FROM node:20-alpine
WORKDIR /app
COPY email-service/package*.json ./
RUN npm ci --omit=dev
COPY shared/ ../shared/
COPY serviceAccountKey.json ../serviceAccountKey.json
COPY email-service/ .
EXPOSE 3007
CMD ["node", "server.js"]
