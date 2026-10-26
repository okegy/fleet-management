# FleetFlow — single-container production image.
#
# Stage 1 builds the Vite SPA; stage 2 runs the Express + Socket.io API and
# serves that build from the same origin, so cookies stay first-party and the
# realtime socket needs no CORS negotiation.

# ---------- stage 1: build the frontend ----------
FROM node:22-alpine AS client
WORKDIR /app/frontend
COPY frontend/package.json frontend/package-lock.json ./
RUN npm ci
COPY frontend/ ./

# Baked into the bundle at build time. API and socket are relative because the
# backend serves this build.
ARG VITE_API_URL=/api
ARG VITE_SOCKET_URL=
ARG VITE_CLERK_PUBLISHABLE_KEY=
ENV VITE_API_URL=$VITE_API_URL \
    VITE_SOCKET_URL=$VITE_SOCKET_URL \
    VITE_CLERK_PUBLISHABLE_KEY=$VITE_CLERK_PUBLISHABLE_KEY
RUN npm run build

# ---------- stage 2: backend runtime ----------
FROM node:22-alpine AS runtime
WORKDIR /app/backend
ENV NODE_ENV=production \
    PORT=8080
COPY backend/package.json backend/package-lock.json ./
RUN npm ci --omit=dev && npm cache clean --force
COPY backend/ ./
COPY --from=client /app/frontend/dist /app/frontend/dist

EXPOSE 8080
HEALTHCHECK --interval=30s --timeout=5s --start-period=20s --retries=3 \
  CMD node -e "fetch('http://127.0.0.1:'+(process.env.PORT||8080)+'/health').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"

CMD ["node", "server.js"]
