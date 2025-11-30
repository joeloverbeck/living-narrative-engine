# MODTESHANROB-003 Preflight validation for missing handlers
## Goal
Introduce a pre-execution validation step in the mod test harness that inspects the assembled OperationRegistry for each rule/action and fails fast with a clear error when referenced operations (including macro expansions) lack handlers, instead of crashing during interpreter execution.
## File list it expects to touch
- tests/common/mods/ModTestFixture.js (add preflight registry validation hook)
- tests/common/mods/ModTestHandlerFactory.js (surface missing-handler details for validation)
- src/logic/operationInterpreter.js or src/logic/systemLogicInterpreter.js (only if minimal changes are needed to expose operation lists for validation without altering public behavior)
- tests/unit/common/mods/ModTestHandlerFactory.completeness.test.js (add assertions for the preflight error shape)
- tests/integration/mods/distress/throw_self_to_ground.test.js or a new targeted integration test covering the failure path
## Out of scope
- Changing runtime behavior of production gameplay beyond improving validation messaging; no schema changes.
- Altering mod authoring data or manifests to satisfy tests.
- Adding new logging sinks or global config flags outside the test harness scope.
## Acceptance criteria
- Tests: unit coverage for the new validation runs under `npm run test:unit -- tests/unit/common/mods/ModTestHandlerFactory.completeness.test.js`; integration scenario that previously crashed now either executes successfully or fails with the new clear validation error when handlers are intentionally removed.
- Invariants: interpreter APIs remain stable; registry state stays isolated per fixture; validation does not introduce non-determinism or mutate mod data.
