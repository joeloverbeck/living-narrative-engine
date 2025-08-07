# INTMIG-002: Batch 1 - Kissing Actions Migration (CORRECTED)

## Overview

Migrate the first batch of kissing-related intimacy actions from the legacy `scope` format to the new `targets` format. This batch focuses on actions that involve kissing mechanics, ensuring consistent migration patterns for similar actions.

## Priority

**HIGH** - First migration batch, establishes patterns for subsequent batches

## Dependencies

- **Blocked by**: INTMIG-001 (Migration Planning and Preparation) - COMPLETED
- **Enables**: Validation of migration approach for remaining batches
- **Related**: INTMIG-003 through INTMIG-005 (can run in parallel after this validates approach)

## Actions in This Batch

**Note**: The workflow tracking document lists 11 kissing actions for Batch 1, but only 8 were detailed in the original workflow. Here's the complete list:

| Action File                             | Current Scope                                     | Migration Complexity |
| --------------------------------------- | ------------------------------------------------- | -------------------- |
| `accept_kiss_passively.action.json`     | `intimacy:current_kissing_partner`               | Simple               |
| `break_kiss_gently.action.json`         | `intimacy:current_kissing_partner`               | Simple               |
| `cup_face_while_kissing.action.json`    | `intimacy:current_kissing_partner`               | Simple               |
| `explore_mouth_with_tongue.action.json` | `intimacy:current_kissing_partner`               | Simple               |
| `kiss_back_passionately.action.json`    | `intimacy:current_kissing_partner`               | Simple               |
| `lean_in_for_deep_kiss.action.json`     | `intimacy:actors_with_mouth_facing_each_other`   | Simple               |
| `nibble_lower_lip.action.json`          | `intimacy:current_kissing_partner`               | Simple               |
| `peck_on_lips.action.json`              | `intimacy:actors_with_mouth_facing_each_other`   | Simple               |
| `pull_back_breathlessly.action.json`    | `intimacy:current_kissing_partner`               | Simple               |
| `pull_back_in_revulsion.action.json`    | `intimacy:current_kissing_partner`               | Simple               |
| `suck_on_tongue.action.json`            | `intimacy:current_kissing_partner`               | Simple               |

## Important Corrections

### 1. File Content Discrepancies
The actual files have different content than shown in the original workflow:
- Files include prerequisites in some cases (e.g., `accept_kiss_passively` has a prerequisite checking if actor is kiss receiver)
- Templates and descriptions may vary from what was shown
- Some files have `forbidden_components` (e.g., `lean_in_for_deep_kiss`)

### 2. Configuration File Name
- **Incorrect**: `config/action-trace-config.json`
- **Correct**: `config/trace-config.json`

### 3. NPM Scripts
- **Missing**: `npm run validate:schemas` does not exist
- **Alternative**: Use direct validation with the validation scripts or schema validation utilities in the codebase

### 4. AJV CLI Tool
- **Issue**: `npx ajv` is not directly available as a CLI tool
- **Alternative**: Use the project's built-in schema validation through the test suite or validation scripts

## Acceptance Criteria

- [ ] All 11 kissing actions migrated to `targets` format
- [ ] No action file contains both `scope` and `targets` properties
- [ ] All migrated actions pass schema validation
- [ ] Existing rules for kissing actions continue to work
- [ ] Action discovery correctly identifies migrated actions
- [ ] UI displays migrated actions correctly
- [ ] Action execution traces validate successfully (if tracing enabled)
- [ ] Unit tests for action-related functionality pass
- [ ] Integration tests involving action discovery pass
- [ ] Migration tracking document updated

## Implementation Steps

### Step 1: Pre-Migration Verification

**1.1 Verify backup exists**

```bash
# Check that INTMIG-001 backup was created
ls -la backups/intmig-*/actions/*.action.json | grep -E "(accept_kiss|break_kiss|cup_face|explore_mouth|kiss_back|lean_in|nibble_lower|peck_on|pull_back|suck_on)" | wc -l
# Expected output: 11
```

**1.2 Run pre-migration validation**

```bash
# Verify current state (should show all using 'scope')
node scripts/validate-intmig-migration.js 2>&1 | grep -E "(accept_kiss|break_kiss|cup_face|explore_mouth|kiss_back|lean_in|nibble_lower|peck_on|pull_back|suck_on)"
```

