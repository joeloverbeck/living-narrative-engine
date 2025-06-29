// src/prompting/AIPromptContentProvider.js

/** @typedef {import('../interfaces/coreServices.js').ILogger} ILogger */
/** @typedef {import('../turns/dtos/AIGameStateDTO.js').AIGameStateDTO} AIGameStateDTO */
/** @typedef {import('../turns/dtos/AIGameStateDTO.js').ActorPromptDataDTO} ActorPromptDataDTO */
/** @typedef {import('../types/promptData.js').PromptData} PromptData */
/** @typedef {import('../interfaces/IPromptStaticContentService.js').IPromptStaticContentService} IPromptStaticContentService */
/** @typedef {import('../interfaces/IPerceptionLogFormatter.js').IPerceptionLogFormatter} IPerceptionLogFormatter */
/** @typedef {import('../interfaces/IGameStateValidationServiceForPrompting.js').IGameStateValidationServiceForPrompting} IGameStateValidationServiceForPrompting */
/** @typedef {import('../turns/dtos/actionComposite.js').ActionComposite} ActionComposite */
/** @typedef {import('../types/perceptionLogTypes.js').RawPerceptionLogEntry} RawPerceptionLogEntry */

import { IAIPromptContentProvider } from '../turns/interfaces/IAIPromptContentProvider.js';
import { ensureTerminalPunctuation } from '../utils/textUtils.js';
import {
  DEFAULT_FALLBACK_CHARACTER_NAME,
  DEFAULT_FALLBACK_DESCRIPTION_RAW,
  DEFAULT_FALLBACK_LOCATION_NAME,
  DEFAULT_FALLBACK_ACTION_COMMAND,
  DEFAULT_FALLBACK_ACTION_DESCRIPTION_RAW,
  PROMPT_FALLBACK_UNKNOWN_LOCATION,
  PROMPT_FALLBACK_NO_EXITS,
  PROMPT_FALLBACK_ALONE_IN_LOCATION,
  PROMPT_FALLBACK_NO_ACTIONS_NARRATIVE,
  PROMPT_FALLBACK_UNKNOWN_CHARACTER_DETAILS,
  PROMPT_FALLBACK_ACTOR_PROMPT_DATA_UNAVAILABLE,
  PROMPT_FALLBACK_MINIMAL_CHARACTER_DETAILS,
  ERROR_FALLBACK_CRITICAL_GAME_STATE_MISSING,
} from '../constants/textDefaults.js';
import { SHORT_TERM_MEMORY_COMPONENT_ID } from '../constants/componentIds.js';

/**
 * @class AIPromptContentProvider
 * @implements {IAIPromptContentProvider}
 * @description Generates specific content pieces from game state data for use with PromptBuilder.
 */
export class AIPromptContentProvider extends IAIPromptContentProvider {
  /** @type {ILogger} */
  #logger;
  /** @type {IPromptStaticContentService} */
  #promptStaticContentService;
  /** @type {IPerceptionLogFormatter} */
  #perceptionLogFormatter;
  /** @type {IGameStateValidationServiceForPrompting} */
  #gameStateValidationService;

