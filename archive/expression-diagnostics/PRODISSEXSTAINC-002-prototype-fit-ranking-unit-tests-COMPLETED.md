# PRODISSEXSTAINC-002: Add PrototypeFitRankingService Unit Tests for Prerequisites Arrays

## Summary

Extend unit tests to cover prerequisites array handling for sexual state prototypes and mixed prototype rankings in PrototypeFitRankingService.

## Priority: High | Effort: Medium

## Rationale

The core bug was triggered by prerequisites arrays. The implementation now accepts arrays, so unit coverage must validate correct type detection and ranking results for emotion, sexual, and mixed inputs without further production changes.

## Files to Touch

| File | Change Type |
|------|-------------|
| `tests/unit/expressionDiagnostics/services/prototypeFitRankingService.test.js` | Modify |

## Assumptions Check (Reassessed)

- `PrototypeFitRankingService` already accepts prerequisites arrays for prototype type detection (per `specs/prototype-discovery-sexual-state-inclusion.md`).
- Existing unit tests already cover some sexual-state detection paths but miss mixed prerequisites array output assertions.
- Integration and UI/controller coverage remain out of scope for this ticket.

## Out of Scope

- Avoid production changes unless tests prove a regression against the spec.
- Do not add integration tests or fixtures.
- Do not update UI controller tests.

## Test Scenarios (Updated Scope)

- Detect emotion prototypes from prerequisites array.
- Detect sexual state prototypes from prerequisites array.
- Detect both types from mixed prerequisites array and verify mixed leaderboard output.
- Fallback to emotions when no prototypes referenced.
- `analyzeAllPrototypeFit` returns rankings containing both `type: 'emotion'` and `type: 'sexual'` for mixed prerequisites.
- `computeImpliedPrototype` includes sexual prototypes in `bySimilarity`, `byGatePass`, and `byCombined` results when prerequisites arrays reference sexual states.
- `detectPrototypeGaps` includes sexual prototypes in `kNearestNeighbors`.

## Acceptance Criteria

### Tests That Must Pass

```bash
npm run test:unit -- --testPathPattern=prototypeFitRankingService
```

### Invariants That Must Remain True

- Existing tests for expression object inputs still pass without modification to production code.
- Test fixtures remain deterministic and do not rely on live data from `data/mods/`.
- New assertions verify the `type` field in ranking outputs.

## Status

Completed

## Outcome

- Added unit coverage for mixed prerequisites arrays producing mixed-type leaderboards.
- Strengthened implied prototype assertions so sexual-type rankings appear across all ranking lists.
