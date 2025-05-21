// src/tests/core/turns/turnManager.constructor.test.js
// --- FILE START ---

import TurnManager from '../../src/turns/turnManager.js';
import {ACTOR_COMPONENT_ID, PLAYER_COMPONENT_ID} from '../../src/constants/componentIds.js'; // Keep if mock entities are used
import {beforeEach, describe, expect, it, jest} from "@jest/globals"; // Use 'it' alias for test cases

// --- Mock Setup ---

// Helper function to create a full set of valid mocks with required methods
const createValidMocks = () => ({
    turnOrderService: {
        isEmpty: jest.fn(),
        startNewRound: jest.fn(),
        getNextEntity: jest.fn(),
        clearCurrentRound: jest.fn(),
        peekNextEntity: jest.fn(),
        addEntity: jest.fn(),
        removeEntity: jest.fn(),
        getCurrentOrder: jest.fn(),
        size: jest.fn(), // Include methods checked implicitly or explicitly
    },
    entityManager: {
        // Mock activeEntities getter if needed for validation, otherwise just methods
        get activeEntities() {
            return this._mockActiveEntities;
        },
        _mockActiveEntities: new Map(), // Example internal state
        getEntityInstance: jest.fn(), // Method checked by TurnManager constructor
        // Add other methods if TurnManager constructor directly checks them
        getEntitiesWithComponents: jest.fn(),
    },
    logger: {
        info: jest.fn(),
        warn: jest.fn(),
        error: jest.fn(),
        debug: jest.fn(),
        createChildLogger: jest.fn(() => createValidMocks().logger), // Allow child logger creation if needed
    },
    dispatcher: {
        dispatchValidated: jest.fn(),
        subscribe: jest.fn(() => jest.fn()), // subscribe returns an unsubscribe function
    },
    turnHandlerResolver: {
        resolveHandler: jest.fn(), // Method checked by TurnManager constructor
    }
});

// Variables to hold mocks accessible in tests
let mockTurnOrderService;
let mockEntityManager;
let mockLogger;
let mockDispatcher;
let mockTurnHandlerResolver;
let validOptions; // To hold the full set of valid options

// --- Test Suite ---

