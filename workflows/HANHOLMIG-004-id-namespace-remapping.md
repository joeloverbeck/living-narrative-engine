# HANHOLMIG-004: ID Namespace Remapping

**Status**: Ready for Implementation
**Priority**: CRITICAL
**Estimated Time**: 1.5-2 hours
**Risk Level**: High (comprehensive content modifications across all files)

## Overview

This ticket performs the critical namespace remapping from `affection:` to `hand_holding:` across all 12 migrated files. It also applies the new Velvet Twilight color scheme to action files and updates scope references from `affection:close_actors_facing_each_other_or_behind_target` to `positioning:close_actors_facing_each_other_or_behind_target`.

**Critical**: This is a high-touch modification requiring careful attention to every ID reference and visual property.

## Prerequisites

- [x] **HANHOLMIG-001 complete**: Scope migration finished
- [x] **HANHOLMIG-002 complete**: Mod structure created
- [x] **HANHOLMIG-003 complete**: Files copied (unchanged)
- [ ] Clean git working directory
- [ ] Feature branch: `feature/hand-holding-mod-migration` active
- [ ] Text editor or IDE ready for bulk find/replace operations

## ID Remapping Reference Table

| Old ID (affection) | New ID (hand_holding) | Type |
|-------------------|----------------------|------|
| `affection:hold_hand` | `hand_holding:hold_hand` | Action |
| `affection:squeeze_hand_reassuringly` | `hand_holding:squeeze_hand_reassuringly` | Action |
| `affection:warm_hands_between_yours` | `hand_holding:warm_hands_between_yours` | Action |
| `affection:holding_hand` | `hand_holding:holding_hand` | Component |
| `affection:hand_held` | `hand_holding:hand_held` | Component |
| `affection:actors-are-holding-hands` | `hand_holding:actors-are-holding-hands` | Condition |
| `affection:event-is-action-hold-hand` | `hand_holding:event-is-action-hold-hand` | Condition |
| `affection:event-is-action-squeeze-hand-reassuringly` | `hand_holding:event-is-action-squeeze-hand-reassuringly` | Condition |
| `affection:event-is-action-warm-hands-between-yours` | `hand_holding:event-is-action-warm-hands-between-yours` | Condition |

## Color Scheme Reference

### Velvet Twilight Color Scheme

**Normal state**:
```json
{
  "backgroundColor": "#2c0e37",
  "textColor": "#ffebf0",
  "hoverBackgroundColor": "#451952",
  "hoverTextColor": "#f3e5f5"
}
```

**Contrast ratios**:
- Normal: 15.01:1 (AAA)
- Hover: 11.45:1 (AAA)

**Theme**: Luxurious nightfall, refined intrigue, intimate connection

## Detailed Steps

### Step 1: Update Action Files (3 files)

#### File 1: hold_hand.action.json

**File path**: `data/mods/hand_holding/actions/hold_hand.action.json`

**Updates required**:
1. Update action ID: `affection:hold_hand` → `hand_holding:hold_hand`
2. Update scope reference: `affection:close_actors_facing_each_other_or_behind_target` → `positioning:close_actors_facing_each_other_or_behind_target`
3. Update forbidden_components: `affection:holding_hand` → `hand_holding:holding_hand`
4. Update forbidden_components: `affection:hand_held` → `hand_holding:hand_held`
5. Apply Velvet Twilight color scheme to visualProperties

**Search and replace patterns**:
```json
# Action ID
"id": "affection:hold_hand"
→ "id": "hand_holding:hold_hand"

# Scope reference (in targets field)
"scope": "affection:close_actors_facing_each_other_or_behind_target"
→ "scope": "positioning:close_actors_facing_each_other_or_behind_target"

# Forbidden components
"affection:holding_hand"
→ "hand_holding:holding_hand"

"affection:hand_held"
→ "hand_holding:hand_held"

# Visual properties (entire visualProperties object)
Replace old color scheme with:
"visualProperties": {
  "backgroundColor": "#2c0e37",
  "textColor": "#ffebf0",
  "hoverBackgroundColor": "#451952",
  "hoverTextColor": "#f3e5f5"
}
```

