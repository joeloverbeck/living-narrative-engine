# HUMINTHELOOLLM-003: UI Callout and Preselection for LLM Suggestions

**Summary:** Render an explicit “LLM suggestion” callout in the action selection UI, preselect the suggested action (with clamping fallback), and preserve keyboard/controller navigation.

## File list
- src/domUI/actionButtonsRenderer.js (or new renderer state/variant)
- src/utils/actionIndexUtils.js (clamp/preselect helper)
- src/turns/llm/llmResponseProcessor.js (ensure speech/thoughts render before callout)
- src/turns/schemas/llmOutputSchemas.js (if needed for descriptor inclusion)
- tests/ (UI/unit specs for preselection and clamping)

## Out of scope
- Core pending gate logic or prompt dispatch (handled in HUMINTHELOOLLM-001/002).
- Telemetry/logging of overrides or suggestions.
- Timeout/fallback configuration and timers.
- Broader UI theming unrelated to the suggestion callout.

## Acceptance criteria
- Tests:
  - `npm run test:unit -- src/utils/actionIndexUtils.test.js` (new/updated) covers clamping behavior and preselection defaults to wait/idle on invalid indexes.
  - `npm run test:integration -- ui/llm-suggestion-callout.integration.test.js` (new) validates callout rendering, suggested button preselected, and keyboard/controller navigation unchanged.
  - `npm run test:unit -- src/turns/llm/llmResponseProcessor.test.js` (new/updated) confirms speech/thoughts/notes render before callout payload reaches UI.
- Invariants:
  - Action buttons remain accessible and navigable with existing input methods.
  - If suggested index is invalid/out-of-range, UI still renders with safe selection (e.g., wait/idle) and no crash.
  - Visual distinction for “LLM suggestion” appears without altering human turn styling.
  - Speech/thought ordering relative to the callout matches current behavior (speech/thoughts first).
