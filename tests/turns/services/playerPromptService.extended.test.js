// tests/turns/services/playerPromptService.extended.test.js
// --- FILE START ---
import HumanPlayerPromptService from '../../../src/turns/services/humanPlayerPromptService.js';
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
    subscribe: jest.fn(), unsubscribe: jest.fn(), dispatchValidated: jest.fn(),
});

// Helper to allow microtasks to process
const tick = (count = 1) => {
    let p = Promise.resolve();
    for (let i = 0; i < count; i++) {
        p = p.then(() => new Promise(resolve => setTimeout(resolve, 0)));
    }
    return p;
};

describe('PlayerPromptService Constructor - Extended Validation', () => {
    let mockLogger;
    let mockActionDiscoverySystem;
    let mockPromptOutputPort;
    let mockWorldContext;
    let mockEntityManager;
    let mockGameDataRepository;
    let mockValidatedEventDispatcher;
    let baseDependencies;

    beforeEach(() => {
        mockLogger = createMockLogger();
        mockActionDiscoverySystem = createMockActionDiscoverySystem();
        mockPromptOutputPort = createMockPromptOutputPort();
        mockWorldContext = createMockWorldContext();
        mockEntityManager = createMockEntityManager();
        mockGameDataRepository = createMockGameDataRepository();
        mockValidatedEventDispatcher = createMockValidatedEventDispatcher();

        baseDependencies = {
            logger: mockLogger,
            actionDiscoverySystem: mockActionDiscoverySystem,
            promptOutputPort: mockPromptOutputPort,
            worldContext: mockWorldContext,
            entityManager: mockEntityManager,
            gameDataRepository: mockGameDataRepository,
            validatedEventDispatcher: mockValidatedEventDispatcher,
        };
    });

    it('should initialize successfully with all valid dependencies', () => {
        expect(() => new HumanPlayerPromptService(baseDependencies)).not.toThrow();
        expect(mockLogger.info).toHaveBeenCalledWith('PlayerPromptService initialized successfully.');
    });

    describe('Logger Dependency Validation', () => {
        let consoleErrorSpy;
        beforeEach(() => {
            consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation(() => {
            });
        });
        afterEach(() => {
            consoleErrorSpy.mockRestore();
        });

        it('should throw if logger is missing', () => {
            const {logger, ...deps} = baseDependencies;
            const testDeps = {...deps};
            delete testDeps.logger;
            expect(() => new HumanPlayerPromptService(testDeps)).toThrow('PlayerPromptService: Missing ILogger dependency.');
        });
        const methods = ['error', 'info', 'debug', 'warn'];
        methods.forEach(method => {
            it(`should throw if logger is missing ${method} method`, () => {
                const invalidLogger = {...createMockLogger(), [method]: undefined};
                expect(() => new HumanPlayerPromptService({...baseDependencies, logger: invalidLogger}))
                    .toThrow(`PlayerPromptService: Invalid ILogger dependency. Missing method: ${method}().`);
            });
        });
    });

    describe('ActionDiscoverySystem Dependency Validation', () => {
        let consoleErrorSpy;
        beforeEach(() => {
            consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation(() => {
            });
        });
        afterEach(() => {
            consoleErrorSpy.mockRestore();
        });

        it('should throw if actionDiscoverySystem is missing', () => {
            const {actionDiscoverySystem, ...deps} = baseDependencies;
            const testDeps = {...deps};
            delete testDeps.actionDiscoverySystem;
            expect(() => new HumanPlayerPromptService(testDeps)).toThrow('PlayerPromptService: Missing IActionDiscoverySystem dependency.');
        });
        it('should throw if actionDiscoverySystem lacks getValidActions method', () => {
            const invalidSystem = {...createMockActionDiscoverySystem(), getValidActions: undefined};
            expect(() => new HumanPlayerPromptService({...baseDependencies, actionDiscoverySystem: invalidSystem}))
                .toThrow('PlayerPromptService: Invalid IActionDiscoverySystem dependency. Missing method: getValidActions().');
        });
    });

    describe('PromptOutputPort Dependency Validation', () => {
        let consoleErrorSpy;
        beforeEach(() => {
            consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation(() => {
            });
        });
        afterEach(() => {
            consoleErrorSpy.mockRestore();
        });

        it('should throw if promptOutputPort is missing', () => {
            const {promptOutputPort, ...deps} = baseDependencies;
            const testDeps = {...deps};
            delete testDeps.promptOutputPort;
            expect(() => new HumanPlayerPromptService(testDeps)).toThrow('PlayerPromptService: Missing IPromptOutputPort dependency.');
        });
        it('should throw if promptOutputPort lacks prompt method', () => {
            const invalidPort = {...createMockPromptOutputPort(), prompt: undefined};
            expect(() => new HumanPlayerPromptService({...baseDependencies, promptOutputPort: invalidPort}))
                .toThrow('PlayerPromptService: Invalid IPromptOutputPort dependency. Missing method: prompt().');
        });
    });

    describe('WorldContext Dependency Validation', () => {
        let consoleErrorSpy;
        beforeEach(() => {
            consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation(() => {
            });
        });
        afterEach(() => {
            consoleErrorSpy.mockRestore();
        });

        it('should throw if worldContext is missing', () => {
            const {worldContext, ...deps} = baseDependencies;
            const testDeps = {...deps};
            delete testDeps.worldContext;
            expect(() => new HumanPlayerPromptService(testDeps)).toThrow('PlayerPromptService: Missing IWorldContext dependency.');
        });
        it('should throw if worldContext lacks getLocationOfEntity method', () => {
            const invalidContext = {...createMockWorldContext(), getLocationOfEntity: undefined};
            expect(() => new HumanPlayerPromptService({...baseDependencies, worldContext: invalidContext}))
                .toThrow('PlayerPromptService: Invalid IWorldContext dependency. Missing method: getLocationOfEntity().');
        });
    });

    describe('EntityManager Dependency Validation', () => {
        let consoleErrorSpy;
        beforeEach(() => {
            consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation(() => {
            });
        });
        afterEach(() => {
            consoleErrorSpy.mockRestore();
        });

        it('should throw if entityManager is missing', () => {
            const {entityManager, ...deps} = baseDependencies;
            const testDeps = {...deps};
            delete testDeps.entityManager;
            expect(() => new HumanPlayerPromptService(testDeps)).toThrow('PlayerPromptService: Missing IEntityManager dependency.');
        });
        it('should throw if entityManager lacks getEntityInstance method', () => {
            const invalidManager = {...createMockEntityManager(), getEntityInstance: undefined};
            expect(() => new HumanPlayerPromptService({...baseDependencies, entityManager: invalidManager}))
                .toThrow('PlayerPromptService: Invalid IEntityManager dependency. Missing method: getEntityInstance().');
        });
    });

    describe('GameDataRepository Dependency Validation', () => {
        let consoleErrorSpy;
        beforeEach(() => {
            consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation(() => {
            });
        });
        afterEach(() => {
            consoleErrorSpy.mockRestore();
        });

        it('should throw if gameDataRepository is missing', () => {
            const {gameDataRepository, ...deps} = baseDependencies;
            const testDeps = {...deps};
            delete testDeps.gameDataRepository;
            expect(() => new HumanPlayerPromptService(testDeps)).toThrow('PlayerPromptService: Missing IGameDataRepository dependency.');
        });
        it('should throw if gameDataRepository lacks getActionDefinition method', () => {
            const invalidRepo = {...createMockGameDataRepository(), getActionDefinition: undefined};
            expect(() => new HumanPlayerPromptService({...baseDependencies, gameDataRepository: invalidRepo}))
                .toThrow('PlayerPromptService: Invalid IGameDataRepository dependency. Missing method: getActionDefinition().');
        });
    });

    describe('ValidatedEventDispatcher Dependency Validation', () => {
        let consoleErrorSpy;
        beforeEach(() => {
            consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation(() => {
            });
        });
        afterEach(() => {
            consoleErrorSpy.mockRestore();
        });

        it('should throw if validatedEventDispatcher is missing', () => {
            const {validatedEventDispatcher, ...deps} = baseDependencies;
            const testDeps = {...deps};
            delete testDeps.validatedEventDispatcher;
            expect(() => new HumanPlayerPromptService(testDeps)).toThrow('PlayerPromptService: Missing IValidatedEventDispatcher dependency.');
        });
        const dispatcherMethods = ['subscribe', 'unsubscribe'];
        dispatcherMethods.forEach(method => {
            it(`should throw if validatedEventDispatcher lacks ${method} method`, () => {
                const invalidDispatcher = {...createMockValidatedEventDispatcher(), [method]: undefined};
                expect(() => new HumanPlayerPromptService({
                    ...baseDependencies,
                    validatedEventDispatcher: invalidDispatcher
                }))
                    .toThrow(`PlayerPromptService: Invalid IValidatedEventDispatcher dependency. Missing method: ${method}().`);
            });
        });
    });
});


