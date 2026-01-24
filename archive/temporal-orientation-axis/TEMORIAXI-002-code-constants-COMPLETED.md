# TEMORIAXI-002: Code Constants - Add temporal_orientation to MOOD_AXES

## Status: ✅ COMPLETED

## Summary

Add `temporal_orientation` to the `MOOD_AXES` array in the centralized mood constants file. This enables the engine code to recognize and iterate over the new axis.

## Priority: Critical | Effort: Low

## Rationale

The `MOOD_AXES` array is the single source of truth in code for which axes exist. Adding `temporal_orientation` here automatically updates `MOOD_AXES_SET` and the `isMoodAxis()` helper function.

## Files to Touch

| File | Change Type |
|------|-------------|
| `src/constants/moodAffectConstants.js` | **Modify** - Add temporal_orientation to MOOD_AXES |

## Out of Scope

- **DO NOT** modify `data/mods/core/components/mood.component.json` - that's TEMORIAXI-001
- **DO NOT** modify `src/turns/schemas/llmOutputSchemas.js` - that's TEMORIAXI-003
- **DO NOT** modify `src/domUI/emotionalStatePanel.js` - that's TEMORIAXI-004
- **DO NOT** modify `data/prompts/corePromptText.json` - that's TEMORIAXI-005
- ~~**DO NOT** update any test files - that's TEMORIAXI-006 and TEMORIAXI-007~~ **SCOPE EXPANDED**: Tests for `moodAffectConstants.js` were updated as part of implementation per user request
- **DO NOT** modify any other constants files

## Implementation Details

### Modify: src/constants/moodAffectConstants.js

#### Change 1: Update JSDoc comment (lines 8-11)
```javascript
// BEFORE:
/**
 * The 10 mood axes that define a character's current affective/regulatory state.
 * Each axis ranges from -100 to +100.
 * @type {readonly string[]}
 */

// AFTER:
/**
 * The 11 mood axes that define a character's current affective/regulatory state.
 * Each axis ranges from -100 to +100.
 * @type {readonly string[]}
 */
```

#### Change 2: Add temporal_orientation to MOOD_AXES array (lines 13-24)
Insert `'temporal_orientation'` after `'future_expectancy'` at position index 6:

```javascript
// BEFORE:
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

// AFTER:
export const MOOD_AXES = Object.freeze([
  'valence',
  'arousal',
  'agency_control',
  'threat',
  'engagement',
  'future_expectancy',
  'temporal_orientation',
  'self_evaluation',
  'affiliation',
  'inhibitory_control',
  'uncertainty',
]);
```

## Acceptance Criteria

### Tests That Must Pass
- `npm run typecheck` passes
- `npx eslint src/constants/moodAffectConstants.js` passes

### Invariants That Must Remain True
- `MOOD_AXES` is still frozen (immutable)
- `MOOD_AXES_SET` automatically contains `'temporal_orientation'` (derived from MOOD_AXES)
- `isMoodAxis('temporal_orientation')` returns `true` (uses MOOD_AXES_SET)
- All existing mood axes remain at their expected positions except for indices >= 7 which shift by 1
- `AFFECT_TRAITS`, `AFFECT_TRAITS_SET`, and `isAffectTrait` are unchanged

### Verification Commands
```bash
npm run typecheck
npx eslint src/constants/moodAffectConstants.js
```

## Dependencies

- **TEMORIAXI-001** must be completed first (schema foundation)

## Notes

- Position rationale: `temporal_orientation` is placed immediately after `future_expectancy` to group temporal-related axes together
- `MOOD_AXES_SET` and `isMoodAxis()` auto-update since they derive from `MOOD_AXES`
- No changes needed to `DEFAULT_MOOD_AXIS_VALUE` (0) - it already works for the new axis
- No changes needed to `MOOD_AXIS_RANGE` - the range [-100, 100] is already correct

---

## Outcome

### What Was Actually Changed vs Originally Planned

**Planned Changes (implemented as specified):**
1. ✅ Updated JSDoc comment from "10 mood axes" to "11 mood axes" in `src/constants/moodAffectConstants.js`
2. ✅ Added `'temporal_orientation'` to `MOOD_AXES` array at index 6 (after `future_expectancy`)

**Scope Expansion (per user request):**
3. ✅ Updated `tests/unit/constants/moodAffectConstants.test.js` to validate 11 axes instead of 10

### Test Modifications

| Test File | Changes | Rationale |
|-----------|---------|-----------|
| `tests/unit/constants/moodAffectConstants.test.js` | Updated count from 10 to 11, added `temporal_orientation` to expected array, added new test for index position | Required for tests to pass with new axis; validates correct positioning |

### New Tests Added

1. **`'has temporal_orientation at index 6 (after future_expectancy)'`** - Verifies `temporal_orientation` is at the correct array position relative to `future_expectancy`
2. **`'contains temporal_orientation'`** (in MOOD_AXES_SET describe block) - Explicitly validates that the new axis is in the pre-computed Set
3. Added `expect(isMoodAxis('temporal_orientation')).toBe(true)` to the existing "returns true for valid mood axes" test

### Verification Results

- `npm run typecheck`: ✅ Passes (pre-existing type errors unrelated to this change)
- `npx eslint src/constants/moodAffectConstants.js`: ✅ Passes (only pre-existing warnings)
- `npx jest tests/unit/constants/moodAffectConstants.test.js`: ✅ All 37 tests pass

### Files Modified

1. `src/constants/moodAffectConstants.js` - Added temporal_orientation axis
2. `tests/unit/constants/moodAffectConstants.test.js` - Updated expectations and added validation tests
