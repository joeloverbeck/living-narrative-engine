/**
 * @file Main orchestrator controller for Mod Manager page
 * @see src/characterBuilder/controllers/BaseCharacterBuilderController.js
 */

/**
 * @typedef {object} ILogger
 * @property {function(string, ...any): void} debug - Debug level logging
 * @property {function(string, ...any): void} info - Info level logging
 * @property {function(string, ...any): void} warn - Warning level logging
 * @property {function(string, ...any): void} error - Error level logging
 */

/**
 * @typedef {object} ModManagerState
 * @property {import('../services/ModDiscoveryService.js').ModMetadata[]} availableMods - Available mods
 * @property {string[]} activeMods - Explicitly selected mod IDs
 * @property {string[]} resolvedMods - Full list including dependencies
 * @property {string} selectedWorld - Current world ID (modId:worldId)
 * @property {import('../services/WorldDiscoveryService.js').WorldInfo[]} availableWorlds - Available worlds
 * @property {boolean} hasUnsavedChanges - Whether config has unsaved changes
 * @property {boolean} isLoading - Whether initial loading is in progress
 * @property {boolean} isSaving - Whether save is in progress
 * @property {string|null} error - Current error message
 * @property {string|null} searchQuery - Current search query
 * @property {string} filterCategory - 'all' | 'active' | 'inactive'
 */

/**
 * @typedef {object} ModManagerDependencies
 * @property {ILogger} logger - Logger instance
 * @property {import('../services/ModDiscoveryService.js').ModDiscoveryService} modDiscoveryService - Mod discovery service
 * @property {import('../services/ModGraphService.js').ModGraphService} modGraphService - Mod graph service
 * @property {import('../services/WorldDiscoveryService.js').WorldDiscoveryService} worldDiscoveryService - World discovery service
 * @property {import('../services/ConfigPersistenceService.js').ConfigPersistenceService} configPersistenceService - Config persistence service
 * @property {import('../logic/WorldSelectionValidator.js').WorldSelectionValidator} [worldSelectionValidator] - Optional world selection validator
 * @property {import('../logic/ConflictDetector.js').ConflictDetector} [conflictDetector] - Optional conflict detector
 */

/**
 * Main controller orchestrating Mod Manager functionality
 */
export class ModManagerController {
  /** @type {ILogger} */
  #logger;
  /** @type {import('../services/ModDiscoveryService.js').ModDiscoveryService} */
  #modDiscoveryService;
  /** @type {import('../services/ModGraphService.js').ModGraphService} */
  #modGraphService;
  /** @type {import('../services/WorldDiscoveryService.js').WorldDiscoveryService} */
  #worldDiscoveryService;
  /** @type {import('../services/ConfigPersistenceService.js').ConfigPersistenceService} */
  #configPersistenceService;
  /** @type {import('../logic/WorldSelectionValidator.js').WorldSelectionValidator|null} */
  #worldValidator;
  /** @type {import('../logic/ConflictDetector.js').ConflictDetector|null} */
  #conflictDetector;
  /** @type {ModManagerState} */
  #state;
  /** @type {Set<function(ModManagerState): void>} */
  #listeners;
  /** @type {{mods: string[], startWorld: string}|null} */
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
    worldSelectionValidator = null,
    conflictDetector = null,
  }) {
    if (!logger) {
      throw new Error('ModManagerController: logger is required');
    }
    if (!modDiscoveryService) {
      throw new Error('ModManagerController: modDiscoveryService is required');
    }
    if (!modGraphService) {
      throw new Error('ModManagerController: modGraphService is required');
    }
    if (!worldDiscoveryService) {
      throw new Error(
        'ModManagerController: worldDiscoveryService is required'
      );
    }
    if (!configPersistenceService) {
      throw new Error(
        'ModManagerController: configPersistenceService is required'
      );
    }

    this.#logger = logger;
    this.#modDiscoveryService = modDiscoveryService;
    this.#modGraphService = modGraphService;
    this.#worldDiscoveryService = worldDiscoveryService;
    this.#configPersistenceService = configPersistenceService;
    this.#worldValidator = worldSelectionValidator;
    this.#conflictDetector = conflictDetector;
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
      const worlds =
        await this.#worldDiscoveryService.discoverWorlds(resolvedMods);

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
    } catch (/** @type {any} */ error) {
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
        this.#logger.warn(`Activation blocked due to conflicts: ${modId}`, {
          conflicts,
        });
        return;
      }
    }

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
    const { availableWorlds, selectedWorld } =
      await this.#handleWorldAfterModChange(resolvedMods);

    this.#updateState({
      activeMods: newActiveMods,
      resolvedMods,
      availableWorlds,
      selectedWorld,
      hasUnsavedChanges: this.#hasChanges(newActiveMods, selectedWorld),
      error: null,
    });

    this.#logger.info(
      `Activated mod: ${modId}, dependencies: ${result.dependencies.join(', ')}`
    );
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
    const { availableWorlds, selectedWorld } =
      await this.#handleWorldAfterModChange(resolvedMods);

    this.#updateState({
      activeMods: newActiveMods,
      resolvedMods,
      availableWorlds,
      selectedWorld,
      hasUnsavedChanges: this.#hasChanges(newActiveMods, selectedWorld),
      error: null,
    });

    this.#logger.info(
      `Deactivated mod: ${modId}, orphaned: ${result.orphaned.join(', ')}`
    );
  }

  /**
   * Handle world selection after mod changes
   * Uses validator if available, otherwise falls back to existing logic
   * @param {string[]} resolvedMods - The new resolved mod list
   * @returns {Promise<{availableWorlds: import('../services/WorldDiscoveryService.js').WorldInfo[], selectedWorld: string}>}
   */
  async #handleWorldAfterModChange(resolvedMods) {
    const worlds =
      await this.#worldDiscoveryService.discoverWorlds(resolvedMods);

    if (this.#worldValidator) {
      const validation = await this.#worldValidator.validateAfterModChange(
        this.#state.selectedWorld,
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
    let selectedWorld = this.#state.selectedWorld;
    if (!worlds.some((w) => w.id === selectedWorld)) {
      selectedWorld = worlds.length > 0 ? worlds[0].id : '';
    }
    return { availableWorlds: worlds, selectedWorld };
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
    } catch (/** @type {any} */ error) {
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
   * Check for conflicts among currently active mods
   * @returns {import('../logic/ConflictDetector.js').ConflictReport}
   */
  checkConflicts() {
    if (!this.#conflictDetector) {
      return { hasConflicts: false, conflicts: [], modConflicts: new Map() };
    }
    return this.#conflictDetector.detectConflicts(
      this.#state.availableMods,
      this.#state.resolvedMods
    );
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

    return this.#configPersistenceService.hasChanges(
      currentConfig,
      this.#savedConfig
    );
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
