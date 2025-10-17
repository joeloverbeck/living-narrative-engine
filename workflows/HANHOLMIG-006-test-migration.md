# HANHOLMIG-006: Test Migration

**Status**: Ready for Implementation
**Priority**: High
**Estimated Time**: 1-1.5 hours
**Risk Level**: Medium (test file modifications)

## Overview

This ticket migrates all hand-holding test files from `tests/integration/mods/affection/` to `tests/integration/mods/hand_holding/`. It updates all test imports, references, configurations, and assertions to use the new `hand_holding` namespace. This ensures comprehensive test coverage for the migrated mod.

## Prerequisites

- [x] **HANHOLMIG-001 complete**: Scope migration finished
- [x] **HANHOLMIG-002 complete**: Mod structure created
- [x] **HANHOLMIG-003 complete**: Files copied
- [x] **HANHOLMIG-004 complete**: Namespace remapping done
- [x] **HANHOLMIG-005 complete**: Affection cleanup done
- [ ] Clean git working directory
- [ ] Feature branch: `feature/hand-holding-mod-migration` active

## Test Files to Migrate

**Total files to migrate**: 7 integration test files

**Source**: `tests/integration/mods/affection/`
**Destination**: `tests/integration/mods/hand_holding/`

### Files List

1. `hold_hand_action.test.js`
2. `hold_hand_action_discovery.test.js`
3. `hold_hand_first_time.integration.test.js`
4. `squeeze_hand_reassuringly_action.test.js`
5. `squeeze_hand_reassuringly_action_discovery.test.js`
6. `warm_hands_between_yours_action.test.js`
7. `warm_hands_between_yours_action_discovery.test.js`

## Detailed Steps

### Step 1: Create Test Directory Structure

**Create destination directory**:
```bash
mkdir -p tests/integration/mods/hand_holding
```

**Verification**:
```bash
ls -la tests/integration/mods/ | grep hand_holding
# Should show: hand_holding/
```

### Step 2: Copy Test Files (7 files)

**Copy all test files**:
```bash
# Copy test files one by one
cp tests/integration/mods/affection/hold_hand_action.test.js \
   tests/integration/mods/hand_holding/hold_hand_action.test.js

cp tests/integration/mods/affection/hold_hand_action_discovery.test.js \
   tests/integration/mods/hand_holding/hold_hand_action_discovery.test.js

cp tests/integration/mods/affection/hold_hand_first_time.integration.test.js \
   tests/integration/mods/hand_holding/hold_hand_first_time.integration.test.js

cp tests/integration/mods/affection/squeeze_hand_reassuringly_action.test.js \
   tests/integration/mods/hand_holding/squeeze_hand_reassuringly_action.test.js

cp tests/integration/mods/affection/squeeze_hand_reassuringly_action_discovery.test.js \
   tests/integration/mods/hand_holding/squeeze_hand_reassuringly_action_discovery.test.js

cp tests/integration/mods/affection/warm_hands_between_yours_action.test.js \
   tests/integration/mods/hand_holding/warm_hands_between_yours_action.test.js

cp tests/integration/mods/affection/warm_hands_between_yours_action_discovery.test.js \
   tests/integration/mods/hand_holding/warm_hands_between_yours_action_discovery.test.js
```

**Verification**:
```bash
ls tests/integration/mods/hand_holding/*.test.js | wc -l
# Should return: 7
```

### Step 3: Update Test File References

For each test file, perform the following updates:

#### Common Updates for ALL Test Files

**Pattern 1: Mod loading in test bed**
```javascript
// Find:
testBed.loadMod('affection');
// Replace with:
testBed.loadMod('hand_holding');
```

**Pattern 2: Action ID references**
```javascript
// Find: affection:hold_hand
// Replace with: hand_holding:hold_hand

// Find: affection:squeeze_hand_reassuringly
// Replace with: hand_holding:squeeze_hand_reassuringly

// Find: affection:warm_hands_between_yours
// Replace with: hand_holding:warm_hands_between_yours
```

**Pattern 3: Component references**
```javascript
// Find: 'affection:holding_hand'
// Replace with: 'hand_holding:holding_hand'

// Find: 'affection:hand_held'
// Replace with: 'hand_holding:hand_held'
```

**Pattern 4: Condition references**
```javascript
// Find: 'affection:actors-are-holding-hands'
// Replace with: 'hand_holding:actors-are-holding-hands'
```

