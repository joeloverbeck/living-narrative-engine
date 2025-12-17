# REMGAMSAVLOAPER-007: Remove Save/Load Adapters, Interfaces, and DI Tokens

**Status**: Completed
**Priority**: HIGH
**Effort**: Medium

## Summary
Remove adapter layer and interfaces that exist solely for game save/load, and clean up DI tokens that expose them.

## Reassessed File list (verified against codebase)
- Delete:
  - `src/adapters/GameEngineSaveAdapter.js` ✅ exists
  - `src/adapters/GameEngineLoadAdapter.js` ✅ exists
  - `src/interfaces/IGamePersistenceService.js` ✅ exists
  - `src/interfaces/ISaveLoadService.js` ✅ exists
  - `src/interfaces/ISaveFileRepository.js` ✅ exists
  - `src/interfaces/ISaveService.js` ✅ exists
  - `src/interfaces/ILoadService.js` ✅ exists (additional discovery)
- Update:
  - `src/dependencyInjection/tokens/tokens-ui.js` - remove: `SaveGameService`, `SaveService`, `SaveGameUI`, `LoadService`, `LoadGameUI`
  - `src/dependencyInjection/tokens/tokens-core.js` - remove: `SaveFileRepository`, `SaveMetadataBuilder`, `ActiveModsManifestBuilder`, `GameStateCaptureService`, `ManualSaveCoordinator`, `GamePersistenceService`, `ISaveFileRepository`, `ISaveLoadService`
  - ~~`src/dependencyInjection/registrations/uiRegistrations.js`~~ - **NO CHANGES NEEDED** (verified: already clean of save/load registrations)
- Tests (deletions):
  - `tests/unit/adapters/gameEngineSaveAdapter.*.test.js` (4 files)
  - `tests/unit/adapters/gameEngineLoadAdapter.*.test.js` (16 files)
  - `tests/unit/adapters/gameEngineAdapters.*.test.js` (8 files)
  - `tests/integration/adapters/GameEngineSaveAdapter.fullstack.integration.test.js`
  - `tests/integration/adapters/GameEngineLoadAdapter.*.integration.test.js` (3 files)
  - `tests/integration/adapters/GameEngineAdapters.integration.test.js`

## Original ticket assumptions corrected
1. **uiRegistrations.js**: Originally expected to remove save/load UI registrations - verified this file is already clean (no save/load coupling present)
2. **ILoadService.js**: Not listed in original ticket but exists and should be deleted
3. **Tests**: Many more test files exist than originally anticipated

## Out of scope (must NOT change)
- Non-save/load adapters and interfaces (e.g., `DefaultComponentPolicy.js`, `InMemoryEntityRepository.js`, `fnLoadOrderResolverAdapter.js`, `LodashCloner.js`, `UuidGenerator.js`)
- Any action tracing DI tokens and registrations
- Browser storage provider interfaces (`src/interfaces/IStorageProvider.js`) and its usage
- `IDataRegistry` and other non-persistence interfaces

## Acceptance criteria
### Specific tests that must pass
- `npm run test:unit -- --runInBand tests/unit/dependencyInjection/registrations/uiRegistrations.registerRenderers.test.js`
- `npm run test:unit -- --runInBand tests/unit/dependencyInjection/registrations/uiRegistrations.registerFacadeAndManager.test.js`
- `npm run test:unit -- --runInBand tests/unit/adapters` (remaining non-save/load adapter tests)
- `npm run test:integration -- --runInBand tests/integration/adapters` (remaining non-save/load adapter tests)

### Invariants that must remain true
- No token module exports save/load-related identifiers:
  - No `ISaveLoadService`, `ISaveFileRepository`, `GamePersistenceService`, `ManualSaveCoordinator`, `SaveGameUI`, `LoadGameUI`, etc.
- UI registration does not require `ISaveLoadService` to construct unrelated UI services (already true)
- Non-save/load adapters and tests remain functional

## Outcome

### Files Deleted
- `src/adapters/GameEngineSaveAdapter.js`
- `src/adapters/GameEngineLoadAdapter.js`
- `src/interfaces/IGamePersistenceService.js`
- `src/interfaces/ISaveLoadService.js`
- `src/interfaces/ISaveFileRepository.js`
- `src/interfaces/ISaveService.js`
- `src/interfaces/ILoadService.js`
- `tests/unit/adapters/gameEngineSaveAdapter.*.test.js` (4 files)
- `tests/unit/adapters/gameEngineLoadAdapter.*.test.js` (16 files)
- `tests/unit/adapters/GameEngineLoadAdapter.test.js`
- `tests/unit/adapters/gameEngineAdapters.*.test.js` (8 files)
- `tests/unit/adapters/gameEngineAdapters.test.js` (additional discovery during test run)
- `tests/integration/adapters/GameEngineSaveAdapter.*.test.js`
- `tests/integration/adapters/GameEngineLoadAdapter.*.test.js` (3 files)
- `tests/integration/adapters/GameEngineAdapters.*.test.js`

### Files Modified
- `src/dependencyInjection/tokens/tokens-ui.js` - Removed: `SaveGameService`, `SaveService`, `SaveGameUI`, `LoadService`, `LoadGameUI`
- `src/dependencyInjection/tokens/tokens-core.js` - Removed: `SaveFileRepository`, `SaveMetadataBuilder`, `ActiveModsManifestBuilder`, `GameStateCaptureService`, `ManualSaveCoordinator`, `GamePersistenceService`, `ISaveFileRepository`, `ISaveLoadService`

### Test Results
All acceptance criteria tests pass:
- ✅ `uiRegistrations.registerRenderers.test.js` - 19 tests passed
- ✅ `uiRegistrations.registerFacadeAndManager.test.js` - 17 tests passed
- ✅ `tests/unit/adapters` - 10 suites, 27 tests passed
- ✅ `tests/integration/adapters` - 3 suites, 10 tests passed

### Invariants Verified
- ✅ No save/load tokens remain in `tokens-ui.js` or `tokens-core.js`
- ✅ Non-save/load adapters remain functional (DefaultComponentPolicy, InMemoryEntityRepository, fnLoadOrderResolverAdapter)
- ✅ `uiRegistrations.js` was already clean - no changes needed

### Additional Notes
- Discovered `ILoadService.js` interface not in original ticket but deleted as it was save/load related
- Found `gameEngineAdapters.test.js` test file during test run that was missed in initial deletion pass
- `uiRegistrations.js` required no changes - already decoupled from save/load concerns

