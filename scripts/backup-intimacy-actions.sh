#!/bin/bash
set -e

# Create backups directory if it doesn't exist
mkdir -p backups

BACKUP_DIR="backups/intmig-$(date +%Y%m%d-%H%M%S)"
SOURCE_DIR="data/mods/intimacy/actions"

echo "🔒 Creating backup of intimacy actions..."
echo "Backup directory: $BACKUP_DIR"

# Create backup directory
mkdir -p "$BACKUP_DIR"

echo "📁 Backing up action files..."
cp -r "$SOURCE_DIR" "$BACKUP_DIR/"

# Count the files
FILE_COUNT=$(ls -1 "$BACKUP_DIR/actions"/*.action.json 2>/dev/null | wc -l)

echo "📋 Creating backup manifest..."
cat > "$BACKUP_DIR/manifest.json" << EOF
{
  "timestamp": "$(date -u +"%Y-%m-%dT%H:%M:%SZ")",
  "source": "$SOURCE_DIR",
  "fileCount": $FILE_COUNT,
  "migration": "INTMIG",
  "gitCommit": "$(git rev-parse HEAD 2>/dev/null || echo 'unknown')",
  "gitBranch": "$(git branch --show-current 2>/dev/null || echo 'unknown')",
  "backupType": "pre-migration",
  "files": [
$(ls -1 "$BACKUP_DIR/actions"/*.action.json | sed 's|.*/||' | sed 's/^/    "/' | sed 's/$/",/' | sed '$ s/,$//')
  ]
}
EOF

echo "✅ Verifying backup..."
if [ $FILE_COUNT -eq 25 ]; then
  echo "✅ Backup completed successfully!"
  echo "   Location: $BACKUP_DIR"
  echo "   Files backed up: $FILE_COUNT"
  echo ""
  echo "To restore from this backup, run:"
  echo "  ./scripts/rollback-intmig-migration.sh $BACKUP_DIR"
else
  echo "⚠️  Warning: Expected 25 files but found $FILE_COUNT"
  echo "   This might be okay if some files were already migrated."
  echo "   Location: $BACKUP_DIR"
fi