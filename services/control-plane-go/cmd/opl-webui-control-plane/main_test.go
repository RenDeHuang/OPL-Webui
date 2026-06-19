package main

import (
	"bytes"
	"context"
	"encoding/json"
	"errors"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"

	"github.com/RenDeHuang/OPL-Webui/services/control-plane-go/internal/controlplane"
)

func TestServerAddressUsesHostAndPort(t *testing.T) {
	t.Setenv("HOST", "0.0.0.0")
	t.Setenv("PORT", "8080")

	if got := serverAddress(); got != "0.0.0.0:8080" {
		t.Fatalf("serverAddress() = %q, want %q", got, "0.0.0.0:8080")
	}
}

func TestServerAddressDefaultsToLocalDevelopment(t *testing.T) {
	t.Setenv("HOST", "")
	t.Setenv("PORT", "")

	if got := serverAddress(); got != "127.0.0.1:4173" {
		t.Fatalf("serverAddress() = %q, want %q", got, "127.0.0.1:4173")
	}
}

func TestRunCLIHelpPrintsUsage(t *testing.T) {
	stdout := &bytes.Buffer{}
	stderr := &bytes.Buffer{}

	handled, code := runCLI([]string{"--help"}, stdout, stderr)

	if !handled {
		t.Fatal("expected --help to be handled")
	}
	if code != 0 {
		t.Fatalf("help exit code = %d, want 0, stderr=%q", code, stderr.String())
	}
	if !strings.Contains(stdout.String(), "opl-webui-control-plane") {
		t.Fatalf("help should name binary, got %q", stdout.String())
	}
	if !strings.Contains(stdout.String(), "canary db") {
		t.Fatalf("help should include canary db, got %q", stdout.String())
	}
}

func TestHandleMetricszReportsReadinessWithoutLeakingSecrets(t *testing.T) {
	t.Setenv("OPL_WEBUI_ENV", "web_cloud")
	t.Setenv("OPL_DATABASE_URL", "postgres://user:secret@example/oplweb")
	t.Setenv("OPL_TENANT_AUTH_MODE", "medopl_launch_token")
	t.Setenv("OPL_CLI_PATH", "")

	request := httptest.NewRequest(http.MethodGet, "/metricsz", nil)
	response := httptest.NewRecorder()

	handleMetricsz(response, request)

	if response.Code != http.StatusOK {
		t.Fatalf("metricsz status = %d, body=%s", response.Code, response.Body.String())
	}
	var body map[string]any
	if err := json.Unmarshal(response.Body.Bytes(), &body); err != nil {
		t.Fatalf("decode metricsz: %v", err)
	}
	if body["service"] != "opl-webui-control-plane" {
		t.Fatalf("service mismatch: %#v", body["service"])
	}
	if body["environment"] != "web_cloud" {
		t.Fatalf("environment mismatch: %#v", body["environment"])
	}
	if body["ready"] != false || body["ok"] != false {
		t.Fatalf("metricsz should mirror runtime readiness: %#v", body)
	}
	if body["missingDependencyCount"] != float64(4) {
		t.Fatalf("missingDependencyCount mismatch: %#v", body["missingDependencyCount"])
	}
	missing, ok := body["missingDependencies"].([]any)
	expectedMissing := []any{
		"OPL_API_KEY_ENCRYPTION_SECRET",
		"OPL_CHAT_MODEL",
		"OPL_CLI_PATH",
		"OPL_SESSION_SECRET",
	}
	if !ok || len(missing) != len(expectedMissing) {
		t.Fatalf("missingDependencies mismatch: %#v", body["missingDependencies"])
	}
	for index, expected := range expectedMissing {
		if missing[index] != expected {
			t.Fatalf("missingDependencies mismatch: %#v", body["missingDependencies"])
		}
	}
	encoded := response.Body.String()
	if strings.Contains(encoded, "secret") || strings.Contains(encoded, "postgres://") {
		t.Fatalf("metricsz leaked sensitive values: %s", encoded)
	}
}

func TestHandleMetricszRejectsNonGet(t *testing.T) {
	request := httptest.NewRequest(http.MethodPost, "/metricsz", nil)
	response := httptest.NewRecorder()

	handleMetricsz(response, request)

	if response.Code != http.StatusMethodNotAllowed {
		t.Fatalf("metricsz POST status = %d, want %d", response.Code, http.StatusMethodNotAllowed)
	}
}

func TestRunDBCanaryUsesDatabaseURLWithoutLeakingIt(t *testing.T) {
	t.Setenv("OPL_DATABASE_URL", "postgres://user:secret@example/oplweb")
	called := false
	store := controlplane.NewMemoryTaskStore()

	report, err := runDBCanary(func(databaseURL string) (controlplane.TaskProjectionStore, error) {
		called = true
		if databaseURL != "postgres://user:secret@example/oplweb" {
			t.Fatalf("database URL mismatch: %s", databaseURL)
		}
		return store, nil
	})
	if err != nil {
		t.Fatalf("runDBCanary returned error: %v", err)
	}
	if !called {
		t.Fatal("expected postgres opener")
	}
	if !report.OK {
		t.Fatalf("expected canary ok: %#v", report)
	}
	encoded, err := json.Marshal(report)
	if err != nil {
		t.Fatalf("marshal report: %v", err)
	}
	if strings.Contains(string(encoded), "secret") || strings.Contains(string(encoded), "postgres://") {
		t.Fatalf("canary report leaked connection details: %s", encoded)
	}
	if !strings.Contains(strings.Join(report.Checks, ","), "delete") {
		t.Fatalf("canary should report delete check: %#v", report.Checks)
	}
	if len(store.ListTaskProjections("tenant_cloud_canary", "workspace_cloud_canary", "user_cloud_canary")) != 0 {
		t.Fatal("canary projection should be cleaned up")
	}
}

