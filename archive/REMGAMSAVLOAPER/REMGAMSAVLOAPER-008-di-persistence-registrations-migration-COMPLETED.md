# REMGAMSAVLOAPER-008: Remove `registerPersistence` Wiring; Preserve `IStorageProvider` + `PlaytimeTracker`

**Status**: COMPLETED
**Priority**: CRITICAL
**Effort**: Medium

## Summary
Stop registering game save/load persistence services via DI, while preserving non-save dependencies currently registered there:
- Move `tokens.IStorageProvider → BrowserStorageProvider` registration out of `persistenceRegistrations.js`
- Move `tokens.PlaytimeTracker → PlaytimeTracker` registration out of `persistenceRegistrations.js`
- Remove `registerPersistence(container)` call from `src/dependencyInjection/baseContainerConfig.js`

This ticket should *not* delete `src/persistence/` yet (that happens in `REMGAMSAVLOAPER-009`), but it should ensure the container still starts and action tracing continues to have a storage provider.

## Assumption Corrections (Post-Assessment)

**Original Assumption**: `actionTracingRegistrations.js` may need modification if it assumes persistence provides `IStorageProvider`.

**Actual State**: `actionTracingRegistrations.js` (line 82) **does** depend on `tokens.IStorageProvider` for `TraceDirectoryManager`. However, in the current registration order in `baseContainerConfig.js`:
1. `registerInfrastructure` runs at line 77
2. `registerActionTracing` runs at line 86
3. `registerPersistence` runs at line 97

Since DI containers use lazy resolution (resolution at `resolve()` time, not registration time), this ordering **does not** cause runtime issues. However, moving `IStorageProvider` to `infrastructureRegistrations.js` ensures proper dependency ordering semantics and eliminates the dependency on `persistenceRegistrations.js` entirely.

**Key Finding**: `persistenceRegistrations.js` registers 10 services:
- `IStorageProvider` (needed by action tracing - **keep**)
- `PlaytimeTracker` (needed by non-save code - **keep**)
- `ISaveFileRepository` (save/load only - **remove**)
- `ISaveLoadService` (save/load only - **remove**)
- `ComponentCleaningService` (save/load only - **remove**)
- `SaveMetadataBuilder` (save/load only - **remove**)
- `ActiveModsManifestBuilder` (save/load only - **remove**)
- `GameStateCaptureService` (save/load only - **remove**)
- `ManualSaveCoordinator` (save/load only - **remove**)
- `GamePersistenceService` (save/load only - **remove**)

## Revised File list
- `src/dependencyInjection/baseContainerConfig.js` - remove import and call to `registerPersistence`
- `src/dependencyInjection/registrations/persistenceRegistrations.js` - **delete entirely** (all remaining services are save/load-only)
- `src/dependencyInjection/registrations/infrastructureRegistrations.js` - add `IStorageProvider` + `PlaytimeTracker` registrations
- `tests/unit/dependencyInjection/registrations/persistenceRegistrations.test.js` - **delete entirely**
- `tests/unit/dependencyInjection/registrations/infrastructureRegistrations.test.js` - **create** to verify `IStorageProvider` + `PlaytimeTracker` registration

## Out of scope (must NOT change)
- Implementation of `BrowserStorageProvider` itself.
- Action tracing feature behavior and exported trace file formats.
- Any remaining `src/persistence/` code (delete only in `REMGAMSAVLOAPER-009`).

## Acceptance criteria
### Specific tests that must pass
- `npm run test:unit -- --runInBand tests/unit/services/browserStorageProvider.test.js`
- `npm run test:unit -- --runInBand tests/unit/dependencyInjection/registrations/infrastructureRegistrations.test.js`
- `npm run test:integration -- --runInBand tests/integration/runtime/mainBootstrapFlow.integration.test.js`

### Invariants that must remain true
- `tokens.IStorageProvider` is registered in the base container in all supported runtime modes.
- `tokens.PlaytimeTracker` is registered and still usable by non-save/load code paths.
- No DI registration remains whose sole purpose is game save/load persistence.

## Outcome

**Completion Date**: 2025-12-17

### Changes Made

**Source Files Modified:**
1. `src/dependencyInjection/baseContainerConfig.js` - Removed import and call to `registerPersistence`
2. `src/dependencyInjection/registrations/infrastructureRegistrations.js` - Added `IStorageProvider` (BrowserStorageProvider) and `PlaytimeTracker` registrations

**Source Files Deleted:**
3. `src/dependencyInjection/registrations/persistenceRegistrations.js` - Entirely removed (all 8 save/load-only services removed)

**Test Files Created:**
4. `tests/unit/dependencyInjection/registrations/infrastructureRegistrations.test.js` - New tests verifying `IStorageProvider` and `PlaytimeTracker` singleton registration, resolution, dependency injection, and logging (9 tests)

**Test Files Deleted:**
5. `tests/unit/dependencyInjection/registrations/persistenceRegistrations.test.js` - Removed with source file

**Test Files Fixed (cleanup from deleted references):**
6. `tests/unit/dependencyInjection/baseContainerConfig.errorHandling.test.js` - Removed `registerPersistence` from `registrationModulePaths` and `failureScenarios`
7. `tests/unit/dependencyInjection/containerConfig.test.js` - Removed `persistenceRegistrations.js` mock and import; moved `IDataRegistry` mock to `registerLoaders` (where it's actually registered)

### Test Results
All acceptance criteria tests passed:
- `browserStorageProvider.test.js`: 8/8 passed ✓
- `infrastructureRegistrations.test.js`: 9/9 passed ✓
- `mainBootstrapFlow.integration.test.js`: 6/6 passed ✓
- Full DI unit test suite: 385/385 passed ✓

### Invariants Verified
- ✓ `tokens.IStorageProvider` is registered in the base container (via `infrastructureRegistrations.js`)
- ✓ `tokens.PlaytimeTracker` is registered and usable by non-save/load code paths
- ✓ No DI registration remains whose sole purpose is game save/load persistence

