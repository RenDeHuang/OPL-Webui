package mvp

import (
	"context"
	"database/sql"
	"encoding/json"
)

type SQLExecutor interface {
	ExecContext(context.Context, string, ...any) (sql.Result, error)
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
	payload, err := json.Marshal(projection)
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
