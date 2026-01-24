#!/bin/bash
# scripts/restart-stack.sh

echo "🛑 Cleaning up old processes..."
npx pm2 delete all 2>/dev/null || true
# Fallback cleanup for old zombies
lsof -ti:3000 | xargs kill -9 2>/dev/null
lsof -ti:3001 | xargs kill -9 2>/dev/null

echo "🏗️  Building Production..."
npm run build

echo "🚀 Starting Stack via PM2..."
npx pm2 start ecosystem.config.js

echo "✅ Deployment Complete"
echo "   Monitor: npx pm2 monit"
echo "   Logs:    npx pm2 logs"
echo "   Status:  npx pm2 status"
