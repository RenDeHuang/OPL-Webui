package main

import (
	"context"
	"encoding/json"
	"fmt"
	"io"
	"log"
	"net/http"
	"os"
	"regexp"

	"github.com/RenDeHuang/OPL-Webui/services/control-plane-go/internal/mvp"
	"github.com/RenDeHuang/OPL-Webui/services/control-plane-go/internal/oplbridge"
	"github.com/RenDeHuang/OPL-Webui/services/control-plane-go/internal/runtimegate"
)

func main() {
	if handled, code := runCLI(os.Args[1:], os.Stdout, os.Stderr); handled {
		os.Exit(code)
	}

	if err := mvp.ConfigureDefaultTaskStoreFromEnv(); err != nil {
		fmt.Fprintln(os.Stderr, err)
		os.Exit(1)
	}

	mux := http.NewServeMux()
	mux.HandleFunc("/healthz", handleHealthz)
	mux.HandleFunc("/readyz", handleReadyz)
	mux.HandleFunc("/metricsz", handleMetricsz)
	mux.HandleFunc("/api/opl/snapshot", oplbridge.HandleSnapshot)
	mux.HandleFunc("/api/session/launch", mvp.HandleSessionLaunch)
	mux.HandleFunc("/api/mvp/task", mvp.HandleTask)
	mux.HandleFunc("/api/mvp/tasks/", mvp.HandleStoredTask)
	mux.Handle("/", http.FileServer(http.Dir("apps/web")))

	addr := serverAddress()
	log.Printf("OPL WebUI Go control plane listening on http://%s", addr)
	if err := http.ListenAndServe(addr, mux); err != nil {
		fmt.Fprintln(os.Stderr, err)
		os.Exit(1)
	}
}

func runCLI(args []string, stdout io.Writer, stderr io.Writer) (bool, int) {
	if len(args) == 0 || args[0] != "canary" {
		if len(args) == 1 && (args[0] == "--help" || args[0] == "-h" || args[0] == "help") {
			printUsage(stdout)
			return true, 0
		}
		return false, 0
	}
	if len(args) != 2 {
		fmt.Fprintln(stderr, "usage: opl-webui-control-plane canary db|opl-cli")
		return true, 2
	}

	var report CanaryReport
	var err error
	switch args[1] {
	case "db":
		report, err = runDBCanary(mvp.OpenPostgresTaskStore)
	case "opl-cli":
		report = runOPLCLICanary(oplbridge.NewDefaultRunner())
	default:
		fmt.Fprintln(stderr, "usage: opl-webui-control-plane canary db|opl-cli")
		return true, 2
	}
	if err != nil {
		report = canaryErrorReport(args[1], err)
	}
	if encodeErr := json.NewEncoder(stdout).Encode(report); encodeErr != nil {
		fmt.Fprintln(stderr, encodeErr)
		return true, 1
	}
	if err != nil || !report.OK {
		return true, 1
	}
	return true, 0
}

func printUsage(stdout io.Writer) {
	fmt.Fprintln(stdout, "usage: opl-webui-control-plane [--help] [canary db|canary opl-cli]")
	fmt.Fprintln(stdout, "")
	fmt.Fprintln(stdout, "commands:")
	fmt.Fprintln(stdout, "  canary db       verify Postgres open/ping/schema/write/read/delete")
	fmt.Fprintln(stdout, "  canary opl-cli  verify OPL readonly CLI surfaces")
}

func serverAddress() string {
	host := os.Getenv("HOST")
	if host == "" {
		host = "127.0.0.1"
	}

	port := os.Getenv("PORT")
	if port == "" {
		port = "4173"
	}

	return host + ":" + port
}

func handleHealthz(response http.ResponseWriter, request *http.Request) {
	if request.Method != http.MethodGet {
		response.Header().Set("allow", http.MethodGet)
		http.Error(response, "method not allowed", http.StatusMethodNotAllowed)
		return
	}

	response.Header().Set("content-type", "application/json; charset=utf-8")
	_ = json.NewEncoder(response).Encode(map[string]any{
		"ok":      true,
		"service": "opl-webui-control-plane",
	})
}

