#!/bin/sh
# The only command CI's deploy key may run on blightbloom: it reads a tar.gz from stdin, takes
# the collector's three files (FILES) out of it (nothing else, whatever else the archive holds),
# puts them in /home/deploy/potion-siege and restarts the containers. `.github/workflows/ci.yml`'s
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
DOCKERFILE_SHA256=559455a27d37d72d17168c1c5b6c336a0396ee58c2ced94871a516dae32326db
COMPOSE_SHA256=8822f604a44e35b948f6fea22a0e886dc2697634a519b2d69b042d007c1567db
# the collector's own files, in the order CI packs them (the Dockerfile copies the same)
FILES="collector.mjs collectorLimits.mjs replayShelf.mjs saveVault.mjs"
# the collector is ~20 KB; anything near this is not it
MAX_PAYLOAD=1048576
STAGE="$(mktemp -d)"
trap 'rm -rf "$STAGE"' EXIT

# shellcheck disable=SC2086 # FILES splits into its names on purpose
head -c "$MAX_PAYLOAD" | tar xzf - -C "$STAGE" --no-same-owner --no-same-permissions $FILES ||
  { echo "payload is not a tar.gz with $FILES, aborting" >&2; exit 1; }
for f in $FILES; do
  [ -f "$STAGE/$f" ] && [ ! -L "$STAGE/$f" ] ||
    { echo "payload is missing $f, aborting" >&2; exit 1; }
done

hash_ok() {
  [ "$(sha256sum "$TARGET/$1" 2>/dev/null | cut -d' ' -f1)" = "$2" ] ||
    { echo "$TARGET/$1 is not the one installed by hand (sha256 $2), aborting" >&2; exit 1; }
}
hash_ok Dockerfile "$DOCKERFILE_SHA256"
hash_ok docker-compose.yml "$COMPOSE_SHA256"
grep -q "^PS_TUNNEL_TOKEN=..*" "$TARGET/.env" 2>/dev/null || {
  echo "PS_TUNNEL_TOKEN is missing or empty in $TARGET/.env (server/README.md)" >&2; exit 1; }
# created here, as deploy, so the bind mounts are not created root-owned by docker
mkdir -p "$TARGET/data" "$TARGET/backups"

up() {
  [ "$(docker inspect -f '{{.State.Health.Status}}' ps-collector 2>/dev/null)" = healthy ] &&
    [ "$(docker inspect -f '{{.State.Status}}' ps-tunnel 2>/dev/null)" = running ] &&
    [ "$(docker inspect -f '{{.State.Status}}' ps-backup 2>/dev/null)" = running ]
}

same() {
  for f in $FILES; do cmp -s "$STAGE/$f" "$TARGET/$f" || return 1; done
}

# Every push to main runs this job; a push that does not change the collector restarts nothing.
if same && up; then
  echo "unchanged, ps-collector healthy, ps-tunnel and ps-backup running"
  exit 0
fi

for f in $FILES; do
  cp "$STAGE/$f" "$TARGET/$f"
  chmod 644 "$TARGET/$f"
done
cd "$TARGET"
docker compose up -d --build --force-recreate
for _ in $(seq 1 30); do
  up && { echo "ps-collector healthy, ps-tunnel and ps-backup running"; exit 0; }
  sleep 2
done
docker logs --tail 30 ps-collector
docker logs --tail 15 ps-tunnel || true
docker logs --tail 15 ps-backup || true
echo "ps-collector, ps-tunnel or ps-backup did not come up" >&2
exit 1
