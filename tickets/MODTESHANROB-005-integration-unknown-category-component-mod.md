# MODTESHANROB-005 Integration test for unknown-category mod with component mutations
## Goal
Add an integration test that loads a mod with an uncatalogued category whose rules/actions invoke component mutation and perception logging (e.g., ADD_COMPONENT) and verifies the handler auto-detection provides coverage without triggering MissingHandlerError.
## File list it expects to touch
- tests/integration/mods/ (new test file, e.g., tests/integration/mods/unknown-category-component.test.js)
- tests/common/mods/examples/ or a small fixture mod dataset referenced by the new test
- tests/common/mods/ModTestHandlerFactory.js (only if minor plumbing is required for the new fixture)
## Out of scope
- Changing existing mod content under data/mods/**; use test-local fixtures instead.
- Altering production interpreter behavior beyond what the test harness requires to load the fixture.
- Introducing new schema requirements or manifest fields for mods.
## Acceptance criteria
- Tests: the new integration test passes under `npm run test:integration -- tests/integration/mods/unknown-category-component.test.js` (or equivalent path) and no MissingHandlerError is thrown when the fixture runs.
- Invariants: ModTestFixture API remains stable; registry state isolation per test is preserved; handler selection stays deterministic for the same fixture data.
