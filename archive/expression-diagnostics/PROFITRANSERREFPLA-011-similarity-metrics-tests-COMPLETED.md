# PROFITRANSERREFPLA-011: Tests for PrototypeSimilarityMetrics

**Status**: COMPLETED
**Priority**: MEDIUM
**Estimated Effort**: M (1-2 days)
**Dependencies**: PROFITRANSERREFPLA-008
**Blocks**: PROFITRANSERREFPLA-012

## Problem Statement

Before extracting `PrototypeSimilarityMetrics` from `PrototypeFitRankingService`, we need comprehensive tests for similarity and distance calculations. These metrics determine how close prototypes are to each other and to target signatures, which is critical for prototype gap detection.

## Objective

Create unit and integration tests for the future `PrototypeSimilarityMetrics` that validate:
1. Cosine similarity calculations
2. Euclidean weight distance
3. Combined distance (weight + gate)
4. Distance distribution caching
5. Percentile and z-score calculations
6. Distance context building

## Scope

### In Scope
- Unit tests for similarity metrics via `PrototypeFitRankingService` facade in `tests/unit/expressionDiagnostics/services/`
- Integration tests in `tests/integration/expression-diagnostics/`
- Test fixtures for similarity scenarios
- Cache behavior tests

### Out of Scope
- Implementing `PrototypeSimilarityMetrics` (ticket 012)
- Modifying `PrototypeFitRankingService`
- Other service extractions

## Acceptance Criteria

- [x] Unit test file created: `tests/unit/expressionDiagnostics/services/prototypeSimilarityMetrics.test.js`
- [x] Integration test file created: `tests/integration/expression-diagnostics/prototypeSimilarityMetrics.integration.test.js`
- [x] Tests cover `#computeCosineSimilarity(targetSignature, protoWeights)` calculation (via analyzeAllPrototypeFit)
- [x] Tests cover `#computeWeightDistance(desiredWeights, protoWeights)` Euclidean distance (via detectPrototypeGaps)
- [x] Tests cover `#computePrototypeCombinedDistance(protoA, protoB)` combination (via detectPrototypeGaps)
- [x] Tests cover `#getDistanceDistribution(cacheKey, prototypes)` caching (via detectPrototypeGaps)
- [x] Tests cover `#computeDistancePercentile(sortedDistances, value)` percentile - returns ratio 0-1
- [x] Tests cover `#computeDistanceZScore(mean, std, value)` z-score
- [x] Tests cover `#buildDistanceContext(distance, percentile, zScore)` - returns string
- [x] Edge case: Identical prototypes (distance 0)
- [x] Edge case: Orthogonal prototypes (cosine 0)
- [x] Edge case: Missing axes in comparison
- [x] Cache hit/miss scenarios
- [x] Tests are enabled (not skipped) per project pattern

## Outcome

### Test Coverage Created

**Unit Tests (21 tests)** - `tests/unit/expressionDiagnostics/services/prototypeSimilarityMetrics.test.js`:
- `computeWeightDistance`: 4 tests
  - Lower distance for prototypes closer to target signature
  - Normalized Euclidean distance (divides by axis count)
  - Handles missing axes (defaults to 0)
  - Larger distance for opposite-signed weights
- `computePrototypeCombinedDistance`: 2 tests
  - Combines weight and gate distances (0.7×weight + 0.3×gate)
  - Handles prototypes with no gates (gate distance = 0)
- `getDistanceDistribution caching`: 4 tests
  - Computes distribution with mean and std
  - Returns cached results on subsequent calls
  - Returns null for single prototype
  - Returns null for empty prototype list
- `computeDistancePercentile`: 2 tests
  - Returns ratio 0-1 (not percentage)
  - Returns lower percentile for closer prototypes
- `computeDistanceZScore`: 3 tests
  - Returns 0 for value at mean
  - Returns 0 when std is 0 (all distances equal)
  - Computes negative z-score for below-mean distance
- `buildDistanceContext`: 2 tests
  - Returns formatted string with distance, percentile, and z-score
  - Returns null when percentile is null
- Edge cases: 4 tests
  - Identical prototypes
  - Orthogonal weight vectors
  - Empty weight objects
  - Many axes

**Integration Tests (13 tests)** - `tests/integration/expression-diagnostics/prototypeSimilarityMetrics.integration.test.js`:
- With real emotion prototypes: 3 tests
  - Finds positive-valence prototypes for positive-valence targets
  - Finds negative-valence prototypes for negative-valence targets
  - Ranks prototypes by distance to target correctly
- Distance distribution caching: 2 tests
  - Maintains consistent cache across multiple calls
  - Computes valid distribution with multiple prototypes
