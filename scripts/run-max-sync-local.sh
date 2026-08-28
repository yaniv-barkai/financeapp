#!/usr/bin/env bash
set -euo pipefail
cd "$(dirname "$0")/max-sync"
# dotenv loads ../../.env.local from run.ts — no need to `source` it
npm run sync
