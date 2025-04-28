// src/core/config/registrations/questRegistrations.test.js

// --- JSDoc Imports for Type Hinting ---
/** @typedef {import('../../interfaces/coreServices.js').ILogger} ILogger */
/** @typedef {import('../../interfaces/coreServices.js').IEventBus} IEventBus */
/** @typedef {import('../../../entities/entityManager.js').default} EntityManager */
/** @typedef {import('../../gameStateManager.js').default} GameStateManager */
/** @typedef {import('../../../services/questPrerequisiteService.js').QuestPrerequisiteService} QuestPrerequisiteService */
/** @typedef {import('../../../services/questRewardService.js').QuestRewardService} QuestRewardService */
/** @typedef {import('../../../services/objectiveEventListenerService.js').ObjectiveEventListenerService} ObjectiveEventListenerService */
/** @typedef {import('../../../services/objectiveStateCheckerService.js').ObjectiveStateCheckerService} ObjectiveStateCheckerService */
/** @typedef {import('../../services/gameDataRepository.js').GameDataRepository} GameDataRepository */
/** @typedef {import('../../services/validatedEventDispatcher.js').default} ValidatedEventDispatcher */ // Added for mock
/** @typedef {any} AppContainer */ // Using 'any' for simplicity

// --- Jest Imports ---
import {describe, beforeEach, it, expect, jest} from '@jest/globals';

// --- Class Under Test ---
import {registerQuestSystems} from '../../../../core/config/registrations/questRegistrations.js'; // Adjust path

// --- Dependencies ---
import {tokens} from '../../../../core/tokens.js';
import {INITIALIZABLE} from "../../../../core/tags";

// --- Mock Implementations ---
const mockLogger = {info: jest.fn(), warn: jest.fn(), error: jest.fn(), debug: jest.fn()};
const mockEventBus = {on: jest.fn(), off: jest.fn(), emit: jest.fn()};
const mockEntityManager = { /* Methods added if needed by factories */};
const mockGameStateManager = { /* Methods added if needed by factories */};
const mockQuestPrerequisiteService = { /* Methods added if needed */};
const mockQuestRewardService = { /* Methods added if needed */};
const mockObjectiveEventListenerService = { /* Methods added if needed */};
const mockObjectiveStateCheckerService = { /* Methods added if needed */};

// FIX: Provide a more complete mock for GameDataRepository
const mockGameDataRepository = {
    // Add methods expected by QuestSystem or its dependencies' constructors
    // Based on the provided GameDataRepository code:
    getActionDefinition: jest.fn(),
    getEntityDefinition: jest.fn(),
    getAllActionDefinitions: jest.fn(() => []), // Return empty array for safety
    getAllEntityDefinitions: jest.fn(() => []), // Return empty array for safety
    // Add any other methods that might be checked or used during construction
};

const mockvalidatedEventDispatcher = {dispatch: jest.fn()};

