# MONCARSAMCOV-002 - Wire Sampling Coverage Into MonteCarloSimulator

## Goal
Integrate sampling coverage tracking into MonteCarloSimulator so simulation results include the `samplingCoverage` payload described in the spec, with config toggles and domain resolution.

## Status: Completed

## Scope
- Wire the existing `monteCarloSamplingCoverage` utility into `MonteCarloSimulator` (no new module needed).
- Add a `samplingCoverageConfig` entry alongside existing simulator config.
- Resolve domain ranges for the variables exposed in the simulator context:
  - `moodAxes.*` / `mood.*`: [-100, 100] (current + previous).
  - `emotions.*` / `sexualStates.*`: [0, 1] derived intensities (current + previous).
- Track coverage per variable path during sampling and finalize the payload on completion.
- Omit `samplingCoverage` when no in-scope numeric variables are referenced (affect traits and sexualArousal are excluded per spec).

## File list
- `src/expressionDiagnostics/services/MonteCarloSimulator.js`
- `src/expressionDiagnostics/services/monteCarloSamplingCoverage.js`
- `tests/unit/expressionDiagnostics/services/monteCarloSimulator.test.js`

## Out of scope
- Markdown report changes.
- UI rendering changes.
- Any changes to sampling distributions or random state generation.
  - The report/UI coverage rendering described in the spec will be handled in a separate ticket.

## Acceptance criteria
### Specific tests that must pass
- `npm run test:unit -- --testPathPatterns=tests/unit/expressionDiagnostics/services/monteCarloSimulator.test.js --coverage=false`

### Invariants that must remain true
- Existing MonteCarloSimulator results (trigger rate, blockers, clause data, sensitivity data) are unchanged when coverage is enabled.
- Coverage tracking can be toggled off via config and does not affect output when disabled.
- No new console logging in browser-facing code.

## Outcome
- Wired the existing sampling coverage calculator into MonteCarloSimulator with coverage config support and domain ranges for current/previous mood axes, emotions, and sexual states.
- Added simulator unit tests to cover coverage inclusion, config disabling, and omission when only out-of-scope variables are referenced.
