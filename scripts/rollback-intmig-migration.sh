#!/bin/bash
set -e

if [ -z "$1" ]; then
  echo "Usage: $0 <backup-directory>"
  echo ""
  echo "Available backups:"
  if [ -d "backups" ]; then
    ls -la backups/intmig-* 2>/dev/null || echo "  No INTMIG backups found"
  else
    echo "  No backups directory found"
  fi
  exit 1
fi

BACKUP_DIR="$1"
TARGET_DIR="data/mods/intimacy/actions"

if [ ! -d "$BACKUP_DIR" ]; then
  echo "❌ Backup directory not found: $BACKUP_DIR"
  exit 1
fi

if [ ! -d "$BACKUP_DIR/actions" ]; then
  echo "❌ Invalid backup directory structure: missing actions/ subdirectory"
  exit 1
fi

echo "⚠️  WARNING: This will restore intimacy actions from backup"
echo ""
echo "  Backup source: $BACKUP_DIR"
echo "  Target directory: $TARGET_DIR"
echo ""

# Show backup info if manifest exists
if [ -f "$BACKUP_DIR/manifest.json" ]; then
  echo "Backup information:"
  grep -E '"timestamp"|"fileCount"|"gitCommit"' "$BACKUP_DIR/manifest.json" | sed 's/^/  /'
  echo ""
fi

read -p "Continue with rollback? (y/N) " -n 1 -r
echo
if [[ ! $REPLY =~ ^[Yy]$ ]]; then
  echo "Rollback cancelled."
  exit 0
fi

echo ""
echo "🔒 Creating safety backup of current state..."
SAFETY_BACKUP="backups/intmig-rollback-safety-$(date +%Y%m%d-%H%M%S)"
mkdir -p "$SAFETY_BACKUP"
cp -r "$TARGET_DIR" "$SAFETY_BACKUP/"

# Create safety backup manifest
cat > "$SAFETY_BACKUP/manifest.json" << EOF
{
  "timestamp": "$(date -u +"%Y-%m-%dT%H:%M:%SZ")",
  "source": "$TARGET_DIR",
  "fileCount": $(ls -1 "$SAFETY_BACKUP/actions"/*.action.json 2>/dev/null | wc -l),
  "backupType": "rollback-safety",
  "restoredFrom": "$BACKUP_DIR"
}
EOF

echo "📂 Restoring files from backup..."
# Use cp with force to overwrite existing files
cp -f "$BACKUP_DIR/actions/"*.action.json "$TARGET_DIR/"

echo "✅ Files restored successfully"
echo ""
echo "🔍 Verifying restoration..."

# Run validation script to check current state
if [ -f "scripts/validate-intmig-migration.js" ]; then
  echo "Running migration validation..."
  node scripts/validate-intmig-migration.js || true
else
  echo "Validation script not found, skipping validation"
fi

echo ""
echo "✅ Rollback completed successfully!"
echo "   Restored from: $BACKUP_DIR"
echo "   Safety backup: $SAFETY_BACKUP"
echo ""
echo "Next steps:"
echo "  1. Run tests to verify functionality: npm run test:ci"
echo "  2. Check git status: git status"
echo "  3. If needed, restore safety backup: ./scripts/rollback-intmig-migration.sh $SAFETY_BACKUP"