#!/bin/bash
# ════════════════════════════════════════════════════════════════════
# SchoolLedger — EC2 One-Time Setup Script
# Run this ONCE on a fresh EC2 Ubuntu 22.04 instance
# ════════════════════════════════════════════════════════════════════
set -e

echo "=========================================="
echo "  SchoolLedger EC2 Setup (one-time)"
echo "=========================================="

# ─── 1. Create swap file (critical for 1GB RAM) ────────────────────
echo "[1/5] Creating 2GB swap file..."
if [ ! -f /swapfile ]; then
    sudo fallocate -l 2G /swapfile
    sudo chmod 600 /swapfile
    sudo mkswap /swapfile
    sudo swapon /swapfile
    echo '/swapfile none swap sw 0 0' | sudo tee -a /etc/fstab
    echo "  Swap created and enabled."
else
    echo "  Swap already exists, skipping."
fi

# ─── 2. Install Docker ─────────────────────────────────────────────
echo "[2/5] Installing Docker..."
if ! command -v docker &> /dev/null; then
    curl -fsSL https://get.docker.com | sudo sh
    sudo usermod -aG docker $USER
    echo "  Docker installed. (You may need to log out/in for group changes)"
else
    echo "  Docker already installed, skipping."
fi

# ─── 3. Enable Docker on boot ──────────────────────────────────────
echo "[3/5] Enabling Docker on boot..."
sudo systemctl enable docker
sudo systemctl start docker

# ─── 4. Create project directory ───────────────────────────────────
echo "[4/5] Creating project directory..."
mkdir -p ~/schoolledger/scripts
mkdir -p ~/schoolledger/docker/nginx
mkdir -p ~/schoolledger/docker/mysql

# ─── 5. Login to GitHub Container Registry ─────────────────────────
echo "[5/5] Setting up GHCR login..."
echo ""
echo "  You need a GitHub Personal Access Token (PAT) with read:packages scope."
echo "  Create one at: https://github.com/settings/tokens/new?scopes=read:packages"
echo ""
read -p "  Enter your GitHub username: " GH_USER
read -s -p "  Enter your GitHub PAT: " GH_PAT
echo ""
echo "$GH_PAT" | docker login ghcr.io -u "$GH_USER" --password-stdin
echo "  GHCR login saved."

# ─── Create .env.docker if it doesn't exist ────────────────────────
if [ ! -f ~/schoolledger/.env.docker ]; then
    echo ""
    echo "  Creating .env.docker from template..."
    cat > ~/schoolledger/.env.docker << 'ENVEOF'
DOMAIN=localhost

MYSQL_ROOT_PASSWORD=CHANGE_ME_STRONG_PASSWORD
MYSQL_DATABASE=schoolledger
MYSQL_USER=schoolledger
MYSQL_PASSWORD=CHANGE_ME_STRONG_PASSWORD

CI_ENVIRONMENT=production
JWT_SECRET_KEY=CHANGE_ME
JWT_TIME_TO_LIVE=7200
JWT_ALGORITHM=HS256
JWT_PLATFORM_TOKEN_LIFETIME=3600
JWT_PLATFORM_SECRET_KEY=CHANGE_ME

ENCRYPTION_KEY=hex2bin:CHANGE_ME

app.forceGlobalSecureRequests=false
app.CSPEnabled=false
SITE_URL=http://localhost/app

PAYNOW_INTEGRATION_ID=24158
PAYNOW_INTEGRATION_KEY=your_key
PAYNOW_RESULT_URL=http://localhost/api/subscription/webhook
PAYNOW_RETURN_URL=http://localhost/app/billing?payment=complete
SUBSCRIPTION_CURRENCY=USD

email.protocol=smtp
email.SMTPHost=smtp.your-provider.com
email.SMTPPort=587
email.SMTPCrypto=tls
email.fromEmail=noreply@localhost
email.fromName=SchoolLedger
email.SMTPUser=your_user
email.SMTPPass=your_pass

PLATFORM_URL=http://localhost/app/platform-control-panel/demo-requests

RATE_LIMITER_UNAUTHENTICATED_LIMIT=60
RATE_LIMITER_AUTHENTICATED_LIMIT=120

VITE_API_BASE_URL=/api
RUN_MIGRATIONS=1
ENVEOF
    echo "  Created ~/schoolledger/.env.docker"
    echo "  IMPORTANT: Edit this file with your real secrets!"
    echo "    nano ~/schoolledger/.env.docker"
fi

echo ""
echo "=========================================="
echo "  Setup complete!"
echo "=========================================="
echo ""
echo "Next steps:"
echo "  1. Edit your env file:  nano ~/schoolledger/.env.docker"
echo "  2. Push code to GitHub main branch — GitHub Actions will"
echo "     build the images and deploy automatically."
echo ""
echo "Or deploy manually after first push:"
echo "  cd ~/schoolledger"
echo "  bash scripts/ec2-deploy.sh"
echo ""
