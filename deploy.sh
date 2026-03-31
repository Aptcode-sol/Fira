#!/bin/bash

#============================================================
# FIRA Deployment Script
# Pulls latest code, builds all services, and restarts PM2
#============================================================

set -e  # Exit on any error

echo "========================================="
echo "🚀 FIRA Deployment Started"
echo "========================================="
echo ""

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Get current branch
BRANCH=$(git rev-parse --abbrev-ref HEAD)
echo "📌 Current branch: $BRANCH"
echo ""

# Step 1: Pull latest code
echo "========================================="
echo "📥 Step 1: Pulling Latest Code"
echo "========================================="
if git pull origin main; then
    echo -e "${GREEN}✅ Git pull successful${NC}"
else
    echo -e "${RED}❌ Git pull failed${NC}"
    exit 1
fi
echo ""

# Step 2: Build all services
echo "========================================="
echo "🔨 Step 2: Building All Services"
echo "========================================="
if chmod +x build.sh && ./build.sh; then
    echo -e "${GREEN}✅ Build successful${NC}"
else
    echo -e "${RED}❌ Build failed${NC}"
    exit 1
fi
echo ""

# Step 3: Restart PM2 apps
echo "========================================="
echo "🔄 Step 3: Restarting PM2 Applications"
echo "========================================="

# Stop all existing apps
if pm2 delete all 2>/dev/null; then
    echo "Stopped all PM2 apps"
else
    echo "No running PM2 apps to stop"
fi

# Start new apps
if pm2 start ecosystem.config.js --env production; then
    echo -e "${GREEN}✅ PM2 apps started${NC}"
else
    echo -e "${RED}❌ PM2 start failed${NC}"
    exit 1
fi

# Save PM2 state
pm2 save
pm2 status

echo ""
echo "========================================="
echo -e "${GREEN}✅ Deployment Complete!${NC}"
echo "========================================="
echo ""
echo "📊 Application Status:"
pm2 list
echo ""
echo "📝 To view logs:"
echo "   pm2 logs              # All logs"
echo "   pm2 logs -f           # Follow logs"
echo "   pm2 logs fira-backend # Backend only"
echo ""
