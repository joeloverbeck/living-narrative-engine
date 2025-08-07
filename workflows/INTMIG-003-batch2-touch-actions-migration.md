# INTMIG-003: Batch 2 - Touch Actions Migration

## Overview

Migrate the second batch of 5 touch-related intimacy actions from the legacy `scope` format to the new `targets` format. This batch includes actions involving physical touch with various scopes, demonstrating migration patterns for actions with different scope types.

## Priority

**HIGH** - Second migration batch, validates approach for varied scope types

## Dependencies

- **Blocked by**: INTMIG-001 (Migration Planning and Preparation)
- **Can run parallel with**: INTMIG-004, INTMIG-005 (after INTMIG-002 validates approach)
- **Enables**: INTMIG-006 (Schema Validation and Testing)

## Actions in This Batch

| Action File                       | Current Scope                                                           | Template                                | Complexity    |
| --------------------------------- | ----------------------------------------------------------------------- | --------------------------------------- | ------------- |
| `brush_hand.action.json`          | `positioning:close_actors`                                              | `brush {target}'s hand lightly`         | Simple        |
| `feel_arm_muscles.action.json`    | `intimacy:actors_with_muscular_arms_facing_each_other_or_behind_target` | `feel {target}'s arm muscles`           | Complex scope |
| `fondle_ass.action.json`          | `intimacy:actors_with_ass_cheeks_facing_each_other_or_behind_target`    | `fondle {target}'s ass`                 | Complex scope |
| `place_hand_on_waist.action.json` | `positioning:close_actors`                                              | `place a hand on {target}'s waist`      | Simple        |
| `thumb_wipe_cheek.action.json`    | `intimacy:close_actors_facing_each_other`                               | `wipe {target}'s cheek with your thumb` | Simple        |

## Acceptance Criteria

- [ ] All 5 touch actions migrated to `targets` format
- [ ] No action file contains both `scope` and `targets` properties
- [ ] All migrated actions pass schema validation
- [ ] Actions with complex scopes maintain correct target resolution
- [ ] Cross-mod scope references (positioning:\*) work correctly
- [ ] Existing rules for touch actions continue to work
- [ ] Action discovery correctly identifies migrated actions
- [ ] UI displays migrated actions with proper target selection
- [ ] Action execution traces validate successfully
- [ ] Unit tests for touch actions pass
- [ ] Integration tests involving touch actions pass
- [ ] Migration tracking document updated

## Implementation Steps

### Step 1: Pre-Migration Verification

**1.1 Verify backup exists**

```bash
# Check that INTMIG-001 backup includes these actions
ls -la backups/intmig-*/actions/*.action.json | grep -E "(brush_hand|feel_arm|fondle_ass|place_hand|thumb_wipe)" | wc -l
# Expected output: 5
```

**1.2 Verify scope files exist**

```bash
# Check that referenced scope files exist
ls -la data/mods/positioning/scopes/close_actors.scope
ls -la data/mods/intimacy/scopes/actors_with_muscular_arms_facing_each_other_or_behind_target.scope
ls -la data/mods/intimacy/scopes/actors_with_ass_cheeks_facing_each_other_or_behind_target.scope
ls -la data/mods/intimacy/scopes/close_actors_facing_each_other.scope
```

**1.3 Document current state**

```bash
# Capture current content for all 5 actions
for action in brush_hand feel_arm_muscles fondle_ass place_hand_on_waist thumb_wipe_cheek; do
  echo "=== $action ==="
  jq '.scope' "data/mods/intimacy/actions/${action}.action.json"
done
```

### Step 2: Migrate brush_hand.action.json

**2.1 Current file content**

```json
{
  "$schema": "schema://living-narrative-engine/action.schema.json",
  "id": "intimacy:brush_hand",
  "name": "Brush Hand",
  "description": "Lightly brush against the target's hand in a subtle, intimate gesture.",
  "scope": "positioning:close_actors",
  "required_components": {
    "actor": ["positioning:closeness"]
  },
  "forbidden_components": {
    "actor": ["intimacy:kissing"]
  },
  "template": "brush {target}'s hand lightly",
  "prerequisites": []
}
```

