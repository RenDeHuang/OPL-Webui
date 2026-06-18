package controlplane

import (
	"errors"
	"strings"
	"testing"
)

func TestPostgresTaskStoreRecordsUsageEventForProjection(t *testing.T) {
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

	if len(executor.execCalls) != 2 {
		t.Fatalf("expected task write and usage event write, got %#v", executor.execCalls)
	}
	usageCall := executor.execCalls[1]
	if !strings.Contains(usageCall.query, "insert into usage_events") {
		t.Fatalf("expected usage event insert, got %q", usageCall.query)
	}
	expected := []any{
		projection.TenantID,
		projection.WorkspaceID,
		projection.UserID,
		projection.RunID,
		"task.created",
		int64(1),
		projection.Task.TaskID,
	}
	if len(usageCall.args) != len(expected) {
		t.Fatalf("usage args mismatch: %#v", usageCall.args)
	}
	for index, value := range expected {
		if usageCall.args[index] != value {
			t.Fatalf("usage arg %d = %#v, want %#v; all args %#v", index, usageCall.args[index], value, usageCall.args)
		}
	}
	if !strings.Contains(usageCall.query, "on conflict (tenant_id, workspace_id, event_id) do nothing") {
		t.Fatalf("usage insert must be idempotent, got %q", usageCall.query)
	}
}

func TestPostgresTaskStoreKeepsUsageAndProjectionBoundaryTogether(t *testing.T) {
	executor := &fakeSQLExecutor{}
	store := NewPostgresTaskStore(executor)
	projection, err := CreateTaskResponse(TaskRequest{
		TenantID:    "tenant_boundary",
		WorkspaceID: "workspace_boundary",
		UserID:      "user_boundary",
		Prompt:      "生成一个医学研究项目的证据整理任务",
		Intent:      "research",
	})
	if err != nil {
		t.Fatalf("CreateTaskResponse returned error: %v", err)
	}

	if err := store.SaveTaskProjection(projection); err != nil {
		t.Fatalf("SaveTaskProjection returned error: %v", err)
	}

	taskWrite := executor.execCalls[0]
	usageWrite := executor.execCalls[1]
	if taskWrite.args[0] != usageWrite.args[0] || taskWrite.args[1] != usageWrite.args[1] || taskWrite.args[3] != usageWrite.args[2] {
		t.Fatalf("task and usage boundary diverged: task=%#v usage=%#v", taskWrite.args, usageWrite.args)
	}
}

func TestPostgresTaskStoreWritesProjectionAndUsageInOneTransaction(t *testing.T) {
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

	if !executor.began {
		t.Fatal("expected transaction begin before writes")
	}
	if !executor.committed {
		t.Fatal("expected transaction commit after writes")
	}
	if executor.rolledBack {
		t.Fatal("successful write should not roll back")
	}
}

func TestPostgresTaskStoreRollsBackWhenUsageWriteFails(t *testing.T) {
	executor := &fakeSQLExecutor{execErrAtCall: map[int]error{1: errors.New("usage denied")}}
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

	err = store.SaveTaskProjection(projection)
	if err == nil || !strings.Contains(err.Error(), "usage denied") {
		t.Fatalf("expected usage write error, got %v", err)
	}
	if !executor.rolledBack {
		t.Fatal("expected transaction rollback after usage write failure")
	}
	if executor.committed {
		t.Fatal("failed write should not commit")
	}
}

func TestPostgresTaskStoreChecksQuotaBeforeProjectionAndUsageWrites(t *testing.T) {
	executor := &fakeSQLExecutor{usageQuota: UsageQuotaProjection{
		Plan: "starter", TaskQuota: 2, UsagePeriod: "monthly", UsedCount: 0, RemainingCount: 2,
	}}
	store := NewPostgresTaskStore(executor)
	projection, err := CreateTaskResponse(TaskRequest{
		TenantID:    "tenant_quota",
		WorkspaceID: "workspace_quota",
		UserID:      "user_quota",
		Prompt:      "生成一个医学研究项目的证据整理任务",
		Intent:      "research",
	})
	if err != nil {
		t.Fatalf("CreateTaskResponse returned error: %v", err)
	}

	if err := store.SaveTaskProjectionWithQuota(projection); err != nil {
		t.Fatalf("SaveTaskProjectionWithQuota returned error: %v", err)
	}

	if len(executor.execCalls) != 3 {
		t.Fatalf("expected plan ensure, task write and usage write, got %#v", executor.execCalls)
	}
	if !strings.Contains(executor.execCalls[0].query, "insert into tenant_plans") {
		t.Fatalf("expected tenant plan ensure before writes, got %q", executor.execCalls[0].query)
	}
	if executor.queryRowCalls != 2 {
		t.Fatalf("expected plan lock query and usage count query, got %d", executor.queryRowCalls)
	}
	if !strings.Contains(executor.execCalls[1].query, "insert into task_projections") {
		t.Fatalf("expected task projection write after quota check, got %q", executor.execCalls[1].query)
	}
	if !strings.Contains(executor.execCalls[2].query, "insert into usage_events") {
		t.Fatalf("expected usage event write after task projection, got %q", executor.execCalls[2].query)
	}
	if !executor.committed {
		t.Fatal("successful quota-enforced write should commit")
	}
}

func TestPostgresTaskStoreQuotaFailureDoesNotWriteProjectionOrUsage(t *testing.T) {
	executor := &fakeSQLExecutor{usageQuota: UsageQuotaProjection{
		Plan: "starter", TaskQuota: 2, UsagePeriod: "monthly", UsedCount: 2, RemainingCount: 0,
	}}
	store := NewPostgresTaskStore(executor)
	projection, err := CreateTaskResponse(TaskRequest{
		TenantID:    "tenant_quota",
		WorkspaceID: "workspace_quota",
		UserID:      "user_quota",
		Prompt:      "生成一个医学研究项目的证据整理任务",
		Intent:      "research",
	})
	if err != nil {
		t.Fatalf("CreateTaskResponse returned error: %v", err)
	}

	err = store.SaveTaskProjectionWithQuota(projection)
	if !errors.Is(err, ErrQuotaExceeded) {
		t.Fatalf("expected ErrQuotaExceeded, got %v", err)
	}
	for _, call := range executor.execCalls {
		if strings.Contains(call.query, "insert into task_projections") || strings.Contains(call.query, "insert into usage_events") {
			t.Fatalf("quota failure must not write projection or usage, got %#v", executor.execCalls)
		}
	}
	if !executor.rolledBack {
		t.Fatal("quota failure should roll back")
	}
	if executor.committed {
		t.Fatal("quota failure should not commit")
	}
}

func TestPostgresTaskStoreUsageQuotaReadDoesNotLockPlanRow(t *testing.T) {
	executor := &fakeSQLExecutor{usageQuota: UsageQuotaProjection{
		Plan: "starter", TaskQuota: 2, UsagePeriod: "monthly", UsedCount: 1, RemainingCount: 1,
	}}
	store := NewPostgresTaskStore(executor)

	quota := store.GetUsageQuota("tenant_quota", "workspace_quota")

	if quota.UsedCount != 1 || quota.RemainingCount != 1 {
		t.Fatalf("quota mismatch: %#v", quota)
	}
	if strings.Contains(strings.ToLower(executor.queryCalls[0]), "for update") {
		t.Fatalf("read-only quota projection must not lock plan row: %q", executor.queryCalls[0])
	}
}
