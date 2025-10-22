# MODTESTROB-010-05: Migrate `dropItemRuleExecution` Suite to Drop Scenario Helpers

## Summary
Refactor `tests/integration/mods/items/dropItemRuleExecution.test.js` to adopt the drop-item scenario helpers and domain matchers for consistent inventory removal checks.

## Dependencies
- MODTESTROB-010-01 baseline established.

## Tasks
1. Audit the existing test cases to map manual inventory setup and action payloads.
2. Replace `ModEntityBuilder` usage with `fixture.createDropItemScenario`, configuring actor and item metadata to match original expectations.
3. Use helper-provided entities via `fixture.reset(scenario.entities)` before executing the drop action.
4. Update assertions to rely on domain matchers and helper data, ensuring inventory removal and event messaging remain intact.
5. Adjust any additional inventory configuration by using helper options like `additionalInventoryItems` instead of bespoke builders.
6. Remove unused imports and confirm the file’s formatting with Prettier after modifications.

## Acceptance Criteria
- Manual builders and custom assertion helpers are fully removed.
- Helper-based scenario covers all test cases without regression.
- Suite passes using `npm run test:integration -- tests/integration/mods/items/dropItemRuleExecution.test.js`.

## Validation
- Provide passing test output in ticket updates.
- Document any helper feedback for MODTESTROB-010-06 follow-up work.
