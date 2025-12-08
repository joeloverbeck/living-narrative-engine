# Coverage and debugging for negligible damage tier

## Summary
Existing negligible severity plumbing and narrative coverage are already present (e.g., `classifyDamageSeverity` in use, negligible assertions in `tests/unit/anatomy/services/*.negligible.test.js` and `tests/e2e/actions/damageNarrativeDispatch.e2e.test.js`). Remaining gaps: DAMAGE_DEBUG logs omit severity, and `damagePropagationFlow.e2e.test.js` lacks a negligible scenario that exercises propagation while keeping existing medium/high assertions untouched. Add minimal logging and coverage to close those gaps without altering thresholds or narrative wording.

## Updated scope / findings
- Unit coverage for negligible damage already lives in `tests/unit/anatomy/services/` (damageAccumulator, damagePropagationService, damageTypeEffectsService); no new unit files needed beyond a targeted check for DAMAGE_DEBUG severity emission.
- Integration suite `tests/integration/anatomy/damagePropagation.negligible.integration.test.js` does not exist; propagation behavior is already covered by unit/e2e suites, so add coverage via existing e2e flow instead of a new integration harness.
- `tests/e2e/actions/damageNarrativeDispatch.e2e.test.js` already contains a negligible scenario; keep it stable.
- Add a negligible-propagation case to `tests/e2e/actions/damagePropagationFlow.e2e.test.js` that asserts severity tagging on parent and propagated hits.
- DAMAGE_DEBUG logging currently lives inside `src/logic/services/damageResolutionService.js`; extend those messages with a `severity` field (no other structural changes). `applyDamageHandler` and `damagePropagationService` do not emit DAMAGE_DEBUG today and remain untouched.

## File list to touch
- src/logic/services/damageResolutionService.js (append severity to DAMAGE_DEBUG logs)
- tests/unit/logic/services/damageResolutionService.test.js (or nearby) for targeted severity logging assertion
- tests/e2e/actions/damagePropagationFlow.e2e.test.js (add negligible scenario without altering existing ones)

## Out of scope
- Functional changes to damage math, thresholds, or narrative wording (covered by other tickets)
- Altering mod data payloads or adding new macros
- Refactoring the logging framework beyond adding severity fields to existing debug payloads

## Acceptance criteria
- Tests to run:
  - `npm run test:unit -- tests/unit/logic/services/damageResolutionService.test.js --runInBand`
  - `npm run test:e2e -- tests/e2e/actions/damagePropagationFlow.e2e.test.js --runInBand`
  - `npm run test:e2e -- tests/e2e/actions/damageNarrativeDispatch.e2e.test.js --runInBand` (regression)
- Invariants that must remain true:
  - Existing e2e assertions for medium/high damage continue to pass without snapshot or wording changes.
  - DAMAGE_DEBUG logs keep their current structure and are only extended with a `severity` field, not renamed keys.
  - Tests remain deterministic (no reliance on random damage values beyond controlled fixtures).

## Status
Completed

## Outcome
- Appended severity details to existing DAMAGE_DEBUG lines inside `src/logic/services/damageResolutionService.js`, including propagation results that inspect child health when available.
- Added a unit assertion in `tests/unit/logic/services/damageResolutionService.test.js` that verifies DAMAGE_DEBUG logs now carry severity.
- Added a negligible propagation scenario to `tests/e2e/actions/damagePropagationFlow.e2e.test.js` that confirms severity tagging on both the originating part and the propagated child while keeping existing medium/high cases untouched.
