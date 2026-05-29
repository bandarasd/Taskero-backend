#!/bin/bash
# Run this from /home/ubuntu/taskero/taskero-backend on the EC2 instance.
# Builds all Docker images, pushes to the local MicroK8s registry, and deploys.
set -euo pipefail

REGISTRY="localhost:32000"
MK="sudo microk8s kubectl"

SERVICES=(
  "api-gateway"
  "user-service"
  "task-service"
  "chat-service"
  "payment-service"
  "search-service"
  "notification-service"
  "email-service"
)

# ── 1. Build & push images ────────────────────────────────────────────────────
echo "==> Building and pushing Docker images to local registry"
for svc in "${SERVICES[@]}"; do
  echo "  Building $svc..."
  sudo docker build -t "$REGISTRY/taskero-$svc:latest" "./$svc"
  sudo docker push "$REGISTRY/taskero-$svc:latest"
done

# ── 2. Apply namespace + secrets ─────────────────────────────────────────────
echo "==> Applying namespace"
$MK apply -f k8s/00-namespace.yaml

echo "==> Applying secrets"
$MK apply -f k8s/01-secrets.yaml

echo "==> Creating Firebase secret"
if [ ! -f serviceAccountKey.json ]; then
  echo "ERROR: serviceAccountKey.json not found in $(pwd)"
  exit 1
fi
$MK create secret generic taskero-firebase-secret \
  --from-file=serviceAccountKey.json=./serviceAccountKey.json \
  -n taskero \
  --dry-run=client -o yaml | $MK apply -f -

# ── 3. Postgres ───────────────────────────────────────────────────────────────
echo "==> Deploying Postgres"
$MK apply -f k8s/02-postgres.yaml

echo "==> Waiting for Postgres..."
$MK rollout status deployment/postgres -n taskero --timeout=120s

# ── 4. DB migrations ──────────────────────────────────────────────────────────
echo "==> Running DB migrations"
$MK delete job db-migrate -n taskero 2>/dev/null || true
sed "s|REGISTRY|$REGISTRY|g" k8s/03-db-migrate-job.yaml | $MK apply -f -
$MK wait --for=condition=complete job/db-migrate -n taskero --timeout=120s
echo "Migrations done."

# ── 5. Deploy all services ────────────────────────────────────────────────────
echo "==> Deploying services"
for manifest in k8s/04-api-gateway.yaml k8s/05-user-service.yaml k8s/06-task-service.yaml \
                k8s/07-chat-service.yaml k8s/08-payment-service.yaml k8s/09-search-service.yaml \
                k8s/10-notification-service.yaml k8s/11-email-service.yaml; do
  sed "s|REGISTRY|$REGISTRY|g" $manifest | $MK apply -f -
done

echo "==> Applying ingress"
$MK apply -f k8s/12-ingress.yaml

echo "==> Waiting for api-gateway..."
$MK rollout status deployment/api-gateway -n taskero --timeout=120s

# ── 6. Summary ────────────────────────────────────────────────────────────────
echo ""
echo "======================================================"
echo " Deploy complete!"
echo "======================================================"
$MK get pods -n taskero
echo ""
PUBLIC_IP=$(curl -s http://169.254.169.254/latest/meta-data/public-ipv4 2>/dev/null || echo "YOUR_EC2_IP")
echo " API: http://$PUBLIC_IP"
echo " Test: curl http://$PUBLIC_IP/users/health"
echo "======================================================"
