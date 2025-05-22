// tests/turns/services/playerPromptService.test.js
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
    // Based on the original ticket and error logs, 'src/turns/services/playerPromptService.js' seems to be the actual path.
    // The error log was 'src/turns/services/playerPromptService.js:112:21'
    service = new PlayerPromptService(validDependencies);
    mockActor = new Entity('player:test', 'dummy');
});

afterEach(() => {
    jest.clearAllMocks();
});

describe('PlayerPromptService Constructor', () => {
    it('should succeed when all valid dependencies are provided', () => {
        mockLogger.info.mockClear(); // Clear info from the beforeEach instantiation
        const localService = new PlayerPromptService(validDependencies);
        expect(localService).toBeInstanceOf(PlayerPromptService);
        expect(mockLogger.info).toHaveBeenCalledWith('PlayerPromptService initialized successfully.');
        expect(mockLogger.info).toHaveBeenCalledTimes(1); // This instance's call
    });

    describe('ValidatedEventDispatcher Dependency Validation', () => {
        it('should throw if validatedEventDispatcher is missing', () => {
            const {validatedEventDispatcher: _, ...incompleteDeps} = validDependencies;
            expect(() => new PlayerPromptService(incompleteDeps)).toThrow('PlayerPromptService: Missing IValidatedEventDispatcher dependency.');
        });
        it('should throw if validatedEventDispatcher lacks subscribe method', () => {
            const invalidDispatcher = {...mockValidatedEventDispatcher, subscribe: undefined};
            expect(() => new PlayerPromptService({
                ...validDependencies,
                validatedEventDispatcher: invalidDispatcher
            })).toThrow('PlayerPromptService: Invalid IValidatedEventDispatcher dependency. Missing method: subscribe().');
        });
        it('should throw if validatedEventDispatcher lacks unsubscribe method', () => {
            const invalidDispatcher = {...mockValidatedEventDispatcher, unsubscribe: undefined};
            expect(() => new PlayerPromptService({
                ...validDependencies,
                validatedEventDispatcher: invalidDispatcher
            })).toThrow('PlayerPromptService: Invalid IValidatedEventDispatcher dependency. Missing method: unsubscribe().');
        });
    });
});

