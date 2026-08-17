#!/bin/sh
set -eu
umask 077

if [ "$#" -ne 1 ]; then
  echo "usage: scripts/backup-local.sh BACKUP_DIRECTORY" >&2
  exit 64
fi

backup_dir=$1
db_container=${CIVICPIN_DB_CONTAINER:-supabase_db_civic-pin}
storage_container=${CIVICPIN_STORAGE_CONTAINER:-supabase_storage_civic-pin}

if [ -e "$backup_dir" ]; then
  echo "backup target already exists: $backup_dir" >&2
  exit 73
fi

mkdir -p "$backup_dir"
docker exec "$db_container" pg_dump -U postgres -Fc \
  --schema=auth --schema=public --schema=private --schema=storage --schema=extensions \
  postgres > "$backup_dir/database.dump"
docker exec "$storage_container" tar -C /mnt -cf - . > "$backup_dir/storage.tar"
(
  cd "$backup_dir"
  shasum -a 256 database.dump storage.tar > checksums.sha256
)
echo "encrypted-at-rest destination required before retaining: $backup_dir"
