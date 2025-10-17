# HANHOLMIG-005: Affection Mod Cleanup

**Status**: Ready for Implementation
**Priority**: High
**Estimated Time**: 45-60 minutes
**Risk Level**: Medium (affects existing affection mod)

## Overview

This ticket completes the migration by removing hand-holding content from the affection mod. It updates the affection mod-manifest.json to remove migrated items, deletes the physical files, tests that remaining affection functionality works correctly, and updates the color scheme documentation.

**Critical**: Backup before deleting files. Test affection mod thoroughly after cleanup.

## Prerequisites

- [x] **HANHOLMIG-001 complete**: Scope migration finished
- [x] **HANHOLMIG-002 complete**: Mod structure created
- [x] **HANHOLMIG-003 complete**: Files copied
- [x] **HANHOLMIG-004 complete**: Namespace remapping done
- [ ] Clean git working directory
- [ ] Feature branch: `feature/hand-holding-mod-migration` active

## Detailed Steps

### Step 1: Backup Affection Mod (Recommended)

**Safety measure before deletion**:
```bash
# Create backup
cp -r data/mods/affection/ data/mods/affection.backup

# Or commit current state
git add data/mods/affection/
git commit -m "Pre-cleanup: Backup affection mod state"
```

### Step 2: Update Affection Mod Manifest

**File to edit**: `data/mods/affection/mod-manifest.json`

#### Remove from content.actions array (3 items)

Find and remove:
```json
"hold_hand",
"squeeze_hand_reassuringly",
"warm_hands_between_yours"
```

**Before (example)**:
```json
"actions": [
  "other_action",
  "hold_hand",
  "squeeze_hand_reassuringly",
  "warm_hands_between_yours",
  "another_action"
]
```

**After**:
```json
"actions": [
  "other_action",
  "another_action"
]
```

#### Remove from content.components array (2 items)

Find and remove:
```json
"holding_hand",
"hand_held"
```

#### Remove from content.conditions array (4 items)

Find and remove:
```json
"actors-are-holding-hands",
"event-is-action-hold-hand",
"event-is-action-squeeze-hand-reassuringly",
"event-is-action-warm-hands-between-yours"
```

#### Remove from content.rules array (3 items)

Find and remove:
```json
"handle_hold_hand",
"handle_squeeze_hand_reassuringly",
"handle_warm_hands_between_yours"
```

#### Verify JSON Validity After Edits

**Important**: Ensure proper JSON syntax after removals:
- Check comma placement (no trailing commas, no missing commas)
- Ensure arrays are properly closed
- Validate JSON structure

**Validation command**:
```bash
cat data/mods/affection/mod-manifest.json | jq '.'
# Should parse successfully without errors
```

### Step 3: Delete Physical Files from Affection Mod

#### Delete Action Files (3 files)

```bash
rm data/mods/affection/actions/hold_hand.action.json
rm data/mods/affection/actions/squeeze_hand_reassuringly.action.json
rm data/mods/affection/actions/warm_hands_between_yours.action.json
```

**Verification**:
```bash
ls data/mods/affection/actions/ | grep -E "hold_hand|squeeze_hand|warm_hands"
# Should return: NO RESULTS
```

#### Delete Component Files (2 files)

```bash
rm data/mods/affection/components/holding_hand.component.json
rm data/mods/affection/components/hand_held.component.json
```

**Verification**:
```bash
ls data/mods/affection/components/ | grep -E "holding_hand|hand_held"
# Should return: NO RESULTS
```

#### Delete Condition Files (4 files)

```bash
rm data/mods/affection/conditions/actors-are-holding-hands.condition.json
rm data/mods/affection/conditions/event-is-action-hold-hand.condition.json
rm data/mods/affection/conditions/event-is-action-squeeze-hand-reassuringly.condition.json
rm data/mods/affection/conditions/event-is-action-warm-hands-between-yours.condition.json
```

**Verification**:
```bash
ls data/mods/affection/conditions/ | grep -E "holding-hands|hold-hand|squeeze-hand|warm-hands"
# Should return: NO RESULTS
```

#### Delete Rule Files (3 files)

```bash
rm data/mods/affection/rules/handle_hold_hand.rule.json
rm data/mods/affection/rules/handle_squeeze_hand_reassuringly.rule.json
rm data/mods/affection/rules/handle_warm_hands_between_yours.rule.json
```

**Verification**:
```bash
ls data/mods/affection/rules/ | grep -E "hold_hand|squeeze_hand|warm_hands"
# Should return: NO RESULTS
```

### Step 4: Verify Affection Mod Manifest Accuracy

