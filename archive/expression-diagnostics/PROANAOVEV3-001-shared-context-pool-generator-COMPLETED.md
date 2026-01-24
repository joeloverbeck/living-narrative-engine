# PROANAOVEV3-001: SharedContextPoolGenerator Service

## Summary

Status: Completed.

Create a new service that generates a single shared context pool for evaluating all prototypes consistently, replacing the per-pair Monte Carlo sampling approach. The pool will be built from full Monte Carlo contexts (via `ContextBuilder`) so downstream gate checks see the same structure as the current behavioral pipeline.

## Motivation

The current system evaluates O(pairs × samplesPerPair) = O(4095 × 20000) = ~82M evaluations. By generating a shared pool once and evaluating all prototypes against it, we reduce to O(prototypes × poolSize) = O(91 × 50000) = ~4.5M evaluations - an 18× improvement.

## Files to Create

### Service
- `src/expressionDiagnostics/services/prototypeOverlap/SharedContextPoolGenerator.js`

### Unit Tests
- `tests/unit/expressionDiagnostics/services/prototypeOverlap/sharedContextPoolGenerator.test.js`

## Implementation Details

### Interface

```javascript
class SharedContextPoolGenerator {
  /**
   * @param {object} deps
   * @param {object} deps.randomStateGenerator - IRandomStateGenerator with generate()
   * @param {object} deps.contextBuilder - IContextBuilder with buildContext()
   * @param {object} deps.logger - Logger instance
   * @param {number} [deps.poolSize] - Total contexts in pool (default: 50000)
   * @param {boolean} [deps.stratified] - Whether to stratify by mood regime proxy
   * @param {number} [deps.stratumCount] - Number of strata if stratified
   * @param {'uniform'|'mood-regime'|'extremes-enhanced'} [deps.stratificationStrategy]
   * @param {number|null} [deps.randomSeed] - Seed for reproducibility
   */
  constructor(deps)

  /**
   * Generate the shared context pool.
   * @returns {Array<object>} Array of context objects
   */
  generate()

  /**
   * Get contexts for a specific stratum (if stratified).
   * @param {string} stratumId
   * @returns {Array<object>}
   */
  getStratum(stratumId)

  /**
   * Get pool metadata for reproducibility.
   * @returns {{poolSize: number, seed: number|null, timestamp: number, stratified: boolean}}
   */
  getMetadata()
}
```

### Dependencies
- Use existing `RandomStateGenerator` for individual contexts
- Build full contexts with `ContextBuilder` so gates see normal context shape
- Standard DI pattern with `validateDependency`

### Updated Assumptions (Code Audit)
- `RandomStateGenerator` is currently unseeded (uses `Math.random`). Deterministic pools will be implemented by temporarily seeding `Math.random` within the generator call rather than changing public APIs.
- There is no shared "mood regime" stratification utility for global pools; stratification will use valence-axis bands as a proxy for regimes.

### Stratification Strategies
1. `uniform` - Uniform sampling across all axes (valence bands used only for grouping when stratified)
2. `mood-regime` - Gaussian sampling across axes, with valence bands used as a proxy for regimes
3. `extremes-enhanced` - Extra sampling in the lowest/highest valence bands (axis boundary proxy)

## Out of Scope

- Integrating with `PrototypeOverlapAnalyzer` (ticket 013)
- Configuration additions (ticket 008)
- DI registration (ticket 009)

## Acceptance Criteria

- [x] Service generates context pool of specified size
- [x] Pool is deterministically reproducible with same seed (via seeded `Math.random` override during generation)
- [x] Stratified sampling distributes contexts across valence-band "regime" strata
- [x] Pool metadata tracks generation parameters
- [x] Unit tests cover:
  - Pool generation with default options
  - Stratified sampling (each strategy)
  - Deterministic seeding
  - Pool metadata accuracy
  - Edge cases (pool size 0, invalid options)
- [ ] 80%+ branch coverage on new code (not measured; unit tests run without coverage)
- [ ] `npm run typecheck` passes (fails due to pre-existing type errors outside this scope)
- [x] `npx eslint src/expressionDiagnostics/services/prototypeOverlap/SharedContextPoolGenerator.js` passes

## Dependencies

None - this is a foundational service.

## Estimated Complexity

Medium - new service with stratification logic and reproducibility requirements.

## Outcome

- Added a SharedContextPoolGenerator service that builds full contexts via ContextBuilder and supports deterministic seeding by locally seeding `Math.random` during generation.
- Implemented valence-band stratification with uniform, mood-regime (Gaussian), and extremes-enhanced (edge-weighted) strategies as a proxy for mood regimes.
- Added unit tests covering generation defaults, stratification, deterministic seeding, metadata, and edge cases.
- `npm run typecheck` currently fails due to existing repo-wide errors; coverage threshold was not measured for this change.
