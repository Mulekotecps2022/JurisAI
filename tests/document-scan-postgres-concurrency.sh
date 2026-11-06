#!/usr/bin/env bash
set -euo pipefail
container=jurisai-test-postgres
id=44444444-4444-4444-8444-444444444444
docker exec "$container" psql -U postgres -d postgres -v ON_ERROR_STOP=1 -c "insert into public.document values ('$id','quarantined','case-documents','case/d'); insert into storage.objects values ('case-documents','case/d');"
docker exec "$container" psql -U postgres -d postgres -v ON_ERROR_STOP=1 -c "set role service_role; select public.enqueue_document_scan_job('$id');"
# Both connections start at the same time. The SKIP LOCKED claim must return
# the same document no more than once; each worker uses its own DB session.
tmp=$(mktemp -d)
trap 'rm -rf "$tmp"' EXIT
for i in 1 2 3 4 5 6 7 8; do
  (
    docker exec "$container" psql -U postgres -d postgres -At -v ON_ERROR_STOP=1 \
      -c "set role service_role; select document_id from public.claim_document_scan_job(180);" > "$tmp/$i"
  ) &
done
wait
count=$(grep -h -c "$id" "$tmp"/* | awk '{s+=$1} END {print s+0}')
if [[ "$count" != 1 ]]; then echo "Concurrent claims: expected 1, got $count"; exit 1; fi
docker exec "$container" psql -U postgres -d postgres -At -v ON_ERROR_STOP=1 -c "select count(*) from public.document_scan_audit where document_id='$id' and event='claimed';" | grep -qx 1
echo "PASS: 8 concurrent PostgreSQL sessions, one lease and one claim audit"