**1.3 Check action tracing configuration**

```bash
# Ensure tracing is configured for intimacy actions
cat config/trace-config.json | grep '"intimacy:\*"'
# Should show: "tracedActions": ["intimacy:*"]
```

### Step 2-12: Migrate Each Action File

For each action file, follow this pattern:

**2.1 Read current content**
```bash
cat data/mods/intimacy/actions/[ACTION_NAME].action.json
```

**2.2 Perform migration**
```bash
# Replace 'scope' with 'targets' while preserving the rest of the file
sed -i 's/"scope": "\([^"]*\)"/"targets": "\1"/' \
  data/mods/intimacy/actions/[ACTION_NAME].action.json
```

**2.3 Verify migration**
```bash
# Check the file was updated correctly
grep -E '("scope"|"targets")' data/mods/intimacy/actions/[ACTION_NAME].action.json
# Should only show: "targets": "[scope_value]"
```

**2.4 Validate against schema**
```bash
# Run the project's schema validation
node scripts/validate-intmig-migration.js --file data/mods/intimacy/actions/[ACTION_NAME].action.json
```

Apply this pattern to all 11 files:
1. `accept_kiss_passively.action.json`
2. `break_kiss_gently.action.json`
3. `cup_face_while_kissing.action.json`
4. `explore_mouth_with_tongue.action.json`
5. `kiss_back_passionately.action.json`
6. `lean_in_for_deep_kiss.action.json`
7. `nibble_lower_lip.action.json`
8. `peck_on_lips.action.json`
9. `pull_back_breathlessly.action.json`
10. `pull_back_in_revulsion.action.json`
11. `suck_on_tongue.action.json`

### Step 13: Batch Validation

**13.1 Verify all migrations**

```bash
# Check that no 'scope' properties remain in migrated files
for action in accept_kiss_passively break_kiss_gently cup_face_while_kissing \
             explore_mouth_with_tongue kiss_back_passionately lean_in_for_deep_kiss \
             nibble_lower_lip peck_on_lips pull_back_breathlessly \
             pull_back_in_revulsion suck_on_tongue; do
  echo "Checking $action..."
  grep -l '"scope"' "data/mods/intimacy/actions/${action}.action.json" && echo "ERROR: scope found!" || echo "✓ Migrated"
done
```

**13.2 Run migration validator**

```bash
# This should show 11 actions successfully migrated
node scripts/validate-intmig-migration.js | grep -A20 "Migration Validation Report"
```

**13.3 Validate action traces (if enabled)**

```bash
node scripts/validate-action-traces.js
```

## Testing Requirements

### Unit Testing

**Test action discovery and schema validation**

```bash
# Run unit tests with coverage
npm run test:unit -- --testPathPattern="action" --coverage
```

### Integration Testing

**Test action discovery integration**

```bash
# Run integration tests focusing on action discovery
npm run test:integration -- --testPathPattern="actionDiscovery"
```

### Manual Testing

1. **Start the application**

   ```bash
   npm run dev
   ```

2. **Test action discovery**
   - Open browser console
   - Check that kissing actions appear in action list
   - Verify scope resolution works correctly

3. **Test action execution**
   - Trigger a kissing action
   - Verify event payload structure
   - Check trace output (if tracing enabled)

4. **Validate traces**
   ```bash
   node scripts/validate-action-traces.js
   ```

## Rollback Procedure

If any issues are encountered:

### Immediate Rollback (before commit)

```bash
# Revert all kissing action files
for action in accept_kiss_passively break_kiss_gently cup_face_while_kissing \
             explore_mouth_with_tongue kiss_back_passionately lean_in_for_deep_kiss \
             nibble_lower_lip peck_on_lips pull_back_breathlessly \
             pull_back_in_revulsion suck_on_tongue; do
  git checkout -- "data/mods/intimacy/actions/${action}.action.json"
done
```

### Restore from Backup

```bash
# Use the rollback script
./scripts/rollback-intmig-migration.sh

# Or manually restore specific files
BACKUP_DIR=$(ls -t backups/intmig-* | head -1)

for action in accept_kiss_passively break_kiss_gently cup_face_while_kissing \
             explore_mouth_with_tongue kiss_back_passionately lean_in_for_deep_kiss \
             nibble_lower_lip peck_on_lips pull_back_breathlessly \
             pull_back_in_revulsion suck_on_tongue; do
  cp "$BACKUP_DIR/actions/${action}.action.json" "data/mods/intimacy/actions/"
done
```

