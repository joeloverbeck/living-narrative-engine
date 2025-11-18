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
  #anatomyGenerationService;
  #eventDispatcher;
  #logger;
  #isInitialized = false;
  #unsubscribeEntityCreated = null;
  #pendingGenerations = new Set(); // Currently processing generations
  #generationPromises = new Map(); // Track generation promises for waiting

  // Queue for sequential anatomy generation
  #generationQueue = [];
  #isProcessingQueue = false;

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

    // Add to queue instead of processing immediately
    this.#generationQueue.push(instanceId);
    this.#logger.debug(
      `AnatomyInitializationService: Added entity '${instanceId}' to generation queue (queue size: ${this.#generationQueue.length})`
    );

    // Start processing the queue if not already processing
    if (!this.#isProcessingQueue) {
      // Set the flag synchronously to avoid race condition
      this.#isProcessingQueue = true;
      this.#processQueue();
    }
  }

  /**
   * Process the anatomy generation queue sequentially
   *
   * @private
   */
  async #processQueue() {
    // Note: #isProcessingQueue is already set by the caller to avoid race conditions
    // If somehow this method is called directly without the flag set, ensure it's set
    if (!this.#isProcessingQueue) {
      this.#isProcessingQueue = true;
    }

    while (this.#generationQueue.length > 0) {
      const instanceId = this.#generationQueue.shift();

      try {
        // Mark as pending before starting generation
        this.#pendingGenerations.add(instanceId);
        this.#logger.debug(
          `AnatomyInitializationService: Processing anatomy generation for entity '${instanceId}' (remaining in queue: ${this.#generationQueue.length})`
        );

        // Wait for this generation to complete before processing next
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

    this.#isProcessingQueue = false;
    this.#logger.debug(
      'AnatomyInitializationService: Finished processing anatomy generation queue'
    );
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
    // Wait for queue to be empty and no pending generations
    const startTime = Date.now();
    const deadline = startTime + timeoutMs;
    let lastObservedQueueSize = this.#generationQueue.length;
    let lastObservedPendingSize = this.#pendingGenerations.size;

    while (
      this.#generationQueue.length > 0 ||
      this.#pendingGenerations.size > 0 ||
      this.#isProcessingQueue
    ) {
      const now = Date.now();
      if (now > deadline) {
        throw new Error(
          `AnatomyInitializationService: Timeout waiting for anatomy generation to complete. Queue: ${lastObservedQueueSize}, Pending: ${lastObservedPendingSize}`
        );
      }

      lastObservedQueueSize = this.#generationQueue.length;
      lastObservedPendingSize = this.#pendingGenerations.size;

      const remaining = deadline - now;
      if (remaining <= 0) {
        throw new Error(
          `AnatomyInitializationService: Timeout waiting for anatomy generation to complete. Queue: ${lastObservedQueueSize}, Pending: ${lastObservedPendingSize}`
        );
      }

      const delay = Math.min(50, remaining);
      await new Promise((resolve) => setTimeout(resolve, Math.max(1, delay)));

      if (Date.now() > deadline) {
        throw new Error(
          `AnatomyInitializationService: Timeout waiting for anatomy generation to complete. Queue: ${lastObservedQueueSize}, Pending: ${lastObservedPendingSize}`
        );
      }
    }

    this.#logger.debug(
      'AnatomyInitializationService: All anatomy generations completed'
    );
  }

  /**
   * Waits for anatomy generation to complete for a specific entity
   *
   * @param {string} entityId - The entity instance ID to wait for
   * @param {number} [timeoutMs] - Timeout in milliseconds
   * @returns {Promise<boolean>} Resolves with whether anatomy was generated
   * @throws {Error} If timeout is reached or generation fails
   */
  async waitForEntityGeneration(entityId, timeoutMs = 5000) {
    // If not pending, return immediately
    if (!this.#pendingGenerations.has(entityId)) {
      return false;
    }

    // Create a promise to wait for this specific generation
    return new Promise((resolve, reject) => {
      if (!this.#generationPromises.has(entityId)) {
        this.#generationPromises.set(entityId, []);
      }

      let timeoutId = null;

      const resolveWithCleanup = (value) => {
        if (timeoutId !== null) {
          clearTimeout(timeoutId);
          timeoutId = null;
        }
        resolve(value);
      };

      const rejectWithCleanup = (error) => {
        if (timeoutId !== null) {
          clearTimeout(timeoutId);
          timeoutId = null;
        }
        reject(error);
      };

      const callbacks = {
        resolve: resolveWithCleanup,
        reject: rejectWithCleanup,
      };

      const waiters = this.#generationPromises.get(entityId);
      waiters.push(callbacks);

      timeoutId = setTimeout(() => {
        const updatedWaiters = this.#generationPromises.get(entityId);
        if (updatedWaiters) {
          const index = updatedWaiters.indexOf(callbacks);
          if (index !== -1) {
            updatedWaiters.splice(index, 1);
          }
          if (updatedWaiters.length === 0) {
            this.#generationPromises.delete(entityId);
          }
        }
        reject(
          new Error(
            `AnatomyInitializationService: Timeout waiting for anatomy generation for entity '${entityId}'`
          )
        );
      }, timeoutMs);
    });
  }

  /**
   * Resolves generation promises for a completed entity
   *
   * @param entityId
   * @param wasGenerated
   * @private
   */
  #resolveGenerationPromise(entityId, wasGenerated) {
    if (this.#generationPromises.has(entityId)) {
      const promises = this.#generationPromises.get(entityId);
      promises.forEach(({ resolve }) => resolve(wasGenerated));
      this.#generationPromises.delete(entityId);
    }
  }

  /**
   * Rejects generation promises for a failed entity
   *
   * @param entityId
   * @param error
   * @private
   */
  #rejectGenerationPromise(entityId, error) {
    if (this.#generationPromises.has(entityId)) {
      const promises = this.#generationPromises.get(entityId);
      promises.forEach(({ reject }) => reject(error));
      this.#generationPromises.delete(entityId);
    }
  }

  /**
   * Checks if anatomy generation is currently pending for any entity
   *
   * @returns {boolean} True if any generations are pending
   */
  hasPendingGenerations() {
    return (
      this.#pendingGenerations.size > 0 || this.#generationQueue.length > 0
    );
  }

  /**
   * Gets the current number of pending anatomy generations
   *
   * @returns {number} The number of pending generations
   */
  getPendingGenerationCount() {
    return this.#pendingGenerations.size + this.#generationQueue.length;
  }

  /**
   * Cleans up the service
   */
  destroy() {
    if (this.#unsubscribeEntityCreated) {
      this.#unsubscribeEntityCreated();
      this.#unsubscribeEntityCreated = null;
    }

    // Clear any pending operations
    this.#pendingGenerations.clear();
    this.#generationPromises.clear();
    this.#generationQueue.length = 0;
    this.#isProcessingQueue = false;
    this.#isInitialized = false;

    this.#logger.info('AnatomyInitializationService: Destroyed');
  }

  /**
   * @description Test-only helper that directly manipulates the internal queue and pending state.
   * @param {object} [state] - Desired state overrides.
   * @param {string[]} [state.queue] - Entity IDs that should be present in the generation queue.
   * @param {string[]} [state.pending] - Entity IDs that should be marked as pending generations.
   * @param {boolean} [state.processing] - Whether the service should consider the queue as currently processing.
   * @returns {void}
   */
  __TEST_ONLY__setInternalState({ queue, pending, processing } = {}) {
    if (Array.isArray(queue)) {
      this.#generationQueue.length = 0;
      queue.forEach((id) => this.#generationQueue.push(id));
    }

    if (Array.isArray(pending)) {
      this.#pendingGenerations.clear();
      pending.forEach((id) => this.#pendingGenerations.add(id));
    }

    if (typeof processing === 'boolean') {
      this.#isProcessingQueue = processing;
    }
  }

  /**
   * @description Test-only helper that executes the internal queue processor.
   * @param {{ ensureProcessingFlag?: boolean }} [options] - Behaviour customization options.
   * @returns {Promise<void>} Resolves once queue processing has completed.
   */
  async __TEST_ONLY__processQueue({ ensureProcessingFlag = false } = {}) {
    if (ensureProcessingFlag) {
      this.#isProcessingQueue = false;
    }

    await this.#processQueue();
  }
}
