package webapp

import (
	"encoding/json"
	"net/http"
	"os"
	"strconv"
	"strings"
)

const defaultChatMonthlyQuota = 100

func (server Server) HandleAuditEvents(response http.ResponseWriter, request *http.Request) {
	if request.Method != http.MethodGet {
		writeError(response, http.StatusMethodNotAllowed, "METHOD_NOT_ALLOWED", "method not allowed")
		return
	}
	user, ok := server.currentUser(response, request)
	if !ok {
		return
	}
	writeJSON(response, http.StatusOK, map[string]any{"ok": true, "events": server.Store.ListAuditEvents(user.ID)})
}

func (server Server) HandleBillingSummary(response http.ResponseWriter, request *http.Request) {
	if request.Method != http.MethodGet {
		writeError(response, http.StatusMethodNotAllowed, "METHOD_NOT_ALLOWED", "method not allowed")
		return
	}
	user, ok := server.currentUser(response, request)
	if !ok {
		return
	}
	events := server.Store.ListAuditEvents(user.ID)
	latestEventKind := ""
	if len(events) > 0 {
		latestEventKind = events[len(events)-1].EventKind
	}
	limit := chatMonthlyQuota()
	quota := server.Store.ChatQuotaStatus(user.ID, limit)
	if projection, ok := server.tryMedOPLBillingProjection(request, quota, events); ok {
		writeJSON(response, http.StatusOK, projection)
		return
	}
	writeJSON(response, http.StatusOK, map[string]any{
		"ok": true, "owner": "MedOPL", "deepLink": MedOPLURL + "/billing",
		"quota":                     quota,
		"audit":                     map[string]any{"eventCount": len(events), "latestEventKind": latestEventKind},
		"webuiBillingSourceOfTruth": "forbidden",
		"webuiPaymentMutation":      "forbidden",
	})
}

func (server Server) HandleCommercialStatus(response http.ResponseWriter, request *http.Request) {
	if request.Method != http.MethodGet {
		writeError(response, http.StatusMethodNotAllowed, "METHOD_NOT_ALLOWED", "method not allowed")
		return
	}
	user, ok := server.currentUser(response, request)
	if !ok {
		return
	}
	writeJSON(response, http.StatusOK, map[string]any{
		"ok": true, "owner": "OnePersonLabWeb", "productId": "one-person-lab-web",
		"accountType": "personal", "lifecycleState": "active",
		"tenantId": user.TenantID, "tenantRole": "owner",
		"teamReadiness": map[string]any{
			"state":              "single_user_owner",
			"owner":              "OnePersonLabWeb",
			"consumer":           "settings_lifecycle_summary",
			"allowedNextActions": []string{"view_medopl_billing"},
		},
		"webuiTeamMutation":         "forbidden",
		"webuiInviteMutation":       "forbidden",
		"webuiRBACMutation":         "forbidden",
		"webuiPaymentMutation":      "forbidden",
		"webuiBillingSourceOfTruth": "forbidden",
	})
}

func (server Server) HandleConversations(response http.ResponseWriter, request *http.Request) {
	if request.Method != http.MethodGet {
		writeError(response, http.StatusMethodNotAllowed, "METHOD_NOT_ALLOWED", "method not allowed")
		return
	}
	user, ok := server.currentUser(response, request)
	if !ok {
		return
	}
	writeJSON(response, http.StatusOK, map[string]any{"ok": true, "conversations": server.Store.ListConversations(user.ID)})
}

func (server Server) HandleRuntimeStatus(response http.ResponseWriter, request *http.Request) {
	if request.Method != http.MethodGet {
		writeError(response, http.StatusMethodNotAllowed, "METHOD_NOT_ALLOWED", "method not allowed")
		return
	}
	writeJSON(response, http.StatusOK, runtimeStatusProjection())
}

