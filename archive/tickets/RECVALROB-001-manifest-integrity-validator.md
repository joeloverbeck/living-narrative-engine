# Manifest Integrity Validator

## Status: COMPLETED

## Outcome

**Implementation completed successfully.** All acceptance criteria met.

### Changes Made

1. **Extended `ManifestFileExistenceValidator`** (`cli/validation/manifestFileExistenceValidator.js`):
   - Added `validateUnregisteredFiles(modId, manifest)` - validates disk → manifest
   - Added `validateAllModsUnregistered(manifests)` - batch validation
   - Added `generateUnregisteredReport(results)` - human-readable report
   - Added content category definitions with proper file patterns (actions, scopes, tasks, portraits, etc.)
   - Added file exclusion logic (`.DS_Store`, `Thumbs.db`, `.gitkeep`, backup files)

2. **Added Phase 6 to Orchestrator** (`cli/validation/modValidationOrchestrator.js`):
   - Unregistered files validation runs after file existence validation
   - Warnings (not errors) for unregistered files found
   - Performance timing tracked

3. **Unit Tests** (`tests/unit/validation/manifestFileExistenceValidator.unregistered.test.js`):
   - 22 tests covering all edge cases
   - Tests graceful handling of null/undefined manifests
   - Tests empty content sections and non-existent directories
   - Tests report generation for success and failure cases
   - Tests constructor validation

4. **Integration Tests** (`tests/integration/validation/manifestFileExistence.integration.test.js`):
   - Extended with unregistered files detection
   - Tests system file ignoring

### Test Results

- **Unit Tests**: 22/22 passed
- **Integration Tests**: 4/4 passed

### Detected Unregistered Files (informational)

The validation found 3 unregistered files in the codebase:

- `anatomy/lookups/part_health_thresholds.json`
- `descriptors/components/plumage_sheen.component.json`
- `metabolism/lookups/hunger_thresholds.json`

These are warnings only and do not fail validation.

---

## Corrected Assumptions

**Original assumptions were incorrect.** After codebase analysis:

1. **No new file needed** - `ManifestFileExistenceValidator` already exists at `cli/validation/manifestFileExistenceValidator.js`
2. **Extend existing class** - Add inverse check (disk → manifest) to complement existing (manifest → disk) check
3. **No DI changes needed** - Validator already instantiated in orchestrator constructor
4. **Test file path corrected** - Uses existing validator test structure

## Files Modified

- `cli/validation/manifestFileExistenceValidator.js` (Extended with `validateUnregisteredFiles` method)
- `cli/validation/modValidationOrchestrator.js` (Added Phase 6 for unregistered files validation)
- `tests/unit/validation/manifestFileExistenceValidator.unregistered.test.js` (New unit test file)
- `tests/integration/validation/manifestFileExistence.integration.test.js` (Extended with unregistered file tests)

## Out of Scope

- Fixing existing manifest violations.
- Changing `ModLoader`.
- Modifying `mod-manifest.json` files.
- Creating new DI tokens or registrations.

## Acceptance Criteria

### Specific Tests

- **Unit Test (`tests/unit/cli/validation/manifestFileExistenceValidator.unregistered.test.js`):**
  - Mock file system with a file in `data/mods/testmod/actions/` that is NOT in `mod-manifest.json`.
  - Verify validator returns an error/warning for that file.
  - Mock file system where all files are registered. Verify validator passes.
  - Verify exclusions (`.DS_Store`, `thumbs.db`) are ignored.
- **Integration Test (extend `manifestFileExistence.integration.test.js`):**
  - Run validation via orchestrator.
  - Verify command output includes unregistered file detection.

### Invariants

- Validator must not crash if `mod-manifest.json` is missing.
- Validator must only check `data/mods` directory.
- Validator must respect `exclusions` (like `.DS_Store`, `thumbs.db`, `.gitkeep`, etc.).
- Existing `validateMod()` behavior must remain unchanged (backward compatible).

## Content Categories to Scan

Based on `mod-manifest.schema.json`:

- `actions/`, `components/`, `conditions/`, `damageTypes/`, `events/`, `goals/`, `macros/`, `rules/`, `worlds/`
- `blueprints/`, `recipes/`, `anatomyFormatting/`, `libraries/`, `lookups/`, `parts/`, `structure-templates/`
- `scopes/` (\*.scope files)
- `entities/definitions/`, `entities/instances/`
- `refinement-methods/` (\*.refinement.json)
- `tasks/` (\*.task.json)
- `portraits/` (image files)
