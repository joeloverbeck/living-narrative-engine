// src/turns/services/AIPromptFormatter.js
// --- FILE START ---

/** @typedef {import('../../interfaces/coreServices.js').ILogger} ILogger */
/** @typedef {import('../interfaces/IAIPromptFormatter.js').IAIPromptFormatter} IAIPromptFormatter_Interface */
/** @typedef {import('../dtos/AIGameStateDTO.js').AIGameStateDTO} AIGameStateDTO */
/** @typedef {import('../dtos/AIGameStateDTO.js').AILocationExitDTO} AILocationExitDTO */
/** @typedef {import('../dtos/AIGameStateDTO.js').AICharacterInLocationDTO} AICharacterInLocationDTO */
/** @typedef {import('../dtos/AIGameStateDTO.js').AIPerceptionLogEntryDTO} AIPerceptionLogEntryDTO */
/** @typedef {import('../dtos/AIGameStateDTO.js').AIAvailableActionDTO} AIAvailableActionDTO */

import {IAIPromptFormatter} from '../interfaces/IAIPromptFormatter.js';
// MODIFICATION: LLM_TURN_ACTION_SCHEMA imported is now the modified one (without resolvedParameters)
import {LLM_TURN_ACTION_SCHEMA} from '../schemas/llmOutputSchemas.js';

// Import component IDs
import {
    NAME_COMPONENT_ID,
    DESCRIPTION_COMPONENT_ID,
    PERSONALITY_COMPONENT_ID,
    PROFILE_COMPONENT_ID,
    LIKES_COMPONENT_ID,
    DISLIKES_COMPONENT_ID,
    SECRETS_COMPONENT_ID,
    SPEECH_PATTERNS_COMPONENT_ID
} from '../../constants/componentIds.js'; // Assuming path to componentIds.js

/**
 * @class AIPromptFormatter
 * @implements {IAIPromptFormatter_Interface}
 * @description Responsible for transforming the structured AIGameStateDTO into a
 * textual prompt string suitable for an LLM, instructing it to return JSON.
 */
export class AIPromptFormatter extends IAIPromptFormatter {
    constructor() {
        super();
    }

    _formatListSegment(title, items, itemFormatter, emptyMessage, logger) {
        const lines = [title];
        if (items && items.length > 0) {
            items.forEach(item => {
                lines.push(itemFormatter(item));
            });
            if (logger && typeof logger.debug === 'function') {
                logger.debug(`AIPromptFormatter: Formatted ${items.length} items for section "${title.replace(/[:\n]*$/, '')}".`);
            }
        } else {
            lines.push(emptyMessage);
            if (logger && typeof logger.debug === 'function') {
                logger.debug(`AIPromptFormatter: Section "${title.replace(/[:\n]*$/, '')}" is empty, using empty message.`);
            }
        }
        return lines.join('\n');
    }

