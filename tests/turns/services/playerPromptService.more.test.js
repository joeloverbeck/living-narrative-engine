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
        mockPromptOutputPort.prompt.mockResolvedValue(undefined);
        mockValidatedEventDispatcher.subscribe.mockReturnValue(jest.fn());
    });

    afterEach(() => {
        jest.clearAllMocks();
    });

    describe('Cancellation Signal Timing', () => {
        it('should throw AbortError if signal aborts after location fetch but before action discovery', async () => {
            const abortController = new AbortController();
            const options = {cancellationSignal: abortController.signal};

            mockWorldContext.getLocationOfEntity.mockImplementation(async () => {
                await tick();
                abortController.abort();
                return mockLocation;
            });

            const promptPromise = service.prompt(validActor, options);

            try {
                await promptPromise;
                throw new Error('Test failed: Promise was expected to reject but it resolved.');
            } catch (e) {
                expect(e).toBeInstanceOf(DOMException);
                expect(e.name).toBe('AbortError');
                expect(e.message).toBe('Prompt aborted by signal during setup.');
            }
            expect(mockActionDiscoverySystem.getValidActions).not.toHaveBeenCalled();
        });

        it('should throw AbortError if signal aborts after action discovery but before output port prompt', async () => {
            const abortController = new AbortController();
            const options = {cancellationSignal: abortController.signal};

            mockActionDiscoverySystem.getValidActions.mockImplementation(async () => {
                await tick();
                abortController.abort();
                return discoveredActions;
            });

            const promptPromise = service.prompt(validActor, options);

            try {
                await promptPromise;
                throw new Error('Test failed: Promise was expected to reject but it resolved.');
            } catch (e) {
                expect(e).toBeInstanceOf(DOMException);
                expect(e.name).toBe('AbortError');
                expect(e.message).toBe('Prompt aborted by signal after action discovery.');
            }
            expect(mockPromptOutputPort.prompt).not.toHaveBeenCalledWith(validActor.id, discoveredActions);
        });
    });

    describe('actionDiscoverySystem.getValidActions Failures', () => {
        const discoveryError = new Error('Discovery Failed');
        const discoveryPromptError = new PromptError('Discovery PromptError', discoveryError, 'DISCOVERY_SPECIFIC_ERROR');
        const discoveryAbortError = new DOMException('Discovery Aborted', 'AbortError');

        const testCases = [
            {error: discoveryError, expectedCause: discoveryError, rethrows: false},
            {error: discoveryPromptError, expectedCause: discoveryPromptError, rethrows: true},
            {error: discoveryAbortError, expectedCause: discoveryAbortError, rethrows: true},
        ];

        testCases.forEach(({error, expectedCause, rethrows}) => {
            it(`should handle ${error.constructor.name} from getValidActions and attempt to inform UI`, async () => {
                mockActionDiscoverySystem.getValidActions.mockRejectedValue(error);
                const errorPromptSpy = jest.fn().mockResolvedValue(undefined);
                mockPromptOutputPort.prompt.mockImplementation(async (actorId, actions, message) => {
                    if (actions && actions.length === 0 && message) {
                        return errorPromptSpy(actorId, actions, message);
                    }
                    return Promise.resolve();
                });

                const promptPromise = service.prompt(validActor);

                await expect(promptPromise).rejects.toThrow(rethrows ? expectedCause : PromptError);
                if (!rethrows) {
                    await expect(promptPromise).rejects.toMatchObject({
                        message: `Action discovery failed for actor ${validActor.id}`,
                        cause: expectedCause
                    });
                }

                expect(mockLogger.error).toHaveBeenCalledWith(
                    `PlayerPromptService: Action discovery failed for actor ${validActor.id}.`,
                    error
                );
                expect(errorPromptSpy).toHaveBeenCalledWith(
                    validActor.id,
                    [],
                    error.message
                );
                expect(errorPromptSpy).toHaveBeenCalledTimes(1);
            });

            it(`should handle ${error.constructor.name} from getValidActions and also log if UI notification fails`, async () => {
                mockActionDiscoverySystem.getValidActions.mockRejectedValue(error);
                const portError = new Error("UI Notification Port Error");
                const errorPromptSpy = jest.fn().mockRejectedValue(portError);
                mockPromptOutputPort.prompt.mockImplementation(async (actorId, actions, message) => {
                    if (actions && actions.length === 0 && message) {
                        return errorPromptSpy(actorId, actions, message);
                    }
                    return Promise.resolve();
                });

                const promptPromise = service.prompt(validActor);

                await expect(promptPromise).rejects.toThrow(rethrows ? expectedCause : PromptError);
                if (!rethrows) {
                    await expect(promptPromise).rejects.toMatchObject({
                        message: `Action discovery failed for actor ${validActor.id}`,
                        cause: expectedCause
                    });
                }

                expect(mockLogger.error).toHaveBeenCalledWith(
                    `PlayerPromptService: Action discovery failed for actor ${validActor.id}.`,
                    error
                );
                expect(errorPromptSpy).toHaveBeenCalledWith(
                    validActor.id, [], error.message
                );
                expect(mockLogger.error).toHaveBeenCalledWith(
                    `PlayerPromptService: Failed to send error prompt via output port for actor ${validActor.id} after discovery failure. Port error:`,
                    portError
                );
                expect(errorPromptSpy).toHaveBeenCalledTimes(1);
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
                rethrows: false,
                needsMessageCheck: true
            },
            {
                name: 'PromptError',
                error: portDispatchPromptError,
                expectedType: PromptError,
                rethrows: true,
                needsMessageCheck: false
            },
            {
                name: 'AbortError',
                error: portDispatchAbortError,
                expectedType: DOMException,
                rethrows: true,
                needsMessageCheck: false
            },
        ];

        errorDefinitions.forEach(({name, error, expectedType, rethrows, needsMessageCheck}) => {
            it(`should handle ${name} from main promptOutputPort.prompt call`, async () => {
                const expectedMessage = needsMessageCheck ? `Failed to dispatch prompt via output port for actor ${validActor.id}` : undefined;
                mockActionDiscoverySystem.getValidActions.mockResolvedValue(discoveredActions);

                mockPromptOutputPort.prompt.mockImplementation(async (actorIdParam, actionsParam) => {
                    if (actorIdParam === validActor.id && actionsParam === discoveredActions) {
                        throw error;
                    }
                    return undefined;
                });

                const promptPromise = service.prompt(validActor);

                await expect(promptPromise).rejects.toThrow(expectedType);
                if (rethrows) {
                    await expect(promptPromise).rejects.toThrow(error);
                } else if (needsMessageCheck && expectedMessage) {
                    await expect(promptPromise).rejects.toMatchObject({
                        message: expectedMessage,
                        cause: error
                    });
                }

                expect(mockLogger.error).toHaveBeenCalledWith(
                    `PlayerPromptService: Failed to dispatch prompt via output port for actor ${validActor.id}.`,
                    error
                );
                expect(mockPromptOutputPort.prompt).toHaveBeenCalledWith(validActor.id, discoveredActions);
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
            await tick();

            expect(capturedEventHandler).toBeDefined();
            capturedEventHandler({
                type: PLAYER_TURN_SUBMITTED_ID,
                payload: {submittedByActorId: 'actor:other', actionId: defaultAction.id, speech: null}
            });

            expect(mockLogger.debug).toHaveBeenCalledWith(expect.stringContaining(`Received PLAYER_TURN_SUBMITTED_ID for actor actor:other, but this prompt is for ${validActor.id}. Ignoring.`));
            service.cancelCurrentPrompt();
            await expect(promptPromise).rejects.toThrow(PromptError);
        });

        it('should ignore event if prompt is already settled (e.g., by abort)', async () => {
            const abortController = new AbortController();
            const promptPromise = service.prompt(validActor, {cancellationSignal: abortController.signal});
            await tick();
            expect(capturedEventHandler).toBeDefined();

            abortController.abort();
            try {
                await promptPromise;
            } catch (e) {
                expect(e.name).toBe('AbortError');
            }
            await tick();

            capturedEventHandler({
                type: PLAYER_TURN_SUBMITTED_ID,
                payload: {submittedByActorId: validActor.id, actionId: defaultAction.id, speech: null}
            });
            expect(mockLogger.debug).toHaveBeenCalledWith(expect.stringContaining(`Listener for ${validActor.id} received event but prompt already settled. Ignoring.`));
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
            expect(mockLogger.debug).toHaveBeenCalledWith(expect.stringContaining(`PLAYER_TURN_SUBMITTED_ID event did not contain 'submittedByActorId'. Proceeding based on this prompt's actor: ${validActor.id}.`));
            expect(mockUnsubscribeFn).toHaveBeenCalled();
        });

        it('should log warning and proceed if discoveredActions contains malformed items (but submitted action is valid)', async () => {
            const malformedAction = {name: "Malformed", command: "bad"}; // Missing id
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
                expect.stringContaining(`PlayerPromptService: Malformed item in discoveredActions for current prompt (actor ${validActor.id}). Item:`),
                malformedAction
            );
            expect(mockUnsubscribeFn).toHaveBeenCalled();
        });

        it('should reject if submitted actionId matches a malformed item (even if other items are valid)', async () => {
            const discoverableButMalformed = {id: 123, name: "Numeric ID", command: "num"}; // Non-string ID
            const validDiscoveredAction = {id: 'validAction123', name: 'Valid Action', command: 'do valid'};
            mockActionDiscoverySystem.getValidActions.mockResolvedValue([discoverableButMalformed, validDiscoveredAction]);

            const promptPromise = service.prompt(validActor);
            await tick();
            expect(capturedEventHandler).toBeDefined();

            capturedEventHandler({
                type: PLAYER_TURN_SUBMITTED_ID,
                payload: {actionId: '123', speech: null}
            });

            await expect(promptPromise).rejects.toMatchObject({
                name: 'PromptError',
                code: 'INVALID_ACTION_ID',
                message: `Invalid actionId '123' submitted by actor ${validActor.id}. Action not available.`
            });
            expect(mockLogger.warn).toHaveBeenCalledWith(
                expect.stringContaining(`PlayerPromptService: Malformed item in discoveredActions for current prompt (actor ${validActor.id}). Item:`),
                discoverableButMalformed
            );
            expect(mockUnsubscribeFn).toHaveBeenCalled();
        });

        it('should log warning but resolve if selected action is missing a name', async () => {
            const actionWithoutName = {id: 'action:no-name', command: 'do no name'};
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
                expect.stringContaining(`PlayerPromptService: Action 'action:no-name' found for current prompt (actor ${validActor.id}), but missing 'name'. Action:`),
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
            await tick();

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
            await tick();

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
            await tick(); // Let prompt set up

            abortController.abort(); // Abort the signal externally

            // Wait for the internal abort handler of the prompt to run and reject the promise
            try {
                await promptPromise;
            } catch (e) {
                expect(e.name).toBe('AbortError'); // Original rejection by the prompt itself
                expect(e.message).toBe('Prompt aborted by signal.');
            }
            await tick(); // Ensure all internal state changes from the abort are complete (like nulling #currentPromptContext)

            // Now, call cancelCurrentPrompt. Since #currentPromptContext should be null,
            // it should log that no active prompt is found.
            service.cancelCurrentPrompt();
            await tick();

            expect(mockLogger.info).toHaveBeenCalledWith("PlayerPromptService: cancelCurrentPrompt called.");
            expect(mockLogger.debug).toHaveBeenCalledWith("PlayerPromptService: cancelCurrentPrompt called, but no active prompt to cancel.");
        });
    });
});
// --- FILE END ---