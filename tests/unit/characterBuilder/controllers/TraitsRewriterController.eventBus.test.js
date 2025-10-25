/**
 * @file Test for TraitsRewriterController EventBus integration
 * @description Reproduces and tests the fix for the eventBus method error
 * that occurs when generation complete events are dispatched
 */

import {
  describe,
  it,
  expect,
  beforeEach,
  afterEach,
  jest,
} from '@jest/globals';
import { TraitsRewriterController } from '../../../../src/characterBuilder/controllers/TraitsRewriterController.js';
import { CHARACTER_BUILDER_EVENTS } from '../../../../src/characterBuilder/services/characterBuilderService.js';
import { createTestBed } from '../../../common/testBed.js';

// Mock the UIStateManager module
jest.mock('../../../../src/shared/characterBuilder/uiStateManager.js', () => {
  class MockUIStateManager {
    constructor() {
      this.currentState = 'empty';
    }

    showState(state) {
      this.currentState = state;
    }

    getCurrentState() {
      return this.currentState;
    }
  }

  return {
    UIStateManager: MockUIStateManager,
    UI_STATES: {
      EMPTY: 'empty',
      LOADING: 'loading',
      RESULTS: 'results',
      ERROR: 'error',
    },
  };
});

describe('TraitsRewriterController - EventBus Integration', () => {
  let testBed;
  let controller;
  let mockEventBus;
  let mockElements;
  let mockLogger;

  beforeEach(async () => {
    testBed = createTestBed();

    // Setup DOM elements
    mockElements = {
      characterDefinition: document.createElement('textarea'),
      characterInputError: document.createElement('div'),
      rewriteTraitsButton: document.createElement('button'),
      exportJsonButton: document.createElement('button'),
      exportTextButton: document.createElement('button'),
      copyTraitsButton: document.createElement('button'),
      clearInputButton: document.createElement('button'),
      retryButton: document.createElement('button'),
      generationProgress: document.createElement('div'),
      progressText: document.createElement('span'),
      rewrittenTraitsContainer: document.createElement('div'),
      generationError: document.createElement('div'),
      emptyState: document.createElement('div'),
      loadingState: document.createElement('div'),
      resultsState: document.createElement('div'),
      errorState: document.createElement('div'),
      characterNameDisplay: document.createElement('h2'),
      traitsSections: document.createElement('div'),
      errorMessage: document.createElement('div'),
      screenReaderAnnouncement: document.createElement('div'),
    };

    // Set IDs for elements
    mockElements.characterDefinition.id = 'character-definition';
    mockElements.characterInputError.id = 'character-input-error';
    mockElements.rewriteTraitsButton.id = 'rewrite-traits-button';
    mockElements.exportJsonButton.id = 'export-json-button';
    mockElements.exportTextButton.id = 'export-text-button';
    mockElements.copyTraitsButton.id = 'copy-traits-button';
    mockElements.clearInputButton.id = 'clear-input-button';
    mockElements.retryButton.id = 'retry-button';
    mockElements.generationProgress.id = 'generation-progress';
    mockElements.progressText.id = 'progress-text';
    mockElements.progressText.className = 'progress-text';
    mockElements.rewrittenTraitsContainer.id = 'rewritten-traits-container';
    mockElements.generationError.id = 'generation-error';
    mockElements.emptyState.id = 'empty-state';
    mockElements.loadingState.id = 'loading-state';
    mockElements.resultsState.id = 'results-state';
    mockElements.errorState.id = 'error-state';
    mockElements.characterNameDisplay.id = 'character-name-display';
    mockElements.traitsSections.id = 'traits-sections';
    mockElements.errorMessage.id = 'error-message';
    mockElements.screenReaderAnnouncement.id = 'screen-reader-announcement';

    // Append to document
    Object.values(mockElements).forEach((el) => document.body.appendChild(el));

    // Setup mock event bus with spy
    mockEventBus = testBed.createMock('mockEventBus', [
      'dispatch',
      'subscribe',
      'unsubscribe',
    ]);
    mockEventBus.dispatch = jest.fn();
    mockEventBus.subscribe = jest.fn(() => {
      return { unsubscribe: jest.fn() };
    });
    mockEventBus.unsubscribe = jest.fn();

    // Setup mocks
    mockLogger = testBed.createMockLogger();
    const mockCharacterBuilderService = testBed.createMock(
      'mockCharacterBuilderService',
      [
        'initialize',
        'getAllCharacterConcepts',
        'createCharacterConcept',
        'updateCharacterConcept',
        'deleteCharacterConcept',
        'getCharacterConcept',
        'generateThematicDirections',
        'getThematicDirections',
      ]
    );
    mockCharacterBuilderService.initialize.mockResolvedValue();
    mockCharacterBuilderService.getAllCharacterConcepts.mockResolvedValue([]);

    const mockSchemaValidator = testBed.createMock('mockSchemaValidator', [
      'validate',
    ]);
    mockSchemaValidator.validate.mockReturnValue({ valid: true });

    const mockTraitsRewriterGenerator = testBed.createMock(
      'mockTraitsRewriterGenerator',
      ['generateRewrittenTraits']
    );

    const mockTraitsRewriterDisplayEnhancer = testBed.createMock(
      'mockTraitsRewriterDisplayEnhancer',
      ['enhanceForDisplay', 'formatForExport', 'generateExportFilename']
    );

    const dependencies = {
      logger: mockLogger,
      characterBuilderService: mockCharacterBuilderService,
      eventBus: mockEventBus,
      schemaValidator: mockSchemaValidator,
      traitsRewriterGenerator: mockTraitsRewriterGenerator,
      traitsRewriterDisplayEnhancer: mockTraitsRewriterDisplayEnhancer,
    };

    controller = new TraitsRewriterController(dependencies);
    await controller.initialize();
  });

  afterEach(() => {
    // Clean up DOM
    Object.values(mockElements).forEach((el) => {
      if (el && el.parentNode) {
        el.parentNode.removeChild(el);
      }
    });

    if (controller && typeof controller.destroy === 'function') {
      controller.destroy();
    }

    testBed.cleanup();
  });

  describe('Generation Complete Event Handling', () => {
    it('should subscribe to generation complete events without errors', () => {
      // Arrange - Find the registered handler for generation complete
      const registeredCalls = mockEventBus.subscribe.mock.calls;
      const generationCompleteHandler = registeredCalls.find(
        (call) =>
          call[0] === CHARACTER_BUILDER_EVENTS.TRAITS_REWRITER_GENERATION_COMPLETED
      );

      // Assert - Verify the handler was registered
      expect(generationCompleteHandler).toBeDefined();

      const handler = generationCompleteHandler[1];

      // Act - Trigger the generation complete event (should not throw)
      const mockEvent = {
        type: CHARACTER_BUILDER_EVENTS.TRAITS_REWRITER_GENERATION_COMPLETED,
        payload: {
          characterName: 'Test Character',
          rewrittenTraits: { traits: [] },
        },
      };

      // Assert - Handler executes without errors
      expect(() => handler(mockEvent)).not.toThrow();
    });
  });

  describe('Additional Generation Event Handling', () => {
    it('should update progress text when progress events include a message', () => {
      const registeredCalls = mockEventBus.subscribe.mock.calls;
      const progressHandlerCall = registeredCalls.find(
        (call) =>
          call[0] ===
          CHARACTER_BUILDER_EVENTS.TRAITS_REWRITER_GENERATION_STARTED
      );

      expect(progressHandlerCall).toBeDefined();

      const progressHandler = progressHandlerCall[1];
      mockElements.progressText.textContent = 'Waiting';

      progressHandler({
        payload: {
          message: 'Halfway done',
        },
      });

      expect(mockElements.progressText.textContent).toBe('Halfway done');
    });

    it('should surface errors dispatched through generation failure events', () => {
      const registeredCalls = mockEventBus.subscribe.mock.calls;
      const errorHandlerCall = registeredCalls.find(
        (call) =>
          call[0] ===
          CHARACTER_BUILDER_EVENTS.TRAITS_REWRITER_GENERATION_FAILED
      );

      expect(errorHandlerCall).toBeDefined();

      const errorHandler = errorHandlerCall[1];
      mockElements.generationError.style.display = 'none';
      const originalGetElement = controller._getElement;
      const errorElement = { textContent: '' };
      controller._getElement = function (key) {
        if (key === 'errorMessage') {
          return errorElement;
        }
        return originalGetElement.call(this, key);
      };

      const eventError = new Error('Network offline');

      errorHandler({
        payload: {
          error: eventError,
        },
      });

      expect(mockLogger.error).toHaveBeenCalledWith(
        'TraitsRewriterController: Generation error',
        expect.objectContaining({
          payload: { error: eventError },
        })
      );
      expect(errorElement.textContent).toBe('Network offline');
      expect(mockElements.generationError.style.display).toBe('block');
    });
  });
});
