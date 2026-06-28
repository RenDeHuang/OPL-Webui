#!/bin/sh
set -eu

config_path="${1:-deploy/config.example.yaml}"

if [ ! -f "$config_path" ]; then
  echo "config check failed: missing config file: $config_path" >&2
  exit 1
fi

require_text() {
  needle="$1"
  if ! grep -Fq "$needle" "$config_path"; then
    echo "config check failed: missing required text: $needle" >&2
    exit 1
  fi
}

forbidden_text() {
  needle="$1"
  if grep -Fq "$needle" "$config_path"; then
    echo "config check failed: forbidden text present: $needle" >&2
    exit 1
  fi
}

require_text "One Person Lab Web interaction platform / browser entry"
require_text "production_cloud_rollout: authoritative production release"
require_text "prod_compose_example: does not claim production rollout"
require_text "runtime/resource/storage/billing/payment"
require_text "framework/execution semantics"
require_text "Web-owned runtime/storage/payment/artifact truth"

forbidden_text "kubectl"
forbidden_text "image push"
forbidden_text "helm"
forbidden_text "terraform"

echo "config check passed: $config_path"
