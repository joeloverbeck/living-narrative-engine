/**
 * @file Service for calculating mod configuration statistics
 * @see ModGraphService.js
 */

import { validateDependency } from '../../utils/dependencyUtils.js';

/**
 * Statistics cache structure.
 *
 * @typedef {object} StatisticsCache
 * @property {boolean} isValid - Whether cache is current
 * @property {object} data - Cached calculation results
 */

/**
 * Health status of current mod configuration.
 *
 * @typedef {object} HealthStatus
 * @property {boolean} hasCircularDeps - Whether circular dependencies exist
 * @property {string[]} missingDeps - List of missing dependency mod IDs
 * @property {boolean} loadOrderValid - Whether load order is valid
 * @property {string[]} warnings - Warning messages
 * @property {string[]} errors - Error messages
 */

/**
 * Service for calculating and caching mod configuration statistics.
 * Provides a clean API for UI components to consume statistics data.
 */
export default class ModStatisticsService {
  #modGraphService;
  #logger;

  /** @type {StatisticsCache} */
  #cache;

  /**
   * Creates a new ModStatisticsService instance.
   *
   * @param {object} deps - Service dependencies
   * @param {object} deps.modGraphService - Graph service for mod dependency data
   * @param {object} deps.logger - Logger instance
   */
  constructor({ modGraphService, logger }) {
    validateDependency(modGraphService, 'IModGraphService', logger, {
      requiredMethods: ['getAllNodes', 'getLoadOrder', 'getModStatus'],
    });
    validateDependency(logger, 'ILogger', logger, {
      requiredMethods: ['info', 'warn', 'error', 'debug'],
    });

    this.#modGraphService = modGraphService;
    this.#logger = logger;
    this.#cache = { isValid: false, data: {} };
  }

  /**
   * Invalidate the statistics cache.
   * Call this when mods are activated/deactivated.
   */
  invalidateCache() {
    this.#cache = { isValid: false, data: {} };
    this.#logger.debug('[ModStatisticsService] Cache invalidated');
  }

  /**
   * Get reference to the underlying graph service.
   *
   * @returns {object} ModGraphService instance
   */
  getGraphService() {
    return this.#modGraphService;
  }

  /**
   * Check if the statistics cache is currently valid.
   *
   * @returns {boolean} True if cache is valid
   */
  isCacheValid() {
    return this.#cache.isValid;
  }

  /**
   * @typedef {object} HotspotEntry
   * @property {string} modId - Mod identifier
   * @property {number} dependentCount - Number of mods depending on this
   */

  /**
   * Get mods with the most dependents (most depended-on).
   *
   * @param {number} [limit] - Maximum number of results (default: 5)
   * @returns {HotspotEntry[]} Sorted by dependentCount descending
   */
  getDependencyHotspots(limit = 5) {
    // Check cache
    if (this.#cache.isValid && this.#cache.data.hotspots) {
      return this.#cache.data.hotspots.slice(0, limit);
    }

    const nodes = this.#modGraphService.getAllNodes();
    const hotspots = [];

    for (const [modId, node] of nodes) {
      // Only count active mods (not inactive)
      if (node.status === 'inactive') continue;

      hotspots.push({
        modId,
        dependentCount: node.dependents.length,
      });
    }

    // Sort by dependentCount descending
    hotspots.sort((a, b) => b.dependentCount - a.dependentCount);

    // Cache full results and mark valid
    this.#cache.data.hotspots = hotspots;
    this.#cache.isValid = true;

    return hotspots.slice(0, limit);
  }

  /**
   * Check health of current mod configuration.
   *
   * @returns {HealthStatus} Health status with validation results
   */
  getHealthStatus() {
    // Check cache
    if (this.#cache.isValid && this.#cache.data.health) {
      return this.#cache.data.health;
    }

    const nodes = this.#modGraphService.getAllNodes();
    const loadOrder = this.#modGraphService.getLoadOrder();

    const health = {
      hasCircularDeps: false,
      missingDeps: [],
      loadOrderValid: true,
      warnings: [],
      errors: [],
    };

    // Check for missing dependencies
    for (const [modId, node] of nodes) {
      if (node.status === 'inactive') continue;

      for (const depId of node.dependencies) {
        const depNode = nodes.get(depId);
        if (!depNode || depNode.status === 'inactive') {
          health.missingDeps.push(depId);
          health.errors.push(
            `Missing dependency: '${depId}' required by '${modId}'`
          );
        }
      }
    }

    // Validate load order exists and has entries
    if (!loadOrder || loadOrder.length === 0) {
      health.loadOrderValid = false;
      health.warnings.push('Load order is empty or not computed');
    }

    // Check for circular dependencies (via load order failure)
    // If getAllNodes has entries but getLoadOrder is empty, likely circular
    if (nodes.size > 0 && (!loadOrder || loadOrder.length === 0)) {
      health.hasCircularDeps = true;
      health.errors.push('Possible circular dependency detected');
    }

    // Cache results and mark valid
    this.#cache.data.health = health;
    this.#cache.isValid = true;

    return health;
  }
}
