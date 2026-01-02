# MULHITSIMROB-001: Add Property-Based Tests for MultiHitSimulator

## Summary

Add property-based tests using fast-check library to verify key invariants of the MultiHitSimulator class.

## Background

The `MultiHitSimulator` class (831 lines) has complex async behavior with timer management, targeting modes, and state transitions. Property-based testing can verify invariants that hold across many random inputs, catching edge cases that example-based tests might miss.

**Reference**: `specs/multi-hit-simulator-robustness.md` lines 332-338

## Files to Touch

| File | Action | Description |
|------|--------|-------------|
| `tests/unit/domUI/damage-simulator/MultiHitSimulator.propertyBased.test.js` | CREATE | New property-based test file |
| `package.json` | VERIFY | fast-check already installed (confirmed) |

## Out of Scope

- NOT modifying `src/domUI/damage-simulator/MultiHitSimulator.js`
- NOT modifying `tests/unit/domUI/damage-simulator/MultiHitSimulator.test.js`
- NOT modifying integration tests in `tests/integration/domUI/damage-simulator/`
- NOT adding new dependencies (fast-check is already in package.json)
- NOT changing any production behavior

## Implementation Details

### Property 1: Hit Count Invariant

```javascript
// For any valid configuration, hitsExecuted in results equals hitCount when completed
fc.property(
  fc.integer({ min: 1, max: 100 }), // hitCount
  async (hitCount) => {
    // Configure and run simulation
    // Assert: results.hitsExecuted === hitCount when results.completed === true
  }
)
```

### Property 2: Progress Monotonicity

```javascript
// percentComplete never decreases during a run
fc.property(
  fc.integer({ min: 2, max: 20 }), // hitCount (multiple hits to observe progress)
  async (hitCount) => {
    // Track all PROGRESS events
    // Assert: each percentComplete >= previous percentComplete
  }
)
```

### Property 3: Round-Robin Coverage

```javascript
// After N hits where N = parts.length, each part hit exactly once
fc.property(
  fc.array(fc.string(), { minLength: 2, maxLength: 10 }), // partIds
  async (partIds) => {
    // Configure with round-robin mode
    // Run for exactly partIds.length hits
    // Assert: each partId appears exactly once in partHitCounts
  }
)
```

### Property 4: Duration Bounds

```javascript
// durationMs >= delayMs * (hitCount - 1) for non-stopped runs
fc.property(
  fc.integer({ min: 1, max: 10 }), // hitCount
  fc.integer({ min: 10, max: 100 }), // delayMs
  async (hitCount, delayMs) => {
    // Run to completion
    // Assert: results.durationMs >= delayMs * (hitCount - 1)
  }
)
```

## Acceptance Criteria

### Tests That Must Pass

- [x] All 4 property-based tests pass with default iterations (100 runs each)
- [x] All existing 94 unit tests in `MultiHitSimulator.test.js` still pass
- [x] Test file imports and runs without errors

### Invariants That Must Remain True

- [x] Hit count equals configuration when simulation completes
- [x] Progress percentage is monotonically non-decreasing
- [x] Round-robin targeting cycles through all parts exactly once per cycle
- [x] Simulation duration accounts for all delay intervals

### Coverage Requirements

- [x] 100% statement/branch/function/line coverage maintained for `MultiHitSimulator.js`
- [x] New test file should not require changes to source code

## Test File Template

```javascript
/**
 * @file Property-based tests for MultiHitSimulator
 * Uses fast-check to verify invariants across random inputs.
 * @see specs/multi-hit-simulator-robustness.md
 */

jest.setTimeout(30000); // Property tests with many runs need more time

import { describe, it, expect, beforeEach, afterEach, jest } from '@jest/globals';
import fc from 'fast-check';
import MultiHitSimulator from '../../../../src/domUI/damage-simulator/MultiHitSimulator.js';

// Mock factory functions...

describe('MultiHitSimulator - Property-Based Tests', () => {
  describe('Hit Count Invariant', () => { /* ... */ });
  describe('Progress Monotonicity', () => { /* ... */ });
  describe('Round-Robin Coverage', () => { /* ... */ });
  describe('Duration Bounds', () => { /* ... */ });
});
```

## Verification Commands

```bash
# Run property-based tests only
NODE_ENV=test npx jest tests/unit/domUI/damage-simulator/MultiHitSimulator.propertyBased.test.js --no-coverage --verbose

# Verify existing tests still pass
NODE_ENV=test npx jest tests/unit/domUI/damage-simulator/MultiHitSimulator.test.js --no-coverage --silent

# Full coverage check
NODE_ENV=test npx jest tests/unit/domUI/damage-simulator/ --coverage
```

## Dependencies

- **Blocks**: None
- **Blocked by**: None
- **Related**: MULHITSIMROB-002 (integration tests), MULHITSIMROB-003 (CI coverage)

## Estimated Effort

Small - focused test file creation with established patterns from other property tests in the codebase.

## Reference Files

- Pattern: `tests/unit/anatomy/damage-types.property.test.js`
- Pattern: `tests/unit/validation/componentIdFormat.property.test.js`
- Source: `src/domUI/damage-simulator/MultiHitSimulator.js`

## Status

Completed.

## Outcome

Added property-based tests for hit-count completion, progress monotonicity, round-robin coverage, and delay-derived duration bounds without changing production code; no scope changes required.
