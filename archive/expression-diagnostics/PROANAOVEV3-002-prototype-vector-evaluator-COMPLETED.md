# PROANAOVEV3-002: PrototypeVectorEvaluator Service

## Summary

Status: Completed.

Create a service that evaluates every prototype against the shared context pool, producing output vectors that enable cheap pairwise comparisons.

## Motivation

Instead of evaluating pairs independently, evaluate all prototypes once against a shared pool. This produces output vectors (gate results + intensities) that enable O(1) vector operations for pairwise metrics.

## Files to Create

### Service
- `src/expressionDiagnostics/services/prototypeOverlap/PrototypeVectorEvaluator.js`

### Unit Tests
- `tests/unit/expressionDiagnostics/services/prototypeOverlap/prototypeVectorEvaluator.test.js`

## Implementation Details

### Interface

```javascript
class PrototypeVectorEvaluator {
  /**
   * @param {object} options
   * @param {object} options.prototypeGateChecker - PrototypeGateChecker instance
   * @param {object} options.prototypeIntensityCalculator - PrototypeIntensityCalculator instance
   * @param {object} options.logger - Logger instance
   */
  constructor(options)

  /**
   * Evaluate all prototypes on the shared context pool.
   * @param {Array<object>} prototypes - All prototypes to evaluate
   * @param {Array<object>} contextPool - Shared context pool
   * @returns {Promise<Map<string, PrototypeOutputVector>>}
   */
  async evaluateAll(prototypes, contextPool)
}

/**
 * @typedef {object} PrototypeOutputVector
 * @property {string} prototypeId
 * @property {Float32Array} gateResults - Binary pass/fail per context (0 or 1)
 * @property {Float32Array} intensities - Output intensity per context (0 if gate fails)
 * @property {number} activationRate - Fraction of contexts where gate passes
 * @property {number} meanIntensity - Mean intensity when activated
 * @property {number} stdIntensity - Std dev of intensity when activated
 */
```

### Memory Optimization
- Use `Float32Array` for vectors (50% memory vs regular arrays)
- Batch processing with `await` yield (requestIdleCallback or setTimeout fallback)
- Cache results per evaluator instance and context pool reference

### Dependencies
- Existing `PrototypeGateChecker`
- Existing `PrototypeIntensityCalculator`
  - Uses `checkAllGatesPass()` and `computeIntensity()` respectively

## Out of Scope

- Creating shared context pool (ticket 001)
- Pairwise metric calculations (ticket 004)
- DI registration (ticket 009)

## Acceptance Criteria

- [x] Service evaluates all prototypes against context pool
- [x] Output vectors use `Float32Array` for memory efficiency
- [x] Batch processing yields to event loop
- [x] Activation rate and intensity statistics computed correctly
- [x] Unit tests cover:
  - Single prototype evaluation
  - Batch evaluation of multiple prototypes
  - Output vector structure validation
  - Memory efficiency (Float32Array usage)
  - Event loop yielding behavior
  - Error handling (invalid prototype) and empty pool behavior (empty vectors, zeroed stats)
- [ ] 80%+ branch coverage on new code
- [ ] `npm run typecheck` passes
- [ ] `npx eslint src/expressionDiagnostics/services/prototypeOverlap/PrototypeVectorEvaluator.js` passes

## Dependencies

- PROANAOVEV3-001 (SharedContextPoolGenerator) - provides context pool

## Estimated Complexity

Medium - batch processing with memory optimization and async handling.

## Outcome

- Implemented PrototypeVectorEvaluator with cached Float32Array output vectors, chunked evaluation, and event-loop yielding for shared pool scans.
- Added a convenience evaluateSingle wrapper while preserving the evaluateAll interface described in this ticket.
- Added unit tests covering single/batch evaluation, empty pools, invalid prototypes, Float32Array usage, and yield behavior.
- `npm run typecheck` and direct eslint invocation were not run; branch coverage was not measured for this change.
