/**
 * @file Scope Condition Analyzer
 * @description Utility for analyzing scope definitions and extracting condition dependencies
 */

import { createRequire } from 'node:module';
import { existsSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';

const currentFileUrl = fileURLToPath(import.meta.url);
const currentDir = dirname(currentFileUrl);
const localRequire = createRequire(import.meta.url);

/**
 * Utility for analyzing scope definitions and extracting condition dependencies.
 *
 * This class provides static methods for:
 * - Extracting condition_ref references from scope AST structures
 * - Discovering transitive dependencies recursively
 * - Validating that referenced conditions exist
 * - Loading condition definitions with caching
 */
class ScopeConditionAnalyzer {
  /**
   * Cache for loaded condition definitions to avoid redundant file reads
   *
   * @type {Map<string, object>}
   */
  static #conditionCache = new Map();

  /**
   * Extracts all condition_ref references from a scope definition.
   *
   * @param {object|{ast: object, expr: string}} scopeAst - Parsed scope AST from parseScopeDefinitions
   *   Can be either the raw AST object or the full scope data with .ast and .expr properties
   * @returns {Set<string>} Set of condition IDs referenced in the scope (e.g., "positioning:actor-facing")
   * @example
   * const scopeData = {
   *   ast: {
   *     type: 'Filter',
   *     logic: {
   *       and: [
   *         { condition_ref: 'positioning:actor-facing' },
   *         { condition_ref: 'anatomy:has-part' }
   *       ]
   *     }
   *   }
   * };
   *
   * const refs = ScopeConditionAnalyzer.extractConditionRefs(scopeData);
   * // Returns: Set(['positioning:actor-facing', 'anatomy:has-part'])
   */
  static extractConditionRefs(scopeAst) {
    const conditionRefs = new Set();

    /**
     * Recursive function to walk the AST and find condition_ref entries
     *
     * @param {object|Array|string|number|boolean|null} node - Current node in the AST
     */
    const walk = (node) => {
      if (!node || typeof node !== 'object') {
        return;
      }

      // Check if this node is a condition_ref
      if (node.condition_ref) {
        conditionRefs.add(node.condition_ref);
        return;
      }

      // Recursively walk all properties
      for (const value of Object.values(node)) {
        if (Array.isArray(value)) {
          value.forEach(walk);
        } else if (typeof value === 'object') {
          walk(value);
        }
      }
    };

    // Start walking from the AST structure
    // The scopeAst can have multiple forms:
    // 1. Full scope data: { expr: string, ast: object }
    // 2. Raw AST node with logic/filter properties
    // 3. Direct AST object
    if (scopeAst?.ast) {
      walk(scopeAst.ast);
    } else if (scopeAst?.logic || scopeAst?.filter) {
      walk(scopeAst.logic || scopeAst.filter);
    } else {
      walk(scopeAst);
    }

    return conditionRefs;
  }

  /**
   * Recursively discovers all transitive condition dependencies.
   *
   * @param {string[]} conditionIds - Initial condition IDs to start discovery from
   * @param {(id: string) => Promise<object>} dataLoader - Async function to load condition definitions
   * @param {number} [maxDepth] - Maximum recursion depth to prevent infinite loops
   * @returns {Promise<Set<string>>} All condition IDs including transitive dependencies
   * @example
   * const allConditions = await ScopeConditionAnalyzer.discoverTransitiveDependencies(
   *   ['positioning:actor-facing'],
   *   ScopeConditionAnalyzer.loadConditionDefinition.bind(ScopeConditionAnalyzer),
   *   5
   * );
   */
  static async discoverTransitiveDependencies(
    conditionIds,
    dataLoader,
    maxDepth = 5
  ) {
    const discovered = new Set(conditionIds);
    const toProcess = [...conditionIds];
    let depth = 0;

    while (toProcess.length > 0 && depth < maxDepth) {
      const currentId = toProcess.shift();

      try {
        // Load the condition definition
        const conditionDef = await dataLoader(currentId);

        // Extract nested condition_refs from this condition's logic
        const nested = this.extractConditionRefs(conditionDef);

        // Add new discoveries to processing queue
        for (const nestedId of nested) {
          if (!discovered.has(nestedId)) {
            discovered.add(nestedId);
            toProcess.push(nestedId);
          }
        }
      } catch {
        // Condition doesn't exist or can't be loaded
        // Will be caught by validation later
        continue;
      }

      depth++;
    }

    if (depth >= maxDepth) {
      // eslint-disable-next-line no-console
      console.warn(
        `Reached max recursion depth (${maxDepth}) while discovering condition dependencies. ` +
          `This may indicate circular references.`
      );
    }

    return discovered;
  }

  /**
   * Validates that all referenced conditions exist.
   *
   * @param {Set<string>|string[]} conditionIds - Condition IDs to validate
   * @param {string} _scopePath - Path to scope file (for error messages, currently unused)
   * @returns {Promise<{valid: string[], missing: string[]}>} Results object with valid and missing condition lists
   * @example
   * const validation = await ScopeConditionAnalyzer.validateConditions(
   *   new Set(['positioning:actor-facing', 'positioning:nonexistent']),
   *   'data/mods/my-mod/scopes/my-scope.scope'
   * );
   * // Returns: { valid: ['positioning:actor-facing'], missing: ['positioning:nonexistent'] }
   */
  static async validateConditions(conditionIds, _scopePath) {
    const results = { valid: [], missing: [] };
    const idsArray = Array.isArray(conditionIds)
      ? conditionIds
      : Array.from(conditionIds);

    for (const id of idsArray) {
      if (!id || typeof id !== 'string' || !id.includes(':')) {
        results.missing.push(id);
        continue;
      }

      const [modId, conditionName] = id.split(':');
      const conditionPath = resolve(
        currentDir,
        `../../../data/mods/${modId}/conditions/${conditionName}.condition.json`
      );

      if (existsSync(conditionPath)) {
        results.valid.push(id);
      } else {
        results.missing.push(id);
      }
    }

    return results;
  }

  /**
   * Loads a condition definition from the file system.
   *
   * Uses caching to avoid redundant file reads. The cache persists for the
   * lifetime of the test suite unless explicitly cleared.
   *
   * @param {string} conditionId - Condition ID in format "modId:conditionName"
   * @returns {Promise<object>} Loaded condition definition
   * @throws {Error} If condition file cannot be loaded or ID format is invalid
   * @example
   * const condition = await ScopeConditionAnalyzer.loadConditionDefinition(
   *   'positioning:actor-in-entity-facing-away'
   * );
   */
  static async loadConditionDefinition(conditionId) {
    // Check cache first
    if (this.#conditionCache.has(conditionId)) {
      return this.#conditionCache.get(conditionId);
    }

    // Validate ID format
    if (!conditionId || typeof conditionId !== 'string' || !conditionId.includes(':')) {
      throw new Error(
        `Invalid condition ID format: "${conditionId}". Expected "modId:conditionId"`
      );
    }

    const [modId, conditionName] = conditionId.split(':');
    const conditionPath = resolve(
      currentDir,
      `../../../data/mods/${modId}/conditions/${conditionName}.condition.json`
    );

    try {
      // Use localRequire for JSON import
      const definition = localRequire(conditionPath);

      // Cache the definition
      this.#conditionCache.set(conditionId, definition);

      return definition;
    } catch (err) {
      throw new Error(
        `Failed to load condition "${conditionId}" from ${conditionPath}: ${err.message}`
      );
    }
  }

  /**
   * Clears the condition definition cache.
   *
   * This is useful between test runs to ensure fresh data is loaded.
   *
   * @example
   * afterEach(() => {
   *   ScopeConditionAnalyzer.clearCache();
   * });
   */
  static clearCache() {
    this.#conditionCache.clear();
  }
}

export default ScopeConditionAnalyzer;
