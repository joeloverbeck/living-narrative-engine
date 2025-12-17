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
    if (!logger) {
      throw new Error('WorldSelectionValidator: logger is required');
    }
    if (!worldDiscoveryService) {
      throw new Error('WorldSelectionValidator: worldDiscoveryService is required');
    }
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
