#!/bin/bash
# scripts/deploy-migration.sh

echo "🛡️  Loading Production Environment..."
# Load env vars from .env.production, ignoring comments
if [ -f .env.production ]; then
    export $(grep -v '^#' .env.production | xargs)
else
    echo "❌ .env.production not found!"
    exit 1
fi

echo "🎯 Target Database: $DATABASE_URL"

echo "🚀 Running Prisma Migrate Deploy..."
# 'deploy' applies pending migrations without resetting the DB or generating clients
npx prisma migrate deploy

echo "✅ Migration Deployment Complete."
