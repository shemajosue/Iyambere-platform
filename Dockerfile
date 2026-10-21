# Iyambere — the whole platform as one container: the API, plus the web app
# (citizen, technician and WASAC portals) served from the same address.
#
#   docker build -t iyambere .
#   docker run -p 4000:4000 -e DATABASE_URL=postgres://... -e SEED_DEMO=true iyambere

# ---- 1. Build the web app ---------------------------------------------------
FROM node:20-slim AS web
WORKDIR /build/app
COPY app/package.json app/package-lock.json ./
RUN npm ci --no-audit --no-fund
COPY app/ ./
RUN CI=1 npx expo export --platform web --output-dir dist

# ---- 2. Runtime: API + built web app ---------------------------------------
FROM node:20-slim
ENV NODE_ENV=production \
    PORT=4000 \
    WEB_DIR=/srv/app/dist
WORKDIR /srv/api
COPY api/package.json api/package-lock.json ./
RUN npm ci --omit=dev --no-audit --no-fund
COPY api/ ./
COPY db/ /srv/db/
COPY --from=web /build/app/dist /srv/app/dist

EXPOSE 4000
HEALTHCHECK --interval=30s --timeout=5s CMD node -e "fetch('http://localhost:'+process.env.PORT+'/health').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"
CMD ["node", "scripts/boot.js"]
