package runtimegate

import (
	"slices"
	"testing"
)

func TestCurrentStatusAllowsDevelopmentWithoutProductionDependencies(t *testing.T) {
	t.Setenv("OPL_WEBUI_ENV", "")

	status := CurrentStatus()
	if !status.OK {
		t.Fatalf("expected development to be ready: %#v", status)
	}
	if status.Environment != "development" {
		t.Fatalf("environment mismatch: %s", status.Environment)
	}
}

func TestCurrentStatusRequiresProductionDependencies(t *testing.T) {
	t.Setenv("OPL_WEBUI_ENV", "production")
	t.Setenv("OPL_DATABASE_URL", "postgres://example")

	status := CurrentStatus()
	if status.OK {
		t.Fatalf("expected production to be blocked: %#v", status)
	}
	if slices.Contains(status.Missing, "OPL_DATABASE_URL") {
		t.Fatalf("configured database should not be missing: %#v", status.Missing)
	}
	if !slices.IsSorted(status.Missing) {
		t.Fatalf("missing dependencies should be stable sorted: %#v", status.Missing)
	}
}

func TestCurrentStatusRequiresWebCloudDependencies(t *testing.T) {
	t.Setenv("OPL_WEBUI_ENV", "web_cloud")
	t.Setenv("OPL_DATABASE_URL", "postgres://example")

	status := CurrentStatus()
	if status.OK {
		t.Fatalf("expected web cloud to require OPL CLI path: %#v", status)
	}
	if slices.Contains(status.Missing, "OPL_QUEUE_URL") {
		t.Fatalf("web cloud should not require queue yet: %#v", status.Missing)
	}
	if slices.Contains(status.Missing, "OPL_OBJECT_STORE_URL") {
		t.Fatalf("web cloud should not require object store yet: %#v", status.Missing)
	}
	if slices.Contains(status.Missing, "OPL_BILLING_MODE") {
		t.Fatalf("web cloud should not require billing yet: %#v", status.Missing)
	}
	if !slices.Contains(status.Missing, "OPL_CLI_PATH") {
		t.Fatalf("web cloud should require OPL CLI path: %#v", status.Missing)
	}
	for _, key := range []string{"OPL_SESSION_SECRET", "OPL_API_KEY_ENCRYPTION_SECRET", "OPL_CHAT_MODEL"} {
		if !slices.Contains(status.Missing, key) {
			t.Fatalf("web cloud should require %s: %#v", key, status.Missing)
		}
	}
}

func TestCurrentStatusAcceptsWebCloudMinimumDependencies(t *testing.T) {
	t.Setenv("OPL_WEBUI_ENV", "web_cloud")
	t.Setenv("OPL_DATABASE_URL", "postgres://example")
	t.Setenv("OPL_SESSION_SECRET", "test-session-secret")
	t.Setenv("OPL_API_KEY_ENCRYPTION_SECRET", "test-api-key-secret")
	t.Setenv("OPL_CHAT_MODEL", "gpt-4o-mini")
	t.Setenv("OPL_CLI_PATH", "/opt/opl/bin/opl")

	status := CurrentStatus()
	if !status.OK {
		t.Fatalf("expected web cloud to be ready with minimum dependencies: %#v", status)
	}
	if status.Environment != "web_cloud" {
		t.Fatalf("environment mismatch: %s", status.Environment)
	}
}

func TestCurrentStatusDoesNotRequireRetiredLaunchTokenSecret(t *testing.T) {
	t.Setenv("OPL_WEBUI_ENV", "web_cloud")
	t.Setenv("OPL_DATABASE_URL", "postgres://example")
	t.Setenv("OPL_SESSION_SECRET", "test-session-secret")
	t.Setenv("OPL_API_KEY_ENCRYPTION_SECRET", "test-api-key-secret")
	t.Setenv("OPL_CHAT_MODEL", "gpt-4o-mini")
	t.Setenv("OPL_CLI_PATH", "/opt/opl/bin/opl")

	status := CurrentStatus()
	if !status.OK {
		t.Fatalf("expected public account web cloud to be ready without retired launch token secret: %#v", status)
	}
	if slices.Contains(status.Missing, "OPL_TENANT_AUTH_SECRET") {
		t.Fatalf("retired launch token secret should not be required: %#v", status.Missing)
	}
}
