package mvp

import (
	"os"
	"sync"
)

type TaskStore interface {
	SaveTaskProjection(TaskResponse) error
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

type WorkspaceMembershipStore interface {
	EnsureWorkspaceMembership(launchTokenClaims) error
	GetCurrentWorkspace(launchTokenClaims) (WorkspaceCurrentResponse, bool)
}

type TaskProjectionStore interface {
	TaskStore
	TaskReader
	TaskLister
	TaskDeleter
	WorkspaceMembershipStore
}

type TaskStoreConfig struct {
	DatabaseURL string
}

type PostgresStoreOpener func(string) (TaskProjectionStore, error)

type MemoryTaskStore struct {
	mu          sync.RWMutex
	items       map[string]TaskResponse
	memberships map[string]WorkspaceCurrentResponse
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
		items:       map[string]TaskResponse{},
		memberships: map[string]WorkspaceCurrentResponse{},
	}
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
