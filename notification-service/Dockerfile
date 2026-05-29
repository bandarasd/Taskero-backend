FROM node:20-alpine
WORKDIR /app/service
COPY notification-service/package*.json ./
RUN npm ci --omit=dev
COPY shared/ /app/shared/
RUN ln -s /app/service/node_modules /app/shared/node_modules
COPY serviceAccountKey.json /app/serviceAccountKey.json
COPY notification-service/ .
ENV NODE_PATH=/app/service/node_modules
EXPOSE 3006
CMD ["node", "server.js"]
