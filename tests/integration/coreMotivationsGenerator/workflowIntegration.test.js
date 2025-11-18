/**
 * @file Integration tests for Core Motivations Generator complete workflows
 * Tests end-to-end workflows including service coordination, event flow, and state management
 */

import {
  describe,
  it,
  expect,
  beforeEach,
  afterEach,
  jest,
} from '@jest/globals';
import { CoreMotivationsGenerator } from '../../../src/characterBuilder/services/CoreMotivationsGenerator.js';
import { CoreMotivationsGeneratorController } from '../../../src/coreMotivationsGenerator/controllers/CoreMotivationsGeneratorController.js';
import { CoreMotivationsDisplayEnhancer } from '../../../src/coreMotivationsGenerator/services/CoreMotivationsDisplayEnhancer.js';
import { ControllerLifecycleOrchestrator } from '../../../src/characterBuilder/services/controllerLifecycleOrchestrator.js';
import { AsyncUtilitiesToolkit } from '../../../src/characterBuilder/services/asyncUtilitiesToolkit.js';
import { DOMElementManager } from '../../../src/characterBuilder/services/domElementManager.js';
import { EventListenerRegistry } from '../../../src/characterBuilder/services/eventListenerRegistry.js';
import { PerformanceMonitor } from '../../../src/characterBuilder/services/performanceMonitor.js';
import { MemoryManager } from '../../../src/characterBuilder/services/memoryManager.js';
import { ErrorHandlingStrategy } from '../../../src/characterBuilder/services/errorHandlingStrategy.js';
import { ValidationService } from '../../../src/characterBuilder/services/validationService.js';
import {
  ERROR_CATEGORIES,
  ERROR_SEVERITY,
} from '../../../src/characterBuilder/controllers/BaseCharacterBuilderController.js';
import { createCoreMotivationsTestBed } from '../../common/coreMotivations/mockFactories.js';
import {
  createMockThematicDirection,
  createMockCharacterConcept,
  createMockCoreMotivations,
  waitForAsync,
} from '../../common/coreMotivations/testHelpers.js';

describe('Core Motivations Workflow Integration', () => {
  let testBed;
  let controller;
  let generator;
  let displayEnhancer;

  beforeEach(() => {
    // Create comprehensive test bed
    testBed = createCoreMotivationsTestBed({
      database: { hasExistingData: false },
      llm: { shouldSucceed: true },
      cache: { hasCachedData: false },
    });

    setupControllerDOM();

    const controllerDependencies = createControllerDependencies({
      logger: testBed.mocks.logger,
      eventBus: testBed.mocks.eventBus,
      schemaValidator: testBed.mocks.schemaValidator,
    });

    // Initialize services
    generator = new CoreMotivationsGenerator({
      logger: testBed.mocks.logger,
      llmJsonService: {
        clean: jest.fn((r) => r),
        parseAndRepair: jest.fn((r) => JSON.parse(r)),
      },
      llmStrategyFactory: testBed.mocks.llmService,
      llmConfigManager: {
        loadConfiguration: jest.fn().mockResolvedValue(true),
        getActiveConfiguration: jest
          .fn()
          .mockResolvedValue({ configId: 'test' }),
        setActiveConfiguration: jest.fn(),
      },
      eventBus: testBed.mocks.eventBus,
    });

    displayEnhancer = new CoreMotivationsDisplayEnhancer({
      logger: testBed.mocks.logger,
    });

    controller = new CoreMotivationsGeneratorController({
      logger: testBed.mocks.logger,
      characterBuilderService: testBed.mocks.characterBuilderService,
      eventBus: testBed.mocks.eventBus,
      schemaValidator: testBed.mocks.schemaValidator,
      coreMotivationsGenerator: generator,
      displayEnhancer: displayEnhancer,
      ...controllerDependencies,
    });
  });

  afterEach(() => {
    testBed.cleanup();
    jest.clearAllMocks();
    document.body.innerHTML = '';
  });

  describe('Complete Generation Workflow', () => {
    it('should create controller successfully', () => {
      // Controller is created in beforeEach
      expect(controller).toBeDefined();
      expect(controller.handleError).toBeDefined();
      expect(controller.showWarning).toBeDefined();
      expect(controller.showSuccess).toBeDefined();
      expect(controller.showError).toBeDefined();
    });

    it('should handle error correctly', async () => {
      const error = new Error('Test error');

      // Test error handling
      controller.handleError(error);

      // Verify error was logged
      expect(testBed.mocks.logger.error).toHaveBeenCalledWith(
        'Core Motivations Generator error:',
        error
      );
    });
  });

  describe('Error Recovery Workflow', () => {
    it('should show warning messages correctly', () => {
      const message = 'Test warning';

      controller.showWarning(message);

      expect(testBed.mocks.logger.warn).toHaveBeenCalledWith(message);
    });

    it('should show success messages correctly', () => {
      const message = 'Test success';

      controller.showSuccess(message);

      expect(testBed.mocks.logger.info).toHaveBeenCalledWith(message);
    });

    it('should show error messages correctly', () => {
      const message = 'Test error';

      controller.showError(message);

      expect(testBed.mocks.logger.error).toHaveBeenCalledWith(message);
    });
  });

  describe('Service Integration', () => {
    it('should have all required services', () => {
      // Verify all services were properly provided
      expect(testBed.mocks.logger).toBeDefined();
      expect(testBed.mocks.characterBuilderService).toBeDefined();
      expect(testBed.mocks.eventBus).toBeDefined();
      expect(testBed.mocks.schemaValidator).toBeDefined();
    });

    it('should handle service errors', () => {
      // Verify controller can handle errors through public API
      const error = new Error('Service error');
      controller.handleError(error);

      expect(testBed.mocks.logger.error).toHaveBeenCalledWith(
        'Core Motivations Generator error:',
        error
      );
    });
  });

  describe('Display Enhancer Integration', () => {
    it('should create motivation blocks correctly', () => {
      const motivation = createMockCoreMotivations(1)[0];
      const element = displayEnhancer.createMotivationBlock(motivation);

      expect(element).toBeDefined();
      expect(element.tagName).toBe('DIV');
      expect(element.className).toContain('motivation-block');
    });

    it('should format motivations for export', () => {
      const motivations = createMockCoreMotivations(2);
      const direction = createMockThematicDirection({ id: 'dir-1' });

      const formatted = displayEnhancer.formatMotivationsForExport(
        motivations,
        direction
      );

      expect(formatted).toContain('Core Motivation:');
      expect(formatted).toContain('Internal Contradiction:');
      expect(formatted).toContain('Central Question:');
    });
  });

  describe('Event Flow Integration', () => {
    it('should have access to event bus', () => {
      // Verify event bus is available
      expect(testBed.mocks.eventBus).toBeDefined();
      expect(testBed.mocks.eventBus.dispatch).toBeDefined();
      expect(testBed.mocks.eventBus.subscribe).toBeDefined();
    });
  });

  describe('Core Motivations Generator Integration', () => {
    it('should work with generator service', async () => {
      const context = {
        concept: createMockCharacterConcept(),
        direction: createMockThematicDirection(),
        clichés: [{ id: 'cliche-1', text: 'Test' }],
      };

      // Test generator directly
      const result = await generator.generate(context);

      expect(result).toBeDefined();
      expect(Array.isArray(result)).toBe(true);
    });
  });

  describe('LLM Service Integration', () => {
    it('should handle LLM service responses', async () => {
      // Verify LLM service is properly mocked
      const response =
        await testBed.mocks.llmService.generateCompletion('test prompt');

      expect(response).toBeDefined();
    });
  });
});

