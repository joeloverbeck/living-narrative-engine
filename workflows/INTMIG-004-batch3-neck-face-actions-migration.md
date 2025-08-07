# INTMIG-004: Batch 3 - Neck/Face Actions Migration

## Overview

Migrate the third batch of 6 neck and face-related intimacy actions from the legacy `scope` format to the new `targets` format. This batch includes actions with varied scopes for facial and neck interactions, some requiring specific positioning.

**Note**: `lean_in_for_deep_kiss.action.json` was already migrated in a previous batch.

## Priority

**COMPLETED** - Third migration batch successfully migrated

## Dependencies

- **Blocked by**: INTMIG-001 (Migration Planning and Preparation)
- **Can run parallel with**: INTMIG-003, INTMIG-005 (after INTMIG-002 validates approach)
- **Enables**: INTMIG-006 (Schema Validation and Testing)

## Actions in This Batch

| Action File                                | Current Scope                                                  | Template                                    |
| ------------------------------------------ | -------------------------------------------------------------- | ------------------------------------------- |
| `kiss_cheek.action.json`                   | `intimacy:close_actors_facing_each_other`                      | `kiss {target}'s cheek`                     |
| `kiss_neck_sensually.action.json`          | `intimacy:actors_with_arms_facing_each_other_or_behind_target` | `kiss {target}'s neck sensually`            |
| `lick_lips.action.json`                    | `intimacy:close_actors_facing_each_other`                      | `lick {target}'s lips`                      |
| `nibble_earlobe_playfully.action.json`     | `intimacy:close_actors_facing_each_other_or_behind_target`     | `nibble on {target}'s earlobe playfully`    |
| `nuzzle_face_into_neck.action.json`        | `intimacy:close_actors_facing_each_other`                      | `nuzzle face into {target}'s neck`          |
| `suck_on_neck_to_leave_hickey.action.json` | `intimacy:close_actors_facing_each_other_or_behind_target`     | `suck on {target}'s neck to leave a hickey` |

## Acceptance Criteria

- [x] All 6 neck/face actions migrated to `targets` format
- [x] No action file contains both `scope` and `targets` properties
- [x] All migrated actions pass schema validation
- [x] Actions with positional requirements maintain correct scope
- [x] Actions allowing behind positioning work correctly
- [x] Existing rules for neck/face actions continue to work
- [x] Action discovery correctly identifies migrated actions
- [x] UI displays migrated actions with proper positioning requirements
- [x] Action execution traces validate successfully
- [x] Integration tests pass
- [x] Migration tracking document updated

## Implementation Steps

### Step 1: Pre-Migration Analysis

**1.1 Analyze scope variations**

```bash
# Group actions by scope pattern
echo "=== Facing each other only ==="
grep -l "close_actors_facing_each_other\"" data/mods/intimacy/actions/*.action.json | xargs basename -a

echo "=== Facing or behind ==="
grep -l "or_behind_target\"" data/mods/intimacy/actions/*.action.json | xargs basename -a

echo "=== Specific body parts ==="
grep -l "with_mouth\|with_arms" data/mods/intimacy/actions/*.action.json | xargs basename -a
```

**1.2 Verify scope file existence**

```bash
# Check all unique scopes exist
ls -la data/mods/intimacy/scopes/close_actors_facing_each_other.scope
ls -la data/mods/intimacy/scopes/actors_with_arms_facing_each_other_or_behind_target.scope
ls -la data/mods/intimacy/scopes/actors_with_mouth_facing_each_other.scope
ls -la data/mods/intimacy/scopes/close_actors_facing_each_other_or_behind_target.scope
```

### Step 2: Migrate kiss_cheek.action.json

**2.1 Migration command**

```bash
sed -i 's/"scope": "intimacy:close_actors_facing_each_other"/"targets": "intimacy:close_actors_facing_each_other"/' \
  data/mods/intimacy/actions/kiss_cheek.action.json
```

**2.2 Validate**

```bash
npx ajv validate -s data/schemas/action.schema.json \
  -d data/mods/intimacy/actions/kiss_cheek.action.json
```

### Step 3: Migrate kiss_neck_sensually.action.json

**3.1 Migration command**

```bash
sed -i 's/"scope": "intimacy:actors_with_arms_facing_each_other_or_behind_target"/"targets": "intimacy:actors_with_arms_facing_each_other_or_behind_target"/' \
  data/mods/intimacy/actions/kiss_neck_sensually.action.json
```

**3.2 Validate**

```bash
npx ajv validate -s data/schemas/action.schema.json \
  -d data/mods/intimacy/actions/kiss_neck_sensually.action.json
```

### Step 4: Migrate lick_lips.action.json

**5.1 Migration command**

```bash
sed -i 's/"scope": "intimacy:close_actors_facing_each_other"/"targets": "intimacy:close_actors_facing_each_other"/' \
  data/mods/intimacy/actions/lick_lips.action.json
```

