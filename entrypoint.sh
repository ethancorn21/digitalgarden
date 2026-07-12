#!/bin/bash
set -euo pipefail

GITHUB_TOKEN=$(aws secretsmanager get-secret-value \
  --secret-id digitalgarden/git-pat --query SecretString --output text)

git clone "https://x-access-token:${GITHUB_TOKEN}@github.com/ethancorn21/digitalgarden.git" /app
cd /app
npm ci

bash scripts/pipeline.sh
