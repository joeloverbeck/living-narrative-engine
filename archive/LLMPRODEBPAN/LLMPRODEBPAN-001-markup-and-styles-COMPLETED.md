# LLMPRODEBPAN-001: UI Markup and Styles (COMPLETED)

**Files:**
- `game.html`
- `css/style.css`

**Out of Scope:**
- JavaScript logic or event handling (just the static structure and styles).

**Acceptance Criteria:**

1.  **Markup (`game.html`):**
    *   `#llm-prompt-debug-widget` is added to the `#right-pane` in `game.html`, inserted *before* `#game-actions-widget`.
    *   The widget contains:
        *   Header/Label: "LLM Prompt Debug"
        *   Button: `#llm-prompt-debug-button` with text "prompt to llm".
    *   `#llm-prompt-debug-modal` is added to the `body` (alongside other modals).
    *   The modal structure mimics existing modals (overlay -> content -> title + close button + body).
    *   Modal contains:
        *   Title: "LLM Prompt Preview"
        *   Body area: `#llm-prompt-debug-content` (container for text/metadata).
        *   Metadata strip container (e.g., `.prompt-metadata`).
        *   Actions: Close button and Copy button (`#llm-prompt-copy-button`).
        *   Status area: `#llm-prompt-debug-status`.

2.  **Styles (`css/style.css`):**
    *   Widget matches the visual style of other right-pane widgets.
    *   Modal overlay and content match existing modal styles.
    *   Prompt content area uses a monospace font (e.g., `Roboto Mono`), `white-space: pre-wrap`, and has `max-height` with `overflow-y: auto`.
    *   Metadata strip is distinct (e.g., smaller font, different background/border).
    *   Loading spinner styles (if not reusing existing ones).

3.  **Verification:**
    *   Open `game.html` in a browser (after build) and verify the widget appears in the right pane.
    *   Manually un-hide the modal (via DevTools) to verify its layout and styling.

# Outcome
*   Added `#llm-prompt-debug-widget` to `game.html` before `#game-actions-widget`.
*   Added `#llm-prompt-debug-modal` to `game.html` body.
*   Created `css/components/_llm-prompt-debug.css` with specific styles for the widget and modal, matching the project's design system.
*   Imported `css/components/_llm-prompt-debug.css` in `css/style.css`.
*   Verified markup and style import via unit test `tests/unit/ui/llmPromptDebugPanel.markup.test.js`.
