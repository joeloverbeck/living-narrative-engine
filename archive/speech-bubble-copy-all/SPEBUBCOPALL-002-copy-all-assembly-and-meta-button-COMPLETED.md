# SPEBUBCOPALL-002: Implement copy-all payload assembly and meta button wiring (COMPLETED)

## Status
- Completed

## Current state (assumptions corrected)
- `buildSpeechMeta` only renders thoughts/notes buttons and returns `null` when both are absent, so there is no container to host a copy-all control.
- `speechBubbleRenderer` does not pass speech text into `buildSpeechMeta`, and thought bubbles only send notes (not the thought text) to the helper.
- `clipboardUtils` already exposes `copyToClipboard`, `formatThoughtsForClipboard`, `formatNotesForClipboard`, and `showCopyFeedback`, but there is no helper that assembles a “copy all” payload or guards against empty assembly.
- A `copy-all` icon already exists in `src/domUI/icons.js`, so only wiring is needed.
- Unit tests in `tests/unit/domUI/helpers/buildSpeechMeta*.test.js` cover thoughts/notes buttons only and expect `buildSpeechMeta` to return `null` when there is no metadata.

## Scope (updated)
- Add a copy-all meta button that always renders in the meta row (even when thoughts/notes are missing) and assemble clipboard payloads per bubble type using existing clipboard helpers.
- Ensure `buildSpeechMeta` can handle speech, thoughts, and notes data (including when some are missing) without throwing, and wires `aria-label`/`title` per bubble type.
- Keep existing thoughts/notes button behavior intact and continue using source strings (not innerHTML) for copy payloads; preserve quoted speech formatting.

## File list
- src/domUI/helpers/buildSpeechMeta.js
- src/domUI/helpers/clipboardUtils.js (add copy-all assembly helper and reuse feedback)
- tests/unit/domUI/helpers/buildSpeechMeta.test.js
- tests/unit/domUI/helpers/buildSpeechMeta.edgeCases.test.js
- tests/unit/domUI/helpers/buildSpeechMeta.copyHandlers.test.js (extend for copy-all success/failure paths)

## Out of scope
- Altering speech/thought rendering structure outside the meta row container.
- Styling or CSS class changes beyond the new copy-all control.
- Icon artwork changes (default already present) and non-clipboard-related UX.

## Acceptance criteria
- Tests:
  - `npm run test:unit -- tests/unit/domUI/helpers/buildSpeechMeta.test.js tests/unit/domUI/helpers/buildSpeechMeta.edgeCases.test.js tests/unit/domUI/helpers/buildSpeechMeta.copyHandlers.test.js` validate copy-all button creation, ordering (last in meta row), aria label/title per bubble type, and assembled payload rules for player speech, LLM speech, and thoughts.
  - Unit coverage includes failure path: empty assembled payload or rejected clipboard write triggers failure feedback without throwing.
- Invariants:
  - Existing thoughts/notes buttons retain behavior, class names, and aria labels.
  - Clipboard formatting for individual thoughts/notes remains unchanged outside copy-all aggregation.
  - Copy-all assembly derives text from source strings (not innerHTML) and preserves surrounding quotes for speech content.

## Outcome
- Added aggregated copy-all assembly in `clipboardUtils` and wired a `copy-all` meta button (using the existing icon) that renders even when only speech content is present.
- `buildSpeechMeta` now appends the copy-all control after existing thoughts/notes buttons with contextual aria labels/titles; speech/thought renderers pass the needed copy-all context without altering existing button behavior.
- Expanded unit coverage for copy-all assembly and handlers in `buildSpeechMeta` and `clipboardUtils`, with targeted tests running in-band due to known worker flakiness.
