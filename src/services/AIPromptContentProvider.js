// src/services/AIPromptContentProvider.js
// --- FILE START ---

/** @typedef {import('../interfaces/coreServices.js').ILogger} ILogger */
/** @typedef {import('../turns/dtos/AIGameStateDTO.js').AIGameStateDTO} AIGameStateDTO */
/** @typedef {import('../turns/dtos/AIGameStateDTO.js').ActorPromptDataDTO} ActorPromptDataDTO */
/** @typedef {import('../types/promptData.js').PromptData} PromptData */
/** @typedef {import('../interfaces/IPromptStaticContentService.js').IPromptStaticContentService} IPromptStaticContentService */
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


import {IAIPromptContentProvider} from "../turns/interfaces/IAIPromptContentProvider.js";
import {ensureTerminalPunctuation} from '../utils/textUtils.js';
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
    ERROR_FALLBACK_CRITICAL_GAME_STATE_MISSING
} from '../constants/textDefaults.js';

// Static constants and templates have been moved to PromptStaticContentService.js

/**
 * @class AIPromptContentProvider
 * @implements {IAIPromptContentProvider}
 * @description Generates specific content pieces from game state data for use with PromptBuilder.
 * This class is responsible for preparing the raw text for different sections of a prompt.
 */
export class AIPromptContentProvider extends IAIPromptContentProvider {
    /** @type {IPromptStaticContentService} */
    #promptStaticContentService;

    /**
     * @param {object} dependencies
     * @param {IPromptStaticContentService} dependencies.promptStaticContentService - Service for static prompt content.
     */
    constructor({promptStaticContentService}) {
        super();
        if (!promptStaticContentService) {
            throw new Error("AIPromptContentProvider: promptStaticContentService dependency is required.");
        }
        this.#promptStaticContentService = promptStaticContentService;
    }

