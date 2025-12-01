# SPEBUBCOPALL-003: Wire copy-all into speechBubbleRenderer and cover integration

Ensure `speechBubbleRenderer` always renders the meta container (even without thoughts/notes) and passes the data needed for the copy-all button; verify DOM presence/order and clipboard payloads via renderer integration tests.

## File list
- src/domUI/speechBubbleRenderer.js
- tests/unit/domUI/speechBubbleRenderer.portrait.test.js (extend meta container expectations)
- tests/integration/domUI/speechBubbleRendererInteractions.integration.test.js
- tests/integration/domUI/speechBubblePortraitModalIntegration.test.js (if DOM assertions needed for meta row)

## Out of scope
- Icon definitions or clipboard assembly logic (handled in other tickets).
- CSS/theming adjustments beyond ensuring the meta container exists.
- Changes to thought/speech rendering order or portrait modal mechanics.

## Acceptance criteria
- Tests:
  - `npm run test:unit -- tests/unit/domUI/speechBubbleRenderer.portrait.test.js` verifies meta container renders for player/non-player bubbles without thoughts/notes and includes a trailing copy-all button.
  - `npm run test:integration -- tests/integration/domUI/speechBubbleRendererInteractions.integration.test.js` covers DOM button presence/order and clipboard payload composition for speech vs thought bubbles when clicking copy-all.
  - If portrait modal asserts meta row, extend `tests/integration/domUI/speechBubblePortraitModalIntegration.test.js` to include copy-all presence without regressions.
- Invariants:
  - Speech/thought layout, scroll/portrait logic, and meta container class names remain stable.
  - Existing per-field copy buttons keep semantics and positioning; copy-all is appended without reordering prior icons.
  - Meta container creation does not introduce runtime errors when thoughts/notes are absent.
