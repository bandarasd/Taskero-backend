FROM node:20-alpine
WORKDIR /app
COPY task-service/package*.json ./
RUN npm ci --omit=dev
COPY shared/ ../shared/
COPY serviceAccountKey.json ../serviceAccountKey.json
COPY task-service/ .
EXPOSE 3002
CMD ["node", "server.js"]
