# Health summary and body description support for negligible damage

## Summary
Update the health line used by body descriptions so negligible damage is surfaced as a soft cosmetic state. Health currently reports `Perfect health.` when parts have taken small amounts of damage but remain in the `healthy` state (and when only vital-organ injuries exist, which is intentional for visibility filtering). Thread negligible handling through the health line without altering state thresholds or exposing hidden organs.

## File list it expects to touch
- src/anatomy/bodyDescriptionComposer.js (health line assembly)
- src/anatomy/services/injuryAggregationService.js (expose negligible surface damage)
- src/anatomy/services/injuryNarrativeFormatterService.js (format cosmetic health copy)
- tests/integration/anatomy/bodyDescriptionComposer.healthLine.integration.test.js
- tests/unit/anatomy/bodyDescriptionComposer.healthLine.test.js

## Out of scope
- Damage classification thresholds or severity tagging changes (handled by NEGDAMTIEANDNAR-010)
- Perceptible event/narrative text outside health summaries
- Changing mod data or descriptor templates beyond what is necessary to surface the negligible state label

## Acceptance criteria
- Tests that must pass:
  - `npm run test:unit -- tests/unit/anatomy/bodyDescriptionComposer.healthLine.test.js --runInBand`
  - `npm run test:integration -- tests/integration/anatomy/bodyDescriptionComposer.healthLine.integration.test.js --runInBand`
- Invariants that must remain true:
  - When no visible damage exists, the summary remains exactly `Health: Perfect health.` (vital-organ-only injuries stay hidden per existing behavior).
  - Visible damage above negligible continues to render existing wording without regressions.
  - No new health state IDs are introduced; negligible should be surfaced as cosmetic copy using existing thresholds.

## Status
Completed

## Outcome
- Added cosmetic handling to injury aggregation and health-line formatting so small-but-nonzero visible damage returns `Health: Cosmetic scuffs.` instead of `Perfect health.`
- Left state thresholds and hidden vital-organ behavior unchanged; negligible detection uses existing damage severity thresholds against current vs. max health.
- Extended unit/integration health-line tests to cover the cosmetic path alongside the existing perfect and injured scenarios.
