package mvp

import (
	"encoding/json"
	"errors"
	"net/http"
	"strings"

	"github.com/RenDeHuang/OPL-Webui/services/control-plane-go/internal/oplbridge"
)

type WorkspaceRef struct {
	ID   string `json:"id"`
	Name string `json:"name"`
}

type WorkspaceCurrentResponse struct {
	OK            bool                 `json:"ok"`
	TenantID      string               `json:"tenantId"`
	WorkspaceID   string               `json:"workspaceId"`
	UserID        string               `json:"userId"`
	TenantRole    string               `json:"tenantRole"`
	WorkspaceRole string               `json:"workspaceRole"`
	Workspace     WorkspaceRef         `json:"workspace"`
	UsageQuota    UsageQuotaProjection `json:"usageQuota"`
}

type TaskListResponse struct {
	OK          bool           `json:"ok"`
	TenantID    string         `json:"tenantId"`
	WorkspaceID string         `json:"workspaceId"`
	UserID      string         `json:"userId"`
	Tasks       []TaskResponse `json:"tasks"`
}

type SaaSTaskRequest struct {
	Prompt string `json:"prompt"`
	Intent string `json:"intent,omitempty"`
}

type sqlStatement struct {
	query string
	args  []any
}

const PostgresSaaSSchema = `
create table if not exists users (
  id text primary key,
  display_name text not null
);
create table if not exists tenants (
  id text primary key,
  name text not null
);
create table if not exists tenant_memberships (
  tenant_id text not null references tenants(id),
  user_id text not null references users(id),
  role text not null,
  primary key (tenant_id, user_id)
);
create table if not exists workspaces (
  tenant_id text not null references tenants(id),
  id text not null,
  name text not null,
  primary key (tenant_id, id)
);
create table if not exists workspace_memberships (
  tenant_id text not null,
  workspace_id text not null,
  user_id text not null references users(id),
  role text not null,
  primary key (tenant_id, workspace_id, user_id),
  foreign key (tenant_id, workspace_id) references workspaces(tenant_id, id)
);`

func HandleWorkspaceCurrent(response http.ResponseWriter, request *http.Request) {
	if request.Method != http.MethodGet {
		writeMethodNotAllowed(response)
		return
	}
	current, authErr := currentWorkspaceFromRequest(request)
	if authErr != nil {
		writeTaskAuthError(response, authErr)
		return
	}
	writeJSON(response, http.StatusOK, current)
}

func HandleSaaSTasks(response http.ResponseWriter, request *http.Request) {
	switch request.Method {
	case http.MethodGet:
		current, authErr := currentWorkspaceFromRequest(request)
		if authErr != nil {
			writeTaskAuthError(response, authErr)
			return
		}
		writeJSON(response, http.StatusOK, TaskListResponse{
			OK: true, TenantID: current.TenantID, WorkspaceID: current.WorkspaceID, UserID: current.UserID,
			Tasks: defaultTaskStore.ListTaskProjections(current.TenantID, current.WorkspaceID, current.UserID),
		})
	case http.MethodPost:
		handleSaaSTaskCreate(response, request, oplbridge.NewDefaultRunner())
	default:
		writeMethodNotAllowed(response)
	}
}

func HandleSaaSTask(response http.ResponseWriter, request *http.Request) {
	if request.Method != http.MethodGet {
		writeMethodNotAllowed(response)
		return
	}
	current, authErr := currentWorkspaceFromRequest(request)
	if authErr != nil {
		writeTaskAuthError(response, authErr)
		return
	}
	taskID := strings.Trim(strings.TrimPrefix(request.URL.Path, "/api/tasks/"), "/")
	if taskID == "" || strings.Contains(taskID, "/") {
		writeJSON(response, http.StatusBadRequest, ErrorResponse{OK: false, ErrorCode: "INVALID_TASK_LOOKUP", Message: "taskId is required"})
		return
	}
	projection, ok := defaultTaskStore.GetTaskProjection(current.TenantID, current.WorkspaceID, taskID)
	if !ok || projection.UserID != current.UserID {
		writeJSON(response, http.StatusNotFound, ErrorResponse{OK: false, ErrorCode: "TASK_NOT_FOUND", Message: "task projection was not found"})
		return
	}
	writeJSON(response, http.StatusOK, projection)
}

