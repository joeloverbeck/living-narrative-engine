/**
 * @file Unit of Work pattern for anatomy generation operations
 */

import { InvalidArgumentError } from '../../errors/invalidArgumentError.js';
import { AnatomyGenerationError } from './anatomyErrorHandler.js';

/** @typedef {import('../../interfaces/IEntityManager.js').IEntityManager} IEntityManager */
/** @typedef {import('../../interfaces/coreServices.js').ILogger} ILogger */

/**
 * Provides transactional semantics for anatomy generation operations
 * Tracks created entities and allows rollback on failure
 */
export class AnatomyUnitOfWork {
  /** @type {IEntityManager} */
  #entityManager;
  /** @type {ILogger} */
  #logger;
  /** @type {string[]} */
  #createdEntities;
  /** @type {Array<{operation: Function, result: any}>} */
  #operations;
  /** @type {boolean} */
  #isCommitted;
  /** @type {boolean} */
  #isRolledBack;

  /**
   * @param {object} deps
   * @param {IEntityManager} deps.entityManager
   * @param {ILogger} deps.logger
   */
  constructor({ entityManager, logger }) {
    if (!entityManager) {
      throw new InvalidArgumentError('entityManager is required');
    }
    if (!logger) {
      throw new InvalidArgumentError('logger is required');
    }

    this.#entityManager = entityManager;
    this.#logger = logger;
    this.#createdEntities = [];
    this.#operations = [];
    this.#isCommitted = false;
    this.#isRolledBack = false;
  }

  /**
   * Tracks an entity that was created during this unit of work
   *
   * @param {string} entityId - The ID of the created entity
   * @throws {Error} If unit of work has already been committed or rolled back
   */
  trackEntity(entityId) {
    this.#ensureActive();

    if (!entityId) {
      throw new InvalidArgumentError('entityId is required');
    }

    this.#createdEntities.push(entityId);
    this.#logger.debug(
      `AnatomyUnitOfWork: Tracked entity '${entityId}'. Total tracked: ${this.#createdEntities.length}`
    );
  }

  /**
   * Tracks multiple entities that were created during this unit of work
   *
   * @param {string[]} entityIds - Array of entity IDs to track
   */
  trackEntities(entityIds) {
    if (!Array.isArray(entityIds)) {
      throw new InvalidArgumentError('entityIds must be an array');
    }

    entityIds.forEach((id) => this.trackEntity(id));
  }

  /**
   * Executes an operation within the unit of work
   * If the operation fails, automatic rollback is triggered
   *
   * @template T
   * @param {() => Promise<T>} operation - The operation to execute
   * @returns {Promise<T>} The result of the operation
   * @throws {Error} If operation fails or unit of work is not active
   */
  async execute(operation) {
    this.#ensureActive();

    try {
      const result = await operation();
      this.#operations.push({ operation, result });
      return result;
    } catch (error) {
      this.#logger.error(
        'AnatomyUnitOfWork: Operation failed, triggering rollback',
        { error: error.message, trackedEntities: this.#createdEntities.length }
      );
      await this.rollback();
      throw error;
    }
  }

  /**
   * Commits the unit of work, finalizing all operations
   * After commit, no more operations can be performed
   *
   * @returns {Promise<void>}
   */
  async commit() {
    this.#ensureActive();

    this.#logger.debug(
      `AnatomyUnitOfWork: Committing unit of work. Entities created: ${this.#createdEntities.length}, Operations: ${this.#operations.length}`
    );

    this.#isCommitted = true;
    this.#createdEntities = [];
    this.#operations = [];
  }

  /**
   * Rolls back all operations by deleting created entities
   * Entities are deleted in reverse order of creation
   *
   * @returns {Promise<void>}
   */
  async rollback() {
    if (this.#isRolledBack) {
      this.#logger.warn('AnatomyUnitOfWork: Rollback already performed');
      return;
    }

    if (this.#isCommitted) {
      throw new Error('Cannot rollback a committed unit of work');
    }

    this.#logger.info(
      `AnatomyUnitOfWork: Starting rollback. Entities to delete: ${this.#createdEntities.length}`
    );

    const failedDeletions = [];

    // Delete entities in reverse order
    for (const entityId of [...this.#createdEntities].reverse()) {
      try {
        this.#logger.debug(`AnatomyUnitOfWork: Deleting entity '${entityId}'`);

        // Check if entity still exists before trying to delete
        const entity = this.#entityManager.getEntityInstance(entityId);
        if (entity) {
          await this.#entityManager.removeEntityInstance(entityId);
          this.#logger.debug(
            `AnatomyUnitOfWork: Successfully deleted entity '${entityId}'`
          );
        } else {
          this.#logger.debug(
            `AnatomyUnitOfWork: Entity '${entityId}' already removed`
          );
        }
      } catch (error) {
        this.#logger.error(
          `AnatomyUnitOfWork: Failed to delete entity '${entityId}' during rollback`,
          { error: error.message }
        );
        failedDeletions.push({ entityId, error: error.message });
      }
    }

    this.#isRolledBack = true;
    this.#createdEntities = [];
    this.#operations = [];

    if (failedDeletions.length > 0) {
      throw new AnatomyGenerationError(
        `Rollback partially failed. ${failedDeletions.length} entities could not be deleted`,
        null,
        null,
        { failedDeletions }
      );
    }

    this.#logger.info('AnatomyUnitOfWork: Rollback completed successfully');
  }

  /**
   * Returns whether this unit of work has been committed
   *
   * @returns {boolean}
   */
  get isCommitted() {
    return this.#isCommitted;
  }

  /**
   * Returns whether this unit of work has been rolled back
   *
   * @returns {boolean}
   */
  get isRolledBack() {
    return this.#isRolledBack;
  }

  /**
   * Returns the number of entities being tracked
   *
   * @returns {number}
   */
  get trackedEntityCount() {
    return this.#createdEntities.length;
  }

  /**
   * Ensures the unit of work is still active (not committed or rolled back)
   *
   * @private
   * @throws {Error} If unit of work is not active
   */
  #ensureActive() {
    if (this.#isCommitted) {
      throw new Error('Unit of work has already been committed');
    }
    if (this.#isRolledBack) {
      throw new Error('Unit of work has already been rolled back');
    }
  }
}
