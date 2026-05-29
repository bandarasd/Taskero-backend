FROM node:20-alpine
WORKDIR /app
COPY api-gateway/package*.json ./
RUN npm ci --omit=dev
COPY shared/ ../shared/
COPY serviceAccountKey.json ../serviceAccountKey.json
COPY api-gateway/ .
ENV NODE_PATH=/app/node_modules
EXPOSE 3000
CMD ["node", "server.js"]
