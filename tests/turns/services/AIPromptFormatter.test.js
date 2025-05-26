// tests/turns/services/AIPromptFormatter.test.js
// --- FILE START ---

import {jest, describe, beforeEach, test, expect} from '@jest/globals';
import {AIPromptFormatter} from '../../../src/turns/services/AIPromptFormatter.js';
import {LLM_TURN_ACTION_SCHEMA} from '../../../src/turns/schemas/llmOutputSchemas.js';
import {
    NAME_COMPONENT_ID,
    DESCRIPTION_COMPONENT_ID,
    PROFILE_COMPONENT_ID,
    PERSONALITY_COMPONENT_ID,
    LIKES_COMPONENT_ID,
    DISLIKES_COMPONENT_ID,
    SECRETS_COMPONENT_ID,
    SPEECH_PATTERNS_COMPONENT_ID
} from '../../../src/constants/componentIds.js';

// --- TICKET AIPF-REFACTOR-009 START: Import Standardized Fallback Strings ---
import {
    DEFAULT_FALLBACK_CHARACTER_NAME,
    DEFAULT_FALLBACK_DESCRIPTION_RAW,
    DEFAULT_FALLBACK_LOCATION_NAME,
    // DEFAULT_FALLBACK_EVENT_DESCRIPTION_RAW, // Used to construct expected strings
    // DEFAULT_FALLBACK_ACTION_ID, // Used in expected strings
    // DEFAULT_FALLBACK_ACTION_COMMAND, // Used in expected strings
    // DEFAULT_FALLBACK_ACTION_NAME, // Used in expected strings
    // DEFAULT_FALLBACK_ACTION_DESCRIPTION_RAW, // Used to construct expected strings
    PROMPT_FALLBACK_UNKNOWN_LOCATION,
    PROMPT_FALLBACK_NO_EXITS,
    PROMPT_FALLBACK_ALONE_IN_LOCATION,
    PROMPT_FALLBACK_NO_RECENT_EVENTS,
    PROMPT_FALLBACK_NO_ACTIONS_DEFAULT,
    // PROMPT_FALLBACK_NO_ACTIONS_CAN_WAIT, // Not directly used in current assertions but available
    PROMPT_FALLBACK_UNKNOWN_CHARACTER_DETAILS,
    PROMPT_FALLBACK_ACTOR_PROMPT_DATA_UNAVAILABLE,
    PROMPT_FALLBACK_MINIMAL_CHARACTER_DETAILS,
    ERROR_FALLBACK_CRITICAL_GAME_STATE_MISSING,
    ERROR_FALLBACK_ACTOR_STATE_MISSING, DEFAULT_FALLBACK_ACTION_DESCRIPTION_RAW
} from '../../../src/constants/textDefaults.js';
// For constructing expected strings that involve punctuation:
const PUNCTUATED_FALLBACK_DESCRIPTION = DEFAULT_FALLBACK_DESCRIPTION_RAW + '.';
const PUNCTUATED_FALLBACK_EVENT_DESCRIPTION = DEFAULT_FALLBACK_DESCRIPTION_RAW + '.'; // Assuming events also use general description fallback if not specific
// const PUNCTUATED_FALLBACK_EVENT_DESCRIPTION = DEFAULT_FALLBACK_EVENT_DESCRIPTION_RAW + '.'; // If a distinct event desc raw constant was used
const PUNCTUATED_FALLBACK_ACTION_DESCRIPTION = DEFAULT_FALLBACK_ACTION_DESCRIPTION_RAW + '.';

// --- TICKET AIPF-REFACTOR-009 END ---

/**
 * @returns {jest.Mocked<import('../../../src/interfaces/coreServices.js').ILogger>}
 */
const mockLogger = () => ({
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
    debug: jest.fn(),
});

