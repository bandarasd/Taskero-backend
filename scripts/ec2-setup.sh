#!/bin/bash
set -e

# Run this once on a fresh Ubuntu 24.04 EC2 instance (t2.micro)
# Usage: bash ec2-setup.sh

echo "=== Installing Docker ==="
sudo apt-get update -y
sudo apt-get install -y ca-certificates curl gnupg
sudo install -m 0755 -d /etc/apt/keyrings
curl -fsSL https://download.docker.com/linux/ubuntu/gpg | sudo gpg --dearmor -o /etc/apt/keyrings/docker.gpg
sudo chmod a+r /etc/apt/keyrings/docker.gpg
echo "deb [arch=$(dpkg --print-architecture) signed-by=/etc/apt/keyrings/docker.gpg] https://download.docker.com/linux/ubuntu $(. /etc/os-release && echo "$VERSION_CODENAME") stable" | sudo tee /etc/apt/sources.list.d/docker.list > /dev/null
sudo apt-get update -y
sudo apt-get install -y docker-ce docker-ce-cli containerd.io docker-compose-plugin
sudo usermod -aG docker $USER

echo "=== Cloning repo ==="
# Replace with your actual repo URL
git clone https://github.com/YOUR_USERNAME/taskero.git ~/taskero
cd ~/taskero/taskero-backend

echo "=== Setting up environment ==="
cp .env.example .env
echo ""
echo ">>> Edit .env now and fill in your secrets, then re-run:"
echo "    cd ~/taskero/taskero-backend && bash scripts/ec2-start.sh"