// --- Mock DI Container ---
const createMockContainer = () => {
    const registrations = new Map();
    const instances = new Map(); // To handle singleton resolution

    const container = {
        _registrations: registrations,
        register: jest.fn((token, factoryOrValue, options = {}) => {
            if (!token) throw new Error('Mock Register Error: Token is required.');
            registrations.set(token, {factoryOrValue, options});
            // console.log(`Mock Register: ${String(token)} with options ${JSON.stringify(options)}`);
        }),
        resolve: jest.fn((token) => {
            // console.log(`Mock Resolve Request: ${String(token)}`);
            // Always return predefined mocks first
            if (token === tokens.ILogger) return mockLogger;
            if (token === tokens.EventBus) return mockEventBus;
            if (token === tokens.EntityManager) return mockEntityManager;
            if (token === tokens.GameStateManager) return mockGameStateManager;
            if (token === tokens.QuestPrerequisiteService && instances.has(token)) return instances.get(token);
            if (token === tokens.QuestPrerequisiteService) return mockQuestPrerequisiteService;
            if (token === tokens.QuestRewardService) return mockQuestRewardService;
            if (token === tokens.ObjectiveEventListenerService) return mockObjectiveEventListenerService;
            if (token === tokens.ObjectiveStateCheckerService) return mockObjectiveStateCheckerService;
            // Use the improved mock here
            if (token === tokens.GameDataRepository) return mockGameDataRepository;
            if (token === tokens.ValidatedEventDispatcher) return mockvalidatedEventDispatcher;


            const registration = registrations.get(token);
            if (!registration) {
                // Add other known dependencies if needed for complex factory resolutions
                // if (token === tokens.SomeOtherService) return mockSomeOtherService;
                throw new Error(`Mock Resolve Error: Token not registered or mocked: ${String(token)}`);
            }

            // Handle singleton resolution: create instance once if factory exists
            if (registration.options?.lifecycle === 'singleton') {
                if (instances.has(token)) {
                    // console.log(`Mock Resolve: Returning existing singleton instance for ${String(token)}`);
                    return instances.get(token);
                }
                if (typeof registration.factoryOrValue === 'function') {
                    // console.log(`Mock Resolve: Creating singleton instance for ${String(token)}`);
                    // Execute factory, passing the container itself
                    const instance = registration.factoryOrValue(container);
                    instances.set(token, instance);
                    return instance;
                } else {
                    // It's a pre-registered instance
                    instances.set(token, registration.factoryOrValue);
                    return registration.factoryOrValue;
                }
            }

            // Handle transient or other lifecycles (basic execution)
            if (typeof registration.factoryOrValue === 'function') {
                // console.log(`Mock Resolve: Executing factory for ${String(token)}`);
                return registration.factoryOrValue(container);
            }

            // console.log(`Mock Resolve: Returning raw value for ${String(token)}`);
            return registration.factoryOrValue; // Return raw value/class
        }),
        resolveAll: jest.fn((tag) => {
            // console.log(`Mock ResolveAll Request: ${tag}`);
            const found = [];
            for (const [token, reg] of registrations.entries()) {
                if (reg.options?.tags?.includes(tag)) {
                    // Return the token itself for simplicity in this test setup
                    found.push(token);
                }
            }
            // console.log(`Mock ResolveAll Found: ${found.map(String)}`);
            return found;
        })
    };
    return container;
};


