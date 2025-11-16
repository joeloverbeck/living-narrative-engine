/**
 * @file Test bed for traits rewriter integration testing
 * @see src/characterBuilder/services/TraitsRewriter.js
 * @see src/characterBuilder/controllers/TraitsRewriterController.js
 */

/* eslint-env jest */
/* global expect, global */

import { jest } from '@jest/globals';
import { BaseTestBed } from './baseTestBed.js';
import { v4 as uuidv4 } from 'uuid';
import {
  cleanupTestElements,
  createTestContainer,
} from './domTestUtils.js';

/**
 * Test bed for traits rewriter integration testing
 * Provides mocks, test data factories, and UI simulation methods
 */
export class TraitsRewriterTestBed extends BaseTestBed {
  constructor() {
    super();

    // Initialize mock services
    this.mockLLMService = jest.fn();
    this.mockEventBus = {
      dispatch: jest.fn(),
    };
    this.mockLogger = {
      debug: jest.fn(),
      info: jest.fn(),
      warn: jest.fn(),
      error: jest.fn(),
    };

    // Initialize test data containers
    this.testData = {};
    this.services = {};
    this.uiElements = {};
    this.createdElementIds = [];

    // Track UI state for testing
    this.uiState = {
      loadingState: false,
      resultsVisible: false,
      exportEnabled: false,
      errorVisible: false,
      errorMessage: '',
      validationErrors: {},
      rewrittenTraits: null,
    };

    // Track dispatched events for verification
    this.dispatchedEvents = [];

    // Track responses for test assertions
    this.lastResponse = null;
  }

  /**
   * Setup test bed (synchronous - no async needed)
   */
  setup() {
    this.setupMocks();
    this.setupTestData();
    this.setupServices();
    this.setupUIElements();
  }

  /**
   * Initialize test bed (compatibility method for older tests)
   *
   * @param {Window} window - Window object (unused but kept for compatibility)
   */
  initialize(window) {
    this.setup();
  }

