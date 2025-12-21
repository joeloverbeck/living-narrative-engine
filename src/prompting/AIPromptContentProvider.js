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
/** @typedef {import('./services/modActionMetadataProvider.js').ModActionMetadata} ModActionMetadata */

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
import { validateDependencies } from '../utils/dependencyUtils.js';
import { AgeUtils } from '../utils/ageUtils.js';
import { tokens } from '../dependencyInjection/tokens.js';
import { buildDarknessWorldContext } from './helpers/darknessWorldContextBuilder.js';

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
  /** @type {import('./characterDataXmlBuilder.js').CharacterDataXmlBuilder} */
  #characterDataXmlBuilder;
  /** @type {*} */
  #actionCategorizationService;
  /** @type {import('./services/modActionMetadataProvider.js').ModActionMetadataProvider} */
  #modActionMetadataProvider;

  /**
   * @param {object} dependencies - Object containing required services.
   * @param {ILogger} dependencies.logger - Logger instance for logging.
   * @param {IPromptStaticContentService} dependencies.promptStaticContentService - Service for static prompt content.
   * @param {IPerceptionLogFormatter} dependencies.perceptionLogFormatter - Service to format perception logs.
   * @param {IGameStateValidationServiceForPrompting} dependencies.gameStateValidationService - Service to validate game state for prompting.
   * @param {*} dependencies.actionCategorizationService - Service for action categorization.
   * @param {import('./characterDataXmlBuilder.js').CharacterDataXmlBuilder} dependencies.characterDataXmlBuilder - Builder for XML character data.
   * @param {import('./services/modActionMetadataProvider.js').ModActionMetadataProvider} dependencies.modActionMetadataProvider - Provider for mod action metadata.
   * @returns {void}
   */
  constructor({
    logger,
    promptStaticContentService,
    perceptionLogFormatter,
    gameStateValidationService,
    actionCategorizationService,
    characterDataXmlBuilder,
    modActionMetadataProvider,
  }) {
    super();
    validateDependencies(
      [
        {
          dependency: logger,
          name: 'AIPromptContentProvider: logger',
          methods: ['info', 'warn', 'error', 'debug'],
        },
        {
          dependency: promptStaticContentService,
          name: 'AIPromptContentProvider: promptStaticContentService',
          methods: [
            'getCoreTaskDescriptionText',
            'getCharacterPortrayalGuidelines',
            'getNc21ContentPolicyText',
            'getFinalLlmInstructionText',
          ],
        },
        {
          dependency: perceptionLogFormatter,
          name: 'AIPromptContentProvider: perceptionLogFormatter',
          methods: ['format'],
        },
        {
          dependency: gameStateValidationService,
          name: 'AIPromptContentProvider: gameStateValidationService',
          methods: ['validate'],
        },
        {
          dependency: actionCategorizationService,
          name: 'AIPromptContentProvider: actionCategorizationService',
          methods: [
            'extractNamespace',
            'shouldUseGrouping',
            'groupActionsByNamespace',
            'getSortedNamespaces',
            'formatNamespaceDisplayName',
          ],
        },
        {
          dependency: characterDataXmlBuilder,
          name: 'AIPromptContentProvider: characterDataXmlBuilder',
          methods: ['buildCharacterDataXml'],
        },
        {
          dependency: modActionMetadataProvider,
          name: 'AIPromptContentProvider: modActionMetadataProvider',
          methods: ['getMetadataForMod'],
        },
      ],
      logger
    );

    this.#logger = logger;
    this.#promptStaticContentService = promptStaticContentService;
    this.#perceptionLogFormatter = perceptionLogFormatter;
    this.#gameStateValidationService = gameStateValidationService;
    this.#actionCategorizationService = actionCategorizationService;
    this.#characterDataXmlBuilder = characterDataXmlBuilder;
    this.#modActionMetadataProvider = modActionMetadataProvider;
    this.#logger.debug(
      'AIPromptContentProvider initialized with XML builder for character data.'
    );
  }

  /**
   * @private
   * Helper method to format a list of items into a string segment for the prompt.
   * @param {string} title - Section title.
   * @param {Array<*>} items - Array of items to format.
   * @param {function(*): string} itemFormatter - Function to convert each item to a string.
   * @param {string} emptyMessage - Message to show if items is empty.
   * @returns {string} Formatted section string.
   */
  _formatListSegment(title, items, itemFormatter, emptyMessage) {
    const cleanedTitle = title.replace(/[:\n]*$/, '');
    const lines = [cleanedTitle + ':'];

    if (items && items.length > 0) {
      items.forEach((item) => {
        lines.push(itemFormatter(item));
      });
      this.#logger.debug(
        `AIPromptContentProvider: Formatted ${items.length} items for section "${cleanedTitle}".`
      );
    } else {
      lines.push(emptyMessage);
      this.#logger.debug(
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
   * @private
   * Parses structured character description into markdown bullet points.
   * @param {string} description - Character description to parse.
   * @returns {string[]} Array of formatted attribute lines.
   */
  _parseCharacterDescription(description) {
    const attributes = [];

    // Split by semicolons OR newlines, but preserve pipes within values (for clothing lists)
    const parts = description.split(/[;\n]/);

    for (const part of parts) {
      const trimmed = part.trim();
      if (trimmed.includes(':')) {
        const colonIndex = trimmed.indexOf(':');
        const key = trimmed.substring(0, colonIndex).trim();
        const value = trimmed.substring(colonIndex + 1).trim();

        if (key && value) {
          // Capitalize first letter of key and format as bullet point
          const formattedKey = key.charAt(0).toUpperCase() + key.slice(1);
          attributes.push(`- **${formattedKey}**: ${value}`);
        }
      } else if (trimmed.length > 0) {
        // Handle non-key-value parts as general description
        attributes.push(`- **Description**: ${trimmed}`);
      }
    }

    // If no structured attributes found, treat entire description as single item
    if (attributes.length === 0) {
      attributes.push(`- **Description**: ${description}`);
    }

    return attributes;
  }

  /**
   * @private
   * @description Extracts and sanitizes timestamped entries from a component.
   * @param {object} component - Component containing the entries array.
   * @param {string} key - Key of the array within the component.
   * @returns {Array<{text:string,timestamp:string}>} Sanitized array of entries.
   */
  _extractTimestampedEntries(component, key) {
    const entries = Array.isArray(component?.[key]) ? component[key] : [];
    return entries
      .filter(
        (e) =>
          typeof e.text === 'string' &&
          e.text.trim().length > 0 &&
          typeof e.timestamp === 'string' &&
          e.timestamp.trim().length > 0
      )
      .map((e) => ({ text: e.text, timestamp: e.timestamp }));
  }

  /**
   * @private
   * @description Extracts notes in structured format only.
   * @param {object} notesComp - The notes component.
   * @returns {Array<{text:string,subject:string,subjectType?:string,context?:string,timestamp?:string}>} Array of structured notes.
   */
  _extractNotes(notesComp) {
    const notes = Array.isArray(notesComp?.notes) ? notesComp.notes : [];
    return notes
      .filter((note) => {
        return (
          typeof note === 'object' &&
          note !== null &&
          typeof note.text === 'string' &&
          note.text.trim().length > 0
        );
      })
      .map((note) => {
        // Return structured note with all relevant fields (excluding tags)
        const result = { text: note.text };
        if (note.subject) result.subject = note.subject;
        if (note.subjectType) result.subjectType = note.subjectType;
        if (note.context) result.context = note.context;
        // Tags are intentionally excluded from the prompt pipeline
        if (note.timestamp) result.timestamp = note.timestamp;
        return result;
      });
  }

  /**
   * @private
   * @description Extracts goals with optional timestamps from a component.
   * @param {object} goalsComp - The goals component.
   * @returns {Array<{text:string,timestamp?:string}>} Array of goals with optional timestamps.
   */
  _extractGoals(goalsComp) {
    const goals = Array.isArray(goalsComp?.goals) ? goalsComp.goals : [];
    return goals
      .filter((goal) => {
        return (
          typeof goal === 'object' &&
          goal !== null &&
          typeof goal.text === 'string' &&
          goal.text.trim().length > 0
        );
      })
      .map((goal) => {
        // Return goal with text (required) and timestamp (optional)
        const result = { text: goal.text };
        if (goal.timestamp) result.timestamp = goal.timestamp;
        return result;
      });
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
   * @returns {{thoughtsArray: Array<{text:string,timestamp?:string}>, notesArray: Array<{text:string,subject?:string,subjectType?:string,context?:string,timestamp?:string}>, goalsArray: Array<{text:string,timestamp?:string}>}}
   *   Object containing memory arrays for prompt data.
   */
  _extractMemoryComponents(componentsMap) {
    const memoryComp = componentsMap[SHORT_TERM_MEMORY_COMPONENT_ID];
    const thoughtsArray = Array.isArray(memoryComp?.thoughts)
      ? memoryComp.thoughts.filter((t) => t && t.text)
      : [];

    const notesComp = componentsMap['core:notes'];
    const notesArray = this._extractNotes(notesComp);

    const goalsComp = componentsMap['core:goals'];
    const goalsArray = this._extractGoals(goalsComp);

    this.#logger.debug(
      `AIPromptContentProvider.getPromptData: goalsArray contains ${goalsArray.length} entries.`
    );

    return { thoughtsArray, notesArray, goalsArray };
  }

  /**
   * @private
   * Combines base values and memory arrays into the final PromptData object.
   * @param {object} baseValues - Preassembled base prompt values.
   * @param {Array<{text:string,timestamp?:string}>} thoughtsArray - Extracted short-term memory thoughts.
   * @param {Array<{text:string,timestamp?:string}>} notesArray - Extracted notes.
   * @param {Array<{text:string,timestamp?:string}>} goalsArray - Extracted goals.
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
        characterPersonaContent: this.getCharacterPersonaContent(gameStateDto),
        portrayalGuidelinesContent:
          this.getCharacterPortrayalGuidelinesContent(characterName),
        contentPolicyContent: this.getContentPolicyContent(),
        worldContextContent: this.getWorldContextContent(gameStateDto),
        availableActionsInfoContent:
          this.getAvailableActionsInfoContent(gameStateDto),
        userInputContent: currentUserInput,
        finalInstructionsContent: this.getFinalInstructionsContent(),
        perceptionLogArray: perceptionLogArray,
        characterName: characterName,
        locationName: locationName,
        assistantResponsePrefix: '\n', // Standard newline before assistant response
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
   * @returns {string} Formatted character persona content.
   */
  getCharacterPersonaContent(gameState) {
    this.#logger.debug(
      'AIPromptContentProvider: Formatting character persona content with XML structure.'
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

    // Check for minimal character details before formatting
    if (
      (!actorPromptData.name ||
        actorPromptData.name === DEFAULT_FALLBACK_CHARACTER_NAME) &&
      !actorPromptData.description &&
      !actorPromptData.personality &&
      !actorPromptData.profile
    ) {
      this.#logger.debug(
        'AIPromptContentProvider: Character details are minimal. Using PROMPT_FALLBACK_MINIMAL_CHARACTER_DETAILS.'
      );
      return PROMPT_FALLBACK_MINIMAL_CHARACTER_DETAILS;
    }

    // Use CharacterDataXmlBuilder for XML structure
    try {
      const formattedPersona =
        this.#characterDataXmlBuilder.buildCharacterDataXml(actorPromptData);

      if (!formattedPersona || formattedPersona.trim().length === 0) {
        this.#logger.warn(
          'AIPromptContentProvider: CharacterDataXmlBuilder returned empty result. Using fallback.'
        );
        return PROMPT_FALLBACK_MINIMAL_CHARACTER_DETAILS;
      }

      this.#logger.debug(
        'AIPromptContentProvider: Successfully formatted character persona with XML structure.'
      );
      return formattedPersona;
    } catch (error) {
      this.#logger.error(
        'AIPromptContentProvider: Error formatting character persona with CharacterDataXmlBuilder.',
        error
      );
      // Fallback to basic format if builder fails
      return `YOU ARE ${actorPromptData.name || DEFAULT_FALLBACK_CHARACTER_NAME}.\nThis is your identity. All thoughts, actions, and words must stem from this core truth.`;
    }
  }

  /**
   * @param {AIGameStateDTO} gameState - The game state DTO.
   * @returns {string} Formatted world context content.
   */
  getWorldContextContent(gameState) {
    this.#logger.debug(
      'AIPromptContentProvider: Formatting world context content with markdown structure.'
    );
    const { currentLocation } = gameState;

    if (!currentLocation) {
      this.#logger.warn(
        'AIPromptContentProvider: currentLocation is missing in getWorldContextContent. Using fallback.'
      );
      return PROMPT_FALLBACK_UNKNOWN_LOCATION;
    }

    // Check lighting state from DTO (undefined = lit for backward compat)
    const isLit = currentLocation.isLit !== false;

    if (!isLit) {
      this.#logger.debug(
        'AIPromptContentProvider: Location is in darkness, using darkness world context builder.'
      );
      return buildDarknessWorldContext({
        locationName: currentLocation.name || DEFAULT_FALLBACK_LOCATION_NAME,
        darknessDescription: currentLocation.descriptionInDarkness || null,
        characterCount: currentLocation.characters?.length || 0,
      });
    }

    // Build markdown-structured content for lit locations
    const segments = [];

    // Main header
    segments.push('## Current Situation');
    segments.push('');

    // Location section
    const locationName = currentLocation.name || DEFAULT_FALLBACK_LOCATION_NAME;
    segments.push('### Location');
    segments.push(locationName);
    segments.push('');

    // Description section
    let locationDesc =
      currentLocation.description || DEFAULT_FALLBACK_DESCRIPTION_RAW;
    locationDesc = ensureTerminalPunctuation(locationDesc);
    segments.push('### Description');
    segments.push(locationDesc);
    segments.push('');

    // Exits section
    segments.push('## Exits from Current Location');
    if (currentLocation.exits && currentLocation.exits.length > 0) {
      currentLocation.exits.forEach((exit) => {
        const formatDirection = (direction) => {
          if (direction.startsWith('to ') || direction.startsWith('into ')) {
            return direction;
          }
          return `Towards ${direction}`;
        };
        const targetName =
          exit.targetLocationName ||
          exit.targetLocationId ||
          DEFAULT_FALLBACK_LOCATION_NAME;
        const blockedSuffix = exit.isBlocked
          ? ` (blocked by ${exit.blockerName || 'Unknown blocker'})`
          : '';
        segments.push(
          `- **${formatDirection(exit.direction)}** leads to ${targetName}${blockedSuffix}`
        );
      });
      this.#logger.debug(
        `AIPromptContentProvider: Formatted ${currentLocation.exits.length} exits for location.`
      );
    } else {
      segments.push(PROMPT_FALLBACK_NO_EXITS);
      this.#logger.debug(
        'AIPromptContentProvider: No exits found, using fallback message.'
      );
    }
    segments.push('');

    // Characters section
    segments.push('## Other Characters Present');
    if (currentLocation.characters && currentLocation.characters.length > 0) {
      currentLocation.characters.forEach((char) => {
        const namePart = char.name || DEFAULT_FALLBACK_CHARACTER_NAME;
        let descriptionText =
          char.description || DEFAULT_FALLBACK_DESCRIPTION_RAW;
        descriptionText = ensureTerminalPunctuation(descriptionText);

        segments.push(`### ${namePart}`);

        // Add apparent age if available
        if (char.apparentAge) {
          const ageDescription = AgeUtils.formatAgeDescription(
            char.apparentAge
          );
          segments.push(`- **Apparent age**: ${ageDescription}`);
        }

        // Format character description as bullet points if it contains attribute-like information
        const hasStructuredDelimiter = /[;,\n]/.test(descriptionText);
        if (descriptionText.includes(':') && hasStructuredDelimiter) {
          // Parse structured character description into bullet points
          const attributes = this._parseCharacterDescription(descriptionText);
          attributes.forEach((attr) => segments.push(attr));
        } else {
          // Simple description without structure
          segments.push(`- **Description**: ${descriptionText}`);
        }
        segments.push('');
      });
      this.#logger.debug(
        `AIPromptContentProvider: Formatted ${currentLocation.characters.length} characters for location.`
      );
    } else {
      segments.push(PROMPT_FALLBACK_ALONE_IN_LOCATION);
      this.#logger.debug(
        'AIPromptContentProvider: No other characters found, using fallback message.'
      );
    }

    return segments.join('\n');
  }

  /**
   * Format actions with categorization when appropriate
   *
   * @private
   * @param {ActionComposite[]} actions - Array of actions to format
   * @returns {string} Formatted markdown content with categorized actions
   */
  _formatCategorizedActions(actions) {
    try {
      const startTime = performance.now();

      this.#logger.debug(
        'AIPromptContentProvider: Formatting categorized actions',
        {
          actionCount: actions.length,
        }
      );

      const grouped =
        this.#actionCategorizationService.groupActionsByNamespace(actions);

      if (grouped.size === 0) {
        this.#logger.warn(
          'AIPromptContentProvider: Grouping returned empty result, falling back to flat format'
        );
        return this._formatFlatActions(actions);
      }

      const segments = ['## Available Actions', ''];

      for (const [namespace, namespaceActions] of grouped) {
        const displayName =
          this.#actionCategorizationService.formatNamespaceDisplayName(
            namespace
          );

        // Look up mod manifest for metadata
        const metadata =
          this.#modActionMetadataProvider.getMetadataForMod(namespace);

        // Format header with action count
        segments.push(
          `### ${displayName} Actions (${namespaceActions.length} actions)`
        );

        // Add purpose if available
        if (metadata?.actionPurpose) {
          segments.push(`**Purpose:** ${metadata.actionPurpose}`);
        }

        // Add consider when if available
        if (metadata?.actionConsiderWhen) {
          segments.push(`**Consider when:** ${metadata.actionConsiderWhen}`);
        }

        // Add spacing after header metadata
        if (metadata?.actionPurpose || metadata?.actionConsiderWhen) {
          segments.push('');
        }

        for (const action of namespaceActions) {
          segments.push(this._formatSingleAction(action));
        }

        segments.push(''); // Empty line between sections
      }

      const duration = performance.now() - startTime;
      this.#logger.debug(
        'AIPromptContentProvider: Categorized formatting completed',
        {
          duration: `${duration.toFixed(2)}ms`,
          namespaceCount: grouped.size,
          totalActions: actions.length,
        }
      );

      return segments.join('\n').trim();
    } catch (error) {
      this.#logger.error(
        'AIPromptContentProvider: Error in categorized formatting, falling back to flat format',
        {
          error: error.message,
          actionCount: actions.length,
        }
      );

      // Graceful fallback to flat formatting
      return this._formatFlatActions(actions);
    }
  }

  /**
   * Format actions in flat (non-categorized) format
   *
   * @private
   * @param {ActionComposite[]} actions - Array of actions to format
   * @returns {string} Formatted flat list content
   */
  _formatFlatActions(actions) {
    this.#logger.debug(
      'AIPromptContentProvider: Using flat action formatting',
      {
        actionCount: actions.length,
      }
    );

    return this._formatListSegment(
      'Choose one of the following available actions by its index',
      actions,
      this._formatSingleAction.bind(this),
      PROMPT_FALLBACK_NO_ACTIONS_NARRATIVE
    );
  }

  /**
   * Format individual action entry consistently
   *
   * @private
   * @param {ActionComposite} action - Single action object to format
   * @returns {string} Formatted action line
   */
  _formatSingleAction(action) {
    if (!action) {
      this.#logger.warn(
        'AIPromptContentProvider: Attempted to format null/undefined action'
      );
      return '';
    }

    const commandStr = action.commandString || DEFAULT_FALLBACK_ACTION_COMMAND;
    let description =
      action.description || DEFAULT_FALLBACK_ACTION_DESCRIPTION_RAW;

    // Ensure description ends with punctuation for LLM readability
    description = ensureTerminalPunctuation(description);

    return `[Index: ${action.index}] Command: "${commandStr}". Description: ${description}`;
  }

  /**
   * Format available actions info content with optional categorization
   *
   * @param {AIGameStateDTO} gameState - Current game state
   * @returns {string} Formatted actions content for LLM prompt
   */
  getAvailableActionsInfoContent(gameState) {
    this.#logger.debug(
      'AIPromptContentProvider: Formatting available actions info content.'
    );

    const actions = gameState.availableActions || [];
    const noActionsMessage = PROMPT_FALLBACK_NO_ACTIONS_NARRATIVE;

    // Handle empty or invalid actions
    if (!Array.isArray(actions) || actions.length === 0) {
      this.#logger.warn(
        'AIPromptContentProvider: No available actions provided. Using fallback message.'
      );
      return noActionsMessage;
    }

    try {
      // Check if we should use categorization
      if (this.#actionCategorizationService.shouldUseGrouping(actions)) {
        this.#logger.debug(
          'AIPromptContentProvider: Using categorized formatting',
          {
            actionCount: actions.length,
          }
        );

        return this._formatCategorizedActions(actions);
      } else {
        this.#logger.debug(
          'AIPromptContentProvider: Using flat formatting (thresholds not met)',
          {
            actionCount: actions.length,
          }
        );

        return this._formatFlatActions(actions);
      }
    } catch (error) {
      this.#logger.error(
        'AIPromptContentProvider: Critical error in action formatting, using fallback',
        {
          error: error.message,
          actionCount: actions.length,
        }
      );

      // Ultimate fallback to original behavior
      return this._formatListSegment(
        'Choose one of the following available actions by its index',
        actions,
        (action) => {
          const commandStr =
            action.commandString || DEFAULT_FALLBACK_ACTION_COMMAND;
          const description =
            action.description || DEFAULT_FALLBACK_ACTION_DESCRIPTION_RAW;
          return `[Index: ${action.index}] Command: "${commandStr}". Description: ${ensureTerminalPunctuation(description)}`;
        },
        noActionsMessage
      );
    }
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
