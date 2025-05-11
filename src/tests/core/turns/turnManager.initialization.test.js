// src/tests/core/turns/turnManager.initialization.test.js
// --- FILE START ---

import TurnManager from '../../../core/turns/turnManager.js';
import {ACTOR_COMPONENT_ID, PLAYER_COMPONENT_ID} from '../../../types/components.js';
import {TURN_ENDED_ID, SYSTEM_ERROR_OCCURRED_ID, TURN_STARTED_ID} from '../../../core/constants/eventIds.js';
import {beforeEach, describe, expect, jest, test} from "@jest/globals";

// --- Mock Implementations ---

class MockEntity {
    constructor(id, components = []) {
        this.id = id || `entity-${Math.random().toString(36).substr(2, 9)}`;
        this.components = new Map(components.map(c => [c, {}])); // Store components as a Map
        this.hasComponent = jest.fn((componentId) => this.components.has(componentId));
        this.getComponent = jest.fn((componentId) => this.components.get(componentId));
    }
}

const mockLogger = () => ({
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
    debug: jest.fn(),
    createChildLogger: jest.fn(() => mockLogger()), // For services that might create child loggers
});

const mockTurnOrderService = () => ({
    clearCurrentRound: jest.fn(async () => {
    }),
    isEmpty: jest.fn(async () => true),
    startNewRound: jest.fn(async () => {
    }),
    getNextEntity: jest.fn(async () => null),
    addEntity: jest.fn(),
    removeEntity: jest.fn(),
    peekNextEntity: jest.fn(async () => null),
    getCurrentOrder: jest.fn(() => []),
    size: jest.fn(() => 0),
});

const mockEntityManager = () => ({
    getEntityInstance: jest.fn((id) => new MockEntity(id)),
    activeEntities: new Map(), // Simulate active entities
    getEntitiesWithComponents: jest.fn(() => []), // Used by TurnOrderService in some setups
    createEntity: jest.fn(),
    destroyEntity: jest.fn(),
});

const mockValidatedEventDispatcher = () => ({
    dispatchValidated: jest.fn(async (eventName, payload) => true), // Assume successful dispatch
    subscribe: jest.fn((eventName, callback) => {
        // Store callback for potential manual invocation in tests
        // this.subscriptions = this.subscriptions || {};
        // this.subscriptions[eventName] = callback;
        return jest.fn(); // Return an unsubscribe function
    }),
    unsubscribe: jest.fn(), // Though subscribe usually returns the unsub function
});

const mockTurnHandlerResolver = () => ({
    resolveHandler: jest.fn(async (actor) => new MockTurnHandler(actor)), // Default to returning a mock handler
});

class MockTurnHandler {
    constructor(actor) {
        this.actor = actor;
        this.startTurn = jest.fn(async (currentActor) => {
        });
        this.destroy = jest.fn(async () => {
        });
        this.signalNormalApparentTermination = jest.fn();
    }
}