const NEW_INTRO_PARAGRAPH = "You are an AI character in a detailed, interactive text-based adventure game. " +
    "Your primary task is to decide on one action to perform this turn and determine what, if anything, your character will say. " +
    "Base your decision on your character's persona, the current situation, recent events, and the specific actions available to you. " +
    "Act in a way that is believable and consistent with your character's motivations and understanding of the game world.";

const LLM_SCHEMA_STRING = JSON.stringify(LLM_TURN_ACTION_SCHEMA, null, 2);

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
    "Suppose available action is: Name: \"Take Item\", System ID: \"app:take_item\", Base Command: \"take <item>\".\n" +
    "{\n" +
    "  \"actionDefinitionId\": \"app:take_item\",\n" +
    "  \"commandString\": \"take old map\",\n" +
    "  \"speech\": \"\"\n" +
    "}",

    "EXAMPLE 3: Waiting and not speaking.\n" +
    "Suppose available action is: Name: \"Wait\", System ID: \"core:wait\", Base Command: \"wait\".\n" +
    "{\n" +
    "  \"actionDefinitionId\": \"core:wait\",\n" +
    "  \"commandString\": \"wait\",\n" +
    "  \"speech\": \"\"\n" +
    "}",
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

    describe('_formatOptionalAttribute', () => {
        test('should return "Label: Value" for valid label and value', () => {
            expect(formatter._formatOptionalAttribute("Personality", "Brave")).toBe("Personality: Brave");
        });
        test('should trim whitespace and return "Label: Value" for value with spaces', () => {
            expect(formatter._formatOptionalAttribute("Likes", "  Apples and Oranges  ")).toBe("Likes: Apples and Oranges");
        });
        test('should return "Label: Value" for an already trimmed value', () => {
            expect(formatter._formatOptionalAttribute("Likes", "Apples and Oranges")).toBe("Likes: Apples and Oranges");
        });
        test('should return null if value is an empty string', () => {
            expect(formatter._formatOptionalAttribute("Secrets", "")).toBeNull();
        });
        test('should return null if value is a string with only spaces', () => {
            expect(formatter._formatOptionalAttribute("Secrets", "   ")).toBeNull();
        });
        test('should return null if value is undefined', () => {
            expect(formatter._formatOptionalAttribute("Profile", undefined)).toBeNull();
        });
        test('should return null if value is null', () => {
            expect(formatter._formatOptionalAttribute("Dislikes", null)).toBeNull();
        });
        test('should handle various labels correctly', () => {
            expect(formatter._formatOptionalAttribute("Special Trait", "Very Special")).toBe("Special Trait: Very Special");
        });
    });


    describe('formatPrompt', () => {
        describe('Valid and Complete DTO', () => {
            test('should format a complete AIGameStateDTO correctly with all optional attributes', () => {
                const actorState = {
                    id: 'actor-123',
                    [NAME_COMPONENT_ID]: {text: 'Test Actor'},
                    [DESCRIPTION_COMPONENT_ID]: {text: 'A brave adventurer'},
                    [PERSONALITY_COMPONENT_ID]: {text: '  Courageous and inquisitive  '},
                    [PROFILE_COMPONENT_ID]: {text: 'A seasoned warrior with many tales.'},
                    [LIKES_COMPONENT_ID]: {text: 'Shiny objects, good mead'},
                    [DISLIKES_COMPONENT_ID]: {text: 'Spiders, dark magic'},
                    [SECRETS_COMPONENT_ID]: {text: 'Is afraid of heights'},
                    [SPEECH_PATTERNS_COMPONENT_ID]: {patterns: ["Huzzah!", "By my sword!"]}
                };
                const actorPromptData = { // ActorDataExtractor provides this (already trimmed and punctuated for description)
                    name: 'Test Actor',
                    description: 'A brave adventurer.', // Assume ActorDataExtractor added the period
                    personality: 'Courageous and inquisitive',
                    profile: 'A seasoned warrior with many tales.',
                    likes: 'Shiny objects, good mead',
                    dislikes: 'Spiders, dark magic',
                    secrets: 'Is afraid of heights',
                    speechPatterns: ["Huzzah!", "By my sword!"]
                };
                const gameState = {
                    actorState: actorState,
                    actorPromptData: actorPromptData,
                    currentLocation: {
                        name: 'The Grand Hall',
                        description: 'A vast hall with high ceilings.', // AIPromptFormatter will punctuate this
                        exits: [
                            {direction: 'north', targetLocationId: 'loc2', targetLocationName: 'North Passage'},
                            {direction: 'east', targetLocationId: 'loc3', targetLocationName: 'East Chamber'},
                        ],
                        characters: [
                            {id: 'char-guard-1', name: 'Guard', description: 'A stern-looking guard.'}, // AIPromptFormatter will punctuate
                        ],
                    },
                    perceptionLog: [
                        {timestamp: Date.now(), type: 'sound', description: 'You hear a distant roar.'}, // AIPromptFormatter will punctuate
                        {timestamp: Date.now(), type: 'sight', description: 'A rat scurries past.'}, // AIPromptFormatter will punctuate
                    ],
                    availableActions: [
                        {id: 'core:move', command: 'go north', name: 'Move North', description: 'Move to the north.'}, // AIPromptFormatter will punctuate
                        {id: 'core:speak', command: 'say Hello', name: 'Speak', description: 'Talk to someone.'}, // AIPromptFormatter will punctuate
                    ],
                };

                const characterSegment = [
                    "You are Test Actor.",
                    "Description: A brave adventurer.", // Description from actorPromptData is already punctuated
                    "Personality: Courageous and inquisitive",
                    "Profile: A seasoned warrior with many tales.",
                    "Likes: Shiny objects, good mead",
                    "Dislikes: Spiders, dark magic",
                    "Secrets: Is afraid of heights",
                    "Speech Patterns:\n- Huzzah!\n- By my sword!"
                ].join('\n');

                // AIPromptFormatter._formatLocationSegment will punctuate descriptions
                const locationSegment = "You are currently in the location: The Grand Hall. Location description: A vast hall with high ceilings.\n" +
                    "Exits from your current location:\n" +
                    "- Towards north leads to North Passage.\n" +
                    "- Towards east leads to East Chamber.\n" +
                    "Other characters present in this location:\n" +
                    "- Guard - Description: A stern-looking guard.";
                // AIPromptFormatter._formatEventsSegment will punctuate descriptions
                const eventsSegment = "Recent events relevant to you (oldest first):\n" +
                    "- You hear a distant roar.\n" +
                    "- A rat scurries past.";
                // AIPromptFormatter._formatActionsSegment will punctuate descriptions
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
            });

            test('should format correctly when optional attributes are missing from actorPromptData', () => {
                const actorState = {
                    id: 'actor-minimal',
                    [NAME_COMPONENT_ID]: {text: 'Minimalist Mike'},
                    [DESCRIPTION_COMPONENT_ID]: {text: 'Less is more'},
                };
                const actorPromptData = { // Processed by ActorDataExtractor
                    name: 'Minimalist Mike',
                    description: 'Less is more.', // Punctuated by ActorDataExtractor
                };
                const gameState = {
                    actorState: actorState,
                    actorPromptData: actorPromptData,
                    currentLocation: {name: 'Empty Room', description: 'Just four walls', exits: [], characters: []}, // AIPromptFormatter punctuates desc
                    perceptionLog: [],
                    availableActions: [],
                };

                const characterSegment = [
                    "You are Minimalist Mike.",
                    "Description: Less is more."
                ].join('\n');

                // --- TICKET AIPF-REFACTOR-009: Use constants for empty/fallback messages ---
                const locationSegment = "You are currently in the location: Empty Room. Location description: Just four walls.\n" + // Punctuated by formatter
                    `Exits from your current location:\n${PROMPT_FALLBACK_NO_EXITS}\n` +
                    `Other characters present in this location:\n${PROMPT_FALLBACK_ALONE_IN_LOCATION}`;
                const eventsSegment = `Recent events relevant to you (oldest first):\n${PROMPT_FALLBACK_NO_RECENT_EVENTS}`;
                const actionsSegment = "Your available actions are (for your JSON response, use 'System ID' for 'actionDefinitionId' and construct a complete 'commandString' based on the 'Base Command'):\n" +
                    PROMPT_FALLBACK_NO_ACTIONS_DEFAULT;
                // --- TICKET AIPF-REFACTOR-009 END ---

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

        describe('Null/Undefined AIGameStateDTO', () => {
            test('should return error prompt and log error if gameState is null', () => {
                // --- TICKET AIPF-REFACTOR-009: Use constant ---
                const result = formatter.formatPrompt(null, logger);
                expect(result).toBe(ERROR_FALLBACK_CRITICAL_GAME_STATE_MISSING);
                // --- TICKET AIPF-REFACTOR-009 END ---
                expect(logger.error).toHaveBeenCalledWith("AIPromptFormatter: AIGameStateDTO is null or undefined. Cannot format prompt.");
            });

            test('should return error prompt and log error if gameState is undefined', () => {
                // --- TICKET AIPF-REFACTOR-009: Use constant ---
                const result = formatter.formatPrompt(undefined, logger);
                expect(result).toBe(ERROR_FALLBACK_CRITICAL_GAME_STATE_MISSING);
                // --- TICKET AIPF-REFACTOR-009 END ---
                expect(logger.error).toHaveBeenCalledWith("AIPromptFormatter: AIGameStateDTO is null or undefined. Cannot format prompt.");
            });

            test('should return error prompt and log error if actorState is missing', () => {
                const gameState = {actorState: null};
                // --- TICKET AIPF-REFACTOR-009: Use constant ---
                const result = formatter.formatPrompt(gameState, logger);
                expect(result).toBe(ERROR_FALLBACK_ACTOR_STATE_MISSING);
                // --- TICKET AIPF-REFACTOR-009 END ---
                expect(logger.error).toHaveBeenCalledWith("AIPromptFormatter: AIGameStateDTO is missing 'actorState'. Cannot format prompt meaningfully.", {gameState});
            });
        });

        describe('DTO with Partially Missing Data', () => {
            test('Actor State Missing Details: should use default names/descriptions from constants', () => {
                const actorState = { // Raw data that would lead to defaults
                    id: 'actor-empty',
                    [NAME_COMPONENT_ID]: {text: ' '}, // Empty, so ActorDataExtractor uses default
                    [DESCRIPTION_COMPONENT_ID]: {text: null}, // Null, so ActorDataExtractor uses default
                };
                // This is what ActorDataExtractor would produce using the constants
                const actorPromptData = {
                    name: DEFAULT_FALLBACK_CHARACTER_NAME,
                    description: PUNCTUATED_FALLBACK_DESCRIPTION, // Already punctuated by extractor
                };
                const gameState = {
                    actorState: actorState,
                    actorPromptData: actorPromptData,
                    currentLocation: {
                        // --- TICKET AIPF-REFACTOR-009: Use fallback constants for location name/desc (raw for desc) ---
                        name: null, // Will use DEFAULT_FALLBACK_LOCATION_NAME
                        description: '', // Will use DEFAULT_FALLBACK_DESCRIPTION_RAW, then punctuated
                        // --- TICKET AIPF-REFACTOR-009 END ---
                        exits: [],
                        characters: [],
                    },
                    perceptionLog: [],
                    availableActions: [],
                };

                // --- TICKET AIPF-REFACTOR-009: Construct expected segments using constants ---
                const characterSegment = `You are ${DEFAULT_FALLBACK_CHARACTER_NAME}.\nDescription: ${PUNCTUATED_FALLBACK_DESCRIPTION}`;
                const locationSegment = `You are currently in the location: ${DEFAULT_FALLBACK_LOCATION_NAME}. Location description: ${PUNCTUATED_FALLBACK_DESCRIPTION}\n` +
                    `Exits from your current location:\n${PROMPT_FALLBACK_NO_EXITS}\n` +
                    `Other characters present in this location:\n${PROMPT_FALLBACK_ALONE_IN_LOCATION}`;
                const eventsSegment = `Recent events relevant to you (oldest first):\n${PROMPT_FALLBACK_NO_RECENT_EVENTS}`;
                const actionsSegment = `Your available actions are (for your JSON response, use 'System ID' for 'actionDefinitionId' and construct a complete 'commandString' based on the 'Base Command'):\n${PROMPT_FALLBACK_NO_ACTIONS_DEFAULT}`;
                // --- TICKET AIPF-REFACTOR-009 END ---

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
                const actorState = {
                    id: 'actor-lost',
                    [NAME_COMPONENT_ID]: {text: 'Lost Actor'},
                    [DESCRIPTION_COMPONENT_ID]: {text: 'Confused'}
                };
                const actorPromptData = {name: 'Lost Actor', description: 'Confused.'}; // ActorDataExtractor punctuates
                const gameState = {
                    actorState: actorState,
                    actorPromptData: actorPromptData,
                    currentLocation: null,
                    perceptionLog: [],
                    availableActions: [],
                };

                const characterSegment = "You are Lost Actor.\nDescription: Confused.";
                // --- TICKET AIPF-REFACTOR-009: Use constant ---
                const locationSegment = PROMPT_FALLBACK_UNKNOWN_LOCATION;
                const eventsSegment = `Recent events relevant to you (oldest first):\n${PROMPT_FALLBACK_NO_RECENT_EVENTS}`;
                const actionsSegment = `Your available actions are (for your JSON response, use 'System ID' for 'actionDefinitionId' and construct a complete 'commandString' based on the 'Base Command'):\n${PROMPT_FALLBACK_NO_ACTIONS_DEFAULT}`;
                // --- TICKET AIPF-REFACTOR-009 END ---

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
                const actorState = {
                    id: 'actor-alone',
                    [NAME_COMPONENT_ID]: {text: 'Solo Explorer'},
                    [DESCRIPTION_COMPONENT_ID]: {text: 'Likes quiet places'}
                };
                const actorPromptData = {name: 'Solo Explorer', description: 'Likes quiet places.'};
                const gameState = {
                    actorState: actorState,
                    actorPromptData: actorPromptData,
                    currentLocation: {
                        name: 'Quiet Room',
                        description: 'A very quiet room', // Formatter punctuates
                        exits: [],
                        characters: [],
                    },
                    perceptionLog: [{timestamp: Date.now(), type: 'thought', description: 'It is quiet here'}], // Formatter punctuates
                    availableActions: [{id: 'core:wait', command: 'wait', name: 'Wait', description: 'Do nothing'}], // Formatter punctuates
                };

                const characterSegment = "You are Solo Explorer.\nDescription: Likes quiet places.";
                // --- TICKET AIPF-REFACTOR-009: Use constants ---
                const locationSegment = "You are currently in the location: Quiet Room. Location description: A very quiet room.\n" +
                    `Exits from your current location:\n${PROMPT_FALLBACK_NO_EXITS}\n` +
                    `Other characters present in this location:\n${PROMPT_FALLBACK_ALONE_IN_LOCATION}`;
                const eventsSegment = "Recent events relevant to you (oldest first):\n- It is quiet here."; // Punctuated by formatter
                // --- TICKET AIPF-REFACTOR-009 END ---
                const actionsSegment = "Your available actions are (for your JSON response, use 'System ID' for 'actionDefinitionId' and construct a complete 'commandString' based on the 'Base Command'):\n" +
                    '- Name: "Wait", System ID: "core:wait", Base Command: "wait". Description: Do nothing.'; // Punctuated by formatter

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
                const actorState = {
                    id: 'actor-oblivious',
                    [NAME_COMPONENT_ID]: {text: 'Oblivious One'},
                    [DESCRIPTION_COMPONENT_ID]: {text: 'Not very observant'}
                };
                const actorPromptData = {name: 'Oblivious One', description: 'Not very observant.'};
                const gameState = {
                    actorState: actorState,
                    actorPromptData: actorPromptData,
                    currentLocation: {
                        name: 'A Room',
                        description: 'Just a room', // Formatter punctuates
                        exits: [{direction: 'out', targetLocationId: 'somewhere', targetLocationName: 'The Void'}],
                        characters: [{id: 'char-nobody', name: 'Nobody', description: 'Barely visible'}], // Formatter punctuates
                    },
                    perceptionLog: [], // Empty
                    availableActions: [{
                        id: 'core:ponder',
                        command: 'ponder',
                        name: 'Ponder',
                        description: 'Think deeply'
                    }], // Formatter punctuates
                };

                const characterSegment = "You are Oblivious One.\nDescription: Not very observant.";
                const locationSegment = "You are currently in the location: A Room. Location description: Just a room.\n" +
                    "Exits from your current location:\n- Towards out leads to The Void.\n" +
                    "Other characters present in this location:\n- Nobody - Description: Barely visible.";
                // --- TICKET AIPF-REFACTOR-009: Use constant ---
                const eventsSegment = `Recent events relevant to you (oldest first):\n${PROMPT_FALLBACK_NO_RECENT_EVENTS}`;
                // --- TICKET AIPF-REFACTOR-009 END ---
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
                const actorState = {
                    id: 'actor-stuck',
                    [NAME_COMPONENT_ID]: {text: 'Stuck Sam'},
                    [DESCRIPTION_COMPONENT_ID]: {text: 'Can do nothing'}
                };
                const actorPromptData = {name: 'Stuck Sam', description: 'Can do nothing.'};
                const gameState = {
                    actorState: actorState,
                    actorPromptData: actorPromptData,
                    currentLocation: {
                        name: 'Featureless Plain',
                        description: 'Endless, featureless plain', // Formatter punctuates
                        exits: [],
                        characters: [],
                    },
                    perceptionLog: [{timestamp: Date.now(), type: 'feeling', description: 'A sense of ennui'}], // Formatter punctuates
                    availableActions: [], // Empty
                };

                const characterSegment = "You are Stuck Sam.\nDescription: Can do nothing.";
                const locationSegment = "You are currently in the location: Featureless Plain. Location description: Endless, featureless plain.\n" +
                    `Exits from your current location:\n${PROMPT_FALLBACK_NO_EXITS}\n` +
                    `Other characters present in this location:\n${PROMPT_FALLBACK_ALONE_IN_LOCATION}`;
                const eventsSegment = "Recent events relevant to you (oldest first):\n- A sense of ennui.";
                // --- TICKET AIPF-REFACTOR-009: Use constant ---
                const actionsSegment = `Your available actions are (for your JSON response, use 'System ID' for 'actionDefinitionId' and construct a complete 'commandString' based on the 'Base Command'):\n${PROMPT_FALLBACK_NO_ACTIONS_DEFAULT}`;
                // --- TICKET AIPF-REFACTOR-009 END ---

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

            // --- TICKET AIPF-REFACTOR-009: Add a test for _formatCharacterSegment directly for actorPromptData missing cases ---
            describe('_formatCharacterSegment specific fallbacks', () => {
                test('should return PROMPT_FALLBACK_ACTOR_PROMPT_DATA_UNAVAILABLE if actorPromptData is null but actorState exists', () => {
                    const gameState = {
                        actorState: {id: 'some-actor'}, // actorState exists
                        actorPromptData: null, // actorPromptData is null
                    };
                    const result = formatter._formatCharacterSegment(gameState, logger);
                    expect(result).toBe(PROMPT_FALLBACK_ACTOR_PROMPT_DATA_UNAVAILABLE);
                    expect(logger.warn).toHaveBeenCalledWith("AIPromptFormatter: Character details (actorPromptData) are missing or undefined in gameState.");
                });

                test('should return PROMPT_FALLBACK_UNKNOWN_CHARACTER_DETAILS if both actorPromptData and actorState are null/missing', () => {
                    const gameState = {
                        actorState: null, // actorState is null
                        actorPromptData: null, // actorPromptData is null
                    };
                    const result = formatter._formatCharacterSegment(gameState, logger);
                    expect(result).toBe(PROMPT_FALLBACK_UNKNOWN_CHARACTER_DETAILS);
                    expect(logger.warn).toHaveBeenCalledWith("AIPromptFormatter: Character details (actorPromptData) are missing or undefined in gameState.");
                    expect(logger.warn).toHaveBeenCalledWith("AIPromptFormatter: Raw character details (actorState) are also unknown.");
                });


                test('should return PROMPT_FALLBACK_MINIMAL_CHARACTER_DETAILS for default name and only one line of info', () => {
                    const gameState = {
                        actorPromptData: {
                            name: DEFAULT_FALLBACK_CHARACTER_NAME,
                            description: PUNCTUATED_FALLBACK_DESCRIPTION, // Only name and description
                            // no other attributes
                        }
                    };
                    // _formatCharacterSegment adds "You are <name>." and "Description: <desc>."
                    // If name is default and characterInfo.length <=1, it returns fallback.
                    // Here, characterInfo would contain two lines (name, desc). The original logic was:
                    // if (characterInfo.length <= 1 && actorPromptData.name === DEFAULT_FALLBACK_CHARACTER_NAME)
                    // This condition might need adjustment or the test setup carefully considered.
                    // If actorPromptData only has 'name', then length is 1.
                    // If it has 'name' and 'description', length is 2.
                    // Let's test the exact condition: actorPromptData.name is default, and minimal info results.
                    // The current logic in _formatCharacterSegment is:
                    // characterInfo.push(`You are ${actorPromptData.name}.`);
                    // characterInfo.push(`Description: ${actorPromptData.description}`);
                    // ...
                    // if (characterInfo.length <= 1 && actorPromptData.name === DEFAULT_FALLBACK_CHARACTER_NAME) {
                    //    return PROMPT_FALLBACK_MINIMAL_CHARACTER_DETAILS;
                    // }
                    // So, if only name was present (e.g. description was undefined in DTO, though unlikely from extractor):
                    const minimalGameState = {
                        actorPromptData: {
                            name: DEFAULT_FALLBACK_CHARACTER_NAME,
                            // description is undefined or not pushed to characterInfo
                        }
                    };
                    // Manually trace _formatCharacterSegment:
                    // characterInfo = [`You are ${DEFAULT_FALLBACK_CHARACTER_NAME}.`] -> length 1
                    // Description line is conditional on actorPromptData.description existing
                    // Let's assume description IS missing from DTO for this test of the boundary condition
                    const actorPromptDataMinimal = {name: DEFAULT_FALLBACK_CHARACTER_NAME};
                    const result = formatter._formatCharacterSegment({actorPromptData: actorPromptDataMinimal}, logger);
                    // Expected: Pushes `You are Unnamed Character.`
                    // Description won't be pushed.
                    // Optional attributes are none.
                    // Speech patterns none.
                    // So characterInfo is just [`You are Unnamed Character.`]. Length is 1.
                    // actorPromptData.name === DEFAULT_FALLBACK_CHARACTER_NAME is true.
                    // So it should return PROMPT_FALLBACK_MINIMAL_CHARACTER_DETAILS
                    expect(result).toBe(PROMPT_FALLBACK_MINIMAL_CHARACTER_DETAILS);
                });
            });
            // --- TICKET AIPF-REFACTOR-009 END ---
        });
    });
});

// --- FILE END ---