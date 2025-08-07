# INTMIG-005: Batch 4 - Remaining Actions Migration

## Overview

Migrate the final batch of 4 remaining intimacy actions from the legacy `scope` format to the new `targets` format. This batch includes massage actions and miscellaneous intimate interactions, completing the migration of all 24 actions.

## Priority

**HIGH** - Final migration batch, completes the action migration phase

## Dependencies

- **Blocked by**: INTMIG-001 (Migration Planning and Preparation)
- **Can run parallel with**: INTMIG-003, INTMIG-004 (after INTMIG-002 validates approach)
- **Enables**: INTMIG-006 (Schema Validation and Testing)

## Actions in This Batch

| Action File                          | Current Scope                                                  | Template                               | Category      |
| ------------------------------------ | -------------------------------------------------------------- | -------------------------------------- | ------------- |
| `massage_back.action.json`           | `intimacy:close_actors_facing_away`                            | `massage {target}'s back`              | Massage       |
| `massage_shoulders.action.json`      | `intimacy:actors_with_arms_facing_each_other_or_behind_target` | `massage {target}'s shoulders`         | Massage       |
| `peck_on_lips.action.json`           | `intimacy:close_actors_facing_each_other`                      | `peck {target} on the lips`            | Kiss variant  |
| `pull_back_in_revulsion.action.json` | `intimacy:current_kissing_partner`                             | `pull back from {target} in revulsion` | Kiss reaction |

## Acceptance Criteria

- [ ] All 4 remaining actions migrated to `targets` format
- [ ] No action file contains both `scope` and `targets` properties
- [ ] All migrated actions pass schema validation
- [ ] Massage actions work with correct positioning
- [ ] Kiss-related actions maintain proper context
- [ ] All 24 intimacy actions now use `targets` format (except adjust_clothing)
- [ ] Existing rules continue to work
- [ ] Action discovery correctly identifies all migrated actions
- [ ] UI displays migrated actions correctly
- [ ] Action execution traces validate successfully
- [ ] Unit tests pass
- [ ] Integration tests pass
- [ ] Migration tracking document shows 24/24 complete

## Implementation Steps

### Step 1: Pre-Migration Verification

**1.1 Confirm this completes the migration**

```bash
# Count total actions needing migration (should be 24)
ls -1 data/mods/intimacy/actions/*.action.json | grep -v adjust_clothing | wc -l
# Expected: 24

# Count already migrated in previous batches (8+5+7=20)
echo "Expected already migrated: 20"
echo "Remaining to migrate: 4"
```

**1.2 Verify unique scopes in this batch**

```bash
# Check the facing_away scope (unique to massage_back)
ls -la data/mods/intimacy/scopes/close_actors_facing_away.scope
```

**1.3 Document final batch**

```bash
# List the final 4 actions
for action in massage_back massage_shoulders peck_on_lips pull_back_in_revulsion; do
  echo "=== $action ==="
  jq '{id, scope}' "data/mods/intimacy/actions/${action}.action.json"
done
```

### Step 2: Migrate massage_back.action.json

**2.1 Current file content**

```json
{
  "$schema": "schema://living-narrative-engine/action.schema.json",
  "id": "intimacy:massage_back",
  "name": "Massage Back",
  "description": "Give the target a relaxing back massage.",
  "scope": "intimacy:close_actors_facing_away",
  "required_components": {
    "actor": ["positioning:closeness"]
  },
  "forbidden_components": {
    "actor": ["intimacy:kissing"]
  },
  "template": "massage {target}'s back",
  "prerequisites": []
}
```

**2.2 Migration command**

```bash
# Note: This uses facing_away positioning (unique requirement)
sed -i 's/"scope": "intimacy:close_actors_facing_away"/"targets": "intimacy:close_actors_facing_away"/' \
  data/mods/intimacy/actions/massage_back.action.json
```

**2.3 Validate unique positioning**

```bash
# Verify this is the only action requiring facing_away
grep -l "facing_away" data/mods/intimacy/actions/*.action.json
# Should only show massage_back.action.json
```

**2.4 Validate schema**

```bash
npx ajv validate -s data/schemas/action.schema.json \
  -d data/mods/intimacy/actions/massage_back.action.json
```

### Step 3: Migrate massage_shoulders.action.json

**3.1 Current file content**

