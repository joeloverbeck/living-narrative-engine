# PROCRESUGREC-001: Extend Recommendation Facts Data Dependencies

## Summary

Extend `RecommendationFactsBuilder` to include the additional deterministic data needed by the prototype creation recommendation (mood regime bounds, stored contexts, prototype definitions, fit ranking outputs, gap detection, and target signature).

## Priority: High | Effort: Medium

## Rationale

The recommendation logic depends on data currently unavailable to the facts builder. Centralizing these inputs ensures deterministic behavior and keeps `RecommendationEngine` free of duplicated analysis logic.

## Dependencies

- None (can be implemented independently of synthesis and recommendation emission)

## Assumption Corrections (Validated Against Codebase)

| Original Assumption | Reality | Correction |
|---------------------|---------|------------|
| Test file at `recommendationFactsBuilder.test.js` | Only `recommendationFactsBuilderGateClamp.test.js` exists (covers gate clamp only) | Create new `recommendationFactsBuilder.test.js` for new functionality |
| Separate files `extractMoodConstraints.js` and `filterContextsByConstraints.js` | Both are exported functions from `moodRegimeUtils.js` | Import from `moodRegimeUtils.js` |
| `RecommendationFactsBuilder` may have existing `PrototypeFitRankingService` wiring | NO integration exists; constructor only has `invariantValidator`, `prototypeConstraintAnalyzer`, `logger`, `gateClampConfig` | Add `prototypeFitRankingService` as constructor dependency |
| `moodRegime` already has `bounds` field | Current structure is `{ definition, sampleCount }` | Compute `bounds` from `definition` constraints |
| `PrototypeFitRankingService` is read-only | Need small addition: `getPrototypeDefinitions()` public method (~20 lines) to expose weights/gates | **Minor update** allowed (doesn't change evaluation logic) |

## Files to Touch

| File | Change Type |
|------|-------------|
| `src/expressionDiagnostics/services/RecommendationFactsBuilder.js` | **Update** |
| `src/expressionDiagnostics/services/PrototypeFitRankingService.js` | **Minor Update** (add `getPrototypeDefinitions()` public method) |
| `src/expressionDiagnostics/services/MonteCarloReportGenerator.js` | **Read-only** (reference for wiring pattern) |
| `src/expressionDiagnostics/utils/moodRegimeUtils.js` | **Read-only** (use existing `extractMoodConstraints` and `filterContextsByConstraints` helpers) |
| `tests/unit/expressionDiagnostics/services/recommendationFactsBuilder.test.js` | **Create** new test file |
| `tests/unit/expressionDiagnostics/services/prototypeFitRankingService.test.js` | **Update** (add tests for `getPrototypeDefinitions`) |

## Out of Scope

- **DO NOT** change recommendation emission rules or ordering
- **DO NOT** modify prototype evaluation logic or existing fit ranking behavior
- **DO NOT** alter stored context persistence formats
- **DO NOT** add new report outputs to MonteCarloReportGenerator
- **DO NOT** update any UI rendering

## Implementation Details

- Add the following to `DiagnosticFacts` output:
  - `moodRegime.bounds`: normalized AND-only bounds (axis -> { min?, max? }) - derived from `definition` constraints
  - `moodRegime.sampleCount`: count of stored contexts in regime (already exists)
  - `storedMoodRegimeContexts`: contexts filtered by regime bounds using `filterContextsByConstraints`
  - `prototypeDefinitions`: include weights and gates for each prototype id used in evaluation (via new `getPrototypeDefinitions()` method)
  - `prototypeFit`: use fit ranking outputs (leaderboard entries, combinedScore, distance, kNearest list) when available
  - `gapDetection`: nearest distance, percentile, kNearestNeighbors
  - `targetSignature`: implied signature used by fit ranking; serialize Map to plain object for JSON compatibility
- Add `prototypeFitRankingService` as optional constructor dependency (following `MonteCarloReportGenerator` pattern)
- Use `extractMoodConstraints` + `filterContextsByConstraints` from `moodRegimeUtils.js` to build regime context lists
- Keep all new fields deterministic and stable for identical inputs

## Acceptance Criteria

### Tests That Must Pass

```bash
npm run test:unit -- tests/unit/expressionDiagnostics/services/recommendationFactsBuilder.test.js --coverage=false
npm run test:unit -- tests/unit/expressionDiagnostics/services/recommendationFactsBuilderGateClamp.test.js --coverage=false
npm run test:unit -- tests/unit/expressionDiagnostics/services/prototypeFitRankingService.test.js --coverage=false
```

### Invariants That Must Remain True

- Existing `RecommendationFactsBuilder` outputs remain unchanged for pre-existing fields.
- No mutation of `simulationResult` objects.
- Regime filtering uses the same bounds semantics as existing mood regime utilities.
- All added fields are serializable JSON and deterministic.

## Definition of Done

- [x] `DiagnosticFacts` contains all required new fields.
- [x] Regime context filtering uses existing helpers from `moodRegimeUtils.js`.
- [x] Prototype definitions include weights and gates used in evaluation.
- [x] Target signature sourcing matches implied prototype logic.
- [x] Unit tests validate new fields and determinism.

## Outcome

**Status**: ✅ COMPLETED

### Implementation Summary

1. **PrototypeFitRankingService** - Added `getPrototypeDefinitions(prototypeRefs)` method (~30 lines) that exposes weights and gates for requested prototype references.

2. **RecommendationFactsBuilder** - Extended with:
   - New constructor dependency: `prototypeFitRankingService` (optional)
   - Import: `filterContextsByConstraints` from `moodRegimeUtils.js`
   - New helper methods:
     - `#computeBoundsFromConstraints(constraints)` - Converts constraint array to normalized axis bounds
     - `#buildStoredMoodRegimeContexts(simulationResult, moodConstraints)` - Filters stored contexts by mood constraints
     - `#extractPrototypeDefinitions(simulationResult)` - Gets weights/gates from PrototypeFitRankingService
     - `#performPrototypeFitAnalysis(expression, storedContexts)` - Orchestrates fit, gap, and signature computation
     - `#serializeTargetSignature(signature)` - Converts Map to plain object for JSON compatibility
   - Updated `build()` method output with all new fields

3. **New DiagnosticFacts Fields**:
   - `moodRegime.bounds`: Object mapping axis names to `{ min?, max? }` in normalized 0-1 scale
   - `storedMoodRegimeContexts`: Array of filtered contexts matching mood constraints
   - `prototypeDefinitions`: Object keyed by qualified ID (`emotions:joy`, `sexualStates:arousal`) with `weights` and `gates`
   - `prototypeFit`: Direct pass-through from `analyzeAllPrototypeFit()` result
   - `gapDetection`: Direct pass-through from `detectPrototypeGaps()` result
   - `targetSignature`: Serialized Map from `computeImpliedPrototype()` result

### Test Coverage

- Created `tests/unit/expressionDiagnostics/services/recommendationFactsBuilder.test.js` (18 tests)
  - `moodRegime.bounds computation` - 4 tests
  - `storedMoodRegimeContexts filtering` - 3 tests
  - `prototypeDefinitions extraction` - 2 tests
  - `prototypeFit integration` - 2 tests
  - `gapDetection integration` - 2 tests
  - `targetSignature derivation` - 2 tests
  - `determinism invariants` - 1 test
  - `backward compatibility` - 1 test
  - `error handling` - 1 test

- Updated `tests/unit/expressionDiagnostics/services/prototypeFitRankingService.test.js` (7 new tests)
  - Non-array input handling
  - Empty array handling
  - Emotion prototype extraction
  - Sexual prototype extraction
  - Multiple prototypes
  - Non-existent prototypes
  - Empty weights/gates handling

### Test Results

```
Tests: 76 passed, 76 total
- recommendationFactsBuilder.test.js: 18 passed
- recommendationFactsBuilderGateClamp.test.js: 3 passed
- prototypeFitRankingService.test.js: 55 passed
```

### Files Modified

| File | Lines Changed |
|------|---------------|
| `src/expressionDiagnostics/services/PrototypeFitRankingService.js` | +30 |
| `src/expressionDiagnostics/services/RecommendationFactsBuilder.js` | +150 |
| `tests/unit/expressionDiagnostics/services/recommendationFactsBuilder.test.js` | +420 (new) |
| `tests/unit/expressionDiagnostics/services/prototypeFitRankingService.test.js` | +60 |
