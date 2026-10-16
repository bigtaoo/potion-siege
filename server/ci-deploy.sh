#!/bin/sh
# The only command CI's deploy key may run on blightbloom: it reads the collector payload (a
# tar.gz of collector.mjs, Dockerfile, docker-compose.yml) from stdin, puts it in
# /home/deploy/potion-siege and restarts the containers. `.github/workflows/ci.yml`'s
# deploy-server job sends it; server/README.md says how it is installed.
#
# The key is registered in /home/deploy/.ssh/authorized_keys as
#   command="/home/deploy/potion-siege-ci-deploy.sh",restrict ssh-ed25519 AAAA... potion-siege-ci
# so sshd runs this script whatever the key's holder asks for, as `deploy` (never root), with
# no pty and no forwarding. The live copy sits outside the deploy target, so a deploy can never
# replace it; editing this file changes nothing on the box until it is installed again.
# `.env` is never read or written.
set -eu

TARGET="$HOME/potion-siege"
FILES="collector.mjs Dockerfile docker-compose.yml"
STAGE="$(mktemp -d)"
trap 'rm -rf "$STAGE"' EXIT

tar xzf - -C "$STAGE"
for f in $FILES; do
  [ -f "$STAGE/$f" ] || { echo "payload is missing $f, aborting" >&2; exit 1; }
done
grep -q "^PS_TUNNEL_TOKEN=..*" "$TARGET/.env" 2>/dev/null || {
  echo "PS_TUNNEL_TOKEN is missing or empty in $TARGET/.env (server/README.md)" >&2; exit 1; }
# created here, as deploy, so the bind mount is not created root-owned by docker
mkdir -p "$TARGET/data"

up() {
  [ "$(docker inspect -f '{{.State.Health.Status}}' ps-collector 2>/dev/null)" = healthy ] &&
    [ "$(docker inspect -f '{{.State.Status}}' ps-tunnel 2>/dev/null)" = running ]
}

# Every push to main runs this job; a push that does not change the payload restarts nothing.
same=1
for f in $FILES; do
  cmp -s "$STAGE/$f" "$TARGET/$f" || same=0
done
if [ "$same" = 1 ] && up; then
  echo "unchanged, ps-collector healthy, ps-tunnel running"
  exit 0
fi

for f in $FILES; do cp "$STAGE/$f" "$TARGET/$f"; done
cd "$TARGET"
docker compose up -d --build --force-recreate
for _ in $(seq 1 30); do
  up && { echo "ps-collector healthy, ps-tunnel running"; exit 0; }
  sleep 2
done
docker logs --tail 30 ps-collector
docker logs --tail 15 ps-tunnel || true
echo "ps-collector or ps-tunnel did not come up" >&2
exit 1
