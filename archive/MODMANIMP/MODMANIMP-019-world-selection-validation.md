# MODMANIMP-019: World Selection Validation

**Status:** Completed
**Priority:** Phase 6 (Features)
**Estimated Effort:** S (2-3 hours)
**Dependencies:** MODMANIMP-018 (Mod Activation), MODMANIMP-010 (WorldDiscoveryService)

---

## Assumptions Corrected

**Note:** The following assumptions were corrected based on codebase analysis:

1. **ModManagerController already has world auto-selection logic** in `#activateMod` and `#deactivateMod` (lines 207-209, 248-250). The validator integration must complement, not duplicate, this existing behavior.

2. **`selectWorld()` already validates** against `availableWorlds` (line 272). The ticket's proposed integration should use validator methods but preserve existing patterns.

3. **WorldDiscoveryService exists** with all required methods (`discoverWorlds`, `parseWorldId`, `isWorldAvailable`) - verified.

4. **Integration approach**: The validator will be an optional dependency to maintain backward compatibility. Minimal changes to public API.

---

## Objective

Implement validation logic ensuring the selected world remains valid as mods are activated/deactivated. When the current world becomes unavailable, automatically select an alternative or prompt the user.

---

## Files to Touch

### New Files

- `src/modManager/logic/WorldSelectionValidator.js`
- `tests/unit/modManager/logic/WorldSelectionValidator.test.js`

### Modified Files

- `src/modManager/controllers/ModManagerController.js` (integrate validator)

---

## Out of Scope

**DO NOT modify:**

- WorldDiscoveryService (use as-is)
- World loading logic
- Backend APIs
- World file structure
- WorldListView (it receives validated state)

---

## Implementation Details

### Validator Class

