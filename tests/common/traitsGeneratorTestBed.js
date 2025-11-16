/**
 * @file Test bed for traits generator integration testing
 * @see src/characterBuilder/services/TraitsGenerator.js
 * @see src/characterBuilder/controllers/TraitsGeneratorController.js
 */

/* eslint-env jest */
/* global expect, global */

import { jest } from '@jest/globals';
import { BaseTestBed } from './baseTestBed.js';
import { v4 as uuidv4 } from 'uuid';

/**
 * Test bed for traits generator integration testing
 * Provides mocks, test data factories, and UI simulation methods
 */
export class TraitsGeneratorTestBed extends BaseTestBed {
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

    // Track UI state for testing
    this.uiState = {
      loadingState: false,
      resultsVisible: false,
      exportEnabled: false,
      errorVisible: false,
      errorMessage: '',
      validationErrors: {},
      generatedTraits: null,
    };

    // Track dispatched events for verification
    this.dispatchedEvents = [];

    // Track responses for test assertions
    this.lastThematicDirectionsResponse = null;
    this.lastCoreMotivationsResponse = null;
    this.lastClichesResponse = null;
    this.lastTraitsResponse = null;
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

    // Mock storage service - No database mock needed per policy
    this.mockStorageService = {
      initialize: jest.fn().mockResolvedValue(true),
      getThematicDirections: jest.fn().mockResolvedValue([]),
      getAllThematicDirections: jest.fn().mockResolvedValue([]),
      getClichesByDirectionId: jest.fn().mockResolvedValue([]),
      getCoreMotivationsByDirectionId: jest.fn().mockResolvedValue([]),
      // Methods for tracking responses
      getLastThematicDirectionsResponse: () =>
        this.lastThematicDirectionsResponse,
      getLastCoreMotivationsResponse: () => this.lastCoreMotivationsResponse,
      getLastClichesResponse: () => this.lastClichesResponse,
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
      // Methods for TraitsGeneratorController
      generateTraits: jest.fn(),
      getDirectionsWithClichesAndMotivations: jest.fn().mockResolvedValue([]),
      getAllThematicDirectionsWithConcepts: jest.fn().mockResolvedValue([]),
      hasClichesForDirection: jest.fn().mockResolvedValue(true),
      hasCoreMotivationsForDirection: jest.fn().mockResolvedValue(true),
      getCoreMotivationsByDirectionId: jest.fn().mockResolvedValue([]),
      getClichesByDirectionId: jest.fn().mockResolvedValue([]),
      // Methods for tracking responses
      getLastThematicDirectionsResponse: () =>
        this.lastThematicDirectionsResponse,
      getLastCoreMotivationsResponse: () => this.lastCoreMotivationsResponse,
      getLastClichesResponse: () => this.lastClichesResponse,
      getLastTraitsResponse: () => this.lastTraitsResponse,
    };

