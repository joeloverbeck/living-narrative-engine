# DAMSIMOVEHEA-001: Extract Overall Health Calculation

## Summary
Expose `InjuryAggregationService.calculateOverallHealth()` as a public method so the damage simulator can reuse the canonical calculation.

## Status
Completed

## Motivation
The damage simulator needs to display overall entity health, but the canonical calculation exists only as a private method in `InjuryAggregationService`. To maintain a single source of truth for health calculations across the entire app, this method must be exposed.

## Reassessed Assumptions
- Overall health calculation is already exercised indirectly via `aggregateInjuries()` tests in `tests/unit/anatomy/services/injuryAggregationService.test.js`.
- There are no existing direct tests for `calculateOverallHealth()` because the method is currently private.
- The method is only referenced internally in `InjuryAggregationService` today (no external call sites to preserve).

## Files to Touch

| File | Changes |
|------|---------|
| `src/anatomy/services/injuryAggregationService.js` | Change `#calculateOverallHealth()` from private to public `calculateOverallHealth()` |
| `tests/unit/anatomy/services/injuryAggregationService.test.js` | Add unit tests for the newly exposed public method |

## Out of Scope

- **NO changes to calculation logic** - The algorithm must remain identical
- **NO changes to existing consumers** - InjuryStatusPanel, prompt formatters must work unchanged
- **NO UI changes** - This ticket is backend/service only
- **NO DI registration changes** - InjuryAggregationService is already registered
- **NO new dependencies** - No additional imports or services

## Implementation Details

### Current State (near the end of injuryAggregationService.js)
```javascript
#calculateOverallHealth(partInfos) {
  if (partInfos.length === 0) return 100;
  let totalWeightedHealth = 0;
  let totalWeight = 0;
  for (const part of partInfos) {
    const weight = this.#getPartWeight(part);
    totalWeightedHealth += part.healthPercentage * weight;
    totalWeight += weight;
  }
  if (totalWeight === 0) return 100;
  let calculatedHealth = Math.round(totalWeightedHealth / totalWeight);
  // Apply data-driven vital organ caps
  for (const part of partInfos) {
    if (part.vitalOrganCap) {
      const { threshold, capValue } = part.vitalOrganCap;
      if (part.healthPercentage <= threshold) {
        calculatedHealth = Math.min(calculatedHealth, capValue);
      }
    }
  }
  return calculatedHealth;
}
```

### Target State
```javascript
/**
 * Calculate overall health from an array of part information objects.
 * Uses weighted average with vital organ cap adjustments.
 *
 * @param {Array<{healthPercentage: number, healthCalculationWeight?: number, vitalOrganCap?: {threshold: number, capValue: number}}>} partInfos
 * @returns {number} Overall health percentage (0-100)
 */
calculateOverallHealth(partInfos) {
  // Same logic, now public
}
```

### Internal Call Site Update
The internal method `#aggregateEntityHealth()` currently calls `this.#calculateOverallHealth()`. After refactoring:
- Update call to `this.calculateOverallHealth()`
- Behavior must remain identical

## Acceptance Criteria

### Tests That Must Pass

1. **New: Direct coverage of `calculateOverallHealth()`**
   - Add a small unit test set that calls `calculateOverallHealth()` directly (minimal duplication of existing aggregate tests).
   - Cover empty input, weighted average rounding, vital organ cap, and default weight behavior.

2. **Existing tests must pass unchanged**
   - All current `InjuryAggregationService` tests
   - Run: `npm run test:unit -- tests/unit/anatomy/services/injuryAggregationService.test.js`

### Invariants

1. **Calculation consistency**: `calculateOverallHealth()` returns identical values to the previous `#calculateOverallHealth()`
2. **Backward compatibility**: `InjuryStatusPanel` displays the same health values
3. **Prompt consistency**: LLM prompts show the same health percentages
4. **No side effects**: Method remains pure (no state changes, no events dispatched)

## Definition of Done

- [ ] `#calculateOverallHealth()` renamed to `calculateOverallHealth()` (public)
- [ ] JSDoc added with parameter and return type documentation
- [ ] Internal call site updated from `this.#` to `this.`
- [ ] All new unit tests pass
- [ ] All existing unit tests pass
- [ ] Manual verification: InjuryStatusPanel still shows correct health in game.html (optional if no UI touched)
- [ ] Code reviewed and merged

## Outcome
- Exposed `calculateOverallHealth()` publicly and updated the internal call site.
- Added direct unit tests for the public method while keeping existing aggregate coverage intact.
- No UI or DI changes were needed; manual UI verification was not performed.
