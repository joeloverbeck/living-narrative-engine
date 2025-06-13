// src/turns/order/turnOrderService.js

/**
 * @file Implements the Turn Order Service responsible for managing
 * the sequence of entity turns within a round.
 */

import { ITurnOrderService } from '../interfaces/ITurnOrderService.js';
import { ITurnOrderQueue } from '../interfaces/ITurnOrderQueue.js';
import { SimpleRoundRobinQueue } from './queues/simpleRoundRobinQueue.js'; // Added import
import { InitiativePriorityQueue } from './queues/initiativePriorityQueue.js';
import { freeze } from '../../utils/objectUtils'; // Added import

// --- Type Imports ---
/** @typedef {import('../interfaces/ITurnOrderQueue.js').Entity} Entity */
/** @typedef {import('../interfaces/ITurnOrderService.js').TurnOrderStrategy} TurnOrderStrategy */
/** @typedef {import('../../interfaces/coreServices.js').ILogger} ILogger */ // Assuming ILogger path

/**
 * @class TurnOrderService
 * @implements {ITurnOrderService}
 * @classdesc Manages the overall turn order for a round or encounter, using
 * an underlying queue structure based on the selected strategy.
 */
export class TurnOrderService extends ITurnOrderService {
  /**
   * The currently active turn order queue instance. Null if no round is active.
   *
   * @private
   * @type {ITurnOrderQueue | null}
   */
  #currentQueue = null;

  /**
   * The strategy being used for the current round. Null if no round is active.
   *
   * @private
   * @type {TurnOrderStrategy | null}
   */
  #currentStrategy = null;

  /**
   * The logger service instance.
   *
   * @private
   * @type {ILogger}
   */
  #logger;

  // --- Constructor ---

  /**
   * Creates an instance of TurnOrderService.
   *
   * @param {object} dependencies - The dependencies for the service.
   * @param {ILogger} dependencies.logger - The logging service instance.
   * @throws {Error} If required dependencies are missing or invalid.
   */
  constructor({ logger }) {
    super(); // Call base class constructor

    if (
      !logger ||
      typeof logger.error !== 'function' ||
      typeof logger.warn !== 'function'
    ) {
      // Added warn check for robustness
      throw new Error(
        'TurnOrderService requires a valid ILogger instance (info, error, warn methods).'
      );
    }
    this.#logger = logger;

    // Initialize state
    this.#currentQueue = null;
    this.#currentStrategy = null;

    this.#logger.debug('TurnOrderService initialized.');
  }

  // --- Basic Methods (Implemented in TASK-TURN-ORDER-001.4) ---

  /**
   * Checks if the turn order queue for the current round is empty.
   * Returns true if no round is active.
   *
   * @override
   * @returns {boolean} True if the turn order is complete or empty, false otherwise.
   */
  isEmpty() {
    return this.#currentQueue ? this.#currentQueue.isEmpty() : true;
  }

  /**
   * Returns the next entity in the turn order without advancing the turn.
   * Returns null if no round is active or the queue is empty.
   *
   * @override
   * @returns {Entity | null} The entity whose turn is next, or null.
   */
  peekNextEntity() {
    return this.#currentQueue ? this.#currentQueue.peek() : null;
  }

  /**
   * Gets a read-only list of entities currently remaining in the turn order for this round.
   * The order reflects the *remaining* turn sequence as determined by the underlying queue.
   * Returns an empty frozen array if no round is active.
   *
   * @override
   * @returns {ReadonlyArray<Entity>} A read-only array of entities remaining.
   */
  getCurrentOrder() {
    const order = this.#currentQueue ? this.#currentQueue.toArray() : [];
    return freeze(order);
  }

  // --- Helper Method (Implemented in TASK-TURN-ORDER-001.4) ---

  /**
   * Clears the current round's state, including the queue and strategy.
   *
   * @protected
   * @returns {void}
   */
  clearCurrentRound() {
    if (this.#currentQueue) {
      this.#currentQueue.clear();
      this.#logger.debug('TurnOrderService: Cleared existing turn queue.');
    }
    this.#currentQueue = null;
    this.#currentStrategy = null;
    this.#logger.debug('TurnOrderService: Current round state cleared.');
  }

  // --- Core Interface Methods ---

