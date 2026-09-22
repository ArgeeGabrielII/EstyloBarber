#!/usr/bin/env sh
set -eu
mkdir -p backups
STAMP=$(date +%Y%m%d-%H%M%S)
docker compose exec -T postgres pg_dump -U "${POSTGRES_USER:-estylo}" "${POSTGRES_DB:-estylo}" > "backups/estylo-${STAMP}.sql"
find backups -type f -name 'estylo-*.sql' -mtime +14 -delete
printf 'Backup created: backups/estylo-%s.sql\n' "$STAMP"