    // Mock traits generator service
    this.mockTraitsGeneratorService = {
      generateTraits: jest.fn(),
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
      getControllerName: jest.fn().mockReturnValue('TraitsGeneratorController'),
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
      setElement: jest.fn((id, element) => { elementCache[id] = element; }),
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
        Object.keys(elementCache).forEach(key => delete elementCache[key]);
      }),
      getElementsSnapshot: jest.fn(() => elementCache),
      validateElementCache: jest.fn(() => ({ valid: true, missing: [] })),
      cacheElementsFromMap: jest.fn((map) => {
        Object.entries(map).forEach(([id, selectorConfig]) => {
          // Handle both string selectors and config objects
          const selector = typeof selectorConfig === 'string' ? selectorConfig : selectorConfig?.selector;
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
        errorMessage: null
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
    this.testData.validClichés = this.createValidCliches();
    this.testData.validTraitsResponse = this.createValidTraitsResponse();
  }

  /**
   * Setup service instances with mocks
   */
  setupServices() {
    // Store service references for test access
    this.services.characterBuilderService = this.mockCharacterBuilderService;
    this.services.traitsGeneratorService = this.mockTraitsGeneratorService;
    this.services.eventBus = this.mockEventBus;
    this.services.logger = this.mockLogger;
    this.services.schemaValidator = this.mockSchemaValidator;
  }

  /**
   * Setup UI elements for interaction simulation
   */
  setupUIElements() {
    // Create mock UI elements
    this.uiElements = {
      generateButton: {
        onclick: null,
        disabled: false,
        id: 'generateButton',
      },
      exportButton: {
        onclick: null,
        disabled: false,
        hidden: true,
        id: 'exportButton',
      },
      retryButton: {
        onclick: null,
        disabled: false,
        id: 'retryButton',
      },
      coreMotivation: {
        value: '',
        oninput: null,
        id: 'coreMotivation',
      },
      internalContradiction: {
        value: '',
        oninput: null,
        id: 'internalContradiction',
      },
      centralQuestion: {
        value: '',
        oninput: null,
        id: 'centralQuestion',
      },
      resultsContainer: {
        hidden: true,
        innerHTML: '',
      },
      errorContainer: {
        hidden: true,
        textContent: '',
      },
      loadingIndicator: {
        hidden: true,
      },
    };
  }

  // ============= UI Simulation Methods =============

  /**
   * Simulate button click
   *
   * @param {string} buttonId - Button element ID
   * @returns {Promise<any>} Result of button click handler
   */
  async simulateButtonClick(buttonId) {
    const button = this.uiElements[buttonId];
    if (button && button.onclick) {
      // Update UI state based on button
      if (buttonId === 'generateButton') {
        this.uiState.loadingState = true;
        this.uiState.errorVisible = false;
      }
      if (buttonId === 'retryButton') {
        this.uiState.loadingState = true;
        this.uiState.errorVisible = false;
      }
      return await button.onclick();
    }
    // If no onclick handler, still update state for generateButton
    if (buttonId === 'generateButton') {
      this.uiState.loadingState = true;
      this.uiState.errorVisible = false;
    }
    return null;
  }

  /**
   * Simulate input event
   *
   * @param {string} inputId - Input element ID
   */
  simulateInputEvent(inputId) {
    const input = this.uiElements[inputId];
    if (input && input.oninput) {
      input.oninput();
    }
  }

  /**
   * Simulate user input with validation trigger
   *
   * @param {string} fieldName - Field name
   * @param {string} value - Input value
   */
  simulateUserInput(fieldName, value) {
    if (this.uiElements[fieldName]) {
      this.uiElements[fieldName].value = value;
      this.simulateInputEvent(fieldName);
    }
  }

  /**
   * Set user input value
   *
   * @param {string} fieldName - Field name
   * @param {string} value - Input value
   */
  setUserInput(fieldName, value) {
    if (this.uiElements[fieldName]) {
      this.uiElements[fieldName].value = value;
    }
  }

  /**
   * Simulate page reload
   */
  simulatePageReload() {
    // Reset UI state
    this.uiState.loadingState = false;
    this.uiState.errorVisible = false;
    this.uiState.errorMessage = '';
    // Clear UI element values
    Object.keys(this.uiElements).forEach((key) => {
      if (this.uiElements[key].value !== undefined) {
        this.uiElements[key].value = '';
      }
    });
  }

  /**
   * Simulate generation in progress state
   */
  simulateGenerationInProgress() {
    this.uiState.loadingState = true;
    this.uiState.resultsVisible = false;
    this.uiElements.loadingIndicator.hidden = false;
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
      coreMotivation: 'To atone for past mistakes by protecting the innocent',
      internalContradiction:
        'Believes they deserve punishment yet knows others need protection',
      centralQuestion:
        'Can someone who has caused great harm ever truly be redeemed?',
    };
  }

  /**
   * Create valid clichés
   *
   * @returns {Array} Valid clichés array
   */
  createValidCliches() {
    return [
      { id: 'cliche-1', text: 'Brooding antihero with dark past' },
      { id: 'cliche-2', text: 'Reluctant mentor figure' },
      { id: 'cliche-3', text: 'Sacrificial hero complex' },
    ];
  }

  /**
   * Create valid traits response (all 12 categories)
   *
   * @returns {object} Valid traits response
   */
  createValidTraitsResponse() {
    return {
      names: [
        {
          name: 'Alaric Ironward',
          justification:
            'A strong name suggesting nobility and military prowess',
        },
        {
          name: 'Marcus Thornfield',
          justification: 'Classic warrior name with grounded surname',
        },
        {
          name: 'Gareth Soulstone',
          justification: 'Evokes strength and weight of past experiences',
        },
      ],
      physicalDescription:
        'A weathered man in his early forties with silver-streaked dark hair...',
      personality: [
        {
          trait: 'Protective Instinct',
          explanation: 'Driven to shield others from harm',
          behavioral_examples: [
            'Always positions himself between danger and innocents',
          ],
        },
      ],
      strengths: [
        {
          strength: 'Combat Experience',
          explanation: 'Years of battle have honed skills',
          application_examples: ['Can assess threats instantly'],
        },
      ],
      weaknesses: [
        {
          weakness: 'Self-Punishment',
          explanation: 'Believes deserves suffering',
          manifestation_examples: ['Refuses comfort'],
        },
      ],
      likes: ['Quiet moments', 'Helping others', 'Simple pleasures'],
      dislikes: ['Unnecessary violence', 'Arrogance', 'Waste'],
      fears: [
        {
          fear: 'Repeating past mistakes',
          root_cause: 'Traumatic event',
          behavioral_impact: 'Overly cautious',
        },
      ],
      goals: [
        {
          goal: 'Find redemption',
          motivation: 'Guilt over past',
          obstacles: ['Self-doubt', 'Past enemies'],
        },
      ],
      notes: 'Additional character notes and background details',
      profile: 'Character profile summary combining all traits',
      secrets: [
        {
          secret: 'Hidden past identity',
          reason_for_hiding: 'Protect loved ones',
          consequences_if_revealed: 'Endangers allies',
        },
      ],
    };
  }

  /**
   * Create complete traits data for export testing
   *
   * @returns {object} Complete traits data
   */
  createCompleteTraitsData() {
    return this.createValidTraitsResponse();
  }

  /**
   * Create valid traits data for schema validation (schema-compliant)
   *
   * @returns {object} Valid traits data
   */
  createValidTraitsData() {
    return {
      id: 'a1b2c3d4-e5f6-7890-abcd-ef1234567890',
      generatedAt: '2024-01-01T00:00:00.000Z',
      names: [
        {
          name: 'Alaric Ironward',
          justification:
            'A strong name suggesting nobility and military prowess that resonates with the character theme',
        },
        {
          name: 'Marcus Thornfield',
          justification:
            'Classic warrior name with grounded surname that implies connection to nature and growth',
        },
        {
          name: 'Gareth Soulstone',
          justification:
            'Evokes strength and weight of past experiences while suggesting inner fortitude and resilience',
        },
      ],
      physicalDescription:
        'A weathered man in his early forties with silver-streaked dark hair that speaks of countless battles and hard-won wisdom. His steel-gray eyes hold depths of experience, while callused hands tell stories of survival.',
      personality: [
        {
          trait: 'Protective Instinct',
          explanation:
            'Driven to shield others from harm at any cost to himself',
        },
        {
          trait: 'Introspective',
          explanation:
            'Spends considerable time examining his own motivations and decisions',
        },
        {
          trait: 'Determined',
          explanation:
            'Once committed to a course of action, sees it through regardless of obstacles',
        },
      ],
      strengths: ['Combat Experience', 'Strategic Thinking'],
      weaknesses: ['Self-Punishment', 'Overthinking'],
      likes: ['Quiet moments', 'Helping others', 'Simple pleasures'],
      dislikes: ['Unnecessary violence', 'Arrogance', 'Waste'],
      fears: ['Repeating past mistakes'],
      goals: {
        shortTerm: ['Find redemption'],
        longTerm:
          'Achieve lasting peace and purpose in life after years of conflict',
      },
      notes: [
        'Additional character notes and background details',
        'Complex motivations drive all actions',
      ],
      profile:
        'Character profile summary combining all traits into a cohesive narrative that explores themes of redemption, personal growth, and the struggle between past mistakes and future hope. This character represents the universal human desire for second chances.',
      secrets: ['Hidden past identity'],
    };
  }

  /**
   * Create valid direction with concept for controller testing
   *
   * @returns {object} Direction with concept data
   */
  createValidDirectionWithConcept() {
    return {
      direction: {
        id: 'test-direction-id',
        title: 'Test Thematic Direction',
        description: 'A test thematic direction for unit testing',
        conceptId: 'test-concept-id',
        coreTension: 'Test core tension',
        uniqueTwist: 'Test unique twist',
        narrativePotential: 'Test narrative potential',
      },
      concept: {
        id: 'test-concept-id',
        concept: 'A battle-scarred veteran seeking redemption',
        name: 'Redeemed Veteran',
      },
    };
  }

  /**
   * Create valid core motivation for controller testing
   *
   * @returns {object} Valid core motivation data
   */
  createValidCoreMotivation() {
    return {
      id: 'motivation-1',
      coreDesire: 'To find redemption for past mistakes',
      internalContradiction: 'Wants to help but fears discovery of dark past',
      centralQuestion:
        'Can someone who has done terrible things ever truly be redeemed?',
      directionId: 'test-direction-id',
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
    this.mockTraitsGeneratorService.generateTraits.mockResolvedValue(response);
    this.mockCharacterBuilderService.generateTraits.mockResolvedValue(response);
    // Track the response
    this.lastTraitsResponse = response;
  }

  /**
   * Mock LLM service timeout
   */
  mockLLMTimeout() {
    const timeoutError = new Error('Request timeout');
    timeoutError.code = 'TIMEOUT';
    this.mockLLMService.mockRejectedValue(timeoutError);
    this.mockTraitsGeneratorService.generateTraits.mockRejectedValue(
      timeoutError
    );
    this.mockCharacterBuilderService.generateTraits.mockRejectedValue(
      timeoutError
    );
  }

  /**
   * Mock LLM service failure
   *
   * @param {Error} error - Error to throw
   */
  mockLLMServiceFailure(error) {
    this.mockLLMService.mockRejectedValue(error);
    this.mockTraitsGeneratorService.generateTraits.mockRejectedValue(error);
    this.mockCharacterBuilderService.generateTraits.mockRejectedValue(error);
  }

  /**
   * Mock file download
   *
   * @returns {jest.Mock} Download spy
   */
  mockFileDownload() {
    const downloadSpy = jest.fn();
    global.document = {
      createElement: jest.fn(() => ({
        click: downloadSpy,
        href: '',
        download: '',
      })),
    };
    return downloadSpy;
  }

  // ============= State Getter Methods =============

  /**
   * Get loading state
   *
   * @returns {boolean} Loading state
   */
  getLoadingState() {
    return this.uiState.loadingState;
  }

  /**
   * Get results visibility
   *
   * @returns {boolean} Results visible
   */
  getResultsVisible() {
    return this.uiState.resultsVisible;
  }

  /**
   * Get export button enabled state
   *
   * @returns {boolean} Export enabled
   */
  getExportButtonEnabled() {
    return this.uiState.exportEnabled;
  }

  /**
   * Get error message
   *
   * @returns {string} Error message
   */
  getErrorMessage() {
    return this.uiState.errorMessage;
  }

  /**
   * Get validation error for field
   *
   * @param {string} fieldName - Field name
   * @returns {string|null} Validation error
   */
  getValidationError(fieldName) {
    return this.uiState.validationErrors[fieldName] || null;
  }

  /**
   * Get results container
   *
   * @returns {object} Results container element
   */
  getResultsContainer() {
    return this.uiElements.resultsContainer;
  }

  /**
   * Get export button
   *
   * @returns {object} Export button element
   */
  getExportButton() {
    return this.uiElements.exportButton;
  }

  /**
   * Get error container
   *
   * @returns {object} Error container element
   */
  getErrorContainer() {
    return this.uiElements.errorContainer;
  }

  /**
   * Get retry button
   *
   * @returns {object} Retry button element
   */
  getRetryButton() {
    return this.uiElements.retryButton;
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
   * Get traits generator service
   *
   * @returns {object} Traits generator service mock
   */
  getTraitsGeneratorService() {
    return this.services.traitsGeneratorService;
  }

  /**
   * Get controller
   *
   * @returns {object} Controller mock
   */
  getController() {
    // Return a mock controller with UI interaction methods
    return {
      initialize: jest.fn(),
      generateTraits: jest.fn(),
    };
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

  // ============= Test Setup Methods =============

  /**
   * Setup valid UI state
   */
  setupValidUIState() {
    this.simulateUserInput('coreMotivation', 'Test motivation');
    this.simulateUserInput('internalContradiction', 'Test contradiction');
    this.simulateUserInput('centralQuestion', 'Test question?');
    this.uiState.errorVisible = false;
    this.uiState.loadingState = false;
  }

  /**
   * Setup generated traits in UI
   */
  setupGeneratedTraitsInUI() {
    this.uiState.generatedTraits = this.createValidTraitsResponse();
    this.uiState.resultsVisible = true;
    this.uiState.exportEnabled = true;
    this.uiElements.resultsContainer.hidden = false;
    this.uiElements.exportButton.hidden = false;
  }

  /**
   * Set generated traits
   *
   * @param {object} traits - Traits data
   */
  setGeneratedTraits(traits) {
    this.uiState.generatedTraits = traits;
  }

  /**
   * Setup directions with mixed requirements
   */
  setupDirectionsWithMixedRequirements() {
    const directions = [
      {
        direction: { id: 'dir-1', title: 'Direction with both' },
        concept: {
          id: 'concept-1',
          concept: 'Test concept 1',
          directionId: 'dir-1',
        },
        hasClichés: true,
        hasMotivations: true,
      },
      {
        direction: { id: 'dir-2', title: 'Direction with clichés only' },
        concept: {
          id: 'concept-2',
          concept: 'Test concept 2',
          directionId: 'dir-2',
        },
        hasClichés: true,
        hasMotivations: false,
      },
      {
        direction: { id: 'dir-3', title: 'Direction with motivations only' },
        concept: {
          id: 'concept-3',
          concept: 'Test concept 3',
          directionId: 'dir-3',
        },
        hasClichés: false,
        hasMotivations: true,
      },
    ];

    // Setup getAllThematicDirectionsWithConcepts to return all directions with concepts
    const directionsWithConcepts = directions.map((d) => ({
      direction: d.direction,
      concept: d.concept,
    }));
    this.mockCharacterBuilderService.getAllThematicDirectionsWithConcepts.mockResolvedValue(
      directionsWithConcepts
    );
    // Track the response
    this.lastThematicDirectionsResponse = directionsWithConcepts;

    // Setup mock responses for filtering
    this.mockCharacterBuilderService.hasClichesForDirection.mockImplementation(
      (id) => Promise.resolve(id === 'dir-1' || id === 'dir-2')
    );
    this.mockCharacterBuilderService.getClichesByDirectionId.mockImplementation(
      (id) => {
        if (id === 'dir-1' || id === 'dir-2') {
          const cliches = [{ id: 'cliche-1', text: 'Test cliche' }];
          this.lastClichesResponse = cliches;
          return Promise.resolve(cliches);
        }
        return Promise.resolve([]);
      }
    );
    this.mockCharacterBuilderService.getCoreMotivationsByDirectionId.mockImplementation(
      (id) => {
        if (id === 'dir-1' || id === 'dir-3') {
          const motivations = [{ id: 'motivation-1', text: 'Test motivation' }];
          this.lastCoreMotivationsResponse = motivations;
          return Promise.resolve(motivations);
        }
        return Promise.resolve([]);
      }
    );

    // Also mock the deprecated method to avoid errors if still called anywhere
    if (
      this.mockCharacterBuilderService.getDirectionsWithClichesAndMotivations
    ) {
      this.mockCharacterBuilderService.getDirectionsWithClichesAndMotivations.mockResolvedValue(
        [directions[0]]
      );
    }
  }

  // ============= Verification Methods =============

  /**
   * Verify traits structure
   *
   * @param {object} traits - Traits to verify
   */
  verifyTraitsStructure(traits) {
    expect(traits).toHaveProperty('names');
    expect(traits).toHaveProperty('physicalDescription');
    expect(traits).toHaveProperty('personality');
    expect(traits).toHaveProperty('strengths');
    expect(traits).toHaveProperty('weaknesses');
    expect(traits).toHaveProperty('likes');
    expect(traits).toHaveProperty('dislikes');
    expect(traits).toHaveProperty('fears');
    expect(traits).toHaveProperty('goals');
    expect(traits).toHaveProperty('notes');
    expect(traits).toHaveProperty('profile');
    expect(traits).toHaveProperty('secrets');
  }

  /**
   * Verify all trait categories present
   *
   * @param {object} result - Result to verify
   */
  verifyAllTraitCategoriesPresent(result) {
    this.verifyTraitsStructure(result);
  }

  /**
   * Verify LLM called with correct prompt
   */
  verifyLLMCalledWithCorrectPrompt() {
    expect(this.mockLLMService).toHaveBeenCalled();
    const calls = this.mockLLMService.mock.calls;
    expect(calls.length).toBeGreaterThan(0);
    // Verify prompt contains expected elements
    const lastCall = calls[calls.length - 1];
    if (lastCall && lastCall[0]) {
      expect(lastCall[0]).toContain('traits');
    }
  }

  /**
   * Verify results display
   */
  verifyResultsDisplay() {
    expect(this.uiElements.resultsContainer.hidden).toBe(false);
    expect(this.uiState.resultsVisible).toBe(true);
  }

  /**
   * Verify enhanced results displayed
   */
  verifyEnhancedResultsDisplayed() {
    this.verifyResultsDisplay();
    expect(this.uiElements.resultsContainer.innerHTML).toBeTruthy();
  }

  /**
   * Get exported text
   *
   * @returns {string} Exported text
   */
  getExportedText() {
    if (!this.uiState.generatedTraits) return '';

    // Simulate export formatting
    let text = '=== CHARACTER TRAITS ===\n\n';

    text += 'NAMES:\n';
    this.uiState.generatedTraits.names?.forEach((n) => {
      text += `- ${n.name}\n`;
    });

    text += '\nPHYSICAL DESCRIPTION:\n';
    text += this.uiState.generatedTraits.physicalDescription + '\n';

    text += '\nPERSONALITY:\n';
    text += '\nSTRENGTHS:\n';
    text += '\nWEAKNESSES:\n';
    text += '\nLIKES:\n';
    text += '\nDISLIKES:\n';
    text += '\nFEARS:\n';
    text += '\nGOALS:\n';
    text += '\nNOTES:\n';
    text += '\nPROFILE:\n';
    text += '\nSECRETS:\n';
    text += '\nUSER INPUTS:\n';

    return text;
  }

  /**
   * Execute traits generation
   *
   * @param {object} concept - Concept data
   * @param {object} direction - Direction data
   * @param {object} userInputs - User inputs
   * @param {Array} clichés - Clichés array
   * @returns {Promise<object>} Generation result
   */
  async executeTraitsGeneration(concept, direction, userInputs, clichés) {
    // Simulate the generation process
    this.mockLLMResponse(this.createValidTraitsResponse());

    const params = {
      concept,
      direction,
      userInputs,
      cliches: clichés,
    };

    return await this.mockCharacterBuilderService.generateTraits(params);
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
      generatedTraits: null,
    };
  }
}