func (server Server) HandleMaterialsDeliverables(response http.ResponseWriter, request *http.Request) {
	if request.Method != http.MethodGet {
		writeError(response, http.StatusMethodNotAllowed, "METHOD_NOT_ALLOWED", "method not allowed")
		return
	}
	writeJSON(response, http.StatusOK, materialsDeliverablesProjection())
}

func (server Server) HandleConversation(response http.ResponseWriter, request *http.Request) {
	if request.Method != http.MethodGet {
		writeError(response, http.StatusMethodNotAllowed, "METHOD_NOT_ALLOWED", "method not allowed")
		return
	}
	user, ok := server.currentUser(response, request)
	if !ok {
		return
	}
	conversationID := strings.TrimPrefix(request.URL.Path, "/api/chat/conversations/")
	if conversationID == "" || strings.Contains(conversationID, "/") {
		writeError(response, http.StatusBadRequest, "INVALID_CONVERSATION_ID", "conversationId is required")
		return
	}
	conversation, messages, ok := server.Store.GetConversation(user.ID, conversationID)
	if !ok {
		writeError(response, http.StatusNotFound, "CONVERSATION_NOT_FOUND", "conversation was not found")
		return
	}
	writeJSON(response, http.StatusOK, map[string]any{"ok": true, "conversation": conversation, "messages": messages})
}

func runtimeStatusProjection() map[string]any {
	state := strings.TrimSpace(os.Getenv("MEDOPL_RUNTIME_STATE"))
	if state == "" {
		state = "required"
	}
	if state != "not_connected" && state != "required" && state != "ready" {
		state = "required"
	}
	counts := map[string]any{"activeRuns": runtimeCount("MEDOPL_RUNTIME_ACTIVE_RUNS")}
	refs := map[string]any{}
	if runtimeRef := strings.TrimSpace(os.Getenv("MEDOPL_RUNTIME_REF")); runtimeRef != "" {
		refs["runtimeRef"] = runtimeRef
	}
	return map[string]any{
		"ok": true, "owner": "MedOPL", "state": state,
		"deepLink": MedOPLURL + "/runtime",
		"refs":     refs, "counts": counts,
		"webuiRuntimeExecution": "forbidden",
	}
}

func materialsDeliverablesProjection() map[string]any {
	materials := []map[string]any{}
	if materialRef := strings.TrimSpace(os.Getenv("MEDOPL_MATERIAL_REF")); materialRef != "" {
		materials = append(materials, map[string]any{
			"materialId": materialRef,
			"title":      "Linked material",
			"kind":       "reference",
			"status":     "ready",
		})
	}
	deliverables := []map[string]any{}
	if deliverableRef := strings.TrimSpace(os.Getenv("MEDOPL_DELIVERABLE_REF")); deliverableRef != "" {
		deliverables = append(deliverables, map[string]any{
			"deliverableId": deliverableRef,
			"title":         "Linked deliverable",
			"kind":          "artifact_ref",
			"status":        "draft",
			"ref":           deliverableRef,
		})
	}
	return map[string]any{
		"ok": true, "owner": "MedOPL",
		"deepLink":             MedOPLURL + "/materials",
		"materials":            materials,
		"deliverables":         deliverables,
		"webuiStorageMutation": "forbidden",
		"webuiArtifactBody":    "forbidden",
	}
}

func (server Server) currentUser(response http.ResponseWriter, request *http.Request) (User, bool) {
	claims, err := parseSessionCookie(request)
	if err != nil {
		writeError(response, http.StatusUnauthorized, "AUTH_REQUIRED", "session cookie is required")
		return User{}, false
	}
	user, ok := server.Store.FindUserByID(claims.UserID)
	if !ok || user.TenantID != claims.TenantID || user.WorkspaceID != claims.WorkspaceID || user.Email != claims.Email {
		writeError(response, http.StatusUnauthorized, "AUTH_REQUIRED", "session cookie is invalid")
		return User{}, false
	}
	return user, true
}

