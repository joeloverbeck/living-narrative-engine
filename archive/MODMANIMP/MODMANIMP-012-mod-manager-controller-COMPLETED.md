# MODMANIMP-012: ModManagerController

**Status:** Completed
**Priority:** Phase 4 (Controller Layer)
**Estimated Effort:** M (5-6 hours)
**Dependencies:** MODMANIMP-008, MODMANIMP-009, MODMANIMP-010, MODMANIMP-011

---

## Objective

Create the main orchestrator controller that coordinates all services and manages state for the Mod Manager page. This controller handles user interactions, coordinates service calls, and maintains UI state consistency.

---

## Outcome

### Implementation Summary

The ModManagerController was successfully implemented with the following deliverables:

1. **Controller Implementation** (`src/modManager/controllers/ModManagerController.js`)
   - Full implementation matching ticket specification
   - Added dependency validation in constructor (throws on missing dependencies)
   - Added proper JSDoc type annotations for TypeScript checking
   - Uses private class fields (`#`) for encapsulation

2. **Comprehensive Unit Tests** (`tests/unit/modManager/controllers/ModManagerController.test.js`)
   - 50 tests total (16 acceptance criteria tests + 34 edge case tests)
   - All tests pass
   - Coverage includes constructor validation, initialization, mod toggling, world selection, configuration saving, filtering, and subscription management

### Files Created/Modified

| File | Action | Description |
|------|--------|-------------|
| `src/modManager/controllers/ModManagerController.js` | Created | Main controller class with state management |
| `tests/unit/modManager/controllers/ModManagerController.test.js` | Created | 50 comprehensive unit tests |
| `tickets/MODMANIMP-012-mod-manager-controller.md` | Modified | Updated Reference Files section |

### Test Results

```
PASS tests/unit/modManager/controllers/ModManagerController.test.js
Test Suites: 1 passed, 1 total
Tests:       50 passed, 50 total
```

### Tests Created

| Test | Rationale |
|------|-----------|
| `constructor throws when logger is not provided` | Validates required dependency |
| `constructor throws when modDiscoveryService is not provided` | Validates required dependency |
| `constructor throws when modGraphService is not provided` | Validates required dependency |
| `constructor throws when worldDiscoveryService is not provided` | Validates required dependency |
| `constructor throws when configPersistenceService is not provided` | Validates required dependency |
| `constructor initializes with default state` | Verifies initial state shape |
| `initialize loads mods and config successfully` | Core happy path |
| `initialize handles errors gracefully` | Resilience verification |
| `initialize sets loading state during operation` | UI state management |
| `toggleMod activates inactive mod` | Core feature test |
| `toggleMod deactivates active mod` | Core feature test |
| `toggleMod does not affect core mod` | Invariant protection |
| `toggleMod activates dependencies automatically` | Dependency resolution |
| `toggleMod blocks deactivation when dependents exist` | Safety protection |
| `toggleMod handles activation error from graph service` | Error handling |
| `toggleMod handles deactivation error from graph service` | Error handling |
| `toggleMod auto-selects first world when current becomes invalid` | State consistency |
| `toggleMod clears world when no worlds available after deactivation` | Edge case handling |
| `selectWorld updates selected world` | Core feature |
| `selectWorld validates world availability` | Input validation |
| `selectWorld clears error on valid selection` | State cleanup |
| `saveConfiguration persists current state` | Core persistence |
| `saveConfiguration updates hasUnsavedChanges` | State tracking |
| `saveConfiguration prevents concurrent saves` | Race condition prevention |
| `saveConfiguration handles API failure` | Error handling |
| `saveConfiguration handles network error` | Error handling |
| `setSearchQuery filters mods by name/description` | Search functionality |
| `setFilterCategory filters by activation status` | Category filtering |
| `getFilteredMods applies both filters` | Combined filtering |
| `getFilteredMods filters by mod id` | ID search |
| `getFilteredMods filters by mod description` | Description search |
| `getFilteredMods case-insensitive search` | Usability |
| `getFilteredMods returns all mods when no filters` | Default behavior |
| `getFilteredMods returns empty array when no matches` | Edge case |
| `subscribe notifies on state changes` | Observer pattern |
| `subscribe returns unsubscribe function` | Cleanup support |
| `subscribe immediately calls listener with current state` | Initial sync |
| `unsubscribe prevents further notifications` | Cleanup verification |
| `multiple listeners receive notifications` | Multi-observer support |
| `listener error does not prevent other listeners` | Resilience |
| `getState returns immutable copy` | State immutability |
| `getModDisplayInfo returns correct status for core mod` | Display helper |
| `getModDisplayInfo returns correct status for explicit mod` | Display helper |
| `getModDisplayInfo returns correct status for dependency mod` | Display helper |
| `getModDisplayInfo returns correct status for inactive mod` | Display helper |
| `hasUnsavedChanges true when config differs from saved` | Change detection |
| `hasUnsavedChanges false when config matches saved` | Change detection |
| `destroy cleans up resources` | Cleanup verification |
| `destroy calls cancelPendingSave` | Service cleanup |
| `destroy clears all listeners` | Memory cleanup |

