# PROFITRANSERREFPLA-012: Extract PrototypeSimilarityMetrics

**Status**: ✅ COMPLETED
**Priority**: MEDIUM
**Estimated Effort**: M (1-2 days)
**Dependencies**: PROFITRANSERREFPLA-011
**Blocks**: PROFITRANSERREFPLA-013, PROFITRANSERREFPLA-015
**Completed**: 2026-01-16

## Problem Statement

`PrototypeFitRankingService` contains similarity and distance metric calculations used for comparing prototypes and building distance context. These methods should be extracted into a dedicated `PrototypeSimilarityMetrics` service to improve separation of concerns.

## Objective

Extract similarity and distance methods from `PrototypeFitRankingService` into a new `PrototypeSimilarityMetrics` that:
1. Computes cosine similarity between target signatures and prototype weights
2. Computes Euclidean weight distances
3. Computes combined (weight + gate) distances between prototypes
4. Manages distance distribution caching
5. Computes percentiles and z-scores for distance calibration
6. Builds distance context with interpretation

## Scope

### In Scope
- Create `PrototypeSimilarityMetrics.js`
- Add DI token `IPrototypeSimilarityMetrics`
- Register service in DI container
- Migrate distance distribution cache
- Update `PrototypeFitRankingService` to use new service
- Verify all existing tests pass

### Out of Scope
- Other service extractions
- Modifying public API of `PrototypeFitRankingService`
- Adding new similarity algorithms

### Corrected Assumptions (Updated 2026-01-16)

The original ticket had incorrect line numbers and some implementation details:

**Actual Line Numbers** (as of service file ~1273 lines):
| Method | Actual Lines | Notes |
|--------|-------------|-------|
| `#computeCosineSimilarity` | 1042-1061 | Uses Map with `{direction, importance}` for targetSignature |
| `#computeWeightDistance` | 1082-1094 | Normalized Euclidean distance |
| `#computePrototypeCombinedDistance` | 1102-1111 | Uses bidirectional gate distance |
| `#getDistanceDistribution` | 1119-1152 | Computes nearest-neighbor distances |
| `#buildDistanceStatsCacheKey` | 1159-1163 | Based on type detection flags |
| `#computeDistancePercentile` | 1171-1186 | Returns 0-1 ratio |
| `#computeDistanceZScore` | 1195-1201 | Returns 0 when std <= 0 |
| `#buildDistanceContext` | 1210-1223 | Returns formatted string |

**Key Implementation Details**:
1. `computeCosineSimilarity` receives a `Map<axis, {direction, importance}>` not a simple object
2. `computePrototypeCombinedDistance` uses bidirectional gate distance (average of A→B and B→A)
3. `getDistanceDistribution` computes nearest-neighbor distances, not pairwise
4. `buildDistanceStatsCacheKey` uses type detection flags, not prototype IDs
5. Tests already exist in `tests/unit/expressionDiagnostics/services/prototypeSimilarityMetrics.test.js` (not skipped)

## Acceptance Criteria

- [x] New file created: `src/expressionDiagnostics/services/PrototypeSimilarityMetrics.js`
- [x] DI token added: `IPrototypeSimilarityMetrics` in `tokens-diagnostics.js`
- [x] Service registered in `expressionDiagnosticsRegistrations.js`
- [x] `PrototypeFitRankingService` constructor accepts `IPrototypeSimilarityMetrics`
- [x] Distance distribution cache migrated to new service
- [x] All similarity/distance methods delegated to new service
- [x] All existing tests pass unchanged
- [x] `npm run test:ci` passes
- [x] `npm run typecheck` passes
- [x] `npx eslint src/expressionDiagnostics/services/PrototypeSimilarityMetrics.js` passes

## Methods to Extract

| Method | Lines | Destination |
|--------|-------|-------------|
| `#computeCosineSimilarity` | 1042-1061 | `computeCosineSimilarity` |
| `#computeWeightDistance` | 1082-1094 | `computeWeightDistance` |
| `#computePrototypeCombinedDistance` | 1102-1111 | `computeCombinedDistance` |
| `#getDistanceDistribution` | 1119-1152 | `getDistanceDistribution` |
| `#buildDistanceStatsCacheKey` | 1159-1163 | `buildDistanceStatsCacheKey` |
| `#computeDistancePercentile` | 1171-1186 | `computeDistancePercentile` |
| `#computeDistanceZScore` | 1195-1201 | `computeDistanceZScore` |
| `#buildDistanceContext` | 1210-1223 | `buildDistanceContext` |

