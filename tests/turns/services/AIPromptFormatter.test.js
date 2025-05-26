// tests/turns/services/AIPromptFormatter.test.js
// --- FILE START ---

import {jest, describe, beforeEach, test, expect} from '@jest/globals';
import {AIPromptFormatter} from '../../../src/turns/services/AIPromptFormatter.js';
// Import the actual schema to ensure consistency
import {LLM_TURN_ACTION_SCHEMA} from '../../../src/turns/schemas/llmOutputSchemas.js';
// Import Component IDs needed for test data setup
import {NAME_COMPONENT_ID, DESCRIPTION_COMPONENT_ID} from '../../../src/constants/componentIds.js';

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

const LLM_SCHEMA_STRING = JSON.stringify(LLM_TURN_ACTION_SCHEMA, null, 2);

// MODIFICATION: Updated JSON_FORMATTING_INSTRUCTIONS_BLOCK
const JSON_FORMATTING_INSTRUCTIONS_BLOCK = [
    "RESPONSE FORMATTING INSTRUCTIONS:\n" +
    "You MUST respond with a single, valid JSON object. Do NOT include any text, explanations, or conversational pleasantries before or after this JSON object. " +
    "Do not use markdown code blocks (e.g., ```json ... ```) or any other formatting around the final JSON output. Your entire response must be ONLY the JSON object itself.",

    "The JSON object MUST conform to the following structure (described using JSON Schema conventions - note the '$id' property of the schema itself is for registration and not part of your response object):\n" +
    LLM_SCHEMA_STRING,

    "GUIDANCE FOR FILLING THE JSON FIELDS:\n" +
    "1. `actionDefinitionId`: Use the exact 'System ID' (e.g., 'core:wait', 'core:go') from the 'Your available actions are:' list for your chosen action. This field is MANDATORY.\n" +
    "2. `commandString`: Use the 'Base Command' (e.g., 'wait', 'go north', 'take torch') associated with your chosen System ID. You MUST augment this base command with all necessary details (like specific direction for 'go', or target item and source for 'take') to make it a complete command the game can parse (e.g., 'go north', 'take a_torch from the old sconce'). If your character is speaking, you might integrate this if your game parser handles commands like 'say Hello there' or 'shout Help!'. This field is MANDATORY and must be self-sufficient.\n" +
    "3. `speech`: The exact words your character says. If not speaking, use an empty string `\"\"`. This field is MANDATORY.",

    "EXAMPLE 1: Moving and speaking.\n" +
    "Suppose available action is: Name: \"Go To Location\", System ID: \"core:go\", Base Command: \"go <direction>\".\n" +
    "{\n" +
    "  \"actionDefinitionId\": \"core:go\",\n" +
    "  \"commandString\": \"go out to town\",\n" +
    "  \"speech\": \"I think I'll head to town now.\"\n" +
    "}",

    "EXAMPLE 2: Taking an item without speech.\n" +
    "Suppose available action is: Name: \"Take Item\", System ID: \"app:take_item\", Base Command: \"take <item>\".\n" + // Corrected Base Command
    "{\n" +
    "  \"actionDefinitionId\": \"app:take_item\",\n" +
    "  \"commandString\": \"take old map\",\n" + // Corrected commandString
    "  \"speech\": \"\"\n" +
    "}",

    "EXAMPLE 3: Waiting and not speaking.\n" +
    "Suppose available action is: Name: \"Wait\", System ID: \"core:wait\", Base Command: \"wait\".\n" +
    "{\n" +
    "  \"actionDefinitionId\": \"core:wait\",\n" +
    "  \"commandString\": \"wait\",\n" +
    "  \"speech\": \"\"\n" +
    "}",
    // EXAMPLE 4 removed
    "Now, based on all the information provided, make your decision and provide your response ONLY as a valid JSON object adhering to the schema."
].join('\n\n');


