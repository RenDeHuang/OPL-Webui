package mvp

import (
	"encoding/json"
	"net/http"
	"strings"

	"github.com/RenDeHuang/OPL-Webui/services/control-plane-go/internal/oplbridge"
	"github.com/RenDeHuang/OPL-Webui/services/control-plane-go/internal/runtimegate"
)

func HandleTask(response http.ResponseWriter, request *http.Request) {
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

	projection, err := CreateTaskResponseWithRoute(request.Context(), payload, oplbridge.NewDefaultRunner())
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

	projection, ok := defaultTaskStore.GetTaskProjection(parts[0], parts[1], parts[2])
	if !ok {
		writeJSON(response, http.StatusNotFound, ErrorResponse{
			OK:        false,
			ErrorCode: "TASK_NOT_FOUND",
			Message:   "task projection was not found",
		})
		return
	}

	writeJSON(response, http.StatusOK, projection)
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
