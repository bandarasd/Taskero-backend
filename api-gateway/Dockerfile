FROM node:20-alpine
WORKDIR /app/service
COPY api-gateway/package*.json ./
RUN npm ci --omit=dev
COPY shared/ /app/shared/
COPY serviceAccountKey.json /app/serviceAccountKey.json
COPY api-gateway/ .
ENV NODE_PATH=/app/service/node_modules
EXPOSE 3000
CMD ["node", "server.js"]