    /**
     * @private
     * Helper method to format a list of items into a string segment for the prompt.
     * @param {string} title - The title of the segment.
     * @param {Array<*>} items - The array of items to format.
     * @param {function(*): string} itemFormatter - A function that formats a single item into a string.
     * @param {string} emptyMessage - The message to use if the items array is empty.
     * @param {ILogger | undefined} logger - Optional logger instance.
     * @returns {string} The formatted string segment.
     */
    _formatListSegment(title, items, itemFormatter, emptyMessage, logger) {
        const cleanedTitle = title.replace(/[:\n]*$/, '');
        const lines = [cleanedTitle + ":"];

        if (items && items.length > 0) {
            items.forEach(item => {
                lines.push(itemFormatter(item));
            });
            logger?.debug(`AIPromptContentProvider: Formatted ${items.length} items for section "${cleanedTitle}".`);
        } else {
            lines.push(emptyMessage);
            logger?.debug(`AIPromptContentProvider: Section "${cleanedTitle}" is empty, using empty message.`);
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
     * @param {AIGameStateDTO | null | undefined} gameStateDto - The game state DTO to validate.
     * @param {ILogger} logger - Logger instance for logging validation issues.
     * @returns {{isValid: boolean, errorContent: string | null}} An object indicating if the state is valid
     * and an error message if not.
     */
    validateGameStateForPrompting(gameStateDto, logger) {
        if (!gameStateDto) {
            logger?.error("AIPromptContentProvider.validateGameStateForPrompting: AIGameStateDTO is null or undefined.");
            return {isValid: false, errorContent: ERROR_FALLBACK_CRITICAL_GAME_STATE_MISSING};
        }
        if (!gameStateDto.actorState) {
            logger?.error("AIPromptContentProvider.validateGameStateForPrompting: AIGameStateDTO is missing 'actorState'. This might affect prompt data completeness indirectly.");
        }
        if (!gameStateDto.actorPromptData) {
            logger?.warn("AIPromptContentProvider.validateGameStateForPrompting: AIGameStateDTO is missing 'actorPromptData'. Character info will be limited or use fallbacks.");
        }
        return {isValid: true, errorContent: null};
    }

    /**
     * Assembles the complete PromptData object required for constructing an LLM prompt.
     * @param {AIGameStateDTO} gameStateDto - The comprehensive game state for the current AI actor.
     * @param {ILogger} logger - Logger instance for logging during the assembly process.
     * @returns {Promise<PromptData>} A promise that resolves to the fully assembled PromptData object.
     * @throws {Error} If critical information is missing (e.g., gameStateDto is null or validation fails)
     * and PromptData cannot be safely constructed.
     */
    async getPromptData(gameStateDto, logger) {
        logger.debug("AIPromptContentProvider: Starting assembly of PromptData.");

        const validationResult = this.validateGameStateForPrompting(gameStateDto, logger);
        if (!validationResult.isValid) {
            const errorMessage = validationResult.errorContent || ERROR_FALLBACK_CRITICAL_GAME_STATE_MISSING;
            logger.error(`AIPromptContentProvider.getPromptData: Critical game state validation failed. Reason: ${errorMessage}`);
            throw new Error(errorMessage);
        }

        const characterName = gameStateDto.actorPromptData?.name || DEFAULT_FALLBACK_CHARACTER_NAME;
        logger.debug(`AIPromptContentProvider.getPromptData: Character name resolved to: "${characterName}".`);

        const currentUserInput = gameStateDto.currentUserInput || "";
        logger.debug(`AIPromptContentProvider.getPromptData: Current user input resolved to: "${currentUserInput || "empty"}"`);

        const rawPerceptionLog = /** @type {RawPerceptionLogEntry[]} */ (gameStateDto.perceptionLog || []);
        const perceptionLogArray = rawPerceptionLog.map(rawEntry => {
            if (!rawEntry || typeof rawEntry !== 'object') {
                logger?.warn(`AIPromptContentProvider: Invalid raw perception log entry skipped: ${JSON.stringify(rawEntry)}`);
                return null;
            }

            const mappedEntry = {
                content: rawEntry.descriptionText || "",
                timestamp: rawEntry.timestamp,
                type: rawEntry.perceptionType,
                eventId: rawEntry.eventId,
                actorId: rawEntry.actorId,
                targetId: rawEntry.targetId
            };

            if (typeof mappedEntry.timestamp === 'undefined') {
                logger?.warn(`AIPromptContentProvider: Perception log entry (event ID: ${rawEntry.eventId || 'N/A'}) missing 'timestamp'. Placeholder {timestamp} may not resolve correctly. Original entry: ${JSON.stringify(rawEntry)}`);
            }
            if (typeof mappedEntry.type === 'undefined') {
                logger?.warn(`AIPromptContentProvider: Perception log entry (event ID: ${rawEntry.eventId || 'N/A'}) missing 'perceptionType' (for 'type'). Placeholder {type} may not resolve correctly. Original entry: ${JSON.stringify(rawEntry)}`);
            }
            if (mappedEntry.content === "") {
                logger?.debug(`AIPromptContentProvider: Perception log entry (event ID: ${rawEntry.eventId || 'N/A'}) resulted in empty 'content' after mapping from 'descriptionText'. Original entry: ${JSON.stringify(rawEntry)}`);
            }
            return mappedEntry;
        }).filter(entry => entry !== null);

        logger.debug(`AIPromptContentProvider.getPromptData: Processed perception log. Original count: ${rawPerceptionLog.length}, Mapped count for PromptBuilder: ${perceptionLogArray.length}.`);
        if (perceptionLogArray.length > 0) {
            logger.debug(`AIPromptContentProvider.getPromptData: First mapped perception log entry for PromptBuilder: ${JSON.stringify(perceptionLogArray[0])}`);
        }

        const locationName = gameStateDto.currentLocation?.name || "an unknown place";
        logger.debug(`AIPromptContentProvider.getPromptData: Location name resolved to: "${locationName}".`);

        try {
            const promptData = {
                taskDefinitionContent: this.getTaskDefinitionContent(),
                characterPersonaContent: this.getCharacterPersonaContent(gameStateDto, logger),
                portrayalGuidelinesContent: this.getCharacterPortrayalGuidelinesContent(characterName),
                contentPolicyContent: this.getContentPolicyContent(),
                worldContextContent: this.getWorldContextContent(gameStateDto, logger),
                availableActionsInfoContent: this.getAvailableActionsInfoContent(gameStateDto, logger),
                userInputContent: currentUserInput,
                finalInstructionsContent: this.getFinalInstructionsContent(),
                perceptionLogArray: perceptionLogArray,
                characterName: characterName,
                locationName: locationName,
            };

            logger.info("AIPromptContentProvider.getPromptData: PromptData assembled successfully.");
            logger.debug(`AIPromptContentProvider.getPromptData: Assembled PromptData keys: ${Object.keys(promptData).join(', ')}`);

            return promptData;
        } catch (error) {
            logger.error(`AIPromptContentProvider.getPromptData: Error during assembly of PromptData components: ${error.message}`, {error});
            throw new Error(`AIPromptContentProvider.getPromptData: Failed to assemble PromptData due to internal error: ${error.message}`);
        }
    }

    /**
     * Generates the character definition content.
     * @param {AIGameStateDTO} gameState - The game state DTO.
     * @param {ILogger | undefined} logger - Optional logger instance.
     * @returns {string} The formatted character segment.
     */
    getCharacterPersonaContent(gameState, logger) {
        logger?.debug("AIPromptContentProvider: Formatting character persona content.");
        const {actorPromptData} = gameState;

        if (!actorPromptData) {
            logger?.warn("AIPromptContentProvider: actorPromptData is missing. Using fallback.");
            return gameState.actorState ? PROMPT_FALLBACK_ACTOR_PROMPT_DATA_UNAVAILABLE : PROMPT_FALLBACK_UNKNOWN_CHARACTER_DETAILS;
        }

        const characterInfo = [];
        characterInfo.push(`YOU ARE ${actorPromptData.name || DEFAULT_FALLBACK_CHARACTER_NAME}.\nThis is your identity. All thoughts, actions, and words must stem from this core truth.`);

        if (actorPromptData.description) {
            characterInfo.push(`Your Description: ${actorPromptData.description}`);
        }
        const optionalAttributes = [
            this._formatOptionalAttribute("Your Personality", actorPromptData.personality),
            this._formatOptionalAttribute("Your Profile / Background", actorPromptData.profile),
            this._formatOptionalAttribute("Your Likes", actorPromptData.likes),
            this._formatOptionalAttribute("Your Dislikes", actorPromptData.dislikes),
            this._formatOptionalAttribute("Your Secrets", actorPromptData.secrets)
        ];
        optionalAttributes.forEach(line => {
            if (line !== null) characterInfo.push(line);
        });

        if (actorPromptData.speechPatterns && actorPromptData.speechPatterns.length > 0) {
            characterInfo.push(`Your Speech Patterns:\n- ${actorPromptData.speechPatterns.join('\n- ')}`);
        }

        if (characterInfo.length <= 1 && (!actorPromptData.name || actorPromptData.name === DEFAULT_FALLBACK_CHARACTER_NAME)) {
            return PROMPT_FALLBACK_MINIMAL_CHARACTER_DETAILS;
        }
        return characterInfo.join('\n');
    }

    /**
     * Generates the world context content (location, exits, other characters).
     * @param {AIGameStateDTO} gameState - The game state DTO.
     * @param {ILogger | undefined} logger - Optional logger instance.
     * @returns {string} The formatted world context segment.
     */
    getWorldContextContent(gameState, logger) {
        logger?.debug("AIPromptContentProvider: Formatting world context content.");
        const {currentLocation} = gameState;

        if (!currentLocation) {
            return PROMPT_FALLBACK_UNKNOWN_LOCATION;
        }

        const locationDescriptionLines = [];
        const locationName = currentLocation.name || DEFAULT_FALLBACK_LOCATION_NAME;
        let locationDesc = currentLocation.description || DEFAULT_FALLBACK_DESCRIPTION_RAW;
        locationDesc = ensureTerminalPunctuation(locationDesc);
        locationDescriptionLines.push(`CURRENT SITUATION\nLocation: ${locationName}.\nDescription: ${locationDesc}`);

        const segments = [locationDescriptionLines.join('\n')];

        segments.push(this._formatListSegment(
            "Exits from your current location",
            currentLocation.exits,
            (exit) => `- Towards ${exit.direction} leads to ${exit.targetLocationName || exit.targetLocationId || DEFAULT_FALLBACK_LOCATION_NAME}.`,
            PROMPT_FALLBACK_NO_EXITS,
            logger
        ));

        segments.push(this._formatListSegment(
            "Other characters present in this location (you cannot speak as them)",
            currentLocation.characters,
            (char) => {
                const namePart = char.name || DEFAULT_FALLBACK_CHARACTER_NAME;
                let descriptionText = char.description || DEFAULT_FALLBACK_DESCRIPTION_RAW;
                descriptionText = ensureTerminalPunctuation(descriptionText);
                return `- ${namePart} - Description: ${descriptionText}`;
            },
            PROMPT_FALLBACK_ALONE_IN_LOCATION,
            logger
        ));
        return segments.join('\n\n');
    }

    /**
     * Generates the available actions content.
     * @param {AIGameStateDTO} gameState - The game state DTO.
     * @param {ILogger | undefined} logger - Optional logger instance.
     * @returns {string} The formatted actions segment.
     */
    getAvailableActionsInfoContent(gameState, logger) {
        logger?.debug("AIPromptContentProvider: Formatting available actions info content.");
        let noActionsMessage = PROMPT_FALLBACK_NO_ACTIONS_NARRATIVE;

        if (!gameState.availableActions || gameState.availableActions.length === 0) {
            logger?.warn("AIPromptContentProvider: No available actions provided.");
        }

        return this._formatListSegment(
            "Consider these available actions when deciding what to do",
            gameState.availableActions,
            (action) => {
                const systemId = action.id || DEFAULT_FALLBACK_ACTION_ID;
                const baseCommand = action.command || DEFAULT_FALLBACK_ACTION_COMMAND;
                const nameDisplay = action.name || DEFAULT_FALLBACK_ACTION_NAME;
                let description = action.description || DEFAULT_FALLBACK_ACTION_DESCRIPTION_RAW;
                description = ensureTerminalPunctuation(description);
                return `- "${nameDisplay}" (Reference ID: ${systemId}). Description: ${description} (If you choose this, you might think of it as performing: '${baseCommand}'.)`;
            },
            noActionsMessage,
            logger
        );
    }

    /**
     * Returns the core task description text.
     * Delegates to PromptStaticContentService.
     * @returns {string}
     */
    getTaskDefinitionContent() {
        return this.#promptStaticContentService.getCoreTaskDescriptionText();
    }

    /**
     * Returns character portrayal guidelines.
     * Delegates to PromptStaticContentService.
     * @param {string} characterName - The name of the character.
     * @returns {string}
     */
    getCharacterPortrayalGuidelinesContent(characterName) {
        return this.#promptStaticContentService.getCharacterPortrayalGuidelines(characterName);
    }

    /**
     * Returns the NC-21 content policy text.
     * Delegates to PromptStaticContentService.
     * @returns {string}
     */
    getContentPolicyContent() {
        return this.#promptStaticContentService.getNc21ContentPolicyText();
    }

    /**
     * Returns the final LLM instruction text.
     * Delegates to PromptStaticContentService.
     * @returns {string}
     */
    getFinalInstructionsContent() {
        return this.#promptStaticContentService.getFinalLlmInstructionText();
    }
}

// --- FILE END ---