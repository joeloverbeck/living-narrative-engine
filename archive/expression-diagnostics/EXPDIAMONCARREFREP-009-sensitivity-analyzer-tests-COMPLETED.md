# EXPDIAMONCARREFREP-009: SensitivityAnalyzer Unit Test Coverage

## Summary
Ensure `SensitivityAnalyzer` unit tests cover its current public API and control-flow branches. The service already exists and has baseline tests; this ticket focuses on filling gaps around early-return guards, error handling, and compound blocker traversal.

## Status
Completed

## Current State / Assumptions (Reassessed)
- `SensitivityAnalyzer` exposes `computeSensitivityData()` and `computeGlobalSensitivityData()` only.
- There is no public `flattenLeaves()` or `calculateWilsonInterval()` on this service.
- `computeSensitivityData()` accepts `(storedContexts, blockers)` and does **not** accept prerequisites.
- `computeGlobalSensitivityData()` accepts `(storedContexts, blockers, prerequisites)` and expects `prerequisites[0].logic`.
- The test file `tests/unit/expressionDiagnostics/services/sensitivityAnalyzer.test.js` already exists.

## Files to Update

| File | Action | Description |
|------|--------|-------------|
| `tests/unit/expressionDiagnostics/services/sensitivityAnalyzer.test.js` | Update | Add missing unit tests for SensitivityAnalyzer |

## Out of Scope

- **DO NOT** modify production code
- **DO NOT** create integration tests (that's EXPDIAMONCARREFREP-013)
- **DO NOT** modify controller tests
- **DO NOT** add new public APIs to SensitivityAnalyzer

## Acceptance Criteria

### Tests That Must Be Added

#### computeSensitivityData()
1. Returns empty array when `blockers` are missing or empty (with stored contexts present).
2. Traverses nested compound blockers (multi-level) and calls `computeThresholdSensitivity` for leaf nodes.
3. Logs a warning and continues when `computeThresholdSensitivity` throws.

#### computeGlobalSensitivityData()
1. Returns empty array when `prerequisites` are missing or empty.
2. Returns empty array when `prerequisites[0].logic` is missing.
3. Logs a warning and continues when `computeExpressionSensitivity` throws.

### Invariants That Must Remain True
1. Tests follow Jest `describe/it` conventions.
2. Tests use mock dependencies (not real MonteCarloSimulator).
3. Tests are independent and can run in isolation.
4. No production code modifications.

## Verification Commands
```bash
npm run test:unit -- --testPathPattern="sensitivityAnalyzer"
```

## Dependencies
- **Depends on**: EXPDIAMONCARREFREP-008 (SensitivityAnalyzer exists)
- **Blocks**: EXPDIAMONCARREFREP-010 (report orchestrator uses sensitivity analyzer)

## Outcome
- Updated existing unit tests to cover early-return guards, nested blocker traversal, and warning paths for error handling.
- Left production code untouched; aligned expectations with the current SensitivityAnalyzer API.
