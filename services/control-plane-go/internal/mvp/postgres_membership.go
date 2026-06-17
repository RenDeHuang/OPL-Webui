package mvp

import (
	"context"
	"database/sql"
)

func (store PostgresTaskStore) EnsureWorkspaceMembership(claims launchTokenClaims) error {
	transactor, ok := store.db.(SQLTransactor)
	if !ok {
		return sql.ErrTxDone
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
	for _, statement := range workspaceMembershipStatements(claims) {
		if _, err := tx.ExecContext(context.Background(), statement.query, statement.args...); err != nil {
			return err
		}
	}
	if err := tx.Commit(); err != nil {
		return err
	}
	committed = true
	return nil
}

func (store PostgresTaskStore) GetCurrentWorkspace(claims launchTokenClaims) (WorkspaceCurrentResponse, bool) {
	var tenantRole, workspaceRole, workspaceName string
	err := store.db.QueryRowContext(context.Background(), `
select tm.role, wm.role, w.name
from tenant_memberships tm
join workspace_memberships wm on wm.tenant_id = tm.tenant_id and wm.user_id = tm.user_id
join workspaces w on w.tenant_id = wm.tenant_id and w.id = wm.workspace_id
where tm.tenant_id = $1 and wm.workspace_id = $2 and tm.user_id = $3
`, claims.TenantID, claims.WorkspaceID, claims.UserID).Scan(&tenantRole, &workspaceRole, &workspaceName)
	if err != nil {
		return WorkspaceCurrentResponse{}, false
	}
	current := workspaceCurrentFromClaims(claims)
	current.TenantRole = tenantRole
	current.WorkspaceRole = workspaceRole
	current.Workspace.Name = workspaceName
	return current, true
}
