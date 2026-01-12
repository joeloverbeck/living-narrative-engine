# MONCARREGPOP-002: Add population summary metadata to simulation results

## Goal
Attach explicit population counts to Monte Carlo simulation results so report/UI can distinguish full samples from stored contexts and their in-regime subsets.

## Expected file list
- `src/monteCarlo/MonteCarloSimulator.js`
- `src/monteCarlo/types.js` (or the file defining `SimulationResult`)
- `tests/unit/monteCarlo/monteCarloSimulator.populationSummary.test.js`

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
