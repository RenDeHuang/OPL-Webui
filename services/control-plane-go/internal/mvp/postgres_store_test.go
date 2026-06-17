package mvp

import (
	"context"
	"database/sql"
	"errors"
	"strings"
	"testing"
)

type fakeSQLExecutor struct {
	execQuery string
	execArgs  []any
	row       fakeSQLRow
	execErr   error
}

func (executor *fakeSQLExecutor) ExecContext(_ context.Context, query string, args ...any) (sql.Result, error) {
	executor.execQuery = query
	executor.execArgs = args
	return nil, executor.execErr
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

type fakeSQLDatabase struct {
	fakeSQLExecutor
	driverName  string
	databaseURL string
	pinged      bool
	closed      bool
	pingErr     error
	execErr     error
}

func (db *fakeSQLDatabase) PingContext(context.Context) error {
	db.pinged = true
	return db.pingErr
}

func (db *fakeSQLDatabase) Close() error {
	db.closed = true
	return nil
}

func (db *fakeSQLDatabase) ExecContext(ctx context.Context, query string, args ...any) (sql.Result, error) {
	if db.execErr != nil {
		return nil, db.execErr
	}
	return db.fakeSQLExecutor.ExecContext(ctx, query, args...)
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
	if executor.execArgs[3] != projection.UserID {
		t.Fatalf("user arg mismatch: %#v", executor.execArgs)
	}
	if !strings.Contains(executor.execArgs[5].(string), "\"runId\"") {
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

func TestPostgresTaskStoreDeletesProjectionThroughSQLBoundary(t *testing.T) {
	executor := &fakeSQLExecutor{}
	store := NewPostgresTaskStore(executor)

	if err := store.DeleteTaskProjection("tenant_cloud_demo", "workspace_cloud_demo", "task_001"); err != nil {
		t.Fatalf("DeleteTaskProjection returned error: %v", err)
	}

	if !strings.Contains(executor.execQuery, "delete from task_projections") {
		t.Fatalf("expected delete query, got %q", executor.execQuery)
	}
	if executor.execArgs[0] != "tenant_cloud_demo" {
		t.Fatalf("tenant arg mismatch: %#v", executor.execArgs)
	}
	if executor.execArgs[2] != "task_001" {
		t.Fatalf("task arg mismatch: %#v", executor.execArgs)
	}
}

func TestPostgresTaskStorePropagatesDeleteError(t *testing.T) {
	executor := &fakeSQLExecutor{execErr: errors.New("delete denied")}
	store := NewPostgresTaskStore(executor)

	err := store.DeleteTaskProjection("tenant_cloud_demo", "workspace_cloud_demo", "task_001")
	if err == nil || !strings.Contains(err.Error(), "delete denied") {
		t.Fatalf("expected delete error, got %v", err)
	}
}

func TestPostgresTaskStoreSchemaKeepsTenantScopedPrimaryKey(t *testing.T) {
	if !strings.Contains(PostgresTaskStoreSchema, "task_projections") {
		t.Fatal("schema must create task_projections")
	}
	if !strings.Contains(PostgresTaskStoreSchema, "payload_json jsonb not null") {
		t.Fatal("schema must store the projection payload as jsonb")
	}
	if !strings.Contains(PostgresTaskStoreSchema, "user_id text not null") {
		t.Fatal("schema must store the projection user boundary")
	}
	if !strings.Contains(PostgresTaskStoreSchema, "add column if not exists user_id text") {
		t.Fatal("schema must include user_id drift migration")
	}
	if !strings.Contains(PostgresTaskStoreSchema, "primary key (tenant_id, workspace_id, task_id)") {
		t.Fatal("schema must be tenant and workspace scoped")
	}
}

func TestOpenPostgresTaskStoreUsesPGXDriverAndInitializesSchema(t *testing.T) {
	database := &fakeSQLDatabase{}

	store, err := openPostgresTaskStore("postgres://example", func(driverName string, databaseURL string) (SQLDatabase, error) {
		database.driverName = driverName
		database.databaseURL = databaseURL
		return database, nil
	})
	if err != nil {
		t.Fatalf("openPostgresTaskStore returned error: %v", err)
	}

	if database.driverName != "pgx" {
		t.Fatalf("expected pgx driver, got %s", database.driverName)
	}
	if database.databaseURL != "postgres://example" {
		t.Fatalf("database URL mismatch: %s", database.databaseURL)
	}
	if !database.pinged {
		t.Fatal("expected database ping before store is returned")
	}
	if !strings.Contains(database.execQuery, "create table if not exists task_projections") {
		t.Fatalf("expected schema initialization query, got %q", database.execQuery)
	}
	if database.closed {
		t.Fatal("database should stay open when store is ready")
	}
	if _, ok := store.(PostgresTaskStore); !ok {
		t.Fatalf("expected PostgresTaskStore, got %T", store)
	}
}

func TestOpenPostgresTaskStoreClosesDatabaseWhenPingFails(t *testing.T) {
	database := &fakeSQLDatabase{pingErr: errors.New("postgres unavailable")}

	_, err := openPostgresTaskStore("postgres://example", func(string, string) (SQLDatabase, error) {
		return database, nil
	})

	if err == nil || !strings.Contains(err.Error(), "ping postgres task store") {
		t.Fatalf("expected ping error, got %v", err)
	}
	if !database.closed {
		t.Fatal("database should close when ping fails")
	}
	if database.execQuery != "" {
		t.Fatalf("schema should not initialize after ping failure: %q", database.execQuery)
	}
}

func TestOpenPostgresTaskStoreClosesDatabaseWhenSchemaInitFails(t *testing.T) {
	database := &fakeSQLDatabase{execErr: errors.New("schema denied")}

	_, err := openPostgresTaskStore("postgres://example", func(string, string) (SQLDatabase, error) {
		return database, nil
	})

	if err == nil || !strings.Contains(err.Error(), "initialize postgres task store schema") {
		t.Fatalf("expected schema error, got %v", err)
	}
	if !database.closed {
		t.Fatal("database should close when schema initialization fails")
	}
}
