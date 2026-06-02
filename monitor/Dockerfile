# Sentinel Monitor — container image.
#
# BUILD CONTEXT MUST BE THE REPO ROOT (the monitor reads
# contracts/deployments/<network>.json at runtime via a relative path).
# On Railway/Render: set Dockerfile path = monitor/Dockerfile, root dir = repo root.
#
#   docker build -f monitor/Dockerfile -t sentinel-monitor .
#   docker run -e MONITOR_NETWORK=mainnet -e MANTLE_RPC_URL=... \
#              -e MONITOR_PRIVATE_KEY=0x... -p 8080:8080 sentinel-monitor
#
# Node 24 → node:sqlite is stable (no --experimental flag needed).

FROM node:24-slim

WORKDIR /app

# Deployment address books the monitor reads at runtime (small JSON files only —
# not the whole contracts/ tree).
COPY contracts/deployments ./contracts/deployments

# Monitor package. It has no workspace-protocol deps, so a standalone npm
# install works without the rest of the monorepo.
COPY monitor/package.json ./monitor/package.json
WORKDIR /app/monitor
RUN npm install

COPY monitor/tsconfig.json ./tsconfig.json
COPY monitor/src ./src
RUN npm run build && mkdir -p /app/monitor/data

WORKDIR /app
# PORT is provided by the platform; the server reads it (see config.ts).
CMD ["node", "monitor/dist/index.js"]
