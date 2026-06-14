package mvp

import (
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"net/http"
	"strings"

	"github.com/RenDeHuang/OPL-Webui/services/control-plane-go/internal/oplbridge"
)

type TaskRequest struct {
	TenantID    string `json:"tenantId"`
	WorkspaceID string `json:"workspaceId"`
	UserID      string `json:"userId"`
	Prompt      string `json:"prompt"`
	Intent      string `json:"intent,omitempty"`
}

type Task struct {
	TaskID          string   `json:"taskId"`
	TenantID        string   `json:"tenantId"`
	WorkspaceID     string   `json:"workspaceId"`
	Intent          string   `json:"intent"`
	Status          string   `json:"status"`
	CommandPolicyID string   `json:"commandPolicyId"`
	ArtifactRefs    []string `json:"artifactRefs"`
}

type Artifact struct {
	ArtifactID  string   `json:"artifactId"`
	TenantID    string   `json:"tenantId"`
	WorkspaceID string   `json:"workspaceId"`
	Kind        string   `json:"kind"`
	Version     int      `json:"version"`
	SourceRefs  []string `json:"sourceRefs"`
	DownloadRef string   `json:"downloadRef"`
}

type AdapterProjection struct {
	Command  []string             `json:"command"`
	PolicyID string               `json:"policyId"`
	Mode     string               `json:"mode"`
	Route    *oplbridge.TaskRoute `json:"route,omitempty"`
}

type TaskResponse struct {
	OK          bool              `json:"ok"`
	RunID       string            `json:"runId"`
	UserID      string            `json:"userId"`
	TenantID    string            `json:"tenantId"`
	WorkspaceID string            `json:"workspaceId"`
	Prompt      string            `json:"prompt"`
	Task        Task              `json:"task"`
	Artifacts   []Artifact        `json:"artifacts"`
	Adapter     AdapterProjection `json:"adapter"`
}

type ErrorResponse struct {
	OK        bool   `json:"ok"`
	ErrorCode string `json:"errorCode"`
	Message   string `json:"message"`
}

func CreateTaskResponse(input TaskRequest) (TaskResponse, error) {
	return CreateTaskResponseWithRoute(context.Background(), input, nil)
}

func CreateTaskResponseWithRoute(ctx context.Context, input TaskRequest, runner oplbridge.Runner) (TaskResponse, error) {
	request, err := validateRequest(input)
	if err != nil {
		return TaskResponse{}, err
	}

	taskID := request.WorkspaceID + "_task_001"
	artifactID := taskID + "_artifact_001"
	policyID := oplbridge.TaskRoutePolicyID
	route := (*oplbridge.TaskRoute)(nil)
	if runner != nil {
		projection := oplbridge.BuildTaskRoute(ctx, runner, oplbridge.TaskRouteRequest{
			Prompt: request.Prompt,
			Intent: request.Intent,
			Target: "deliverable",
		})
		route = &projection
	}

	return TaskResponse{
		OK:          true,
		RunID:       fmt.Sprintf("run_%s_%s_001", request.WorkspaceID, request.UserID),
		UserID:      request.UserID,
		TenantID:    request.TenantID,
		WorkspaceID: request.WorkspaceID,
		Prompt:      request.Prompt,
		Task: Task{
			TaskID:          taskID,
			TenantID:        request.TenantID,
			WorkspaceID:     request.WorkspaceID,
			Intent:          request.Intent,
			Status:          "completed",
			CommandPolicyID: policyID,
			ArtifactRefs:    []string{artifactID},
		},
		Artifacts: []Artifact{
			{
				ArtifactID:  artifactID,
				TenantID:    request.TenantID,
				WorkspaceID: request.WorkspaceID,
				Kind:        artifactKind(request.Intent),
				Version:     1,
				SourceRefs:  []string{policyID, taskID},
				DownloadRef: fmt.Sprintf("demo://%s/%s", request.WorkspaceID, artifactID),
			},
		},
		Adapter: AdapterProjection{
			Command:  []string{"opl", "contract", "handoff-envelope"},
			PolicyID: policyID,
			Mode:     "readonly",
			Route:    route,
		},
	}, nil
}

func HandleTask(response http.ResponseWriter, request *http.Request) {
	if request.Method != http.MethodPost {
		writeJSON(response, http.StatusMethodNotAllowed, ErrorResponse{
			OK:        false,
			ErrorCode: "METHOD_NOT_ALLOWED",
			Message:   "method not allowed",
		})
		return
	}

	var payload TaskRequest
	if err := json.NewDecoder(request.Body).Decode(&payload); err != nil {
		writeInvalid(response, err)
		return
	}

	projection, err := CreateTaskResponseWithRoute(request.Context(), payload, oplbridge.NewDefaultRunner())
	if err != nil {
		writeInvalid(response, err)
		return
	}

	writeJSON(response, http.StatusOK, projection)
}

func validateRequest(input TaskRequest) (TaskRequest, error) {
	input.TenantID = strings.TrimSpace(input.TenantID)
	input.WorkspaceID = strings.TrimSpace(input.WorkspaceID)
	input.UserID = strings.TrimSpace(input.UserID)
	input.Prompt = strings.TrimSpace(input.Prompt)
	input.Intent = strings.TrimSpace(input.Intent)
	if input.Intent == "" {
		input.Intent = "general"
	}

	switch {
	case input.TenantID == "":
		return TaskRequest{}, errors.New("tenantId is required")
	case input.WorkspaceID == "":
		return TaskRequest{}, errors.New("workspaceId is required")
	case input.UserID == "":
		return TaskRequest{}, errors.New("userId is required")
	case input.Prompt == "":
		return TaskRequest{}, errors.New("prompt is required")
	}

	return input, nil
}

func artifactKind(intent string) string {
	switch intent {
	case "research":
		return "analysis_package"
	case "grant":
		return "grant_package"
	case "presentation":
		return "slide_deck"
	default:
		return "document"
	}
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
