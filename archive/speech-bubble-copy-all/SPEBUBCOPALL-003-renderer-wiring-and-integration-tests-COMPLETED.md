# SPEBUBCOPALL-003: Wire copy-all into speechBubbleRenderer and cover integration (COMPLETED)

## Status

- Completed

## Updated scope (assumptions corrected)

`speechBubbleRenderer` already passes copy-all data into `buildSpeechMeta`, which renders a meta container (class `speech-meta`) even when there are no thoughts/notes. Clipboard formatting and button wiring live in `buildSpeechMeta` and are unit-tested in `tests/unit/domUI/helpers/buildSpeechMeta.copyHandlers.test.js`. The missing piece is renderer-level integration coverage to prove the copy-all button is present/order-stable in the DOM and that it assembles the right clipboard payload for player vs. NPC bubbles.

## File list

- tests/integration/domUI/speechBubbleRendererInteractions.integration.test.js

## Out of scope

- Icon definitions or clipboard assembly logic (handled in other tickets).
- CSS/theming adjustments beyond ensuring the meta container exists.
- Changes to thought/speech rendering order or portrait modal mechanics.

## Acceptance criteria

- Tests:
  - `npm run test:integration -- tests/integration/domUI/speechBubbleRendererInteractions.integration.test.js` (run in-band if workers flake) covers copy-all DOM presence/order and clipboard payload composition for speech vs thought bubbles when clicking copy-all.
- Invariants:
  - Speech/thought layout, scroll/portrait logic, and meta container class names remain stable.
  - Existing per-field copy buttons keep semantics and positioning; copy-all is appended without reordering prior icons.
  - Meta container creation does not introduce runtime errors when thoughts/notes are absent.

## Outcome

- Added integration coverage in `tests/integration/domUI/speechBubbleRendererInteractions.integration.test.js` to assert copy-all button presence/order and clipboard payloads for player speech and NPC speech/thought bubbles.
- No renderer or helper wiring changes were needed because `buildSpeechMeta` already created the meta container and copy-all button for bubbles without thoughts/notes.
- Test run: `npm run test:integration -- --runInBand tests/integration/domUI/speechBubbleRendererInteractions.integration.test.js` (in-band to avoid worker crash).
