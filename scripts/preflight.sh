#!/bin/bash
# scripts/preflight.sh
# One-click pre-flight check for Stream Deck

cd "$(dirname "$0")/.." || exit 1

echo "🔍 PHASE 1: Type Check..."
if ! npx tsc --noEmit; then
    echo "❌ Type check failed!"
    exit 1
fi
echo "✅ Types OK"

echo ""
echo "🔍 PHASE 2: Lint Check..."
if ! npm run lint --silent; then
    echo "❌ Lint failed!"
    exit 1
fi
echo "✅ Lint OK"

echo ""
echo "🏗️  PHASE 3: Build..."
if ! npm run build; then
    echo "❌ Build failed!"
    exit 1
fi
echo "✅ Build OK"

echo ""
echo "══════════════════════════════════════"
echo "✅ PRE-FLIGHT COMPLETE - Ready to deploy"
echo "══════════════════════════════════════"
