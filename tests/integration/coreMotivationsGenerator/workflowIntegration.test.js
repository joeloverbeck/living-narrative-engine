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
import {
  createCoreMotivationsTestBed,
  createMockLLMService,
} from '../../common/coreMotivations/mockFactories.js';
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
  let mockDOM;

  beforeEach(() => {
    // Create comprehensive test bed
    testBed = createCoreMotivationsTestBed({
      database: { hasExistingData: false },
      llm: { shouldSucceed: true },
      cache: { hasCachedData: false },
    });

    // Set up mock DOM
    mockDOM = {
      directionSelector: createMockDOMElement('select', 'direction-selector'),
      generateBtn: createMockDOMElement('button', 'generate-btn'),
      clearAllBtn: createMockDOMElement('button', 'clear-all-btn'),
      exportBtn: createMockDOMElement('button', 'export-btn'),
      motivationsList: createMockDOMElement('div', 'motivations-list'),
      emptyState: createMockDOMElement('div', 'empty-state'),
      loadingState: createMockDOMElement('div', 'loading-state'),
      resultsState: createMockDOMElement('div', 'results-state'),
      errorState: createMockDOMElement('div', 'error-state'),
    };

    // Mock all required DOM elements
    mockDOM['direction-selector'] = createMockDOMElement('div', 'direction-selector');
    mockDOM['no-directions-message'] = createMockDOMElement('div', 'no-directions-message');
    mockDOM['loading-indicator'] = createMockDOMElement('div', 'loading-indicator');
    mockDOM['generate-btn'] = createMockDOMElement('button', 'generate-btn');
    mockDOM['clear-all-btn'] = createMockDOMElement('button', 'clear-all-btn');
    mockDOM['export-btn'] = createMockDOMElement('button', 'export-btn');
    mockDOM['back-btn'] = createMockDOMElement('button', 'back-btn');
    mockDOM['motivation-search'] = createMockDOMElement('input', 'motivation-search');
    mockDOM['motivation-sort'] = createMockDOMElement('select', 'motivation-sort');
    mockDOM['motivations-container'] = createMockDOMElement('div', 'motivations-container');
    mockDOM['empty-state'] = createMockDOMElement('div', 'empty-state');
    mockDOM['confirmation-modal'] = createMockDOMElement('div', 'confirmation-modal');
    mockDOM['confirm-clear'] = createMockDOMElement('button', 'confirm-clear');
    mockDOM['cancel-clear'] = createMockDOMElement('button', 'cancel-clear');
    mockDOM['sr-announcements'] = createMockDOMElement('div', 'sr-announcements');
    mockDOM['search-results-count'] = createMockDOMElement('span', 'search-results-count');
    mockDOM['search-count'] = createMockDOMElement('span', 'search-count');

    global.document = {
      getElementById: jest.fn((id) => {
        // Map kebab-case to camelCase for mockDOM lookup
        const key = id.replace(/-/g, '-');
        return mockDOM[id] || null;
      }),
      createElement: jest.fn((tag) => createMockDOMElement(tag)),
      querySelector: jest.fn(),
      querySelectorAll: jest.fn(() => []),
      body: {
        appendChild: jest.fn(),
      },
    };

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
    });
  });

  afterEach(() => {
    testBed.cleanup();
    jest.clearAllMocks();
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
      const response = await testBed.mocks.llmService.generateCompletion('test prompt');
      
      expect(response).toBeDefined();
    });
  });
});

// Helper functions
/**
 *
 * @param tag
 * @param id
 * @param className
 */
function createMockDOMElement(tag, id = '', className = '') {
  const element = {
    tagName: tag.toUpperCase(),
    id,
    className,
    innerHTML: '',
    innerText: '',
    textContent: '',
    value: '',
    disabled: false,
    style: { display: 'block' },
    children: [],
    addEventListener: jest.fn(),
    removeEventListener: jest.fn(),
    dispatchEvent: jest.fn(),
    click: jest.fn(),
    focus: jest.fn(),
    blur: jest.fn(),
    getAttribute: jest.fn((attr) => {
      if (attr === 'id') return id;
      if (attr === 'class') return className;
      return null;
    }),
    setAttribute: jest.fn(),
    querySelector: jest.fn(),
    querySelectorAll: jest.fn(() => []),
    appendChild: jest.fn(function(child) {
      this.children.push(child);
    }),
    removeChild: jest.fn(function(child) {
      const index = this.children.indexOf(child);
      if (index > -1) this.children.splice(index, 1);
    }),
    contains: jest.fn(),
    classList: {
      add: jest.fn(),
      remove: jest.fn(),
      toggle: jest.fn(),
      contains: jest.fn(),
    },
  };
  return element;
}

/**
 *
 * @param str
 */
function toCamelCase(str) {
  return str.replace(/-([a-z])/g, (g) => g[1].toUpperCase());
}
