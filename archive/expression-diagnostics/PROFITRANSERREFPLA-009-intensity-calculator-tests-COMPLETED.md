# PROFITRANSERREFPLA-009: Tests for PrototypeIntensityCalculator

**Status**: Completed
**Priority**: MEDIUM
**Estimated Effort**: M (1-2 days)
**Dependencies**: PROFITRANSERREFPLA-006
**Blocks**: PROFITRANSERREFPLA-010

## Problem Statement

Before extracting `PrototypeIntensityCalculator` from `PrototypeFitRankingService`, we need comprehensive tests for the existing intensity and scoring behavior. Intensity is derived from normalized axes, gate filtering, and a weighted/clamped computation; scoring combines gate pass, intensity rates, conflict score, and exclusion compatibility into a composite fit measure.

## Objective

Create unit and integration tests (via `PrototypeFitRankingService` until extraction) that validate the current behavior:
1. Intensity computation using normalized axes, sum of absolute weights, and clamping to [0,1]
2. Intensity distribution across gate-passing contexts, including pAboveThreshold and min/max
3. Percentile calculations using the current floor-index approach for p50, p90, p95
4. Conflict analysis based on constraint midpoint direction vs. weight sign
5. Composite score computation using existing weight constants

## Scope

### In Scope
- Unit tests for intensity/scoring behavior via `PrototypeFitRankingService` in `tests/unit/expressionDiagnostics/services/`
- Integration tests in `tests/integration/expression-diagnostics/` using `PrototypeFitRankingService` + `InMemoryDataRegistry`
- Test fixtures for various weight configurations
- Percentile correctness tests aligned with current implementation

### Out of Scope
- Implementing `PrototypeIntensityCalculator` (ticket 010)
- Modifying `PrototypeFitRankingService`
- Other service extractions

## Acceptance Criteria

- [x] Unit test file created: `tests/unit/expressionDiagnostics/services/prototypeIntensityCalculator.test.js`
- [x] Integration test file created: `tests/integration/expression-diagnostics/prototypeIntensityCalculator.integration.test.js`
- [x] Tests cover `computeIntensity(weights, ctx)` via `analyzeAllPrototypeFit` (normalized axes, clamp to [0,1], sumAbsWeights)
- [x] Tests cover positive and negative weight handling (including negative outputs clamped to 0)
- [x] Tests cover `computeIntensityDistribution(proto, contexts, threshold)` output shape (p50/p90/p95/pAboveThreshold/min/max)
- [x] Tests cover `percentile(sortedArr, p)` for p50, p90, p95 using floor-index behavior
- [x] Tests cover `analyzeConflicts(weights, constraints)` using constraint midpoint sign and conflict magnitude
- [x] Tests cover `computeCompositeScore(params)` using current constants and conflictScore inversion
- [x] Edge case: Zero weights
- [x] Edge case: Empty contexts array
- [x] Edge case: All weights same sign
- [x] Edge case: Single context
- [x] All tests are enabled (no `describe.skip`/`it.skip`)

## Tasks

### 1. Create Unit Test File

Create tests in `tests/unit/expressionDiagnostics/services/prototypeIntensityCalculator.test.js` that exercise intensity distribution, percentile behavior, conflicts, and composite score via `PrototypeFitRankingService`. Keep tests enabled and aligned with the current calculations (normalized axes + clamp, gate filtering, floor-index percentile).

### 2. Create Integration Test File

Create tests in `tests/integration/expression-diagnostics/prototypeIntensityCalculator.integration.test.js` using `InMemoryDataRegistry` to validate intensity distribution, percentile behavior, conflict analysis, and composite scoring with realistic prototype data.

### 3. Document Interface Contract

```typescript
interface IPrototypeIntensityCalculator {
  /**
   * Compute intensity from normalized axes, using sumAbsWeights and clamping to [0,1].
   */
  computeIntensity(weights: object, ctx: object): number;

  /**
   * Compute intensity distribution across gate-passing contexts.
   */
  computeDistribution(proto: Prototype, contexts: object[], threshold: number): IntensityDistribution;

  /**
   * Compute percentile using floor(p * (n - 1)) for sorted arrays.
   */
  percentile(sortedArr: number[], p: number): number;

  /**
   * Analyze conflicts using constraint midpoint sign vs weight sign.
   */
  analyzeConflicts(weights: object, constraints: object): ConflictAnalysis;

  /**
   * Compute composite score from multiple factors
   */
  computeCompositeScore(params: CompositeScoreParams): number;
}

interface IntensityDistribution {
  p50: number;
  p90: number;
  p95: number;
  pAboveThreshold: number;
  min: number | null;
  max: number | null;
}

interface ConflictAnalysis {
  score: number;
  magnitude: number;
  axes: Array<{ axis: string, weight: number, direction: string }>;
}

interface CompositeScoreParams {
  gatePassRate: number;
  pIntensityAbove: number;
  conflictScore: number;
  exclusionCompatibility: number;
}
```

## Verification

```bash
npm run test:unit -- --testPathPatterns="prototypeIntensityCalculator" --coverage=false --verbose
npm run test:integration -- --testPathPatterns="prototypeIntensityCalculator" --coverage=false --verbose
```

## Success Metrics

- All calculation types thoroughly tested
- Statistical methods validated
- Edge cases documented
- Interface contract clear

## Notes

- Intensity calculator depends on `ContextAxisNormalizer` for context normalization (`mood`/`moodAxes`, sexual axes, affect traits).
- Percentile calculation uses a floor-index approach and returns 0 for empty arrays.
- Composite score weights are defined in `PrototypeFitRankingService.js` constants and should be preserved by tests.

## Outcome

- Updated ticket assumptions to match current intensity, percentile, conflict, and composite score behavior (no weight normalization, clamp to [0,1], floor-index percentile).
- Added unit + integration tests via `PrototypeFitRankingService` for intensity distribution, conflicts, percentiles, composite scoring, and edge cases; no production code changes were required.

## Related Files

**Source Methods (to be extracted):**
- `PrototypeFitRankingService.js:921-969` - `#computeIntensityDistribution`
- `PrototypeFitRankingService.js:974-997` - `#computeIntensity`
- `PrototypeFitRankingService.js:1000-1006` - `#percentile`
- `PrototypeFitRankingService.js:1012-1047` - `#analyzeConflicts`
- `PrototypeFitRankingService.js:1051-1058` - `#computeCompositeScore`

**Constants (to migrate):**
- `WEIGHT_INTENSITY`, `WEIGHT_GATE_PASS`, `WEIGHT_EXCLUSION`, `WEIGHT_CONFLICT`
