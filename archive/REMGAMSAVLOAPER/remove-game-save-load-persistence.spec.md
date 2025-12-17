# Spec: Remove Game Save/Load Persistence (Full Purge)

## Background / Motivation
The project currently exposes **Save Game** and **Load Game** UI entry points:
- `game.html` “Game Menu” panel contains **Save Game** and **Load Game** buttons and associated modal dialogs.
- `index.html` landing page contains a **Load Game** button that navigates to `game.html?load=true`.

The save/load feature set was implemented early, is not currently used, and has not worked reliably in a long time. It creates significant maintenance burden across UI, engine, DI wiring, and tests.

This spec defines **everything that must be found and removed** to eliminate game state persistence (manual save/load) end-to-end.

## Goal
Remove:
1. All UI affordances for saving/loading games.
2. All runtime code paths for saving/loading game state.
3. All persistence pipeline code (expected bulk under `src/persistence/`).
4. All tests that exist primarily to validate save/load persistence.

After the change, the engine should only support “start new game” behavior; no manual save slots, no load workflows, no “open load UI on startup”.

## Non-Goals / Explicitly Out of Scope
This spec targets **game save/load** persistence only. Do not remove unrelated persistence concepts such as:
- LLM selection persistence in `src/llms/services/llmSelectionPersistence.js` (localStorage-based).
- Anatomy or component “persistence” in the sense of writing to entity components (e.g. `src/anatomy/DescriptionPersistenceService.js`).
- “Action tracing” storage behavior (depends on `IStorageProvider`) unless it is currently coupled to game save/load.

If any module is named “persistence” but is not about *save/load game state to/from disk*, it must be evaluated carefully before removal.

## Definition of “Game Save/Load Persistence”
Any code that:
- Serializes game state, writes save files, or manages save slots.
- Reads save files, parses metadata, restores game state, or resets engine state for load.
- Exposes save/load UI, dispatches save/load UI events, or adapts engine methods to UI.
- Registers DI services exclusively to support the above.

## Inventory (Known Surface Area)
These are the entry points and core modules currently involved:

### UI Surface
- `game.html`
  - Buttons: `#open-save-game-button`, `#open-load-game-button`
  - Modals: `#save-game-screen`, `#load-game-screen`
  - Modal controls: `#confirm-save-button`, `#cancel-save-button`, `#save-name-input`,
    `#confirm-load-button`, `#delete-save-button`, `#cancel-load-button`
  - Startup parameter: inline script calls `window.beginGame(params.get('load') === 'true')`.
- `index.html`
  - Button: `#load-button`
  - Inline navigation: `window.location.href = 'game.html?load=true'`.
- `css/components/_modals.css` contains selectors for save/load modal button IDs and status messages.

### Engine / Runtime
- `src/main.js` exports `beginGame(showLoadUI = false)` and calls `gameEngine.showLoadGameUI()` when `showLoadUI` is true.
- `src/bootstrapper/stages/uiStages.js` wires menu buttons to `gameEngine.showSaveGameUI()` and `gameEngine.showLoadGameUI()`.
- `src/engine/gameEngine.js` contains:
  - `triggerManualSave()`, `loadGame()`, `showSaveGameUI()`, `showLoadGameUI()`
  - persistence service availability checks
  - `PersistenceCoordinator` dependency
- `src/engine/persistenceCoordinator.js` orchestrates save/load and dispatches events.
- `src/engine/gameSessionManager.js` contains load-specific behavior (prepare/finalize load, manual save name/path normalization).

### DI / Wiring
- `src/dependencyInjection/registrations/persistenceRegistrations.js` registers the save/load pipeline services.
- `src/dependencyInjection/baseContainerConfig.js` always calls `registerPersistence(container)`.
- `src/dependencyInjection/registrations/uiRegistrations.js` registers `SaveGameUI`, `LoadGameUI`, `SaveGameService`, and wires them with `ISaveLoadService`.
- Tokens implicated:
  - `src/dependencyInjection/tokens/tokens-ui.js`: `SaveGameUI`, `LoadGameUI`, `SaveGameService`, `SaveService`, `LoadService`
  - `src/dependencyInjection/tokens/tokens-core.js`: `ISaveLoadService`, `ISaveFileRepository`, `GamePersistenceService`, etc.

### Save/Load Pipeline
`src/persistence/` (expected to be removed entirely unless strongly justified):
- `gamePersistenceService.js`, `saveLoadService.js`, `saveFileRepository.js`, `saveFileParser.js`, `manualSaveCoordinator.js`, etc.
- supporting helpers/types: `persistenceErrors.js`, `persistenceMessages.js`, `persistenceTypes.js`, checksum/serializer/capture/restorer modules.