**2.2 Migration command**

```bash
# Note: This references a scope from the positioning mod
sed -i 's/"scope": "positioning:close_actors"/"targets": "positioning:close_actors"/' \
  data/mods/intimacy/actions/brush_hand.action.json
```

**2.3 Verify cross-mod reference**

```bash
# Ensure the positioning scope is still accessible
grep '"targets": "positioning:close_actors"' data/mods/intimacy/actions/brush_hand.action.json
```

**2.4 Validate schema**

```bash
npx ajv validate -s data/schemas/action.schema.json \
  -d data/mods/intimacy/actions/brush_hand.action.json
```

### Step 3: Migrate feel_arm_muscles.action.json

**3.1 Current file content**

```json
{
  "$schema": "schema://living-narrative-engine/action.schema.json",
  "id": "intimacy:feel_arm_muscles",
  "name": "Feel Arm Muscles",
  "description": "Run your hands over the target's arm muscles, feeling their definition.",
  "scope": "intimacy:actors_with_muscular_arms_facing_each_other_or_behind_target",
  "required_components": {
    "actor": ["positioning:closeness"]
  },
  "forbidden_components": {
    "actor": ["intimacy:kissing"]
  },
  "template": "feel {target}'s arm muscles",
  "prerequisites": []
}
```

**3.2 Migration command**

```bash
# This has a complex scope name - be careful with the sed pattern
sed -i 's/"scope": "intimacy:actors_with_muscular_arms_facing_each_other_or_behind_target"/"targets": "intimacy:actors_with_muscular_arms_facing_each_other_or_behind_target"/' \
  data/mods/intimacy/actions/feel_arm_muscles.action.json
```

**3.3 Verify long scope name preserved**

```bash
# Check the full scope name is intact
jq '.targets' data/mods/intimacy/actions/feel_arm_muscles.action.json
# Should output: "intimacy:actors_with_muscular_arms_facing_each_other_or_behind_target"
```

**3.4 Validate**

```bash
npx ajv validate -s data/schemas/action.schema.json \
  -d data/mods/intimacy/actions/feel_arm_muscles.action.json
```

### Step 4: Migrate fondle_ass.action.json

**4.1 Current file content**

```json
{
  "$schema": "schema://living-narrative-engine/action.schema.json",
  "id": "intimacy:fondle_ass",
  "name": "Fondle Ass",
  "description": "Squeeze and caress the target's buttocks in an intimate manner.",
  "scope": "intimacy:actors_with_ass_cheeks_facing_each_other_or_behind_target",
  "required_components": {
    "actor": ["positioning:closeness"]
  },
  "forbidden_components": {
    "actor": ["intimacy:kissing"]
  },
  "template": "fondle {target}'s ass",
  "prerequisites": []
}
```

**4.2 Migration command**

```bash
# Another complex scope name
sed -i 's/"scope": "intimacy:actors_with_ass_cheeks_facing_each_other_or_behind_target"/"targets": "intimacy:actors_with_ass_cheeks_facing_each_other_or_behind_target"/' \
  data/mods/intimacy/actions/fondle_ass.action.json
```

**4.3 Validate**

```bash
npx ajv validate -s data/schemas/action.schema.json \
  -d data/mods/intimacy/actions/fondle_ass.action.json
```

### Step 5: Migrate place_hand_on_waist.action.json

**5.1 Current file content**

```json
{
  "$schema": "schema://living-narrative-engine/action.schema.json",
  "id": "intimacy:place_hand_on_waist",
  "name": "Place Hand on Waist",
  "description": "Gently place your hand on the target's waist in an intimate gesture.",
  "scope": "positioning:close_actors",
  "required_components": {
    "actor": ["positioning:closeness"]
  },
  "forbidden_components": {
    "actor": ["intimacy:kissing"]
  },
  "template": "place a hand on {target}'s waist",
  "prerequisites": []
}
```

**5.2 Migration command**

