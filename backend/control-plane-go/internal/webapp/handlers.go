package webapp

import (
	"context"
	"errors"
	"net/http"
	"strings"
	"time"
)

type Server struct {
	Store      Store
	ChatClient ChatClient
}

type errorResponse struct {
	OK        bool   `json:"ok"`
	ErrorCode string `json:"errorCode"`
	Message   string `json:"message"`
}

var defaultStore Store = NewMemoryStore()

func ConfigureDefaultStoreFromEnv() error {
	store, err := OpenStoreFromEnv()
	if err != nil {
		return err
	}
	defaultStore = store
	return nil
}

func RegisterRoutes(mux *http.ServeMux) {
	server := Server{Store: defaultStore}
	mux.HandleFunc("/api/auth/register", server.HandleRegister)
	mux.HandleFunc("/api/auth/login", server.HandleLogin)
	mux.HandleFunc("/api/auth/logout", server.HandleLogout)
	mux.HandleFunc("/api/session/current", server.HandleCurrentSession)
	mux.HandleFunc("/api/settings/model-provider", server.HandleModelProvider)
	mux.HandleFunc("/api/account/audit-events", server.HandleAuditEvents)
	mux.HandleFunc("/api/account/billing-summary", server.HandleBillingSummary)
	mux.HandleFunc("/api/account/commercial-status", server.HandleCommercialStatus)
	mux.HandleFunc("/api/ops/registration-policy", server.HandleOpsRegistrationPolicy)
	mux.HandleFunc("/api/ops/users/", server.HandleOpsUserStatus)
	mux.HandleFunc("/api/ops/users", server.HandleOpsUsers)
	mux.HandleFunc("/api/medopl/runtime/status", server.HandleRuntimeStatus)
	mux.HandleFunc("/api/medopl/materials-deliverables/projection", server.HandleMaterialsDeliverables)
	mux.HandleFunc("/api/opl/runtime-gate", server.HandleRuntimeGate)
	mux.HandleFunc("/api/opl/runs", server.HandleRuntimeRun)
	mux.HandleFunc("/api/tasks/", server.HandleTaskHistoryDetail)
	mux.HandleFunc("/api/tasks", server.HandleTaskHistory)
	mux.HandleFunc("/api/chat/conversations/", server.HandleConversation)
	mux.HandleFunc("/api/chat/conversations", server.HandleConversations)
	mux.HandleFunc("/api/chat", server.HandleChat)
}

func (server Server) HandleRegister(response http.ResponseWriter, request *http.Request) {
	if request.Method != http.MethodPost {
		writeError(response, http.StatusMethodNotAllowed, "METHOD_NOT_ALLOWED", "method not allowed")
		return
	}
	var payload struct {
		Email    string `json:"email"`
		Password string `json:"password"`
	}
	if !decodeStrict(response, request, &payload) {
		return
	}
	hash, err := hashPassword(payload.Password)
	if err != nil || !isValidEmail(payload.Email) {
		writeError(response, http.StatusBadRequest, "INVALID_CREDENTIALS_INPUT", "valid email and password are required")
		return
	}
	user, err := server.Store.CreateUser(payload.Email, hash)
	if errors.Is(err, ErrDuplicateEmail) {
		writeError(response, http.StatusConflict, "EMAIL_ALREADY_REGISTERED", "email already registered")
		return
	}
	if err != nil {
		writeError(response, http.StatusInternalServerError, "ACCOUNT_CREATE_FAILED", "account could not be created")
		return
	}
	server.recordAudit(user.ID, "account.registered", map[string]string{"authMode": AuthMode})
	server.writeSession(response, http.StatusCreated, user)
}

func (server Server) HandleLogin(response http.ResponseWriter, request *http.Request) {
	if request.Method != http.MethodPost {
		writeError(response, http.StatusMethodNotAllowed, "METHOD_NOT_ALLOWED", "method not allowed")
		return
	}
	var payload struct {
		Email    string `json:"email"`
		Password string `json:"password"`
	}
	if !decodeStrict(response, request, &payload) {
		return
	}
	user, ok := server.Store.FindUserByEmail(payload.Email)
	if !ok || !verifyPassword(user.PasswordHash, payload.Password) {
		writeError(response, http.StatusUnauthorized, "INVALID_CREDENTIALS", "email or password is invalid")
		return
	}
	if user.Status == UserStatusDisabled {
		writeError(response, http.StatusLocked, "USER_DISABLED", "user is disabled")
		return
	}
	server.recordAudit(user.ID, "account.login", map[string]string{"authMode": AuthMode})
	server.writeSession(response, http.StatusOK, user)
}

func (server Server) HandleLogout(response http.ResponseWriter, request *http.Request) {
	if request.Method != http.MethodPost {
		writeError(response, http.StatusMethodNotAllowed, "METHOD_NOT_ALLOWED", "method not allowed")
		return
	}
	clearSessionCookie(response)
	response.WriteHeader(http.StatusNoContent)
}

func (server Server) HandleCurrentSession(response http.ResponseWriter, request *http.Request) {
	if request.Method != http.MethodGet {
		writeError(response, http.StatusMethodNotAllowed, "METHOD_NOT_ALLOWED", "method not allowed")
		return
	}
	user, ok := server.currentUser(response, request)
	if !ok {
		return
	}
	writeJSON(response, http.StatusOK, safeSession(user))
}

