# HANHOLMIG-003: File Migration

**Status**: Ready for Implementation
**Priority**: High
**Estimated Time**: 30-45 minutes
**Risk Level**: Low (pure copy operation, no modifications)

## Overview

This ticket covers the pure file copy operation from the `affection` mod to the new `hand_holding` mod structure. **No namespace updates or content modifications are performed in this ticket** - those changes happen in HANHOLMIG-004. This separation ensures clean version control history and easier rollback if needed.

## Prerequisites

- [x] **HANHOLMIG-001 complete**: Scope migration finished and tested
- [x] **HANHOLMIG-002 complete**: hand_holding mod structure created
- [ ] Clean git working directory
- [ ] Feature branch: `feature/hand-holding-mod-migration` active

## File Migration Overview

**Total files to copy**: 12 files
- 3 action files
- 2 component files
- 4 condition files
- 3 rule files

**Source mod**: `data/mods/affection/`
**Destination mod**: `data/mods/hand_holding/`

## Detailed Steps

### Step 1: Verify Source Files Exist

**Verification command**:
```bash
# Check all source files exist before copying
ls data/mods/affection/actions/hold_hand.action.json
ls data/mods/affection/actions/squeeze_hand_reassuringly.action.json
ls data/mods/affection/actions/warm_hands_between_yours.action.json
ls data/mods/affection/components/holding_hand.component.json
ls data/mods/affection/components/hand_held.component.json
ls data/mods/affection/conditions/actors-are-holding-hands.condition.json
ls data/mods/affection/conditions/event-is-action-hold-hand.condition.json
ls data/mods/affection/conditions/event-is-action-squeeze-hand-reassuringly.condition.json
ls data/mods/affection/conditions/event-is-action-warm-hands-between-yours.condition.json
ls data/mods/affection/rules/handle_hold_hand.rule.json
ls data/mods/affection/rules/handle_squeeze_hand_reassuringly.rule.json
ls data/mods/affection/rules/handle_warm_hands_between_yours.rule.json
```

**Expected result**: All 12 files should exist. If any are missing, STOP and investigate.

### Step 2: Copy Action Files (3 files)

**Source**: `data/mods/affection/actions/`
**Destination**: `data/mods/hand_holding/actions/`

```bash
# Copy action files
cp data/mods/affection/actions/hold_hand.action.json \
   data/mods/hand_holding/actions/hold_hand.action.json

cp data/mods/affection/actions/squeeze_hand_reassuringly.action.json \
   data/mods/hand_holding/actions/squeeze_hand_reassuringly.action.json

cp data/mods/affection/actions/warm_hands_between_yours.action.json \
   data/mods/hand_holding/actions/warm_hands_between_yours.action.json
```

**Verification**:
```bash
ls -la data/mods/hand_holding/actions/
# Should show: hold_hand.action.json, squeeze_hand_reassuringly.action.json, warm_hands_between_yours.action.json
```

### Step 3: Copy Component Files (2 files)

**Source**: `data/mods/affection/components/`
**Destination**: `data/mods/hand_holding/components/`

```bash
# Copy component files
cp data/mods/affection/components/holding_hand.component.json \
   data/mods/hand_holding/components/holding_hand.component.json

cp data/mods/affection/components/hand_held.component.json \
   data/mods/hand_holding/components/hand_held.component.json
```

**Verification**:
```bash
ls -la data/mods/hand_holding/components/
# Should show: holding_hand.component.json, hand_held.component.json
```

### Step 4: Copy Condition Files (4 files)

**Source**: `data/mods/affection/conditions/`
**Destination**: `data/mods/hand_holding/conditions/`

```bash
# Copy condition files
cp data/mods/affection/conditions/actors-are-holding-hands.condition.json \
   data/mods/hand_holding/conditions/actors-are-holding-hands.condition.json

cp data/mods/affection/conditions/event-is-action-hold-hand.condition.json \
   data/mods/hand_holding/conditions/event-is-action-hold-hand.condition.json

cp data/mods/affection/conditions/event-is-action-squeeze-hand-reassuringly.condition.json \
   data/mods/hand_holding/conditions/event-is-action-squeeze-hand-reassuringly.condition.json

cp data/mods/affection/conditions/event-is-action-warm-hands-between-yours.condition.json \
   data/mods/hand_holding/conditions/event-is-action-warm-hands-between-yours.condition.json
```

**Verification**:
```bash
ls -la data/mods/hand_holding/conditions/
# Should show: 4 condition files
```

