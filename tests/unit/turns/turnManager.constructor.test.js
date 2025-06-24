// src/tests/turns/turnManager.constructor.test.js
// --- FILE START ---

import {
  describeTurnManagerSuite,
  TurnManagerTestBed,
} from '../../common/turns/turnManagerTestBed.js';
import TurnManager from '../../../src/turns/turnManager.js';
import { beforeEach, expect, it } from '@jest/globals'; // Use 'it' alias for test cases
import { describeConstructorValidation } from '../../common/constructorValidationHelpers.js';

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

    /**
     *
     */
    function createDeps() {
      const bed = new TurnManagerTestBed();
      return bed.mocks;
    }

    const dependencySpec = {
      turnOrderService: {
        error: /ITurnOrderService/,
        methods: ['clearCurrentRound'],
      },
      entityManager: {
        error: /EntityManager/,
        methods: ['getEntityInstance'],
      },
      logger: { error: /ILogger/, methods: ['warn', 'error'] },
      dispatcher: {
        error: /IValidatedEventDispatcher/,
        methods: ['dispatch', 'subscribe'],
      },
      turnHandlerResolver: {
        error: /ITurnHandlerResolver/,
        methods: ['resolveHandler'],
      },
    };

    describeConstructorValidation(TurnManager, createDeps, dependencySpec);

    // --- Edge Cases ---

    it('should handle empty options object gracefully', () => {
      const expectedErrorMsg =
        'TurnManager requires a valid ITurnOrderService instance.';
      expect(() => new TurnManager({})).toThrow(expectedErrorMsg);
    });

    it('should handle undefined options gracefully', () => {
      const expectedErrorMsg =
        'TurnManager requires a valid ITurnOrderService instance.';
      expect(() => new TurnManager(undefined)).toThrow(expectedErrorMsg);
    });

    it('should handle null options gracefully', () => {
      const expectedErrorMsg =
        'TurnManager requires a valid ITurnOrderService instance.';
      expect(() => new TurnManager(null)).toThrow(expectedErrorMsg);
    });
  }
);
// --- FILE END ---