**Count remaining items**:
```bash
echo "Actions: $(cat data/mods/affection/mod-manifest.json | jq '.content.actions | length')"
echo "Components: $(cat data/mods/affection/mod-manifest.json | jq '.content.components | length')"
echo "Conditions: $(cat data/mods/affection/mod-manifest.json | jq '.content.conditions | length')"
echo "Rules: $(cat data/mods/affection/mod-manifest.json | jq '.content.rules | length')"
```

**Cross-check with physical files**:
```bash
echo "Physical actions: $(ls data/mods/affection/actions/*.json 2>/dev/null | wc -l)"
echo "Physical components: $(ls data/mods/affection/components/*.json 2>/dev/null | wc -l)"
echo "Physical conditions: $(ls data/mods/affection/conditions/*.json 2>/dev/null | wc -l)"
echo "Physical rules: $(ls data/mods/affection/rules/*.json 2>/dev/null | wc -l)"

# Manifest counts should match physical file counts
```

### Step 5: Validate Affection Mod Still Loads

**Run mod validation**:
```bash
node scripts/validateMods.js --mod affection
```

**Expected result**: Affection mod passes validation with reduced content list.

### Step 6: Test Affection Mod Functionality

**Run affection integration tests**:
```bash
npm run test:integration -- tests/integration/mods/affection/
```

**Expected results**:
- Tests for remaining affection actions pass
- No errors related to missing hand-holding files
- Affection mod loads correctly in test environment

**Manual verification** (if development environment available):
```bash
npm run start
# Check browser console for:
# - Affection mod loads without errors
# - No references to missing hand-holding files
# - Other affection actions discoverable
```

### Step 7: Update Color Scheme Documentation

**File to edit**: `specs/wcag-compliant-color-combinations.spec.md`

#### Find Velvet Twilight Section (Section 11.3)

Locate this section in the spec file.

#### Add Usage Documentation

**After the contrast information, add**:
```markdown
- ✅ **USED BY**: Hand Holding mod (hand-holding interactions, state-based gestures)
```

**Full section should look like**:
```markdown
### 11.3 Velvet Twilight

**Theme**: Luxurious nightfall, refined intrigue, intimate connection

**Colors**:
- Background: #2c0e37
- Text: #ffebf0
- Hover Background: #451952
- Hover Text: #f3e5f5

**Contrast Ratios**:
- Normal: 15.01:1 🌟 AAA
- Hover: 11.45:1 🌟 AAA

- ✅ **USED BY**: Hand Holding mod (hand-holding interactions, state-based gestures)
```

#### Verify Documentation Syntax

```bash
# Check markdown is valid
cat specs/wcag-compliant-color-combinations.spec.md | grep -A10 "Velvet Twilight"
# Should show updated section with USED BY line
```

### Step 8: Optional - Consider Affection Dependency on Hand_Holding

**Decision point**: Does affection mod need to depend on hand_holding?

**Consider adding dependency if**:
- Future affection actions will check for hand-holding state
- Affection actions need to interact with hand-holding components

**If yes, update affection mod-manifest.json**:
```json
{
  "dependencies": [
    {
      "id": "hand_holding",
      "version": "^1.0.0"
    }
  ]
}
```

**Recommendation from spec**: Only add if future cross-dependency is certain. Otherwise, leave independent.

## Validation Criteria

### Affection Mod Cleanup Checklist

- [ ] 3 action files removed from affection/actions/
- [ ] 2 component files removed from affection/components/
- [ ] 4 condition files removed from affection/conditions/
- [ ] 3 rule files removed from affection/rules/
- [ ] Affection mod-manifest.json updated (12 items removed)
- [ ] Affection mod-manifest.json is valid JSON
- [ ] Manifest counts match physical file counts
- [ ] No hand-holding files remain in affection mod
- [ ] Affection mod validation passes
- [ ] Affection integration tests pass
- [ ] Color scheme documentation updated

### Validation Commands

```bash
# Verify no hand-holding files remain
find data/mods/affection/ -name "*hold*" -o -name "*hand*" | grep -v ".backup"
# Should return: NO RESULTS (or only unrelated files)

# Verify manifest is valid
node scripts/validateMods.js --mod affection

# Verify manifest/file count consistency
diff <(cat data/mods/affection/mod-manifest.json | jq -r '.content.actions[]' | sort) \
     <(ls data/mods/affection/actions/*.json | xargs -n1 basename | sed 's/.action.json//' | sort)
# Should return: NO DIFFERENCES

# Run affection tests
npm run test:integration -- tests/integration/mods/affection/

# Verify color scheme doc updated
grep -A1 "Velvet Twilight" specs/wcag-compliant-color-combinations.spec.md | grep "USED BY.*Hand Holding"
# Should find the usage line
```

## Files Modified

