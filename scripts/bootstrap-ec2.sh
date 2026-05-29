#!/bin/bash
# Run this script on a fresh Ubuntu 22.04 EC2 instance (t3.small or larger).
# curl -fsSL https://raw.githubusercontent.com/YOUR_ORG/taskero/main/taskero-backend/scripts/bootstrap-ec2.sh | bash
set -euo pipefail

echo "==> Installing MicroK8s"
sudo snap install microk8s --classic --channel=1.30/stable
sudo usermod -aG microk8s ubuntu
sudo chown -R ubuntu:ubuntu ~/.kube 2>/dev/null || true

echo "==> Waiting for MicroK8s to be ready"
sudo microk8s status --wait-ready

echo "==> Enabling required addons"
sudo microk8s enable dns storage ingress

echo "==> Creating kubectl alias"
echo 'alias kubectl="microk8s kubectl"' >> ~/.bashrc
echo 'alias mk="microk8s kubectl"' >> ~/.bashrc
source ~/.bashrc

echo "==> MicroK8s node info"
sudo microk8s kubectl get nodes

echo ""
echo "======================================================"
echo " MicroK8s ready. Next steps:"
echo "======================================================"
echo " 1. Upload your serviceAccountKey.json to this server"
echo " 2. Run the deploy script: ./scripts/deploy.sh"
echo "======================================================"
