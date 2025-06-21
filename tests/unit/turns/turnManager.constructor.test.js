// src/tests/turns/turnManager.constructor.test.js
// --- FILE START ---

import { describeTurnManagerSuite } from '../../common/turns/turnManagerTestBed.js';
import TurnManager from '../../../src/turns/turnManager.js';
import { beforeEach, expect, it, jest, afterEach } from '@jest/globals'; // Use 'it' alias for test cases

// --- Test Suite ---

describeTurnManagerSuite(
  'TurnManager - Constructor Dependency Validation',
  (getBed) => {
    let testBed;
    let validOptions; // To hold the full set of valid options

    beforeEach(() => {
      testBed = getBed();

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

    it.each([
      [
        'turnOrderService',
        null,
        'TurnManager requires a valid ITurnOrderService instance.',
        true,
      ],
      [
        'turnOrderService',
        () => ({
          ...testBed.mocks.turnOrderService,
          clearCurrentRound: undefined,
        }),
        'TurnManager requires a valid ITurnOrderService instance.',
        true,
      ],
      [
        'entityManager',
        null,
        'TurnManager requires a valid EntityManager instance.',
        true,
      ],
      [
        'entityManager',
        () => ({
          ...testBed.mocks.entityManager,
          getEntityInstance: undefined,
        }),
        'TurnManager requires a valid EntityManager instance.',
        true,
      ],
      ['logger', null, 'TurnManager requires a valid ILogger instance.', true],
      [
        'logger',
        () => ({ error: jest.fn() }),
        'TurnManager requires a valid ILogger instance.',
        true,
      ],
      [
        'logger',
        () => ({ info: jest.fn(), warn: jest.fn(), debug: jest.fn() }),
        'TurnManager requires a valid ILogger instance.',
        true,
      ],
      [
        'dispatcher',
        null,
        'TurnManager requires a valid IValidatedEventDispatcher instance (with dispatch and subscribe methods).',
        false,
      ],
      [
        'dispatcher',
        () => ({ subscribe: jest.fn(() => jest.fn()) }),
        'TurnManager requires a valid IValidatedEventDispatcher instance (with dispatch and subscribe methods).',
        false,
      ],
      [
        'dispatcher',
        () => ({ dispatch: jest.fn() }),
        'TurnManager requires a valid IValidatedEventDispatcher instance (with dispatch and subscribe methods).',
        false,
      ],
      [
        'turnHandlerResolver',
        null,
        'TurnManager requires a valid ITurnHandlerResolver instance (with resolveHandler method).',
        false,
      ],
      [
        'turnHandlerResolver',
        () => ({}),
        'TurnManager requires a valid ITurnHandlerResolver instance (with resolveHandler method).',
        false,
      ],
    ])(
      'should throw if %s is invalid',
      (optionKey, valueOrFactory, expectedErrorMsg, expectConsole) => {
        const value =
          typeof valueOrFactory === 'function'
            ? valueOrFactory()
            : valueOrFactory;
        const options = { ...validOptions, [optionKey]: value };
        expect(() => new TurnManager(options)).toThrow(expectedErrorMsg);

        const consoleCalled = console.error.mock.calls.some(
          ([msg]) => msg === expectedErrorMsg
        );
        const loggerCalled = testBed.mocks.logger.error.mock.calls.some(
          ([msg]) => msg === expectedErrorMsg
        );

        expect(consoleCalled).toBe(expectConsole);
        expect(loggerCalled).toBe(!expectConsole);
      }
    );

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
  }
);
// --- FILE END ---