#### File 2: squeeze_hand_reassuringly.action.json

**File path**: `data/mods/hand_holding/actions/squeeze_hand_reassuringly.action.json`

**Updates required**:
1. Update action ID: `affection:squeeze_hand_reassuringly` → `hand_holding:squeeze_hand_reassuringly`
2. Update required_conditions: `affection:actors-are-holding-hands` → `hand_holding:actors-are-holding-hands`
3. Update scope reference: `affection:close_actors_facing_each_other_or_behind_target` → `positioning:close_actors_facing_each_other_or_behind_target`
4. Apply Velvet Twilight color scheme

**Search and replace patterns**:
```json
# Action ID
"id": "affection:squeeze_hand_reassuringly"
→ "id": "hand_holding:squeeze_hand_reassuringly"

# Required condition
"affection:actors-are-holding-hands"
→ "hand_holding:actors-are-holding-hands"

# Scope reference
"scope": "affection:close_actors_facing_each_other_or_behind_target"
→ "scope": "positioning:close_actors_facing_each_other_or_behind_target"

# Visual properties
Replace with Velvet Twilight scheme (same as File 1)
```

#### File 3: warm_hands_between_yours.action.json

**File path**: `data/mods/hand_holding/actions/warm_hands_between_yours.action.json`

**Updates required**:
1. Update action ID: `affection:warm_hands_between_yours` → `hand_holding:warm_hands_between_yours`
2. Update required_conditions: `affection:actors-are-holding-hands` → `hand_holding:actors-are-holding-hands`
3. Update scope reference: `affection:close_actors_facing_each_other_or_behind_target` → `positioning:close_actors_facing_each_other_or_behind_target`
4. Apply Velvet Twilight color scheme

**Search and replace patterns**: Same as File 2 (with appropriate action ID)

### Step 2: Update Component Files (2 files)

#### File 1: holding_hand.component.json

**File path**: `data/mods/hand_holding/components/holding_hand.component.json`

**Updates required**:
1. Update component ID: `affection:holding_hand` → `hand_holding:holding_hand`

**Search and replace patterns**:
```json
# Component ID
"id": "affection:holding_hand"
→ "id": "hand_holding:holding_hand"
```

**Note**: No schema changes required, only ID update.

#### File 2: hand_held.component.json

**File path**: `data/mods/hand_holding/components/hand_held.component.json`

**Updates required**:
1. Update component ID: `affection:hand_held` → `hand_holding:hand_held`

**Search and replace patterns**:
```json
# Component ID
"id": "affection:hand_held"
→ "id": "hand_holding:hand_held"
```

### Step 3: Update Condition Files (4 files)

#### File 1: actors-are-holding-hands.condition.json

**File path**: `data/mods/hand_holding/conditions/actors-are-holding-hands.condition.json`

**Updates required**:
1. Update condition ID: `affection:actors-are-holding-hands` → `hand_holding:actors-are-holding-hands`
2. Update component references in logic:
   - `affection:holding_hand` → `hand_holding:holding_hand`
   - `affection:hand_held` → `hand_holding:hand_held`

**Search and replace patterns**:
```json
# Condition ID
"id": "affection:actors-are-holding-hands"
→ "id": "hand_holding:actors-are-holding-hands"

# Component references in logic
"affection:holding_hand"
→ "hand_holding:holding_hand"

"affection:hand_held"
→ "hand_holding:hand_held"
```

#### File 2: event-is-action-hold-hand.condition.json

**File path**: `data/mods/hand_holding/conditions/event-is-action-hold-hand.condition.json`

**Updates required**:
1. Update condition ID: `affection:event-is-action-hold-hand` → `hand_holding:event-is-action-hold-hand`
2. Update action ID reference in logic: `affection:hold_hand` → `hand_holding:hold_hand`

