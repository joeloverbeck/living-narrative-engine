# HUMINTHELOOLLM-003: UI Callout and Preselection for LLM Suggestions

**Summary:** Render an explicit “LLM suggestion” callout in the action selection UI by consuming the existing `llm:suggested_action` bus event, preselect the suggested action with a safe fallback, and preserve keyboard/controller navigation.
**Status:** Completed

## Reality check (updated assumptions)
- Action buttons currently render from `core:update_available_actions`, dispatched by the `core:player_turn_prompt` rule; that payload does **not** include suggestion metadata.
- Suggestion metadata already exists on the bus as `llm:suggested_action` from `ActionDecisionWorkflow`, but no UI subscriber consumes it today.
- `actionIndexUtils` only asserts indices; clamping for suggestions happens in `ActionDecisionWorkflow`/`EventBusPromptAdapter`, not via a shared helper.
- LLM parsing lives in `src/turns/services/LLMResponseProcessor.js` and does not orchestrate UI ordering for speech/thoughts.

## File list
- src/domUI/actionButtonsRenderer.js (consume `llm:suggested_action`, preselect, render callout)
- css/components/_actions-widget.css (styling for the callout without disturbing existing buttons)
- tests/ (UI/unit specs for suggestion callout and clamping fallback)

## Out of scope
- Core pending gate logic or prompt dispatch (handled in HUMINTHELOOLLM-001/002).
- Telemetry/logging of overrides or suggestions.
- Timeout/fallback configuration and timers.
- Broader UI theming unrelated to the suggestion callout.

## Outcome
- ActionButtonsRenderer now listens for `llm:suggested_action` and, when the actor matches, renders a callout with the descriptor (or command text fallback) above the buttons.
- Suggested actions are preselected with a safe clamp that prefers wait/idle when out-of-range; selection clears on actor change or submission to avoid stale UI state.
- Added lightweight styling for the callout and unit coverage for suggestion callouts/clamping; existing integration coverage for ActionButtonsRenderer remains green.

## Acceptance criteria
- UI reacts to `llm:suggested_action` for the current actor: callout renders with the descriptor (fallback to command string) and does not alter non-LLM turns.
- Suggested action is preselected when actions arrive via `core:update_available_actions`; if the index is out-of-range, selection falls back to wait/idle when available, otherwise clamps safely without crashing.
- Keyboard/controller navigation and existing action button interactions remain unchanged (no new focus traps or disabled state regressions).
- Suggestion state clears when actions change to a different actor or after submission so stale callouts do not persist.
- Tests:
  - `npm run test:unit -- tests/unit/domUI/actionButtonsRenderer.llmSuggestion.test.js` (new) covers callout rendering, descriptor fallback, and clamped/idle preselection behavior.
  - `npm run test:integration -- tests/integration/domUI/actionButtonsRenderer.integration.test.js` (updated if needed) ensures existing navigation/selection flow remains intact with suggestions present.