```bash
# Cross-mod reference to positioning
sed -i 's/"scope": "positioning:close_actors"/"targets": "positioning:close_actors"/' \
  data/mods/intimacy/actions/place_hand_on_waist.action.json
```

**5.3 Validate**

```bash
npx ajv validate -s data/schemas/action.schema.json \
  -d data/mods/intimacy/actions/place_hand_on_waist.action.json
```

### Step 6: Migrate thumb_wipe_cheek.action.json

**6.1 Current file content**

```json
{
  "$schema": "schema://living-narrative-engine/action.schema.json",
  "id": "intimacy:thumb_wipe_cheek",
  "name": "Thumb Wipe Cheek",
  "description": "Gently wipe the target's cheek with your thumb in a caring gesture.",
  "scope": "intimacy:close_actors_facing_each_other",
  "required_components": {
    "actor": ["positioning:closeness"]
  },
  "forbidden_components": {
    "actor": ["intimacy:kissing"]
  },
  "template": "wipe {target}'s cheek with your thumb",
  "prerequisites": []
}
```

**6.2 Migration command**

```bash
sed -i 's/"scope": "intimacy:close_actors_facing_each_other"/"targets": "intimacy:close_actors_facing_each_other"/' \
  data/mods/intimacy/actions/thumb_wipe_cheek.action.json
```

**6.3 Validate**

```bash
npx ajv validate -s data/schemas/action.schema.json \
  -d data/mods/intimacy/actions/thumb_wipe_cheek.action.json
```

### Step 7: Batch Validation

**7.1 Verify all migrations**

```bash
# Check that no 'scope' properties remain in migrated files
for action in brush_hand feel_arm_muscles fondle_ass place_hand_on_waist thumb_wipe_cheek; do
  echo "Checking $action..."
  if grep -q '"scope"' "data/mods/intimacy/actions/${action}.action.json"; then
    echo "  ❌ ERROR: scope property still exists!"
  else
    echo "  ✓ scope removed"
  fi
  if grep -q '"targets"' "data/mods/intimacy/actions/${action}.action.json"; then
    echo "  ✓ targets added"
  else
    echo "  ❌ ERROR: targets property missing!"
  fi
done
```

**7.2 Verify cross-mod references**

```bash
# Check that positioning mod references are preserved
grep -l '"targets": "positioning:' data/mods/intimacy/actions/*.action.json
# Should show: brush_hand.action.json and place_hand_on_waist.action.json
```

**7.3 Check complex scope preservation**

```bash
# Verify long scope names weren't truncated
for action in feel_arm_muscles fondle_ass; do
  echo "=== $action ==="
  jq -r '.targets' "data/mods/intimacy/actions/${action}.action.json" | wc -c
done
# Should show character counts > 50 for both
```

**7.4 Run migration validator**

```bash
node scripts/validate-intmig-migration.js | grep -E "(brush_hand|feel_arm|fondle_ass|place_hand|thumb_wipe)"
```

## Testing Requirements

### Unit Testing

**Test touch action discovery**

```bash
npm run test:unit -- --testPathPattern="actionDiscovery" --testNamePattern="intimacy.*(touch|hand|waist|cheek)"
```

**Test cross-mod scope resolution**

```bash
npm run test:unit -- --testPathPattern="scopeResolver" --testNamePattern="cross.*mod.*reference"
```

**Test complex scope handling**

```bash
npm run test:unit -- --testPathPattern="scopeResolver" --testNamePattern="complex.*scope.*name"
```

### Integration Testing

**Test touch action rules**

```bash
npm run test:integration -- --testPathPattern="rules.*intimacy" --testNamePattern="touch|hand|waist"
```

**Test positioning integration**

```bash
npm run test:integration -- --testPathPattern="action.*execution" --testNamePattern="positioning.*scope"
```

### Manual Testing

1. **Test cross-mod scope resolution**

   ```javascript
   // In browser console
   const actions = await gameEngine.getAvailableActions('actor1');
   const touchActions = actions.filter((a) =>
     ['brush_hand', 'place_hand_on_waist'].some((id) => a.id.includes(id))
   );
   console.log('Cross-mod touch actions:', touchActions);
   ```

