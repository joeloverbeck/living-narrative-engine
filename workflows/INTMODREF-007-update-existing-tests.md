# INTMODREF-007: Update Existing Tests

**Phase**: 4 - Testing
**Estimated Time**: 1-2 hours
**Dependencies**: INTMODREF-002, INTMODREF-003, INTMODREF-004, INTMODREF-005 (all migrations complete)
**Report Reference**: Testing Requirements - Verify existing tests (lines 665-670)

## Objective

Update all existing tests that reference `intimacy:*` actions, components, or scopes to use the new mod namespaces (affection, kissing, caressing). Ensure the full test suite passes after migration.

## Background

Existing tests may reference intimacy mod content in various ways:
- Direct action ID references in test cases
- Component queries for kissing state
- Scope references in mock data
- Test descriptions mentioning intimacy

All references must be updated to maintain test validity after the refactoring.

## Tasks

### 1. Find All Intimacy Test References

Run comprehensive search across test directories:

```bash
# Search all test files for intimacy references
grep -r "intimacy:" tests/ > intimacy-test-refs.txt

# Count references by test type
echo "Unit tests:"
grep -r "intimacy:" tests/unit/ | wc -l
echo "Integration tests:"
grep -r "intimacy:" tests/integration/ | wc -l
echo "E2E tests:"
grep -r "intimacy:" tests/e2e/ | wc -l

# Find test files that need updating
grep -rl "intimacy:" tests/ | sort | uniq
```

### 2. Categorize Test Updates by Type

Based on search results, categorize tests:

**Unit Tests** - Likely testing intimacy mod logic directly:
- Component tests
- Rule tests
- Condition tests
- Scope tests

**Integration Tests** - Testing intimacy interactions:
- Action workflow tests
- Cross-mod interaction tests
- State management tests

**E2E Tests** - End-to-end gameplay tests:
- Player interaction flows
- NPC behavior tests

### 3. Create Reference Update Script

Create automated script for bulk updates:

```bash
#!/bin/bash
# update-test-refs.sh

# Affection actions
AFFECTION_ACTIONS=(
  "hold_hand" "hug_tight" "brush_hand" "massage_back"
  "massage_shoulders" "sling_arm_around_shoulders"
  "wrap_arm_around_waist" "place_hand_on_waist"
)

# Kissing actions
KISSING_ACTIONS=(
  "kiss_cheek" "peck_on_lips" "lean_in_for_deep_kiss"
  "kiss_back_passionately" "accept_kiss_passively"
  "explore_mouth_with_tongue" "suck_on_tongue" "nibble_lower_lip"
  "cup_face_while_kissing" "break_kiss_gently"
  "pull_back_breathlessly" "pull_back_in_revulsion"
  "kiss_neck_sensually" "suck_on_neck_to_leave_hickey"
  "nibble_earlobe_playfully"
)

# Caressing actions
CARESSING_ACTIONS=(
  "run_thumb_across_lips" "thumb_wipe_cheek" "nuzzle_face_into_neck"
  "lick_lips" "adjust_clothing" "fondle_ass" "caress_abdomen"
  "feel_arm_muscles" "run_fingers_through_hair"
)

# Update function
update_test_references() {
  local test_dir=$1

  # Update affection references
  for action in "${AFFECTION_ACTIONS[@]}"; do
    find "$test_dir" -type f \( -name "*.test.js" -o -name "*.spec.js" \) \
      -exec sed -i "s/'intimacy:$action'/'affection:$action'/g" {} \;
    find "$test_dir" -type f \( -name "*.test.js" -o -name "*.spec.js" \) \
      -exec sed -i "s/\"intimacy:$action\"/\"affection:$action\"/g" {} \;
    find "$test_dir" -type f \( -name "*.test.js" -o -name "*.spec.js" \) \
      -exec sed -i "s/\`intimacy:$action\`/\`affection:$action\`/g" {} \;
  done

  # Update kissing references
  for action in "${KISSING_ACTIONS[@]}"; do
    find "$test_dir" -type f \( -name "*.test.js" -o -name "*.spec.js" \) \
      -exec sed -i "s/'intimacy:$action'/'kissing:$action'/g" {} \;
    find "$test_dir" -type f \( -name "*.test.js" -o -name "*.spec.js" \) \
      -exec sed -i "s/\"intimacy:$action\"/\"kissing:$action\"/g" {} \;
    find "$test_dir" -type f \( -name "*.test.js" -o -name "*.spec.js" \) \
      -exec sed -i "s/\`intimacy:$action\`/\`kissing:$action\`/g" {} \;
  done

  # Update caressing references
  for action in "${CARESSING_ACTIONS[@]}"; do
    find "$test_dir" -type f \( -name "*.test.js" -o -name "*.spec.js" \) \
      -exec sed -i "s/'intimacy:$action'/'caressing:$action'/g" {} \;
    find "$test_dir" -type f \( -name "*.test.js" -o -name "*.spec.js" \) \
      -exec sed -i "s/\"intimacy:$action\"/\"caressing:$action\"/g" {} \;
    find "$test_dir" -type f \( -name "*.test.js" -o -name "*.spec.js" \) \
      -exec sed -i "s/\`intimacy:$action\`/\`caressing:$action\`/g" {} \;
  done

  # Update component reference
  find "$test_dir" -type f \( -name "*.test.js" -o -name "*.spec.js" \) \
    -exec sed -i "s/'intimacy:kissing'/'kissing:kissing'/g" {} \;
  find "$test_dir" -type f \( -name "*.test.js" -o -name "*.spec.js" \) \
    -exec sed -i "s/\"intimacy:kissing\"/\"kissing:kissing\"/g" {} \;

  echo "Updated test references in $test_dir"
}

# Run updates for all test directories
update_test_references "tests/unit"
update_test_references "tests/integration"
update_test_references "tests/e2e"

echo "Test reference update complete"
```

