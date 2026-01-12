# MONCARPERANAREP-002: Filter emotion calculation to referenced emotions

## Goal
Avoid calculating all emotion prototypes during Monte Carlo simulation by calculating only the emotions referenced by the expression logic.

## Assumptions check (updated)
- `MonteCarloSimulator` already extracts referenced emotions once per simulation (used for witness filtering), so no new extraction logic is needed.
- `#buildContext` is already called once per sample; the change is limited to passing a filter into context building.
- `EmotionCalculatorService` and `EmotionCalculatorAdapter` do not currently expose a filtered calculation method.

## File list (expected to touch)
- src/emotions/emotionCalculatorService.js
- src/expressionDiagnostics/adapters/EmotionCalculatorAdapter.js
- src/expressionDiagnostics/services/MonteCarloSimulator.js
- tests/unit/expressionDiagnostics/adapters/emotionCalculatorAdapter.test.js
- tests/unit/expressionDiagnostics/services/monteCarloSimulator.test.js
- tests/unit/expressionDiagnostics/services/monteCarloSimulator.hierarchical.test.js

## Work items
- Add a filtered calculation method to `EmotionCalculatorService` that accepts a `Set` of emotion names and returns intensities only for those prototypes.
- Add a wrapper method in `EmotionCalculatorAdapter` that calls the filtered service method and returns a plain object.
- Update `MonteCarloSimulator` to pass the referenced emotion filter into context building so only those emotions are calculated.
- Ensure the behavior falls back to full calculation when the filter is empty or missing.
- Add unit coverage for filtered adapter calls and simulator usage of the filter.

## Out of scope
- Any changes to sexual state filtering or calculation.
- Any refactor of `#extractReferencedEmotions` beyond wiring the existing method into the new flow.
- Performance optimizations unrelated to emotion filtering.

## Acceptance criteria
### Tests that must pass
- `npm run test:unit -- --testPathPattern="emotionCalculator"`
- `npm run test:unit -- --testPathPattern="monteCarloSimulator"`
- `npm run test:integration -- --testPathPattern="expression-diagnostics"`

### Invariants that must remain true
- For expressions that reference all emotions (or when no filter is provided), results are identical to the current full-calculation behavior.
- For filtered expressions, only referenced emotions are present in the computed emotion map; unreferenced emotions are absent or unchanged from prior expectations.
- Expression evaluation outcomes remain statistically equivalent for the same inputs.

## Status
Completed

## Outcome
Implemented filtered emotion calculation paths in the service/adapter and passed referenced emotion filters into Monte Carlo context building, leveraging the existing referenced-emotion extraction already in place rather than adding new extraction logic; added focused unit coverage for the adapter and simulator filter usage.
