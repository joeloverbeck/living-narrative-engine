// src/turns/services/AIPromptFormatter.js
// --- FILE START ---

/** @typedef {import('../../interfaces/coreServices.js').ILogger} ILogger */
/** @typedef {import('../interfaces/IAIPromptFormatter.js').IAIPromptFormatter} IAIPromptFormatter_Interface */
/** @typedef {import('../dtos/AIGameStateDTO.js').AIGameStateDTO} AIGameStateDTO */
/** @typedef {import('../dtos/AIGameStateDTO.js').ActorPromptDataDTO} ActorPromptDataDTO */
/** @typedef {import('../dtos/AIGameStateDTO.js').AILocationExitDTO} AILocationExitDTO */
/** @typedef {import('../dtos/AIGameStateDTO.js').AICharacterInLocationDTO} AICharacterInLocationDTO */
/** @typedef {import('../dtos/AIGameStateDTO.js').AIPerceptionLogEntryDTO} AIPerceptionLogEntryDTO */
/** @typedef {import('../dtos/AIGameStateDTO.js').AIAvailableActionDTO} AIAvailableActionDTO */

import {IAIPromptFormatter} from '../interfaces/IAIPromptFormatter.js';
import {LLM_TURN_ACTION_SCHEMA} from '../schemas/llmOutputSchemas.js';
import {ensureTerminalPunctuation} from '../../utils/textUtils.js';
// --- TICKET AIPF-REFACTOR-009 START: Import Standardized Fallback Strings ---
import {
    DEFAULT_FALLBACK_CHARACTER_NAME,
    DEFAULT_FALLBACK_DESCRIPTION_RAW,
    DEFAULT_FALLBACK_LOCATION_NAME,
    DEFAULT_FALLBACK_EVENT_DESCRIPTION_RAW,
    DEFAULT_FALLBACK_ACTION_ID,
    DEFAULT_FALLBACK_ACTION_COMMAND,
    DEFAULT_FALLBACK_ACTION_NAME, // Added for action name fallback
    DEFAULT_FALLBACK_ACTION_DESCRIPTION_RAW,
    PROMPT_FALLBACK_UNKNOWN_LOCATION,
    PROMPT_FALLBACK_NO_EXITS,
    PROMPT_FALLBACK_ALONE_IN_LOCATION,
    PROMPT_FALLBACK_NO_RECENT_EVENTS,
    PROMPT_FALLBACK_NO_ACTIONS_DEFAULT,
    PROMPT_FALLBACK_NO_ACTIONS_CAN_WAIT,
    PROMPT_FALLBACK_UNKNOWN_CHARACTER_DETAILS,
    PROMPT_FALLBACK_ACTOR_PROMPT_DATA_UNAVAILABLE,
    PROMPT_FALLBACK_MINIMAL_CHARACTER_DETAILS,
    ERROR_FALLBACK_CRITICAL_GAME_STATE_MISSING,
    ERROR_FALLBACK_ACTOR_STATE_MISSING
} from '../../constants/textDefaults.js';
// --- TICKET AIPF-REFACTOR-009 END ---

// --- TICKET AIPF-REFACTOR-007 START: Define Module-Level Constants ---
const PROMPT_INTRODUCTION_TEXT = `You are an AI character in a detailed, interactive text-based adventure game. Your primary task is to decide on one action to perform this turn and determine what, if anything, your character will say. Base your decision on your character's persona, the current situation, recent events, and the specific actions available to you. Act in a way that is believable and consistent with your character's motivations and understanding of the game world.`;

const LLM_RESPONSE_FORMAT_INSTRUCTIONS_TEXT = `RESPONSE FORMATTING INSTRUCTIONS:
You MUST respond with a single, valid JSON object. Do NOT include any text, explanations, or conversational pleasantries before or after this JSON object. Do not use markdown code blocks (e.g., \`\`\`json ... \`\`\`) or any other formatting around the final JSON output. Your entire response must be ONLY the JSON object itself.`;

const JSON_SCHEMA_INTRO_TEXT = `The JSON object MUST conform to the following structure (described using JSON Schema conventions - note the '$id' property of the schema itself is for registration and not part of your response object):
`;