**5.2 Validate**

```bash
npx ajv validate -s data/schemas/action.schema.json \
  -d data/mods/intimacy/actions/lick_lips.action.json
```

### Step 5: Migrate nibble_earlobe_playfully.action.json

**6.1 Migration command**

```bash
sed -i 's/"scope": "intimacy:close_actors_facing_each_other_or_behind_target"/"targets": "intimacy:close_actors_facing_each_other_or_behind_target"/' \
  data/mods/intimacy/actions/nibble_earlobe_playfully.action.json
```

**6.2 Validate**

```bash
npx ajv validate -s data/schemas/action.schema.json \
  -d data/mods/intimacy/actions/nibble_earlobe_playfully.action.json
```

### Step 6: Migrate nuzzle_face_into_neck.action.json

**7.1 Migration command**

```bash
sed -i 's/"scope": "intimacy:close_actors_facing_each_other"/"targets": "intimacy:close_actors_facing_each_other"/' \
  data/mods/intimacy/actions/nuzzle_face_into_neck.action.json
```

**7.2 Validate**

```bash
npx ajv validate -s data/schemas/action.schema.json \
  -d data/mods/intimacy/actions/nuzzle_face_into_neck.action.json
```

### Step 7: Migrate suck_on_neck_to_leave_hickey.action.json

**8.1 Migration command**

```bash
sed -i 's/"scope": "intimacy:close_actors_facing_each_other_or_behind_target"/"targets": "intimacy:close_actors_facing_each_other_or_behind_target"/' \
  data/mods/intimacy/actions/suck_on_neck_to_leave_hickey.action.json
```

**8.2 Validate**

```bash
npx ajv validate -s data/schemas/action.schema.json \
  -d data/mods/intimacy/actions/suck_on_neck_to_leave_hickey.action.json
```

### Step 8: Batch Validation

**9.1 Verify all migrations**

```bash
# Check migration status for all files in this batch
for action in kiss_cheek kiss_neck_sensually lick_lips \
             nibble_earlobe_playfully nuzzle_face_into_neck suck_on_neck_to_leave_hickey; do
  echo "Checking $action..."
  if jq -e '.scope' "data/mods/intimacy/actions/${action}.action.json" > /dev/null 2>&1; then
    echo "  ❌ ERROR: scope still exists"
  fi
  if jq -e '.targets' "data/mods/intimacy/actions/${action}.action.json" > /dev/null 2>&1; then
    echo "  ✓ targets present"
  else
    echo "  ❌ ERROR: targets missing"
  fi
done
```

**9.2 Verify positional scopes**

```bash
# Check actions that allow behind positioning
echo "Actions allowing behind position:"
grep -l '"targets": ".*or_behind_target"' data/mods/intimacy/actions/*.action.json | xargs basename -a
# Should show: kiss_neck_sensually, nibble_earlobe_playfully, suck_on_neck_to_leave_hickey
```

## Testing Requirements

### Integration Testing

**Run integration tests**

```bash
npm run test:integration
```

### Manual Testing

1. **Test positional requirements**
   - Position actors facing each other
   - Verify kiss_cheek, lick_lips, nuzzle_face_into_neck available
   - Position actor behind target
   - Verify kiss_neck_sensually, nibble_earlobe_playfully available
   - Verify kiss_cheek NOT available from behind

2. **Test body part specific scopes**
   - Test kiss_neck_sensually requires arm positioning

## Completion Checklist

- [x] All 6 neck/face actions migrated
- [x] Positional requirements preserved
- [x] Schema validation passes
- [x] Integration tests pass
- [x] Manual positional testing completed
- [x] Tracking document updated
- [x] Git commit created

## Git Commands

```bash
# Stage all migrated files
git add data/mods/intimacy/actions/kiss_cheek.action.json
git add data/mods/intimacy/actions/kiss_neck_sensually.action.json
git add data/mods/intimacy/actions/lick_lips.action.json
git add data/mods/intimacy/actions/nibble_earlobe_playfully.action.json
git add data/mods/intimacy/actions/nuzzle_face_into_neck.action.json
git add data/mods/intimacy/actions/suck_on_neck_to_leave_hickey.action.json

# Commit
git commit -m "feat(intimacy): migrate batch 3 neck/face actions to targets format

- Migrated 6 neck and face-related actions
- Preserves positional requirements (facing vs behind)
- Maintains body-part specific scopes
- Part of INTMIG-004 batch migration"
```

## Notes

- `lean_in_for_deep_kiss.action.json` was already migrated in a previous batch
- Pay attention to actions that allow "behind" positioning
- Body-part specific scopes (mouth, arms) must be preserved exactly
- Some actions are romantic (kiss_cheek) while others are more intimate (hickey)
- Positional testing is critical for this batch
