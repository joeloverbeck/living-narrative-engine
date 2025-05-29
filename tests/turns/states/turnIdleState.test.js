// tests/turns/states/turnIdleState.test.js
// --- FILE START ---

/**
 * @fileoverview Unit tests for TurnIdleState.
 * Verifies its interaction with ITurnContext and BaseTurnHandler.
 * Ticket: PTH-REFACTOR-001 (Refactor TurnIdleState to Use ITurnContext)
 */

import {afterEach, beforeEach, describe, expect, jest, test} from '@jest/globals';

// Module to be tested
import {TurnIdleState} from '../../../src/turns/states/turnIdleState.js';

// Dependencies to be mocked or spied upon
import {AwaitingPlayerInputState} from '../../../src/turns/states/awaitingPlayerInputState.js';
import {AbstractTurnState} from '../../../src/turns/states/abstractTurnState.js';

// --- Mocks & Test Utilities ---

const mockLogger = {
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
    debug: jest.fn(),
    createChild: jest.fn(() => mockLogger),
};

const createMockActor = (id = 'test-actor-idle') => ({
    id: id,
    name: `MockIdleActor-${id}`,
});

const createMockTurnContext = (actor, loggerInstance = mockLogger) => {
    const mockContext = {
        getActor: jest.fn().mockReturnValue(actor),
        getLogger: jest.fn().mockReturnValue(loggerInstance),
        endTurn: jest.fn(),
        getPlayerPromptService: jest.fn(),
        getGame: jest.fn(),
        getCommandProcessor: jest.fn(),
        getCommandOutcomeInterpreter: jest.fn(),
        getSafeEventDispatcher: jest.fn(),
        getSubscriptionManager: jest.fn(),
        getTurnEndPort: jest.fn(),
        isAwaitingExternalEvent: jest.fn().mockReturnValue(false),
        requestTransition: jest.fn().mockResolvedValue(undefined),
        setAwaitingExternalEvent: jest.fn(),
    };
    return mockContext;
};

// Mock for the TurnStateFactory
const mockTurnStateFactory = {
    createIdleState: jest.fn(),
};

const createMockBaseTurnHandler = (loggerInstance = mockLogger) => {
    const handlerMock = {
        _logger: loggerInstance,
        getLogger: jest.fn().mockReturnValue(loggerInstance),
        getTurnContext: jest.fn().mockReturnValue(null),
        _transitionToState: jest.fn().mockResolvedValue(undefined),
        _resetTurnStateAndResources: jest.fn(),
        getCurrentActor: jest.fn().mockReturnValue(null),
        _setCurrentActorInternal: jest.fn(),
        _setCurrentTurnContextInternal: jest.fn(),
        _currentState: {
            getStateName: jest.fn().mockReturnValue('MockPreviousState'),
            exitState: jest.fn().mockResolvedValue(undefined),
        },
        _turnStateFactory: mockTurnStateFactory, // Assign the mock factory
    };
    return handlerMock;
};

