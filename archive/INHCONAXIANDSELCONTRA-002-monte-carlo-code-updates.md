# INHCONAXIANDSELCONTRA-002: Monte Carlo Code Updates - Update RandomStateGenerator and axisNormalizationUtils

## Status: ✅ COMPLETED

## Summary

Update the hardcoded mood axis and affect trait arrays in the expression diagnostics code to include `inhibitory_control` and `self_control`. This enables the Monte Carlo simulation system to generate and normalize states that include the new regulatory dimensions.

## Priority: High | Effort: Low

## Dependencies

- **Requires**: INHCONAXIANDSELCONTRA-001 (schema updates must be complete first)

## Rationale

The Monte Carlo simulator uses hardcoded arrays (`MOOD_AXES`, `AFFECT_TRAITS`) and default objects (`DEFAULT_AFFECT_TRAITS`) to generate random character states for expression diagnostics. Without updating these, the new axis and trait won't participate in:
- Random state generation
- Prototype matching
- Sampling coverage analysis
- Normalization functions

## Files to Touch

| File | Change Type |
|------|-------------|
| `src/expressionDiagnostics/services/RandomStateGenerator.js` | **Modify** - Update `MOOD_AXES` and `AFFECT_TRAITS` arrays |
| `src/expressionDiagnostics/utils/axisNormalizationUtils.js` | **Modify** - Update `DEFAULT_AFFECT_TRAITS` object |
| `tests/unit/expressionDiagnostics/services/randomStateGenerator.test.js` | **Modify** - Fix hardcoded random call counts broken by new axis/trait |
| `tests/unit/expressionDiagnostics/axisNormalizationUtils.test.js` | **Modify** - Add `self_control` expectation to verify default |

## Out of Scope

- **DO NOT** modify component schemas - that's INHCONAXIANDSELCONTRA-001
- **DO NOT** modify UI components - that's INHCONAXIANDSELCONTRA-003
- **DO NOT** modify LLM prompts - that's INHCONAXIANDSELCONTRA-004
- **DO NOT** modify entity definitions - that's INHCONAXIANDSELCONTRA-005
- **DO NOT** write NEW comprehensive tests - that's INHCONAXIANDSELCONTRA-006
  - **Exception**: Fix existing tests broken by code changes (hardcoded counts, missing expectations)
- **DO NOT** modify any other files in expressionDiagnostics

## Implementation Details

### Modify: src/expressionDiagnostics/services/RandomStateGenerator.js

Locate the `MOOD_AXES` constant (approximately line 13) and add `'inhibitory_control'`:

```javascript
const MOOD_AXES = [
  'valence',
  'arousal',
  'agency_control',
  'threat',
  'engagement',
  'future_expectancy',
  'self_evaluation',
  'affiliation',
  'inhibitory_control',  // NEW - 9th axis
];
```

Locate the `AFFECT_TRAITS` constant (approximately line 23) and add `'self_control'`:

```javascript
const AFFECT_TRAITS = [
  'affective_empathy',
  'cognitive_empathy',
  'harm_aversion',
  'self_control',  // NEW - 4th trait
];
```

### Modify: src/expressionDiagnostics/utils/axisNormalizationUtils.js

Locate the `DEFAULT_AFFECT_TRAITS` constant (approximately line 5) and add `self_control`:

```javascript
const DEFAULT_AFFECT_TRAITS = Object.freeze({
  affective_empathy: 50,
  cognitive_empathy: 50,
  harm_aversion: 50,
  self_control: 50,  // NEW - default regulatory capacity
});
```

## Acceptance Criteria

### Specific Tests That Must Pass

1. **RandomStateGenerator generates inhibitory_control:**
   ```bash
   npm run test:unit -- tests/unit/expressionDiagnostics/services/randomStateGenerator.test.js --verbose
   ```
   - Generated mood states must include `inhibitory_control` key
   - `inhibitory_control` values must be within [-100, 100] range

