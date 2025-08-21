/**
 * @file Integration test for CoreMotivationsGeneratorController eventBus dispatch behavior
 * @description Tests that verify correct event dispatching patterns and signatures
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
import { SafeEventDispatcher } from '../../../src/events/safeEventDispatcher.js';
import { createMockLogger } from '../../common/mockFactories/loggerMocks.js';
import { createMockValidatedEventDispatcherForIntegration } from '../../common/mockFactories/eventBusMocks.js';

describe('CoreMotivationsGeneratorController - EventBus Dispatch Behavior', () => {
  let controller;
  let safeEventDispatcher;
  let logger;
  let mockCharacterBuilderService;
  let mockCoreMotivationsGenerator;
  let mockDisplayEnhancer;
  let consoleErrorSpy;
  let consoleWarnSpy;

  beforeEach(async () => {
    // Spy on console to capture the actual errors/warnings
    consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation();
    consoleWarnSpy = jest.spyOn(console, 'warn').mockImplementation();

    // Create logger and event dispatcher
    logger = createMockLogger();
    const mockValidatedDispatcher = {
      dispatch: jest.fn().mockResolvedValue(true),
      subscribe: jest.fn().mockReturnValue(() => {}),
      unsubscribe: jest.fn(),
    };
    safeEventDispatcher = new SafeEventDispatcher({
      logger,
      validatedEventDispatcher: mockValidatedDispatcher,
    });

    // Mock services (comprehensive mock from test bed)
    mockCharacterBuilderService = {
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
      getCharacterConceptById: jest.fn().mockResolvedValue({
        id: 'concept-1',
        concept: 'A brave warrior',
      }),
      generateThematicDirections: jest.fn().mockResolvedValue([]),
      getThematicDirections: jest.fn().mockResolvedValue([]),
      getThematicDirectionsByConceptId: jest.fn().mockResolvedValue([]),
      hasClichesForDirection: jest.fn().mockResolvedValue(false),
      getCoreMotivationsByDirectionId: jest.fn().mockResolvedValue([]),
      getClichesByDirectionId: jest
        .fn()
        .mockResolvedValue([{ id: 'cliche-1', text: 'Chosen one trope' }]),
      saveCoreMotivations: jest.fn().mockResolvedValue(['motivation-1']),
      removeCoreMotivationItem: jest.fn().mockResolvedValue(true),
      clearCoreMotivationsForDirection: jest.fn().mockResolvedValue(2),
    };

    mockCoreMotivationsGenerator = {
      generate: jest.fn().mockResolvedValue([]),
    };

    mockDisplayEnhancer = {
      createMotivationBlock: jest.fn(),
      formatMotivationsForExport: jest.fn(),
      formatSingleMotivation: jest.fn(),
    };

    // Create DOM structure needed by controller
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

    // Create controller with safe event dispatcher
    controller = new CoreMotivationsGeneratorController({
      logger,
      characterBuilderService: mockCharacterBuilderService,
      eventBus: safeEventDispatcher,
      schemaValidator: {
        validate: jest.fn(),
        isSchemaLoaded: jest.fn(),
        validateAgainstSchema: jest.fn(),
        addSchema: jest.fn(),
        removeSchema: jest.fn(),
        getValidator: jest.fn(),
      },
      coreMotivationsGenerator: mockCoreMotivationsGenerator,
      displayEnhancer: mockDisplayEnhancer,
    });
  });

  afterEach(() => {
    document.body.innerHTML = '';
    consoleErrorSpy.mockRestore();
    consoleWarnSpy.mockRestore();
    jest.clearAllMocks();
  });

  describe('Validate correct event dispatch behavior', () => {
    it('should dispatch events with proper string event names and complete initialization', async () => {
      // Spy on the safeEventDispatcher to verify correct dispatch calls
      const dispatchSpy = jest.spyOn(safeEventDispatcher, 'dispatch');

      // Act - Initialize the controller which should dispatch events correctly
      await controller.initialize();

      // Assert - Verify that dispatch was called with proper string event names
      expect(dispatchSpy).toHaveBeenCalledWith(
        'core:core_motivations_ui_initialized',
        expect.objectContaining({
          conceptId: expect.any(String),
          eligibleDirectionsCount: expect.any(Number),
        })
      );

      // Verify no errors about invalid event signatures occurred
      expect(logger.error).not.toHaveBeenCalledWith(
        expect.stringContaining('Invalid event name provided'),
        expect.anything()
      );

      // The key validation: dispatch was called with proper string event name and payload structure
      // This proves the controller is using the correct event dispatch signature

      dispatchSpy.mockRestore();
    });
  });
});
