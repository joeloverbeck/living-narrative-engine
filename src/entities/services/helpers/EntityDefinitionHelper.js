/**
 * @file EntityDefinitionHelper - Handles entity definition operations
 * @module EntityDefinitionHelper
 */

import { validateDependency } from '../../../utils/dependencyUtils.js';
import { ensureValidLogger } from '../../../utils/loggerUtils.js';
import { DefinitionNotFoundError } from '../../../errors/definitionNotFoundError.js';

/** @typedef {import('../../../interfaces/coreServices.js').ILogger} ILogger */
/** @typedef {import('../../../interfaces/coreServices.js').IDataRegistry} IDataRegistry */
/** @typedef {import('../definitionCache.js').DefinitionCache} DefinitionCache */
/** @typedef {import('../../entityDefinition.js').default} EntityDefinition */

/**
 * @class EntityDefinitionHelper
 * @description Handles entity definition retrieval and caching operations
 */
export default class EntityDefinitionHelper {
  /** @type {IDataRegistry} */
  #registry;
  /** @type {DefinitionCache} */
  #definitionCache;
  /** @type {ILogger} */
  #logger;

  /**
   * @class
   * @param {object} deps - Dependencies
   * @param {IDataRegistry} deps.registry - Data registry
   * @param {DefinitionCache} deps.definitionCache - Definition cache
   * @param {ILogger} deps.logger - Logger instance
   */
  constructor({ registry, definitionCache, logger }) {
    validateDependency(logger, 'ILogger', console, {
      requiredMethods: ['info', 'error', 'warn', 'debug'],
    });
    this.#logger = ensureValidLogger(logger, 'EntityDefinitionHelper');

    validateDependency(registry, 'IDataRegistry', this.#logger, {
      requiredMethods: ['getEntityDefinition'],
    });
    this.#registry = registry;

    validateDependency(definitionCache, 'DefinitionCache', this.#logger, {
      requiredMethods: ['get', 'set', 'has', 'clear'],
    });
    this.#definitionCache = definitionCache;
  }

  /**
   * Retrieves an entity definition for creation operations.
   *
   * @param {string} definitionId - Entity definition ID
   * @returns {EntityDefinition} The entity definition
   * @throws {DefinitionNotFoundError} If the definition is missing
   */
  getDefinitionForCreate(definitionId) {
    let definition = this.#definitionCache.get(definitionId);
    
    if (!definition) {
      this.#logger.debug(`Definition '${definitionId}' not in cache, fetching from registry`);
      
      try {
        definition = this.#registry.getEntityDefinition(definitionId);
        
        if (definition) {
          this.#definitionCache.set(definitionId, definition);
          this.#logger.debug(`Cached definition '${definitionId}'`);
        }
      } catch (error) {
        this.#logger.error(`Failed to fetch definition '${definitionId}' from registry:`, error);
        throw new DefinitionNotFoundError(definitionId);
      }
    }

    if (!definition) {
      this.#logger.warn(`Definition '${definitionId}' not found in registry`);
      throw new DefinitionNotFoundError(definitionId);
    }

    return definition;
  }

  /**
   * Retrieves an entity definition for reconstruction operations.
   *
   * @param {string} definitionId - Entity definition ID
   * @returns {EntityDefinition} The entity definition
   * @throws {DefinitionNotFoundError} If the definition is missing
   */
  getDefinitionForReconstruct(definitionId) {
    // Same logic as create, but with different logging context
    this.#logger.debug(`Retrieving definition '${definitionId}' for reconstruction`);
    return this.getDefinitionForCreate(definitionId);
  }

  /**
   * Checks if a definition exists in the cache or registry.
   *
   * @param {string} definitionId - Entity definition ID
   * @returns {boolean} True if definition exists
   */
  hasDefinition(definitionId) {
    // Check cache first
    if (this.#definitionCache.has(definitionId)) {
      return true;
    }

    // Check registry
    try {
      const definition = this.#registry.getEntityDefinition(definitionId);
      if (definition) {
        // Cache it for future use
        this.#definitionCache.set(definitionId, definition);
        return true;
      }
    } catch (error) {
      this.#logger.debug(`Definition '${definitionId}' not found in registry:`, error);
    }

    return false;
  }

  /**
   * Preloads definitions into the cache.
   *
   * @param {string[]} definitionIds - Array of definition IDs to preload
   * @returns {object} Results of preloading operations
   */
  preloadDefinitions(definitionIds) {
    const results = {
      loaded: [],
      failed: [],
      alreadyCached: [],
    };

    for (const definitionId of definitionIds) {
      try {
        if (this.#definitionCache.has(definitionId)) {
          results.alreadyCached.push(definitionId);
          continue;
        }

        const definition = this.#registry.getEntityDefinition(definitionId);
        if (definition) {
          this.#definitionCache.set(definitionId, definition);
          results.loaded.push(definitionId);
        } else {
          results.failed.push(definitionId);
        }
      } catch (error) {
        this.#logger.debug(`Failed to preload definition '${definitionId}':`, error);
        results.failed.push(definitionId);
      }
    }

    this.#logger.debug('Preloaded definitions', {
      loaded: results.loaded.length,
      failed: results.failed.length,
      alreadyCached: results.alreadyCached.length,
    });

    return results;
  }

  /**
   * Validates that a definition has required properties.
   *
   * @param {EntityDefinition} definition - Definition to validate
   * @param {string} definitionId - Definition ID for error context
   * @throws {Error} If definition is invalid
   */
  validateDefinition(definition, definitionId) {
    if (!definition || typeof definition !== 'object') {
      throw new Error(`Definition '${definitionId}' is not a valid object`);
    }

    // Check for required properties
    const requiredProperties = ['id', 'components'];
    for (const prop of requiredProperties) {
      if (!(prop in definition)) {
        throw new Error(`Definition '${definitionId}' missing required property: ${prop}`);
      }
    }

    // Validate ID matches
    if (definition.id !== definitionId) {
      throw new Error(`Definition ID mismatch: expected '${definitionId}', got '${definition.id}'`);
    }

    // Validate components structure
    if (definition.components && typeof definition.components !== 'object') {
      throw new Error(`Definition '${definitionId}' has invalid components structure`);
    }
  }

  /**
   * Gets cache statistics.
   *
   * @returns {object} Cache statistics
   */
  getCacheStats() {
    if (typeof this.#definitionCache.getStats === 'function') {
      return this.#definitionCache.getStats();
    }
    return {
      size: this.#definitionCache.size || 0,
      hits: 0,
      misses: 0,
    };
  }

  /**
   * Clears the definition cache.
   */
  clearCache() {
    this.#definitionCache.clear();
    this.#logger.debug('Definition cache cleared');
  }

  /**
   * Gets all cached definition IDs.
   *
   * @returns {string[]} Array of cached definition IDs
   */
  getCachedDefinitionIds() {
    if (typeof this.#definitionCache.keys === 'function') {
      return Array.from(this.#definitionCache.keys());
    }
    return [];
  }
}