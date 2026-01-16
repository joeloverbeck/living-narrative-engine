# PROFITRANSERREFPLA-005: Tests for Context Axis Normalization

**Status**: Completed
**Priority**: HIGH
**Estimated Effort**: S (0.5-1 day)
**Dependencies**: None
**Blocks**: PROFITRANSERREFPLA-006

## Problem Statement

Axis normalization and regime filtering currently live inside `PrototypeFitRankingService` as private helpers (`#normalizeAxisConstraints`, `#filterToMoodRegime`, `#getNormalizedAxes`) backed by `axisNormalizationUtils`. There is no standalone `ContextAxisNormalizer` yet, so tests must capture the existing behavior before extraction to avoid regressions.

## Objective

Add unit tests that exercise the current normalization and filtering behavior through the public API, covering mood, sexual, and affect-trait axes along with constraints extraction from prerequisites.

## Updated Assumptions

- Axis constraints are `Map<string, {min: number, max: number}>` values (not plain objects).
- Constraints are extracted only when a `PrototypeConstraintAnalyzer` is provided.
- Context shapes include `mood` or `moodAxes`, `sexual` or `sexualAxes`, optional `sexualArousal`, and optional `affectTraits`.
- Normalization comes from `axisNormalizationUtils` and uses the existing raw-value scaling rules.
- Affect trait defaults come from `DEFAULT_AFFECT_TRAITS`.

## Scope

### In Scope
- Unit tests for normalization and filtering in `tests/unit/expressionDiagnostics/services/contextAxisNormalizer.test.js`.
- Coverage for Map-based constraints, mixed context shapes, sexual arousal normalization, and affect-trait defaults.
- Coverage for prerequisite-based constraint extraction (via `PrototypeConstraintAnalyzer`).

### Out of Scope
- Implementing `ContextAxisNormalizer` (ticket 006).
- Changing `PrototypeFitRankingService` behavior or public API.
- Integration tests (defer until the standalone service exists).

## Acceptance Criteria

- [x] Unit test file created: `tests/unit/expressionDiagnostics/services/contextAxisNormalizer.test.js`.
- [x] Tests cover filtering with normalized mood axes (including mixed `mood` vs `moodAxes`).
- [x] Tests cover sexual arousal normalization from `sexual` data.
- [x] Tests cover affect-trait defaults in filtering.
- [x] Tests cover constraint extraction from prerequisites via `PrototypeConstraintAnalyzer`.
- [x] Tests are active (not skipped) and pass under the unit test suite.

## Tasks

1. Add unit tests that exercise normalization/filtering via `PrototypeFitRankingService.computeImpliedPrototype`.
2. Use stubbed dependencies to isolate normalization behavior.
3. Run targeted Jest unit tests with `--testPathPatterns` and `--coverage=false`.

## Verification

```bash
npm run test:unit -- --testPathPatterns="contextAxisNormalizer" --coverage=false
```

## Notes

- Existing normalization tests already cover `axisNormalizationUtils`; focus here is filtering + constraints flow.
- Keep tests aligned with current shapes to preserve behavior before extraction.

## Related Files

- `src/expressionDiagnostics/services/PrototypeFitRankingService.js` (#normalizeAxisConstraints, #filterToMoodRegime, #getNormalizedAxes)
- `src/expressionDiagnostics/utils/axisNormalizationUtils.js`
- `tests/unit/expressionDiagnostics/services/prototypeFitRankingService.normalization.test.js`

## Outcome

- Updated scope to match the current PrototypeFitRankingService helpers and Map-based constraints instead of a missing ContextAxisNormalizer class.
- Added focused unit tests for mood/sexual/trait filtering and prerequisite constraint extraction via the public API.
- No production code changes were required.
