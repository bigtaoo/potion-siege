# The telemetry collector (scripts/collector.mjs and its two modules, copied in by CI). No
# dependencies. The image is pinned to one Node release: a rebuild does not pick up a new one
# unasked (bump it here, and the backup service's in docker-compose.yml).
FROM node:22.23.4-alpine
WORKDIR /app
COPY collector.mjs collectorLimits.mjs replayShelf.mjs ./
# compose bind-mounts ./data here; without it, node could not create the directory itself
RUN mkdir /data && chown node:node /data
USER node
ENV PORT=8787 COLLECTOR_DIR=/data
EXPOSE 8787
CMD ["node", "collector.mjs"]
