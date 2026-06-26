package webapp

import (
	"net/http"
	"os"
	"strings"
)

var adminOpsDoesNotProve = []string{"full SaaS", "payment lifecycle", "team/RBAC lifecycle", "HA", "runtime sync"}

func (server Server) HandleOpsRegistrationPolicy(response http.ResponseWriter, request *http.Request) {
	if !server.operatorAuthorized(response, request) {
		return
	}
	switch request.Method {
	case http.MethodGet:
		server.writeRegistrationPolicy(response, http.StatusOK)
	case http.MethodPut:
		var payload struct {
			RegistrationMode string `json:"registrationMode"`
		}
		if !decodeStrict(response, request, &payload) {
			return
		}
		mode := strings.TrimSpace(payload.RegistrationMode)
		if !validRegistrationMode(mode) {
			writeError(response, http.StatusBadRequest, "INVALID_REGISTRATION_MODE", "registrationMode is invalid")
			return
		}
		previousMode := server.Store.RegistrationMode()
		if err := server.Store.SetRegistrationMode(mode); err != nil {
			writeError(response, http.StatusBadRequest, "INVALID_REGISTRATION_MODE", "registrationMode is invalid")
			return
		}
		server.recordOperatorAudit("ops.registration_policy_updated", map[string]string{
			"actor": "ops", "source": "operator_only_api", "previousMode": previousMode, "nextMode": mode,
		})
		server.writeRegistrationPolicy(response, http.StatusOK)
	default:
		writeError(response, http.StatusMethodNotAllowed, "METHOD_NOT_ALLOWED", "method not allowed")
	}
}

func (server Server) HandleOpsUsers(response http.ResponseWriter, request *http.Request) {
	if !server.operatorAuthorized(response, request) {
		return
	}
	if request.Method != http.MethodGet {
		writeError(response, http.StatusMethodNotAllowed, "METHOD_NOT_ALLOWED", "method not allowed")
		return
	}
	users := []map[string]any{}
	for _, user := range server.Store.ListUsers() {
		users = append(users, server.opsUserSummary(user))
	}
	writeJSON(response, http.StatusOK, map[string]any{
		"ok": true, "owner": "OnePersonLabWeb", "users": users, "doesNotProve": adminOpsDoesNotProve,
	})
}

func (server Server) HandleOpsUserStatus(response http.ResponseWriter, request *http.Request) {
	if !server.operatorAuthorized(response, request) {
		return
	}
	if request.Method != http.MethodPost {
		writeError(response, http.StatusMethodNotAllowed, "METHOD_NOT_ALLOWED", "method not allowed")
		return
	}
	userID := strings.TrimSuffix(strings.TrimPrefix(request.URL.Path, "/api/ops/users/"), "/status")
	if userID == "" || strings.Contains(userID, "/") {
		writeError(response, http.StatusBadRequest, "INVALID_USER_STATUS", "user status path is invalid")
		return
	}
	var payload struct {
		UserStatus string `json:"userStatus"`
	}
	if !decodeStrict(response, request, &payload) {
		return
	}
	nextStatus := strings.TrimSpace(payload.UserStatus)
	if !validUserStatus(nextStatus) {
		writeError(response, http.StatusBadRequest, "INVALID_USER_STATUS", "userStatus is invalid")
		return
	}
	previous, ok := server.Store.FindUserByID(userID)
	if !ok {
		writeError(response, http.StatusNotFound, "USER_NOT_FOUND", "user was not found")
		return
	}
	updated, err := server.Store.SetUserStatus(userID, nextStatus)
	if err != nil {
		writeError(response, http.StatusNotFound, "USER_NOT_FOUND", "user was not found")
		return
	}
	eventKind := "ops.user_enabled"
	if nextStatus == UserStatusDisabled {
		eventKind = "ops.user_disabled"
	}
	metadata := map[string]string{
		"actor": "ops", "source": "operator_only_api", "previousStatus": previous.Status, "nextStatus": nextStatus,
	}
	server.recordAudit(userID, eventKind, metadata)
	server.recordOperatorAudit(eventKind, metadata)
	writeJSON(response, http.StatusOK, server.opsUserSummary(updated))
}

func (server Server) writeRegistrationPolicy(response http.ResponseWriter, status int) {
	writeJSON(response, status, map[string]any{
		"ok": true, "owner": "OnePersonLabWeb", "registrationMode": server.Store.RegistrationMode(),
		"doesNotProve": adminOpsDoesNotProve,
	})
}

func (server Server) opsUserSummary(user User) map[string]any {
	status := user.Status
	if status == "" {
		status = UserStatusActive
	}
	events := server.Store.ListAuditEvents(user.ID)
	latestEventKind := ""
	if len(events) > 0 {
		latestEventKind = events[len(events)-1].EventKind
	}
	return map[string]any{
		"userId": user.ID, "email": user.Email,
		"tenantId": user.TenantID, "workspaceId": user.WorkspaceID, "userStatus": status,
		"createdAt": user.CreatedAt, "quota": server.Store.ChatQuotaStatus(user.ID, chatMonthlyQuota()),
		"auditSummary": map[string]any{"eventCount": len(events), "latestEventKind": latestEventKind},
	}
}

func (server Server) operatorAuthorized(response http.ResponseWriter, request *http.Request) bool {
	expected := strings.TrimSpace(os.Getenv("OPL_ADMIN_OPERATOR_TOKEN"))
	header := strings.TrimSpace(request.Header.Get("authorization"))
	if !strings.HasPrefix(header, "Bearer ") {
		writeError(response, http.StatusUnauthorized, "OPERATOR_AUTH_REQUIRED", "operator authorization is required")
		return false
	}
	provided := strings.TrimSpace(strings.TrimPrefix(header, "Bearer "))
	if expected == "" || provided == "" || provided != expected {
		writeError(response, http.StatusUnauthorized, "OPERATOR_AUTH_REQUIRED", "operator authorization is required")
		return false
	}
	return true
}

func (server Server) recordOperatorAudit(eventKind string, metadata map[string]string) {
	_ = server.Store.RecordOperatorAuditEvent(OperatorAuditEvent{EventKind: eventKind, Metadata: metadata})
}