func (server Server) writeSession(response http.ResponseWriter, status int, user User) {
	token, err := signSession(claimsFromUser(user))
	if err != nil {
		writeError(response, http.StatusServiceUnavailable, "SESSION_SECRET_REQUIRED", "session secret is required")
		return
	}
	setSessionCookie(response, token)
	writeJSON(response, status, safeSession(user))
}

func (server Server) writeProvider(response http.ResponseWriter, userID string) {
	body := map[string]any{
		"ok": true, "provider": ProviderName, "baseUrl": FixedBaseURL,
		"apiKeyConfigured": false, "maskedKey": "",
	}
	if binding, ok := server.Store.GetAPIKeyBinding(userID); ok {
		body["apiKeyConfigured"] = true
		body["maskedKey"] = binding.MaskedKey
	}
	writeJSON(response, http.StatusOK, body)
}

func (server Server) ensureConversation(userID string, conversationID string, message string) (Conversation, bool) {
	if conversationID != "" {
		conversation, _, ok := server.Store.GetConversation(userID, conversationID)
		return conversation, ok
	}
	title := message
	if len([]rune(title)) > 32 {
		title = string([]rune(title)[:32])
	}
	conversation, err := server.Store.CreateConversation(userID, title)
	return conversation, err == nil
}

func (server Server) writeRuntimeRequired(response http.ResponseWriter, userID string, conversationID string) {
	content := "该能力需要 MedOPL Runtime / Storage / Node Pool"
	_ = server.Store.AddMessage(ChatMessage{ConversationID: conversationID, UserID: userID, Role: "assistant", Content: content})
	server.recordAudit(userID, "runtime_gate.required", map[string]string{"conversationId": conversationID})
	writeJSON(response, http.StatusConflict, map[string]any{
		"ok": false, "errorCode": "RUNTIME_REQUIRED", "message": content,
		"conversationId": conversationID, "medoplDeepLink": MedOPLURL + "/runtime/open?source=opl-webui",
	})
}

func decodeStrict(response http.ResponseWriter, request *http.Request, target any) bool {
	decoder := json.NewDecoder(request.Body)
	decoder.DisallowUnknownFields()
	if err := decoder.Decode(target); err != nil {
		writeError(response, http.StatusBadRequest, "INVALID_JSON", err.Error())
		return false
	}
	return true
}

func writeJSON(response http.ResponseWriter, status int, body any) {
	response.Header().Set("content-type", "application/json; charset=utf-8")
	response.WriteHeader(status)
	_ = json.NewEncoder(response).Encode(body)
}

func writeError(response http.ResponseWriter, status int, code string, message string) {
	writeJSON(response, status, errorResponse{OK: false, ErrorCode: code, Message: message})
}

func safeSession(user User) map[string]any {
	return map[string]any{
		"ok": true, "email": user.Email, "userId": user.ID,
		"tenantId": user.TenantID, "workspaceId": user.WorkspaceID, "authMode": AuthMode,
	}
}

func claimsFromUser(user User) SessionClaims {
	return SessionClaims{UserID: user.ID, TenantID: user.TenantID, WorkspaceID: user.WorkspaceID, Email: user.Email}
}

func osSecretMissing() bool {
	return strings.TrimSpace(os.Getenv("OPL_API_KEY_ENCRYPTION_SECRET")) == ""
}

func (server Server) recordAudit(userID string, eventKind string, metadata map[string]string) {
	_ = server.Store.RecordAuditEvent(AuditEvent{UserID: userID, EventKind: eventKind, Metadata: metadata})
}

func chatMonthlyQuota() int {
	value := strings.TrimSpace(os.Getenv("OPL_CHAT_MONTHLY_QUOTA"))
	if value == "" {
		return defaultChatMonthlyQuota
	}
	quota, err := strconv.Atoi(value)
	if err != nil || quota < 1 {
		return defaultChatMonthlyQuota
	}
	return quota
}

func runtimeCount(key string) int {
	value := strings.TrimSpace(os.Getenv(key))
	if value == "" {
		return 0
	}
	count, err := strconv.Atoi(value)
	if err != nil || count < 0 {
		return 0
	}
	return count
}
