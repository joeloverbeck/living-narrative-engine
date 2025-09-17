# MOVMODMIG-010: Cleanup and Production Deployment

## Overview
Final cleanup of migrated files from core mod, production deployment of movement mod, and post-migration validation to ensure successful migration completion.

## Current State
- **Movement Mod**: Fully migrated and tested
- **Core Mod**: Still contains original movement files
- **Compatibility Layer**: Active
- **Documentation**: Migration complete but not finalized

## Objectives
1. Remove migrated files from core mod
2. Clean up backup files (after verification)
3. Update all documentation
4. Deploy to production
5. Monitor post-deployment
6. Archive migration artifacts

## Technical Requirements

### Files to Remove from Core
```bash
# Files to delete from core mod
data/mods/core/actions/go.action.json
data/mods/core/rules/go.rule.json
data/mods/core/conditions/event-is-action-go.condition.json
data/mods/core/conditions/actor-can-move.condition.json
data/mods/core/conditions/exit-is-unblocked.condition.json
data/mods/core/scopes/clear_directions.scope
```

### Core Mod Manifest Update
```json
// Remove from data/mods/core/mod-manifest.json
{
  "content": {
    "actions": [
      // Remove: "movement:go"
    ],
    "rules": [
      // Remove: "handle_go_action"
    ],
    "conditions": [
      // Remove: "core:event-is-action-go"
      // Remove: "core:actor-can-move"
      // Remove: "core:exit-is-unblocked"
    ],
    "scopes": [
      // Remove: "core:clear_directions"
    ]
  }
}
```

## Implementation Steps

### Step 1: Final Validation
```bash
# Verify movement mod is fully functional
npm run test:integration -- --testPathPattern="movement"

# Verify cross-mod references work
npm run test:integration -- --testPathPattern="crossMod"

# Run full test suite
npm run test:ci
```

### Step 2: Remove Core Files
```bash
#!/bin/bash
# Location: scripts/cleanup-movement-migration.sh

echo "Removing migrated files from core mod..."

# Remove action
rm -f data/mods/core/actions/go.action.json

# Remove rule
rm -f data/mods/core/rules/go.rule.json

# Remove conditions
rm -f data/mods/core/conditions/event-is-action-go.condition.json
rm -f data/mods/core/conditions/actor-can-move.condition.json
rm -f data/mods/core/conditions/exit-is-unblocked.condition.json

# Remove scope
rm -f data/mods/core/scopes/clear_directions.scope

echo "Files removed successfully"
```

### Step 3: Update Core Manifest
```javascript
// Update core mod manifest
const updateCoreManifest = () => {
  const manifestPath = 'data/mods/core/mod-manifest.json';
  const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));

  // Remove movement-related content
  manifest.content.actions = manifest.content.actions.filter(
    id => !['movement:go'].includes(id)
  );

  manifest.content.rules = manifest.content.rules.filter(
    id => id !== 'handle_go_action'
  );

  manifest.content.conditions = manifest.content.conditions.filter(
    id => ![
      'core:event-is-action-go',
      'core:actor-can-move',
      'core:exit-is-unblocked'
    ].includes(id)
  );

  manifest.content.scopes = manifest.content.scopes.filter(
    id => id !== 'core:clear_directions'
  );

  // Update version
  manifest.version = incrementMinorVersion(manifest.version);

  fs.writeFileSync(manifestPath, JSON.stringify(manifest, null, 2));
};
```

### Step 4: Archive Backups
```bash
# Archive backup files
BACKUP_DIR=$(cat .current-migration-backup)
tar -czf "archives/movement-migration-backup-$(date +%Y%m%d).tar.gz" "$BACKUP_DIR"

# Keep backup for 30 days, then remove
echo "$BACKUP_DIR" >> .backup-cleanup-schedule
```

### Step 5: Update Documentation
```markdown
// Update: README.md
## Mod Structure

### Movement Mod
The movement mod provides all spatial navigation mechanics:
- Go action with Explorer Cyan theme
- Movement validation conditions
- Direction scoping
- Movement event handling

### Core Mod Changes (v2.0.0)
- Movement mechanics migrated to dedicated movement mod
- Use `movement:*` namespace for all movement components
- Positioning mod now depends on movement mod
```

