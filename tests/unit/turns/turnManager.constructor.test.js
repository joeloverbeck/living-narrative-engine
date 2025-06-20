// src/tests/turns/turnManager.constructor.test.js
// --- FILE START ---

import { TurnManagerTestBed } from '../../common/turns/turnManagerTestBed.js';
import TurnManager from '../../../src/turns/turnManager.js';
import { beforeEach, describe, expect, it, jest, afterEach } from '@jest/globals'; // Use 'it' alias for test cases

// --- Test Suite ---

describe('TurnManager - Constructor Dependency Validation', () => {
  let testBed;
  let validOptions; // To hold the full set of valid options

  beforeEach(() => {
    testBed = new TurnManagerTestBed();

    // Prepare valid options object
    validOptions = {
      turnOrderService: testBed.mocks.turnOrderService,
      entityManager: testBed.mocks.entityManager,
      logger: testBed.mocks.logger,
      dispatcher: testBed.mocks.dispatcher,
      turnHandlerResolver: testBed.mocks.turnHandlerResolver,
    };

    // Spy on console.error for tests checking logger fallback
    jest.spyOn(console, 'error').mockImplementation(() => {});
  });

  afterEach(() => {
    // Restore console.error spy
    jest.restoreAllMocks();
    testBed.cleanup();
  });

  // --- Success Case ---

  it('should instantiate successfully with all valid dependencies', () => {
    let turnManager;
    expect(() => {
      turnManager = new TurnManager(validOptions);
    }).not.toThrow();

    expect(turnManager).toBeInstanceOf(TurnManager);
    expect(testBed.mocks.logger.info).toHaveBeenCalledTimes(0); // Called only once
    expect(turnManager.getCurrentActor()).toBeNull(); // Check initial state
    // isRunning is private, cannot check directly without hacks
  });

  // --- Dependency Validation Failure Cases ---

  // TurnOrderService
  it('should throw if turnOrderService is null or undefined', () => {
    const expectedErrorMsg =
      'TurnManager requires a valid ITurnOrderService instance.';
    const options = { ...validOptions, turnOrderService: null };
    expect(() => new TurnManager(options)).toThrow(expectedErrorMsg);
    // Constructor uses console.error for initial checks before logger is assigned
    expect(console.error).toHaveBeenCalledWith(expectedErrorMsg);
  });

  it('should throw if turnOrderService is invalid (missing required methods like clearCurrentRound)', () => {
    const invalidService = {
      ...testBed.mocks.turnOrderService,
      clearCurrentRound: undefined,
    };
    const options = { ...validOptions, turnOrderService: invalidService };
    const expectedErrorMsg =
      'TurnManager requires a valid ITurnOrderService instance.';
    expect(() => new TurnManager(options)).toThrow(expectedErrorMsg);
    expect(console.error).toHaveBeenCalledWith(expectedErrorMsg);
  });

  // EntityManager
  it('should throw if entityManager is null or undefined', () => {
    const expectedErrorMsg =
      'TurnManager requires a valid EntityManager instance.';
    const options = { ...validOptions, entityManager: null };
    expect(() => new TurnManager(options)).toThrow(expectedErrorMsg);
    expect(console.error).toHaveBeenCalledWith(expectedErrorMsg);
  });

  it('should throw if entityManager is invalid (missing getEntityInstance)', () => {
    const invalidManager = {
      ...testBed.mocks.entityManager,
      getEntityInstance: undefined,
    };
    const options = { ...validOptions, entityManager: invalidManager };
    const expectedErrorMsg =
      'TurnManager requires a valid EntityManager instance.';
    expect(() => new TurnManager(options)).toThrow(expectedErrorMsg);
    expect(console.error).toHaveBeenCalledWith(expectedErrorMsg);
  });

  // Logger
  it('should throw if logger is null or undefined', () => {
    const expectedErrorMsg = 'TurnManager requires a valid ILogger instance.';
    const options = { ...validOptions, logger: null };
    expect(() => new TurnManager(options)).toThrow(expectedErrorMsg);
    // Check console was used as fallback
    expect(console.error).toHaveBeenCalledWith(expectedErrorMsg);
  });

  it('should throw if logger is invalid (missing methods like info, warn, error, debug)', () => {
    const expectedErrorMsg = 'TurnManager requires a valid ILogger instance.';
    const invalidLogger = { error: jest.fn() }; // Missing info, warn, debug
    const options = { ...validOptions, logger: invalidLogger };
    expect(() => new TurnManager(options)).toThrow(expectedErrorMsg);
    expect(console.error).toHaveBeenCalledWith(expectedErrorMsg);

    // Test missing a different method
    const invalidLogger2 = {
      info: jest.fn(),
      warn: jest.fn(),
      debug: jest.fn(),
    }; // Missing error
    const options2 = { ...validOptions, logger: invalidLogger2 };
    expect(() => new TurnManager(options2)).toThrow(expectedErrorMsg);
    expect(console.error).toHaveBeenCalledWith(expectedErrorMsg); // Still uses console.error for initial check
  });

  // Dispatcher
  it('should throw if dispatcher is null or undefined', () => {
    const expectedErrorMsg =
      'TurnManager requires a valid IValidatedEventDispatcher instance (with dispatch and subscribe methods).';
    const options = { ...validOptions, dispatcher: null };
    expect(() => new TurnManager(options)).toThrow(expectedErrorMsg);
    // Logger is valid here, so check logger.error
    expect(testBed.mocks.logger.error).toHaveBeenCalledWith(expectedErrorMsg);
    // Verify console.error was NOT called for this specific check (since logger was valid)
    expect(console.error).not.toHaveBeenCalledWith(expectedErrorMsg);
  });

  it('should throw if dispatcher is invalid (missing dispatch)', () => {
    const invalidDispatcher = { subscribe: jest.fn(() => jest.fn()) }; // Missing dispatch
    const options = { ...validOptions, dispatcher: invalidDispatcher };
    const expectedErrorMsg =
      'TurnManager requires a valid IValidatedEventDispatcher instance (with dispatch and subscribe methods).';
    expect(() => new TurnManager(options)).toThrow(expectedErrorMsg);
    expect(testBed.mocks.logger.error).toHaveBeenCalledWith(expectedErrorMsg);
    expect(console.error).not.toHaveBeenCalledWith(expectedErrorMsg);
  });

  it('should throw if dispatcher is invalid (missing subscribe)', () => {
    const invalidDispatcher = { dispatch: jest.fn() }; // Missing subscribe
    const options = { ...validOptions, dispatcher: invalidDispatcher };
    const expectedErrorMsg =
      'TurnManager requires a valid IValidatedEventDispatcher instance (with dispatch and subscribe methods).';
    expect(() => new TurnManager(options)).toThrow(expectedErrorMsg);
    expect(testBed.mocks.logger.error).toHaveBeenCalledWith(expectedErrorMsg);
    expect(console.error).not.toHaveBeenCalledWith(expectedErrorMsg);
  });

  // TurnHandlerResolver
  it('should throw if turnHandlerResolver is null or undefined', () => {
    const expectedErrorMsg =
      'TurnManager requires a valid ITurnHandlerResolver instance (with resolveHandler method).';
    const options = { ...validOptions, turnHandlerResolver: null };
    expect(() => new TurnManager(options)).toThrow(expectedErrorMsg);
    expect(testBed.mocks.logger.error).toHaveBeenCalledWith(expectedErrorMsg);
    expect(console.error).not.toHaveBeenCalledWith(expectedErrorMsg);
  });

  it('should throw if turnHandlerResolver is invalid (missing resolveHandler)', () => {
    const invalidResolver = {}; // Missing resolveHandler
    const options = { ...validOptions, turnHandlerResolver: invalidResolver };
    const expectedErrorMsg =
      'TurnManager requires a valid ITurnHandlerResolver instance (with resolveHandler method).';
    expect(() => new TurnManager(options)).toThrow(expectedErrorMsg);
    expect(testBed.mocks.logger.error).toHaveBeenCalledWith(expectedErrorMsg);
    expect(console.error).not.toHaveBeenCalledWith(expectedErrorMsg);
  });

  // --- Edge Cases ---

  it('should handle empty options object gracefully', () => {
    const expectedErrorMsg =
      'TurnManager requires a valid ITurnOrderService instance.';
    expect(() => new TurnManager({})).toThrow(expectedErrorMsg);
    expect(console.error).toHaveBeenCalledWith(expectedErrorMsg);
  });

  it('should handle undefined options gracefully', () => {
    const expectedErrorMsg =
      'TurnManager requires a valid ITurnOrderService instance.';
    expect(() => new TurnManager(undefined)).toThrow(expectedErrorMsg);
    expect(console.error).toHaveBeenCalledWith(expectedErrorMsg);
  });

  it('should handle null options gracefully', () => {
    const expectedErrorMsg =
      'TurnManager requires a valid ITurnOrderService instance.';
    expect(() => new TurnManager(null)).toThrow(expectedErrorMsg);
    expect(console.error).toHaveBeenCalledWith(expectedErrorMsg);
  });
});
// --- FILE END ---
