FROM golang:1.22-alpine AS builder

WORKDIR /src
COPY go.work go.work
COPY backend/control-plane-go/go.mod backend/control-plane-go/go.mod
COPY backend/control-plane-go backend/control-plane-go
RUN go build -o /out/opl-webui-control-plane ./backend/control-plane-go/cmd/opl-webui-control-plane

FROM alpine:3.22

WORKDIR /app
ENV HOST=0.0.0.0
ENV PORT=4173
ENV OPL_CLI_PATH=/opt/opl/bin/opl
COPY --from=builder /out/opl-webui-control-plane /app/opl-webui-control-plane
COPY frontend/web frontend/web
EXPOSE 4173
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 CMD wget -qO- "http://127.0.0.1:${PORT}/healthz" >/dev/null || exit 1

CMD ["/app/opl-webui-control-plane"]
