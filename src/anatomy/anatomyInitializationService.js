// src/anatomy/anatomyInitializationService.js

/**
 * @file Service that listens for entity creation events and generates anatomy when needed
 */

import { ENTITY_CREATED_ID } from '../constants/eventIds.js';
import { InvalidArgumentError } from '../errors/invalidArgumentError.js';

/** @typedef {import('../interfaces/ISafeEventDispatcher.js').ISafeEventDispatcher} ISafeEventDispatcher */
/** @typedef {import('../interfaces/coreServices.js').ILogger} ILogger */
/** @typedef {import('./anatomyGenerationService.js').AnatomyGenerationService} AnatomyGenerationService */

/**
 * Service that automatically generates anatomy for entities when they are created
 */
export class AnatomyInitializationService {
  /** @type {ISafeEventDispatcher} */
  #eventDispatcher;
  /** @type {ILogger} */
  #logger;
  /** @type {AnatomyGenerationService} */
  #anatomyGenerationService;
  /** @type {boolean} */
  #isInitialized = false;
  /** @type {(() => void) | null} */
  #unsubscribeEntityCreated = null;
  /** @type {Set<string>} */
  #pendingGenerations = new Set();
  /** @type {Map<string, {resolve: Function, reject: Function}>} */
  #generationPromises = new Map();

  /**
   * @param {object} deps
   * @param {ISafeEventDispatcher} deps.eventDispatcher - Event dispatcher for listening to entity creation events
   * @param {ILogger} deps.logger - Logger for debugging and error messages
   * @param {AnatomyGenerationService} deps.anatomyGenerationService - Service that handles anatomy generation
   */
  constructor({ eventDispatcher, logger, anatomyGenerationService }) {
    if (!eventDispatcher)
      throw new InvalidArgumentError('eventDispatcher is required');
    if (!logger) throw new InvalidArgumentError('logger is required');
    if (!anatomyGenerationService)
      throw new InvalidArgumentError('anatomyGenerationService is required');

    this.#eventDispatcher = eventDispatcher;
    this.#logger = logger;
    this.#anatomyGenerationService = anatomyGenerationService;
  }

  /**
   * Initializes the service by registering event listeners
   */
  initialize() {
    if (this.#isInitialized) {
      this.#logger.warn('AnatomyInitializationService: Already initialized');
      return;
    }

    this.#logger.debug(
      'AnatomyInitializationService: Registering event listeners'
    );

