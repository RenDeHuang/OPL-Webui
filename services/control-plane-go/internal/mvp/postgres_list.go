package mvp

import "context"

type SQLRows interface {
	Next() bool
	Scan(...any) error
	Close() error
}

type SQLQueryer interface {
	QueryContext(context.Context, string, ...any) (SQLRows, error)
}

func (database sqlDatabase) QueryContext(ctx context.Context, query string, args ...any) (SQLRows, error) {
	return database.db.QueryContext(ctx, query, args...)
}

func (transaction sqlTransaction) QueryContext(ctx context.Context, query string, args ...any) (SQLRows, error) {
	return transaction.tx.QueryContext(ctx, query, args...)
}

func (store PostgresTaskStore) ListTaskProjections(tenantID string, workspaceID string, userID string) []TaskResponse {
	queryer, ok := store.db.(SQLQueryer)
	if !ok {
		return []TaskResponse{}
	}
	rows, err := queryer.QueryContext(context.Background(), `
select payload_json
from task_projections
where tenant_id = $1 and workspace_id = $2 and user_id = $3
order by task_id
`, tenantID, workspaceID, userID)
	if err != nil {
		return []TaskResponse{}
	}
	defer rows.Close()

	projections := []TaskResponse{}
	for rows.Next() {
		payload := ""
		if err := rows.Scan(&payload); err != nil {
			return []TaskResponse{}
		}
		projection, err := decodeTaskProjection(payload)
		if err != nil {
			return []TaskResponse{}
		}
		projections = append(projections, projection)
	}
	return projections
}
