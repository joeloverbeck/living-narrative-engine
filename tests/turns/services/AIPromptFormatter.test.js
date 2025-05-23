// tests/turns/services/AIPromptFormatter.test.js
// --- FILE START ---

import {jest, describe, beforeEach, test, expect} from '@jest/globals';
import {AIPromptFormatter} from '../../../src/turns/services/AIPromptFormatter.js';
// Import the schema to ensure consistency if it's available to tests,
// otherwise, we'll define the stringified version as used in the formatter.
// For this update, I'll use a string constant that mirrors what the formatter generates.
// import { LLM_TURN_ACTION_SCHEMA } from '../../../src/turns/schemas/llmOutputSchemas.js';

/**
 * @returns {jest.Mocked<import('../../../src/interfaces/coreServices.js').ILogger>}
 */
const mockLogger = () => ({
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
    debug: jest.fn(),
});

// Define constants for the new prompt structure to make tests more readable
const NEW_INTRO_PARAGRAPH = "You are an AI character in a detailed, interactive text-based adventure game. " +
    "Your primary task is to decide on one action to perform this turn and determine what, if anything, your character will say. " +
    "Base your decision on your character's persona, the current situation, recent events, and the specific actions available to you. " +
    "Act in a way that is believable and consistent with your character's motivations and understanding of the game world.";

const LLM_SCHEMA_STRING = JSON.stringify({
    "$id": "llmTurnActionResponseSchema/v1",
    "type": "object",
    "properties": {
        "actionDefinitionId": {
            "type": "string",
            "description": "The unique System Identifier for the action to be performed (e.g., 'core:wait', 'core:go', 'app:take_item'). This MUST be one of the 'System ID' values provided in the 'Your available actions are:' section.",
            "minLength": 1
        },
        "commandString": {
            "type": "string",
            "description": "The actual command string that will be processed by the game's command parser (e.g., 'wait', 'go north', 'take a_torch from sconce', 'say Hello there'). This should be based on the 'Base Command' from the available actions list, potentially augmented with details from resolvedParameters or to include speech naturally if the action implies it. It should be a complete, parsable command.",
            "minLength": 1
        },
        "resolvedParameters": {
            "type": "object",
            "description": "An object containing any specific parameters required by the chosen action if they are not already part of the base command string. Example: for 'core:interact', commandString: 'examine lever', resolvedParameters: {'targetObjectId': 'lever_001'}. If commandString is self-sufficient, use an empty object {}. This field is MANDATORY.",
            "additionalProperties": true
        },
        "speech": {
            "type": "string",
            "description": "The exact words the character will say aloud. Provide an empty string (\"\") if the character chooses not to speak this turn. This speech might also be incorporated into the 'commandString' if appropriate for the game's parser (e.g., a 'say' command). This field is MANDATORY."
        }
    },
    "required": [
        "actionDefinitionId",
        "commandString",
        "resolvedParameters",
        "speech"
    ],
    "additionalProperties": false
}, null, 2);

