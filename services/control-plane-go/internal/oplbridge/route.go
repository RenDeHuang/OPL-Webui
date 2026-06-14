package oplbridge

import (
	"context"
	"encoding/json"
	"slices"
)

const TaskRoutePolicyID = "opl.cli.readonly.task-route"

type TaskRouteRequest struct {
	Prompt string
	Intent string
	Target string
}

type TaskRoute struct {
	OK            bool                `json:"ok"`
	Mode          string              `json:"mode"`
	PolicyID      string              `json:"policyId"`
	Commands      []CommandProjection `json:"commands"`
	Resolution    map[string]any      `json:"resolution"`
	HandoffBundle map[string]any      `json:"handoffBundle"`
}

func BuildTaskRoute(ctx context.Context, runner Runner, request TaskRouteRequest) TaskRoute {
	intent := request.Intent
	if intent == "" {
		intent = "general"
	}
	target := request.Target
	if target == "" {
		target = "deliverable"
	}

	commands := [][]string{
		{"domain", "resolve-request", "--intent", intent, "--target", target, "--goal", request.Prompt, "--json"},
		{"contract", "handoff-envelope", request.Prompt, "--intent", intent, "--target", target, "--json"},
	}
	route := TaskRoute{
		OK:       true,
		Mode:     "readonly",
		PolicyID: TaskRoutePolicyID,
		Commands: []CommandProjection{},
	}

	for _, args := range commands {
		command := CommandProjection{
			Args:     append([]string{}, args...),
			PolicyID: TaskRoutePolicyID,
			Mutating: false,
			OK:       true,
		}
		payload, err := runner.Run(ctx, args)
		if err != nil {
			command.OK = false
			command.Error = "OPL CLI command failed"
			route.OK = false
			route.Commands = append(route.Commands, command)
			continue
		}

		projection := map[string]any{}
		if err := json.Unmarshal(payload, &projection); err != nil {
			command.OK = false
			command.Error = err.Error()
			route.OK = false
			route.Commands = append(route.Commands, command)
			continue
		}
		switch args[0] + " " + args[1] {
		case "domain resolve-request":
			route.Resolution = projection
		case "contract handoff-envelope":
			route.HandoffBundle = projection
		}
		route.Commands = append(route.Commands, command)
	}

	return route
}

func isTaskRouteCommand(args []string) bool {
	if len(args) < 2 {
		return false
	}
	if args[0] == "domain" && args[1] == "resolve-request" {
		return slices.Contains(args, "--json")
	}
	if args[0] == "contract" && args[1] == "handoff-envelope" {
		return slices.Contains(args, "--json")
	}

	return false
}
