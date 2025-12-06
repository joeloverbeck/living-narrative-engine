# LLMPRODEBPAN-004: Wiring and Integration

**Files:**

- `src/domUI/engineUIManager.js`
- `src/domUI/domUiFacade.js`
- `src/dependencyInjection/registrations/uiRegistrations.js`
- `src/bootstrapper/stages/uiStages.js`
- `tests/integration/llmPromptDebug.spec.js` (New integration test)

**Out of Scope:**

- Changing engine logic or modal internals.

**Acceptance Criteria:**

1.  **Registration:**
    - Register `PromptPreviewModal` in `uiRegistrations.js` as a singleton/factory.
    - Inject it into `DomUiFacade`.
    - Expose it via a getter in `DomUiFacade`.

2.  **Event Handling (`EngineUIManager`):**
    - Subscribe to `core:ui_show_llm_prompt_preview`.
    - Handler calls `domUiFacade.getPromptPreviewModal().show(payload)`.

3.  **Button Wiring (`uiStages.js`):**
    - In `setupMenuButtonListenersStage` (or similar), select `#llm-prompt-debug-button`.
    - Add click listener:
      - Calls `gameEngine.previewLlmPromptForCurrentActor()`.
      - (Optional) specific "Loading..." UI on the button itself or cursor if desired, though spec implies the modal/engine handles the flow.
      - _Refinement from spec:_ "Handle promise rejections by sending an inline error event/payload to the modal." -> If the engine method is async and fails _before_ dispatching, the UI layer needs to catch that.

4.  **Integration Test:**
    - Mock the Engine's `previewLlmPromptForCurrentActor` to immediately dispatch the event with dummy data.
    - Simulate click on `#llm-prompt-debug-button`.
    - Assert:
      - Engine method was called.
      - Modal `#llm-prompt-debug-modal` becomes visible.
      - Modal content matches the dummy data.

---

## Outcome: Completed

The wiring and integration for the LLM Prompt Debug Panel have been successfully implemented as per the ticket's acceptance criteria.

**Changes made:**

- `src/domUI/index.js`: Exported `PromptPreviewModal`.
- `src/dependencyInjection/tokens/tokens-ui.js`: Added `PromptPreviewModal` token.
- `src/dependencyInjection/registrations/uiRegistrations.js`:
  - `PromptPreviewModal` is now registered as a singleton factory.
  - The `DomUiFacade` registration was updated to include `PromptPreviewModal` as a dependency.
- `src/domUI/domUiFacade.js`:
  - `PromptPreviewModal` was added as a constructor dependency.
  - A getter (`promptPreviewModal`) was added to expose the instance.
- `src/domUI/engineUIManager.js`:
  - Subscribed to `UI_SHOW_LLM_PROMPT_PREVIEW` event.
  - A handler (`#handleShowLlmPromptPreview`) was implemented to call `domUiFacade.promptPreviewModal.show(event.payload)`.
- `src/bootstrapper/stages/uiStages.js`:
  - A click listener was added for the `#llm-prompt-debug-button` which calls `gameEngine.previewLlmPromptForCurrentActor()`.
  - Basic error handling for the engine call was included.
- `tests/integration/llmPromptDebug.spec.js`: A new integration test was created to verify the entire flow, including DOM element rendering, DI container setup, button click simulation, event dispatching, and modal content assertion.

All existing tests were run and passed, and the newly added integration test also passed after addressing several dependency mocking requirements.

This ticket is now complete.
