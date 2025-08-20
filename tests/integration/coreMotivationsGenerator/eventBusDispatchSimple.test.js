/**
 * @file Simplified integration test to reproduce eventBus dispatch issue
 * @description Reproduces the exact error seen in production logs
 */

import {
  describe,
  it,
  expect,
  beforeEach,
  afterEach,
  jest,
} from '@jest/globals';
import { CoreMotivationsGeneratorController } from '../../../src/coreMotivationsGenerator/controllers/CoreMotivationsGeneratorController.js';

describe('CoreMotivationsGeneratorController - EventBus Dispatch Issue (Simplified)', () => {
  let controller;
  let mockEventBus;
  let dispatchedCalls;

  beforeEach(() => {
    // Create a mock eventBus that tracks calls
    dispatchedCalls = [];
    mockEventBus = {
      dispatch: jest.fn((...args) => {
        dispatchedCalls.push(args);

        // Simulate the real eventBus behavior:
        // If first arg is an object (wrong usage), it will cause issues
        const [firstArg, secondArg] = args;

        if (typeof firstArg === 'object' && firstArg !== null) {
          // This simulates the error that happens in production
          console.error('EventBus: Invalid event name provided.', firstArg);
          return Promise.resolve(false);
        }

        // Correct usage: eventName (string), payload (object)
        if (typeof firstArg === 'string') {
          return Promise.resolve(true);
        }

        return Promise.resolve(false);
      }),
      subscribe: jest.fn(),
      unsubscribe: jest.fn(),
    };

    // Mock services
    const mockLogger = {
      info: jest.fn(),
      warn: jest.fn(),
      error: jest.fn(),
      debug: jest.fn(),
      log: jest.fn(),
    };

    const mockCharacterBuilderService = {
      initialize: jest.fn().mockResolvedValue(true),
      getAllCharacterConcepts: jest
        .fn()
        .mockResolvedValue([{ id: 'concept-1', concept: 'A brave warrior' }]),
      createCharacterConcept: jest.fn().mockResolvedValue('concept-id'),
      updateCharacterConcept: jest.fn().mockResolvedValue(true),
      deleteCharacterConcept: jest.fn().mockResolvedValue(true),
      getCharacterConcept: jest.fn().mockResolvedValue({
        id: 'concept-1',
        concept: 'A brave warrior',
      }),
      generateThematicDirections: jest.fn().mockResolvedValue([]),
      getThematicDirections: jest.fn().mockResolvedValue([]),
      getThematicDirectionsByConceptId: jest.fn().mockResolvedValue([]),
      hasClichesForDirection: jest.fn().mockResolvedValue(false),
    };

    const mockCoreMotivationsGenerator = {
      generate: jest.fn().mockResolvedValue([]),
    };

    const mockDisplayEnhancer = {
      createMotivationBlock: jest.fn(),
      formatMotivationsForExport: jest.fn(),
      formatSingleMotivation: jest.fn(),
    };

    const mockSchemaValidator = {
      validate: jest.fn().mockReturnValue({ valid: true }),
      getErrors: jest.fn().mockReturnValue([]),
      validateAgainstSchema: jest
        .fn()
        .mockReturnValue({ valid: true, errors: [] }),
    };

    // Create DOM structure
    document.body.innerHTML = `
      <div id="loading-overlay"></div>
      <div id="direction-selector"></div>
      <div id="generate-button"></div>
      <div id="motivations-display"></div>
      <div id="export-button"></div>
      <div id="clear-all-button"></div>
      <div id="motivations-count"></div>
      <div id="no-concept-message"></div>
      <div id="no-directions-message"></div>
      <div id="no-cliches-message"></div>
      <div id="select-direction-message"></div>
      <div id="confirmation-modal"></div>
      <div id="confirm-clear"></div>
      <div id="cancel-clear"></div>
      <div id="error-message"></div>
      <div id="success-message"></div>
      <div id="warning-message"></div>
      <div id="search-bar"></div>
      <div id="sort-dropdown"></div>
      <div id="load-more-trigger"></div>
      <button id="generate-button-kbd"></button>
      <button id="export-button-kbd"></button>
      <button id="clear-all-button-kbd"></button>
    `;

    // Mock localStorage
    const localStorageMock = {
      getItem: jest.fn(),
      setItem: jest.fn(),
      clear: jest.fn(),
    };
    Object.defineProperty(window, 'localStorage', {
      value: localStorageMock,
      writable: true,
    });

    // Create controller
    controller = new CoreMotivationsGeneratorController({
      logger: mockLogger,
      characterBuilderService: mockCharacterBuilderService,
      eventBus: mockEventBus,
      schemaValidator: mockSchemaValidator,
      coreMotivationsGenerator: mockCoreMotivationsGenerator,
      displayEnhancer: mockDisplayEnhancer,
    });
  });

  afterEach(() => {
    document.body.innerHTML = '';
    jest.clearAllMocks();
  });

  describe('Current behavior (after fix)', () => {
    it('should call eventBus.dispatch with correct signature (eventName, payload)', async () => {
      // Spy on console.error to capture the error
      const consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation();

      // Act - Initialize the controller
      await controller.initialize();

      // Assert - Check how dispatch was called
      expect(mockEventBus.dispatch).toHaveBeenCalled();

      // The controller now calls dispatch correctly with two arguments
      const firstCall = dispatchedCalls[0];
      expect(firstCall).toBeDefined();
      expect(firstCall.length).toBe(2); // Two arguments passed (correct)

      const [eventName, payload] = firstCall;
      expect(typeof eventName).toBe('string');
      expect(eventName).toBe('core:core_motivations_ui_initialized');
      expect(typeof payload).toBe('object');
      expect(payload).toHaveProperty('conceptId');
      expect(payload).toHaveProperty('eligibleDirectionsCount');

      // No error should be triggered
      expect(consoleErrorSpy).not.toHaveBeenCalledWith(
        'EventBus: Invalid event name provided.',
        expect.anything()
      );

      consoleErrorSpy.mockRestore();
    });
  });
});
