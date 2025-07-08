/**
 * @file EntityEventDispatcher - Handles event dispatching for entity lifecycle operations
 * @module EntityEventDispatcher
 */

import { validateDependency } from '../../../utils/dependencyUtils.js';
import { ensureValidLogger } from '../../../utils/loggerUtils.js';
import {
  ENTITY_CREATED_ID,
  ENTITY_REMOVED_ID,
} from '../../../constants/eventIds.js';

/** @typedef {import('../../../interfaces/coreServices.js').ILogger} ILogger */
/** @typedef {import('../../../interfaces/ISafeEventDispatcher.js').ISafeEventDispatcher} ISafeEventDispatcher */

/**
 * @class EntityEventDispatcher
 * @description Handles event dispatching for entity lifecycle operations
 */
export default class EntityEventDispatcher {
  /** @type {ISafeEventDispatcher} */
  #eventDispatcher;
  /** @type {ILogger} */
  #logger;

  /**
   * @class
   * @param {object} deps - Dependencies
   * @param {ISafeEventDispatcher} deps.eventDispatcher - Event dispatcher
   * @param {ILogger} deps.logger - Logger instance
   */
  constructor({ eventDispatcher, logger }) {
    validateDependency(logger, 'ILogger', console, {
      requiredMethods: ['info', 'error', 'warn', 'debug'],
    });
    this.#logger = ensureValidLogger(logger, 'EntityEventDispatcher');

    validateDependency(eventDispatcher, 'ISafeEventDispatcher', this.#logger, {
      requiredMethods: ['dispatch'],
    });
    this.#eventDispatcher = eventDispatcher;
  }

  /**
   * Dispatches the ENTITY_CREATED event.
   *
   * @param {object} entity - Newly created entity
   * @param {boolean} wasReconstructed - Flag indicating reconstruction
   */
  dispatchEntityCreated(entity, wasReconstructed) {
    const eventData = {
      instanceId: entity.id,
      definitionId: entity.definitionId,
      wasReconstructed,
      entity,
    };

    this.#logger.debug('Dispatching ENTITY_CREATED event', {
      instanceId: entity.id,
      definitionId: entity.definitionId,
      wasReconstructed,
    });

    try {
      this.#eventDispatcher.dispatch(ENTITY_CREATED_ID, eventData);
    } catch (error) {
      this.#logger.error('Failed to dispatch ENTITY_CREATED event', {
        instanceId: entity.id,
        error: error.message,
      });
      throw error;
    }
  }

  /**
   * Dispatches the ENTITY_REMOVED event.
   *
   * @param {object} entity - Removed entity
   */
  dispatchEntityRemoved(entity) {
    const eventData = {
      instanceId: entity.id,
      definitionId: entity.definitionId,
      entity,
    };

    this.#logger.debug('Dispatching ENTITY_REMOVED event', {
      instanceId: entity.id,
      definitionId: entity.definitionId,
    });

    try {
      this.#eventDispatcher.dispatch(ENTITY_REMOVED_ID, eventData);
    } catch (error) {
      this.#logger.error('Failed to dispatch ENTITY_REMOVED event', {
        instanceId: entity.id,
        error: error.message,
      });
      throw error;
    }
  }

  /**
   * Dispatches a custom entity lifecycle event.
   *
   * @param {string} eventType - Event type identifier
   * @param {object} eventData - Event data
   * @param {string} [context] - Optional context for logging
   */
  dispatchCustomEvent(eventType, eventData, context = '') {
    this.#logger.debug('Dispatching custom entity event', {
      eventType,
      context,
      instanceId: eventData.instanceId,
    });

    try {
      this.#eventDispatcher.dispatch(eventType, eventData);
    } catch (error) {
      this.#logger.error('Failed to dispatch custom entity event', {
        eventType,
        context,
        instanceId: eventData.instanceId,
        error: error.message,
      });
      throw error;
    }
  }

  /**
   * Dispatches multiple events in sequence.
   *
   * @param {Array<{eventType: string, eventData: object}>} events - Events to dispatch
   * @param {string} [context] - Optional context for logging
   */
  dispatchMultipleEvents(events, context = '') {
    this.#logger.debug('Dispatching multiple entity events', {
      count: events.length,
      context,
    });

    const results = [];
    for (const { eventType, eventData } of events) {
      try {
        this.#eventDispatcher.dispatch(eventType, eventData);
        results.push({ eventType, success: true });
      } catch (error) {
        this.#logger.error('Failed to dispatch event in batch', {
          eventType,
          context,
          error: error.message,
        });
        results.push({ eventType, success: false, error });
      }
    }

    return results;
  }

  /**
   * Checks if the event dispatcher is available.
   *
   * @returns {boolean} True if event dispatcher is available
   */
  isAvailable() {
    return this.#eventDispatcher && typeof this.#eventDispatcher.dispatch === 'function';
  }

  /**
   * Gets event dispatcher statistics (if available).
   *
   * @returns {object | null} Event dispatcher statistics or null
   */
  getStats() {
    if (this.#eventDispatcher && typeof this.#eventDispatcher.getStats === 'function') {
      return this.#eventDispatcher.getStats();
    }
    return null;
  }
}