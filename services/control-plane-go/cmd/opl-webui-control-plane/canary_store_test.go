package main

import "github.com/RenDeHuang/OPL-Webui/services/control-plane-go/internal/mvp"

func (store *readFailingCanaryStore) SaveTaskProjection(projection mvp.TaskResponse) error {
	store.projection = projection
	return nil
}

func (store *readFailingCanaryStore) SaveTaskProjectionWithQuota(projection mvp.TaskResponse) error {
	return store.SaveTaskProjection(projection)
}

func (store *readFailingCanaryStore) GetUsageQuota(string, string) mvp.UsageQuotaProjection {
	return mvp.UsageQuotaProjection{Plan: "mvp", TaskQuota: 2, UsagePeriod: "monthly", RemainingCount: 2}
}

func (store *readFailingCanaryStore) GetTaskProjection(string, string, string) (mvp.TaskResponse, bool) {
	return mvp.TaskResponse{}, false
}

func (store *readFailingCanaryStore) ListTaskProjections(string, string, string) []mvp.TaskResponse {
	return []mvp.TaskResponse{}
}

func (store *readFailingCanaryStore) DeleteTaskProjection(tenantID string, workspaceID string, taskID string) error {
	if tenantID == store.projection.TenantID && workspaceID == store.projection.WorkspaceID && taskID == store.projection.Task.TaskID {
		store.deleted = true
	}
	return nil
}

func (store *readFailingCanaryStore) EnsureWorkspaceMembership(mvp.LaunchTokenClaims) error {
	return nil
}

func (store *readFailingCanaryStore) GetCurrentWorkspace(mvp.LaunchTokenClaims) (mvp.WorkspaceCurrentResponse, bool) {
	return mvp.WorkspaceCurrentResponse{}, false
}
