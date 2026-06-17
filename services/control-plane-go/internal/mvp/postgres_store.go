package mvp

import (
	"context"
	"database/sql"
	"encoding/json"
	"fmt"

	_ "github.com/jackc/pgx/v5/stdlib"
)

type SQLExecutor interface {
	ExecContext(context.Context, string, ...any) (sql.Result, error)
	QueryRowContext(context.Context, string, ...any) SQLRow
}

type SQLTransactor interface {
	BeginTx(context.Context, *sql.TxOptions) (SQLTransaction, error)
}

type SQLTransaction interface {
	SQLExecutor
	Commit() error
	Rollback() error
}

type SQLRow interface {
	Scan(...any) error
}

type SQLDatabase interface {
	SQLExecutor
	SQLTransactor
	PingContext(context.Context) error
	Close() error
}

type SQLDatabaseOpener func(driverName string, databaseURL string) (SQLDatabase, error)

type PostgresTaskStore struct {
	db SQLExecutor
}

type sqlDatabase struct {
	db *sql.DB
}

type sqlTransaction struct {
	tx *sql.Tx
}

const PostgresTaskStoreSchema = `
create table if not exists task_projections (
  tenant_id text not null,
  workspace_id text not null,
  task_id text not null,
  user_id text not null,
  run_id text not null,
  payload_json jsonb not null,
  primary key (tenant_id, workspace_id, task_id)
);
alter table task_projections add column if not exists user_id text;`
const PostgresUsageLedgerSchema = `
create table if not exists usage_events (
  tenant_id text not null,
  workspace_id text not null,
  user_id text not null,
  event_id text not null,
  event_kind text not null,
  quantity bigint not null,
  source_ref text not null,
  created_at timestamptz not null default now(),
  primary key (tenant_id, workspace_id, event_id)
);`

const taskCreatedUsageKind = "task.created"

func NewPostgresTaskStore(db SQLExecutor) PostgresTaskStore {
	return PostgresTaskStore{db: db}
}

func openPostgresTaskStore(databaseURL string, openDatabase SQLDatabaseOpener) (TaskProjectionStore, error) {
	db, err := openDatabase("pgx", databaseURL)
	if err != nil {
		return nil, fmt.Errorf("open postgres task store: %w", err)
	}
	if err := db.PingContext(context.Background()); err != nil {
		_ = db.Close()
		return nil, fmt.Errorf("ping postgres task store: %w", err)
	}
	if _, err := db.ExecContext(context.Background(), PostgresTaskStoreSchema); err != nil {
		_ = db.Close()
		return nil, fmt.Errorf("initialize postgres task store schema: %w", err)
	}
	if _, err := db.ExecContext(context.Background(), PostgresUsageLedgerSchema); err != nil {
		_ = db.Close()
		return nil, fmt.Errorf("initialize postgres usage ledger schema: %w", err)
	}
	return NewPostgresTaskStore(db), nil
}

func sqlOpenDatabase(driverName string, databaseURL string) (SQLDatabase, error) {
	db, err := sql.Open(driverName, databaseURL)
	if err != nil {
		return nil, err
	}
	return sqlDatabase{db: db}, nil
}

func OpenPostgresTaskStore(databaseURL string) (TaskProjectionStore, error) {
	return openPostgresTaskStore(databaseURL, sqlOpenDatabase)
}

func (database sqlDatabase) ExecContext(ctx context.Context, query string, args ...any) (sql.Result, error) {
	return database.db.ExecContext(ctx, query, args...)
}

func (database sqlDatabase) QueryRowContext(ctx context.Context, query string, args ...any) SQLRow {
	return database.db.QueryRowContext(ctx, query, args...)
}

func (database sqlDatabase) BeginTx(ctx context.Context, options *sql.TxOptions) (SQLTransaction, error) {
	tx, err := database.db.BeginTx(ctx, options)
	if err != nil {
		return nil, err
	}
	return sqlTransaction{tx: tx}, nil
}