const JSON_FIELD_GUIDANCE_TEXT = `GUIDANCE FOR FILLING THE JSON FIELDS:
1. \`actionDefinitionId\`: Use the exact 'System ID' (e.g., 'core:wait', 'core:go') from the 'Your available actions are:' list for your chosen action. This field is MANDATORY.
2. \`commandString\`: Use the 'Base Command' (e.g., 'wait', 'go north', 'take torch') associated with your chosen System ID. You MUST augment this base command with all necessary details (like specific direction for 'go', or target item and source for 'take') to make it a complete command the game can parse (e.g., 'go north', 'take a_torch from the old sconce'). If your character is speaking, you might integrate this if your game parser handles commands like 'say Hello there' or 'shout Help!'. This field is MANDATORY and must be self-sufficient.
3. \`speech\`: The exact words your character says. If not speaking, use an empty string \`""\`. This field is MANDATORY.`;

const EXAMPLE_1_TEXT = `EXAMPLE 1: Moving and speaking.
Suppose available action is: Name: "Go To Location", System ID: "core:go", Base Command: "go <direction>".
{
  "actionDefinitionId": "core:go",
  "commandString": "go out to town",
  "speech": "I think I'll head to town now."
}`;

const EXAMPLE_2_TEXT = `EXAMPLE 2: Taking an item without speech.
Suppose available action is: Name: "Take Item", System ID: "app:take_item", Base Command: "take <item>".
{
  "actionDefinitionId": "app:take_item",
  "commandString": "take old map",
  "speech": ""
}`;

const EXAMPLE_3_TEXT = `EXAMPLE 3: Waiting and not speaking.
Suppose available action is: Name: "Wait", System ID: "core:wait", Base Command: "wait".
{
  "actionDefinitionId": "core:wait",
  "commandString": "wait",
  "speech": ""
}`;

const FINAL_LLM_INSTRUCTION_TEXT = `Now, based on all the information provided, make your decision and provide your response ONLY as a valid JSON object adhering to the schema.`;

// --- TICKET AIPF-REFACTOR-007 END: Define Module-Level Constants ---


/**
 * @class AIPromptFormatter
 * @implements {IAIPromptFormatter_Interface}
 */
export class AIPromptFormatter extends IAIPromptFormatter {
    constructor() {
        super();
    }

    _formatListSegment(title, items, itemFormatter, emptyMessage, logger) {
        const cleanedTitle = title.replace(/[:\n]*$/, '');
        const lines = [title];

        if (items && items.length > 0) {
            items.forEach(item => {
                lines.push(itemFormatter(item));
            });
            logger?.debug(`AIPromptFormatter: Formatted ${items.length} items for section "${cleanedTitle}".`);
        } else {
            lines.push(emptyMessage);
            logger?.debug(`AIPromptFormatter: Section "${cleanedTitle}" is empty, using empty message.`);
        }
        return lines.join('\n');
    }

    _formatOptionalAttribute(label, value) {
        if (value && typeof value === 'string') {
            const trimmedValue = value.trim();
            if (trimmedValue !== '') {
                return `${label}: ${trimmedValue}`;
            }
        }
        return null;
    }

    _formatCharacterSegment(gameState, logger) {
        logger?.debug("AIPromptFormatter: Formatting character segment using actorPromptData.");
        const {actorPromptData} = gameState;

        if (!actorPromptData) {
            logger?.warn("AIPromptFormatter: Character details (actorPromptData) are missing or undefined in gameState.");
            if (!gameState.actorState) {
                logger?.warn("AIPromptFormatter: Raw character details (actorState) are also unknown.");
                // --- TICKET AIPF-REFACTOR-009: Use constant ---
                return PROMPT_FALLBACK_UNKNOWN_CHARACTER_DETAILS;
            }
            // --- TICKET AIPF-REFACTOR-009: Use constant ---
            return PROMPT_FALLBACK_ACTOR_PROMPT_DATA_UNAVAILABLE;
            // --- TICKET AIPF-REFACTOR-009 END ---
        }

        const characterInfo = [];

        // Name (from actorPromptData.name, already defaulted by ActorDataExtractor)
        characterInfo.push(`You are ${actorPromptData.name}.`);

        // Description (from actorPromptData.description, already defaulted and punctuated by ActorDataExtractor)
        // --- FIX START ---
        if (actorPromptData.description) {
            characterInfo.push(`Description: ${actorPromptData.description}`);
        }
        // --- FIX END ---

        const optionalAttributes = [
            this._formatOptionalAttribute("Personality", actorPromptData.personality),
            this._formatOptionalAttribute("Profile", actorPromptData.profile),
            this._formatOptionalAttribute("Likes", actorPromptData.likes),
            this._formatOptionalAttribute("Dislikes", actorPromptData.dislikes),
            this._formatOptionalAttribute("Secrets", actorPromptData.secrets)
        ];

        optionalAttributes.forEach(line => {
            if (line !== null) {
                characterInfo.push(line);
            }
        });

        if (actorPromptData.speechPatterns && actorPromptData.speechPatterns.length > 0) {
            characterInfo.push(`Speech Patterns:\n- ${actorPromptData.speechPatterns.join('\n- ')}`);
        }

        // --- TICKET AIPF-REFACTOR-009: Use constant in condition and message ---
        if (characterInfo.length <= 1 && actorPromptData.name === DEFAULT_FALLBACK_CHARACTER_NAME) {
            logger?.warn("AIPromptFormatter: Very minimal character information was formatted from actorPromptData.");
            return PROMPT_FALLBACK_MINIMAL_CHARACTER_DETAILS;
        }
        // --- TICKET AIPF-REFACTOR-009 END ---

        logger?.debug(`AIPromptFormatter: Character segment formatted successfully using actorPromptData for ${actorPromptData.name}.`);
        return characterInfo.join('\n');
    }

