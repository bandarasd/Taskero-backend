FROM node:20-alpine
WORKDIR /app/service
COPY search-service/package*.json ./
RUN npm ci --omit=dev
COPY shared/ /app/shared/
COPY serviceAccountKey.json /app/serviceAccountKey.json
COPY search-service/ .
ENV NODE_PATH=/app/service/node_modules
EXPOSE 3005
CMD ["node", "server.js"]
