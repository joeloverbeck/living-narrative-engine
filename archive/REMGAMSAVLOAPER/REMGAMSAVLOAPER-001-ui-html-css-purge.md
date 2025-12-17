# REMGAMSAVLOAPER-001: Purge Save/Load UI From `game.html`, `index.html`, and Modal CSS

**Status**: Completed
**Priority**: HIGH
**Effort**: Small (mostly HTML/CSS; tiny bootstrap guard)

## Summary
Remove all “Save Game” / “Load Game” UI entry points and markup, including:
- Buttons and modals in `game.html`
- “Load Game” button/behavior in `index.html`
- Save/load-specific selectors in `css/components/_modals.css`
- URL-param-driven load-on-start behavior (`game.html?load=true`)

## File list it expects to touch
- `game.html`
- `index.html`
- `css/components/_modals.css`
- `src/bootstrapper/stages/auxiliary/initSaveGameUI.js`
- `src/bootstrapper/stages/auxiliary/initLoadGameUI.js`
- Tests that assert the old markup/behavior (see Acceptance Criteria)

## Out of scope (must NOT change)
- Engine/DI/persistence refactors (these happen in later tickets in this set).
- Generic modal styling used by non-save/load features (e.g. LLM selection modal).
- Any non-save/load UI features on `index.html` / `game.html` (layout may be adjusted, but functionality should remain).

## Reassessed assumptions / scope updates
- Removing `#save-game-screen` / `#load-game-screen` from `game.html` exposes that the current bootstrap sequence eagerly initializes `SaveGameUI`/`LoadGameUI` via auxiliary stages; those UI classes treat their DOM selectors as required and will throw if the elements are missing.
- To keep `game.html` bootable after removing the markup, this ticket includes a minimal guard in the save/load auxiliary initializers: if the corresponding modal root element is not present in the DOM, the initializer is skipped and treated as a success.
- `?start=false` is intentionally preserved (developer/test utility). Only the `load=true` URL param behavior is removed here.

## Acceptance criteria
### Specific tests that must pass
- `npm run test:unit -- --runInBand tests/unit/index.test.js`
- `npm run test:unit -- --runInBand tests/unit/gameHtml.saveLoadPurge.test.js`
- `npm run test:unit -- --runInBand tests/unit/bootstrapper/stages/auxiliary/initSaveGameUI.test.js`
- `npm run test:unit -- --runInBand tests/unit/bootstrapper/stages/auxiliary/initLoadGameUI.test.js`
- `npm run test:unit -- --runInBand tests/unit/main/main.bootstrapFlow.test.js`
- `npm run test:unit -- --runInBand tests/unit/index/index-llm-selector.test.js`

### Invariants that must remain true
- `game.html` contains no elements/IDs for save/load:
  - No `#open-save-game-button`, `#open-load-game-button`
  - No `#save-game-screen`, `#load-game-screen`
  - No `#confirm-save-button`, `#confirm-load-button`, `#delete-save-button`
- `index.html` contains no “Load Game” button or navigation to `game.html?load=true`.
- Generic modal styles continue to support existing modals (at minimum, LLM selection modal rendering/visibility is unaffected).

## Implementation notes
- Remove only the `load=true` plumbing; keep the existing `?start=false` gate.
- Update `index.html` layout after removing the “Load Game” button to avoid awkward spacing.

## Outcome
- Removed save/load buttons and modal markup from `game.html`; removed `load=true` plumbing while preserving `?start=false`.
- Removed “Load Game” UI and `game.html?load=true` navigation from `index.html`, adjusting the button grid to 1-column.
- Purged save/load-specific selectors from `css/components/_modals.css` while leaving shared modal styles intact.
- Added a minimal bootstrap guard so `SaveGameUI`/`LoadGameUI` initialization is skipped when their modal roots are absent (avoids bootstrap failures after HTML purge).
- Updated/added unit tests to reflect the new markup and to lock in the “no save/load remnants” invariant.
