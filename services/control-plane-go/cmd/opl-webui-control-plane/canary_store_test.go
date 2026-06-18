package main

import "github.com/RenDeHuang/OPL-Webui/services/control-plane-go/internal/controlplane"

func (store *readFailingCanaryStore) SaveTaskProjection(projection controlplane.TaskResponse) error {
	store.projection = projection
	return nil
}

func (store *readFailingCanaryStore) SaveTaskProjectionWithQuota(projection controlplane.TaskResponse) error {
	return store.SaveTaskProjection(projection)
}

func (store *readFailingCanaryStore) GetUsageQuota(string, string) controlplane.UsageQuotaProjection {
	return controlplane.UsageQuotaProjection{Plan: "mvp", TaskQuota: 2, UsagePeriod: "monthly", RemainingCount: 2}
}

func (store *readFailingCanaryStore) GetTaskProjection(string, string, string) (controlplane.TaskResponse, bool) {
	return controlplane.TaskResponse{}, false
}

func (store *readFailingCanaryStore) ListTaskProjections(string, string, string) []controlplane.TaskResponse {
	return []controlplane.TaskResponse{}
}

func (store *readFailingCanaryStore) DeleteTaskProjection(tenantID string, workspaceID string, taskID string) error {
	if tenantID == store.projection.TenantID && workspaceID == store.projection.WorkspaceID && taskID == store.projection.Task.TaskID {
		store.deleted = true
	}
	return nil
}
