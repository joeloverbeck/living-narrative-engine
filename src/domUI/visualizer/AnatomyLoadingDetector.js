/**
 * @file Replaces 100ms timeout hack with proper anatomy generation detection
 * @see AnatomyVisualizerUI.js
 */

import { validateDependency } from '../../utils/index.js';
import { ENTITY_CREATED_ID } from '../../constants/eventIds.js';

/**
 * Default configuration for anatomy loading detection
 *
 * @readonly
 */
const DEFAULT_CONFIG = {
  timeout: 5000, // 5 seconds max wait
  retryInterval: 100, // Start with 100ms
  maxRetries: 20,
  useExponentialBackoff: true,
  backoffMultiplier: 1.5,
  maxRetryInterval: 1000, // Cap at 1 second
};

/**
 * Provides reliable detection of anatomy generation completion, replacing
 * the problematic 100ms timeout hack with proper event-driven detection.
 *
 * @class AnatomyLoadingDetector
 */
class AnatomyLoadingDetector {
  #entityManager;
  #eventDispatcher;
  #logger;
  #activeSubscriptions;
  #disposed;

  /**
   * Creates a new AnatomyLoadingDetector instance
   *
   * @param {object} dependencies - Required dependencies
   * @param {object} dependencies.entityManager - Entity management service
   * @param {object} dependencies.eventDispatcher - Event dispatching service
   * @param {object} dependencies.logger - Logging service
   */
  constructor({ entityManager, eventDispatcher, logger }) {
    validateDependency(entityManager, 'entityManager');
    validateDependency(eventDispatcher, 'eventDispatcher');

    this.#entityManager = entityManager;
    this.#eventDispatcher = eventDispatcher;
    this.#logger = logger || console; // Fallback to console if no logger
    this.#activeSubscriptions = new Set();
    this.#disposed = false;
  }

  /**
   * Waits for anatomy to be ready on an existing entity
   *
   * @param {string} entityId - Entity ID to check
   * @param {object} [config] - Configuration options
   * @returns {Promise<boolean>} True if anatomy is ready, false on timeout/error
   */
  async waitForAnatomyReady(entityId, config = {}) {
    this.#throwIfDisposed();

    if (!entityId || typeof entityId !== 'string') {
      throw new Error('Entity ID must be a non-empty string');
    }

    const options = { ...DEFAULT_CONFIG, ...config };
    const startTime = Date.now();
    let attempt = 0;
    let retryInterval = options.retryInterval;

    while (
      Date.now() - startTime < options.timeout &&
      attempt < options.maxRetries
    ) {
      try {
        const isReady = await this.#checkAnatomyReady(entityId);
        if (isReady) {
          this.#logger.debug?.(
            `Anatomy ready for entity ${entityId} after ${attempt} attempts`
          );
          return true;
        }
      } catch (error) {
        this.#logger.error(`Failed to get entity ${entityId}:`, error);
        return false;
      }

      // Wait before next attempt
      await this.#sleep(retryInterval);

      attempt++;

      // Apply exponential backoff
      if (options.useExponentialBackoff) {
        retryInterval = Math.min(
          retryInterval * options.backoffMultiplier,
          options.maxRetryInterval
        );
      }
    }

    // Timeout reached
    this.#logger.warn(
      `Timeout waiting for anatomy ready on entity ${entityId}`,
      {
        entityId,
        attempts: attempt,
        timeElapsed: Date.now() - startTime,
      }
    );

    return false;
  }

  /**
   * Waits for entity creation event for a specific entity
   *
   * @param {string} entityId - Entity ID to wait for
   * @param {Function} callback - Callback when entity is created
   * @returns {Function} Unsubscribe function
   */
  waitForEntityCreation(entityId, callback) {
    this.#throwIfDisposed();

    if (!entityId || typeof entityId !== 'string') {
      throw new Error('Entity ID must be a non-empty string');
    }
    if (typeof callback !== 'function') {
      throw new Error('Callback must be a function');
    }

    const eventHandler = (event) => {
      if (event?.payload?.instanceId === entityId) {
        // Entity created, unsubscribe and call callback
        unsubscribe();
        callback(entityId);
      }
    };

    const unsubscribe = this.#eventDispatcher.subscribe(
      ENTITY_CREATED_ID,
      eventHandler
    );
    this.#activeSubscriptions.add(unsubscribe);

    // Return unsubscribe function
    return () => {
      this.#activeSubscriptions.delete(unsubscribe);
      unsubscribe();
    };
  }

  /**
   * Comprehensive workflow that waits for entity creation and then anatomy readiness
   *
   * @param {string} entityId - Entity ID to wait for
   * @param {object} [config] - Configuration options
   * @returns {Promise<boolean>} True if entity created and anatomy ready
   */
  async waitForEntityWithAnatomy(entityId, config = {}) {
    this.#throwIfDisposed();

    return new Promise((resolve) => {
      let isResolved = false;

      const unsubscribe = this.waitForEntityCreation(entityId, async () => {
        if (isResolved) return;

        try {
          // Entity created, now wait for anatomy to be ready
          const anatomyReady = await this.waitForAnatomyReady(entityId, config);

          if (!isResolved) {
            isResolved = true;
            resolve(anatomyReady);
          }
        } catch (error) {
          this.#logger.error(
            `Error waiting for anatomy on entity ${entityId}:`,
            error
          );

          if (!isResolved) {
            isResolved = true;
            resolve(false);
          }
        }
      });

      // Set timeout for the entire operation
      const timeout = config.timeout || DEFAULT_CONFIG.timeout;
      setTimeout(() => {
        if (!isResolved) {
          isResolved = true;
          unsubscribe();
          this.#logger.warn(`Timeout waiting for entity creation: ${entityId}`);
          resolve(false);
        }
      }, timeout);
    });
  }

  /**
   * Disposes the detector and cleans up all subscriptions
   */
  dispose() {
    if (this.#disposed) {
      return;
    }

    // Unsubscribe from all active subscriptions
    for (const unsubscribe of this.#activeSubscriptions) {
      try {
        unsubscribe();
      } catch (error) {
        this.#logger.warn?.('Error unsubscribing from event:', error);
      }
    }

    this.#activeSubscriptions.clear();
    this.#disposed = true;
  }

  /**
   * Checks if anatomy is ready for a specific entity
   *
   * @param {string} entityId - Entity ID to check
   * @returns {Promise<boolean>} True if anatomy is ready
   * @private
   */
  async #checkAnatomyReady(entityId) {
    const entity = await this.#entityManager.getEntityInstance(entityId);
    if (!entity) {
      return false;
    }

    const bodyComponent = entity.getComponentData('anatomy:body');

    // Check if anatomy:body component exists and has anatomy data
    return !!(
      bodyComponent &&
      bodyComponent.body &&
      (bodyComponent.body.parts || bodyComponent.body.root)
    );
  }

  /**
   * Sleep utility for async delays
   *
   * @param {number} ms - Milliseconds to sleep
   * @returns {Promise<void>}
   * @private
   */
  #sleep(ms) {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  /**
   * Throws error if detector has been disposed
   *
   * @private
   */
  #throwIfDisposed() {
    if (this.#disposed) {
      throw new Error('AnatomyLoadingDetector has been disposed');
    }
  }
}

export { AnatomyLoadingDetector, DEFAULT_CONFIG };
