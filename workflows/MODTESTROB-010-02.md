# MODTESTROB-010-02: Migrate `stand_up_action` Integration Suite to Fixture Helpers

## Summary
Refactor `tests/integration/mods/positioning/stand_up_action.test.js` to use `ModTestFixture` scenario helpers and domain matchers instead of manual `ModEntityBuilder` patterns.

## Dependencies
- MODTESTROB-010-01 baseline established.

## Tasks
1. Confirm the file imports both `ModEntityBuilder` and `ModAssertionHelpers` today using `rg` to understand current structure.
2. Replace bespoke entity construction with `fixture.createKneelingBeforeSitting` (or the most appropriate sitting helper) to set up actors and furniture:
   - Ensure kneeling removal and seating context match the original assertions.
   - Reuse generated entities via `fixture.reset(scenario.entities)`.
3. Update action execution to call `fixture.executeAction` using IDs provided by the helper scenario.
4. Swap assertions to use `tests/common/mods/domainMatchers.js` matchers (e.g., `toHaveActionSuccess`, seating state matchers) rather than custom helper functions.
5. Remove unused imports and ensure imports remain alphabetized.
6. Re-run the original assertions to confirm expectations are equivalent—add additional matcher coverage only if needed to preserve intent.

## Acceptance Criteria
- No references to `ModEntityBuilder` or `ModAssertionHelpers` remain in the suite.
- Scenario setup relies solely on the fixture helper output while preserving original test cases.
- Domain matchers cover action success and seating state outcomes.
- Tests pass via `npm run test:integration -- tests/integration/mods/positioning/stand_up_action.test.js`.

## Validation
- Provide before/after snippet comparison in ticket notes.
- Attach test command output demonstrating the suite passes post-migration.