describe('TurnManager - Initialization', () => {
    let validOptions;
    let logger;
    let turnOrderService;
    let entityManager;
    let dispatcher;
    let turnHandlerResolver;

    beforeEach(() => {
        logger = mockLogger();
        turnOrderService = mockTurnOrderService();
        entityManager = mockEntityManager();
        dispatcher = mockValidatedEventDispatcher();
        turnHandlerResolver = mockTurnHandlerResolver();

        validOptions = {
            turnOrderService,
            entityManager,
            logger,
            dispatcher,
            turnHandlerResolver,
        };
    });

    test('TurnManager constructor success with valid dependencies', () => {
        let turnManager;
        expect(() => {
            turnManager = new TurnManager(validOptions);
        }).not.toThrow();

        expect(turnManager).toBeInstanceOf(TurnManager);
        expect(logger.info).toHaveBeenCalledWith('TurnManager initialized successfully.');
        expect(turnManager.getCurrentActor()).toBeNull();
        expect(turnManager.getActiveTurnHandler()).toBeNull();
        // isRunning is not directly exposed, but internal state should be correct
    });

    test('TurnManager constructor throws error if turnOrderService is missing', () => {
        const options = {...validOptions, turnOrderService: null};
        expect(() => new TurnManager(options)).toThrow('TurnManager requires a valid ITurnOrderService instance.');
        // Logger might not be called if error is thrown before this.logger is set, depends on constructor order.
        // However, the console.error inside the constructor should be called.
    });

    test('TurnManager constructor throws error if entityManager is missing', () => {
        const options = {...validOptions, entityManager: null};
        expect(() => new TurnManager(options)).toThrow('TurnManager requires a valid EntityManager instance.');
    });

    test('TurnManager constructor throws error if logger is missing or invalid', () => {
        const consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation(() => {
        });
        expect(() => new TurnManager({
            ...validOptions,
            logger: null
        })).toThrow('TurnManager requires a valid ILogger instance.');

        const invalidLogger = {...mockLogger(), info: undefined}; // Missing a required method
        expect(() => new TurnManager({
            ...validOptions,
            logger: invalidLogger
        })).toThrow('TurnManager requires a valid ILogger instance.');
        consoleErrorSpy.mockRestore();
    });

    test('TurnManager constructor throws error if dispatcher is missing or invalid', () => {
        expect(() => new TurnManager({
            ...validOptions,
            dispatcher: null
        })).toThrow('TurnManager requires a valid IValidatedEventDispatcher instance (with dispatchValidated and subscribe methods).');

        const invalidDispatcher = {...mockValidatedEventDispatcher(), subscribe: undefined};
        expect(() => new TurnManager({
            ...validOptions,
            dispatcher: invalidDispatcher
        })).toThrow('TurnManager requires a valid IValidatedEventDispatcher instance (with dispatchValidated and subscribe methods).');
    });

    test('TurnManager constructor throws error if turnHandlerResolver is missing or invalid', () => {
        expect(() => new TurnManager({
            ...validOptions,
            turnHandlerResolver: null
        })).toThrow('TurnManager requires a valid ITurnHandlerResolver instance (with resolveHandler method).');

        const invalidResolver = {...mockTurnHandlerResolver(), resolveHandler: undefined};
        expect(() => new TurnManager({
            ...validOptions,
            turnHandlerResolver: invalidResolver
        })).toThrow('TurnManager requires a valid ITurnHandlerResolver instance (with resolveHandler method).');
    });

    test('TurnManager constructor logs error using console if logger is invalid then throws', () => {
        const consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation(() => {
        });
        const options = {
            turnOrderService,
            entityManager,
            logger: {info: 'not a function'}, // Invalid logger
            dispatcher,
            turnHandlerResolver
        };
        expect(() => new TurnManager(options)).toThrow('TurnManager requires a valid ILogger instance.');
        expect(consoleErrorSpy).toHaveBeenCalledWith('TurnManager requires a valid ILogger instance.'); // Initial check in constructor
        consoleErrorSpy.mockRestore();
    });

    test('TurnManager constructor logs error using provided logger if other dependencies are invalid', () => {
        const options = {
            turnOrderService: null, // Invalid
            entityManager,
            logger, // Valid logger
            dispatcher,
            turnHandlerResolver
        };
        expect(() => new TurnManager(options)).toThrow('TurnManager requires a valid ITurnOrderService instance.');
        // The constructor itself uses console.error for its own checks before this.logger is assigned.
        // If we want to test logger.error, the dependency must fail *after* this.logger = logger.
        // The checks are ordered, so turnOrderService is checked first.

        // Let's test a dependency checked *after* logger assignment, e.g. dispatcher
        const optionsWithBadDispatcher = {
            turnOrderService,
            entityManager,
            logger, // Valid logger
            dispatcher: {subscribe: 'not a function'}, // Invalid dispatcher
            turnHandlerResolver
        };
        expect(() => new TurnManager(optionsWithBadDispatcher)).toThrow('TurnManager requires a valid IValidatedEventDispatcher instance (with dispatchValidated and subscribe methods).');
        expect(logger.error).toHaveBeenCalledWith('TurnManager requires a valid IValidatedEventDispatcher instance (with dispatchValidated and subscribe methods).');
    });
});

// --- FILE END ---