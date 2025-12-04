# PHYCONNARIMP-002: Filter Dismembered Parts from Health State Descriptions

## Status: ✅ COMPLETED

---

## Summary

Prevent dismembered body parts from appearing in health state descriptions. A missing body part should only show "is missing" - it cannot logically be "numb", "in agony", or have any other health-based sensation since it's no longer attached.

## Problem Statement

**Current buggy output:**
```
My right ear is completely numb. My right ear is missing.
```

**Expected output:**
```
My right ear is missing.
```

## Root Cause

The code processes health states and effects independently. A dismembered part has:
1. `state: 'destroyed'` - Health state at 0%
2. `isDismembered: true` - Physical status (severed)

Both get processed, resulting in duplicate and semantically incorrect output.

## Solution

When iterating over health states, exclude any parts that appear in the `dismemberedParts` array:

```javascript
// Build exclusion set ONCE at start
const dismemberedPartIds = new Set(
  (summary.dismemberedParts || []).map(p => p.partEntityId)
);

// In health state processing loop:
if (state === 'destroyed') {
  parts = (summary.destroyedParts || []).filter(
    p => !dismemberedPartIds.has(p.partEntityId)
  );
} else {
  parts = (summary.injuredParts || []).filter(
    p => p.state === state && !dismemberedPartIds.has(p.partEntityId)
  );
}
```

---

## Files to Touch