### Affection Mod Changes

**Modified**:
- `data/mods/affection/mod-manifest.json` (12 items removed from content arrays)

**Deleted** (12 files):
- `data/mods/affection/actions/hold_hand.action.json`
- `data/mods/affection/actions/squeeze_hand_reassuringly.action.json`
- `data/mods/affection/actions/warm_hands_between_yours.action.json`
- `data/mods/affection/components/holding_hand.component.json`
- `data/mods/affection/components/hand_held.component.json`
- `data/mods/affection/conditions/actors-are-holding-hands.condition.json`
- `data/mods/affection/conditions/event-is-action-hold-hand.condition.json`
- `data/mods/affection/conditions/event-is-action-squeeze-hand-reassuringly.condition.json`
- `data/mods/affection/conditions/event-is-action-warm-hands-between-yours.condition.json`
- `data/mods/affection/rules/handle_hold_hand.rule.json`
- `data/mods/affection/rules/handle_squeeze_hand_reassuringly.rule.json`
- `data/mods/affection/rules/handle_warm_hands_between_yours.rule.json`

### Documentation Changes

**Modified**:
- `specs/wcag-compliant-color-combinations.spec.md` (added Velvet Twilight usage)

## Testing

### Critical Tests

**Test 1: Affection mod loads correctly**
```bash
npm run start
# Check console for mod loading
# Verify no errors related to hand-holding files
```

**Test 2: Affection tests pass**
```bash
npm run test:integration -- tests/integration/mods/affection/
# All remaining affection tests should pass
```

**Test 3: No broken references**
```bash
# Search for references to deleted files in remaining affection content
grep -r "hold_hand" data/mods/affection/
grep -r "holding_hand" data/mods/affection/
grep -r "hand_held" data/mods/affection/
# Should return: NO RESULTS (except possibly in comments or unrelated contexts)
```

**Test 4: Manifest consistency**
```bash
# Verify manifest lists match physical files
node scripts/validateMods.js --mod affection --strict
```

## Rollback Plan

If affection mod breaks after cleanup:

**Restore from backup**:
```bash
# Remove modified affection mod
rm -rf data/mods/affection/

# Restore from backup
cp -r data/mods/affection.backup/ data/mods/affection/

# Or revert git commit
git revert <this-commit-hash>
```

**Restore specific files**:
```bash
# Restore from git history
git checkout HEAD~1 data/mods/affection/
```

## Commit Strategy

**Two-part commit** (recommended):

**Part 1: File deletions and manifest update**
```bash
git add data/mods/affection/
git commit -m "HANHOLMIG-005: Clean up affection mod after hand_holding migration

- Remove 12 hand-holding files from affection mod
  - 3 actions: hold_hand, squeeze_hand_reassuringly, warm_hands_between_yours
  - 2 components: holding_hand, hand_held
  - 4 conditions: actors-are-holding-hands, event-is-action-*
  - 3 rules: handle_hold_hand, handle_squeeze_hand_reassuringly, handle_warm_hands_between_yours

- Update affection mod-manifest.json to remove migrated items

Affection mod validated and tested.
All remaining affection functionality works correctly."
```

**Part 2: Documentation update**
```bash
git add specs/wcag-compliant-color-combinations.spec.md
git commit -m "HANHOLMIG-005: Update color scheme documentation

- Mark Velvet Twilight as used by Hand Holding mod
- Document usage in WCAG spec file"
```

**Alternative: Single atomic commit**
```bash
git add data/mods/affection/ specs/wcag-compliant-color-combinations.spec.md
git commit -m "HANHOLMIG-005: Clean up affection mod and update documentation

Affection mod cleanup:
- Remove 12 hand-holding files (3 actions, 2 components, 4 conditions, 3 rules)
- Update mod-manifest.json to remove migrated items
- Tested and validated remaining affection functionality

Documentation:
- Mark Velvet Twilight color scheme as used by Hand Holding mod

Migration from affection to hand_holding mod complete on affection side."
```

## Success Criteria

Cleanup is successful when:
- ✅ All 12 hand-holding files deleted from affection mod
- ✅ Affection mod-manifest.json updated correctly
- ✅ Manifest counts match physical file counts
- ✅ Affection mod validation passes
- ✅ Affection integration tests pass
- ✅ No broken references to deleted files
- ✅ Color scheme documentation updated
- ✅ Affection mod loads correctly without errors

## Next Steps

After this ticket is complete and committed:
1. Verify clean commit with `git status`
2. Run full affection test suite to ensure no breaks
3. Proceed to **HANHOLMIG-006** (Test Migration)

---

**Important**: Test thoroughly before proceeding. Affection mod should work perfectly with remaining content after cleanup.
