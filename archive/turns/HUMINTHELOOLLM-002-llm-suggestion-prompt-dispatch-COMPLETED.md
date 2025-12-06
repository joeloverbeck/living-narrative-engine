# HUMINTHELOOLLM-002: LLM Suggestion Prompt Dispatch

**Summary:** Preselect LLM action suggestions in the `PLAYER_TURN_PROMPT_ID` payload while keeping the existing `llm:suggested_action` emission and gating flow intact.
**Status:** Completed

## Reality check / updated scope

- `llm:suggested_action` is already emitted and clamped inside `ActionDecisionWorkflow` (not `PromptCoordinator`).
- The prompt dispatch path currently drops the suggested index/descriptor because `PromptCoordinator` → `EventBusPromptAdapter` only forwards `availableActions`, and the `player_turn_prompt` schema rejects extra fields.
- Goal: propagate the clamped suggestion into the prompt payload (optional) so UI can preselect, without changing the decision provider contracts or duplicating dispatches.

## File list

- src/turns/states/workflows/actionDecisionWorkflow.js (forward clamped suggestion to prompt dispatch)
- src/turns/prompting/promptCoordinator.js
- src/turns/adapters/eventBusPromptAdapter.js
- data/mods/core/events/player_turn_prompt.event.json
- tests/ (unit coverage for prompt dispatch payload + schema, adjust LLM gating tests)

## Out of scope

- UI rendering or styling of the suggestion callout.
- Pending gating logic beyond dispatching events (covered in HUMINTHELOOLLM-001).
- Timeout/fallback behavior.
- Telemetry/logging for suggestions or overrides.

## Acceptance criteria

- Tests:
  - `npm run test:unit -- tests/unit/turns/prompting/promptCoordinator.test.js` verifies prompt dispatch can include optional `suggestedAction` metadata.
  - `npm run test:unit -- tests/unit/turns/adapters/eventBusPromptAdapter.test.js` verifies the adapter forwards `suggestedAction`, clamps indexes safely, and avoids duplicate dispatch work.
  - `npm run test:unit -- tests/unit/turns/states/workflows/actionDecisionWorkflow.test.js` (and related integration fixture) confirms the clamped LLM suggestion is sent both via `llm:suggested_action` and through the prompt payload.
  - Update schema tests to allow the new optional field on `PLAYER_TURN_PROMPT_ID` without loosening other constraints.
- Invariants:
  - Existing human prompt dispatch and event names remain unchanged.
- No duplicate prompt dispatch for a single LLM decision.
- Missing/invalid suggested indexes do not throw; prompt still renders with safe defaults and clamped values.
- Event payload includes only intended fields (no speech/thoughts/notes in prompt payload to avoid PII leakage).

## Outcome

- Propagated the clamped LLM suggestion index/descriptor from `ActionDecisionWorkflow` into the prompt dispatch payload as optional `suggestedAction`, enabling UI preselection without changing existing event names.
- Kept `llm:suggested_action` emission intact and tightened schema/tests to allow the new prompt metadata while maintaining existing validation rules.
