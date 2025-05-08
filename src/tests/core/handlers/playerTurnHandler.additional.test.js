// src/tests/core/handlers/playerTurnHandler.additional.test.js
// --- FILE START ---
import PlayerTurnHandler from '../../../core/handlers/playerTurnHandler.js';
import {afterEach, beforeEach, describe, expect, it, jest} from "@jest/globals";
import TurnDirective from '../../../core/constants/turnDirectives.js';
import {TURN_ENDED_ID} from '../../../core/constants/eventIds.js';

describe('PlayerTurnHandler - Additional Scenarios and Edge Cases', () => {
    let mockLogger;
    let mockCommandProcessor;
    let mockTurnEndPort;
    let mockPlayerPromptService;
    let mockCommandOutcomeInterpreter;
    let mockSafeEventDispatcher;
    let mockSubscriptionManager;
    let validDependencies;
    let playerTurnHandler;
    let actor;
    let className;

    const ACTOR_ID = 'playerTest1';
    const OTHER_ACTOR_ID = 'playerTest2';

    beforeEach(() => {
        mockLogger = {
            info: jest.fn(),
            warn: jest.fn(),
            error: jest.fn(),
            debug: jest.fn(),
        };
        mockCommandProcessor = {
            processCommand: jest.fn(),
        };
        mockTurnEndPort = {
            notifyTurnEnded: jest.fn().mockResolvedValue(undefined),
        };
        mockPlayerPromptService = {
            prompt: jest.fn().mockResolvedValue(undefined),
        };
        mockCommandOutcomeInterpreter = {
            interpret: jest.fn(),
        };
        mockSafeEventDispatcher = {
            dispatchSafely: jest.fn(),
            subscribe: jest.fn(), // General mock for ISafeEventDispatcher contract
        };
        mockSubscriptionManager = {
            subscribeToCommandInput: jest.fn().mockReturnValue(true),
            unsubscribeFromCommandInput: jest.fn(),
            subscribeToTurnEnded: jest.fn().mockReturnValue(true),
            unsubscribeFromTurnEnded: jest.fn(),
            unsubscribeAll: jest.fn(),
        };

        validDependencies = {
            logger: mockLogger,
            commandProcessor: mockCommandProcessor,
            turnEndPort: mockTurnEndPort,
            playerPromptService: mockPlayerPromptService,
            commandOutcomeInterpreter: mockCommandOutcomeInterpreter,
            safeEventDispatcher: mockSafeEventDispatcher,
            subscriptionLifecycleManager: mockSubscriptionManager,
        };

        playerTurnHandler = new PlayerTurnHandler(validDependencies);
        className = playerTurnHandler.constructor.name;
        actor = {id: ACTOR_ID, name: 'Test Player Actor'};

        process.env.NODE_ENV = 'test'; // Enable test-only methods
    });

    afterEach(() => {
        jest.restoreAllMocks();
        jest.clearAllMocks();
        if (playerTurnHandler && typeof playerTurnHandler._TEST_GET_CURRENT_ACTOR === 'function') {
            playerTurnHandler._TEST_SET_CURRENT_ACTOR(null);
        }
        delete process.env.NODE_ENV;
    });

    // --- Strategy Edge Cases ---
    describe('_executeRepromptStrategy - Edge Cases', () => {
        // GAP 2.5.1
        it('should re-throw error if _promptPlayerForAction fails, and _promptPlayerForAction should handle turn end', async () => {
            playerTurnHandler._TEST_SET_CURRENT_ACTOR(actor);
            const promptError = new Error("Prompt failed during re-prompt strategy");
            const promptPlayerActionSpy = jest.spyOn(playerTurnHandler, '_promptPlayerForAction').mockRejectedValue(promptError);

            await expect(playerTurnHandler._executeRepromptStrategy(actor)).rejects.toThrow(promptError);

            expect(promptPlayerActionSpy).toHaveBeenCalledWith(actor);
            expect(mockLogger.debug).toHaveBeenCalledWith(
                `${className}: _executeRepromptStrategy: Re-throwing error from _promptPlayerForAction for ${ACTOR_ID}. Error: ${promptError.message}`
            );
        });

        // GAP 3.1.1
        it('should abort and log if actor becomes invalid after successful re-prompt attempt', async () => {
            playerTurnHandler._TEST_SET_CURRENT_ACTOR(actor);
            const promptPlayerActionSpy = jest.spyOn(playerTurnHandler, '_promptPlayerForAction').mockImplementation(async () => {
                playerTurnHandler._TEST_SET_CURRENT_ACTOR(null);
            });

            await playerTurnHandler._executeRepromptStrategy(actor);

            expect(promptPlayerActionSpy).toHaveBeenCalledWith(actor);
            expect(mockLogger.warn).toHaveBeenCalledWith(
                `${className}.#_isTurnValidForActor: Check failed for actor ${ACTOR_ID}; no current actor.`
            );
            expect(mockLogger.warn).toHaveBeenCalledWith(
                `${className}: _executeRepromptStrategy: Actor ${ACTOR_ID} no longer valid after re-prompt attempt. Aborting operation.`
            );
        });
    });

    describe('_executeWaitForTurnEndEventStrategy - Edge Cases', () => {
        // GAP 3.1.2
        it('should abort and log if actor becomes invalid after attempting to set up #waitForTurnEndEvent', async () => {
            playerTurnHandler._TEST_SET_CURRENT_ACTOR(actor);

            mockSubscriptionManager.subscribeToTurnEnded.mockImplementation(() => {
                playerTurnHandler._TEST_SET_CURRENT_ACTOR(null);
                return true;
            });

            await playerTurnHandler._executeWaitForTurnEndEventStrategy(actor);

            expect(mockSubscriptionManager.subscribeToTurnEnded).toHaveBeenCalledTimes(1);

            expect(mockLogger.warn).toHaveBeenCalledWith(
                `${className}.#_isTurnValidForActor: Check failed for actor ${ACTOR_ID}; no current actor.`
            );
            expect(mockLogger.warn).toHaveBeenCalledWith(
                `${className}: _executeWaitForTurnEndEventStrategy: Actor ${ACTOR_ID} no longer valid after attempting to set up wait for '${TURN_ENDED_ID}'. Aborting operation.`
            );
        });
    });

    // --- Event-Driven Scenarios ---
    describe('#waitForTurnEndEvent and TURN_ENDED_ID event handling', () => {
        let turnEndedListener;

        beforeEach(() => {
            mockSubscriptionManager.subscribeToTurnEnded.mockImplementation((listener) => {
                turnEndedListener = listener;
                return true;
            });
            turnEndedListener = null;
        });

        // GAP 1.2.1 (Part 1)
        it('should subscribe to TURN_ENDED_ID and call _handleTurnEnd on event for current actor', async () => {
            playerTurnHandler._TEST_SET_CURRENT_ACTOR(actor);
            const handleTurnEndSpy = jest.spyOn(playerTurnHandler, '_handleTurnEnd');

            await playerTurnHandler._executeWaitForTurnEndEventStrategy(actor);

            expect(mockSubscriptionManager.subscribeToTurnEnded).toHaveBeenCalledTimes(1);
            expect(turnEndedListener).toBeInstanceOf(Function);

            const eventPayload = {entityId: ACTOR_ID, message: "Turn ended by event."};
            await turnEndedListener(eventPayload);

            expect(handleTurnEndSpy).toHaveBeenCalledWith(ACTOR_ID, null);
            expect(mockSubscriptionManager.unsubscribeAll).toHaveBeenCalled();
        });

        // GAP 3.3.1
        it('should ignore TURN_ENDED_ID event if for a different actor', async () => {
            playerTurnHandler._TEST_SET_CURRENT_ACTOR(actor);
            const handleTurnEndSpy = jest.spyOn(playerTurnHandler, '_handleTurnEnd');

            await playerTurnHandler._executeWaitForTurnEndEventStrategy(actor);
            expect(turnEndedListener).toBeInstanceOf(Function);

            const eventPayload = {entityId: OTHER_ACTOR_ID, message: "Event for someone else."};
            await turnEndedListener(eventPayload);

            expect(handleTurnEndSpy).not.toHaveBeenCalled();
            expect(mockLogger.debug).toHaveBeenCalledWith(
                expect.stringContaining(`Ignoring '${TURN_ENDED_ID}' event for entity ${OTHER_ACTOR_ID}`)
            );
        });

        it('should clear mechanisms if TURN_ENDED_ID received for awaited actor, but actor no longer current', async () => {
            playerTurnHandler._TEST_SET_CURRENT_ACTOR(actor);
            const handleTurnEndSpy = jest.spyOn(playerTurnHandler, '_handleTurnEnd');

            await playerTurnHandler._executeWaitForTurnEndEventStrategy(actor);
            expect(turnEndedListener).toBeInstanceOf(Function);

            playerTurnHandler._TEST_SET_CURRENT_ACTOR({id: OTHER_ACTOR_ID});

            const eventPayload = {entityId: ACTOR_ID, message: "Event for previously awaited actor."};
            await turnEndedListener(eventPayload);

            expect(handleTurnEndSpy).not.toHaveBeenCalled();
            expect(mockLogger.warn).toHaveBeenCalledWith(
                expect.stringContaining(`Received '${TURN_ENDED_ID}' for awaited actor ${ACTOR_ID}, but actor is no longer current`)
            );
            expect(mockSubscriptionManager.unsubscribeFromTurnEnded).toHaveBeenCalled();
        });

        // GAP 2.6.1 (Failure path)
        it('should call _handleTurnEnd with error if subscription to TURN_ENDED_ID fails', async () => {
            playerTurnHandler._TEST_SET_CURRENT_ACTOR(actor);
            mockSubscriptionManager.subscribeToTurnEnded.mockReturnValue(false);
            const handleTurnEndSpy = jest.spyOn(playerTurnHandler, '_handleTurnEnd').mockResolvedValue(undefined);

            await playerTurnHandler._executeWaitForTurnEndEventStrategy(actor);

            expect(mockLogger.error).toHaveBeenCalledWith(
                `${className}: Failed to subscribe to '${TURN_ENDED_ID}' for actor ${ACTOR_ID}. Ending turn with failure.`
            );
            expect(handleTurnEndSpy).toHaveBeenCalledWith(ACTOR_ID, expect.any(Error));
            const errorArg = handleTurnEndSpy.mock.calls[0][1];
            expect(errorArg.message).toBe(`Internal error: Failed to subscribe to ${TURN_ENDED_ID} event listener.`);
        });
    });

    // --- destroy() Method Scenarios ---
    describe('destroy() method', () => {
        // GAP 4.1.1
        it('should notifyTurnEnded(false) and cleanup if called during active turn (abnormal termination)', async () => {
            playerTurnHandler._TEST_SET_CURRENT_ACTOR(actor);

            playerTurnHandler.destroy();
            await new Promise(process.nextTick);

            expect(mockLogger.warn).toHaveBeenCalledWith(
                `${className}: Destroying during active turn for ${ACTOR_ID} (not normally terminated). Failsafe: notifying TurnEndPort of failure.`
            );
            expect(mockTurnEndPort.notifyTurnEnded).toHaveBeenCalledWith(ACTOR_ID, false);
            expect(mockTurnEndPort.notifyTurnEnded).toHaveBeenCalledTimes(1);
            expect(mockSubscriptionManager.unsubscribeAll).toHaveBeenCalledTimes(1);
            expect(playerTurnHandler._TEST_GET_CURRENT_ACTOR()).toBeNull();
        });

        // GAP 4.2.1 (Part 1 - explicit signal)
        it('should NOT notifyTurnEnded by destroy if normally terminating (signalled) during active turn, but still cleanup', async () => {
            playerTurnHandler._TEST_SET_CURRENT_ACTOR(actor);
            playerTurnHandler.signalNormalApparentTermination();

            playerTurnHandler.destroy();
            await new Promise(process.nextTick);

            expect(mockLogger.debug).toHaveBeenCalledWith(
                `${className}: Destroying for ${ACTOR_ID} (normally terminated). Failsafe TurnEndPort notification skipped.`
            );
            expect(mockTurnEndPort.notifyTurnEnded).not.toHaveBeenCalled();
            expect(mockSubscriptionManager.unsubscribeAll).toHaveBeenCalledTimes(1);
            expect(playerTurnHandler._TEST_GET_CURRENT_ACTOR()).toBeNull();
        });

        // GAP 4.2.1 (Part 2 - implicitly normal via _handleTurnEnd having run)
        it('should NOT notifyTurnEnded by destroy if called after a turn has fully completed via _handleTurnEnd', async () => {
            playerTurnHandler._TEST_SET_CURRENT_ACTOR(actor);
            jest.spyOn(playerTurnHandler, '_handleTurnEnd');
            await playerTurnHandler._handleTurnEnd(actor.id, null);

            expect(playerTurnHandler._TEST_GET_CURRENT_ACTOR()).toBeNull();

            mockTurnEndPort.notifyTurnEnded.mockClear();
            mockSubscriptionManager.unsubscribeAll.mockClear();

            playerTurnHandler.destroy();
            await new Promise(process.nextTick);

            expect(mockLogger.debug).toHaveBeenCalledWith(
                expect.stringContaining(`${className}: Destroying handler (no active or awaited actor). No failsafe notification needed`)
            );
            expect(mockTurnEndPort.notifyTurnEnded).not.toHaveBeenCalled();
            expect(mockSubscriptionManager.unsubscribeAll).toHaveBeenCalledTimes(1);
        });


        // GAP 4.3.1
        it('should cleanup but not notifyTurnEnded if no turn is active when destroyed', async () => {
            expect(playerTurnHandler._TEST_GET_CURRENT_ACTOR()).toBeNull();

            playerTurnHandler.destroy();
            await new Promise(process.nextTick);

            expect(mockLogger.debug).toHaveBeenCalledWith(
                expect.stringContaining(`${className}: Destroying handler (no active or awaited actor). No failsafe notification needed`)
            );
            expect(mockTurnEndPort.notifyTurnEnded).not.toHaveBeenCalled();
            expect(mockSubscriptionManager.unsubscribeAll).toHaveBeenCalledTimes(1);
        });

        // GAP 4.4.1
        it('should be idempotent, performing full cleanup and notification only once', async () => {
            playerTurnHandler._TEST_SET_CURRENT_ACTOR(actor);

            playerTurnHandler.destroy();
            await new Promise(process.nextTick);

            expect(mockTurnEndPort.notifyTurnEnded).toHaveBeenCalledWith(ACTOR_ID, false);
            expect(mockTurnEndPort.notifyTurnEnded).toHaveBeenCalledTimes(1);
            expect(mockSubscriptionManager.unsubscribeAll).toHaveBeenCalledTimes(1);
            const logMessageOnDestroy = `${className}: Destroying handler instance`;
            expect(mockLogger.info).toHaveBeenCalledWith(expect.stringContaining(logMessageOnDestroy));

            mockTurnEndPort.notifyTurnEnded.mockClear();
            mockSubscriptionManager.unsubscribeAll.mockClear();
            mockLogger.info.mockClear();
            mockLogger.debug.mockClear();

            playerTurnHandler.destroy();
            await new Promise(process.nextTick);

            expect(mockLogger.debug).toHaveBeenCalledWith(
                expect.stringContaining(`${className}: Already destroyed. Skipping destruction for context:`)
            );
            expect(mockTurnEndPort.notifyTurnEnded).not.toHaveBeenCalled();
            expect(mockSubscriptionManager.unsubscribeAll).not.toHaveBeenCalled();
            expect(mockLogger.info).not.toHaveBeenCalledWith(expect.stringContaining(logMessageOnDestroy));
        });

        it('should still cleanup if failsafe notification in destroy throws error', async () => {
            playerTurnHandler._TEST_SET_CURRENT_ACTOR(actor);
            const notifyError = new Error("Notify failed during destroy");
            mockTurnEndPort.notifyTurnEnded.mockRejectedValue(notifyError);

            playerTurnHandler.destroy();
            await new Promise(resolve => process.nextTick(resolve));

            expect(mockTurnEndPort.notifyTurnEnded).toHaveBeenCalledWith(ACTOR_ID, false);
            expect(mockLogger.error).toHaveBeenCalledWith(
                `${className}: Error in failsafe TurnEndPort notification for ${ACTOR_ID} during destroy: ${notifyError.message}`,
                notifyError
            );
            expect(mockSubscriptionManager.unsubscribeAll).toHaveBeenCalledTimes(1);
            expect(playerTurnHandler._TEST_GET_CURRENT_ACTOR()).toBeNull();
        });
    });

    // --- Sequential Turn Handling ---
    describe('Sequential Turn Handling', () => {
        // GAP 5.2.1
        it('should manage subscriptions correctly across a startTurn -> _handleTurnEnd -> startTurn sequence', async () => {
            const actor1 = {id: ACTOR_ID, name: 'Player One'};
            const actor2 = {id: OTHER_ACTOR_ID, name: 'Player Two'};

            jest.spyOn(playerTurnHandler, '_handleTurnEnd');

            // --- First Turn (actor1) ---
            await playerTurnHandler.startTurn(actor1);
            expect(mockSubscriptionManager.subscribeToCommandInput).toHaveBeenCalledTimes(1);
            expect(mockSubscriptionManager.subscribeToCommandInput).toHaveBeenLastCalledWith(expect.any(Function));
            expect(mockSubscriptionManager.unsubscribeFromCommandInput).toHaveBeenCalledTimes(1);

            await playerTurnHandler._handleTurnEnd(actor1.id, null);
            expect(mockTurnEndPort.notifyTurnEnded).toHaveBeenCalledWith(actor1.id, true);
            expect(mockSubscriptionManager.unsubscribeAll).toHaveBeenCalledTimes(1);
            expect(playerTurnHandler._TEST_GET_CURRENT_ACTOR()).toBeNull();

            mockSubscriptionManager.subscribeToCommandInput.mockClear();
            mockSubscriptionManager.unsubscribeFromCommandInput.mockClear();
            mockSubscriptionManager.unsubscribeAll.mockClear();
            mockTurnEndPort.notifyTurnEnded.mockClear();

            // --- Second Turn (actor2) ---
            await playerTurnHandler.startTurn(actor2);
            expect(playerTurnHandler._TEST_GET_CURRENT_ACTOR()).toBe(actor2);
            expect(mockSubscriptionManager.subscribeToCommandInput).toHaveBeenCalledTimes(1);
            expect(mockSubscriptionManager.subscribeToCommandInput).toHaveBeenLastCalledWith(expect.any(Function));
            expect(mockSubscriptionManager.unsubscribeFromCommandInput).toHaveBeenCalledTimes(1);
            expect(mockSubscriptionManager.unsubscribeAll).not.toHaveBeenCalled();
        });
    });
});
// --- FILE END ---