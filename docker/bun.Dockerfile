# 1.3.14 exactly: Bun has no LTS line and no release-branch policy, so the
# version that was tested is the only version known to work, and it is the
# version LangGraph was verified on.
FROM oven/bun:1.3.14-slim

# A real Node, not Bun's shebang-compatibility shim: pnpm 11.10.0 imports
# node:sqlite, which that shim does not provide, so `bun install --global
# pnpm` installs a pnpm that cannot run.
RUN apt-get update \
  && apt-get install -y --no-install-recommends curl ca-certificates gnupg \
  && curl -fsSL https://deb.nodesource.com/setup_24.x | bash - \
  && apt-get install -y --no-install-recommends nodejs \
  && rm -rf /var/lib/apt/lists/*

WORKDIR /app

COPY . .

# Installed and built with pnpm, not with Bun's own installer: the benchmark
# requires identical dependency versions across every cell, and two resolvers
# over one workspace is the fastest way to lose that.
RUN corepack enable \
  && corepack use pnpm@11.10.0 \
  && pnpm install --frozen-lockfile \
  && pnpm build

# Cells 1 and 2 run the SAME compiled output as cells 3 and 4. Only the
# interpreter changes; that is the variable under test.
ENV ENTRY=adapters/hono/dist/server.bun.js
CMD ["sh", "-c", "bun $ENTRY"]