    _formatLocationSegment(gameState, logger) {
        logger?.debug("AIPromptFormatter: Formatting location segment.");
        const {currentLocation} = gameState;

        if (!currentLocation) {
            logger?.info("AIPromptFormatter: Current location is unknown.");
            // --- TICKET AIPF-REFACTOR-009: Use constant ---
            return PROMPT_FALLBACK_UNKNOWN_LOCATION;
            // --- TICKET AIPF-REFACTOR-009 END ---
        }

        const locationDescriptionLines = [];
        // --- TICKET AIPF-REFACTOR-009: Use constants for fallbacks ---
        const locationName = currentLocation.name || DEFAULT_FALLBACK_LOCATION_NAME;
        let locationDesc = currentLocation.description || DEFAULT_FALLBACK_DESCRIPTION_RAW;
        // --- TICKET AIPF-REFACTOR-009 END ---
        locationDesc = ensureTerminalPunctuation(locationDesc);
        locationDescriptionLines.push(`You are currently in the location: ${locationName}. Location description: ${locationDesc}`);

        const segments = [locationDescriptionLines.join('\n')];

        const exitsSegment = this._formatListSegment(
            "Exits from your current location:",
            currentLocation.exits,
            // --- TICKET AIPF-REFACTOR-009: Use constant for fallback location name if targetLocationName is missing ---
            (exit) => `- Towards ${exit.direction} leads to ${exit.targetLocationName || exit.targetLocationId || DEFAULT_FALLBACK_LOCATION_NAME}.`,
            // --- TICKET AIPF-REFACTOR-009 END ---
            // --- TICKET AIPF-REFACTOR-009: Use constant ---
            PROMPT_FALLBACK_NO_EXITS,
            // --- TICKET AIPF-REFACTOR-009 END ---
            logger
        );
        segments.push(exitsSegment);

        const charactersSegment = this._formatListSegment(
            "Other characters present in this location:",
            currentLocation.characters,
            (char) => {
                // --- TICKET AIPF-REFACTOR-009: Use constants for fallbacks ---
                const namePart = char.name || DEFAULT_FALLBACK_CHARACTER_NAME;
                let descriptionText = char.description || DEFAULT_FALLBACK_DESCRIPTION_RAW;
                // --- TICKET AIPF-REFACTOR-009 END ---
                descriptionText = ensureTerminalPunctuation(descriptionText);
                return `- ${namePart} - Description: ${descriptionText}`;
            },
            // --- TICKET AIPF-REFACTOR-009: Use constant ---
            PROMPT_FALLBACK_ALONE_IN_LOCATION,
            // --- TICKET AIPF-REFACTOR-009 END ---
            logger
        );
        segments.push(charactersSegment);

        return segments.join('\n');
    }

    _formatEventsSegment(gameState, logger) {
        logger?.debug("AIPromptFormatter: Formatting events segment.");
        return this._formatListSegment(
            "Recent events relevant to you (oldest first):",
            gameState.perceptionLog,
            (entry) => {
                // --- TICKET AIPF-REFACTOR-009: Use constant for fallback, ensure punctuation ---
                let eventDesc = entry.description || DEFAULT_FALLBACK_EVENT_DESCRIPTION_RAW;
                eventDesc = ensureTerminalPunctuation(eventDesc);
                return `- ${eventDesc}`;
                // --- TICKET AIPF-REFACTOR-009 END ---
            },
            // --- TICKET AIPF-REFACTOR-009: Use constant ---
            PROMPT_FALLBACK_NO_RECENT_EVENTS,
            // --- TICKET AIPF-REFACTOR-009 END ---
            logger
        );
    }

