// src/tests/core/services/playerPromptService.test.js
// --- FILE START ---

import PlayerPromptService from '../../../core/turns/services/playerPromptService.js';
import {afterEach, beforeEach, describe, expect, it, jest} from "@jest/globals";
import Entity from "../../../entities/entity.js";
import {PromptError} from '../../../core/errors/promptError.js';

const createMockLogger = () => ({
    info: jest.fn(), warn: jest.fn(), error: jest.fn(), debug: jest.fn(),
});
const createMockActionDiscoverySystem = () => ({getValidActions: jest.fn()});
const createMockPromptOutputPort = () => ({prompt: jest.fn()});
const createMockWorldContext = () => ({getLocationOfEntity: jest.fn()});
const createMockEntityManager = () => ({getEntityInstance: jest.fn()});
const createMockGameDataRepository = () => ({getActionDefinition: jest.fn()});
const createMockValidatedEventDispatcher = () => ({
    subscribe: jest.fn(), unsubscribe: jest.fn(), dispatchValidated: jest.fn(),
});

let mockLogger, mockActionDiscoverySystem, mockPromptOutputPort, mockWorldContext,
    mockEntityManager, mockGameDataRepository, mockValidatedEventDispatcher,
    validDependencies, service, mockActor;

const PROMPT_TIMEOUT_DURATION = 60000;
const SUBMITTED_EVENT_TYPE = 'core:player_turn_submitted';


beforeEach(() => {
    mockLogger = createMockLogger();
    mockActionDiscoverySystem = createMockActionDiscoverySystem();
    mockPromptOutputPort = createMockPromptOutputPort();
    mockWorldContext = createMockWorldContext();
    mockEntityManager = createMockEntityManager();
    mockGameDataRepository = createMockGameDataRepository();
    mockValidatedEventDispatcher = createMockValidatedEventDispatcher();

    validDependencies = {
        logger: mockLogger, actionDiscoverySystem: mockActionDiscoverySystem,
        promptOutputPort: mockPromptOutputPort, worldContext: mockWorldContext,
        entityManager: mockEntityManager, gameDataRepository: mockGameDataRepository,
        validatedEventDispatcher: mockValidatedEventDispatcher,
    };
    service = new PlayerPromptService(validDependencies);
    mockActor = new Entity('player:test');
});

afterEach(() => {
    jest.clearAllMocks();
});

describe('PlayerPromptService Constructor', () => {
    it('should succeed when all valid dependencies are provided', () => {
        mockLogger.info.mockClear();
        const localService = new PlayerPromptService(validDependencies);
        expect(localService).toBeInstanceOf(PlayerPromptService);
        expect(mockLogger.info).toHaveBeenCalledWith('PlayerPromptService initialized successfully.');
        expect(mockLogger.info).toHaveBeenCalledTimes(1);
    });

    describe('ValidatedEventDispatcher Dependency Validation', () => {
        it('should throw if validatedEventDispatcher is missing', () => {
            const {validatedEventDispatcher: _, ...incompleteDeps} = validDependencies;
            expect(() => new PlayerPromptService(incompleteDeps)).toThrow(/Invalid or missing IValidatedEventDispatcher/);
        });
        it('should throw if validatedEventDispatcher lacks subscribe method', () => {
            const invalidDispatcher = {...mockValidatedEventDispatcher, subscribe: undefined};
            expect(() => new PlayerPromptService({
                ...validDependencies,
                validatedEventDispatcher: invalidDispatcher
            })).toThrow(/Invalid or missing IValidatedEventDispatcher/);
        });
        it('should throw if validatedEventDispatcher lacks unsubscribe method', () => {
            const invalidDispatcher = {...mockValidatedEventDispatcher, unsubscribe: undefined};
            expect(() => new PlayerPromptService({
                ...validDependencies,
                validatedEventDispatcher: invalidDispatcher
            })).toThrow(/Invalid or missing IValidatedEventDispatcher/);
        });
    });
});

