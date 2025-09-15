# MOVMODMIG-002: Backup and Documentation

## Overview
Create comprehensive backups of all files to be migrated and document the current state of the system before migration begins. This ensures we can rollback if needed and have a clear record of the pre-migration state.

## Current State
- **Core Mod**: Contains 6 movement-related files scheduled for migration
- **Positioning Mod**: Has 2 files with dependencies on core movement components
- **Documentation**: No formal migration documentation exists
- **Backups**: No systematic backup strategy for mod migrations

## Objectives
1. Create versioned backups of all affected files
2. Document current component relationships and dependencies
3. Generate pre-migration system snapshot
4. Establish rollback procedures
5. Create migration audit trail

## Technical Requirements

### Backup Strategy
```bash
# Backup directory structure
backups/
├── movement-migration-[timestamp]/
│   ├── core/
│   │   ├── actions/
│   │   │   └── go.action.json
│   │   ├── rules/
│   │   │   └── go.rule.json
│   │   ├── conditions/
│   │   │   ├── event-is-action-go.condition.json
│   │   │   ├── actor-can-move.condition.json
│   │   │   └── exit-is-unblocked.condition.json
│   │   └── scopes/
│   │       └── clear_directions.scope
│   ├── positioning/
│   │   └── actions/
│   │       ├── turn_around.action.json
│   │       └── get_close.action.json
│   └── metadata.json
```

### Backup Metadata Format
```json
// Location: backups/movement-migration-[timestamp]/metadata.json
{
  "backupVersion": "1.0.0",
  "timestamp": "2024-01-XX-HHMMSS",
  "purpose": "Movement mod migration from core",
  "ticket": "MOVMODMIG-002",
  "files": {
    "core": {
      "actions": ["go.action.json"],
      "rules": ["go.rule.json"],
      "conditions": [
        "event-is-action-go.condition.json",
        "actor-can-move.condition.json",
        "exit-is-unblocked.condition.json"
      ],
      "scopes": ["clear_directions.scope"]
    },
    "positioning": {
      "actions": ["turn_around.action.json", "get_close.action.json"]
    }
  },
  "checksums": {
    "core/actions/go.action.json": "sha256:...",
    "core/rules/go.rule.json": "sha256:..."
  }
}
```

## Implementation Steps

### Step 1: Create Backup Directory Structure
```bash
# Create timestamped backup directory
TIMESTAMP=$(date +%Y%m%d-%H%M%S)
BACKUP_DIR="backups/movement-migration-$TIMESTAMP"
mkdir -p "$BACKUP_DIR"/{core/{actions,rules,conditions,scopes},positioning/actions}

# Store backup directory path for later use
echo "$BACKUP_DIR" > .current-migration-backup
```

### Step 2: Backup Core Movement Files
```bash
# Backup actions
cp data/mods/core/actions/go.action.json "$BACKUP_DIR/core/actions/"

# Backup rules
cp data/mods/core/rules/go.rule.json "$BACKUP_DIR/core/rules/"

# Backup conditions
cp data/mods/core/conditions/event-is-action-go.condition.json "$BACKUP_DIR/core/conditions/"
cp data/mods/core/conditions/actor-can-move.condition.json "$BACKUP_DIR/core/conditions/"
cp data/mods/core/conditions/exit-is-unblocked.condition.json "$BACKUP_DIR/core/conditions/"

# Backup scopes
cp data/mods/core/scopes/clear_directions.scope "$BACKUP_DIR/core/scopes/"
```

### Step 3: Backup Affected Positioning Mod Files
```bash
# Backup positioning mod files that reference movement components
cp data/mods/positioning/actions/turn_around.action.json "$BACKUP_DIR/positioning/actions/"
cp data/mods/positioning/actions/get_close.action.json "$BACKUP_DIR/positioning/actions/"
```

### Step 4: Generate File Checksums
```bash
# Generate SHA256 checksums for integrity verification
cd "$BACKUP_DIR"
find . -type f -name "*.json" -o -name "*.scope" | while read file; do
  sha256sum "$file"
done > checksums.txt
```

### Step 5: Document Current Dependencies
```json
// Location: backups/movement-migration-[timestamp]/dependency-map.json
{
  "timestamp": "2024-01-XX-HHMMSS",
  "dependencies": {
    "core:go": {
      "referencedBy": [],
      "references": [
        "core:clear_directions",
        "core:actor-can-move"
      ]
    },
    "core:actor-can-move": {
      "referencedBy": [
        "core:go",
        "core:follow",
        "positioning:turn_around",
        "positioning:get_close"
      ],
      "references": []
    },
    "core:exit-is-unblocked": {
      "referencedBy": [
        "core:clear_directions"
      ],
      "references": []
    },
    "core:clear_directions": {
      "referencedBy": [
        "core:go"
      ],
      "references": [
        "core:exit-is-unblocked"
      ]
    },
    "core:event-is-action-go": {
      "referencedBy": [
        "core:handle_go_action"
      ],
      "references": []
    }
  }
}
```

