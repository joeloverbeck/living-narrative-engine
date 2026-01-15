# INHCONAXIANDSELCONTRA-006: Unit Tests - RandomStateGenerator and axisNormalizationUtils

## Status: ✅ COMPLETED

## Summary

Add explicit unit tests for `RandomStateGenerator` and `axisNormalizationUtils` to verify that the new `inhibitory_control` mood axis and `self_control` affect trait are properly included in generated states and normalization functions.

## Priority: Medium | Effort: Low

## Dependencies

- **Requires**: INHCONAXIANDSELCONTRA-001 (schema updates) ✅ Complete
- **Requires**: INHCONAXIANDSELCONTRA-002 (code updates) ✅ Complete

## Rationale

The existing tests iterate over `MOOD_AXES` and `AFFECT_TRAITS` arrays, which already provides coverage for the new values. However, we add explicit tests to:
1. Provide clear documentation that the new axis/trait are specifically verified
2. Serve as regression tests if the arrays are ever modified incorrectly
3. Verify normalization behavior for `self_control` with explicit values

**Note**: The Math.random call counts (28 for uniform, 56 for gaussian) were already correct after INHCONAXIANDSELCONTRA-002 was completed. The test for `self_control` default (0.5) also already existed.

## Files to Touch

| File | Change Type |
|------|-------------|
| `tests/unit/expressionDiagnostics/services/randomStateGenerator.test.js` | **Modify** - Update call counts, add new axis/trait assertions |
| `tests/unit/expressionDiagnostics/axisNormalizationUtils.test.js` | **Modify** - Add `self_control` to normalization tests |

## Out of Scope

- **DO NOT** modify source code - that's INHCONAXIANDSELCONTRA-002
- **DO NOT** create integration tests - that's INHCONAXIANDSELCONTRA-008
- **DO NOT** modify UI tests - that's INHCONAXIANDSELCONTRA-007
- **DO NOT** modify any other test files

## Implementation Details

### Modify: tests/unit/expressionDiagnostics/services/randomStateGenerator.test.js

#### ~~Update Math.random call counts~~ ✅ ALREADY CORRECT

The call counts were already updated by INHCONAXIANDSELCONTRA-002:
- Uniform static: 28 calls (already at line 82)
- Gaussian static: 56 calls (already at line 90)

No changes needed to these assertions.

#### Add explicit test for inhibitory_control axis

Add new test case:
```javascript
it('should include inhibitory_control in generated mood states', () => {
  const state = generator.generate('uniform', 'static');

  expect(state.current.mood).toHaveProperty('inhibitory_control');
  expect(state.previous.mood).toHaveProperty('inhibitory_control');
  expect(state.current.mood.inhibitory_control).toBeGreaterThanOrEqual(-100);
  expect(state.current.mood.inhibitory_control).toBeLessThanOrEqual(100);
  expect(Number.isInteger(state.current.mood.inhibitory_control)).toBe(true);
});
```

#### Add explicit test for self_control trait

Add new test case:
```javascript
it('should include self_control in generated affect traits', () => {
  const state = generator.generate('uniform', 'static');

  expect(state.affectTraits).toHaveProperty('self_control');
  expect(state.affectTraits.self_control).toBeGreaterThanOrEqual(0);
  expect(state.affectTraits.self_control).toBeLessThanOrEqual(100);
  expect(Number.isInteger(state.affectTraits.self_control)).toBe(true);
});
```

### Modify: tests/unit/expressionDiagnostics/axisNormalizationUtils.test.js

#### ~~Add test for self_control in normalizeAffectTraits~~ ✅ ALREADY EXISTS

The existing test at line 72-81 already asserts:
```javascript
expect(normalized.self_control).toBeCloseTo(0.5, 6);
```

No changes needed to the existing test.

#### Add explicit test for self_control normalization

Add new test case:
```javascript
it('normalizes self_control trait from [0, 100] to [0, 1]', () => {
  const normalized = normalizeAffectTraits({
    self_control: 72,
  });

  expect(normalized.self_control).toBeCloseTo(0.72, 6);
});

it('defaults self_control to 0.5 when not provided', () => {
  const normalized = normalizeAffectTraits({});

  expect(normalized.self_control).toBeCloseTo(0.5, 6);
});
```

