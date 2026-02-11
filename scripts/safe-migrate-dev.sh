#!/bin/bash
# scripts/safe-migrate-dev.sh

echo "🛡️  Creating Safety Backup for Dev DB..."
TIMESTAMP=$(date +%Y%m%d_%H%M%S)
BACKUP_DIR="backups/db"
mkdir -p $BACKUP_DIR

if [ -f "prisma/dev.db" ]; then
    cp "prisma/dev.db" "$BACKUP_DIR/dev.db.$TIMESTAMP.bak"
    echo "✅ Backup created at $BACKUP_DIR/dev.db.$TIMESTAMP.bak"
else
    echo "⚠️  No existing dev database found to backup."
fi

echo "🚀 Running Prisma Migrate Dev..."
# Load development environment variables
export $(grep -v '^#' .env.development | xargs)

# Execute prisma migrate dev, passing any arguments (like --name)
npx prisma migrate dev "$@"