### Step 6: Create Rollback Script
```bash
#!/bin/bash
# Location: backups/movement-migration-[timestamp]/rollback.sh

echo "Movement Migration Rollback Script"
echo "==================================="

# Check if backup directory exists
if [ ! -d "$1" ]; then
  echo "Error: Backup directory $1 not found"
  exit 1
fi

BACKUP_DIR="$1"

echo "Rolling back from backup: $BACKUP_DIR"

# Restore core files
echo "Restoring core mod files..."
cp "$BACKUP_DIR/core/actions/"*.json data/mods/core/actions/
cp "$BACKUP_DIR/core/rules/"*.json data/mods/core/rules/
cp "$BACKUP_DIR/core/conditions/"*.json data/mods/core/conditions/
cp "$BACKUP_DIR/core/scopes/"*.scope data/mods/core/scopes/

# Restore positioning files
echo "Restoring positioning mod files..."
cp "$BACKUP_DIR/positioning/actions/"*.json data/mods/positioning/actions/

# Remove movement mod files if they exist
echo "Cleaning movement mod..."
rm -f data/mods/movement/actions/go.action.json
rm -f data/mods/movement/rules/go.rule.json
rm -f data/mods/movement/conditions/*.json
rm -f data/mods/movement/scopes/*.scope

echo "Rollback complete!"
```

### Step 7: Create Migration Documentation
```markdown
// Location: docs/migrations/movement-mod-migration.md
# Movement Mod Migration Documentation

## Migration ID: MOVMODMIG-2024-01

### Overview
Migration of movement-related functionality from core mod to dedicated movement mod.

### Pre-Migration State
- **Date**: [Timestamp]
- **Core Version**: [Version]
- **Files Affected**: 6 core files, 2 positioning files

### Files Being Migrated
1. `core:go` → `movement:go`
2. `core:actor-can-move` → `movement:actor-can-move`
3. `core:exit-is-unblocked` → `movement:exit-is-unblocked`
4. `core:clear_directions` → `movement:clear_directions`
5. `core:event-is-action-go` → `movement:event-is-action-go`
6. `core:handle_go_action` → `movement:handle_go_action`

### Backup Location
`backups/movement-migration-[timestamp]/`

### Rollback Procedure
Execute: `./backups/movement-migration-[timestamp]/rollback.sh [backup-dir]`
```

## Validation Criteria

### Backup Completeness
- [ ] All 6 core movement files backed up
- [ ] Both positioning mod files backed up
- [ ] Checksums generated for all files
- [ ] Metadata file created with timestamps

### Documentation Quality
- [ ] Dependency map accurately reflects current state
- [ ] Migration documentation is comprehensive
- [ ] Rollback script is executable and tested

### Integrity Verification
- [ ] All backed up files are readable
- [ ] JSON files validate against their schemas
- [ ] Scope files have correct syntax

## Testing Requirements

### Backup Verification Tests
```javascript
// Location: tests/unit/migrations/backupVerification.test.js
describe('Migration Backup Verification', () => {
  it('should have all required files in backup', () => {
    // Verify file count and locations
  });

  it('should have valid checksums', () => {
    // Verify checksum integrity
  });

  it('should have complete metadata', () => {
    // Verify metadata completeness
  });
});
```

### Rollback Testing
```javascript
// Location: tests/integration/migrations/rollbackTest.test.js
describe('Migration Rollback', () => {
  it('should successfully restore all files', () => {
    // Test rollback script execution
  });

  it('should restore correct file versions', () => {
    // Verify file contents after rollback
  });
});
```

## Risk Assessment

### Risks
1. **Data Loss**: Files could be corrupted during backup
2. **Incomplete Backup**: Some dependencies might be missed
3. **Rollback Failure**: Script might fail due to permissions

### Mitigation
1. Verify checksums immediately after backup
2. Use dependency analysis from MOVMODMIG-003
3. Test rollback script in development environment

## Dependencies
- **Requires**: MOVMODMIG-001 (infrastructure must exist)
- **Enables**: MOVMODMIG-003, MOVMODMIG-004, MOVMODMIG-005

## Estimated Effort
**Story Points**: 3
**Time Estimate**: 2-3 hours

## Acceptance Criteria
- [ ] All movement files backed up with checksums
- [ ] Dependency map accurately documents relationships
- [ ] Rollback script successfully tested
- [ ] Migration documentation complete
- [ ] Backup metadata includes all required information
- [ ] Timestamp format consistent (YYYYMMDD-HHMMSS)
- [ ] All file paths use forward slashes

## Notes
- Backups should be retained until at least 2 versions after migration
- Consider creating automated backup verification
- Rollback script should be tested before actual migration begins