func (database sqlDatabase) PingContext(ctx context.Context) error {
	return database.db.PingContext(ctx)
}

func (database sqlDatabase) Close() error {
	return database.db.Close()
}

func (transaction sqlTransaction) ExecContext(ctx context.Context, query string, args ...any) (sql.Result, error) {
	return transaction.tx.ExecContext(ctx, query, args...)
}

func (transaction sqlTransaction) QueryRowContext(ctx context.Context, query string, args ...any) SQLRow {
	return transaction.tx.QueryRowContext(ctx, query, args...)
}

func (transaction sqlTransaction) Commit() error {
	return transaction.tx.Commit()
}

func (transaction sqlTransaction) Rollback() error {
	return transaction.tx.Rollback()
}

func (store PostgresTaskStore) SaveTaskProjection(projection TaskResponse) error {
	payload, err := encodeTaskProjection(projection)
	if err != nil {
		return err
	}

	transactor, ok := store.db.(SQLTransactor)
	if !ok {
		return fmt.Errorf("postgres task store requires transaction support")
	}
	tx, err := transactor.BeginTx(context.Background(), nil)
	if err != nil {
		return err
	}
	committed := false
	defer func() {
		if !committed {
			_ = tx.Rollback()
		}
	}()

	if err := saveTaskProjection(tx, projection, payload); err != nil {
		return err
	}
	if err := recordTaskCreatedUsage(tx, projection); err != nil {
		return err
	}
	if err := tx.Commit(); err != nil {
		return err
	}
	committed = true
	return nil
}

func saveTaskProjection(executor SQLExecutor, projection TaskResponse, payload string) error {
	_, err := executor.ExecContext(context.Background(), `
insert into task_projections (tenant_id, workspace_id, task_id, user_id, run_id, payload_json)
values ($1, $2, $3, $4, $5, $6)
on conflict (tenant_id, workspace_id, task_id)
do update set user_id = excluded.user_id, run_id = excluded.run_id, payload_json = excluded.payload_json
`, projection.TenantID, projection.WorkspaceID, projection.Task.TaskID, projection.UserID, projection.RunID, string(payload))
	return err
}

func recordTaskCreatedUsage(executor SQLExecutor, projection TaskResponse) error {
	_, err := executor.ExecContext(context.Background(), `
insert into usage_events (tenant_id, workspace_id, user_id, event_id, event_kind, quantity, source_ref)
values ($1, $2, $3, $4, $5, $6, $7)
on conflict (tenant_id, workspace_id, event_id) do nothing
`, projection.TenantID, projection.WorkspaceID, projection.UserID, projection.RunID, taskCreatedUsageKind, int64(1), projection.Task.TaskID)
	return err
}

func (store PostgresTaskStore) GetTaskProjection(tenantID string, workspaceID string, taskID string) (TaskResponse, bool) {
	payload := ""
	err := store.db.QueryRowContext(context.Background(), `
select payload_json
from task_projections
where tenant_id = $1 and workspace_id = $2 and task_id = $3
`, tenantID, workspaceID, taskID).Scan(&payload)
	if err != nil {
		return TaskResponse{}, false
	}

	projection, err := decodeTaskProjection(payload)
	if err != nil {
		return TaskResponse{}, false
	}
	return projection, true
}

func (store PostgresTaskStore) DeleteTaskProjection(tenantID string, workspaceID string, taskID string) error {
	_, err := store.db.ExecContext(context.Background(), `
delete from task_projections
where tenant_id = $1 and workspace_id = $2 and task_id = $3
`, tenantID, workspaceID, taskID)
	return err
}

func encodeTaskProjection(projection TaskResponse) (string, error) {
	payload, err := json.Marshal(projection)
	if err != nil {
		return "", err
	}
	return string(payload), nil
}

func decodeTaskProjection(payload string) (TaskResponse, error) {
	projection := TaskResponse{}
	err := json.Unmarshal([]byte(payload), &projection)
	return projection, err
}