    _formatCharacterSegment(gameState, logger) {
        logger.debug("AIPromptFormatter: Formatting character segment.");
        const {actorState} = gameState;

        if (!actorState) {
            logger.warn("AIPromptFormatter: Character details (actorState) are unknown.");
            return "Your character details are unknown.";
        }

        const characterInfo = [];

        // Name (from core:name component)
        const nameComponent = actorState[NAME_COMPONENT_ID];
        const name = (nameComponent && nameComponent.text) ? nameComponent.text : "Unnamed Character";
        characterInfo.push(`You are ${name}.`);

        // Description (from core:description component)
        const descriptionComponent = actorState[DESCRIPTION_COMPONENT_ID];
        let description = (descriptionComponent && descriptionComponent.text) ? descriptionComponent.text : "No description available.";
        if (!/[.!?]$/.test(description.trim())) {
            description += '.';
        }
        characterInfo.push(`Description: ${description}`);

        // Personality (from core:personality component)
        const personalityComponent = actorState[PERSONALITY_COMPONENT_ID];
        if (personalityComponent && typeof personalityComponent.text === 'string' && personalityComponent.text.trim() !== '') {
            characterInfo.push(`Personality: ${personalityComponent.text.trim()}`);
        }

        // Profile (from core:profile component)
        const profileComponent = actorState[PROFILE_COMPONENT_ID];
        if (profileComponent && typeof profileComponent.text === 'string' && profileComponent.text.trim() !== '') {
            characterInfo.push(`Profile: ${profileComponent.text.trim()}`);
        }

        // Likes (from core:likes component)
        const likesComponent = actorState[LIKES_COMPONENT_ID];
        if (likesComponent && typeof likesComponent.text === 'string' && likesComponent.text.trim() !== '') {
            characterInfo.push(`Likes: ${likesComponent.text.trim()}`);
        }

        // Dislikes (from core:dislikes component)
        const dislikesComponent = actorState[DISLIKES_COMPONENT_ID];
        if (dislikesComponent && typeof dislikesComponent.text === 'string' && dislikesComponent.text.trim() !== '') {
            characterInfo.push(`Dislikes: ${dislikesComponent.text.trim()}`);
        }

        // Secrets (from core:secrets component)
        const secretsComponent = actorState[SECRETS_COMPONENT_ID];
        if (secretsComponent && typeof secretsComponent.text === 'string' && secretsComponent.text.trim() !== '') {
            characterInfo.push(`Secrets: ${secretsComponent.text.trim()}`);
        }

        // Speech Patterns (from core:speech_patterns component)
        const speechPatternsComponent = actorState[SPEECH_PATTERNS_COMPONENT_ID];
        if (speechPatternsComponent && Array.isArray(speechPatternsComponent.patterns) && speechPatternsComponent.patterns.length > 0) {
            const validPatterns = speechPatternsComponent.patterns.filter(p => typeof p === 'string' && p.trim() !== '');
            if (validPatterns.length > 0) {
                characterInfo.push(`Speech Patterns:\n- ${validPatterns.join('\n- ')}`);
            }
        }

        if (characterInfo.length === 0) { // Should not happen if name is always present
            logger.warn("AIPromptFormatter: No character information could be formatted.");
            return "Your character details are minimal or unknown.";
        }

        return characterInfo.join('\n');
    }

    _formatLocationSegment(gameState, logger) {
        logger.debug("AIPromptFormatter: Formatting location segment.");
        const {currentLocation} = gameState;

        if (!currentLocation) {
            logger.info("AIPromptFormatter: Current location is unknown.");
            return "Your current location is unknown.";
        }

        const locationDescriptionLines = [];
        const locationName = currentLocation.name || "Unnamed Location";
        let locationDesc = currentLocation.description || "No description available";
        // Ensure the location description text ends with appropriate terminal punctuation
        if (!/[.!?]$/.test(locationDesc.trim())) {
            locationDesc += '.';
        }
        // Use the (now correctly punctuated) locationDesc without adding another period.
        locationDescriptionLines.push(`You are currently in the location: ${locationName}. Location description: ${locationDesc}`);

        const segments = [locationDescriptionLines.join('\n')];

        const exitsSegment = this._formatListSegment(
            "Exits from your current location:",
            currentLocation.exits,
            // MODIFICATION: Display target location name instead of ID, and remove instructional text.
            // This assumes `exit.targetLocationName` is populated in AILocationExitDTO.
            (exit) => `- Towards ${exit.direction} leads to ${exit.targetLocationName}.`,
            "There are no obvious exits.",
            logger
        );
        segments.push(exitsSegment);

        const charactersSegment = this._formatListSegment(
            "Other characters present in this location:",
            currentLocation.characters,
            (char) => {
                const namePart = char.name || "Unnamed Character";
                let descriptionText = char.description || 'No description';
                if (!/[.!?]$/.test(descriptionText.trim())) {
                    descriptionText += '.';
                }
                return `- ${namePart} - Description: ${descriptionText}`;
            },
            "You are alone here.",
            logger
        );
        segments.push(charactersSegment);

        return segments.join('\n');
    }

