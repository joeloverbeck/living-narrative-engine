// src/services/gameStateValidationServiceForPrompting.js
// --- FILE START ---
/** @typedef {import('../interfaces/coreServices.js').ILogger} ILogger */
/** @typedef {import('../turns/dtos/AIGameStateDTO.js').AIGameStateDTO} AIGameStateDTO */
/** @typedef {import('../interfaces/ISafeEventDispatcher.js').ISafeEventDispatcher} ISafeEventDispatcher */

/** @typedef {import('../interfaces/IGameStateValidationServiceForPrompting.js').IGameStateValidationServiceForPrompting} IGameStateValidationServiceForPrompting_Interface */

import { ERROR_FALLBACK_CRITICAL_GAME_STATE_MISSING } from '../constants/textDefaults.js';
import { SYSTEM_ERROR_OCCURRED_ID } from '../constants/eventIds.js';
import { IGameStateValidationServiceForPrompting } from '../interfaces/IGameStateValidationServiceForPrompting.js';

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
   * Performs a pure validation of the provided AIGameStateDTO without side effects.
   *
   * @param {AIGameStateDTO | null | undefined} gameStateDto - The game state DTO to validate.
   * @returns {{isValid: boolean, errorContent: string | null}} Result of validation.
   */
  check(gameStateDto) {
    if (!gameStateDto) {
      return {
        isValid: false,
        errorContent: ERROR_FALLBACK_CRITICAL_GAME_STATE_MISSING,
      };
    }

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

    return { isValid: true, errorContent: null };
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
    const result = this.check(gameStateDto);
    if (!result.isValid) {
      this.#dispatcher.dispatch(SYSTEM_ERROR_OCCURRED_ID, {
        message:
          'GameStateValidationServiceForPrompting.validate: AIGameStateDTO is null or undefined.',
        details: {},
      });
    }
    return result;
  }
}

// --- FILE END ---
