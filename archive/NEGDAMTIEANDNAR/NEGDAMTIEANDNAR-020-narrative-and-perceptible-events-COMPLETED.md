# Negligible severity in narrative and perceptible event text

Status: Completed

## Summary
Damage severity is already classified as `negligible` in `classifyDamageSeverity` and is passed through `DamageResolutionService` into `DamageAccumulator` entries and the `anatomy:damage_applied` payload, but `DamageNarrativeComposer` drops the severity when composing `descriptionText`. As a result, perceptible events read like standard hits even when severity is negligible. Add a negligible qualifier to composed primary/propagation text while keeping non-negligible wording byte-for-byte unchanged.

## Discrepancies noted
- Severity tagging already exists in `DamageResolutionService`/`DamageAccumulator`; no handler changes are needed just to forward severity.
- Existing negligible coverage lives in `tests/unit/anatomy/services/damageAccumulator.negligible.test.js`, `damagePropagationService.negligible.test.js`, and `damageTypeEffectsService.negligible.test.js`; there is no narrative/perceptible text coverage.
- Perceptible event rendering comes from `DamageNarrativeComposer` output (consumed by `DamageEventMessageRenderer`); `game.html` templating is not involved.

## File list it expects to touch
- src/anatomy/services/damageNarrativeComposer.js
- tests/unit/anatomy/services/damageNarrativeComposer.negligible.test.js (new)
- tests/e2e/actions/damageNarrativeDispatch.e2e.test.js (add negligible/standard assertions)

## Out of scope
- Health summary lines or body-level condition descriptors (handled separately)
- Changing damage propagation math or thresholds
- Altering macro schemas or adding new perceptible event types

## Acceptance criteria
- Tests that must pass:
  - `npm run test:unit -- tests/unit/anatomy/services/damageNarrativeComposer.negligible.test.js --runInBand` (negligible qualifier added; standard wording unchanged)
  - `npm run test:e2e -- tests/e2e/actions/damageNarrativeDispatch.e2e.test.js --runInBand` (add negligible narrative assertion alongside existing dispatch coverage)
- Invariants that must remain true:
- Existing perceptible event text for non-negligible severities is unchanged byte-for-byte.
- No new hardcoded strings inside macros; severity comes from handler classification only.
- Event payload shape remains backward compatible for consumers that ignore severity.

## Outcome
- DamageNarrativeComposer now uses severity to label negligible hits in both primary and propagation text while keeping standard phrasing unchanged.
- Added unit coverage for negligible and mixed-severity formatting plus e2e coverage that exercises negligible damage narratives alongside existing dispatch assertions.
