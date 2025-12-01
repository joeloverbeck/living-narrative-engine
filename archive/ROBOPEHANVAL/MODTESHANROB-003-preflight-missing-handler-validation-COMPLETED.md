# MODTESHANROB-003 Preflight validation for missing handlers
## Status
Completed.
## Reality check
- The mod test harness already auto-detects operations per category via `ModTestHandlerFactory` (rules, actions, macros) and `tests/unit/common/mods/ModTestHandlerFactory.completeness.test.js` enforces handler coverage across `data/mods/**`.
- The original crash case (`distress` missing component handlers) is no longer reproducible with the current handler auto-detection and integration test coverage.
- Gap that remains: the assembled `OperationRegistry` is never validated against the expanded rule operations before execution. A missing handler still manifests as a runtime `MissingHandlerError` when a test customizes handlers (or when new ops slip past the factory), not as a preflight failure.
## Updated goal
Add a pre-execution validation step in the mod test harness (test-only) that inspects expanded rules for referenced operation types and fails fast with a clear error when the active `OperationRegistry` lacks handlers. Keep public interpreter APIs unchanged.
## Updated scope / files
- tests/common/engine/systemLogicTestEnv.js: add the preflight registry validation hook that scans expanded rules.
- tests/unit/common/mods/ModTestHandlerFactory.completeness.test.js: add coverage for the new preflight error shape (or a nearby unit that exercises the validation helper).
- Optional: minimal helper exposure from ModTestHandlerFactory only if needed for the preflight (prefer local helpers first).
## Out of scope
- Changing runtime behavior of production gameplay beyond improved validation messaging; no schema changes.
- Altering mod authoring data or manifests to satisfy tests.
- Adding new logging sinks or global config flags outside the test harness scope.
## Acceptance criteria
- Preflight validation runs during mod test environment setup and throws a clear error listing missing operation ids and the rules they came from.
- Unit coverage exists for the validation behavior (pass + failure path) and runs under `npm run test:unit`.
- Invariants: interpreter APIs remain stable; registry state stays isolated per fixture; validation does not introduce non-determinism or mutate mod data.
## Outcome
- Implemented the preflight handler coverage check inside `tests/common/engine/systemLogicTestEnv.js`, scanning expanded rules and surfacing missing operation types with rule ids before interpreter execution. No changes were required to `ModTestFixture` or the factory beyond existing auto-detection.
- Added unit coverage in `tests/unit/common/engine/systemLogicTestEnv.preflight.test.js` (failure and success paths). The existing completeness suite already enforces category coverage, so integration scopes stayed unchanged.
- Tests: `npm run test:unit -- --runInBand tests/unit/common/engine/systemLogicTestEnv.preflight.test.js tests/unit/common/mods/ModTestHandlerFactory.completeness.test.js`.