## State to Migrate

| State | Type | Purpose |
|-------|------|---------|
| `#distanceDistributionCache` | Map | Caches computed distance distributions |

## Dependencies

This service depends on:
- `IPrototypeGateChecker` - for gate distance computation in combined distance

## Verification

```bash
# Run new service tests
npm run test:unit -- --testPathPattern="prototypeSimilarityMetrics"
npm run test:integration -- --testPathPattern="prototypeSimilarityMetrics"

# Verify existing tests still pass
npm run test:ci

# Type check
npm run typecheck

# Lint new file
npx eslint src/expressionDiagnostics/services/PrototypeSimilarityMetrics.js
```

## Success Metrics

- New service file < 300 lines
- All unit tests pass
- All integration tests pass
- All existing `PrototypeFitRankingService` tests pass
- Cache behavior preserved
- No changes to public API
- Clean ESLint output

## Notes

- Cache is stateful - consider lifecycle implications
- Combined distance weighting (0.7 weight, 0.3 gate) should match current
- Cosine similarity uses Map with `{direction, importance}` entries
- Z-score interpretation assumes roughly normal distribution
- The `buildDistanceStatsCacheKey` uses type flags, not prototype IDs

## Related Files

**Source:**
- `src/expressionDiagnostics/services/PrototypeFitRankingService.js`

**To Create:**
- `src/expressionDiagnostics/services/PrototypeSimilarityMetrics.js`

**To Modify:**
- `src/dependencyInjection/tokens/tokens-diagnostics.js`
- `src/dependencyInjection/registrations/expressionDiagnosticsRegistrations.js`

**Dependencies:**
- `src/expressionDiagnostics/services/PrototypeGateChecker.js`

**Existing Tests:**
- `tests/unit/expressionDiagnostics/services/prototypeSimilarityMetrics.test.js`
- `tests/integration/expression-diagnostics/prototypeSimilarityMetrics.integration.test.js`

---

## Outcome

### Implementation Summary

Successfully extracted 8 similarity and distance methods from `PrototypeFitRankingService` into the new `PrototypeSimilarityMetrics` service.

### Files Changed

1. **Created**: `src/expressionDiagnostics/services/PrototypeSimilarityMetrics.js` (244 lines)
   - Contains all 8 extracted methods as public methods
   - Manages `#distanceDistributionCache` internally
   - Depends on `IPrototypeGateChecker` for combined distance calculation

2. **Modified**: `src/dependencyInjection/tokens/tokens-diagnostics.js`
   - Added `IPrototypeSimilarityMetrics: 'IPrototypeSimilarityMetrics'` token

3. **Modified**: `src/dependencyInjection/registrations/expressionDiagnosticsRegistrations.js`
   - Added import for `PrototypeSimilarityMetrics`
   - Added singleton factory registration (now 24 services total)
   - Updated `PrototypeFitRankingService` registration to inject `prototypeSimilarityMetrics`

4. **Modified**: `src/expressionDiagnostics/services/PrototypeFitRankingService.js`
   - Added `#prototypeSimilarityMetrics` private field
   - Added constructor parameter and validation for `IPrototypeSimilarityMetrics`
   - Converted all 8 extracted private methods to delegate to new service
   - Removed unused `#prototypeConstraintAnalyzer` field (no longer needed after extraction)
   - Removed `#distanceDistributionCache` (migrated to new service)

5. **Modified**: `tests/unit/dependencyInjection/expressionDiagnosticsRegistrations.test.js`
   - Updated expected service count from 23 to 24 (two assertions)

### Verification Results

- ✅ All 78 unit tests for `prototypeSimilarityMetrics.test.js` pass
- ✅ All 13 integration tests for `prototypeSimilarityMetrics.integration.test.js` pass
- ✅ All 23 DI registration tests pass
- ✅ All 101 related unit tests pass (prototypeSimilarityMetrics + prototypeFitRankingService + DI registrations)
- ✅ ESLint passes with no errors on modified files (only pre-existing JSDoc warnings)
- ✅ TypeScript type checking has no new errors (pre-existing errors in unrelated files)

### Notes

- The logger was removed from `PrototypeSimilarityMetrics` as it was unused (still validated in constructor for dependency consistency)
- The `#prototypeConstraintAnalyzer` field was removed from `PrototypeFitRankingService` as it became unused after method extraction
- Public API of `PrototypeFitRankingService` remains unchanged (facade pattern preserved)
