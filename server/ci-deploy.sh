#!/bin/sh
# The only command CI's deploy key may run on blightbloom: it reads a tar.gz from stdin, takes
# collector.mjs out of it (nothing else, whatever else the archive holds), puts it in
# /home/deploy/potion-siege and restarts the containers. `.github/workflows/ci.yml`'s
# deploy-server job sends it; server/README.md says how it is installed.
#
# The key is registered in /home/deploy/.ssh/authorized_keys as
#   command="/home/deploy/potion-siege-ci-deploy.sh",restrict ssh-ed25519 AAAA... potion-siege-ci
# so sshd runs this script whatever the key's holder asks for, as `deploy` (never root), with
# no pty and no forwarding. The live copy sits outside the deploy target, so a deploy can never
# replace it; editing this file changes nothing on the box until it is installed again.
# `.env` is never read or written.
#
# The Dockerfile and docker-compose.yml decide what runs and with which mounts, so they never
# come from CI: they are installed by hand (server/README.md) and must hash to the values below,
# which src/analytics/deploy.test.ts keeps equal to server/'s copies. Changing either file means
# installing it and this script again, by hand.
set -eu

TARGET="$HOME/potion-siege"
DOCKERFILE_SHA256=9eb786df1ae661cf3bcd41e3b7d1352142221b5c98b51f7763d030f8e3786aca
COMPOSE_SHA256=938f33a3b2c4d9fd8104a31b89eff1fbfb0d953fb0df4f4d66e66ad179ef6e3e
# the collector is ~10 KB; anything near this is not it
MAX_PAYLOAD=1048576
STAGE="$(mktemp -d)"
trap 'rm -rf "$STAGE"' EXIT

head -c "$MAX_PAYLOAD" | tar xzf - -C "$STAGE" --no-same-owner --no-same-permissions collector.mjs ||
  { echo "payload is not a tar.gz with collector.mjs, aborting" >&2; exit 1; }
[ -f "$STAGE/collector.mjs" ] && [ ! -L "$STAGE/collector.mjs" ] ||
  { echo "payload is missing collector.mjs, aborting" >&2; exit 1; }

hash_ok() {
  [ "$(sha256sum "$TARGET/$1" 2>/dev/null | cut -d' ' -f1)" = "$2" ] ||
    { echo "$TARGET/$1 is not the one installed by hand (sha256 $2), aborting" >&2; exit 1; }
}
hash_ok Dockerfile "$DOCKERFILE_SHA256"
hash_ok docker-compose.yml "$COMPOSE_SHA256"
grep -q "^PS_TUNNEL_TOKEN=..*" "$TARGET/.env" 2>/dev/null || {
  echo "PS_TUNNEL_TOKEN is missing or empty in $TARGET/.env (server/README.md)" >&2; exit 1; }
# created here, as deploy, so the bind mount is not created root-owned by docker
mkdir -p "$TARGET/data"

up() {
  [ "$(docker inspect -f '{{.State.Health.Status}}' ps-collector 2>/dev/null)" = healthy ] &&
    [ "$(docker inspect -f '{{.State.Status}}' ps-tunnel 2>/dev/null)" = running ]
}

# Every push to main runs this job; a push that does not change the collector restarts nothing.
if cmp -s "$STAGE/collector.mjs" "$TARGET/collector.mjs" && up; then
  echo "unchanged, ps-collector healthy, ps-tunnel running"
  exit 0
fi

cp "$STAGE/collector.mjs" "$TARGET/collector.mjs"
chmod 644 "$TARGET/collector.mjs"
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
