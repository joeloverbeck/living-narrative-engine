// tests/turns/services/playerPromptService.more.test.js
// --- FILE START ---
import PlayerPromptService from '../../../src/turns/services/playerPromptService.js';
import {PromptError} from '../../../src/errors/promptError.js';
import {PLAYER_TURN_SUBMITTED_ID} from '../../../src/constants/eventIds.js';
import Entity from '../../../src/entities/entity.js';
import {jest, describe, it, expect, beforeEach, afterEach} from '@jest/globals';

// Mock factory functions
const createMockLogger = () => ({
    info: jest.fn(), warn: jest.fn(), error: jest.fn(), debug: jest.fn(),
});
const createMockActionDiscoverySystem = () => ({getValidActions: jest.fn()});
const createMockPromptOutputPort = () => ({prompt: jest.fn()});
const createMockWorldContext = () => ({getLocationOfEntity: jest.fn()});
const createMockEntityManager = () => ({getEntityInstance: jest.fn()});
const createMockGameDataRepository = () => ({getActionDefinition: jest.fn()});
const createMockValidatedEventDispatcher = () => ({
    subscribe: jest.fn(), unsubscribe: jest.fn(),
});

// Helper to allow microtasks to process
const tick = (count = 1) => {
    let p = Promise.resolve();
    for (let i = 0; i < count; i++) {
        p = p.then(() => new Promise(resolve => setTimeout(resolve, 0)));
    }
    return p;
};