**Usage**:
```bash
chmod +x update-test-refs.sh
./update-test-refs.sh
```

### 4. Update Test Mod Loading

Update tests that load mods to include new mod names:

**Before**:
```javascript
testBed.loadMods(['core', 'anatomy', 'positioning', 'intimacy']);
```

**After**:
```javascript
testBed.loadMods(['core', 'anatomy', 'positioning', 'affection', 'kissing', 'caressing']);
```

Or for specific tests:
```javascript
// For affection-only tests
testBed.loadMods(['core', 'anatomy', 'positioning', 'affection']);

// For kissing-only tests
testBed.loadMods(['core', 'anatomy', 'positioning', 'kissing']);
```

### 5. Update Test Descriptions

Update test suite descriptions that mention "intimacy":

```bash
# Find test descriptions mentioning intimacy
grep -r "describe.*[Ii]ntimacy" tests/

# Update manually if needed
# Example:
# Before: describe('Intimacy Mod - Actions', ...)
# After: describe('Affection/Kissing/Caressing Mods - Actions', ...)
```

### 6. Fix Component-Specific Tests

Tests that verify kissing component behavior need updating:

**Before**:
```javascript
const kissingComponent = testBed.getComponent(actor, 'intimacy:kissing');
expect(kissingComponent).toBeDefined();
```

**After**:
```javascript
const kissingComponent = testBed.getComponent(actor, 'kissing:kissing');
expect(kissingComponent).toBeDefined();
```

### 7. Update Scope Reference Tests

Tests that use scope IDs need updating:

**Before**:
```javascript
const scope = testBed.evaluateScope('intimacy:close_actors_facing_each_other', actor);
```

**After**:
```javascript
// Depends on which mod the test belongs to
const scope = testBed.evaluateScope('affection:close_actors_facing_each_other', actor);
// or
const scope = testBed.evaluateScope('kissing:close_actors_facing_each_other', actor);
// or
const scope = testBed.evaluateScope('caressing:close_actors_facing_each_other', actor);
```

### 8. Run Test Suite and Fix Failures

Execute test suite systematically:

```bash
# Run unit tests first
NODE_ENV=test npm run test:unit

# If failures, identify and fix
NODE_ENV=test npx jest tests/unit/ --no-coverage --verbose

# Run integration tests
NODE_ENV=test npm run test:integration

# Run e2e tests
NODE_ENV=test npm run test:e2e

# Run full suite
NODE_ENV=test npm run test:ci
```

