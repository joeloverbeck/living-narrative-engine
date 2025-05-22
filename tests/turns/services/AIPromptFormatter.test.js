// tests/turns/services/AIPromptFormatter.test.js
// --- FILE START ---

import {jest, describe, beforeEach, test, expect} from '@jest/globals';
import {AIPromptFormatter} from '../../../src/turns/services/AIPromptFormatter.js';
// No DTO import needed as we will use plain objects based on JSDoc typedefs

/**
 * @returns {jest.Mocked<import('../../../src/interfaces/coreServices.js').ILogger>}
 */
const mockLogger = () => ({
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
    debug: jest.fn(),
});

describe('AIPromptFormatter', () => {
    /** @type {AIPromptFormatter} */
    let formatter;
    /** @type {ReturnType<typeof mockLogger>} */
    let logger;

    const CONCLUDING_INSTRUCTION = "Apart from picking one among the available actions, you have the opportunity to speak. " +
        "It's not obligatory. Use your reasoning to determine if you should talk in this context.";

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
                const gameState = { // AIGameStateDTO structure
                    actorState: { // AIActorStateDTO structure
                        id: 'actor-123',
                        name: 'Test Actor',
                        description: 'A brave adventurer',
                    },
                    currentLocation: { // AILocationSummaryDTO structure
                        name: 'The Grand Hall',
                        description: 'A vast hall with high ceilings',
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

                const expectedPrompt = [
                    "You're Test Actor. Description: A brave adventurer.",
                    "You're in the location The Grand Hall. Description: A vast hall with high ceilings.\n" +
                    "Exits:\n" +
                    "- north to loc2\n" +
                    "- east to loc3\n" +
                    "Characters here:\n" +
                    "- Guard (A stern-looking guard.)",
                    "Recent events:\n" +
                    "- You hear a distant roar.\n" +
                    "- A rat scurries past.",
                    "Your available actions are:\n" +
                    "- go north (Move to the north.)\n" +
                    "- say Hello (Talk to someone.)",
                    CONCLUDING_INSTRUCTION
                ].join('\n\n');

                const result = formatter.formatPrompt(gameState, logger);
                expect(result).toBe(expectedPrompt);
                expect(logger.info).toHaveBeenCalledWith("AIPromptFormatter: Starting LLM prompt generation.");
                expect(logger.info).toHaveBeenCalledWith("AIPromptFormatter: LLM prompt generation complete.");

                expect(logger.debug).toHaveBeenCalledWith("AIPromptFormatter: Formatting character segment.");
                expect(logger.debug).toHaveBeenCalledWith("AIPromptFormatter: Formatting location segment.");
                expect(logger.debug).toHaveBeenCalledWith('AIPromptFormatter: Formatted 2 items for section "Exits".');
                expect(logger.debug).toHaveBeenCalledWith('AIPromptFormatter: Formatted 1 items for section "Characters here".');
                expect(logger.debug).toHaveBeenCalledWith("AIPromptFormatter: Formatting events segment.");
                expect(logger.debug).toHaveBeenCalledWith('AIPromptFormatter: Formatted 2 items for section "Recent events".');
                expect(logger.debug).toHaveBeenCalledWith("AIPromptFormatter: Formatting actions segment.");
                expect(logger.debug).toHaveBeenCalledWith('AIPromptFormatter: Formatted 2 items for section "Your available actions are".');
                expect(logger.debug).toHaveBeenCalledWith(expect.stringContaining("AIPromptFormatter: Generated Prompt"));
                expect(logger.debug).toHaveBeenCalledTimes(9);

                expect(logger.error).not.toHaveBeenCalled();
            });
        });

        describe('Null/Undefined AIGameStateDTO', () => {
            test('should return error prompt and log error if gameState is null', () => {
                const expectedErrorPrompt = "Error: Critical game state information is missing to make a decision.";
                const result = formatter.formatPrompt(null, logger);
                expect(result).toBe(expectedErrorPrompt);
                expect(logger.error).toHaveBeenCalledWith("AIPromptFormatter: AIGameStateDTO is null or undefined. Cannot format prompt.");
                expect(logger.info).toHaveBeenCalledWith("AIPromptFormatter: Starting LLM prompt generation.");
                expect(logger.info).not.toHaveBeenCalledWith("AIPromptFormatter: LLM prompt generation complete.");
            });

            test('should return error prompt and log error if gameState is undefined', () => {
                const expectedErrorPrompt = "Error: Critical game state information is missing to make a decision.";
                const result = formatter.formatPrompt(undefined, logger);
                expect(result).toBe(expectedErrorPrompt);
                expect(logger.error).toHaveBeenCalledWith("AIPromptFormatter: AIGameStateDTO is null or undefined. Cannot format prompt.");
                expect(logger.info).toHaveBeenCalledWith("AIPromptFormatter: Starting LLM prompt generation.");
                expect(logger.info).not.toHaveBeenCalledWith("AIPromptFormatter: LLM prompt generation complete.");
            });
        });

        describe('DTO with Partially Missing Data', () => {
            test('Actor State Missing Details: should use default names/descriptions', () => {
                const gameState = {
                    actorState: {
                        id: 'actor-empty',
                        name: null,
                        description: undefined,
                    },
                    currentLocation: {
                        name: 'Default Room',
                        description: 'Plain',
                        exits: [],
                        characters: [],
                    },
                    perceptionLog: [],
                    availableActions: [],
                };

                const expectedPrompt = [
                    "You're Unnamed Character. Description: No description available.",
                    "You're in the location Default Room. Description: Plain.\n" +
                    "Exits:\n" +
                    "There are no obvious exits.\n" +
                    "Characters here:\n" +
                    "You are alone here.",
                    "Recent events:\n" +
                    "None.",
                    "Your available actions are:\n" +
                    "You have no specific actions available right now.",
                    CONCLUDING_INSTRUCTION
                ].join('\n\n');

                const result = formatter.formatPrompt(gameState, logger);
                expect(result).toBe(expectedPrompt);
                expect(logger.debug).toHaveBeenCalledWith("AIPromptFormatter: Formatting character segment.");
                expect(logger.debug).toHaveBeenCalledWith('AIPromptFormatter: Section "Exits" is empty, using empty message.');
                expect(logger.debug).toHaveBeenCalledWith('AIPromptFormatter: Section "Characters here" is empty, using empty message.');
                expect(logger.debug).toHaveBeenCalledWith('AIPromptFormatter: Section "Recent events" is empty, using empty message.');
                expect(logger.debug).toHaveBeenCalledWith('AIPromptFormatter: Section "Your available actions are" is empty, using empty message.');
            });

            test('currentLocation is null: should state location is unknown', () => {
                const gameState = {
                    actorState: {
                        id: 'actor-lost',
                        name: 'Lost Actor',
                        description: 'Confused',
                    },
                    currentLocation: null,
                    perceptionLog: [],
                    availableActions: [],
                };

                const expectedPrompt = [
                    "You're Lost Actor. Description: Confused.",
                    "Your current location is unknown.",
                    "Recent events:\n" +
                    "None.",
                    "Your available actions are:\n" +
                    "You have no specific actions available right now.",
                    CONCLUDING_INSTRUCTION
                ].join('\n\n');

                const result = formatter.formatPrompt(gameState, logger);
                expect(result).toBe(expectedPrompt);
                expect(logger.info).toHaveBeenCalledWith("AIPromptFormatter: Current location is unknown.");
                expect(logger.debug).toHaveBeenCalledWith("AIPromptFormatter: Formatting location segment.");
            });

            test('Empty lists in currentLocation: should use emptyMessages for exits and characters', () => {
                const gameState = {
                    actorState: {id: 'actor-alone', name: 'Solo Explorer', description: 'Likes quiet places'},
                    currentLocation: {
                        name: 'Quiet Room',
                        description: 'A very quiet room',
                        exits: [], // Empty exits
                        characters: [], // Empty characters
                    },
                    perceptionLog: [{timestamp: Date.now(), type: 'thought', description: 'It is quiet here.'}],
                    availableActions: [{id: 'core:wait', command: 'wait', name: 'Wait', description: 'Do nothing.'}],
                };

                const expectedPrompt = [
                    "You're Solo Explorer. Description: Likes quiet places.",
                    "You're in the location Quiet Room. Description: A very quiet room.\n" +
                    "Exits:\n" +
                    "There are no obvious exits.\n" +
                    "Characters here:\n" +
                    "You are alone here.",
                    "Recent events:\n" +
                    "- It is quiet here.",
                    "Your available actions are:\n" +
                    "- wait (Do nothing.)",
                    CONCLUDING_INSTRUCTION
                ].join('\n\n');

                const result = formatter.formatPrompt(gameState, logger);
                expect(result).toBe(expectedPrompt);
                expect(logger.debug).toHaveBeenCalledWith('AIPromptFormatter: Section "Exits" is empty, using empty message.');
                expect(logger.debug).toHaveBeenCalledWith('AIPromptFormatter: Section "Characters here" is empty, using empty message.');
            });

            test('Empty perceptionLog: should state "Recent events: None."', () => {
                const gameState = {
                    actorState: {id: 'actor-oblivious', name: 'Oblivious One', description: 'Not very observant'},
                    currentLocation: {
                        name: 'A Room',
                        description: 'Just a room',
                        exits: [{direction: 'out', targetLocationId: 'somewhere'}],
                        characters: [{id: 'char-nobody', name: 'Nobody', description: 'Barely visible.'}],
                    },
                    perceptionLog: [], // Empty perceptionLog
                    availableActions: [{
                        id: 'core:ponder',
                        command: 'ponder',
                        name: 'Ponder',
                        description: 'Think deeply.'
                    }],
                };

                const expectedPrompt = [
                    "You're Oblivious One. Description: Not very observant.",
                    "You're in the location A Room. Description: Just a room.\n" +
                    "Exits:\n" +
                    "- out to somewhere\n" +
                    "Characters here:\n" +
                    "- Nobody (Barely visible.)",
                    "Recent events:\n" +
                    "None.",
                    "Your available actions are:\n" +
                    "- ponder (Think deeply.)",
                    CONCLUDING_INSTRUCTION
                ].join('\n\n');
                const result = formatter.formatPrompt(gameState, logger);
                expect(result).toBe(expectedPrompt);
                expect(logger.debug).toHaveBeenCalledWith("AIPromptFormatter: Formatting events segment.");
                expect(logger.debug).toHaveBeenCalledWith('AIPromptFormatter: Section "Recent events" is empty, using empty message.');
            });

            test('Empty availableActions: should state "You have no specific actions available right now."', () => {
                const gameState = {
                    actorState: {id: 'actor-stuck', name: 'Stuck Sam', description: 'Can do nothing'},
                    currentLocation: {
                        name: 'Featureless Plain',
                        description: 'Endless, featureless plain',
                        exits: [],
                        characters: [],
                    },
                    perceptionLog: [{timestamp: Date.now(), type: 'feeling', description: 'A sense of ennui.'}],
                    availableActions: [], // Empty availableActions
                };

                const expectedPrompt = [
                    "You're Stuck Sam. Description: Can do nothing.",
                    "You're in the location Featureless Plain. Description: Endless, featureless plain.\n" +
                    "Exits:\n" +
                    "There are no obvious exits.\n" +
                    "Characters here:\n" +
                    "You are alone here.",
                    "Recent events:\n" +
                    "- A sense of ennui.",
                    "Your available actions are:\n" +
                    "You have no specific actions available right now.",
                    CONCLUDING_INSTRUCTION
                ].join('\n\n');
                const result = formatter.formatPrompt(gameState, logger);
                expect(result).toBe(expectedPrompt);
                expect(logger.debug).toHaveBeenCalledWith("AIPromptFormatter: Formatting actions segment.");
                expect(logger.debug).toHaveBeenCalledWith('AIPromptFormatter: Section "Your available actions are" is empty, using empty message.');
            });

        });
    });
});

// --- FILE END ---