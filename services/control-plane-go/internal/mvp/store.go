package mvp

import "sync"

type TaskStore interface {
	SaveTaskProjection(TaskResponse) error
}

type TaskReader interface {
	GetTaskProjection(tenantID string, workspaceID string, taskID string) (TaskResponse, bool)
}

type MemoryTaskStore struct {
	mu    sync.RWMutex
	items map[string]TaskResponse
}

func NewMemoryTaskStore() *MemoryTaskStore {
	return &MemoryTaskStore{items: map[string]TaskResponse{}}
}

func (store *MemoryTaskStore) SaveTaskProjection(projection TaskResponse) error {
	store.mu.Lock()
	defer store.mu.Unlock()

	store.items[taskStoreKey(projection.TenantID, projection.WorkspaceID, projection.Task.TaskID)] = projection
	return nil
}

func (store *MemoryTaskStore) GetTaskProjection(tenantID string, workspaceID string, taskID string) (TaskResponse, bool) {
	store.mu.RLock()
	defer store.mu.RUnlock()

	projection, ok := store.items[taskStoreKey(tenantID, workspaceID, taskID)]
	return projection, ok
}

func taskStoreKey(tenantID string, workspaceID string, taskID string) string {
	return tenantID + "/" + workspaceID + "/" + taskID
}