describe('PlayerPromptService prompt Method - Extended Scenarios', () => {
    let service;
    let mockLogger;
    let mockActionDiscoverySystem;
    let mockPromptOutputPort;
    let mockWorldContext;
    let mockEntityManager;
    let mockGameDataRepository;
    let mockValidatedEventDispatcher;
    let validActor;
    let mockLocation;

    const defaultDiscoveredActions = [{id: 'action1', name: 'Action 1', command: 'do it'}];
    const actionDefault = {id: 'actionDefault', name: 'Default', command: 'default'};

    beforeEach(() => {
        mockLogger = createMockLogger();
        mockActionDiscoverySystem = createMockActionDiscoverySystem();
        mockPromptOutputPort = createMockPromptOutputPort();
        mockWorldContext = createMockWorldContext();
        mockEntityManager = createMockEntityManager();
        mockGameDataRepository = createMockGameDataRepository();
        mockValidatedEventDispatcher = createMockValidatedEventDispatcher();

        service = new HumanPlayerPromptService({
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

        mockWorldContext.getLocationOfEntity.mockResolvedValue(mockLocation);
        mockActionDiscoverySystem.getValidActions.mockResolvedValue([...defaultDiscoveredActions]);
        mockPromptOutputPort.prompt.mockResolvedValue(undefined);
    });

    afterEach(() => {
        jest.clearAllMocks();
    });

    describe('Initial Validations and Setup', () => {
        let consoleErrorSpyForPrepare;

        beforeEach(() => {
        });

        afterEach(() => {
            if (consoleErrorSpyForPrepare) consoleErrorSpyForPrepare.mockRestore();
        });


        it('should throw PromptError if actor is null', async () => {
            await expect(service.prompt(null)).rejects.toThrow(new PromptError('Invalid actor provided to PlayerPromptService.prompt: null'));
        });

        it('should throw PromptError if actor.id is missing', async () => {
            const invalidActor = {name: 'No ID Actor'};
            await expect(service.prompt(invalidActor)).rejects.toThrow(new PromptError(`Invalid actor provided to PlayerPromptService.prompt: ${JSON.stringify(invalidActor)}`));
        });

        it('should throw PromptError if actor.id is an empty string', async () => {
            const invalidActor = {id: ''};
            await expect(service.prompt(invalidActor)).rejects.toThrow(new PromptError(`Invalid actor provided to PlayerPromptService.prompt: ${JSON.stringify(invalidActor)}`));
        });

        it('should throw DOMException with AbortError if cancellationSignal is already aborted before initiation', async () => {
            const abortController = new AbortController();
            abortController.abort();
            const options = {cancellationSignal: abortController.signal};
            try {
                await service.prompt(validActor, options);
                throw new Error('Prompt should have been aborted');
            } catch (e) {
                expect(e).toBeInstanceOf(DOMException);
                expect(e.name).toBe('AbortError');
                expect(e.message).toBe('Prompt aborted by signal before initiation.');
            }
        });
    });

    describe('Superseding Prompts (Behavior of #clearCurrentPrompt)', () => {

        it('should reject the superseded prompt with PROMPT_SUPERSEDED_BY_NEW_REQUEST for a different actor', async () => {
            const firstActor = new Entity('player:first', 'player-template');
            const firstPromptUnsubscribeFn = jest.fn();
            mockActionDiscoverySystem.getValidActions.mockResolvedValueOnce([...defaultDiscoveredActions]);
            mockValidatedEventDispatcher.subscribe.mockImplementationOnce(() => firstPromptUnsubscribeFn);
            const firstPromptPromise = service.prompt(firstActor);
            await tick();

            const secondActor = new Entity('player:other', 'player-template');
            mockWorldContext.getLocationOfEntity.mockResolvedValueOnce(new Entity('location:other', 'loc-template'));
            mockActionDiscoverySystem.getValidActions.mockResolvedValueOnce([actionDefault]);

            const secondPromptUnsubscribeFn = jest.fn();
            mockValidatedEventDispatcher.subscribe.mockImplementationOnce((_, cb) => {
                setTimeout(() => cb({
                    type: PLAYER_TURN_SUBMITTED_ID,
                    payload: {actionId: actionDefault.id, speech: null, submittedByActorId: secondActor.id}
                }), 0);
                return secondPromptUnsubscribeFn;
            });

            const secondPromptPromise = service.prompt(secondActor);

            await expect(firstPromptPromise).rejects.toMatchObject({
                name: 'PromptError',
                message: `New prompt initiated for actor ${secondActor.id}, superseding previous prompt for ${firstActor.id}.`,
                code: "PROMPT_SUPERSEDED_BY_NEW_REQUEST"
            });
            expect(firstPromptUnsubscribeFn).toHaveBeenCalledTimes(1);
            // Corrected expectation for the log message
            expect(mockLogger.warn).toHaveBeenCalledWith(expect.stringContaining(`Actively clearing prompt for actor ${firstActor.id}`));

            await expect(secondPromptPromise).resolves.toBeDefined();
            expect(secondPromptUnsubscribeFn).toHaveBeenCalledTimes(1);
        });

        it('should reject the superseded prompt with a specific message when re-prompting the same actor', async () => {
            const actor = new Entity('player:same', 'player-template');
            const firstPromptUnsubscribeFn = jest.fn();
            mockActionDiscoverySystem.getValidActions.mockResolvedValueOnce([...defaultDiscoveredActions]);
            mockValidatedEventDispatcher.subscribe.mockImplementationOnce(() => firstPromptUnsubscribeFn);
            const firstPromptPromise = service.prompt(actor);
            await tick();

            mockActionDiscoverySystem.getValidActions.mockResolvedValueOnce([actionDefault]);
            const secondPromptUnsubscribeFn = jest.fn();
            mockValidatedEventDispatcher.subscribe.mockImplementationOnce((_, cb) => {
                setTimeout(() => cb({
                    type: PLAYER_TURN_SUBMITTED_ID,
                    payload: {actionId: actionDefault.id, speech: null, submittedByActorId: actor.id}
                }), 0);
                return secondPromptUnsubscribeFn;
            });
            const secondPromptPromiseSameActor = service.prompt(actor);

            await expect(firstPromptPromise).rejects.toMatchObject({
                name: 'PromptError',
                message: `New prompt re-initiated for actor ${actor.id}, superseding existing prompt.`,
                code: "PROMPT_SUPERSEDED_BY_NEW_REQUEST"
            });
            expect(firstPromptUnsubscribeFn).toHaveBeenCalledTimes(1);

            await expect(secondPromptPromiseSameActor).resolves.toBeDefined();
        });

        it('cancelCurrentPrompt logs "no active prompt" if called after a prompt self-aborted (and nulled current context)', async () => {
            const actorToAbort = new Entity('player:abort-then-cancel', 't');
            const unsubscribeFn = jest.fn();
            const abortController = new AbortController();
            const signal = abortController.signal;
            const removeEventListenerSpy = jest.spyOn(signal, 'removeEventListener');

            mockActionDiscoverySystem.getValidActions.mockResolvedValueOnce([actionDefault]);
            mockValidatedEventDispatcher.subscribe.mockImplementationOnce(() => unsubscribeFn);

            const promptPromise = service.prompt(actorToAbort, {cancellationSignal: signal});
            await tick();

            abortController.abort();

            try {
                await promptPromise;
            } catch (e) {
                expect(e.name).toBe('AbortError');
            }

            await tick();

            service.cancelCurrentPrompt();
            await tick();

            expect(mockLogger.info).toHaveBeenCalledWith("PlayerPromptService: cancelCurrentPrompt called.");
            // This expectation relies on the fact that localPromptContext.reject (called by abort)
            // will nullify this.#currentPromptContext if it matches, due to the Phase 3 integration.
            expect(mockLogger.debug).toHaveBeenCalledWith("PlayerPromptService: cancelCurrentPrompt called, but no active prompt to cancel.");

            expect(unsubscribeFn).toHaveBeenCalledTimes(1);
            expect(removeEventListenerSpy).toHaveBeenCalledTimes(1);
            removeEventListenerSpy.mockRestore();
        });


        it('#clearCurrentPrompt should log errors from its own calls to unsubscribe but still reject the old prompt', async () => {
            const actorToSupersede = new Entity('player:badunsubscribe', 't');
            const erroringUnsubscribeFn = jest.fn(() => {
                throw new Error("Unsubscribe failed!");
            });
            mockActionDiscoverySystem.getValidActions.mockResolvedValueOnce([...defaultDiscoveredActions]);
            mockValidatedEventDispatcher.subscribe.mockImplementationOnce(() => erroringUnsubscribeFn);
            const firstPromptWithBadUnsubscribe = service.prompt(actorToSupersede);
            await tick();

            const secondActor = new Entity('player:other2', 'player-template');
            mockWorldContext.getLocationOfEntity.mockResolvedValueOnce(new Entity('location:other2', 'loc-template'));
            mockActionDiscoverySystem.getValidActions.mockResolvedValueOnce([actionDefault]);

            const secondPromptUnsubscribeFn = jest.fn();
            mockValidatedEventDispatcher.subscribe.mockImplementationOnce((_, cb) => {
                setTimeout(() => cb({
                    type: PLAYER_TURN_SUBMITTED_ID,
                    payload: {actionId: actionDefault.id, speech: null, submittedByActorId: secondActor.id}
                }), 0);
                return secondPromptUnsubscribeFn;
            });
            const secondPromptPromise = service.prompt(secondActor);

            await expect(firstPromptWithBadUnsubscribe).rejects.toMatchObject({
                name: 'PromptError', code: "PROMPT_SUPERSEDED_BY_NEW_REQUEST"
            });
            // Corrected expectation for the error log message
            expect(mockLogger.error).toHaveBeenCalledWith(
                expect.stringContaining(`PlayerPromptService._performPromptResourceCleanup: Error unsubscribing event listener for prompt (actor ${actorToSupersede.id}).`),
                expect.objectContaining({message: "Unsubscribe failed!"})
            );

            await expect(secondPromptPromise).resolves.toBeDefined();
        });
    });

    describe('worldContext.getLocationOfEntity Failures', () => {

        it('should throw PromptError if getLocationOfEntity returns null', async () => {
            mockWorldContext.getLocationOfEntity.mockResolvedValue(null);
            const promptPromise = service.prompt(validActor);
            await expect(promptPromise).rejects.toThrow(PromptError);
            await expect(promptPromise).rejects.toMatchObject({
                message: `Failed to determine actor location for ${validActor.id}: Location not found or undefined.`,
                code: "LOCATION_NOT_FOUND"
            });
        });

        it('should throw PromptError if getLocationOfEntity returns undefined', async () => {
            mockWorldContext.getLocationOfEntity.mockResolvedValue(undefined);
            const promptPromise = service.prompt(validActor);
            await expect(promptPromise).rejects.toThrow(PromptError);
            await expect(promptPromise).rejects.toMatchObject({
                message: `Failed to determine actor location for ${validActor.id}: Location not found or undefined.`,
                code: "LOCATION_NOT_FOUND"
            });
        });

        it('should wrap and throw PromptError if getLocationOfEntity throws a generic error', async () => {
            const genericError = new Error("Generic location error");
            mockWorldContext.getLocationOfEntity.mockRejectedValue(genericError);
            const promptPromise = service.prompt(validActor);
            await expect(promptPromise).rejects.toThrow(PromptError);
            await expect(promptPromise).rejects.toMatchObject({
                message: `Failed to determine actor location for ${validActor.id}. Details: ${genericError.message}`,
                cause: genericError,
                code: "LOCATION_FETCH_FAILED"
            });
        });

        it('should re-throw PromptError if getLocationOfEntity throws a PromptError', async () => {
            const specificPromptError = new PromptError("Specific location PromptError", null, "CUSTOM_LOCATION_ERROR");
            mockWorldContext.getLocationOfEntity.mockRejectedValue(specificPromptError);
            await expect(service.prompt(validActor)).rejects.toThrow(specificPromptError);
        });

        it('should re-throw AbortError if getLocationOfEntity throws an AbortError', async () => {
            const abortError = new DOMException("Location fetch aborted", "AbortError");
            mockWorldContext.getLocationOfEntity.mockRejectedValue(abortError);
            await expect(service.prompt(validActor)).rejects.toThrow(abortError);
        });

        it('should throw AbortError if cancellationSignal aborts during getLocationOfEntity', async () => {
            const abortController = new AbortController();
            const options = {cancellationSignal: abortController.signal};

            mockWorldContext.getLocationOfEntity.mockImplementation(async () => {
                abortController.abort();
                await tick();
                return mockLocation;
            });

            const promptPromise = service.prompt(validActor, options);

            try {
                await promptPromise;
                throw new Error("Test failed: Prompt should have aborted.");
            } catch (e) {
                expect(e).toBeInstanceOf(DOMException);
                expect(e.name).toBe('AbortError');
                expect(e.message).toBe('Prompt aborted by signal during location fetch.');
            }
        });
    });
});
// --- FILE END ---