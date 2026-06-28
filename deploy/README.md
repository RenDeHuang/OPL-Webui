# OPL-Webui Deploy Baseline

Owner: `one-person-lab-web-release`

Purpose: provide local and standalone deployment examples for the OPL-Webui browser entry and Go control plane without replacing the production Cloud Rollout path.

Machine boundary: `tests/contract/web-cloud-deploy-shape.test.mjs` guards these files, secret hygiene, and production mutation boundaries.

## Deployment Modes

- local compose = local verification for developers.
- standalone compose = single-node private deployment example for a controlled private host.
- production cloud rollout = authoritative production release for `opl.medopl.cn`.
- prod compose example cannot claim production rollout.

The production source of release truth remains `deploy/web-cloud/RUNBOOK.md`, `.github/workflows/release-image.yml`, `.github/workflows/cloud-rollout.yml`, and `contracts/web-release-profile.json`. Compose examples do not run Cloud Rollout, do not mutate Kubernetes, and do not fold back release evidence.

## Owner Split

OPL-Webui owns browser interaction, auth/session, BYOK binding, task intent, page state, readonly projection, deeplink, diagnostics, and the Go control-plane bridge.

MedOPL owns runtime/resource/storage/billing/payment and canonical PostgreSQL business truth.

one-person-lab owns framework/execution semantics.

OPL-Webui does not own runtime/storage/payment/artifact truth. These examples can point to external MedOPL and database endpoints, but they cannot create Web-owned runtime, storage, payment, or artifact authority.

## Files

- `deploy/.env.example`: sanitized environment variables with placeholders only.
- `deploy/config.example.yaml`: example config shape for local and standalone checks.
- `deploy/docker-compose.local.yml`: developer local Go control-plane container example.
- `deploy/docker-compose.standalone.yml`: single-node private deployment example using externally managed state.
- `deploy/docker-compose.prod.example.yml`: production-shaped example only; Cloud Rollout remains authoritative.
- `deploy/scripts/config-check.sh`: local/standalone/config validation only.

Run:

```sh
sh deploy/scripts/config-check.sh deploy/config.example.yaml
```

The script performs static validation only. It must not run `kubectl`, push images, deploy to cloud, or write release evidence.