### Step 5: Copy Rule Files (3 files)

**Source**: `data/mods/affection/rules/`
**Destination**: `data/mods/hand_holding/rules/`

```bash
# Copy rule files
cp data/mods/affection/rules/handle_hold_hand.rule.json \
   data/mods/hand_holding/rules/handle_hold_hand.rule.json

cp data/mods/affection/rules/handle_squeeze_hand_reassuringly.rule.json \
   data/mods/hand_holding/rules/handle_squeeze_hand_reassuringly.rule.json

cp data/mods/affection/rules/handle_warm_hands_between_yours.rule.json \
   data/mods/hand_holding/rules/handle_warm_hands_between_yours.rule.json
```

**Verification**:
```bash
ls -la data/mods/hand_holding/rules/
# Should show: 3 rule files
```

### Step 6: Verify All Files Copied

**Count files in destination**:
```bash
echo "Actions: $(ls data/mods/hand_holding/actions/*.json 2>/dev/null | wc -l)"
echo "Components: $(ls data/mods/hand_holding/components/*.json 2>/dev/null | wc -l)"
echo "Conditions: $(ls data/mods/hand_holding/conditions/*.json 2>/dev/null | wc -l)"
echo "Rules: $(ls data/mods/hand_holding/rules/*.json 2>/dev/null | wc -l)"
```

**Expected output**:
```
Actions: 3
Components: 2
Conditions: 4
Rules: 3
```

### Step 7: Verify Files Are Valid JSON

**Quick validation**:
```bash
# Test all files are valid JSON
for file in data/mods/hand_holding/**/*.json; do
  echo "Checking $file..."
  cat "$file" | jq '.' > /dev/null && echo "✓ Valid JSON" || echo "✗ Invalid JSON"
done
```

**Expected result**: All files should be valid JSON.

### Step 8: Compare File Sizes (Sanity Check)

**Verify copied files match source**:
```bash
# Compare file sizes between source and destination
diff <(ls -l data/mods/affection/actions/*.json | awk '{print $5, $9}') \
     <(ls -l data/mods/hand_holding/actions/*.json | awk '{print $5, $9}' | sed 's/hand_holding/affection/g')

# Repeat for other directories
diff <(ls -l data/mods/affection/components/*.json | awk '{print $5, $9}') \
     <(ls -l data/mods/hand_holding/components/*.json | awk '{print $5, $9}' | sed 's/hand_holding/affection/g')

diff <(ls -l data/mods/affection/conditions/*.json | awk '{print $5, $9}') \
     <(ls -l data/mods/hand_holding/conditions/*.json | awk '{print $5, $9}' | sed 's/hand_holding/affection/g')

diff <(ls -l data/mods/affection/rules/*.json | awk '{print $5, $9}') \
     <(ls -l data/mods/hand_holding/rules/*.json | awk '{print $5, $9}' | sed 's/hand_holding/affection/g')
```

**Expected result**: No differences (files should match exactly).

## Validation Criteria

### Migration Checklist

- [ ] All 3 action files copied to `hand_holding/actions/`
- [ ] All 2 component files copied to `hand_holding/components/`
- [ ] All 4 condition files copied to `hand_holding/conditions/`
- [ ] All 3 rule files copied to `hand_holding/rules/`
- [ ] All copied files are valid JSON
- [ ] File sizes match between source and destination
- [ ] Total of 12 files in hand_holding mod
- [ ] No files modified during copy (pure copy operation)

### Validation Commands

```bash
# Comprehensive file count
find data/mods/hand_holding/ -name "*.json" -type f | wc -l
# Should return: 13 (12 content files + 1 mod-manifest.json)

# Verify all required files exist
for file in \
  actions/hold_hand.action.json \
  actions/squeeze_hand_reassuringly.action.json \
  actions/warm_hands_between_yours.action.json \
  components/holding_hand.component.json \
  components/hand_held.component.json \
  conditions/actors-are-holding-hands.condition.json \
  conditions/event-is-action-hold-hand.condition.json \
  conditions/event-is-action-squeeze-hand-reassuringly.condition.json \
  conditions/event-is-action-warm-hands-between-yours.condition.json \
  rules/handle_hold_hand.rule.json \
  rules/handle_squeeze_hand_reassuringly.rule.json \
  rules/handle_warm_hands_between_yours.rule.json; do
    test -f "data/mods/hand_holding/$file" && echo "✓ $file" || echo "✗ $file MISSING"
done
```

