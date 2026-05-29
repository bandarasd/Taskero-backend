FROM node:20-alpine
WORKDIR /app/service
COPY email-service/package*.json ./
RUN npm ci --omit=dev
COPY shared/ /app/shared/
COPY serviceAccountKey.json /app/serviceAccountKey.json
COPY email-service/ .
ENV NODE_PATH=/app/service/node_modules
EXPOSE 3007
CMD ["node", "server.js"]
