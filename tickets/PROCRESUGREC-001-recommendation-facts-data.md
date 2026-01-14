# PROCRESUGREC-001: Extend Recommendation Facts Data Dependencies

## Summary

Extend `RecommendationFactsBuilder` to include the additional deterministic data needed by the prototype creation recommendation (mood regime bounds, stored contexts, prototype definitions, fit ranking outputs, gap detection, and target signature).

## Priority: High | Effort: Medium

## Rationale

The recommendation logic depends on data currently unavailable to the facts builder. Centralizing these inputs ensures deterministic behavior and keeps `RecommendationEngine` free of duplicated analysis logic.

## Dependencies

- None (can be implemented independently of synthesis and recommendation emission)

## Files to Touch

| File | Change Type |
|------|-------------|
| `src/expressionDiagnostics/services/RecommendationFactsBuilder.js` | **Update** |
| `src/expressionDiagnostics/services/PrototypeFitRankingService.js` | **Read-only** (reference for data sourcing) |
| `src/expressionDiagnostics/services/MonteCarloReportGenerator.js` | **Read-only** (reference for wiring pattern) |
| `src/expressionDiagnostics/utils/extractMoodConstraints.js` | **Read-only** (use existing helpers) |
| `src/expressionDiagnostics/utils/filterContextsByConstraints.js` | **Read-only** (use existing helpers) |

## Out of Scope

- **DO NOT** change recommendation emission rules or ordering
- **DO NOT** modify prototype evaluation logic or existing fit ranking behavior
- **DO NOT** alter stored context persistence formats
- **DO NOT** add new report outputs to MonteCarloReportGenerator
- **DO NOT** update any UI rendering

## Implementation Details

- Add the following to `DiagnosticFacts` output:
  - `moodRegime.bounds`: normalized AND-only bounds (axis -> { min?, max? })
  - `moodRegime.sampleCount`: count of stored contexts in regime
  - `storedMoodRegimeContexts`: contexts filtered by regime bounds; strip axes outside allowed scope
  - `prototypeDefinitions`: include weights and gates for each prototype id used in evaluation
  - `prototypeFit`: use fit ranking outputs (leaderboard entries, combinedScore, distance, kNearest list) when available
  - `gapDetection`: nearest distance, percentile, kNearestNeighbors
  - `targetSignature`: implied signature used by fit ranking; derive using same logic as impliedPrototype in report generator if not supplied
- Ensure `RecommendationFactsBuilder` can either:
  - call `PrototypeFitRankingService` directly using the same wiring as `MonteCarloReportGenerator`, or
  - accept precomputed analysis from `simulationResult` without recomputation
- Use `extractMoodConstraints` + `filterContextsByConstraints` to build regime context lists.
- Keep all new fields deterministic and stable for identical inputs.

## Acceptance Criteria

### Tests That Must Pass

```bash
npm run test:unit -- tests/unit/expressionDiagnostics/services/recommendationFactsBuilder.test.js --coverage=false
```

### Invariants That Must Remain True

- Existing `RecommendationFactsBuilder` outputs remain unchanged for pre-existing fields.
- No mutation of `simulationResult` objects.
- Regime filtering uses the same bounds semantics as existing mood regime utilities.
- All added fields are serializable JSON and deterministic.

## Definition of Done

- [ ] `DiagnosticFacts` contains all required new fields.
- [ ] Regime context filtering uses existing helpers.
- [ ] Prototype definitions include weights and gates used in evaluation.
- [ ] Target signature sourcing matches implied prototype logic.
- [ ] Unit tests validate new fields and determinism.
