package main

import (
	"context"
	"encoding/json"
	"fmt"
	"io"
	"log"
	"net/http"
	"os"
	"path/filepath"
	"regexp"
	"strings"

	"github.com/RenDeHuang/OPL-Webui/backend/control-plane-go/internal/oplbridge"
	"github.com/RenDeHuang/OPL-Webui/backend/control-plane-go/internal/runtimegate"
	"github.com/RenDeHuang/OPL-Webui/backend/control-plane-go/internal/webapp"
)

func main() {
	if handled, code := runCLI(os.Args[1:], os.Stdout, os.Stderr); handled {
		os.Exit(code)
	}

	if err := webapp.ConfigureDefaultStoreFromEnv(); err != nil {
		fmt.Fprintln(os.Stderr, err)
		os.Exit(1)
	}

	mux := http.NewServeMux()
	mux.HandleFunc("/healthz", handleHealthz)
	mux.HandleFunc("/readyz", handleReadyz)
	mux.HandleFunc("/metricsz", handleMetricsz)
	mux.HandleFunc("/api/opl/snapshot", oplbridge.HandleSnapshot)
	webapp.RegisterRoutes(mux)
	mux.HandleFunc("/", handleWebApp)

	addr := serverAddress()
	log.Printf("OPL WebUI Go control plane listening on http://%s", addr)
	if err := http.ListenAndServe(addr, mux); err != nil {
		fmt.Fprintln(os.Stderr, err)
		os.Exit(1)
	}
}

func handleWebApp(response http.ResponseWriter, request *http.Request) {
	if strings.HasPrefix(request.URL.Path, "/api/") {
		http.NotFound(response, request)
		return
	}

	if request.Method != http.MethodGet && request.Method != http.MethodHead {
		response.Header().Set("allow", "GET, HEAD")
		http.Error(response, "method not allowed", http.StatusMethodNotAllowed)
		return
	}

	requestPath := request.URL.Path
	cleanPath := filepath.Clean(strings.TrimPrefix(requestPath, "/"))
	if cleanPath == "." {
		cleanPath = "index.html"
	}
	if cleanPath == ".." || strings.HasPrefix(cleanPath, "../") {
		http.NotFound(response, request)
		return
	}

	root := webRootDir()
	candidate := filepath.Join(root, cleanPath)
	if info, err := os.Stat(candidate); err == nil && !info.IsDir() {
		http.ServeFile(response, request, candidate)
		return
	}

	if filepath.Ext(cleanPath) != "" {
		http.NotFound(response, request)
		return
	}
	http.ServeFile(response, request, filepath.Join(root, "index.html"))
}

func webRootDir() string {
	workingDir, err := os.Getwd()
	if err == nil {
		for {
			candidate := filepath.Join(workingDir, "frontend", "web")
			if info, statErr := os.Stat(filepath.Join(candidate, "index.html")); statErr == nil && !info.IsDir() {
				return candidate
			}
			parent := filepath.Dir(workingDir)
			if parent == workingDir {
				break
			}
			workingDir = parent
		}
	}
	return filepath.Join("frontend", "web")
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
		report, err = runDBCanary(webapp.OpenPostgresDatabaseCanary)
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
		"observabilitySchemaVersion": 1,
		"releaseProbeContract":       "production_observability_baseline_v1",
		"publicProbeEndpoints":       []string{"/healthz", "/readyz", "/metricsz", "/"},
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

func runDBCanary(openPostgres webapp.DatabaseCanaryOpener) (CanaryReport, error) {
	databaseURL := os.Getenv("OPL_DATABASE_URL")
	if databaseURL == "" {
		return CanaryReport{}, fmt.Errorf("OPL_DATABASE_URL is required")
	}
	canary, err := openPostgres(databaseURL)
	if err != nil {
		return CanaryReport{}, fmt.Errorf("open postgres canary: %w", err)
	}
	defer canary.Close()

	if err := canary.Run(context.Background()); err != nil {
		return CanaryReport{}, fmt.Errorf("webapp postgres canary: %w", err)
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