const JSON_FORMATTING_INSTRUCTIONS_BLOCK = [
    "RESPONSE FORMATTING INSTRUCTIONS:\n" +
    "You MUST respond with a single, valid JSON object. Do NOT include any text, explanations, or conversational pleasantries before or after this JSON object. " +
    "Do not use markdown code blocks (e.g., ```json ... ```) or any other formatting around the final JSON output. Your entire response must be ONLY the JSON object itself.",

    "The JSON object MUST conform to the following structure (described using JSON Schema conventions - note the '$id' property of the schema itself is for registration and not part of your response object):\n" +
    LLM_SCHEMA_STRING,

    "GUIDANCE FOR FILLING THE JSON FIELDS:\n" +
    "1. `actionDefinitionId`: Use the exact 'System ID' (e.g., 'core:wait', 'core:go') from the 'Your available actions are:' list for your chosen action. This field is MANDATORY.\n" +
    "2. `commandString`: Use the 'Base Command' (e.g., 'wait', 'go north', 'take torch') associated with your chosen System ID. You might need to fill in details (like direction for 'go', or target for 'take') to make it a complete command the game can parse, e.g., 'go north' or 'take torch from table'. If your character is speaking, you might integrate this if your game parser handles commands like 'say Hello there' or 'shout Help!'. This field is MANDATORY.\n" +
    "3. `resolvedParameters`: If the `commandString` doesn't capture all necessary specifics (like a target ID for an interaction if not part of the command string, or specific coordinates), provide them here. Example: for `actionDefinitionId: 'core:interact'`, `commandString: 'examine lever'`, `resolvedParameters: {'targetObjectId': 'lever_001'}`. If `commandString` is self-sufficient, use an empty object `{}`. This field is MANDATORY.\n" +
    "4. `speech`: The exact words your character says. If not speaking, use an empty string `\"\"`. This field is MANDATORY.",

    "EXAMPLE 1: Moving and speaking.\n" +
    "Suppose available action is: Name: \"Go To Location\", System ID: \"core:go\", Base Command: \"go\".\n" +
    "{\n" +
    "  \"actionDefinitionId\": \"core:go\",\n" +
    "  \"commandString\": \"go out to town\",\n" +
    "  \"resolvedParameters\": { \"direction\": \"out to town\" },\n" +
    "  \"speech\": \"I think I'll head to town now.\"\n" +
    "}",

    "EXAMPLE 2: Taking an item without speech.\n" +
    "Suppose available action is: Name: \"Take Item\", System ID: \"app:take_item\", Base Command: \"take\".\n" +
    "{\n" +
    "  \"actionDefinitionId\": \"app:take_item\",\n" +
    "  \"commandString\": \"take the old map from the dusty table\",\n" +
    "  \"resolvedParameters\": { \"itemId\": \"map_ancient_01\", \"sourceContainerId\": \"table_dusty_003\" },\n" +
    "  \"speech\": \"\"\n" +
    "}",

    "EXAMPLE 3: Waiting and not speaking.\n" +
    "Suppose available action is: Name: \"Wait\", System ID: \"core:wait\", Base Command: \"wait\".\n" +
    "{\n" +
    "  \"actionDefinitionId\": \"core:wait\",\n" +
    "  \"commandString\": \"wait\",\n" +
    "  \"resolvedParameters\": {},\n" +
    "  \"speech\": \"\"\n" +
    "}",

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
    "}",

    "Now, based on all the information provided, make your decision and provide your response ONLY as a valid JSON object adhering to the schema."
].join('\n\n');