### Validation Results

- **ESLint**: Warnings only (no errors)
- **TypeScript**: ModManagerController has no type errors
- **Jest Tests**: 50/50 passing

### Corrections Made

The original ticket's Reference Files section referenced non-existent files:
- `src/characterBuilder/CharacterBuilderController.js` → Corrected to `src/characterBuilder/controllers/BaseCharacterBuilderController.js`
- `src/domUI/controllers/GameController.js` → Removed (does not exist)

---

## Files to Touch

### New Files

- `src/modManager/controllers/ModManagerController.js`
- `tests/unit/modManager/controllers/ModManagerController.test.js`

---

## Out of Scope

**DO NOT modify:**

- Individual services (use them as-is)
- UI components (they receive state, not events)
- Bootstrap initialization (MODMANIMP-006)
- Backend APIs
- Any global state management

---

## Implementation Details

### Controller Class

```javascript
// src/modManager/controllers/ModManagerController.js
/**
 * @file Main orchestrator for Mod Manager page
 * @see src/characterBuilder/CharacterBuilderController.js
 */

/**
 * @typedef {Object} ModManagerState
 * @property {import('../services/ModDiscoveryService.js').ModMetadata[]} availableMods
 * @property {string[]} activeMods - Explicitly selected mod IDs
 * @property {string[]} resolvedMods - Full list including dependencies
 * @property {string} selectedWorld - Current world ID (modId:worldId)
 * @property {import('../services/WorldDiscoveryService.js').WorldInfo[]} availableWorlds
 * @property {boolean} hasUnsavedChanges
 * @property {boolean} isLoading
 * @property {boolean} isSaving
 * @property {string|null} error
 * @property {string|null} searchQuery
 * @property {string} filterCategory - 'all' | 'active' | 'inactive'
 */

/**
 * @typedef {Object} ModManagerDependencies
 * @property {Object} logger
 * @property {import('../services/ModDiscoveryService.js').ModDiscoveryService} modDiscoveryService
 * @property {import('../services/ModGraphService.js').ModGraphService} modGraphService
 * @property {import('../services/WorldDiscoveryService.js').WorldDiscoveryService} worldDiscoveryService
 * @property {import('../services/ConfigPersistenceService.js').ConfigPersistenceService} configPersistenceService
 */

/**
 * Main controller orchestrating Mod Manager functionality
 */
export class ModManagerController {
  #logger;
  #modDiscoveryService;
  #modGraphService;
  #worldDiscoveryService;
  #configPersistenceService;
  #state;
  #listeners;
  #savedConfig;

  /**
   * @param {ModManagerDependencies} dependencies
   */
  constructor({
    logger,
    modDiscoveryService,
    modGraphService,
    worldDiscoveryService,
    configPersistenceService,
  }) {
    this.#logger = logger;
    this.#modDiscoveryService = modDiscoveryService;
    this.#modGraphService = modGraphService;
    this.#worldDiscoveryService = worldDiscoveryService;
    this.#configPersistenceService = configPersistenceService;
    this.#listeners = new Set();
    this.#savedConfig = null;

    this.#state = {
      availableMods: [],
      activeMods: [],
      resolvedMods: [],
      selectedWorld: '',
      availableWorlds: [],
      hasUnsavedChanges: false,
      isLoading: true,
      isSaving: false,
      error: null,
      searchQuery: '',
      filterCategory: 'all',
    };
  }

  /**
   * Initialize controller and load initial data
   * @returns {Promise<void>}
   */
  async initialize() {
    this.#logger.info('Initializing ModManagerController...');
    this.#updateState({ isLoading: true, error: null });

    try {
      // Load available mods and current config in parallel
      const [mods, currentConfig] = await Promise.all([
        this.#modDiscoveryService.discoverMods(),
        this.#configPersistenceService.loadConfig(),
      ]);

      // Build dependency graph
      this.#modGraphService.buildGraph(mods);

      // Set explicit mods from config (excluding 'core' which is always active)
      const explicitMods = currentConfig.mods.filter((id) => id !== 'core');
      this.#modGraphService.setExplicitMods(explicitMods);

      // Calculate resolved mod list
      const resolvedMods = this.#modGraphService.getLoadOrder();

      // Discover available worlds
      const worlds = await this.#worldDiscoveryService.discoverWorlds(resolvedMods);

      // Store saved config for change detection
      this.#savedConfig = { ...currentConfig };

      this.#updateState({
        availableMods: mods,
        activeMods: explicitMods,
        resolvedMods,
        selectedWorld: currentConfig.startWorld,
        availableWorlds: worlds,
        isLoading: false,
        hasUnsavedChanges: false,
      });

      this.#logger.info('ModManagerController initialized successfully');
    } catch (error) {
      this.#logger.error('Failed to initialize ModManagerController', error);
      this.#updateState({
        isLoading: false,
        error: `Failed to load: ${error.message}`,
      });
    }
  }

  /**
   * Toggle a mod's activation state
   * @param {string} modId - Mod to toggle
   * @returns {Promise<void>}
   */
  async toggleMod(modId) {
    const currentStatus = this.#modGraphService.getModStatus(modId);
    this.#logger.info(`Toggling mod: ${modId} (current status: ${currentStatus})`);

    if (currentStatus === 'core') {
      this.#logger.warn('Cannot toggle core mod');
      return;
    }

    if (currentStatus === 'inactive') {
      await this.#activateMod(modId);
    } else {
      await this.#deactivateMod(modId);
    }
  }

  /**
   * Activate a mod and its dependencies
   * @param {string} modId
   */
  async #activateMod(modId) {
    const result = this.#modGraphService.calculateActivation(modId);

    if (!result.valid) {
      this.#updateState({ error: result.error });
      return;
    }

    // Add to explicit mods
    const newActiveMods = [...this.#state.activeMods, modId];
    this.#modGraphService.setExplicitMods(newActiveMods);

    // Recalculate resolved list and worlds
    const resolvedMods = this.#modGraphService.getLoadOrder();
    const worlds = await this.#worldDiscoveryService.discoverWorlds(resolvedMods);

    // Check if current world is still valid
    let selectedWorld = this.#state.selectedWorld;
    if (!worlds.some((w) => w.id === selectedWorld)) {
      selectedWorld = worlds.length > 0 ? worlds[0].id : '';
    }

    this.#updateState({
      activeMods: newActiveMods,
      resolvedMods,
      availableWorlds: worlds,
      selectedWorld,
      hasUnsavedChanges: this.#hasChanges(newActiveMods, selectedWorld),
      error: null,
    });

    this.#logger.info(`Activated mod: ${modId}, dependencies: ${result.dependencies.join(', ')}`);
  }

  /**
   * Deactivate a mod
   * @param {string} modId
   */
  async #deactivateMod(modId) {
    const result = this.#modGraphService.calculateDeactivation(modId);

    if (!result.valid) {
      this.#updateState({ error: result.error });
      return;
    }

    // Remove from explicit mods
    const newActiveMods = this.#state.activeMods.filter((id) => id !== modId);
    this.#modGraphService.setExplicitMods(newActiveMods);

    // Recalculate resolved list and worlds
    const resolvedMods = this.#modGraphService.getLoadOrder();
    const worlds = await this.#worldDiscoveryService.discoverWorlds(resolvedMods);

    // Check if current world is still valid
    let selectedWorld = this.#state.selectedWorld;
    if (!worlds.some((w) => w.id === selectedWorld)) {
      selectedWorld = worlds.length > 0 ? worlds[0].id : '';
    }

    this.#updateState({
      activeMods: newActiveMods,
      resolvedMods,
      availableWorlds: worlds,
      selectedWorld,
      hasUnsavedChanges: this.#hasChanges(newActiveMods, selectedWorld),
      error: null,
    });

    this.#logger.info(`Deactivated mod: ${modId}, orphaned: ${result.orphaned.join(', ')}`);
  }

  /**
   * Select a world
   * @param {string} worldId - World ID in format modId:worldId
   */
  selectWorld(worldId) {
    if (!this.#state.availableWorlds.some((w) => w.id === worldId)) {
      this.#updateState({ error: `Invalid world: ${worldId}` });
      return;
    }

    this.#updateState({
      selectedWorld: worldId,
      hasUnsavedChanges: this.#hasChanges(this.#state.activeMods, worldId),
      error: null,
    });

    this.#logger.info(`Selected world: ${worldId}`);
  }

  /**
   * Save current configuration
   * @returns {Promise<boolean>}
   */
  async saveConfiguration() {
    if (this.#state.isSaving) {
      this.#logger.warn('Save already in progress');
      return false;
    }

    this.#updateState({ isSaving: true, error: null });

    try {
      const config = {
        mods: ['core', ...this.#state.activeMods],
        startWorld: this.#state.selectedWorld,
      };

      const result = await this.#configPersistenceService.saveConfig(config);

      if (result.success) {
        this.#savedConfig = { ...config };
        this.#updateState({
          isSaving: false,
          hasUnsavedChanges: false,
        });
        this.#logger.info('Configuration saved successfully');
        return true;
      } else {
        this.#updateState({
          isSaving: false,
          error: result.error,
        });
        return false;
      }
    } catch (error) {
      this.#logger.error('Save failed', error);
      this.#updateState({
        isSaving: false,
        error: `Save failed: ${error.message}`,
      });
      return false;
    }
  }

  /**
   * Update search query
   * @param {string} query
   */
  setSearchQuery(query) {
    this.#updateState({ searchQuery: query });
  }

  /**
   * Update filter category
   * @param {'all'|'active'|'inactive'} category
   */
  setFilterCategory(category) {
    this.#updateState({ filterCategory: category });
  }

  /**
   * Get filtered mods based on search and filter
   * @returns {import('../services/ModDiscoveryService.js').ModMetadata[]}
   */
  getFilteredMods() {
    let mods = this.#state.availableMods;

    // Apply category filter
    if (this.#state.filterCategory === 'active') {
      mods = mods.filter((m) => this.#state.resolvedMods.includes(m.id));
    } else if (this.#state.filterCategory === 'inactive') {
      mods = mods.filter((m) => !this.#state.resolvedMods.includes(m.id));
    }

    // Apply search filter
    if (this.#state.searchQuery) {
      const query = this.#state.searchQuery.toLowerCase();
      mods = mods.filter(
        (m) =>
          m.id.toLowerCase().includes(query) ||
          m.name.toLowerCase().includes(query) ||
          m.description.toLowerCase().includes(query)
      );
    }

    return mods;
  }

  /**
   * Get enhanced mod info with status
   * @param {string} modId
   * @returns {{status: string, isExplicit: boolean, isDependency: boolean}}
   */
  getModDisplayInfo(modId) {
    const status = this.#modGraphService.getModStatus(modId);
    return {
      status,
      isExplicit: this.#state.activeMods.includes(modId),
      isDependency: status === 'dependency',
    };
  }

  /**
   * Subscribe to state changes
   * @param {(state: ModManagerState) => void} listener
   * @returns {() => void} Unsubscribe function
   */
  subscribe(listener) {
    this.#listeners.add(listener);
    // Immediately call with current state
    listener(this.getState());
    return () => this.#listeners.delete(listener);
  }

  /**
   * Get current state (immutable copy)
   * @returns {ModManagerState}
   */
  getState() {
    return { ...this.#state };
  }

  /**
   * Check if configuration has changed
   * @param {string[]} activeMods
   * @param {string} selectedWorld
   * @returns {boolean}
   */
  #hasChanges(activeMods, selectedWorld) {
    if (!this.#savedConfig) return true;

    const currentConfig = {
      mods: ['core', ...activeMods],
      startWorld: selectedWorld,
    };

    return this.#configPersistenceService.hasChanges(currentConfig, this.#savedConfig);
  }

  /**
   * Update state and notify listeners
   * @param {Partial<ModManagerState>} updates
   */
  #updateState(updates) {
    this.#state = { ...this.#state, ...updates };
    this.#notifyListeners();
  }

  /**
   * Notify all listeners of state change
   */
  #notifyListeners() {
    const state = this.getState();
    for (const listener of this.#listeners) {
      try {
        listener(state);
      } catch (error) {
        this.#logger.error('Listener error', error);
      }
    }
  }

  /**
   * Cleanup resources
   */
  destroy() {
    this.#listeners.clear();
    this.#configPersistenceService.cancelPendingSave();
    this.#logger.debug('ModManagerController destroyed');
  }
}

export default ModManagerController;
```

