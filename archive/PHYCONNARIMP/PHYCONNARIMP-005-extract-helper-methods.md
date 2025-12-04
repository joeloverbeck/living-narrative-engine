# PHYCONNARIMP-005: Extract Helper Methods for Code Clarity

## Status: ✅ COMPLETED (2025-12-04)

---

## Outcome

### What Was Actually Changed vs Originally Planned

**Originally Planned (7 methods)**:
- `#buildDismemberedPartIdSet(summary)`
- `#formatDyingMessage(turnsRemaining)`
- `#formatDismembermentFirstPerson(summary)`
- `#formatHealthStatesFirstPerson(summary, excludePartIds)`
- `#formatOtherEffectsFirstPerson(summary, excludePartIds)`
- `#formatBleedingEffectsFirstPerson(bleedingParts)`
- `#formatListWithOxfordComma(items)`

**Actually Extracted (3 methods)**:
- `#buildDismemberedPartIdSet(summary)` - lines 402-406
- `#formatDyingMessage(turnsRemaining)` - lines 415-418
- `#formatDismembermentFirstPerson(summary)` - lines 427-433

**Already Existed (4 methods)**:
- `#formatEffectsFirstPerson(summary, dismemberedPartIds)` - existed at lines 287-336
- `#formatBleedingEffectsFirstPerson(bleedingParts)` - existed at lines 346-375
- `#formatListWithOxfordComma(items)` - existed at lines 384-392
- `#formatPartGroupFirstPerson(parts, state)` - existed at lines 260-277

### Files Changed
| File | Change |
|------|--------|
| `src/anatomy/services/injuryNarrativeFormatterService.js` | Extracted 3 inline code blocks into dedicated private methods with JSDoc |

### Test Results
- **All 64 tests pass** without modification
- Behavior-preserving refactoring confirmed
- No new tests needed (existing coverage sufficient)

### Notes
- Original ticket overestimated scope significantly (~92-350 lines → ~30 lines actual)
- Previous tickets (001-004) had already implemented most helper methods
- ESLint found pre-existing issues unrelated to this refactoring (unused `#getPossessivePronoun` method)

---

## Summary

Refactor `formatFirstPerson()` into smaller, focused private methods to improve code clarity, testability, and maintainability. This is a code quality improvement that consolidates the structural changes from tickets 001-004.

## Problem Statement

After applying tickets 001-004, the `formatFirstPerson()` method will have grown organically. This ticket consolidates and structures the code into well-named helper methods following the Single Responsibility Principle.

## Solution

Extract the following private helper methods:

```javascript
formatFirstPerson(summary) {
  if (!summary) {
    this.#logger.warn('formatFirstPerson called with null/undefined summary');
    return 'I feel fine.';
  }

  if (summary.isDead) return 'Everything fades to black...';
  if (summary.isDying) return this.#formatDyingMessage(summary.dyingTurnsRemaining);
  if (!summary.injuredParts || summary.injuredParts.length === 0) return 'I feel fine.';

  // Build exclusion set for dismembered parts
  const dismemberedPartIds = this.#buildDismemberedPartIdSet(summary);

  const narrativeParts = [];

  // 1. Dismemberment (highest priority)
  const dismemberment = this.#formatDismembermentFirstPerson(summary);
  if (dismemberment) narrativeParts.push(dismemberment);

  // 2. Health states (excluding dismembered)
  const healthStates = this.#formatHealthStatesFirstPerson(summary, dismemberedPartIds);
  if (healthStates) narrativeParts.push(healthStates);

  // 3. Other effects (excluding dismembered)
  const effects = this.#formatOtherEffectsFirstPerson(summary, dismemberedPartIds);
  if (effects) narrativeParts.push(effects);

  return narrativeParts.join(' ') || 'I feel fine.';
}
```

### New Helper Methods

| Method | Purpose |
|--------|---------|
| `#buildDismemberedPartIdSet(summary)` | Create Set of dismembered part IDs for filtering |
| `#formatDyingMessage(turnsRemaining)` | Generate dying state message |
| `#formatDismembermentFirstPerson(summary)` | Generate "is missing" sentences |
| `#formatHealthStatesFirstPerson(summary, excludePartIds)` | Generate health state sentences |
| `#formatOtherEffectsFirstPerson(summary, excludePartIds)` | Generate effect sentences |
| `#formatBleedingEffectsFirstPerson(bleedingParts)` | Group and format bleeding |
| `#formatListWithOxfordComma(items)` | Format array with proper grammar |

