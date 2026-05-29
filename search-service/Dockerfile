FROM node:20-alpine
WORKDIR /app
COPY search-service/package*.json ./
RUN npm ci --omit=dev
COPY shared/ ../shared/
COPY serviceAccountKey.json ../serviceAccountKey.json
COPY search-service/ .
ENV NODE_PATH=/app/node_modules
EXPOSE 3005
CMD ["node", "server.js"]
