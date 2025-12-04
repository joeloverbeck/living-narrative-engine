# PHYCONNARIMP-003: Prioritize Dismemberment at Top of Narrative Report

## Status: COMPLETED

## Summary

Reorder the narrative output so that dismemberment descriptions appear FIRST, before health states and other effects. Losing a body part is the most severe and immediately noticeable condition.

## Problem Statement

**Current output order:**
```
My torso screams with agony. My upper head throbs painfully. My right ear is missing.
Blood flows steadily from my torso.
```

**Expected output order:**
```
My right ear is missing. My torso screams with agony. My upper head throbs painfully.
Blood flows steadily from my torso.
```

## Root Cause

The current `formatFirstPerson()` method processes in this order:
1. Health states by severity (destroyed → critical → injured → wounded → scratched)
2. Effects (dismembered → bleeding → burning → poisoned → fractured)

Dismemberment is processed inside `#formatEffectsFirstPerson()` (lines 295-300), which is called AFTER the health state loop completes.

## Solution

Extract dismemberment formatting to run BEFORE health states:

1. Add dismemberment formatting directly in `formatFirstPerson()` BEFORE the health state loop
2. Remove dismemberment processing from `#formatEffectsFirstPerson()` (it becomes "other effects" only)

```javascript
formatFirstPerson(summary) {
  // ... dead/dying checks ...

  const narrativeParts = [];
  const dismemberedPartIds = new Set(/* ... */);

  // 1. FIRST: Dismemberment (highest priority - body part loss)
  const dismemberedParts = summary.dismemberedParts || [];
  for (const part of dismemberedParts) {
    const partName = this.#formatPartName(part.partType, part.orientation);
    narrativeParts.push(`My ${partName} is missing.`);
  }

  // 2. Health states by severity (already excludes dismembered parts)
  // ... existing loop ...

  // 3. Other effects (bleeding, burning, etc.) - dismemberment removed from here
  const effectDescriptions = this.#formatEffectsFirstPerson(summary, dismemberedPartIds);
  // ...
}
```

---

## Files Changed

| File | Change Type | Lines |
|------|-------------|-------|
| `src/anatomy/services/injuryNarrativeFormatterService.js` | Modify | ~128-133, ~160, ~302-303 |
| `tests/unit/anatomy/services/injuryNarrativeFormatterService.test.js` | Add tests | 5 new test cases |

---

## Out of Scope

The following are **explicitly NOT part of this ticket**:

- `src/anatomy/services/injuryAggregationService.js` - Data source unchanged
- `src/anatomy/registries/healthStateRegistry.js` - No changes
- `src/domUI/injuryStatusPanel.js` - UI integration separate
- `src/turns/services/actorDataExtractor.js` - LLM integration separate
- Duplicate deduplication (PHYCONNARIMP-001)
- Dismemberment filtering logic (PHYCONNARIMP-002) - **ALREADY IMPLEMENTED**
- Bleeding grouping (PHYCONNARIMP-004)
- Method extraction/refactoring (PHYCONNARIMP-005)

---

## Acceptance Criteria

### Tests That Must Pass

#### New Unit Tests (Added)

1. **`should show dismemberment before health states`** ✅
   - Input: Summary with dismembered ear AND critical torso
   - Assert: "is missing" appears BEFORE "screams with agony" in output string

2. **`should show dismemberment before bleeding`** ✅
   - Input: Summary with dismembered arm AND bleeding torso
   - Assert: "is missing" appears BEFORE "Blood" in output

3. **`should maintain health state order after dismemberment`** ✅
   - Input: Summary with dismembered part + destroyed + critical + wounded parts
   - Assert: After dismemberment, health states appear in severity order

4. **`should handle only dismemberment without other injuries`** ✅
   - Input: Summary with only dismembered parts, no other injuries
   - Assert: Output is only "My X is missing." sentences

5. **`should handle no dismemberment with health states only`** ✅
   - Input: Summary with health states but no dismemberment
   - Assert: Output starts with health states (no "is missing")

#### Existing Tests

All 52 existing tests continue to pass (57 total with new tests).

### Invariants That Remain True

1. **Dismemberment First**: All "is missing" sentences appear before any health state sentences ✅
2. **Health State Order Preserved**: Within health states, severity order (destroyed → critical → ...) is maintained ✅
3. **Effects After Health**: Bleeding/burning/etc. appear after health states ✅
4. **Public API Stability**: `formatFirstPerson(summary)` signature unchanged ✅

### Expected Output Order

```
1. Dismemberment     → "My X is missing."
2. Destroyed         → "My X is completely numb."
3. Critical          → "My X screams with agony."
4. Injured           → "My X aches deeply."
5. Wounded           → "My X throbs painfully."
6. Scratched         → "My X stings slightly."
7. Bleeding          → "Blood flows from my X."
8. Burning           → "Searing heat radiates from my X."
9. Poisoned          → "A sickening feeling spreads from my X."
10. Fractured        → "Sharp pain shoots through my X."
```

---

## Implementation Notes

- This is primarily a reorganization of existing code
- The dismemberment formatting logic already existed in `#formatEffectsFirstPerson()` (lines 295-300)
- Extracted dismemberment handling to run FIRST in `formatFirstPerson()`
- Modified `#formatEffectsFirstPerson()` to skip dismemberment (it only handles other effects now)
- Low risk: reorganization, not new logic
- PHYCONNARIMP-002 (dismemberment filtering) was already complete - the filtering logic was in place

---

## Dependencies

- ~~PHYCONNARIMP-002~~ - **ALREADY COMPLETE** (filtering is implemented in current code)

## Blocked By

- None (PHYCONNARIMP-002 was already done)

## Blocks

- PHYCONNARIMP-005 (refactoring depends on final structure)
- PHYCONNARIMP-006 (integration tests verify final output)

---

## Outcome

### What Was Changed

1. **`src/anatomy/services/injuryNarrativeFormatterService.js`**:
   - Added dismemberment processing loop at lines 128-133 in `formatFirstPerson()`, BEFORE the health state loop
   - Updated comment at line 160 to clarify the new ordering
   - Removed dismemberment processing from `#formatEffectsFirstPerson()` (lines 302-303), replaced with explanatory comment

2. **`tests/unit/anatomy/services/injuryNarrativeFormatterService.test.js`**:
   - Added new `describe('dismemberment priority ordering')` block with 5 test cases (lines 963-1254)

### Differences from Original Plan

- **Ticket corrections**: Updated ticket to note that PHYCONNARIMP-002 was already implemented (filtering logic was in place)
- **Minimal changes**: Made only 3 targeted code edits instead of full restructure
- **No breaking changes**: Public API unchanged, all existing tests pass

### Test Results

- **57 tests pass** (52 existing + 5 new)
- All ordering invariants verified
- No lint issues introduced by changes
