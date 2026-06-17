package mvp

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
