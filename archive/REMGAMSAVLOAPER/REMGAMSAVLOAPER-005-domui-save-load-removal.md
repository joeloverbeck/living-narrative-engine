# REMGAMSAVLOAPER-005: Remove DomUI Save/Load Modules and Engine UI Event Handling

**Status**: Completed
**Priority**: HIGH
**Effort**: Medium

## Summary
Remove the DomUI implementation for save/load and all of its internal helper code:
- `SaveGameUI`, `LoadGameUI`, `SaveGameService`, save/load slot helpers
- DomUiFacade accessors/deps for save/load
- EngineUIManager subscriptions/handlers for save/load UI events (DomUI side only; engine dispatchers remain until `REMGAMSAVLOAPER-006`)

Delete tests that exist primarily to validate save/load UI behavior.

## Reassessed assumptions (2025-12-17)
- Save/load DomUI modules are currently constructed and injected via `src/dependencyInjection/registrations/uiRegistrations.js`. Deleting `src/domUI/saveGameUI.js` / `src/domUI/loadGameUI.js` without updating DI wiring will break runtime and tests.
- Save/load UI event IDs (`REQUEST_SHOW_SAVE_GAME_UI`, `REQUEST_SHOW_LOAD_GAME_UI`, `CANNOT_SAVE_GAME_INFO`) are still referenced by `src/engine/gameEngine.js`. This ticket can and should remove DomUI subscriptions/handlers, but it must **not** delete these event ID exports yet (that belongs with engine API removal in `REMGAMSAVLOAPER-006`).
- Slot formatting helpers targeted for deletion (`src/domUI/helpers/renderSlotItem.js`, `src/domUI/helpers/slotDataFormatter.js`) are also imported by `src/utils/loadSlotUtils.js` and its tests. Removing the helpers therefore requires either refactoring that utility or removing it as part of the save/load UI purge.
- Save/load DomUI modules were also initialized via bootstrapper auxiliary stages. Once the DomUI modules are removed, the bootstrapper stage list must stop importing/calling those init modules to avoid runtime/test failures.

## File list it expects to touch
- Delete:
  - `src/domUI/saveGameUI.js`
  - `src/domUI/loadGameUI.js`
  - `src/domUI/saveGameService.js`
  - `src/domUI/saveGameTypedefs.js`
  - `src/domUI/helpers/renderSlotItem.js`
  - `src/domUI/helpers/slotDataFormatter.js`
  - `src/utils/loadSlotUtils.js`
  - `src/bootstrapper/stages/auxiliary/initSaveGameUI.js`
  - `src/bootstrapper/stages/auxiliary/initLoadGameUI.js`
- Update:
  - `src/domUI/domUiFacade.js`
  - `src/domUI/engineUIManager.js`
  - `src/domUI/index.js`
  - `src/bootstrapper/stages/auxiliary/index.js`
  - `src/bootstrapper/stages/initializeAuxiliaryServicesStage.js`
  - `src/bootstrapper/stages/uiStages.js`
  - `src/dependencyInjection/registrations/uiRegistrations.js` (remove Save/Load UI registrations + facade wiring deps)
  - `src/constants/eventIds.js` (ONLY if no longer referenced outside DomUI; currently expected to remain until `REMGAMSAVLOAPER-006`)
- Tests (expected deletions):
  - `tests/unit/domUI/loadGameUI.*.test.js`
  - `tests/unit/domUI/saveGameUI.*.test.js`
  - `tests/unit/domUI/saveGameService.test.js`
  - `tests/unit/config/registrations/uiRegistrations.loadGameUIResolution.test.js`
  - `tests/unit/domUI/helpers/renderSlotItem.test.js`
  - `tests/unit/domUI/helpers/slotDataFormatter.test.js`
  - `tests/unit/utils/loadSlotUtils.test.js`
  - `tests/unit/utils/compareLoadSlots.test.js`
  - `tests/unit/bootstrapper/stages/auxiliary/initLoadGameUI.test.js`
  - `tests/unit/bootstrapper/stages/auxiliary/initSaveGameUI.test.js`
  - `tests/integration/domUI/loadGameUI.realModules.integration.test.js`
  - `tests/integration/domUI/saveGameService.realModules.integration.test.js`
  - `tests/integration/domUI/saveGameService.windowPrompt.integration.test.js`
  - `tests/integration/domUI/slotListManager.test.js`
  - `tests/integration/domUI/helpers/saveSlotHelpers.integration.test.js`
  - `tests/integration/utils/loadSlotUtils.integration.test.js`
  - `tests/integration/bootstrapper/auxiliary/initLoadAndSaveStages.fullstack.integration.test.js`
  - `tests/integration/bootstrapper/auxiliary/initLoadGameUI.adapterBridge.integration.test.js`
- Tests (expected to remain passing, may need small updates):
  - `tests/unit/domUI/slotModalBase.test.js` (ensure shared modal base still behaves correctly)
  - `tests/unit/domUI/llmSelectionModal.test.js`
  - `tests/unit/dependencyInjection/registrations/uiRegistrations.*.test.js` (remove Save/Load UI-related expectations/mocks)
  - `tests/integration/llmPromptDebug.spec.js` (remove Save/Load UI-related DI expectations)

## Out of scope (must NOT change)
- `src/domUI/slotModalBase.js` behavior beyond removing misleading save/load wording (do not break LLM selection modal).
- Any LLM selection persistence and UI (`src/domUI/llmSelectionModal.js` and `src/llms/services/llmSelectionPersistence.js`).
- Engine methods for save/load (handled in `REMGAMSAVLOAPER-006`).

## Acceptance criteria
### Specific tests that must pass
- `npm run test:unit -- --runInBand tests/unit/domUI/slotModalBase.test.js`
- `npm run test:unit -- --runInBand tests/unit/domUI/domUiFacade.test.js`
- `npm run test:unit -- --runInBand tests/unit/domUI/engineUIManager.test.js`
- `npm run test:unit -- --runInBand tests/unit/domUI/llmSelectionModal.test.js`
- `npm run test:integration -- --runInBand tests/integration/indexLLMSelector.integration.test.js`

### Invariants that must remain true
- No code under `src/domUI/` imports from `src/interfaces/ISaveLoadService.js` after this ticket.
- No remaining DomUI code subscribes to:
  - `REQUEST_SHOW_SAVE_GAME_UI`
  - `REQUEST_SHOW_LOAD_GAME_UI`
  - `CANNOT_SAVE_GAME_INFO`
- Shared modal infrastructure continues to work for non-save/load modals (LLM selection at minimum).

## Outcome
- Shipped: Deleted `src/domUI/saveGameUI.js`, `src/domUI/loadGameUI.js`, `src/domUI/saveGameService.js`, `src/domUI/saveGameTypedefs.js`, and slot helper modules; removed save/load deps from `src/domUI/domUiFacade.js`, `src/domUI/engineUIManager.js`, `src/domUI/index.js`, and `src/dependencyInjection/registrations/uiRegistrations.js`.
- Adjusted scope vs original plan: Kept save/load UI event IDs in `src/constants/eventIds.js` because `src/engine/gameEngine.js` still references them (engine-side cleanup remains in `REMGAMSAVLOAPER-006`).
- Additional cleanup discovered during implementation: Deleted `src/utils/loadSlotUtils.js` and its helper tests because it depended on the deleted slot formatting helpers.
