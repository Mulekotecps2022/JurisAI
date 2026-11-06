#!/usr/bin/env bash
set -euo pipefail
# Runs the actual Next.js route in a disposable local process.
# No Supabase credentials are provided. Uploads must remain disabled.
export JURISAI_ENABLE_UPLOADS=false
export NEXT_TELEMETRY_DISABLED=1
PORT=31987
LOG=$(mktemp)
npm run dev -- --hostname 127.0.0.1 --port "$PORT" >"$LOG" 2>&1 &
PID=$!
cleanup() { kill "$PID" 2>/dev/null || true; wait "$PID" 2>/dev/null || true; cat "$LOG"; rm -f "$LOG"; }
trap cleanup EXIT
ready=0
for i in $(seq 1 90); do
  if ! kill -0 "$PID" 2>/dev/null; then echo "Next.js exited"; exit 1; fi
  status=$(curl --silent --output /dev/null --max-time 2 -w '%{http_code}' -X POST "http://127.0.0.1:$PORT/api/documentos/upload" || true)
  if [ "$status" = "503" ]; then ready=1; break; fi
  sleep 2
done
if [ "$ready" -ne 1 ]; then echo "Upload fail-closed check did not reach 503"; exit 1; fi
check() {
  local expected="$1"; shift
  local actual
  actual=$(curl --silent --output /dev/null --max-time 15 -w '%{http_code}' "$@")
  if [ "$actual" != "$expected" ]; then echo "Expected $expected, got $actual"; exit 1; fi
}
check 503 -X POST "http://127.0.0.1:$PORT/api/documentos/upload"
check 403 -X POST -H 'Sec-Fetch-Site: cross-site' "http://127.0.0.1:$PORT/api/documentos/upload"
check 503 -X POST -H 'Origin: https://attacker.invalid' "http://127.0.0.1:$PORT/api/documentos/upload"
check 503 -X POST -H 'Content-Type: application/json' --data '{"caseId":"11111111-1111-4111-8111-111111111111"}' "http://127.0.0.1:$PORT/api/documentos/upload"
echo "PASS: actual Next.js upload route remains fail-closed over HTTP"
