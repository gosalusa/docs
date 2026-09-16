#!/usr/bin/env bash
set -euo pipefail

cd "$(dirname "$0")"

if [ ! -d node_modules/@resvg/resvg-js ]; then
  echo "installing dependencies…"
  npm install --no-audit --no-fund
fi

node render-favicons.mjs "$@"