describe('registerQuestSystems', () => {
    /** @type {ReturnType<typeof createMockContainer>} */
    let mockContainer;

    const questTokens = [
        tokens.QuestPrerequisiteService,
        tokens.QuestRewardService,
        tokens.ObjectiveEventListenerService,
        tokens.ObjectiveStateCheckerService,
        tokens.QuestSystem,
        tokens.QuestStartTriggerSystem,
    ];
    const initializableQuestTokens = [
        tokens.QuestSystem,
        tokens.QuestStartTriggerSystem,
    ];
    const nonInitializableQuestTokens = questTokens.filter(t => !initializableQuestTokens.includes(t));


    beforeEach(() => {
        jest.clearAllMocks();
        mockContainer = createMockContainer();
        // Pre-register essential dependency needed *by* the registration function itself
        mockContainer.register(tokens.ILogger, mockLogger, {lifecycle: 'singleton'});
    });

    it('should register all 6 quest services/systems', () => {
        registerQuestSystems(mockContainer);

        expect(mockContainer.register).toHaveBeenCalledTimes(questTokens.length + 1); // +1 for ILogger

        questTokens.forEach(token => {
            expect(mockContainer.register).toHaveBeenCalledWith(
                token,
                expect.any(Function), // All registered via factories/single
                expect.objectContaining({lifecycle: 'singleton'})
            );
        });
    });

    it(`should tag ${initializableQuestTokens.length} systems with '${INITIALIZABLE[0]}'`, () => {
        registerQuestSystems(mockContainer);

        initializableQuestTokens.forEach(token => {
            expect(mockContainer.register).toHaveBeenCalledWith(
                token,
                expect.any(Function),
                expect.objectContaining({
                    tags: expect.arrayContaining(INITIALIZABLE),
                    lifecycle: 'singleton'
                })
            );
        });
    });

    it(`should NOT tag ${nonInitializableQuestTokens.length} services with '${INITIALIZABLE[0]}'`, () => {
        registerQuestSystems(mockContainer);

        nonInitializableQuestTokens.forEach(token => {
            // Need to find the specific call for this token
            const registrationCall = mockContainer.register.mock.calls.find(call => call[0] === token);
            expect(registrationCall).toBeDefined();
            // Check that tags array exists BUT does NOT contain INITIALIZABLE
            // Or, more simply, check if the options object *lacks* the tags array or the tag isn't in it
            const options = registrationCall[2];
            expect(options?.tags).not.toEqual(expect.arrayContaining(INITIALIZABLE));
            expect(options.lifecycle).toEqual('singleton'); // Still a singleton
        });
    });

    it('should log registration messages', () => {
        registerQuestSystems(mockContainer);

        expect(mockLogger.debug).toHaveBeenCalledWith('Quest Registration: Starting...');
        questTokens.forEach(token => {
            if (initializableQuestTokens.includes(token)) {
                expect(mockLogger.debug).toHaveBeenCalledWith(expect.stringContaining(`Registered ${String(token)} tagged with ${INITIALIZABLE[0]}`));
            } else {
                expect(mockLogger.debug).toHaveBeenCalledWith(expect.stringContaining(`Registered ${String(token)}.`));
            }
        });
        expect(mockLogger.info).toHaveBeenCalledWith(expect.stringContaining(`Quest Registration: Completed registering ${questTokens.length} quest services/systems.`));
    });


    it('should resolve QuestPrerequisiteService when QuestSystem is resolved', () => {
        // Arrange: Register necessary mocks for QuestSystem dependencies
        // Ensure ALL dependencies listed in QuestSystem's registration are mocked *and registered*
        mockContainer.register(tokens.EventBus, mockEventBus, {lifecycle: 'singleton'});
        mockContainer.register(tokens.EntityManager, mockEntityManager, {lifecycle: 'singleton'});
        mockContainer.register(tokens.GameStateManager, mockGameStateManager, {lifecycle: 'singleton'});
        mockContainer.register(tokens.QuestPrerequisiteService, mockQuestPrerequisiteService, {lifecycle: 'singleton'});
        mockContainer.register(tokens.QuestRewardService, mockQuestRewardService, {lifecycle: 'singleton'});
        mockContainer.register(tokens.ObjectiveEventListenerService, mockObjectiveEventListenerService, {lifecycle: 'singleton'});
        mockContainer.register(tokens.ObjectiveStateCheckerService, mockObjectiveStateCheckerService, {lifecycle: 'singleton'});
        // Register the *corrected* GameDataRepository mock
        mockContainer.register(tokens.GameDataRepository, mockGameDataRepository, {lifecycle: 'singleton'});
        // validatedEventDispatcher is needed by QuestRewardService factory, which is a dependency of QuestSystem factory
        mockContainer.register(tokens.ValidatedEventDispatcher, mockvalidatedEventDispatcher, {lifecycle: 'singleton'});

        // Call the registration function AFTER mocks are set up
        registerQuestSystems(mockContainer);

        // Spy on the container's resolve method *after* registration but *before* resolving QuestSystem
        const resolveSpy = jest.spyOn(mockContainer, 'resolve');

        // Act: Resolve QuestSystem, which should trigger its factory
        // This line should no longer throw the error about GameDataRepository
        const questSystemInstance = mockContainer.resolve(tokens.QuestSystem);

        // Assert: Check that the resolve spy was called with the dependency token
        // This assertion remains the primary goal of this specific test
        expect(resolveSpy).toHaveBeenCalledWith(tokens.QuestPrerequisiteService);

        // Also check other dependencies were resolved implicitly if needed for confidence
        expect(resolveSpy).toHaveBeenCalledWith(tokens.GameDataRepository); // Should have been called by the factory now
        expect(resolveSpy).toHaveBeenCalledWith(tokens.QuestRewardService);
        expect(resolveSpy).toHaveBeenCalledWith(tokens.EventBus);
        expect(resolveSpy).toHaveBeenCalledWith(tokens.EntityManager);
        expect(resolveSpy).toHaveBeenCalledWith(tokens.GameStateManager);
        expect(resolveSpy).toHaveBeenCalledWith(tokens.ObjectiveEventListenerService);
        expect(resolveSpy).toHaveBeenCalledWith(tokens.ObjectiveStateCheckerService);
        // Note: validatedEventDispatcher is resolved *indirectly* when QuestRewardService is resolved by the factory.
        // Spying might not catch it unless the mock resolve explicitly tracks nested calls.
        // But checking the direct dependencies of QuestSystem is usually sufficient here.

        expect(questSystemInstance).toBeDefined(); // Ensure resolution didn't fail overall

        // Cleanup spy
        resolveSpy.mockRestore();
    });

    it('should match snapshot for registration calls', () => {
        registerQuestSystems(mockContainer);
        const callsToSnapshot = mockContainer.register.mock.calls.filter(
            (call) => call[0] !== tokens.ILogger // Exclude pre-registered logger
        );
        // Remember to update snapshot if this is the first run after fixing mocks or logic: jest --updateSnapshot
        expect(callsToSnapshot).toMatchSnapshot();
    });

});