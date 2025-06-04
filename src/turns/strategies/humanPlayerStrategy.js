// src/core/turns/strategies/humanPlayerStrategy.js
// --- FILE START ---

/** @typedef {import('../interfaces/ITurnContext.js').ITurnContext} ITurnContext */
/** @typedef {import('../interfaces/IActorTurnStrategy.js').IActorTurnStrategy} IActorTurnStrategy_Interface */
/** @typedef {import('../interfaces/IActorTurnStrategy.js').ITurnAction} ITurnAction */
/** @typedef {import('../../entities/entity.js').default} Entity */
/** @typedef {import('../interfaces/IHumanPlayerPromptService.js').IHumanPlayerPromptService} IPlayerPromptService */

// JSDoc type definitions for structures expected from PlayerPromptService.prompt()
/**
 * @typedef {object} PlayerPromptResolution
 * @description The structure of the object resolved by PlayerPromptService.prompt().
 * @property {AvailableAction} action - The selected available action.
 * @property {string | null} speech - The speech input from the player, or null.
 */

/**
 * @typedef {object} AvailableAction
 * @description Represents an action available to the player.
 * @property {string} id - The unique identifier for the action definition (e.g., "core:wait", "ability:fireball").
 * @property {string} command - A representative command string or label for the action (e.g., "Wait", "Cast Fireball").
 */

/** @typedef {import('../../interfaces/coreServices.js').ILogger} ILogger */
// Import PromptError if it's used for instanceof checks beyond AbortError
// import { PromptError } from '../../errors/promptError.js';

import { IActorTurnStrategy } from '../interfaces/IActorTurnStrategy.js';

/**
 * @class HumanPlayerStrategy
 * @implements {IActorTurnStrategy_Interface}
 * @description Implements the IActorTurnStrategy for human-controlled players.
 * It uses the PlayerPromptService to asynchronously obtain a chosen action and
 * any associated speech from the player, then constructs an ITurnAction.
 * It supports cancellation via an AbortSignal obtained from the TurnContext.
 */
export class HumanPlayerStrategy extends IActorTurnStrategy {
  /**
   * Creates an instance of HumanPlayerStrategy.
   */
  constructor() {
    super();
  }

