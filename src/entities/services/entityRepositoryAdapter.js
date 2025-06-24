/**
 * @file EntityRepositoryAdapter - Encapsulates entity storage operations
 * @description Provides a clean interface for entity storage operations,
 * wrapping the MapManager functionality with proper error handling and logging.
 */

import { MapManager } from '../../utils/mapManagerUtils.js';
import { validateDependency } from '../../utils/validationUtils.js';
import { ensureValidLogger } from '../../utils/index.js';
import { EntityNotFoundError } from '../../errors/entityNotFoundError.js';
import { DuplicateEntityError } from '../../errors/duplicateEntityError.js';

/** @typedef {import('../entity.js').default} Entity */
/** @typedef {import('../../interfaces/coreServices.js').ILogger} ILogger */

/**
 * @class EntityRepositoryAdapter
 * @description Provides a service layer for entity storage operations,
 * encapsulating MapManager functionality with proper error handling.
 */
export class EntityRepositoryAdapter {
  /** @type {MapManager} @private */
  #mapManager;
  /** @type {ILogger} @private */
  #logger;

  /**
   * @param {object} deps - Dependencies
   * @param {ILogger} deps.logger - Logger instance
   */
  constructor({ logger }) {
    validateDependency(logger, 'ILogger', console, {
      requiredMethods: ['info', 'error', 'warn', 'debug'],
    });
    
    this.#logger = ensureValidLogger(logger, 'EntityRepositoryAdapter');
    this.#mapManager = new MapManager({ throwOnInvalidId: false });
    
    this.#logger.debug('EntityRepositoryAdapter initialized.');
  }

  /**
   * Add an entity to the repository.
   * 
   * @param {Entity} entity - Entity to add
   * @throws {DuplicateEntityError} If entity with same ID already exists
   */
  add(entity) {
    if (this.#mapManager.has(entity.id)) {
      const msg = `Entity with ID '${entity.id}' already exists in repository.`;
      this.#logger.error(msg);
      throw new DuplicateEntityError(entity.id, msg);
    }
    
    this.#mapManager.add(entity.id, entity);
    this.#logger.debug(`Entity '${entity.id}' added to repository.`);
  }

  /**
   * Get an entity by ID.
   * 
   * @param {string} entityId - Entity ID to lookup
   * @returns {Entity|undefined} Entity if found, undefined otherwise
   */
  get(entityId) {
    return this.#mapManager.get(entityId);
  }

  /**
   * Check if an entity exists in the repository.
   * 
   * @param {string} entityId - Entity ID to check
   * @returns {boolean} True if entity exists
   */
  has(entityId) {
    return this.#mapManager.has(entityId);
  }

  /**
   * Remove an entity from the repository.
   * 
   * @param {string} entityId - Entity ID to remove
   * @returns {boolean} True if entity was removed, false if not found
   * @throws {EntityNotFoundError} If entity is not found
   */
  remove(entityId) {
    if (!this.#mapManager.has(entityId)) {
      const msg = `Entity with ID '${entityId}' not found in repository.`;
      this.#logger.error(msg);
      throw new EntityNotFoundError(entityId);
    }
    
    const removed = this.#mapManager.remove(entityId);
    if (removed) {
      this.#logger.debug(`Entity '${entityId}' removed from repository.`);
    }
    return removed;
  }

  /**
   * Clear all entities from the repository.
   */
  clear() {
    this.#mapManager.clear();
    this.#logger.info('All entities cleared from repository.');
  }

  /**
   * Get an iterator over all entities in the repository.
   * 
   * @returns {IterableIterator<Entity>} Iterator over all entities
   */
  entities() {
    return this.#mapManager.values();
  }

  /**
   * Get the count of entities in the repository.
   * 
   * @returns {number} Number of entities
   */
  size() {
    return this.#mapManager.size;
  }
}

export default EntityRepositoryAdapter; 