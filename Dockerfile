FROM oven/bun:1.4.4 AS build
WORKDIR /app
COPY package.json bun.lock ./
RUN bun install --frozen-lockfile
COPY . .
RUN bun run build

FROM oven/bun:1.4.4-slim
WORKDIR /app
ENV NODE_ENV=production PORT=3000
# The server bundle is self-contained (only Node built-ins), so no node_modules are needed.
COPY --from=build /app/.output ./.output
# Overrides, evidence picks and exclusions live here. Creating it owned by `bun` means a new named
# volume mounted on it starts out writable by the server.
RUN mkdir data && chown bun:bun data
VOLUME /app/data
USER bun
EXPOSE 3000
CMD ["bun", ".output/server/index.mjs"]