  /**
   * @param {object} dependencies - Object containing required services.
   * @param {ILogger} dependencies.logger - Logger instance for logging.
   * @param {IPromptStaticContentService} dependencies.promptStaticContentService - Service for static prompt content.
   * @param {IPerceptionLogFormatter} dependencies.perceptionLogFormatter - Service to format perception logs.
   * @param {IGameStateValidationServiceForPrompting} dependencies.gameStateValidationService - Service to validate game state for prompting.
   * @returns {void}
   */
  constructor({
    logger,
    promptStaticContentService,
    perceptionLogFormatter,
    gameStateValidationService,
  }) {
    super();
    if (!logger)
      throw new Error('AIPromptContentProvider: Logger is required.');
    if (!promptStaticContentService)
      throw new Error(
        'AIPromptContentProvider: PromptStaticContentService is required.'
      );
    if (!perceptionLogFormatter)
      throw new Error(
        'AIPromptContentProvider: PerceptionLogFormatter is required.'
      );
    if (!gameStateValidationService)
      throw new Error(
        'AIPromptContentProvider: GameStateValidationServiceForPrompting is required.'
      );

    this.#logger = logger;
    this.#promptStaticContentService = promptStaticContentService;
    this.#perceptionLogFormatter = perceptionLogFormatter;
    this.#gameStateValidationService = gameStateValidationService;
    this.#logger.debug(
      'AIPromptContentProvider initialized with new services.'
    );
  }

  /**
   * @private
   * Helper method to format a list of items into a string segment for the prompt.
   * @param {string} title - Section title.
   * @param {Array<*>} items - Array of items to format.
   * @param {function(*): string} itemFormatter - Function to convert each item to a string.
   * @param {string} emptyMessage - Message to show if items is empty.
   * @param {ILogger} logger - Logger instance for debugging.
   * @returns {string} Formatted section string.
   */
  _formatListSegment(title, items, itemFormatter, emptyMessage, logger) {
    const cleanedTitle = title.replace(/[:\n]*$/, '');
    const lines = [cleanedTitle + ':'];

    if (items && items.length > 0) {
      items.forEach((item) => {
        lines.push(itemFormatter(item));
      });
      logger.debug(
        `AIPromptContentProvider: Formatted ${items.length} items for section "${cleanedTitle}".`
      );
    } else {
      lines.push(emptyMessage);
      logger.debug(
        `AIPromptContentProvider: Section "${cleanedTitle}" is empty, using empty message.`
      );
    }
    return lines.join('\n');
  }

  /**
   * @private
   * Helper method to format an optional attribute if it has a non-empty value.
   * @param {string} label - The label for the attribute.
   * @param {string | undefined | null} value - The attribute value.
   * @returns {string | null} Formatted attribute or null if empty.
   */
  _formatOptionalAttribute(label, value) {
    if (value && typeof value === 'string') {
      const trimmedValue = value.trim();
      if (trimmedValue !== '') {
        return `${label}: ${trimmedValue}`;
      }
    }
    return null;
  }

  /**
   * Validates if the provided AIGameStateDTO contains the critical information.
   *
   * @param {AIGameStateDTO | null | undefined} gameStateDto - The game state DTO to validate.
   * @param {ILogger} _logger - Logger instance for logging validation issues.
   * @returns {{isValid: boolean, errorContent: string | null}} Result of validation.
   */
  validateGameStateForPrompting(gameStateDto, _logger) {
    this.#logger.debug(
      `AIPromptContentProvider.validateGameStateForPrompting: Delegating to GameStateValidationServiceForPrompting.`
    );
    return this.#gameStateValidationService.validate(gameStateDto);
  }

  /**
   * @private
   * Validates the incoming game state or throws an Error if invalid.
   * @param {AIGameStateDTO | null | undefined} gameStateDto - The DTO to validate.
   * @param {ILogger} logger - Logger instance passed from caller.
   * @returns {void}
   * @throws {Error} If validation fails.
   */
  _validateOrThrow(gameStateDto, logger) {
    const validationResult = this.validateGameStateForPrompting(
      gameStateDto,
      logger
    );
    if (!validationResult.isValid) {
      const errorMessage =
        validationResult.errorContent ||
        ERROR_FALLBACK_CRITICAL_GAME_STATE_MISSING;
      this.#logger.error(
        `AIPromptContentProvider.getPromptData: Critical game state validation failed. Reason: ${errorMessage}`
      );
      throw new Error(errorMessage);
    }
  }

  /**
   * @private
   * Extracts commonly used values from the game state DTO.
   * @param {AIGameStateDTO} gameStateDto - The game state DTO.
   * @returns {{characterName: string, currentUserInput: string, perceptionLogArray: Array<RawPerceptionLogEntry>, locationName: string, componentsMap: object}}
   *   Object containing the extracted values and component map.
   */
  _extractCommonValues(gameStateDto) {
    const characterName =
      gameStateDto.actorPromptData?.name || DEFAULT_FALLBACK_CHARACTER_NAME;
    const currentUserInput = gameStateDto.currentUserInput || '';
    const rawPerceptionLog = /** @type {RawPerceptionLogEntry[]} */ (
      gameStateDto.perceptionLog || []
    );
    const perceptionLogArray =
      this.#perceptionLogFormatter.format(rawPerceptionLog);
    const locationName =
      gameStateDto.currentLocation?.name || 'an unknown place';
    const componentsMap =
      gameStateDto?.actorState?.components ??
      gameStateDto?.components ??
      gameStateDto?.actorState ??
      {};

    return {
      characterName,
      currentUserInput,
      perceptionLogArray,
      locationName,
      componentsMap,
    };
  }

  /**
   * @private
   * Extracts memory-related arrays from the provided components map.
   * @param {object} componentsMap - Actor or game components.
   * @returns {{thoughtsArray: string[], notesArray: Array<{text:string,timestamp:string}>, goalsArray: Array<{text:string,timestamp:string}>}}
   *   Object containing memory arrays for prompt data.
   */
  _extractMemoryComponents(componentsMap) {
    const memoryComp = componentsMap[SHORT_TERM_MEMORY_COMPONENT_ID];
    const thoughtsArray = Array.isArray(memoryComp?.thoughts)
      ? memoryComp.thoughts.map((t) => t.text).filter(Boolean)
      : [];

    const notesComp = componentsMap['core:notes'];
    const notesArray = Array.isArray(notesComp?.notes)
      ? notesComp.notes
          .filter(
            (n) =>
              typeof n.text === 'string' &&
              n.text.trim().length > 0 &&
              typeof n.timestamp === 'string' &&
              n.timestamp.trim().length > 0
          )
          .map((n) => ({ text: n.text, timestamp: n.timestamp }))
      : [];

    const goalsComp = componentsMap['core:goals'];
    const goalsArray = Array.isArray(goalsComp?.goals)
      ? goalsComp.goals
          .filter(
            (g) =>
              typeof g.text === 'string' &&
              g.text.trim().length > 0 &&
              typeof g.timestamp === 'string' &&
              g.timestamp.trim().length > 0
          )
          .map((g) => ({ text: g.text, timestamp: g.timestamp }))
      : [];

    this.#logger.debug(
      `AIPromptContentProvider.getPromptData: goalsArray contains ${goalsArray.length} entries.`
    );

    return { thoughtsArray, notesArray, goalsArray };
  }

  /**
   * @private
   * Combines base values and memory arrays into the final PromptData object.
   * @param {object} baseValues - Preassembled base prompt values.
   * @param {string[]} thoughtsArray - Extracted short-term memory thoughts.
   * @param {Array<{text:string,timestamp:string}>} notesArray - Extracted notes.
   * @param {Array<{text:string,timestamp:string}>} goalsArray - Extracted goals.
   * @returns {PromptData} The assembled PromptData object.
   */
  _buildPromptData(baseValues, thoughtsArray, notesArray, goalsArray) {
    const promptData = {
      ...baseValues,
      thoughtsArray,
      notesArray,
      goalsArray,
    };

    this.#logger.debug(
      'AIPromptContentProvider.getPromptData: PromptData assembled successfully.'
    );
    this.#logger.debug(
      `AIPromptContentProvider.getPromptData: Assembled PromptData keys: ${Object.keys(
        promptData
      ).join(', ')}`
    );
    this.#logger.debug(
      `AIPromptContentProvider.getPromptData: thoughtsArray contains ${thoughtsArray.length} entries.`
    );
    this.#logger.debug(
      `AIPromptContentProvider.getPromptData: notesArray contains ${notesArray.length} entries.`
    );
    return promptData;
  }

  /**
   * Assembles the complete PromptData object required for constructing an LLM prompt.
   *
   * @param {AIGameStateDTO} gameStateDto - The comprehensive game state for the current AI actor.
   * @param {ILogger} logger - Logger instance for logging during the assembly process.
   * @returns {Promise<PromptData>} A promise that resolves to the fully assembled PromptData object.
   * @throws {Error} If critical information is missing.
   */
  async getPromptData(gameStateDto, logger) {
    this.#logger.debug(
      'AIPromptContentProvider: Starting assembly of PromptData.'
    );

    // 1. Validate incoming DTO
    this._validateOrThrow(gameStateDto, logger);

    // 2. Extract commonly-used values
    const {
      characterName,
      currentUserInput,
      perceptionLogArray,
      locationName,
      componentsMap,
    } = this._extractCommonValues(gameStateDto);

    // 3. Assemble base PromptData
    let promptData;
    try {
      const baseValues = {
        taskDefinitionContent: this.getTaskDefinitionContent(),
        characterPersonaContent: this.getCharacterPersonaContent(
          gameStateDto,
          this.#logger
        ),
        portrayalGuidelinesContent:
          this.getCharacterPortrayalGuidelinesContent(characterName),
        contentPolicyContent: this.getContentPolicyContent(),
        worldContextContent: this.getWorldContextContent(
          gameStateDto,
          this.#logger
        ),
        availableActionsInfoContent: this.getAvailableActionsInfoContent(
          gameStateDto,
          this.#logger
        ),
        userInputContent: currentUserInput,
        finalInstructionsContent: this.getFinalInstructionsContent(),
        perceptionLogArray: perceptionLogArray,
        characterName: characterName,
        locationName: locationName,
      };

      const memoryData = this._extractMemoryComponents(componentsMap);

      promptData = this._buildPromptData(
        baseValues,
        memoryData.thoughtsArray,
        memoryData.notesArray,
        memoryData.goalsArray
      );

      return promptData;
    } catch (error) {
      const err = /** @type {Error} */ (error);
      this.#logger.error(
        `AIPromptContentProvider.getPromptData: Error during assembly of PromptData components: ${err.message}`,
        { error: err }
      );
      throw new Error(
        `AIPromptContentProvider.getPromptData: Failed to assemble PromptData due to internal error: ${err.message}`
      );
    }
  }

  /**
   * @param {AIGameStateDTO} gameState - The game state DTO.
   * @param {ILogger} [_logger] - Optional logger instance.
   * @returns {string} Formatted character persona content.
   */
  getCharacterPersonaContent(gameState, _logger) {
    this.#logger.debug(
      'AIPromptContentProvider: Formatting character persona content.'
    );
    const { actorPromptData } = gameState;

    if (!actorPromptData) {
      this.#logger.warn(
        'AIPromptContentProvider: actorPromptData is missing in getCharacterPersonaContent. Using fallback.'
      );
      return gameState.actorState
        ? PROMPT_FALLBACK_ACTOR_PROMPT_DATA_UNAVAILABLE
        : PROMPT_FALLBACK_UNKNOWN_CHARACTER_DETAILS;
    }

    const characterInfo = [];
    characterInfo.push(
      `YOU ARE ${
        actorPromptData.name || DEFAULT_FALLBACK_CHARACTER_NAME
      }.\nThis is your identity. All thoughts, actions, and words must stem from this core truth.`
    );

    if (actorPromptData.description) {
      characterInfo.push(`Your Description: ${actorPromptData.description}`);
    }
    const optionalAttributes = [
      this._formatOptionalAttribute(
        'Your Personality',
        actorPromptData.personality
      ),
      this._formatOptionalAttribute(
        'Your Profile / Background',
        actorPromptData.profile
      ),
      this._formatOptionalAttribute('Your Likes', actorPromptData.likes),
      this._formatOptionalAttribute('Your Dislikes', actorPromptData.dislikes),
      this._formatOptionalAttribute('Your Secrets', actorPromptData.secrets),
      this._formatOptionalAttribute('Your Fears', actorPromptData.fears),
    ];
    optionalAttributes.forEach((line) => {
      if (line !== null) characterInfo.push(line);
    });

    if (
      actorPromptData.speechPatterns &&
      actorPromptData.speechPatterns.length > 0
    ) {
      characterInfo.push(
        `Your Speech Patterns:\n- ${actorPromptData.speechPatterns.join('\n- ')}`
      );
    }

    if (
      characterInfo.length <= 1 &&
      (!actorPromptData.name ||
        actorPromptData.name === DEFAULT_FALLBACK_CHARACTER_NAME)
    ) {
      this.#logger.debug(
        'AIPromptContentProvider: Character details are minimal or name is default. Using PROMPT_FALLBACK_MINIMAL_CHARACTER_DETAILS.'
      );
      return PROMPT_FALLBACK_MINIMAL_CHARACTER_DETAILS;
    }
    return characterInfo.join('\n');
  }

  /**
   * @param {AIGameStateDTO} gameState - The game state DTO.
   * @param {ILogger} [_logger] - Optional logger instance.
   * @returns {string} Formatted world context content.
   */
  getWorldContextContent(gameState, _logger) {
    this.#logger.debug(
      'AIPromptContentProvider: Formatting world context content.'
    );
    const { currentLocation } = gameState;

    if (!currentLocation) {
      this.#logger.warn(
        'AIPromptContentProvider: currentLocation is missing in getWorldContextContent. Using fallback.'
      );
      return PROMPT_FALLBACK_UNKNOWN_LOCATION;
    }

    const locationDescriptionLines = [];
    const locationName = currentLocation.name || DEFAULT_FALLBACK_LOCATION_NAME;
    let locationDesc =
      currentLocation.description || DEFAULT_FALLBACK_DESCRIPTION_RAW;
    locationDesc = ensureTerminalPunctuation(locationDesc);
    locationDescriptionLines.push(
      `CURRENT SITUATION\nLocation: ${locationName}.\nDescription: ${locationDesc}`
    );

    const segments = [locationDescriptionLines.join('\n')];
    segments.push(
      this._formatListSegment(
        'Exits from your current location',
        currentLocation.exits,
        (exit) =>
          `- Towards ${exit.direction} leads to ${
            exit.targetLocationName ||
            exit.targetLocationId ||
            DEFAULT_FALLBACK_LOCATION_NAME
          }.`,
        PROMPT_FALLBACK_NO_EXITS,
        this.#logger
      )
    );
    segments.push(
      this._formatListSegment(
        'Other characters present in this location (you cannot speak as them)',
        currentLocation.characters,
        (char) => {
          const namePart = char.name || DEFAULT_FALLBACK_CHARACTER_NAME;
          let descriptionText =
            char.description || DEFAULT_FALLBACK_DESCRIPTION_RAW;
          descriptionText = ensureTerminalPunctuation(descriptionText);
          return `- ${namePart} - Description: ${descriptionText}`;
        },
        PROMPT_FALLBACK_ALONE_IN_LOCATION,
        this.#logger
      )
    );
    return segments.join('\n\n');
  }

  /**
   * @param {AIGameStateDTO} gameState - The game state DTO.
   * @param {ILogger} [_logger] - Optional logger instance.
   * @returns {string} Formatted available actions content.
   */
  getAvailableActionsInfoContent(gameState, _logger) {
    this.#logger.debug(
      'AIPromptContentProvider: Formatting available actions info content.'
    );
    const noActionsMessage = PROMPT_FALLBACK_NO_ACTIONS_NARRATIVE;

    if (
      !gameState.availableActions ||
      !Array.isArray(gameState.availableActions) ||
      gameState.availableActions.length === 0
    ) {
      this.#logger.warn(
        'AIPromptContentProvider: No available actions provided. Using fallback message for list segment.'
      );
    }

    return this._formatListSegment(
      'Choose one of the following available actions by its index',
      gameState.availableActions,
      (action) => {
        // action is an ActionComposite, with index, commandString, description, etc.
        const commandStr =
          action.commandString || DEFAULT_FALLBACK_ACTION_COMMAND;
        let description =
          action.description || DEFAULT_FALLBACK_ACTION_DESCRIPTION_RAW;
        description = ensureTerminalPunctuation(description);

        // The critical change: Add the index clearly at the start of the line.
        return `[Index: ${action.index}] Command: "${commandStr}". Description: ${description}`;
      },
      noActionsMessage,
      this.#logger
    );
  }

  /**
   * @returns {string} The core task definition text.
   */
  getTaskDefinitionContent() {
    return this.#promptStaticContentService.getCoreTaskDescriptionText();
  }

  /**
   * @param {string} characterName - Name of the character.
   * @returns {string} The portrayal guidelines text.
   */
  getCharacterPortrayalGuidelinesContent(characterName) {
    return this.#promptStaticContentService.getCharacterPortrayalGuidelines(
      characterName
    );
  }

  /**
   * @returns {string} The NC-21 content policy text.
   */
  getContentPolicyContent() {
    return this.#promptStaticContentService.getNc21ContentPolicyText();
  }

  /**
   * @returns {string} The final LLM instruction text.
   */
  getFinalInstructionsContent() {
    return this.#promptStaticContentService.getFinalLlmInstructionText();
  }
}
