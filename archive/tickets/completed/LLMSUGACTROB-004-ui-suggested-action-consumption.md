# LLMSUGACTROB-004 Align UI consumption with core suggested-action event

Status: Completed

## Assumption check

- ActionButtonsRenderer already subscribes to `LLM_SUGGESTED_ACTION_ID`, which resolves to the canonical `core:suggested_action` value; no leftover `llm:` listener remains.
- Unit coverage exists for preselection and callout rendering (`tests/unit/domUI/actionButtonsRenderer.llmSuggestion.test.js`).
- Event ID contract is locked in `tests/unit/constants/eventIds.test.js` to `core:suggested_action`.

## Updated scope

- Keep the current wiring intact; just validate the canonical event handling via the existing targeted unit suite.
- Avoid UI refactors, DI/workflow changes, or styling tweaks.

## File list

- src/domUI/actionButtonsRenderer.js (only if a regression surfaces)
- tests/unit/domUI/actionButtonsRenderer.llmSuggestion.test.js (existing coverage)

## Out of scope

- Workflow/DI changes.
- Styling or layout adjustments beyond event handling verification.
- Changes to other UI modules unrelated to suggested-action callouts.

## Acceptance criteria

### Tests

- `npm run test:single -- tests/unit/domUI/actionButtonsRenderer.llmSuggestion.test.js` validates handling of the `core:suggested_action` event, including preselection and callout rendering.

### Invariants

- Renderer continues to function for non-LLM events and manual actions.
- Event listener uses the canonical ID consistent with `eventIds` export and event definition.
- No regressions to existing keyboard/control flows for action selection.

## Outcome

- Verified existing renderer already subscribes to the canonical `core:suggested_action` event via `LLM_SUGGESTED_ACTION_ID`; no UI code changes required.
- Rebased ticket scope/acceptance on the actual test command (`npm run test:single -- tests/unit/domUI/actionButtonsRenderer.llmSuggestion.test.js`) and confirmed the suite still passes.
