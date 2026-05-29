FROM node:20-alpine
WORKDIR /app/service
COPY user-service/package*.json ./
RUN npm ci --omit=dev
COPY shared/ /app/shared/
COPY serviceAccountKey.json /app/serviceAccountKey.json
COPY user-service/ .
ENV NODE_PATH=/app/service/node_modules
EXPOSE 3001
CMD ["node", "server.js"]