describe('PlayerPromptService - Further Scenarios', () => {
    let service;
    let mockLogger;
    let mockActionDiscoverySystem;
    let mockPromptOutputPort;
    let mockWorldContext;
    let mockValidatedEventDispatcher;
    let mockEntityManager;
    let mockGameDataRepository;
    let validActor;
    let mockLocation;
    let defaultAction;
    let discoveredActions;

    beforeEach(() => {
        mockLogger = createMockLogger();
        mockActionDiscoverySystem = createMockActionDiscoverySystem();
        mockPromptOutputPort = createMockPromptOutputPort();
        mockWorldContext = createMockWorldContext();
        mockValidatedEventDispatcher = createMockValidatedEventDispatcher();
        mockEntityManager = createMockEntityManager();
        mockGameDataRepository = createMockGameDataRepository();

        service = new PlayerPromptService({
            logger: mockLogger,
            actionDiscoverySystem: mockActionDiscoverySystem,
            promptOutputPort: mockPromptOutputPort,
            worldContext: mockWorldContext,
            entityManager: mockEntityManager,
            gameDataRepository: mockGameDataRepository,
            validatedEventDispatcher: mockValidatedEventDispatcher,
        });

        validActor = new Entity('player:valid', 'player-template');
        mockLocation = new Entity('location:test', 'location-template');
        defaultAction = {id: 'action:default', name: 'Default Action', command: 'do default'};
        discoveredActions = [defaultAction, {id: 'action:other', name: 'Other', command: 'other'}];

        mockWorldContext.getLocationOfEntity.mockResolvedValue(mockLocation);
        mockActionDiscoverySystem.getValidActions.mockResolvedValue(discoveredActions);
        mockPromptOutputPort.prompt.mockResolvedValue(undefined); // Default successful prompt
        mockValidatedEventDispatcher.subscribe.mockReturnValue(jest.fn());
    });

    afterEach(() => {
        jest.clearAllMocks();
    });

    describe('Cancellation Signal Timing', () => {
        it('should throw AbortError if signal aborts after location fetch but before action discovery', async () => {
            const abortController = new AbortController();
            const options = {cancellationSignal: abortController.signal};

            let originalGetLocation = mockWorldContext.getLocationOfEntity;
            mockWorldContext.getLocationOfEntity = jest.fn(async (...args) => {
                const result = await originalGetLocation(...args);
                abortController.abort();
                return result;
            });


            const promptPromise = service.prompt(validActor, options);

            try {
                await promptPromise;
                throw new Error('Test failed: Promise was expected to reject but it resolved.');
            } catch (e) {
                expect(e).toBeInstanceOf(DOMException);
                expect(e.name).toBe('AbortError');
                expect(e.message).toBe('Prompt aborted by signal during location fetch.');
            }
            expect(mockActionDiscoverySystem.getValidActions).not.toHaveBeenCalled();
        });

        it('should throw AbortError if signal aborts after action discovery but before output port prompt', async () => {
            const abortController = new AbortController();
            const options = {cancellationSignal: abortController.signal};

            let originalGetValidActions = mockActionDiscoverySystem.getValidActions;
            mockActionDiscoverySystem.getValidActions = jest.fn(async (...args) => {
                const result = await originalGetValidActions(...args);
                abortController.abort();
                return result;
            });


            const promptPromise = service.prompt(validActor, options);

            try {
                await promptPromise;
                throw new Error('Test failed: Promise was expected to reject but it resolved.');
            } catch (e) {
                expect(e).toBeInstanceOf(DOMException);
                expect(e.name).toBe('AbortError');
                // This message comes from _fetchContextAndDiscoverActions
                // expect(e.message).toBe('Prompt aborted by signal after action discovery.');
                // If the abort happens and is caught by the check in prompt() itself, the message is:
                expect(e.message).toMatch(/Prompt aborted by signal after (action discovery|context\/action fetch)\./);


            }
            expect(mockPromptOutputPort.prompt).not.toHaveBeenCalled();
        });
    });

    describe('actionDiscoverySystem.getValidActions Failures', () => {
        const discoveryError = new Error('Discovery Failed');
        const discoveryPromptError = new PromptError('Discovery PromptError', discoveryError, 'DISCOVERY_SPECIFIC_ERROR');
        const discoveryAbortError = new DOMException('Discovery Aborted', 'AbortError');

        const testCases = [
            {
                name: 'Error',
                error: discoveryError,
                expectedCause: discoveryError,
                rethrows: false,
                errorCode: "ACTION_DISCOVERY_FAILED"
            },
            {name: 'PromptError', error: discoveryPromptError, expectedCause: discoveryPromptError, rethrows: true},
            {
                name: 'DOMException (AbortError)',
                error: discoveryAbortError,
                expectedCause: discoveryAbortError,
                rethrows: true
            },
        ];

        testCases.forEach(({name, error, expectedCause, rethrows, errorCode}) => {
            it(`should correctly handle and log ${name} from getValidActions`, async () => {
                mockActionDiscoverySystem.getValidActions.mockRejectedValue(error);

                const promptPromise = service.prompt(validActor);

                if (rethrows) {
                    await expect(promptPromise).rejects.toThrow(error);
                } else {
                    await expect(promptPromise).rejects.toThrow(PromptError);
                    await expect(promptPromise).rejects.toMatchObject({
                        message: `Action discovery failed for actor ${validActor.id}. Details: ${error.message}`,
                        cause: expectedCause,
                        code: errorCode
                    });
                }

                expect(mockLogger.error).toHaveBeenCalledWith(
                    `PlayerPromptService._fetchContextAndDiscoverActions: Action discovery failed for actor ${validActor.id}.`,
                    error
                );

                const promptCatchLogCall = mockLogger.error.mock.calls.find(
                    call => call[0] === `PlayerPromptService.prompt: Error during _fetchContextAndDiscoverActions for actor ${validActor.id}. Propagating error.`
                );
                expect(promptCatchLogCall).toBeDefined();

                if (promptCatchLogCall) {
                    const loggedErrorInPromptCatch = promptCatchLogCall[1];
                    if (rethrows) {
                        expect(loggedErrorInPromptCatch).toBe(error);
                    } else {
                        expect(loggedErrorInPromptCatch).toBeInstanceOf(PromptError);
                        expect(loggedErrorInPromptCatch.cause).toBe(error);
                        expect(loggedErrorInPromptCatch.message).toBe(`Action discovery failed for actor ${validActor.id}. Details: ${error.message}`);
                        expect(loggedErrorInPromptCatch.code).toBe(errorCode);
                    }
                }
                expect(mockPromptOutputPort.prompt).not.toHaveBeenCalled();
            });
        });
    });


    describe('promptOutputPort.prompt (Main Dispatch) Failures', () => {
        const portDispatchError = new Error('Port Dispatch Failed');
        const portDispatchPromptError = new PromptError('Port Dispatch PromptError', portDispatchError, 'PORT_ERROR');
        const portDispatchAbortError = new DOMException('Port Dispatch Aborted', 'AbortError');

        const errorDefinitions = [
            {
                name: 'Generic Error',
                error: portDispatchError,
                expectedType: PromptError,
                rethrows: false, // The helper wraps it
                needsMessageCheck: true,
                errorCode: "OUTPUT_PORT_DISPATCH_FAILED" // UPDATED errorCode for the wrapped error
            },
            {
                name: 'PromptError',
                error: portDispatchPromptError,
                expectedType: PromptError,
                rethrows: true, // The helper re-throws it
                needsMessageCheck: false
            },
            {
                name: 'AbortError',
                error: portDispatchAbortError,
                expectedType: DOMException, // AbortError is a DOMException
                rethrows: true, // The helper re-throws it
                needsMessageCheck: false
            },
        ];

        errorDefinitions.forEach(({name, error, expectedType, rethrows, needsMessageCheck, errorCode}) => {
            it(`should handle ${name} from main promptOutputPort.prompt call`, async () => {
                // Log message from the prompt() method's catch block
                const logMessageFromPromptMethod = `PlayerPromptService.prompt: Error during prompt dispatch for actor ${validActor.id} (via _dispatchPromptToOutputPort). Propagating error.`;
                // Log message from the _dispatchPromptToOutputPort() method's catch block
                const logMessageFromHelperMethod = `PlayerPromptService._dispatchPromptToOutputPort: Failed to dispatch prompt via output port for actor ${validActor.id}.`;

                // Determine the error object that prompt() method's catch block will receive and log
                let errorReceivedAndLoggedByPromptMethod;
                let specificExpectedErrorMessageForMatcher; // For the .toMatchObject check

                if (name === 'Generic Error') {
                    specificExpectedErrorMessageForMatcher = `Failed to dispatch prompt via output port for actor ${validActor.id}. Details: ${error.message}`;
                    errorReceivedAndLoggedByPromptMethod = expect.objectContaining({
                        message: specificExpectedErrorMessageForMatcher,
                        cause: error, // The original error
                        code: errorCode // This is "OUTPUT_PORT_DISPATCH_FAILED"
                    });
                } else { // PromptError or AbortError are re-thrown as is by the helper
                    errorReceivedAndLoggedByPromptMethod = error;
                    specificExpectedErrorMessageForMatcher = error.message; // Not strictly needed for toThrow(error) but good for consistency
                }

                mockActionDiscoverySystem.getValidActions.mockResolvedValue(discoveredActions);

                // Mock the call that happens INSIDE _dispatchPromptToOutputPort, called with (actorId, actions)
                mockPromptOutputPort.prompt.mockImplementation(async (actorIdParam, actionsParam, errorMessageParam) => {
                    // We are testing the case where actions are being sent, not an error message.
                    if (actorIdParam === validActor.id && actionsParam === discoveredActions && errorMessageParam === undefined) {
                        throw error; // Simulate the output port itself throwing the specified 'error'
                    }
                    // If it's called with (actorId, [], errorMsg), that's a different path for _dispatchPromptToOutputPort
                    return undefined;
                });

                const promptPromise = service.prompt(validActor);

                // 1. Check overall promise rejection type
                await expect(promptPromise).rejects.toThrow(expectedType);

                // 2. Check specific error instance or properties
                if (rethrows) { // For PromptError and AbortError, which are re-thrown as is by helper
                    await expect(promptPromise).rejects.toThrow(error);
                } else if (needsMessageCheck && name === 'Generic Error') { // For Generic Error that gets wrapped by helper
                    await expect(promptPromise).rejects.toMatchObject({
                        message: specificExpectedErrorMessageForMatcher,
                        cause: error, // Original error as cause
                        code: errorCode // The code from the wrapper: OUTPUT_PORT_DISPATCH_FAILED
                    });
                }

                // 3. Check logger calls
                //    A. Log from _dispatchPromptToOutputPort (logs the original error from the port)
                expect(mockLogger.error).toHaveBeenCalledWith(
                    logMessageFromHelperMethod,
                    error // The original error that mockPromptOutputPort.prompt threw
                );

                //    B. Log from prompt() method's catch block (logs the error it received from the helper)
                expect(mockLogger.error).toHaveBeenCalledWith(
                    logMessageFromPromptMethod,
                    errorReceivedAndLoggedByPromptMethod // This is what prompt()'s catch block receives and logs
                );

                // 4. Ensure promptOutputPort.prompt was called correctly before it threw
                expect(mockPromptOutputPort.prompt).toHaveBeenCalledWith(validActor.id, discoveredActions);

                // 5. If promptOutputPort.prompt fails, subscription should not happen
                expect(mockValidatedEventDispatcher.subscribe).not.toHaveBeenCalled();
            });
        });
    });

    describe('Event Subscription Failures', () => {
        it('should reject with PromptError if validatedEventDispatcher.subscribe throws', async () => {
            const subscriptionError = new Error("Subscription System Error");
            mockValidatedEventDispatcher.subscribe.mockImplementation(() => {
                throw subscriptionError;
            });

            const promptPromise = service.prompt(validActor);
            await expect(promptPromise).rejects.toThrow(PromptError);
            await expect(promptPromise).rejects.toMatchObject({
                message: `Failed to subscribe to player input event for actor ${validActor.id}.`,
                code: "SUBSCRIPTION_ERROR",
                cause: subscriptionError
            });
        });

        it('should reject with PromptError if subscribe does not return an unsubscribe function', async () => {
            mockValidatedEventDispatcher.subscribe.mockReturnValue(null);

            const promptPromise = service.prompt(validActor);
            await expect(promptPromise).rejects.toThrow(PromptError);
            await expect(promptPromise).rejects.toMatchObject({
                message: `Failed to subscribe to player input event for actor ${validActor.id}: No unsubscribe function returned.`,
                code: "SUBSCRIPTION_FAILED"
            });
        });
    });

    describe('handlePlayerTurnSubmitted Edge Cases', () => {
        let capturedEventHandler;
        let mockUnsubscribeFn;

        beforeEach(() => {
            mockUnsubscribeFn = jest.fn();
            mockValidatedEventDispatcher.subscribe.mockImplementation((eventName, handler) => {
                if (eventName === PLAYER_TURN_SUBMITTED_ID) {
                    capturedEventHandler = handler;
                }
                return mockUnsubscribeFn;
            });
        });

        it('should ignore event if submittedByActorId is for a different actor', async () => {
            const promptPromise = service.prompt(validActor);
            await tick(); // Allow prompt setup and subscription

            expect(capturedEventHandler).toBeDefined();
            capturedEventHandler({
                type: PLAYER_TURN_SUBMITTED_ID,
                payload: {submittedByActorId: 'actor:other', actionId: defaultAction.id, speech: null}
            });
            await tick(); // Allow event handler to process

            expect(mockLogger.debug).toHaveBeenCalledWith(`PlayerPromptService._handlePlayerTurnSubmittedEvent: Received ${PLAYER_TURN_SUBMITTED_ID} for actor actor:other, but this prompt is for ${validActor.id}. Ignoring.`);
            // The prompt should not resolve or reject based on this ignored event.
            // To end the test, we cancel it.
            service.cancelCurrentPrompt();
            await expect(promptPromise).rejects.toThrow(PromptError); // Expect cancellation
        });

        it('should ignore event if prompt is already settled (e.g., by abort)', async () => {
            const abortController = new AbortController();
            const promptPromise = service.prompt(validActor, {cancellationSignal: abortController.signal});
            await tick(); // Allow prompt setup and subscription
            expect(capturedEventHandler).toBeDefined();

            abortController.abort(); // Abort the prompt
            try {
                await promptPromise; // Wait for the abort to propagate
            } catch (e) {
                expect(e.name).toBe('AbortError'); // Verify it aborted
            }
            await tick(); // Ensure abort handling microtasks are done

            const testEvent = {
                type: PLAYER_TURN_SUBMITTED_ID,
                payload: {submittedByActorId: validActor.id, actionId: defaultAction.id, speech: null}
            };
            capturedEventHandler(testEvent); // Dispatch event after prompt is settled
            await tick(); // Allow event handler to process

            expect(mockLogger.debug).toHaveBeenCalledWith(`PlayerPromptService._handlePlayerTurnSubmittedEvent: Listener for ${validActor.id} (event ${testEvent.type}) received event but prompt already settled. Ignoring.`);
        });

        it('should proceed if submittedByActorId is missing in payload', async () => {
            const promptPromise = service.prompt(validActor);
            await tick();
            expect(capturedEventHandler).toBeDefined();

            capturedEventHandler({
                type: PLAYER_TURN_SUBMITTED_ID,
                payload: {actionId: defaultAction.id, speech: "Hello"}
            });

            await expect(promptPromise).resolves.toEqual({action: defaultAction, speech: "Hello"});
            expect(mockLogger.debug).toHaveBeenCalledWith(`PlayerPromptService._handlePlayerTurnSubmittedEvent: ${PLAYER_TURN_SUBMITTED_ID} event did not contain 'submittedByActorId'. Proceeding based on this prompt's actor: ${validActor.id}.`);
            expect(mockUnsubscribeFn).toHaveBeenCalled();
        });

        it('should log warning and proceed if discoveredActions contains malformed items (but submitted action is valid)', async () => {
            const malformedAction = {name: "Malformed", command: "bad"}; // Missing ID
            const validDiscoveredAction = {id: 'validAction123', name: 'Valid Action', command: 'do valid'};
            mockActionDiscoverySystem.getValidActions.mockResolvedValue([malformedAction, validDiscoveredAction]);

            const promptPromise = service.prompt(validActor);
            await tick();
            expect(capturedEventHandler).toBeDefined();

            capturedEventHandler({
                type: PLAYER_TURN_SUBMITTED_ID,
                payload: {actionId: validDiscoveredAction.id, speech: null}
            });

            await expect(promptPromise).resolves.toEqual({action: validDiscoveredAction, speech: null});
            expect(mockLogger.warn).toHaveBeenCalledWith(
                `PlayerPromptService._handlePlayerTurnSubmittedEvent: Malformed item in discoveredActions for prompt (actor ${validActor.id}). Item:`,
                malformedAction
            );
            expect(mockUnsubscribeFn).toHaveBeenCalled();
        });

        it('should reject if submitted actionId matches a malformed item (even if other items are valid)', async () => {
            const discoverableButMalformed = {id: 123, name: "Numeric ID", command: "num"}; // ID is not a string
            const validDiscoveredAction = {id: 'validAction123', name: 'Valid Action', command: 'do valid'};
            mockActionDiscoverySystem.getValidActions.mockResolvedValue([discoverableButMalformed, validDiscoveredAction]);

            const promptPromise = service.prompt(validActor);
            await tick();
            expect(capturedEventHandler).toBeDefined();

            // Event submits '123' which is the ID of the malformed action.
            // The code's .find(da => da.id === submittedActionId) will fail if da.id is not a string,
            // or if the submittedActionId (string '123') doesn't match the numeric 123.
            // The crucial part is that `selectedAction` will be falsy or point to the malformed action.
            // If `da.id` is not a string, the `this.#logger.warn` for malformed item logs `da` itself.
            // If `selectedAction` is not found because `da.id` (e.g. number) !== `submittedActionId` (string),
            // it rejects with INVALID_ACTION_ID.
            // The current code warns for any malformed item during the `find` iteration, then if selectedAction is not found, it rejects.

            capturedEventHandler({
                type: PLAYER_TURN_SUBMITTED_ID,
                payload: {actionId: '123', speech: null} // Submitted as string '123'
            });

            await expect(promptPromise).rejects.toMatchObject({
                name: 'PromptError',
                code: 'INVALID_ACTION_ID',
                message: `Invalid actionId '123' submitted by actor ${validActor.id}. Action not available.`
            });
            // This warning is for the malformed item found during the iteration.
            expect(mockLogger.warn).toHaveBeenCalledWith(
                `PlayerPromptService._handlePlayerTurnSubmittedEvent: Malformed item in discoveredActions for prompt (actor ${validActor.id}). Item:`,
                discoverableButMalformed // The da object itself
            );
            expect(mockUnsubscribeFn).toHaveBeenCalled();
        });

        it('should log warning but resolve if selected action is missing a name', async () => {
            const actionWithoutName = {id: 'action:no-name', command: 'do no name'}; // Missing 'name'
            mockActionDiscoverySystem.getValidActions.mockResolvedValue([actionWithoutName]);

            const promptPromise = service.prompt(validActor);
            await tick();
            expect(capturedEventHandler).toBeDefined();

            capturedEventHandler({
                type: PLAYER_TURN_SUBMITTED_ID,
                payload: {actionId: 'action:no-name', speech: "Test Speech"}
            });

            await expect(promptPromise).resolves.toEqual({action: actionWithoutName, speech: "Test Speech"});
            expect(mockLogger.warn).toHaveBeenCalledWith(
                `PlayerPromptService._handlePlayerTurnSubmittedEvent: Action 'action:no-name' found for prompt (actor ${validActor.id}), but missing 'name'. Action:`,
                actionWithoutName
            );
            expect(mockUnsubscribeFn).toHaveBeenCalled();
        });
    });

    describe('cancelCurrentPrompt Method', () => {
        it('should log "no active prompt" if called when no prompt is active', () => {
            service.cancelCurrentPrompt();
            expect(mockLogger.info).toHaveBeenCalledWith("PlayerPromptService: cancelCurrentPrompt called.");
            expect(mockLogger.debug).toHaveBeenCalledWith("PlayerPromptService: cancelCurrentPrompt called, but no active prompt to cancel.");
        });

        it('should reject active prompt with PROMPT_CANCELLED if it has no signal', async () => {
            const promptPromise = service.prompt(validActor);
            await tick(); // Ensure prompt is set up

            service.cancelCurrentPrompt();
            await expect(promptPromise).rejects.toMatchObject({
                name: 'PromptError',
                code: 'PROMPT_CANCELLED',
                message: 'Current player prompt was explicitly cancelled by external request.'
            });
            expect(mockLogger.info).toHaveBeenCalledWith("PlayerPromptService: cancelCurrentPrompt called.");
        });

        it('should reject active prompt with PROMPT_CANCELLED if its signal is not aborted', async () => {
            const abortController = new AbortController();
            const promptPromise = service.prompt(validActor, {cancellationSignal: abortController.signal});
            await tick(); // Ensure prompt is set up

            service.cancelCurrentPrompt();
            await expect(promptPromise).rejects.toMatchObject({
                name: 'PromptError',
                code: 'PROMPT_CANCELLED',
                message: 'Current player prompt was explicitly cancelled by external request.'
            });
        });

        it('should reject active prompt with AbortError if its signal was already aborted, and log correctly', async () => {
            const abortController = new AbortController();
            const promptPromise = service.prompt(validActor, {cancellationSignal: abortController.signal});
            await tick(); // Let prompt setup, including signal listener

            abortController.abort(); // Abort the signal

            // Wait for the promise to settle due to the abort
            try {
                await promptPromise;
            } catch (e) {
                expect(e.name).toBe('AbortError');
                // The message comes from the signal listener in the prompt method's Promise
                expect(e.message).toBe('Prompt aborted by signal.');
            }
            await tick(); // Allow microtasks related to promise rejection and cleanup to complete

            // Now, call cancelCurrentPrompt AFTER the prompt has already been aborted by its own signal
            service.cancelCurrentPrompt();
            await tick();


            expect(mockLogger.info).toHaveBeenCalledWith("PlayerPromptService: cancelCurrentPrompt called.");

            // After the prompt's own abort handler (via signal listener) has run,
            // it calls cleanupAndReject, which should nullify `this.#currentPromptContext`.
            // Therefore, when `cancelCurrentPrompt` is called subsequently, it should find no active prompt.
            const debugCalls = mockLogger.debug.mock.calls;
            const lastCancelDebugLog = debugCalls.find(call => call[0].startsWith("PlayerPromptService: cancelCurrentPrompt called, but no active prompt"));

            expect(lastCancelDebugLog).toBeDefined();
            expect(lastCancelDebugLog[0]).toBe("PlayerPromptService: cancelCurrentPrompt called, but no active prompt to cancel.");
        });
    });
});
// --- FILE END ---