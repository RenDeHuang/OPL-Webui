package controlplane

import (
	"os"
	"sync"
)

type TaskStore interface {
	SaveTaskProjection(TaskResponse) error
}

type QuotaTaskStore interface {
	SaveTaskProjectionWithQuota(TaskResponse) error
	GetUsageQuota(tenantID string, workspaceID string) UsageQuotaProjection
}

type TaskReader interface {
	GetTaskProjection(tenantID string, workspaceID string, taskID string) (TaskResponse, bool)
}

type TaskLister interface {
	ListTaskProjections(tenantID string, workspaceID string, userID string) []TaskResponse
}

type TaskDeleter interface {
	DeleteTaskProjection(tenantID string, workspaceID string, taskID string) error
}

type TaskProjectionStore interface {
	TaskStore
	QuotaTaskStore
	TaskReader
	TaskLister
	TaskDeleter
}

type TaskStoreConfig struct {
	DatabaseURL string
}

type PostgresStoreOpener func(string) (TaskProjectionStore, error)

type MemoryTaskStore struct {
	mu    sync.RWMutex
	items map[string]TaskResponse
	usage map[string]int
}

func NewTaskStore(config TaskStoreConfig, openPostgres PostgresStoreOpener) (TaskProjectionStore, error) {
	if config.DatabaseURL == "" {
		return NewMemoryTaskStore(), nil
	}
	return openPostgres(config.DatabaseURL)
}

func ConfigureDefaultTaskStoreFromEnv() error {
	return configureDefaultTaskStoreFromEnv(OpenPostgresTaskStore)
}

func configureDefaultTaskStoreFromEnv(openPostgres PostgresStoreOpener) error {
	store, err := NewTaskStore(TaskStoreConfig{
		DatabaseURL: os.Getenv("OPL_DATABASE_URL"),
	}, openPostgres)
	if err != nil {
		return err
	}
	defaultTaskStore = store
	return nil
}

func NewMemoryTaskStore() *MemoryTaskStore {
	return &MemoryTaskStore{
		items: map[string]TaskResponse{},
		usage: map[string]int{},
	}
}

func (store *MemoryTaskStore) SaveTaskProjection(projection TaskResponse) error {
	store.mu.Lock()
	defer store.mu.Unlock()

	store.items[taskStoreKey(projection.TenantID, projection.WorkspaceID, projection.Task.TaskID)] = projection
	return nil
}

func (store *MemoryTaskStore) SaveTaskProjectionWithQuota(projection TaskResponse) error {
	store.mu.Lock()
	defer store.mu.Unlock()

	quota := usageQuotaFromCount(store.usage[usageStoreKey(projection.TenantID, projection.WorkspaceID)])
	if quota.UsedCount >= quota.TaskQuota {
		return ErrQuotaExceeded
	}
	store.items[taskStoreKey(projection.TenantID, projection.WorkspaceID, projection.Task.TaskID)] = projection
	store.usage[usageStoreKey(projection.TenantID, projection.WorkspaceID)]++
	return nil
}

func (store *MemoryTaskStore) GetUsageQuota(tenantID string, workspaceID string) UsageQuotaProjection {
	store.mu.RLock()
	defer store.mu.RUnlock()

	return usageQuotaFromCount(store.usage[usageStoreKey(tenantID, workspaceID)])
}

func (store *MemoryTaskStore) GetTaskProjection(tenantID string, workspaceID string, taskID string) (TaskResponse, bool) {
	store.mu.RLock()
	defer store.mu.RUnlock()

	projection, ok := store.items[taskStoreKey(tenantID, workspaceID, taskID)]
	return projection, ok
}

func (store *MemoryTaskStore) ListTaskProjections(tenantID string, workspaceID string, userID string) []TaskResponse {
	store.mu.RLock()
	defer store.mu.RUnlock()

	tasks := []TaskResponse{}
	for _, projection := range store.items {
		if projection.TenantID == tenantID && projection.WorkspaceID == workspaceID && projection.UserID == userID {
			tasks = append(tasks, projection)
		}
	}
	return tasks
}

func (store *MemoryTaskStore) DeleteTaskProjection(tenantID string, workspaceID string, taskID string) error {
	store.mu.Lock()
	defer store.mu.Unlock()

	delete(store.items, taskStoreKey(tenantID, workspaceID, taskID))
	return nil
}

func taskStoreKey(tenantID string, workspaceID string, taskID string) string {
	return tenantID + "/" + workspaceID + "/" + taskID
}

func usageStoreKey(tenantID string, workspaceID string) string {
	return tenantID + "/" + workspaceID
}
