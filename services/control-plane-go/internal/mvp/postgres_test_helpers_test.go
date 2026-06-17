package mvp

import (
	"context"
	"database/sql"
)

type fakeSQLExecutor struct {
	execQuery     string
	execArgs      []any
	execCalls     []sqlCall
	row           fakeSQLRow
	execErr       error
	execErrAtCall map[int]error
	began         bool
	committed     bool
	rolledBack    bool
}

type sqlCall struct {
	query string
	args  []any
}

func (executor *fakeSQLExecutor) ExecContext(_ context.Context, query string, args ...any) (sql.Result, error) {
	executor.execQuery = query
	executor.execArgs = args
	executor.execCalls = append(executor.execCalls, sqlCall{query: query, args: args})
	if executor.execErrAtCall != nil {
		if err := executor.execErrAtCall[len(executor.execCalls)-1]; err != nil {
			return nil, err
		}
	}
	return nil, executor.execErr
}

func (executor *fakeSQLExecutor) QueryRowContext(_ context.Context, query string, args ...any) SQLRow {
	executor.execQuery = query
	executor.execArgs = args
	return &executor.row
}

func (executor *fakeSQLExecutor) BeginTx(context.Context, *sql.TxOptions) (SQLTransaction, error) {
	executor.began = true
	return executor, nil
}

func (executor *fakeSQLExecutor) Commit() error {
	executor.committed = true
	return nil
}

func (executor *fakeSQLExecutor) Rollback() error {
	executor.rolledBack = true
	return nil
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
