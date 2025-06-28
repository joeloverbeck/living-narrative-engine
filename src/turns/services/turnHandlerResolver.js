// src/turns/services/turnHandlerResolver.js
// --- FILE START (Entire file content as requested) ---

// --- Interface Imports ---
import { ITurnHandlerResolver } from '../interfaces/ITurnHandlerResolver.js';

// --- Core Imports ---
import { validateDependency } from '../../utils/dependencyUtils.js';

// --- Type Imports for JSDoc ---
/** @typedef {import('../../interfaces/coreServices.js').ILogger} ILogger */
/** @typedef {import('../../entities/entity.js').default} Entity */
/** @typedef {import('../interfaces/ITurnHandler.js').ITurnHandler} ITurnHandler */

/**
 * @typedef {object} HandlerRule
 * @property {string} name - The name of the handler for logging purposes (e.g., "Player", "AI").
 * @property {(actor: Entity) => boolean} predicate - A function that returns true if this rule applies to the given actor.
 * @property {() => ITurnHandler} factory - A factory function that creates a new instance of the handler.
 */

/**
 * @class TurnHandlerResolver
 * @implements {ITurnHandlerResolver}
 * @description Service responsible for resolving the correct ITurnHandler using a
 * configurable set of rules. It finds the first matching rule and uses its factory
 * to create a new handler instance.
 */
class TurnHandlerResolver extends ITurnHandlerResolver {
  /** @type {ILogger} */
  #logger;
  /** @type {HandlerRule[]} */
  #handlerRules;

  /**
   * Creates an instance of TurnHandlerResolver.
   *
   * @param {object} dependencies - The dependencies required by the resolver.
   * @param {ILogger} dependencies.logger - The logging service.
   * @param {HandlerRule[]} dependencies.handlerRules - An ordered array of rules for resolving handlers.
   */
  constructor({ logger, handlerRules }) {
    super();
    validateDependency(logger, 'logger', logger, {
      requiredMethods: ['debug', 'info', 'warn', 'error'],
    });
    this.#logger = logger;

    if (!Array.isArray(handlerRules)) {
      const errorMsg =
        'TurnHandlerResolver requires handlerRules to be an array.';
      this.#logger.error(errorMsg);
      throw new Error(errorMsg);
    }
    this.#handlerRules = handlerRules;

    this.#logger.debug(
      `TurnHandlerResolver initialized with ${handlerRules.length} handler rules.`
    );
  }

  /**
   * Resolves the correct turn handler for the given actor by iterating through
   * the registered rules and using the factory of the first one that matches.
   *
   * @override
   * @param {Entity} actor - The entity whose turn handler needs to be resolved.
   * @returns {Promise<ITurnHandler | null>} A promise that resolves with a new
   * ITurnHandler instance for the actor, or null if no handler is found.
   */
  async resolveHandler(actor) {
    if (!actor || !actor.id) {
      this.#logger.warn(
        `TurnHandlerResolver: Attempted to resolve handler for invalid or null actor.`
      );
      return null;
    }
    this.#logger.debug(
      `TurnHandlerResolver: Resolving handler for actor ${actor.id}...`
    );

    for (const rule of this.#handlerRules) {
      try {
        if (rule.predicate(actor)) {
          this.#logger.debug(
            `Match found for actor ${actor.id}. Applying rule: '${rule.name}'.`
          );
          return this.#createAndValidateHandler(rule.name, rule.factory, actor);
        }
      } catch (error) {
        this.#logger.error(
          `Error executing predicate for rule '${rule.name}' on actor ${actor.id}: ${error.message}`,
          error
        );
        // Continue to the next rule
      }
    }

    this.#logger.debug(
      `TurnHandlerResolver: No matching rule found for actor ${actor.id}. Returning null.`
    );
    return null;
  }

  /**
   * [DRY HELPER] Creates and validates a handler instance using a factory.
   * Encapsulates the try/catch, logging, and validation logic.
   *
   * @private
   * @param {string} handlerName - The name of the handler for logging (e.g., "Player", "AI").
   * @param {() => ITurnHandler} factory - The factory function to call.
   * @param {Entity} actor - The actor for whom the handler is being created.
   * @returns {ITurnHandler | null} The created handler or null on failure.
   */
  #createAndValidateHandler(handlerName, factory, actor) {
    this.#logger.debug(
      `TurnHandlerResolver: Creating new ${handlerName}Handler for actor ${actor.id}.`
    );
    try {
      const handler = factory();

      if (!handler || typeof handler.startTurn !== 'function') {
        this.#logger.error(
          `TurnHandlerResolver: ${handlerName} factory did not return a valid handler for actor ${actor.id}.`
        );
        return null;
      }
      return handler;
    } catch (error) {
      this.#logger.error(
        `TurnHandlerResolver: Error creating ${handlerName}Handler for actor ${actor.id}: ${error.message}`,
        error
      );
      return null;
    }
  }
}

export default TurnHandlerResolver;
// --- FILE END ---
