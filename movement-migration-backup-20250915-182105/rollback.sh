#!/bin/bash

# Movement Migration Rollback Script
# Usage: ./rollback.sh [backup-dir]

echo "Movement Migration Rollback Script"
echo "==================================="
echo ""

# Check if backup directory argument is provided
if [ -z "$1" ]; then
  echo "Usage: $0 <backup-directory>"
  echo "Example: $0 movement-migration-backup-20250915-182105"
  exit 1
fi

BACKUP_DIR="$1"

# Check if backup directory exists
if [ ! -d "$BACKUP_DIR" ]; then
  echo "Error: Backup directory '$BACKUP_DIR' not found"
  exit 1
fi

# Check if we're in the project root
if [ ! -d "data/mods/core" ]; then
  echo "Error: This script must be run from the project root directory"
  echo "Current directory: $(pwd)"
  exit 1
fi

echo "Rolling back from backup: $BACKUP_DIR"
echo ""

# Restore core files
echo "Step 1: Restoring core mod files..."
if [ -d "$BACKUP_DIR/core/actions" ]; then
  cp "$BACKUP_DIR/core/actions/"*.json data/mods/core/actions/ 2>/dev/null && echo "  ✓ Actions restored"
fi
if [ -d "$BACKUP_DIR/core/rules" ]; then
  cp "$BACKUP_DIR/core/rules/"*.json data/mods/core/rules/ 2>/dev/null && echo "  ✓ Rules restored"
fi
if [ -d "$BACKUP_DIR/core/conditions" ]; then
  cp "$BACKUP_DIR/core/conditions/"*.json data/mods/core/conditions/ 2>/dev/null && echo "  ✓ Conditions restored"
fi
if [ -d "$BACKUP_DIR/core/scopes" ]; then
  cp "$BACKUP_DIR/core/scopes/"*.scope data/mods/core/scopes/ 2>/dev/null && echo "  ✓ Scopes restored"
fi

# Restore positioning files
echo ""
echo "Step 2: Restoring positioning mod files..."
if [ -d "$BACKUP_DIR/positioning/actions" ]; then
  cp "$BACKUP_DIR/positioning/actions/"*.json data/mods/positioning/actions/ 2>/dev/null && echo "  ✓ Positioning actions restored"
fi

# Restore movement mod manifest to original state
echo ""
echo "Step 3: Restoring movement mod manifest..."
if [ -f "$BACKUP_DIR/movement/mod-manifest.json" ]; then
  cp "$BACKUP_DIR/movement/mod-manifest.json" data/mods/movement/ && echo "  ✓ Movement mod manifest restored"
fi

# Remove migrated files from movement mod if they exist
echo ""
echo "Step 4: Cleaning migrated files from movement mod..."
rm -f data/mods/movement/actions/go.action.json 2>/dev/null
rm -f data/mods/movement/rules/go.rule.json 2>/dev/null
rm -f data/mods/movement/conditions/event-is-action-go.condition.json 2>/dev/null
rm -f data/mods/movement/conditions/actor-can-move.condition.json 2>/dev/null
rm -f data/mods/movement/conditions/exit-is-unblocked.condition.json 2>/dev/null
rm -f data/mods/movement/scopes/clear_directions.scope 2>/dev/null
echo "  ✓ Movement mod cleaned"

# Verify checksums if available
echo ""
echo "Step 5: Verifying file integrity..."
if [ -f "$BACKUP_DIR/checksums.txt" ]; then
  cd "$BACKUP_DIR"
  if sha256sum -c checksums.txt --quiet 2>/dev/null; then
    echo "  ✓ Backup integrity verified"
  else
    echo "  ⚠ Warning: Some backup files may have been modified"
  fi
  cd - > /dev/null
else
  echo "  ⚠ No checksums file found for verification"
fi

echo ""
echo "====================================="
echo "Rollback complete!"
echo ""
echo "Next steps:"
echo "1. Run 'npm run test:unit' to verify system integrity"
echo "2. Check that the game loads correctly"
echo "3. Review any error logs for issues"
echo ""
echo "If you encounter any issues, the backup files are preserved in:"
echo "  $BACKUP_DIR"