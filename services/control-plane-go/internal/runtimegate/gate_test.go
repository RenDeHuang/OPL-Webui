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

func TestCurrentStatusRequiresCloudMVPDependencies(t *testing.T) {
	t.Setenv("OPL_WEBUI_ENV", "cloud_mvp")
	t.Setenv("OPL_DATABASE_URL", "postgres://example")
	t.Setenv("OPL_TENANT_AUTH_MODE", "medopl_launch_token")

	status := CurrentStatus()
	if status.OK {
		t.Fatalf("expected cloud MVP to require OPL CLI path: %#v", status)
	}
	if slices.Contains(status.Missing, "OPL_QUEUE_URL") {
		t.Fatalf("cloud MVP should not require queue yet: %#v", status.Missing)
	}
	if slices.Contains(status.Missing, "OPL_OBJECT_STORE_URL") {
		t.Fatalf("cloud MVP should not require object store yet: %#v", status.Missing)
	}
	if slices.Contains(status.Missing, "OPL_BILLING_MODE") {
		t.Fatalf("cloud MVP should not require billing yet: %#v", status.Missing)
	}
	if !slices.Contains(status.Missing, "OPL_CLI_PATH") {
		t.Fatalf("cloud MVP should require OPL CLI path: %#v", status.Missing)
	}
}

func TestCurrentStatusAcceptsCloudMVPMinimumDependencies(t *testing.T) {
	t.Setenv("OPL_WEBUI_ENV", "cloud_mvp")
	t.Setenv("OPL_DATABASE_URL", "postgres://example")
	t.Setenv("OPL_TENANT_AUTH_MODE", "medopl_launch_token")
	t.Setenv("OPL_CLI_PATH", "/opt/opl/bin/opl")

	status := CurrentStatus()
	if !status.OK {
		t.Fatalf("expected cloud MVP to be ready with minimum dependencies: %#v", status)
	}
	if status.Environment != "cloud_mvp" {
		t.Fatalf("environment mismatch: %s", status.Environment)
	}
}
