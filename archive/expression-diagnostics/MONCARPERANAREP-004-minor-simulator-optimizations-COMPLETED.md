# MONCARPERANAREP-004: Minor Monte Carlo simulator optimizations

## Goal
Apply low-risk micro-optimizations that reduce overhead without altering outcomes.

## File list (expected to touch)
- src/expressionDiagnostics/adapters/EmotionCalculatorAdapter.js
- src/expressionDiagnostics/services/MonteCarloSimulator.js

## Work items
- Replace manual Map-to-object conversion with a native `Object.fromEntries` equivalent where safe.
- Replace the `setTimeout(0)` chunk-yield with `requestIdleCallback` when available, falling back to `setTimeout`.
- Use `structuredClone` for sensitivity-analysis deep clone when available, falling back to current behavior.

## Out of scope
- Any behavioral changes to the simulator (no change in results or sampling).
- Refactors to emotion filtering or context-building logic.
- Changes to config defaults or runtime wiring.

## Acceptance criteria
### Tests that must pass
- `npm run test:unit -- --testPathPatterns="monteCarloSimulator" --coverage=false`
- `npm run test:integration -- --testPathPatterns="expression-diagnostics" --coverage=false`

### Invariants that must remain true
- Simulator results are identical for the same inputs.
- The main simulation loop still yields periodically to keep the UI responsive.
- Adapter output structure is unchanged (plain object with emotion keys).

## Updated assumptions
- `MonteCarloSimulator` already builds context once per sample and passes it through evaluation helpers.
- `EmotionCalculatorAdapter` already supports filtered emotion calculation; no further filtering work is required here.

## Status
Completed.

## Outcome
- Implemented safe `Object.fromEntries` conversion for adapter map output.
- Replaced chunk-yielding `setTimeout` with `requestIdleCallback` fallback behavior.
- Used `structuredClone` when available for sensitivity-analysis logic cloning.
