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

describe('CommandOutcomeInterpreter', () => {
    let interpreter;
    // This actorId is available to direct children 'it' blocks of this 'describe'
    const outerScopeActorId = 'player1';

    beforeEach(() => {
        jest.clearAllMocks();
        mockDispatcher.dispatchSafely.mockImplementation(() => Promise.resolve(true));

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
        const actorId = 'testActor'; // Define actorId for this describe block's scope
        it('should throw if actorId is invalid', async () => {
            await expect(interpreter.interpret({}, null)).rejects.toThrow('CommandOutcomeInterpreter: Invalid actorId provided (null).');
            await expect(interpreter.interpret({}, '')).rejects.toThrow('CommandOutcomeInterpreter: Invalid actorId provided ().');
        });

        it('should throw and dispatch system_error if commandResult is malformed', async () => {
            await expect(interpreter.interpret(null, actorId))
                .rejects.toThrow(`CommandOutcomeInterpreter: Invalid CommandResult structure for actor ${actorId}. Missing 'success' or 'turnEnded'.`);
            expect(mockDispatcher.dispatchSafely).toHaveBeenCalledWith('core:system_error_occurred', expect.any(Object));

            jest.clearAllMocks();
            mockDispatcher.dispatchSafely.mockResolvedValue(true);

            await expect(interpreter.interpret({success: true /* missing turnEnded */}, actorId))
                .rejects.toThrow(`CommandOutcomeInterpreter: Invalid CommandResult structure for actor ${actorId}. Missing 'success' or 'turnEnded'.`);
            expect(mockDispatcher.dispatchSafely).toHaveBeenCalledWith('core:system_error_occurred', expect.any(Object));
        });
    });

    describe('interpret - success path (core:action_executed)', () => {
        const actorId = 'player:1'; // Define actorId for this describe block's scope

        it('should dispatch core:action_executed with correct payload structure when actionResult contains a valid actionId and top-level message', async () => {
            const commandResult = {
                success: true,
                turnEnded: false,
                message: 'Magic missile cast!',
                actionResult: {
                    actionId: 'spell:magic_missile',
                    damage: 10,
                    target: 'goblin:1',
                    messages: []
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
                        messages: [{text: 'Magic missile cast!', type: 'info'}],
                    },
                }
            );
            const dispatchedPayload = mockDispatcher.dispatchSafely.mock.calls[0][1];
            expect(dispatchedPayload).not.toHaveProperty('outcome');
            expect(dispatchedPayload).not.toHaveProperty('details');
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
                actionResult: {
                    someData: 'someValue',
                },
            };

            const directive = await interpreter.interpret(commandResult, actorId);

            expect(directive).toBe(TurnDirective.END_TURN_SUCCESS);
            expect(mockDispatcher.dispatchSafely).toHaveBeenCalledTimes(1);
            const dispatchedPayload = mockDispatcher.dispatchSafely.mock.calls[0][1];
            expect(dispatchedPayload).toEqual({
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
                message: 'Action performed.',
                actionResult: {
                    actionId: null,
                    info: 'details here',
                },
            };

            await interpreter.interpret(commandResult, actorId);
            const dispatchedPayload = mockDispatcher.dispatchSafely.mock.calls[0][1];

            expect(dispatchedPayload.actionId).toBe('core:unknown_executed_action');
            expect(dispatchedPayload.result).toEqual({
                success: true,
                messages: [{text: 'Action performed.', type: 'info'}],
            });
            expect(mockLogger.debug).toHaveBeenCalledWith(expect.stringContaining(`actor ${actorId}: actionResult or actionResult.actionId not found, null, or invalid. Using default actionId 'core:unknown_executed_action'.`));
        });

        it('should use default actionId and log warning if actionResult.actionId is an empty string', async () => {
            const commandResult = {
                success: true,
                turnEnded: false,
                message: 'Action with empty id.',
                actionResult: {actionId: ''},
            };
            await interpreter.interpret(commandResult, actorId);
            const dispatchedPayload = mockDispatcher.dispatchSafely.mock.calls[0][1];
            expect(dispatchedPayload.actionId).toBe('core:unknown_executed_action');
            expect(dispatchedPayload.result.messages).toEqual([{text: 'Action with empty id.', type: 'info'}]);
            expect(mockLogger.warn).toHaveBeenCalledWith(expect.stringContaining(`actor ${actorId}: actionResult.actionId was present but not a valid non-empty string (""). Using default actionId 'core:unknown_executed_action'.`));
        });

        it('should use default actionId and log warning if actionResult.actionId is not a string (e.g. a number)', async () => {
            const commandResult = {
                success: true,
                turnEnded: false,
                message: 'Action with numeric id.',
                actionResult: {actionId: 123},
            };
            await interpreter.interpret(commandResult, actorId);
            const dispatchedPayload = mockDispatcher.dispatchSafely.mock.calls[0][1];
            expect(dispatchedPayload.actionId).toBe('core:unknown_executed_action');
            expect(dispatchedPayload.result.messages).toEqual([{text: 'Action with numeric id.', type: 'info'}]);
            expect(mockLogger.warn).toHaveBeenCalledWith(expect.stringContaining(`actor ${actorId}: actionResult.actionId was present but not a valid non-empty string (123). Using default actionId 'core:unknown_executed_action'.`));
        });

        it('should result in empty messages array if result.message and actionResult.messages are missing', async () => {
            const commandResult = {
                success: true,
                turnEnded: false,
                actionResult: {actionId: 'test:action'},
            };
            await interpreter.interpret(commandResult, actorId);
            expect(mockDispatcher.dispatchSafely).toHaveBeenCalledWith(
                'core:action_executed',
                expect.objectContaining({
                    actionId: 'test:action',
                    result: expect.objectContaining({
                        success: true,
                        messages: [],
                    }),
                })
            );
        });


        it('should have empty messages if actionResult is null or undefined and no top-level message', async () => {
            const commandResultNull = {success: true, turnEnded: false, actionResult: null};
            await interpreter.interpret(commandResultNull, actorId);
            let dispatchedPayload = mockDispatcher.dispatchSafely.mock.calls[0][1];
            expect(dispatchedPayload.result.messages).toEqual([]);
            expect(dispatchedPayload.actionId).toBe('core:unknown_executed_action');
            expect(mockLogger.debug).toHaveBeenCalledWith(expect.stringContaining(`actor ${actorId}: actionResult or actionResult.actionId not found, null, or invalid. Using default actionId 'core:unknown_executed_action'.`));


            jest.clearAllMocks();
            mockDispatcher.dispatchSafely.mockResolvedValue(true);
            const commandResultUndefined = {success: true, turnEnded: false, actionResult: undefined};
            await interpreter.interpret(commandResultUndefined, actorId);
            dispatchedPayload = mockDispatcher.dispatchSafely.mock.calls[0][1];
            expect(dispatchedPayload.result.messages).toEqual([]);
            expect(dispatchedPayload.actionId).toBe('core:unknown_executed_action');
            expect(mockLogger.debug).toHaveBeenCalledWith(expect.stringContaining(`actor ${actorId}: actionResult or actionResult.actionId not found, null, or invalid. Using default actionId 'core:unknown_executed_action'.`));
        });
    });

    describe('interpret - failure path (core:action_failed)', () => {
        const actorId = 'player:1'; // Define actorId for this describe block's scope

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
                    details: {actionId: 'combat:attack'}
                })
            );
            expect(mockLogger.info).toHaveBeenCalledWith(`Actor ${actorId}: Failure, turn continues (re-prompt).`);
        });

        it('should derive errorMessage from stringified result.error if message and Error instance are missing', async () => {
            const commandResult = {
                success: false,
                turnEnded: false,
                error: 'critical_system_failure_code_123',
                actionResult: null
            };
            await interpreter.interpret(commandResult, actorId);
            expect(mockDispatcher.dispatchSafely).toHaveBeenCalledWith(
                'core:action_failed',
                expect.objectContaining({
                    errorMessage: 'critical_system_failure_code_123',
                    actionId: "core:unknown_failed_action",
                    details: {errorInfo: 'critical_system_failure_code_123'}
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
                    details: {errorInfo: null}
                })
            );
        });

        it('should use default actionId "core:unknown_failed_action" if actionResult.actionId is missing', async () => {
            const commandResult = {
                success: false,
                turnEnded: false,
                error: 'Failed',
                actionResult: {some_detail: 'some failure detail'}
            };
            await interpreter.interpret(commandResult, actorId);
            expect(mockDispatcher.dispatchSafely).toHaveBeenCalledWith(
                'core:action_failed',
                expect.objectContaining({
                    actionId: 'core:unknown_failed_action',
                    details: {some_detail: 'some failure detail'}
                })
            );
        });
    });

    // These 'it' blocks are direct children of the main 'describe'
    // We'll use outerScopeActorId or define one locally if needed to ensure it's in scope.
    it('VED Failure Path [Success + TurnEnded]: should return intended directive (END_TURN_SUCCESS) and log warning', async () => {
        const actorId = outerScopeActorId; // Explicitly use actorId from the correct scope
        mockDispatcher.dispatchSafely.mockResolvedValue(false);
        const resultData = {
            success: true,
            turnEnded: true,
            message: 'Victory!',
            actionResult: {actionId: 'some_action'}
        };

        const directive = await interpreter.interpret(resultData, actorId);

        expect(directive).toBe(TurnDirective.END_TURN_SUCCESS);
        const expectedAttemptedPayload = {
            actorId: actorId,
            actionId: 'some_action',
            result: {
                success: true,
                messages: [{text: 'Victory!', type: 'info'}],
            }
        };
        expect(mockDispatcher.dispatchSafely).toHaveBeenCalledWith('core:action_executed', expectedAttemptedPayload);
        expect(mockLogger.warn).toHaveBeenCalledTimes(1);
        expect(mockLogger.warn).toHaveBeenCalledWith(
            expect.stringContaining(`SafeEventDispatcher reported failure dispatching 'core:action_executed' for actor ${actorId}`)
        );
    });

    it('VED Failure Path [Failure + !TurnEnded]: should return intended directive (RE_PROMPT) and log warning', async () => {
        const actorId = outerScopeActorId; // Explicitly use actorId from the correct scope
        mockDispatcher.dispatchSafely.mockResolvedValue(false);
        const errorString = 'Bad command';
        const resultData = {
            success: false,
            turnEnded: false,
            error: errorString,
            message: 'A bad command was issued',
            actionResult: {actionId: 'failed_action_id'}
        };

        const directive = await interpreter.interpret(resultData, actorId);

        expect(directive).toBe(TurnDirective.RE_PROMPT);
        const expectedAttemptedPayload = {
            actorId: actorId,
            actionId: 'failed_action_id',
            errorMessage: 'A bad command was issued',
            details: {actionId: 'failed_action_id'}
        };
        expect(mockDispatcher.dispatchSafely).toHaveBeenCalledWith('core:action_failed', expectedAttemptedPayload);
        expect(mockLogger.warn).toHaveBeenCalledTimes(1);
        expect(mockLogger.warn).toHaveBeenCalledWith(
            expect.stringContaining(`SafeEventDispatcher reported failure dispatching 'core:action_failed' for actor ${actorId}`)
        );
    });
});
// --- FILE END ---