// src/tests/core/services/playerPromptService.test.js
// --- FILE START ---

import PlayerPromptService from '../../../src/turns/services/playerPromptService.js'; // Adjusted path to match project structure
import {afterEach, beforeEach, describe, expect, it, jest} from "@jest/globals";
import Entity from "../../../src/entities/entity.js";
import {PromptError} from '../../../src/errors/promptError.js';
import {PLAYER_TURN_SUBMITTED_ID} from "../../../src/constants/eventIds.js";

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

// REMOVED: PROMPT_TIMEOUT_DURATION constant as timeout is removed.
// const PROMPT_TIMEOUT_DURATION = 60000;


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
    // Assuming PlayerPromptService is in 'core/services/' not 'core/turns/services/'
    // Corrected path based on typical project structure for services.
    // If 'core/turns/services/' is indeed correct, this should be reverted.
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
        const lookAction = {id: 'core:look', name: 'Look Around', command: 'Look Around'}; // Added name
        const speakAction = {id: 'core:speak', name: 'Speak Freely', command: 'Speak Freely'}; // Added name

        const mockDiscoveredActions = [lookAction, speakAction];
        const chosenActionId = speakAction.id;
        const chosenSpeech = "Hello there!";
        const expectedResolution = {action: speakAction, speech: chosenSpeech};

        mockWorldContext.getLocationOfEntity.mockResolvedValue(mockLocation);
        mockActionDiscoverySystem.getValidActions.mockResolvedValue(mockDiscoveredActions);
        mockPromptOutputPort.prompt.mockResolvedValue(undefined);

        const mockUnsubscribeFn = jest.fn();
        mockValidatedEventDispatcher.subscribe.mockReset();
        mockValidatedEventDispatcher.subscribe.mockImplementation((eventName, eventHandlerCallback) => {
            if (eventName === PLAYER_TURN_SUBMITTED_ID) {
                Promise.resolve().then(() => { // Simulate async event emission
                    eventHandlerCallback({
                        type: PLAYER_TURN_SUBMITTED_ID,
                        payload: {actionId: chosenActionId, speech: chosenSpeech}
                    });
                });
            }
            return mockUnsubscribeFn;
        });

        const resultPromise = service.prompt(mockActor);
        await expect(resultPromise).resolves.toEqual(expectedResolution);
        expect(mockValidatedEventDispatcher.subscribe).toHaveBeenCalledWith(PLAYER_TURN_SUBMITTED_ID, expect.any(Function));
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
            // REMOVED: jest.useFakeTimers() - no longer needed for timeout test
            mockLocationInst = new Entity('location:test-loc-promise');
            mockDiscoveredActionsList = [
                {id: 'action1', name: 'Action One', command: 'do one'}, // Added name
                {id: 'action2', name: 'Action Two', command: 'do two'}  // Added name
            ];
            mockWorldContext.getLocationOfEntity.mockResolvedValue(mockLocationInst);
            mockActionDiscoverySystem.getValidActions.mockResolvedValue(mockDiscoveredActionsList);
            mockPromptOutputPort.prompt.mockResolvedValue(undefined);
            mockUnsubscribeFnForSuite = jest.fn();
            mockValidatedEventDispatcher.subscribe.mockReset(); // Reset before each test in this block
            mockValidatedEventDispatcher.subscribe.mockReturnValue(mockUnsubscribeFnForSuite);
        });

        afterEach(() => {
            // REMOVED: jest.useRealTimers()
            mockValidatedEventDispatcher.subscribe.mockReset(); // Ensure clean state
        });

        // REMOVED: Test for 'should reject with PromptError on timeout'
        // as the timeout functionality has been removed from PlayerPromptService.

        const getCallbackAndPromise = async (actorForPrompt) => {
            let capturedCbArg;
            // Ensure this mockImplementation is fresh for each call to getCallbackAndPromise if needed,
            // or that it's correctly set up in beforeEach if it's general enough.
            // For this test suite, it seems to be fine in beforeEach.
            mockValidatedEventDispatcher.subscribe.mockImplementationOnce((evtName, cb) => {
                if (evtName === PLAYER_TURN_SUBMITTED_ID) {
                    capturedCbArg = cb;
                }
                return mockUnsubscribeFnForSuite;
            });

            const promise = service.prompt(actorForPrompt);

            // Allow promise chain for subscription to settle
            for (let i = 0; i < 5; i++) { // Reduced iterations, usually 1-2 are enough
                await Promise.resolve();
            }

            if (!capturedCbArg) {
                // Attempt to find the callback if not immediately captured (e.g. if subscribe was called multiple times)
                const calls = mockValidatedEventDispatcher.subscribe.mock.calls;
                if (calls.length > 0) {
                    const lastCall = calls[calls.length - 1];
                    if (lastCall[0] === PLAYER_TURN_SUBMITTED_ID && typeof lastCall[1] === 'function') {
                        capturedCbArg = lastCall[1];
                    }
                }
                if (!capturedCbArg) {
                    // This block helps debug if the callback isn't captured as expected
                    console.error("Debug: Callback not captured. Subscribe calls:", JSON.stringify(calls));
                    try {
                        await promise; // See if promise resolves/rejects unexpectedly
                    } catch (e) {
                        // If promise rejected, it might indicate an issue before event handling
                        throw new Error(`getCallbackAndPromise: service.prompt may have rejected before callback was captured. Error: ${e.message}. Check logs.`);
                    }
                    // If promise didn't reject and callback still not found, it's an issue with test setup/mocking
                    throw new Error("getCallbackAndPromise: Event callback was not captured. Subscribe mock might not have been called as expected or callback not passed.");
                }
            }
            expect(capturedCbArg).toBeInstanceOf(Function); // Assert that callback is a function
            return {promptPromise: promise, capturedCallback: capturedCbArg};
        };


        it('should reject with PromptError if submitted actionId is invalid', async () => {
            const {promptPromise, capturedCallback} = await getCallbackAndPromise(mockActor);
            capturedCallback({
                type: PLAYER_TURN_SUBMITTED_ID,
                payload: {actionId: 'invalid-action-id', speech: null}
            });
            await expect(promptPromise).rejects.toMatchObject({
                name: 'PromptError',
                message: `Invalid actionId 'invalid-action-id' submitted by actor ${mockActor.id}. Action not available.`,
                code: "INVALID_ACTION_ID"
            });
            expect(mockUnsubscribeFnForSuite).toHaveBeenCalled();
        });

        it('should clear timeout (conceptually, ensure cleanup) and unsubscribe when event is received', async () => {
            const {promptPromise, capturedCallback} = await getCallbackAndPromise(mockActor);
            const validAction = mockDiscoveredActionsList[0];

            capturedCallback({
                type: PLAYER_TURN_SUBMITTED_ID,
                payload: {actionId: validAction.id, speech: "test speech"}
            });

            await expect(promptPromise).resolves.toEqual({action: validAction, speech: "test speech"});
            // Timeout is no longer cleared as it doesn't exist, but unsubscription is key.
            expect(mockUnsubscribeFnForSuite).toHaveBeenCalled();
            // Check that clearTimeout was not called if it were still a mock
            // expect(clearTimeout).not.toHaveBeenCalled(); // If clearTimeout was globally mocked
        });

        it('should reject with PromptError if event object itself is malformed (e.g. not an object, or missing type/payload)', async () => {
            const {promptPromise, capturedCallback} = await getCallbackAndPromise(mockActor);
            // Malformed: missing 'type' and 'payload' at the top level
            capturedCallback({someOtherData: "value", speech: "only speech", actionId: "some-action"});

            await expect(promptPromise).rejects.toMatchObject({
                name: 'PromptError',
                message: `Malformed event object for PLAYER_TURN_SUBMITTED_ID for actor ${mockActor.id}.`,
                code: "INVALID_EVENT_STRUCTURE"
            });
            expect(mockUnsubscribeFnForSuite).toHaveBeenCalled();
        });

        it('should reject with PromptError if event.payload is missing actionId', async () => {
            const {promptPromise, capturedCallback} = await getCallbackAndPromise(mockActor);
            capturedCallback({
                type: PLAYER_TURN_SUBMITTED_ID, // Correct type
                payload: {speech: "only speech, no actionId"} // Payload missing actionId
            });

            try {
                await promptPromise;
                // This line should not be reached if the test is correct
                throw new Error('Test failed: Promise was expected to reject but it resolved.');
            } catch (error) {
                expect(error).toBeInstanceOf(PromptError);
                expect(error.name).toBe('PromptError');
                expect(error.code).toBe('INVALID_PAYLOAD_CONTENT');
                const expectedMessage = `Invalid actionId in payload for PLAYER_TURN_SUBMITTED_ID for actor ${mockActor.id}.`;
                expect(error.message).toBe(expectedMessage);
            }
            expect(mockUnsubscribeFnForSuite).toHaveBeenCalled();
        });
    });
});
// --- FILE END ---