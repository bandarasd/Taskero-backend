#!/bin/bash
set -e

# Run from taskero-backend/ to build and start all services
cd "$(dirname "$0")/.."

echo "=== Building and starting all services ==="
docker compose -f docker-compose.prod.yml up -d --build

echo "=== Running DB migrations ==="
NODE_TLS_REJECT_UNAUTHORIZED=0 npm run db:migrate

echo "=== Done! Services running on: ==="
echo "  API Gateway: http://$(curl -s http://169.254.169.254/latest/meta-data/public-ipv4):3000"
docker compose -f docker-compose.prod.yml ps
