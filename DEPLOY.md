# Deploying Taskero Backend to AWS EC2 + MicroK8s

## Prerequisites

- AWS account (free tier: t2.micro — tight on RAM; t3.small ~$15/mo recommended)
- Docker Hub account (free tier is fine)
- Your repo on GitHub

---

## Step 1 — Launch EC2 Instance

1. Go to AWS Console → EC2 → Launch Instance
2. **AMI**: Ubuntu Server 22.04 LTS
3. **Instance type**: t3.small (2GB RAM) — t2.micro may OOM with 8 services
4. **Key pair**: create or select one, download the `.pem`
5. **Security group** — open these inbound ports:
   | Port | Source | Purpose |
   |------|--------|---------|
   | 22   | Your IP | SSH |
   | 80   | 0.0.0.0/0 | HTTP API |
   | 443  | 0.0.0.0/0 | HTTPS (optional) |
6. **Storage**: 20GB gp3 (enough for images + DB)
7. Launch and note the **Public IP**

---

## Step 2 — Bootstrap MicroK8s on EC2

SSH into the instance:
```bash
ssh -i your-key.pem ubuntu@YOUR_EC2_IP
```

Run the bootstrap script:
```bash
curl -fsSL https://raw.githubusercontent.com/YOUR_ORG/taskero/main/taskero-backend/scripts/bootstrap-ec2.sh | bash
```

Then **log out and back in** so the `microk8s` group takes effect.

---

## Step 3 — Clone the Repo on EC2

```bash
git clone https://github.com/YOUR_ORG/taskero.git
cd taskero/taskero-backend
```

---

## Step 4 — Upload Secrets

### Firebase service account key
```bash
# From your local machine:
scp -i your-key.pem taskero-backend/serviceAccountKey.json ubuntu@YOUR_EC2_IP:~/taskero/taskero-backend/
```

### Edit k8s/01-secrets.yaml
Fill in the `REPLACE_ME` values:
- `CLOUDINARY_API_SECRET`
- `STRIPE_SECRET_KEY` / `STRIPE_PUBLISHABLE_KEY`
- `EMAIL_PASS`
- `DB_PASSWORD` (if you changed it)

> **Never commit secrets to git.** The file is gitignored by default.

---

## Step 5 — Set Docker Hub Registry

```bash
export REGISTRY=docker.io/YOUR_DOCKERHUB_USERNAME
```

---

## Step 6 — Build & Push Docker Images

Run from your **local machine** (or let GitHub Actions do it after Step 8):

```bash
cd taskero-backend

for svc in api-gateway user-service task-service chat-service payment-service search-service notification-service email-service; do
  docker build -t $REGISTRY/taskero-$svc:latest ./$svc
  docker push $REGISTRY/taskero-$svc:latest
done
```

---

## Step 7 — Deploy

On the EC2 instance:

```bash
cd ~/taskero/taskero-backend
REGISTRY=docker.io/YOUR_DOCKERHUB_USERNAME ./scripts/deploy.sh
```

The script will:
1. Apply all Kubernetes manifests
2. Wait for Postgres to be ready
3. Run DB migrations
4. Deploy all 8 services
5. Configure the ingress

Check pod status:
```bash
sudo microk8s kubectl get pods -n taskero
```

Test the API:
```bash
curl http://YOUR_EC2_IP/users/health
```

---

## Step 8 — Set Up GitHub Actions (CI/CD)

Add these secrets to your GitHub repo (`Settings → Secrets → Actions`):

| Secret | Value |
|--------|-------|
| `DOCKERHUB_USERNAME` | Your Docker Hub username |
| `DOCKERHUB_TOKEN` | Docker Hub access token (not password) |
| `EC2_HOST` | EC2 public IP |
| `EC2_SSH_KEY` | Contents of your `.pem` key file |

Every push to `main` that touches `taskero-backend/` will automatically build images and deploy.

---

## Useful Commands

```bash
# Check all pods
sudo microk8s kubectl get pods -n taskero

# View logs for a service
sudo microk8s kubectl logs -f deployment/api-gateway -n taskero

# Restart a service
sudo microk8s kubectl rollout restart deployment/user-service -n taskero

# Check ingress
sudo microk8s kubectl get ingress -n taskero

# Re-run migrations manually
sudo microk8s kubectl delete job db-migrate -n taskero 2>/dev/null || true
REGISTRY=docker.io/YOUR_USERNAME ./scripts/deploy.sh
```

---

## Architecture

```
Internet:80
    ↓
EC2 (MicroK8s nginx ingress)
    ↓
api-gateway pod (port 3000)
    ↓ (cluster-internal DNS)
user-service:3001   task-service:3002   chat-service:3003
payment-service:3004  search-service:3005
notification-service:3006  email-service:3007
    ↓
postgres pod (PersistentVolume on EC2 disk)
```

All inter-service communication uses Kubernetes DNS:
`http://<service-name>:<port>` (e.g. `http://user-service:3001`)
