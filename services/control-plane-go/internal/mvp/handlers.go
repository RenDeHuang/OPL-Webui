package mvp

import (
	"encoding/json"
	"net/http"
	"strings"

	"github.com/RenDeHuang/OPL-Webui/services/control-plane-go/internal/oplbridge"
	"github.com/RenDeHuang/OPL-Webui/services/control-plane-go/internal/runtimegate"
)

func HandleTask(response http.ResponseWriter, request *http.Request) {
	handleTaskWithRunner(response, request, oplbridge.NewDefaultRunner())
}

func HandleSessionLaunch(response http.ResponseWriter, request *http.Request) {
	if request.Method != http.MethodPost {
		writeJSON(response, http.StatusMethodNotAllowed, ErrorResponse{
			OK:        false,
			ErrorCode: "METHOD_NOT_ALLOWED",
			Message:   "method not allowed",
		})
		return
	}

	claims, authErr := launchClaimsFromRequest(request)
	if authErr != nil {
		writeTaskAuthError(response, authErr)
		return
	}
	sessionToken, authErr := signSessionToken(claims)
	if authErr != nil {
		writeTaskAuthError(response, authErr)
		return
	}

	http.SetCookie(response, &http.Cookie{
		Name:     sessionCookieName,
		Value:    sessionToken,
		Path:     "/",
		HttpOnly: true,
		SameSite: http.SameSiteLaxMode,
	})
	response.WriteHeader(http.StatusNoContent)
}

func HandleSessionCurrent(response http.ResponseWriter, request *http.Request) {
	if request.Method != http.MethodGet {
		writeJSON(response, http.StatusMethodNotAllowed, ErrorResponse{
			OK:        false,
			ErrorCode: "METHOD_NOT_ALLOWED",
			Message:   "method not allowed",
		})
		return
	}

	claims, authErr := launchClaimsFromRequest(request)
	if authErr != nil {
		writeTaskAuthError(response, authErr)
		return
	}
	writeJSON(response, http.StatusOK, map[string]any{
		"ok":          true,
		"tenantId":    claims.TenantID,
		"workspaceId": claims.WorkspaceID,
		"userId":      claims.UserID,
		"authMode":    launchTokenAuthMode,
	})
}

func handleTaskWithRunner(response http.ResponseWriter, request *http.Request, runner oplbridge.Runner) {
	if request.Method != http.MethodPost {
		writeJSON(response, http.StatusMethodNotAllowed, ErrorResponse{
			OK:        false,
			ErrorCode: "METHOD_NOT_ALLOWED",
			Message:   "method not allowed",
		})
		return
	}

	if status := runtimegate.CurrentStatus(); !status.OK {
		writeJSON(response, http.StatusServiceUnavailable, ErrorResponse{
			OK:        false,
			ErrorCode: "PRODUCTION_RUNTIME_NOT_READY",
			Message:   "production runtime dependencies are not configured",
		})
		return
	}

	var payload TaskRequest
	decoder := json.NewDecoder(request.Body)
	decoder.DisallowUnknownFields()
	if err := decoder.Decode(&payload); err != nil {
		writeInvalid(response, err)
		return
	}

	authorizedPayload, authErr := applyTaskAuthBoundary(request, payload)
	if authErr != nil {
		writeTaskAuthError(response, authErr)
		return
	}

	projection, err := CreateTaskResponseWithRoute(request.Context(), authorizedPayload, runner)
	if err != nil {
		writeInvalid(response, err)
		return
	}
	if err := defaultTaskStore.SaveTaskProjection(projection); err != nil {
		writeJSON(response, http.StatusInternalServerError, ErrorResponse{
			OK:        false,
			ErrorCode: "TASK_STORE_WRITE_FAILED",
			Message:   err.Error(),
		})
		return
	}

	writeJSON(response, http.StatusOK, projection)
}

func HandleStoredTask(response http.ResponseWriter, request *http.Request) {
	if request.Method != http.MethodGet {
		writeJSON(response, http.StatusMethodNotAllowed, ErrorResponse{
			OK:        false,
			ErrorCode: "METHOD_NOT_ALLOWED",
			Message:   "method not allowed",
		})
		return
	}

	parts := strings.Split(strings.TrimPrefix(request.URL.Path, "/api/mvp/tasks/"), "/")
	if len(parts) != 3 || parts[0] == "" || parts[1] == "" || parts[2] == "" {
		writeJSON(response, http.StatusBadRequest, ErrorResponse{
			OK:        false,
			ErrorCode: "INVALID_TASK_LOOKUP",
			Message:   "tenantId, workspaceId, and taskId are required",
		})
		return
	}

	claims, authErr := authorizeTaskLookup(request, parts[0], parts[1])
	if authErr != nil {
		writeTaskAuthError(response, authErr)
		return
	}

	projection, ok := defaultTaskStore.GetTaskProjection(parts[0], parts[1], parts[2])
	if !ok {
		writeJSON(response, http.StatusNotFound, ErrorResponse{
			OK:        false,
			ErrorCode: "TASK_NOT_FOUND",
			Message:   "task projection was not found",
		})
		return
	}
	if claims != nil && projection.UserID != claims.UserID {
		writeTaskAuthError(response, boundaryMismatch())
		return
	}

	writeJSON(response, http.StatusOK, projection)
}

func writeTaskAuthError(response http.ResponseWriter, err *taskAuthError) {
	writeJSON(response, err.StatusCode, ErrorResponse{
		OK:        false,
		ErrorCode: err.ErrorCode,
		Message:   err.Message,
	})
}

func writeInvalid(response http.ResponseWriter, err error) {
	writeJSON(response, http.StatusBadRequest, ErrorResponse{
		OK:        false,
		ErrorCode: "INVALID_MVP_TASK_REQUEST",
		Message:   err.Error(),
	})
}

func writeJSON(response http.ResponseWriter, status int, body any) {
	response.Header().Set("content-type", "application/json; charset=utf-8")
	response.WriteHeader(status)
	_ = json.NewEncoder(response).Encode(body)
}
