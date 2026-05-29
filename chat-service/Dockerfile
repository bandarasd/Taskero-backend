FROM node:20-alpine
WORKDIR /app
COPY chat-service/package*.json ./
RUN npm ci --omit=dev
COPY shared/ ../shared/
COPY serviceAccountKey.json ../serviceAccountKey.json
COPY chat-service/ .
ENV NODE_PATH=/app/node_modules
EXPOSE 3003
CMD ["node", "server.js"]
