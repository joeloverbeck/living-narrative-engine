# REMGAMSAVLOAPER-006: Remove Engine Save/Load APIs and `PersistenceCoordinator`

**Status**: COMPLETED
**Priority**: HIGH
**Effort**: Medium
**Completed**: 2025-12-17

## Summary
Remove engine runtime capabilities for manual save/load:
- Delete `src/engine/persistenceCoordinator.js`
- Remove save/load methods from `src/engine/gameEngine.js`:
  - `triggerManualSave`
  - `loadGame`
  - `showSaveGameUI`
  - `showLoadGameUI`
- Remove load-session logic from `src/engine/gameSessionManager.js` (prepare/finalize load, save path normalization, etc.)

Update/remove tests that validate those APIs.

## File list it expects to touch

### Source files to delete
- `src/engine/persistenceCoordinator.js`

### Source files to update
- `src/engine/gameEngine.js` - remove save/load methods and PersistenceCoordinator import
- `src/engine/gameSessionManager.js` - remove load-session logic (prepareForLoadGameSession, finalizeLoadSuccess)
- `src/constants/eventIds.js` - remove save/load event IDs:
  - `GAME_SAVED_ID`
  - `REQUEST_SHOW_SAVE_GAME_UI`
  - `REQUEST_SHOW_LOAD_GAME_UI`
  - `CANNOT_SAVE_GAME_INFO`
- `src/dependencyInjection/tokens/tokens-core.js` - remove `PersistenceCoordinator` token

### Test helper files to update
- `tests/common/engine/dispatchTestUtils.js` - remove save/load dispatch asserters/builders and related imports
- `tests/common/engine/unavailableMessages.js` - remove save/load messages only
- `tests/common/engine/engineTestTypedefs.js` - remove save/load type imports if present (verified: no changes needed)

### Test files to delete
- `tests/unit/engine/persistenceCoordinator.test.js`
- `tests/unit/engine/triggerManualSave.test.js`
- `tests/unit/engine/showSaveGameUI.test.js`
- `tests/unit/engine/showLoadGameUI.test.js`
- `tests/integration/persistence/persistenceCoordinator.integration.test.js`
- `tests/integration/engine/loadGame.test.js`

## Out of scope (must NOT change)
- Action tracing persistence concepts and storage provider behavior (not game save/load).
- LLM selection persistence and any other localStorage-only UI preferences.
- Turn/order logic unrelated to load-session behavior.
- `tests/e2e/actions/ActionPersistenceIntegration.simple.e2e.test.js` - uses `triggerManualSave` term but is about action tracing, not game save/load.
- Files in `tests/unit/adapters/` and `tests/integration/adapters/` - these are part of REMGAMSAVLOAPER-007/009.
- Files in `tests/unit/services/` and `tests/integration/persistence/` (other than persistenceCoordinator) - these are part of REMGAMSAVLOAPER-009.
- Files in `tests/unit/main/` and `tests/integration/app/` - these have save/load references but are testing main.js bootstrap which is covered by other tickets.

## Acceptance criteria
### Specific tests that must pass
- `npm run test:unit -- --runInBand tests/unit/engine`
- `npm run test:unit -- --runInBand tests/unit/services/thoughtPersistenceHook.test.js` (guards against accidentally breaking other "persistence"-named features)
- `npm run test:unit -- --runInBand tests/unit/constants/eventIds.test.js` (verify event ID exports still work)

### Invariants that must remain true
- No production code references `PersistenceCoordinator`.
- `GameEngine` exposes only "start new game" flows (no save/load UI requests, no load state resets).
- `GameSessionManager` contains no load-session behavior; it remains responsible only for new-game lifecycle work (or is deleted/refactored cleanly if mostly load-centric).

## Completion Summary

### Source files deleted
- ✅ `src/engine/persistenceCoordinator.js`

### Source files updated
- ✅ `src/engine/gameEngine.js` - removed `saveGame`, `loadGame`, `showSaveGameUI`, `showLoadGameUI` methods and all PersistenceCoordinator references; added missing `createSafeErrorLogger` import
- ✅ `src/engine/gameSessionManager.js` - removed `prepareForLoadGameSession`, `finalizeLoadSuccess`, and all load-session logic
- ✅ `src/constants/eventIds.js` - removed `GAME_SAVED_ID`, `REQUEST_SHOW_SAVE_GAME_UI`, `REQUEST_SHOW_LOAD_GAME_UI`, `CANNOT_SAVE_GAME_INFO`
- ✅ `src/dependencyInjection/tokens/tokens-core.js` - removed `PersistenceCoordinator` token

### Test helper files updated
- ✅ `tests/common/engine/dispatchTestUtils.js` - removed save/load dispatch asserters and related imports
- ✅ `tests/common/engine/unavailableMessages.js` - removed save/load messages

### Test files deleted
- ✅ `tests/unit/engine/persistenceCoordinator.test.js`
- ✅ `tests/unit/engine/triggerManualSave.test.js`
- ✅ `tests/unit/engine/showSaveGameUI.test.js`
- ✅ `tests/unit/engine/showLoadGameUI.test.js`
- ✅ `tests/integration/persistence/persistenceCoordinator.integration.test.js`
- ✅ `tests/integration/engine/loadGame.test.js`

### Test files updated (load-session tests removed)
- ✅ `tests/unit/engine/gameEngine.branchCoverage.test.js` - removed load failure delegation test
- ✅ `tests/unit/engine/gameEngine.errorRecovery.coverage.test.js` - removed handleLoadFailure tests
- ✅ `tests/unit/engine/gameSessionManager.edge-cases.test.js` - removed all load-session tests

### Verification
- ✅ All 89 engine unit tests pass
- ✅ All 23 dispatch test utils tests pass
- ✅ ESLint: no errors (only pre-existing JSDoc warnings)

