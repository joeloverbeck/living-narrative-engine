# LLMPRODEBPAN-002: GameEngine Logic

Status: Completed — engine-side only (UI work remains out of scope).
Reference: `specs/llm-prompt-debug-panel.spec.md`.

**Corrected scope & assumptions**
- GameEngine currently has no prompt preview helper and only resolves core services (logger, entity manager, turn manager, etc.). New dependencies for this ticket must be added in a minimally invasive way.
- Active turn data is available via `TurnManager.getActiveTurnHandler()?.getTurnContext()` and `TurnManager.getCurrentActor()`; when either is missing, treat the call as an error state (no active turn).
- `TurnActionChoicePipeline.buildChoices(actor, turnContext)` is the canonical way to recompute available actions without advancing turns or mutating any chosen-action cache.
- Prompt assembly should use `IAIPromptPipeline.generatePrompt(actor, turnContext, availableActions)`, which internally only calls `llmAdapter.getCurrentActiveLlmId`; **`llmAdapter.getAIDecision` must not be invoked** in this flow.
- Actor display names should come from `EntityDisplayDataProvider.getEntityName(actor.id, actor.id)` when available; otherwise fall back to the actor id.
- Metadata needed for the UI event: actor id/name, `llmAdapter.getCurrentActiveLlmId()` result, `availableActions.length`, and a timestamp captured at request time.
- Dispatch the result through `SafeEventDispatcher.dispatch`; the method itself should never throw — errors propagate via the payload.

**Files:**
- `src/engine/gameEngine.js`
- `tests/unit/engine/gameEngine.test.js` (extend existing suite)
- `src/constants/eventIds.js`

**Out of Scope:**
- UI implementation (modals, listeners) and any DOM wiring.
- Changing `AIPromptPipeline` or `TurnActionChoicePipeline` internals.

**Acceptance Criteria:**

1.  **Event ID:**
    * Add `UI_SHOW_LLM_PROMPT_PREVIEW` (value: `core:ui_show_llm_prompt_preview`) to `src/constants/eventIds.js`.

2.  **`GameEngine.previewLlmPromptForCurrentActor()` (async):**
    * Retrieves the current active turn context and actor from `TurnManager`; if missing, dispatches the preview event with `prompt: null` and error `"No active turn context"`.
    * Calls `TurnActionChoicePipeline.buildChoices` to get available actions without advancing or mutating turn state.
    * Calls `AIPromptPipeline.generatePrompt` with the actor, turn context, and available actions; **must not call `llmAdapter.getAIDecision`.**
    * Collects metadata (actor id/name, active LLM id, action count, timestamp) and dispatches `UI_SHOW_LLM_PROMPT_PREVIEW` via `SafeEventDispatcher` with payload `{ prompt: string | null, actorId, actorName, llmId, actionCount, timestamp, errors: string[] }`.
    * On any caught error, dispatches the event with `prompt: null` and the error message appended to `errors`.

3.  **Tests (unit):**
    * **No Turn:** Dispatches event with error "No active turn context".
    * **Success:** Mocks pipelines; asserts `generatePrompt` is called with correct args and event is dispatched with the returned string and metadata.
    * **Error Handling:** If a pipeline throws, catches error and dispatches event with `prompt: null` and error message.
    * **Invariant Check:** Verify `llmAdapter.getAIDecision` is never called.

## Outcome
- Added `core:ui_show_llm_prompt_preview` event id.
- Implemented `GameEngine.previewLlmPromptForCurrentActor` using `TurnActionChoicePipeline`, `IAIPromptPipeline`, `LLMAdapter`, and `EntityDisplayDataProvider`, emitting metadata (including timestamp) via `SafeEventDispatcher` without invoking `getAIDecision`.
- Expanded unit coverage in `tests/unit/engine/gameEngine.test.js` to cover no-turn, success, and error flows with dispatcher payload assertions.
