FROM node:20-alpine
WORKDIR /app
COPY payment-service/package*.json ./
RUN npm ci --omit=dev
COPY shared/ ../shared/
COPY serviceAccountKey.json ../serviceAccountKey.json
COPY payment-service/ .
EXPOSE 3004
CMD ["node", "server.js"]
