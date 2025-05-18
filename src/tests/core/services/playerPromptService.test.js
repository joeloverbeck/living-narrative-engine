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
        const lookAction = {action: {id: 'core:look', name: 'Look'}, command: 'look'};
        const speakAction = {action: {id: 'core:speak', name: 'Speak'}, command: 'speak'};
        const mockDiscoveredActions = [lookAction, speakAction];
        const chosenActionId = speakAction.action.id;
        const chosenSpeech = "Hello there!";
        const expectedResolution = {action: speakAction, speech: chosenSpeech};

        mockWorldContext.getLocationOfEntity.mockResolvedValue(mockLocation);
        mockActionDiscoverySystem.getValidActions.mockResolvedValue(mockDiscoveredActions);
        mockPromptOutputPort.prompt.mockResolvedValue(undefined);

        const mockUnsubscribeFn = jest.fn();
        mockValidatedEventDispatcher.subscribe.mockReset();
        mockValidatedEventDispatcher.subscribe.mockImplementation((eventName, eventHandlerCallback) => {
            if (eventName === 'core:player_turn_submitted') {
                Promise.resolve().then(() => {
                    eventHandlerCallback({actionId: chosenActionId, speech: chosenSpeech});
                });
            }
            return mockUnsubscribeFn;
        });

        const resultPromise = service.prompt(mockActor);
        await expect(resultPromise).resolves.toEqual(expectedResolution);
        expect(mockValidatedEventDispatcher.subscribe).toHaveBeenCalledWith('core:player_turn_submitted', expect.any(Function));
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
            mockDiscoveredActionsList = [
                {action: {id: 'action1', name: 'Action One'}, command: 'do one'},
                {action: {id: 'action2', name: 'Action Two'}, command: 'do two'}
            ];
            mockWorldContext.getLocationOfEntity.mockResolvedValue(mockLocationInst);
            mockActionDiscoverySystem.getValidActions.mockResolvedValue(mockDiscoveredActionsList);
            mockPromptOutputPort.prompt.mockResolvedValue(undefined);
            mockUnsubscribeFnForSuite = jest.fn();
            mockValidatedEventDispatcher.subscribe.mockReset();
            mockValidatedEventDispatcher.subscribe.mockReturnValue(mockUnsubscribeFnForSuite);
        });

        afterEach(() => {
            jest.useRealTimers();
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

            // To ensure that the `setTimeout` within `service.prompt` has been registered
            // after its internal `await` calls (which resolve quickly due to mocks),
            // we need to yield to the event loop. `process.nextTick` or `setImmediate` (if available via jest.requireActual)
            // are more direct for this than Promise.resolve().then().
            // Using Jest's own mechanism to flush microtasks if available, or fallback.
            const flushMicrotasks = async () => {
                for (let i = 0; i < 5; i++) { // A few ticks for safety
                    await Promise.resolve();
                }
            };

            flushMicrotasks().then(() => {
                // By this point, the setTimeout inside service.prompt should have been called.
                // Now, run the timers.
                if (jest.getTimerCount() > 0) { // Check if any timers are actually set
                    jest.runOnlyPendingTimers();
                } else {
                    // This case might indicate an issue where setTimeout was not registered
                    // or was cleared prematurely. The test will likely time out if reject() isn't called.
                    // Forcing a failure here might be better than a silent timeout if no timers are pending.
                    // However, the .catch on promptPromise should ideally handle it.
                    // If runOnlyPendingTimers does nothing, the promise won't reject from timeout.
                    // Consider if an error occurred before setTimeout in service.prompt.
                    // The earlier then/catch on promptPromise should catch non-timeout rejections.
                }
            });
        });

        const getCallbackAndPromise = async (actorForPrompt) => {
            let capturedCbArg;
            mockValidatedEventDispatcher.subscribe.mockImplementationOnce((evtName, cb) => {
                if (evtName === 'core:player_turn_submitted') {
                    capturedCbArg = cb;
                }
                return mockUnsubscribeFnForSuite;
            });

            const promise = service.prompt(actorForPrompt);
            for (let i = 0; i < 5; i++) {
                await Promise.resolve();
            }

            if (!capturedCbArg) {
                const calls = mockValidatedEventDispatcher.subscribe.mock.calls;
                if (calls.length > 0 && calls[calls.length - 1][1]) {
                    capturedCbArg = calls[calls.length - 1][1];
                }
                if (!capturedCbArg) {
                    try {
                        await promise;
                    } catch (e) {
                        throw new Error(`getCallbackAndPromise: service.prompt rejected before subscribe was effective or callback captured. Error: ${e.message}`);
                    }
                    throw new Error("getCallbackAndPromise: Event callback was not captured. Check subscribe mock. Calls: " + calls.length);
                }
            }

            expect(capturedCbArg).toBeInstanceOf(Function);
            return {promptPromise: promise, capturedCallback: capturedCbArg};
        };

        it('should reject with PromptError if submitted actionId is invalid', async () => {
            const {promptPromise, capturedCallback} = await getCallbackAndPromise(mockActor);
            capturedCallback({actionId: 'invalid-action-id', speech: null});
            await expect(promptPromise).rejects.toMatchObject({
                name: 'PromptError',
                message: `Invalid actionId 'invalid-action-id' submitted by actor ${mockActor.id}.`,
                code: "INVALID_ACTION_ID"
            });
            expect(mockUnsubscribeFnForSuite).toHaveBeenCalled();
        });

        it('should clear timeout and unsubscribe when event is received', async () => {
            const {promptPromise, capturedCallback} = await getCallbackAndPromise(mockActor);
            const validAction = mockDiscoveredActionsList[0];
            capturedCallback({actionId: validAction.action.id, speech: "test speech"});
            await expect(promptPromise).resolves.toEqual({action: validAction, speech: "test speech"});
            expect(mockUnsubscribeFnForSuite).toHaveBeenCalled();
        });

        it('should reject with PromptError if event payload is malformed', async () => {
            const {promptPromise, capturedCallback} = await getCallbackAndPromise(mockActor);
            capturedCallback({speech: "only speech"});
            await expect(promptPromise).rejects.toMatchObject({
                name: 'PromptError',
                message: `Invalid event payload for 'core:player_turn_submitted' for actor ${mockActor.id}.`,
                code: "INVALID_PAYLOAD"
            });
            expect(mockUnsubscribeFnForSuite).toHaveBeenCalled();
        });
    });
});
// --- FILE END ---