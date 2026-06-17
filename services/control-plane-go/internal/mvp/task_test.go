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

func TestCreateTaskResponseDefaultsMissingIntentToGeneral(t *testing.T) {
	result, err := CreateTaskResponse(TaskRequest{
		TenantID:    "tenant_cloud_demo",
		WorkspaceID: "workspace_cloud_demo",
		UserID:      "user_demo",
		Prompt:      "生成一个医学研究项目的证据整理任务",
	})
	if err != nil {
		t.Fatalf("CreateTaskResponse returned error: %v", err)
	}

	if result.Task.Intent != "general" {
		t.Fatalf("intent mismatch: %s", result.Task.Intent)
	}
	if result.Artifacts[0].Kind != "document" {
		t.Fatalf("artifact kind mismatch: %s", result.Artifacts[0].Kind)
	}
}

func TestCreateTaskResponseRejectsInvalidIntent(t *testing.T) {
	_, err := CreateTaskResponse(TaskRequest{
		TenantID:    "tenant_cloud_demo",
		WorkspaceID: "workspace_cloud_demo",
		UserID:      "user_demo",
		Prompt:      "生成一个医学研究项目的证据整理任务",
		Intent:      "side_effect_runtime",
	})
	if err == nil {
		t.Fatal("expected invalid intent error")
	}
}

func TestCreateTaskResponseRejectsUnstableBoundaryID(t *testing.T) {
	_, err := CreateTaskResponse(TaskRequest{
		TenantID:    "tenant/demo",
		WorkspaceID: "workspace_cloud_demo",
		UserID:      "user_demo",
		Prompt:      "生成一个医学研究项目的证据整理任务",
		Intent:      "research",
	})
	if err == nil {
		t.Fatal("expected invalid tenant boundary error")
	}
}

func TestCreateTaskResponseSupportsSchemaIntentEnum(t *testing.T) {
	tests := []struct {
		intent       string
		artifactKind string
	}{
		{intent: "research", artifactKind: "analysis_package"},
		{intent: "grant", artifactKind: "grant_package"},
		{intent: "presentation", artifactKind: "slide_deck"},
		{intent: "general", artifactKind: "document"},
	}

	for _, tt := range tests {
		t.Run(tt.intent, func(t *testing.T) {
			result, err := CreateTaskResponse(TaskRequest{
				TenantID:    "tenant_cloud_demo",
				WorkspaceID: "workspace_cloud_demo",
				UserID:      "user_demo",
				Prompt:      "生成一个医学研究项目的证据整理任务",
				Intent:      tt.intent,
			})
			if err != nil {
				t.Fatalf("CreateTaskResponse returned error: %v", err)
			}
			if result.Task.Intent != tt.intent {
				t.Fatalf("intent mismatch: %s", result.Task.Intent)
			}
			if result.Artifacts[0].Kind != tt.artifactKind {
				t.Fatalf("artifact kind mismatch: %s", result.Artifacts[0].Kind)
			}
		})
	}
}

func TestCreateAndStoreTaskResponsePersistsTenantScopedProjection(t *testing.T) {
	store := NewMemoryTaskStore()

	result, err := CreateAndStoreTaskResponse(TaskRequest{
		TenantID:    "tenant_cloud_demo",
		WorkspaceID: "workspace_cloud_demo",
		UserID:      "user_demo",
		Prompt:      "生成一个医学研究项目的证据整理任务",
		Intent:      "research",
	}, store)
	if err != nil {
		t.Fatalf("CreateAndStoreTaskResponse returned error: %v", err)
	}

	stored, ok := store.GetTaskProjection("tenant_cloud_demo", "workspace_cloud_demo", result.Task.TaskID)
	if !ok {
		t.Fatal("expected stored task projection")
	}
	if stored.RunID != result.RunID {
		t.Fatalf("stored run mismatch: %s", stored.RunID)
	}
	if stored.Artifacts[0].ArtifactID != result.Artifacts[0].ArtifactID {
		t.Fatalf("stored artifact mismatch: %#v", stored.Artifacts)
	}
}
