# MODTESTROB-010-03: Migrate `scoot_closer_action` Integration Suite to Seating Helpers

## Summary
Refactor `tests/integration/mods/positioning/scoot_closer_action.test.js` to leverage seating scenario helpers and domain matchers that clarify occupant movement expectations.

## Dependencies
- MODTESTROB-010-01 baseline established.

## Tasks
1. Inspect current setup blocks to catalog manual entity/furniture creation and kneeling/sitting components.
2. Replace the manual `ModEntityBuilder` graph with an appropriate `ModTestFixture` helper (e.g., `createSittingPair` or `createKneelingBeforeSitting`) that yields furniture and seated actors:
   - Preserve the number of seats and occupant identities from the original suite.
   - Use helper-provided IDs when executing the scoot action via `fixture.executeAction`.
3. Update assertions to consume helper outputs (e.g., `scenario.seatedActors`) instead of hand-built arrays.
4. Switch to domain matchers for action success/failure and seating state validation.
5. Remove obsolete helper imports and align remaining imports per repository formatting conventions.
6. Confirm auxiliary edge-case tests (if present) still assert intended occupancy behavior.

## Acceptance Criteria
- Manual builder usage is fully replaced by fixture helper scenarios.
- Assertions depend on domain matchers and helper-provided entity references.
- Suite passes using `npm run test:integration -- tests/integration/mods/positioning/scoot_closer_action.test.js`.

## Validation
- Include updated test output in ticket notes.
- Document any adjustments required to helper APIs back to MODTESTROB-010-06 if gaps are discovered.
