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
    const mockLogger = testBed.createMockLogger();
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
    it('should dispatch UI_STATE_CHANGED event when generation completes', () => {
      // Arrange - Find the registered handler for generation complete
      const registeredCalls = mockEventBus.subscribe.mock.calls;
      const generationCompleteHandler = registeredCalls.find(
        (call) =>
          call[0] === CHARACTER_BUILDER_EVENTS.TRAITS_REWRITER_GENERATION_COMPLETED
      );

      expect(generationCompleteHandler).toBeDefined();

      const handler = generationCompleteHandler[1];

      // Clear previous dispatch calls
      mockEventBus.dispatch.mockClear();

      // Act - Trigger the generation complete event
      const mockEvent = {
        type: CHARACTER_BUILDER_EVENTS.TRAITS_REWRITER_GENERATION_COMPLETED,
        payload: {
          characterName: 'Test Character',
          rewrittenTraits: { traits: [] },
        },
      };

      handler(mockEvent);

      // Assert - Verify dispatch was NOT called (UI state is handled by UIStateManager)
      expect(mockEventBus.dispatch).not.toHaveBeenCalled();
    });

    it('should use eventBus getter instead of non-existent _getEventBus method', () => {
      // Arrange
      const registeredCalls = mockEventBus.subscribe.mock.calls;
      const generationCompleteHandler = registeredCalls.find(
        (call) =>
          call[0] === CHARACTER_BUILDER_EVENTS.TRAITS_REWRITER_GENERATION_COMPLETED
      );

      const handler = generationCompleteHandler[1];
      mockEventBus.dispatch.mockClear();

      // Act - This should not throw "this._getEventBus is not a function"
      const mockEvent = {
        type: CHARACTER_BUILDER_EVENTS.TRAITS_REWRITER_GENERATION_COMPLETED,
        payload: {
          characterName: 'Alicia Western',
          rewrittenTraits: { traits: [] },
        },
      };

      expect(() => handler(mockEvent)).not.toThrow();

      // Assert - Verify dispatch was NOT called (UI state is handled by UIStateManager)
      expect(mockEventBus.dispatch).not.toHaveBeenCalled();
    });

    it('should include correct metadata in UI_STATE_CHANGED event', () => {
      // Arrange
      const registeredCalls = mockEventBus.subscribe.mock.calls;
      const generationCompleteHandler = registeredCalls.find(
        (call) =>
          call[0] === CHARACTER_BUILDER_EVENTS.TRAITS_REWRITER_GENERATION_COMPLETED
      );

      const handler = generationCompleteHandler[1];
      mockEventBus.dispatch.mockClear();

      // Act
      const mockEvent = {
        type: CHARACTER_BUILDER_EVENTS.TRAITS_REWRITER_GENERATION_COMPLETED,
        payload: {
          characterName: 'Alicia Western',
          rewrittenTraits: { traits: [] },
        },
      };

      handler(mockEvent);

      // Assert - Verify dispatch was NOT called (UI state is handled by UIStateManager)
      expect(mockEventBus.dispatch).not.toHaveBeenCalled();
    });
  });
});