---

## Files to Touch

| File | Change Type | Lines |
|------|-------------|-------|
| `src/anatomy/services/injuryNarrativeFormatterService.js` | Refactor | Minor extraction (~30 lines new, ~15 lines replaced) |
| `tests/unit/anatomy/services/injuryNarrativeFormatterService.test.js` | Verify only | All 64 existing tests must pass |

### Corrected Assumptions (2025-12-04)

**Methods that already exist** (no changes needed):
- `#formatEffectsFirstPerson(summary, dismemberedPartIds)` - lines 299-348
- `#formatBleedingEffectsFirstPerson(bleedingParts)` - lines 358-387
- `#formatListWithOxfordComma(items)` - lines 396-404

**Methods to extract from inline code**:
- `#buildDismemberedPartIdSet(summary)` - Extract from lines 124-126
- `#formatDyingMessage(turnsRemaining)` - Extract from lines 105-109
- `#formatDismembermentFirstPerson(summary)` - Extract from lines 129-133

**Original scope overestimate**: The ticket assumed "Major restructure (~92-350)" but the actual `formatFirstPerson()` method is only ~75 lines and already well-organized. Most helper methods were implemented in previous tickets.

---

## Out of Scope

The following are **explicitly NOT part of this ticket**:

- `src/anatomy/services/injuryAggregationService.js` - Data source unchanged
- `src/anatomy/registries/healthStateRegistry.js` - No changes
- `src/domUI/injuryStatusPanel.js` - UI integration separate
- `src/turns/services/actorDataExtractor.js` - LLM integration separate
- Any new functionality or behavior changes
- New test cases for edge cases (covered in 001-004)

---

## Acceptance Criteria

### Tests That Must Pass

#### All Existing Tests

Every test from the original test suite PLUS all tests added in tickets 001-004 must pass without modification.

#### No Behavior Change Verification

Run the following verification:
1. Save output of `formatFirstPerson()` with 10+ test scenarios BEFORE refactoring
2. Run same scenarios AFTER refactoring
3. Outputs must be **byte-for-byte identical**

### Invariants That Must Remain True

1. **Behavioral Parity**: Output is identical before and after refactoring
2. **Public API Stability**: `formatFirstPerson(summary)` signature unchanged
3. **No New Dependencies**: No new imports or service dependencies
4. **Method Visibility**: All new methods are private (`#` prefix)
5. **Code Quality**:
   - Each method < 30 lines
   - Single responsibility per method
   - Clear method naming

### Code Quality Checklist

- [x] All new methods have JSDoc comments
- [x] No method exceeds 30 lines
- [x] No deep nesting (max 3 levels)
- [x] Consistent naming conventions
- [x] No magic strings (use constants)
- [x] Passes ESLint without new warnings

---

## Implementation Notes

### Method Extraction Order

1. `#buildDismemberedPartIdSet()` - Simple extraction
2. `#formatDyingMessage()` - Simple extraction
3. `#formatDismembermentFirstPerson()` - From effects section
4. `#formatHealthStatesFirstPerson()` - Main loop extraction
5. `#formatOtherEffectsFirstPerson()` - Bleeding/burning/etc.
6. `#formatBleedingEffectsFirstPerson()` - From PHYCONNARIMP-004
7. `#formatListWithOxfordComma()` - From PHYCONNARIMP-004

---

## Dependencies

- PHYCONNARIMP-001 (duplicate fix in place)
- PHYCONNARIMP-002 (filtering in place)
- PHYCONNARIMP-003 (ordering in place)
- PHYCONNARIMP-004 (bleeding grouping in place)

## Blocked By

- PHYCONNARIMP-001
- PHYCONNARIMP-002
- PHYCONNARIMP-003
- PHYCONNARIMP-004

## Blocks

- PHYCONNARIMP-006 (integration tests run after refactoring)
