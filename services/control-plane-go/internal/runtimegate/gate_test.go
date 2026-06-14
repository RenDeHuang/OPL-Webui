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