2. **Test complex scope resolution**

   ```javascript
   // Test actions with long scope names
   const complexActions = await gameEngine.getAvailableActions('actor1');
   const muscleAction = complexActions.find((a) =>
     a.id.includes('feel_arm_muscles')
   );
   console.log('Complex scope action:', muscleAction);
   ```

3. **Verify UI target selection**
   - Select an actor
   - Check that touch actions appear in action list
   - Verify target selection works for cross-mod scopes
   - Test actions with complex scope names

## Risk Mitigation

### Specific Risks for This Batch

| Risk                              | Impact | Mitigation                                       |
| --------------------------------- | ------ | ------------------------------------------------ |
| Cross-mod scope resolution fails  | High   | Test positioning mod integration thoroughly      |
| Long scope names get truncated    | Medium | Use careful sed patterns, verify with jq         |
| Complex scopes break UI           | Medium | Manual UI testing for each action                |
| Forbidden components not enforced | High   | Test that kissing actors can't use touch actions |

### Validation Points

1. **After each file migration**: Validate schema individually
2. **After all migrations**: Run batch validation
3. **Before commit**: Full test suite
4. **After commit**: Action trace validation

## Rollback Procedure

### Immediate Rollback

```bash
# Revert all touch action files
for action in brush_hand feel_arm_muscles fondle_ass place_hand_on_waist thumb_wipe_cheek; do
  git checkout -- "data/mods/intimacy/actions/${action}.action.json"
done
```

### Selective Rollback

```bash
# If only specific actions have issues
git checkout -- "data/mods/intimacy/actions/feel_arm_muscles.action.json"
git checkout -- "data/mods/intimacy/actions/fondle_ass.action.json"
```

## Migration Tracking Update

Update `workflows/INTMIG-tracking.md`:

```markdown
| intimacy:brush_hand | ... | targets | ✅ Migrated | ✅ | ✅ | Batch 2 - Cross-mod ref |
| intimacy:feel_arm_muscles | ... | targets | ✅ Migrated | ✅ | ✅ | Batch 2 - Complex scope |
| intimacy:fondle_ass | ... | targets | ✅ Migrated | ✅ | ✅ | Batch 2 - Complex scope |
| intimacy:place_hand_on_waist | ... | targets | ✅ Migrated | ✅ | ✅ | Batch 2 - Cross-mod ref |
| intimacy:thumb_wipe_cheek | ... | targets | ✅ Migrated | ✅ | ✅ | Batch 2 |
```

## Completion Checklist

- [ ] All 5 touch actions migrated
- [ ] No files contain 'scope' property
- [ ] All files contain 'targets' property
- [ ] Cross-mod references preserved (positioning:\*)
- [ ] Complex scope names intact
- [ ] Schema validation passes for all files
- [ ] Unit tests pass
- [ ] Integration tests pass
- [ ] Manual testing completed
- [ ] UI target selection verified
- [ ] Action traces validated
- [ ] Tracking document updated
- [ ] Git commit created

## Git Commands

```bash
# Stage the migrated files
git add data/mods/intimacy/actions/brush_hand.action.json
git add data/mods/intimacy/actions/feel_arm_muscles.action.json
git add data/mods/intimacy/actions/fondle_ass.action.json
git add data/mods/intimacy/actions/place_hand_on_waist.action.json
git add data/mods/intimacy/actions/thumb_wipe_cheek.action.json

# Commit with descriptive message
git commit -m "feat(intimacy): migrate batch 2 touch actions to targets format

- Migrated 5 touch-related actions from 'scope' to 'targets' format
- Includes cross-mod references to positioning:close_actors
- Preserves complex scope names for body-part-specific actions
- Maintains backward compatibility with existing rules
- Part of INTMIG-003 batch migration"
```

## Notes

- This batch demonstrates migration of actions with varied scope types
- Cross-mod references (positioning:\*) require careful testing
- Complex scope names must be preserved exactly for correct resolution
- The forbidden_components checking (no touching while kissing) must still work
- Pay special attention to UI behavior with complex scopes