describe('AIPromptFormatter', () => {
    /** @type {AIPromptFormatter} */
    let formatter;
    /** @type {ReturnType<typeof mockLogger>} */
    let logger;

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
                        [NAME_COMPONENT_ID]: {text: 'Test Actor'},
                        [DESCRIPTION_COMPONENT_ID]: {text: 'A brave adventurer'}, // No period, formatter adds it
                        // Example of an optional component being present:
                        ['core:profile']: {text: 'A seasoned warrior.'}
                    },
                    currentLocation: {
                        name: 'The Grand Hall',
                        description: 'A vast hall with high ceilings.',
                        exits: [
                            {direction: 'north', targetLocationId: 'loc2', targetLocationName: 'North Passage'},
                            {direction: 'east', targetLocationId: 'loc3', targetLocationName: 'East Chamber'},
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

                // Updated characterSegment to reflect new structure and formatting
                const characterSegment = [
                    "You are Test Actor.",
                    "Description: A brave adventurer.", // Formatter adds period
                    "Profile: A seasoned warrior."      // Example optional component
                ].join('\n');

                const locationSegment = "You are currently in the location: The Grand Hall. Location description: A vast hall with high ceilings.\n" +
                    "Exits from your current location:\n" +
                    "- Towards north leads to North Passage.\n" +
                    "- Towards east leads to East Chamber.\n" +
                    "Other characters present in this location:\n" +
                    "- Guard - Description: A stern-looking guard.";
                const eventsSegment = "Recent events relevant to you (oldest first):\n" +
                    "- You hear a distant roar.\n" +
                    "- A rat scurries past.";
                const actionsSegment = "Your available actions are (for your JSON response, use 'System ID' for 'actionDefinitionId' and construct a complete 'commandString' based on the 'Base Command'):\n" +
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
                expect(logger.debug).toHaveBeenCalledWith('AIPromptFormatter: Formatted 2 items for section "Exits from your current location".');
                expect(logger.debug).toHaveBeenCalledWith('AIPromptFormatter: Formatted 1 items for section "Other characters present in this location".');
                expect(logger.debug).toHaveBeenCalledWith("AIPromptFormatter: Formatting events segment.");
                expect(logger.debug).toHaveBeenCalledWith('AIPromptFormatter: Formatted 2 items for section "Recent events relevant to you (oldest first)".');
                expect(logger.debug).toHaveBeenCalledWith("AIPromptFormatter: Formatting actions segment.");
                expect(logger.debug).toHaveBeenCalledWith('AIPromptFormatter: Formatted 2 items for section "Your available actions are (for your JSON response, use \'System ID\' for \'actionDefinitionId\' and construct a complete \'commandString\' based on the \'Base Command\')".');
                // MODIFICATION: Removed expectation for the debug log of the full prompt string
                // expect(logger.debug).toHaveBeenCalledWith(expect.stringContaining("AIPromptFormatter: Generated Prompt"));

                expect(logger.error).not.toHaveBeenCalled();
            });
        });

        describe('Null/Undefined AIGameStateDTO', () => {
            test('should return error prompt and log error if gameState is null', () => {
                const expectedErrorPrompt = "Error: Critical game state information is missing. Cannot generate LLM prompt.";
                const result = formatter.formatPrompt(null, logger);
                expect(result).toBe(expectedErrorPrompt);
                expect(logger.error).toHaveBeenCalledWith("AIPromptFormatter: AIGameStateDTO is null or undefined. Cannot format prompt.");
            });

            test('should return error prompt and log error if gameState is undefined', () => {
                const expectedErrorPrompt = "Error: Critical game state information is missing. Cannot generate LLM prompt.";
                const result = formatter.formatPrompt(undefined, logger);
                expect(result).toBe(expectedErrorPrompt);
                expect(logger.error).toHaveBeenCalledWith("AIPromptFormatter: AIGameStateDTO is null or undefined. Cannot format prompt.");
            });

            test('should return error prompt and log error if actorState is missing', () => {
                const gameState = {actorState: null};
                const expectedErrorPrompt = "Error: Actor state information is missing. Cannot generate LLM prompt.";
                const result = formatter.formatPrompt(gameState, logger);
                expect(result).toBe(expectedErrorPrompt);
                expect(logger.error).toHaveBeenCalledWith("AIPromptFormatter: AIGameStateDTO is missing 'actorState'. Cannot format prompt meaningfully.", {gameState});
            });
        });

        describe('DTO with Partially Missing Data', () => {
            test('Actor State Missing Details: should use default names/descriptions from AIGameStateProvider via AIPromptFormatter fallbacks', () => {
                // This test now assumes AIGameStateProvider provided its defaults.
                // AIPromptFormatter will use these if text is present, or its own fallbacks if component keys are missing.
                // For this test, we simulate what AIGameStateProvider would provide for an entity with no name/desc components.
                const gameState = {
                    actorState: {
                        id: 'actor-empty',
                        [NAME_COMPONENT_ID]: {text: 'Unknown Name'}, // Default from AIGameStateProvider
                        [DESCRIPTION_COMPONENT_ID]: {text: 'No description available.'}, // Default from AIGameStateProvider
                    },
                    currentLocation: {
                        name: 'Default Room',
                        description: 'Plain.',
                        exits: [],
                        characters: [],
                    },
                    perceptionLog: [],
                    availableActions: [],
                };

                // Expected character segment based on AIGameStateProvider defaults
                const characterSegment = "You are Unknown Name.\nDescription: No description available.";
                const locationSegment = "You are currently in the location: Default Room. Location description: Plain.\n" +
                    "Exits from your current location:\n" +
                    "There are no obvious exits.\n" +
                    "Other characters present in this location:\n" +
                    "You are alone here.";
                const eventsSegment = "Recent events relevant to you (oldest first):\n" +
                    "Nothing noteworthy has happened recently.";
                const actionsSegment = "Your available actions are (for your JSON response, use 'System ID' for 'actionDefinitionId' and construct a complete 'commandString' based on the 'Base Command'):\n" +
                    "You have no specific actions available right now. If 'core:wait' (or similar) is an option, use its System ID for 'actionDefinitionId' and an appropriate 'commandString' (e.g., 'wait'). Otherwise, the game rules will dictate behavior.";


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
            });

            test('currentLocation is null: should state location is unknown', () => {
                const gameState = {
                    actorState: {
                        id: 'actor-lost',
                        [NAME_COMPONENT_ID]: {text: 'Lost Actor'},
                        [DESCRIPTION_COMPONENT_ID]: {text: 'Confused'}, // Formatter adds period
                    },
                    currentLocation: null,
                    perceptionLog: [],
                    availableActions: [],
                };

                const characterSegment = "You are Lost Actor.\nDescription: Confused.";
                const locationSegment = "Your current location is unknown.";
                const eventsSegment = "Recent events relevant to you (oldest first):\n" +
                    "Nothing noteworthy has happened recently.";
                const actionsSegment = "Your available actions are (for your JSON response, use 'System ID' for 'actionDefinitionId' and construct a complete 'commandString' based on the 'Base Command'):\n" +
                    "You have no specific actions available right now. If 'core:wait' (or similar) is an option, use its System ID for 'actionDefinitionId' and an appropriate 'commandString' (e.g., 'wait'). Otherwise, the game rules will dictate behavior.";

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
            });

            test('Empty lists in currentLocation: should use emptyMessages for exits and characters', () => {
                const gameState = {
                    actorState: {
                        id: 'actor-alone',
                        [NAME_COMPONENT_ID]: {text: 'Solo Explorer'},
                        [DESCRIPTION_COMPONENT_ID]: {text: 'Likes quiet places'} // Formatter adds period
                    },
                    currentLocation: {
                        name: 'Quiet Room',
                        description: 'A very quiet room.',
                        exits: [],
                        characters: [],
                    },
                    perceptionLog: [{timestamp: Date.now(), type: 'thought', description: 'It is quiet here.'}],
                    availableActions: [{id: 'core:wait', command: 'wait', name: 'Wait', description: 'Do nothing.'}],
                };

                const characterSegment = "You are Solo Explorer.\nDescription: Likes quiet places.";
                const locationSegment = "You are currently in the location: Quiet Room. Location description: A very quiet room.\n" +
                    "Exits from your current location:\n" +
                    "There are no obvious exits.\n" +
                    "Other characters present in this location:\n" +
                    "You are alone here.";
                const eventsSegment = "Recent events relevant to you (oldest first):\n" +
                    "- It is quiet here.";
                const actionsSegment = "Your available actions are (for your JSON response, use 'System ID' for 'actionDefinitionId' and construct a complete 'commandString' based on the 'Base Command'):\n" +
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
            });

            test('Empty perceptionLog: should state "Nothing noteworthy has happened recently."', () => {
                const gameState = {
                    actorState: {
                        id: 'actor-oblivious',
                        [NAME_COMPONENT_ID]: {text: 'Oblivious One'},
                        [DESCRIPTION_COMPONENT_ID]: {text: 'Not very observant'} // Formatter adds period
                    },
                    currentLocation: {
                        name: 'A Room',
                        description: 'Just a room.',
                        exits: [{direction: 'out', targetLocationId: 'somewhere', targetLocationName: 'The Void'}],
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

                const characterSegment = "You are Oblivious One.\nDescription: Not very observant.";
                const locationSegment = "You are currently in the location: A Room. Location description: Just a room.\n" +
                    "Exits from your current location:\n" +
                    "- Towards out leads to The Void.\n" +
                    "Other characters present in this location:\n" +
                    "- Nobody - Description: Barely visible.";
                const eventsSegment = "Recent events relevant to you (oldest first):\n" +
                    "Nothing noteworthy has happened recently.";
                const actionsSegment = "Your available actions are (for your JSON response, use 'System ID' for 'actionDefinitionId' and construct a complete 'commandString' based on the 'Base Command'):\n" +
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
            });

            test('Empty availableActions: should use new empty message', () => {
                const gameState = {
                    actorState: {
                        id: 'actor-stuck',
                        [NAME_COMPONENT_ID]: {text: 'Stuck Sam'},
                        [DESCRIPTION_COMPONENT_ID]: {text: 'Can do nothing'} // Formatter adds period
                    },
                    currentLocation: {
                        name: 'Featureless Plain',
                        description: 'Endless, featureless plain.',
                        exits: [],
                        characters: [],
                    },
                    perceptionLog: [{timestamp: Date.now(), type: 'feeling', description: 'A sense of ennui.'}],
                    availableActions: [],
                };

                const characterSegment = "You are Stuck Sam.\nDescription: Can do nothing.";
                const locationSegment = "You are currently in the location: Featureless Plain. Location description: Endless, featureless plain.\n" +
                    "Exits from your current location:\n" +
                    "There are no obvious exits.\n" +
                    "Other characters present in this location:\n" +
                    "You are alone here.";
                const eventsSegment = "Recent events relevant to you (oldest first):\n" +
                    "- A sense of ennui.";
                const actionsSegment = "Your available actions are (for your JSON response, use 'System ID' for 'actionDefinitionId' and construct a complete 'commandString' based on the 'Base Command'):\n" +
                    "You have no specific actions available right now. If 'core:wait' (or similar) is an option, use its System ID for 'actionDefinitionId' and an appropriate 'commandString' (e.g., 'wait'). Otherwise, the game rules will dictate behavior.";

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
            });
        });
    });
});

// --- FILE END ---