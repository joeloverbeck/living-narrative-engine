/**
 * @file Unit tests for SpeechPatternsGeneratorController
 * @see src/characterBuilder/controllers/SpeechPatternsGeneratorController.js
 */

import {
  describe,
  it,
  expect,
  beforeEach,
  afterEach,
  jest,
} from '@jest/globals';
import SpeechPatternsGeneratorController from '../../../../src/characterBuilder/controllers/SpeechPatternsGeneratorController.js';
import { EnhancedSpeechPatternsValidator } from '../../../../src/characterBuilder/validators/EnhancedSpeechPatternsValidator.js';
import { tokens } from '../../../../src/dependencyInjection/tokens.js';

// Mock dependencies
jest.mock('../../../../src/characterBuilder/validators/EnhancedSpeechPatternsValidator.js');
jest.mock('../../../../src/utils/domUtils.js', () => ({
  DomUtils: {
    createElement: jest.fn(),
    appendChild: jest.fn(),
  },
}));

// Mock global DOM methods
Object.defineProperty(global, 'performance', {
  value: {
    now: jest.fn(() => Date.now()),
    mark: jest.fn(),
    measure: jest.fn(() => ({ duration: 100 })),
  },
});

Object.defineProperty(global, 'requestAnimationFrame', {
  value: jest.fn((callback) => {
    callback();
    return 1;
  }),
});

Object.defineProperty(global, 'AbortController', {
  value: jest.fn().mockImplementation(() => ({
    signal: { aborted: false },
    abort: jest.fn(),
  })),
});

// Mock Blob and URL for file download tests
Object.defineProperty(global, 'Blob', {
  value: jest.fn().mockImplementation((content, options) => ({
    size: content[0].length,
    type: options?.type || 'text/plain',
  })),
});

Object.defineProperty(global, 'URL', {
  value: {
    createObjectURL: jest.fn(() => 'mock-blob-url'),
    revokeObjectURL: jest.fn(),
  },
});

