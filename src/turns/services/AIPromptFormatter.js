// src/turns/services/AIPromptFormatter.js
// --- FILE START ---

/** @typedef {import('../../interfaces/coreServices.js').ILogger} ILogger */
/** @typedef {import('../interfaces/IAIPromptFormatter.js').IAIPromptFormatter} IAIPromptFormatter_Interface */
/** @typedef {import('../dtos/AIGameStateDTO.js').AIGameStateDTO} AIGameStateDTO */
// Import DTOs that might be used by various itemFormatters in the future.
// Specific itemFormatters might be defined in this class or passed in.
// For now, these are placeholders for potential future use within this class,
// even if _formatListSegment itself is generic.
/** @typedef {import('../dtos/AIGameStateDTO.js').AILocationExitDTO} AILocationExitDTO */
/** @typedef {import('../dtos/AIGameStateDTO.js').AICharacterInLocationDTO} AICharacterInLocationDTO */
/** @typedef {import('../dtos/AIGameStateDTO.js').AIPerceptionLogEntryDTO} AIPerceptionLogEntryDTO */
/** @typedef {import('../dtos/AIGameStateDTO.js').AIAvailableActionDTO} AIAvailableActionDTO */

import {IAIPromptFormatter} from '../interfaces/IAIPromptFormatter.js';

/**
 * @class AIPromptFormatter
 * @implements {IAIPromptFormatter_Interface}
 * @description Responsible for transforming the structured AIGameStateDTO into a
 * textual prompt string suitable for an LLM.
 */
export class AIPromptFormatter extends IAIPromptFormatter {
    /**
     * Creates an instance of AIPromptFormatter.
     * Future: Constructor could accept configuration for different prompt styles or templates.
     */
    constructor() {
        super();
        // Initialization logic for the formatter, if any, would go here.
        // For example, loading prompt templates or configurations.
    }

    /**
     * @private
     * Helper to format a list of items for the prompt.
     * @template T
     * @param {string} title - The title for this section (e.g., "Exits:").
     * @param {Array<T> | undefined | null} items - The array of items to format.
     * @param {(item: T) => string} itemFormatter - A function that takes an item and returns its string representation for the prompt.
     * @param {string} emptyMessage - Message to display if items array is empty or not provided.
     * @param {ILogger} [logger] - Optional logger instance for debugging.
     * @returns {string} A formatted string segment.
     */
    _formatListSegment(title, items, itemFormatter, emptyMessage, logger) {
        const lines = [title]; // Title is the first line

        if (items && items.length > 0) {
            items.forEach(item => {
                // itemFormatter is responsible for any prefix like "-"
                lines.push(itemFormatter(item));
            });
            if (logger && typeof logger.debug === 'function') {
                logger.debug(`AIPromptFormatter: Formatted ${items.length} items for section "${title.replace(/[:\n]*$/, '')}".`);
            }
        } else {
            // If the title already ends with a colon or similar, we might just append.
            // Or, ensure the empty message stands on its own line if it's substantial.
            // Given the example: "Exits: None." vs "Exits:\nThere are no obvious exits."
            // The provided example logic adds emptyMessage as a new line.
            lines.push(emptyMessage);
            if (logger && typeof logger.debug === 'function') {
                logger.debug(`AIPromptFormatter: Section "${title.replace(/[:\n]*$/, '')}" is empty, using empty message.`);
            }
        }
        return lines.join('\n');
    }

    /**
     * @private
     * Formats the character segment of the prompt.
     * @param {AIGameStateDTO} gameState - The game state DTO.
     * @param {ILogger} logger - Logger instance.
     * @returns {string} The formatted character segment.
     */
    _formatCharacterSegment(gameState, logger) {
        logger.debug("AIPromptFormatter: Formatting character segment.");
        const {actorState} = gameState;
        if (!actorState) {
            logger.warn("AIPromptFormatter: Character details (actorState) are unknown.");
            return "Your character details are unknown.";
        }
        // Ensure name and description have fallbacks if they could be missing/undefined from DTO
        const name = actorState.name || "Unnamed Character";
        const description = actorState.description || "No description available";
        return `You're ${name}. Description: ${description}.`;
    }

    /**
     * @private
     * Formats the location segment of the prompt.
     * @param {AIGameStateDTO} gameState - The game state DTO.
     * @param {ILogger} logger - Logger instance.
     * @returns {string} The formatted location segment.
     */
    _formatLocationSegment(gameState, logger) {
        logger.debug("AIPromptFormatter: Formatting location segment.");
        const {currentLocation} = gameState;

        if (!currentLocation) {
            logger.info("AIPromptFormatter: Current location is unknown.");
            return "Your current location is unknown.";
        }

        const locationDescriptionLines = [];
        const locationName = currentLocation.name || "Unnamed Location";
        const locationDesc = currentLocation.description || "No description available";
        locationDescriptionLines.push(`You're in the location ${locationName}. Description: ${locationDesc}.`);

        const segments = [locationDescriptionLines.join('\n')];

        const exitsSegment = this._formatListSegment(
            "Exits:",
            currentLocation.exits,
            /** @type {(exit: AILocationExitDTO) => string} */
            (exit) => `- ${exit.direction} to ${exit.targetLocationId}`,
            "There are no obvious exits.",
            logger
        );
        segments.push(exitsSegment);

        const charactersSegment = this._formatListSegment(
            "Characters here:",
            currentLocation.characters,
            /** @type {(char: AICharacterInLocationDTO) => string} */
            (char) => `- ${char.name} (${char.description || 'No description'})`,
            "You are alone here.",
            logger
        );
        segments.push(charactersSegment);

        return segments.join('\n');
    }

