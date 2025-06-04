// src/services/AIPromptContentProvider.js
// --- FILE START ---

/** @typedef {import('../interfaces/coreServices.js').ILogger} ILogger */
/** @typedef {import('../turns/dtos/AIGameStateDTO.js').AIGameStateDTO} AIGameStateDTO */
/** @typedef {import('../turns/dtos/AIGameStateDTO.js').ActorPromptDataDTO} ActorPromptDataDTO */
/** @typedef {import('../types/promptData.js').PromptData} PromptData */
/** @typedef {import('../interfaces/IPromptStaticContentService.js').IPromptStaticContentService} IPromptStaticContentService */
/** @typedef {import('../interfaces/IPerceptionLogFormatter.js').IPerceptionLogFormatter} IPerceptionLogFormatter */
/** @typedef {import('../interfaces/IGameStateValidationServiceForPrompting.js').IGameStateValidationServiceForPrompting} IGameStateValidationServiceForPrompting */
/**
 * @typedef {object} RawPerceptionLogEntry
 * @description Represents a single entry as it might come from the game state or entity component.
 * @property {string} [descriptionText] - The main textual content of the log entry.
 * @property {string} [perceptionType] - The category of the perceived event.
 * @property {string} [timestamp] - When the event occurred.
 * @property {string} [eventId] - Unique ID for the event or log entry.
 * @property {string} [actorId] - ID of the entity that caused the event.
 * @property {string} [targetId] - Optional ID of the primary target.
 * // ... any other properties from the original log entry schema
 */

