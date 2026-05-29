FROM node:20-alpine
WORKDIR /app/service
COPY chat-service/package*.json ./
RUN npm ci --omit=dev
COPY shared/ /app/shared/
COPY serviceAccountKey.json /app/serviceAccountKey.json
COPY chat-service/ .
ENV NODE_PATH=/app/service/node_modules
EXPOSE 3003
CMD ["node", "server.js"]
