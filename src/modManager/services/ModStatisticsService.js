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
 * Depth analysis results for mod dependency chains.
 *
 * @typedef {object} DepthAnalysis
 * @property {number} maxDepth - Maximum chain length in the graph
 * @property {string[]} deepestChain - Mod IDs in the deepest chain (leaf to root)
 * @property {number} averageDepth - Average depth across all mods
 */

/**
 * Footprint data for a single explicit mod.
 *
 * @typedef {object} ModFootprint
 * @property {string} modId - Explicit mod ID
 * @property {string[]} dependencies - List of transitive dependency IDs
 * @property {number} count - Number of transitive dependencies
 */

/**
 * Full footprint analysis across all explicit mods.
 *
 * @typedef {object} FootprintAnalysis
 * @property {ModFootprint[]} footprints - Per-mod footprint data sorted by count desc
 * @property {number} totalUniqueDeps - Total unique dependencies across all explicit mods
 * @property {number} sharedDepsCount - Number of dependencies shared by 2+ explicit mods
 * @property {number} overlapPercentage - Percentage of deps that are shared (0-100)
 */

/**
 * Ratio analysis of foundation vs optional mods.
 *
 * @typedef {object} RatioAnalysis
 * @property {number} foundationCount - Number of foundation mods (core + dependencies)
 * @property {number} optionalCount - Number of optional mods (explicit)
 * @property {number} totalActive - Total active mods
 * @property {number} foundationPercentage - Foundation percentage (0-100)
 * @property {number} optionalPercentage - Optional percentage (0-100)
 * @property {string[]} foundationMods - List of foundation mod IDs
 * @property {string} profile - Classification: 'foundation-heavy' | 'balanced' | 'content-heavy'
 */

/**
 * Single at-risk mod entry.
 *
 * @typedef {object} OrphanRisk
 * @property {string} modId - The at-risk dependency mod ID
 * @property {string} singleDependent - The only mod depending on it
 * @property {string} status - Status of the at-risk mod ('dependency' | 'core')
 */

