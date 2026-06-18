package controlplane

import (
	"context"
	"database/sql"
	"fmt"
)

const PostgresPlanQuotaSchema = `
create table if not exists tenant_plans (
  tenant_id text primary key references tenants(id),
  plan text not null,
  task_quota bigint not null,
  usage_period text not null
);`

func (store PostgresTaskStore) SaveTaskProjectionWithQuota(projection TaskResponse) error {
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

	if err := ensureTenantPlan(tx, projection.TenantID); err != nil {
		return err
	}
	quota := getLockedUsageQuota(tx, projection.TenantID, projection.WorkspaceID)
	if quota.UsedCount >= quota.TaskQuota {
		return ErrQuotaExceeded
	}
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

func (store PostgresTaskStore) GetUsageQuota(tenantID string, workspaceID string) UsageQuotaProjection {
	return getUsageQuota(store.db, tenantID, workspaceID)
}

func ensureTenantPlan(executor SQLExecutor, tenantID string) error {
	_, err := executor.ExecContext(context.Background(), `
insert into tenant_plans (tenant_id, plan, task_quota, usage_period)
values ($1, $2, $3, $4)
on conflict (tenant_id) do nothing
`, tenantID, defaultPlan, int64(defaultTaskQuota), defaultUsagePeriod)
	return err
}

func getUsageQuota(executor SQLExecutor, tenantID string, workspaceID string) UsageQuotaProjection {
	return getUsageQuotaWithLock(executor, tenantID, workspaceID, false)
}

func getLockedUsageQuota(executor SQLExecutor, tenantID string, workspaceID string) UsageQuotaProjection {
	return getUsageQuotaWithLock(executor, tenantID, workspaceID, true)
}

func getUsageQuotaWithLock(executor SQLExecutor, tenantID string, workspaceID string, lockPlan bool) UsageQuotaProjection {
	var plan, usagePeriod string
	var taskQuota int
	planQuery := `
select plan, task_quota, usage_period
from tenant_plans
where tenant_id = $1
`
	if lockPlan {
		planQuery += "for update\n"
	}
	err := executor.QueryRowContext(context.Background(), planQuery, tenantID).Scan(&plan, &taskQuota, &usagePeriod)
	if err != nil {
		if err == sql.ErrNoRows {
			return usageQuotaFromCount(0)
		}
		return usageQuotaFromCount(0)
	}
	return usageQuotaProjection(plan, taskQuota, usagePeriod, currentTaskUsage(executor, tenantID, workspaceID))
}

func currentTaskUsage(executor SQLExecutor, tenantID string, workspaceID string) int {
	usedCount := 0
	err := executor.QueryRowContext(context.Background(), `
select coalesce(sum(quantity), 0)
from usage_events
where tenant_id = $1 and workspace_id = $2 and event_kind = $3
`, tenantID, workspaceID, taskCreatedUsageKind).Scan(&usedCount)
	if err != nil {
		return 0
	}
	return usedCount
}