**Search and replace patterns**:
```json
# Condition ID
"id": "affection:event-is-action-hold-hand"
→ "id": "hand_holding:event-is-action-hold-hand"

# Action ID reference
"affection:hold_hand"
→ "hand_holding:hold_hand"
```

#### File 3: event-is-action-squeeze-hand-reassuringly.condition.json

**File path**: `data/mods/hand_holding/conditions/event-is-action-squeeze-hand-reassuringly.condition.json`

**Updates required**:
1. Update condition ID: `affection:event-is-action-squeeze-hand-reassuringly` → `hand_holding:event-is-action-squeeze-hand-reassuringly`
2. Update action ID reference: `affection:squeeze_hand_reassuringly` → `hand_holding:squeeze_hand_reassuringly`

**Search and replace patterns**: Similar to File 2

#### File 4: event-is-action-warm-hands-between-yours.condition.json

**File path**: `data/mods/hand_holding/conditions/event-is-action-warm-hands-between-yours.condition.json`

**Updates required**:
1. Update condition ID: `affection:event-is-action-warm-hands-between-yours` → `hand_holding:event-is-action-warm-hands-between-yours`
2. Update action ID reference: `affection:warm_hands_between_yours` → `hand_holding:warm_hands_between_yours`

**Search and replace patterns**: Similar to File 2

### Step 4: Update Rule Files (3 files)

#### File 1: handle_hold_hand.rule.json

**File path**: `data/mods/hand_holding/rules/handle_hold_hand.rule.json`

**Updates required**:
1. Update condition reference: `affection:event-is-action-hold-hand` → `hand_holding:event-is-action-hold-hand`
2. Update component types in operations:
   - `affection:holding_hand` → `hand_holding:holding_hand`
   - `affection:hand_held` → `hand_holding:hand_held`

**Search and replace patterns**:
```json
# Condition reference (in "when" field)
"affection:event-is-action-hold-hand"
→ "hand_holding:event-is-action-hold-hand"

# Component types in operations
"componentType": "affection:holding_hand"
→ "componentType": "hand_holding:holding_hand"

"componentType": "affection:hand_held"
→ "componentType": "hand_holding:hand_held"
```

#### File 2: handle_squeeze_hand_reassuringly.rule.json

**File path**: `data/mods/hand_holding/rules/handle_squeeze_hand_reassuringly.rule.json`

**Updates required**:
1. Update condition reference: `affection:event-is-action-squeeze-hand-reassuringly` → `hand_holding:event-is-action-squeeze-hand-reassuringly`

**Search and replace patterns**:
```json
# Condition reference
"affection:event-is-action-squeeze-hand-reassuringly"
→ "hand_holding:event-is-action-squeeze-hand-reassuringly"
```

**Note**: This rule has no component operations, only condition reference update.

#### File 3: handle_warm_hands_between_yours.rule.json

**File path**: `data/mods/hand_holding/rules/handle_warm_hands_between_yours.rule.json`

**Updates required**:
1. Update condition reference: `affection:event-is-action-warm-hands-between-yours` → `hand_holding:event-is-action-warm-hands-between-yours`

**Search and replace patterns**: Similar to File 2

### Step 5: Bulk Search and Replace Strategy

**For efficiency, use a text editor with multi-file find/replace**:

**Recommended approach** (VS Code, Sublime Text, or similar):
1. Open entire `data/mods/hand_holding/` directory
2. Use "Find in Files" with "Replace All" functionality
3. Execute replacements in order shown below

**Replacement order** (most specific to least specific):

