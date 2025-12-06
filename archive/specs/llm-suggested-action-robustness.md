# Context

- Modules: `src/turns/states/workflows/actionDecisionWorkflow.js`, `src/turns/factories/concreteTurnContextFactory.js`, DI registration in `src/dependencyInjection/registrations/turnLifecycleRegistrations.js`, event constants/definitions under `src/constants/eventIds.js` and `data/mods/core/events/suggested_action.event.json`.
- Responsibility: emit LLM action suggestions for human approval, dispatch validated events, and surface `PlayerPromptService` so the prompt UI can collect the human decision.
- Entry points: `ActionDecisionWorkflow.run()` when the decision provider is LLM; `ConcreteTurnContextFactory.create()` wiring the services bag used by the workflow; validated event dispatch via `SafeEventDispatcher/ValidatedEventDispatcher`.
- Affected UI: `src/domUI/actionButtonsRenderer.js` consumes the suggested-action event to render callouts and preselect actions (existing behavior relies on canonical event IDs and schemas).

# Problem

- Failure: production emitted `llm:suggested_action` with no event definition, triggering `ValidatedEventDispatcher` warnings and skipping validation; additionally, `TurnContext` lacked `PlayerPromptService` in its services bag, causing runtime errors when awaiting human approval.
- Root causes:
  - Namespace drift: canonical IDs used the `llm:` prefix while event definitions live under `core:` namespacing conventions.
  - DI omission: `ConcreteTurnContextFactory` did not inject `promptCoordinator`, so contexts built in production could not supply `getPlayerPromptService()`.
- Tests covering regression: `tests/unit/constants/eventIds.test.js`, `tests/unit/schemas/suggestedActionEvent.schema.test.js`, `tests/unit/turns/states/workflows/actionDecisionWorkflow.test.js` (new PlayerPromptService failure path), `tests/unit/turns/factories/concreteTurnContextFactory.test.js`.

# Truth Sources

- Event schema contracts in `data/schemas/event.schema.json` and `common.schema.json`.
- Existing prompt flow contracts in `src/turns/prompting/promptCoordinator.js` and `IPromptCoordinator` interface.
- Domain rules from HUMINTHELOOLLM tickets in `archive/turns/*.md` and gating spec `archive/specs/human-in-the-loop-llm-gating.md`.
- UI consumption path in `src/domUI/actionButtonsRenderer.js` (expects canonical suggested-action event).

# Desired Behavior

## Normal cases

- When an LLM proposes an action, the workflow:
  - Clamps the suggested index to available actions.
  - Emits `core:suggested_action` with payload matching the schema, validated by VED.
  - Sets the pending flag and awaits human submission via `PlayerPromptService.prompt`, passing suggested action metadata and cancellation signal.
  - Builds the final action (LLM or overridden) and proceeds to processing with metadata recorded.
- `TurnContext` always has `promptCoordinator` wired in production so `getPlayerPromptService()` succeeds.

## Edge cases

- No available actions: emit event with clamped index null? (must define) and continue without prompt while logging.
- Suggested index out of range: clamp and log correction; still emit event with clamped index.
- Prompt service unavailable or throws: log error, skip prompt, proceed with LLM action while clearing pending flag.
- Timeout policies (`autoAccept`, `autoWait`, `noop`) continue to resolve cleanly without leaving pending flags set.

## Failure modes

- Missing services: throw with clear message (`TurnContext: PlayerPromptService not available...`) and log at error; workflow should catch, log, and continue with LLM action rather than crash.
- Missing event definitions: do not occur in production; if lookup fails in dev/test, log once and continue dispatching.
- Schema validation failures: surface logger warnings and reject dispatch if payload does not match `core:suggested_action`.

## Invariants

- Event IDs are namespaced under `core:` and match filenames in `data/mods/core/events/`.
- `TurnContext` services bag includes `promptCoordinator`, `safeEventDispatcher`, `turnEndPort`, and `entityManager`.
- Pending flag is set before awaiting submission and always cleared in finally blocks.
- Telemetry logs only once per decision and include both suggested and submitted indices when present.

## API Contracts

- Stable: `ActionDecisionWorkflow` public behavior (emit suggested event, await prompt, clamp indices), `TurnContext.getPlayerPromptService()` signature, `core:suggested_action` payload shape.
- Allowed to change: internal logging verbosity, timeout policies configuration surface (`getLLMTimeoutConfig`), telemetry field names as long as logged shape remains backward compatible for consumers.

# Testing Plan

## Tests to update/add

- Unit: keep `tests/unit/constants/eventIds.test.js` in sync when event IDs change; `tests/unit/schemas/suggestedActionEvent.schema.test.js` for schema evolution; `tests/unit/turns/states/workflows/actionDecisionWorkflow.test.js` covering service-missing paths, timeout policy, and clamping.
- Integration: add a DI bootstrap test ensuring `promptCoordinator` is present in the TurnContext services bag (turn lifecycle registration). Add a VED dispatch test that loads `core:suggested_action` and asserts no warnings.
- UI: extend `tests/unit/domUI/actionButtonsRenderer.llmSuggestion.test.js` to assert it reacts to `core:suggested_action`.

## Regression / property tests

- Property-style clamping test: for arbitrary action counts and indices, clamped index stays within [1, n] and pending flag cleanup occurs.
- Resilience test: simulate missing prompt service to assert workflow logs error and still transitions to processing.
- Schema round-trip: validate `core:suggested_action` payloads generated by the workflow against the JSON Schema (fuzz speech/thoughts/notes nullability).
