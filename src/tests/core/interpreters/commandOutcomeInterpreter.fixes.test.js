// src/tests/core/interpreters/commandOutcomeInterpreter.fixes.test.js
// --- FILE START ---

import CommandOutcomeInterpreter from '../../../core/interpreters/commandOutcomeInterpreter.js';
import TurnDirective from '../../../core/constants/turnDirectives.js';
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

describe('CommandOutcomeInterpreter', () => {
    let interpreter;

    beforeEach(() => {
        jest.clearAllMocks(); // Clears mock usage data, but not implementation
        mockDispatcher.dispatchSafely.mockImplementation(() => Promise.resolve(true)); // Reset mock implementation

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
        const actorId = 'testActor'; // Define actorId for this scope
        it('should throw if actorId is invalid', async () => {
            await expect(interpreter.interpret({}, null)).rejects.toThrow('CommandOutcomeInterpreter: Invalid actorId provided (null).');
            await expect(interpreter.interpret({}, '')).rejects.toThrow('CommandOutcomeInterpreter: Invalid actorId provided ().');
        });

        it('should throw and dispatch system_error if commandResult is malformed', async () => {
            await expect(interpreter.interpret(null, actorId))
                .rejects.toThrow(`CommandOutcomeInterpreter: Invalid CommandResult structure for actor ${actorId}. Missing 'success' or 'turnEnded'.`);
            expect(mockDispatcher.dispatchSafely).toHaveBeenCalledWith('core:system_error_occurred', expect.any(Object));

            jest.clearAllMocks(); // Clear for next check
            mockDispatcher.dispatchSafely.mockResolvedValue(true);

            await expect(interpreter.interpret({success: true /* missing turnEnded */}, actorId))
                .rejects.toThrow(`CommandOutcomeInterpreter: Invalid CommandResult structure for actor ${actorId}. Missing 'success' or 'turnEnded'.`);
            expect(mockDispatcher.dispatchSafely).toHaveBeenCalledWith('core:system_error_occurred', expect.any(Object));
        });
    });

    describe('interpret - success path (core:action_executed)', () => {
        const actorId = 'player:1';

        it('should dispatch core:action_executed with correct payload structure when actionResult contains a valid actionId and top-level message', async () => {
            const commandResult = {
                success: true,
                turnEnded: false,
                message: 'Magic missile cast!', // This will be used for messages array
                actionResult: {
                    actionId: 'spell:magic_missile',
                    // Other data like damage, target are in actionResult but NOT directly in event.result
                    damage: 10,
                    target: 'goblin:1',
                    messages: [] // Assuming actionResult itself might have its own detailed messages (empty here)
                },
            };

            const directive = await interpreter.interpret(commandResult, actorId);

            expect(directive).toBe(TurnDirective.RE_PROMPT);
            expect(mockDispatcher.dispatchSafely).toHaveBeenCalledTimes(1);
            expect(mockDispatcher.dispatchSafely).toHaveBeenCalledWith(
                'core:action_executed',
                {
                    actorId: actorId,
                    actionId: 'spell:magic_missile',
                    result: {
                        success: true,
                        messages: [{text: 'Magic missile cast!', type: 'info'}], // Corrected
                    },
                }
            );
            const dispatchedPayload = mockDispatcher.dispatchSafely.mock.calls[0][1];
            expect(dispatchedPayload).not.toHaveProperty('outcome'); // Top-level check still valid
            expect(dispatchedPayload).not.toHaveProperty('details'); // Top-level check still valid
            expect(mockLogger.info).toHaveBeenCalledWith(`Actor ${actorId}: Success, turn continues (re-prompt).`);
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
            await interpreter.interpret(commandResult, actorId);
            expect(mockDispatcher.dispatchSafely).toHaveBeenCalledWith(
                'core:action_executed',
                expect.objectContaining({
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
                actionResult: { // actionId is missing, someData is not used in event.result
                    someData: 'someValue',
                },
            };

            const directive = await interpreter.interpret(commandResult, actorId);

            expect(directive).toBe(TurnDirective.END_TURN_SUCCESS);
            expect(mockDispatcher.dispatchSafely).toHaveBeenCalledTimes(1);
            const dispatchedPayload = mockDispatcher.dispatchSafely.mock.calls[0][1];
            expect(dispatchedPayload).toEqual({ // Corrected
                actorId: actorId,
                actionId: 'core:unknown_executed_action',
                result: {
                    success: true,
                    messages: [{text: 'Generic action done.', type: 'info'}],
                },
            });
            expect(mockLogger.debug).toHaveBeenCalledWith(expect.stringContaining(`actor ${actorId}: actionResult or actionResult.actionId not found, null, or invalid. Using default actionId 'core:unknown_executed_action'.`));
            expect(mockLogger.info).toHaveBeenCalledWith(`Actor ${actorId}: Success, turn ended.`);
        });

        it('should use default actionId for core:action_executed if actionResult.actionId is null', async () => {
            const commandResult = {
                success: true,
                turnEnded: false,
                message: 'Action performed.', // This will form the message
                actionResult: {
                    actionId: null, // actionId is null
                    info: 'details here', // This info is not part of event.result
                },
            };

            await interpreter.interpret(commandResult, actorId);
            const dispatchedPayload = mockDispatcher.dispatchSafely.mock.calls[0][1];

            expect(dispatchedPayload.actionId).toBe('core:unknown_executed_action');
            expect(dispatchedPayload.result).toEqual({ // Corrected
                success: true,
                messages: [{text: 'Action performed.', type: 'info'}],
            });
            // The following check is no longer valid as 'data' doesn't exist in result
            // expect(dispatchedPayload.result.data).toEqual({actionId: null, info: 'details here'});
            expect(mockLogger.debug).toHaveBeenCalledWith(expect.stringContaining(`actor ${actorId}: actionResult or actionResult.actionId not found, null, or invalid. Using default actionId 'core:unknown_executed_action'.`));
        });

        it('should use default actionId and log warning if actionResult.actionId is an empty string', async () => {
            const commandResult = {
                success: true,
                turnEnded: false,
                message: 'Action with empty id.', // This will be the message
                actionResult: {actionId: ''},
            };
            await interpreter.interpret(commandResult, actorId);
            const dispatchedPayload = mockDispatcher.dispatchSafely.mock.calls[0][1];
            expect(dispatchedPayload.actionId).toBe('core:unknown_executed_action');
            expect(dispatchedPayload.result.messages).toEqual([{text: 'Action with empty id.', type: 'info'}]); // Check messages
            expect(mockLogger.warn).toHaveBeenCalledWith(expect.stringContaining(`actor ${actorId}: actionResult.actionId was present but not a valid non-empty string (""). Using default actionId 'core:unknown_executed_action'.`));
        });

        it('should use default actionId and log warning if actionResult.actionId is not a string (e.g. a number)', async () => {
            const commandResult = {
                success: true,
                turnEnded: false,
                message: 'Action with numeric id.', // This will be the message
                actionResult: {actionId: 123},
            };
            await interpreter.interpret(commandResult, actorId);
            const dispatchedPayload = mockDispatcher.dispatchSafely.mock.calls[0][1];
            expect(dispatchedPayload.actionId).toBe('core:unknown_executed_action');
            expect(dispatchedPayload.result.messages).toEqual([{text: 'Action with numeric id.', type: 'info'}]); // Check messages
            expect(mockLogger.warn).toHaveBeenCalledWith(expect.stringContaining(`actor ${actorId}: actionResult.actionId was present but not a valid non-empty string (123). Using default actionId 'core:unknown_executed_action'.`));
        });

        it('should result in empty messages array if result.message and actionResult.messages are missing', async () => {
            const commandResult = {
                success: true,
                turnEnded: false,
                // message is missing
                actionResult: {actionId: 'test:action' /* no actionResult.messages */},
            };
            await interpreter.interpret(commandResult, actorId);
            expect(mockDispatcher.dispatchSafely).toHaveBeenCalledWith(
                'core:action_executed',
                expect.objectContaining({
                    actionId: 'test:action', // actionId from actionResult is used
                    result: expect.objectContaining({
                        success: true,
                        messages: [], // Corrected: expecting empty array
                    }),
                })
            );
        });


        it('should have empty messages if actionResult is null or undefined and no top-level message', async () => {
            const commandResultNull = {success: true, turnEnded: false, actionResult: null /* no message */};
            await interpreter.interpret(commandResultNull, actorId);
            let dispatchedPayload = mockDispatcher.dispatchSafely.mock.calls[0][1];
            // result.data no longer exists
            // expect(dispatchedPayload.result.data).toEqual({});
            expect(dispatchedPayload.result.messages).toEqual([]); // Corrected
            expect(dispatchedPayload.actionId).toBe('core:unknown_executed_action');
            expect(mockLogger.debug).toHaveBeenCalledWith(expect.stringContaining(`actor ${actorId}: actionResult or actionResult.actionId not found, null, or invalid. Using default actionId 'core:unknown_executed_action'.`));


            jest.clearAllMocks();
            mockDispatcher.dispatchSafely.mockResolvedValue(true);
            const commandResultUndefined = {success: true, turnEnded: false, actionResult: undefined /* no message */};
            await interpreter.interpret(commandResultUndefined, actorId);
            dispatchedPayload = mockDispatcher.dispatchSafely.mock.calls[0][1];
            // result.data no longer exists
            // expect(dispatchedPayload.result.data).toEqual({});
            expect(dispatchedPayload.result.messages).toEqual([]); // Corrected
            expect(dispatchedPayload.actionId).toBe('core:unknown_executed_action');
            expect(mockLogger.debug).toHaveBeenCalledWith(expect.stringContaining(`actor ${actorId}: actionResult or actionResult.actionId not found, null, or invalid. Using default actionId 'core:unknown_executed_action'.`));
        });
    });

    describe('interpret - failure path (core:action_failed)', () => {
        const actorId = 'player:1';

        it('should dispatch core:action_failed with correct payload, deriving errorMessage from error object', async () => {
            const errorObj = new Error('Spell fizzled!');
            const commandResult = {
                success: false,
                turnEnded: true,
                error: errorObj,
                actionResult: {actionId: 'spell:fireball', failure_reason: 'low_mana'},
            };
            const directive = await interpreter.interpret(commandResult, actorId);

            expect(directive).toBe(TurnDirective.END_TURN_FAILURE);
            expect(mockDispatcher.dispatchSafely).toHaveBeenCalledWith(
                'core:action_failed',
                {
                    actorId: actorId,
                    actionId: 'spell:fireball',
                    errorMessage: 'Spell fizzled!',
                    details: {actionId: 'spell:fireball', failure_reason: 'low_mana'},
                }
            );
            expect(mockLogger.info).toHaveBeenCalledWith(`Actor ${actorId}: Failure, turn ended.`);
        });

        it('should derive errorMessage from result.message if error is not an Error instance', async () => {
            const commandResult = {
                success: false,
                turnEnded: false,
                error: 'generic_error_code',
                message: 'Attack missed.',
                actionResult: {actionId: 'combat:attack'}
            };
            await interpreter.interpret(commandResult, actorId);
            expect(mockDispatcher.dispatchSafely).toHaveBeenCalledWith(
                'core:action_failed',
                expect.objectContaining({
                    errorMessage: 'Attack missed.',
                    details: {actionId: 'combat:attack'} // ensure details is actionResult
                })
            );
            expect(mockLogger.info).toHaveBeenCalledWith(`Actor ${actorId}: Failure, turn continues (re-prompt).`);
        });

        it('should derive errorMessage from stringified result.error if message and Error instance are missing', async () => {
            const commandResult = {
                success: false,
                turnEnded: false,
                error: 'critical_system_failure_code_123',
                actionResult: null // actionResult is null
            };
            await interpreter.interpret(commandResult, actorId);
            expect(mockDispatcher.dispatchSafely).toHaveBeenCalledWith(
                'core:action_failed',
                expect.objectContaining({
                    errorMessage: 'critical_system_failure_code_123',
                    actionId: "core:unknown_failed_action",
                    details: {errorInfo: 'critical_system_failure_code_123'} // actionResult is null, so details becomes {errorInfo}
                })
            );
        });

        it('should use default "Unknown action failure." if error and message are missing', async () => {
            const commandResult = {success: false, turnEnded: false, error: null, message: null};
            await interpreter.interpret(commandResult, actorId);
            expect(mockDispatcher.dispatchSafely).toHaveBeenCalledWith(
                'core:action_failed',
                expect.objectContaining({
                    errorMessage: 'Unknown action failure.',
                    details: {errorInfo: null} // actionResult is undefined, error is null
                })
            );
        });

        it('should use default actionId "core:unknown_failed_action" if actionResult.actionId is missing', async () => {
            const commandResult = {
                success: false,
                turnEnded: false,
                error: 'Failed',
                actionResult: {some_detail: 'some failure detail'} // No actionId in actionResult
            };
            await interpreter.interpret(commandResult, actorId);
            expect(mockDispatcher.dispatchSafely).toHaveBeenCalledWith(
                'core:action_failed',
                expect.objectContaining({
                    actionId: 'core:unknown_failed_action',
                    details: {some_detail: 'some failure detail'} // details is actionResult
                })
            );
        });
    });

    it('should log warning if dispatchSafely returns false', async () => {
        mockDispatcher.dispatchSafely.mockResolvedValue(false);
        const commandResult = {
            success: true,
            turnEnded: false,
            message: "test message",
            actionResult: {actionId: 'test:action'}
        };
        await interpreter.interpret(commandResult, 'actor:test');
        expect(mockLogger.warn).toHaveBeenCalledWith(expect.stringContaining("SafeEventDispatcher reported failure dispatching 'core:action_executed'"));
    });
});
// --- FILE END ---