## Files Copied

### Complete File List

**Actions (3)**:
1. `data/mods/hand_holding/actions/hold_hand.action.json`
2. `data/mods/hand_holding/actions/squeeze_hand_reassuringly.action.json`
3. `data/mods/hand_holding/actions/warm_hands_between_yours.action.json`

**Components (2)**:
1. `data/mods/hand_holding/components/holding_hand.component.json`
2. `data/mods/hand_holding/components/hand_held.component.json`

**Conditions (4)**:
1. `data/mods/hand_holding/conditions/actors-are-holding-hands.condition.json`
2. `data/mods/hand_holding/conditions/event-is-action-hold-hand.condition.json`
3. `data/mods/hand_holding/conditions/event-is-action-squeeze-hand-reassuringly.condition.json`
4. `data/mods/hand_holding/conditions/event-is-action-warm-hands-between-yours.condition.json`

**Rules (3)**:
1. `data/mods/hand_holding/rules/handle_hold_hand.rule.json`
2. `data/mods/hand_holding/rules/handle_squeeze_hand_reassuringly.rule.json`
3. `data/mods/hand_holding/rules/handle_warm_hands_between_yours.rule.json`

## Important Notes

### What This Ticket Does NOT Do

**No modifications are made in this ticket**:
- ❌ No namespace updates (affection: → hand_holding:)
- ❌ No color scheme changes
- ❌ No scope reference updates
- ❌ No ID remapping
- ❌ No content edits of any kind

**Rationale**:
- Clean separation of copy vs. modify operations
- Easier to review in git history
- Simpler rollback if needed
- Clear phase boundaries

### Files Still Reference Old Namespaces

After this ticket, files will still contain:
- `"id": "affection:hold_hand"` (not yet updated)
- `"scope": "affection:close_actors..."` (not yet updated)
- Old color scheme (not yet updated)
- Component references with `affection:` namespace

**These will be updated in HANHOLMIG-004** (ID Namespace Remapping).

## Testing

### Verification Tests

**Test 1: File existence**
```bash
test $(find data/mods/hand_holding/ -name "*.json" -not -name "mod-manifest.json" | wc -l) -eq 12 \
  && echo "✓ All 12 files copied" || echo "✗ File count mismatch"
```

**Test 2: Valid JSON**
```bash
find data/mods/hand_holding/ -name "*.json" -exec sh -c 'jq empty "$1" 2>/dev/null || echo "Invalid: $1"' _ {} \;
# Should not output any "Invalid" messages
```

**Test 3: Content integrity**
```bash
# Verify first action file still has affection namespace (expected at this stage)
grep -q "affection:hold_hand" data/mods/hand_holding/actions/hold_hand.action.json \
  && echo "✓ File not modified (affection namespace preserved)" \
  || echo "✗ File appears modified"
```

## Rollback Plan

If files need to be re-copied:

```bash
# Delete all copied files
rm -rf data/mods/hand_holding/actions/*.json
rm -rf data/mods/hand_holding/components/*.json
rm -rf data/mods/hand_holding/conditions/*.json
rm -rf data/mods/hand_holding/rules/*.json

# Re-run copy commands from Steps 2-5
```

## Commit Strategy

**Single atomic commit**:
```bash
git add data/mods/hand_holding/
git commit -m "HANHOLMIG-003: Copy 12 files from affection to hand_holding mod

- Copy 3 action files (hold_hand, squeeze_hand_reassuringly, warm_hands_between_yours)
- Copy 2 component files (holding_hand, hand_held)
- Copy 4 condition files (actors-are-holding-hands, event-is-action-*)
- Copy 3 rule files (handle_hold_hand, handle_squeeze_hand_reassuringly, handle_warm_hands_between_yours)

Pure copy operation - NO modifications made yet.
Files still reference affection namespace (will update in HANHOLMIG-004).

Total: 12 files copied successfully."
```

## Success Criteria

Migration is successful when:
- ✅ All 12 files exist in hand_holding mod
- ✅ All files are valid JSON
- ✅ File sizes match source files exactly
- ✅ No modifications made to file contents
- ✅ Files still reference old namespaces (expected)
- ✅ All validation commands pass

## Next Steps

After this ticket is complete and committed:
1. Verify clean commit with `git status`
2. Proceed to **HANHOLMIG-004** (ID Namespace Remapping)

---

**Note**: Files are copied but not yet updated. HANHOLMIG-004 will perform all namespace remapping and color scheme updates.