  /**
   * Setup mock services
   */
  setupMocks() {
    // Reset mocks
    this.mockLLMService = jest.fn();
    this.mockEventBus = {
      dispatch: jest.fn((event) => {
        this.dispatchedEvents.push(event);
      }),
      subscribe: jest.fn(),
      unsubscribe: jest.fn(),
    };

    // Mock character builder service
    this.mockCharacterBuilderService = {
      // Required methods for BaseCharacterBuilderController
      initialize: jest.fn().mockResolvedValue(true),
      getAllCharacterConcepts: jest.fn().mockResolvedValue([]),
      createCharacterConcept: jest.fn().mockResolvedValue({}),
      updateCharacterConcept: jest.fn().mockResolvedValue({}),
      deleteCharacterConcept: jest.fn().mockResolvedValue(true),
      getCharacterConcept: jest.fn().mockResolvedValue({}),
      generateThematicDirections: jest.fn().mockResolvedValue([]),
      getThematicDirections: jest.fn().mockResolvedValue([]),
      // Methods for TraitsRewriterController
      rewriteTraits: jest.fn(),
      getAllThematicDirectionsWithConcepts: jest.fn().mockResolvedValue([]),
      getLastResponse: () => this.lastResponse,
    };

    // Mock traits rewriter service
    this.mockTraitsRewriterService = {
      rewrite: jest.fn(),
    };

    // Mock schema validator (required by BaseCharacterBuilderController)
    this.mockSchemaValidator = {
      validate: jest.fn(),
      validateAsync: jest.fn(),
      validateAgainstSchema: jest.fn(),
    };

    // Mock required services for BaseCharacterBuilderController refactoring
    this.mockControllerLifecycleOrchestrator = {
      setControllerName: jest.fn(),
      registerHook: jest.fn(),
      executeHook: jest.fn().mockResolvedValue(undefined),
      hasHook: jest.fn().mockReturnValue(false),
      getHooks: jest.fn().mockReturnValue([]),
      clearHooks: jest.fn(),
      getControllerName: jest.fn().mockReturnValue('TraitsRewriterController'),
      createControllerMethodHook: jest.fn((controller, methodName) => {
        return async (...args) => {
          if (typeof controller[methodName] === 'function') {
            return await controller[methodName].call(controller, ...args);
          }
          return undefined;
        };
      }),
      isInitialized: false,
      isInitializing: false,
      isDestroyed: false,
      isDestroying: false,
      initialize: jest.fn().mockImplementation(async function () {
        // Prevent duplicate initialization
        if (this.isInitialized) {
          return;
        }
        // Prevent concurrent initialization
        if (this.isInitializing) {
          return;
        }

        this.isInitializing = true;
        this.isInitialized = false;
        // Simulate initialization
        await Promise.resolve();
        this.isInitializing = false;
        this.isInitialized = true;
      }),
      destroy: jest.fn().mockImplementation(function () {
        this.isDestroying = true;
        this.isInitialized = false;
        this.isInitializing = false;
        this.isDestroying = false;
        this.isDestroyed = true;
      }),
      makeDestructionSafe: jest.fn((fn, name) => fn),
      reinitialize: jest.fn().mockImplementation(async function ({ onReset }) {
        this.isInitialized = false;
        if (typeof onReset === 'function') {
          onReset();
        }
        await this.initialize();
      }),
      resetInitializationState: jest.fn().mockImplementation(function (callback) {
        this.isInitialized = false;
        this.isInitializing = false;
        if (typeof callback === 'function') {
          callback();
        }
      }),
    };

    // Create element cache for mockDOMElementManager
    const elementCache = {};

    this.mockDOMElementManager = {
      getElement: jest.fn((id) => elementCache[id] || null),
      setElement: jest.fn((id, element) => {
        elementCache[id] = element;
      }),
      hideElement: jest.fn(),
      showElement: jest.fn(),
      enableElement: jest.fn(),
      disableElement: jest.fn(),
      cacheElement: jest.fn((id, selector) => {
        const element = document.querySelector(selector);
        if (element) {
          elementCache[id] = element;
        }
      }),
      clearCache: jest.fn(() => {
        Object.keys(elementCache).forEach((key) => delete elementCache[key]);
      }),
      getElementsSnapshot: jest.fn(() => elementCache),
      validateElementCache: jest.fn(() => ({ valid: true, missing: [] })),
      cacheElementsFromMap: jest.fn((map) => {
        Object.entries(map).forEach(([id, selectorConfig]) => {
          // Handle both string selectors and config objects
          const selector =
            typeof selectorConfig === 'string'
              ? selectorConfig
              : selectorConfig?.selector;
          if (typeof selector === 'string') {
            const element = document.querySelector(selector);
            if (element) {
              elementCache[id] = element;
            }
          }
        });
        return elementCache;
      }),
      normalizeElementConfig: jest.fn((config) =>
        typeof config === 'string' ? { selector: config, required: true } : config
      ),
      validateElement: jest.fn(),
      setElementEnabled: jest.fn(),
      setElementText: jest.fn((id, text) => {
        const element = elementCache[id];
        if (element) {
          element.textContent = text;
        }
      }),
      configure: jest.fn(),
    };

    this.mockEventListenerRegistry = {
      addEventListener: jest.fn(),
      addDelegatedListener: jest.fn(),
      addDebouncedListener: jest.fn(),
      addThrottledListener: jest.fn(),
      addAsyncClickHandler: jest.fn(),
      subscribeToEvent: jest.fn(),
      removeListener: jest.fn(),
      removeAllListeners: jest.fn(),
      detachEventBusListeners: jest.fn(() => 0),
      setContextName: jest.fn(),
      destroy: jest.fn(),
      getListenerCount: jest.fn(() => 0),
      hasListener: jest.fn(() => false),
    };

    this.mockAsyncUtilitiesToolkit = {
      withTimeout: jest.fn((promise) => promise),
      retry: jest.fn((fn) => fn()),
      debounce: jest.fn((fn) => fn),
      throttle: jest.fn((fn) => fn),
      getTimerStats: jest.fn(() => ({
        timeouts: { count: 0, ids: [] },
        intervals: { count: 0, ids: [] },
        animationFrames: { count: 0, ids: [] },
      })),
      clearAllTimers: jest.fn(),
    };

    this.mockPerformanceMonitor = {
      startMeasurement: jest.fn(),
      endMeasurement: jest.fn(),
      recordMetric: jest.fn(),
      getMetrics: jest.fn().mockReturnValue({}),
      clearData: jest.fn(),
      configure: jest.fn(),
    };

    this.mockMemoryManager = {
      track: jest.fn(),
      release: jest.fn(),
      getMemoryUsage: jest.fn().mockReturnValue(0),
      setContextName: jest.fn(),
      clear: jest.fn(),
    };

    this.mockErrorHandlingStrategy = {
      handleError: jest.fn((error, context) => ({
        error: error instanceof Error ? error.message : String(error),
        category: context?.category || 'system',
        severity: context?.severity || 'error',
        timestamp: new Date().toISOString(),
      })),
      handleServiceError: jest.fn((error, operation, userMessage) => {
        // Rethrow the error with operation context for testing
        const contextualError = new Error(`${operation} failed: ${error.message}`);
        throw contextualError;
      }),
      logError: jest.fn(),
      shouldRetry: jest.fn().mockReturnValue(false),
      configureContext: jest.fn(),
      resetLastError: jest.fn(),
    };

    this.mockValidationService = {
      validateInput: jest.fn().mockReturnValue({ valid: true, errors: [] }),
      validateForm: jest.fn().mockReturnValue({ valid: true, errors: [] }),
      validateField: jest.fn().mockReturnValue({ valid: true, error: null }),
      validateData: jest.fn((data, schemaId) => ({
        isValid: true,
        errors: null,
        errorMessage: null,
      })),
      configure: jest.fn(),
    };
  }

