// tests/unit/turns/turnManager.schedulerValidation.test.js
// --- FILE START ---

import {
  describeTurnManagerSuite,
  TurnManagerTestBed,
} from '../../common/turns/turnManagerTestBed.js';
import TurnManager from '../../../src/turns/turnManager.js';
import { beforeEach, expect, it } from '@jest/globals';

describeTurnManagerSuite('TurnManager - Scheduler Validation', (getBed) => {
  let testBed;
  let validOptions;

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

  it('should throw error when scheduler is null', () => {
    const invalidOptions = {
      ...validOptions,
      scheduler: null,
    };

    expect(() => new TurnManager(invalidOptions)).toThrow(
      'TurnManager requires a valid IScheduler instance.'
    );
  });

  it('should use default scheduler when scheduler is undefined', () => {
    const invalidOptions = {
      ...validOptions,
      scheduler: undefined,
    };

    // Should not throw - undefined triggers default scheduler
    expect(() => new TurnManager(invalidOptions)).not.toThrow();
  });

  it('should throw error when scheduler lacks setTimeout method', () => {
    const invalidScheduler = {
      clearTimeout: jest.fn(),
      // missing setTimeout
    };

    const invalidOptions = {
      ...validOptions,
      scheduler: invalidScheduler,
    };

    expect(() => new TurnManager(invalidOptions)).toThrow(
      'TurnManager requires a valid IScheduler instance.'
    );
  });

  it('should throw error when scheduler lacks clearTimeout method', () => {
    const invalidScheduler = {
      setTimeout: jest.fn(),
      // missing clearTimeout
    };

    const invalidOptions = {
      ...validOptions,
      scheduler: invalidScheduler,
    };

    expect(() => new TurnManager(invalidOptions)).toThrow(
      'TurnManager requires a valid IScheduler instance.'
    );
  });

  it('should throw error when scheduler methods are not functions', () => {
    const invalidScheduler = {
      setTimeout: 'not-a-function',
      clearTimeout: jest.fn(),
    };

    const invalidOptions = {
      ...validOptions,
      scheduler: invalidScheduler,
    };

    expect(() => new TurnManager(invalidOptions)).toThrow(
      'TurnManager requires a valid IScheduler instance.'
    );
  });

  it('should accept valid scheduler with both required methods', () => {
    const validScheduler = {
      setTimeout: jest.fn(),
      clearTimeout: jest.fn(),
    };

    const validOptionsWithScheduler = {
      ...validOptions,
      scheduler: validScheduler,
    };

    expect(() => new TurnManager(validOptionsWithScheduler)).not.toThrow();
  });
});

// --- FILE END ---
