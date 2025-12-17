/**
 * @file Dependency graph service for mod management
 * @see src/modding/modLoadOrderResolver.js
 */

import ModLoadOrderResolver from '../../modding/modLoadOrderResolver.js';

/**
 * @typedef {Object} ModNode
 * @property {string} id - Mod identifier
 * @property {string[]} dependencies - Direct dependency IDs
 * @property {string[]} dependents - Mods that depend on this mod
 * @property {'explicit'|'dependency'|'core'|'inactive'} status - Current activation status
 */

/**
 * @typedef {Object} ActivationResult
 * @property {string[]} activated - Mods that will be activated
 * @property {string[]} dependencies - Mods activated as dependencies
 * @property {string[]} conflicts - Conflicting mod IDs (if any)
 * @property {boolean} valid - Whether activation is valid
 * @property {string} [error] - Error message if invalid
 */

/**
 * @typedef {Object} DeactivationResult
 * @property {string[]} deactivated - Mods that will be deactivated
 * @property {string[]} orphaned - Dependencies no longer needed
 * @property {string[]} blocked - Mods that block deactivation (dependents)
 * @property {boolean} valid - Whether deactivation is valid
 * @property {string} [error] - Error message if invalid
 */

/**
 * Service for managing mod dependency graphs
 */
export class ModGraphService {
  #logger;
  #loadOrderResolver;
  #graph;
  #explicitMods;

  /**
   * @param {Object} options
   * @param {Object} options.logger - Logger instance
   */
  constructor({ logger }) {
    if (!logger) {
      throw new Error('ModGraphService: logger is required');
    }
    this.#logger = logger;
    this.#loadOrderResolver = new ModLoadOrderResolver(logger);
    this.#graph = new Map();
    this.#explicitMods = new Set();
  }