```
1. "affection:event-is-action-warm-hands-between-yours" → "hand_holding:event-is-action-warm-hands-between-yours"
2. "affection:event-is-action-squeeze-hand-reassuringly" → "hand_holding:event-is-action-squeeze-hand-reassuringly"
3. "affection:event-is-action-hold-hand" → "hand_holding:event-is-action-hold-hand"
4. "affection:actors-are-holding-hands" → "hand_holding:actors-are-holding-hands"
5. "affection:warm_hands_between_yours" → "hand_holding:warm_hands_between_yours"
6. "affection:squeeze_hand_reassuringly" → "hand_holding:squeeze_hand_reassuringly"
7. "affection:hold_hand" → "hand_holding:hold_hand"
8. "affection:holding_hand" → "hand_holding:holding_hand"
9. "affection:hand_held" → "hand_holding:hand_held"
10. "affection:close_actors_facing_each_other_or_behind_target" → "positioning:close_actors_facing_each_other_or_behind_target"
```

**Color scheme replacement**:
```json
# Find old visualProperties blocks and replace with:
"visualProperties": {
  "backgroundColor": "#2c0e37",
  "textColor": "#ffebf0",
  "hoverBackgroundColor": "#451952",
  "hoverTextColor": "#f3e5f5"
}
```

### Step 6: Verify No Old Namespaces Remain

**Critical verification**:
```bash
# Search for any remaining affection namespace references
grep -r "affection:hold_hand" data/mods/hand_holding/
grep -r "affection:holding_hand" data/mods/hand_holding/
grep -r "affection:hand_held" data/mods/hand_holding/
grep -r "affection:actors-are-holding-hands" data/mods/hand_holding/
grep -r "affection:squeeze_hand" data/mods/hand_holding/
grep -r "affection:warm_hands" data/mods/hand_holding/
grep -r "affection:event-is-action" data/mods/hand_holding/
grep -r "affection:close_actors" data/mods/hand_holding/

# Should return: NO RESULTS for all searches
```

### Step 7: Verify Color Scheme Applied

**Check all action files**:
```bash
# Verify Velvet Twilight colors in all actions
grep -A4 "visualProperties" data/mods/hand_holding/actions/*.json

# Should show #2c0e37 (backgroundColor) in all three action files
```

## Validation Criteria

### Namespace Validation Checklist

- [ ] No `affection:` namespace references remain in any file
- [ ] All action IDs use `hand_holding:` namespace
- [ ] All component IDs use `hand_holding:` namespace
- [ ] All condition IDs use `hand_holding:` namespace
- [ ] All component references in logic use `hand_holding:` namespace
- [ ] All action references in conditions use `hand_holding:` namespace
- [ ] All condition references in rules use `hand_holding:` namespace
- [ ] All scope references use `positioning:close_actors_facing_each_other_or_behind_target`
- [ ] No forbidden_components reference `affection:` namespace
- [ ] No required_conditions reference `affection:` namespace

### Color Scheme Validation Checklist

- [ ] hold_hand.action.json uses Velvet Twilight colors
- [ ] squeeze_hand_reassuringly.action.json uses Velvet Twilight colors
- [ ] warm_hands_between_yours.action.json uses Velvet Twilight colors
- [ ] backgroundColor is #2c0e37 in all actions
- [ ] textColor is #ffebf0 in all actions
- [ ] hoverBackgroundColor is #451952 in all actions
- [ ] hoverTextColor is #f3e5f5 in all actions

### JSON Validity Checklist

- [ ] All 12 files still valid JSON after modifications
- [ ] No syntax errors introduced during find/replace
- [ ] Proper comma placement maintained
- [ ] All quotes matched correctly

## Validation Commands

```bash
# Verify no old namespaces remain
bash -c 'found=0; for term in "affection:hold_hand" "affection:holding_hand" "affection:hand_held" "affection:actors-are-holding-hands"; do
  if grep -rq "$term" data/mods/hand_holding/; then
    echo "✗ Found old namespace: $term"; found=1;
  fi;
done;
[ $found -eq 0 ] && echo "✓ No old namespaces found" || echo "✗ Old namespaces still exist"'

# Verify all files still valid JSON
for file in data/mods/hand_holding/**/*.json; do
  cat "$file" | jq '.' > /dev/null 2>&1 && echo "✓ $file" || echo "✗ $file INVALID JSON"
done

# Verify color scheme applied
grep -l "#2c0e37" data/mods/hand_holding/actions/*.json | wc -l
# Should return: 3 (all action files)

# Count new namespace occurrences (sanity check)
grep -ro "hand_holding:" data/mods/hand_holding/ | wc -l
# Should return: high number (multiple occurrences across 12 files)

# Verify scope reference updated
grep -c "positioning:close_actors_facing_each_other_or_behind_target" data/mods/hand_holding/actions/*.json
# Should return: 3 (one per action file)
```