import { IAIPromptContentProvider } from '../turns/interfaces/IAIPromptContentProvider.js';
import { ensureTerminalPunctuation } from '../utils/textUtils.js';
import {
  DEFAULT_FALLBACK_CHARACTER_NAME,
  DEFAULT_FALLBACK_DESCRIPTION_RAW,
  DEFAULT_FALLBACK_LOCATION_NAME,
  DEFAULT_FALLBACK_ACTION_ID,
  DEFAULT_FALLBACK_ACTION_COMMAND,
  DEFAULT_FALLBACK_ACTION_NAME,
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

// Static constants and templates have been moved to PromptStaticContentService.js

/**
 * @class AIPromptContentProvider
 * @implements {IAIPromptContentProvider}
 * @description Generates specific content pieces from game state data for use with PromptBuilder.
 * This class is responsible for preparing the raw text for different sections of a prompt.
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
   * @param {object} dependencies
   * @param {ILogger} dependencies.logger
   * @param {IPromptStaticContentService} dependencies.promptStaticContentService
   * @param {IPerceptionLogFormatter} dependencies.perceptionLogFormatter
   * @param {IGameStateValidationServiceForPrompting} dependencies.gameStateValidationService
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
   * @param {string} title - The title of the segment.
   * @param {Array<*>} items - The array of items to format.
   * @param {function(*): string} itemFormatter - A function that formats a single item into a string.
   * @param {string} emptyMessage - The message to use if the items array is empty.
   * @param {ILogger} logger - Logger instance (expected to be this.#logger from calling methods).
   * @returns {string} The formatted string segment.
   */
  _formatListSegment(title, items, itemFormatter, emptyMessage, logger) {
    // logger parameter is expected to be this.#logger and thus defined.
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
   * @param {string | undefined | null} value - The value of the attribute.
   * @returns {string | null} The formatted attribute string or null if the value is empty.
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
   * Validates if the provided AIGameStateDTO contains the critical information
   * necessary for generating prompt data.
   *
   * @param {AIGameStateDTO | null | undefined} gameStateDto - The game state DTO to validate.
   * @param {ILogger} logger - Logger instance for logging validation issues (as per interface).
   * @returns {{isValid: boolean, errorContent: string | null}} An object indicating if the state is valid
   * and an error message if not.
   */
  validateGameStateForPrompting(gameStateDto, logger) {
    // The `logger` argument is part of the IAIPromptContentProvider interface.
    // This method's own operational logging uses this.#logger.
    // The actual detailed validation logging will be done by the #gameStateValidationService, which uses its own logger.
    // The `logger` parameter is not passed to `this.#gameStateValidationService.validate` as the service manages its own logging.
    this.#logger.debug(
      `AIPromptContentProvider.validateGameStateForPrompting: Delegating to GameStateValidationServiceForPrompting.`
    );
    return this.#gameStateValidationService.validate(gameStateDto);
  }

  /**
   * Assembles the complete PromptData object required for constructing an LLM prompt.
   *
   * @param {AIGameStateDTO} gameStateDto - The comprehensive game state for the current AI actor.
   * @param {ILogger} logger - Logger instance for logging during the assembly process. (Note: this method will use the class's instance logger for its own operations)
   * @returns {Promise<PromptData>} A promise that resolves to the fully assembled PromptData object.
   * @throws {Error} If critical information is missing (e.g., gameStateDto is null or validation fails)
   * and PromptData cannot be safely constructed.
   */
  async getPromptData(gameStateDto, logger) {
    // `logger` here is from IAIPromptContentProvider interface, // eslint-disable-line no-unused-vars
    this.#logger.debug(
      'AIPromptContentProvider: Starting assembly of PromptData.'
    );

    // ------------------------------------------------------------------
    // 1. Validate incoming DTO
    // ------------------------------------------------------------------
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

    // ------------------------------------------------------------------
    // 2. Extract commonly-used values
    // ------------------------------------------------------------------
    const characterName =
      gameStateDto.actorPromptData?.name || DEFAULT_FALLBACK_CHARACTER_NAME;
    const currentUserInput = gameStateDto.currentUserInput || '';
    const rawPerceptionLog = /** @type {RawPerceptionLogEntry[]} */ (
      gameStateDto.perceptionLog || []
    );
    const perceptionLogArray =
      this.#perceptionLogFormatter.format(rawPerceptionLog);
    const locationName =
      gameStateDto.currentLocation?.name || 'an unknown place'; // literal fallback string used in tests

    // ------------------------------------------------------------------
    // 3. Assemble base PromptData (everything that already existed)
    // ------------------------------------------------------------------
    let promptData;
    try {
      promptData = {
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

      // ------------------------------------------------------------------
      // 4.  Pull short-term memory → thoughtsArray (oldest-first)
      // ------------------------------------------------------------------
      const componentsMap =
        gameStateDto?.actorState?.components ?? // preferred new location
        gameStateDto?.components ?? // legacy fall-back
        gameStateDto?.actorState ?? // very old code path
        {};

      const memoryComp = componentsMap[SHORT_TERM_MEMORY_COMPONENT_ID];
      promptData.thoughtsArray = Array.isArray(memoryComp?.thoughts)
        ? memoryComp.thoughts.map((t) => t.text).filter(Boolean)
        : [];

      // ------------------------------------------------------------------
      // 5. Wrap-up / logging
      // ------------------------------------------------------------------
      this.#logger.info(
        'AIPromptContentProvider.getPromptData: PromptData assembled successfully.'
      );
      this.#logger.debug(
        `AIPromptContentProvider.getPromptData: Assembled PromptData keys: ${Object.keys(promptData).join(', ')}`
      );
      this.#logger.debug(
        `AIPromptContentProvider.getPromptData: thoughtsArray contains ${promptData.thoughtsArray.length} entries.`
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
   * Generates the character definition content.
   *
   * @param {AIGameStateDTO} gameState - The game state DTO.
   * @param {ILogger | undefined} logger - Optional logger instance. (Note: This method uses this.#logger for its own logging)
   * @returns {string} The formatted character segment.
   */
  getCharacterPersonaContent(gameState, logger) {
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
      `YOU ARE ${actorPromptData.name || DEFAULT_FALLBACK_CHARACTER_NAME}.\nThis is your identity. All thoughts, actions, and words must stem from this core truth.`
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
      this._formatOptionalAttribute('Your Fears', actorPromptData.fears), // <<< Added fears
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
   * Generates the world context content (location, exits, other characters).
   *
   * @param {AIGameStateDTO} gameState - The game state DTO.
   * @param {ILogger | undefined} logger - Optional logger instance. (Note: This method uses this.#logger for its own logging)
   * @returns {string} The formatted world context segment.
   */
  getWorldContextContent(gameState, logger) {
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
          `- Towards ${exit.direction} leads to ${exit.targetLocationName || exit.targetLocationId || DEFAULT_FALLBACK_LOCATION_NAME}.`,
        PROMPT_FALLBACK_NO_EXITS,
        this.#logger // Pass this.#logger to the helper
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
        this.#logger // Pass this.#logger to the helper
      )
    );
    return segments.join('\n\n');
  }

  /**
   * Generates the available actions content.
   *
   * @param {AIGameStateDTO} gameState - The game state DTO.
   * @param {ILogger | undefined} logger - Optional logger instance. (Note: This method uses this.#logger for its own logging)
   * @returns {string} The formatted actions segment.
   */
  getAvailableActionsInfoContent(gameState, logger) {
    this.#logger.debug(
      'AIPromptContentProvider: Formatting available actions info content.'
    );
    const noActionsMessage = PROMPT_FALLBACK_NO_ACTIONS_NARRATIVE;

    if (
      !gameState.availableActions ||
      gameState.availableActions.length === 0
    ) {
      this.#logger.warn(
        'AIPromptContentProvider: No available actions provided. Using fallback message for list segment.'
      );
      // The _formatListSegment will handle logging the use of the empty message.
    }

    return this._formatListSegment(
      'Consider these available actions when deciding what to do',
      gameState.availableActions,
      (action) => {
        const systemId = action.id || DEFAULT_FALLBACK_ACTION_ID; // Corresponds to actionDefinitionId
        const baseCommand = action.command || DEFAULT_FALLBACK_ACTION_COMMAND; // Corresponds to commandString
        const nameDisplay = action.name || DEFAULT_FALLBACK_ACTION_NAME;
        let description =
          action.description || DEFAULT_FALLBACK_ACTION_DESCRIPTION_RAW;
        description = ensureTerminalPunctuation(description);

        // MODIFIED LINE:
        return `- "${nameDisplay}" (actionDefinitionId: "${systemId}", commandString: "${baseCommand}"). Description: ${description}`;
      },
      noActionsMessage,
      this.#logger // Pass this.#logger to the helper
    );
  }

  /**
   * Returns the core task description text.
   * Delegates to PromptStaticContentService.
   *
   * @returns {string}
   */
  getTaskDefinitionContent() {
    // Formerly: return CORE_TASK_DESCRIPTION_TEXT;
    return this.#promptStaticContentService.getCoreTaskDescriptionText();
  }

  /**
   * Returns character portrayal guidelines.
   * Delegates to PromptStaticContentService.
   *
   * @param {string} characterName - The name of the character.
   * @returns {string}
   */
  getCharacterPortrayalGuidelinesContent(characterName) {
    // Formerly: return CHARACTER_PORTRAYAL_GUIDELINES_TEMPLATE(characterName);
    return this.#promptStaticContentService.getCharacterPortrayalGuidelines(
      characterName
    );
  }

  /**
   * Returns the NC-21 content policy text.
   * Delegates to PromptStaticContentService.
   *
   * @returns {string}
   */
  getContentPolicyContent() {
    // Formerly: return NC_21_CONTENT_POLICY_TEXT;
    return this.#promptStaticContentService.getNc21ContentPolicyText();
  }

  /**
   * Returns the final LLM instruction text.
   * Delegates to PromptStaticContentService.
   *
   * @returns {string}
   */
  getFinalInstructionsContent() {
    // Formerly: return FINAL_LLM_INSTRUCTION_TEXT;
    return this.#promptStaticContentService.getFinalLlmInstructionText();
  }
}

// --- FILE END ---