  /**
   * Build the dependency graph from mod metadata
   * @param {Array<{id: string, dependencies: Array<{id: string}>}>} mods - Mod metadata array
   */
  buildGraph(mods) {
    this.#logger.info('Building mod dependency graph...');
    this.#graph.clear();

    // Create nodes for all mods
    for (const mod of mods) {
      this.#graph.set(mod.id, {
        id: mod.id,
        dependencies: (mod.dependencies || []).map((d) => d.id),
        dependents: [],
        status: 'inactive',
      });
    }

    // Calculate reverse dependencies (dependents)
    for (const mod of mods) {
      const deps = (mod.dependencies || []).map((d) => d.id);
      for (const depId of deps) {
        const depNode = this.#graph.get(depId);
        if (depNode) {
          depNode.dependents.push(mod.id);
        }
      }
    }

    // Mark core mod
    const coreNode = this.#graph.get('core');
    if (coreNode) {
      coreNode.status = 'core';
    }

    this.#logger.info(`Graph built with ${this.#graph.size} mods`);
  }

  /**
   * Set the currently active explicit mods
   * @param {string[]} modIds - Explicitly activated mod IDs
   */
  setExplicitMods(modIds) {
    this.#explicitMods = new Set(modIds);
    this.#updateStatuses();
  }

  /**
   * Calculate what happens when activating a mod
   * @param {string} modId - Mod to activate
   * @returns {ActivationResult}
   */
  calculateActivation(modId) {
    const node = this.#graph.get(modId);
    if (!node) {
      return {
        activated: [],
        dependencies: [],
        conflicts: [],
        valid: false,
        error: `Unknown mod: ${modId}`,
      };
    }

    if (node.status === 'core') {
      return {
        activated: [],
        dependencies: [],
        conflicts: [],
        valid: false,
        error: 'Core mod is always active',
      };
    }

    // Get all dependencies recursively
    const allDeps = this.#getAllDependencies(modId);
    const newDeps = allDeps.filter((id) => {
      const n = this.#graph.get(id);
      return n && n.status === 'inactive';
    });

    // Check for conflicts (not implemented in current data, placeholder)
    const conflicts = []; // TODO: Implement conflict checking when mod manifests support it

    return {
      activated: [modId],
      dependencies: newDeps,
      conflicts,
      valid: conflicts.length === 0,
    };
  }

  /**
   * Calculate what happens when deactivating a mod
   * @param {string} modId - Mod to deactivate
   * @returns {DeactivationResult}
   */
  calculateDeactivation(modId) {
    const node = this.#graph.get(modId);
    if (!node) {
      return {
        deactivated: [],
        orphaned: [],
        blocked: [],
        valid: false,
        error: `Unknown mod: ${modId}`,
      };
    }

    if (node.status === 'core') {
      return {
        deactivated: [],
        orphaned: [],
        blocked: [],
        valid: false,
        error: 'Core mod cannot be deactivated',
      };
    }

    // Check if any other explicit mods depend on this one
    const blockers = this.#getExplicitDependents(modId);
    if (blockers.length > 0) {
      return {
        deactivated: [],
        orphaned: [],
        blocked: blockers,
        valid: false,
        error: `Cannot deactivate: required by ${blockers.join(', ')}`,
      };
    }

    // Find dependencies that would become orphaned
    const deps = this.#getAllDependencies(modId);
    const orphaned = deps.filter((depId) => {
      if (depId === 'core') return false;
      // Check if any other explicit mod still needs this dependency
      const depNode = this.#graph.get(depId);
      if (!depNode) return false;
      return !depNode.dependents.some((d) => {
        return d !== modId && this.#isActive(d);
      });
    });

    return {
      deactivated: [modId],
      orphaned,
      blocked: [],
      valid: true,
    };
  }

  /**
   * Get load order for active mods using Kahn's algorithm
   * @returns {string[]} Sorted mod IDs
   */
  getLoadOrder() {
    const activeMods = this.#getActiveMods();

    // Build manifestsMap as a Map keyed by lowercase mod ID
    const manifestsMap = new Map();
    for (const [id, node] of this.#graph) {
      manifestsMap.set(id.toLowerCase(), {
        id,
        dependencies: node.dependencies.map((d) => ({ id: d, version: '*' })),
      });
    }

    try {
      // API: resolve(requestedIds: string[], manifestsMap: Map)
      return this.#loadOrderResolver.resolve(activeMods, manifestsMap);
    } catch (error) {
      this.#logger.error('Failed to resolve load order', error);
      return activeMods; // Fallback to unsorted
    }
  }

  /**
   * Get all currently active mods
   * @returns {string[]}
   */
  #getActiveMods() {
    const active = [];
    for (const [id, node] of this.#graph) {
      if (node.status !== 'inactive') {
        active.push(id);
      }
    }
    return active;
  }

  /**
   * Get all dependencies recursively
   * @param {string} modId
   * @returns {string[]}
   */
  #getAllDependencies(modId) {
    const visited = new Set();
    const result = [];

    const visit = (id) => {
      if (visited.has(id)) return;
      visited.add(id);
      const node = this.#graph.get(id);
      if (!node) return;
      for (const depId of node.dependencies) {
        visit(depId);
        if (!result.includes(depId)) {
          result.push(depId);
        }
      }
    };

    visit(modId);
    return result;
  }

  /**
   * Get explicit mods that depend on given mod
   * @param {string} modId
   * @returns {string[]}
   */
  #getExplicitDependents(modId) {
    const result = [];
    for (const explicitId of this.#explicitMods) {
      if (explicitId === modId) continue;
      const deps = this.#getAllDependencies(explicitId);
      if (deps.includes(modId)) {
        result.push(explicitId);
      }
    }
    return result;
  }

  /**
   * Check if a mod is currently active
   * @param {string} modId
   * @returns {boolean}
   */
  #isActive(modId) {
    const node = this.#graph.get(modId);
    return node && node.status !== 'inactive';
  }

  /**
   * Update all mod statuses based on explicit mods
   */
  #updateStatuses() {
    // Reset all non-core to inactive
    for (const [_id, node] of this.#graph) {
      if (node.status !== 'core') {
        node.status = 'inactive';
      }
    }

    // Mark explicit mods
    for (const modId of this.#explicitMods) {
      const node = this.#graph.get(modId);
      if (node && node.status !== 'core') {
        node.status = 'explicit';
      }
    }

    // Mark dependencies
    for (const modId of this.#explicitMods) {
      const deps = this.#getAllDependencies(modId);
      for (const depId of deps) {
        const node = this.#graph.get(depId);
        if (node && node.status === 'inactive') {
          node.status = 'dependency';
        }
      }
    }
  }

  /**
   * Get the current status of a mod
   * @param {string} modId
   * @returns {'explicit'|'dependency'|'core'|'inactive'|'unknown'}
   */
  getModStatus(modId) {
    const node = this.#graph.get(modId);
    return node?.status || 'unknown';
  }

  /**
   * Get all mods with their current statuses
   * @returns {Map<string, ModNode>}
   */
  getAllNodes() {
    return new Map(this.#graph);
  }
}

export default ModGraphService;
