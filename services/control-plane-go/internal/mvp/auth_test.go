package mvp

import (
	"bytes"
	"context"
	"crypto/hmac"
	"crypto/sha256"
	"encoding/base64"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"testing"
)

type authBoundaryRunner struct{}

func (authBoundaryRunner) Run(_ context.Context, args []string) ([]byte, error) {
	switch args[0] + " " + args[1] {
	case "domain resolve-request":
		return []byte(`{"resolution":{"status":"routed","domain_id":"medautoscience"}}`), nil
	case "contract handoff-envelope":
		return []byte(`{"handoff_bundle":{"target_domain_id":"medautoscience","routing_status":"routed"}}`), nil
	default:
		return []byte(`{}`), nil
	}
}

func TestLaunchTokenBoundaryAllowsDevelopmentBodyIdentity(t *testing.T) {
	t.Setenv("OPL_WEBUI_ENV", "")
	t.Setenv("OPL_TENANT_AUTH_MODE", "")

	request := httptest.NewRequest(http.MethodPost, "/api/mvp/task", nil)

	payload, authErr := applyTaskAuthBoundary(request, TaskRequest{
		TenantID:    "tenant_dev",
		WorkspaceID: "workspace_dev",
		UserID:      "user_dev",
		Prompt:      "生成一个医学研究项目的证据整理任务",
		Intent:      "research",
	})
	if authErr != nil {
		t.Fatalf("development boundary returned error: %v", authErr)
	}
	if payload.TenantID != "tenant_dev" || payload.WorkspaceID != "workspace_dev" || payload.UserID != "user_dev" {
		t.Fatalf("development boundary changed identity: %#v", payload)
	}
}

func TestLaunchTokenBoundaryRejectsMissingTokenInCloudMVP(t *testing.T) {
	setCloudMVPAuthEnv(t)

	response := httptest.NewRecorder()
	request := httptest.NewRequest(http.MethodPost, "/api/mvp/task", jsonBody(t, TaskRequest{
		TenantID:    "tenant_from_body",
		WorkspaceID: "workspace_from_body",
		UserID:      "user_from_body",
		Prompt:      "生成一个医学研究项目的证据整理任务",
		Intent:      "research",
	}))

	handleTaskWithRunner(response, request, authBoundaryRunner{})

	assertErrorResponse(t, response, http.StatusUnauthorized, "AUTH_REQUIRED")
}

func TestLaunchTokenBoundaryRejectsBodyIdentityMismatch(t *testing.T) {
	setCloudMVPAuthEnv(t)

	response := httptest.NewRecorder()
	request := httptest.NewRequest(http.MethodPost, "/api/mvp/task", jsonBody(t, TaskRequest{
		TenantID:    "tenant_other",
		WorkspaceID: "workspace_token",
		UserID:      "user_token",
		Prompt:      "生成一个医学研究项目的证据整理任务",
		Intent:      "research",
	}))
	request.Header.Set("authorization", "Bearer "+signedLaunchToken(t, "test-secret", launchTokenClaims{
		TenantID:    "tenant_token",
		WorkspaceID: "workspace_token",
		UserID:      "user_token",
	}))

	handleTaskWithRunner(response, request, authBoundaryRunner{})

	assertErrorResponse(t, response, http.StatusForbidden, "TENANT_BOUNDARY_MISMATCH")
}

func TestLaunchTokenBoundaryRejectsUnstableTokenIdentity(t *testing.T) {
	setCloudMVPAuthEnv(t)

	response := httptest.NewRecorder()
	request := httptest.NewRequest(http.MethodPost, "/api/mvp/task", jsonBody(t, TaskRequest{
		Prompt: "生成一个医学研究项目的证据整理任务",
		Intent: "research",
	}))
	request.Header.Set("authorization", "Bearer "+signedLaunchToken(t, "test-secret", launchTokenClaims{
		TenantID:    "tenant/token",
		WorkspaceID: "workspace_token",
		UserID:      "user_token",
	}))

	handleTaskWithRunner(response, request, authBoundaryRunner{})

	assertErrorResponse(t, response, http.StatusUnauthorized, "INVALID_LAUNCH_TOKEN")
}