### Utilities (Likely Save/Load-Specific)
- `src/utils/savePathUtils.js` (manual save file path/name + constants)
- `src/utils/saveMetadataUtils.js`
- `src/utils/loadSlotUtils.js`
- `src/utils/saveFileReadUtils.js`
- `src/utils/saveStateUtils.js`
- `src/utils/persistenceResultUtils.js`
- `src/utils/persistenceErrorUtils.js`
- `src/constants/persistence.js`
- Save/load-related event IDs in `src/constants/eventIds.js`: `GAME_SAVED_ID`, `REQUEST_SHOW_SAVE_GAME_UI`, `REQUEST_SHOW_LOAD_GAME_UI`, `CANNOT_SAVE_GAME_INFO`

Important coupling note:
- `src/utils/cloneUtils.js` currently imports `../persistence/persistenceErrors.js` and `./persistenceResultUtils.js`.
  - This coupling must be removed if `src/persistence/` is deleted.
  - See “Decoupling & Refactor Requirements” below.

## Removal Checklist (Implementation Plan)

### 1) Remove UI Entry Points
**game.html**
- Remove the **Save Game** and **Load Game** buttons in the “Game Menu” panel.
- Remove the Save/Load modal overlays and all child inputs/buttons/status regions that exist solely for save/load.
- Remove any mention of save/load IDs in the DOM (so UI bootstrapping doesn’t expect them).
- Remove load-on-start URL param behavior:
  - Delete usage of `params.get('load') === 'true'` and call `window.beginGame()` unconditionally (or with only `start` semantics if still needed).

**index.html**
- Remove the **Load Game** button and its navigation handler to `game.html?load=true`.
- Ensure the grid layout still looks correct (likely becomes 1-column or needs a 1-button layout).

**CSS**
- Remove save/load specific rules:
  - selectors for `#confirm-save-button`, `#confirm-load-button`, `#delete-save-button`
  - status message rules tied only to `#save-game-status-message` / `#load-game-status-message`
- Keep generic modal styling used by other modals (e.g. LLM selection modal).

### 2) Remove Bootstrap/Startup Wiring
**`src/main.js`**
- Remove `beginGame(showLoadUI = false)` parameter and all code that calls `gameEngine.showLoadGameUI()`.
- Update any call sites/tests accordingly.

**`src/bootstrapper/stages/uiStages.js`**
- Remove event listener setup for:
  - `#open-save-game-button` → `gameEngine.showSaveGameUI()`
  - `#open-load-game-button` → `gameEngine.showLoadGameUI()`
- Ensure the stage still succeeds and logs meaningfully (may still wire other buttons like LLM prompt debug).

**Auxiliary UI initialization**
- Remove save/load UI initialization helpers:
  - `src/bootstrapper/stages/auxiliary/initSaveGameUI.js`
  - `src/bootstrapper/stages/auxiliary/initLoadGameUI.js`
  - Exports from `src/bootstrapper/stages/auxiliary/index.js`
  - Entries in `src/bootstrapper/stages/initializeAuxiliaryServicesStage.js` for `SaveGameUI` and `LoadGameUI`

### 3) Remove Dom UI Components Related to Save/Load
Delete (or fully remove references + exports) for:
- `src/domUI/saveGameUI.js`
- `src/domUI/loadGameUI.js`
- `src/domUI/saveGameService.js`
- `src/domUI/saveGameTypedefs.js`
- Helpers used only by Save/Load UI:
  - `src/domUI/helpers/renderSlotItem.js`
  - `src/domUI/helpers/slotDataFormatter.js`

Update:
- `src/domUI/domUiFacade.js` to remove `saveGame`/`loadGame` dependencies and accessors.
- `src/domUI/engineUIManager.js` to remove handlers and subscriptions for:
  - `REQUEST_SHOW_SAVE_GAME_UI`
  - `REQUEST_SHOW_LOAD_GAME_UI`
  - `CANNOT_SAVE_GAME_INFO`
- `src/domUI/index.js` to remove exports for `SaveGameUI`, `SaveGameService`, `LoadGameUI`.

Keep but consider cleanup:
- `src/domUI/slotModalBase.js` is also used by `src/domUI/llmSelectionModal.js`; it must remain.
  - Any “save slot” default messages in `SlotModalBase` should be reviewed and generalized if they become misleading post-removal.

### 4) Remove Engine Save/Load Capability
**`src/engine/persistenceCoordinator.js`**
- Delete completely.

