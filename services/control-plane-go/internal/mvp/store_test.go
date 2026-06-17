package mvp

import (
	"errors"
	"strings"
	"testing"
)

func TestNewTaskStoreUsesMemoryWithoutDatabaseURL(t *testing.T) {
	store, err := NewTaskStore(TaskStoreConfig{}, func(string) (TaskProjectionStore, error) {
		t.Fatal("postgres opener should not be called without database URL")
		return nil, nil
	})
	if err != nil {
		t.Fatalf("NewTaskStore returned error: %v", err)
	}
	if _, ok := store.(*MemoryTaskStore); !ok {
		t.Fatalf("expected memory store, got %T", store)
	}
}

func TestNewTaskStoreUsesPostgresWhenDatabaseURLExists(t *testing.T) {
	called := false
	store, err := NewTaskStore(TaskStoreConfig{DatabaseURL: "postgres://example"}, func(databaseURL string) (TaskProjectionStore, error) {
		called = true
		if databaseURL != "postgres://example" {
			t.Fatalf("database URL mismatch: %s", databaseURL)
		}
		return NewMemoryTaskStore(), nil
	})
	if err != nil {
		t.Fatalf("NewTaskStore returned error: %v", err)
	}
	if !called {
		t.Fatal("expected postgres opener to be called")
	}
	if store == nil {
		t.Fatal("expected store")
	}
}

func TestConfigureDefaultTaskStoreFromEnvUsesMemoryByDefault(t *testing.T) {
	t.Setenv("OPL_DATABASE_URL", "")

	if err := ConfigureDefaultTaskStoreFromEnv(); err != nil {
		t.Fatalf("ConfigureDefaultTaskStoreFromEnv returned error: %v", err)
	}
	if _, ok := defaultTaskStore.(*MemoryTaskStore); !ok {
		t.Fatalf("expected default memory store, got %T", defaultTaskStore)
	}
}

func TestConfigureDefaultTaskStoreFromEnvUsesConfiguredPostgresStore(t *testing.T) {
	t.Setenv("OPL_DATABASE_URL", "postgres://example")
	called := false

	if err := configureDefaultTaskStoreFromEnv(func(databaseURL string) (TaskProjectionStore, error) {
		called = true
		if databaseURL != "postgres://example" {
			t.Fatalf("database URL mismatch: %s", databaseURL)
		}
		return NewMemoryTaskStore(), nil
	}); err != nil {
		t.Fatalf("configureDefaultTaskStoreFromEnv returned error: %v", err)
	}
	if !called {
		t.Fatal("expected postgres opener to be called")
	}
}

func TestConfigureDefaultTaskStoreFromEnvPropagatesPostgresOpenError(t *testing.T) {
	t.Setenv("OPL_DATABASE_URL", "postgres://example")

	if err := configureDefaultTaskStoreFromEnv(func(string) (TaskProjectionStore, error) {
		return nil, errors.New("postgres unavailable")
	}); err == nil || !strings.Contains(err.Error(), "postgres unavailable") {
		t.Fatalf("expected postgres opener error, got %v", err)
	}
}

func TestMemoryTaskStoreDeletesProjection(t *testing.T) {
	store := NewMemoryTaskStore()
	projection, err := CreateTaskResponse(TaskRequest{
		TenantID:    "tenant_cloud_demo",
		WorkspaceID: "workspace_cloud_demo",
		UserID:      "user_demo",
		Prompt:      "生成一个医学研究项目的证据整理任务",
		Intent:      "research",
	})
	if err != nil {
		t.Fatalf("CreateTaskResponse returned error: %v", err)
	}
	if err := store.SaveTaskProjection(projection); err != nil {
		t.Fatalf("SaveTaskProjection returned error: %v", err)
	}

	if err := store.DeleteTaskProjection("tenant_cloud_demo", "workspace_cloud_demo", projection.Task.TaskID); err != nil {
		t.Fatalf("DeleteTaskProjection returned error: %v", err)
	}
	if _, ok := store.GetTaskProjection("tenant_cloud_demo", "workspace_cloud_demo", projection.Task.TaskID); ok {
		t.Fatal("projection should be deleted")
	}
}

func TestMemoryTaskStoreEnforcesTaskQuotaWithoutWritingProjection(t *testing.T) {
	store := NewMemoryTaskStore()
	first := mustTaskProjection(t, "tenant_quota", "workspace_quota", "user_quota", "first")
	second := mustTaskProjection(t, "tenant_quota", "workspace_quota", "user_quota", "second")
	third := mustTaskProjection(t, "tenant_quota", "workspace_quota", "user_quota", "third")

	if err := store.SaveTaskProjectionWithQuota(first); err != nil {
		t.Fatalf("first SaveTaskProjectionWithQuota returned error: %v", err)
	}
	if err := store.SaveTaskProjectionWithQuota(second); err != nil {
		t.Fatalf("second SaveTaskProjectionWithQuota returned error: %v", err)
	}
	err := store.SaveTaskProjectionWithQuota(third)
	if !errors.Is(err, ErrQuotaExceeded) {
		t.Fatalf("expected ErrQuotaExceeded, got %v", err)
	}
	if _, ok := store.GetTaskProjection("tenant_quota", "workspace_quota", third.Task.TaskID); ok {
		t.Fatal("quota failure must not write task projection")
	}
	usage := store.GetUsageQuota("tenant_quota", "workspace_quota")
	if usage.UsedCount != 2 || usage.RemainingCount != 0 {
		t.Fatalf("usage should stay at quota after failed write: %#v", usage)
	}
}

func TestMemoryTaskStoreScopesQuotaByTenant(t *testing.T) {
	store := NewMemoryTaskStore()
	for _, prompt := range []string{"first", "second"} {
		if err := store.SaveTaskProjectionWithQuota(mustTaskProjection(t, "tenant_a", "workspace_shared", "user_a", prompt)); err != nil {
			t.Fatalf("tenant A write returned error: %v", err)
		}
	}
	err := store.SaveTaskProjectionWithQuota(mustTaskProjection(t, "tenant_b", "workspace_shared", "user_b", "tenant B first"))
	if err != nil {
		t.Fatalf("tenant B usage should not be affected by tenant A: %v", err)
	}
}

func mustTaskProjection(t *testing.T, tenantID string, workspaceID string, userID string, prompt string) TaskResponse {
	t.Helper()
	projection, err := CreateTaskResponse(TaskRequest{
		TenantID:    tenantID,
		WorkspaceID: workspaceID,
		UserID:      userID,
		Prompt:      prompt,
		Intent:      "research",
	})
	if err != nil {
		t.Fatalf("CreateTaskResponse returned error: %v", err)
	}
	projection.Task.TaskID = workspaceID + "_task_" + prompt
	projection.RunID = "run_" + workspaceID + "_" + userID + "_" + prompt
	return projection
}