### Step 6: Create Release Notes
```markdown
// Location: CHANGELOG.md
## [2.0.0] - 2024-XX-XX

### Breaking Changes
- Movement components migrated from core to movement mod
- Namespace changed from `core:*` to `movement:*` for:
  - `go` action
  - `actor-can-move` condition
  - `exit-is-unblocked` condition
  - `clear_directions` scope
  - `event-is-action-go` condition

### Migration Guide
- Update all references from `core:` to `movement:` namespace
- Add `movement` to mod dependencies if using movement features
- Compatibility layer available until v3.0.0

### Visual Changes
- Go action now uses Explorer Cyan theme (#006064)
- Improved WCAG compliance (AAA normal, AA hover)
```

### Step 7: Deploy to Production
```bash
#!/bin/bash
# Production deployment script

echo "Deploying movement mod to production..."

# 1. Tag the release
git tag -a "v2.0.0-movement-migration" -m "Movement mod migration complete"

# 2. Run final tests
npm run test:ci || exit 1

# 3. Build production bundle
npm run build:production || exit 1

# 4. Deploy
npm run deploy:production

# 5. Verify deployment
npm run verify:production

echo "Deployment complete!"
```

### Step 8: Post-Deployment Monitoring
```javascript
// Monitoring configuration
const monitoringConfig = {
  alerts: [
    {
      metric: 'movement_mod_load_failure',
      threshold: 0.01, // 1% failure rate
      action: 'page_oncall'
    },
    {
      metric: 'missing_movement_reference',
      threshold: 1,
      action: 'log_and_alert'
    }
  ],
  dashboards: [
    'movement_mod_performance',
    'cross_mod_communication',
    'error_rates'
  ]
};
```

## Validation Criteria

### Pre-Deployment
- [ ] All tests passing
- [ ] No references to old namespaces
- [ ] Backup verified and archived
- [ ] Documentation updated

### Deployment
- [ ] Files removed from core
- [ ] Manifests updated
- [ ] Version tags created
- [ ] Production build successful

### Post-Deployment
- [ ] Movement mod loads correctly
- [ ] No errors in production logs
- [ ] Performance metrics normal
- [ ] Compatibility layer working

## Rollback Plan
```bash
#!/bin/bash
# Emergency rollback procedure

echo "EMERGENCY ROLLBACK - Movement Migration"

# 1. Restore backup
BACKUP_DIR=$(cat .current-migration-backup)
./rollback.sh "$BACKUP_DIR"

# 2. Revert manifest changes
git checkout HEAD~1 -- data/mods/core/mod-manifest.json
git checkout HEAD~1 -- data/mods/movement/mod-manifest.json

# 3. Restart services
npm run restart:production

# 4. Verify rollback
npm run verify:rollback

echo "Rollback complete - investigate issues before retry"
```

## Risk Assessment

### Risks
1. **Missing References**: Some references might be missed
2. **Production Issues**: Unexpected behavior in production
3. **Performance Impact**: Movement might be slower

### Mitigation
1. Compatibility layer provides safety net
2. Staged rollout with monitoring
3. Quick rollback procedure ready

## Dependencies
- **Requires**: MOVMODMIG-009 (all validation complete)
- **Blocks**: None (final ticket)

## Estimated Effort
**Story Points**: 3
**Time Estimate**: 2-3 hours

## Acceptance Criteria
- [ ] Core files removed successfully
- [ ] Manifests updated correctly
- [ ] Documentation complete
- [ ] Release notes published
- [ ] Production deployment successful
- [ ] Monitoring active
- [ ] No production issues
- [ ] Backup archived
- [ ] Migration marked complete

## Notes
- Keep compatibility layer for at least 2 versions
- Monitor deprecation warnings to track adoption
- Consider automated migration for other mods in future
- Document lessons learned for next migration