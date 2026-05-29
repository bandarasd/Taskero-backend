FROM node:20-alpine
WORKDIR /app
COPY user-service/package*.json ./
RUN npm ci --omit=dev
COPY shared/ ../shared/
COPY serviceAccountKey.json ../serviceAccountKey.json
COPY user-service/ .
ENV NODE_PATH=/app/node_modules
EXPOSE 3001
CMD ["node", "server.js"]