  /**
   * Determines the action a human player will take for the current turn.
   * It calls `PlayerPromptService.prompt()` with a cancellation signal obtained
   * from the `ITurnContext`.
   * @async
   * @param {ITurnContext} context - The turn context for the current turn.
   * @returns {Promise<ITurnAction>} A Promise that resolves to an ITurnAction object.
   * @throws {Error|DOMException} If essential services are missing, playerData is malformed,
   * or if the prompt operation fails or is aborted. `DOMException` with `name === 'AbortError'`
   * is thrown if the prompt is cancelled.
   */
  async decideAction(context) {
    const logger = this._getLoggerFromContext(context);
    let actor;

    try {
      actor = this._getActorFromContext(context, logger);
      const playerPromptService = this._getPlayerPromptServiceFromContext(
        context,
        logger
      );

      let cancellationSignal;
      if (typeof context.getPromptSignal === 'function') {
        cancellationSignal = context.getPromptSignal();
        if (!(cancellationSignal instanceof AbortSignal)) {
          logger.warn(
            `HumanPlayerStrategy: context.getPromptSignal() for actor ${actor.id} did not return an AbortSignal. Proceeding without cancellation support for this prompt.`
          );
          cancellationSignal = undefined;
        } else {
          logger.debug(
            `HumanPlayerStrategy: Obtained cancellation signal for actor ${actor.id}.`
          );
        }
      } else {
        logger.warn(
          `HumanPlayerStrategy: context.getPromptSignal is not a function for actor ${actor.id}. Proceeding without cancellation support for this prompt.`
        );
        cancellationSignal = undefined;
      }

      logger.info(
        `HumanPlayerStrategy: Initiating decideAction for actor ${actor.id}.`
      );

      let playerData;
      try {
        logger.debug(
          `HumanPlayerStrategy: Calling playerPromptService.prompt() for actor ${actor.id}${cancellationSignal ? ' with cancellation signal.' : '.'}`
        );
        playerData = await playerPromptService.prompt(actor, {
          cancellationSignal,
        });
        logger.debug(
          `HumanPlayerStrategy: Received playerData for actor ${actor.id}. Details:`,
          playerData
        );
      } catch (promptError) {
        if (promptError && promptError.name === 'AbortError') {
          logger.info(
            `HumanPlayerStrategy: Prompt for actor ${actor.id} was cancelled (aborted).`
          );
        } else {
          const errorMessage = `HumanPlayerStrategy: Error during playerPromptService.prompt() for actor ${actor.id}.`;
          logger.error(errorMessage, promptError);
        }
        throw promptError;
      }

      if (
        !playerData ||
        !playerData.action ||
        typeof playerData.action.id !== 'string' ||
        playerData.action.id.trim() === '' ||
        typeof playerData.action.command !== 'string'
      ) {
        const errorMsg = `HumanPlayerStrategy: Invalid or incomplete data received from playerPromptService.prompt() for actor ${actor.id}. Action ID and command string are mandatory.`;
        logger.error(errorMsg, { receivedData: playerData });
        throw new Error(errorMsg + ` Received: ${JSON.stringify(playerData)}`);
      }
      logger.debug(
        `HumanPlayerStrategy: playerData for actor ${actor.id} validated successfully. Action ID: "${playerData.action.id}".`
      );

      // --- MODIFIED ITurnAction CONSTRUCTION ---
      /** @type {ITurnAction} */
      const turnAction = {
        actionDefinitionId: playerData.action.id,
        commandString: playerData.action.command,
        // Speech is now a top-level property.
        // Default to empty string if playerData.speech is null or undefined,
        // as the schema expects a string.
        speech: playerData.speech || '',
        // resolvedParameters field is removed
      };
      // --- END MODIFIED ITurnAction CONSTRUCTION ---

      logger.info(
        `HumanPlayerStrategy: Constructed ITurnAction for actor ${actor.id} with actionDefinitionId "${turnAction.actionDefinitionId}".`
      );
      logger.debug(
        `HumanPlayerStrategy: ITurnAction details for actor ${actor.id}:`,
        { turnActionDetails: turnAction }
      );

      return turnAction;
    } catch (error) {
      let actorIdForLog = 'unknown_actor';
      if (actor && typeof actor.id === 'string' && actor.id.trim() !== '') {
        actorIdForLog = actor.id;
      } else if (context && typeof context.getActor === 'function') {
        try {
          const currentActorInCatch = context.getActor();
          if (
            currentActorInCatch &&
            typeof currentActorInCatch.id === 'string' &&
            currentActorInCatch.id.trim() !== ''
          ) {
            actorIdForLog = currentActorInCatch.id;
          }
        } catch (e) {
          if (logger && typeof logger.warn === 'function') {
            logger.warn(
              `HumanPlayerStrategy: Could not retrieve actor ID in final catch block: ${e.message}`
            );
          } else {
            console.warn(
              `HumanPlayerStrategy: Could not retrieve actor ID in final catch block: ${e.message}`
            );
          }
        }
      }

      if (error && error.name === 'AbortError') {
        logger.info(
          `HumanPlayerStrategy.decideAction: Operation for actor ${actorIdForLog} was cancelled (aborted). Error: ${error.message}`
        );
      } else {
        logger.error(
          `HumanPlayerStrategy.decideAction: Operation failed for actor ${actorIdForLog}. Error: ${error.message}`,
          error
        );
      }

      throw error;
    }
  }

