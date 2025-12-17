# REMGAMSAVLOAPER-009: Purge `src/persistence/`, Save/Load Utilities/Constants, and Persistence Test Suites

**Status**: ✅ Completed
**Priority**: CRITICAL
**Effort**: Large (mostly deletions; keep diff reviewable by batching logically)

## Summary
Complete the full purge:
- Delete the entire `src/persistence/` directory
- Remove save/load-specific utilities and constants
- Remove tests that exist primarily for save/load persistence
- Ensure no general-purpose utilities import from `src/persistence/` (fix `cloneUtils` coupling)

## Reassessed Assumptions (Corrected 2024-12-17)

The original ticket assumed certain files existed that had already been deleted or never existed. Below is the **corrected** file list based on actual codebase inspection:

### Files That Actually Exist (to be deleted)

**Source Code:**
- `src/persistence/` directory (all 21 files)
- `src/constants/persistence.js`
- `src/utils/savePathUtils.js`
- `src/utils/saveMetadataUtils.js`
- `src/utils/saveFileReadUtils.js`
- `src/utils/saveStateUtils.js`
- `src/utils/persistenceResultUtils.js`
- `src/utils/persistenceErrorUtils.js`

**Tests (unit):**
- `tests/unit/persistence/` directory (all 13 files)
- `tests/unit/utils/savePathUtils.test.js`
- `tests/unit/utils/saveMetadataUtils.test.js`
- `tests/unit/utils/saveFileReadUtils.test.js`
- `tests/unit/utils/saveStateUtils.test.js`
- `tests/unit/utils/persistenceResultUtils.test.js`
- `tests/unit/utils/persistenceErrorUtils.test.js`
- `tests/unit/utils/saveInputValidators.test.js`
- `tests/unit/utils/cloneUtils.additionalCoverage.test.js` (uses safeDeepClone from persistence)
- `tests/unit/services/gamePersistenceService*.test.js` (5 files)
- `tests/unit/services/gameStateCaptureService*.test.js` (2 files)
- `tests/unit/services/gameStateRestorer.test.js`
- `tests/unit/services/gameStateSerializer.test.js`
- `tests/unit/services/manualSaveCoordinator.test.js`
- `tests/unit/services/saveLoadService*.test.js` (6 files)
- `tests/unit/services/saveMetadataBuilder.test.js`
- `tests/unit/services/saveValidationService.test.js`
- `tests/unit/services/componentCleaningService.test.js`
- `tests/unit/services/activeModsManifestBuilder.test.js`

**Tests (integration):**
- `tests/integration/persistence/` directory (all 9 files)
- `tests/integration/saveLoadRoundTrip.integration.test.js`
- `tests/integration/stateFidelityAfterLoad.integration.test.js`
- `tests/integration/utils/cloneUtils.integration.test.js` (uses safeDeepClone)
- `tests/integration/utils/saveMetadataUtils.integration.test.js`
- `tests/integration/utils/saveStateUtils.integration.test.js`

### Files That Did NOT Exist (originally listed but already deleted)
- `src/utils/loadSlotUtils.js` - Already deleted in previous ticket
- `tests/unit/utils/loadSlotUtils.test.js` - Already deleted
- `tests/unit/utils/compareLoadSlots.test.js` - Already deleted
- `tests/unit/dependencyInjection/registrations/persistenceRegistrations.test.js` - Already deleted

### Files That Must Be Modified (not deleted)
- `src/utils/cloneUtils.js` - Remove imports from `../persistence/**` and delete `safeDeepClone` function
- `tests/unit/utils/cloneUtils.test.js` - Remove tests for `safeDeepClone`
- `tests/unit/utils/mouthEngagementUtils.cloneFallback.test.js` - Verify it doesn't use persistence

### Files Already Clean (no changes needed)
- `src/utils/index.js` - Only re-exports from `cloneUtils.js` (general exports, not persistence-specific)
- `tests/common/engine/dispatchTestUtils.js` - Already cleaned (no save/load helpers)
- `tests/common/engine/unavailableMessages.js` - Already cleaned (only non-save/load messages)
- `tests/common/constants.js` - No save/load constants

## Out of scope (must NOT change)
- LLM selection persistence (`src/llms/services/llmSelectionPersistence.js`) and its tests.
- Anatomy "persistence" services or entity/component write semantics.
- Action tracing persistence and export behavior (only remove things directly coupled to save/load game state).

## Acceptance criteria
### Specific tests that must pass
- `npm run test:unit -- --runInBand tests/unit/services/browserStorageProvider.test.js`
- `npm run test:unit -- --runInBand tests/unit/domUI/slotModalBase.test.js`
- `npm run test:unit -- --runInBand tests/unit/engine`
- `npm run test:integration -- --runInBand tests/integration/runtime/mainBootstrapFlow.integration.test.js`
- `npm run test:integration -- --runInBand tests/integration/indexLLMSelector.integration.test.js`

### Invariants that must remain true
- `src/persistence/` does not exist after this ticket.
- No general-purpose utility imports from `src/persistence/`:
  - In particular, `src/utils/cloneUtils.js` must not import `../persistence/**`.
- `rg -n "Save Game|Load Game|manual_save|saveLoadService|PersistenceCoordinator|ISaveLoadService" src tests` returns no relevant hits (excluding unrelated "persistence" in other domains).
- `tokens.IStorageProvider` and `tokens.PlaytimeTracker` remain registered and functional (validated by existing storage provider tests and bootstrapping integration tests).

## Outcome (2025-12-17)

### What was actually changed vs originally planned

**Originally Planned:**
The ticket assumed all files in the "Files That Actually Exist" section needed deletion, plus modifications to `cloneUtils.js` to remove persistence coupling.

**Actual Changes:**

1. **Files Deleted (as planned):**
   - `src/persistence/` directory (21 files)
   - `src/constants/persistence.js`
   - `src/utils/savePathUtils.js`, `saveMetadataUtils.js`, `saveFileReadUtils.js`, `saveStateUtils.js`, `persistenceResultUtils.js`, `persistenceErrorUtils.js`
   - `tests/unit/persistence/` directory (13 files)
   - `tests/integration/persistence/` directory (9 files)
   - All persistence-related service tests and utility tests

2. **Files Modified:**
   - `src/utils/cloneUtils.js` - Removed `safeDeepClone` function and all persistence imports. The function was only used by persistence code, so complete removal was appropriate.

3. **Files Already Clean (no action needed):**
   - `tests/common/engine/dispatchTestUtils.js` - Already cleaned in previous tickets
   - `tests/common/engine/unavailableMessages.js` - Already cleaned
   - `tests/common/constants.js` - No save/load constants

4. **Discrepancies from original ticket:**
   - Several files listed in the original ticket had already been deleted in earlier tickets (REMGAMSAVLOAPER-001 through 008)
   - The ticket was corrected with "Reassessed Assumptions" section documenting what actually existed

**All acceptance tests pass:**
- ✅ browserStorageProvider.test.js (8 tests)
- ✅ slotModalBase.test.js (56 tests)
- ✅ engine unit tests (89 tests)
- ✅ mainBootstrapFlow.integration.test.js (6 tests)
- ✅ indexLLMSelector.integration.test.js (3 tests)

