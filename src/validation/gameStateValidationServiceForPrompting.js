// src/services/gameStateValidationServiceForPrompting.js
// --- FILE START ---
import { ILogger } from '../interfaces/iLogger.js';
import { ISafeEventDispatcher } from '../interfaces/iSafeEventDispatcher.js';
import { IGameStateValidationServiceForPrompting } from '../interfaces/iGameStateValidationServiceForPrompting.js';

/**
 * @typedef {import('../interfaces/iGameStateValidationServiceForPrompting.js').IGameStateValidationServiceForPrompting} IGameStateValidationServiceForPrompting_Interface */

import { ERROR_FALLBACK_CRITICAL_GAME_STATE_MISSING } from '../constants/textDefaults.js';
import { SYSTEM_ERROR_OCCURRED_ID } from '../constants/eventIds.js';

/**
 * @class GameStateValidationServiceForPrompting
 * @description Validates AIGameStateDTO for prompt generation.
 * @implements {IGameStateValidationServiceForPrompting_Interface}
 */
export class GameStateValidationServiceForPrompting extends IGameStateValidationServiceForPrompting {
  /** @type {ILogger} */
  #logger;
  /** @type {ISafeEventDispatcher} */
  #dispatcher;

  /**
   * @param {object} dependencies
   * @param {ILogger} dependencies.logger
   * @param {ISafeEventDispatcher} dependencies.safeEventDispatcher
   */
  constructor({ logger, safeEventDispatcher }) {
    super();

    if (!logger) {
      throw new Error(
        'GameStateValidationServiceForPrompting: Logger dependency is required.'
      );
    }
    this.#logger = logger;
    if (
      !safeEventDispatcher ||
      typeof safeEventDispatcher.dispatch !== 'function'
    ) {
      throw new Error(
        'GameStateValidationServiceForPrompting: safeEventDispatcher with dispatch method is required.'
      );
    }
    this.#dispatcher = safeEventDispatcher;
    this.#logger.debug('GameStateValidationServiceForPrompting initialized.');
  }

  /**
   * Validates if the provided AIGameStateDTO contains the critical information
   * necessary for generating prompt data.
   *
   * @param {AIGameStateDTO | null | undefined} gameStateDto - The game state DTO to validate.
   * @returns {{isValid: boolean, errorContent: string | null}} An object indicating if the state is valid
   * and an error message if not.
   */
  validate(gameStateDto) {
    if (!gameStateDto) {
      this.#dispatcher.dispatch(SYSTEM_ERROR_OCCURRED_ID, {
        message:
          'GameStateValidationServiceForPrompting.validate: AIGameStateDTO is null or undefined.',
        details: {},
      });
      return {
        isValid: false,
        errorContent: ERROR_FALLBACK_CRITICAL_GAME_STATE_MISSING,
      };
    }

    // The original validation in AIPromptContentProvider logged warnings for these
    // but still considered the gameStateDto as "valid" for the purpose of proceeding,
    // relying on fallbacks later. This behavior is maintained here.
    // If these missing fields should now be considered critical errors making isValid false,
    // then the return statements below should be adjusted.
    if (!gameStateDto.actorState) {
      this.#logger.warn(
        "GameStateValidationServiceForPrompting.validate: AIGameStateDTO is missing 'actorState'. This might affect prompt data completeness indirectly."
      );
    }
    if (!gameStateDto.actorPromptData) {
      this.#logger.warn(
        "GameStateValidationServiceForPrompting.validate: AIGameStateDTO is missing 'actorPromptData'. Character info will be limited or use fallbacks."
      );
    }

    // Add any other future critical checks here that would set isValid to false.
    // For now, only a completely missing gameStateDto is treated as a critical validation failure.
    return { isValid: true, errorContent: null };
  }
}

// --- FILE END ---