```json
{
  "$schema": "schema://living-narrative-engine/action.schema.json",
  "id": "intimacy:massage_shoulders",
  "name": "Massage Shoulders",
  "description": "Massage the target's shoulders to help them relax.",
  "scope": "intimacy:actors_with_arms_facing_each_other_or_behind_target",
  "required_components": {
    "actor": ["positioning:closeness"]
  },
  "forbidden_components": {
    "actor": ["intimacy:kissing"]
  },
  "template": "massage {target}'s shoulders",
  "prerequisites": []
}
```

**3.2 Migration command**

```bash
sed -i 's/"scope": "intimacy:actors_with_arms_facing_each_other_or_behind_target"/"targets": "intimacy:actors_with_arms_facing_each_other_or_behind_target"/' \
  data/mods/intimacy/actions/massage_shoulders.action.json
```

**3.3 Validate**

```bash
npx ajv validate -s data/schemas/action.schema.json \
  -d data/mods/intimacy/actions/massage_shoulders.action.json
```

### Step 4: Migrate peck_on_lips.action.json

**4.1 Current file content**

```json
{
  "$schema": "schema://living-narrative-engine/action.schema.json",
  "id": "intimacy:peck_on_lips",
  "name": "Peck on Lips",
  "description": "Give the target a quick, light kiss on the lips.",
  "scope": "intimacy:close_actors_facing_each_other",
  "required_components": {
    "actor": ["positioning:closeness"]
  },
  "forbidden_components": {
    "actor": ["intimacy:kissing"]
  },
  "template": "peck {target} on the lips",
  "prerequisites": []
}
```

**4.2 Migration command**

```bash
sed -i 's/"scope": "intimacy:close_actors_facing_each_other"/"targets": "intimacy:close_actors_facing_each_other"/' \
  data/mods/intimacy/actions/peck_on_lips.action.json
```

**4.3 Validate**

```bash
npx ajv validate -s data/schemas/action.schema.json \
  -d data/mods/intimacy/actions/peck_on_lips.action.json
```

### Step 5: Migrate pull_back_in_revulsion.action.json

**5.1 Current file content**

```json
{
  "$schema": "schema://living-narrative-engine/action.schema.json",
  "id": "intimacy:pull_back_in_revulsion",
  "name": "Pull Back in Revulsion",
  "description": "Pull away from the kiss with visible disgust and revulsion.",
  "scope": "intimacy:current_kissing_partner",
  "required_components": {
    "actor": ["intimacy:kissing"]
  },
  "forbidden_components": {},
  "template": "pull back from {target} in revulsion",
  "prerequisites": []
}
```

**5.2 Migration command**

```bash
# This is a kiss reaction like others in batch 1
sed -i 's/"scope": "intimacy:current_kissing_partner"/"targets": "intimacy:current_kissing_partner"/' \
  data/mods/intimacy/actions/pull_back_in_revulsion.action.json
```

**5.3 Validate**

```bash
npx ajv validate -s data/schemas/action.schema.json \
  -d data/mods/intimacy/actions/pull_back_in_revulsion.action.json
```

### Step 6: Final Batch Validation

**6.1 Verify all 4 actions migrated**

```bash
# Check migration status for this batch
for action in massage_back massage_shoulders peck_on_lips pull_back_in_revulsion; do
  echo "=== $action ==="
  echo -n "  scope exists: "
  jq -e '.scope' "data/mods/intimacy/actions/${action}.action.json" > /dev/null 2>&1 && echo "YES ❌" || echo "NO ✓"
  echo -n "  targets exists: "
  jq -e '.targets' "data/mods/intimacy/actions/${action}.action.json" > /dev/null 2>&1 && echo "YES ✓" || echo "NO ❌"
done
```

**6.2 Verify ALL 24 actions are now migrated**

```bash
# Count actions with 'targets' property (should be 24)
grep -l '"targets":' data/mods/intimacy/actions/*.action.json | grep -v adjust_clothing | wc -l
# Expected: 24

# Count actions with 'scope' property (should be 0)
grep -l '"scope":' data/mods/intimacy/actions/*.action.json | grep -v adjust_clothing | wc -l
# Expected: 0

# Verify adjust_clothing still uses multi-target format
jq '.targets | type' data/mods/intimacy/actions/adjust_clothing.action.json
# Should output: "object" (not "string")
```

**6.3 Complete migration validation**

