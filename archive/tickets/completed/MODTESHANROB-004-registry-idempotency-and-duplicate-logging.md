# MODTESHANROB-004 Registry idempotency and duplicate registration logging
## Status
- Completed
## Goal
Tame duplicate handler overwrite noise in the mod test harness by consolidating registration into a single, deterministic pass: the harness should emit at most one targeted warning that lists the colliding operation ids and clarifies that the last registration wins, while keeping the OperationRegistry isolated per fixture (already true) and deterministic across runs.

## Reality check / current state
- `createBaseRuleEnvironment` already instantiates a fresh `OperationRegistry` per fixture, so isolation is in place.
- Duplicate overwrites stem from registering factory-supplied `IF` / `FOR_EACH` stubs and then replacing them once the `OperationInterpreter` is available, which produces multiple generic `OperationRegistry` warnings per fixture init.
- Ordering is currently deterministic, but the harness does not explicitly dedupe before registration or emit a single aggregated warning.

## File list to touch
- tests/common/engine/systemLogicTestEnv.js (dedupe/registration logging for the harness)
- tests/unit/common/mods/ModTestHandlerFactory.completeness.test.js (assert consolidated warning and deterministic winner mapping)
- (Optional) tests/common/mods/ModTestFixture.js only if fixture wiring needs adjustment; otherwise leave untouched.

## Out of scope
- Altering production registry behavior in src/logic/** beyond what the test harness needs for determinism.
- Adding global logging frameworks or changing log destinations.
- Modifying mod content files under data/mods/**.

## Acceptance criteria
- The harness registers each operation type once per fixture initialization; when replacements occur (e.g., `IF` / `FOR_EACH`), only a single warning is emitted that lists the colliding operations and notes the chosen winner (last declaration).
- OperationRegistry remains per-fixture; handler selection stays deterministic regardless of test order or resets.
- Unit run `npm run test:unit -- tests/unit/common/mods/ModTestHandlerFactory.completeness.test.js` covers the duplicate warning behavior and passes.

## Outcome
- Deduped handler registration inside `createBaseRuleEnvironment` so only the final `IF`/`FOR_EACH` flow handlers are registered, emitting one consolidated warning that names the overridden operations and winner source while keeping per-fixture registry isolation intact.
- Added a unit assertion in `ModTestHandlerFactory.completeness.test.js` to lock the consolidated warning and ensure the flow handlers use the finalized implementations.
