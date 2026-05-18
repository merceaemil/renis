# Run Prisma migrations against Postgres (docker compose --profile tools run --rm db-migrate)
FROM node:22-alpine

WORKDIR /app

COPY package.json package-lock.json ./
COPY packages/database/package.json ./packages/database/
RUN npm ci -w @renis/database --include=dev

COPY packages/database/prisma ./packages/database/prisma
COPY packages/database/src ./packages/database/src

WORKDIR /app/packages/database
RUN npx prisma generate

CMD ["npx", "prisma", "migrate", "deploy"]