describe('TurnManager - Constructor Dependency Validation', () => {

    beforeEach(() => {
        // Create fresh mocks for each test run
        const mocks = createValidMocks();
        mockTurnOrderService = mocks.turnOrderService;
        mockEntityManager = mocks.entityManager;
        mockLogger = mocks.logger;
        mockDispatcher = mocks.dispatcher;
        mockTurnHandlerResolver = mocks.turnHandlerResolver;

        // Prepare valid options object
        validOptions = {
            turnOrderService: mockTurnOrderService,
            entityManager: mockEntityManager,
            logger: mockLogger,
            dispatcher: mockDispatcher,
            turnHandlerResolver: mockTurnHandlerResolver,
        };

        // Spy on console.error for tests checking logger fallback
        jest.spyOn(console, 'error').mockImplementation(() => {
        });
    });

    afterEach(() => {
        // Restore console.error spy
        jest.restoreAllMocks();
    });

    // --- Success Case ---

    it('should instantiate successfully with all valid dependencies', () => {
        let turnManager;
        expect(() => {
            turnManager = new TurnManager(validOptions);
        }).not.toThrow();

        expect(turnManager).toBeInstanceOf(TurnManager);
        expect(mockLogger.info).toHaveBeenCalledWith('TurnManager initialized successfully.');
        expect(mockLogger.info).toHaveBeenCalledTimes(1); // Called only once
        expect(turnManager.getCurrentActor()).toBeNull(); // Check initial state
        // isRunning is private, cannot check directly without hacks
    });

    // --- Dependency Validation Failure Cases ---

    // TurnOrderService
    it('should throw if turnOrderService is null or undefined', () => {
        const expectedErrorMsg = 'TurnManager requires a valid ITurnOrderService instance.';
        const options = {...validOptions, turnOrderService: null};
        expect(() => new TurnManager(options)).toThrow(expectedErrorMsg);
        // Constructor uses console.error for initial checks before logger is assigned
        expect(console.error).toHaveBeenCalledWith(expectedErrorMsg);
    });

    it('should throw if turnOrderService is invalid (missing required methods like clearCurrentRound)', () => {
        const invalidService = {...mockTurnOrderService, clearCurrentRound: undefined};
        const options = {...validOptions, turnOrderService: invalidService};
        const expectedErrorMsg = 'TurnManager requires a valid ITurnOrderService instance.';
        expect(() => new TurnManager(options)).toThrow(expectedErrorMsg);
        expect(console.error).toHaveBeenCalledWith(expectedErrorMsg);
    });

    // EntityManager
    it('should throw if entityManager is null or undefined', () => {
        const expectedErrorMsg = 'TurnManager requires a valid EntityManager instance.';
        const options = {...validOptions, entityManager: null};
        expect(() => new TurnManager(options)).toThrow(expectedErrorMsg);
        expect(console.error).toHaveBeenCalledWith(expectedErrorMsg);
    });

    it('should throw if entityManager is invalid (missing getEntityInstance)', () => {
        const invalidManager = {...mockEntityManager, getEntityInstance: undefined};
        const options = {...validOptions, entityManager: invalidManager};
        const expectedErrorMsg = 'TurnManager requires a valid EntityManager instance.';
        expect(() => new TurnManager(options)).toThrow(expectedErrorMsg);
        expect(console.error).toHaveBeenCalledWith(expectedErrorMsg);
    });

    // Logger
    it('should throw if logger is null or undefined', () => {
        const expectedErrorMsg = 'TurnManager requires a valid ILogger instance.';
        const options = {...validOptions, logger: null};
        expect(() => new TurnManager(options)).toThrow(expectedErrorMsg);
        // Check console was used as fallback
        expect(console.error).toHaveBeenCalledWith(expectedErrorMsg);
    });

    it('should throw if logger is invalid (missing methods like info, warn, error, debug)', () => {
        const expectedErrorMsg = 'TurnManager requires a valid ILogger instance.';
        const invalidLogger = {error: jest.fn()}; // Missing info, warn, debug
        const options = {...validOptions, logger: invalidLogger};
        expect(() => new TurnManager(options)).toThrow(expectedErrorMsg);
        expect(console.error).toHaveBeenCalledWith(expectedErrorMsg);

        // Test missing a different method
        const invalidLogger2 = {info: jest.fn(), warn: jest.fn(), debug: jest.fn()}; // Missing error
        const options2 = {...validOptions, logger: invalidLogger2};
        expect(() => new TurnManager(options2)).toThrow(expectedErrorMsg);
        expect(console.error).toHaveBeenCalledWith(expectedErrorMsg); // Still uses console.error for initial check
    });

    // Dispatcher
    it('should throw if dispatcher is null or undefined', () => {
        const expectedErrorMsg = 'TurnManager requires a valid IValidatedEventDispatcher instance (with dispatchValidated and subscribe methods).';
        const options = {...validOptions, dispatcher: null};
        expect(() => new TurnManager(options)).toThrow(expectedErrorMsg);
        // Logger is valid here, so check logger.error
        expect(mockLogger.error).toHaveBeenCalledWith(expectedErrorMsg);
        // Verify console.error was NOT called for this specific check (since logger was valid)
        expect(console.error).not.toHaveBeenCalledWith(expectedErrorMsg);
    });

    it('should throw if dispatcher is invalid (missing dispatchValidated)', () => {
        const invalidDispatcher = {subscribe: jest.fn(() => jest.fn())}; // Missing dispatchValidated
        const options = {...validOptions, dispatcher: invalidDispatcher};
        const expectedErrorMsg = 'TurnManager requires a valid IValidatedEventDispatcher instance (with dispatchValidated and subscribe methods).';
        expect(() => new TurnManager(options)).toThrow(expectedErrorMsg);
        expect(mockLogger.error).toHaveBeenCalledWith(expectedErrorMsg);
        expect(console.error).not.toHaveBeenCalledWith(expectedErrorMsg);
    });

    it('should throw if dispatcher is invalid (missing subscribe)', () => {
        const invalidDispatcher = {dispatchValidated: jest.fn()}; // Missing subscribe
        const options = {...validOptions, dispatcher: invalidDispatcher};
        const expectedErrorMsg = 'TurnManager requires a valid IValidatedEventDispatcher instance (with dispatchValidated and subscribe methods).';
        expect(() => new TurnManager(options)).toThrow(expectedErrorMsg);
        expect(mockLogger.error).toHaveBeenCalledWith(expectedErrorMsg);
        expect(console.error).not.toHaveBeenCalledWith(expectedErrorMsg);
    });

    // TurnHandlerResolver
    it('should throw if turnHandlerResolver is null or undefined', () => {
        const expectedErrorMsg = 'TurnManager requires a valid ITurnHandlerResolver instance (with resolveHandler method).';
        const options = {...validOptions, turnHandlerResolver: null};
        expect(() => new TurnManager(options)).toThrow(expectedErrorMsg);
        // Logger and Dispatcher are valid here, so check logger.error
        expect(mockLogger.error).toHaveBeenCalledWith(expectedErrorMsg);
        expect(console.error).not.toHaveBeenCalledWith(expectedErrorMsg);
    });

    it('should throw if turnHandlerResolver is invalid (missing resolveHandler)', () => {
        const invalidResolver = {someOtherMethod: jest.fn()}; // Missing resolveHandler
        const options = {...validOptions, turnHandlerResolver: invalidResolver};
        const expectedErrorMsg = 'TurnManager requires a valid ITurnHandlerResolver instance (with resolveHandler method).';
        expect(() => new TurnManager(options)).toThrow(expectedErrorMsg);
        expect(mockLogger.error).toHaveBeenCalledWith(expectedErrorMsg);
        expect(console.error).not.toHaveBeenCalledWith(expectedErrorMsg);
    });

});
// --- FILE END ---