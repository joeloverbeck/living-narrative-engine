/**
 * @file Turn Order Shuffle Service
 * @description Service responsible for randomizing NPC turn order while preserving
 *              human player positions in the turn sequence.
 * @see ../order/turnOrderService.js - Main service that uses this shuffle service
 * @see ../config/turnOrderShuffle.config.js - Configuration for shuffle behavior
 * @see specs/randomized-turn-ordering.md - Feature specification
 */

import { ITurnOrderShuffleService } from '../interfaces/ITurnOrderShuffleService.js';
import { shuffleInPlace } from '../../utils/shuffleUtils.js';
import {
  isShuffleEnabledForStrategy,
  getDiagnosticsConfig,
} from '../config/turnOrderShuffle.config.js';
import { determineActorType } from '../../utils/actorTypeUtils.js';

/** @typedef {import('../interfaces/ITurnOrderQueue.js').Entity} Entity */

/**
 * @class TurnOrderShuffleService
 * @implements {ITurnOrderShuffleService}
 * @classdesc Implements the position-preserving shuffle algorithm for turn order
 *            randomization. Human players maintain their original positions while
 *            non-human actors are shuffled among the remaining slots.
 */
export class TurnOrderShuffleService extends ITurnOrderShuffleService {
  /**
   * Logger instance for diagnostic output
   *
   * @private
   * @type {Pick<import('../../interfaces/coreServices.js').ILogger, 'debug' | 'info' | 'warn' | 'error'>}
   */
  #logger;

  /**
   * Creates an instance of TurnOrderShuffleService.
   *
   * @param {object} dependencies - Service dependencies
   * @param {import('../../interfaces/coreServices.js').ILogger} dependencies.logger - Logger instance
   * @throws {Error} If required dependencies are missing
   */
  constructor({ logger }) {
    super();

    if (!logger || typeof logger.error !== 'function') {
      throw new Error(
        'TurnOrderShuffleService requires a valid ILogger instance.'
      );
    }

    const noop = () => {};
    const bindOr = (methodName, fallback) => {
      const method = logger[methodName];
      return typeof method === 'function' ? method.bind(logger) : fallback;
    };

    this.#logger = {
      debug: bindOr('debug', noop),
      info: bindOr('info', noop),
      warn: bindOr('warn', noop),
      error: bindOr('error', noop),
    };

    this.#logger.debug('TurnOrderShuffleService initialized.');
  }

  /**
   * Shuffles the entities array while preserving human player positions.
   *
   * Algorithm:
   * 1. Identify and record positions of human players
   * 2. Extract non-human actors
   * 3. Shuffle the non-human actors
   * 4. Rebuild the array with humans at original positions
   *
   * @override
   * @param {Entity[]} entities - Array of entities to shuffle
   * @param {string} strategy - Turn order strategy (e.g., 'round-robin')
   * @param {function(): number} [randomFn=Math.random] - Random function for testing
   * @returns {Entity[]} Shuffled array (same reference, modified in place)
   */
  shuffleWithHumanPositionPreservation(
    entities,
    strategy,
    randomFn = Math.random
  ) {
    // Validate input
    if (!Array.isArray(entities)) {
      this.#logger.warn(
        'TurnOrderShuffleService: shuffleWithHumanPositionPreservation called with non-array input.'
      );
      return entities;
    }

    if (entities.length <= 1) {
      this.#logger.debug(
        'TurnOrderShuffleService: Array too small to shuffle (length <= 1).'
      );
      return entities;
    }

    // Check if shuffling is enabled for this strategy
    if (!isShuffleEnabledForStrategy(strategy)) {
      this.#logger.debug(
        `TurnOrderShuffleService: Shuffling disabled for strategy "${strategy}".`
      );
      return entities;
    }

    const diagnostics = getDiagnosticsConfig();

    // Log original order if enabled
    if (diagnostics.logOriginalOrder) {
      const originalOrder = this.#formatEntityList(
        entities,
        diagnostics.includeActorNames
      );
      this.#logger.debug(
        `TurnOrderShuffleService: Original order: [${originalOrder}]`
      );
    }

    // Step 1: Identify human positions and collect non-humans
    /** @type {Map<number, Entity>} */
    const humanPositions = new Map();
    /** @type {Entity[]} */
    const nonHumans = [];

    for (let i = 0; i < entities.length; i++) {
      const entity = entities[i];
      const actorType = this.#determineActorType(entity);

      if (actorType === 'human') {
        humanPositions.set(i, entity);
      } else {
        nonHumans.push(entity);
      }
    }

    // If all are human or all are non-human with only one, no meaningful shuffle
    if (humanPositions.size === entities.length) {
      this.#logger.debug(
        'TurnOrderShuffleService: All entities are human, no shuffle needed.'
      );
      return entities;
    }

    if (nonHumans.length <= 1) {
      this.#logger.debug(
        'TurnOrderShuffleService: Only 0-1 non-human entities, no shuffle needed.'
      );
      return entities;
    }

    // Step 2: Shuffle the non-humans
    shuffleInPlace(nonHumans, randomFn);

    // Step 3: Rebuild the array in place
    let nonHumanIndex = 0;
    for (let i = 0; i < entities.length; i++) {
      if (humanPositions.has(i)) {
        // Human stays at their position
        entities[i] = humanPositions.get(i);
      } else {
        // Fill with next shuffled non-human
        entities[i] = nonHumans[nonHumanIndex++];
      }
    }

    // Log shuffle result if enabled
    if (diagnostics.logShuffleResults) {
      const shuffledOrder = this.#formatEntityList(
        entities,
        diagnostics.includeActorNames
      );
      this.#logger.debug(
        `TurnOrderShuffleService: Shuffled order: [${shuffledOrder}]`
      );
      this.#logger.debug(
        `TurnOrderShuffleService: Preserved ${humanPositions.size} human position(s), shuffled ${nonHumans.length} non-human(s).`
      );
    }

    return entities;
  }

  /**
   * Checks if an entity is a human player.
   *
   * @override
   * @param {Entity} entity - Entity to check
   * @returns {boolean} True if the entity is a human player
   */
  isHumanPlayer(entity) {
    return this.#determineActorType(entity) === 'human';
  }

  /**
   * Determines the actor type using the utility function.
   *
   * @private
   * @param {Entity} entity - Entity to check
   * @returns {string} 'human' or 'ai'
   */
  #determineActorType(entity) {
    try {
      return determineActorType(entity);
    } catch (error) {
      this.#logger.warn(
        `TurnOrderShuffleService: Error determining actor type for entity "${entity?.id}": ${error.message}`
      );
      // Default to human to avoid shuffling unknown entities
      return 'human';
    }
  }

  /**
   * Formats entity list for logging.
   *
   * @private
   * @param {Entity[]} entities - Entities to format
   * @param {boolean} includeNames - Whether to include names
   * @returns {string} Formatted string
   */
  #formatEntityList(entities, includeNames) {
    return entities
      .map((e) => {
        if (includeNames && e.name) {
          return `${e.id}(${e.name})`;
        }
        return e.id;
      })
      .join(', ');
  }
}

export default TurnOrderShuffleService;
