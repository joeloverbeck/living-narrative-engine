# MONCARREGPOP-002: Add population summary metadata to simulation results

## Status
Completed

## Goal
Attach explicit population counts to Monte Carlo simulation results so report/UI can distinguish full samples from stored contexts and their in-regime subsets.

## Expected file list
- `src/expressionDiagnostics/services/MonteCarloSimulator.js` (defines `SimulationResult`)
- `tests/unit/expressionDiagnostics/services/monteCarloSimulator.populationSummary.test.js`

## Assumptions (rechecked)
- The simulator lives under `src/expressionDiagnostics/services/`.
- `SimulationResult` is a typedef inside `src/expressionDiagnostics/services/MonteCarloSimulator.js` (no standalone `types.js`).
- `moodRegimeUtils` already exists under `src/expressionDiagnostics/utils/` and should be used consistently for regime checks.

## Work
- Extend `SimulationResult` with `populationSummary`:
  - `sampleCount`
  - `inRegimeSampleCount`
  - `inRegimeSampleRate`
  - `storedContextCount`
  - `storedContextLimit`
  - `storedInRegimeCount`
  - `storedInRegimeRate`
- Compute `storedInRegimeCount` once using the same regime predicate as the simulator (via `moodRegimeUtils`).
- Preserve existing fields and behavior; add the summary alongside current output.

## Out of scope
- Any report or UI rendering changes.
- Any changes to sampling distributions, random seeds, or regime definition.

## Acceptance criteria
### Tests
- `npm run test:unit -- --testPathPatterns=monteCarloSimulator.populationSummary.test.js --coverage=false`

### Invariants
- `inRegimeSampleCount` continues to be derived from full samples.
- `storedContextCount` remains capped by `sensitivitySampleLimit`.
- Adding `populationSummary` does not alter any existing counts or rates.

## Outcome
- Added `populationSummary` metadata to `MonteCarloSimulator` results, including stored-context in-regime counts derived from the same predicate.
- Added a unit test to lock in population counts when stored contexts are capped.
- No report/UI changes; scope stayed within simulator payloads.