    _formatActionsSegment(gameState, logger) {
        logger?.debug("AIPromptFormatter: Formatting actions segment.");
        // --- TICKET AIPF-REFACTOR-009: Use constants for no-actions messages ---
        let noActionsMessage = PROMPT_FALLBACK_NO_ACTIONS_DEFAULT;
        if (gameState.availableActions && gameState.availableActions.length > 0) {
            if (gameState.availableActions.some(action => (action.id || "").toLowerCase().includes('wait'))) {
                noActionsMessage = PROMPT_FALLBACK_NO_ACTIONS_CAN_WAIT;
            }
        } else {
            logger?.warn("AIPromptFormatter: No available actions provided. The LLM must still try to produce valid JSON, perhaps using a generic 'wait' if it intuits one, but this should be handled by game design.");
        }
        // --- TICKET AIPF-REFACTOR-009 END ---

        return this._formatListSegment(
            "Your available actions are (for your JSON response, use 'System ID' for 'actionDefinitionId' and construct a complete 'commandString' based on the 'Base Command'):",
            gameState.availableActions,
            (action) => {
                // --- TICKET AIPF-REFACTOR-009: Use constants for fallbacks ---
                const systemId = action.id || DEFAULT_FALLBACK_ACTION_ID;
                const baseCommand = action.command || DEFAULT_FALLBACK_ACTION_COMMAND;
                const nameDisplay = action.name || DEFAULT_FALLBACK_ACTION_NAME; // Use specific name fallback
                let description = action.description || DEFAULT_FALLBACK_ACTION_DESCRIPTION_RAW;
                // --- TICKET AIPF-REFACTOR-009 END ---
                description = ensureTerminalPunctuation(description);
                return `- Name: "${nameDisplay}", System ID: "${systemId}", Base Command: "${baseCommand}". Description: ${description}`;
            },
            noActionsMessage,
            logger
        );
    }

    formatPrompt(gameState, logger) {
        const logInfo = (message, ...args) => (logger && logger.info) ? logger.info(message, ...args) : console.info(message, ...args);
        const logError = (message, ...args) => (logger && logger.error) ? logger.error(message, ...args) : console.error(message, ...args);

        logInfo("AIPromptFormatter: Starting LLM prompt generation.");

        if (!gameState) {
            logError("AIPromptFormatter: AIGameStateDTO is null or undefined. Cannot format prompt.");
            // --- TICKET AIPF-REFACTOR-009: Use constant ---
            return ERROR_FALLBACK_CRITICAL_GAME_STATE_MISSING;
            // --- TICKET AIPF-REFACTOR-009 END ---
        }
        if (!gameState.actorState) {
            logError("AIPromptFormatter: AIGameStateDTO is missing 'actorState'. Cannot format prompt meaningfully.", {gameState});
            // --- TICKET AIPF-REFACTOR-009: Use constant ---
            return ERROR_FALLBACK_ACTOR_STATE_MISSING;
            // --- TICKET AIPF-REFACTOR-009 END ---
        }
        if (!gameState.actorPromptData) {
            // This case is handled by _formatCharacterSegment, which will use PROMPT_FALLBACK_ACTOR_PROMPT_DATA_UNAVAILABLE.
            // Logging here is still good.
            logError("AIPromptFormatter: AIGameStateDTO is missing 'actorPromptData'. Character information will be incomplete.", {gameState});
        }


        const promptSegments = [];
        promptSegments.push(PROMPT_INTRODUCTION_TEXT);
        promptSegments.push(this._formatCharacterSegment(gameState, logger));
        promptSegments.push(this._formatLocationSegment(gameState, logger));
        promptSegments.push(this._formatEventsSegment(gameState, logger));
        promptSegments.push(this._formatActionsSegment(gameState, logger));
        promptSegments.push(LLM_RESPONSE_FORMAT_INSTRUCTIONS_TEXT);
        promptSegments.push(
            JSON_SCHEMA_INTRO_TEXT +
            JSON.stringify(LLM_TURN_ACTION_SCHEMA, null, 2)
        );
        promptSegments.push(JSON_FIELD_GUIDANCE_TEXT);
        promptSegments.push(EXAMPLE_1_TEXT);
        promptSegments.push(EXAMPLE_2_TEXT);
        promptSegments.push(EXAMPLE_3_TEXT);
        promptSegments.push(FINAL_LLM_INSTRUCTION_TEXT);

        const llmPromptString = promptSegments.join('\n\n');

        logInfo("AIPromptFormatter: LLM prompt generation complete.");
        return llmPromptString;
    }
}

// --- FILE END ---