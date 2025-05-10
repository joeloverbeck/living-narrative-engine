// src/tests/core/interpreters/commandOutcomeInterpreter.test.js
// --- FILE START ---

import CommandOutcomeInterpreter from '../../../core/interpreters/commandOutcomeInterpreter.js';
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

    describe('constructor', () => {
        it('should throw if logger is missing or invalid', () => {
            expect(() => new CommandOutcomeInterpreter({dispatcher: mockDispatcher, logger: null}))
                .toThrow('CommandOutcomeInterpreter: Invalid or missing ILogger dependency.');
            expect(() => new CommandOutcomeInterpreter({dispatcher: mockDispatcher, logger: {error: 'not a function'}}))
                .toThrow('CommandOutcomeInterpreter: Invalid or missing ILogger dependency.');
        });

        it('should throw if dispatcher is missing or invalid', () => {
            expect(() => new CommandOutcomeInterpreter({logger: mockLogger, dispatcher: null}))
                .toThrow('CommandOutcomeInterpreter: Invalid or missing ISafeEventDispatcher dependency.');
            expect(() => new CommandOutcomeInterpreter({
                logger: mockLogger,
                dispatcher: {dispatchSafely: 'not a function'}
            }))
                .toThrow('CommandOutcomeInterpreter: Invalid or missing ISafeEventDispatcher dependency.');
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

        it('should throw and dispatch system_error if commandResult is malformed', async () => {
            const validationActorId = 'validationActor';
            mockActor.id = validationActorId; // Set specific actor ID for this test
            // mockTurnContext.getActor is already set up to return mockActor

            await expect(interpreter.interpret(null, mockTurnContext))
                .rejects.toThrow(`CommandOutcomeInterpreter: Invalid CommandResult structure for actor ${validationActorId}. Missing 'success' or 'turnEnded'.`);
            expect(mockDispatcher.dispatchSafely).toHaveBeenCalledWith('core:system_error_occurred', expect.any(Object));

            jest.clearAllMocks();
            mockDispatcher.dispatchSafely.mockResolvedValue(true);
            // mockActor.id is still validationActorId
            // mockTurnContext.getActor will still return this mockActor

            await expect(interpreter.interpret({success: true /* missing turnEnded */}, mockTurnContext))
                .rejects.toThrow(`CommandOutcomeInterpreter: Invalid CommandResult structure for actor ${validationActorId}. Missing 'success' or 'turnEnded'.`);
            expect(mockDispatcher.dispatchSafely).toHaveBeenCalledWith('core:system_error_occurred', expect.any(Object));
        });
    });

    describe('interpret - success path (core:action_executed)', () => {
        const successActorId = 'player:1_success';
        beforeEach(() => { // Set actorId for this describe block
            mockActor.id = successActorId;
            // mockTurnContext.getActor will return mockActor with this ID
        });

        it('should dispatch core:action_executed with correct payload structure when actionResult contains a valid actionId and top-level message', async () => {
            const commandResult = {
                success: true,
                turnEnded: false,
                message: 'Magic missile cast!',
                actionResult: {
                    actionId: 'spell:magic_missile',
                    damage: 10,
                    target: 'goblin:1',
                    messages: [] // Intentionally empty to test top-level message usage
                },
            };

            const directive = await interpreter.interpret(commandResult, mockTurnContext);

            expect(directive).toBe(TurnDirective.RE_PROMPT);
            expect(mockDispatcher.dispatchSafely).toHaveBeenCalledTimes(1);
            expect(mockDispatcher.dispatchSafely).toHaveBeenCalledWith(
                'core:action_executed',
                {
                    actorId: successActorId,
                    actionId: 'spell:magic_missile',
                    result: {
                        success: true,
                        messages: [{text: 'Magic missile cast!', type: 'info'}],
                    },
                }
            );
            const dispatchedPayload = mockDispatcher.dispatchSafely.mock.calls[0][1];
            expect(dispatchedPayload).not.toHaveProperty('outcome');
            expect(dispatchedPayload).not.toHaveProperty('details');
            expect(mockLogger.info).toHaveBeenCalledWith(`Actor ${successActorId}: Success, turn continues (re-prompt).`);
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


        it('should use default actionId for core:action_executed if actionResult.actionId is missing', async () => {
            const commandResult = {
                success: true,
                turnEnded: true,
                message: 'Generic action done.',
                actionResult: { // actionId is missing here
                    someData: 'someValue',
                },
            };

            const directive = await interpreter.interpret(commandResult, mockTurnContext);

            expect(directive).toBe(TurnDirective.END_TURN_SUCCESS);
            expect(mockDispatcher.dispatchSafely).toHaveBeenCalledTimes(1);
            const dispatchedPayload = mockDispatcher.dispatchSafely.mock.calls[0][1];
            expect(dispatchedPayload).toEqual({
                actorId: successActorId,
                actionId: 'core:unknown_executed_action',
                result: {
                    success: true,
                    messages: [{text: 'Generic action done.', type: 'info'}],
                },
            });
            expect(mockLogger.debug).toHaveBeenCalledWith(expect.stringContaining(`actor ${successActorId}: actionResult or actionResult.actionId not found, null, or invalid. Using default actionId 'core:unknown_executed_action'.`));
            expect(mockLogger.info).toHaveBeenCalledWith(`Actor ${successActorId}: Success, turn ended.`);
        });

        it('should use default actionId for core:action_executed if actionResult.actionId is null', async () => {
            const commandResult = {
                success: true,
                turnEnded: false,
                message: 'Action performed.',
                actionResult: {
                    actionId: null,
                    info: 'details here',
                },
            };

            await interpreter.interpret(commandResult, mockTurnContext);
            const dispatchedPayload = mockDispatcher.dispatchSafely.mock.calls[0][1];

            expect(dispatchedPayload.actorId).toBe(successActorId);
            expect(dispatchedPayload.actionId).toBe('core:unknown_executed_action');
            expect(dispatchedPayload.result).toEqual({
                success: true,
                messages: [{text: 'Action performed.', type: 'info'}],
            });
            expect(mockLogger.debug).toHaveBeenCalledWith(expect.stringContaining(`actor ${successActorId}: actionResult or actionResult.actionId not found, null, or invalid. Using default actionId 'core:unknown_executed_action'.`));
        });

        it('should use default actionId and log warning if actionResult.actionId is an empty string', async () => {
            const commandResult = {
                success: true,
                turnEnded: false,
                message: 'Action with empty id.',
                actionResult: {actionId: ''},
            };
            await interpreter.interpret(commandResult, mockTurnContext);
            const dispatchedPayload = mockDispatcher.dispatchSafely.mock.calls[0][1];
            expect(dispatchedPayload.actorId).toBe(successActorId);
            expect(dispatchedPayload.actionId).toBe('core:unknown_executed_action');
            expect(dispatchedPayload.result.messages).toEqual([{text: 'Action with empty id.', type: 'info'}]);
            expect(mockLogger.warn).toHaveBeenCalledWith(expect.stringContaining(`actor ${successActorId}: actionResult.actionId was present but not a valid non-empty string (""). Using default actionId 'core:unknown_executed_action'.`));
        });

        it('should use default actionId and log warning if actionResult.actionId is not a string (e.g. a number)', async () => {
            const commandResult = {
                success: true,
                turnEnded: false,
                message: 'Action with numeric id.',
                actionResult: {actionId: 123},
            };
            await interpreter.interpret(commandResult, mockTurnContext);
            const dispatchedPayload = mockDispatcher.dispatchSafely.mock.calls[0][1];
            expect(dispatchedPayload.actorId).toBe(successActorId);
            expect(dispatchedPayload.actionId).toBe('core:unknown_executed_action');
            expect(dispatchedPayload.result.messages).toEqual([{text: 'Action with numeric id.', type: 'info'}]);
            expect(mockLogger.warn).toHaveBeenCalledWith(expect.stringContaining(`actor ${successActorId}: actionResult.actionId was present but not a valid non-empty string (123). Using default actionId 'core:unknown_executed_action'.`));
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


        it('should have empty messages if actionResult is null or undefined and no top-level message', async () => {
            const commandResultNull = {success: true, turnEnded: false, actionResult: null}; // No top-level message
            await interpreter.interpret(commandResultNull, mockTurnContext);
            let dispatchedPayload = mockDispatcher.dispatchSafely.mock.calls[0][1];
            expect(dispatchedPayload.actorId).toBe(successActorId);
            expect(dispatchedPayload.result.messages).toEqual([]);
            expect(dispatchedPayload.actionId).toBe('core:unknown_executed_action'); // Because actionResult is null
            expect(mockLogger.debug).toHaveBeenCalledWith(expect.stringContaining(`actor ${successActorId}: actionResult or actionResult.actionId not found, null, or invalid. Using default actionId 'core:unknown_executed_action'.`));


            jest.clearAllMocks();
            mockDispatcher.dispatchSafely.mockResolvedValue(true); // Reset for next call
            // mockActor.id is still successActorId
            const commandResultUndefined = {success: true, turnEnded: false, actionResult: undefined}; // No top-level message
            await interpreter.interpret(commandResultUndefined, mockTurnContext);
            dispatchedPayload = mockDispatcher.dispatchSafely.mock.calls[0][1];
            expect(dispatchedPayload.actorId).toBe(successActorId);
            expect(dispatchedPayload.result.messages).toEqual([]);
            expect(dispatchedPayload.actionId).toBe('core:unknown_executed_action'); // Because actionResult is undefined
            expect(mockLogger.debug).toHaveBeenCalledWith(expect.stringContaining(`actor ${successActorId}: actionResult or actionResult.actionId not found, null, or invalid. Using default actionId 'core:unknown_executed_action'.`));
        });
    });

    describe('interpret - failure path (core:action_failed)', () => {
        const failureActorId = 'player:1_failure';
        beforeEach(() => { // Set actorId for this describe block
            mockActor.id = failureActorId;
        });

        it('should dispatch core:action_failed with correct payload, deriving errorMessage from error object', async () => {
            const errorObj = new Error('Spell fizzled!');
            const commandResult = {
                success: false,
                turnEnded: true,
                error: errorObj,
                actionResult: {actionId: 'spell:fireball', failure_reason: 'low_mana'},
            };
            const directive = await interpreter.interpret(commandResult, mockTurnContext);

            expect(directive).toBe(TurnDirective.END_TURN_FAILURE);
            expect(mockDispatcher.dispatchSafely).toHaveBeenCalledWith(
                'core:action_failed',
                {
                    actorId: failureActorId,
                    actionId: 'spell:fireball',
                    errorMessage: 'Spell fizzled!',
                    details: {actionId: 'spell:fireball', failure_reason: 'low_mana'},
                }
            );
            expect(mockLogger.info).toHaveBeenCalledWith(`Actor ${failureActorId}: Failure, turn ended.`);
        });

        it('should derive errorMessage from result.message if error is not an Error instance', async () => {
            const commandResult = {
                success: false,
                turnEnded: false,
                error: 'generic_error_code', // Not an Error instance
                message: 'Attack missed.',    // Should be used as errorMessage
                actionResult: {actionId: 'combat:attack'}
            };
            await interpreter.interpret(commandResult, mockTurnContext);
            expect(mockDispatcher.dispatchSafely).toHaveBeenCalledWith(
                'core:action_failed',
                expect.objectContaining({
                    actorId: failureActorId,
                    actionId: 'combat:attack',
                    errorMessage: 'Attack missed.',
                    details: {actionId: 'combat:attack'}
                })
            );
            expect(mockLogger.info).toHaveBeenCalledWith(`Actor ${failureActorId}: Failure, turn continues (re-prompt).`);
        });

        it('should derive errorMessage from stringified result.error if message and Error instance are missing', async () => {
            const commandResult = {
                success: false,
                turnEnded: false,
                error: 'critical_system_failure_code_123', // Will be stringified
                message: null,                             // Message is missing
                actionResult: null                         // actionResult is null
            };
            await interpreter.interpret(commandResult, mockTurnContext);
            expect(mockDispatcher.dispatchSafely).toHaveBeenCalledWith(
                'core:action_failed',
                expect.objectContaining({
                    actorId: failureActorId,
                    errorMessage: 'critical_system_failure_code_123',
                    actionId: "core:unknown_failed_action", // Default because actionResult is null
                    details: {errorInfo: 'critical_system_failure_code_123'} // From result.error
                })
            );
        });

        it('should use default "Unknown action failure." if error and message are missing', async () => {
            const commandResult = {
                success: false,
                turnEnded: false,
                error: null,    // No error object
                message: null,  // No message
                actionResult: {some_detail: "some data"} // actionId missing, but details present
            };
            await interpreter.interpret(commandResult, mockTurnContext);
            expect(mockDispatcher.dispatchSafely).toHaveBeenCalledWith(
                'core:action_failed',
                expect.objectContaining({
                    actorId: failureActorId,
                    errorMessage: 'Unknown action failure.',
                    actionId: "core:unknown_failed_action",
                    details: {some_detail: "some data"}
                })
            );
        });

        it('should use default actionId "core:unknown_failed_action" if actionResult.actionId is missing', async () => {
            const commandResult = {
                success: false,
                turnEnded: false,
                error: 'Failed', // Provides error for errorMessage derivation
                actionResult: {some_detail: 'some failure detail'} // No actionId here
            };
            await interpreter.interpret(commandResult, mockTurnContext);
            expect(mockDispatcher.dispatchSafely).toHaveBeenCalledWith(
                'core:action_failed',
                expect.objectContaining({
                    actorId: failureActorId,
                    actionId: 'core:unknown_failed_action',
                    errorMessage: 'Failed', // derived from error property
                    details: {some_detail: 'some failure detail'}
                })
            );
        });
    });

    // VED (Virtual Event Dispatcher) Failure Path tests
    // These used 'outerScopeActorId' previously. We'll set mockActor.id specifically.
    it('VED Failure Path [Success + TurnEnded]: should return intended directive (END_TURN_SUCCESS) and log warning', async () => {
        const vedSuccessActorId = 'vedActor_EndTurnSuccess';
        mockActor.id = vedSuccessActorId;
        // mockTurnContext.getActor will return mockActor with this ID

        mockDispatcher.dispatchSafely.mockResolvedValue(false); // Simulate dispatch failure
        const resultData = {
            success: true,
            turnEnded: true,
            message: 'Victory!',
            actionResult: {actionId: 'some_action'}
        };

        const directive = await interpreter.interpret(resultData, mockTurnContext);

        expect(directive).toBe(TurnDirective.END_TURN_SUCCESS);
        const expectedAttemptedPayload = {
            actorId: vedSuccessActorId,
            actionId: 'some_action',
            result: {
                success: true,
                messages: [{text: 'Victory!', type: 'info'}],
            }
        };
        expect(mockDispatcher.dispatchSafely).toHaveBeenCalledWith('core:action_executed', expectedAttemptedPayload);
        expect(mockLogger.warn).toHaveBeenCalledTimes(1);
        expect(mockLogger.warn).toHaveBeenCalledWith(
            expect.stringContaining(`SafeEventDispatcher reported failure dispatching 'core:action_executed' for actor ${vedSuccessActorId}`)
        );
    });

    it('VED Failure Path [Failure + !TurnEnded]: should return intended directive (RE_PROMPT) and log warning', async () => {
        const vedFailureActorId = 'vedActor_RePromptFailure';
        mockActor.id = vedFailureActorId;
        // mockTurnContext.getActor will return mockActor with this ID

        mockDispatcher.dispatchSafely.mockResolvedValue(false); // Simulate dispatch failure
        const errorString = 'Bad command';
        const resultData = {
            success: false,
            turnEnded: false,
            error: errorString, // This will be stringified for errorMessage if message is absent
            message: 'A bad command was issued', // This should be preferred for errorMessage
            actionResult: {actionId: 'failed_action_id'}
        };

        const directive = await interpreter.interpret(resultData, mockTurnContext);

        expect(directive).toBe(TurnDirective.RE_PROMPT);
        const expectedAttemptedPayload = {
            actorId: vedFailureActorId,
            actionId: 'failed_action_id',
            errorMessage: 'A bad command was issued', // Derived from result.message
            details: {actionId: 'failed_action_id'}   // This is result.actionResult
        };
        expect(mockDispatcher.dispatchSafely).toHaveBeenCalledWith('core:action_failed', expectedAttemptedPayload);
        expect(mockLogger.warn).toHaveBeenCalledTimes(1);
        expect(mockLogger.warn).toHaveBeenCalledWith(
            expect.stringContaining(`SafeEventDispatcher reported failure dispatching 'core:action_failed' for actor ${vedFailureActorId}`)
        );
    });
});
// --- FILE END ---