FROM node:22-bookworm-slim AS build
WORKDIR /app
COPY apps/api/package.json ./
RUN npm install --no-audit --no-fund
COPY apps/api ./
RUN npx prisma generate && npm run build

FROM node:22-bookworm-slim AS runtime
WORKDIR /app
ENV NODE_ENV=production
COPY apps/api/package.json ./
COPY apps/api/prisma ./prisma
RUN npm install --omit=dev --no-audit --no-fund && npx prisma generate
COPY --from=build /app/dist ./dist
CMD ["sh", "-c", "npx prisma db push --skip-generate && node prisma/seed.mjs && node dist/main.js"]
