// src/tests/core/interpreters/commandOutcomeInterpreter.test.js
// --- FILE START ---

import CommandOutcomeInterpreter from '../../../core/commands/interpreters/commandOutcomeInterpreter.js';
import TurnDirective from '../../../core/turns/constants/turnDirectives.js';
import {beforeEach, describe, expect, it, jest} from "@jest/globals";

// Mocks
const mockLogger = {
    debug: jest.fn(),
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
};

const mockDispatcher = {
    dispatchSafely: jest.fn(),
};

// New mock for TurnContext
let mockTurnContext;
let mockActor; // To store the mock actor object

describe('CommandOutcomeInterpreter', () => {
    let interpreter;
    const defaultActorIdForTests = 'defaultTestActorId'; // A default actorId for general use

    beforeEach(() => {
        jest.clearAllMocks();
        mockDispatcher.dispatchSafely.mockImplementation(() => Promise.resolve(true));

        // Initialize mockActor and mockTurnContext for each test
        // This ensures a clean state and allows actorId to be set per test/describe block
        mockActor = {id: defaultActorIdForTests}; // Default mock actor
        mockTurnContext = {
            getActor: jest.fn(() => mockActor) // Default mock getActor
        };

        interpreter = new CommandOutcomeInterpreter({
            dispatcher: mockDispatcher,
            logger: mockLogger,
        });
    });

    describe('interpret - input validation', () => {
        it('should throw if turnContext is invalid or actor cannot be retrieved from turnContext', async () => {
            // Test for null turnContext
            await expect(interpreter.interpret({}, null))
                .rejects.toThrow('CommandOutcomeInterpreter: Invalid turnContext provided.');

            // Test for turnContext without getActor method
            await expect(interpreter.interpret({}, {}))
                .rejects.toThrow('CommandOutcomeInterpreter: Invalid turnContext provided.');

            // Test for turnContext.getActor() returning null
            mockTurnContext.getActor.mockReturnValue(null);
            await expect(interpreter.interpret({}, mockTurnContext))
                .rejects.toThrow('CommandOutcomeInterpreter: Could not retrieve a valid actor or actor ID from turnContext.');

            // Test for turnContext.getActor() returning an actor without an id
            mockTurnContext.getActor.mockReturnValue({}); // Actor object without 'id'
            await expect(interpreter.interpret({}, mockTurnContext))
                .rejects.toThrow('CommandOutcomeInterpreter: Could not retrieve a valid actor or actor ID from turnContext.');

            // Test for turnContext.getActor() returning an actor with a null id
            mockTurnContext.getActor.mockReturnValue({id: null});
            await expect(interpreter.interpret({}, mockTurnContext))
                .rejects.toThrow('CommandOutcomeInterpreter: Could not retrieve a valid actor or actor ID from turnContext.');

            // Test for turnContext.getActor() returning an actor with an empty string id
            mockTurnContext.getActor.mockReturnValue({id: ''});
            await expect(interpreter.interpret({}, mockTurnContext))
                .rejects.toThrow('CommandOutcomeInterpreter: Could not retrieve a valid actor or actor ID from turnContext.');
        });
    });

    describe('interpret - success path (core:action_executed)', () => {
        const successActorId = 'player:1_success';
        beforeEach(() => { // Set actorId for this describe block
            mockActor.id = successActorId;
            // mockTurnContext.getActor will return mockActor with this ID
        });

        it('should use actionResult.messages if provided, ignoring top-level message', async () => {
            const commandResult = {
                success: true,
                turnEnded: false,
                message: 'This should be ignored.',
                actionResult: {
                    actionId: 'spell:chain_lightning',
                    messages: [
                        {text: 'Lightning arcs to target 1.', type: 'combat'},
                        {text: 'Lightning jumps to target 2.', type: 'combat'}
                    ]
                },
            };
            await interpreter.interpret(commandResult, mockTurnContext);
            expect(mockDispatcher.dispatchSafely).toHaveBeenCalledWith(
                'core:action_executed',
                expect.objectContaining({
                    actorId: successActorId,
                    actionId: 'spell:chain_lightning',
                    result: {
                        success: true,
                        messages: [
                            {text: 'Lightning arcs to target 1.', type: 'combat'},
                            {text: 'Lightning jumps to target 2.', type: 'combat'}
                        ]
                    }
                })
            );
        });

        it('should result in empty messages array if result.message and actionResult.messages are missing', async () => {
            const commandResult = {
                success: true,
                turnEnded: false,
                actionResult: {actionId: 'test:action'}, // No top-level message, no actionResult.messages
            };
            await interpreter.interpret(commandResult, mockTurnContext);
            expect(mockDispatcher.dispatchSafely).toHaveBeenCalledWith(
                'core:action_executed',
                expect.objectContaining({
                    actorId: successActorId,
                    actionId: 'test:action',
                    result: expect.objectContaining({
                        success: true,
                        messages: [],
                    }),
                })
            );
        });
    });

 
});
// --- FILE END ---