# MULHITSIMROB-005: Extract #resolvePartId Helper Method

## Summary

Extract the multi-level fallback chain for part ID resolution into a dedicated private method for clarity and testability.

## Background

The damage result handling uses a triple-fallback pattern that's difficult to test and understand:

```javascript
const hitPartId = firstResult.targetPartId || targetPartId || 'unknown';
```

Extracting this into a method makes each fallback path testable individually.

**Reference**: `specs/multi-hit-simulator-robustness.md` section "Simplify Fallback Chains"

## Files to Touch

| File | Action | Description |
|------|--------|-------------|
| `src/domUI/damage-simulator/MultiHitSimulator.js` | MODIFY | Add #resolvePartId private method |
| `tests/unit/domUI/damage-simulator/MultiHitSimulator.test.js` | MODIFY | Add tests for new method behavior |

## Out of Scope

- NOT changing external API
- NOT modifying TargetSelector
- NOT changing event emission behavior
- NOT changing the fallback order
- NOT adding validation or logging

## Implementation Details

### Current Code (around line 322)

```javascript
// In the simulation loop
const hitPartId = firstResult.targetPartId || targetPartId || 'unknown';
results.partHitCounts[hitPartId] = (results.partHitCounts[hitPartId] || 0) + 1;
```

### Target Implementation

```javascript
/**
 * Resolves the part ID from damage result or selector target.
 * Fallback order: result.targetPartId > selectorTarget > 'unknown'
 * @param {Object} result - Damage result object
 * @param {string|null} selectorTarget - Target from TargetSelector
 * @returns {string} Resolved part ID
 */
#resolvePartId(result, selectorTarget) {
  if (result?.targetPartId) return result.targetPartId;
  if (selectorTarget) return selectorTarget;
  return 'unknown';
}

// Usage
const hitPartId = this.#resolvePartId(firstResult, targetPartId);
```

### Test Cases to Add (delta vs existing coverage)

```javascript
describe('Part ID Resolution (via partHitCounts behavior)', () => {
  it('should use result.targetPartId when available', async () => {
    // Mock applyDamage to return { targetPartId: 'result-part' }
    // Configure with targetSelector returning 'selector-part'
    // Assert: partHitCounts has 'result-part', not 'selector-part'
  });

  it('should fall back to selector target when result lacks targetPartId', async () => {
    // Mock applyDamage to return { targetPartId: null }
    // Configure with targetSelector returning 'selector-part'
    // Assert: partHitCounts has 'selector-part'
  });
});

Note: The suite already covers the "both null -> unknown" case in the existing
"damage result handling edge cases" section; do not duplicate it.
```

**Note**: Since `#resolvePartId` is private, we test its behavior through the public API (checking `results.partHitCounts`).

## Acceptance Criteria

### Tests That Must Pass

- [ ] All existing tests pass unchanged
- [ ] New fallback path tests pass
- [ ] Result uses `result.targetPartId` when present
- [ ] Result uses selector target when `result.targetPartId` is null/undefined
- [ ] Result uses 'unknown' when both are null/undefined

### Invariants That Must Remain True

- Same fallback order: result > selector > 'unknown'
- Same return values for all input combinations
- No performance regression (simple conditional checks)

### Code Quality

- Method is private (`#resolvePartId`)
- Method has JSDoc comment explaining fallback order
- Single responsibility: resolve part ID, nothing else

## Verification Commands

```bash
# Run MultiHitSimulator tests including new fallback tests
NODE_ENV=test npx jest tests/unit/domUI/damage-simulator/MultiHitSimulator.test.js --no-coverage --verbose

# Coverage check
NODE_ENV=test npx jest tests/unit/domUI/damage-simulator/MultiHitSimulator.test.js --coverage

# Verify 100% branch coverage on new method
NODE_ENV=test npx jest tests/unit/domUI/damage-simulator/MultiHitSimulator.test.js --coverage --collectCoverageFrom='src/domUI/damage-simulator/MultiHitSimulator.js'
```

## Dependencies

- **Blocks**: None
- **Blocked by**: MULHITSIMROB-003 (coverage threshold should be in place)
- **Related**: MULHITSIMROB-006 (invariant assertions may reference this method)

## Estimated Effort

Trivial - extract ~3 lines into a method, add ~3 test cases.

## Reference Files

- Source: `src/domUI/damage-simulator/MultiHitSimulator.js` (around line 322)
- Test: `tests/unit/domUI/damage-simulator/MultiHitSimulator.test.js` (lines 1870-2033 for existing edge case tests)

## Status

Completed.

## Outcome

Added a private `#resolvePartId` helper and routed the run loop through it, plus added focused tests for result-over-selector precedence and selector fallback. The existing "both null -> unknown" test already covered that path, so no duplicate test was added.
