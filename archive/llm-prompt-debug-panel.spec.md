# Specification: LLM Prompt Debug Panel

## Overview

Add a debug-only UI control to `game.html` that lets developers view the fully composed LLM prompt for the **current acting actor** without triggering any LLM calls. The control sits above the existing "Game Menu" widget, exposes a button labeled `prompt to llm`, and opens a scrollable modal that renders the exact prompt string that would be sent to the LLM for the active turn (thoughts/speech/action/notes prompt), even when the actor is currently using a human player type.

## Goals

- Surface the assembled LLM prompt in-browser with zero network/LLM spend.
- Works for any acting actor (LLM or human player_type) as long as a turn context exists.
- Reuse existing prompt-building pipeline to guarantee parity with live LLM calls.
- Provide a readable, copyable, scrollable modal with basic metadata (actor, LLM config id, action count).

## Non-Goals

- Do not change turn logic, action selection, or LLM invocation.
- Do not add new LLM calls, retries, or caching layers.
- No persistent storage or logging of prompts.

## UX & IA

- **Placement:** New widget above the current `Game Menu` panel in `game.html` right-pane.
  - Container id: `llm-prompt-debug-widget`.
  - Contents: label "LLM Prompt Debug" (visually a widget header) + button with text `prompt to llm`.
- **Modal:** New modal overlay (similar structure to save/load/LLM selection) with id `llm-prompt-debug-modal`.
  - Title: "LLM Prompt Preview".
  - Body: read-only, monospace, scrollable region showing the assembled prompt (use `<pre>` or `<textarea readonly>`). Max height to keep modal within viewport; enable horizontal scroll for long lines.
  - Metadata strip: actor name/id, active LLM config id, action count used to build the prompt, timestamp.
  - Controls: Close button (top-right) and Copy-to-clipboard button. Show status area for errors.
  - Loading state: spinner or text "Generating prompt…" while the preview is being built.

## Data Flow & Responsibilities

- **Trigger:** Clicking `#llm-prompt-debug-button` calls a new GameEngine method (async) to request a prompt preview.
- **Engine side:**
  - Add a method `previewLlmPromptForCurrentActor()` on `GameEngine`.
    - Locate active turn context via `TurnManager.getActiveTurnHandler()?.getTurnContext()` and `TurnManager.getCurrentActor()`. If missing, return a descriptive error payload.
    - Recompute the definitive `availableActions` for the acting actor using the existing `TurnActionChoicePipeline` (token `TurnActionChoicePipeline`) to ensure parity with decision flow. Do **not** mutate cached chosen actions or turn state.
    - Use `AIPromptPipeline.generatePrompt(actor, turnContext, availableActions)` to build the prompt string. Do **not** call `LLMChooser` or `llmAdapter.getAIDecision`.
    - Collect metadata: actor id, actor display name (via `EntityDisplayDataProvider` if available or fallback to id), `availableActions.length`, current LLM config id (`llmAdapter.getCurrentActiveLlmId()`), timestamp, any assembly errors.
    - Dispatch a new UI event via `SafeEventDispatcher`, e.g. `core:ui_show_llm_prompt_preview`, with `{ prompt, actorId, actorName, llmId, actionCount, errors?: string[] }`. Never fail silently—errors should be surfaced in payload with `prompt` null.
- **UI side:**
  - Extend `EngineUIManager` to subscribe to `core:ui_show_llm_prompt_preview` and route payloads to a new DOM component.
  - New renderer `PromptPreviewModal` (extending `BaseModalRenderer`) to manage the modal lifecycle, render prompt text, show loading/error states, and wire the copy button.
  - Add to `DomUiFacade` a getter for the new modal; register it in `uiRegistrations` using existing `DocumentContext`, `DomElementFactory`, and `ValidatedEventDispatcher`.
  - Button wiring: add `#llm-prompt-debug-button` to the bootstrap stage `setupMenuButtonListenersStage` (or a sibling stage) to call `gameEngine.previewLlmPromptForCurrentActor()`; handle promise rejections by sending an inline error event/payload to the modal.

## Error Handling & Edge Cases

- No active turn/handler/context → modal shows "No active turn is in progress" message.
- Available actions resolve to empty → still build prompt (pipeline should handle empty list); surface `actionCount: 0`.
- Prompt assembly errors → show partial prompt if returned; list errors in status area.
- Abort handling: preview must **not** interfere with the live prompt abort controller; do not reuse or cancel the live `promptAbortController`.
- Actor without `core:player_type` or with human type → still run pipeline and show prompt using current active LLM config; if no LLM config found, surface error state instead of throwing.

## Touchpoints / Files to Modify

- `game.html`: add debug widget and modal markup (consistent ARIA roles/labels, follows existing modal structure).
- `css/style.css`: styles for the new widget and modal (monospace, scrollable body, copy button).
- `src/bootstrapper/stages/uiStages.js`: register click listener for the new button, guarded when `gameEngine` is unavailable.
- `src/constants/eventIds.js`: add `core:ui_show_llm_prompt_preview`.
- `src/domUI/engineUIManager.js`: subscribe to the new event and delegate to the modal.
- `src/domUI/PromptPreviewModal.js` (new): modal controller; handle show/hide, loading, errors, copy action.
- `src/domUI/domUiFacade.js`: expose the new modal.
- `src/dependencyInjection/registrations/uiRegistrations.js`: register/bind the modal and pass into `DomUiFacade`.
- `src/engine/gameEngine.js`: implement `previewLlmPromptForCurrentActor`, resolve dependencies (`TurnActionChoicePipeline`, `IAIPromptPipeline`, `EntityDisplayDataProvider`/names resolver, `ILLMAdapter`), dispatch UI event.
- `src/dependencyInjection/registrations/aiRegistrations.js` (or a small helper) if a lightweight `PromptPreviewService` is introduced to encapsulate the pipeline call.

## Testing Plan

- **Unit:**
  - `GameEngine.previewLlmPromptForCurrentActor` builds prompt via `AIPromptPipeline` and never calls `llmAdapter.getAIDecision` or modifies turn state; returns structured errors when context/actor/llm id missing.
  - `PromptPreviewModal` renders prompt text, metadata, and handles copy button; shows error state when payload contains errors or null prompt.
  - `EngineUIManager` routes `core:ui_show_llm_prompt_preview` events to the modal.
- **Integration (jsdom):**
  - Clicking the new button triggers the preview call and opens the modal with returned prompt text (mocking the engine method).
  - Accessibility: modal has `role="dialog"` with correct `aria-labelledby` and focus trap on open/close (leveraging `BaseModalRenderer`).
- **Regression:** ensure existing save/load/LLM selection modals and menu buttons still operate; snapshot the new widget markup in `game.html` if applicable.

## Out of Scope

- No prompt editing or re-submission to the LLM.
- No persistence/telemetry of prompts.
- No additional controls (search/filter) inside the prompt modal for this iteration.
