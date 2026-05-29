FROM node:20-alpine
WORKDIR /app
COPY notification-service/package*.json ./
RUN npm ci --omit=dev
COPY shared/ ../shared/
COPY serviceAccountKey.json ../serviceAccountKey.json
COPY notification-service/ .
ENV NODE_PATH=/app/node_modules
EXPOSE 3006
CMD ["node", "server.js"]
