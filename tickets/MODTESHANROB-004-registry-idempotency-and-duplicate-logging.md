# MODTESHANROB-004 Registry idempotency and duplicate registration logging
## Goal
Ensure OperationRegistry initialization in the mod test harness is idempotent per fixture, emits at most one targeted warning when duplicate handlers collide (with a list of operation ids and chosen winner), and remains deterministic regardless of test order.
## File list it expects to touch
- tests/common/mods/ModTestHandlerFactory.js (registry build and duplicate-handling logic)
- tests/common/mods/ModTestFixture.js (reset/teardown adjustments if needed for idempotency)
- tests/unit/common/mods/ModTestHandlerFactory.completeness.test.js (add expectations around duplicate registration warnings and deterministic ordering)
- tests/common/mods/discoveryDiagnostics.js (reuse or extend logging utilities if applicable)
## Out of scope
- Altering production registry behavior in src/logic/** beyond what the test harness needs for determinism.
- Adding global logging frameworks or changing log destinations.
- Modifying mod content files under data/mods/**.
## Acceptance criteria
- Tests: unit assertions around duplicate registration warnings pass under `npm run test:unit -- tests/unit/common/mods/ModTestHandlerFactory.completeness.test.js`, and no nondeterministic ordering is observed across repeated runs.
- Invariants: registry state remains isolated per ModTestFixture instance; handler selection remains deterministic for identical inputs; no new warnings for non-colliding registrations.