describe('PlayerPromptService prompt Method', () => {
    it('should execute the happy path successfully, resolving with selected action and speech', async () => {
        const mockLocation = new Entity('location:test');
        // mockDiscoveredActions are DiscoveredActionInfo objects
        const lookDiscoveredAction = {action: {id: 'core:look', command: 'Look Around'}, isEnabled: true};
        const speakDiscoveredAction = {action: {id: 'core:speak', command: 'Speak Freely'}, isEnabled: true};

        const mockDiscoveredActions = [lookDiscoveredAction, speakDiscoveredAction];
        const chosenActionId = speakDiscoveredAction.action.id; // ID of the AvailableAction
        const chosenSpeech = "Hello there!";
        // Expected resolution should contain the AvailableAction, not DiscoveredActionInfo
        const expectedResolution = {action: speakDiscoveredAction.action, speech: chosenSpeech};

        mockWorldContext.getLocationOfEntity.mockResolvedValue(mockLocation);
        mockActionDiscoverySystem.getValidActions.mockResolvedValue(mockDiscoveredActions);
        mockPromptOutputPort.prompt.mockResolvedValue(undefined);

        const mockUnsubscribeFn = jest.fn();
        mockValidatedEventDispatcher.subscribe.mockReset();
        mockValidatedEventDispatcher.subscribe.mockImplementation((eventName, eventHandlerCallback) => {
            if (eventName === SUBMITTED_EVENT_TYPE) {
                // Simulate event dispatch after a microtask tick to allow promise setup
                Promise.resolve().then(() => {
                    // MODIFIED: Pass the full event object
                    eventHandlerCallback({
                        type: SUBMITTED_EVENT_TYPE,
                        payload: {actionId: chosenActionId, speech: chosenSpeech}
                    });
                });
            }
            return mockUnsubscribeFn;
        });

        const resultPromise = service.prompt(mockActor);
        await expect(resultPromise).resolves.toEqual(expectedResolution); // MODIFIED: expectedResolution
        expect(mockValidatedEventDispatcher.subscribe).toHaveBeenCalledWith(SUBMITTED_EVENT_TYPE, expect.any(Function));
        expect(mockUnsubscribeFn).toHaveBeenCalled();
    });

    describe('when action discovery fails', () => {
        const discoveryError = new Error('Discovery Boom!');
        const mockLocation = new Entity('location:test');
        beforeEach(() => {
            mockWorldContext.getLocationOfEntity.mockResolvedValue(mockLocation);
            mockActionDiscoverySystem.getValidActions.mockRejectedValue(discoveryError);
        });

        it('should still reject with the original discovery PromptError even if the error-path port call fails', async () => {
            const portError = new Error('Error path port Boom!');
            mockPromptOutputPort.prompt.mockRejectedValue(portError);
            mockLogger.error.mockClear();

            await expect(service.prompt(mockActor)).rejects.toMatchObject({
                message: `Action discovery failed for actor ${mockActor.id}`,
                cause: discoveryError,
            });

            expect(mockLogger.error).toHaveBeenCalledWith(
                `PlayerPromptService: Action discovery failed for actor ${mockActor.id}.`,
                discoveryError
            );
            expect(mockLogger.error).toHaveBeenCalledWith(
                `PlayerPromptService: Failed to send error prompt via output port for actor ${mockActor.id} after discovery failure. Port error:`,
                portError
            );
        });
    });

    describe('Player input promise handling', () => {
        let mockDiscoveredActionsList;
        let mockLocationInst;
        let mockUnsubscribeFnForSuite;

        beforeEach(() => {
            jest.useFakeTimers();
            mockLocationInst = new Entity('location:test-loc-promise');
            // These are DiscoveredActionInfo objects
            mockDiscoveredActionsList = [
                {action: {id: 'action1', command: 'do one'}, isEnabled: true},
                {action: {id: 'action2', command: 'do two'}, isEnabled: true}
            ];
            mockWorldContext.getLocationOfEntity.mockResolvedValue(mockLocationInst);
            mockActionDiscoverySystem.getValidActions.mockResolvedValue(mockDiscoveredActionsList);
            mockPromptOutputPort.prompt.mockResolvedValue(undefined);
            mockUnsubscribeFnForSuite = jest.fn();
            mockValidatedEventDispatcher.subscribe.mockReset(); // Reset before each test in this suite
            mockValidatedEventDispatcher.subscribe.mockReturnValue(mockUnsubscribeFnForSuite);
        });

        afterEach(() => {
            jest.useRealTimers();
            mockValidatedEventDispatcher.subscribe.mockReset(); // Ensure clean slate for other describe blocks
        });

        it('should reject with PromptError on timeout', (done) => {
            const promptPromise = service.prompt(mockActor);

            promptPromise.then(() => {
                done.fail(new Error('Promise should have rejected due to timeout, but it resolved.'));
            }).catch(error => {
                try {
                    expect(error).toMatchObject({
                        name: 'PromptError',
                        message: `Player prompt timed out for actor ${mockActor.id}.`,
                        code: "PROMPT_TIMEOUT"
                    });
                    expect(mockLogger.warn).toHaveBeenCalledWith(`PlayerPromptService: Prompt timed out for actor ${mockActor.id} after ${PROMPT_TIMEOUT_DURATION}ms.`);
                    expect(mockUnsubscribeFnForSuite).toHaveBeenCalled();
                    done();
                } catch (assertionError) {
                    done.fail(assertionError);
                }
            });

            const flushMicrotasks = async () => {
                for (let i = 0; i < 5; i++) {
                    await Promise.resolve();
                }
            };

            flushMicrotasks().then(() => {
                if (jest.getTimerCount() > 0) {
                    jest.runOnlyPendingTimers();
                }
            });
        });

        // Helper to capture the event handler callback from the subscribe mock
        const getCallbackAndPromise = async (actorForPrompt) => {
            let capturedCbArg;
            // Ensure the mock is fresh for this specific call if tests run in parallel or share state unexpectedly
            mockValidatedEventDispatcher.subscribe.mockImplementationOnce((evtName, cb) => {
                if (evtName === SUBMITTED_EVENT_TYPE) {
                    capturedCbArg = cb;
                }
                return mockUnsubscribeFnForSuite;
            });

            const promise = service.prompt(actorForPrompt);

            // Allow microtasks to process, ensuring the subscribe mock is called and cb captured
            for (let i = 0; i < 10; i++) { // Increased iterations for more robustness
                await Promise.resolve();
            }


            if (!capturedCbArg) {
                // Fallback: If still not captured, check the mock calls directly.
                // This is a bit of a workaround for potential Jest timing issues with async mocks.
                const calls = mockValidatedEventDispatcher.subscribe.mock.calls;
                if (calls.length > 0) {
                    const lastCall = calls[calls.length - 1];
                    if (lastCall[0] === SUBMITTED_EVENT_TYPE && typeof lastCall[1] === 'function') {
                        capturedCbArg = lastCall[1];
                    }
                }

                if (!capturedCbArg) {
                    // If the promise already settled (likely rejected), log it for diagnostics
                    try {
                        await promise; // Check if it resolved
                    } catch (e) {
                        console.error("Promise rejected during getCallbackAndPromise:", e);
                        throw new Error(`getCallbackAndPromise: service.prompt may have rejected before callback was captured. Error: ${e.message}. Check logs.`);
                    }
                    // If it resolved without capturing, that's also an issue.
                    throw new Error("getCallbackAndPromise: Event callback was not captured. Subscribe mock might not have been called as expected or callback not passed.");
                }
            }
            expect(capturedCbArg).toBeInstanceOf(Function);
            return {promptPromise: promise, capturedCallback: capturedCbArg};
        };


        it('should reject with PromptError if submitted actionId is invalid', async () => {
            const {promptPromise, capturedCallback} = await getCallbackAndPromise(mockActor);
            // MODIFIED: Pass the full event object
            capturedCallback({
                type: SUBMITTED_EVENT_TYPE,
                payload: {actionId: 'invalid-action-id', speech: null}
            });
            await expect(promptPromise).rejects.toMatchObject({
                name: 'PromptError',
                message: `Invalid actionId 'invalid-action-id' submitted by actor ${mockActor.id}. Action not available.`, // Updated message slightly to match service
                code: "INVALID_ACTION_ID"
            });
            expect(mockUnsubscribeFnForSuite).toHaveBeenCalled();
        });

        it('should clear timeout and unsubscribe when event is received', async () => {
            const {promptPromise, capturedCallback} = await getCallbackAndPromise(mockActor);
            const validDiscoveredAction = mockDiscoveredActionsList[0]; // This is a DiscoveredActionInfo
            const validAvailableAction = validDiscoveredAction.action;   // This is an AvailableAction

            // MODIFIED: Pass the full event object
            capturedCallback({
                type: SUBMITTED_EVENT_TYPE,
                payload: {actionId: validAvailableAction.id, speech: "test speech"}
            });

            // MODIFIED: Expect the AvailableAction, not DiscoveredActionInfo
            await expect(promptPromise).resolves.toEqual({action: validAvailableAction, speech: "test speech"});
            expect(mockUnsubscribeFnForSuite).toHaveBeenCalled();
        });

        it('should reject with PromptError if event object itself is malformed (e.g. not an object, or missing type/payload)', async () => {
            const {promptPromise, capturedCallback} = await getCallbackAndPromise(mockActor);
            // Pass a malformed event object (e.g., a raw payload, or an object missing 'type' or 'payload')
            capturedCallback({speech: "only speech", actionId: "some-action"}); // Missing type, payload wrapper

            await expect(promptPromise).rejects.toMatchObject({
                name: 'PromptError',
                message: `Malformed event object for '${SUBMITTED_EVENT_TYPE}' for actor ${mockActor.id}.`,
                code: "INVALID_EVENT_STRUCTURE" // MODIFIED: Expecting structure error
            });
            expect(mockUnsubscribeFnForSuite).toHaveBeenCalled();
        });

        // MODIFIED TEST: Using try/catch for more direct assertion of the error message
        it('should reject with PromptError if event.payload is missing actionId', async () => {
            const {promptPromise, capturedCallback} = await getCallbackAndPromise(mockActor);
            // Pass a correctly structured event object, but with a malformed inner payload
            capturedCallback({
                type: SUBMITTED_EVENT_TYPE,
                payload: {speech: "only speech, no actionId"} // actionId is missing here
            });

            try {
                await promptPromise;
                // If promise resolves, the test should fail
                throw new Error('Test failed because the promise was expected to reject but it resolved.');
            } catch (error) {
                expect(error).toBeInstanceOf(PromptError); // Ensure it's the correct error type
                expect(error.name).toBe('PromptError');
                expect(error.code).toBe('INVALID_PAYLOAD_CONTENT');
                const expectedMessage = `Invalid actionId in payload for '${SUBMITTED_EVENT_TYPE}' for actor ${mockActor.id}.`;
                expect(error.message).toBe(expectedMessage);
            }
            // Ensure cleanup function (unsubscribe) was called
            expect(mockUnsubscribeFnForSuite).toHaveBeenCalled();
        });
    });
});
// --- FILE END ---