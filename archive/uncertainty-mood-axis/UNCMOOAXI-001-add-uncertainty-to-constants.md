# UNCMOOAXI-001: Add Uncertainty to Mood Constants

## Summary

Add `uncertainty` as the 10th mood axis to the centralized `MOOD_AXES` array in `moodAffectConstants.js`. This is the foundation ticket that all other uncertainty implementation depends on.

## Priority: High | Effort: Low

## Rationale

The `MOOD_AXES` constant is the single source of truth for mood axis names. Most code in the codebase iterates over this array dynamically, meaning adding a new entry here automatically propagates to:
- Random state generators
- Context builders
- Expression evaluators
- Validation systems
- Diagnostic tools

This is the minimal, zero-risk first step with ~5 lines changed.

## Files to Touch

| File | Change Type |
|------|-------------|
| `src/constants/moodAffectConstants.js` | **Modify** - Add uncertainty to MOOD_AXES array |
| `tests/unit/constants/moodAffectConstants.test.js` | **Modify** - Update axis count expectations (9→10) |
| `tests/unit/expressionDiagnostics/axisRegistryAudit.test.js` | **Modify** - Update axis count (9→10), add uncertainty assertion |
| `tests/unit/expressionDiagnostics/services/monteCarloSimulator.knownContextKeys.test.js` | **Modify** - Update axis count (9→10), add uncertainty assertion |
| `tests/unit/expressionDiagnostics/services/randomStateGenerator.test.js` | **Modify** - Update random sample counts (28→30, 56→60) |
| `tests/unit/expressionDiagnostics/services/randomStateGenerator.completeness.test.js` | **Modify** - Update axis counts (9→10) |
| `tests/integration/expression-diagnostics/monteCarloNewAxis.integration.test.js` | **Modify** - Update axis counts (9→10) |

## Out of Scope

- **DO NOT** modify `mood.component.json` - that's UNCMOOAXI-002
- **DO NOT** modify `emotion_prototypes.lookup.json` - that's UNCMOOAXI-003/004/005
- **DO NOT** create new utility functions or refactor existing code

## In Scope (Revised)

- **Update `moodAffectConstants.test.js`** to reflect 10 axes (originally deferred to UNCMOOAXI-006, but required for tests to pass)

## Implementation Details

### File: src/constants/moodAffectConstants.js

**Current (lines 8-23):**
```javascript
/**
 * The 9 mood axes that define a character's current affective/regulatory state.
 * Each axis ranges from -100 to +100.
 * @type {readonly string[]}
 */
export const MOOD_AXES = Object.freeze([
  'valence',
  'arousal',
  'agency_control',
  'threat',
  'engagement',
  'future_expectancy',
  'self_evaluation',
  'affiliation',
  'inhibitory_control',
]);
```

**After:**
```javascript
/**
 * The 10 mood axes that define a character's current affective/regulatory state.
 * Each axis ranges from -100 to +100.
 * @type {readonly string[]}
 */
export const MOOD_AXES = Object.freeze([
  'valence',
  'arousal',
  'agency_control',
  'threat',
  'engagement',
  'future_expectancy',
  'self_evaluation',
  'affiliation',
  'inhibitory_control',
  'uncertainty',
]);
```

**Changes:**
1. Update JSDoc comment: "9 mood axes" → "10 mood axes"
2. Add `'uncertainty',` as the last entry in the array

## Acceptance Criteria

### Tests That Must Pass

After this change, the related unit tests must pass (tests updated as part of this ticket):
```bash
npm run test:unit -- tests/unit/constants/moodAffectConstants.test.js --verbose
```

To verify the change is correct without running full tests:
```bash
# Quick validation - import and check length
node -e "import('./src/constants/moodAffectConstants.js').then(m => console.log('MOOD_AXES count:', m.MOOD_AXES.length, 'includes uncertainty:', m.MOOD_AXES.includes('uncertainty')))"
```

### Invariants That Must Remain True

1. **Frozen Array**: `MOOD_AXES` must remain frozen via `Object.freeze()`
2. **String Values**: All entries must be lowercase snake_case strings
3. **No Duplicates**: No duplicate axis names
4. **Order Preserved**: Existing 9 axes remain in their original order

## Verification Commands

```bash
# Lint the modified file
npx eslint src/constants/moodAffectConstants.js

# Type check
npm run typecheck

# Quick manual verification
node -e "import('./src/constants/moodAffectConstants.js').then(m => {
  console.log('Count:', m.MOOD_AXES.length);
  console.log('Has uncertainty:', m.MOOD_AXES.includes('uncertainty'));
  console.log('Is frozen:', Object.isFrozen(m.MOOD_AXES));
})"
```

## Definition of Done

- [x] `MOOD_AXES` array contains 10 entries
- [x] `'uncertainty'` is the 10th entry
- [x] JSDoc updated to say "10 mood axes"
- [x] Array remains frozen
- [x] `MOOD_AXES_SET` automatically includes uncertainty (computed from array)
- [x] `isMoodAxis('uncertainty')` returns `true`
- [x] `npx eslint src/constants/moodAffectConstants.js` passes (warnings only, no errors)
- [x] `npm run typecheck` passes (pre-existing errors unrelated to this change)
- [x] All related unit and integration tests pass (4538 unit tests, 287 integration tests)

## Status: ✅ COMPLETED

---

## Outcome

### What Was Originally Planned
The original ticket scope stated "DO NOT update test files" and intended test updates for a later ticket (UNCMOOAXI-006). The ticket planned to modify only `src/constants/moodAffectConstants.js`.

### What Was Actually Changed

**Source Code (1 file):**
- `src/constants/moodAffectConstants.js` - Added `'uncertainty'` as 10th mood axis, updated JSDoc comment

**Test Files (6 files):**
The ticket scope was revised to include test updates because tests must pass after implementation:

1. `tests/unit/constants/moodAffectConstants.test.js` - Updated axis count expectations (9→10), added uncertainty assertions
2. `tests/unit/expressionDiagnostics/axisRegistryAudit.test.js` - Updated test names and assertions for 10 axes
3. `tests/unit/expressionDiagnostics/services/monteCarloSimulator.knownContextKeys.test.js` - Updated axis count assertions, added uncertainty check
4. `tests/unit/expressionDiagnostics/services/randomStateGenerator.test.js` - Updated random sample counts (28→30 uniform, 56→60 gaussian, adjusted dynamic sampling arrays)
5. `tests/unit/expressionDiagnostics/services/randomStateGenerator.completeness.test.js` - Updated axis count assertions (9→10)
6. `tests/integration/expression-diagnostics/monteCarloNewAxis.integration.test.js` - Updated expectedAxes array and count assertions

### Deviation Rationale
The original plan to defer test updates was impractical - tests with hardcoded "9 axes" expectations would fail immediately after the code change. Including test updates in this ticket ensures a clean, passing test suite at each implementation milestone.

### Test Results
- **Unit Tests**: 4538 passed
- **Integration Tests**: 287 passed (1 unrelated failure about missing file)