## Migration Tracking Update

Update `workflows/INTMIG-tracking.md`:

```markdown
| intimacy:accept_kiss_passively | ... | targets | ✅ Migrated | ✅ | ✅ | Batch 1 |
| intimacy:break_kiss_gently | ... | targets | ✅ Migrated | ✅ | ✅ | Batch 1 |
| intimacy:cup_face_while_kissing | ... | targets | ✅ Migrated | ✅ | ✅ | Batch 1 |
| intimacy:explore_mouth_with_tongue | ... | targets | ✅ Migrated | ✅ | ✅ | Batch 1 |
| intimacy:kiss_back_passionately | ... | targets | ✅ Migrated | ✅ | ✅ | Batch 1 |
| intimacy:lean_in_for_deep_kiss | ... | targets | ✅ Migrated | ✅ | ✅ | Batch 1 |
| intimacy:nibble_lower_lip | ... | targets | ✅ Migrated | ✅ | ✅ | Batch 1 |
| intimacy:peck_on_lips | ... | targets | ✅ Migrated | ✅ | ✅ | Batch 1 |
| intimacy:pull_back_breathlessly | ... | targets | ✅ Migrated | ✅ | ✅ | Batch 1 |
| intimacy:pull_back_in_revulsion | ... | targets | ✅ Migrated | ✅ | ✅ | Batch 1 |
| intimacy:suck_on_tongue | ... | targets | ✅ Migrated | ✅ | ✅ | Batch 1 |
```

## Completion Checklist

- [ ] All 11 kissing actions migrated
- [ ] No files contain 'scope' property
- [ ] All files contain 'targets' property
- [ ] Schema validation passes for all files
- [ ] Unit tests pass
- [ ] Integration tests pass
- [ ] Manual testing completed
- [ ] Action traces validated (if tracing enabled)
- [ ] Tracking document updated
- [ ] Git commit created with appropriate message

## Git Commands

```bash
# Stage the migrated files
git add data/mods/intimacy/actions/accept_kiss_passively.action.json
git add data/mods/intimacy/actions/break_kiss_gently.action.json
git add data/mods/intimacy/actions/cup_face_while_kissing.action.json
git add data/mods/intimacy/actions/explore_mouth_with_tongue.action.json
git add data/mods/intimacy/actions/kiss_back_passionately.action.json
git add data/mods/intimacy/actions/lean_in_for_deep_kiss.action.json
git add data/mods/intimacy/actions/nibble_lower_lip.action.json
git add data/mods/intimacy/actions/peck_on_lips.action.json
git add data/mods/intimacy/actions/pull_back_breathlessly.action.json
git add data/mods/intimacy/actions/pull_back_in_revulsion.action.json
git add data/mods/intimacy/actions/suck_on_tongue.action.json

# Update tracking document
git add workflows/INTMIG-tracking.md

# Commit with descriptive message
git commit -m "feat(intimacy): migrate batch 1 kissing actions to targets format

- Migrated 11 kissing-related actions from 'scope' to 'targets' format
- Actions use either intimacy:current_kissing_partner or intimacy:actors_with_mouth_facing_each_other scopes
- Maintains backward compatibility with existing rules
- Part of INTMIG-002 batch migration"
```

## Notes and Corrections Summary

### Key Corrections Made:
1. **File count**: Corrected from 8 to 11 actions based on tracking document
2. **Additional actions**: Added `lean_in_for_deep_kiss`, `peck_on_lips`, and `pull_back_in_revulsion`
3. **Different scopes**: Some actions use `intimacy:actors_with_mouth_facing_each_other` instead of `intimacy:current_kissing_partner`
4. **Config file name**: Corrected from `action-trace-config.json` to `trace-config.json`
5. **Validation approach**: Removed direct `npx ajv` usage in favor of project scripts
6. **File content**: Noted that actual files have prerequisites and forbidden_components not shown in original workflow
7. **NPM scripts**: Removed reference to non-existent `validate:schemas` script

### Important Considerations:
- The actual action files contain more complex structures than shown in the original workflow examples
- Some actions have prerequisites that need to be preserved during migration
- The schema supports both `scope` (deprecated) and `targets` formats, but not both in the same file
- The migration is a simple string replacement of the property name, preserving the value