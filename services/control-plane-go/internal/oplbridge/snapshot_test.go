package oplbridge

import (
	"context"
	"encoding/json"
	"errors"
	"testing"
)

type fakeRunner struct {
	calls [][]string
}

func (runner *fakeRunner) Run(_ context.Context, args []string) ([]byte, error) {
	runner.calls = append(runner.calls, append([]string{}, args...))
	switch args[0] + " " + args[1] {
	case "system initialize":
		return []byte(`{"version":"g2","system_initialize":{"overall_state":"attention_needed","readiness":{"core_ready":true,"domain_ready":false,"full_ready":false},"setup_flow":{"blocking_items":["domain_modules"]}}}`), nil
	case "connect modules":
		return []byte(`{"version":"g2","modules":{"summary":{"default_modules_count":3,"healthy_default_modules_count":1},"items":[{"module_id":"medautoscience","health_status":"ready"}]}}`), nil
	case "contract domains":
		return []byte(`{"version":"g2","domains":[{"domain_id":"medautoscience","single_app_skill":"mas"}]}`), nil
	default:
		return []byte(`{}`), nil
	}
}

func TestSnapshotUsesReadonlyOplCommands(t *testing.T) {
	runner := &fakeRunner{}
	snapshot := BuildSnapshot(context.Background(), runner)

	if snapshot.Mode != "readonly" {
		t.Fatalf("Mode = %q, want readonly", snapshot.Mode)
	}
	if !snapshot.OK {
		t.Fatal("expected ok snapshot")
	}
	if len(snapshot.Commands) != 3 {
		t.Fatalf("command count = %d, want 3", len(snapshot.Commands))
	}

	for _, command := range snapshot.Commands {
		if command.PolicyID != "opl.cli.readonly.snapshot" {
			t.Fatalf("unexpected policy: %s", command.PolicyID)
		}
		if command.Mutating {
			t.Fatalf("readonly snapshot included mutating command: %#v", command.Args)
		}
	}

	if runner.calls[0][0] != "system" || runner.calls[0][1] != "initialize" || runner.calls[0][2] != "--json" {
		t.Fatalf("unexpected first call: %#v", runner.calls[0])
	}
	if runner.calls[1][0] != "connect" || runner.calls[1][1] != "modules" || runner.calls[1][2] != "--json" {
		t.Fatalf("unexpected modules call: %#v", runner.calls[1])
	}
}

func TestSnapshotRejectsMutationCommandRegistration(t *testing.T) {
	if err := validateReadonlyCommand([]string{"module", "install", "--module", "medautoscience"}); err == nil {
		t.Fatal("expected mutation command to be rejected")
	}
}

func TestSnapshotDoesNotExposeRawRunnerErrors(t *testing.T) {
	snapshot := BuildSnapshot(context.Background(), failingRunner{})

	if snapshot.OK {
		t.Fatal("expected degraded snapshot")
	}
	if len(snapshot.Commands) == 0 {
		t.Fatal("expected command projections")
	}
	if snapshot.Commands[0].Error != "OPL CLI command failed" {
		t.Fatalf("Error = %q, want stable public message", snapshot.Commands[0].Error)
	}
	if snapshot.Commands[0].Error == "raw runner stderr with local diagnostics" {
		t.Fatal("raw runner error leaked into public snapshot")
	}
}

func TestSnapshotProjectionIsJSONSerializable(t *testing.T) {
	snapshot := BuildSnapshot(context.Background(), &fakeRunner{})
	payload, err := json.Marshal(snapshot)
	if err != nil {
		t.Fatalf("Marshal returned error: %v", err)
	}
	if !json.Valid(payload) {
		t.Fatal("snapshot is not valid JSON")
	}
}

type failingRunner struct{}

func (failingRunner) Run(context.Context, []string) ([]byte, error) {
	return nil, errors.New("raw runner stderr with local diagnostics")
}
