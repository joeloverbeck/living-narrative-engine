# REMGAMSAVLOAPER-004: Remove Bootstrapper Save/Load Wiring (Menu Listeners + Auxiliary Inits)

**Status**: Completed
**Priority**: HIGH
**Effort**: Medium

## Summary
Remove bootstrap wiring that exists solely to support Save/Load UI:
- Menu button listeners in `src/bootstrapper/stages/uiStages.js`
- Auxiliary initializers `initSaveGameUI` / `initLoadGameUI`
- Auxiliary initializer exports and stage invocations

This ticket should delete or rewrite tests that exist primarily to validate those stages.

## Current reality check (discrepancies vs original assumptions)
- `game.html` no longer contains Save/Load menu button IDs (`#open-save-game-button`, `#open-load-game-button`) or modal roots (`#save-game-screen`, `#load-game-screen`), but the bootstrapper stages and several tests still reference them.
- `initializeAuxiliaryServicesStage` currently invokes `initSaveGameUI` / `initLoadGameUI`, but those initializers short-circuit to success when the modal roots are missing. This means the stage can “pass” even though the wiring is dead code; the goal of this ticket is to remove that dead wiring entirely (not just keep it as a no-op).
- There is existing integration coverage for `initializeAuxiliaryServicesStage` that directly asserts Save/Load initialization; it must be updated as part of this ticket.

## File list it expects to touch
- `src/bootstrapper/stages/uiStages.js`
- `src/bootstrapper/stages/initializeAuxiliaryServicesStage.js`
- `src/bootstrapper/stages/auxiliary/index.js`
- `src/bootstrapper/stages/auxiliary/initSaveGameUI.js`
- `src/bootstrapper/stages/auxiliary/initLoadGameUI.js`
- Tests (expected deletions/updates):
  - `tests/unit/bootstrapper/stages/auxiliary/initSaveGameUI.test.js`
  - `tests/unit/bootstrapper/stages/auxiliary/initLoadGameUI.test.js`
  - `tests/unit/bootstrapper/stages.menuListeners.test.js`
  - `tests/integration/bootstrapper/auxiliary/initLoadAndSaveStages.fullstack.integration.test.js`
  - `tests/integration/bootstrapper/auxiliary/initLoadGameUI.adapterBridge.integration.test.js`
  - `tests/integration/bootstrapper/UIBootstrapper.realDom.integration.test.js`
  - `tests/integration/bootstrapper/initializeAuxiliaryServicesStage.integration.test.js` (currently asserts Save/Load init)
  - `tests/unit/bootstrapper/auxiliaryStages.test.js` (token list/assumptions include Save/Load)
  - `tests/integration/runtime/mainOrchestrationResilience.integration.test.js` (currently hardcodes Save/Load button DOM + mocks Save/Load initializers)

## Out of scope (must NOT change)
- `src/domUI/slotModalBase.js` (shared with LLM selection).
- DomUI save/load modules themselves (handled in `REMGAMSAVLOAPER-005`).
- Engine save/load APIs (`GameEngine.showSaveGameUI`, etc.) (handled in `REMGAMSAVLOAPER-006`).

## Acceptance criteria
### Specific tests that must pass
- `npm run test:unit -- --runInBand tests/unit/bootstrapper/stages.menuListeners.test.js` (updated to reflect non-Save/Load listeners)
- `npm run test:unit -- --runInBand tests/unit/bootstrapper/stages`
- `npm run test:integration -- --runInBand tests/integration/bootstrapper/UIBootstrapper.realDom.integration.test.js` (if retained; otherwise the replacement integration coverage)
- `npm run test:integration -- --runInBand tests/integration/bootstrapper/initializeAuxiliaryServicesStage.integration.test.js`
- `npm run test:integration -- --runInBand tests/integration/runtime/mainOrchestrationResilience.integration.test.js`

### Invariants that must remain true
- UI bootstrap stages do not query or require save/load DOM element IDs.
- Auxiliary services stage does not attempt to initialize `SaveGameUI` or `LoadGameUI`.
- Other unrelated bootstrap wiring remains intact (e.g. LLM selection modal init, processing indicator init).

## Outcome
- Removed Save/Load wiring from bootstrap stages (`setupMenuButtonListenersStage` and `initializeAuxiliaryServicesStage`) instead of keeping it as DOM-gated no-op code.
- Deleted the auxiliary init modules for Save/Load (`initSaveGameUI`, `initLoadGameUI`) and removed their associated unit/integration tests that existed solely to validate that wiring.
- Updated bootstrap-related unit/integration tests to match the current `game.html` reality (no Save/Load buttons/screens) while retaining coverage for menu listener wiring (LLM prompt debug) and auxiliary initialization behavior.
