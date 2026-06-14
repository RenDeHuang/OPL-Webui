package main

import (
	"encoding/json"
	"fmt"
	"log"
	"net/http"
	"os"

	"github.com/RenDeHuang/OPL-Webui/services/control-plane-go/internal/mvp"
	"github.com/RenDeHuang/OPL-Webui/services/control-plane-go/internal/oplbridge"
	"github.com/RenDeHuang/OPL-Webui/services/control-plane-go/internal/runtimegate"
)

func main() {
	mux := http.NewServeMux()
	mux.HandleFunc("/healthz", handleHealthz)
	mux.HandleFunc("/readyz", handleReadyz)
	mux.HandleFunc("/api/opl/snapshot", oplbridge.HandleSnapshot)
	mux.HandleFunc("/api/mvp/task", mvp.HandleTask)
	mux.Handle("/", http.FileServer(http.Dir("apps/web")))

	addr := serverAddress()
	log.Printf("OPL WebUI Go control plane listening on http://%s", addr)
	if err := http.ListenAndServe(addr, mux); err != nil {
		fmt.Fprintln(os.Stderr, err)
		os.Exit(1)
	}
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