---

## Acceptance Criteria

### Tests That Must Pass

1. **Unit Tests** (`ModManagerController.test.js`):
   - `initialize loads mods and config successfully`
   - `initialize handles errors gracefully`
   - `toggleMod activates inactive mod`
   - `toggleMod deactivates active mod`
   - `toggleMod does not affect core mod`
   - `toggleMod activates dependencies automatically`
   - `toggleMod blocks deactivation when dependents exist`
   - `selectWorld updates selected world`
   - `selectWorld validates world availability`
   - `saveConfiguration persists current state`
   - `saveConfiguration updates hasUnsavedChanges`
   - `setSearchQuery filters mods by name/description`
   - `setFilterCategory filters by activation status`
   - `getFilteredMods applies both filters`
   - `subscribe notifies on state changes`
   - `destroy cleans up resources`

2. **ESLint passes:**
   ```bash
   npx eslint src/modManager/controllers/ModManagerController.js
   ```

3. **TypeCheck passes:**
   ```bash
   npm run typecheck
   ```

4. **State subscription works:**
   ```bash
   grep -q "subscribe" src/modManager/controllers/ModManagerController.js && \
   grep -q "#listeners" src/modManager/controllers/ModManagerController.js && \
   echo "OK"
   ```

### Invariants That Must Remain True

1. Core mod always included in resolved list
2. State updates trigger listener notifications
3. Immutable state returned from getState()
4. Parallel loading of mods and config during init
5. World selection validated against available worlds
6. hasUnsavedChanges tracks changes from saved state
7. Services are not modified, only orchestrated
8. Filter/search are client-side operations (no service calls)

---

## Reference Files

- Controller pattern: `src/characterBuilder/controllers/BaseCharacterBuilderController.js`
- Service orchestration: `src/modManager/services/` (all services)

> **Note**: Reference files were corrected from original ticket which referenced non-existent files.