- Prototype gap analysis preparation: 3 tests
  - Provides distance context for gap detection
  - Detects gap when no prototype is close enough
  - Returns k-nearest neighbors with complete distance breakdown
- Distance metrics consistency: 2 tests
  - Combined distance equals 0.7×weight + 0.3×gate
  - Nearest distance matches first k-nearest neighbor
- Edge cases with real data: 3 tests
  - Handles target with very high positive values
  - Handles target equidistant from multiple prototypes
  - Provides numeric z-scores for all distances

### Key Learnings

1. **Target signature computation**: `detectPrototypeGaps` uses `#buildTargetSignature` which computes `direction * importance` from axis constraints, not raw constraint values
2. **Direction inference**: `#inferDirection` returns 1 if midpoint > 0.1, -1 if < -0.1, 0 otherwise
3. **Tightness computation**: `#computeTightness` returns `1 - range/2`
4. **Test behavioral properties**: Rather than asserting specific prototype ordering, tests should verify behavioral properties (e.g., "positive-valence prototypes should be closer for positive-valence targets")

## Implementation Notes

### Method Signatures (Actual Implementation)

| Method | Location | Signature | Return Type |
|--------|----------|-----------|-------------|
| `#computeCosineSimilarity` | Lines 1042-1061 | `(targetSignature: Map, protoWeights: object)` | `number` (-1 to 1) |
| `#computeWeightDistance` | Lines 1082-1094 | `(desiredWeights: object, protoWeights: object)` | `number` (≥0) |
| `#computePrototypeCombinedDistance` | Lines 1102-1111 | `(protoA: Prototype, protoB: Prototype)` | `number` (0.7×weight + 0.3×gate) |
| `#getDistanceDistribution` | Lines 1119-1152 | `(cacheKey: string, prototypes: Prototype[])` | `{mean, std, sortedDistances}` or `null` |
| `#buildDistanceStatsCacheKey` | Lines 1159-1163 | `(typesToFetch: object)` | `string` |
| `#computeDistancePercentile` | Lines 1171-1186 | `(sortedDistances: number[], value: number)` | `number` (ratio 0-1, NOT percentage) |
| `#computeDistanceZScore` | Lines 1195-1201 | `(mean: number, std: number, value: number)` | `number` |
| `#buildDistanceContext` | Lines 1210-1223 | `(distance: number, percentile: number, zScore: number)` | `string` or `null` |

### Key Implementation Details

1. **`targetSignature` is a Map**: Each entry has `{direction: number, importance: number}`
2. **`#computeDistancePercentile` returns ratio 0-1**: NOT percentage 0-100
3. **`#buildDistanceContext` returns string**: Format is `"Distance X.XX is farther than Y% of prototype nearest-neighbor distances (z=Z.ZZ)."`
4. **No `clearCache()` method exists**: Cache is internal (`#distanceDistributionCache`) with no public clear mechanism
5. **Weight distance is normalized**: Divides by number of axes (`Math.sqrt(sumSquares / allAxes.size)`)

## Verification

```bash
npm run test:unit -- --testPathPatterns="prototypeSimilarityMetrics" --verbose
npm run test:integration -- --testPathPatterns="prototypeSimilarityMetrics" --verbose
```

## Success Metrics

- All mathematical formulas thoroughly tested
- Cache behavior validated
- Edge cases documented
- Interface contract clear

## Notes

- Cosine similarity ranges from -1 to 1
- Euclidean distance is always non-negative
- Cache persists for the service lifetime
- Z-score assumes normal distribution

## Related Files

**Test Files Created:**
- `tests/unit/expressionDiagnostics/services/prototypeSimilarityMetrics.test.js`
- `tests/integration/expression-diagnostics/prototypeSimilarityMetrics.integration.test.js`

**Source Methods (to be extracted):**
- `PrototypeFitRankingService.js:1042-1061` - `#computeCosineSimilarity`
- `PrototypeFitRankingService.js:1082-1094` - `#computeWeightDistance`
- `PrototypeFitRankingService.js:1102-1111` - `#computePrototypeCombinedDistance`
- `PrototypeFitRankingService.js:1119-1152` - `#getDistanceDistribution`
- `PrototypeFitRankingService.js:1159-1163` - `#buildDistanceStatsCacheKey`
- `PrototypeFitRankingService.js:1171-1186` - `#computeDistancePercentile`
- `PrototypeFitRankingService.js:1195-1201` - `#computeDistanceZScore`
- `PrototypeFitRankingService.js:1210-1223` - `#buildDistanceContext`
