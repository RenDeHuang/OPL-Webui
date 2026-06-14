FROM golang:1.22-alpine AS builder

WORKDIR /src
COPY go.work go.work
COPY services/control-plane-go/go.mod services/control-plane-go/go.mod
COPY services/control-plane-go services/control-plane-go
RUN go build -o /out/opl-webui-control-plane ./services/control-plane-go/cmd/opl-webui-control-plane

FROM alpine:3.22

WORKDIR /app
ENV HOST=0.0.0.0
ENV PORT=4173
COPY --from=builder /out/opl-webui-control-plane /app/opl-webui-control-plane
COPY apps/web apps/web
EXPOSE 4173
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 CMD wget -qO- "http://127.0.0.1:${PORT}/healthz" >/dev/null || exit 1

CMD ["/app/opl-webui-control-plane"]
