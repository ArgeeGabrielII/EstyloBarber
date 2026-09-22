#!/usr/bin/env sh
set -eu
if [ $# -ne 1 ]; then
  echo "Usage: $0 backups/file.sql"
  exit 1
fi
docker compose exec -T postgres psql -U "${POSTGRES_USER:-estylo}" "${POSTGRES_DB:-estylo}" < "$1"
