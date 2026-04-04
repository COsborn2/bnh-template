FROM oven/bun:1-alpine
WORKDIR /app
COPY package.json bun.lock tsconfig.json ./
RUN bun install --frozen-lockfile --production
COPY src ./src
EXPOSE 3002
CMD ["bun", "src/index.ts"]
