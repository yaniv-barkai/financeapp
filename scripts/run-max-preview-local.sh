#!/usr/bin/env bash
set -euo pipefail
cd "$(dirname "$0")/max-sync"
npm run preview "$@"