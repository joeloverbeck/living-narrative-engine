# MODMANIMP-020: Conflict Detection

**Status:** Completed
**Priority:** Phase 6 (Features)
**Estimated Effort:** S (2-3 hours)
**Dependencies:** MODMANIMP-018 (Mod Activation), MODMANIMP-014 (ModCardComponent)
**Completed:** 2025-12-17

---

## Outcome

### Summary

Successfully implemented mod conflict detection with the following deliverables:

1. **ConflictDetector class** (`src/modManager/logic/ConflictDetector.js`)
   - Detects declared conflicts from mod manifests
   - Detects version-based conflicts (exact, wildcard `1.x`, range `>=2.0`, `<=2.0`)
   - Deduplicates bidirectional conflicts (A-B and B-A treated as same)
   - Provides human-readable conflict warnings

2. **Controller integration** (`src/modManager/controllers/ModManagerController.js`)
   - Added optional `conflictDetector` dependency injection
   - Conflict check runs BEFORE activation attempt in `#activateMod()`
   - Added public `checkConflicts()` method for on-demand conflict scanning

3. **Comprehensive unit tests** (`tests/unit/modManager/logic/ConflictDetector.test.js`)
   - 30 test cases covering all acceptance criteria
   - All tests passing

### Corrections Made

The original ticket contained incorrect assumptions about the codebase that were corrected during implementation:

1. **ActivationCoordinator** - The ticket referenced `this.#activationCoordinator.planActivation(modId)` but this class **does not exist**. The controller uses `modGraphService.calculateActivation()` directly.

2. **Event Emission System** - The ticket showed `this.#emitEvent('conflict:detected', {...})` but this method **does not exist**. ModManagerController uses state updates + subscriber notification pattern via `#updateState()` and `subscribe()`.

3. **Integration Pattern** - The controller integration code was updated to match the actual `toggleMod()` structure.

### Bug Fix During Implementation

Fixed version comparison to handle versions with different part counts (e.g., `2.0` matching `2.0.0`). Changed from strict string equality to normalized `#compareVersions()` function.

### Test Results

- 30/30 ConflictDetector unit tests passing
- 57/57 ModManagerController tests passing
- 503/503 total modManager tests passing
- ESLint: 0 errors
- TypeCheck: Pre-existing errors only (not introduced by this implementation)

---

## Corrected Assumptions

> **Note:** The original ticket contained assumptions about the codebase that were incorrect. These have been corrected during implementation:

1. **ActivationCoordinator** - The ticket referenced `this.#activationCoordinator.planActivation(modId)` but this class **does not exist**. The controller uses `modGraphService.calculateActivation()` directly.

2. **Event Emission System** - The ticket showed `this.#emitEvent('conflict:detected', {...})` but this method **does not exist**. ModManagerController uses state updates + subscriber notification pattern via `#updateState()` and `subscribe()`.

3. **Integration Pattern** - The controller integration code has been updated to match the actual `toggleMod()` structure in `ModManagerController.js`.

---

## Objective

Implement conflict detection logic and UI feedback for mod incompatibilities. Display warnings when mods have conflicting declarations and prevent activation of conflicting mod combinations.

---

## Files Touched

### New Files

- `src/modManager/logic/ConflictDetector.js`
- `tests/unit/modManager/logic/ConflictDetector.test.js`

### Modified Files

- `src/modManager/controllers/ModManagerController.js` (integrate detector)

---

## Out of Scope

**Did NOT modify:**

- ModGraphService (used as-is for dependency info)
- ModCardComponent structure (use addConflictIndicator method)
- Mod manifest format
- Backend APIs
- Animation logic (MODMANIMP-022 handles shake)

---

## Implementation Details

### Detector Class

```javascript
// src/modManager/logic/ConflictDetector.js
/**
 * @file Detects and reports mod conflicts
 * @see src/modding/modDependencyValidator.js
 */

/**
 * @typedef {Object} ConflictInfo
 * @property {string} modA - First conflicting mod ID
 * @property {string} modB - Second conflicting mod ID
 * @property {'declared'|'version'|'resource'} type - Type of conflict
 * @property {string} reason - Human-readable explanation
 */

/**
 * @typedef {Object} ConflictReport
 * @property {boolean} hasConflicts
 * @property {ConflictInfo[]} conflicts
 * @property {Map<string, string[]>} modConflicts - Map of modId to conflicting mod IDs
 */

/**
 * @typedef {Object} ConflictDetectorOptions
 * @property {Object} logger
 */

/**
 * Detects conflicts between mods
 */
export class ConflictDetector {
  #logger;

  /**
   * @param {ConflictDetectorOptions} options
   */
  constructor({ logger }) {
    this.#logger = logger;
  }

  // ... full implementation in source file
}

export default ConflictDetector;
```

