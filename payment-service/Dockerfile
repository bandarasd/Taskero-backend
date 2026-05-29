FROM node:20-alpine
WORKDIR /app/service
COPY payment-service/package*.json ./
RUN npm ci --omit=dev
COPY shared/ /app/shared/
COPY serviceAccountKey.json /app/serviceAccountKey.json
COPY payment-service/ .
ENV NODE_PATH=/app/service/node_modules
EXPOSE 3004
CMD ["node", "server.js"]
