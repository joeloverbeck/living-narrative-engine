# LLMPRODEBPAN-003: Modal Renderer Implementation

**Files:**
- `src/domUI/PromptPreviewModal.js` (New)
- `tests/unit/domUI/PromptPreviewModal.test.js` (New)

**Out of Scope:**
- Engine logic.
- Registering the modal in the DI container (handled in next ticket).

**Acceptance Criteria:**

1.  **Class Structure:**
    *   `PromptPreviewModal` extends `BaseModalRenderer` (or `BoundDomRendererBase` if more appropriate, but likely `BaseModalRenderer` for modal behavior).
    *   Constructor takes `DocumentContext` and `DomElementFactory`.

2.  **Rendering:**
    *   `show(payload)` method:
        *   Opens the modal (`llm-prompt-debug-modal`).
        *   If `payload` is missing or has errors: renders error state in `#llm-prompt-debug-status` and/or content area.
        *   If `payload.prompt` is present:
            *   Injects prompt text into the content area (escaping HTML if necessary, or using `textContent`).
            *   Updates metadata fields (Actor name, ID, etc.).
            *   Clears loading/error states.
    *   `setLoading(isLoading)` method:
        *   Toggles a loading indicator (spinner or text) while waiting for the engine response (if the UI triggers the wait). *Self-correction: The engine event pushes the data, so "loading" might be handled by the initial button click before the event arrives, or the modal opens in a "loading" state first. For now, assume the modal opens *on* the event, or the button handler opens it. Let's assume the modal is passive and only shows when data arrives, OR the button opens it in "loading" and then updates. Let's stick to: `show()` accepts the data. The button handler (next ticket) will handle the "pending" UI feedback if needed.*

3.  **Interactions:**
    *   **Copy Button:** Clicking `#llm-prompt-copy-button` copies the prompt text to clipboard and shows a brief "Copied!" feedback in the status area.
    *   **Close:** Standard modal close behavior (x button, escape key, outside click - inherited from base if possible).

4.  **Tests:**
    *   **Render:** `show({...})` correctly populates the DOM elements.
    *   **Error:** `show({ errors: [...] })` displays errors.
    *   **Copy:** Simulates click, mocks `navigator.clipboard.writeText`, verifies call and status update.

# Outcome
- Created `src/domUI/PromptPreviewModal.js` extending `BaseModalRenderer`.
- Implemented `show(payload)` handling data injection, errors, and metadata.
- Implemented `setLoading(isLoading)` for loading states.
- Implemented copy-to-clipboard functionality with feedback.
- Created comprehensive unit tests in `tests/unit/domUI/PromptPreviewModal.test.js`.
