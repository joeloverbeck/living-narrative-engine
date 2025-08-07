# INTMIG-002: Batch 1 - Kissing Actions Migration

## Overview

Migrate the first batch of 8 kissing-related intimacy actions from the legacy `scope` format to the new `targets` format. This batch focuses on actions that involve the `intimacy:current_kissing_partner` scope, ensuring consistent migration patterns for similar actions.

## Priority

**HIGH** - First migration batch, establishes patterns for subsequent batches

## Dependencies

- **Blocked by**: INTMIG-001 (Migration Planning and Preparation)
- **Enables**: Validation of migration approach for remaining batches
- **Related**: INTMIG-003 through INTMIG-005 (can run in parallel after this validates approach)

## Actions in This Batch

| Action File                             | Current Scope                      | Migration Complexity |
| --------------------------------------- | ---------------------------------- | -------------------- |
| `accept_kiss_passively.action.json`     | `intimacy:current_kissing_partner` | Simple               |
| `break_kiss_gently.action.json`         | `intimacy:current_kissing_partner` | Simple               |
| `cup_face_while_kissing.action.json`    | `intimacy:current_kissing_partner` | Simple               |
| `explore_mouth_with_tongue.action.json` | `intimacy:current_kissing_partner` | Simple               |
| `kiss_back_passionately.action.json`    | `intimacy:current_kissing_partner` | Simple               |
| `nibble_lower_lip.action.json`          | `intimacy:current_kissing_partner` | Simple               |
| `pull_back_breathlessly.action.json`    | `intimacy:current_kissing_partner` | Simple               |
| `suck_on_tongue.action.json`            | `intimacy:current_kissing_partner` | Simple               |

## Acceptance Criteria

- [ ] All 8 kissing actions migrated to `targets` format
- [ ] No action file contains both `scope` and `targets` properties
- [ ] All migrated actions pass schema validation
- [ ] Existing rules for kissing actions continue to work
- [ ] Action discovery correctly identifies migrated actions
- [ ] UI displays migrated actions correctly
- [ ] Action execution traces validate successfully
- [ ] Unit tests for kissing actions pass
- [ ] Integration tests involving kissing actions pass
- [ ] Migration tracking document updated

## Implementation Steps

### Step 1: Pre-Migration Verification

**1.1 Verify backup exists**

```bash
# Check that INTMIG-001 backup was created
ls -la backups/intmig-*/actions/*.action.json | grep -E "(accept_kiss|break_kiss|cup_face|explore_mouth|kiss_back|nibble_lower|pull_back|suck_on)" | wc -l
# Expected output: 8
```

**1.2 Run pre-migration validation**

```bash
# Verify current state (should show all using 'scope')
node scripts/validate-intmig-migration.js 2>&1 | grep -E "(accept_kiss|break_kiss|cup_face|explore_mouth|kiss_back|nibble_lower|pull_back|suck_on)"
```

**1.3 Enable action tracing**

```bash
# Ensure tracing is configured for intimacy actions
cat config/action-trace-config.json | grep "intimacy:\\*"
```

### Step 2: Migrate accept_kiss_passively.action.json

**2.1 Current file content**

```json
{
  "$schema": "schema://living-narrative-engine/action.schema.json",
  "id": "intimacy:accept_kiss_passively",
  "name": "Accept Kiss Passively",
  "description": "Accept the kiss without actively participating, remaining passive but receptive.",
  "scope": "intimacy:current_kissing_partner",
  "required_components": {
    "actor": ["intimacy:kissing"]
  },
  "forbidden_components": {},
  "template": "accept {target}'s kiss passively",
  "prerequisites": []
}
```

**2.2 Migration command**

```bash
# Update the file
sed -i 's/"scope": "intimacy:current_kissing_partner"/"targets": "intimacy:current_kissing_partner"/' \
  data/mods/intimacy/actions/accept_kiss_passively.action.json
```

**2.3 Verify migration**

```bash
# Check the file was updated correctly
grep -E '("scope"|"targets")' data/mods/intimacy/actions/accept_kiss_passively.action.json
# Should only show: "targets": "intimacy:current_kissing_partner"
```