## Acceptance Criteria

### Specific Tests That Must Pass

1. **RandomStateGenerator tests pass:**
   ```bash
   npm run test:unit -- tests/unit/expressionDiagnostics/services/randomStateGenerator.test.js --verbose
   ```

2. **axisNormalizationUtils tests pass:**
   ```bash
   npm run test:unit -- tests/unit/expressionDiagnostics/axisNormalizationUtils.test.js --verbose
   ```

3. **All expression diagnostics tests pass:**
   ```bash
   npm run test:unit -- --testPathPattern="expressionDiagnostics" --verbose
   ```

### Invariants That Must Remain True

1. **Existing Test Coverage**: All existing assertions continue to pass
2. **Range Verification**: `inhibitory_control` validated as [-100, 100], `self_control` as [0, 100]
3. **Integer Validation**: Both new values must be integers
4. **Default Values**: `self_control` defaults to 50 (normalized: 0.5)
5. **No Source Modifications**: Tests verify behavior, don't change source code

## Verification Commands

```bash
# Run specific test files
npm run test:unit -- tests/unit/expressionDiagnostics/services/randomStateGenerator.test.js --verbose
npm run test:unit -- tests/unit/expressionDiagnostics/axisNormalizationUtils.test.js --verbose

# Run all expression diagnostics tests
npm run test:unit -- --testPathPattern="expressionDiagnostics" --verbose

# Lint test files
npx eslint tests/unit/expressionDiagnostics/services/randomStateGenerator.test.js tests/unit/expressionDiagnostics/axisNormalizationUtils.test.js
```

## Definition of Done

- [x] `randomStateGenerator.test.js` call count for uniform static ✅ Already correct (28)
- [x] `randomStateGenerator.test.js` call count for gaussian static ✅ Already correct (56)
- [x] `randomStateGenerator.test.js` dynamic sampling array lengths ✅ Already correct
- [x] New test: `inhibitory_control` axis present in generated states ✅ Added
- [x] New test: `self_control` trait present in generated affect traits ✅ Added
- [x] `axisNormalizationUtils.test.js` existing test asserts `self_control` ✅ Already present
- [x] New test: `self_control` normalization from [0, 100] to [0, 1] ✅ Added
- [x] New test: `self_control` defaults to 0.5 when not provided ✅ Added
- [x] All tests pass ✅
- [x] Linting passes ✅

---

## Outcome

### What Was Originally Planned

The ticket assumed:
1. Math.random call counts needed updating from 25→28 (uniform) and 50→56 (gaussian)
2. Dynamic sampling array lengths needed updating
3. The `self_control` default assertion was missing from axisNormalizationUtils tests

### What Was Actually Changed

Upon investigation, INHCONAXIANDSELCONTRA-002 (code updates) had already been completed, so:

**No changes needed:**
- Math.random call counts were already correct (28 and 56)
- Dynamic sampling arrays were already correct
- `self_control` default assertion already existed in axisNormalizationUtils.test.js

**Changes made (4 new tests total):**

1. `randomStateGenerator.test.js`:
   - Added: `should include inhibitory_control in generated mood states` - Explicit verification of new axis presence and range
   - Added: `should include self_control in generated affect traits` - Explicit verification of new trait presence and range

2. `axisNormalizationUtils.test.js`:
   - Added: `normalizes self_control trait from [0, 100] to [0, 1]` - Tests custom value normalization
   - Added: `defaults self_control to 0.5 when not provided` - Tests empty input default behavior

### Rationale for Differences

The ticket was written before INHCONAXIANDSELCONTRA-002 was implemented, so some assumptions were outdated. The explicit tests still provide value as:
- Clear documentation that the new axis/trait are specifically verified
- Regression tests if the arrays are ever modified incorrectly
- Edge case coverage for normalization with explicit vs default values

### Test Summary

| Test File | New Tests | Status |
|-----------|-----------|--------|
| randomStateGenerator.test.js | 2 tests added | ✅ All pass |
| axisNormalizationUtils.test.js | 2 tests added | ✅ All pass |