  /**
   * Setup test data factories
   */
  setupTestData() {
    this.testData.validConcept = this.createValidConcept();
    this.testData.validDirection = this.createValidDirection();
    this.testData.validUserInputs = this.createValidUserInputs();
    this.testData.validTraits = this.createValidTraits();
    this.testData.validRewriteResponse = this.createValidRewriteResponse();
  }

  /**
   * Setup service instances with mocks
   */
  setupServices() {
    // Store service references for test access
    this.services.characterBuilderService = this.mockCharacterBuilderService;
    this.services.traitsRewriterService = this.mockTraitsRewriterService;
    this.services.eventBus = this.mockEventBus;
    this.services.logger = this.mockLogger;
    this.services.schemaValidator = this.mockSchemaValidator;
  }

  /**
   * Setup UI elements for interaction simulation
   */
  setupUIElements() {
    const { container, children } = createTestContainer({
      containerId: 'traits-rewriter-test-container',
      children: [
        { id: 'rewriteButton', tag: 'button' },
        { id: 'exportButton', tag: 'button' },
        { id: 'resultsContainer', tag: 'div' },
        { id: 'errorContainer', tag: 'div' },
        { id: 'loadingIndicator', tag: 'div' },
      ],
    });

    this.uiElements = { container, ...children };
    this.createdElementIds.push(container.id, ...Object.keys(children));

    this.uiElements.rewriteButton.disabled = false;
    this.uiElements.exportButton.disabled = false;
    this.uiElements.exportButton.hidden = true;
    this.uiElements.resultsContainer.hidden = true;
    this.uiElements.resultsContainer.innerHTML = '';
    this.uiElements.errorContainer.hidden = true;
    this.uiElements.errorContainer.textContent = '';
    this.uiElements.loadingIndicator.hidden = true;
  }

  // ============= Test Data Factories =============

  /**
   * Create valid concept
   *
   * @returns {object} Valid concept data
   */
  createValidConcept() {
    return {
      id: `concept-${uuidv4()}`,
      concept: 'A battle-scarred veteran seeking redemption',
      description: 'A complex character with a troubled past',
    };
  }

  /**
   * Create valid thematic direction
   *
   * @returns {object} Valid direction data
   */
  createValidDirection() {
    return {
      id: `direction-${uuidv4()}`,
      title: 'Path to Redemption',
      theme: 'Exploring themes of guilt and forgiveness',
      description: 'A journey from darkness to light',
      coreTension: 'The struggle between past and future',
      uniqueTwist: 'Redemption through helping others',
    };
  }

