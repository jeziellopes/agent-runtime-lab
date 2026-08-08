# Pinned to the same major as .nvmrc and engines.node. Three statements of one
# fact is two chances to disagree, so they are checked together.
FROM node:24-slim

ENV PNPM_HOME=/pnpm
ENV PATH=$PNPM_HOME:$PATH
RUN corepack enable

WORKDIR /app

COPY . .
RUN pnpm install --frozen-lockfile && pnpm build

# Cells 1 and 2 run the SAME compiled output as cells 3 and 4. Only the
# interpreter changes; that is the variable under test.
ENV ENTRY=adapters/hono/dist/server.js
CMD ["sh", "-c", "node $ENTRY"]
