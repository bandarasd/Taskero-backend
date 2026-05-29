FROM node:20-alpine
WORKDIR /app/service
COPY task-service/package*.json ./
RUN npm ci --omit=dev
COPY shared/ /app/shared/
RUN ln -s /app/service/node_modules /app/shared/node_modules
COPY serviceAccountKey.json /app/serviceAccountKey.json
COPY task-service/ .
ENV NODE_PATH=/app/service/node_modules
EXPOSE 3002
CMD ["node", "server.js"]
