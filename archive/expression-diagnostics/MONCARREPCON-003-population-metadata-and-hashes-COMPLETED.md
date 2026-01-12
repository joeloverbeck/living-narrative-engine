# MONCARREPCON-003: Population metadata and hashes for stored-context sections

## Summary
Augment existing stored-context population labels with explicit population metadata (name/predicate/count/hash), add stable population hashes, and expose population metadata in non-report output.

## Current State (re-verified)
- The report already prints stored-context population labels and a population summary block.
- No population hashes or explicit population objects exist in report or simulation outputs.

## File list (expected to touch)
- src/expressionDiagnostics/services/MonteCarloReportGenerator.js
- src/expressionDiagnostics/services/MonteCarloSimulator.js
- src/expressionDiagnostics/utils/populationHashUtils.js (new)
- tests/unit/expressionDiagnostics/services/monteCarloReportGenerator.populationMeta.test.js (new)
- tests/unit/expressionDiagnostics/services/monteCarloReportGenerator.populationLabels.test.js (update expectations)

## Out of scope
- Any changes to Monte Carlo sampling or stored context selection logic.
- Any updates to full-sample sections that do not rely on stored contexts.
- Any changes to signal labeling or intensity computations.

## Assumptions (updated)
- Population labels already exist in the report, so this ticket extends them with name/predicate/count/hash rather than introducing labels from scratch.
- Stored-context analysis already depends on `storedContexts`; no full-sample IDs are available for hashing.

## Acceptance criteria
- Report generator builds Population objects for stored-global and stored-mood-regime contexts with name, predicate, sampleIds, count, and hash.
- Report sections that use stored contexts include a population header (name, predicate, count, hash).
- Non-report output includes `result.populationMeta.storedGlobal` and `result.populationMeta.storedMoodRegime`.
- Hashes are stable and derived from sampleIds + predicate string.

## Tests
- `npm run test:unit -- --testPathPatterns tests/unit/expressionDiagnostics/services/monteCarloReportGenerator.populationMeta.test.js --coverage=false`
- `npm run test:unit -- --testPathPatterns tests/unit/expressionDiagnostics/services/monteCarloSimulator.populationMeta.test.js --coverage=false`
- Update `tests/unit/expressionDiagnostics/services/monteCarloReportGenerator.populationLabels.test.js` expectations for the new headers.

## Invariants
- Population hashes are consistent across all sections labeled "mood-regime" for the same run.
- No attempt is made to hash or store full-sample IDs beyond stored contexts.

## Status
Completed.

## Outcome
- Extended stored-context labels with explicit population headers (name/predicate/count/hash) and added stable hash utilities.
- Added `populationMeta` to Monte Carlo simulation results for stored-global and stored-mood-regime populations.
- Updated and added unit tests to cover the new metadata and report headers.
