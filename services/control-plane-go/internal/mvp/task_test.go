package mvp

import "testing"

func TestCreateTaskResponseCreatesTenantScopedProjection(t *testing.T) {
	result, err := CreateTaskResponse(TaskRequest{
		TenantID:    "tenant_cloud_demo",
		WorkspaceID: "workspace_cloud_demo",
		UserID:      "user_demo",
		Prompt:      "生成一个医学研究项目的证据整理任务",
		Intent:      "research",
	})
	if err != nil {
		t.Fatalf("CreateTaskResponse returned error: %v", err)
	}

	if !result.OK {
		t.Fatal("expected ok response")
	}
	if result.TenantID != "tenant_cloud_demo" {
		t.Fatalf("tenant mismatch: %s", result.TenantID)
	}
	if result.Task.Status != "completed" {
		t.Fatalf("status mismatch: %s", result.Task.Status)
	}
	if result.Artifacts[0].Kind != "analysis_package" {
		t.Fatalf("artifact kind mismatch: %s", result.Artifacts[0].Kind)
	}
	if result.Adapter.Command[0] != "opl" {
		t.Fatalf("adapter command mismatch: %#v", result.Adapter.Command)
	}
}

func TestCreateTaskResponseRejectsMissingTenant(t *testing.T) {
	_, err := CreateTaskResponse(TaskRequest{
		WorkspaceID: "workspace_cloud_demo",
		UserID:      "user_demo",
		Prompt:      "生成一个医学研究项目的证据整理任务",
	})
	if err == nil {
		t.Fatal("expected missing tenant error")
	}
}