describe('PlayerPromptService prompt Method', () => {
    it('should execute the happy path successfully, resolving with selected action and speech', async () => {
        const mockLocation = new Entity('location:test', 'dummy');
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
        mockValidatedEventDispatcher.subscribe.mockReset(); // Reset from beforeEach call
        // The service instance in `service` already has its dispatcher.subscribe set from its own constructor.
        // We re-initialize a new service here or adjust the existing one for more granular control for specific tests if needed.
        // For this happy path, the global `service` instance is fine, its subscribe mock will be called.
        // Ensure the global mock returns the unsubscribe function for THIS call
        mockValidatedEventDispatcher.subscribe.mockImplementation((eventName, eventHandlerCallback) => {
            if (eventName === PLAYER_TURN_SUBMITTED_ID) {
                Promise.resolve().then(() => { // Simulate async event emission
                    eventHandlerCallback({
                        type: PLAYER_TURN_SUBMITTED_ID,
                        payload: {actionId: chosenActionId, speech: chosenSpeech, submittedByActorId: mockActor.id} // Added submittedByActorId
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
        const mockLocation = new Entity('location:test', 'dummy');

        beforeEach(() => {
            mockWorldContext.getLocationOfEntity.mockResolvedValue(mockLocation);
            mockActionDiscoverySystem.getValidActions.mockRejectedValue(discoveryError);
            // The mockPromptOutputPort.prompt.mockRejectedValue(portError) from the original test
            // is not relevant here because if getValidActions fails, promptOutputPort.prompt
            // for the main dispatch won't be called.
        });

        // The test name "even if the error-path port call fails" is misleading for getValidActions failure.
        // The service re-throws the discovery error; it doesn't make a subsequent "error-path port call".
        // Renaming for clarity or adjusting if a different scenario was intended might be good,
        // but here's the fix for the current structure based on service behavior:
        it('should reject with a PromptError wrapping the discovery error and log appropriately', async () => {
            mockLogger.error.mockClear(); // Clear any logs from service instantiation in beforeEach

            const promptPromise = service.prompt(mockActor);

            // Expect the promise to reject with a PromptError that wraps the original discoveryError
            await expect(promptPromise).rejects.toThrow(PromptError);
            await expect(promptPromise).rejects.toMatchObject({
                message: `Action discovery failed for actor ${mockActor.id}. Details: ${discoveryError.message}`,
                cause: discoveryError,
                code: "ACTION_DISCOVERY_FAILED"
            });

            // 1. Check log from _fetchContextAndDiscoverActions
            expect(mockLogger.error).toHaveBeenCalledWith(
                `PlayerPromptService._fetchContextAndDiscoverActions: Action discovery failed for actor ${mockActor.id}.`,
                discoveryError
            );

            // 2. Check log from the main prompt method's catch block
            // This will be called with the PromptError instance created in _fetchContextAndDiscoverActions
            const promptCatchLogCall = mockLogger.error.mock.calls.find(
                call => call[0] === `PlayerPromptService.prompt: Error during _fetchContextAndDiscoverActions for actor ${mockActor.id}. Propagating error.`
            );
            expect(promptCatchLogCall).toBeDefined();
            if (promptCatchLogCall) {
                const loggedError = promptCatchLogCall[1];
                expect(loggedError).toBeInstanceOf(PromptError);
                expect(loggedError.cause).toBe(discoveryError);
                expect(loggedError.message).toBe(`Action discovery failed for actor ${mockActor.id}. Details: ${discoveryError.message}`);
            }

            // Ensure the main prompt dispatch was not attempted
            expect(mockPromptOutputPort.prompt).not.toHaveBeenCalled();
        });
    });


    describe('Player input promise handling', () => {
        let mockDiscoveredActionsList;
        let mockLocationInst;
        let mockUnsubscribeFnForSuite;

        beforeEach(() => {
            // REMOVED: jest.useFakeTimers() - no longer needed for timeout test
            mockLocationInst = new Entity('location:test-loc-promise', 'dummy');
            mockDiscoveredActionsList = [
                {id: 'action1', name: 'Action One', command: 'do one'}, // Added name
                {id: 'action2', name: 'Action Two', command: 'do two'}  // Added name
            ];
            mockWorldContext.getLocationOfEntity.mockResolvedValue(mockLocationInst);
            mockActionDiscoverySystem.getValidActions.mockResolvedValue(mockDiscoveredActionsList);
            mockPromptOutputPort.prompt.mockResolvedValue(undefined);
            mockUnsubscribeFnForSuite = jest.fn();
            // mockValidatedEventDispatcher.subscribe.mockReset(); // Reset from global beforeEach
            mockValidatedEventDispatcher.subscribe.mockReturnValue(mockUnsubscribeFnForSuite); // Ensure it returns the specific mock for this suite
        });

        afterEach(() => {
            // REMOVED: jest.useRealTimers()
            // mockValidatedEventDispatcher.subscribe.mockReset(); // Ensure clean state, already done by global afterEach
        });

        // REMOVED: Test for 'should reject with PromptError on timeout'
        // as the timeout functionality has been removed from PlayerPromptService.

        const getCallbackAndPromise = async (actorForPrompt) => {
            let capturedCbArg;
            const originalSubscribeMock = mockValidatedEventDispatcher.subscribe;

            // This is the temporary mock that should be called by service.prompt()
            const temporaryCapturingMock = jest.fn((evtName, cb) => {
                if (evtName === PLAYER_TURN_SUBMITTED_ID) {
                    capturedCbArg = cb;
                }
                return mockUnsubscribeFnForSuite; // From the enclosing suite's beforeEach
            });
            mockValidatedEventDispatcher.subscribe = temporaryCapturingMock;

            const promise = service.prompt(actorForPrompt);

            // Allow microtasks and the current macrotask queue to flush.
            // Use setTimeout with 0ms delay as a more portable way to yield.
            await new Promise(resolve => setTimeout(resolve, 0));


            if (!capturedCbArg) {
                console.error("Debug: Callback not captured by temporary mock.");
                // Log the calls made to the temporary mock specifically.
                console.error("Calls on temporaryCapturingMock:", JSON.stringify(temporaryCapturingMock.mock.calls));
                // Restore the original mock before potentially throwing or continuing, to ensure test isolation.
                mockValidatedEventDispatcher.subscribe = originalSubscribeMock;
                try {
                    // Await the promise to see if it rejected, which might explain why subscribe wasn't called.
                    await promise;
                    // If it resolved without capturing, that's also an issue.
                    throw new Error("getCallbackAndPromise: service.prompt resolved but callback was not captured.");
                } catch (e) {
                    // Re-throw with more context.
                    throw new Error(`getCallbackAndPromise: Callback not captured. service.prompt error or unexpected resolution: ${e.message}. Original error cause: ${e.cause ? e.cause : 'N/A'}`);
                }
            }

            // Restore the original mock if we successfully captured the callback and are proceeding.
            mockValidatedEventDispatcher.subscribe = originalSubscribeMock;

            expect(capturedCbArg).toBeInstanceOf(Function);
            return {promptPromise: promise, capturedCallback: capturedCbArg};
        };


        it('should reject with PromptError if submitted actionId is invalid', async () => {
            const {promptPromise, capturedCallback} = await getCallbackAndPromise(mockActor);
            capturedCallback({
                type: PLAYER_TURN_SUBMITTED_ID,
                payload: {actionId: 'invalid-action-id', speech: null, submittedByActorId: mockActor.id} // Added submittedByActorId
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
                payload: {actionId: validAction.id, speech: "test speech", submittedByActorId: mockActor.id} // Added submittedByActorId
            });

            await expect(promptPromise).resolves.toEqual({action: validAction, speech: "test speech"});
            expect(mockUnsubscribeFnForSuite).toHaveBeenCalled();
        });

        it('should reject with PromptError if event object itself is malformed (e.g. not an object, or missing type/payload)', async () => {
            const {promptPromise, capturedCallback} = await getCallbackAndPromise(mockActor);
            capturedCallback({
                someOtherData: "value",
                speech: "only speech",
                actionId: "some-action",
                submittedByActorId: mockActor.id
            }); // Added submittedByActorId

            await expect(promptPromise).rejects.toMatchObject({
                name: 'PromptError',
                message: `Malformed event object for ${PLAYER_TURN_SUBMITTED_ID} for actor ${mockActor.id}.`, // Corrected interpolation
                code: "INVALID_EVENT_STRUCTURE"
            });
            expect(mockUnsubscribeFnForSuite).toHaveBeenCalled();
        });

        it('should reject with PromptError if event.payload is missing actionId', async () => {
            const {promptPromise, capturedCallback} = await getCallbackAndPromise(mockActor);
            capturedCallback({
                type: PLAYER_TURN_SUBMITTED_ID,
                payload: {speech: "only speech, no actionId", submittedByActorId: mockActor.id} // Added submittedByActorId
            });

            try {
                await promptPromise;
                throw new Error('Test failed: Promise was expected to reject but it resolved.');
            } catch (error) {
                expect(error).toBeInstanceOf(PromptError);
                expect(error.name).toBe('PromptError');
                expect(error.code).toBe('INVALID_PAYLOAD_CONTENT');
                // Corrected interpolation for PLAYER_TURN_SUBMITTED_ID
                const expectedMessage = `Invalid actionId in payload for ${PLAYER_TURN_SUBMITTED_ID} for actor ${mockActor.id}.`;
                expect(error.message).toBe(expectedMessage);
            }
            expect(mockUnsubscribeFnForSuite).toHaveBeenCalled();
        });
    });
});
// --- FILE END ---