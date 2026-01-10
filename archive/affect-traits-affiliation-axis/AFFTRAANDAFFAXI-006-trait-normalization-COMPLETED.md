# AFFTRAANDAFFAXI-006: Add Trait Normalization to EmotionCalculatorService

## Summary

Add constants, default values, and a normalization method for affect traits to `EmotionCalculatorService`. This ticket focuses only on the foundational additions; method signature changes and integration come in AFFTRAANDAFFAXI-007.

## Priority: High | Effort: Low

## Rationale

Before integrating affect traits into calculation methods, we need:
1. The component ID constant
2. Default trait values for backwards compatibility
3. A normalization method to convert `[0..100]` to `[0..1]`

This separation ensures the foundational code is in place and testable before modifying calculation logic.

## Files to Touch

| File | Change Type |
|------|-------------|
| `src/emotions/emotionCalculatorService.js` | **Modify** - Add constants and #normalizeAffectTraits method |

## Out of Scope

- **DO NOT** modify `calculateEmotions` method signature - that's AFFTRAANDAFFAXI-007
- **DO NOT** modify `#calculatePrototypeIntensity` - that's AFFTRAANDAFFAXI-007
- **DO NOT** modify `#resolveAxisValue` - that's AFFTRAANDAFFAXI-007
- **DO NOT** modify `#checkGates` - that's AFFTRAANDAFFAXI-007
- **DO NOT** create new test files - that's AFFTRAANDAFFAXI-008
- **DO NOT** modify existing tests - that's AFFTRAANDAFFAXI-007

## Implementation Details

### 1. Add Constants (after line 60, after SEXUAL_PROTOTYPES_LOOKUP_ID)

```javascript
/** Component ID for affect traits */
const AFFECT_TRAITS_COMPONENT_ID = 'core:affect_traits';

/**
 * Default affect trait values for entities without the affect_traits component.
 * Values of 50 represent "average human" baseline.
 * @type {Readonly<{affective_empathy: number, cognitive_empathy: number, harm_aversion: number}>}
 */
const DEFAULT_AFFECT_TRAITS = Object.freeze({
  affective_empathy: 50,
  cognitive_empathy: 50,
  harm_aversion: 50,
});
```

### 2. Add JSDoc Type Definition (after SexualState typedef around line 30)

```javascript
/**
 * @typedef {object} AffectTraits
 * @property {number} affective_empathy - Capacity to feel what others feel [0..100]
 * @property {number} cognitive_empathy - Ability to understand others' perspectives [0..100]
 * @property {number} harm_aversion - Aversion to causing harm [0..100]
 */
```

### 3. Add Normalization Method (as a private method in the class, after #normalizeSexualAxes)

```javascript
/**
 * Normalizes affect traits from [0..100] to [0..1].
 * Uses default values (50 = average human) for missing properties.
 *
 * @param {AffectTraits|null|undefined} affectTraits - Raw affect traits data
 * @returns {{[key: string]: number}} Normalized trait values in [0..1]
 */
#normalizeAffectTraits(affectTraits) {
  const normalized = {};
  const traits = affectTraits ?? DEFAULT_AFFECT_TRAITS;

  for (const [trait, value] of Object.entries(traits)) {
    if (typeof value === 'number') {
      // Normalize [0..100] to [0..1], clamp to valid range
      normalized[trait] = Math.max(0, Math.min(1, value / 100));
    }
  }

  // Ensure all default traits are present with defaults if missing
  for (const [trait, defaultValue] of Object.entries(DEFAULT_AFFECT_TRAITS)) {
    if (normalized[trait] === undefined) {
      normalized[trait] = defaultValue / 100;
    }
  }

  return normalized;
}
```

### Design Notes

- **Normalization pattern**: Matches `#normalizeMoodAxes` (divide by 100)
- **Default handling**: Missing traits default to 50 (average human)
- **Null/undefined handling**: Entire object defaults if null/undefined
- **Range clamping**: Values clamped to [0..1] after normalization
- **No side effects**: Pure function, doesn't modify input

### Location in File

Insert after `#normalizeSexualAxes` method (around line 410) to keep normalization methods grouped together.

## Acceptance Criteria

### Tests That Must Pass

1. **TypeScript type checking passes**:
   ```bash
   npm run typecheck
   ```

2. **ESLint passes**:
   ```bash
   npx eslint src/emotions/emotionCalculatorService.js
   ```

3. **Existing emotion tests still pass** (no API changes yet):
   ```bash
   npm run test:unit -- --testPathPattern="emotionCalculatorService" --verbose
   ```

### Invariants That Must Remain True

1. **No API changes**: Public method signatures unchanged
2. **No behavior changes**: Existing calculations produce identical results
3. **Constants frozen**: DEFAULT_AFFECT_TRAITS is immutable
4. **JSDoc complete**: All new code has proper documentation
5. **Naming consistency**: Method follows existing `#normalize*Axes` pattern

## Verification Commands

```bash
# Type check
npm run typecheck

# Lint the specific file
npx eslint src/emotions/emotionCalculatorService.js

# Run existing tests (should all pass - no behavior change)
npm run test:unit -- --testPathPattern="emotionCalculatorService" --verbose

# Verify constants exist
grep -n "AFFECT_TRAITS_COMPONENT_ID\|DEFAULT_AFFECT_TRAITS" src/emotions/emotionCalculatorService.js

# Verify method exists
grep -n "normalizeAffectTraits" src/emotions/emotionCalculatorService.js
```

## Definition of Done

- [x] `AFFECT_TRAITS_COMPONENT_ID` constant added
- [x] `DEFAULT_AFFECT_TRAITS` constant added with Object.freeze
- [x] `AffectTraits` typedef added
- [x] `#normalizeAffectTraits` method implemented
- [x] JSDoc documentation complete for all additions
- [x] `npm run typecheck` passes
- [x] `npx eslint src/emotions/emotionCalculatorService.js` passes
- [x] All existing emotion tests pass unchanged

---

## Status: ✅ COMPLETED

## Outcome

### What Was Changed

All implementation matched the ticket specification exactly:

1. **`AffectTraits` typedef** - Added after `SexualState` typedef (line 31)
2. **`AFFECT_TRAITS_COMPONENT_ID` constant** - Added after `SEXUAL_PROTOTYPES_LOOKUP_ID` (line 68)
3. **`DEFAULT_AFFECT_TRAITS` constant** - Added with `Object.freeze` (lines 70-79)
4. **`#normalizeAffectTraits` method** - Added after `#normalizeSexualAxes` (lines 432-454)

### Minor Adaptations

- Added ESLint disable comments for intentionally unused code (constant and private method will be used in AFFTRAANDAFFAXI-007)
- No discrepancies found between ticket assumptions and actual codebase

### Verification Results

- **Typecheck**: ✅ Passed
- **ESLint**: ✅ Passed (only pre-existing warnings)
- **Unit Tests**: ✅ 106 tests passed, no regressions
- **No API Changes**: ✅ All public interfaces unchanged
- **No Behavior Changes**: ✅ Existing calculations produce identical results