  /**
   * Initializes and starts a new round of turns. Clears any previous round's state.
   *
   * @override
   * @param {Array<Entity>} entities - An array of entity objects participating in this round. Must not be empty or contain invalid entities.
   * @param {TurnOrderStrategy} strategy - The strategy to use ('round-robin' or 'initiative').
   * @param {Map<string, number>} [initiativeData] - Optional map of entity IDs to initiative scores. Required and must be valid if strategy is 'initiative'.
   * @returns {void}
   * @throws {Error} If entities array is invalid, strategy is unsupported, or initiative data is missing/invalid when required.
   */
  startNewRound(entities, strategy, initiativeData) {
    this.#logger.debug(
      `TurnOrderService: Starting new round with strategy "${strategy}".`
    );
    this.clearCurrentRound(); // Clear previous state first

    // Validate entities array
    if (!Array.isArray(entities) || entities.length === 0) {
      this.#logger.error(
        'TurnOrderService.startNewRound: Failed - entities array must be a non-empty array.'
      );
      throw new Error('Entities array must be provided and non-empty.');
    }
    // Basic validation of entities within the array (can be enhanced)
    if (!entities.every((e) => e && typeof e.id === 'string' && e.id !== '')) {
      this.#logger.error(
        'TurnOrderService.startNewRound: Failed - entities array contains invalid entities (missing or invalid id).'
      );
      throw new Error('Entities array contains invalid entities.');
    }

    this.#currentStrategy = strategy; // Set strategy early for logging/debugging

    try {
      switch (strategy) {
        case 'initiative':
          // Validate initiativeData
          if (!(initiativeData instanceof Map) || initiativeData.size === 0) {
            this.#logger.error(
              'TurnOrderService.startNewRound (initiative): Failed - initiativeData Map is required and must not be empty.'
            );
            throw new Error(
              'Valid initiativeData Map is required for the "initiative" strategy.'
            );
          }

          this.#currentQueue = new InitiativePriorityQueue();
          this.#logger.debug(
            'TurnOrderService: Initialized InitiativePriorityQueue.'
          );

          for (const entity of entities) {
            const initiativeScore = initiativeData.get(entity.id);

            if (
              initiativeScore === undefined ||
              typeof initiativeScore !== 'number' ||
              !Number.isFinite(initiativeScore)
            ) {
              this.#logger.warn(
                `TurnOrderService.startNewRound (initiative): Entity "${entity.id}" missing valid initiative score. Defaulting to 0.`
              );
              // Default to 0 if missing or invalid
              this.#currentQueue.add(entity, 0);
            } else {
              this.#currentQueue.add(entity, initiativeScore);
            }
          }
          this.#logger.debug(
            `TurnOrderService: Populated InitiativePriorityQueue with ${entities.length} entities.`
          );
          break;

        case 'round-robin':
          this.#currentQueue = new SimpleRoundRobinQueue();
          this.#logger.debug(
            'TurnOrderService: Initialized SimpleRoundRobinQueue.'
          );
          for (const entity of entities) {
            this.#currentQueue.add(entity); // Priority is ignored by SimpleRoundRobinQueue
          }
          this.#logger.debug(
            `TurnOrderService: Populated SimpleRoundRobinQueue with ${entities.length} entities.`
          );
          break;

        default:
          this.#logger.error(
            `TurnOrderService.startNewRound: Failed - Unsupported turn order strategy "${strategy}".`
          );
          this.#currentStrategy = null; // Reset strategy if invalid
          throw new Error(`Unsupported turn order strategy: ${strategy}`);
      }
    } catch (error) {
      this.#logger.error(
        `TurnOrderService.startNewRound: Error during queue population for strategy "${strategy}": ${error.message}`,
        error
      );
      // Clean up partially initialized state
      this.clearCurrentRound();
      throw error; // Re-throw the error after logging and cleanup
    }

    this.#logger.debug(
      `TurnOrderService: New round successfully started with ${this.#currentQueue.size()} active entities.`
    );
  }

  /**
   * Gets the next entity whose turn it is and advances the turn order.
   * Delegates to the underlying queue's getNext method.
   *
   * @override
   * @returns {Entity | null} The entity whose turn is next, or null if the queue is empty or no round is active.
   */
  getNextEntity() {
    if (!this.#currentQueue) {
      this.#logger.warn(
        'TurnOrderService.getNextEntity: Called when no round is active.'
      );
      return null;
    }
    const nextEntity = this.#currentQueue.getNext();
    if (nextEntity) {
      this.#logger.debug(
        `TurnOrderService: Advancing turn to entity "${nextEntity.id}".`
      );
    } else {
      this.#logger.debug(
        'TurnOrderService: getNextEntity returned null (queue is likely empty).'
      );
    }
    return nextEntity;
  }

  /**
   * Adds an entity to the current round's turn order dynamically.
   * Delegates to the underlying queue's add method.
   *
   * @override
   * @param {Entity} entity - The entity to add. Must be a valid entity object.
   * @param {number} [initiativeValue] - The initiative score for the entity. Required and used only if the current strategy is 'initiative'. Defaults to 0 if not provided or invalid in initiative mode. Ignored for 'round-robin'.
   * @returns {void}
   * @throws {Error} If no round is active, the entity is invalid, or the queue fails to add the entity.
   */
  addEntity(entity, initiativeValue = 0) {
    if (!this.#currentQueue || !this.#currentStrategy) {
      this.#logger.error(
        'TurnOrderService.addEntity: Cannot add entity, no round is currently active.'
      );
      throw new Error('Cannot add entity: No round is active.');
    }
    if (!entity || typeof entity.id !== 'string' || entity.id === '') {
      this.#logger.error(
        'TurnOrderService.addEntity: Failed - Cannot add invalid entity (missing or invalid id).'
      );
      throw new Error('Cannot add invalid entity.');
    }

    try {
      if (this.#currentStrategy === 'initiative') {
        let score = initiativeValue;
        if (typeof score !== 'number' || !Number.isFinite(score)) {
          this.#logger.warn(
            `TurnOrderService.addEntity (initiative): Invalid initiative value "${initiativeValue}" provided for entity "${entity.id}". Defaulting to 0.`
          );
          score = 0;
        }
        this.#logger.debug(
          `TurnOrderService: Adding entity "${entity.id}" with initiative ${score} to the current round.`
        );
        this.#currentQueue.add(entity, score);
      } else if (this.#currentStrategy === 'round-robin') {
        this.#logger.debug(
          `TurnOrderService: Adding entity "${entity.id}" to the end of the round-robin queue.`
        );
        this.#currentQueue.add(entity); // Priority is ignored
      } else {
        // This case should theoretically not happen if startNewRound validated strategy
        this.#logger.error(
          `TurnOrderService.addEntity: Internal error - current strategy "${this.#currentStrategy}" is unknown.`
        );
        throw new Error(
          `Internal error: Unknown current strategy "${this.#currentStrategy}"`
        );
      }
      this.#logger.debug(
        `TurnOrderService: Entity "${entity.id}" successfully added to the turn order.`
      );
    } catch (error) {
      this.#logger.error(
        `TurnOrderService.addEntity: Failed to add entity "${entity.id}": ${error.message}`,
        error
      );
      throw error; // Re-throw after logging
    }
  }

  /**
   * Removes an entity from the current round's turn order.
   * Delegates to the underlying queue's remove method.
   *
   * @override
   * @param {string} entityId - The unique ID of the entity to remove.
   * @returns {void} // Interface specifies void, even though queue might return the entity
   * @throws {Error} If no round is active or entityId is invalid.
   */
  removeEntity(entityId) {
    if (!this.#currentQueue) {
      this.#logger.warn(
        `TurnOrderService.removeEntity: Called for entity "${entityId}" when no round is active. No action taken.`
      );
      // Don't throw an error here, just log and return, as removing from a non-existent round is a no-op.
      return;
    }
    if (typeof entityId !== 'string' || entityId === '') {
      this.#logger.error(
        'TurnOrderService.removeEntity: Failed - Invalid entityId provided.'
      );
      throw new Error('Invalid entityId provided for removal.');
    }

    try {
      this.#logger.debug(
        `TurnOrderService: Attempting to remove entity "${entityId}" from the turn order.`
      );
      const removedEntity = this.#currentQueue.remove(entityId); // Call the queue's remove method

      // --- CORRECTED LOGIC ---
      // Log success info if the entity was directly removed (non-null return)
      // OR if it's the initiative strategy (where null signifies processing for lazy removal).
      if (removedEntity !== null || this.#currentStrategy === 'initiative') {
        this.#logger.debug(
          `TurnOrderService: Entity "${entityId}" processed for removal (actual removal may be lazy depending on queue type).`
        );
      }
      // Log a warning only if the entity was truly not found (remove returned null AND it wasn't initiative strategy)
      else {
        // Implicitly: removedEntity === null && this.#currentStrategy !== 'initiative'
        this.#logger.warn(
          `TurnOrderService.removeEntity: Entity "${entityId}" not found in the current turn order queue.`
        );
      }
      // --- END CORRECTED LOGIC ---
    } catch (error) {
      this.#logger.error(
        `TurnOrderService.removeEntity: Error while trying to remove entity "${entityId}": ${error.message}`,
        error
      );
      throw error; // Re-throw after logging
    }
  }
}
