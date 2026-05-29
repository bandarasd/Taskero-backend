#!/bin/bash
# Full deploy: apply all k8s manifests and run DB migrations.
# Run from the taskero-backend directory on the EC2 instance.
# Usage: REGISTRY=docker.io/YOUR_DOCKERHUB ./scripts/deploy.sh
set -euo pipefail

REGISTRY="${REGISTRY:?Set REGISTRY=docker.io/YOUR_DOCKERHUB_USERNAME}"
MK="sudo microk8s kubectl"

echo "==> Creating namespace"
$MK apply -f k8s/00-namespace.yaml

echo "==> Applying secrets"
$MK apply -f k8s/01-secrets.yaml -n taskero

echo "==> Creating Firebase secret from file"
if [ ! -f serviceAccountKey.json ]; then
  echo "ERROR: serviceAccountKey.json not found in $(pwd)"
  exit 1
fi
$MK create secret generic taskero-firebase-secret \
  --from-file=serviceAccountKey.json=./serviceAccountKey.json \
  -n taskero \
  --dry-run=client -o yaml | $MK apply -f -

echo "==> Deploying Postgres"
$MK apply -f k8s/02-postgres.yaml -n taskero

echo "==> Waiting for Postgres to be ready"
$MK rollout status deployment/postgres -n taskero --timeout=120s

echo "==> Running DB migrations"
# Patch the migrate job with the correct image registry
sed "s|REGISTRY|$REGISTRY|g" k8s/03-db-migrate-job.yaml | $MK apply -f - -n taskero
$MK wait --for=condition=complete job/db-migrate -n taskero --timeout=120s
echo "Migrations complete."

echo "==> Deploying all services"
for manifest in k8s/04-api-gateway.yaml k8s/05-user-service.yaml k8s/06-task-service.yaml \
                k8s/07-chat-service.yaml k8s/08-payment-service.yaml k8s/09-search-service.yaml \
                k8s/10-notification-service.yaml k8s/11-email-service.yaml; do
  sed "s|REGISTRY|$REGISTRY|g" $manifest | $MK apply -f - -n taskero
done

echo "==> Applying ingress"
$MK apply -f k8s/12-ingress.yaml -n taskero

echo "==> Waiting for api-gateway rollout"
$MK rollout status deployment/api-gateway -n taskero --timeout=120s

echo ""
echo "======================================================"
echo " Deploy complete!"
echo "======================================================"
$MK get pods -n taskero
echo ""
EC2_IP=$(curl -s http://169.254.169.254/latest/meta-data/public-ipv4 2>/dev/null || echo "unknown")
echo " API is available at: http://$EC2_IP"
echo "======================================================"
