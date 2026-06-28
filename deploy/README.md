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

## Troubleshooting And Owner Split

Use this deploy baseline for diagnostics, not production mutation:

- runtime admission blocked: specialist task is not admitted; show the MedOPL deeplink and keep OPL-Webui projection-only.
- runtime gate ready: specialist execution may continue only when MedOPL readiness is projected through the Go control plane.
- onboarding required: new accounts may need MedOPL provisioning before specialist execution is ready.
- Production Browser E2E fail: inspect route/auth/pending/sidebar/dialog state first, then runtime admission evidence.
- MedOPL endpoint missing: record a MedOPL-owned blocker; do not fake readiness in OPL-Webui.
- dogfood account state: classify the account as ordinary, specialist blocked, specialist ready, or onboarding required before rerunning E2E.
- API key save fail: check session, encryption secret, fixed gateway, and sanitized audit events.
- task projection missing: check `/api/tasks` projection and contract-backed empty state before creating UI fallback data.
- rollout apply passed but browser E2E failed: keep release evidence pending and debug browser/runtime admission lanes separately.
- release evidence foldback blocked: do not edit latest release evidence until rollout and production validation have passed.

backup/migration owner split:

- Webui backs up only web interaction config and sanitized audit projection.
- MedOPL owns canonical PostgreSQL runtime/billing/resource/workspace truth.
- one-person-lab owns framework execution semantics.

minimal /_ops diagnostics are planned as contract-only diagnostics for health/ready, config check, MedOPL bridge status, runtime admission diagnostic, audit/task projection diagnostic, and release evidence summary. They must remain readonly: no MedOPL resource admin, no payment admin, and no production mutation installer.