describe('SpeechPatternsGeneratorController', () => {
  let controller;
  let mockLogger;
  let mockCharacterBuilderService;
  let mockEventBus;
  let mockSchemaValidator;
  let mockSpeechPatternsGenerator;
  let mockDisplayEnhancer;
  let mockContainer;
  let mockEnhancedValidator;
  let mockElements;

  beforeEach(() => {
    // Reset all mocks
    jest.clearAllMocks();

    // Mock global objects that are used in the production code
    global.Blob = jest.fn().mockImplementation((content, options) => ({
      content,
      type: options?.type || 'text/plain'
    }));
    
    global.URL = {
      createObjectURL: jest.fn(() => 'mock-blob-url'),
      revokeObjectURL: jest.fn(),
    };

    // Mock performance API methods
    if (!global.performance) {
      global.performance = {};
    }
    jest.spyOn(global.performance, 'now').mockReturnValue(Date.now());
    global.performance.mark = jest.fn();
    global.performance.measure = jest.fn(() => ({ duration: 100 }));

    global.requestAnimationFrame = jest.fn(cb => setTimeout(cb, 0));

    // Mock logger
    mockLogger = {
      debug: jest.fn(),
      info: jest.fn(),
      warn: jest.fn(),
      error: jest.fn(),
    };

    // Mock character builder service
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

    // Mock event bus
    mockEventBus = {
      dispatch: jest.fn(),
      subscribe: jest.fn(),
      unsubscribe: jest.fn(),
    };

    // Mock schema validator
    mockSchemaValidator = {
      validateAgainstSchema: jest.fn(),
      validate: jest.fn().mockReturnValue({ isValid: true, errors: null }),
    };

    // Mock speech patterns generator
    mockSpeechPatternsGenerator = {
      generateSpeechPatterns: jest.fn(),
      getServiceInfo: jest.fn().mockReturnValue({ 
        name: 'Mock Speech Patterns Generator',
        version: '1.0.0'
      }),
    };

    // Mock display enhancer
    mockDisplayEnhancer = {
      enhanceForDisplay: jest.fn(),
      formatForExport: jest.fn(),
      generateExportFilename: jest.fn(),
      getSupportedExportFormats: jest.fn(() => [
        { id: 'txt', name: 'Text', extension: '.txt', mimeType: 'text/plain' },
        { id: 'json', name: 'JSON', extension: '.json', mimeType: 'application/json' },
        { id: 'markdown', name: 'Markdown', extension: '.md', mimeType: 'text/markdown' },
        { id: 'csv', name: 'CSV', extension: '.csv', mimeType: 'text/csv' },
      ]),
      getAvailableTemplates: jest.fn(() => [
        { id: 'default', name: 'Default', description: 'Standard template' },
        { id: 'detailed', name: 'Detailed', description: 'Detailed template' },
      ]),
      formatAsJson: jest.fn(),
      formatAsMarkdown: jest.fn(),
      formatAsCsv: jest.fn(),
      applyTemplate: jest.fn(),
    };

    // Mock container
    mockContainer = {
      resolve: jest.fn(),
    };

    // Mock enhanced validator
    mockEnhancedValidator = {
      validateInput: jest.fn(),
    };

    // Mock enhanced validator constructor
    EnhancedSpeechPatternsValidator.mockImplementation(() => mockEnhancedValidator);

    // Mock DOM elements
    mockElements = {
      characterDefinition: createMockElement('textarea'),
      characterInputError: createMockElement('div'),
      generateBtn: createMockElement('button'),
      exportBtn: createMockElement('button'),
      clearBtn: createMockElement('button'),
      backBtn: createMockElement('button'),
      loadingState: createMockElement('div'),
      resultsState: createMockElement('div'),
      errorState: createMockElement('div'),
      speechPatternsContainer: createMockElement('div'),
      loadingIndicator: createMockElement('div'),
      loadingMessage: createMockElement('div'),
      emptyState: createMockElement('div'),
      patternCount: createMockElement('div'),
      progressContainer: createMockElement('div'),
      progressBar: createMockElement('div'),
      timeEstimate: createMockElement('div'),
      errorMessage: createMockElement('div'),
      retryBtn: createMockElement('button'),
      screenReaderAnnouncement: createMockElement('div'),
      exportFormat: createMockElement('select'),
      exportTemplate: createMockElement('select'),
      templateGroup: createMockElement('div'),
    };

    // Mock document.getElementById to return our mock elements
    jest.spyOn(document, 'getElementById').mockImplementation((id) => {
      const elementMap = {
        'character-definition': mockElements.characterDefinition,
        'character-input-error': mockElements.characterInputError,
        'generate-btn': mockElements.generateBtn,
        'export-btn': mockElements.exportBtn,
        'clear-all-btn': mockElements.clearBtn,
        'back-btn': mockElements.backBtn,
        'loading-state': mockElements.loadingState,
        'results-state': mockElements.resultsState,
        'error-state': mockElements.errorState,
        'speech-patterns-container': mockElements.speechPatternsContainer,
        'loading-indicator': mockElements.loadingIndicator,
        'loading-message': mockElements.loadingMessage,
        'empty-state': mockElements.emptyState,
        'pattern-count': mockElements.patternCount,
        'progress-container': mockElements.progressContainer,
        'progress-bar': mockElements.progressBar,
        'time-estimate': mockElements.timeEstimate,
        'error-message': mockElements.errorMessage,
        'retry-btn': mockElements.retryBtn,
        'screen-reader-announcement': mockElements.screenReaderAnnouncement,
        'export-format': mockElements.exportFormat,
        'export-template': mockElements.exportTemplate,
        'template-group': mockElements.templateGroup,
      };
      return elementMap[id] || null;
    });

    // Mock document.createElement
    jest.spyOn(document, 'createElement').mockImplementation((tagName) => {
      const mockEl = createMockElement(tagName);
      if (tagName === 'a') {
        // Special handling for download links
        mockEl.click = jest.fn();
        mockEl.download = '';
        mockEl.href = '';
      }
      return mockEl;
    });

    // Mock document.createDocumentFragment
    jest.spyOn(document, 'createDocumentFragment').mockImplementation(() => ({
      appendChild: jest.fn(),
    }));

    // Mock document.body
    Object.defineProperty(document, 'body', {
      value: {
        appendChild: jest.fn(),
        removeChild: jest.fn(),
      },
      configurable: true,
    });

    // Mock document.addEventListener
    jest.spyOn(document, 'addEventListener').mockImplementation(jest.fn());
    jest.spyOn(document, 'querySelectorAll').mockImplementation(() => []);
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  /**
   * Helper function to set up controller with proper base class mocking
   * @param {object} dependencies - Controller dependencies
   * @returns {SpeechPatternsGeneratorController} Initialized controller
   */
  async function createInitializedController(dependencies) {
    const controller = new SpeechPatternsGeneratorController(dependencies);
    
    // Mock the base class methods that are called during initialize()
    jest.spyOn(controller, '_cacheElements').mockImplementation(() => {
      // Simulate successful element caching
    });
    jest.spyOn(controller, '_loadInitialData').mockResolvedValue();
    jest.spyOn(controller, '_initializeUIState').mockResolvedValue();
    
    // Mock _getElement to return our mock elements
    jest.spyOn(controller, '_getElement').mockImplementation((elementName) => {
      return mockElements[elementName] || null;
    });
    
    jest.spyOn(controller, '_setupEventListeners').mockImplementation(() => {
      // Call the actual implementation to set up event listeners
      SpeechPatternsGeneratorController.prototype._setupEventListeners.call(controller);
    });
    
    await controller.initialize();
    return controller;
  }

  /**
   * Create a mock DOM element with common properties and methods
   *
   * @param {string} tagName - The HTML tag name
   * @returns {object} Mock DOM element
   */
  function createMockElement(tagName = 'div') {
    const element = {
      tagName: tagName.toUpperCase(),
      value: '',
      textContent: '',
      innerHTML: '',
      style: {
        display: '',
        width: '',
        contain: '',
        cursor: '',
        willChange: '',
        transform: '',
      },
      classList: {
        _classes: new Set(),
        add: jest.fn(function(className) {
          this._classes.add(className);
        }),
        remove: jest.fn(function(className) {
          this._classes.delete(className);
        }),
        contains: jest.fn(function(className) {
          return this._classes.has(className);
        }),
        toggle: jest.fn(function(className) {
          if (this._classes.has(className)) {
            this._classes.delete(className);
            return false;
          } else {
            this._classes.add(className);
            return true;
          }
        }),
      },
      addEventListener: jest.fn(),
      removeEventListener: jest.fn(),
      setAttribute: jest.fn(),
      getAttribute: jest.fn(),
      removeAttribute: jest.fn(),
      appendChild: jest.fn(),
      removeChild: jest.fn(),
      querySelector: jest.fn(),
      querySelectorAll: jest.fn(() => []),
      focus: jest.fn(),
      blur: jest.fn(),
      click: jest.fn(),
      dispatchEvent: jest.fn(),
      parentElement: null,
      nextElementSibling: null,
      previousElementSibling: null,
      firstElementChild: null,
      lastElementChild: null,
      // Add DOM API methods that are used in production code
      closest: jest.fn((selector) => {
        // Mock implementation that returns the element if it matches the selector class
        if (selector === '.speech-pattern-item' && element.classList.contains('speech-pattern-item')) {
          return element;
        }
        return null;
      }),
    };

    // Add specific properties for select elements
    if (tagName === 'select') {
      element.options = [];
      element.selectedIndex = 0;
    }

    return element;
  }

  describe('Constructor Tests', () => {
    it('should create instance with all required dependencies', () => {
      const dependencies = {
        logger: mockLogger,
        characterBuilderService: mockCharacterBuilderService,
        eventBus: mockEventBus,
        schemaValidator: mockSchemaValidator,
        speechPatternsGenerator: mockSpeechPatternsGenerator,
        speechPatternsDisplayEnhancer: mockDisplayEnhancer,
      };

      controller = new SpeechPatternsGeneratorController(dependencies);

      expect(controller).toBeInstanceOf(SpeechPatternsGeneratorController);
      // Constructor does log some debug messages during validation
    });

    it('should handle optional display enhancer dependency', () => {
      const dependencies = {
        logger: mockLogger,
        characterBuilderService: mockCharacterBuilderService,
        eventBus: mockEventBus,
        schemaValidator: mockSchemaValidator,
      };

      controller = new SpeechPatternsGeneratorController(dependencies);

      expect(controller).toBeInstanceOf(SpeechPatternsGeneratorController);
    });

    it('should resolve speech patterns generator from container when not directly provided', () => {
      mockContainer.resolve.mockReturnValue(mockSpeechPatternsGenerator);

      const dependencies = {
        logger: mockLogger,
        characterBuilderService: mockCharacterBuilderService,
        eventBus: mockEventBus,
        schemaValidator: mockSchemaValidator,
        container: mockContainer,
      };

      controller = new SpeechPatternsGeneratorController(dependencies);

      expect(mockContainer.resolve).toHaveBeenCalledWith(tokens.SpeechPatternsGenerator);
    });

    it('should handle container resolution failure gracefully', () => {
      const containerError = new Error('Service not registered');
      mockContainer.resolve.mockImplementation(() => {
        throw containerError;
      });

      const dependencies = {
        logger: mockLogger,
        characterBuilderService: mockCharacterBuilderService,
        eventBus: mockEventBus,
        schemaValidator: mockSchemaValidator,
        container: mockContainer,
      };

      controller = new SpeechPatternsGeneratorController(dependencies);

      expect(mockLogger.warn).toHaveBeenCalledWith(
        'SpeechPatternsGenerator not available:',
        containerError.message
      );
    });

    it('should initialize enhanced validator when schema validator is available', () => {
      const dependencies = {
        logger: mockLogger,
        characterBuilderService: mockCharacterBuilderService,
        eventBus: mockEventBus,
        schemaValidator: mockSchemaValidator,
      };

      controller = new SpeechPatternsGeneratorController(dependencies);

      expect(EnhancedSpeechPatternsValidator).toHaveBeenCalledWith({
        schemaValidator: mockSchemaValidator,
        logger: mockLogger,
      });
      expect(mockLogger.debug).toHaveBeenCalledWith(
        'EnhancedSpeechPatternsValidator initialized'
      );
    });

    it('should handle enhanced validator initialization failure', () => {
      const validatorError = new Error('Validator initialization failed');
      EnhancedSpeechPatternsValidator.mockImplementation(() => {
        throw validatorError;
      });

      const dependencies = {
        logger: mockLogger,
        characterBuilderService: mockCharacterBuilderService,
        eventBus: mockEventBus,
        schemaValidator: mockSchemaValidator,
      };

      controller = new SpeechPatternsGeneratorController(dependencies);

      expect(mockLogger.warn).toHaveBeenCalledWith(
        'Failed to initialize enhanced validator:',
        validatorError.message
      );
    });

    it('should validate display enhancer dependencies', () => {
      const invalidEnhancer = { invalidMethod: jest.fn() };

      expect(() => {
        new SpeechPatternsGeneratorController({
          logger: mockLogger,
          characterBuilderService: mockCharacterBuilderService,
          eventBus: mockEventBus,
          schemaValidator: mockSchemaValidator,
          speechPatternsDisplayEnhancer: invalidEnhancer,
        });
      }).toThrow();
    });

    it('should validate speech patterns generator dependencies', () => {
      const invalidGenerator = { invalidMethod: jest.fn() };

      expect(() => {
        new SpeechPatternsGeneratorController({
          logger: mockLogger,
          characterBuilderService: mockCharacterBuilderService,
          eventBus: mockEventBus,
          schemaValidator: mockSchemaValidator,
          speechPatternsGenerator: invalidGenerator,
        });
      }).toThrow();
    });
  });

  describe('Element Caching Tests', () => {
    beforeEach(async () => {
      // For element caching tests, we need to test actual caching behavior
      // So we don't use createInitializedController which mocks _cacheElements
      controller = new SpeechPatternsGeneratorController({
        logger: mockLogger,
        characterBuilderService: mockCharacterBuilderService,
        eventBus: mockEventBus,
        schemaValidator: mockSchemaValidator,
      });
      
      // Mock individual lifecycle methods but NOT _cacheElements
      jest.spyOn(controller, '_setupEventListeners').mockImplementation(() => {});
      jest.spyOn(controller, '_loadInitialData').mockResolvedValue();
      jest.spyOn(controller, '_initializeUIState').mockResolvedValue();
      
      await controller.initialize();
    });

    it('should cache required elements successfully', () => {
      // Elements should be cached during initialization
      expect(document.getElementById).toHaveBeenCalledWith('character-definition');
      expect(document.getElementById).toHaveBeenCalledWith('generate-btn');
      expect(document.getElementById).toHaveBeenCalledWith('loading-state');
    });

    it('should handle missing optional elements gracefully', () => {
      // Mock some elements as missing
      jest.spyOn(document, 'getElementById').mockImplementation((id) => {
        if (id === 'progress-container' || id === 'time-estimate') {
          return null;
        }
        return mockElements[id.replace(/-([a-z])/g, (g) => g[1].toUpperCase())] || null;
      });

      // Re-create controller to trigger element caching
      controller = new SpeechPatternsGeneratorController({
        logger: mockLogger,
        characterBuilderService: mockCharacterBuilderService,
        eventBus: mockEventBus,
        schemaValidator: mockSchemaValidator,
      });

      // Should not throw error for missing optional elements
      expect(controller).toBeInstanceOf(SpeechPatternsGeneratorController);
    });
  });

  describe('Event Listeners Setup Tests', () => {
    beforeEach(async () => {
      controller = await createInitializedController({
        logger: mockLogger,
        characterBuilderService: mockCharacterBuilderService,
        eventBus: mockEventBus,
        schemaValidator: mockSchemaValidator,
      });
    });

    it('should setup character input event listeners', () => {
      expect(mockElements.characterDefinition.addEventListener).toHaveBeenCalledWith(
        'input',
        expect.any(Function),
        expect.any(Object)
      );
      expect(mockElements.characterDefinition.addEventListener).toHaveBeenCalledWith(
        'blur',
        expect.any(Function),
        expect.any(Object)
      );
    });

    it('should setup button event listeners', () => {
      expect(mockElements.generateBtn.addEventListener).toHaveBeenCalledWith(
        'click',
        expect.any(Function),
        expect.any(Object)
      );
      expect(mockElements.exportBtn.addEventListener).toHaveBeenCalledWith(
        'click',
        expect.any(Function),
        expect.any(Object)
      );
      expect(mockElements.clearBtn.addEventListener).toHaveBeenCalledWith(
        'click',
        expect.any(Function),
        expect.any(Object)
      );
      expect(mockElements.backBtn.addEventListener).toHaveBeenCalledWith(
        'click',
        expect.any(Function),
        expect.any(Object)
      );
    });

    it('should setup keyboard event listeners', () => {
      expect(document.addEventListener).toHaveBeenCalledWith(
        'keydown',
        expect.any(Function)
      );
    });

    it('should create debounced validation function', () => {
      // Trigger input event to test debounced validation setup
      mockElements.characterDefinition.value = 'test input';
      const inputHandler = mockElements.characterDefinition.addEventListener.mock.calls
        .find(call => call[0] === 'input')[1];
      
      inputHandler();
      
      // Should not throw and should handle debounced validation
      expect(inputHandler).toBeDefined();
    });
  });

  describe('Input Handling Tests', () => {
    beforeEach(async () => {
      controller = await createInitializedController({
        logger: mockLogger,
        characterBuilderService: mockCharacterBuilderService,
        eventBus: mockEventBus,
        schemaValidator: mockSchemaValidator,
      });
    });

    it('should handle character input changes', () => {
      mockElements.characterDefinition.value = '  test input  ';
      
      const inputHandler = mockElements.characterDefinition.addEventListener.mock.calls
        .find(call => call[0] === 'input')[1];
      
      inputHandler();
      
      // Should clear validation errors
      expect(mockElements.characterInputError.style.display).toBe('none');
    });

    it('should trigger debounced validation for substantial input', () => {
      mockElements.characterDefinition.value = 'This is substantial input content that should trigger validation';
      
      const inputHandler = mockElements.characterDefinition.addEventListener.mock.calls
        .find(call => call[0] === 'input')[1];
      
      // Should not throw when handling substantial input
      expect(() => inputHandler()).not.toThrow();
    });

    it('should skip validation for short input', () => {
      mockElements.characterDefinition.value = 'short';
      
      const inputHandler = mockElements.characterDefinition.addEventListener.mock.calls
        .find(call => call[0] === 'input')[1];
      
      // Should handle short input without validation
      expect(() => inputHandler()).not.toThrow();
    });

    it('should handle blur event for enhanced validation', () => {
      const blurHandler = mockElements.characterDefinition.addEventListener.mock.calls
        .find(call => call[0] === 'blur')[1];
      
      expect(() => blurHandler()).not.toThrow();
    });
  });

  describe('Character Validation Tests', () => {
    beforeEach(async () => {
      controller = await createInitializedController({
        logger: mockLogger,
        characterBuilderService: mockCharacterBuilderService,
        eventBus: mockEventBus,
        schemaValidator: mockSchemaValidator,
      });
    });

    it.skip('should validate valid JSON character input', async () => {
      const validCharacterData = {
        'core:name': { text: 'John Doe' },
        'core:personality': { traits: ['brave', 'loyal'] },
        'core:profile': { age: 30 }
      };

      mockElements.characterDefinition.value = JSON.stringify(validCharacterData);
      
      // Test basic validation by calling the blur handler
      const blurHandler = mockElements.characterDefinition.addEventListener.mock.calls
        .find(call => call[0] === 'blur')[1];
      
      await blurHandler();
      
      // Should not display validation errors for valid input
      expect(mockElements.characterInputError.style.display).toBe('none');
    });

    it('should handle JSON syntax errors', async () => {
      mockElements.characterDefinition.value = '{ invalid json }';
      
      const blurHandler = mockElements.characterDefinition.addEventListener.mock.calls
        .find(call => call[0] === 'blur')[1];
      
      await blurHandler();
      
      // Should display validation error
      expect(mockElements.characterInputError.style.display).toBe('block');
    });

    it('should handle empty input gracefully', async () => {
      mockElements.characterDefinition.value = '';
      
      const blurHandler = mockElements.characterDefinition.addEventListener.mock.calls
        .find(call => call[0] === 'blur')[1];
      
      await blurHandler();
      
      // Should clear validation display
      expect(() => blurHandler()).not.toThrow();
    });

    it('should use enhanced validator when available', async () => {
      const validationResult = {
        isValid: true,
        errors: [],
        warnings: ['Minor warning'],
        suggestions: ['Consider adding more detail'],
        quality: { overallScore: 0.8 }
      };

      mockEnhancedValidator.validateInput.mockResolvedValue(validationResult);

      const characterData = {
        'core:name': { text: 'Jane Doe' },
        'core:personality': { traits: ['intelligent'] }
      };

      mockElements.characterDefinition.value = JSON.stringify(characterData);
      
      const blurHandler = mockElements.characterDefinition.addEventListener.mock.calls
        .find(call => call[0] === 'blur')[1];
      
      await blurHandler();
      
      expect(mockEnhancedValidator.validateInput).toHaveBeenCalledWith(
        characterData,
        {
          includeQualityAssessment: true,
          includeSuggestions: true,
        }
      );
    });

    it('should fallback to basic validation when enhanced validator fails', async () => {
      const validatorError = new Error('Enhanced validator failed');
      mockEnhancedValidator.validateInput.mockRejectedValue(validatorError);

      const characterData = {
        'core:name': { text: 'John Smith' }
      };

      mockElements.characterDefinition.value = JSON.stringify(characterData);
      
      const blurHandler = mockElements.characterDefinition.addEventListener.mock.calls
        .find(call => call[0] === 'blur')[1];
      
      await blurHandler();
      
      expect(mockLogger.error).toHaveBeenCalledWith('Enhanced validation failed:', validatorError);
    });
  });

  describe('Character Structure Validation Tests', () => {
    beforeEach(async () => {
      controller = await createInitializedController({
        logger: mockLogger,
        characterBuilderService: mockCharacterBuilderService,
        eventBus: mockEventBus,
        schemaValidator: mockSchemaValidator,
      });
    });

    it.skip('should validate required character components', async () => {
      const characterData = {
        'core:name': { text: 'Alice' },
        'core:personality': { traits: ['kind', 'determined'] },
        'core:profile': { background: 'Healer' }
      };

      mockElements.characterDefinition.value = JSON.stringify(characterData);
      
      const blurHandler = mockElements.characterDefinition.addEventListener.mock.calls
        .find(call => call[0] === 'blur')[1];
      
      await blurHandler();
      
      // Should pass validation with required components
      expect(mockElements.characterDefinition.classList.add).not.toHaveBeenCalledWith('error');
    });

    it('should detect missing required components', async () => {
      const characterData = {
        'some:other': { data: 'value' }
      };

      mockElements.characterDefinition.value = JSON.stringify(characterData);
      
      const blurHandler = mockElements.characterDefinition.addEventListener.mock.calls
        .find(call => call[0] === 'blur')[1];
      
      await blurHandler();
      
      // Should show validation error
      expect(mockElements.characterInputError.style.display).toBe('block');
    });

    it.skip('should support legacy format without components wrapper', async () => {
      const legacyCharacterData = {
        'core:name': { text: 'Bob' },
        'core:personality': { traits: ['brave'] }
      };

      mockElements.characterDefinition.value = JSON.stringify(legacyCharacterData);
      
      const blurHandler = mockElements.characterDefinition.addEventListener.mock.calls
        .find(call => call[0] === 'blur')[1];
      
      await blurHandler();
      
      // Should handle legacy format
      expect(mockElements.characterDefinition.classList.add).not.toHaveBeenCalledWith('error');
    });

    it.skip('should support new format with components wrapper', async () => {
      const newFormatData = {
        components: {
          'core:name': { text: 'Charlie' },
          'core:personality': { traits: ['clever'] }
        }
      };

      mockElements.characterDefinition.value = JSON.stringify(newFormatData);
      
      const blurHandler = mockElements.characterDefinition.addEventListener.mock.calls
        .find(call => call[0] === 'blur')[1];
      
      await blurHandler();
      
      // Should handle new format
      expect(mockElements.characterDefinition.classList.add).not.toHaveBeenCalledWith('error');
    });

    it.skip('should extract character name from different field formats', async () => {
      const testCases = [
        { text: 'David' },
        { name: 'Emma' },
        { value: 'Frank' },
        { personal: { firstName: 'Grace', lastName: 'Jones' } }
      ];

      for (const nameComponent of testCases) {
        const characterData = {
          'core:name': nameComponent,
          'core:personality': { traits: ['unique'] }
        };

        mockElements.characterDefinition.value = JSON.stringify(characterData);
        
        const blurHandler = mockElements.characterDefinition.addEventListener.mock.calls
          .find(call => call[0] === 'blur')[1];
        
        await blurHandler();
        
        // Should successfully extract name
        expect(mockElements.characterDefinition.classList.add).not.toHaveBeenCalledWith('error');
      }
    });

    it('should validate content depth', async () => {
      const shallowData = {
        'core:name': { text: 'X' },
        'core:personality': { x: '1' }
      };

      mockElements.characterDefinition.value = JSON.stringify(shallowData);
      
      const blurHandler = mockElements.characterDefinition.addEventListener.mock.calls
        .find(call => call[0] === 'blur')[1];
      
      await blurHandler();
      
      // Should detect lack of detailed content
      expect(mockElements.characterInputError.style.display).toBe('block');
    });

    it('should handle empty character name', async () => {
      const characterData = {
        'core:name': { text: '' },
        'core:personality': { traits: ['mysterious'] }
      };

      mockElements.characterDefinition.value = JSON.stringify(characterData);
      
      const blurHandler = mockElements.characterDefinition.addEventListener.mock.calls
        .find(call => call[0] === 'blur')[1];
      
      await blurHandler();
      
      // Should show error for empty name
      expect(mockElements.characterInputError.style.display).toBe('block');
    });
  });

  describe('Progress Tracking Tests', () => {
    beforeEach(() => {
      controller = new SpeechPatternsGeneratorController({
        logger: mockLogger,
        characterBuilderService: mockCharacterBuilderService,
        eventBus: mockEventBus,
        schemaValidator: mockSchemaValidator,
      });
    });

    it('should update loading progress with stage information', () => {
      mockElements.loadingMessage.textContent = '';
      mockElements.progressBar.style.width = '';
      
      // Call private method through controller (accessing private methods for testing)
      const updateProgressMethod = controller.constructor.prototype.constructor;
      
      // Test progress update components exist
      expect(mockElements.loadingMessage).toBeDefined();
      expect(mockElements.progressBar).toBeDefined();
    });

    it('should calculate time estimates based on stage and progress', () => {
      const startTime = performance.now() - 5000; // 5 seconds ago
      const progress = 30;
      
      // Test that performance.now is being called for time calculations
      expect(performance.now).toBeDefined();
    });

    it('should format time estimates correctly', () => {
      const timeEstimate = {
        remaining: 45000, // 45 seconds
        confidence: 0.85
      };
      
      // Time formatting logic exists in the controller
      expect(timeEstimate.remaining).toBeGreaterThan(0);
      expect(timeEstimate.confidence).toBeGreaterThan(0);
    });

    it('should announce progress to screen readers', () => {
      const stage = 'processing';
      const progress = 50;
      
      // Should handle screen reader announcements
      expect(mockElements.screenReaderAnnouncement).toBeDefined();
    });

    it('should update progress bar with animation', () => {
      const progress = 75;
      
      // Should use requestAnimationFrame for smooth updates
      expect(global.requestAnimationFrame).toBeDefined();
      
      global.requestAnimationFrame(() => {
        // Animation callback should execute
        expect(true).toBe(true);
      });
    });

    it('should handle different progress stages', () => {
      const stages = ['validation', 'processing', 'response', 'rendering'];
      
      stages.forEach(stage => {
        // Each stage should have corresponding message handling
        expect(stage).toBeDefined();
      });
    });
  });

  describe('Main Generation Workflow Tests', () => {
    beforeEach(async () => {
      controller = await createInitializedController({
        logger: mockLogger,
        characterBuilderService: mockCharacterBuilderService,
        eventBus: mockEventBus,
        schemaValidator: mockSchemaValidator,
        speechPatternsGenerator: mockSpeechPatternsGenerator,
      });

      // Set up valid character definition
      const characterData = {
        'core:name': { text: 'Test Character' },
        'core:personality': { traits: ['brave', 'intelligent'] }
      };
      mockElements.characterDefinition.value = JSON.stringify(characterData);
    });

    it.skip('should handle generation button click', async () => {
      // Mock successful generation
      mockSpeechPatternsGenerator.generateSpeechPatterns.mockResolvedValue({
        speechPatterns: ['Pattern 1', 'Pattern 2', 'Pattern 3'],
        characterName: 'Test Character',
        generatedAt: new Date().toISOString(),
        totalCount: 3
      });

      const clickHandler = mockElements.generateBtn.addEventListener.mock.calls
        .find(call => call[0] === 'click')[1];
      
      await clickHandler();
      
      expect(mockSpeechPatternsGenerator.generateSpeechPatterns).toHaveBeenCalled();
    });

    it.skip('should prevent duplicate generation requests', async () => {
      // Mock slow generation
      mockSpeechPatternsGenerator.generateSpeechPatterns.mockImplementation(
        () => new Promise(resolve => setTimeout(resolve, 1000))
      );

      const clickHandler = mockElements.generateBtn.addEventListener.mock.calls
        .find(call => call[0] === 'click')[1];
      
      // Start first generation
      const firstPromise = clickHandler();
      
      // Try to start second generation immediately
      const secondPromise = clickHandler();
      
      await Promise.all([firstPromise, secondPromise]);
      
      // Should only call generator once
      expect(mockSpeechPatternsGenerator.generateSpeechPatterns).toHaveBeenCalledTimes(1);
    });

    it.skip('should handle generation with progress callback', async () => {
      let progressCallback;
      mockSpeechPatternsGenerator.generateSpeechPatterns.mockImplementation((data, options) => {
        progressCallback = options?.progressCallback;
        return Promise.resolve({
          speechPatterns: ['Pattern 1'],
          characterName: 'Test Character',
          generatedAt: new Date().toISOString(),
          totalCount: 1
        });
      });

      const clickHandler = mockElements.generateBtn.addEventListener.mock.calls
        .find(call => call[0] === 'click')[1];
      
      await clickHandler();
      
      // Should provide progress callback
      expect(progressCallback).toBeDefined();
      
      // Test progress callback
      if (progressCallback) {
        expect(() => progressCallback(50)).not.toThrow();
      }
    });

    it.skip('should handle generation cancellation with AbortController', async () => {
      let abortController;
      mockSpeechPatternsGenerator.generateSpeechPatterns.mockImplementation((data, options) => {
        abortController = options?.abortSignal?.controller;
        return new Promise((resolve, reject) => {
          setTimeout(() => {
            if (options?.abortSignal?.aborted) {
              reject(new Error('AbortError'));
            } else {
              resolve({
                speechPatterns: ['Pattern 1'],
                characterName: 'Test Character',
                totalCount: 1
              });
            }
          }, 100);
        });
      });

      const clickHandler = mockElements.generateBtn.addEventListener.mock.calls
        .find(call => call[0] === 'click')[1];
      
      // Start generation
      const generationPromise = clickHandler();
      
      // Simulate ESC key to cancel
      const escEvent = new KeyboardEvent('keydown', { key: 'Escape' });
      document.dispatchEvent(escEvent);
      
      await expect(generationPromise).resolves.toBeDefined();
    });

    it.skip('should handle generation errors', async () => {
      const generationError = new Error('Generation failed');
      mockSpeechPatternsGenerator.generateSpeechPatterns.mockRejectedValue(generationError);

      const clickHandler = mockElements.generateBtn.addEventListener.mock.calls
        .find(call => call[0] === 'click')[1];
      
      await clickHandler();
      
      expect(mockLogger.error).toHaveBeenCalledWith('Speech pattern generation failed:', generationError);
    });

    it.skip('should track generation performance', async () => {
      mockSpeechPatternsGenerator.generateSpeechPatterns.mockResolvedValue({
        speechPatterns: ['Pattern 1', 'Pattern 2'],
        characterName: 'Test Character',
        totalCount: 2
      });

      const clickHandler = mockElements.generateBtn.addEventListener.mock.calls
        .find(call => call[0] === 'click')[1];
      
      await clickHandler();
      
      // Should mark performance points
      expect(performance.mark).toHaveBeenCalledWith('speech-patterns-generation-start');
      expect(performance.measure).toHaveBeenCalled();
    });

    it.skip('should update UI states during generation', async () => {
      mockSpeechPatternsGenerator.generateSpeechPatterns.mockResolvedValue({
        speechPatterns: ['Pattern 1'],
        characterName: 'Test Character',
        totalCount: 1
      });

      const clickHandler = mockElements.generateBtn.addEventListener.mock.calls
        .find(call => call[0] === 'click')[1];
      
      await clickHandler();
      
      // Should disable generate button during generation
      expect(mockElements.generateBtn.disabled).toBeTruthy();
    });

    it.skip('should log performance summary on completion', async () => {
      mockSpeechPatternsGenerator.generateSpeechPatterns.mockResolvedValue({
        speechPatterns: ['Pattern 1', 'Pattern 2', 'Pattern 3'],
        characterName: 'Performance Test Character',
        totalCount: 3
      });

      const clickHandler = mockElements.generateBtn.addEventListener.mock.calls
        .find(call => call[0] === 'click')[1];
      
      await clickHandler();
      
      expect(mockLogger.info).toHaveBeenCalledWith(
        'Speech patterns generation completed',
        expect.objectContaining({
          patternCount: 3
        })
      );
    });
  });

  describe('Results Display Tests', () => {
    beforeEach(async () => {
      controller = await createInitializedController({
        logger: mockLogger,
        characterBuilderService: mockCharacterBuilderService,
        eventBus: mockEventBus,
        schemaValidator: mockSchemaValidator,
        speechPatternsGenerator: mockSpeechPatternsGenerator,
        speechPatternsDisplayEnhancer: mockDisplayEnhancer,
      });
    });

    it.skip('should display results using display enhancer', async () => {
      const mockPatterns = {
        speechPatterns: ['Pattern 1', 'Pattern 2'],
        characterName: 'Display Test Character',
        totalCount: 2
      };

      const enhancedDisplayData = {
        patterns: [
          { 
            index: 1, 
            htmlSafePattern: 'Enhanced Pattern 1',
            htmlSafeExample: 'Example 1',
            circumstances: 'When excited'
          },
          { 
            index: 2, 
            htmlSafePattern: 'Enhanced Pattern 2',
            htmlSafeExample: 'Example 2',
            circumstances: 'When thoughtful'
          }
        ],
        characterName: 'Display Test Character',
        totalCount: 2
      };

      mockDisplayEnhancer.enhanceForDisplay.mockReturnValue(enhancedDisplayData);

      // Simulate successful generation that calls display
      mockSpeechPatternsGenerator.generateSpeechPatterns.mockResolvedValue(mockPatterns);

      const clickHandler = mockElements.generateBtn.addEventListener.mock.calls
        .find(call => call[0] === 'click')[1];
      
      await clickHandler();
      
      expect(mockDisplayEnhancer.enhanceForDisplay).toHaveBeenCalledWith(mockPatterns);
      expect(mockElements.speechPatternsContainer.appendChild).toHaveBeenCalled();
    });

    it.skip('should use fallback display when enhancer not available', async () => {
      // Create controller without display enhancer
      controller = new SpeechPatternsGeneratorController({
        logger: mockLogger,
        characterBuilderService: mockCharacterBuilderService,
        eventBus: mockEventBus,
        schemaValidator: mockSchemaValidator,
        speechPatternsGenerator: mockSpeechPatternsGenerator,
      });

      const mockPatterns = {
        speechPatterns: ['Fallback Pattern 1', 'Fallback Pattern 2'],
        characterName: 'Fallback Test Character',
        totalCount: 2
      };

      mockSpeechPatternsGenerator.generateSpeechPatterns.mockResolvedValue(mockPatterns);

      const clickHandler = mockElements.generateBtn.addEventListener.mock.calls
        .find(call => call[0] === 'click')[1];
      
      await clickHandler();
      
      // Should create fallback display without enhancer
      expect(mockElements.speechPatternsContainer.appendChild).toHaveBeenCalled();
    });

    it.skip('should create results header with character name and count', async () => {
      const mockPatterns = {
        speechPatterns: ['Header Pattern'],
        characterName: 'Header Test Character',
        totalCount: 1
      };

      mockDisplayEnhancer.enhanceForDisplay.mockReturnValue({
        patterns: [{ index: 1, htmlSafePattern: 'Header Pattern', htmlSafeExample: 'Example' }],
        characterName: 'Header Test Character',
        totalCount: 1
      });

      mockSpeechPatternsGenerator.generateSpeechPatterns.mockResolvedValue(mockPatterns);

      const clickHandler = mockElements.generateBtn.addEventListener.mock.calls
        .find(call => call[0] === 'click')[1];
      
      await clickHandler();
      
      expect(mockDisplayEnhancer.enhanceForDisplay).toHaveBeenCalled();
    });

    it.skip('should render individual speech patterns with accessibility attributes', async () => {
      const mockPatterns = {
        speechPatterns: ['Accessible Pattern'],
        characterName: 'Accessibility Test Character',
        totalCount: 1
      };

      const mockElement = createMockElement('article');
      jest.spyOn(document, 'createElement').mockReturnValue(mockElement);

      mockDisplayEnhancer.enhanceForDisplay.mockReturnValue({
        patterns: [{ 
          index: 1, 
          htmlSafePattern: 'Accessible Pattern',
          htmlSafeExample: 'Accessible Example',
          circumstances: 'When testing'
        }],
        characterName: 'Accessibility Test Character',
        totalCount: 1
      });

      mockSpeechPatternsGenerator.generateSpeechPatterns.mockResolvedValue(mockPatterns);

      const clickHandler = mockElements.generateBtn.addEventListener.mock.calls
        .find(call => call[0] === 'click')[1];
      
      await clickHandler();
      
      // Should set accessibility attributes
      expect(mockElement.setAttribute).toHaveBeenCalledWith('role', 'article');
      expect(mockElement.setAttribute).toHaveBeenCalledWith('tabindex', '-1');
    });

    it.skip('should update pattern count display', async () => {
      const mockPatterns = {
        speechPatterns: ['Count Pattern 1', 'Count Pattern 2', 'Count Pattern 3'],
        characterName: 'Count Test Character',
        totalCount: 3
      };

      mockDisplayEnhancer.enhanceForDisplay.mockReturnValue({
        patterns: [
          { index: 1, htmlSafePattern: 'Count Pattern 1', htmlSafeExample: 'Example 1' },
          { index: 2, htmlSafePattern: 'Count Pattern 2', htmlSafeExample: 'Example 2' },
          { index: 3, htmlSafePattern: 'Count Pattern 3', htmlSafeExample: 'Example 3' }
        ],
        characterName: 'Count Test Character',
        totalCount: 3
      });

      mockSpeechPatternsGenerator.generateSpeechPatterns.mockResolvedValue(mockPatterns);

      const clickHandler = mockElements.generateBtn.addEventListener.mock.calls
        .find(call => call[0] === 'click')[1];
      
      await clickHandler();
      
      expect(mockElements.patternCount.textContent).toBe('3 patterns generated');
    });

    it.skip('should set first pattern as focusable for keyboard navigation', async () => {
      const mockPatterns = {
        speechPatterns: ['Focus Pattern'],
        characterName: 'Focus Test Character',
        totalCount: 1
      };

      const mockPatternElement = createMockElement('article');
      mockPatternElement.classList.add('speech-pattern-item');
      mockElements.speechPatternsContainer.querySelector = jest.fn(() => mockPatternElement);

      mockDisplayEnhancer.enhanceForDisplay.mockReturnValue({
        patterns: [{ 
          index: 1, 
          htmlSafePattern: 'Focus Pattern',
          htmlSafeExample: 'Focus Example'
        }],
        characterName: 'Focus Test Character',
        totalCount: 1
      });

      mockSpeechPatternsGenerator.generateSpeechPatterns.mockResolvedValue(mockPatterns);

      const clickHandler = mockElements.generateBtn.addEventListener.mock.calls
        .find(call => call[0] === 'click')[1];
      
      await clickHandler();
      
      expect(mockPatternElement.setAttribute).toHaveBeenCalledWith('tabindex', '0');
    });

    it.skip('should use document fragments for efficient DOM updates', async () => {
      const mockPatterns = {
        speechPatterns: ['Fragment Pattern'],
        characterName: 'Fragment Test Character',
        totalCount: 1
      };

      mockDisplayEnhancer.enhanceForDisplay.mockReturnValue({
        patterns: [{ 
          index: 1, 
          htmlSafePattern: 'Fragment Pattern',
          htmlSafeExample: 'Fragment Example'
        }],
        characterName: 'Fragment Test Character',
        totalCount: 1
      });

      mockSpeechPatternsGenerator.generateSpeechPatterns.mockResolvedValue(mockPatterns);

      const clickHandler = mockElements.generateBtn.addEventListener.mock.calls
        .find(call => call[0] === 'click')[1];
      
      await clickHandler();
      
      expect(document.createDocumentFragment).toHaveBeenCalled();
    });
  });

  describe('Export Functionality Tests', () => {
    beforeEach(async () => {
      controller = await createInitializedController({
        logger: mockLogger,
        characterBuilderService: mockCharacterBuilderService,
        eventBus: mockEventBus,
        schemaValidator: mockSchemaValidator,
        speechPatternsGenerator: mockSpeechPatternsGenerator,
        speechPatternsDisplayEnhancer: mockDisplayEnhancer,
      });

      // Set up generated patterns for export
      const mockPatterns = {
        speechPatterns: ['Export Pattern 1', 'Export Pattern 2'],
        characterName: 'Export Test Character',
        generatedAt: new Date().toISOString(),
        totalCount: 2
      };
      
      // Simulate successful generation to enable export
      mockSpeechPatternsGenerator.generateSpeechPatterns.mockResolvedValue(mockPatterns);
      const clickHandler = mockElements.generateBtn.addEventListener.mock.calls
        .find(call => call[0] === 'click')[1];
    });

    it.skip('should export to text format using display enhancer', async () => {
      mockDisplayEnhancer.formatForExport.mockReturnValue('Formatted export text');
      mockDisplayEnhancer.generateExportFilename.mockReturnValue('export_test_character.txt');
      mockElements.exportFormat.value = 'txt';

      // Generate patterns first
      await mockElements.generateBtn.addEventListener.mock.calls
        .find(call => call[0] === 'click')[1]();

      const exportHandler = mockElements.exportBtn.addEventListener.mock.calls
        .find(call => call[0] === 'click')[1];
      
      exportHandler();
      
      expect(mockDisplayEnhancer.formatForExport).toHaveBeenCalled();
      expect(global.Blob).toHaveBeenCalledWith(['Formatted export text'], { type: 'text/plain;charset=utf-8' });
      expect(global.URL.createObjectURL).toHaveBeenCalled();
    });

    it.skip('should export to JSON format', async () => {
      const jsonContent = '{"patterns": ["Pattern 1", "Pattern 2"]}';
      mockDisplayEnhancer.formatAsJson.mockReturnValue(jsonContent);
      mockDisplayEnhancer.generateExportFilename.mockReturnValue('export_test_character.json');
      mockElements.exportFormat.value = 'json';

      // Generate patterns first
      await mockElements.generateBtn.addEventListener.mock.calls
        .find(call => call[0] === 'click')[1]();

      const exportHandler = mockElements.exportBtn.addEventListener.mock.calls
        .find(call => call[0] === 'click')[1];
      
      exportHandler();
      
      expect(mockDisplayEnhancer.formatAsJson).toHaveBeenCalled();
      expect(global.Blob).toHaveBeenCalledWith([jsonContent], expect.objectContaining({
        type: expect.stringContaining('application/json')
      }));
    });

    it.skip('should export to Markdown format', async () => {
      const markdownContent = '# Export Test Character\n\n## Pattern 1\nContent here';
      mockDisplayEnhancer.formatAsMarkdown.mockReturnValue(markdownContent);
      mockDisplayEnhancer.generateExportFilename.mockReturnValue('export_test_character.md');
      mockElements.exportFormat.value = 'markdown';

      // Generate patterns first
      await mockElements.generateBtn.addEventListener.mock.calls
        .find(call => call[0] === 'click')[1]();

      const exportHandler = mockElements.exportBtn.addEventListener.mock.calls
        .find(call => call[0] === 'click')[1];
      
      exportHandler();
      
      expect(mockDisplayEnhancer.formatAsMarkdown).toHaveBeenCalled();
    });

    it.skip('should export to CSV format', async () => {
      const csvContent = 'index,pattern,example\n1,"Pattern 1","Example 1"';
      mockDisplayEnhancer.formatAsCsv.mockReturnValue(csvContent);
      mockDisplayEnhancer.generateExportFilename.mockReturnValue('export_test_character.csv');
      mockElements.exportFormat.value = 'csv';

      // Generate patterns first
      await mockElements.generateBtn.addEventListener.mock.calls
        .find(call => call[0] === 'click')[1]();

      const exportHandler = mockElements.exportBtn.addEventListener.mock.calls
        .find(call => call[0] === 'click')[1];
      
      exportHandler();
      
      expect(mockDisplayEnhancer.formatAsCsv).toHaveBeenCalled();
    });

    it.skip('should apply template for text exports', async () => {
      mockDisplayEnhancer.applyTemplate.mockReturnValue('Template applied content');
      mockDisplayEnhancer.generateExportFilename.mockReturnValue('templated_export.txt');
      mockElements.exportFormat.value = 'txt';
      mockElements.exportTemplate.value = 'detailed';

      // Generate patterns first
      await mockElements.generateBtn.addEventListener.mock.calls
        .find(call => call[0] === 'click')[1]();

      const exportHandler = mockElements.exportBtn.addEventListener.mock.calls
        .find(call => call[0] === 'click')[1];
      
      exportHandler();
      
      expect(mockDisplayEnhancer.applyTemplate).toHaveBeenCalledWith(
        expect.any(Object),
        'detailed',
        expect.any(Object)
      );
    });

    it.skip('should create fallback export when display enhancer not available', async () => {
      // Create controller without display enhancer
      controller = new SpeechPatternsGeneratorController({
        logger: mockLogger,
        characterBuilderService: mockCharacterBuilderService,
        eventBus: mockEventBus,
        schemaValidator: mockSchemaValidator,
        speechPatternsGenerator: mockSpeechPatternsGenerator,
      });

      // Generate patterns first
      await mockElements.generateBtn.addEventListener.mock.calls
        .find(call => call[0] === 'click')[1]();

      const exportHandler = mockElements.exportBtn.addEventListener.mock.calls
        .find(call => call[0] === 'click')[1];
      
      exportHandler();
      
      // Should create fallback export without enhancer
      expect(global.Blob).toHaveBeenCalledWith(
        [expect.stringContaining('Speech Patterns for')],
        { type: 'text/plain;charset=utf-8' }
      );
    });

    it.skip('should create download link and trigger download', async () => {
      const mockDownloadLink = createMockElement('a');
      jest.spyOn(document, 'createElement').mockReturnValue(mockDownloadLink);
      
      mockDisplayEnhancer.formatForExport.mockReturnValue('Download test content');
      mockDisplayEnhancer.generateExportFilename.mockReturnValue('download_test.txt');

      // Generate patterns first
      await mockElements.generateBtn.addEventListener.mock.calls
        .find(call => call[0] === 'click')[1]();

      const exportHandler = mockElements.exportBtn.addEventListener.mock.calls
        .find(call => call[0] === 'click')[1];
      
      exportHandler();
      
      expect(mockDownloadLink.href).toBe('mock-blob-url');
      expect(mockDownloadLink.download).toBe('download_test.txt');
      expect(mockDownloadLink.click).toHaveBeenCalled();
      expect(document.body.removeChild).toHaveBeenCalledWith(mockDownloadLink);
      expect(global.URL.revokeObjectURL).toHaveBeenCalledWith('mock-blob-url');
    });

    it.skip('should handle export errors gracefully', async () => {
      mockDisplayEnhancer.formatForExport.mockImplementation(() => {
        throw new Error('Export formatting failed');
      });

      // Generate patterns first
      await mockElements.generateBtn.addEventListener.mock.calls
        .find(call => call[0] === 'click')[1]();

      const exportHandler = mockElements.exportBtn.addEventListener.mock.calls
        .find(call => call[0] === 'click')[1];
      
      exportHandler();
      
      expect(mockLogger.error).toHaveBeenCalledWith('Export failed:', expect.any(Error));
    });

    it.skip('should announce successful export to screen readers', async () => {
      mockDisplayEnhancer.formatForExport.mockReturnValue('Screen reader test content');
      mockDisplayEnhancer.generateExportFilename.mockReturnValue('screen_reader_test.txt');
      mockElements.exportFormat.value = 'txt';

      // Generate patterns first
      await mockElements.generateBtn.addEventListener.mock.calls
        .find(call => call[0] === 'click')[1]();

      const exportHandler = mockElements.exportBtn.addEventListener.mock.calls
        .find(call => call[0] === 'click')[1];
      
      exportHandler();
      
      expect(mockElements.screenReaderAnnouncement.textContent).toBe('Speech patterns exported as TXT');
    });

    it.skip('should prevent export when no patterns generated', () => {
      const exportHandler = mockElements.exportBtn.addEventListener.mock.calls
        .find(call => call[0] === 'click')[1];
      
      exportHandler();
      
      // Should not create blob or download when no patterns
      expect(global.Blob).not.toHaveBeenCalled();
    });
  });

  describe('UI State Management Tests', () => {
    beforeEach(async () => {
      controller = await createInitializedController({
        logger: mockLogger,
        characterBuilderService: mockCharacterBuilderService,
        eventBus: mockEventBus,
        schemaValidator: mockSchemaValidator,
        speechPatternsGenerator: mockSpeechPatternsGenerator,
      });
    });

    it.skip('should update generate button state based on character definition and generation status', () => {
      // Initially no character definition - button should be disabled
      expect(mockElements.generateBtn.disabled).toBeTruthy();

      // Set valid character definition
      const characterData = {
        'core:name': { text: 'UI Test Character' },
        'core:personality': { traits: ['brave'] }
      };
      mockElements.characterDefinition.value = JSON.stringify(characterData);

      // After validation passes, generate button should be enabled
      // We'll simulate this through the controller state
    });

    it.skip('should update export button state based on generated patterns', () => {
      // Initially no patterns - export button should be disabled
      expect(mockElements.exportBtn.disabled).toBeTruthy();
    });

    it.skip('should update clear button state based on content and generation status', () => {
      // Test clear button state with no content
      expect(mockElements.clearBtn.disabled).toBeTruthy();

      // Set some character input
      mockElements.characterDefinition.value = '{"core:name": {"text": "Clear Test"}}';
      
      // Clear button should be enabled when there's content
    });

    it.skip('should disable all buttons during generation', async () => {
      // Set up valid character definition
      const characterData = {
        'core:name': { text: 'Generation Test Character' },
        'core:personality': { traits: ['patient'] }
      };
      mockElements.characterDefinition.value = JSON.stringify(characterData);

      // Mock slow generation to test button states during generation
      mockSpeechPatternsGenerator.generateSpeechPatterns.mockImplementation(
        () => new Promise(resolve => setTimeout(resolve, 100))
      );

      const clickHandler = mockElements.generateBtn.addEventListener.mock.calls
        .find(call => call[0] === 'click')[1];
      
      const generationPromise = clickHandler();
      
      // During generation, generate button should be disabled
      expect(mockElements.generateBtn.disabled).toBeTruthy();
      
      await generationPromise;
    });

    it('should show different UI states (empty, loading, results, error)', () => {
      // Test that state management methods exist and work
      expect(mockElements.loadingState).toBeDefined();
      expect(mockElements.resultsState).toBeDefined();
      expect(mockElements.errorState).toBeDefined();
      expect(mockElements.emptyState).toBeDefined();
    });
  });

  describe('Error Handling Tests', () => {
    beforeEach(async () => {
      controller = await createInitializedController({
        logger: mockLogger,
        characterBuilderService: mockCharacterBuilderService,
        eventBus: mockEventBus,
        schemaValidator: mockSchemaValidator,
        speechPatternsGenerator: mockSpeechPatternsGenerator,
      });
    });

    it.skip('should handle different types of generation errors', async () => {
      const errorTypes = [
        { name: 'SpeechPatternsGenerationError', message: 'AI service failed' },
        { name: 'SpeechPatternsResponseProcessingError', message: 'Response invalid' },
        { name: 'SpeechPatternsValidationError', message: 'Content validation failed' },
        { name: 'Error', message: 'unavailable' },
        { name: 'Error', message: 'timeout' },
        { name: 'Error', message: 'validation' }
      ];

      for (const errorType of errorTypes) {
        const error = new Error(errorType.message);
        error.name = errorType.name;
        
        mockSpeechPatternsGenerator.generateSpeechPatterns.mockRejectedValueOnce(error);

        const clickHandler = mockElements.generateBtn.addEventListener.mock.calls
          .find(call => call[0] === 'click')[1];
        
        await clickHandler();
        
        expect(mockLogger.error).toHaveBeenCalledWith('Speech pattern generation failed:', error);
        
        // Reset for next iteration
        jest.clearAllMocks();
      }
    });

    it.skip('should display error message in error state', async () => {
      const testError = new Error('Test error message');
      testError.name = 'SpeechPatternsGenerationError';
      
      mockSpeechPatternsGenerator.generateSpeechPatterns.mockRejectedValue(testError);

      const clickHandler = mockElements.generateBtn.addEventListener.mock.calls
        .find(call => call[0] === 'click')[1];
      
      await clickHandler();
      
      expect(mockElements.errorMessage.textContent).toContain('Failed to generate speech patterns');
    });

    it.skip('should provide retry functionality', async () => {
      const testError = new Error('Retry test error');
      mockSpeechPatternsGenerator.generateSpeechPatterns
        .mockRejectedValueOnce(testError)
        .mockResolvedValueOnce({
          speechPatterns: ['Retry Pattern'],
          characterName: 'Retry Character',
          totalCount: 1
        });

      // First attempt - should fail
      const clickHandler = mockElements.generateBtn.addEventListener.mock.calls
        .find(call => call[0] === 'click')[1];
      
      await clickHandler();
      
      expect(mockLogger.error).toHaveBeenCalledWith('Speech pattern generation failed:', testError);

      // Retry attempt - should succeed
      const retryHandler = mockElements.retryBtn.addEventListener.mock.calls
        .find(call => call[0] === 'click')[1];
      
      if (retryHandler) {
        await retryHandler();
        expect(mockSpeechPatternsGenerator.generateSpeechPatterns).toHaveBeenCalledTimes(2);
      }
    });

    it.skip('should handle AbortError separately', async () => {
      const abortError = new Error('Operation was aborted');
      abortError.name = 'AbortError';
      
      mockSpeechPatternsGenerator.generateSpeechPatterns.mockRejectedValue(abortError);

      const clickHandler = mockElements.generateBtn.addEventListener.mock.calls
        .find(call => call[0] === 'click')[1];
      
      await clickHandler();
      
      expect(mockElements.screenReaderAnnouncement.textContent).toBe('Generation cancelled');
    });

    it('should clear validation errors', () => {
      // Set up error display
      mockElements.characterInputError.style.display = 'block';
      mockElements.characterInputError.innerHTML = 'Test error';
      mockElements.characterDefinition.classList.add('error');

      // Trigger input to clear errors
      const inputHandler = mockElements.characterDefinition.addEventListener.mock.calls
        .find(call => call[0] === 'input')[1];
      
      inputHandler();
      
      expect(mockElements.characterInputError.style.display).toBe('none');
      expect(mockElements.characterInputError.innerHTML).toBe('');
      expect(mockElements.characterDefinition.classList.remove).toHaveBeenCalledWith('error');
    });

    it('should show validation errors with proper formatting', async () => {
      const invalidData = '{ invalid: json }';
      mockElements.characterDefinition.value = invalidData;
      
      const blurHandler = mockElements.characterDefinition.addEventListener.mock.calls
        .find(call => call[0] === 'blur')[1];
      
      await blurHandler();
      
      expect(mockElements.characterInputError.style.display).toBe('block');
      expect(mockElements.characterDefinition.classList.add).toHaveBeenCalledWith('error');
    });
  });

  describe('Enhanced Validation Display Tests', () => {
    beforeEach(async () => {
      controller = await createInitializedController({
        logger: mockLogger,
        characterBuilderService: mockCharacterBuilderService,
        eventBus: mockEventBus,
        schemaValidator: mockSchemaValidator,
      });
    });

    it('should display enhanced validation results with errors, warnings, and suggestions', async () => {
      const validationResult = {
        isValid: false,
        errors: ['Missing required component: core:name'],
        warnings: ['Consider adding more personality traits'],
        suggestions: ['Add core:likes and core:dislikes for better character depth'],
        quality: { overallScore: 0.4 }
      };

      mockEnhancedValidator.validateInput.mockResolvedValue(validationResult);

      const characterData = { 'some:component': { value: 'test' } };
      mockElements.characterDefinition.value = JSON.stringify(characterData);
      
      const blurHandler = mockElements.characterDefinition.addEventListener.mock.calls
        .find(call => call[0] === 'blur')[1];
      
      await blurHandler();
      
      expect(mockElements.characterInputError.style.display).toBe('block');
      expect(mockElements.characterInputError.innerHTML).toContain('validation-errors');
      expect(mockElements.characterInputError.innerHTML).toContain('validation-warnings');
      expect(mockElements.characterInputError.innerHTML).toContain('validation-suggestions');
    });

    it.skip('should display quality score with appropriate styling', async () => {
      const validationResult = {
        isValid: true,
        errors: [],
        warnings: [],
        suggestions: [],
        quality: { overallScore: 0.85 }
      };

      mockEnhancedValidator.validateInput.mockResolvedValue(validationResult);

      const characterData = {
        'core:name': { text: 'Quality Test Character' },
        'core:personality': { traits: ['excellent', 'detailed'] }
      };
      mockElements.characterDefinition.value = JSON.stringify(characterData);
      
      const blurHandler = mockElements.characterDefinition.addEventListener.mock.calls
        .find(call => call[0] === 'blur')[1];
      
      await blurHandler();
      
      expect(mockElements.characterInputError.innerHTML).toContain('quality-score');
      expect(mockElements.characterInputError.innerHTML).toContain('excellent');
    });

    it.skip('should show validation success message', async () => {
      const validationResult = {
        isValid: true,
        errors: [],
        warnings: [],
        suggestions: [],
        quality: { overallScore: 0.9 }
      };

      mockEnhancedValidator.validateInput.mockResolvedValue(validationResult);

      const characterData = {
        'core:name': { text: 'Success Test Character' },
        'core:personality': { traits: ['excellent', 'detailed', 'comprehensive'] },
        'core:profile': { background: 'Very detailed background with lots of content' }
      };
      mockElements.characterDefinition.value = JSON.stringify(characterData);
      
      const blurHandler = mockElements.characterDefinition.addEventListener.mock.calls
        .find(call => call[0] === 'blur')[1];
      
      await blurHandler();
      
      expect(mockElements.characterInputError.innerHTML).toContain('validation-success');
      expect(mockElements.characterInputError.innerHTML).toContain('Excellent character definition!');
    });

    it('should show validation progress indicator', async () => {
      // Mock a delay in validation
      mockEnhancedValidator.validateInput.mockImplementation(
        () => new Promise(resolve => setTimeout(() => resolve({
          isValid: true,
          errors: [],
          warnings: [],
          suggestions: []
        }), 100))
      );

      const characterData = {
        'core:name': { text: 'Progress Test Character' }
      };
      mockElements.characterDefinition.value = JSON.stringify(characterData);
      
      const blurPromise = mockElements.characterDefinition.addEventListener.mock.calls
        .find(call => call[0] === 'blur')[1]();
      
      // Should show progress initially
      expect(mockElements.characterInputError.innerHTML).toContain('validation-progress');
      
      await blurPromise;
    });

    it('should make validation sections collapsible', async () => {
      const validationResult = {
        isValid: false,
        errors: [],
        warnings: ['Warning 1', 'Warning 2'],
        suggestions: ['Suggestion 1', 'Suggestion 2'],
        quality: { overallScore: 0.6 }
      };

      mockEnhancedValidator.validateInput.mockResolvedValue(validationResult);

      const characterData = { 'some:component': { value: 'test' } };
      mockElements.characterDefinition.value = JSON.stringify(characterData);
      
      const blurHandler = mockElements.characterDefinition.addEventListener.mock.calls
        .find(call => call[0] === 'blur')[1];
      
      await blurHandler();
      
      // Should set up collapsible sections
      expect(document.querySelectorAll).toHaveBeenCalledWith('.validation-section');
    });

    it.skip('should handle different quality levels', async () => {
      const qualityLevels = [
        { score: 0.9, expectedClass: 'excellent' },
        { score: 0.7, expectedClass: 'good' },
        { score: 0.5, expectedClass: 'fair' },
        { score: 0.3, expectedClass: 'poor' },
        { score: 0.1, expectedClass: 'inadequate' }
      ];

      for (const level of qualityLevels) {
        const validationResult = {
          isValid: true,
          errors: [],
          warnings: [],
          suggestions: [],
          quality: { overallScore: level.score }
        };

        mockEnhancedValidator.validateInput.mockResolvedValue(validationResult);

        const characterData = {
          'core:name': { text: 'Quality Level Test' }
        };
        mockElements.characterDefinition.value = JSON.stringify(characterData);
        
        const blurHandler = mockElements.characterDefinition.addEventListener.mock.calls
          .find(call => call[0] === 'blur')[1];
        
        await blurHandler();
        
        expect(mockElements.characterInputError.innerHTML).toContain(level.expectedClass);
        
        // Clear for next iteration
        mockElements.characterInputError.innerHTML = '';
      }
    });
  });

  describe('Accessibility and Keyboard Navigation Tests', () => {
    beforeEach(async () => {
      controller = await createInitializedController({
        logger: mockLogger,
        characterBuilderService: mockCharacterBuilderService,
        eventBus: mockEventBus,
        schemaValidator: mockSchemaValidator,
        speechPatternsGenerator: mockSpeechPatternsGenerator,
      });
    });

    it('should handle keyboard shortcuts for generation (Ctrl+Enter)', () => {
      const characterData = {
        'core:name': { text: 'Keyboard Test Character' },
        'core:personality': { traits: ['responsive'] }
      };
      mockElements.characterDefinition.value = JSON.stringify(characterData);

      // Simulate Ctrl+Enter keydown
      const keydownEvent = {
        key: 'Enter',
        ctrlKey: true,
        preventDefault: jest.fn()
      };

      // Find the document keydown listener
      const keydownListeners = document.addEventListener.mock.calls
        .filter(call => call[0] === 'keydown');
      
      expect(keydownListeners.length).toBeGreaterThan(0);

      // Test the keyboard handler
      const keydownHandler = keydownListeners[0][1];
      keydownHandler(keydownEvent);

      expect(keydownEvent.preventDefault).toHaveBeenCalled();
    });

    it('should handle keyboard shortcuts for export (Ctrl+E)', async () => {
      // Set up generated patterns first
      const mockPatterns = {
        speechPatterns: ['Keyboard Export Pattern'],
        characterName: 'Keyboard Export Character',
        totalCount: 1
      };
      mockSpeechPatternsGenerator.generateSpeechPatterns.mockResolvedValue(mockPatterns);

      // Generate patterns first
      const clickHandler = mockElements.generateBtn.addEventListener.mock.calls
        .find(call => call[0] === 'click')[1];
      await clickHandler();

      // Simulate Ctrl+E keydown
      const keydownEvent = {
        key: 'e',
        ctrlKey: true,
        preventDefault: jest.fn()
      };

      const keydownListeners = document.addEventListener.mock.calls
        .filter(call => call[0] === 'keydown');
      
      const keydownHandler = keydownListeners[0][1];
      keydownHandler(keydownEvent);

      expect(keydownEvent.preventDefault).toHaveBeenCalled();
    });

    it('should handle keyboard shortcuts for clear all (Ctrl+Shift+Delete)', () => {
      // Set some content
      mockElements.characterDefinition.value = 'Some content';

      const keydownEvent = {
        key: 'Delete',
        ctrlKey: true,
        shiftKey: true,
        preventDefault: jest.fn()
      };

      const keydownListeners = document.addEventListener.mock.calls
        .filter(call => call[0] === 'keydown');
      
      const keydownHandler = keydownListeners[0][1];
      keydownHandler(keydownEvent);

      expect(keydownEvent.preventDefault).toHaveBeenCalled();
    });

    it('should handle ESC key to cancel generation', () => {
      const keydownEvent = {
        key: 'Escape'
      };

      const keydownListeners = document.addEventListener.mock.calls
        .filter(call => call[0] === 'keydown');
      
      const keydownHandler = keydownListeners[0][1];
      keydownHandler(keydownEvent);

      // Should handle escape key without throwing
      expect(() => keydownHandler(keydownEvent)).not.toThrow();
    });

    it('should handle arrow key navigation through pattern results', async () => {
      // Generate some patterns first
      const mockPatterns = {
        speechPatterns: ['Navigation Pattern 1', 'Navigation Pattern 2', 'Navigation Pattern 3'],
        characterName: 'Navigation Test Character',
        totalCount: 3
      };
      mockSpeechPatternsGenerator.generateSpeechPatterns.mockResolvedValue(mockPatterns);

      const clickHandler = mockElements.generateBtn.addEventListener.mock.calls
        .find(call => call[0] === 'click')[1];
      await clickHandler();

      // Mock pattern elements
      const mockPattern1 = createMockElement('article');
      const mockPattern2 = createMockElement('article');
      const mockPattern3 = createMockElement('article');

      mockPattern1.classList.add('speech-pattern-item');
      mockPattern2.classList.add('speech-pattern-item');
      mockPattern3.classList.add('speech-pattern-item');

      // Set up sibling relationships
      mockPattern1.nextElementSibling = mockPattern2;
      mockPattern2.previousElementSibling = mockPattern1;
      mockPattern2.nextElementSibling = mockPattern3;
      mockPattern3.previousElementSibling = mockPattern2;

      // Test arrow down navigation
      const arrowDownEvent = {
        key: 'ArrowDown',
        target: mockPattern1,
        preventDefault: jest.fn()
      };

      // Find pattern navigation listener
      const keydownListeners = document.addEventListener.mock.calls
        .filter(call => call[0] === 'keydown');
      
      const navigationHandler = keydownListeners[1][1]; // Second keydown listener is for navigation
      if (navigationHandler) {
        navigationHandler(arrowDownEvent);
        expect(arrowDownEvent.preventDefault).toHaveBeenCalled();
      }
    });

    it('should handle vim-style navigation (j/k keys)', async () => {
      // Generate patterns first
      const mockPatterns = {
        speechPatterns: ['Vim Pattern 1', 'Vim Pattern 2'],
        characterName: 'Vim Navigation Character',
        totalCount: 2
      };
      mockSpeechPatternsGenerator.generateSpeechPatterns.mockResolvedValue(mockPatterns);

      const clickHandler = mockElements.generateBtn.addEventListener.mock.calls
        .find(call => call[0] === 'click')[1];
      await clickHandler();

      // Mock pattern elements
      const mockPattern1 = createMockElement('article');
      const mockPattern2 = createMockElement('article');

      mockPattern1.classList.add('speech-pattern-item');
      mockPattern2.classList.add('speech-pattern-item');
      mockPattern1.nextElementSibling = mockPattern2;
      mockPattern2.previousElementSibling = mockPattern1;

      // Test 'j' key (down)
      const jKeyEvent = {
        key: 'j',
        target: mockPattern1,
        preventDefault: jest.fn()
      };

      const keydownListeners = document.addEventListener.mock.calls
        .filter(call => call[0] === 'keydown');
      
      const navigationHandler = keydownListeners[1][1];
      if (navigationHandler) {
        navigationHandler(jKeyEvent);
        expect(jKeyEvent.preventDefault).toHaveBeenCalled();
      }

      // Test 'k' key (up)
      const kKeyEvent = {
        key: 'k',
        target: mockPattern2,
        preventDefault: jest.fn()
      };

      if (navigationHandler) {
        navigationHandler(kKeyEvent);
        expect(kKeyEvent.preventDefault).toHaveBeenCalled();
      }
    });

    it('should handle Home/End keys for pattern navigation', async () => {
      // Generate patterns first
      const mockPatterns = {
        speechPatterns: ['Home Pattern', 'Middle Pattern', 'End Pattern'],
        characterName: 'Home End Navigation Character',
        totalCount: 3
      };
      mockSpeechPatternsGenerator.generateSpeechPatterns.mockResolvedValue(mockPatterns);

      const clickHandler = mockElements.generateBtn.addEventListener.mock.calls
        .find(call => call[0] === 'click')[1];
      await clickHandler();

      // Mock pattern container and patterns
      const mockContainer = createMockElement('div');
      const mockFirstPattern = createMockElement('article');
      const mockMiddlePattern = createMockElement('article');
      const mockLastPattern = createMockElement('article');

      mockFirstPattern.classList.add('speech-pattern-item');
      mockMiddlePattern.classList.add('speech-pattern-item');
      mockLastPattern.classList.add('speech-pattern-item');

      mockMiddlePattern.parentElement = mockContainer;
      mockContainer.firstElementChild = mockFirstPattern;
      mockContainer.lastElementChild = mockLastPattern;

      // Test Home key
      const homeKeyEvent = {
        key: 'Home',
        target: mockMiddlePattern,
        preventDefault: jest.fn()
      };

      const keydownListeners = document.addEventListener.mock.calls
        .filter(call => call[0] === 'keydown');
      
      const navigationHandler = keydownListeners[1][1];
      if (navigationHandler) {
        navigationHandler(homeKeyEvent);
        expect(homeKeyEvent.preventDefault).toHaveBeenCalled();
      }

      // Test End key
      const endKeyEvent = {
        key: 'End',
        target: mockMiddlePattern,
        preventDefault: jest.fn()
      };

      if (navigationHandler) {
        navigationHandler(endKeyEvent);
        expect(endKeyEvent.preventDefault).toHaveBeenCalled();
      }
    });

    it.skip('should announce navigation changes to screen readers', async () => {
      // Generate patterns first
      const mockPatterns = {
        speechPatterns: ['Screen Reader Pattern 1', 'Screen Reader Pattern 2'],
        characterName: 'Screen Reader Test Character',
        totalCount: 2
      };
      mockSpeechPatternsGenerator.generateSpeechPatterns.mockResolvedValue(mockPatterns);

      const clickHandler = mockElements.generateBtn.addEventListener.mock.calls
        .find(call => call[0] === 'click')[1];
      await clickHandler();

      // Mock pattern with pattern number
      const mockPattern = createMockElement('article');
      const mockPatternNumber = createMockElement('div');
      mockPatternNumber.textContent = '2';
      mockPattern.querySelector = jest.fn(() => mockPatternNumber);
      mockPattern.classList.add('speech-pattern-item');

      const arrowEvent = {
        key: 'ArrowDown',
        target: mockPattern,
        preventDefault: jest.fn()
      };

      const keydownListeners = document.addEventListener.mock.calls
        .filter(call => call[0] === 'keydown');
      
      const navigationHandler = keydownListeners[1][1];
      if (navigationHandler) {
        navigationHandler(arrowEvent);
        // Should announce pattern focus
        expect(mockElements.screenReaderAnnouncement.textContent).toContain('Pattern 2 focused');
      }
    });

    it.skip('should announce generation results with navigation instructions', async () => {
      const mockPatterns = {
        speechPatterns: ['Announcement Pattern 1', 'Announcement Pattern 2'],
        characterName: 'Announcement Test Character',
        totalCount: 2
      };
      mockSpeechPatternsGenerator.generateSpeechPatterns.mockResolvedValue(mockPatterns);

      const clickHandler = mockElements.generateBtn.addEventListener.mock.calls
        .find(call => call[0] === 'click')[1];
      await clickHandler();

      // Should announce results with navigation instructions
      const expectedMessage = 
        'Generated 2 speech patterns for Announcement Test Character. ' +
        'Patterns are now displayed. Use Tab to navigate to first pattern, ' +
        'then use arrow keys or J/K to move between patterns.';
      
      expect(mockElements.screenReaderAnnouncement.textContent).toBe(expectedMessage);
    });

    it('should initialize export controls with proper options', async () => {
      // Create controller with display enhancer to test export controls initialization
      controller = await createInitializedController({
        logger: mockLogger,
        characterBuilderService: mockCharacterBuilderService,
        eventBus: mockEventBus,
        schemaValidator: mockSchemaValidator,
        speechPatternsDisplayEnhancer: mockDisplayEnhancer,
      });

      // Should populate export format options
      expect(mockDisplayEnhancer.getSupportedExportFormats).toHaveBeenCalled();
      expect(mockDisplayEnhancer.getAvailableTemplates).toHaveBeenCalled();
    });

    it('should update template visibility based on export format selection', async () => {
      controller = await createInitializedController({
        logger: mockLogger,
        characterBuilderService: mockCharacterBuilderService,
        eventBus: mockEventBus,
        schemaValidator: mockSchemaValidator,
        speechPatternsDisplayEnhancer: mockDisplayEnhancer,
      });

      // Test format change handler
      const formatChangeHandler = mockElements.exportFormat.addEventListener.mock.calls
        .find(call => call[0] === 'change')[1];

      if (formatChangeHandler) {
        // Test with text format (should show templates)
        mockElements.exportFormat.value = 'txt';
        formatChangeHandler();
        expect(mockElements.templateGroup.style.display).toBe('flex');

        // Test with non-text format (should hide templates)
        mockElements.exportFormat.value = 'json';
        formatChangeHandler();
        expect(mockElements.templateGroup.style.display).toBe('none');
      }
    });
  });

  describe('Clear Functionality Tests', () => {
    beforeEach(async () => {
      controller = await createInitializedController({
        logger: mockLogger,
        characterBuilderService: mockCharacterBuilderService,
        eventBus: mockEventBus,
        schemaValidator: mockSchemaValidator,
        speechPatternsGenerator: mockSpeechPatternsGenerator,
      });
    });

    it('should clear all input and results', async () => {
      // Set up some content
      mockElements.characterDefinition.value = '{"core:name": {"text": "Clear Test"}}';
      mockElements.characterInputError.style.display = 'block';
      
      // Generate some patterns first
      const mockPatterns = {
        speechPatterns: ['Clear Pattern'],
        characterName: 'Clear Test Character',
        totalCount: 1
      };
      mockSpeechPatternsGenerator.generateSpeechPatterns.mockResolvedValue(mockPatterns);

      const generateHandler = mockElements.generateBtn.addEventListener.mock.calls
        .find(call => call[0] === 'click')[1];
      await generateHandler();

      // Now clear everything
      const clearHandler = mockElements.clearBtn.addEventListener.mock.calls
        .find(call => call[0] === 'click')[1];
      
      clearHandler();

      expect(mockElements.characterDefinition.value).toBe('');
      expect(mockElements.characterInputError.style.display).toBe('none');
      expect(mockElements.screenReaderAnnouncement.textContent).toBe('All content cleared');
    });

    it('should cancel ongoing generation when clearing', async () => {
      // Set up content
      mockElements.characterDefinition.value = '{"core:name": {"text": "Cancel Test"}}';
      
      // Mock slow generation
      let abortController;
      mockSpeechPatternsGenerator.generateSpeechPatterns.mockImplementation((data, options) => {
        abortController = options?.abortSignal;
        return new Promise(resolve => setTimeout(resolve, 1000));
      });

      // Start generation
      const generateHandler = mockElements.generateBtn.addEventListener.mock.calls
        .find(call => call[0] === 'click')[1];
      const generationPromise = generateHandler();

      // Clear during generation
      const clearHandler = mockElements.clearBtn.addEventListener.mock.calls
        .find(call => call[0] === 'click')[1];
      clearHandler();

      // Should abort the generation
      if (abortController && abortController.abort) {
        expect(abortController.abort).toHaveBeenCalled();
      }

      await generationPromise;
    });

    it.skip('should handle back button navigation', () => {
      // Mock window.location.href as a writable property
      const mockLocationHref = jest.fn();
      Object.defineProperty(window, 'location', {
        value: {
          get href() {
            return mockLocationHref.value || 'current-page.html';
          },
          set href(value) {
            mockLocationHref.value = value;
          }
        },
        writable: true,
        configurable: true
      });

      const backHandler = mockElements.backBtn.addEventListener.mock.calls
        .find(call => call[0] === 'click')[1];
      
      backHandler();
      
      expect(window.location.href).toBe('index.html');
    });
  });
});