  /**
   * Create valid user inputs
   *
   * @returns {object} Valid user input data
   */
  createValidUserInputs() {
    return {
      originalTraits: 'Protective, introspective, determined',
      rewriteInstructions: 'Make the character more mysterious and enigmatic',
    };
  }

  /**
   * Create valid traits
   *
   * @returns {object} Valid traits data
   */
  createValidTraits() {
    return {
      names: ['Alaric Ironward', 'Marcus Thornfield'],
      physicalDescription: 'A weathered man in his early forties...',
      personality: ['Protective Instinct', 'Introspective'],
      strengths: ['Combat Experience'],
      weaknesses: ['Self-Punishment'],
      likes: ['Quiet moments'],
      dislikes: ['Unnecessary violence'],
      fears: ['Repeating past mistakes'],
      goals: ['Find redemption'],
      notes: 'Additional character notes',
      profile: 'Character profile summary',
      secrets: ['Hidden past identity'],
    };
  }

  /**
   * Create valid rewrite response
   *
   * @returns {object} Valid rewrite response
   */
  createValidRewriteResponse() {
    return {
      names: ['Alaric Shadowmere', 'Marcus Veilwalker'],
      physicalDescription: 'A mysterious figure shrouded in shadow...',
      personality: ['Enigmatic Presence', 'Secretive Nature'],
      strengths: ['Strategic Deception'],
      weaknesses: ['Trust Issues'],
      likes: ['Solitude'],
      dislikes: ['Direct confrontation'],
      fears: ['Being truly known'],
      goals: ['Maintain mystery'],
      notes: 'Enhanced enigmatic qualities',
      profile: 'A deeply mysterious character',
      secrets: ['Multiple hidden identities'],
    };
  }

  // ============= Mock Response Methods =============

  /**
   * Mock successful LLM response
   *
   * @param {object} response - Response data
   */
  mockLLMResponse(response) {
    this.mockLLMService.mockResolvedValue(response);
    this.mockTraitsRewriterService.rewrite.mockResolvedValue(response);
    this.mockCharacterBuilderService.rewriteTraits.mockResolvedValue(response);
    // Track the response
    this.lastResponse = response;
  }

  /**
   * Mock LLM service timeout
   */
  mockLLMTimeout() {
    const timeoutError = new Error('Request timeout');
    timeoutError.code = 'TIMEOUT';
    this.mockLLMService.mockRejectedValue(timeoutError);
    this.mockTraitsRewriterService.rewrite.mockRejectedValue(timeoutError);
    this.mockCharacterBuilderService.rewriteTraits.mockRejectedValue(timeoutError);
  }

  /**
   * Mock LLM service failure
   *
   * @param {Error} error - Error to throw
   */
  mockLLMServiceFailure(error) {
    this.mockLLMService.mockRejectedValue(error);
    this.mockTraitsRewriterService.rewrite.mockRejectedValue(error);
    this.mockCharacterBuilderService.rewriteTraits.mockRejectedValue(error);
  }

  // ============= Service Getter Methods =============

  /**
   * Get character builder service
   *
   * @returns {object} Character builder service mock
   */
  getCharacterBuilderService() {
    return this.services.characterBuilderService;
  }

  /**
   * Get traits rewriter service
   *
   * @returns {object} Traits rewriter service mock
   */
  getTraitsRewriterService() {
    return this.services.traitsRewriterService;
  }

  /**
   * Get event bus mock
   *
   * @returns {object} Event bus mock
   */
  getEventBusMock() {
    return this.mockEventBus;
  }

  /**
   * Get schema validator mock
   *
   * @returns {object} Schema validator mock
   */
  getSchemaValidator() {
    return this.services.schemaValidator;
  }

  /**
   * Cleanup test bed
   */
  cleanup() {
    jest.clearAllMocks();
    this.dispatchedEvents = [];
    this.uiState = {
      loadingState: false,
      resultsVisible: false,
      exportEnabled: false,
      errorVisible: false,
      errorMessage: '',
      validationErrors: {},
      rewrittenTraits: null,
    };

    cleanupTestElements(this.createdElementIds);
    this.createdElementIds = [];
  }
}
