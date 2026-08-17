#!/bin/sh
set -eu
umask 077

if [ "$#" -ne 1 ]; then
  echo "usage: scripts/verify-backup.sh BACKUP_DIRECTORY" >&2
  exit 64
fi

backup_dir=$1
db_container=${CIVICPIN_DB_CONTAINER:-supabase_db_civic-pin}
restore_db="civicpin_restore_verify_$$"
storage_restore_dir=$(mktemp -d "${TMPDIR:-/tmp}/civicpin-storage-restore.XXXXXX")

cleanup() {
  docker exec "$db_container" dropdb -U postgres --if-exists "$restore_db" >/dev/null 2>&1 || true
  rm -rf "$storage_restore_dir"
}
trap cleanup EXIT INT TERM

(
  cd "$backup_dir"
  shasum -a 256 -c checksums.sha256
)
docker exec "$db_container" createdb -U postgres "$restore_db"
docker exec "$db_container" psql -U postgres -d "$restore_db" -v ON_ERROR_STOP=1 -c "drop schema public cascade" >/dev/null
docker exec -i "$db_container" pg_restore -U postgres --no-owner --no-privileges -d "$restore_db" < "$backup_dir/database.dump"
db_check=$(docker exec "$db_container" psql -U postgres -d "$restore_db" -Atqc \
  "select count(*) from information_schema.tables where table_schema in ('public','private') and table_name in ('issues','issue_contacts','issue_photos','problem_spots');")
if [ "$db_check" -ne 4 ]; then
  echo "restored database is missing CivicPin tables" >&2
  exit 1
fi

tar -xf "$backup_dir/storage.tar" -C "$storage_restore_dir"
tar -tf "$backup_dir/storage.tar" >/dev/null
echo "backup restore verification passed: database schema and private Storage archive"
