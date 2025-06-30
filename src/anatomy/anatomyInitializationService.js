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
    } catch (error) {
      this.#logger.error(
        `AnatomyInitializationService: Failed to generate anatomy for entity '${instanceId}'`,
        { error }
      );
      // Don't throw - we don't want to break entity creation if anatomy generation fails
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

    this.#isInitialized = false;
    this.#logger.info('AnatomyInitializationService: Disposed');
  }
}