/**
 *
 */
function setupControllerDOM() {
  document.body.innerHTML = `
    <div id="empty-state"></div>
    <div id="loading-state"></div>
    <div id="results-state"></div>
    <div id="error-state"></div>
    <select id="direction-selector"></select>
    <div id="no-directions-message"></div>
    <div id="loading-indicator"></div>
    <button id="generate-btn"></button>
    <button id="clear-all-btn"></button>
    <button id="export-btn"></button>
    <button id="back-btn"></button>
    <input id="motivation-search" />
    <select id="motivation-sort"></select>
    <div id="motivations-container"></div>
    <div id="motivations-list"></div>
    <div id="confirmation-modal"></div>
    <button id="confirm-clear"></button>
    <button id="cancel-clear"></button>
    <div id="sr-announcements"></div>
    <span id="search-results-count"></span>
    <span id="search-count"></span>
  `;
}

/**
 *
 * @param root0
 * @param root0.logger
 * @param root0.eventBus
 * @param root0.schemaValidator
 */
function createControllerDependencies({ logger, eventBus, schemaValidator }) {
  const controllerLifecycleOrchestrator = new ControllerLifecycleOrchestrator({
    logger,
    eventBus,
  });

  const asyncUtilitiesToolkit = new AsyncUtilitiesToolkit({
    logger,
  });

  const performanceRef =
    typeof performance !== 'undefined'
      ? performance
      : {
          now: () => Date.now(),
        };

  const domElementManager = new DOMElementManager({
    logger,
    documentRef: document,
    performanceRef,
    elementsRef: {},
    contextName: 'CoreMotivationsWorkflowIntegration',
  });

  const eventListenerRegistry = new EventListenerRegistry({
    logger,
    asyncUtilities: {
      debounce: (...args) => asyncUtilitiesToolkit.debounce(...args),
      throttle: (...args) => asyncUtilitiesToolkit.throttle(...args),
    },
  });

  const performanceMonitor = new PerformanceMonitor({
    logger,
    eventBus,
  });

  const memoryManager = new MemoryManager({ logger });

  const errorHandlingStrategy = new ErrorHandlingStrategy({
    logger,
    eventBus,
    controllerName: 'CoreMotivationsGeneratorController',
    errorCategories: ERROR_CATEGORIES,
    errorSeverity: ERROR_SEVERITY,
  });

  const validationService = new ValidationService({
    schemaValidator,
    logger,
    handleError: jest.fn(),
    errorCategories: ERROR_CATEGORIES,
  });

  return {
    controllerLifecycleOrchestrator,
    domElementManager,
    eventListenerRegistry,
    asyncUtilitiesToolkit,
    performanceMonitor,
    memoryManager,
    errorHandlingStrategy,
    validationService,
  };
}