2. **RandomStateGenerator generates self_control:**
   - Generated affect traits must include `self_control` key
   - `self_control` values must be within [0, 100] range

3. **axisNormalizationUtils handles self_control:**
   ```bash
   npm run test:unit -- tests/unit/expressionDiagnostics/axisNormalizationUtils.test.js --verbose
   ```
   - `DEFAULT_AFFECT_TRAITS.self_control` must equal 50
   - `normalizeAffectTraits({})` must return object with `self_control: 0.5` (normalized)

4. **All expression diagnostics tests pass:**
   ```bash
   npm run test:unit -- --testPathPattern="expressionDiagnostics" --verbose
   ```

5. **Type checking passes:**
   ```bash
   npm run typecheck
   ```

### Invariants That Must Remain True

1. **Array Order**: New elements appended to end of arrays (don't reorder existing elements)
2. **Object Freeze**: `DEFAULT_AFFECT_TRAITS` remains frozen with `Object.freeze()`
3. **Value Ranges**: `inhibitory_control` sampling uses [-100, 100]; `self_control` uses [0, 100]
4. **Default Neutrality**: `self_control` defaults to 50 (average), not 0 or 100
5. **Backward Compatibility**: Existing tests continue to pass without modification

## Verification Commands

```bash
# Run RandomStateGenerator tests
npm run test:unit -- tests/unit/expressionDiagnostics/services/randomStateGenerator.test.js --verbose

# Run axisNormalizationUtils tests
npm run test:unit -- tests/unit/expressionDiagnostics/axisNormalizationUtils.test.js --verbose

# Run all expression diagnostics tests
npm run test:unit -- --testPathPattern="expressionDiagnostics" --verbose

# Type check
npm run typecheck

# Lint modified files
npx eslint src/expressionDiagnostics/services/RandomStateGenerator.js src/expressionDiagnostics/utils/axisNormalizationUtils.js
```

## Definition of Done

- [x] `MOOD_AXES` array includes `'inhibitory_control'` as 9th element
- [x] `AFFECT_TRAITS` array includes `'self_control'` as 4th element
- [x] `DEFAULT_AFFECT_TRAITS` object includes `self_control: 50`
- [x] All existing tests pass (with minimal fixes for hardcoded counts)
- [x] Type checking: No new errors introduced (pre-existing errors in other files)
- [x] Linting: 0 errors on modified files (only pre-existing warnings)

## Outcome

### What Was Actually Changed vs Originally Planned

**Originally Planned (2 source files):**
- `src/expressionDiagnostics/services/RandomStateGenerator.js` - Add axis and trait
- `src/expressionDiagnostics/utils/axisNormalizationUtils.js` - Add default trait

**Actually Changed (4 files - scope expanded during implementation):**

1. **Source Files (as planned):**
   - `RandomStateGenerator.js`: Added `'inhibitory_control'` to `MOOD_AXES` (9th element), added `'self_control'` to `AFFECT_TRAITS` (4th element)
   - `axisNormalizationUtils.js`: Added `self_control: 50` to `DEFAULT_AFFECT_TRAITS`

2. **Test Files (scope expansion - required to maintain passing CI):**
   - `randomStateGenerator.test.js`: Fixed hardcoded random call counts (25→28 uniform, 50→56 gaussian, array lengths 28→32 and 20→22)
   - `axisNormalizationUtils.test.js`: Added `expect(normalized.self_control).toBeCloseTo(0.5, 6)` assertion

**Discrepancy Analysis:**
The original ticket stated "DO NOT write tests in this ticket" but existing tests had hardcoded expectations that would fail with the new axis/trait. The scope was corrected to allow fixing existing tests broken by code changes, while still deferring NEW comprehensive test writing to INHCONAXIANDSELCONTRA-006.

**Test Results:**
- 78 expressionDiagnostics test suites: PASS
- 1916 tests: PASS
- ESLint: 0 errors (27 pre-existing warnings)