describe('AIPromptFormatter', () => {
    /** @type {AIPromptFormatter} */
    let formatter;
    /** @type {ReturnType<typeof mockLogger>} */
    let logger;

    // const CONCLUDING_INSTRUCTION = "Apart from picking one among the available actions, you have the opportunity to speak. " +
    // "It's not obligatory. Use your reasoning to determine if you should talk in this context."; // This is no longer used.

    beforeEach(() => {
        formatter = new AIPromptFormatter();
        logger = mockLogger();
        jest.clearAllMocks();
    });

    describe('constructor', () => {
        test('should create an instance of AIPromptFormatter', () => {
            expect(formatter).toBeInstanceOf(AIPromptFormatter);
        });
    });

    describe('formatPrompt', () => {
        describe('Valid and Complete DTO', () => {
            test('should format a complete AIGameStateDTO correctly', () => {
                const gameState = {
                    actorState: {
                        id: 'actor-123',
                        name: 'Test Actor',
                        description: 'A brave adventurer.', // Added period for consistency
                    },
                    currentLocation: {
                        name: 'The Grand Hall',
                        description: 'A vast hall with high ceilings.', // Added period
                        exits: [
                            {direction: 'north', targetLocationId: 'loc2'},
                            {direction: 'east', targetLocationId: 'loc3'},
                        ],
                        characters: [
                            {id: 'char-guard-1', name: 'Guard', description: 'A stern-looking guard.'},
                        ],
                    },
                    perceptionLog: [
                        {timestamp: Date.now(), type: 'sound', description: 'You hear a distant roar.'},
                        {timestamp: Date.now(), type: 'sight', description: 'A rat scurries past.'},
                    ],
                    availableActions: [
                        {id: 'core:move', command: 'go north', name: 'Move North', description: 'Move to the north.'},
                        {id: 'core:speak', command: 'say Hello', name: 'Speak', description: 'Talk to someone.'},
                    ],
                };

                const characterSegment = "You are Test Actor. Your character description: A brave adventurer.";
                const locationSegment = "You are currently in the location: The Grand Hall. Location description: A vast hall with high ceilings.\n" +
                    "Exits from your current location:\n" +
                    "- Towards north leads to loc2. (To go this way, choose an action like 'core:go' with appropriate parameters, resulting in a command string like 'go north').\n" +
                    "- Towards east leads to loc3. (To go this way, choose an action like 'core:go' with appropriate parameters, resulting in a command string like 'go east').\n" +
                    "Other characters present in this location:\n" +
                    "- Guard - Description: A stern-looking guard."; // Our fix ensures single period
                const eventsSegment = "Recent events relevant to you (oldest first):\n" +
                    "- You hear a distant roar.\n" +
                    "- A rat scurries past.";
                const actionsSegment = "Your available actions are (for your JSON response, use 'System ID' for 'actionDefinitionId' and 'Base Command' for 'commandString'):\n" +
                    '- Name: "Move North", System ID: "core:move", Base Command: "go north". Description: Move to the north.\n' +
                    '- Name: "Speak", System ID: "core:speak", Base Command: "say Hello". Description: Talk to someone.';

                const expectedPrompt = [
                    NEW_INTRO_PARAGRAPH,
                    characterSegment,
                    locationSegment,
                    eventsSegment,
                    actionsSegment,
                    JSON_FORMATTING_INSTRUCTIONS_BLOCK
                ].join('\n\n');

                const result = formatter.formatPrompt(gameState, logger);
                expect(result).toBe(expectedPrompt);
                expect(logger.info).toHaveBeenCalledWith("AIPromptFormatter: Starting LLM prompt generation.");
                expect(logger.info).toHaveBeenCalledWith("AIPromptFormatter: LLM prompt generation complete.");

                expect(logger.debug).toHaveBeenCalledWith("AIPromptFormatter: Formatting character segment.");
                expect(logger.debug).toHaveBeenCalledWith("AIPromptFormatter: Formatting location segment.");
                // Updated section titles for logger expectations
                expect(logger.debug).toHaveBeenCalledWith('AIPromptFormatter: Formatted 2 items for section "Exits from your current location".');
                expect(logger.debug).toHaveBeenCalledWith('AIPromptFormatter: Formatted 1 items for section "Other characters present in this location".');
                expect(logger.debug).toHaveBeenCalledWith("AIPromptFormatter: Formatting events segment.");
                expect(logger.debug).toHaveBeenCalledWith('AIPromptFormatter: Formatted 2 items for section "Recent events relevant to you (oldest first)".');
                expect(logger.debug).toHaveBeenCalledWith("AIPromptFormatter: Formatting actions segment.");
                expect(logger.debug).toHaveBeenCalledWith('AIPromptFormatter: Formatted 2 items for section "Your available actions are (for your JSON response, use \'System ID\' for \'actionDefinitionId\' and \'Base Command\' for \'commandString\')".');
                expect(logger.debug).toHaveBeenCalledWith(expect.stringContaining("AIPromptFormatter: Generated Prompt"));
                // Total debug calls: intro_segment + char_segment + loc_segment + exits_formatted + chars_formatted + events_segment + events_formatted + actions_segment + actions_formatted + final_prompt_log = 10?
                // Let's be more specific or check count if needed. The specific calls above are more important.
                // The provided formatter code logs 9 times for this case:
                // 1 (Formatting character) + 1 (Formatting location) + 1 (Exits list) + 1 (Characters list) + 1 (Formatting events) + 1 (Events list) + 1 (Formatting actions) + 1 (Actions list) + 1 (Generated Prompt log)
                expect(logger.debug).toHaveBeenCalledTimes(9);


                expect(logger.error).not.toHaveBeenCalled();
            });
        });

        describe('Null/Undefined AIGameStateDTO', () => {
            test('should return error prompt and log error if gameState is null', () => {
                // Updated expected error message
                const expectedErrorPrompt = "Error: Critical game state information is missing. Cannot generate LLM prompt.";
                const result = formatter.formatPrompt(null, logger);
                expect(result).toBe(expectedErrorPrompt);
                expect(logger.error).toHaveBeenCalledWith("AIPromptFormatter: AIGameStateDTO is null or undefined. Cannot format prompt.");
                expect(logger.info).toHaveBeenCalledWith("AIPromptFormatter: Starting LLM prompt generation.");
                expect(logger.info).not.toHaveBeenCalledWith("AIPromptFormatter: LLM prompt generation complete.");
            });

            test('should return error prompt and log error if gameState is undefined', () => {
                // Updated expected error message
                const expectedErrorPrompt = "Error: Critical game state information is missing. Cannot generate LLM prompt.";
                const result = formatter.formatPrompt(undefined, logger);
                expect(result).toBe(expectedErrorPrompt);
                expect(logger.error).toHaveBeenCalledWith("AIPromptFormatter: AIGameStateDTO is null or undefined. Cannot format prompt.");
                expect(logger.info).toHaveBeenCalledWith("AIPromptFormatter: Starting LLM prompt generation.");
                expect(logger.info).not.toHaveBeenCalledWith("AIPromptFormatter: LLM prompt generation complete.");
            });

            test('should return error prompt and log error if actorState is missing', () => {
                const gameState = {actorState: null}; // No actorState
                const expectedErrorPrompt = "Error: Actor state information is missing. Cannot generate LLM prompt.";
                const result = formatter.formatPrompt(gameState, logger);
                expect(result).toBe(expectedErrorPrompt);
                expect(logger.error).toHaveBeenCalledWith("AIPromptFormatter: AIGameStateDTO is missing 'actorState'. Cannot format prompt meaningfully.", {gameState});
                expect(logger.info).toHaveBeenCalledWith("AIPromptFormatter: Starting LLM prompt generation.");
                expect(logger.info).not.toHaveBeenCalledWith("AIPromptFormatter: LLM prompt generation complete.");
            });
        });

        describe('DTO with Partially Missing Data', () => {
            test('Actor State Missing Details: should use default names/descriptions', () => {
                const gameState = {
                    actorState: {
                        id: 'actor-empty',
                        name: null,       // Will default to "Unnamed Character"
                        description: undefined, // Will default to "No description available"
                    },
                    currentLocation: {
                        name: 'Default Room',
                        description: 'Plain.', // Added period
                        exits: [],
                        characters: [],
                    },
                    perceptionLog: [],
                    availableActions: [],
                };

                const characterSegment = "You are Unnamed Character. Your character description: No description available.";
                const locationSegment = "You are currently in the location: Default Room. Location description: Plain.\n" +
                    "Exits from your current location:\n" +
                    "There are no obvious exits.\n" +
                    "Other characters present in this location:\n" +
                    "You are alone here.";
                const eventsSegment = "Recent events relevant to you (oldest first):\n" +
                    "Nothing noteworthy has happened recently.";
                const actionsSegment = "Your available actions are (for your JSON response, use 'System ID' for 'actionDefinitionId' and 'Base Command' for 'commandString'):\n" +
                    "You have no specific actions available right now. If 'core:wait' (or similar) is an option, use its System ID for 'actionDefinitionId' and 'wait' (or similar) for 'commandString'. Otherwise, the game rules will dictate behavior.";


                const expectedPrompt = [
                    NEW_INTRO_PARAGRAPH,
                    characterSegment,
                    locationSegment,
                    eventsSegment,
                    actionsSegment,
                    JSON_FORMATTING_INSTRUCTIONS_BLOCK
                ].join('\n\n');

                const result = formatter.formatPrompt(gameState, logger);
                expect(result).toBe(expectedPrompt);
                expect(logger.debug).toHaveBeenCalledWith("AIPromptFormatter: Formatting character segment.");
                expect(logger.debug).toHaveBeenCalledWith('AIPromptFormatter: Section "Exits from your current location" is empty, using empty message.');
                expect(logger.debug).toHaveBeenCalledWith('AIPromptFormatter: Section "Other characters present in this location" is empty, using empty message.');
                expect(logger.debug).toHaveBeenCalledWith('AIPromptFormatter: Section "Recent events relevant to you (oldest first)" is empty, using empty message.');
                expect(logger.debug).toHaveBeenCalledWith('AIPromptFormatter: Section "Your available actions are (for your JSON response, use \'System ID\' for \'actionDefinitionId\' and \'Base Command\' for \'commandString\')" is empty, using empty message.');
            });

            test('currentLocation is null: should state location is unknown', () => {
                const gameState = {
                    actorState: {
                        id: 'actor-lost',
                        name: 'Lost Actor',
                        description: 'Confused.', // Added period
                    },
                    currentLocation: null,
                    perceptionLog: [],
                    availableActions: [],
                };

                const characterSegment = "You are Lost Actor. Your character description: Confused.";
                const locationSegment = "Your current location is unknown."; // Special case
                const eventsSegment = "Recent events relevant to you (oldest first):\n" +
                    "Nothing noteworthy has happened recently.";
                const actionsSegment = "Your available actions are (for your JSON response, use 'System ID' for 'actionDefinitionId' and 'Base Command' for 'commandString'):\n" +
                    "You have no specific actions available right now. If 'core:wait' (or similar) is an option, use its System ID for 'actionDefinitionId' and 'wait' (or similar) for 'commandString'. Otherwise, the game rules will dictate behavior.";

                const expectedPrompt = [
                    NEW_INTRO_PARAGRAPH,
                    characterSegment,
                    locationSegment,
                    eventsSegment,
                    actionsSegment,
                    JSON_FORMATTING_INSTRUCTIONS_BLOCK
                ].join('\n\n');

                const result = formatter.formatPrompt(gameState, logger);
                expect(result).toBe(expectedPrompt);
                expect(logger.info).toHaveBeenCalledWith("AIPromptFormatter: Current location is unknown.");
                expect(logger.debug).toHaveBeenCalledWith("AIPromptFormatter: Formatting location segment.");
            });

            test('Empty lists in currentLocation: should use emptyMessages for exits and characters', () => {
                const gameState = {
                    actorState: {id: 'actor-alone', name: 'Solo Explorer', description: 'Likes quiet places.'}, // Added period
                    currentLocation: {
                        name: 'Quiet Room',
                        description: 'A very quiet room.', // Added period
                        exits: [],
                        characters: [],
                    },
                    perceptionLog: [{timestamp: Date.now(), type: 'thought', description: 'It is quiet here.'}],
                    availableActions: [{id: 'core:wait', command: 'wait', name: 'Wait', description: 'Do nothing.'}],
                };

                const characterSegment = "You are Solo Explorer. Your character description: Likes quiet places.";
                const locationSegment = "You are currently in the location: Quiet Room. Location description: A very quiet room.\n" +
                    "Exits from your current location:\n" +
                    "There are no obvious exits.\n" +
                    "Other characters present in this location:\n" +
                    "You are alone here.";
                const eventsSegment = "Recent events relevant to you (oldest first):\n" +
                    "- It is quiet here.";
                const actionsSegment = "Your available actions are (for your JSON response, use 'System ID' for 'actionDefinitionId' and 'Base Command' for 'commandString'):\n" +
                    '- Name: "Wait", System ID: "core:wait", Base Command: "wait". Description: Do nothing.';


                const expectedPrompt = [
                    NEW_INTRO_PARAGRAPH,
                    characterSegment,
                    locationSegment,
                    eventsSegment,
                    actionsSegment,
                    JSON_FORMATTING_INSTRUCTIONS_BLOCK
                ].join('\n\n');

                const result = formatter.formatPrompt(gameState, logger);
                expect(result).toBe(expectedPrompt);
                expect(logger.debug).toHaveBeenCalledWith('AIPromptFormatter: Section "Exits from your current location" is empty, using empty message.');
                expect(logger.debug).toHaveBeenCalledWith('AIPromptFormatter: Section "Other characters present in this location" is empty, using empty message.');
            });

            test('Empty perceptionLog: should state "Nothing noteworthy has happened recently."', () => {
                const gameState = {
                    actorState: {id: 'actor-oblivious', name: 'Oblivious One', description: 'Not very observant.'}, // Added period
                    currentLocation: {
                        name: 'A Room',
                        description: 'Just a room.', // Added period
                        exits: [{direction: 'out', targetLocationId: 'somewhere'}],
                        characters: [{id: 'char-nobody', name: 'Nobody', description: 'Barely visible.'}],
                    },
                    perceptionLog: [],
                    availableActions: [{
                        id: 'core:ponder',
                        command: 'ponder',
                        name: 'Ponder',
                        description: 'Think deeply.'
                    }],
                };

                const characterSegment = "You are Oblivious One. Your character description: Not very observant.";
                const locationSegment = "You are currently in the location: A Room. Location description: Just a room.\n" +
                    "Exits from your current location:\n" +
                    "- Towards out leads to somewhere. (To go this way, choose an action like 'core:go' with appropriate parameters, resulting in a command string like 'go out').\n" +
                    "Other characters present in this location:\n" +
                    "- Nobody - Description: Barely visible."; // Our fix handles punctuation
                const eventsSegment = "Recent events relevant to you (oldest first):\n" +
                    "Nothing noteworthy has happened recently."; // Updated empty message
                const actionsSegment = "Your available actions are (for your JSON response, use 'System ID' for 'actionDefinitionId' and 'Base Command' for 'commandString'):\n" +
                    '- Name: "Ponder", System ID: "core:ponder", Base Command: "ponder". Description: Think deeply.';

                const expectedPrompt = [
                    NEW_INTRO_PARAGRAPH,
                    characterSegment,
                    locationSegment,
                    eventsSegment,
                    actionsSegment,
                    JSON_FORMATTING_INSTRUCTIONS_BLOCK
                ].join('\n\n');
                const result = formatter.formatPrompt(gameState, logger);
                expect(result).toBe(expectedPrompt);
                expect(logger.debug).toHaveBeenCalledWith("AIPromptFormatter: Formatting events segment.");
                expect(logger.debug).toHaveBeenCalledWith('AIPromptFormatter: Section "Recent events relevant to you (oldest first)" is empty, using empty message.');
            });

            test('Empty availableActions: should use new empty message', () => {
                const gameState = {
                    actorState: {id: 'actor-stuck', name: 'Stuck Sam', description: 'Can do nothing.'}, // Added period
                    currentLocation: {
                        name: 'Featureless Plain',
                        description: 'Endless, featureless plain.', // Added period
                        exits: [],
                        characters: [],
                    },
                    perceptionLog: [{timestamp: Date.now(), type: 'feeling', description: 'A sense of ennui.'}],
                    availableActions: [],
                };

                const characterSegment = "You are Stuck Sam. Your character description: Can do nothing.";
                const locationSegment = "You are currently in the location: Featureless Plain. Location description: Endless, featureless plain.\n" +
                    "Exits from your current location:\n" +
                    "There are no obvious exits.\n" +
                    "Other characters present in this location:\n" +
                    "You are alone here.";
                const eventsSegment = "Recent events relevant to you (oldest first):\n" +
                    "- A sense of ennui.";
                const actionsSegment = "Your available actions are (for your JSON response, use 'System ID' for 'actionDefinitionId' and 'Base Command' for 'commandString'):\n" +
                    "You have no specific actions available right now. If 'core:wait' (or similar) is an option, use its System ID for 'actionDefinitionId' and 'wait' (or similar) for 'commandString'. Otherwise, the game rules will dictate behavior."; // Updated empty message

                const expectedPrompt = [
                    NEW_INTRO_PARAGRAPH,
                    characterSegment,
                    locationSegment,
                    eventsSegment,
                    actionsSegment,
                    JSON_FORMATTING_INSTRUCTIONS_BLOCK
                ].join('\n\n');
                const result = formatter.formatPrompt(gameState, logger);
                expect(result).toBe(expectedPrompt);
                expect(logger.debug).toHaveBeenCalledWith("AIPromptFormatter: Formatting actions segment.");
                expect(logger.debug).toHaveBeenCalledWith('AIPromptFormatter: Section "Your available actions are (for your JSON response, use \'System ID\' for \'actionDefinitionId\' and \'Base Command\' for \'commandString\')" is empty, using empty message.');
            });
        });
    });
});

// --- FILE END ---