**`src/engine/gameEngine.js`**
- Remove:
  - persistence coordinator field, construction, and usage
  - `triggerManualSave()`
  - `loadGame()`
  - `showSaveGameUI()`
  - `showLoadGameUI()`
  - any “ensure persistence service exists” helpers used only by the above
- Remove import of `PersistenceCoordinator` and related event IDs/constants.
- Remove any runtime behavior that tries to reset state as part of loading.

**`src/engine/gameSessionManager.js`**
- Remove load-session operations:
  - `prepareForLoadGameSession()`
  - `finalizeLoadSuccess()` and any related private helpers
  - manual-save name/path normalization and save-directory constants usage
- After removal, the class should focus on “start new game” session lifecycle only.
  - If the class becomes mostly load-centric, consider deleting it and inlining/relocating the remaining start-session responsibilities.

### 5) Remove Adapters & Interfaces for Save/Load
Delete:
- `src/adapters/GameEngineSaveAdapter.js`
- `src/adapters/GameEngineLoadAdapter.js`

Delete interfaces that exist solely for save/load:
- `src/interfaces/IGamePersistenceService.js`
- `src/interfaces/ISaveLoadService.js`
- `src/interfaces/ISaveFileRepository.js`
- `src/interfaces/ISaveService.js`

### 6) Remove DI Registrations for Save/Load, Preserve Required Non-Save Dependencies
**Primary**
- Remove `src/dependencyInjection/registrations/persistenceRegistrations.js` (or reduce to a no-op and delete later).
- Remove `registerPersistence` import + invocation from `src/dependencyInjection/baseContainerConfig.js`.

**Critical dependency preservation**
`registerPersistence` currently registers dependencies that may also be used outside game save/load:
- `tokens.IStorageProvider` → `BrowserStorageProvider`
  - Required by action tracing (`src/dependencyInjection/registrations/actionTracingRegistrations.js`).
- `tokens.PlaytimeTracker` → `PlaytimeTracker`
  - Required by `GameEngine` and `GameSessionManager`.

Therefore:
- Move `IStorageProvider` and `PlaytimeTracker` registration to an appropriate non-persistence registration bundle (e.g. `infrastructureRegistrations.js` or a new `storageRegistrations.js`).
- Ensure `configureBaseContainer()` still registers these unconditionally when needed.

**UI registrations**
- Remove Save/Load UI registrations from `src/dependencyInjection/registrations/uiRegistrations.js`:
  - `tokens.SaveGameService`
  - `tokens.SaveGameUI`
  - `tokens.LoadGameUI`
  - any implicit dependency on `tokens.ISaveLoadService`

**Token cleanup**
- Remove save/load tokens from:
  - `src/dependencyInjection/tokens/tokens-ui.js`: `SaveGameService`, `SaveGameUI`, `LoadGameUI`, `SaveService`, `LoadService`
  - `src/dependencyInjection/tokens/tokens-core.js`: `ISaveLoadService`, `ISaveFileRepository`, and any persistence-only service tokens (`GamePersistenceService`, `ManualSaveCoordinator`, etc.)

### 7) Purge `src/persistence/` (Expected Full Deletion)
Delete the entire `src/persistence/` directory.

If any code remains in `src/persistence/`, it must be justified with:
- A clear statement of what feature depends on it that is *not* game save/load.
- Proof (via imports/callers) that the dependency is real and not legacy.
- A rationale why it should not be moved to a more appropriate location (e.g. `src/utils/`).

### 8) Clean Up Save/Load-Specific Constants and Utilities
Remove:
- `src/constants/persistence.js`
- save/load event IDs in `src/constants/eventIds.js`:
  - `GAME_SAVED_ID`
  - `REQUEST_SHOW_SAVE_GAME_UI`
  - `REQUEST_SHOW_LOAD_GAME_UI`
  - `CANNOT_SAVE_GAME_INFO`
- save/load path and metadata utilities:
  - `src/utils/savePathUtils.js`
  - `src/utils/saveMetadataUtils.js`
  - `src/utils/loadSlotUtils.js`
  - `src/utils/saveFileReadUtils.js`

Potentially remove or refactor (depending on other consumers):
- `src/utils/persistenceResultUtils.js`
- `src/utils/persistenceErrorUtils.js`
- `src/utils/saveStateUtils.js`

## Decoupling & Refactor Requirements (To Avoid Leaving a “Persistence Skeleton”)
Because `src/utils/cloneUtils.js` currently depends on persistence-domain types and error codes, a full purge requires one of:

**Option A (preferred): Introduce a generic result type**
- Create a non-persistence result helper in `src/utils/` (e.g. `resultUtils.js`) with:
  - `createSuccess(data)`
  - `createFailure({ code, message, details? })`
