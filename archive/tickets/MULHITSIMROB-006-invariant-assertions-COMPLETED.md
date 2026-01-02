# MULHITSIMROB-006: Add Development-Mode Invariant Assertions

## Summary

Add `console.assert` calls to verify key invariants during development, making bugs more visible and self-documenting the code's assumptions.

## Status

Completed

## Background

The `MultiHitSimulator` has several invariants that must hold (documented in the spec's Invariants section):

1. `hitsExecuted >= 1` when `#updateResultsDisplay` is called
2. `#isRunning === true` during the simulation loop
3. After a delay completes, both `#delayTimeout` and `#delayResolve` are nulled together

Adding development-mode assertions makes violations immediately visible during testing.

**Reference**: `specs/multi-hit-simulator-robustness.md` (Invariants section, plus the invariant-check example near the end)

## Files to Touch

| File | Action | Description |
|------|--------|-------------|
| `src/domUI/damage-simulator/MultiHitSimulator.js` | MODIFY | Add console.assert calls |
| `tests/unit/domUI/damage-simulator/MultiHitSimulator.test.js` | OPTIONAL | May need test for assertion behavior |

## Out of Scope

- NOT changing production behavior
- NOT modifying API contracts
- NOT adding runtime validation that throws in production
- NOT adding assertions to TargetSelector (separate concern)
- NOT adding assertions that affect performance significantly

## Implementation Details

### Assertion 1: hitsExecuted Before Display Update

```javascript
#updateResultsDisplay(results) {
  // Invariant: hitsExecuted must be >= 1 when updating results
  if (process.env.NODE_ENV !== 'production') {
    console.assert(
      results.hitsExecuted >= 1,
      `Invariant violation: hitsExecuted must be >= 1, got ${results.hitsExecuted}`
    );
  }
  // ... rest of method
}
```

### Assertion 2: isRunning During Loop

```javascript
async run() {
  // ... setup code

  while (progress.currentHit < hitCount && !this.#shouldStop) {
    // Invariant: #isRunning must be true during the loop
    if (process.env.NODE_ENV !== 'production') {
      console.assert(
        this.#isRunning === true,
        'Invariant violation: #isRunning must be true during simulation loop'
      );
    }
    // ... loop body
  }
}
```

### Assertion 3: Delay Cleanup Consistency

```javascript
#delay(ms) {
  return new Promise((resolve) => {
    this.#delayResolve = resolve;
    this.#delayTimeout = setTimeout(() => {
      this.#delayTimeout = null;
      this.#delayResolve = null;

      // Invariant: Both should be null together after cleanup
      if (process.env.NODE_ENV !== 'production') {
        console.assert(
          this.#delayTimeout === null && this.#delayResolve === null,
          'Invariant violation: delayTimeout and delayResolve must both be null after cleanup'
        );
      }

      resolve();
    }, ms);
  });
}
```

### Alternative: Centralized Invariant Check

```javascript
/**
 * Checks invariant in development mode only.
 * No-op in production for zero performance cost.
 * @param {boolean} condition - Must be true
 * @param {string} message - Error message if false
 */
#assertInvariant(condition, message) {
  if (process.env.NODE_ENV !== 'production') {
    console.assert(condition, `Invariant violation: ${message}`);
  }
}

// Usage
this.#assertInvariant(results.hitsExecuted >= 1, 'hitsExecuted must be >= 1');
```

## Acceptance Criteria

### Tests That Must Pass

- [ ] Relevant existing tests pass
- [ ] No console.assert failures during normal test runs
- [ ] Assertions are not evaluated in production builds

### Invariants That Must Remain True

- Production behavior unchanged (assertions are no-ops)
- No new exceptions in production code
- No performance impact in production

### Verification

```javascript
// Test that assertions work in dev mode
describe('Development Mode Invariants', () => {
  it('should assert hitsExecuted >= 1 before results display', () => {
    // This is an internal invariant - if violated, console.assert fires
    // No direct test needed if invariant can never be violated by normal use
  });
});
```

## Verification Commands

```bash
# Run tests (assertions should not fire for valid inputs)
NODE_ENV=test npx jest tests/unit/domUI/damage-simulator/MultiHitSimulator.test.js --no-coverage --verbose

# Verify no console.assert failures in test output
NODE_ENV=test npx jest tests/unit/domUI/damage-simulator/MultiHitSimulator.test.js 2>&1 | grep -i assert

# Build for production (assertions should be no-op)
npm run build
```

## Dependencies

- **Blocks**: None
- **Blocked by**: None (resolvePartId already exists in the current codebase)
- **Related**: MULHITSIMROB-008 (state machine may provide stronger guarantees)

## Estimated Effort

Trivial - add 3-5 assertion statements.

## Design Notes

### Why console.assert?

- Built-in, no dependencies
- Can be stripped by minifiers in production
- Self-documenting (shows what MUST be true)
- Doesn't throw in production, just logs

### Why process.env.NODE_ENV Check?

- Explicit opt-out for production
- Works with all bundlers (webpack, esbuild, rollup)
- Tree-shakeable in production builds

### Alternative: Invariant Library

Could use an invariant library like `tiny-invariant`, but `console.assert` is sufficient for this use case and has zero dependencies.

## Reference Files

- Source: `src/domUI/damage-simulator/MultiHitSimulator.js`
- Spec: `specs/multi-hit-simulator-robustness.md` (Invariants section and invariant-check example)

## Outcome

Added development-only invariant assertions via a shared helper and verified production gating with a unit test, while adjusting the ticket assumptions to match current delay cleanup behavior and removing the fixed test-count requirement.
