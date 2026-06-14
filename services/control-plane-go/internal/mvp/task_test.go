package mvp

import (
	"context"
	"database/sql"
	"strings"
	"testing"
)

func TestCreateTaskResponseCreatesTenantScopedProjection(t *testing.T) {
	result, err := CreateTaskResponse(TaskRequest{
		TenantID:    "tenant_cloud_demo",
		WorkspaceID: "workspace_cloud_demo",
		UserID:      "user_demo",
		Prompt:      "生成一个医学研究项目的证据整理任务",
		Intent:      "research",
	})
	if err != nil {
		t.Fatalf("CreateTaskResponse returned error: %v", err)
	}

	if !result.OK {
		t.Fatal("expected ok response")
	}
	if result.TenantID != "tenant_cloud_demo" {
		t.Fatalf("tenant mismatch: %s", result.TenantID)
	}
	if result.Task.Status != "completed" {
		t.Fatalf("status mismatch: %s", result.Task.Status)
	}
	if result.Artifacts[0].Kind != "analysis_package" {
		t.Fatalf("artifact kind mismatch: %s", result.Artifacts[0].Kind)
	}
	if result.Adapter.Command[0] != "opl" {
		t.Fatalf("adapter command mismatch: %#v", result.Adapter.Command)
	}
}

func TestCreateTaskResponseRejectsMissingTenant(t *testing.T) {
	_, err := CreateTaskResponse(TaskRequest{
		WorkspaceID: "workspace_cloud_demo",
		UserID:      "user_demo",
		Prompt:      "生成一个医学研究项目的证据整理任务",
	})
	if err == nil {
		t.Fatal("expected missing tenant error")
	}
}

func TestCreateAndStoreTaskResponsePersistsTenantScopedProjection(t *testing.T) {
	store := NewMemoryTaskStore()

	result, err := CreateAndStoreTaskResponse(TaskRequest{
		TenantID:    "tenant_cloud_demo",
		WorkspaceID: "workspace_cloud_demo",
		UserID:      "user_demo",
		Prompt:      "生成一个医学研究项目的证据整理任务",
		Intent:      "research",
	}, store)
	if err != nil {
		t.Fatalf("CreateAndStoreTaskResponse returned error: %v", err)
	}

	stored, ok := store.GetTaskProjection("tenant_cloud_demo", "workspace_cloud_demo", result.Task.TaskID)
	if !ok {
		t.Fatal("expected stored task projection")
	}
	if stored.RunID != result.RunID {
		t.Fatalf("stored run mismatch: %s", stored.RunID)
	}
	if stored.Artifacts[0].ArtifactID != result.Artifacts[0].ArtifactID {
		t.Fatalf("stored artifact mismatch: %#v", stored.Artifacts)
	}
}

type fakeSQLExecutor struct {
	execQuery string
	execArgs  []any
	row       fakeSQLRow
}

func (executor *fakeSQLExecutor) ExecContext(_ context.Context, query string, args ...any) (sql.Result, error) {
	executor.execQuery = query
	executor.execArgs = args
	return nil, nil
}

func (executor *fakeSQLExecutor) QueryRowContext(_ context.Context, query string, args ...any) SQLRow {
	executor.execQuery = query
	executor.execArgs = args
	return &executor.row
}

type fakeSQLRow struct {
	value string
}

func (row *fakeSQLRow) Scan(dest ...any) error {
	target := dest[0].(*string)
	*target = row.value
	return nil
}

func TestPostgresTaskStorePersistsProjectionThroughSQLBoundary(t *testing.T) {
	executor := &fakeSQLExecutor{}
	store := NewPostgresTaskStore(executor)
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

	if !strings.Contains(executor.execQuery, "insert into task_projections") {
		t.Fatalf("expected task_projections insert, got %q", executor.execQuery)
	}
	if executor.execArgs[0] != "tenant_cloud_demo" {
		t.Fatalf("tenant arg mismatch: %#v", executor.execArgs)
	}
	if executor.execArgs[2] != projection.Task.TaskID {
		t.Fatalf("task arg mismatch: %#v", executor.execArgs)
	}
	if !strings.Contains(executor.execArgs[4].(string), "\"runId\"") {
		t.Fatalf("payload should contain encoded projection: %#v", executor.execArgs)
	}
}

func TestPostgresTaskStoreReadsProjectionThroughSQLBoundary(t *testing.T) {
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
	payload, err := encodeTaskProjection(projection)
	if err != nil {
		t.Fatalf("encodeTaskProjection returned error: %v", err)
	}
	executor := &fakeSQLExecutor{row: fakeSQLRow{value: payload}}
	store := NewPostgresTaskStore(executor)

	stored, ok := store.GetTaskProjection("tenant_cloud_demo", "workspace_cloud_demo", projection.Task.TaskID)
	if !ok {
		t.Fatal("expected stored projection")
	}

	if !strings.Contains(executor.execQuery, "select payload_json") {
		t.Fatalf("expected select payload_json query, got %q", executor.execQuery)
	}
	if stored.RunID != projection.RunID {
		t.Fatalf("stored run mismatch: %s", stored.RunID)
	}
}

func TestPostgresTaskStoreSchemaKeepsTenantScopedPrimaryKey(t *testing.T) {
	if !strings.Contains(PostgresTaskStoreSchema, "task_projections") {
		t.Fatal("schema must create task_projections")
	}
	if !strings.Contains(PostgresTaskStoreSchema, "payload_json jsonb not null") {
		t.Fatal("schema must store the projection payload as jsonb")
	}
	if !strings.Contains(PostgresTaskStoreSchema, "primary key (tenant_id, workspace_id, task_id)") {
		t.Fatal("schema must be tenant and workspace scoped")
	}
}

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

func TestConfigureDefaultTaskStoreFromEnvFailsUntilPostgresDriverIsLinked(t *testing.T) {
	t.Setenv("OPL_DATABASE_URL", "postgres://example")

	if err := ConfigureDefaultTaskStoreFromEnv(); err == nil {
		t.Fatal("expected postgres driver linkage error")
	}
}
