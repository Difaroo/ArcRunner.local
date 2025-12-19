#!/bin/bash
# scripts/restart-stack.sh

echo "🛑 Stopping existing servers..."
lsof -ti:3000 | xargs kill -9 2>/dev/null
lsof -ti:3001 | xargs kill -9 2>/dev/null

echo "🏗️  Building Production..."
npm run build

echo "🚀 Starting Production (Port 3001)..."
# Start in background, detached
nohup npm run start > production.log 2>&1 &
PID_PROD=$!
echo "   PID: $PID_PROD"
echo "   Logs: production.log"

echo "⏳ Waiting for Production to stabilize..."
sleep 5
STATUS=$(curl -s -o /dev/null -w "%{http_code}" http://localhost:3001)

if [ "$STATUS" -eq 200 ]; then
    echo "✅ Production is HEALTHY (200 OK)"
else
    echo "⚠️  Production returned status: $STATUS"
fi

echo "🚀 Starting Development (Port 3000)..."
npm run dev