  /**
   * Helper to safely get the logger from the context.
   * @param {ITurnContext} context - The ITurnContext instance.
   * @returns {ILogger} A valid logger instance.
   * @throws {Error} If context is invalid, or logger cannot be retrieved, or the retrieved logger is invalid.
   * @private
   */
  _getLoggerFromContext(context) {
    if (!context) {
      const errorMsg =
        'HumanPlayerStrategy Critical: ITurnContext is null or undefined.';
      console.error(errorMsg);
      throw new Error(errorMsg);
    }
    if (typeof context.getLogger !== 'function') {
      const errorMsg =
        'HumanPlayerStrategy Critical: context.getLogger is not a function.';
      console.error(errorMsg);
      throw new Error(errorMsg);
    }

    let loggerInstance;
    try {
      loggerInstance = context.getLogger();
    } catch (e) {
      const errorMsg = `HumanPlayerStrategy Critical: context.getLogger() call failed. Details: ${e.message}`;
      console.error(errorMsg, e);
      throw new Error(errorMsg);
    }

    if (
      !loggerInstance ||
      typeof loggerInstance.info !== 'function' ||
      typeof loggerInstance.error !== 'function' ||
      typeof loggerInstance.debug !== 'function' ||
      typeof loggerInstance.warn !== 'function'
    ) {
      const errorMsg =
        'HumanPlayerStrategy Critical: Logger from ITurnContext is invalid or incomplete (missing required methods like info, error, debug, warn).';
      console.error(errorMsg);
      throw new Error(errorMsg);
    }
    return loggerInstance;
  }

  /**
   * Helper to safely get the actor from the context, using a provided logger.
   * @param {ITurnContext} context - The ITurnContext instance.
   * @param {ILogger} logger - A valid logger instance for reporting issues.
   * @returns {Entity} A valid actor entity.
   * @throws {Error} If actor cannot be retrieved from context or is invalid.
   * @private
   */
  _getActorFromContext(context, logger) {
    if (!context) {
      const errorMsg =
        'HumanPlayerStrategy Critical: ITurnContext is null (in _getActorFromContext).';
      if (logger && typeof logger.error === 'function') logger.error(errorMsg);
      else console.error(errorMsg);
      throw new Error(errorMsg);
    }
    if (typeof context.getActor !== 'function') {
      const errorMsg =
        'HumanPlayerStrategy Critical: context.getActor is not a function.';
      logger.error(errorMsg);
      throw new Error(errorMsg);
    }

    let actorInstance = null;
    try {
      actorInstance = context.getActor();
    } catch (e) {
      const errorMsg = `HumanPlayerStrategy Critical: context.getActor() call failed. Details: ${e.message}`;
      logger.error(errorMsg, e);
      throw new Error(errorMsg);
    }

    if (
      !actorInstance ||
      typeof actorInstance.id !== 'string' ||
      actorInstance.id.trim() === ''
    ) {
      const errorMsg =
        'HumanPlayerStrategy Critical: Actor not available from ITurnContext or actor has an invalid ID.';
      logger.error(errorMsg, { actorInstance });
      throw new Error(errorMsg);
    }
    return actorInstance;
  }

  /**
   * Helper to safely get the player prompt service from the context, using a provided logger.
   * @param {ITurnContext} context - The ITurnContext instance.
   * @param {ILogger} logger - A valid logger instance for reporting issues.
   * @returns {IPlayerPromptService} A valid player prompt service instance.
   * @throws {Error} If the service cannot be retrieved from context or is invalid.
   * @private
   */
  _getPlayerPromptServiceFromContext(context, logger) {
    if (!context) {
      const errorMsg =
        'HumanPlayerStrategy Critical: ITurnContext is null (in _getPlayerPromptServiceFromContext).';
      if (logger && typeof logger.error === 'function') logger.error(errorMsg);
      else console.error(errorMsg);
      throw new Error(errorMsg);
    }
    if (typeof context.getPlayerPromptService !== 'function') {
      const errorMsg =
        'HumanPlayerStrategy Critical: context.getPlayerPromptService is not a function.';
      logger.error(errorMsg);
      throw new Error(errorMsg);
    }

    let serviceInstance = null;
    try {
      serviceInstance = context.getPlayerPromptService();
    } catch (e) {
      const errorMsg = `HumanPlayerStrategy Critical: context.getPlayerPromptService() call failed. Details: ${e.message}`;
      logger.error(errorMsg, e);
      throw new Error(errorMsg);
    }

    if (!serviceInstance || typeof serviceInstance.prompt !== 'function') {
      const errorMsg =
        'HumanPlayerStrategy Critical: PlayerPromptService not available from ITurnContext or is invalid (e.g., missing prompt method).';
      logger.error(errorMsg, { serviceInstance });
      throw new Error(errorMsg);
    }
    return serviceInstance;
  }
}

// --- FILE END ---