- Update `cloneUtils.safeDeepClone()` to return the generic result.
- Move or replace `PersistenceErrorCodes.DEEP_CLONE_FAILED` with a non-persistence error code namespace (e.g. `CloneErrorCodes`).
- Delete persistence-specific result/error utilities after consumers migrate.

**Option B: Make `safeDeepClone` throw and simplify**
- Replace `safeDeepClone` with an exception-based API and update callers.
- Delete persistence result utils and error utils if no longer needed.

Acceptance requirement here: after the purge, **no general-purpose utility (like cloning/freezing) should import from `src/persistence/`**.

## Tests: Removal & Adjustments
All tests whose purpose is to validate save/load persistence must be removed.

### Delete Entire Suites (High Confidence)
- `tests/integration/persistence/`
- `tests/unit/persistence/`
- `tests/integration/saveLoadRoundTrip.integration.test.js`
- `tests/integration/stateFidelityAfterLoad.integration.test.js`
- Engine persistence tests:
  - `tests/unit/engine/persistenceCoordinator.test.js`
  - `tests/unit/engine/triggerManualSave.test.js`
  - `tests/unit/engine/showSaveGameUI.test.js`
  - `tests/unit/engine/showLoadGameUI.test.js`
- UI save/load tests:
  - `tests/unit/domUI/saveGameUI*`
  - `tests/unit/domUI/loadGameUI*`
  - `tests/integration/domUI/loadGameUI.realModules.integration.test.js`
  - `tests/integration/domUI/slotListManager.test.js`
  - Any integration tests focusing on save slot formatting/helpers.
- Adapter tests for save/load engine adapters:
  - `tests/unit/adapters/*SaveAdapter*`
  - `tests/unit/adapters/*LoadAdapter*`
  - `tests/integration/adapters/*SaveAdapter*`
  - `tests/integration/adapters/*LoadAdapter*`
- DI tests for persistence registrations:
  - `tests/unit/dependencyInjection/registrations/persistenceRegistrations.test.js`
  - Any UI registration tests whose primary assertions are about `SaveGameUI`/`LoadGameUI` registration.

### Update or Remove Mixed-Purpose Test Utilities
Some shared helpers mix save/load assertions with other engine behaviors:
- `tests/common/engine/dispatchTestUtils.js` currently imports save/load event IDs and provides save/load dispatch builders.
  - Remove save/load-specific helpers and imports; keep unrelated dispatch helpers (stop, entity lifecycle, etc.) if still used.
- `tests/common/engine/unavailableMessages.js` includes save/load “unavailable” strings and non-save strings (e.g. playtime tracker).
  - Remove only save/load-related constants; preserve any still-used constants.

### Main/bootstrap tests
Many `main` bootstrap tests currently assert “load UI opens on startup” via `beginGame(showLoadUI)` and `showLoadGameUI` mocks.
- Remove or rewrite those cases so they validate only supported behavior post-purge.
- Any tests that exist solely to cover `showLoadUI` should be removed.

### GameSessionManager tests
If load-session logic is removed from `GameSessionManager`, tests that validate manual save path parsing and load preparation must be removed.
Keep or update tests that validate start-session behavior (if still present).

## Verification / Acceptance Criteria
The implementation is complete when all of the following are true:
- `game.html` has no Save/Load buttons or save/load modals, and no URL param `load=true` behavior.
- `index.html` has no “Load Game” button and no navigation that triggers load UI.
- No code path calls or defines:
  - `showSaveGameUI`, `showLoadGameUI`, `triggerManualSave`, `loadGame`, `PersistenceCoordinator`, `GamePersistenceService`, `ISaveLoadService`, etc.
- `src/persistence/` does not exist, or any remaining file(s) have a documented, non-save/load justification and an explicit rationale for why they remain.
- `rg -n \"Save Game|Load Game|manual_save|saveLoadService|PersistenceCoordinator|ISaveLoadService\" src tests` returns no relevant hits (ignoring unrelated “persistence” in other domains).
- All save/load persistence tests are deleted; the remaining test suite compiles without importing removed modules.
- Build and lint expectations remain satisfied after removing dead code paths:
  - `npm run build`
  - targeted lint on touched files
  - at least one relevant Jest suite runs cleanly (exact command chosen during implementation).

## Risks / Notes
- `IStorageProvider` registration must not be accidentally removed because action tracing depends on it.
- `SlotModalBase` is shared with LLM selection; removing save/load UI must not break LLM selection modal behavior.
- Clone/persistence result utilities are currently entangled; the refactor described above is mandatory to avoid leaving a “persistence” dependency skeleton behind.

