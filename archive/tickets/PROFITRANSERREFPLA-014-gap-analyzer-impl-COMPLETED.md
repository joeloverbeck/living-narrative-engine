# PROFITRANSERREFPLA-014: Extract PrototypeGapAnalyzer

**Status**: COMPLETED
**Priority**: LOW
**Estimated Effort**: L (2-3 days)
**Dependencies**: PROFITRANSERREFPLA-013
**Blocks**: PROFITRANSERREFPLA-015

## Problem Statement

`PrototypeFitRankingService` contains gap detection and prototype synthesis logic that represents the most complex responsibility in the service. This logic should be extracted into a dedicated `PrototypeGapAnalyzer` service.

## Objective

Extract gap detection and synthesis methods from `PrototypeFitRankingService` into a new `PrototypeGapAnalyzer` that:
1. Builds target signatures from constraints and failures
2. Identifies k-nearest neighbor prototypes
3. Detects gaps in prototype coverage
4. Synthesizes new prototypes to fill gaps

## Scope

### In Scope
- Create `PrototypeGapAnalyzer.js`
- Add DI token `IPrototypeGapAnalyzer`
- Register service in DI container
- Migrate gap detection constants
- Update `PrototypeFitRankingService` to use new service
- Enable tests from PROFITRANSERREFPLA-013
- Verify all existing tests pass

### Out of Scope
- Other service extractions
- Modifying public API of `PrototypeFitRankingService`
- Changing synthesis algorithm

## Acceptance Criteria

- [x] New file created: `src/expressionDiagnostics/services/PrototypeGapAnalyzer.js`
- [x] DI token added: `IPrototypeGapAnalyzer` in `tokens-diagnostics.js`
- [x] Service registered in `expressionDiagnosticsRegistrations.js`
- [x] `PrototypeFitRankingService` constructor accepts `IPrototypeGapAnalyzer`
- [x] Gap detection constants migrated to new service
- [x] All gap analysis delegated to new service
- [x] Tests from PROFITRANSERREFPLA-013 pass (remove `.skip`)
- [x] All existing tests pass unchanged
- [x] `npm run test:ci` passes
- [x] `npm run typecheck` passes
- [x] `npx eslint src/expressionDiagnostics/services/PrototypeGapAnalyzer.js` passes

## Outcome

### Implemented Files

**Created:**
- `src/expressionDiagnostics/services/PrototypeGapAnalyzer.js` (254 lines)
  - Public methods: `buildTargetSignature`, `targetSignatureToWeights`, `detectGap`, `synthesizePrototype`, `getThresholds`, `getKNeighbors`
  - Private methods: `#inferDirection`, `#computeTightness`, `#getLastMileWeightForAxis`, `#generateSynthesizedId`, `#blendNeighborWeights`

**Modified:**
- `src/dependencyInjection/tokens/tokens-diagnostics.js` - Added `IPrototypeGapAnalyzer` token
- `src/dependencyInjection/registrations/expressionDiagnosticsRegistrations.js` - Registered service
- `src/expressionDiagnostics/services/PrototypeFitRankingService.js` - Added dependency injection

**Tests:**
- `tests/unit/expressionDiagnostics/services/prototypeGapAnalyzer.test.js`
- `tests/integration/expression-diagnostics/prototypeGapAnalyzer.integration.test.js`

### Deviation from Plan

The ticket was marked "Not Started" but was actually fully implemented as part of the refactoring pipeline. All acceptance criteria were met.

### Metrics
- Service lines: 254 (target was <300)
- All unit tests passing
- All integration tests passing
- Clean ESLint output

## Related Files

**Source:**
- `src/expressionDiagnostics/services/PrototypeFitRankingService.js`

**Created:**
- `src/expressionDiagnostics/services/PrototypeGapAnalyzer.js`

**Modified:**
- `src/dependencyInjection/tokens/tokens-diagnostics.js`
- `src/dependencyInjection/registrations/expressionDiagnosticsRegistrations.js`

**Dependencies:**
- `src/expressionDiagnostics/services/PrototypeSimilarityMetrics.js`
- `src/expressionDiagnostics/services/PrototypeGateChecker.js`

**Tests:**
- `tests/unit/expressionDiagnostics/services/prototypeGapAnalyzer.test.js`
- `tests/integration/expression-diagnostics/prototypeGapAnalyzer.integration.test.js`
