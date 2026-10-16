# The telemetry collector (scripts/collector.mjs, copied in by CI). No dependencies.
FROM node:22-alpine
WORKDIR /app
COPY collector.mjs ./
# compose bind-mounts ./data here; without it, node could not create the directory itself
RUN mkdir /data && chown node:node /data
USER node
ENV PORT=8787 COLLECTOR_DIR=/data
EXPOSE 8787
CMD ["node", "collector.mjs"]