    _formatEventsSegment(gameState, logger) {
        logger.debug("AIPromptFormatter: Formatting events segment.");
        return this._formatListSegment(
            "Recent events relevant to you (oldest first):",
            gameState.perceptionLog,
            (entry) => `- ${entry.description || 'Undescribed event.'}`,
            "Nothing noteworthy has happened recently.",
            logger
        );
    }

    _formatActionsSegment(gameState, logger) {
        logger.debug("AIPromptFormatter: Formatting actions segment.");
        // MODIFICATION: Message adjusted slightly for clarity given resolvedParameters removal.
        let noActionsMessage = "You have no specific actions available right now. If 'core:wait' (or similar) is an option, use its System ID for 'actionDefinitionId' and an appropriate 'commandString' (e.g., 'wait'). Otherwise, the game rules will dictate behavior.";
        if (gameState.availableActions && gameState.availableActions.length > 0) {
            if (gameState.availableActions.some(action => (action.id || "").toLowerCase().includes('wait'))) {
                noActionsMessage = "If no other action is suitable, you can choose to wait (e.g., using 'core:wait' or similar System ID and commandString 'wait').";
            }
        } else {
            logger.warn("AIPromptFormatter: No available actions provided. The LLM must still try to produce valid JSON, perhaps using a generic 'wait' if it intuits one, but this should be handled by game design.");
        }

        return this._formatListSegment(
            // MODIFICATION: Guidance for commandString slightly rephrased.
            "Your available actions are (for your JSON response, use 'System ID' for 'actionDefinitionId' and construct a complete 'commandString' based on the 'Base Command'):",
            gameState.availableActions,
            (action) => {
                const systemId = action.id || "unknown:id";
                const baseCommand = action.command || "unknown_command";
                const nameDisplay = action.name || baseCommand;
                const description = action.description || 'No specific description.';
                return `- Name: "${nameDisplay}", System ID: "${systemId}", Base Command: "${baseCommand}". Description: ${description}`;
            },
            noActionsMessage,
            logger
        );
    }

