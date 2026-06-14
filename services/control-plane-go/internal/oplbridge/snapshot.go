package oplbridge

import (
	"bytes"
	"context"
	"encoding/json"
	"errors"
	"net/http"
	"os"
	"os/exec"
	"slices"
	"time"
)

const PolicyID = "opl.cli.readonly.snapshot"

type Runner interface {
	Run(context.Context, []string) ([]byte, error)
}

type ExecRunner struct {
	Path    string
	Timeout time.Duration
}

type CommandProjection struct {
	Args     []string `json:"args"`
	PolicyID string   `json:"policyId"`
	Mutating bool     `json:"mutating"`
	OK       bool     `json:"ok"`
	Error    string   `json:"error,omitempty"`
}

type Snapshot struct {
	OK               bool                `json:"ok"`
	Mode             string              `json:"mode"`
	PolicyID         string              `json:"policyId"`
	Commands         []CommandProjection `json:"commands"`
	SystemInitialize map[string]any      `json:"systemInitialize"`
	Modules          map[string]any      `json:"modules"`
	Domains          map[string]any      `json:"domains"`
}

type ErrorResponse struct {
	OK        bool   `json:"ok"`
	ErrorCode string `json:"errorCode"`
	Message   string `json:"message"`
}

var readonlyCommands = [][]string{
	{"system", "initialize", "--json"},
	{"modules", "--json"},
	{"contract", "domains", "--json"},
}

func NewDefaultRunner() ExecRunner {
	path := os.Getenv("OPL_CLI_PATH")
	if path == "" {
		path = "/home/dev/projects/one-person-lab/bin/opl"
	}

	return ExecRunner{
		Path:    path,
		Timeout: 8 * time.Second,
	}
}

func (runner ExecRunner) Run(ctx context.Context, args []string) ([]byte, error) {
	if err := validateReadonlyCommand(args); err != nil {
		return nil, err
	}
	if runner.Path == "" {
		return nil, errors.New("OPL CLI path is empty")
	}

	timeout := runner.Timeout
	if timeout <= 0 {
		timeout = 8 * time.Second
	}
	commandCtx, cancel := context.WithTimeout(ctx, timeout)
	defer cancel()

	command := exec.CommandContext(commandCtx, runner.Path, args...)
	var stderr bytes.Buffer
	command.Stderr = &stderr
	output, err := command.Output()
	if commandCtx.Err() != nil {
		return nil, commandCtx.Err()
	}
	if err != nil {
		message := stderr.String()
		if message == "" {
			message = err.Error()
		}
		return nil, errors.New(message)
	}

	return output, nil
}

func BuildSnapshot(ctx context.Context, runner Runner) Snapshot {
	snapshot := Snapshot{
		OK:       true,
		Mode:     "readonly",
		PolicyID: PolicyID,
		Commands: []CommandProjection{},
	}

	for _, args := range readonlyCommands {
		command := CommandProjection{
			Args:     append([]string{}, args...),
			PolicyID: PolicyID,
			Mutating: false,
			OK:       true,
		}

		payload, err := runner.Run(ctx, args)
		if err != nil {
			command.OK = false
			command.Error = "OPL CLI command failed"
			snapshot.OK = false
			snapshot.Commands = append(snapshot.Commands, command)
			continue
		}

		projection := map[string]any{}
		if err := json.Unmarshal(payload, &projection); err != nil {
			command.OK = false
			command.Error = err.Error()
			snapshot.OK = false
			snapshot.Commands = append(snapshot.Commands, command)
			continue
		}

		switch args[0] {
		case "system":
			snapshot.SystemInitialize = projection
		case "modules":
			snapshot.Modules = projection
		case "contract":
			snapshot.Domains = projection
		}
		snapshot.Commands = append(snapshot.Commands, command)
	}

	return snapshot
}

func HandleSnapshot(response http.ResponseWriter, request *http.Request) {
	if request.Method != http.MethodGet {
		writeJSON(response, http.StatusMethodNotAllowed, ErrorResponse{
			OK:        false,
			ErrorCode: "METHOD_NOT_ALLOWED",
			Message:   "method not allowed",
		})
		return
	}

	writeJSON(response, http.StatusOK, BuildSnapshot(request.Context(), NewDefaultRunner()))
}

func validateReadonlyCommand(args []string) error {
	for _, command := range readonlyCommands {
		if slices.Equal(command, args) {
			return nil
		}
	}
	if isTaskRouteCommand(args) {
		return nil
	}

	return errors.New("OPL command is not in the readonly snapshot allowlist")
}

func writeJSON(response http.ResponseWriter, status int, body any) {
	response.Header().Set("content-type", "application/json; charset=utf-8")
	response.WriteHeader(status)
	_ = json.NewEncoder(response).Encode(body)
}