func (server Server) HandleModelProvider(response http.ResponseWriter, request *http.Request) {
	user, ok := server.currentUser(response, request)
	if !ok {
		return
	}
	switch request.Method {
	case http.MethodGet:
		server.writeProvider(response, user.ID)
	case http.MethodPut:
		var payload struct {
			APIKey string `json:"apiKey"`
		}
		if !decodeStrict(response, request, &payload) {
			return
		}
		if osSecretMissing() {
			writeError(response, http.StatusServiceUnavailable, "API_KEY_SECRET_REQUIRED", "API key encryption secret is required")
			return
		}
		encrypted, err := encryptAPIKey(payload.APIKey)
		if err != nil {
			writeError(response, http.StatusBadRequest, "INVALID_API_KEY", "api key is required")
			return
		}
		binding := APIKeyBinding{
			UserID: user.ID, Provider: ProviderName, BaseURL: FixedBaseURL,
			EncryptedAPIKey: encrypted, MaskedKey: maskAPIKey(payload.APIKey),
		}
		if err := server.Store.SaveAPIKeyBinding(binding); err != nil {
			writeError(response, http.StatusInternalServerError, "API_KEY_SAVE_FAILED", "api key could not be saved")
			return
		}
		server.recordAudit(user.ID, "api_key.saved", map[string]string{"provider": ProviderName, "baseUrl": FixedBaseURL})
		server.writeProvider(response, user.ID)
	default:
		writeError(response, http.StatusMethodNotAllowed, "METHOD_NOT_ALLOWED", "method not allowed")
	}
}

func (server Server) HandleChat(response http.ResponseWriter, request *http.Request) {
	if request.Method != http.MethodPost {
		writeError(response, http.StatusMethodNotAllowed, "METHOD_NOT_ALLOWED", "method not allowed")
		return
	}
	user, ok := server.currentUser(response, request)
	if !ok {
		return
	}
	var payload struct {
		Message        string `json:"message"`
		ConversationID string `json:"conversationId,omitempty"`
	}
	if !decodeStrict(response, request, &payload) {
		return
	}
	payload.Message = strings.TrimSpace(payload.Message)
	if payload.Message == "" {
		writeError(response, http.StatusBadRequest, "INVALID_CHAT_MESSAGE", "message is required")
		return
	}
	conversation, ok := server.ensureConversation(user.ID, payload.ConversationID, payload.Message)
	if !ok {
		writeError(response, http.StatusNotFound, "CONVERSATION_NOT_FOUND", "conversation was not found")
		return
	}
	_ = server.Store.AddMessage(ChatMessage{ConversationID: conversation.ID, UserID: user.ID, Role: "user", Content: payload.Message})
	if conversation.Title == "新聊天" {
		if renamed, err := server.Store.UpdateConversationTitle(user.ID, conversation.ID, conversationTitleFromMessage(payload.Message)); err == nil {
			conversation = renamed
		}
	}
	if requiresRuntime(payload.Message) {
		server.writeRuntimeRequired(response, user.ID, conversation.ID)
		return
	}
	binding, ok := server.Store.GetAPIKeyBinding(user.ID)
	if !ok {
		writeError(response, http.StatusBadRequest, "API_KEY_REQUIRED", "user API key is required")
		return
	}
	apiKey, err := decryptAPIKey(binding.EncryptedAPIKey)
	if err != nil {
		writeError(response, http.StatusServiceUnavailable, "API_KEY_DECRYPT_FAILED", "api key binding is unavailable")
		return
	}
	status, allowed := server.Store.ConsumeChatQuota(user.ID, chatMonthlyQuota())
	if !allowed {
		server.recordAudit(user.ID, "chat.quota_exceeded", map[string]string{"conversationId": conversation.ID})
		writeJSON(response, http.StatusTooManyRequests, map[string]any{
			"ok": false, "errorCode": "CHAT_QUOTA_EXCEEDED", "message": "monthly chat quota exceeded",
			"conversationId": conversation.ID, "quota": status,
		})
		return
	}
	ctx, cancel := context.WithTimeout(request.Context(), server.ChatClient.HTTPTimeout()+5*time.Second)
	defer cancel()
	content, err := server.ChatClient.Complete(ctx, apiKey, payload.Message)
	if err != nil {
		status := http.StatusBadGateway
		var upstreamFailure UpstreamFailure
		if errors.As(err, &upstreamFailure) && upstreamFailure.Timeout() {
			status = http.StatusGatewayTimeout
		}
		if !errors.As(err, &upstreamFailure) {
			upstreamFailure = UpstreamFailure{Kind: "unknown", Host: upstreamHost(), Model: modelName()}
		}
		server.recordAudit(user.ID, "chat.upstream_failed", upstreamFailure.Metadata(conversation.ID))
		writeJSON(response, status, map[string]any{
			"ok": false, "errorCode": "UPSTREAM_CHAT_FAILED", "message": "chat upstream returned an error",
			"conversationId": conversation.ID,
			"upstream":       upstreamFailure.Public(),
		})
		return
	}
	assistant := ChatMessage{ConversationID: conversation.ID, UserID: user.ID, Role: "assistant", Content: content}
	_ = server.Store.AddMessage(assistant)
	server.recordAudit(user.ID, "chat.completed", map[string]string{"conversationId": conversation.ID, "model": modelName()})
	writeJSON(response, http.StatusOK, map[string]any{
		"ok": true, "conversationId": conversation.ID, "model": modelName(),
		"assistantMessage": map[string]string{"role": "assistant", "content": content},
	})
}