/**
 * Analysis of mods at risk of becoming orphaned.
 *
 * @typedef {object} OrphanRiskAnalysis
 * @property {OrphanRisk[]} atRiskMods - List of mods with only one dependent
 * @property {number} totalAtRisk - Count of at-risk mods
 * @property {number} percentageOfDeps - Percentage of dependencies that are at-risk
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

    // Check for circular dependencies using explicit detection from ModGraphService
    if (
      typeof this.#modGraphService.hasCircularDependency === 'function' &&
      this.#modGraphService.hasCircularDependency()
    ) {
      health.hasCircularDeps = true;
      const errorMsg =
        typeof this.#modGraphService.getCircularDependencyError === 'function'
          ? this.#modGraphService.getCircularDependencyError()
          : null;
      health.errors.push(errorMsg || 'Circular dependency detected');
      health.loadOrderValid = false;
    }
    // Fallback: If multiple non-core active nodes exist but getLoadOrder is empty,
    // likely circular dependency (single core node with empty load order is just empty, not circular)
    else if (!loadOrder || loadOrder.length === 0) {
      // Count active non-core mods
      let activeNonCoreCount = 0;
      for (const [_id, node] of nodes) {
        if (node.status !== 'inactive' && node.status !== 'core') {
          activeNonCoreCount++;
        }
      }

      if (activeNonCoreCount > 0) {
        // Active mods exist but load order failed - likely circular dependency
        health.hasCircularDeps = true;
        health.errors.push('Possible circular dependency detected');
        health.loadOrderValid = false;
      } else {
        // No active non-core mods, just empty load order
        health.loadOrderValid = false;
        health.warnings.push('Load order is empty or not computed');
      }
    }

    // Cache results and mark valid
    this.#cache.data.health = health;
    this.#cache.isValid = true;

    return health;
  }

  /**
   * Analyze dependency chain depths across all active mods.
   *
   * @returns {DepthAnalysis} Depth analysis results
   */
  getDependencyDepthAnalysis() {
    // Check cache
    if (this.#cache.isValid && this.#cache.data.depth) {
      return this.#cache.data.depth;
    }

    const nodes = this.#modGraphService.getAllNodes();

    if (nodes.size === 0) {
      const result = { maxDepth: 0, deepestChain: [], averageDepth: 0 };
      this.#cache.data.depth = result;
      this.#cache.isValid = true;
      return result;
    }

    // Calculate depth for each active mod
    const depths = new Map();
    const chains = new Map();

    for (const [modId, node] of nodes) {
      if (node.status === 'inactive') continue;
      const { depth, chain } = this.#calculateDepth(modId, nodes, new Set());
      depths.set(modId, depth);
      chains.set(modId, chain);
    }

    // Find maximum depth and deepest chain
    let maxDepth = 0;
    let deepestChain = [];

    for (const [modId, depth] of depths) {
      if (depth > maxDepth) {
        maxDepth = depth;
        deepestChain = chains.get(modId);
      }
    }

    // Calculate average
    const depthValues = Array.from(depths.values());
    const averageDepth =
      depthValues.length > 0
        ? depthValues.reduce((sum, d) => sum + d, 0) / depthValues.length
        : 0;

    const result = {
      maxDepth,
      deepestChain,
      averageDepth: Math.round(averageDepth * 10) / 10, // One decimal place
    };

    this.#cache.data.depth = result;
    this.#cache.isValid = true;
    return result;
  }

  /**
   * Get transitive dependency footprint for each explicit mod.
   *
   * @returns {FootprintAnalysis} Footprint analysis with overlap data
   */
  getTransitiveDependencyFootprints() {
    // Check cache
    if (this.#cache.isValid && this.#cache.data.footprints) {
      return this.#cache.data.footprints;
    }

    const nodes = this.#modGraphService.getAllNodes();

    // Find explicit mods
    const explicitMods = [];
    for (const [modId, node] of nodes) {
      if (node.status === 'explicit') {
        explicitMods.push(modId);
      }
    }

    // Calculate footprint for each explicit mod
    const footprints = [];
    const allDeps = new Set();
    const depCounts = new Map(); // Count how many explicit mods depend on each dep

    for (const modId of explicitMods) {
      const deps = this.#collectTransitiveDeps(modId, nodes, new Set());

      footprints.push({
        modId,
        dependencies: Array.from(deps),
        count: deps.size,
      });

      // Track for overlap analysis
      for (const depId of deps) {
        allDeps.add(depId);
        depCounts.set(depId, (depCounts.get(depId) || 0) + 1);
      }
    }

    // Sort by count descending
    footprints.sort((a, b) => b.count - a.count);

    // Calculate shared dependencies (used by 2+ explicit mods)
    let sharedDepsCount = 0;
    for (const count of depCounts.values()) {
      if (count >= 2) {
        sharedDepsCount++;
      }
    }

    const totalUniqueDeps = allDeps.size;
    const overlapPercentage =
      totalUniqueDeps > 0
        ? Math.round((sharedDepsCount / totalUniqueDeps) * 100)
        : 0;

    const result = {
      footprints,
      totalUniqueDeps,
      sharedDepsCount,
      overlapPercentage,
    };

    this.#cache.data.footprints = result;
    this.#cache.isValid = true;
    return result;
  }

  /**
   * Calculate ratio of foundation vs optional mods.
   *
   * @returns {RatioAnalysis} Ratio analysis with profile classification
   */
  getCoreOptionalRatio() {
    // Check cache
    if (this.#cache.isValid && this.#cache.data.ratio) {
      return this.#cache.data.ratio;
    }

    const nodes = this.#modGraphService.getAllNodes();

    const foundationMods = [];
    let optionalCount = 0;
    let totalActive = 0;

    for (const [modId, node] of nodes) {
      if (node.status === 'inactive') continue;

      totalActive++;

      if (node.status === 'core' || node.status === 'dependency') {
        foundationMods.push(modId);
      } else if (node.status === 'explicit') {
        optionalCount++;
      }
    }

    const foundationCount = foundationMods.length;
    const foundationPercentage =
      totalActive > 0 ? Math.round((foundationCount / totalActive) * 100) : 0;
    const optionalPercentage =
      totalActive > 0 ? Math.round((optionalCount / totalActive) * 100) : 0;

    // Classify profile
    let profile;
    if (foundationPercentage >= 60) {
      profile = 'foundation-heavy';
    } else if (optionalPercentage >= 60) {
      profile = 'content-heavy';
    } else {
      profile = 'balanced';
    }

    const result = {
      foundationCount,
      optionalCount,
      totalActive,
      foundationPercentage,
      optionalPercentage,
      foundationMods,
      profile,
    };

    this.#cache.data.ratio = result;
    this.#cache.isValid = true;
    return result;
  }

  /**
   * Find dependencies that have only one dependent (orphan risk).
   * These mods would become orphaned if their single dependent is deactivated.
   *
   * @returns {OrphanRiskAnalysis} Analysis of single-parent dependencies
   */
  getSingleParentDependencies() {
    // Check cache
    if (this.#cache.isValid && this.#cache.data.orphanRisk) {
      return this.#cache.data.orphanRisk;
    }

    const nodes = this.#modGraphService.getAllNodes();

    const atRiskMods = [];
    let totalDependencies = 0;

    for (const [modId, node] of nodes) {
      // Skip inactive mods
      if (node.status === 'inactive') continue;

      // Only look at dependencies (not explicit mods)
      if (node.status === 'explicit') continue;

      // Count as a dependency
      totalDependencies++;

      // Check if this mod has only one active dependent
      const activeDependents = (node.dependents || []).filter((depId) => {
        const depNode = nodes.get(depId);
        return depNode && depNode.status !== 'inactive';
      });

      if (activeDependents.length === 1) {
        atRiskMods.push({
          modId,
          singleDependent: activeDependents[0],
          status: node.status,
        });
      }
    }

    // Sort by mod ID for consistent ordering
    atRiskMods.sort((a, b) => a.modId.localeCompare(b.modId));

    const percentageOfDeps =
      totalDependencies > 0
        ? Math.round((atRiskMods.length / totalDependencies) * 100)
        : 0;

    const result = {
      atRiskMods,
      totalAtRisk: atRiskMods.length,
      percentageOfDeps,
    };

    this.#cache.data.orphanRisk = result;
    this.#cache.isValid = true;
    return result;
  }

  /**
   * Calculate depth for a single mod (recursive helper).
   *
   * @param {string} modId - Mod to calculate depth for
   * @param {Map<string, object>} nodes - All nodes map
   * @param {Set<string>} visited - Visited nodes (for cycle detection)
   * @returns {{depth: number, chain: string[]}} Depth and chain
   */
  #calculateDepth(modId, nodes, visited) {
    // Cycle detection
    if (visited.has(modId)) {
      return { depth: 0, chain: [] };
    }

    const node = nodes.get(modId);
    if (!node || node.status === 'inactive') {
      return { depth: 0, chain: [] };
    }

    // No dependencies = depth of 1
    if (!node.dependencies || node.dependencies.length === 0) {
      return { depth: 1, chain: [modId] };
    }

    visited.add(modId);

    // Find max depth among dependencies
    let maxChildDepth = 0;
    let maxChildChain = [];

    for (const depId of node.dependencies) {
      const { depth, chain } = this.#calculateDepth(
        depId,
        nodes,
        new Set(visited)
      );
      if (depth > maxChildDepth) {
        maxChildDepth = depth;
        maxChildChain = chain;
      }
    }

    return {
      depth: 1 + maxChildDepth,
      chain: [modId, ...maxChildChain],
    };
  }

  /**
   * Collect all transitive dependencies for a mod.
   *
   * @param {string} modId - Starting mod
   * @param {Map<string, object>} nodes - All nodes
   * @param {Set<string>} visited - Already visited (cycle prevention)
   * @returns {Set<string>} All dependency mod IDs
   */
  #collectTransitiveDeps(modId, nodes, visited) {
    const result = new Set();

    if (visited.has(modId)) {
      return result;
    }
    visited.add(modId);

    const node = nodes.get(modId);
    if (!node || node.status === 'inactive') {
      return result;
    }

    for (const depId of node.dependencies || []) {
      if (depId !== modId) {
        // Don't include self
        result.add(depId);
        // Recursively add transitive deps
        const transitive = this.#collectTransitiveDeps(depId, nodes, visited);
        for (const transitiveId of transitive) {
          result.add(transitiveId);
        }
      }
    }

    return result;
  }
}
