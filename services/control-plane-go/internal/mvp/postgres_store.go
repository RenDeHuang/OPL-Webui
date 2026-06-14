package mvp

import (
	"context"
	"database/sql"
	"encoding/json"
)

type SQLExecutor interface {
	ExecContext(context.Context, string, ...any) (sql.Result, error)
	QueryRowContext(context.Context, string, ...any) SQLRow
}

type SQLRow interface {
	Scan(...any) error
}

type PostgresTaskStore struct {
	db SQLExecutor
}

const PostgresTaskStoreSchema = `
create table if not exists task_projections (
  tenant_id text not null,
  workspace_id text not null,
  task_id text not null,
  run_id text not null,
  payload_json jsonb not null,
  primary key (tenant_id, workspace_id, task_id)
);`

func NewPostgresTaskStore(db SQLExecutor) PostgresTaskStore {
	return PostgresTaskStore{db: db}
}

func (store PostgresTaskStore) SaveTaskProjection(projection TaskResponse) error {
	payload, err := encodeTaskProjection(projection)
	if err != nil {
		return err
	}

	_, err = store.db.ExecContext(context.Background(), `
insert into task_projections (tenant_id, workspace_id, task_id, run_id, payload_json)
values ($1, $2, $3, $4, $5)
on conflict (tenant_id, workspace_id, task_id)
do update set run_id = excluded.run_id, payload_json = excluded.payload_json
`, projection.TenantID, projection.WorkspaceID, projection.Task.TaskID, projection.RunID, string(payload))
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