```javascript
// src/modManager/logic/WorldSelectionValidator.js
/**
 * @file Validates and manages world selection during mod changes
 * @see src/loaders/worldLoader.js
 */

/**
 * @typedef {Object} WorldValidationResult
 * @property {boolean} valid - Whether current selection is still valid
 * @property {string|null} selectedWorld - Current or suggested world
 * @property {string|null} previousWorld - World that was invalidated
 * @property {'unchanged'|'auto-selected'|'cleared'|'invalid'} action
 * @property {string|null} message - User-facing message
 */

/**
 * @typedef {Object} WorldSelectionValidatorOptions
 * @property {Object} logger
 * @property {import('../services/WorldDiscoveryService.js').WorldDiscoveryService} worldDiscoveryService
 */

/**
 * Validates world selection during mod changes
 */
export class WorldSelectionValidator {
  #logger;
  #worldDiscoveryService;

  /**
   * @param {WorldSelectionValidatorOptions} options
   */
  constructor({ logger, worldDiscoveryService }) {
    this.#logger = logger;
    this.#worldDiscoveryService = worldDiscoveryService;
  }

  /**
   * Validate and potentially update world selection after mod changes
   * @param {string} currentWorld - Currently selected world ID
   * @param {string[]} newActiveMods - New list of active mods (load order)
   * @returns {Promise<WorldValidationResult>}
   */
  async validateAfterModChange(currentWorld, newActiveMods) {
    this.#logger.debug('Validating world selection after mod change', {
      currentWorld,
      modCount: newActiveMods.length,
    });

    // Discover available worlds with new mod set
    const availableWorlds = await this.#worldDiscoveryService.discoverWorlds(newActiveMods);

    // Check if current world is still available
    const currentStillValid = availableWorlds.some((w) => w.id === currentWorld);

    if (currentStillValid) {
      return {
        valid: true,
        selectedWorld: currentWorld,
        previousWorld: null,
        action: 'unchanged',
        message: null,
      };
    }

    // Current world is no longer available
    this.#logger.info(`World ${currentWorld} no longer available, finding alternative`);

    // Try to auto-select a new world
    if (availableWorlds.length > 0) {
      const newWorld = this.#selectBestAlternative(currentWorld, availableWorlds);
      return {
        valid: true,
        selectedWorld: newWorld.id,
        previousWorld: currentWorld,
        action: 'auto-selected',
        message: `World "${this.#extractWorldName(currentWorld)}" is no longer available. Selected "${newWorld.name}" instead.`,
      };
    }

    // No worlds available at all
    return {
      valid: false,
      selectedWorld: null,
      previousWorld: currentWorld,
      action: 'cleared',
      message: 'No worlds available. Enable mods that contain worlds.',
    };
  }

  /**
   * Validate a specific world selection
   * @param {string} worldId - World ID to validate
   * @param {string[]} activeMods - Current active mods
   * @returns {Promise<{valid: boolean, error: string|null}>}
   */
  async validateWorldSelection(worldId, activeMods) {
    if (!worldId) {
      return { valid: false, error: 'No world selected' };
    }

    // Check format
    const parsed = this.#worldDiscoveryService.parseWorldId(worldId);
    if (!parsed) {
      return { valid: false, error: 'Invalid world ID format (expected modId:worldId)' };
    }

    // Check if source mod is active
    if (!activeMods.includes(parsed.modId)) {
      return {
        valid: false,
        error: `World requires mod "${parsed.modId}" to be active`,
      };
    }

    // Check if world exists
    const isAvailable = await this.#worldDiscoveryService.isWorldAvailable(worldId, activeMods);
    if (!isAvailable) {
      return { valid: false, error: 'World not found in active mods' };
    }

    return { valid: true, error: null };
  }

  /**
   * Check if a world would become invalid if a mod is deactivated
   * @param {string} worldId - Currently selected world
   * @param {string} modToDeactivate - Mod being deactivated
   * @returns {boolean}
   */
  wouldInvalidateWorld(worldId, modToDeactivate) {
    if (!worldId) return false;

    const parsed = this.#worldDiscoveryService.parseWorldId(worldId);
    if (!parsed) return false;

    return parsed.modId === modToDeactivate;
  }

  /**
   * Select the best alternative world
   * @param {string} previousWorld - World that was invalidated
   * @param {import('../services/WorldDiscoveryService.js').WorldInfo[]} availableWorlds
   * @returns {import('../services/WorldDiscoveryService.js').WorldInfo}
   */
  #selectBestAlternative(previousWorld, availableWorlds) {
    const previousParsed = this.#worldDiscoveryService.parseWorldId(previousWorld);

    // Preference order:
    // 1. Same mod, different world
    // 2. Core mod world
    // 3. First available world

    if (previousParsed) {
      const sameModWorld = availableWorlds.find((w) => w.modId === previousParsed.modId);
      if (sameModWorld) {
        this.#logger.debug('Selected alternative world from same mod');
        return sameModWorld;
      }
    }

    const coreWorld = availableWorlds.find((w) => w.modId === 'core');
    if (coreWorld) {
      this.#logger.debug('Selected core mod world as alternative');
      return coreWorld;
    }

    this.#logger.debug('Selected first available world as alternative');
    return availableWorlds[0];
  }

  /**
   * Extract world name from ID for display
   * @param {string} worldId
   * @returns {string}
   */
  #extractWorldName(worldId) {
    const parsed = this.#worldDiscoveryService.parseWorldId(worldId);
    return parsed ? parsed.worldId : worldId;
  }

  /**
   * Get warning message if deactivating a mod would affect world selection
   * @param {string} currentWorld - Currently selected world
   * @param {string} modToDeactivate - Mod being deactivated
   * @param {string[]} remainingMods - Mods that would remain active
   * @returns {Promise<string|null>}
   */
  async getDeactivationWarning(currentWorld, modToDeactivate, remainingMods) {
    if (!this.wouldInvalidateWorld(currentWorld, modToDeactivate)) {
      return null;
    }

    const remainingWorlds = await this.#worldDiscoveryService.discoverWorlds(remainingMods);

    if (remainingWorlds.length === 0) {
      return `Deactivating "${modToDeactivate}" will remove all available worlds.`;
    }

    const alternative = this.#selectBestAlternative(currentWorld, remainingWorlds);
    return `Deactivating "${modToDeactivate}" will change the starting world to "${alternative.name}".`;
  }
}

export default WorldSelectionValidator;
```

### Controller Integration (Revised)

**Approach:** Minimal integration preserving existing public API. The validator is optional for backward compatibility.

