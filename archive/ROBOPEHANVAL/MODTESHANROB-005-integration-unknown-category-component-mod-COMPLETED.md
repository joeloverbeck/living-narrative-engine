# MODTESHANROB-005 Integration test for unknown-category mod with component mutations

## Status

Completed.

## Reality check

- `ModTestHandlerFactory.getHandlerFactoryForCategory` already falls back to the superset/perception-logging profile when a category has no discovered operations; unit coverage (`ModTestHandlerFactory.completeness.test.js`) asserts unknown categories receive ADD_COMPONENT + ADD_PERCEPTION_LOG_ENTRY handlers.
- Preflight validation in `systemLogicTestEnv` surfaces missing handlers before execution, so the crash scenario is not currently reproducible with production mod data.
- Gap was a missing integration regression that uses a test-local mod (outside `data/mods/**`) to prove the superset path works end-to-end for uncatalogued categories with component mutation and perception logging.

## Updated goal

Add a small integration test that loads a fixture mod with an unknown category whose rule executes ADD_COMPONENT and ADD_PERCEPTION_LOG_ENTRY, confirming the superset fallback runs without MissingHandlerError and the operations execute.

## Updated scope / files

- tests/integration/mods/ (new test file)
- tests/common/mods/examples/ or an inline fixture used by the new test
- tests/common/mods/ModTestHandlerFactory.js (only if handler plumbing gaps appear during the new fixture)

## Out of scope

- Changing existing mod content under data/mods/\*\*; use test-local fixtures instead.
- Altering production interpreter behavior beyond what the test harness requires to load the fixture.
- Introducing new schema requirements or manifest fields for mods.

## Acceptance criteria

- Tests: the new integration test passes under `npm run test:integration -- tests/integration/mods/unknown-category-component.test.js` (or equivalent path) and no MissingHandlerError is thrown when the fixture runs.
- Invariants: ModTestFixture API remains stable; registry state isolation per test is preserved; handler selection stays deterministic for the same fixture data.

## Outcome

- Added `tests/integration/mods/unknown-category/unknown-category-component.test.js`, which supplies a test-local rule with ADD_COMPONENT and ADD_PERCEPTION_LOG_ENTRY and verifies the superset handlers execute without MissingHandlerError while mutating state and logging perception.
- No changes were required to `ModTestHandlerFactory`; existing superset fallback covered the fixture.
- Tests: `npm run test:integration -- --runInBand tests/integration/mods/unknown-category/unknown-category-component.test.js`.
