#!/bin/bash
# scripts/sync-db.sh

DIRECTION=$1
DEV_DB="prisma/dev.db"
PROD_DB="prisma/prod_v2.db"
BACKUP_DIR="backups/db"

mkdir -p $BACKUP_DIR

if [ "$DIRECTION" == "dev-to-prod" ]; then
    echo "🔄 Syncing DEV -> PROD..."
    if [ ! -f $DEV_DB ]; then
        echo "❌ Dev DB not found at $DEV_DB"
        exit 1
    fi
    # Backup Prod
    if [ -f $PROD_DB ]; then
        cp $PROD_DB "$BACKUP_DIR/prod.db.$(date +%s).bak"
    fi
    cp $DEV_DB $PROD_DB
    echo "✅ Dev DB copied to Prod."
    
elif [ "$DIRECTION" == "prod-to-dev" ]; then
    echo "🔄 Syncing PROD -> DEV..."
    if [ ! -f $PROD_DB ]; then
        echo "❌ Prod DB not found at $PROD_DB"
        exit 1
    fi
    # Backup Dev
    if [ -f $DEV_DB ]; then
        cp $DEV_DB "$BACKUP_DIR/dev.db.$(date +%s).bak"
    fi
    cp $PROD_DB $DEV_DB
    echo "✅ Prod DB copied to Dev."

else
    echo "Usage: ./scripts/sync-db.sh [dev-to-prod | prod-to-dev]"
    exit 1
fi
