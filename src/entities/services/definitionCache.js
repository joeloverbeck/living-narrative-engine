/**
 * @file DefinitionCache - Caches entity definitions for faster lookup.
 * @description Service responsible for retrieving definitions from the
 *   data registry and caching them for subsequent access.
 */

import { validateDependency } from '../../utils/dependencyUtils.js';
import { ensureValidLogger } from '../../utils/loggerUtils.js';
import { getDefinition as lookupDefinition } from '../utils/definitionLookup.js';

/** @typedef {import('../../interfaces/coreServices.js').IDataRegistry} IDataRegistry */
/** @typedef {import('../../interfaces/coreServices.js').ILogger} ILogger */
/** @typedef {import('../entityDefinition.js').default} EntityDefinition */

/**
 * @class DefinitionCache
 * @description Provides cached access to entity definitions.
 */
export class DefinitionCache {
  /** @type {Map<string, EntityDefinition>} @private */
  #cache;
  /** @type {IDataRegistry} @private */
  #registry;
  /** @type {ILogger} @private */
  #logger;

  /**
   * Construct a new DefinitionCache with registry and logger.
   *
   * @param {object} deps - Dependencies
   * @param {IDataRegistry} deps.registry - Data registry for definitions
   * @param {ILogger} deps.logger - Logger instance
   */
  constructor({ registry, logger }) {
    validateDependency(logger, 'ILogger', console, {
      requiredMethods: ['info', 'error', 'warn', 'debug'],
    });
    validateDependency(registry, 'IDataRegistry', logger, {
      requiredMethods: ['getEntityDefinition'],
    });

    this.#registry = registry;
    this.#logger = ensureValidLogger(logger, 'DefinitionCache');
    this.#cache = new Map();
    this.#logger.debug('DefinitionCache initialized.');
  }

  /**
   * Retrieve a definition by ID, caching the result.
   *
   * @param {string} definitionId - Definition identifier
   * @returns {EntityDefinition|null} The definition or null when missing/invalid
   */
  get(definitionId) {
    if (this.#cache.has(definitionId)) {
      return this.#cache.get(definitionId);
    }

    try {
      const def = lookupDefinition(definitionId, this.#registry, this.#logger);
      this.#cache.set(definitionId, def);
      return def;
    } catch (err) {
      this.#logger.warn(err.message);
      return null;
    }
  }

  /**
   * Check if a definition exists in the cache.
   *
   * @param {string} definitionId - Definition identifier
   * @returns {boolean} True if definition exists in cache
   */
  has(definitionId) {
    return this.#cache.has(definitionId);
  }

  /**
   * Set a definition in the cache.
   *
   * @param {string} definitionId - Definition identifier
   * @param {EntityDefinition} definition - Definition to cache
   */
  set(definitionId, definition) {
    if (!definitionId || typeof definitionId !== 'string') {
      this.#logger.warn('Invalid definition ID provided to set()');
      return;
    }

    if (!definition) {
      this.#logger.warn('Invalid definition provided to set()');
      return;
    }

    this.#cache.set(definitionId, definition);
    this.#logger.debug(`Definition cached: ${definitionId}`);
  }

  /**
   * Clear all cached definitions.
   */
  clear() {
    this.#cache.clear();
  }
}

export default DefinitionCache;
