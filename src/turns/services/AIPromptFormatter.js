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
import {LLM_TURN_ACTION_SCHEMA} from '../schemas/llmOutputSchemas.js';

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
        const name = actorState.name || "Unnamed Character";
        let description = actorState.description || "No description available";
        // Ensure the description text ends with appropriate terminal punctuation
        if (!/[.!?]$/.test(description.trim())) {
            description += '.';
        }
        // Return without adding an extra period, as 'description' now handles its own punctuation.
        return `You are ${name}. Your character description: ${description}`;
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
            (exit) => `- Towards ${exit.direction} leads to ${exit.targetLocationId}. (To go this way, choose an action like 'core:go' with appropriate parameters, resulting in a command string like 'go ${exit.direction}').`,
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
        let noActionsMessage = "You have no specific actions available right now. If 'core:wait' (or similar) is an option, use its System ID for 'actionDefinitionId' and 'wait' (or similar) for 'commandString'. Otherwise, the game rules will dictate behavior.";
        if (gameState.availableActions && gameState.availableActions.length > 0) {
            if (gameState.availableActions.some(action => (action.id || "").toLowerCase().includes('wait'))) {
                noActionsMessage = "If no other action is suitable, you can choose to wait (e.g., using 'core:wait' or similar System ID).";
            }
        } else {
            logger.warn("AIPromptFormatter: No available actions provided. The LLM must still try to produce valid JSON, perhaps using a generic 'wait' if it intuits one, but this should be handled by game design.");
        }

        return this._formatListSegment(
            "Your available actions are (for your JSON response, use 'System ID' for 'actionDefinitionId' and 'Base Command' for 'commandString'):",
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
        const logDebug = (message, ...args) => (logger && logger.debug) ? logger.debug(message, ...args) : console.debug(message, ...args);

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
            "The JSON object MUST conform to the following structure (described using JSON Schema conventions - note the '$id' property of the schema itself is for registration and not part of your response object):\n" +
            JSON.stringify(LLM_TURN_ACTION_SCHEMA, null, 2)
        );
        promptSegments.push(
            "GUIDANCE FOR FILLING THE JSON FIELDS:\n" +
            "1. `actionDefinitionId`: Use the exact 'System ID' (e.g., 'core:wait', 'core:go') from the 'Your available actions are:' list for your chosen action. This field is MANDATORY.\n" +
            "2. `commandString`: Use the 'Base Command' (e.g., 'wait', 'go north', 'take torch') associated with your chosen System ID. You might need to fill in details (like direction for 'go', or target for 'take') to make it a complete command the game can parse, e.g., 'go north' or 'take torch from table'. If your character is speaking, you might integrate this if your game parser handles commands like 'say Hello there' or 'shout Help!'. This field is MANDATORY.\n" +
            "3. `resolvedParameters`: If the `commandString` doesn't capture all necessary specifics (like a target ID for an interaction if not part of the command string, or specific coordinates), provide them here. Example: for `actionDefinitionId: 'core:interact'`, `commandString: 'examine lever'`, `resolvedParameters: {'targetObjectId': 'lever_001'}`. If `commandString` is self-sufficient, use an empty object `{}`. This field is MANDATORY.\n" +
            "4. `speech`: The exact words your character says. If not speaking, use an empty string `\"\"`. This field is MANDATORY."
        );
        promptSegments.push(
            "EXAMPLE 1: Moving and speaking.\n" +
            "Suppose available action is: Name: \"Go To Location\", System ID: \"core:go\", Base Command: \"go\".\n" +
            "{\n" +
            "  \"actionDefinitionId\": \"core:go\",\n" +
            "  \"commandString\": \"go out to town\",\n" +
            "  \"resolvedParameters\": { \"direction\": \"out to town\" },\n" +
            "  \"speech\": \"I think I'll head to town now.\"\n" +
            "}"
        );
        promptSegments.push(
            "EXAMPLE 2: Taking an item without speech.\n" +
            "Suppose available action is: Name: \"Take Item\", System ID: \"app:take_item\", Base Command: \"take\".\n" +
            "{\n" +
            "  \"actionDefinitionId\": \"app:take_item\",\n" +
            "  \"commandString\": \"take the old map from the dusty table\",\n" +
            "  \"resolvedParameters\": { \"itemId\": \"map_ancient_01\", \"sourceContainerId\": \"table_dusty_003\" },\n" +
            "  \"speech\": \"\"\n" +
            "}"
        );
        promptSegments.push(
            "EXAMPLE 3: Waiting and not speaking.\n" +
            "Suppose available action is: Name: \"Wait\", System ID: \"core:wait\", Base Command: \"wait\".\n" +
            "{\n" +
            "  \"actionDefinitionId\": \"core:wait\",\n" +
            "  \"commandString\": \"wait\",\n" +
            "  \"resolvedParameters\": {},\n" +
            "  \"speech\": \"\"\n" +
            "}"
        );
        promptSegments.push(
            "EXAMPLE 4: Just speaking (using a 'say' action if available, or 'wait' and putting speech in `speech` and `commandString`).\n" +
            "Suppose available action is: Name: \"Say something\", System ID: \"app:say\", Base Command: \"say\".\n" +
            "{\n" +
            "  \"actionDefinitionId\": \"app:say\",\n" +
            "  \"commandString\": \"say Greetings, stranger!\",\n" +
            "  \"resolvedParameters\": { \"message\": \"Greetings, stranger!\" },\n" +
            "  \"speech\": \"Greetings, stranger!\"\n" +
            "}\n" +
            "Alternatively, if no specific 'say' action, using 'wait':\n" +
            "{\n" +
            "  \"actionDefinitionId\": \"core:wait\",\n" +
            "  \"commandString\": \"say Greetings, stranger!\",\n" +
            "  \"resolvedParameters\": {},\n" +
            "  \"speech\": \"Greetings, stranger!\"\n" +
            "}"
        );
        promptSegments.push(
            "Now, based on all the information provided, make your decision and provide your response ONLY as a valid JSON object adhering to the schema."
        );

        const llmPromptString = promptSegments.join('\n\n');

        logInfo("AIPromptFormatter: LLM prompt generation complete.");
        logDebug(`AIPromptFormatter: Generated Prompt (length ${llmPromptString.length}):\n${llmPromptString}`);

        return llmPromptString;
    }
}

// --- FILE END ---