func TestLaunchTokenBoundaryDerivesIdentityFromToken(t *testing.T) {
	setCloudMVPAuthEnv(t)

	response := httptest.NewRecorder()
	request := httptest.NewRequest(http.MethodPost, "/api/mvp/task", jsonBody(t, TaskRequest{
		Prompt: "生成一个医学研究项目的证据整理任务",
		Intent: "research",
	}))
	request.Header.Set("authorization", "Bearer "+signedLaunchToken(t, "test-secret", launchTokenClaims{
		TenantID:    "tenant_token",
		WorkspaceID: "workspace_token",
		UserID:      "user_token",
	}))

	handleTaskWithRunner(response, request, authBoundaryRunner{})

	if response.Code != http.StatusOK {
		t.Fatalf("status = %d, body=%s", response.Code, response.Body.String())
	}
	var projection TaskResponse
	if err := json.Unmarshal(response.Body.Bytes(), &projection); err != nil {
		t.Fatalf("decode response: %v", err)
	}
	if projection.TenantID != "tenant_token" || projection.WorkspaceID != "workspace_token" || projection.UserID != "user_token" {
		t.Fatalf("projection did not derive identity from token: %#v", projection)
	}
}

func setCloudMVPAuthEnv(t *testing.T) {
	t.Helper()
	t.Setenv("OPL_WEBUI_ENV", "cloud_mvp")
	t.Setenv("OPL_TENANT_AUTH_MODE", "medopl_launch_token")
	t.Setenv("OPL_TENANT_AUTH_SECRET", "test-secret")
	t.Setenv("OPL_CLI_PATH", "/tmp/fake-opl")
	t.Setenv("OPL_DATABASE_URL", "postgres://example")
	t.Setenv("OPL_SESSION_SECRET", "test-session-secret")
	t.Setenv("OPL_API_KEY_ENCRYPTION_SECRET", "test-api-key-secret")
	t.Setenv("OPL_CHAT_MODEL", "gpt-4o-mini")
}

func jsonBody(t *testing.T, payload any) *bytes.Reader {
	t.Helper()
	encoded, err := json.Marshal(payload)
	if err != nil {
		t.Fatalf("marshal body: %v", err)
	}
	return bytes.NewReader(encoded)
}

func signedLaunchToken(t *testing.T, secret string, claims launchTokenClaims) string {
	t.Helper()
	return signedToken(t, secret, "v1", claims)
}

func signedSessionToken(t *testing.T, secret string, claims launchTokenClaims) string {
	t.Helper()
	return signedToken(t, secret, "session_v1", claims)
}

func signedToken(t *testing.T, secret string, version string, claims launchTokenClaims) string {
	t.Helper()
	encodedClaims, err := json.Marshal(claims)
	if err != nil {
		t.Fatalf("marshal claims: %v", err)
	}
	claimsSegment := base64.RawURLEncoding.EncodeToString(encodedClaims)
	mac := hmac.New(sha256.New, []byte(secret))
	mac.Write([]byte(version + "." + claimsSegment))
	signature := base64.RawURLEncoding.EncodeToString(mac.Sum(nil))
	return version + "." + claimsSegment + "." + signature
}

func assertErrorResponse(t *testing.T, response *httptest.ResponseRecorder, status int, code string) {
	t.Helper()
	if response.Code != status {
		t.Fatalf("status = %d, want %d, body=%s", response.Code, status, response.Body.String())
	}
	var body ErrorResponse
	if err := json.Unmarshal(response.Body.Bytes(), &body); err != nil {
		t.Fatalf("decode error response: %v", err)
	}
	if body.OK || body.ErrorCode != code {
		t.Fatalf("error response mismatch: %#v", body)
	}
}
