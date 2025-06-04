// src/core/services/turnHandlerResolver.js

// --- Interface Imports ---
import { ITurnHandlerResolver } from '../interfaces/ITurnHandlerResolver.js';
// ITurnHandler might be implicitly used by the factory return types, but not directly in this file.

// --- Core Imports ---
import {
  PLAYER_COMPONENT_ID,
  ACTOR_COMPONENT_ID,
} from '../../constants/componentIds.js';

// --- Type Imports for JSDoc ---
/** @typedef {import('../../interfaces/coreServices.js').ILogger} ILogger */
/** @typedef {import('../../entities/entity.js').default} Entity */
/** @typedef {import('../interfaces/ITurnHandler.js').ITurnHandler} ITurnHandler */
/** @typedef {() => PlayerTurnHandler} PlayerTurnHandlerFactory */

/** @typedef {() => AITurnHandler} AiTurnHandlerFactory */

/**
 * @class TurnHandlerResolver
 * @implements {ITurnHandlerResolver}
 * @description Service responsible for resolving the correct ITurnHandler implementation
 * based on an actor entity. It uses factory functions to create new handler instances.
 */
class TurnHandlerResolver extends ITurnHandlerResolver {
  /** @type {ILogger} */
  #logger;
  /** @type {PlayerTurnHandlerFactory} */
  #createPlayerTurnHandler;
  /** @type {AiTurnHandlerFactory} */
  #createAiTurnHandler;

  /**
   * Creates an instance of TurnHandlerResolver.
   * @param {object} dependencies - The dependencies required by the resolver.
   * @param {ILogger} dependencies.logger - The logging service.
   * @param {PlayerTurnHandlerFactory} dependencies.createPlayerTurnHandler - A factory function that returns a new PlayerTurnHandler.
   * @param {AiTurnHandlerFactory} dependencies.createAiTurnHandler - A factory function that returns a new AITurnHandler.
   * @throws {Error} If required dependencies are missing or invalid.
   */
  constructor({ logger, createPlayerTurnHandler, createAiTurnHandler }) {
    super();

    if (!logger || typeof logger.debug !== 'function') {
      console.error(
        'TurnHandlerResolver: Invalid or missing logger dependency.'
      );
      throw new Error(
        'TurnHandlerResolver: Invalid or missing logger dependency.'
      );
    }
    this.#logger = logger;

    if (typeof createPlayerTurnHandler !== 'function') {
      this.#logger.error(
        'TurnHandlerResolver: Invalid or missing createPlayerTurnHandler factory function.'
      );
      throw new Error(
        'TurnHandlerResolver: Invalid or missing createPlayerTurnHandler factory function.'
      );
    }
    this.#createPlayerTurnHandler = createPlayerTurnHandler;

    if (typeof createAiTurnHandler !== 'function') {
      this.#logger.error(
        'TurnHandlerResolver: Invalid or missing createAiTurnHandler factory function.'
      );
      throw new Error(
        'TurnHandlerResolver: Invalid or missing createAiTurnHandler factory function.'
      );
    }
    this.#createAiTurnHandler = createAiTurnHandler;

    this.#logger.debug(
      'TurnHandlerResolver initialized with handler factories.'
    );
  }

  /**
   * Resolves the correct turn handler implementation for the given actor entity
   * by creating a new instance using the appropriate factory.
   * @param {Entity} actor - The entity whose turn handler needs to be resolved.
   * @returns {Promise<ITurnHandler | null>} A promise that resolves with a new
   * ITurnHandler instance for the actor, or null if no specific handler is found or the actor is invalid.
   */
  async resolveHandler(actor) {
    if (!actor || !actor.id) {
      this.#logger.warn(
        `TurnHandlerResolver: Attempted to resolve handler for invalid or null actor.`
      );
      return null;
    }

    this.#logger.debug(
      `TurnHandlerResolver: Attempting to resolve turn handler for actor ${actor.id}...`
    );

    if (actor.hasComponent(PLAYER_COMPONENT_ID)) {
      this.#logger.info(
        `TurnHandlerResolver: Creating new PlayerTurnHandler for actor ${actor.id}.`
      );
      try {
        const handler = this.#createPlayerTurnHandler();
        // Optional: Basic check if factory returned something that looks like a handler
        if (!handler || typeof handler.startTurn !== 'function') {
          this.#logger.error(
            `TurnHandlerResolver: createPlayerTurnHandler factory did not return a valid handler for actor ${actor.id}.`
          );
          return null;
        }
        return handler;
      } catch (error) {
        this.#logger.error(
          `TurnHandlerResolver: Error creating PlayerTurnHandler for actor ${actor.id}: ${error.message}`,
          error
        );
        return null;
      }
    } else if (
      actor.hasComponent(ACTOR_COMPONENT_ID) &&
      !actor.hasComponent(PLAYER_COMPONENT_ID)
    ) {
      this.#logger.info(
        `TurnHandlerResolver: Creating new AITurnHandler for actor ${actor.id}.`
      );
      try {
        const handler = this.#createAiTurnHandler();
        // Optional: Basic check
        if (!handler || typeof handler.startTurn !== 'function') {
          this.#logger.error(
            `TurnHandlerResolver: createAiTurnHandler factory did not return a valid handler for actor ${actor.id}.`
          );
          return null;
        }
        return handler;
      } catch (error) {
        this.#logger.error(
          `TurnHandlerResolver: Error creating AITurnHandler for actor ${actor.id}: ${error.message}`,
          error
        );
        return null;
      }
    } else {
      this.#logger.info(
        `TurnHandlerResolver: No specific turn handler factory found for actor ${actor.id}. Returning null.`
      );
      return null;
    }
  }
}

export default TurnHandlerResolver;
