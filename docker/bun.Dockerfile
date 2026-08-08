# 1.3.14 exactly: Bun has no LTS line and no release-branch policy, so the
# version that was tested is the only version known to work, and it is the
# version LangGraph was verified on.
FROM oven/bun:1.3.14-slim

ENV PNPM_HOME=/pnpm
ENV PATH=$PNPM_HOME:$PATH

WORKDIR /app

COPY . .

# Installed and built with pnpm, not with Bun's own installer: the benchmark
# requires identical dependency versions across every cell, and two resolvers
# over one workspace is the fastest way to lose that.
RUN bun install --global pnpm@11.10.0 && pnpm install --frozen-lockfile && pnpm build

ENV ENTRY=adapters/hono/dist/server.bun.js
CMD ["sh", "-c", "bun $ENTRY"]