    /**
     * @private
     * Formats the recent events (perception log) segment of the prompt.
     * @param {AIGameStateDTO} gameState - The game state DTO.
     * @param {ILogger} logger - Logger instance.
     * @returns {string} The formatted events segment.
     */
    _formatEventsSegment(gameState, logger) {
        logger.debug("AIPromptFormatter: Formatting events segment.");
        // AIPerceptionLogEntryDTO is already globally typedef'd
        return this._formatListSegment(
            "Recent events:",
            gameState.perceptionLog,
            /** @type {(entry: AIPerceptionLogEntryDTO) => string} */
            (entry) => {
                // As per ticket: "- ${entry.description}."
                // Consider if timestamp/type should be included based on LLM needs in the future.
                // For now, sticking to description only.
                return `- ${entry.description || 'Undescribed event.'}`;
            },
            "None.", // Empty message if no perception log entries
            logger
        );
    }

    /**
     * @private
     * Formats the available actions segment of the prompt.
     * @param {AIGameStateDTO} gameState - The game state DTO.
     * @param {ILogger} logger - Logger instance.
     * @returns {string} The formatted actions segment.
     */
    _formatActionsSegment(gameState, logger) {
        logger.debug("AIPromptFormatter: Formatting actions segment.");
        // AIAvailableActionDTO is already globally typedef'd
        return this._formatListSegment(
            "Your available actions are:",
            gameState.availableActions,
            /** @type {(action: AIAvailableActionDTO) => string} */
            (action) => {
                // As per ticket: "- ${action.command} (${action.description || action.name || 'Perform action'})."
                const details = action.description || action.name || 'Perform action';
                return `- ${action.command} (${details})`;
            },
            "You have no specific actions available right now.", // Empty message
            logger
        );
    }

    /**
     * Formats the provided AIGameStateDTO into a string suitable for use as an LLM prompt.
     * This method orchestrates calls to private helper methods to assemble the complete prompt.
     *
     * @param {AIGameStateDTO} gameState - The structured game state data for the AI actor.
     * @param {ILogger} logger - An instance of the logger.
     * @returns {string} The fully formatted LLM prompt string.
     */
    formatPrompt(gameState, logger) {
        // Task 1: Log the start of the overall prompt generation process
        if (!logger || typeof logger.info !== 'function' || typeof logger.error !== 'function') {
            console.error("AIPromptFormatter: Critical - Logger is missing or invalid in formatPrompt. Using console for this message.");
            // Decide if we should throw or attempt to continue with console,
            // but the ticket implies logger will be valid.
            // For robustness, we could have a fallback logger here if allowed.
            // However, strict adherence to ticket means it expects a valid logger.
            // If logger is truly unusable, many subsequent steps will fail.
            // Let's assume logger is valid for ticket scope, but log this specific issue.
        }

        if (logger && typeof logger.info === 'function') {
            logger.info("AIPromptFormatter: Starting LLM prompt generation.");
        } else {
            console.info("AIPromptFormatter: Starting LLM prompt generation (logger.info unavailable).");
        }

        // Task 2: Input Validation for gameState
        if (!gameState) {
            const errorMsg = "AIPromptFormatter: AIGameStateDTO is null or undefined. Cannot format prompt.";
            if (logger && typeof logger.error === 'function') {
                logger.error(errorMsg);
            } else {
                console.error(errorMsg + " (logger.error unavailable).");
            }
            return "Error: Critical game state information is missing to make a decision.";
        }

        // Task 3: Initialize an array promptSegments
        const promptSegments = [];

        // Task 4: Call Private Segment Formatters
        promptSegments.push(this._formatCharacterSegment(gameState, logger));
        promptSegments.push(this._formatLocationSegment(gameState, logger));
        promptSegments.push(this._formatEventsSegment(gameState, logger));
        promptSegments.push(this._formatActionsSegment(gameState, logger));

        // Task 5: Add Fixed Concluding Instruction
        promptSegments.push(
            "Apart from picking one among the available actions, you have the opportunity to speak. " +
            "It's not obligatory. Use your reasoning to determine if you should talk in this context."
        );

        // Task 6: Join Segments
        const llmPromptString = promptSegments.join('\n\n');

        // Task 7: Log the successful completion of prompt generation
        if (logger && typeof logger.info === 'function') {
            logger.info("AIPromptFormatter: LLM prompt generation complete.");
        } else {
            console.info("AIPromptFormatter: LLM prompt generation complete (logger.info unavailable).");
        }

        // Optional debug logging of the full prompt as mentioned in the ticket
        if (logger && typeof logger.debug === 'function') {
            logger.debug(`AIPromptFormatter: Generated Prompt (length ${llmPromptString.length}):\n${llmPromptString}`);
        }

        // Task 8: Return the final llmPromptString
        return llmPromptString;
    }
}

// --- FILE END ---