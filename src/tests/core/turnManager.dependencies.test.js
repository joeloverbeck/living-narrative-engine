// src/tests/core/turnManager.dependencies.test.js
// --- FILE START (Corrected - Duplicates Removed) ---

import TurnManager from '../../core/turnManager.js'; // Adjust path as needed
import {beforeEach, describe, expect, it, jest} from '@jest/globals'; // Or equivalent import for your test runner

// Mock dependencies
const mockTurnOrderService = {
    clearCurrentRound: jest.fn().mockResolvedValue(undefined),
    isEmpty: jest.fn().mockResolvedValue(true),
    getNextEntity: jest.fn().mockResolvedValue(null),
    startNewRound: jest.fn().mockResolvedValue(undefined),
};

const mockEntityManager = {
    getEntityInstance: jest.fn().mockReturnValue(null),
    activeEntities: new Map(),
};

const mockLogger = {
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
    debug: jest.fn(),
};

const mockDispatcher = {
    dispatchValidated: jest.fn().mockResolvedValue(undefined),
};

const mockTurnHandlerResolver = {
    resolveHandler: jest.fn().mockResolvedValue(null), // Correct method name mock
};


describe('TurnManager', () => {

    // Reset mocks before each test
    beforeEach(() => {
        jest.clearAllMocks();
    });

    it('should construct successfully with all valid dependencies', () => {
        expect(() => new TurnManager({
            turnOrderService: mockTurnOrderService,
            entityManager: mockEntityManager,
            logger: mockLogger,
            dispatcher: mockDispatcher,
            turnHandlerResolver: mockTurnHandlerResolver, // Pass the valid mock
        })).not.toThrow();

        expect(mockLogger.info).toHaveBeenCalledWith('TurnManager initialized successfully.');
    });

    // --- Test missing/invalid dependencies ---

    it('should throw error if turnOrderService is missing', () => {
        expect(() => new TurnManager({
            // turnOrderService: missing
            entityManager: mockEntityManager,
            logger: mockLogger,
            dispatcher: mockDispatcher,
            turnHandlerResolver: mockTurnHandlerResolver,
        })).toThrow('TurnManager requires a valid ITurnOrderService instance.');
    });

    it('should throw error if turnOrderService is invalid (missing methods)', () => {
        expect(() => new TurnManager({
            turnOrderService: {}, // Invalid object
            entityManager: mockEntityManager,
            logger: mockLogger,
            dispatcher: mockDispatcher,
            turnHandlerResolver: mockTurnHandlerResolver,
        })).toThrow('TurnManager requires a valid ITurnOrderService instance.');
    });

    it('should throw error if entityManager is missing', () => {
        expect(() => new TurnManager({
            turnOrderService: mockTurnOrderService,
            // entityManager: missing
            logger: mockLogger,
            dispatcher: mockDispatcher,
            turnHandlerResolver: mockTurnHandlerResolver,
        })).toThrow('TurnManager requires a valid EntityManager instance.');
    });

    it('should throw error if entityManager is invalid (missing methods)', () => {
        expect(() => new TurnManager({
            turnOrderService: mockTurnOrderService,
            entityManager: {}, // Invalid object
            logger: mockLogger,
            dispatcher: mockDispatcher,
            turnHandlerResolver: mockTurnHandlerResolver,
        })).toThrow('TurnManager requires a valid EntityManager instance.');
    });

    it('should throw error if logger is missing', () => {
        expect(() => new TurnManager({
            turnOrderService: mockTurnOrderService,
            entityManager: mockEntityManager,
            // logger: missing
            dispatcher: mockDispatcher,
            turnHandlerResolver: mockTurnHandlerResolver,
        })).toThrow('TurnManager requires a valid ILogger instance.');
    });

    it('should throw error if logger is invalid (missing methods)', () => {
        expect(() => new TurnManager({
            turnOrderService: mockTurnOrderService,
            entityManager: mockEntityManager,
            logger: { info: jest.fn() }, // Missing warn/error
            dispatcher: mockDispatcher,
            turnHandlerResolver: mockTurnHandlerResolver,
        })).toThrow('TurnManager requires a valid ILogger instance.');
    });

    it('should throw error if dispatcher is missing', () => {
        expect(() => new TurnManager({
            turnOrderService: mockTurnOrderService,
            entityManager: mockEntityManager,
            logger: mockLogger,
            // dispatcher: missing
            turnHandlerResolver: mockTurnHandlerResolver,
        })).toThrow('TurnManager requires a valid IValidatedEventDispatcher instance.');
        // Check logger.error call (since logger is provided and valid here)
        expect(mockLogger.error).toHaveBeenCalledWith('TurnManager requires a valid IValidatedEventDispatcher instance.');
    });

    it('should throw error if dispatcher is invalid (missing methods)', () => {
        expect(() => new TurnManager({
            turnOrderService: mockTurnOrderService,
            entityManager: mockEntityManager,
            logger: mockLogger,
            dispatcher: {}, // Invalid object
            turnHandlerResolver: mockTurnHandlerResolver,
        })).toThrow('TurnManager requires a valid IValidatedEventDispatcher instance.');
        expect(mockLogger.error).toHaveBeenCalledWith('TurnManager requires a valid IValidatedEventDispatcher instance.');
    });

    // --- Test turnHandlerResolver specifically (Removed duplicates) ---

    it('should throw error if turnHandlerResolver is missing', () => {
        expect(() => new TurnManager({
            turnOrderService: mockTurnOrderService,
            entityManager: mockEntityManager,
            logger: mockLogger,
            dispatcher: mockDispatcher,
            // turnHandlerResolver: missing
        })).toThrow(/requires a valid ITurnHandlerResolver instance/); // Use regex for flexibility
        // Check if logger.error was called with the correct message part
        expect(mockLogger.error).toHaveBeenCalledWith(expect.stringContaining('requires a valid ITurnHandlerResolver instance'));
    });

    it('should throw error if turnHandlerResolver is invalid (missing resolveHandler method)', () => {
        expect(() => new TurnManager({
            turnOrderService: mockTurnOrderService,
            entityManager: mockEntityManager,
            logger: mockLogger,
            dispatcher: mockDispatcher,
            turnHandlerResolver: {}, // Invalid object missing 'resolveHandler'
        })).toThrow(/requires a valid ITurnHandlerResolver instance \(with resolveHandler method\)/); // Expect the NEW specific message
        // Check if logger.error was called with the new message
        expect(mockLogger.error).toHaveBeenCalledWith(expect.stringContaining('requires a valid ITurnHandlerResolver instance (with resolveHandler method)'));
    });

    // --- Test successful construction again (Removed duplicate) ---

    it('should construct successfully with all valid dependencies (including valid resolver)', () => {
        expect(() => new TurnManager({
            turnOrderService: mockTurnOrderService,
            entityManager: mockEntityManager,
            logger: mockLogger,
            dispatcher: mockDispatcher,
            turnHandlerResolver: mockTurnHandlerResolver, // Use the mock with .resolveHandler
        })).not.toThrow();

        expect(mockLogger.info).toHaveBeenCalledWith('TurnManager initialized successfully.');
    });

});
// --- FILE END ---