**For each failure**:
1. Identify the test file
2. Review the error message
3. Determine if it's a reference update issue or logic change needed
4. Fix the test
5. Re-run to verify

### 9. Update Test Utilities

If test utilities reference intimacy mod:

**File**: `tests/common/testBed.js` (or similar)

Update any intimacy-specific helper methods:

```javascript
// Before
createKissingScenario() {
  // ... setup
  this.executeAction('intimacy:lean_in_for_deep_kiss', actor, target);
}

// After
createKissingScenario() {
  // ... setup
  this.executeAction('kissing:lean_in_for_deep_kiss', actor, target);
}
```

## Common Test Update Patterns

### Pattern 1: Action Execution Tests

**Before**:
```javascript
it('should execute intimacy action', () => {
  const result = executeAction('intimacy:hold_hand', actor, target);
  expect(result.success).toBe(true);
});
```

**After**:
```javascript
it('should execute affection action', () => {
  const result = executeAction('affection:hold_hand', actor, target);
  expect(result.success).toBe(true);
});
```

### Pattern 2: Component Query Tests

**Before**:
```javascript
it('should have kissing component', () => {
  const component = getComponent(actor, 'intimacy:kissing');
  expect(component).toBeDefined();
});
```

**After**:
```javascript
it('should have kissing component', () => {
  const component = getComponent(actor, 'kissing:kissing');
  expect(component).toBeDefined();
});
```

### Pattern 3: Mock Data

**Before**:
```javascript
const mockAction = {
  id: 'intimacy:kiss_cheek',
  name: 'Kiss Cheek'
};
```

**After**:
```javascript
const mockAction = {
  id: 'kissing:kiss_cheek',
  name: 'Kiss Cheek'
};
```

## Acceptance Criteria

- [ ] All intimacy references identified in test files
- [ ] Automated update script created and executed
- [ ] All action references updated to appropriate mod namespace
- [ ] All component references updated (intimacy:kissing → kissing:kissing)
- [ ] All scope references updated appropriately
- [ ] Test mod loading updated to include new mods
- [ ] Test descriptions updated where needed
- [ ] Test utilities updated if they reference intimacy
- [ ] Unit test suite passes (100%)
- [ ] Integration test suite passes (100%)
- [ ] E2E test suite passes (100%)
- [ ] Full test suite passes with coverage ≥80%
- [ ] No `intimacy:` references remain in test files

## Validation Commands

```bash
# Verify no intimacy references in tests (should return nothing)
grep -r "intimacy:" tests/ || echo "All test references updated ✓"

# Run full test suite
NODE_ENV=test npm run test:ci

# Check test coverage
NODE_ENV=test npm run test:integration -- --coverage
NODE_ENV=test npm run test:unit -- --coverage

# Verify specific test categories
NODE_ENV=test npx jest tests/unit/mods/ --no-coverage
NODE_ENV=test npx jest tests/integration/mods/ --no-coverage

# Run tests for new mods
NODE_ENV=test npx jest tests/unit/mods/affection/ --no-coverage
NODE_ENV=test npx jest tests/unit/mods/kissing/ --no-coverage
NODE_ENV=test npx jest tests/unit/mods/caressing/ --no-coverage
```

## Troubleshooting Common Issues

### Issue: Test can't find action

**Cause**: Mod not loaded in test setup
**Fix**: Add missing mod to `testBed.loadMods()` call

### Issue: Component query returns undefined

**Cause**: Component ID not updated
**Fix**: Change `intimacy:kissing` → `kissing:kissing`

### Issue: Scope evaluation fails

**Cause**: Scope ID still references intimacy mod
**Fix**: Update scope ID to appropriate mod namespace

### Issue: Test description mentions wrong mod

**Cause**: Test description not updated
**Fix**: Update `describe()` string to reflect new mod structure

## Next Steps

After completion, proceed to:
- **INTMODREF-008**: Documentation and cleanup

## Notes

- Automated script handles most updates, but manual verification essential
- Some tests may need logic changes beyond just ID updates
- Pay special attention to component lifecycle tests (kissing mod)
- Tests should pass with same coverage % as before migration
- New integration tests (INTMODREF-006) supplement existing tests
- Consider creating migration guide for external test suites
