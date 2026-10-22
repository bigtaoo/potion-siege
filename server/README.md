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

## Deploy from CI

Every green push to `main` deploys it (`.github/workflows/ci.yml`, job `deploy-server`, before
the web build goes out); a push that leaves the collector unchanged restarts nothing. CI sends
`collector.mjs` and nothing else: the `Dockerfile` and `docker-compose.yml` say what runs and
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
`ci-deploy.sh`, install it again:

```bash
tr -d '\r' < server/ci-deploy.sh | ssh blightbloom 'install -o deploy -g deploy -m 700 /dev/stdin /home/deploy/potion-siege-ci-deploy.sh'
```

After editing the `Dockerfile` or `docker-compose.yml` (and so the hashes in `ci-deploy.sh`),
install all three by hand before the push reaches `main`; root owns the two, so nothing running
as `deploy` can change them:

```bash
for f in Dockerfile docker-compose.yml; do
  tr -d '\r' < server/$f | ssh blightbloom "sudo install -o root -g root -m 644 /dev/stdin /home/deploy/potion-siege/$f"
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