    // Listen for entity creation events
    this.#unsubscribeEntityCreated = this.#eventDispatcher.subscribe(
      ENTITY_CREATED_ID,
      this.#handleEntityCreated.bind(this)
    );

    this.#isInitialized = true;
    this.#logger.info('AnatomyInitializationService: Initialized');
  }

  /**
   * Handles entity creation events
   *
   * @param {object} event - The event object from EventBus
   * @param {string} event.type - The event type
   * @param {object} event.payload - The event payload
   * @param {string} event.payload.instanceId - The entity instance ID
   * @param {string} event.payload.definitionId - The entity definition ID
   * @param {boolean} event.payload.wasReconstructed - Whether this was a reconstruction
   * @private
   */
  async #handleEntityCreated(event) {
    // Extract payload from the event object
    const payload = event.payload || event;

    // Skip reconstructed entities as they should already have their anatomy
    if (payload.wasReconstructed) {
      return;
    }

    const { instanceId } = payload;
    if (!instanceId) {
      this.#logger.warn(
        'AnatomyInitializationService: Entity created event missing instanceId'
      );
      return;
    }

    try {
      // Mark as pending before starting generation
      this.#pendingGenerations.add(instanceId);
      this.#logger.debug(
        `AnatomyInitializationService: Starting anatomy generation for entity '${instanceId}'`
      );

      // Attempt to generate anatomy for the newly created entity
      const wasGenerated =
        await this.#anatomyGenerationService.generateAnatomyIfNeeded(
          instanceId
        );

      if (wasGenerated) {
        this.#logger.info(
          `AnatomyInitializationService: Generated anatomy for entity '${instanceId}'`
        );
      }

      // Mark as completed and resolve any waiting promises
      this.#pendingGenerations.delete(instanceId);
      this.#resolveGenerationPromise(instanceId, wasGenerated);
    } catch (error) {
      this.#logger.error(
        `AnatomyInitializationService: Failed to generate anatomy for entity '${instanceId}'`,
        { error }
      );
      
      // Mark as completed even on error and reject any waiting promises
      this.#pendingGenerations.delete(instanceId);
      this.#rejectGenerationPromise(instanceId, error);
      
      // Don't throw - we don't want to break entity creation if anatomy generation fails
    }
  }

  /**
   * Generate anatomy for a specific entity with a given blueprint
   *
   * @param {string} entityId - The entity instance ID
   * @param {string} blueprintId - The anatomy blueprint ID to use
   * @returns {Promise<boolean>} True if anatomy was generated successfully
   */
  async generateAnatomy(entityId, blueprintId) {
    try {
      this.#logger.debug(
        `AnatomyInitializationService: Generating anatomy for entity '${entityId}' with blueprint '${blueprintId}'`
      );

      // For now, delegate to the generation service
      // In the future, we might need to pass blueprint info differently
      const wasGenerated =
        await this.#anatomyGenerationService.generateAnatomyIfNeeded(entityId);

      if (wasGenerated) {
        this.#logger.info(
          `AnatomyInitializationService: Successfully generated anatomy for entity '${entityId}' with blueprint '${blueprintId}'`
        );
      }

      return wasGenerated;
    } catch (error) {
      this.#logger.error(
        `AnatomyInitializationService: Failed to generate anatomy for entity '${entityId}' with blueprint '${blueprintId}'`,
        { error }
      );
      throw error;
    }
  }

  /**
   * Waits for anatomy generation to complete for all pending entities
   * 
   * @param {number} [timeoutMs] - Timeout in milliseconds
   * @returns {Promise<void>} Resolves when all pending generations complete
   * @throws {Error} If timeout is reached or generation fails
   */
  async waitForAllGenerationsToComplete(timeoutMs = 10000) {
    if (this.#pendingGenerations.size === 0) {
      this.#logger.debug(
        'AnatomyInitializationService: No pending anatomy generations'
      );
      return;
    }

    this.#logger.debug(
      `AnatomyInitializationService: Waiting for ${this.#pendingGenerations.size} anatomy generations to complete`
    );

    const pendingEntityIds = Array.from(this.#pendingGenerations);
    const promises = pendingEntityIds.map(entityId => this.#getGenerationPromise(entityId));
    
    try {
      await Promise.race([
        Promise.allSettled(promises),
        new Promise((_, reject) => 
          setTimeout(() => reject(new Error(`Anatomy generation timeout after ${timeoutMs}ms`)), timeoutMs)
        )
      ]);

      this.#logger.info(
        'AnatomyInitializationService: All anatomy generations completed'
      );
    } catch (error) {
      this.#logger.error(
        'AnatomyInitializationService: Failed to wait for anatomy generations',
        { error, pendingCount: this.#pendingGenerations.size }
      );
      throw error;
    }
  }

  /**
   * Gets the count of pending anatomy generations
   * 
   * @returns {number} Number of pending generations
   */
  getPendingGenerationCount() {
    return this.#pendingGenerations.size;
  }

  /**
   * Gets a promise that resolves when anatomy generation completes for a specific entity
   * 
   * @private
   * @param {string} entityId - The entity ID
   * @returns {Promise<boolean>} Promise that resolves with generation result
   */
  #getGenerationPromise(entityId) {
    if (!this.#generationPromises.has(entityId)) {
      const promiseHandlers = {};
      const promise = new Promise((resolve, reject) => {
        promiseHandlers.resolve = resolve;
        promiseHandlers.reject = reject;
      });
      promiseHandlers.promise = promise;
      this.#generationPromises.set(entityId, promiseHandlers);
    }
    return this.#generationPromises.get(entityId).promise;
  }

  /**
   * Resolves the generation promise for an entity
   * 
   * @private
   * @param {string} entityId - The entity ID
   * @param {boolean} wasGenerated - Whether anatomy was generated
   */
  #resolveGenerationPromise(entityId, wasGenerated) {
    const promiseHandlers = this.#generationPromises.get(entityId);
    if (promiseHandlers) {
      promiseHandlers.resolve(wasGenerated);
      this.#generationPromises.delete(entityId);
    }
  }

  /**
   * Rejects the generation promise for an entity
   * 
   * @private
   * @param {string} entityId - The entity ID
   * @param {Error} error - The error that occurred
   */
  #rejectGenerationPromise(entityId, error) {
    const promiseHandlers = this.#generationPromises.get(entityId);
    if (promiseHandlers) {
      promiseHandlers.reject(error);
      this.#generationPromises.delete(entityId);
    }
  }

  /**
   * Disposes of the service by removing event listeners
   */
  dispose() {
    if (!this.#isInitialized) {
      return;
    }

    this.#logger.debug(
      'AnatomyInitializationService: Removing event listeners'
    );

    if (this.#unsubscribeEntityCreated) {
      this.#unsubscribeEntityCreated();
      this.#unsubscribeEntityCreated = null;
    }

    // Clean up any remaining promises
    for (const [entityId, promiseHandlers] of this.#generationPromises) {
      promiseHandlers.reject(new Error('Service disposed'));
    }
    this.#generationPromises.clear();
    this.#pendingGenerations.clear();

    this.#isInitialized = false;
    this.#logger.info('AnatomyInitializationService: Disposed');
  }
}
