package mvp

import (
	"errors"
	"os"
	"sync"
)

type TaskStore interface {
	SaveTaskProjection(TaskResponse) error
}

type TaskReader interface {
	GetTaskProjection(tenantID string, workspaceID string, taskID string) (TaskResponse, bool)
}

type TaskProjectionStore interface {
	TaskStore
	TaskReader
}

type TaskStoreConfig struct {
	DatabaseURL string
}

type PostgresStoreOpener func(string) (TaskProjectionStore, error)

type MemoryTaskStore struct {
	mu    sync.RWMutex
	items map[string]TaskResponse
}

func NewTaskStore(config TaskStoreConfig, openPostgres PostgresStoreOpener) (TaskProjectionStore, error) {
	if config.DatabaseURL == "" {
		return NewMemoryTaskStore(), nil
	}
	return openPostgres(config.DatabaseURL)
}

func OpenPostgresTaskStore(_ string) (TaskProjectionStore, error) {
	return nil, errors.New("postgres driver is not linked into this runtime")
}

func ConfigureDefaultTaskStoreFromEnv() error {
	store, err := NewTaskStore(TaskStoreConfig{
		DatabaseURL: os.Getenv("OPL_DATABASE_URL"),
	}, OpenPostgresTaskStore)
	if err != nil {
		return err
	}
	defaultTaskStore = store
	return nil
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
