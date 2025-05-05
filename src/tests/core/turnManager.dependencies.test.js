// src/tests/core/turnManager.dependencies.test.js
// --- FILE START (Corrected) ---

import TurnManager from '../../core/turnManager.js'; // Adjust path as needed
import {beforeEach, describe, expect, it, jest} from '@jest/globals'; // Or equivalent import for your test runner

// Mock dependencies (Define ONCE at the top)
let mockTurnOrderService;
let mockEntityManager;
let mockLogger;
let mockDispatcher;
let mockTurnHandlerResolver;

describe('TurnManager Constructor Dependency Validation', () => { // Renamed describe for clarity

    // Reset and re-initialize mocks before each test
    beforeEach(() => {
        mockTurnOrderService = {
            clearCurrentRound: jest.fn().mockResolvedValue(undefined),
            isEmpty: jest.fn().mockResolvedValue(true),
            getNextEntity: jest.fn().mockResolvedValue(null),
            startNewRound: jest.fn().mockResolvedValue(undefined),
            // Add other methods if TurnManager constructor checks them
            peekNextEntity: jest.fn(),
            addEntity: jest.fn(),
            removeEntity: jest.fn(),
            getCurrentOrder: jest.fn(),
        };

        mockEntityManager = {
            getEntityInstance: jest.fn().mockReturnValue(null),
            activeEntities: new Map(),
            // Add other methods if TurnManager constructor checks them
            createEntityInstance: jest.fn(),
            addComponent: jest.fn(),
            removeComponent: jest.fn(),
            getComponentData: jest.fn(),
            hasComponent: jest.fn(),
            removeEntityInstance: jest.fn(),
            getEntitiesInLocation: jest.fn(),
            buildInitialSpatialIndex: jest.fn(),
            clearAll: jest.fn(),
        };

        mockLogger = {
            info: jest.fn(),
            warn: jest.fn(),
            error: jest.fn(),
            debug: jest.fn(),
        };

        // *** FIXED: Add subscribe method to mockDispatcher definition ***
        mockDispatcher = {
            dispatchValidated: jest.fn().mockResolvedValue(undefined),
            subscribe: jest.fn(() => jest.fn()), // subscribe returns unsubscribe
        };

        mockTurnHandlerResolver = {
            resolveHandler: jest.fn().mockResolvedValue(null), // Correct method name mock
        };

        // Clear any previous mock calls
        jest.clearAllMocks();
    });

    // --- Test successful construction ---
    // *** Combined/Corrected the successful construction test ***
    it('should construct successfully with all valid dependencies', () => {
        // *** This should now pass as mockDispatcher includes 'subscribe' ***
        expect(() => new TurnManager({
            turnOrderService: mockTurnOrderService,
            entityManager: mockEntityManager,
            logger: mockLogger,
            dispatcher: mockDispatcher,           // Correct mock used
            turnHandlerResolver: mockTurnHandlerResolver, // Correct mock used
        })).not.toThrow();

        expect(mockLogger.info).toHaveBeenCalledWith('TurnManager initialized successfully.');
    });

    // --- Test missing/invalid dependencies ---

    // TurnOrderService Tests (Unchanged)
    it('should throw error if turnOrderService is missing', () => {
        const expectedMsg = 'TurnManager requires a valid ITurnOrderService instance.';
        expect(() => new TurnManager({
            // turnOrderService: missing
            entityManager: mockEntityManager,
            logger: mockLogger,
            dispatcher: mockDispatcher,
            turnHandlerResolver: mockTurnHandlerResolver,
        })).toThrow(expectedMsg);
    });

    it('should throw error if turnOrderService is invalid (missing methods)', () => {
        const expectedMsg = 'TurnManager requires a valid ITurnOrderService instance.';
        expect(() => new TurnManager({
            turnOrderService: {}, // Invalid object
            entityManager: mockEntityManager,
            logger: mockLogger,
            dispatcher: mockDispatcher,
            turnHandlerResolver: mockTurnHandlerResolver,
        })).toThrow(expectedMsg);
    });

    // EntityManager Tests (Unchanged)
    it('should throw error if entityManager is missing', () => {
        const expectedMsg = 'TurnManager requires a valid EntityManager instance.';
        expect(() => new TurnManager({
            turnOrderService: mockTurnOrderService,
            // entityManager: missing
            logger: mockLogger,
            dispatcher: mockDispatcher,
            turnHandlerResolver: mockTurnHandlerResolver,
        })).toThrow(expectedMsg);
    });

    it('should throw error if entityManager is invalid (missing methods)', () => {
        const expectedMsg = 'TurnManager requires a valid EntityManager instance.';
        expect(() => new TurnManager({
            turnOrderService: mockTurnOrderService,
            entityManager: {}, // Invalid object
            logger: mockLogger,
            dispatcher: mockDispatcher,
            turnHandlerResolver: mockTurnHandlerResolver,
        })).toThrow(expectedMsg);
    });

    // Logger Tests (Unchanged, assuming console spy logic is correct)
    it('should throw error if logger is missing', () => {
        const consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation(() => {});
        const expectedMsg = 'TurnManager requires a valid ILogger instance.';
        expect(() => new TurnManager({
            turnOrderService: mockTurnOrderService,
            entityManager: mockEntityManager,
            // logger: missing
            dispatcher: mockDispatcher,
            turnHandlerResolver: mockTurnHandlerResolver,
        })).toThrow(expectedMsg);
        expect(consoleErrorSpy).toHaveBeenCalledWith(expectedMsg);
        consoleErrorSpy.mockRestore();
    });

    it('should throw error if logger is invalid (missing methods)', () => {
        const consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation(() => {});
        const expectedMsg = 'TurnManager requires a valid ILogger instance.';
        expect(() => new TurnManager({
            turnOrderService: mockTurnOrderService,
            entityManager: mockEntityManager,
            logger: { info: jest.fn() }, // Missing warn/error/debug
            dispatcher: mockDispatcher,
            turnHandlerResolver: mockTurnHandlerResolver,
        })).toThrow(expectedMsg);
        expect(consoleErrorSpy).toHaveBeenCalledWith(expectedMsg);
        consoleErrorSpy.mockRestore();
    });

    // Dispatcher Tests (Corrected and Added)
    it('should throw error if dispatcher is missing', () => {
        // *** FIXED: Expected error message ***
        const expectedMsg = 'TurnManager requires a valid IValidatedEventDispatcher instance (with dispatchValidated and subscribe methods).';
        expect(() => new TurnManager({
            turnOrderService: mockTurnOrderService,
            entityManager: mockEntityManager,
            logger: mockLogger,
            // dispatcher: missing
            turnHandlerResolver: mockTurnHandlerResolver,
        })).toThrow(expectedMsg);
        // Check logger.error call (since logger is provided and valid here)
        expect(mockLogger.error).toHaveBeenCalledWith(expectedMsg);
    });

    // *** FIXED: Test logic for invalid dispatcher and expected message ***
    it('should throw error if dispatcher is invalid (missing dispatchValidated)', () => {
        const invalidDispatcher = { subscribe: jest.fn(() => jest.fn()) }; // Has subscribe, missing dispatchValidated
        const expectedMsg = 'TurnManager requires a valid IValidatedEventDispatcher instance (with dispatchValidated and subscribe methods).';
        expect(() => new TurnManager({
            turnOrderService: mockTurnOrderService,
            entityManager: mockEntityManager,
            logger: mockLogger,
            dispatcher: invalidDispatcher,
            turnHandlerResolver: mockTurnHandlerResolver,
        })).toThrow(expectedMsg);
        expect(mockLogger.error).toHaveBeenCalledWith(expectedMsg);
    });

    // *** ADDED: Test case for missing subscribe ***
    it('should throw error if dispatcher is invalid (missing subscribe)', () => {
        const invalidDispatcher = { dispatchValidated: jest.fn() }; // Has dispatchValidated, missing subscribe
        const expectedMsg = 'TurnManager requires a valid IValidatedEventDispatcher instance (with dispatchValidated and subscribe methods).';
        expect(() => new TurnManager({
            turnOrderService: mockTurnOrderService,
            entityManager: mockEntityManager,
            logger: mockLogger,
            dispatcher: invalidDispatcher,
            turnHandlerResolver: mockTurnHandlerResolver,
        })).toThrow(expectedMsg);
        expect(mockLogger.error).toHaveBeenCalledWith(expectedMsg);
    });


    // TurnHandlerResolver Tests (Corrected assertions and preconditions)
    it('should throw error if turnHandlerResolver is missing', () => {
        // *** This should now pass the dispatcher check first ***
        const expectedErrorMsgRegex = /requires a valid ITurnHandlerResolver instance \(with resolveHandler method\)/;
        expect(() => new TurnManager({
            turnOrderService: mockTurnOrderService,
            entityManager: mockEntityManager,
            logger: mockLogger,
            dispatcher: mockDispatcher, // Valid dispatcher
            // turnHandlerResolver: missing
        })).toThrow(expectedErrorMsgRegex);
        // Check if logger.error was called with the correct message part
        expect(mockLogger.error).toHaveBeenCalledWith(expect.stringContaining('requires a valid ITurnHandlerResolver instance (with resolveHandler method)'));
    });

    it('should throw error if turnHandlerResolver is invalid (missing resolveHandler method)', () => {
        // *** This should now pass the dispatcher check first ***
        // *** FIXED: Regex and stringContaining to match exact error message ***
        const expectedErrorMsgRegex = /requires a valid ITurnHandlerResolver instance \(with resolveHandler method\)/;
        const expectedLogMsgPart = 'requires a valid ITurnHandlerResolver instance (with resolveHandler method)';
        expect(() => new TurnManager({
            turnOrderService: mockTurnOrderService,
            entityManager: mockEntityManager,
            logger: mockLogger,
            dispatcher: mockDispatcher, // Valid dispatcher
            turnHandlerResolver: {}, // Invalid object missing 'resolveHandler'
        })).toThrow(expectedErrorMsgRegex);
        // Check if logger.error was called with the correct message part
        expect(mockLogger.error).toHaveBeenCalledWith(expect.stringContaining(expectedLogMsgPart));
    });

    // *** REMOVED Duplicate successful construction test ***

});
// --- FILE END ---