func handleReadyz(response http.ResponseWriter, request *http.Request) {
	if request.Method != http.MethodGet {
		response.Header().Set("allow", http.MethodGet)
		http.Error(response, "method not allowed", http.StatusMethodNotAllowed)
		return
	}

	status := runtimegate.CurrentStatus()
	httpStatus := http.StatusOK
	if !status.OK {
		httpStatus = http.StatusServiceUnavailable
	}

	response.Header().Set("content-type", "application/json; charset=utf-8")
	response.WriteHeader(httpStatus)
	_ = json.NewEncoder(response).Encode(status)
}

func handleMetricsz(response http.ResponseWriter, request *http.Request) {
	if request.Method != http.MethodGet {
		response.Header().Set("allow", http.MethodGet)
		http.Error(response, "method not allowed", http.StatusMethodNotAllowed)
		return
	}

	status := runtimegate.CurrentStatus()
	response.Header().Set("content-type", "application/json; charset=utf-8")
	_ = json.NewEncoder(response).Encode(map[string]any{
		"ok":                     status.OK,
		"service":                "opl-webui-control-plane",
		"environment":            status.Environment,
		"ready":                  status.OK,
		"missingDependencyCount": len(status.Missing),
		"missingDependencies":    status.Missing,
	})
}

type CanaryReport struct {
	OK       bool     `json:"ok"`
	Kind     string   `json:"kind"`
	Checks   []string `json:"checks"`
	Error    string   `json:"error,omitempty"`
	PolicyID string   `json:"policyId,omitempty"`
}

var databaseURLPattern = regexp.MustCompile(`(?i)postgres(?:ql)?://\S+`)

func canaryErrorReport(kind string, err error) CanaryReport {
	return CanaryReport{
		OK:    false,
		Kind:  kind,
		Error: databaseURLPattern.ReplaceAllString(err.Error(), "[redacted-database-url]"),
	}
}

func runDBCanary(openPostgres mvp.PostgresStoreOpener) (CanaryReport, error) {
	databaseURL := os.Getenv("OPL_DATABASE_URL")
	if databaseURL == "" {
		return CanaryReport{}, fmt.Errorf("OPL_DATABASE_URL is required")
	}
	store, err := openPostgres(databaseURL)
	if err != nil {
		return CanaryReport{}, fmt.Errorf("open postgres canary: %w", err)
	}

	projection, err := mvp.CreateAndStoreTaskResponse(mvp.TaskRequest{
		TenantID:    "tenant_cloud_canary",
		WorkspaceID: "workspace_cloud_canary",
		UserID:      "user_cloud_canary",
		Prompt:      "OPL-Webui cloud MVP database canary",
		Intent:      "general",
	}, store)
	if err != nil {
		return CanaryReport{}, fmt.Errorf("write postgres canary projection: %w", err)
	}
	cleanup := func() error {
		return store.DeleteTaskProjection("tenant_cloud_canary", "workspace_cloud_canary", projection.Task.TaskID)
	}
	if _, ok := store.GetTaskProjection("tenant_cloud_canary", "workspace_cloud_canary", projection.Task.TaskID); !ok {
		_ = cleanup()
		return CanaryReport{}, fmt.Errorf("read postgres canary projection")
	}
	if err := cleanup(); err != nil {
		return CanaryReport{}, fmt.Errorf("delete postgres canary projection: %w", err)
	}

	return CanaryReport{
		OK:     true,
		Kind:   "db",
		Checks: []string{"open", "ping", "schema", "write", "read", "delete"},
	}, nil
}

func runOPLCLICanary(runner oplbridge.Runner) CanaryReport {
	snapshot := oplbridge.BuildSnapshot(context.Background(), runner)

	report := CanaryReport{
		OK:       snapshot.OK,
		Kind:     "opl-cli",
		Checks:   []string{"system.initialize", "connect.modules", "contract.domains"},
		PolicyID: oplbridge.PolicyID,
	}
	if !report.OK {
		report.Error = "OPL CLI readonly canary failed"
	}
	return report
}
