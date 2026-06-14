package main

import (
	"fmt"
	"log"
	"net/http"
	"os"

	"github.com/RenDeHuang/OPL-Webui/services/control-plane-go/internal/mvp"
)

func main() {
	port := os.Getenv("PORT")
	if port == "" {
		port = "4173"
	}

	mux := http.NewServeMux()
	mux.HandleFunc("/api/mvp/task", mvp.HandleTask)
	mux.Handle("/", http.FileServer(http.Dir("apps/web")))

	addr := "127.0.0.1:" + port
	log.Printf("OPL WebUI Go control plane listening on http://%s", addr)
	if err := http.ListenAndServe(addr, mux); err != nil {
		fmt.Fprintln(os.Stderr, err)
		os.Exit(1)
	}
}
