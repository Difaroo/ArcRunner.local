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

echo "🛡️  Creating Safety Backup..."
TIMESTAMP=$(date +%Y%m%d_%H%M%S)
BACKUP_DIR="backups/db"
mkdir -p $BACKUP_DIR

if [ -f "prisma/prod_v2.db" ]; then
    cp "prisma/prod_v2.db" "$BACKUP_DIR/prod_v2.db.$TIMESTAMP.bak"
    echo "✅ Backup created at $BACKUP_DIR/prod_v2.db.$TIMESTAMP.bak"
else
    echo "⚠️  No existing database found to backup. Proceeding with caution."
fi

echo "🚀 Running Prisma Migrate Deploy..."
# 'deploy' applies pending migrations without resetting the DB or generating clients
npx prisma migrate deploy

echo "✅ Migration Deployment Complete."
