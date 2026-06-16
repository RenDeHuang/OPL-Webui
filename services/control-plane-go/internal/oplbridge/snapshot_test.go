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
	case "domain resolve-request":
		return []byte(`{"version":"g2","resolution":{"status":"routed","workstream_id":"research_ops","domain_id":"medautoscience","entry_surface":"domain_gateway","confidence":"high"}}`), nil
	case "contract handoff-envelope":
		return []byte(`{"version":"g2","handoff_bundle":{"surface_id":"opl_family_handoff_bundle","target_domain_id":"medautoscience","task_intent":"research","entry_mode":"product_entry_handoff","routing_status":"routed"}}`), nil
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

func TestTaskRouteUsesReadonlyResolveAndHandoffCommands(t *testing.T) {
	runner := &fakeRunner{}
	route := BuildTaskRoute(context.Background(), runner, TaskRouteRequest{
		Prompt: "生成一个医学研究项目的证据整理任务",
		Intent: "research",
		Target: "deliverable",
	})

	if !route.OK {
		t.Fatal("expected ok route")
	}
	if route.PolicyID != "opl.cli.readonly.task-route" {
		t.Fatalf("unexpected policy: %s", route.PolicyID)
	}
	if len(route.Commands) != 2 {
		t.Fatalf("command count = %d, want 2", len(route.Commands))
	}
	for _, command := range route.Commands {
		if command.Mutating {
			t.Fatalf("route included mutating command: %#v", command.Args)
		}
	}
	if runner.calls[0][0] != "domain" || runner.calls[0][1] != "resolve-request" {
		t.Fatalf("unexpected resolve call: %#v", runner.calls[0])
	}
	if runner.calls[1][0] != "contract" || runner.calls[1][1] != "handoff-envelope" {
		t.Fatalf("unexpected handoff call: %#v", runner.calls[1])
	}
	resolution := route.Resolution["resolution"].(map[string]any)
	if resolution["domain_id"] != "medautoscience" {
		t.Fatalf("domain_id = %v, want medautoscience", resolution["domain_id"])
	}
	handoff := route.HandoffBundle["handoff_bundle"].(map[string]any)
	if handoff["target_domain_id"] != "medautoscience" {
		t.Fatalf("target_domain_id = %v, want medautoscience", handoff["target_domain_id"])
	}
}

func TestTaskRouteDoesNotExposeRawRunnerErrors(t *testing.T) {
	route := BuildTaskRoute(context.Background(), failingRunner{}, TaskRouteRequest{
		Prompt: "生成一个医学研究项目的证据整理任务",
		Intent: "research",
		Target: "deliverable",
	})

	if route.OK {
		t.Fatal("expected degraded route")
	}
	if len(route.Commands) == 0 {
		t.Fatal("expected command projections")
	}
	if route.Commands[0].Error != "OPL CLI command failed" {
		t.Fatalf("Error = %q, want stable public message", route.Commands[0].Error)
	}
	if route.Commands[0].Error == "raw runner stderr with local diagnostics" {
		t.Fatal("raw runner error leaked into public route")
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