### Controller Integration (Corrected)

```javascript
// Add to ModManagerController.js

// In constructor dependencies typedef:
// @property {import('../logic/ConflictDetector.js').ConflictDetector} [conflictDetector] - Optional conflict detector

// Add private field:
/** @type {import('../logic/ConflictDetector.js').ConflictDetector|null} */
#conflictDetector;

// In constructor body (after other dependency assignments):
this.#conflictDetector = conflictDetector ?? null;

// Modify #activateMod() method - add conflict check at start:
async #activateMod(modId) {
  // Check for conflicts before proceeding with activation
  if (this.#conflictDetector) {
    const conflicts = this.#conflictDetector.checkActivationConflicts(
      modId,
      this.#state.availableMods,
      this.#state.resolvedMods
    );

    if (conflicts.length > 0) {
      const warning = this.#conflictDetector.getConflictWarning(conflicts);
      this.#updateState({ error: warning });
      this.#logger.warn(`Activation blocked due to conflicts: ${modId}`, { conflicts });
      return;
    }
  }

  const result = this.#modGraphService.calculateActivation(modId);
  // ... rest of existing #activateMod logic
}

// Add public method to check conflicts on demand:
checkConflicts() {
  if (!this.#conflictDetector) {
    return { hasConflicts: false, conflicts: [], modConflicts: new Map() };
  }
  return this.#conflictDetector.detectConflicts(
    this.#state.availableMods,
    this.#state.resolvedMods
  );
}
```

---

## Acceptance Criteria

### Tests That Must Pass

1. **Unit Tests** (`ConflictDetector.test.js`): ✅ All 30 tests passing
   - `detectConflicts returns empty when no conflicts`
   - `detectConflicts finds declared conflicts`
   - `detectConflicts finds version conflicts with exact match`
   - `detectConflicts finds version conflicts with wildcard pattern`
   - `detectConflicts finds version conflicts with range pattern`
   - `detectConflicts deduplicates A-B and B-A conflicts`
   - `detectConflicts builds modConflicts map correctly`
   - `checkActivationConflicts returns only new mod conflicts`
   - `checkActivationConflicts returns empty for compatible mod`
   - `getConflictingMods returns conflicting mod IDs`
   - `getConflictWarning returns null for no conflicts`
   - `getConflictWarning returns single conflict message`
   - `getConflictWarning returns multi-conflict summary`
   - `compareVersions handles semantic versions correctly`
   - `isVersionIncompatible matches exact versions`
   - `isVersionIncompatible matches wildcard patterns`
   - `isVersionIncompatible matches range patterns`

2. **ESLint passes:** ✅
   ```bash
   npx eslint src/modManager/logic/ConflictDetector.js
   ```

3. **TypeCheck passes:** ✅ (Pre-existing errors only)
   ```bash
   npm run typecheck
   ```

4. **Conflict detection structure:** ✅
   ```bash
   grep -q "type: 'declared'" src/modManager/logic/ConflictDetector.js && \
   grep -q "type: 'version'" src/modManager/logic/ConflictDetector.js && \
   echo "OK"
   ```

### Invariants That Remain True

1. ✅ Conflicts are bidirectional (if A conflicts with B, B conflicts with A)
2. ✅ Duplicate conflicts deduplicated in report
3. ✅ Conflict check happens BEFORE activation attempt
4. ✅ Version patterns support exact, wildcard, and range matching
5. ✅ Conflict warnings are human-readable
6. ⚠️ UI events emitted for conflict visualization (handled by state update pattern, not direct events)
7. ✅ Conflicting mods tracked in modConflicts map

---

## Reference Files

- Dependency validation: `src/modding/modDependencyValidator.js`
- Version comparison: `src/modding/modLoadOrderResolver.js`
- Manifest structure: `data/mods/core/mod-manifest.json`
