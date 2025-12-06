# PHYCONNARIMP-001: Fix Duplicate Part Counting in Injury Narrative

## Status: COMPLETED

---

## Summary

Remove duplicate body part references in the first-person injury narrative output. Currently, destroyed parts appear twice because they exist in both `destroyedParts` and `injuredParts` arrays, and the formatter code redundantly merges them.

## Problem Statement

**Current buggy output:**

```
My right ear and right ear is completely numb.
```

**Expected output:**

```
My right ear is completely numb.
```

## Root Cause

In `injuryNarrativeFormatterService.js` lines 129-136, when processing `state === 'destroyed'`:

```javascript
if (state === 'destroyed') {
  parts = [...(summary.destroyedParts || [])];
  if (summary.injuredParts) {
    parts.push(...summary.injuredParts.filter((p) => p.state === 'destroyed'));
  }
}
```

The code first takes all `destroyedParts`, then adds parts from `injuredParts` with `state === 'destroyed'`. Since `injuredParts` already contains destroyed parts (anything with `state !== 'healthy'`), this creates duplicates.

## Solution

Remove the redundant filter that adds from `injuredParts`:

```javascript
if (state === 'destroyed') {
  parts = [...(summary.destroyedParts || [])];
  // REMOVED: no longer add from injuredParts since destroyedParts is authoritative
}
```

---

## Files to Touch

| File                                                                  | Change Type | Lines          |
| --------------------------------------------------------------------- | ----------- | -------------- |
| `src/anatomy/services/injuryNarrativeFormatterService.js`             | Modify      | ~129-136       |
| `tests/unit/anatomy/services/injuryNarrativeFormatterService.test.js` | Add tests   | New test cases |

---

## Out of Scope

The following are **explicitly NOT part of this ticket**:

- `src/anatomy/services/injuryAggregationService.js` - Do not modify the data source
- `src/anatomy/registries/healthStateRegistry.js` - No changes
- `src/domUI/injuryStatusPanel.js` - UI integration is separate
- `src/turns/services/actorDataExtractor.js` - LLM integration is separate
- Any changes to output order or grouping (covered in PHYCONNARIMP-003, PHYCONNARIMP-004)
- Dismemberment filtering (covered in PHYCONNARIMP-002)
- Helper method extraction/refactoring (covered in PHYCONNARIMP-005)

---

## Acceptance Criteria

### Tests That Must Pass

#### New Unit Tests

1. **`should not duplicate destroyed parts in output`**
   - Input: Summary with same part in both `injuredParts` and `destroyedParts`
   - Assert: Part name appears exactly once in output

2. **`should handle multiple destroyed parts without duplication`**
   - Input: Summary with 2+ destroyed parts in both arrays
   - Assert: Each part name appears exactly once

#### Existing Tests

All existing tests in `tests/unit/anatomy/services/injuryNarrativeFormatterService.test.js` must continue to pass.

### Invariants That Must Remain True

1. **Single Mention Rule**: No body part should appear more than once in the narrative output
2. **Destroyed Parts Coverage**: All parts in `destroyedParts` array must be mentioned (if not dismembered)
3. **Format Consistency**: Output format for destroyed parts remains `"My {part} is completely numb."`
4. **Public API Stability**: `formatFirstPerson(summary)` signature unchanged

### Manual Verification

Run the formatter with this test case:

```javascript
const summary = {
  entityId: 'test',
  injuredParts: [
    {
      partEntityId: 'p1',
      partType: 'arm',
      orientation: 'left',
      state: 'destroyed',
    },
  ],
  destroyedParts: [
    {
      partEntityId: 'p1',
      partType: 'arm',
      orientation: 'left',
      state: 'destroyed',
    },
  ],
  bleedingParts: [],
  burningParts: [],
  poisonedParts: [],
  fracturedParts: [],
  dismemberedParts: [],
  isDying: false,
  isDead: false,
};
```

Expected: `"My left arm is completely numb."` (NOT `"My left arm and left arm is completely numb."`)

---

## Implementation Notes

- This is a **minimal, surgical fix** - just remove the redundant filter
- Low risk: isolated change in a single location
- No refactoring needed for this ticket
- Estimated diff: ~5 lines removed

---

## Dependencies

- None - this ticket can be worked independently

## Blocked By

- None

## Blocks

- PHYCONNARIMP-002 (benefits from clean data flow, but not strictly required)

---

## Outcome

### What Was Actually Changed

1. **Source Code** (`src/anatomy/services/injuryNarrativeFormatterService.js`):
   - Removed lines 132-136: the redundant filter that merged `injuredParts` with `destroyedParts`
   - Updated comment to clarify `destroyedParts` is the authoritative source
   - Net change: -5 lines (exactly as estimated)

2. **Tests** (`tests/unit/anatomy/services/injuryNarrativeFormatterService.test.js`):
   - Added new `describe('duplicate part deduplication')` block with 3 tests:
     - `should not duplicate destroyed parts in output`
     - `should handle multiple destroyed parts without duplication`
     - `should produce correct grammar for single destroyed part`

### Verification Results

- All 43 unit tests pass (40 existing + 3 new)
- All 8 underscore conversion tests pass
- Public API unchanged (`formatFirstPerson(summary)` signature preserved)
- No breaking changes to downstream consumers

### Discrepancies From Plan

**None** - implementation matched the ticket exactly:

- Same lines modified as specified
- Same fix approach (remove redundant filter)
- Same test structure as provided in template
- Added one extra test (`should produce correct grammar`) to explicitly verify the "My right ear and right ear" bug from the problem statement

### Pre-existing Issues (Not Fixed)

The source file has pre-existing linting issues unrelated to this ticket:

- Line 167: `entityPronoun` assigned but never used
- Line 355: `#getPossessivePronoun` defined but never used

These are out of scope for PHYCONNARIMP-001.