**2.4 Validate schema**

```bash
npx ajv validate -s data/schemas/action.schema.json \
  -d data/mods/intimacy/actions/accept_kiss_passively.action.json
```

### Step 3: Migrate break_kiss_gently.action.json

**3.1 Current file content**

```json
{
  "$schema": "schema://living-narrative-engine/action.schema.json",
  "id": "intimacy:break_kiss_gently",
  "name": "Break Kiss Gently",
  "description": "Gently pull away from the kiss, ending it in a soft, considerate manner.",
  "scope": "intimacy:current_kissing_partner",
  "required_components": {
    "actor": ["intimacy:kissing"]
  },
  "forbidden_components": {},
  "template": "break kiss with {target} gently",
  "prerequisites": []
}
```

**3.2 Migration command**

```bash
sed -i 's/"scope": "intimacy:current_kissing_partner"/"targets": "intimacy:current_kissing_partner"/' \
  data/mods/intimacy/actions/break_kiss_gently.action.json
```

**3.3 Validate**

```bash
npx ajv validate -s data/schemas/action.schema.json \
  -d data/mods/intimacy/actions/break_kiss_gently.action.json
```

### Step 4: Migrate cup_face_while_kissing.action.json

**4.1 Migration command**

```bash
sed -i 's/"scope": "intimacy:current_kissing_partner"/"targets": "intimacy:current_kissing_partner"/' \
  data/mods/intimacy/actions/cup_face_while_kissing.action.json
```

**4.2 Validate**

```bash
npx ajv validate -s data/schemas/action.schema.json \
  -d data/mods/intimacy/actions/cup_face_while_kissing.action.json
```

### Step 5: Migrate explore_mouth_with_tongue.action.json

**5.1 Migration command**

```bash
sed -i 's/"scope": "intimacy:current_kissing_partner"/"targets": "intimacy:current_kissing_partner"/' \
  data/mods/intimacy/actions/explore_mouth_with_tongue.action.json
```

**5.2 Validate**

```bash
npx ajv validate -s data/schemas/action.schema.json \
  -d data/mods/intimacy/actions/explore_mouth_with_tongue.action.json
```

### Step 6: Migrate kiss_back_passionately.action.json

**6.1 Migration command**

```bash
sed -i 's/"scope": "intimacy:current_kissing_partner"/"targets": "intimacy:current_kissing_partner"/' \
  data/mods/intimacy/actions/kiss_back_passionately.action.json
```

**6.2 Validate**

```bash
npx ajv validate -s data/schemas/action.schema.json \
  -d data/mods/intimacy/actions/kiss_back_passionately.action.json
```

### Step 7: Migrate nibble_lower_lip.action.json

**7.1 Migration command**

```bash
sed -i 's/"scope": "intimacy:current_kissing_partner"/"targets": "intimacy:current_kissing_partner"/' \
  data/mods/intimacy/actions/nibble_lower_lip.action.json
```

**7.2 Validate**

```bash
npx ajv validate -s data/schemas/action.schema.json \
  -d data/mods/intimacy/actions/nibble_lower_lip.action.json
```

### Step 8: Migrate pull_back_breathlessly.action.json

**8.1 Migration command**

```bash
sed -i 's/"scope": "intimacy:current_kissing_partner"/"targets": "intimacy:current_kissing_partner"/' \
  data/mods/intimacy/actions/pull_back_breathlessly.action.json
```

**8.2 Validate**

```bash
npx ajv validate -s data/schemas/action.schema.json \
  -d data/mods/intimacy/actions/pull_back_breathlessly.action.json
```

### Step 9: Migrate suck_on_tongue.action.json

**9.1 Migration command**

```bash
sed -i 's/"scope": "intimacy:current_kissing_partner"/"targets": "intimacy:current_kissing_partner"/' \
  data/mods/intimacy/actions/suck_on_tongue.action.json
```

**9.2 Validate**

```bash
npx ajv validate -s data/schemas/action.schema.json \
  -d data/mods/intimacy/actions/suck_on_tongue.action.json
```

### Step 10: Batch Validation

