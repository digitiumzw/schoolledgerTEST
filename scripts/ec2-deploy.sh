#!/bin/bash
# ════════════════════════════════════════════════════════════════════
# SchoolLedger — EC2 Deploy Script
# Pulls latest images from GHCR and restarts services
# Run this on the EC2 server (called by GitHub Actions or manually)
# ════════════════════════════════════════════════════════════════════
set -e

cd ~/schoolledger

echo "=========================================="
echo "  SchoolLedger Deploy"
echo "=========================================="

# ─── Load environment ──────────────────────────────────────────────
if [ ! -f .env.docker ]; then
    echo "ERROR: .env.docker not found. Run ec2-setup.sh first."
    exit 1
fi
export $(grep -v '^#' .env.docker | xargs)

# ─── Pull latest images ────────────────────────────────────────────
echo "[1/3] Pulling latest images from GHCR..."
docker compose -f docker-compose.ec2.yml --env-file .env.docker pull

# ─── Restart services ──────────────────────────────────────────────
echo "[2/3] Restarting services..."
docker compose -f docker-compose.ec2.yml --env-file .env.docker up -d --force-recreate

# ─── Cleanup old images ────────────────────────────────────────────
echo "[3/3] Cleaning up old images..."
docker image prune -f 2>/dev/null || true

echo ""
echo "=========================================="
echo "  Deploy complete!"
echo "=========================================="
echo ""
echo "Services:"
docker compose -f docker-compose.ec2.yml ps
echo ""
echo "Logs:  docker compose -f docker-compose.ec2.yml logs -f"
echo ""