**Pattern 5: Test describe blocks**
```javascript
// Find: describe('Affection Mod - Hold Hand Action', ...)
// Replace with: describe('Hand Holding Mod - Hold Hand Action', ...)

// Similarly for other describe blocks mentioning "Affection"
```

### Step 4: File-Specific Updates

#### File 1: hold_hand_action.test.js

**Updates required**:
- Update test bed mod loading
- Update action ID assertions
- Update component references in expectations
- Update test descriptions

**Key changes**:
```javascript
// Mod loading
- testBed.loadMod('affection');
+ testBed.loadMod('hand_holding');

// Action ID
- expect(result.actionId).toBe('affection:hold_hand');
+ expect(result.actionId).toBe('hand_holding:hold_hand');

// Component assertions
- expect(actor.components['affection:holding_hand']).toBeDefined();
+ expect(actor.components['hand_holding:holding_hand']).toBeDefined();

- expect(target.components['affection:hand_held']).toBeDefined();
+ expect(target.components['hand_holding:hand_held']).toBeDefined();
```

#### File 2: hold_hand_action_discovery.test.js

**Updates required**:
- Update mod loading
- Update action ID in discovery assertions
- Update forbidden_components checks

**Key changes**:
```javascript
// Action discovery
- expect(actions).toContain('affection:hold_hand');
+ expect(actions).toContain('hand_holding:hold_hand');
```

#### File 3: hold_hand_first_time.integration.test.js

**Updates required**:
- Update mod loading
- Update action and component references
- Update any mock data or fixtures

**Key changes**: Similar to File 1, plus any integration-specific references

#### Files 4-7: squeeze_hand_reassuringly and warm_hands_between_yours tests

**Updates required**: Same patterns as Files 1-2, with appropriate action names

### Step 5: Bulk Find/Replace Strategy

**Use text editor with multi-file find/replace** for efficiency:

**Replacements to apply across all test files**:

```
1. "affection:hold_hand" → "hand_holding:hold_hand"
2. "affection:squeeze_hand_reassuringly" → "hand_holding:squeeze_hand_reassuringly"
3. "affection:warm_hands_between_yours" → "hand_holding:warm_hands_between_yours"
4. "affection:holding_hand" → "hand_holding:holding_hand"
5. "affection:hand_held" → "hand_holding:hand_held"
6. "affection:actors-are-holding-hands" → "hand_holding:actors-are-holding-hands"
7. testBed.loadMod('affection') → testBed.loadMod('hand_holding')
8. "Affection Mod -" → "Hand Holding Mod -" (in describe blocks)
```

### Step 6: Delete Original Test Files from Affection

**After updating hand_holding tests, delete originals**:
```bash
rm tests/integration/mods/affection/hold_hand_action.test.js
rm tests/integration/mods/affection/hold_hand_action_discovery.test.js
rm tests/integration/mods/affection/hold_hand_first_time.integration.test.js
rm tests/integration/mods/affection/squeeze_hand_reassuringly_action.test.js
rm tests/integration/mods/affection/squeeze_hand_reassuringly_action_discovery.test.js
rm tests/integration/mods/affection/warm_hands_between_yours_action.test.js
rm tests/integration/mods/affection/warm_hands_between_yours_action_discovery.test.js
```

**Verification**:
```bash
ls tests/integration/mods/affection/*hand*.test.js 2>/dev/null
# Should return: NO RESULTS
```

### Step 7: Review Performance Test (if necessary)

**File to review**: `tests/performance/common/mods/ModTestHandlerFactory.performance.test.js`

**Check if it references hand_held component**:
```bash
grep -n "hand_held\|holding_hand" tests/performance/common/mods/ModTestHandlerFactory.performance.test.js
```

**If references found**:
- Update component references to use `hand_holding:` namespace
- Update any test data or mocks

**If no references**: No action needed for this file.

### Step 8: Verify All Test References Updated

**Search for old namespace references**:
```bash
grep -r "affection:hold_hand" tests/integration/mods/hand_holding/
grep -r "affection:holding_hand" tests/integration/mods/hand_holding/
grep -r "affection:hand_held" tests/integration/mods/hand_holding/
grep -r "affection:actors-are-holding-hands" tests/integration/mods/hand_holding/
grep -r "loadMod('affection')" tests/integration/mods/hand_holding/

# All should return: NO RESULTS
```

## Validation Criteria

### Test Migration Checklist

