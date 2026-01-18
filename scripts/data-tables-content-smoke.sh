#!/usr/bin/env bash
set -euo pipefail

SERVER_URL="${TLDW_URL:-http://127.0.0.1:8000}"
AUTH_MODE="${TLDW_AUTH_MODE:-single-user}"
API_KEY="${TLDW_API_KEY:-}"
ACCESS_TOKEN="${TLDW_ACCESS_TOKEN:-}"
TABLE_UUID="${TABLE_UUID:-}"

if [[ "$AUTH_MODE" == "single-user" ]]; then
  if [[ -z "$API_KEY" ]]; then
    echo "TLDW_API_KEY is required for single-user auth"
    exit 1
  fi
  AUTH_HEADER="X-API-KEY: ${API_KEY}"
else
  if [[ -z "$ACCESS_TOKEN" ]]; then
    echo "TLDW_ACCESS_TOKEN is required for multi-user auth"
    exit 1
  fi
  AUTH_HEADER="Authorization: Bearer ${ACCESS_TOKEN}"
fi

request() {
  local method=$1
  local path=$2
  shift 2
  curl -sS --max-time 30 -X "$method" "${SERVER_URL}${path}" \
    -H "$AUTH_HEADER" \
    -H "Content-Type: application/json" \
    "$@"
}

if [[ -z "$TABLE_UUID" ]]; then
  resp="$(request GET "/api/v1/data-tables?limit=1&offset=0")"
  TABLE_UUID="$(python3 - <<'PY' "$resp"
import json, sys
data=json.loads(sys.argv[1])
tables=(data.get("tables") or data.get("items") or data.get("results") or [])
print((tables[0].get("uuid") if tables else "") or "")
PY
)"
fi

if [[ -z "$TABLE_UUID" ]]; then
  if [[ "${GENERATE:-0}" != "1" ]]; then
    echo "No existing tables. Set TABLE_UUID or GENERATE=1 to create one."
    exit 1
  fi

  payload="$(python3 - <<'PY'
import json, os
print(json.dumps({
  "name": os.environ.get("GENERATE_NAME","QA Table"),
  "prompt": os.environ.get("GENERATE_PROMPT","List two rows with Name and Score."),
  "sources": [{
    "source_type": "rag_query",
    "source_id": os.environ.get("GENERATE_RAG_QUERY","sample data table"),
    "title": "QA Seed",
    "snapshot": {"query": os.environ.get("GENERATE_RAG_QUERY","sample data table")}
  }]
}))
PY
)"
  resp="$(request POST "/api/v1/data-tables/generate?wait_for_completion=true" --data "$payload")"
  TABLE_UUID="$(python3 - <<'PY' "$resp"
import json, sys
data=json.loads(sys.argv[1])
table=data.get("table") or {}
print(table.get("uuid") or "")
PY
)"
fi

if [[ -z "$TABLE_UUID" ]]; then
  echo "Unable to resolve TABLE_UUID"
  exit 1
fi

update_payload="$(python3 - <<'PY'
import json
columns = [
  {"column_id":"col-qa-name","name":"Name","type":"text","position":0},
  {"column_id":"col-qa-score","name":"Score","type":"number","position":1}
]
rows = [
  {"col-qa-name":"Alpha","col-qa-score":1},
  {"Name":"Beta","Score":2}
]
print(json.dumps({"columns": columns, "rows": rows}))
PY
)"

resp="$(request PUT "/api/v1/data-tables/${TABLE_UUID}/content" --data "$update_payload")"

python3 - <<'PY' "$resp"
import json, sys
data=json.loads(sys.argv[1])
table=data.get("table") or {}
print("updated table:", table.get("uuid"), "rows:", table.get("row_count"))
rows=data.get("rows") or []
if rows:
    print("first row data:", rows[0].get("data"))
PY