```javascript
// Add to ModManagerController.js

// In constructor - add optional parameter:
/** @type {import('../logic/WorldSelectionValidator.js').WorldSelectionValidator|null} */
this.#worldValidator = worldSelectionValidator || null;

// In #activateMod and #deactivateMod, use validator for enhanced validation:
// (The existing auto-selection logic at lines 207-209 and 248-250 continues to work)
// Validator provides richer result with action type and messages for UI feedback
async #handleWorldAfterModChange(resolvedMods, currentWorld) {
  const worlds = await this.#worldDiscoveryService.discoverWorlds(resolvedMods);

  if (this.#worldValidator) {
    const validation = await this.#worldValidator.validateAfterModChange(
      currentWorld,
      resolvedMods
    );
    if (validation.action !== 'unchanged') {
      this.#logger.info(`World selection changed: ${validation.action}`);
    }
    return {
      availableWorlds: worlds,
      selectedWorld: validation.selectedWorld || '',
    };
  }

  // Fallback to existing logic (backward compatibility)
  let selectedWorld = currentWorld;
  if (!worlds.some((w) => w.id === currentWorld)) {
    selectedWorld = worlds.length > 0 ? worlds[0].id : '';
  }
  return { availableWorlds: worlds, selectedWorld };
}

// In selectWorld - validator provides better error messages:
// Existing inline check remains for quick validation,
// validator adds detailed error context
```

**Key changes:**
1. `worldSelectionValidator` is optional parameter (maintains backward compat)
2. `#handleWorldAfterModChange` private method extracts world update logic
3. Existing validation in `selectWorld()` line 272 is preserved

---

## Acceptance Criteria

### Tests That Must Pass

1. **Unit Tests** (`WorldSelectionValidator.test.js`):
   - `validateAfterModChange returns unchanged when world still valid`
   - `validateAfterModChange auto-selects when world becomes invalid`
   - `validateAfterModChange clears selection when no worlds available`
   - `validateAfterModChange returns appropriate message`
   - `validateWorldSelection returns valid for existing world`
   - `validateWorldSelection returns error for missing world`
   - `validateWorldSelection returns error for inactive mod`
   - `validateWorldSelection returns error for invalid format`
   - `wouldInvalidateWorld returns true when mod provides world`
   - `wouldInvalidateWorld returns false for unrelated mod`
   - `selectBestAlternative prefers same mod`
   - `selectBestAlternative falls back to core mod`
   - `getDeactivationWarning returns warning for world-providing mod`
   - `getDeactivationWarning returns null for unrelated mod`

2. **ESLint passes:**
   ```bash
   npx eslint src/modManager/logic/WorldSelectionValidator.js
   ```

3. **TypeCheck passes:**
   ```bash
   npm run typecheck
   ```

4. **World ID format handling:**
   ```bash
   grep -q "parseWorldId" src/modManager/logic/WorldSelectionValidator.js && \
   grep -q "modId:worldId" src/modManager/logic/WorldSelectionValidator.js && \
   echo "OK"
   ```

### Invariants That Must Remain True

1. World ID always in format `modId:worldId`
2. Auto-selection prefers same mod, then core, then first available
3. Validation error messages are user-friendly
4. Deactivation warnings provided before action
5. No world is valid when no mods with worlds are active
6. World source mod must be in active mods list

---

## Reference Files

- World loading: `src/loaders/worldLoader.js`
- World discovery: `src/modManager/services/WorldDiscoveryService.js`
- Config structure: `data/game.json`

---

## Outcome

**Completion Date:** 2025-12-17

### Files Created
- `src/modManager/logic/WorldSelectionValidator.js` - Validator class with all specified methods
- `tests/unit/modManager/logic/WorldSelectionValidator.test.js` - 27 unit tests (all passing)

### Files Modified
- `src/modManager/controllers/ModManagerController.js` - Minimal integration with validator as optional dependency

### Implementation Notes

1. **Validator Integration**: WorldSelectionValidator is injected as an optional dependency to ModManagerController, preserving backward compatibility.

2. **Controller Changes**:
   - Added `#worldValidator` private field
   - Added optional `worldSelectionValidator` constructor parameter
   - Created `#handleWorldAfterModChange()` private method to encapsulate world selection logic
   - Updated `#activateMod()` and `#deactivateMod()` to use the new helper method

3. **Test Coverage**:
   - WorldSelectionValidator: 27 tests covering all acceptance criteria
   - ModManagerController: 7 new integration tests for validator functionality
   - Total: 57 controller tests (all passing)

4. **Design Decisions**:
   - Validator uses WorldDiscoveryService's `parseWorldId()` method for ID parsing
   - Selection priority: same mod → core mod → first available
   - Fallback logic preserved when validator not provided

### Verification
```bash
# All tests pass
NODE_ENV=test npx jest tests/unit/modManager/logic/WorldSelectionValidator.test.js  # 27 passed
NODE_ENV=test npx jest tests/unit/modManager/controllers/ModManagerController.test.js  # 57 passed
```