- [ ] All 7 test files copied to `tests/integration/mods/hand_holding/`
- [ ] All mod loading calls use `hand_holding` instead of `affection`
- [ ] All action ID references use `hand_holding:` namespace
- [ ] All component references use `hand_holding:` namespace
- [ ] All condition references use `hand_holding:` namespace
- [ ] All test descriptions updated (Affection → Hand Holding)
- [ ] No references to `affection:` namespace remain in hand_holding tests
- [ ] Original test files deleted from affection directory
- [ ] Performance test reviewed and updated if necessary
- [ ] All test files are valid JavaScript syntax

### Validation Commands

```bash
# Count test files in destination
ls tests/integration/mods/hand_holding/*.test.js | wc -l
# Should return: 7

# Verify no old namespace references
bash -c 'found=0; for ns in "affection:hold_hand" "affection:holding_hand" "affection:hand_held" "loadMod('\''affection'\'')"; do
  if grep -rq "$ns" tests/integration/mods/hand_holding/; then
    echo "✗ Found old reference: $ns"; found=1;
  fi;
done;
[ $found -eq 0 ] && echo "✓ No old references in hand_holding tests" || echo "✗ Old references still exist"'

# Verify old tests deleted from affection
ls tests/integration/mods/affection/*hand*.test.js 2>/dev/null | wc -l
# Should return: 0

# Syntax check all test files
for file in tests/integration/mods/hand_holding/*.test.js; do
  node --check "$file" && echo "✓ $file" || echo "✗ $file SYNTAX ERROR"
done
```

## Testing

### Quick Verification Test

**Run migrated tests**:
```bash
npm run test:integration -- tests/integration/mods/hand_holding/
```

**Expected result**:
- Tests should run (may fail if hand_holding mod not yet in game.json)
- No errors about missing `affection` mod references
- Test structure intact

**Note**: Tests may not fully pass until HANHOLMIG-008 (game.json integration), but they should at least load and attempt to run.

## Files Modified

### Test Files Migrated (7 files)

**Created in** `tests/integration/mods/hand_holding/`:
1. `hold_hand_action.test.js` (updated)
2. `hold_hand_action_discovery.test.js` (updated)
3. `hold_hand_first_time.integration.test.js` (updated)
4. `squeeze_hand_reassuringly_action.test.js` (updated)
5. `squeeze_hand_reassuringly_action_discovery.test.js` (updated)
6. `warm_hands_between_yours_action.test.js` (updated)
7. `warm_hands_between_yours_action_discovery.test.js` (updated)

**Deleted from** `tests/integration/mods/affection/`:
- Same 7 files removed

**Potentially modified**:
- `tests/performance/common/mods/ModTestHandlerFactory.performance.test.js` (if references found)

## Rollback Plan

If test migration has issues:

```bash
# Restore original tests to affection
git checkout tests/integration/mods/affection/

# Remove migrated tests
rm -rf tests/integration/mods/hand_holding/

# Re-apply migration carefully with corrections
```

## Commit Strategy

**Single atomic commit**:
```bash
git add tests/integration/mods/hand_holding/ tests/integration/mods/affection/ tests/performance/
git commit -m "HANHOLMIG-006: Migrate hand-holding tests to hand_holding mod

Test migration:
- Move 7 integration test files from affection to hand_holding
- Update all mod loading calls (affection → hand_holding)
- Update all namespace references (affection: → hand_holding:)
- Update test descriptions (Affection Mod → Hand Holding Mod)
- Delete original test files from affection directory

Updated tests:
- hold_hand_action.test.js
- hold_hand_action_discovery.test.js
- hold_hand_first_time.integration.test.js
- squeeze_hand_reassuringly_action.test.js
- squeeze_hand_reassuringly_action_discovery.test.js
- warm_hands_between_yours_action.test.js
- warm_hands_between_yours_action_discovery.test.js

Performance test reviewed (updated if necessary).

Tests ready for validation in HANHOLMIG-007."
```

## Success Criteria

Migration is successful when:
- ✅ All 7 test files migrated to hand_holding directory
- ✅ All test files updated with new namespace references
- ✅ No `affection:` references remain in hand_holding tests
- ✅ Original test files deleted from affection directory
- ✅ All test files have valid JavaScript syntax
- ✅ Tests attempt to run (may not fully pass until game.json update)

## Next Steps

After this ticket is complete and committed:
1. Verify clean commit with `git status`
2. Attempt test run: `npm run test:integration -- tests/integration/mods/hand_holding/`
3. Proceed to **HANHOLMIG-007** (Validation and Testing)

---

**Note**: Tests may not fully pass until hand_holding mod is added to game.json (HANHOLMIG-008), but they should load and attempt to run without reference errors.