| File | Change Type | Lines |
|------|-------------|-------|
| `src/anatomy/services/injuryNarrativeFormatterService.js` | Modify | ~119-139 (formatFirstPerson health states loop), ~278-327 (#formatEffectsFirstPerson for bleeding/burning/etc filtering) |
| `tests/unit/anatomy/services/injuryNarrativeFormatterService.test.js` | Add tests | New test cases |

---

## Out of Scope

The following are **explicitly NOT part of this ticket**:

- `src/anatomy/services/injuryAggregationService.js` - Data source unchanged
- `src/anatomy/registries/healthStateRegistry.js` - No changes
- `src/domUI/injuryStatusPanel.js` - UI integration separate
- `src/turns/services/actorDataExtractor.js` - LLM integration separate
- Output reordering (PHYCONNARIMP-003 handles priority)
- Bleeding grouping (PHYCONNARIMP-004)
- Duplicate deduplication (PHYCONNARIMP-001)
- Filtering dismembered parts from effects like bleeding (PHYCONNARIMP-002 only filters health states; effects filtering may be added here or as part of a follow-up)

---

## Acceptance Criteria

### Tests That Must Pass

#### New Unit Tests

1. **`should not show health state for dismembered parts`**
   - Input: Summary with ear that is both `destroyed` and `dismembered`
   - Assert: Output contains "is missing", NOT "is completely numb"

2. **`should show health state for destroyed but non-dismembered parts`**
   - Input: Summary with destroyed torso (not dismembered)
   - Assert: Output contains "is completely numb", NOT "is missing"

3. **`should not show bleeding for dismembered parts`**
   - Input: Summary with dismembered arm that is also bleeding
   - Assert: Output contains "is missing", NOT "Blood" or "blood"

4. **`should handle multiple dismembered parts`**
   - Input: Summary with 2+ dismembered parts
   - Assert: Each shows only "is missing"

5. **`should not exclude non-dismembered parts when some are dismembered`**
   - Input: Summary with one dismembered ear AND one wounded torso
   - Assert: Ear shows "is missing", torso shows health state

#### Existing Tests

All existing tests must continue to pass.

### Invariants That Must Remain True

1. **Dismembered = Missing Only**: Parts in `dismemberedParts` array produce ONLY "is missing" output
2. **Non-Dismembered Parts Unaffected**: Parts NOT in `dismemberedParts` retain normal health state output
3. **Semantic Correctness**: A missing part cannot have health sensations
4. **Public API Stability**: `formatFirstPerson(summary)` signature unchanged

### Business Rules

| Part State | Has `isDismembered` | Output |
|------------|---------------------|--------|
| destroyed | No | "My X is completely numb." |
| destroyed | Yes | "My X is missing." (from effects section only) |
| critical | No | "My X screams with agony." |
| critical | Yes | "My X is missing." (from effects section only) |
| other | No | Appropriate health state description |
| other | Yes | "My X is missing." (from effects section only) |

---

## Implementation Notes

- Create a `Set` from `dismemberedParts.map(p => p.partEntityId)` ONCE at the start
- Use this set to filter in the health states loop
- Also filter the effects (bleeding, burning, etc.) using the same set
- Low-medium complexity: requires filtering in multiple places

---

## Test Code Template

```javascript
describe('dismembered parts filtering', () => {
  it('should not show health state for dismembered parts', () => {
    const summary = {
      entityId: 'entity-1',
      injuredParts: [
        { partEntityId: 'part-1', partType: 'ear', orientation: 'right', state: 'destroyed' }
      ],
      destroyedParts: [
        { partEntityId: 'part-1', partType: 'ear', orientation: 'right', state: 'destroyed' }
      ],
      bleedingParts: [],
      burningParts: [],
      poisonedParts: [],
      fracturedParts: [],
      dismemberedParts: [
        { partEntityId: 'part-1', partType: 'ear', orientation: 'right', isDismembered: true }
      ],
      isDying: false,
      isDead: false,
    };

    const result = service.formatFirstPerson(summary);
    expect(result).toContain('is missing');
    expect(result).not.toContain('is completely numb');
  });

  it('should show health state for destroyed but non-dismembered parts', () => {
    const summary = {
      entityId: 'entity-1',
      injuredParts: [
        { partEntityId: 'part-1', partType: 'torso', orientation: null, state: 'destroyed' }
      ],
      destroyedParts: [
        { partEntityId: 'part-1', partType: 'torso', orientation: null, state: 'destroyed' }
      ],
      bleedingParts: [],
      burningParts: [],
      poisonedParts: [],
      fracturedParts: [],
      dismemberedParts: [],
      isDying: false,
      isDead: false,
    };

    const result = service.formatFirstPerson(summary);
    expect(result).toContain('is completely numb');
    expect(result).not.toContain('is missing');
  });

  it('should not show bleeding for dismembered parts', () => {
    const summary = {
      entityId: 'entity-1',
      injuredParts: [
        { partEntityId: 'part-1', partType: 'arm', orientation: 'left', state: 'destroyed' }
      ],
      destroyedParts: [
        { partEntityId: 'part-1', partType: 'arm', orientation: 'left', state: 'destroyed' }
      ],
      bleedingParts: [
        { partEntityId: 'part-1', partType: 'arm', orientation: 'left', bleedingSeverity: 'severe' }
      ],
      burningParts: [],
      poisonedParts: [],
      fracturedParts: [],
      dismemberedParts: [
        { partEntityId: 'part-1', partType: 'arm', orientation: 'left', isDismembered: true }
      ],
      isDying: false,
      isDead: false,
    };

    const result = service.formatFirstPerson(summary);
    expect(result).toContain('is missing');
    expect(result).not.toContain('Blood');
    expect(result).not.toContain('blood');
  });
});
```

---

## Dependencies

- Recommended: PHYCONNARIMP-001 (cleaner code to work with)

## Blocked By

- None (can work independently, but cleaner after PHYCONNARIMP-001)

## Blocks

- PHYCONNARIMP-003 (priority ordering expects filtering to be in place)

---

## Outcome

### Implementation Summary

**Date Completed**: 2025-12-04

**Changes Made**:

1. **`src/anatomy/services/injuryNarrativeFormatterService.js`**:
   - Added `dismemberedPartIds` Set construction at start of `formatFirstPerson()` (lines 122-126)
   - Added filtering in health states loop to exclude dismembered parts from both `destroyedParts` and `injuredParts` (lines 135-145)
   - Updated `#formatEffectsFirstPerson()` signature to accept `dismemberedPartIds` parameter (line 292)
   - Added filtering for all effect types: bleeding, burning, poisoned, and fractured (lines 303-346)

2. **`tests/unit/anatomy/services/injuryNarrativeFormatterService.test.js`**:
   - Added 9 new tests in `describe('dismembered parts filtering')` block:
     - `should not show health state for dismembered parts`
     - `should show health state for destroyed but non-dismembered parts`
     - `should not show bleeding for dismembered parts`
     - `should handle multiple dismembered parts`
     - `should not exclude non-dismembered parts when some are dismembered`
     - `should not show burning effect for dismembered parts`
     - `should not show poisoned effect for dismembered parts`
     - `should not show fractured effect for dismembered parts`
     - `should filter dismembered from non-destroyed health states` (edge case for non-destroyed states)

### Deviations from Plan

- **Scope expanded**: The ticket noted that "Filtering dismembered parts from effects like bleeding (PHYCONNARIMP-002 only filters health states; effects filtering may be added here or as part of a follow-up)". The implementation included effects filtering as it was the logical completion of the feature and was mentioned in the Implementation Notes section.
- **Additional tests**: Added 4 extra tests beyond the 5 specified in acceptance criteria to cover burning, poisoned, fractured effects, and non-destroyed health states.

### Test Results

All 52 tests pass (43 existing + 9 new):
- All acceptance criteria tests implemented and passing
- All existing tests continue to pass
- Public API `formatFirstPerson(summary)` signature unchanged

### Verification

```bash
NODE_ENV=test npx jest tests/unit/anatomy/services/injuryNarrativeFormatterService.test.js --no-coverage --verbose
# Result: 52 passed, 0 failed
```