func handleSaaSTaskCreate(response http.ResponseWriter, request *http.Request, runner oplbridge.Runner) {
	current, authErr := currentWorkspaceFromRequest(request)
	if authErr != nil {
		writeTaskAuthError(response, authErr)
		return
	}
	var payload SaaSTaskRequest
	decoder := json.NewDecoder(request.Body)
	decoder.DisallowUnknownFields()
	if err := decoder.Decode(&payload); err != nil {
		writeInvalid(response, err)
		return
	}
	projection, err := CreateTaskResponseWithRoute(request.Context(), TaskRequest{
		TenantID: current.TenantID, WorkspaceID: current.WorkspaceID, UserID: current.UserID,
		Prompt: payload.Prompt, Intent: payload.Intent,
	}, runner)
	if err != nil {
		writeInvalid(response, err)
		return
	}
	if err := defaultTaskStore.SaveTaskProjectionWithQuota(projection); err != nil {
		if errors.Is(err, ErrQuotaExceeded) {
			writeJSON(response, http.StatusTooManyRequests, ErrorResponse{OK: false, ErrorCode: "QUOTA_EXCEEDED", Message: err.Error()})
			return
		}
		writeJSON(response, http.StatusInternalServerError, ErrorResponse{OK: false, ErrorCode: "TASK_STORE_WRITE_FAILED", Message: err.Error()})
		return
	}
	writeJSON(response, http.StatusOK, projection)
}

func currentWorkspaceFromRequest(request *http.Request) (WorkspaceCurrentResponse, *taskAuthError) {
	claims, authErr := launchClaimsFromRequest(request)
	if authErr != nil {
		return WorkspaceCurrentResponse{}, authErr
	}
	current, ok := defaultTaskStore.GetCurrentWorkspace(claims)
	if !ok {
		return WorkspaceCurrentResponse{}, membershipRequired()
	}
	current.UsageQuota = defaultTaskStore.GetUsageQuota(current.TenantID, current.WorkspaceID)
	return current, nil
}

func (store *MemoryTaskStore) EnsureWorkspaceMembership(claims launchTokenClaims) error {
	store.mu.Lock()
	defer store.mu.Unlock()
	store.memberships[membershipKey(claims)] = workspaceCurrentFromClaims(claims)
	return nil
}

func (store *MemoryTaskStore) GetCurrentWorkspace(claims launchTokenClaims) (WorkspaceCurrentResponse, bool) {
	store.mu.RLock()
	defer store.mu.RUnlock()
	current, ok := store.memberships[membershipKey(claims)]
	return current, ok
}

func membershipRequired() *taskAuthError {
	return &taskAuthError{StatusCode: http.StatusForbidden, ErrorCode: "MEMBERSHIP_REQUIRED", Message: "workspace membership is required"}
}

func membershipKey(claims launchTokenClaims) string {
	return "__membership__/" + claims.TenantID + "/" + claims.WorkspaceID + "/" + claims.UserID
}

func workspaceCurrentFromClaims(claims launchTokenClaims) WorkspaceCurrentResponse {
	return WorkspaceCurrentResponse{
		OK: true, TenantID: claims.TenantID, WorkspaceID: claims.WorkspaceID, UserID: claims.UserID,
		TenantRole: "owner", WorkspaceRole: "owner", Workspace: WorkspaceRef{ID: claims.WorkspaceID, Name: claims.WorkspaceID},
		UsageQuota: usageQuotaFromCount(0),
	}
}

func workspaceMembershipStatements(claims launchTokenClaims) []sqlStatement {
	return []sqlStatement{
		{query: `insert into users (id, display_name) values ($1, $1) on conflict (id) do nothing`, args: []any{claims.UserID}},
		{query: `insert into tenants (id, name) values ($1, $1) on conflict (id) do nothing`, args: []any{claims.TenantID}},
		{query: `insert into tenant_memberships (tenant_id, user_id, role) values ($1, $2, $3) on conflict (tenant_id, user_id) do nothing`, args: []any{claims.TenantID, claims.UserID, "owner"}},
		{query: `insert into workspaces (tenant_id, id, name) values ($1, $2, $2) on conflict (tenant_id, id) do nothing`, args: []any{claims.TenantID, claims.WorkspaceID}},
		{query: `insert into workspace_memberships (tenant_id, workspace_id, user_id, role) values ($1, $2, $3, $4) on conflict (tenant_id, workspace_id, user_id) do nothing`, args: []any{claims.TenantID, claims.WorkspaceID, claims.UserID, "owner"}},
	}
}
