#!/usr/bin/env sh
# Builds the production image, starts it and checks what Dokku and browsers rely on.
# Usage: scripts/container-smoke.sh [host-port]
set -eu
PORT="${1:-8090}"
NAME="entdeckerreise-smoke-$$"
docker build -q -t entdeckerreise:smoke . >/dev/null
docker run -d --rm -p "$PORT:5000" --name "$NAME" entdeckerreise:smoke >/dev/null
trap 'docker stop "$NAME" >/dev/null' EXIT

fail() { echo "FAIL: $1" >&2; exit 1; }
for i in 1 2 3 4 5 6 7 8 9 10; do curl -fs "http://localhost:$PORT/health" >/dev/null && break; sleep 1; done

[ "$(curl -s "http://localhost:$PORT/health")" = "ok" ] || fail "/health does not answer ok"
curl -fs "http://localhost:$PORT/" | grep -q '<div id="app">' || fail "/ does not serve the app"
for f in sw.js registerSW.js manifest.webmanifest index.html; do
  curl -sI "http://localhost:$PORT/$f" | grep -qi '^cache-control: no-cache' || fail "/$f is cacheable"
done
echo "container smoke: ok"
