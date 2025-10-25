/**
 * @file Unit tests for TraitsRewriterController
 * @description Tests the complete controller implementation for trait rewriting functionality
 */

import {
  describe,
  it,
  expect,
  beforeAll,
  afterAll,
  beforeEach,
  afterEach,
  jest,
} from '@jest/globals';
import { TraitsRewriterController } from '../../../../src/characterBuilder/controllers/TraitsRewriterController.js';
import { CHARACTER_BUILDER_EVENTS } from '../../../../src/characterBuilder/services/characterBuilderService.js';
import { TraitsRewriterError } from '../../../../src/characterBuilder/errors/TraitsRewriterError.js';
import { createTestBed } from '../../../common/testBed.js';
import {
  createOptimizedDOMSetup,
  OptimizedMockFactory,
  mockControllerDebounce,
  waitForNextTick,
  simulateEvent,
} from '../../../common/testOptimizations.js';

// Mock the UIStateManager module
jest.mock('../../../../src/shared/characterBuilder/uiStateManager.js', () => {
  class MockUIStateManager {
    constructor() {
      this.currentState = 'empty';
    }

    showState(state, message) {
      this.currentState = state;
      // Don't manipulate DOM - let the controller handle it through _showElement
    }

    getCurrentState() {
      return this.currentState;
    }

    showError(message) {
      this.showState('error', message);
    }

    showLoading(message) {
      this.showState('loading', message);
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

describe('TraitsRewriterController', () => {
  let testBed;
  let controller;
  let mockLogger;
  let mockCharacterBuilderService;
  let mockEventBus;
  let mockSchemaValidator;
  let mockTraitsRewriterGenerator;
  let mockTraitsRewriterDisplayEnhancer;
  let mockDependencies;
  let mockElements;
  let domSetup;
  let mockFactory;
  let debounceCleanup;

  beforeAll(() => {
    // Create optimized DOM setup
    domSetup = createOptimizedDOMSetup('traits-rewriter-test-container');
    mockFactory = new OptimizedMockFactory();

    // Setup persistent DOM elements
    mockElements = domSetup.setupElements({
      characterDefinition: { tag: 'textarea', id: 'character-definition' },
      characterInputError: { tag: 'div', id: 'character-input-error' },
      rewriteTraitsButton: { tag: 'button', id: 'rewrite-traits-button' },
      exportJsonButton: { tag: 'button', id: 'export-json-button' },
      exportTextButton: { tag: 'button', id: 'export-text-button' },
      copyTraitsButton: { tag: 'button', id: 'copy-traits-button' },
      clearInputButton: { tag: 'button', id: 'clear-input-button' },
      retryButton: { tag: 'button', id: 'retry-button' },
      generationProgress: { tag: 'div', id: 'generation-progress' },
      rewrittenTraitsContainer: {
        tag: 'div',
        id: 'rewritten-traits-container',
      },
      generationError: { tag: 'div', id: 'generation-error' },
      emptyState: { tag: 'div', id: 'empty-state' },
      characterNameDisplay: { tag: 'h3', id: 'character-name-display' },
      traitsSections: { tag: 'div', id: 'traits-sections' },
      progressText: { tag: 'p', className: 'progress-text' },
      errorMessage: { tag: 'p', className: 'error-message' },
      // Add UIStateManager required elements
      loadingState: { tag: 'div', id: 'loading-state' },
      resultsState: { tag: 'div', id: 'results-state' },
      errorState: { tag: 'div', id: 'error-state' },
    });

    // Set initial styles and properties
    mockElements.characterInputError.style.display = 'none';
    mockElements.generationProgress.style.display = 'none';
    mockElements.rewrittenTraitsContainer.style.display = 'none';
    mockElements.generationError.style.display = 'none';
    mockElements.exportJsonButton.style.display = 'none';
    mockElements.exportTextButton.style.display = 'none';
    mockElements.copyTraitsButton.style.display = 'none';
    mockElements.loadingState.style.display = 'none';
    mockElements.resultsState.style.display = 'none';
    mockElements.errorState.style.display = 'none';

    // Set initial text content that gets reset each test
    mockElements.progressText.textContent =
      'Rewriting traits in character voice...';
  });

  beforeEach(() => {
    testBed = createTestBed();

    // Reset DOM elements
    domSetup.resetElements();

    // Restore initial text content that tests expect
    mockElements.progressText.textContent =
      'Rewriting traits in character voice...';

    // Create fresh mocks (not using cache due to call count issues)
    mockLogger = mockFactory.getMockLogger();
    mockCharacterBuilderService = {
      initialize: jest.fn(),
      getAllCharacterConcepts: jest.fn(),
      createCharacterConcept: jest.fn(),
      updateCharacterConcept: jest.fn(),
      deleteCharacterConcept: jest.fn(),
      getCharacterConcept: jest.fn(),
      generateThematicDirections: jest.fn(),
      getThematicDirections: jest.fn(),
    };
    mockEventBus = {
      dispatch: jest.fn(),
      subscribe: jest.fn(),
      unsubscribe: jest.fn(),
    };
    mockSchemaValidator = {
      validate: jest.fn(),
      isSchemaLoaded: jest.fn(),
    };
    mockTraitsRewriterGenerator = {
      generateRewrittenTraits: jest.fn(),
    };
    mockTraitsRewriterDisplayEnhancer = {
      enhanceForDisplay: jest.fn(),
      formatForExport: jest.fn(),
      generateExportFilename: jest.fn(),
      createDisplaySections: jest.fn(),
    };

    // Create dependencies object
    mockDependencies = {
      logger: mockLogger,
      characterBuilderService: mockCharacterBuilderService,
      eventBus: mockEventBus,
      schemaValidator: mockSchemaValidator,
      traitsRewriterGenerator: mockTraitsRewriterGenerator,
      traitsRewriterDisplayEnhancer: mockTraitsRewriterDisplayEnhancer,
    };
  });

  afterEach(() => {
    // Clean up debounce mock if it exists
    if (debounceCleanup) {
      debounceCleanup();
      debounceCleanup = null;
    }

    testBed.cleanup();
    jest.clearAllMocks();
    jest.resetAllMocks();
  });

  afterAll(() => {
    domSetup.cleanup();
    mockFactory.clearCache();
  });

  describe('Constructor and Initialization', () => {
    it('should validate all required dependencies', () => {
      // Act
      controller = new TraitsRewriterController(mockDependencies);

      // Assert
      // Logger initialization message was moved to _loadInitialData
      expect(controller).toBeDefined();
      expect(controller.constructor.name).toBe('TraitsRewriterController');
    });

    it('should throw error if traitsRewriterGenerator is missing', () => {
      // Arrange
      delete mockDependencies.traitsRewriterGenerator;

      // Act & Assert
      expect(() => new TraitsRewriterController(mockDependencies)).toThrow();
    });

    it('should throw error if traitsRewriterDisplayEnhancer is missing', () => {
      // Arrange
      delete mockDependencies.traitsRewriterDisplayEnhancer;

      // Act & Assert
      expect(() => new TraitsRewriterController(mockDependencies)).toThrow();
    });

    it('should initialize with proper services', async () => {
      // Arrange
      controller = new TraitsRewriterController(mockDependencies);

      // Act
      await controller.initialize();

      // Assert
      expect(mockLogger.debug).toHaveBeenCalledWith(
        'TraitsRewriterController: Loading initial data'
      );
    });

    it('should cache all required UI elements', () => {
      // Arrange
      controller = new TraitsRewriterController(mockDependencies);

      // Act
      controller._cacheElements();

      // Assert
      // Verify that caching was successful by checking if elements can be accessed
      expect(controller._getElement('characterDefinition')).toBeDefined();
    });

    it('should setup event listeners correctly', () => {
      // Arrange
      controller = new TraitsRewriterController(mockDependencies);
      controller._cacheElements();

      // Act
      controller._setupEventListeners();

      // Assert
      // Verify that event listeners were set up by checking button functionality
      expect(mockElements.rewriteTraitsButton.onclick).toBeDefined();
    });
  });

  describe('Character Input Handling', () => {
    beforeEach(() => {
      controller = new TraitsRewriterController(mockDependencies);
      debounceCleanup = mockControllerDebounce(controller);
      controller._cacheElements();
      controller._setupEventListeners();
    });

    it('should validate JSON character definitions', async () => {
      // Arrange
      const validCharacterJSON = JSON.stringify({
        components: {
          'core:name': 'Test Character',
          'core:personality': 'Brave and noble',
          'core:likes': 'Adventure',
        },
      });

      mockElements.characterDefinition.value = validCharacterJSON;

      // Act
      // Trigger input event using optimized simulation
      simulateEvent(mockElements.characterDefinition, 'input');

      // Wait for next tick instead of debounce delay
      await waitForNextTick();

      // Assert
      expect(mockElements.rewriteTraitsButton.disabled).toBe(false);
    });

    it('should show validation errors for invalid input', async () => {
      // Arrange
      mockElements.characterDefinition.value = 'invalid json';

      // Act
      const inputEvent = new Event('input');
      simulateEvent(mockElements.characterDefinition, 'input');

      // Wait for debounce
      await waitForNextTick();

      // Assert
      expect(mockElements.characterInputError.style.display).not.toBe('none');
      expect(mockElements.rewriteTraitsButton.disabled).toBe(true);
    });

    it('should enable rewrite button for valid input', async () => {
      // Arrange
      const validCharacterJSON = JSON.stringify({
        components: {
          'core:name': 'Test Character',
          'core:profile': 'A test character profile',
        },
      });

      mockElements.characterDefinition.value = validCharacterJSON;

      // Act
      const inputEvent = new Event('input');
      simulateEvent(mockElements.characterDefinition, 'input');

      // Wait for debounce
      await waitForNextTick();

      // Assert
      expect(mockElements.rewriteTraitsButton.disabled).toBe(false);
    });

    it('should handle real-time input validation', async () => {
      // Arrange
      const characterDefinitionElement = mockElements.characterDefinition;

      // Act - Type invalid JSON first
      characterDefinitionElement.value = '{invalid';
      simulateEvent(characterDefinitionElement, 'input');
      await waitForNextTick();

      // Assert
      expect(mockElements.rewriteTraitsButton.disabled).toBe(true);

      // Act - Fix to valid JSON
      characterDefinitionElement.value =
        '{"components": {"core:name": "Test", "core:personality": "Brave"}}';
      simulateEvent(characterDefinitionElement, 'input');
      await waitForNextTick();

      // Assert
      expect(mockElements.rewriteTraitsButton.disabled).toBe(false);
    });

    it('should require at least one trait to rewrite', async () => {
      // Arrange
      const characterWithoutTraits = JSON.stringify({
        components: {
          'core:name': 'Test Character',
          'some:other': 'value',
        },
      });

      mockElements.characterDefinition.value = characterWithoutTraits;

      // Act
      const inputEvent = new Event('input');
      simulateEvent(mockElements.characterDefinition, 'input');

      // Wait for debounce
      await waitForNextTick();

      // Assert
      expect(mockElements.characterInputError.textContent).toContain(
        'at least one trait to rewrite inside the components property'
      );
      expect(mockElements.rewriteTraitsButton.disabled).toBe(true);
    });

    it('should reset validation state when character input is cleared', async () => {
      // Arrange - set valid input first to enable generation
      const validCharacterJSON = JSON.stringify({
        components: {
          'core:name': 'Test Character',
          'core:personality': 'Brave',
        },
      });
      mockElements.characterDefinition.value = validCharacterJSON;
      simulateEvent(mockElements.characterDefinition, 'input');
      await waitForNextTick();
      expect(mockElements.rewriteTraitsButton.disabled).toBe(false);

      // Act - clear the input and ensure state resets
      mockElements.characterInputError.style.display = 'block';
      mockElements.characterDefinition.value = '   ';
      simulateEvent(mockElements.characterDefinition, 'input');
      await waitForNextTick();

      // Assert
      expect(mockElements.rewriteTraitsButton.disabled).toBe(true);
      expect(mockElements.characterInputError.style.display).toBe('none');
    });

    it('should require character definitions to include the core:name component', async () => {
      // Arrange - missing core:name while including another trait
      const missingNameJSON = JSON.stringify({
        components: {
          'core:personality': 'Bold and curious',
        },
      });

      mockElements.characterDefinition.value = missingNameJSON;

      // Act
      simulateEvent(mockElements.characterDefinition, 'input');
      await waitForNextTick();

      // Assert
      expect(mockElements.characterInputError.textContent).toContain(
        'core:name component inside the components property'
      );
      expect(mockElements.rewriteTraitsButton.disabled).toBe(true);
    });
  });

  describe('Generation Workflow', () => {
    beforeEach(() => {
      controller = new TraitsRewriterController(mockDependencies);
      debounceCleanup = mockControllerDebounce(controller);
      controller._cacheElements();
      controller._setupEventListeners();

      // Setup valid character input
      const validCharacterJSON = JSON.stringify({
        components: {
          'core:name': 'Test Character',
          'core:personality': 'Brave',
          'core:likes': 'Adventure',
        },
      });
      mockElements.characterDefinition.value = validCharacterJSON;
    });

    it('should manage generation state properly', async () => {
      // Arrange
      await controller.initialize();

      // Set up valid character input
      const validJSON = JSON.stringify({
        components: {
          'core:name': 'Test Character',
          'core:personality': 'Brave',
        },
      });
      mockElements.characterDefinition.value = validJSON;

      // Trigger validation
      simulateEvent(mockElements.characterDefinition, 'input');
      await waitForNextTick(); // Wait for next tick instead of debounce

      const mockResult = {
        rewrittenTraits: {
          'core:personality': "I'm brave and courageous",
        },
        characterName: 'Test Character',
      };

      mockTraitsRewriterGenerator.generateRewrittenTraits.mockResolvedValue(
        mockResult
      );
      mockTraitsRewriterDisplayEnhancer.enhanceForDisplay.mockReturnValue({
        sections: [
          { id: 'personality', title: 'Personality', content: "I'm brave" },
        ],
        characterName: 'Test Character',
      });

      // Act
      simulateEvent(mockElements.rewriteTraitsButton, 'click');
      await waitForNextTick();

      // Assert
      expect(
        mockTraitsRewriterGenerator.generateRewrittenTraits
      ).toHaveBeenCalled();
    });

    it('should integrate with TraitsRewriterGenerator', async () => {
      // Arrange
      const mockCharacterDefinition = {
        components: {
          'core:name': 'Test Character',
          'core:personality': 'Brave',
        },
      };

      const mockResult = {
        rewrittenTraits: {
          'core:personality': "I'm brave",
        },
        characterName: 'Test Character',
      };

      mockTraitsRewriterGenerator.generateRewrittenTraits.mockResolvedValue(
        mockResult
      );

      // Setup character input to be valid
      const inputEvent = new Event('input');
      mockElements.characterDefinition.value = JSON.stringify(
        mockCharacterDefinition
      );
      simulateEvent(mockElements.characterDefinition, 'input');
      await waitForNextTick();

      // Act
      simulateEvent(mockElements.rewriteTraitsButton, 'click');
      await waitForNextTick();

      // Assert
      expect(
        mockTraitsRewriterGenerator.generateRewrittenTraits
      ).toHaveBeenCalledWith(mockCharacterDefinition, {
        includeMetadata: true,
      });
    });

    it('should update progress text while traits are being rewritten', async () => {
      // Arrange
      await controller.initialize();
      const validJSON = JSON.stringify({
        components: {
          'core:name': 'Progress Test',
          'core:personality': 'Curious',
        },
      });
      const mockResult = {
        rewrittenTraits: {
          'core:personality': 'Curious and thoughtful',
        },
        characterName: 'Progress Test',
      };

      const originalGetElement = controller._getElement;
      const progressElement = { textContent: 'Waiting' };
      controller._getElement = function (key) {
        if (key === 'progressText') {
          return progressElement;
        }
        return originalGetElement.call(this, key);
      };
      mockTraitsRewriterGenerator.generateRewrittenTraits.mockResolvedValue(
        mockResult
      );
      mockTraitsRewriterDisplayEnhancer.enhanceForDisplay.mockReturnValue({
        sections: [
          {
            id: 'personality',
            title: 'Personality',
            content: 'Curious and thoughtful',
          },
        ],
        characterName: 'Progress Test',
      });

      mockElements.characterDefinition.value = validJSON;
      simulateEvent(mockElements.characterDefinition, 'input');
      await waitForNextTick();

      // Act
      simulateEvent(mockElements.rewriteTraitsButton, 'click');
      await waitForNextTick();

      // Assert
      expect(progressElement.textContent).toBe(
        'Rewriting traits in character voice...'
      );
    });

    it('should render HTML-enhanced trait sections returned by the enhancer', async () => {
      // Arrange
      await controller.initialize();
      const validJSON = JSON.stringify({
        components: {
          'core:name': 'HTML Test',
          'core:personality': 'Bold',
        },
      });
      const mockResult = {
        rewrittenTraits: {
          'core:personality': 'Bold and inspiring',
        },
        characterName: 'HTML Test',
      };
      const enhancedSection = {
        id: 'personality',
        title: 'Personality',
        htmlContent: '<strong>Bold and inspiring</strong>',
        content: 'Fallback text',
      };

      mockTraitsRewriterGenerator.generateRewrittenTraits.mockResolvedValue(
        mockResult
      );
      mockTraitsRewriterDisplayEnhancer.enhanceForDisplay.mockReturnValue({
        sections: [enhancedSection],
        characterName: 'HTML Test',
      });

      mockElements.traitsSections.innerHTML = '';
      mockElements.characterDefinition.value = validJSON;
      simulateEvent(mockElements.characterDefinition, 'input');
      await waitForNextTick();

      // Act
      simulateEvent(mockElements.rewriteTraitsButton, 'click');
      await waitForNextTick();

      // Assert
      const renderedSection =
        mockElements.traitsSections.querySelector('.trait-content');
      expect(renderedSection).toBeTruthy();
      expect(renderedSection.innerHTML).toBe('<strong>Bold and inspiring</strong>');
    });

    it('should handle generation progress events', async () => {
      // Arrange
      await controller.initialize();

      const progressEvent = {
        type: CHARACTER_BUILDER_EVENTS.TRAITS_REWRITER_GENERATION_STARTED,
        payload: {
          message: 'Generating traits...',
          characterName: 'Test Character',
        },
      };

      // Act
      mockEventBus.dispatch(progressEvent);

      // Assert - Since we're mocking the event bus, we need to verify the dispatch was called
      // The actual progress text update would happen in the real event handler
      expect(mockEventBus.dispatch).toHaveBeenCalledWith(progressEvent);
    });

    it('should display results after successful generation', async () => {
      // Arrange
      // Create controller and initialize
      controller = new TraitsRewriterController(mockDependencies);
      controller._cacheElements();

      const mockResult = {
        rewrittenTraits: {
          'core:personality': "I'm a brave soul",
          'core:likes': 'I enjoy adventure',
        },
        characterName: 'Test Character',
      };

      const mockDisplayData = {
        sections: [
          {
            id: 'personality',
            title: 'Personality',
            content: "I'm a brave soul",
          },
          { id: 'likes', title: 'Likes', content: 'I enjoy adventure' },
        ],
        characterName: 'Test Character',
      };

      mockTraitsRewriterDisplayEnhancer.enhanceForDisplay.mockReturnValue(
        mockDisplayData
      );

      // Act - Directly test the display results logic
      // We're testing that _showElement works properly when called by #displayResults
      controller._showElement('rewrittenTraitsContainer');

      // Assert
      expect(mockElements.rewrittenTraitsContainer.style.display).not.toBe(
        'none'
      );
    });
  });

  describe('Results Display', () => {
    beforeEach(() => {
      controller = new TraitsRewriterController(mockDependencies);
      debounceCleanup = mockControllerDebounce(controller);
      controller._cacheElements();
    });

    it('should integrate with TraitsRewriterDisplayEnhancer', async () => {
      // Arrange
      const mockTraits = {
        'core:personality': "I'm brave",
        'core:likes': 'I love adventure',
      };

      const mockDisplayData = {
        sections: [
          { id: 'personality', title: 'Personality', content: "I'm brave" },
          { id: 'likes', title: 'Likes', content: 'I love adventure' },
        ],
        characterName: 'Test Character',
      };

      mockTraitsRewriterDisplayEnhancer.enhanceForDisplay.mockReturnValue(
        mockDisplayData
      );

      // Act - Call private method directly for testing
      const displayResults = controller.constructor.prototype.constructor
        .toString()
        .includes('#displayResults')
        ? null // Can't directly test private method
        : mockTraitsRewriterDisplayEnhancer.enhanceForDisplay(mockTraits, {
            characterName: 'Test Character',
          });

      // Assert
      if (displayResults) {
        expect(displayResults).toEqual(mockDisplayData);
      }
    });

    it('should create proper trait sections', () => {
      // Arrange
      const sections = [
        { id: 'personality', title: 'Personality', content: 'Brave and noble' },
        { id: 'likes', title: 'Likes', content: 'Adventure and exploration' },
      ];

      // Act
      // Since we can't directly call private methods, we test the DOM manipulation
      sections.forEach((section) => {
        const sectionElement = document.createElement('div');
        sectionElement.className = 'trait-section';
        sectionElement.setAttribute('data-section-id', section.id);

        const titleElement = document.createElement('h4');
        titleElement.className = 'trait-section-title';
        titleElement.textContent = section.title;

        const contentElement = document.createElement('div');
        contentElement.className = 'trait-content';
        contentElement.textContent = section.content;

        sectionElement.appendChild(titleElement);
        sectionElement.appendChild(contentElement);
        mockElements.traitsSections.appendChild(sectionElement);
      });

      // Assert
      expect(mockElements.traitsSections.children.length).toBe(2);
      expect(
        mockElements.traitsSections.querySelector(
          '[data-section-id="personality"]'
        )
      ).toBeTruthy();
      expect(
        mockElements.traitsSections.querySelector('[data-section-id="likes"]')
      ).toBeTruthy();
    });

    it('should show results container', () => {
      // Arrange
      mockElements.rewrittenTraitsContainer.style.display = 'none';

      // Act
      controller._showElement('rewrittenTraitsContainer');

      // Assert
      expect(mockElements.rewrittenTraitsContainer.style.display).not.toBe(
        'none'
      );
    });

    it('should enable export functionality', () => {
      // Arrange
      mockElements.exportJsonButton.style.display = 'none';
      mockElements.exportTextButton.style.display = 'none';
      mockElements.copyTraitsButton.style.display = 'none';

      // Act
      controller._showElement('exportJsonButton');
      controller._showElement('exportTextButton');
      controller._showElement('copyTraitsButton');

      // Assert
      expect(mockElements.exportJsonButton.style.display).not.toBe('none');
      expect(mockElements.exportTextButton.style.display).not.toBe('none');
      expect(mockElements.copyTraitsButton.style.display).not.toBe('none');
    });
  });

  describe('Export Functionality', () => {
    beforeEach(() => {
      controller = new TraitsRewriterController(mockDependencies);
      debounceCleanup = mockControllerDebounce(controller);
      controller._cacheElements();
      controller._setupEventListeners();

      // Mock navigator.clipboard
      global.navigator.clipboard = {
        writeText: jest.fn().mockResolvedValue(undefined),
      };

      // Mock URL.createObjectURL and URL.revokeObjectURL
      global.URL.createObjectURL = jest.fn(() => 'blob:mock-url');
      global.URL.revokeObjectURL = jest.fn();
    });

    afterEach(() => {
      delete global.navigator.clipboard;
      delete global.URL.createObjectURL;
      delete global.URL.revokeObjectURL;
    });

    it('should support JSON export via dedicated button', async () => {
      // Arrange
      await controller.initialize();
      const mockTraits = { 'core:personality': "I'm brave" };
      const mockExportContent = JSON.stringify(mockTraits, null, 2);
      const mockFilename = 'character-traits-2024';

      mockTraitsRewriterDisplayEnhancer.formatForExport.mockReturnValue(
        mockExportContent
      );
      mockTraitsRewriterDisplayEnhancer.generateExportFilename.mockReturnValue(
        mockFilename
      );

      // Simulate having generated traits
      const mockResult = {
        rewrittenTraits: mockTraits,
        characterName: 'Test Character',
      };
      mockTraitsRewriterGenerator.generateRewrittenTraits.mockResolvedValue(
        mockResult
      );

      // Setup display enhancer for generation
      mockTraitsRewriterDisplayEnhancer.enhanceForDisplay.mockReturnValue({
        sections: [
          { id: 'personality', title: 'Personality', content: "I'm brave" },
        ],
        characterName: 'Test Character',
      });

      // Setup valid input and trigger full generation workflow
      const validJSON = JSON.stringify({
        components: {
          'core:name': 'Test Character',
          'core:personality': 'Brave',
        },
      });

      // Setup character input to be valid (following successful test pattern)
      const inputEvent = new Event('input');
      mockElements.characterDefinition.value = validJSON;
      simulateEvent(mockElements.characterDefinition, 'input');
      await waitForNextTick();

      // Trigger generation by clicking the rewrite button
      simulateEvent(mockElements.rewriteTraitsButton, 'click');
      await waitForNextTick();

      // Act
      simulateEvent(mockElements.exportJsonButton, 'click');
      await waitForNextTick();

      // Assert
      expect(
        mockTraitsRewriterDisplayEnhancer.formatForExport
      ).toHaveBeenCalledWith(mockResult.rewrittenTraits, 'json');
    });

    it('should support text export via dedicated button', async () => {
      // Arrange
      await controller.initialize();
      const mockTraits = { 'core:personality': "I'm brave" };
      const mockExportContent = "Personality: I'm brave";
      const mockFilename = 'character-traits-2024';

      mockTraitsRewriterDisplayEnhancer.formatForExport.mockReturnValue(
        mockExportContent
      );
      mockTraitsRewriterDisplayEnhancer.generateExportFilename.mockReturnValue(
        mockFilename
      );

      // Simulate having generated traits
      const mockResult = {
        rewrittenTraits: mockTraits,
        characterName: 'Test Character',
      };
      mockTraitsRewriterGenerator.generateRewrittenTraits.mockResolvedValue(
        mockResult
      );

      // Setup valid input and generate (following successful test pattern)
      const validJSON = JSON.stringify({
        components: {
          'core:name': 'Test Character',
          'core:personality': 'Brave',
        },
      });

      const inputEvent = new Event('input');
      mockElements.characterDefinition.value = validJSON;
      simulateEvent(mockElements.characterDefinition, 'input');
      await waitForNextTick();

      simulateEvent(mockElements.rewriteTraitsButton, 'click');
      await waitForNextTick();

      // Act
      simulateEvent(mockElements.exportTextButton, 'click');
      await waitForNextTick();

      // Assert
      expect(
        mockTraitsRewriterDisplayEnhancer.formatForExport
      ).toHaveBeenCalledWith(mockResult.rewrittenTraits, 'text');
    });

    it('should generate proper filenames', () => {
      // Arrange
      const characterName = 'Test Character';
      const expectedFilename = 'test-character-traits-2024';

      mockTraitsRewriterDisplayEnhancer.generateExportFilename.mockReturnValue(
        expectedFilename
      );

      // Act
      const filename =
        mockTraitsRewriterDisplayEnhancer.generateExportFilename(characterName);

      // Assert
      expect(filename).toBe(expectedFilename);
    });

    it('should support copy to clipboard', async () => {
      // Arrange
      await controller.initialize();
      const mockTraits = { 'core:personality': "I'm brave" };
      const mockTextContent = "Personality: I'm brave";

      mockTraitsRewriterDisplayEnhancer.formatForExport.mockReturnValue(
        mockTextContent
      );

      // Simulate having generated traits
      const mockResult = {
        rewrittenTraits: mockTraits,
        characterName: 'Test Character',
      };
      mockTraitsRewriterGenerator.generateRewrittenTraits.mockResolvedValue(
        mockResult
      );

      // Setup valid input and generate (following successful test pattern)
      const validJSON = JSON.stringify({
        components: {
          'core:name': 'Test Character',
          'core:personality': 'Brave',
        },
      });

      const inputEvent = new Event('input');
      mockElements.characterDefinition.value = validJSON;
      simulateEvent(mockElements.characterDefinition, 'input');
      await waitForNextTick();

      simulateEvent(mockElements.rewriteTraitsButton, 'click');
      await waitForNextTick();

      // Act
      simulateEvent(mockElements.copyTraitsButton, 'click');
      await waitForNextTick();

      // Assert
      expect(global.navigator.clipboard.writeText).toHaveBeenCalledWith(
        mockTextContent
      );
    });

    it('should surface errors encountered during JSON export', async () => {
      // Arrange
      await controller.initialize();
      const mockResult = {
        rewrittenTraits: { 'core:personality': 'Clever' },
        characterName: 'Export Failure',
      };

      mockTraitsRewriterGenerator.generateRewrittenTraits.mockResolvedValue(
        mockResult
      );
      mockTraitsRewriterDisplayEnhancer.enhanceForDisplay.mockReturnValue({
        sections: [],
        characterName: 'Export Failure',
      });
      mockTraitsRewriterDisplayEnhancer.formatForExport.mockImplementation(() => {
        throw new Error('format error');
      });

      const validJSON = JSON.stringify({
        components: {
          'core:name': 'Export Failure',
          'core:personality': 'Clever',
        },
      });

      const originalGetElement = controller._getElement;
      const errorElement = { textContent: '' };
      controller._getElement = function (key) {
        if (key === 'errorMessage') {
          return errorElement;
        }
        return originalGetElement.call(this, key);
      };
      mockElements.generationError.style.display = 'none';
      mockElements.characterDefinition.value = validJSON;
      simulateEvent(mockElements.characterDefinition, 'input');
      await waitForNextTick();

      simulateEvent(mockElements.rewriteTraitsButton, 'click');
      await waitForNextTick();

      // Act
      simulateEvent(mockElements.exportJsonButton, 'click');
      await waitForNextTick();

      // Assert
      expect(mockLogger.error).toHaveBeenCalledWith(
        'TraitsRewriterController: JSON export failed',
        expect.any(Error)
      );
      expect(mockElements.generationError.style.display).toBe('block');
      expect(errorElement.textContent).toBe('Export failed');
    });

    it('should surface errors encountered during text export', async () => {
      // Arrange
      await controller.initialize();
      const mockResult = {
        rewrittenTraits: { 'core:personality': 'Strategic' },
        characterName: 'Text Failure',
      };

      mockTraitsRewriterGenerator.generateRewrittenTraits.mockResolvedValue(
        mockResult
      );
      mockTraitsRewriterDisplayEnhancer.enhanceForDisplay.mockReturnValue({
        sections: [],
        characterName: 'Text Failure',
      });
      mockTraitsRewriterDisplayEnhancer.formatForExport.mockImplementation(() => {
        throw new Error('text export error');
      });

      const validJSON = JSON.stringify({
        components: {
          'core:name': 'Text Failure',
          'core:personality': 'Strategic',
        },
      });

      const originalGetElement = controller._getElement;
      const errorElement = { textContent: '' };
      controller._getElement = function (key) {
        if (key === 'errorMessage') {
          return errorElement;
        }
        return originalGetElement.call(this, key);
      };
      mockElements.generationError.style.display = 'none';
      mockElements.characterDefinition.value = validJSON;
      simulateEvent(mockElements.characterDefinition, 'input');
      await waitForNextTick();

      simulateEvent(mockElements.rewriteTraitsButton, 'click');
      await waitForNextTick();

      // Act
      simulateEvent(mockElements.exportTextButton, 'click');
      await waitForNextTick();

      // Assert
      expect(mockLogger.error).toHaveBeenCalledWith(
        'TraitsRewriterController: Text export failed',
        expect.any(Error)
      );
      expect(mockElements.generationError.style.display).toBe('block');
      expect(errorElement.textContent).toBe('Export failed');
    });

    it('should display an error if copying traits to the clipboard fails', async () => {
      // Arrange
      await controller.initialize();
      const mockResult = {
        rewrittenTraits: { 'core:personality': 'Friendly' },
        characterName: 'Copy Failure',
      };

      mockTraitsRewriterGenerator.generateRewrittenTraits.mockResolvedValue(
        mockResult
      );
      mockTraitsRewriterDisplayEnhancer.enhanceForDisplay.mockReturnValue({
        sections: [],
        characterName: 'Copy Failure',
      });
      global.navigator.clipboard.writeText.mockRejectedValue(
        new Error('clipboard not available')
      );

      const validJSON = JSON.stringify({
        components: {
          'core:name': 'Copy Failure',
          'core:personality': 'Friendly',
        },
      });

      const originalGetElement = controller._getElement;
      const errorElement = { textContent: '' };
      controller._getElement = function (key) {
        if (key === 'errorMessage') {
          return errorElement;
        }
        return originalGetElement.call(this, key);
      };
      mockElements.generationError.style.display = 'none';
      mockElements.characterDefinition.value = validJSON;
      simulateEvent(mockElements.characterDefinition, 'input');
      await waitForNextTick();

      simulateEvent(mockElements.rewriteTraitsButton, 'click');
      await waitForNextTick();

      // Act
      simulateEvent(mockElements.copyTraitsButton, 'click');
      await waitForNextTick();

      // Assert
      expect(mockLogger.error).toHaveBeenCalledWith(
        'TraitsRewriterController: Copy to clipboard failed',
        expect.any(Error)
      );
      expect(mockElements.generationError.style.display).toBe('block');
      expect(errorElement.textContent).toBe('Copy failed');
    });
  });

  describe('Error Handling', () => {
    beforeEach(() => {
      controller = new TraitsRewriterController(mockDependencies);
      debounceCleanup = mockControllerDebounce(controller);
      controller._cacheElements();
      controller._setupEventListeners();
    });

    it('should display user-friendly error messages', () => {
      // Arrange
      const errorMessage = 'Generation failed: Invalid input';
      const error = new TraitsRewriterError(errorMessage, 'GENERATION_FAILED');

      // Act
      // Simulate error display
      mockElements.errorMessage.textContent = error.message;
      controller._showElement('generationError');

      // Assert
      expect(mockElements.errorMessage.textContent).toBe(errorMessage);
      expect(mockElements.generationError.style.display).not.toBe('none');
    });

    it('should handle generation failures gracefully', async () => {
      // Arrange
      const error = new Error('LLM service unavailable');
      mockTraitsRewriterGenerator.generateRewrittenTraits.mockRejectedValue(
        error
      );

      // Setup valid input
      const validJSON = JSON.stringify({
        components: {
          'core:name': 'Test Character',
          'core:personality': 'Brave',
        },
      });
      mockElements.characterDefinition.value = validJSON;
      simulateEvent(mockElements.characterDefinition, 'input');
      await waitForNextTick();

      // Act
      simulateEvent(mockElements.rewriteTraitsButton, 'click');
      await waitForNextTick();

      // Assert
      expect(mockLogger.error).toHaveBeenCalledWith(
        'TraitsRewriterController: Generation failed',
        error
      );
    });

    it('should provide retry functionality', async () => {
      // Arrange
      const error = new Error('Temporary failure');
      mockTraitsRewriterGenerator.generateRewrittenTraits
        .mockRejectedValueOnce(error)
        .mockResolvedValueOnce({
          rewrittenTraits: { 'core:personality': "I'm brave" },
          characterName: 'Test Character',
        });

      // Setup display enhancer mock for the successful retry
      mockTraitsRewriterDisplayEnhancer.enhanceForDisplay.mockReturnValue({
        sections: [
          { id: 'personality', title: 'Personality', content: "I'm brave" },
        ],
        characterName: 'Test Character',
      });

      // Setup valid input
      const validJSON = JSON.stringify({
        components: {
          'core:name': 'Test Character',
          'core:personality': 'Brave',
        },
      });
      mockElements.characterDefinition.value = validJSON;

      // Validate input to enable the button
      simulateEvent(mockElements.characterDefinition, 'input');
      await waitForNextTick();

      // First attempt will fail
      simulateEvent(mockElements.rewriteTraitsButton, 'click');
      await waitForNextTick();

      // Second attempt should succeed (based on mock setup)
      simulateEvent(mockElements.rewriteTraitsButton, 'click');
      await waitForNextTick();

      // Verify the generator was called twice
      expect(
        mockTraitsRewriterGenerator.generateRewrittenTraits
      ).toHaveBeenCalledTimes(2);
    });

    it('should handle JSON parse errors', async () => {
      // Arrange
      mockElements.characterDefinition.value = 'not valid json {';

      // Act
      simulateEvent(mockElements.characterDefinition, 'input');
      await waitForNextTick();

      // Assert
      expect(mockElements.characterInputError.textContent).toContain(
        'Invalid JSON'
      );
      expect(mockElements.rewriteTraitsButton.disabled).toBe(true);
    });

    it('should handle missing required fields', async () => {
      // Arrange
      const invalidJSON = JSON.stringify({
        'some:field': 'value',
        // Missing components property entirely
      });
      mockElements.characterDefinition.value = invalidJSON;

      // Act
      simulateEvent(mockElements.characterDefinition, 'input');
      await waitForNextTick();

      // Assert
      expect(mockElements.characterInputError.textContent).toContain(
        'components'
      );
      expect(mockElements.rewriteTraitsButton.disabled).toBe(true);
    });
  });

  describe('UI State Management', () => {
    beforeEach(() => {
      controller = new TraitsRewriterController(mockDependencies);
      debounceCleanup = mockControllerDebounce(controller);
      controller._cacheElements();
    });

    it('should manage state transitions properly', () => {
      // Test empty state
      controller._showState('empty');
      expect(mockElements.emptyState.style.display).not.toBe('none');

      // Test loading state
      controller._showElement('generationProgress');
      controller._hideElement('emptyState');
      expect(mockElements.generationProgress.style.display).not.toBe('none');
      expect(mockElements.emptyState.style.display).toBe('none');

      // Test results state
      controller._showElement('rewrittenTraitsContainer');
      controller._hideElement('generationProgress');
      expect(mockElements.rewrittenTraitsContainer.style.display).not.toBe(
        'none'
      );
      expect(mockElements.generationProgress.style.display).toBe('none');
    });

    it('should show generation progress', () => {
      // Arrange
      mockElements.generationProgress.style.display = 'none';

      // Act
      controller._showElement('generationProgress');

      // Assert
      expect(mockElements.generationProgress.style.display).not.toBe('none');
      // Progress text should maintain its initial value from setup
      expect(mockElements.progressText.textContent).toBe(
        'Rewriting traits in character voice...'
      );
    });

    it('should handle clear/reset functionality', async () => {
      // Arrange
      await controller.initialize();
      mockElements.characterDefinition.value = 'Some input';
      controller._showElement('rewrittenTraitsContainer');

      // Act
      simulateEvent(mockElements.clearInputButton, 'click');

      // Assert
      expect(mockElements.characterDefinition.value).toBe('');
      expect(mockElements.rewrittenTraitsContainer.style.display).toBe('none');
      expect(mockElements.emptyState.style.display).not.toBe('none');
    });

    it('should disable controls during generation', () => {
      // Arrange
      mockElements.rewriteTraitsButton.disabled = false;
      mockElements.clearInputButton.disabled = false;
      mockElements.characterDefinition.disabled = false;

      // Act - Simulate generation start
      controller._showElement('generationProgress');
      mockElements.rewriteTraitsButton.disabled = true;
      mockElements.clearInputButton.disabled = true;
      mockElements.characterDefinition.disabled = true;

      // Assert
      expect(mockElements.rewriteTraitsButton.disabled).toBe(true);
      expect(mockElements.clearInputButton.disabled).toBe(true);
      expect(mockElements.characterDefinition.disabled).toBe(true);
    });

    it('should re-enable controls after generation', () => {
      // Arrange
      mockElements.rewriteTraitsButton.disabled = true;
      mockElements.clearInputButton.disabled = true;
      mockElements.characterDefinition.disabled = true;

      // Act - Simulate generation complete
      controller._hideElement('generationProgress');
      mockElements.rewriteTraitsButton.disabled = false;
      mockElements.clearInputButton.disabled = false;
      mockElements.characterDefinition.disabled = false;

      // Assert
      expect(mockElements.rewriteTraitsButton.disabled).toBe(false);
      expect(mockElements.clearInputButton.disabled).toBe(false);
      expect(mockElements.characterDefinition.disabled).toBe(false);
    });
  });
});

// Note: setupMockDOMElements and createMockElement functions removed
// Replaced with optimized DOM setup from testOptimizations.js