## Files Modified

All 12 content files in `data/mods/hand_holding/`:

### Actions (3 files modified)
1. `actions/hold_hand.action.json` - ID, scope, forbidden_components, colors updated
2. `actions/squeeze_hand_reassuringly.action.json` - ID, scope, required_conditions, colors updated
3. `actions/warm_hands_between_yours.action.json` - ID, scope, required_conditions, colors updated

### Components (2 files modified)
1. `components/holding_hand.component.json` - ID updated
2. `components/hand_held.component.json` - ID updated

### Conditions (4 files modified)
1. `conditions/actors-are-holding-hands.condition.json` - ID and component references updated
2. `conditions/event-is-action-hold-hand.condition.json` - ID and action reference updated
3. `conditions/event-is-action-squeeze-hand-reassuringly.condition.json` - ID and action reference updated
4. `conditions/event-is-action-warm-hands-between-yours.condition.json` - ID and action reference updated

### Rules (3 files modified)
1. `rules/handle_hold_hand.rule.json` - Condition reference and component types updated
2. `rules/handle_squeeze_hand_reassuringly.rule.json` - Condition reference updated
3. `rules/handle_warm_hands_between_yours.rule.json` - Condition reference updated

## Testing

### Comprehensive Validation

```bash
# Run full validation test suite
node scripts/validateMods.js --mod hand_holding

# Validate visual contrast (WCAG compliance)
node scripts/validateVisualContrast.js

# Expected: All actions pass WCAG AA minimum (Velvet Twilight achieves AAA)
```

## Rollback Plan

If remapping errors are discovered:

```bash
# Revert all changes to hand_holding files
git checkout data/mods/hand_holding/

# Or restore from HANHOLMIG-003 commit
git reset --hard <HANHOLMIG-003-commit-hash>

# Re-apply changes carefully with corrected patterns
```

## Commit Strategy

**Single atomic commit**:
```bash
git add data/mods/hand_holding/
git commit -m "HANHOLMIG-004: Complete namespace remapping and color scheme update

Namespace updates (affection: → hand_holding:):
- 3 action IDs updated
- 2 component IDs updated
- 4 condition IDs updated
- All component references in logic updated
- All action references in conditions updated
- All condition references in rules updated

Scope reference updates:
- All actions now reference positioning:close_actors_facing_each_other_or_behind_target

Color scheme applied:
- Velvet Twilight scheme applied to all 3 actions
- Achieves WCAG AAA contrast (15.01:1 normal, 11.45:1 hover)

All 12 files updated successfully.
No affection: namespace references remain."
```

## Success Criteria

Remapping is successful when:
- ✅ All files use hand_holding: namespace for their content
- ✅ No affection: namespace references remain in hand_holding mod
- ✅ All scope references use positioning: namespace
- ✅ Velvet Twilight color scheme applied to all actions
- ✅ All files remain valid JSON
- ✅ Validation scripts pass without errors
- ✅ Visual contrast validation passes (WCAG AAA)

## Next Steps

After this ticket is complete and committed:
1. Verify clean commit with `git status`
2. Run validation: `node scripts/validateMods.js --mod hand_holding`
3. Proceed to **HANHOLMIG-005** (Affection Mod Cleanup)

---

**Critical Note**: This is the most error-prone ticket. Take time to verify every replacement. Use bulk find/replace tools carefully and verify results before committing.
