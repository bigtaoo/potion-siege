# Telemetry collector (ps.gamestao.com)

`scripts/collector.mjs` in a container on the box daydayup owns (Hetzner `blightbloom`,
62.238.1.182; ssh alias `blightbloom`). It shares nothing with daydayup, Holy Kicker or fight but
the machine: its own compose project in `/home/deploy/potion-siege` (this folder), its own
network. Two containers: `ps-collector` (128 MB, no published port) and `ps-tunnel`
(cloudflared). The box's ports 80/443 are daydayup's Caddy, so the way in is a Cloudflare
Tunnel: `ps-tunnel` dials out to Cloudflare, which serves https://ps.gamestao.com and passes the
requests down to `http://collector:8787`.

Events land in `/home/deploy/potion-siege/data/events-YYYY-MM-DD.ndjson` (UTC days). The
collector deletes the day files older than 14 months itself (`KEEP_MONTHS`, the period the
privacy policy §8 states), so the box needs no cron for it. To look at them:

```bash
ssh blightbloom 'cat /home/deploy/potion-siege/data/events-*.ndjson' > telemetry/events.ndjson
npm run report -- telemetry/events.ndjson
```

## Battle replays

While a player shares statistics the game also posts each battle's replay to `POST /r`
(`src/analytics/replayUpload.ts`): at its end, when it is left, and when the page goes to the
background mid-battle. The collector keeps one gzipped `<uid>-<run>.json.gz` per install and
battle in `data/replays` (`scripts/replayShelf.mjs`), a later upload of the same battle over the
earlier, and deletes each 15 days after it came (`KEEP_DAYS`, privacy policy §8), or the oldest
first once the shelf passes 1 GiB (`COLLECTOR_REPLAY_BYTES` in the compose file's environment
changes that). To play them again and see where the wall falls, what bites it, the merges, the
skill picks and the commander's casts:

```bash
rsync -a blightbloom:/home/deploy/potion-siege/data/replays/ telemetry/replays/
npm run replays
```

`REPLAYS=<dir>` reads another folder, `DAYS=7` only the last week's uploads, `BUILD=<prefix>`
only those builds. Replays from before a change to the battle (`REPLAY_VERSION`) are counted
apart and left out; one that does not play back to its hash is a desync, worth a look.

A deletion request (privacy policy §9) covers the replays too:

```bash
ssh blightbloom 'rm -f /home/deploy/potion-siege/data/replays/<id>-*.json.gz'
```

## Limits and health

`scripts/collectorLimits.mjs` charges each address from the request's headers, before a byte of
the body is read: 240 event requests and 1 MB a minute, 20 replays and 4 MB a minute; bytes past
the declared `Content-Length` are charged as they come. Bodies over 64 KB (events) or 256 KB (a
replay) get 413, at most 32 replay bodies are read at once (503 with `Retry-After` past that), and
a body not done in 20 s gets 408. Once a minute the log says how many addresses went over a byte
budget.

`GET /health` answers 200 `ok` while the data folder takes writes and the disk has 256 MB free,
503 `unhealthy` otherwise; it is never rate limited. Point an uptime monitor at
https://ps.gamestao.com/health (e.g. UptimeRobot, every 5 minutes, alert on anything but 200).

## Backups

The `ps-backup` container gzips each finished day's `events-YYYY-MM-DD.ndjson` into
`/home/deploy/potion-siege/backups` at 03:00 UTC and deletes the copies older than
`PS_BACKUP_DAYS` (30 unless set in `.env`). They sit on the same disk: they guard against a
file deleted or broken by mistake, not against losing the box; copy them off now and then if that
matters. Replays are not backed up. A deletion request must clean the backups too, or wait out
the 30 days (privacy policy §8):

```bash
ssh blightbloom 'cd /home/deploy/potion-siege/backups && for f in events-*.ndjson.gz; do gzip -dc "$f" | grep -v "\"<id>\"" | gzip > "$f.new" && mv "$f.new" "$f"; done'
```

## Deploy from CI

Every green push to `main` deploys it (`.github/workflows/ci.yml`, job `deploy-server`, before
the web build goes out); a push that leaves the collector unchanged restarts nothing. CI sends
the collector's three files (`collector.mjs`, `collectorLimits.mjs`, `replayShelf.mjs`) and
nothing else: the `Dockerfile` and `docker-compose.yml` say what runs and
what is mounted, so a leaked key that could send them could take the box. They are installed by
hand, and `ci-deploy.sh` refuses to build unless both hash to the values written in it
(`src/analytics/deploy.test.ts` keeps those equal to this folder's copies).

CI holds an ssh key (`D:\cloud\potion_siege_ci_ed25519`, the only readable copy; the private
half is the repo Secret `SERVER_DEPLOY_KEY`) that can do one thing on the box: it is registered
in `/home/deploy/.ssh/authorized_keys` as
`command="/home/deploy/potion-siege-ci-deploy.sh",restrict ssh-ed25519 AAAA... potion-siege-ci`,
so whatever it asks for, sshd runs `ci-deploy.sh` as `deploy`, with no pty and no forwarding
(checked 2026-10-16: `cat /etc/shadow; id` runs the script instead, which rejects the empty
stdin, and `ssh -tt` gets `PTY allocation request failed`). Repo Variables:
`SERVER_DEPLOY_ENABLED=true`, `SERVER_SSH_KNOWN_HOSTS` (the box's ed25519 host key line, checked
against `/etc/ssh/ssh_host_ed25519_key.pub`).

The live script sits outside the deploy target so a deploy cannot replace it; after editing
`ci-deploy.sh`, install it again. The file goes through a temp file first: on the box `sudo`
gets no stdin, so `sudo install … /dev/stdin` fails with `No such file or directory`.

```bash
tr -d '\r' < server/ci-deploy.sh | ssh blightbloom 't=$(mktemp) && cat > $t && sudo install -o deploy -g deploy -m 700 $t /home/deploy/potion-siege-ci-deploy.sh; rm -f $t'
```

After editing the `Dockerfile` or `docker-compose.yml` (and so the hashes in `ci-deploy.sh`),
install all three by hand before the push reaches `main`; root owns the two, so nothing running
as `deploy` can change them. The order matters when CI starts sending a new file (as when
`collectorLimits.mjs` and `replayShelf.mjs` came): an old script would copy `collector.mjs`
alone and build an image without the others, which then fails at start, while the new script on
an old push only refuses to deploy. Then create the backup folder once:
`ssh blightbloom 'sudo install -d -o deploy -g deploy /home/deploy/potion-siege/backups'`
(`ci-deploy.sh` also makes it; `ps-backup` writes there as uid 1000, so not root-owned).

```bash
for f in Dockerfile docker-compose.yml; do
  tr -d '\r' < server/$f | ssh blightbloom "t=\$(mktemp) && cat > \$t && sudo install -o root -g root -m 644 \$t /home/deploy/potion-siege/$f; rm -f \$t"
done
ssh blightbloom 'cd /home/deploy/potion-siege && sha256sum Dockerfile docker-compose.yml'
```

## The tunnel

Remotely managed (Cloudflare Zero Trust → Networks → Tunnels): its one public hostname is
`ps.gamestao.com` → `http://collector:8787`, and Cloudflare keeps the proxied (orange) DNS
record for it. The box keeps the connector token in `/home/deploy/potion-siege/.env`, which the
deploy never touches and refuses to run without:

```bash
ssh blightbloom 'umask 077; cat > /home/deploy/potion-siege/.env; chown deploy:deploy /home/deploy/potion-siege/.env'
# then paste one line, PS_TUNNEL_TOKEN=<the connector token>, and press Ctrl-D
```
