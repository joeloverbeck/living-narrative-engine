# Context
- `tests/common/mods/ModTestHandlerFactory.js` builds the operation handler set used by `ModTestFixture` in integration tests.
- `tests/common/mods/ModTestFixture.js` wires the handler factory into `OperationInterpreter` and `SystemLogicInterpreter` when executing mod rules.
- Production equivalents live under `src/logic/` (`operationInterpreter.js`, `actionSequence.js`, `operationHandlers/*`) and drive how rules run.
- Mod metadata that selects a category comes from `data/mods/*/mod-manifest.json`; action/rule payloads live under `data/mods/**`.

# Problem
- When a mod uses operations like `ADD_COMPONENT` but its category is not mapped to a handler set with component mutation support, `OperationInterpreter` raises `MissingHandlerError` at runtime.
- Example failure: `tests/integration/mods/distress/throw_self_to_ground.test.js` previously crashed with `Cannot execute operation 'ADD_COMPONENT': handler not found` because `distress` defaulted to the baseline handler set without component mutation registration.
- The current fix manually mapped `distress` to `createHandlersWithPerceptionLogging`, but each new category risks the same gap and noisy overwrite warnings from the registry.

# Truth sources
- Schema contracts: `schema://living-narrative-engine/action.schema.json`, `schema://living-narrative-engine/rule.schema.json`.
- Execution pipeline: `src/logic/operationInterpreter.js`, `src/logic/actionSequence.js`, `src/logic/systemLogicInterpreter.js`.
- Test harness: `tests/common/mods/ModTestHandlerFactory.js`, `tests/common/mods/ModTestFixture.js`.
- Category expectations and validation: `tests/integration/infrastructure/categoryPatternValidation.test.js`, `tests/unit/common/mods/ModTestHandlerFactory.completeness.test.js`.
- Repro case: `tests/integration/mods/distress/throw_self_to_ground.test.js` with rule `data/mods/distress/rules/throw_self_to_ground.rule.json`.

# Desired behavior
## Normal cases
- Handler selection automatically provides every operation used by the mod’s actions/rules (including component mutations, perception logging, inventory, closeness) regardless of category novelty.
- New categories gain correct handler coverage without manual switch edits; heuristics should infer needs from referenced operations and macros before interpreter wiring.
- Registry initialization should be idempotent per test run, with explicit logging only when an override is intentional.

## Edge cases
- Unknown or custom categories still receive handlers for all detected operations; if detection is inconclusive, fall back to a superset that includes component mutation and perception logging.
- Mods that mix uncommon operations (e.g., mouth engagement, locks, GOAP prep) get the union of required handlers rather than a single narrow set.
- Macro expansion is analyzed so indirectly invoked operations are included.

## Failure modes (what errors to raise/return)
- If an operation referenced in mod data lacks a registered handler after assembly, fail fast before rule execution with a clear error: missing operation id, mod id/category, suggested factory to extend.
- Duplicate registration should emit a single warning that lists the colliding operations and the chosen winner.
- When data references an unknown operation id, raise a validation-style error instead of a runtime interpreter crash.

## Invariants
- Before `SystemLogicInterpreter` processes a rule, `OperationRegistry` has handlers for every `type` and macro-expanded operation in that rule.
- Handler selection is deterministic for a given mod dataset and does not depend on test execution order.
- Test harness continues to isolate registry state per fixture to avoid cross-test leakage.
- Action discoverability tests rely on the same handler coverage as rule execution tests (no split configurations).

## API contracts
- Keep `ModTestFixture.forAction(category, actionId)` and `ModTestHandlerFactory.getHandlerFactoryForCategory(modCategory)` stable for callers.
- Preserve JSON shapes for actions, rules, and manifests; no new required fields for mod authors unless explicitly versioned.
- Allow optional factory hints (e.g., `testOverrides.handlerProfile`) without changing defaults for existing mods.

## What is allowed to change
- Internal heuristics that derive handler sets (operation scanning, macro expansion, manifest hints).
- Default handler composition strategy (e.g., move to union-of-needed-operations or profile registry) as long as public fixture API stays stable.
- Logging detail and error classes, provided error surfaces remain actionable and non-breaking for tests.

# Testing plan
## Which tests must be updated/added
- Extend `tests/unit/common/mods/ModTestHandlerFactory.completeness.test.js` to assert auto-detection covers new categories referencing component mutations and perception logging without manual mapping.
- Add an integration test that loads an unknown-category mod with `ADD_COMPONENT` and verifies no `MissingHandlerError` occurs (or that a targeted preflight error is thrown if deliberately misconfigured).
- Add a fixture test that inspects the assembled `OperationRegistry` for a sample mod and asserts required handlers exist before execution.

## Regression tests / property tests
- Property-style scan over `data/mods/**/{rules,actions}/*.json` to extract referenced operations/macros and assert handler coverage in the test harness profiles.
- Regression test ensuring macro-expanded operations (e.g., `core:logSuccessAndEndTurn`) are included in the handler set with no overwrites.
- Performance guard that building handler sets for all categories stays within current test thresholds while still performing coverage checks.
