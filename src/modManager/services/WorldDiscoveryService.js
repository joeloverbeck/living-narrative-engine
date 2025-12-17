/**
 * @file Service for discovering available worlds from active mods
 * @see src/loaders/worldLoader.js
 */

/**
 * @typedef {Object} WorldInfo
 * @property {string} id - Full world ID (modId:worldId)
 * @property {string} modId - Source mod ID
 * @property {string} worldId - World identifier within mod
 * @property {string} name - Display name
 * @property {string} description - World description
 */

/**
 * @typedef {Object} ModMetadata
 * @property {string} id - Mod identifier
 * @property {string} name - Display name
 * @property {string} description - Mod description
 * @property {boolean} hasWorlds - Whether mod contains worlds
 */

/**
 * @typedef {Object} ILogger
 * @property {function(string, ...any): void} debug - Debug level logging
 * @property {function(string, ...any): void} info - Info level logging
 * @property {function(string, ...any): void} warn - Warning level logging
 * @property {function(string, ...any): void} error - Error level logging
 */

/**
 * @typedef {Object} IModDiscoveryService
 * @property {function(): Promise<ModMetadata[]>} getModsWithWorlds - Get mods that have worlds
 */

/**
 * Service for discovering worlds from mod metadata.
 *
 * Note: Since no backend API exists for world details, this service
 * derives world information from mod metadata only, using the convention
 * that each mod with worlds has a primary world with ID `modId:modId`.
 */
export class WorldDiscoveryService {
  /** @type {ILogger} */
  #logger;

  /** @type {IModDiscoveryService} */
  #modDiscoveryService;

  /**
   * @param {Object} options
   * @param {ILogger} options.logger - Logger instance
   * @param {IModDiscoveryService} options.modDiscoveryService - ModDiscoveryService instance
   */
  constructor({ logger, modDiscoveryService }) {
    if (!logger) {
      throw new Error('WorldDiscoveryService: logger is required');
    }
    if (!modDiscoveryService) {
      throw new Error('WorldDiscoveryService: modDiscoveryService is required');
    }
    this.#logger = logger;
    this.#modDiscoveryService = modDiscoveryService;
  }

  /**
   * Get available worlds from a set of active mods
   * @param {string[]} activeModIds - Currently active mod IDs
   * @returns {Promise<WorldInfo[]>}
   */
  async discoverWorlds(activeModIds) {
    this.#logger.info(
      'WorldDiscoveryService: Discovering worlds from active mods...'
    );

    const modsWithWorlds = await this.#modDiscoveryService.getModsWithWorlds();
    const activeModSet = new Set(activeModIds);

    // Filter to only active mods that have worlds
    const activeModsWithWorlds = modsWithWorlds.filter((mod) =>
      activeModSet.has(mod.id)
    );

    if (activeModsWithWorlds.length === 0) {
      this.#logger.info(
        'WorldDiscoveryService: No active mods contain worlds'
      );
      return [];
    }

    // Create world entries from mod metadata
    const worlds = activeModsWithWorlds.map((mod) =>
      this.#createWorldFromMod(mod)
    );

    this.#logger.info(
      `WorldDiscoveryService: Discovered ${worlds.length} worlds from ${activeModsWithWorlds.length} mods`
    );
    return worlds;
  }

  /**
   * Create world entry from mod metadata
   * Uses convention modId:modId for primary world
   * @param {ModMetadata} mod - Mod metadata
   * @returns {WorldInfo}
   */
  #createWorldFromMod(mod) {
    return {
      id: `${mod.id}:${mod.id}`,
      modId: mod.id,
      worldId: mod.id,
      name: `${mod.name} World`,
      description: mod.description || `Main world from ${mod.name}`,
    };
  }

  /**
   * Validate that a world ID is available from active mods
   * @param {string} worldId - Full world ID (modId:worldId)
   * @param {string[]} activeModIds - Currently active mod IDs
   * @returns {Promise<boolean>}
   */
  async isWorldAvailable(worldId, activeModIds) {
    const worlds = await this.discoverWorlds(activeModIds);
    return worlds.some((w) => w.id === worldId);
  }

  /**
   * Parse a world ID into its components
   * @param {string} worldId - Full world ID (modId:worldId)
   * @returns {{modId: string, worldId: string}|null}
   */
  parseWorldId(worldId) {
    if (!worldId || typeof worldId !== 'string' || !worldId.includes(':')) {
      return null;
    }
    const [modId, ...rest] = worldId.split(':');
    const parsedWorldId = rest.join(':');
    if (!modId || !parsedWorldId) {
      return null;
    }
    return {
      modId,
      worldId: parsedWorldId,
    };
  }
}

export default WorldDiscoveryService;