**10.1 Verify all migrations**

```bash
# Check that no 'scope' properties remain in migrated files
for action in accept_kiss_passively break_kiss_gently cup_face_while_kissing \
             explore_mouth_with_tongue kiss_back_passionately nibble_lower_lip \
             pull_back_breathlessly suck_on_tongue; do
  echo "Checking $action..."
  grep -l '"scope"' "data/mods/intimacy/actions/${action}.action.json" && echo "ERROR: scope found!" || echo "✓ Migrated"
done
```

**10.2 Run migration validator**

```bash
# This should show 8 actions successfully migrated
node scripts/validate-intmig-migration.js | grep -A20 "Migration Validation Report"
```

**10.3 Schema validation for all files**

```bash
npm run validate:schemas -- --filter="intimacy/actions"
```

## Testing Requirements

### Unit Testing

**Test kissing action discovery**

```bash
npm run test:unit -- --testPathPattern="actionDiscovery" --testNamePattern="intimacy.*kiss"
```

**Test action schema validation**

```bash
npm run test:unit -- --testPathPattern="schema.*validation" --testNamePattern="action.*targets"
```

### Integration Testing

**Test kissing rules execution**

```bash
npm run test:integration -- --testPathPattern="rules.*intimacy" --testNamePattern="kissing"
```

**Test event handling**

```bash
npm run test:integration -- --testPathPattern="action.*execution" --testNamePattern="kiss"
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
   - Check action trace output

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
             explore_mouth_with_tongue kiss_back_passionately nibble_lower_lip \
             pull_back_breathlessly suck_on_tongue; do
  git checkout -- "data/mods/intimacy/actions/${action}.action.json"
done
```

### Restore from Backup

```bash
# Find the backup directory
BACKUP_DIR=$(ls -t backups/intmig-* | head -1)

# Restore specific files
for action in accept_kiss_passively break_kiss_gently cup_face_while_kissing \
             explore_mouth_with_tongue kiss_back_passionately nibble_lower_lip \
             pull_back_breathlessly suck_on_tongue; do
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
| intimacy:nibble_lower_lip | ... | targets | ✅ Migrated | ✅ | ✅ | Batch 1 |
| intimacy:pull_back_breathlessly | ... | targets | ✅ Migrated | ✅ | ✅ | Batch 1 |
| intimacy:suck_on_tongue | ... | targets | ✅ Migrated | ✅ | ✅ | Batch 1 |
```

## Completion Checklist

- [ ] All 8 kissing actions migrated
- [ ] No files contain 'scope' property
- [ ] All files contain 'targets' property
- [ ] Schema validation passes for all files
- [ ] Unit tests pass
- [ ] Integration tests pass
- [ ] Manual testing completed
- [ ] Action traces validated
- [ ] Tracking document updated
- [ ] Git commit created with message: "feat(intimacy): migrate batch 1 kissing actions to targets format"

## Git Commands

```bash
# Stage the migrated files
git add data/mods/intimacy/actions/accept_kiss_passively.action.json
git add data/mods/intimacy/actions/break_kiss_gently.action.json
git add data/mods/intimacy/actions/cup_face_while_kissing.action.json
git add data/mods/intimacy/actions/explore_mouth_with_tongue.action.json
git add data/mods/intimacy/actions/kiss_back_passionately.action.json
git add data/mods/intimacy/actions/nibble_lower_lip.action.json
git add data/mods/intimacy/actions/pull_back_breathlessly.action.json
git add data/mods/intimacy/actions/suck_on_tongue.action.json

# Commit with descriptive message
git commit -m "feat(intimacy): migrate batch 1 kissing actions to targets format

- Migrated 8 kissing-related actions from 'scope' to 'targets' format
- All actions using intimacy:current_kissing_partner scope
- Maintains backward compatibility with existing rules
- Part of INTMIG-002 batch migration"
```

## Notes

- All 8 actions in this batch use the same scope, making migration straightforward
- The string format for `targets` is used for consistency with single-target actions
- No rule changes are required as the event payload structure remains the same
- This batch establishes the migration pattern for remaining batches