```bash
# Run the full migration validator
node scripts/validate-intmig-migration.js

# Should show:
# Total actions to migrate: 24
# Successfully migrated: 24
# Schema valid: 24
# Errors found: 0
```

## Testing Requirements

### Comprehensive Testing

**Test all positioning variants**

```bash
# Test facing_away (unique to massage_back)
npm run test:unit -- --testPathPattern="scopeResolver" --testNamePattern="facing_away"

# Test all massage actions
npm run test:unit -- --testPathPattern="actionDiscovery" --testNamePattern="massage"

# Test kiss variants
npm run test:unit -- --testPathPattern="actionDiscovery" --testNamePattern="peck|revulsion"
```

### Integration Testing

**Test complete intimacy mod**

```bash
# Run all intimacy tests
npm run test:integration -- --testPathPattern="intimacy"

# Test action discovery for entire mod
npm run test:integration -- --testPathPattern="actionDiscovery" --testNamePattern="intimacy.*complete"
```

### Manual Testing

1. **Test unique positioning**
   - Position actor behind target (facing away)
   - Verify ONLY massage_back is available
   - Verify other actions are NOT available

2. **Test complete action set**
   - Verify all 25 intimacy actions appear in UI
   - Test at least one action from each batch
   - Verify adjust_clothing multi-target still works

## Migration Summary Validation

### Verify Migration Completeness

**Generate migration report**

```bash
cat > workflows/INTMIG-migration-report.md << 'EOF'
# INTMIG Migration Report

## Migration Summary

- **Total Actions**: 25
- **Already Multi-Target**: 1 (adjust_clothing)
- **Migrated**: 24
- **Migration Rate**: 100%

## Batch Summary

| Batch | Count | Actions | Status |
|-------|-------|---------|--------|
| Pre-migration | 1 | adjust_clothing | ✅ Already multi-target |
| Batch 1 | 8 | Kissing actions | ✅ Complete |
| Batch 2 | 5 | Touch actions | ✅ Complete |
| Batch 3 | 7 | Neck/Face actions | ✅ Complete |
| Batch 4 | 4 | Remaining actions | ✅ Complete |

## Validation Results

- Schema Validation: ✅ PASS (24/24)
- Unit Tests: ✅ PASS
- Integration Tests: ✅ PASS
- E2E Tests: ✅ PASS
- Action Discovery: ✅ WORKING
- UI Display: ✅ WORKING
- Rule Execution: ✅ WORKING

## Migration Metrics

- Files Modified: 24
- Lines Changed: 24 (one per file)
- Breaking Changes: 0
- Rollback Required: NO
EOF
```

## Completion Checklist

- [ ] All 4 remaining actions migrated
- [ ] massage_back with unique facing_away scope works
- [ ] massage_shoulders with behind positioning works
- [ ] peck_on_lips kiss variant works
- [ ] pull_back_in_revulsion reaction works
- [ ] ALL 24 actions now use targets format
- [ ] No files contain 'scope' property (except adjust_clothing doesn't have it)
- [ ] Schema validation passes for all files
- [ ] Unit tests pass
- [ ] Integration tests pass
- [ ] Manual testing completed
- [ ] Migration report generated
- [ ] Tracking document shows 24/24 complete
- [ ] Ready for comprehensive validation (INTMIG-006)

## Git Commands

```bash
# Stage the final batch
git add data/mods/intimacy/actions/massage_back.action.json
git add data/mods/intimacy/actions/massage_shoulders.action.json
git add data/mods/intimacy/actions/peck_on_lips.action.json
git add data/mods/intimacy/actions/pull_back_in_revulsion.action.json

# Add migration report
git add workflows/INTMIG-migration-report.md

# Commit
git commit -m "feat(intimacy): complete migration with batch 4 remaining actions

- Migrated final 4 actions to targets format
- Includes massage actions with unique positioning requirements
- Completes migration of all 24 intimacy actions
- All actions now use targets format (adjust_clothing already multi-target)
- Part of INTMIG-005 final batch migration

BREAKING CHANGE: None - maintains backward compatibility"
```

## Notes

- This completes the action file migration phase
- massage_back is unique - only action requiring facing_away positioning
- All 24 actions successfully migrated, 1 was already multi-target
- Ready to proceed with comprehensive validation and testing phases
- No breaking changes - all existing rules and systems continue to work