// --- Test Suite ---
describe('TurnIdleState', () => {
    let mockHandler;
    let turnIdleState;
    let testActor;
    let originalAbstractExitState;
    let originalAbstractHandleTurnEndedEvent;
    let originalAbstractHandleSubmittedCommand;
    let originalAbstractProcessCommandResult;
    let originalAbstractHandleDirective;
    let originalAbstractDestroy;
    let originalAbstractEnterState;


    beforeEach(() => {
        jest.clearAllMocks();
        testActor = createMockActor('actor-123');
        mockHandler = createMockBaseTurnHandler(mockLogger);

        // Set up the mock implementation for createIdleState
        // It needs to return an instance of TurnIdleState, passing the handler.
        mockTurnStateFactory.createIdleState.mockImplementation(
            (handlerForFactory) => new TurnIdleState(handlerForFactory)
        );

        turnIdleState = new TurnIdleState(mockHandler);

        originalAbstractEnterState = AbstractTurnState.prototype.enterState;
        originalAbstractExitState = AbstractTurnState.prototype.exitState;
        originalAbstractHandleTurnEndedEvent = AbstractTurnState.prototype.handleTurnEndedEvent;
        originalAbstractHandleSubmittedCommand = AbstractTurnState.prototype.handleSubmittedCommand;
        originalAbstractProcessCommandResult = AbstractTurnState.prototype.processCommandResult;
        originalAbstractHandleDirective = AbstractTurnState.prototype.handleDirective;
        originalAbstractDestroy = AbstractTurnState.prototype.destroy;


        jest.spyOn(AbstractTurnState.prototype, 'enterState');
        jest.spyOn(AbstractTurnState.prototype, 'exitState');
        jest.spyOn(AbstractTurnState.prototype, 'handleSubmittedCommand');
        jest.spyOn(AbstractTurnState.prototype, 'handleTurnEndedEvent');
        jest.spyOn(AbstractTurnState.prototype, 'processCommandResult');
        jest.spyOn(AbstractTurnState.prototype, 'handleDirective');
        jest.spyOn(AbstractTurnState.prototype, 'destroy');
    });

    afterEach(() => {
        AbstractTurnState.prototype.enterState = originalAbstractEnterState;
        AbstractTurnState.prototype.exitState = originalAbstractExitState;
        AbstractTurnState.prototype.handleTurnEndedEvent = originalAbstractHandleTurnEndedEvent;
        AbstractTurnState.prototype.handleSubmittedCommand = originalAbstractHandleSubmittedCommand;
        AbstractTurnState.prototype.processCommandResult = originalAbstractProcessCommandResult;
        AbstractTurnState.prototype.handleDirective = originalAbstractHandleDirective;
        AbstractTurnState.prototype.destroy = originalAbstractDestroy;
        jest.restoreAllMocks();
    });

    test('constructor should correctly store the handler', () => {
        expect(turnIdleState._handler).toBe(mockHandler);
    });

    test('getStateName should return "TurnIdleState"', () => {
        expect(turnIdleState.getStateName()).toBe('TurnIdleState');
    });

    describe('enterState', () => {
        test('should call super.enterState and then handler._resetTurnStateAndResources', async () => {
            AbstractTurnState.prototype.enterState.mockImplementationOnce(async function () { /* Minimal mock */
            });
            const specificLogger = {...mockLogger, debug: jest.fn()};
            mockHandler.getLogger.mockReturnValue(specificLogger);

            await turnIdleState.enterState(mockHandler, null);

            expect(AbstractTurnState.prototype.enterState).toHaveBeenCalledWith(mockHandler, null);
            expect(specificLogger.debug).toHaveBeenCalledWith('TurnIdleState: Ensuring clean state by calling handler._resetTurnStateAndResources().');
            expect(mockHandler._resetTurnStateAndResources).toHaveBeenCalledWith('enterState-TurnIdleState');
            expect(specificLogger.debug).toHaveBeenCalledWith('TurnIdleState: Entry complete. Handler is now idle.');
        });

        test('should use handler.getLogger for logging as context is null/cleared', async () => {
            AbstractTurnState.prototype.enterState.mockImplementationOnce(async function () { /* Minimal mock */
            });
            mockHandler.getTurnContext.mockReturnValue(null);

            await turnIdleState.enterState(mockHandler, null);

            expect(mockHandler.getLogger).toHaveBeenCalled();
            expect(mockLogger.debug).toHaveBeenCalledWith(expect.stringContaining('Ensuring clean state'));
        });
    });

    describe('exitState', () => {
        test('should call super.exitState', async () => {
            AbstractTurnState.prototype.exitState.mockImplementationOnce(async function () { /* Minimal mock */
            });
            const mockNextState = {getStateName: () => 'MockNextState'};
            await turnIdleState.exitState(mockHandler, mockNextState);
            expect(AbstractTurnState.prototype.exitState).toHaveBeenCalledWith(mockHandler, mockNextState);
        });

        test('super.exitState log should use ITurnContext if available (e.g. exiting to start a turn)', async () => {
            AbstractTurnState.prototype.exitState = originalAbstractExitState; // Use original implementation

            const mockContext = createMockTurnContext(testActor, mockLogger);
            mockHandler.getTurnContext.mockReturnValue(mockContext); // Ensure context is available

            await turnIdleState.exitState(mockHandler, null);

            expect(mockContext.getLogger).toHaveBeenCalled(); // Logger from context should be used
            expect(mockLogger.info).toHaveBeenCalledWith(
                `TurnIdleState: Exiting. Actor: ${testActor.id}. Transitioning to None.`
            );
        });
    });

    describe('startTurn', () => {
        let mockValidContext;

        beforeEach(() => {
            // Mock abstract state methods for these tests as they are not the focus here
            AbstractTurnState.prototype.enterState.mockImplementation(async function () {
            });
            AbstractTurnState.prototype.exitState.mockImplementation(async function () {
            });

            mockValidContext = createMockTurnContext(testActor, mockLogger);
            mockHandler.getTurnContext.mockReturnValue(mockValidContext); // Default to a valid context
        });

        test('should transition to AwaitingPlayerInputState if ITurnContext is valid', async () => {
            await turnIdleState.startTurn(mockHandler, testActor);

            expect(mockValidContext.getLogger).toHaveBeenCalled();
            expect(mockValidContext.getActor).toHaveBeenCalled();
            expect(mockLogger.info).toHaveBeenCalledWith(`TurnIdleState: Received startTurn for actor ${testActor.id}.`);
            expect(mockLogger.debug).toHaveBeenCalledWith(`TurnIdleState: ITurnContext confirmed for actor ${testActor.id}. Transitioning to AwaitingPlayerInputState.`);
            expect(mockHandler._transitionToState).toHaveBeenCalledWith(expect.any(AwaitingPlayerInputState));
            expect(mockLogger.info).toHaveBeenCalledWith(`TurnIdleState: Successfully transitioned to AwaitingPlayerInputState for actor ${testActor.id}.`);
        });

        test('should throw error and re-transition to Idle if actorEntity is invalid', async () => {
            mockHandler.getTurnContext.mockReturnValue(null); // No context for this path
            const invalidActor = null;

            await expect(turnIdleState.startTurn(mockHandler, invalidActor))
                .rejects.toThrow('TurnIdleState: startTurn called with invalid actorEntity.');

            expect(mockLogger.error).toHaveBeenCalledWith('TurnIdleState: startTurn called with invalid actorEntity.');
            expect(mockHandler._resetTurnStateAndResources).toHaveBeenCalledWith('invalid-actor-TurnIdleState');
            expect(mockTurnStateFactory.createIdleState).toHaveBeenCalledWith(mockHandler);
            expect(mockHandler._transitionToState).toHaveBeenCalledWith(expect.any(TurnIdleState));
        });

        test('should throw error and re-transition to Idle if ITurnContext is missing', async () => {
            mockHandler.getTurnContext.mockReturnValue(null); // Force context to be missing

            await expect(turnIdleState.startTurn(mockHandler, testActor))
                .rejects.toThrow(`TurnIdleState: ITurnContext is missing or invalid. Expected concrete handler to set it up. Actor: ${testActor.id}.`);

            expect(mockLogger.error).toHaveBeenCalledWith(`TurnIdleState: ITurnContext is missing or invalid. Expected concrete handler to set it up. Actor: ${testActor.id}.`);
            expect(mockHandler._resetTurnStateAndResources).toHaveBeenCalledWith('missing-context-TurnIdleState');
            expect(mockTurnStateFactory.createIdleState).toHaveBeenCalledWith(mockHandler);
            expect(mockHandler._transitionToState).toHaveBeenCalledWith(expect.any(TurnIdleState));
        });

        test('should throw error and re-transition to Idle if ITurnContext actor mismatches', async () => {
            const wrongActor = createMockActor('wrong-actor-id');
            // mockValidContext is already set up with testActor by the describe's beforeEach
            // mockHandler.getTurnContext.mockReturnValue(mockValidContext); // This is implicitly done

            await expect(turnIdleState.startTurn(mockHandler, wrongActor))
                .rejects.toThrow(`TurnIdleState: Actor in ITurnContext ('${testActor.id}') does not match actor provided to state's startTurn ('${wrongActor.id}').`);

            expect(mockLogger.error).toHaveBeenCalledWith(`TurnIdleState: Actor in ITurnContext ('${testActor.id}') does not match actor provided to state's startTurn ('${wrongActor.id}').`);
            expect(mockHandler._resetTurnStateAndResources).toHaveBeenCalledWith('actor-mismatch-TurnIdleState');
            expect(mockTurnStateFactory.createIdleState).toHaveBeenCalledWith(mockHandler);
            expect(mockHandler._transitionToState).toHaveBeenCalledWith(expect.any(TurnIdleState));
        });

        test('should handle failure during transition to AwaitingPlayerInputState and re-idle', async () => {
            const transitionError = new Error('Failed to transition');
            // Mock the first call to _transitionToState (to AwaitingPlayerInputState) to reject.
            // Subsequent calls will use the default mock (resolves) from createMockBaseTurnHandler.
            mockHandler._transitionToState.mockRejectedValueOnce(transitionError);

            await expect(turnIdleState.startTurn(mockHandler, testActor))
                .rejects.toThrow(transitionError);

            expect(mockLogger.error).toHaveBeenCalledWith(
                `TurnIdleState: Failed to transition to AwaitingPlayerInputState for ${testActor.id}. Error: ${transitionError.message}`,
                transitionError
            );
            expect(mockHandler._resetTurnStateAndResources).toHaveBeenCalledWith('transition-fail-TurnIdleState');
            expect(mockTurnStateFactory.createIdleState).toHaveBeenCalledWith(mockHandler);
            expect(mockHandler._transitionToState).toHaveBeenCalledTimes(2); // Original attempt + recovery attempt
            expect(mockHandler._transitionToState).toHaveBeenLastCalledWith(expect.any(TurnIdleState));
        });
    });

    describe('Disallowed Operations in Idle State', () => {
        const commandString = "do stuff";
        const eventPayload = {entityId: 'some-actor', event: 'TURN_ENDED_SOMEHOW'};
        const cmdProcResult = {success: true, message: "done"};
        const directive = "SOME_DIRECTIVE";

        beforeEach(() => {
            // Restore original AbstractTurnState methods for these specific tests
            // to ensure we are testing the interaction with the *actual* super methods.
            AbstractTurnState.prototype.handleSubmittedCommand = originalAbstractHandleSubmittedCommand;
            AbstractTurnState.prototype.handleTurnEndedEvent = originalAbstractHandleTurnEndedEvent;
            AbstractTurnState.prototype.processCommandResult = originalAbstractProcessCommandResult;
            AbstractTurnState.prototype.handleDirective = originalAbstractHandleDirective;
        });


        test('handleSubmittedCommand should log warning and call super (which throws)', async () => {
            mockHandler.getTurnContext.mockReturnValue(null);
            const expectedErrorMsg = `Method 'handleSubmittedCommand(command: "${commandString}", entity: ${testActor?.id}, contextActor: NO_CONTEXT_ACTOR)' must be implemented by concrete state TurnIdleState.`;

            await expect(turnIdleState.handleSubmittedCommand(mockHandler, commandString, testActor))
                .rejects.toThrow(expectedErrorMsg);

            expect(mockLogger.warn).toHaveBeenCalledWith(`TurnIdleState: Command ('${commandString}') submitted by ${testActor.id} but no turn is active (handler is Idle).`);
            // This assertion now checks the error log from AbstractTurnState
            expect(mockLogger.error).toHaveBeenCalledWith(expectedErrorMsg);
        });

        test('handleTurnEndedEvent should log warning and call super (which logs warn)', async () => {
            mockHandler.getTurnContext.mockReturnValue(null);

            await turnIdleState.handleTurnEndedEvent(mockHandler, eventPayload);

            expect(mockLogger.warn).toHaveBeenCalledWith(`TurnIdleState: handleTurnEndedEvent called (for ${eventPayload.entityId}) but no turn is active (handler is Idle).`);
            // This assertion checks the warning log from AbstractTurnState
            expect(mockLogger.warn).toHaveBeenCalledWith(
                `Method 'handleTurnEndedEvent(payloadActorId: ${eventPayload.entityId})' called on state TurnIdleState where it might not be expected or handled. Current context actor: N/A.`
            );
        });

        test('processCommandResult should log warning and call super (which throws)', async () => {
            mockHandler.getTurnContext.mockReturnValue(null);
            // AbstractTurnState's processCommandResult gets actor from context, which is null.
            // The passed 'actor' param is used for an initial check then context actor is prioritized.
            const expectedErrorMsg = `Method 'processCommandResult(actorId: undefined, command: "${commandString}")' must be implemented by concrete state TurnIdleState.`;


            await expect(turnIdleState.processCommandResult(mockHandler, testActor, cmdProcResult, commandString))
                .rejects.toThrow(expectedErrorMsg);

            expect(mockLogger.warn).toHaveBeenCalledWith(`TurnIdleState: processCommandResult called (for ${testActor.id}) but no turn is active.`);
            // This assertion now checks the error log from AbstractTurnState
            expect(mockLogger.error).toHaveBeenCalledWith(expectedErrorMsg);
        });

        test('handleDirective should log warning and call super (which throws)', async () => {
            mockHandler.getTurnContext.mockReturnValue(null);
            // Similar to processCommandResult, context actor will be undefined.
            const expectedErrorMsg = `Method 'handleDirective(actorId: undefined, directive: ${directive})' must be implemented by concrete state TurnIdleState.`;

            await expect(turnIdleState.handleDirective(mockHandler, testActor, directive, cmdProcResult))
                .rejects.toThrow(expectedErrorMsg);

            expect(mockLogger.warn).toHaveBeenCalledWith(`TurnIdleState: handleDirective called (for ${testActor.id}) but no turn is active.`);
            // This assertion now checks the error log from AbstractTurnState
            expect(mockLogger.error).toHaveBeenCalledWith(expectedErrorMsg);
        });
    });

    describe('destroy', () => {
        test('should log information and call super.destroy', async () => {
            AbstractTurnState.prototype.destroy.mockImplementationOnce(async function () { /* Minimal mock for super call */
            });
            mockHandler.getTurnContext.mockReturnValue(null); // Context is typically null in Idle

            await turnIdleState.destroy(mockHandler);

            expect(mockLogger.info).toHaveBeenCalledWith('TurnIdleState: BaseTurnHandler is being destroyed while in idle state.');
            expect(AbstractTurnState.prototype.destroy).toHaveBeenCalledWith(mockHandler);
            expect(mockLogger.debug).toHaveBeenCalledWith('TurnIdleState: Destroy handling complete.');
        });
    });

    test('should not have direct PlayerTurnHandler code dependencies', () => {
        const sourceCode = TurnIdleState.toString(); // This gets the source code of the class
        const dependencyRegex = /(?<!\/\/\s*|\*\s*)\bPlayerTurnHandler\b/;
        expect(sourceCode).not.toMatch(dependencyRegex);
    });
});

// --- FILE END ---