# MONCARPERANAREP-004: Minor Monte Carlo simulator optimizations

## Goal
Apply low-risk micro-optimizations that reduce overhead without altering outcomes.

## File list (expected to touch)
- src/expressionDiagnostics/adapters/EmotionCalculatorAdapter.js
- src/expressionDiagnostics/services/MonteCarloSimulator.js

## Work items
- Replace manual Map-to-object conversion with a native `Object.fromEntries` equivalent where safe.
- Replace the `setTimeout(0)` chunk-yield with `requestIdleCallback` when available, falling back to `setTimeout`.
- Evaluate whether deep clone in sensitivity analysis can use `structuredClone` when available (with fallback to current behavior).

## Out of scope
- Any behavioral changes to the simulator (no change in results or sampling).
- Refactors to emotion filtering or context-building logic.
- Changes to test fixtures or config defaults.

## Acceptance criteria
### Tests that must pass
- `npm run test:unit -- --testPathPattern="monteCarloSimulator"`
- `npm run test:integration -- --testPathPattern="expression-diagnostics"`

### Invariants that must remain true
- Simulator results are identical for the same inputs.
- The main simulation loop still yields periodically to keep the UI responsive.
- Adapter output structure is unchanged (plain object with emotion keys).
