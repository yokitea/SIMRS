FROM node:22-alpine AS builder
WORKDIR /app
COPY apps/web/package.json ./
RUN npm install
COPY apps/web ./
ARG NEXT_PUBLIC_SIMRS_API_URL=http://localhost:8090
ARG NEXT_PUBLIC_BRAND_NAME="Core SIMRS"
ARG NEXT_PUBLIC_RIS_URL=http://localhost:3000
ARG NEXT_PUBLIC_PACS_VIEWER_URL=http://localhost:3001/viewer
ENV NEXT_PUBLIC_SIMRS_API_URL=$NEXT_PUBLIC_SIMRS_API_URL
ENV NEXT_PUBLIC_BRAND_NAME=$NEXT_PUBLIC_BRAND_NAME
ENV NEXT_PUBLIC_RIS_URL=$NEXT_PUBLIC_RIS_URL
ENV NEXT_PUBLIC_PACS_VIEWER_URL=$NEXT_PUBLIC_PACS_VIEWER_URL
RUN npm run build

FROM node:22-alpine
WORKDIR /app
RUN adduser -D -u 10001 simrs
COPY --from=builder --chown=10001:10001 /app/.next/standalone ./
COPY --from=builder --chown=10001:10001 /app/.next/static ./.next/static
USER 10001
ENV PORT=3002
EXPOSE 3002
CMD ["node", "server.js"]