    formatPrompt(gameState, logger) {
        const logInfo = (message, ...args) => (logger && logger.info) ? logger.info(message, ...args) : console.info(message, ...args);
        const logError = (message, ...args) => (logger && logger.error) ? logger.error(message, ...args) : console.error(message, ...args);
        // const logDebug = (message, ...args) => (logger && logger.debug) ? logger.debug(message, ...args) : console.debug(message, ...args); // MODIFICATION: Removed as logDebug helper is no longer used here for the full prompt

        logInfo("AIPromptFormatter: Starting LLM prompt generation.");

        if (!gameState) {
            logError("AIPromptFormatter: AIGameStateDTO is null or undefined. Cannot format prompt.");
            return "Error: Critical game state information is missing. Cannot generate LLM prompt.";
        }
        if (!gameState.actorState) {
            logError("AIPromptFormatter: AIGameStateDTO is missing 'actorState'. Cannot format prompt meaningfully.", {gameState});
            return "Error: Actor state information is missing. Cannot generate LLM prompt.";
        }

        const promptSegments = [];
        promptSegments.push(
            "You are an AI character in a detailed, interactive text-based adventure game. " +
            "Your primary task is to decide on one action to perform this turn and determine what, if anything, your character will say. " +
            "Base your decision on your character's persona, the current situation, recent events, and the specific actions available to you. " +
            "Act in a way that is believable and consistent with your character's motivations and understanding of the game world."
        );
        promptSegments.push(this._formatCharacterSegment(gameState, logger));
        promptSegments.push(this._formatLocationSegment(gameState, logger));
        promptSegments.push(this._formatEventsSegment(gameState, logger));
        promptSegments.push(this._formatActionsSegment(gameState, logger));
        promptSegments.push(
            "RESPONSE FORMATTING INSTRUCTIONS:\n" +
            "You MUST respond with a single, valid JSON object. Do NOT include any text, explanations, or conversational pleasantries before or after this JSON object. " +
            "Do not use markdown code blocks (e.g., ```json ... ```) or any other formatting around the final JSON output. Your entire response must be ONLY the JSON object itself."
        );
        promptSegments.push(
            // MODIFICATION: LLM_TURN_ACTION_SCHEMA is now the one without resolvedParameters.
            // The $id property description clarifies it's for schema registration, not for the LLM to include.
            "The JSON object MUST conform to the following structure (described using JSON Schema conventions - note the '$id' property of the schema itself is for registration and not part of your response object):\n" +
            JSON.stringify(LLM_TURN_ACTION_SCHEMA, null, 2)
        );
        promptSegments.push(
            // MODIFICATION: Guidance for resolvedParameters removed, commandString guidance updated, speech renumbered.
            "GUIDANCE FOR FILLING THE JSON FIELDS:\n" +
            "1. `actionDefinitionId`: Use the exact 'System ID' (e.g., 'core:wait', 'core:go') from the 'Your available actions are:' list for your chosen action. This field is MANDATORY.\n" +
            "2. `commandString`: Use the 'Base Command' (e.g., 'wait', 'go north', 'take torch') associated with your chosen System ID. You MUST augment this base command with all necessary details (like specific direction for 'go', or target item and source for 'take') to make it a complete command the game can parse (e.g., 'go north', 'take a_torch from the old sconce'). If your character is speaking, you might integrate this if your game parser handles commands like 'say Hello there' or 'shout Help!'. This field is MANDATORY and must be self-sufficient.\n" +
            "3. `speech`: The exact words your character says. If not speaking, use an empty string `\"\"`. This field is MANDATORY."
        );
        promptSegments.push(
            // MODIFICATION: Examples updated to remove resolvedParameters and make commandString self-sufficient.
            "EXAMPLE 1: Moving and speaking.\n" +
            "Suppose available action is: Name: \"Go To Location\", System ID: \"core:go\", Base Command: \"go <direction>\".\n" +
            "{\n" +
            "  \"actionDefinitionId\": \"core:go\",\n" +
            "  \"commandString\": \"go out to town\",\n" + // Assumes "out to town" is a valid direction or target for 'go'
            "  \"speech\": \"I think I'll head to town now.\"\n" +
            "}"
        );
        promptSegments.push(
            "EXAMPLE 2: Taking an item without speech.\n" +
            "Suppose available action is: Name: \"Take Item\", System ID: \"app:take_item\", Base Command: \"take <item>\".\n" +
            "{\n" +
            "  \"actionDefinitionId\": \"app:take_item\",\n" +
            // commandString now includes the specifics previously in resolvedParameters
            "  \"commandString\": \"take old map\",\n" +
            "  \"speech\": \"\"\n" +
            "}"
        );
        promptSegments.push(
            "EXAMPLE 3: Waiting and not speaking.\n" +
            "Suppose available action is: Name: \"Wait\", System ID: \"core:wait\", Base Command: \"wait\".\n" +
            "{\n" +
            "  \"actionDefinitionId\": \"core:wait\",\n" +
            "  \"commandString\": \"wait\",\n" +
            "  \"speech\": \"\"\n" +
            "}"
        );
        promptSegments.push(
            "Now, based on all the information provided, make your decision and provide your response ONLY as a valid JSON object adhering to the schema."
        );

        const llmPromptString = promptSegments.join('\n\n');

        logInfo("AIPromptFormatter: LLM prompt generation complete.");
        // MODIFICATION: Removed the logDebug line that previously logged the full prompt here.
        // logDebug(`AIPromptFormatter: Generated Prompt (length ${llmPromptString.length}):\n${llmPromptString}`);

        return llmPromptString;
    }
}

// --- FILE END ---