func TestRunDBCanaryFailsClosedWithoutDatabaseURL(t *testing.T) {
	t.Setenv("OPL_DATABASE_URL", "")

	_, err := runDBCanary(func(string) (controlplane.TaskProjectionStore, error) {
		t.Fatal("opener should not run without database URL")
		return nil, nil
	})
	if err == nil || !strings.Contains(err.Error(), "OPL_DATABASE_URL is required") {
		t.Fatalf("expected missing database error, got %v", err)
	}
}

func TestRunDBCanaryPropagatesOpenError(t *testing.T) {
	t.Setenv("OPL_DATABASE_URL", "postgres://user:secret@example/oplweb")
	_, err := runDBCanary(func(string) (controlplane.TaskProjectionStore, error) {
		return nil, errors.New("network timeout")
	})
	if err == nil || !strings.Contains(err.Error(), "open postgres canary") {
		t.Fatalf("expected open error, got %v", err)
	}
}

func TestCanaryReportErrorRedactsConnectionDetails(t *testing.T) {
	report := canaryErrorReport("db", errors.New("dial postgres://user:secret@example/oplweb failed"))
	encoded, err := json.Marshal(report)
	if err != nil {
		t.Fatalf("marshal report: %v", err)
	}
	if strings.Contains(string(encoded), "secret") || strings.Contains(string(encoded), "postgres://") {
		t.Fatalf("canary error report leaked connection details: %s", encoded)
	}
	if !strings.Contains(report.Error, "[redacted-database-url]") {
		t.Fatalf("expected redacted marker, got %q", report.Error)
	}
}

type readFailingCanaryStore struct {
	projection controlplane.TaskResponse
	deleted    bool
}

func (store *readFailingCanaryStore) SaveTaskProjection(projection controlplane.TaskResponse) error {
	store.projection = projection
	return nil
}

func (store *readFailingCanaryStore) SaveTaskProjectionWithQuota(projection controlplane.TaskResponse) error {
	return store.SaveTaskProjection(projection)
}

func (store *readFailingCanaryStore) GetUsageQuota(string, string) controlplane.UsageQuotaProjection {
	return controlplane.UsageQuotaProjection{Plan: "starter", TaskQuota: 2, UsagePeriod: "monthly", RemainingCount: 2}
}

func (store *readFailingCanaryStore) GetTaskProjection(string, string, string) (controlplane.TaskResponse, bool) {
	return controlplane.TaskResponse{}, false
}

func (store *readFailingCanaryStore) ListTaskProjections(string, string, string) []controlplane.TaskResponse {
	return []controlplane.TaskResponse{}
}

func (store *readFailingCanaryStore) DeleteTaskProjection(tenantID string, workspaceID string, taskID string) error {
	if tenantID == store.projection.TenantID && workspaceID == store.projection.WorkspaceID && taskID == store.projection.Task.TaskID {
		store.deleted = true
	}
	return nil
}

func TestRunDBCanaryCleansUpAfterReadFailure(t *testing.T) {
	t.Setenv("OPL_DATABASE_URL", "postgres://user:secret@example/oplweb")
	store := &readFailingCanaryStore{}

	_, err := runDBCanary(func(string) (controlplane.TaskProjectionStore, error) {
		return store, nil
	})

	if err == nil || !strings.Contains(err.Error(), "read postgres canary projection") {
		t.Fatalf("expected read error, got %v", err)
	}
	if !store.deleted {
		t.Fatal("canary projection should be cleaned up after read failure")
	}
}

type fakeCanaryRunner struct {
	calls [][]string
}

func (runner *fakeCanaryRunner) Run(_ context.Context, args []string) ([]byte, error) {
	runner.calls = append(runner.calls, append([]string{}, args...))
	return []byte(`{"ok":true}`), nil
}

func TestRunOPLCLICanaryUsesReadonlySurfaces(t *testing.T) {
	runner := &fakeCanaryRunner{}

	report := runOPLCLICanary(runner)

	if !report.OK {
		t.Fatalf("expected canary ok: %#v", report)
	}
	if len(runner.calls) != 3 {
		t.Fatalf("expected snapshot and route readonly commands, got %#v", runner.calls)
	}
	for _, call := range runner.calls {
		if len(call) == 0 || call[0] == "install" || call[0] == "repair" {
			t.Fatalf("unexpected mutating command: %#v", call)
		}
		if len(call) >= 2 && call[0] == "domain" && call[1] == "resolve-request" {
			t.Fatalf("canary should not require Codex passthrough command: %#v", call)
		}
	}
}
