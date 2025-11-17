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
import { createMockLogger } from '../../common/mockFactories/loggerMocks.js';
import {
  createTestContainer,
  resolveControllerDependencies,
} from '../../common/testContainerConfig.js';
import { tokens } from '../../../src/dependencyInjection/tokens.js';

describe('CoreMotivationsGeneratorController - EventBus Dispatch Behavior', () => {
  let controller;
  let container;
  let controllerDependencies;
  let eventBus;
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

    // Set up dependency container and logger
    logger = createMockLogger();
    container = await createTestContainer();
    controllerDependencies = resolveControllerDependencies(container);
    eventBus = container.resolve(tokens.ISafeEventDispatcher);

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
      generateThematicDirections: jest.fn().mockResolvedValue([]),
      getThematicDirections: jest.fn().mockResolvedValue([]),
      getThematicDirectionsByConceptId: jest.fn().mockResolvedValue([]),
      getAllThematicDirectionsWithConcepts: jest.fn().mockResolvedValue([]),
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
    const {
      schemaValidator,
      controllerLifecycleOrchestrator,
      domElementManager,
      eventListenerRegistry,
      asyncUtilitiesToolkit,
      performanceMonitor,
      memoryManager,
      errorHandlingStrategy,
      validationService,
    } = controllerDependencies;

    controller = new CoreMotivationsGeneratorController({
      logger,
      characterBuilderService: mockCharacterBuilderService,
      eventBus,
      schemaValidator,
      controllerLifecycleOrchestrator,
      domElementManager,
      eventListenerRegistry,
      asyncUtilitiesToolkit,
      performanceMonitor,
      memoryManager,
      errorHandlingStrategy,
      validationService,
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
      // Spy on the SafeEventDispatcher to verify correct dispatch calls
      const dispatchSpy = jest.spyOn(eventBus, 'dispatch');

      // Act - Initialize the controller which should dispatch events correctly
      await controller.initialize();

      // Assert - Verify that dispatch was called with proper string event names
      expect(dispatchSpy).toHaveBeenCalledWith(
        'core:core_motivations_ui_initialized',
        expect.objectContaining({
          conceptId: '', // Controller initializes as empty string for event validation
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

  describe('Event Definition Validation', () => {
    it('should have a valid event definition for core:directions_loaded', async () => {
      // Arrange
      const mockDirectionsWithConcepts = [
        {
          direction: {
            id: 'dir1',
            conceptId: 'concept1',
            title: 'Direction 1',
          },
          concept: { id: 'concept1', text: 'Test concept' },
        },
      ];
      mockCharacterBuilderService.getAllThematicDirectionsWithConcepts.mockResolvedValue(
        mockDirectionsWithConcepts
      );
      mockCharacterBuilderService.hasClichesForDirection.mockResolvedValue(
        true
      );

      // Track actual validation warnings
      let validationWarnings = [];
      consoleWarnSpy.mockImplementation((...args) => {
        validationWarnings.push(args.join(' '));
      });

      // Act
      await controller.initialize();

      // Assert - should not have validation warnings about missing event definitions
      const directionsLoadedWarnings = validationWarnings.filter((warning) =>
        warning.includes(
          "EventDefinition not found for 'core:directions_loaded'"
        )
      );

      expect(directionsLoadedWarnings).toHaveLength(0);
    });

    it('should dispatch core:directions_loaded event with correct payload structure', async () => {
      // Arrange
      const mockDirectionsWithConcepts = [
        {
          direction: {
            id: 'dir1',
            conceptId: 'concept1',
            title: 'Direction 1',
          },
          concept: { id: 'concept1', text: 'Test concept' },
        },
        {
          direction: {
            id: 'dir2',
            conceptId: 'concept2',
            title: 'Direction 2',
          },
          concept: { id: 'concept2', text: 'Another concept' },
        },
      ];
      mockCharacterBuilderService.getAllThematicDirectionsWithConcepts.mockResolvedValue(
        mockDirectionsWithConcepts
      );
      mockCharacterBuilderService.hasClichesForDirection.mockResolvedValue(
        true
      );

      const dispatchSpy = jest.spyOn(eventBus, 'dispatch');

      // Act
      await controller.initialize();

      // Assert - verify the event is dispatched with correct structure
      expect(dispatchSpy).toHaveBeenCalledWith('core:directions_loaded', {
        count: 2,
        groups: 2,
      });

      dispatchSpy.mockRestore();
    });
  });
});
