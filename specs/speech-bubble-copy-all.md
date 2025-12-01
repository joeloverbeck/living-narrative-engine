# Context
- `src/domUI/speechBubbleRenderer.js` renders speech and thought bubbles, derives player/LLM status from entity components, and appends meta buttons returned by `buildSpeechMeta`.
- `src/domUI/helpers/buildSpeechMeta.js` builds the meta button row (thoughts/notes icons) and wires clipboard handlers via `clipboardUtils`.
- `src/domUI/helpers/clipboardUtils.js` formats notes/thoughts for clipboard and emits feedback; speech content currently bypasses these helpers.
- Icons are provided by `src/domUI/icons.js`; new UI affordances need a default SVG and optional registry override.
- Coverage exists in `tests/unit/domUI/helpers/buildSpeechMeta.*`, `tests/unit/domUI/speechBubbleRenderer.portrait.test.js`, `tests/integration/domUI/speechBubbleRendererInteractions.integration.test.js`, and portrait modal integration tests that inspect DOM structure and meta button presence.

# Problem
- Users must manually copy speech, then thoughts, then notes to assemble a coherent story from LLM turns.
- The UI already exposes per-field copy buttons (thoughts/notes) but offers no single action to copy the full bubble payload (speech + thoughts + notes) nor a copy affordance on human speech.
- Because `buildSpeechMeta` returns `null` when no thoughts/notes exist, there is no container to host a universal “copy all” control.

# Truth sources
- Rendering and payload shape: `src/domUI/speechBubbleRenderer.js` (`renderSpeech`, `renderThought`, `#createSpeechElements`, `#appendQuotedSpeech`).
- Meta button creation and clipboard wiring: `src/domUI/helpers/buildSpeechMeta.js`, `src/domUI/helpers/clipboardUtils.js`.
- Icon plumbing: `src/domUI/icons.js`.
- Current DOM/CSS expectations and tests: `tests/unit/domUI/helpers/buildSpeechMeta.*`, `tests/unit/domUI/speechBubbleRenderer.portrait.test.js`, `tests/integration/domUI/speechBubbleRendererInteractions.integration.test.js`, `tests/integration/domUI/speechBubblePortraitModalIntegration.test.js`.

# Desired behavior
## Button presence and layout
- Add a “copy all” meta button that always renders on every bubble (speech or thought), positioned on the same meta row as thoughts/notes and visually right-aligned/ordered after existing icons.
- When no thoughts/notes exist, still render the meta container to host the copy-all button; preserve existing `speech-bubble`/`thought-bubble` structure and CSS hooks.
- Button uses a dedicated icon (clipboard/all-in-one symbol) sourced from `icons.js` with registry override support; adds `aria-label`/`title` describing what will be copied for the given bubble type.

## Copy rules
- Human player speech bubble: copy the displayed speech content only (same text as rendered, preserving inline action markers `*foo*` but without HTML tags when `allowHtml` is true).
- LLM thought bubble: copy concatenated payload of thoughts plus notes (if any). Thoughts should use `formatThoughtsForClipboard`; notes should use `formatNotesForClipboard`. Order: thoughts, blank line, notes.
- LLM speech bubble: copy speech content plus thoughts and notes when present. Order: speech content, blank line, formatted thoughts (if present), blank line, formatted notes (if present).
- Clipboard operation reuses `copyToClipboard` and `showCopyFeedback`, with success/failure messaging consistent with existing meta buttons; click should `preventDefault`/`stopPropagation`.
- Copy content must be derived from source strings, not innerHTML, to avoid leaking markup; preserve surrounding quotes used in the UI for speech content.

## Edge cases
- If any segment (thoughts/notes) is empty/invalid, omit it from the assembled text but still keep button enabled for the remaining fields.
- For player thoughts (if ever emitted), treat them like LLM thoughts: copy thoughts + notes.
- Works when `buildSpeechMeta` previously returned `null`; no runtime errors when notes/thoughts missing or when clipboard API fails (feedback shows failure).

## Failure modes
- If formatting yields an empty string (all segments missing/invalid), show “Copy failed” feedback and do not call `copyToClipboard`.
- Clipboard failures follow existing pattern: log via `clipboardUtils`, show failure feedback, but do not throw.

## Invariants
- Speech/thought rendering remains scroll-safe and portrait logic unchanged.
- Existing thoughts/notes buttons keep their behavior and ordering; adding copy-all must not change their semantics or aria labels.
- Meta container class names remain stable so downstream CSS/tests stay intact.

# Testing plan
- **Unit (buildSpeechMeta)**: add tests for copy-all handler covering (a) human speech payload copies only speech text with quotes, (b) LLM thought copies formatted thoughts + notes with separators, (c) LLM speech copies speech + thoughts + notes with correct ordering and skips missing fields, (d) failure feedback when assembled text is empty or `copyToClipboard` rejects. Mock `clipboardUtils`, assert aria labels/titles and button ordering (`.meta-btn.copy-all` is last).
- **Unit (speechBubbleRenderer)**: extend portrait renderer tests to assert meta container exists even without thoughts/notes and contains copy-all button for both player and non-player bubbles; verify `buildSpeechMeta` invocation includes data needed for copy-all label/context.
- **Integration (speechBubbleRendererInteractions.integration.test.js)**: simulate renders for speech and thought bubbles, trigger copy-all click, and assert composed clipboard payload matches rules (speech-only for human, speech+thoughts+notes for LLM). Ensure button is present in DOM order after thoughts/notes icons.
- **Icon coverage**: add a small unit test for `icons.js` default icon map to include the new `copy-all` entry and allow registry override (similar to existing defaults).
