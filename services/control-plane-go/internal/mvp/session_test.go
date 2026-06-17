package mvp

import (
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"testing"
)

func TestSessionLaunchRequiresBearerToken(t *testing.T) {
	setCloudMVPAuthEnv(t)

	response := httptest.NewRecorder()
	request := httptest.NewRequest(http.MethodPost, "/api/session/launch", nil)

	HandleSessionLaunch(response, request)

	assertErrorResponse(t, response, http.StatusUnauthorized, "AUTH_REQUIRED")
}

func TestSessionLaunchSetsHttpOnlyBoundaryCookie(t *testing.T) {
	setCloudMVPAuthEnv(t)

	response := httptest.NewRecorder()
	request := httptest.NewRequest(http.MethodPost, "/api/session/launch", nil)
	request.Header.Set("authorization", "Bearer "+signedLaunchToken(t, "test-secret", launchTokenClaims{
		TenantID:    "tenant_token",
		WorkspaceID: "workspace_token",
		UserID:      "user_token",
	}))

	HandleSessionLaunch(response, request)

	if response.Code != http.StatusNoContent {
		t.Fatalf("status = %d, body=%s", response.Code, response.Body.String())
	}
	cookie := response.Result().Cookies()[0]
	if cookie.Name != "opl_session" || cookie.Value == "" || !cookie.HttpOnly || cookie.Path != "/" || cookie.SameSite != http.SameSiteLaxMode {
		t.Fatalf("session cookie mismatch: %#v", cookie)
	}
}

func TestSessionCookieDerivesTaskIdentity(t *testing.T) {
	setCloudMVPAuthEnv(t)

	response := httptest.NewRecorder()
	request := httptest.NewRequest(http.MethodPost, "/api/mvp/task", jsonBody(t, TaskRequest{
		Prompt: "生成一个医学研究项目的证据整理任务",
		Intent: "research",
	}))
	request.AddCookie(&http.Cookie{
		Name:  "opl_session",
		Value: signedSessionToken(t, "test-secret", launchTokenClaims{TenantID: "tenant_token", WorkspaceID: "workspace_token", UserID: "user_token"}),
	})

	handleTaskWithRunner(response, request, authBoundaryRunner{})

	if response.Code != http.StatusOK {
		t.Fatalf("status = %d, body=%s", response.Code, response.Body.String())
	}
	var projection TaskResponse
	if err := json.Unmarshal(response.Body.Bytes(), &projection); err != nil {
		t.Fatalf("decode response: %v", err)
	}
	if projection.TenantID != "tenant_token" || projection.WorkspaceID != "workspace_token" || projection.UserID != "user_token" {
		t.Fatalf("projection did not derive identity from session: %#v", projection)
	}
}
