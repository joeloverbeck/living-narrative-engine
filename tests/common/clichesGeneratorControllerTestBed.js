/**
 * @file Test bed for ClichesGeneratorController testing
 */

import { jest } from '@jest/globals';
import { BaseTestBed } from './baseTestBed.js';
import { ClichesGeneratorController } from '../../src/clichesGenerator/controllers/ClichesGeneratorController.js';
import { Cliche } from '../../src/characterBuilder/models/cliche.js';
import { createEventBus } from './mockFactories/eventBus.js';
import { v4 as uuidv4 } from 'uuid';
import { ControllerLifecycleOrchestrator } from '../../src/characterBuilder/services/controllerLifecycleOrchestrator.js';

/**
 * Test bed for ClichesGeneratorController
 */
export class ClichesGeneratorControllerTestBed extends BaseTestBed {
  constructor() {
    super();

    // Create mock logger with enhanced debugging support
    this.logger = {
      debug: jest.fn(),
      info: jest.fn(),
      warn: jest.fn(),
      error: jest.fn(),
      log: jest.fn(),
    };
    this.mockLogger = this.logger; // Keep backwards compatibility

    // Track event dispatches for state management testing
    this.dispatchedEvents = [];
    this.eventCallbacks = new Map();
    this._controllerInitializeWrapped = false;

    // Mock services
    this.mockCharacterBuilderService = {
      initialize: jest.fn().mockResolvedValue(true),
      getAllThematicDirections: jest.fn(),
      getAllThematicDirectionsWithConcepts: jest.fn(),
      getCharacterConcept: jest.fn(),
      hasClichesForDirection: jest.fn(),
      getClichesByDirectionId: jest.fn(),
      generateClichesForDirection: jest.fn(),
      getAllCharacterConcepts: jest.fn(),
      createCharacterConcept: jest.fn(),
      updateCharacterConcept: jest.fn(),
      deleteCharacterConcept: jest.fn(),
      generateThematicDirections: jest.fn(),
      getThematicDirections: jest.fn(),
      storeCliches: jest.fn().mockResolvedValue(true),
      storeCharacterConcept: jest.fn().mockResolvedValue(true),
      storeThematicDirection: jest.fn().mockResolvedValue(true),
    };

    this.mockClicheGenerator = {
      generateCliches: jest.fn(),
      parseLLMResponse: jest.fn(),
    };

    // Use enhanced event bus that tracks dispatches for state management testing
    this.mockEventBus = this.createEnhancedEventBus();

    this.mockSchemaValidator = {
      validate: jest.fn().mockReturnValue({ valid: true }),
      getErrors: jest.fn().mockReturnValue([]),
      validateAgainstSchema: jest
        .fn()
        .mockReturnValue({ valid: true, errors: [] }),
    };

    // Controller will be created in setup() after DOM is ready
    this.controller = null;
  }

  /**
   * Override setup to initialize the controller
   */
  async setup() {
    await super.setup();

    // Create DOM structure first
    this.createDOMStructure();

    // Set up default mock data before controller initialization
    // This ensures the controller has data to load during initialization
    // Check if the mock has not been configured with a return value
    if (
      !this.mockCharacterBuilderService.getAllThematicDirectionsWithConcepts.getMockImplementation?.() &&
      !this.mockCharacterBuilderService.getAllThematicDirectionsWithConcepts
        .mock.results.length
    ) {
      // Only set up defaults if not already mocked
      this.mockCharacterBuilderService.getAllThematicDirectionsWithConcepts.mockResolvedValue(
        []
      );
    }

    // Create required services for BaseCharacterBuilderController
    const controllerLifecycleOrchestrator =
      new ControllerLifecycleOrchestrator({
        logger: this.logger,
        eventBus: this.mockEventBus,
      });

    const mockDomElementManager = {
      cacheElement: jest.fn(),
      cacheElements: jest.fn(),
      getElement: jest.fn(),
      getAllElements: jest.fn().mockReturnValue({}),
      clearCache: jest.fn(),
    };

    const mockEventListenerRegistry = {
      register: jest.fn(),
      registerAll: jest.fn(),
      unregisterAll: jest.fn(),
      getRegisteredCount: jest.fn().mockReturnValue(0),
    };

    const mockAsyncUtilitiesToolkit = {
      setTimeout: jest.fn((fn, delay) => setTimeout(fn, delay)),
      setInterval: jest.fn((fn, delay) => setInterval(fn, delay)),
      clearTimeout: jest.fn((id) => clearTimeout(id)),
      clearInterval: jest.fn((id) => clearInterval(id)),
      requestAnimationFrame: jest.fn((fn) => requestAnimationFrame(fn)),
      cancelAnimationFrame: jest.fn((id) => cancelAnimationFrame(id)),
      debounce: jest.fn((fn) => fn),
      throttle: jest.fn((fn) => fn),
    };

    const mockPerformanceMonitor = {
      trackOperation: jest.fn().mockResolvedValue(undefined),
      getMetrics: jest.fn().mockReturnValue({}),
      clearMetrics: jest.fn(),
    };

    const mockMemoryManager = {
      createWeakRef: jest.fn((obj) => ({ deref: () => obj })),
      getAllRefs: jest.fn().mockReturnValue([]),
      clearAllRefs: jest.fn(),
    };

    const mockErrorHandlingStrategy = {
      handleError: jest.fn(),
      showError: jest.fn(),
      dispatchErrorEvent: jest.fn(),
    };

    const mockValidationService = {
      validateData: jest.fn().mockReturnValue({ valid: true, errors: [] }),
      handleValidationError: jest.fn(),
    };

    // Then create controller instance with DOM already in place
    this.controller = new ClichesGeneratorController({
      logger: this.logger,
      characterBuilderService: this.mockCharacterBuilderService,
      eventBus: this.mockEventBus,
      schemaValidator: this.mockSchemaValidator,
      clicheGenerator: this.mockClicheGenerator,
      controllerLifecycleOrchestrator,
      domElementManager: mockDomElementManager,
      eventListenerRegistry: mockEventListenerRegistry,
      asyncUtilitiesToolkit: mockAsyncUtilitiesToolkit,
      performanceMonitor: mockPerformanceMonitor,
      memoryManager: mockMemoryManager,
      errorHandlingStrategy: mockErrorHandlingStrategy,
      validationService: mockValidationService,
    });

    this._controllerInitializeWrapped = false;
    this._wrapControllerInitialize();

    // Initialize the controller
    if (this.controller && this.controller.initialize) {
      await this.controller.initialize();
    }
  }

  /**
   * Create DOM structure for testing
   */
  createDOMStructure() {
    document.body.innerHTML = `
      <div id="cliches-generator-container">
        <form id="cliches-form">
          <select id="direction-selector">
            <option value="">-- Choose a thematic direction --</option>
          </select>
          <button id="generate-btn" type="submit" disabled>Generate Clichés</button>
        </form>
        
        <div id="selected-direction-display" style="display: none">
          <div id="direction-content"></div>
          <div id="direction-meta"></div>
        </div>
        
        <div id="original-concept-display" style="display: none">
          <div id="concept-content"></div>
        </div>
        
        <div id="status-messages"></div>
        
        <div id="cliches-container" class="cliches-container">
          <!-- Empty State (default) -->
          <div class="cb-empty-state" id="empty-state">
            <h3>No Clichés Generated</h3>
            <p>
              Select a thematic direction and click "Generate Clichés" to
              identify common tropes to avoid.
            </p>
          </div>

          <!-- Loading State -->
          <div
            class="cb-loading-state"
            id="loading-state"
            style="display: none"
          >
            <div class="loading-spinner"></div>
            <p>Generating clichés...</p>
          </div>

          <!-- Results State -->
          <div
            class="cb-results-state"
            id="results-state"
            style="display: none"
          >
            <!-- Clichés will be populated here dynamically -->
          </div>

          <!-- Error State -->
          <div class="cb-error-state" id="error-state" style="display: none">
            <h3>Generation Failed</h3>
            <p id="error-message">
              <!-- Error message populated dynamically -->
            </p>
            <button
              type="button"
              id="retry-btn"
              class="cb-button cb-button-secondary"
            >
              Try Again
            </button>
          </div>
        </div>
        
        <button id="back-btn">Back to Menu</button>
      </div>
    `;
  }

  /**
   * Create mock directions data
   *
   * @param count
   */
  createMockDirections(count = 3) {
    const directions = [];
    for (let i = 0; i < count; i++) {
      directions.push({
        id: `dir-${i + 1}`,
        conceptId: `concept-${Math.floor(i / 2) + 1}`,
        title: `Direction ${i + 1}`,
        description: `Description for direction ${i + 1}`,
        coreTension: `Core tension ${i + 1}`,
        createdAt: new Date().toISOString(),
      });
    }
    return directions;
  }

  /**
   * Create a single mock direction
   *
   * @param id
   */
  createMockDirection(id = 'dir-123') {
    return {
      id,
      conceptId: 'concept-1',
      title: 'Test Direction',
      description: 'Test direction description',
      coreTension: 'Test core tension',
      createdAt: new Date().toISOString(),
    };
  }

  /**
   * Create mock concept
   *
   * @param id
   */
  createMockConcept(id = 'concept-1') {
    return {
      id,
      concept:
        'A test character concept that describes an interesting character.',
      text: 'A test character concept that describes an interesting character.', // Keep both for compatibility
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      status: 'completed',
      thematicDirections: [],
      metadata: {},
    };
  }

  /**
   * Create mock clichés data
   */
  createMockClichesData() {
    const categories = {
      names: ['John Smith', 'Jane Doe', 'Bob Johnson'],
      physicalDescriptions: [
        'Tall and muscular',
        'Beautiful but mysterious',
        'Average build with scars',
      ],
      personalityTraits: ['Brooding', 'Sarcastic', 'Rebellious'],
      skillsAbilities: ['Master swordsman', 'Expert hacker', 'Martial artist'],
      typicalLikes: ['Being alone', 'Justice', 'Classic music'],
      typicalDislikes: ['Authority', 'Crowds', 'Small talk'],
      commonFears: ['Losing loved ones', 'Being powerless', 'Failure'],
      genericGoals: ['Save the world', 'Get revenge', 'Find their purpose'],
      backgroundElements: [
        'Orphaned at young age',
        'Trained by mentor',
        'Noble upbringing',
      ],
      overusedSecrets: [
        'Secret royal bloodline',
        'Hidden powers',
        'Dark family history',
      ],
      speechPatterns: [
        'I work alone',
        "This time it's personal",
        'You remind me of myself',
      ],
    };

    const tropesAndStereotypes = [
      'The chosen one',
      'Reluctant hero',
      'Dark past',
    ];

    const cliche = new Cliche({
      id: uuidv4(),
      directionId: 'dir-123',
      conceptId: 'concept-1',
      categories,
      tropesAndStereotypes,
      llmMetadata: {
        model: 'test-model',
        temperature: 0.7,
        tokens: 1000,
        responseTime: 500,
      },
    });

    // Ensure the cliche has a proper getTotalCount method
    if (!cliche.getTotalCount || typeof cliche.getTotalCount !== 'function') {
      cliche.getTotalCount = function () {
        let total = 0;
        if (this.categories) {
          Object.values(this.categories).forEach((category) => {
            if (Array.isArray(category)) {
              total += category.length;
            }
          });
        }
        if (
          this.tropesAndStereotypes &&
          Array.isArray(this.tropesAndStereotypes)
        ) {
          total += this.tropesAndStereotypes.length;
        }
        return total;
      };
    }

    return cliche;
  }

  /**
   * Get DOM elements for testing
   */
  getDirectionSelector() {
    return document.getElementById('direction-selector');
  }

  getGenerateButton() {
    return document.getElementById('generate-btn');
  }

  getDirectionDisplay() {
    return document.getElementById('selected-direction-display');
  }

  getConceptDisplay() {
    return document.getElementById('original-concept-display');
  }

  getClichesContainer() {
    return document.getElementById('cliches-container');
  }

  getStatusMessages() {
    return document.getElementById('status-messages');
  }

  /**
   * Simulate direction selection
   *
   * @param directionId
   */
  async selectDirection(directionId) {
    const selector = this.getDirectionSelector();
    selector.value = directionId;

    // Use direct test method if available for more reliable testing
    if (this.controller && this.controller._testDirectionSelection) {
      await this.controller._testDirectionSelection(directionId);
    } else {
      const event = new Event('change', { bubbles: true });
      selector.dispatchEvent(event);
      // Wait for async operations
      await this.flushPromises();
    }

    // Give extra time for all operations to complete
    await this.waitForAsyncOperations();
  }

  /**
   * Trigger cliché generation
   */
  async triggerGeneration() {
    const button = this.getGenerateButton();
    button.disabled = false;

    // Use direct test method if available for more reliable testing
    if (this.controller && this.controller._testGeneration) {
      await this.controller._testGeneration();
    } else {
      const event = new Event('click', { bubbles: true });
      button.dispatchEvent(event);
      // Wait for async operations
      await this.flushPromises();
    }

    // Give extra time for all operations to complete
    await this.waitForAsyncOperations();
  }

  /**
   * Get error message from status messages
   */
  getErrorMessage() {
    const messages = this.getStatusMessages();
    const errorElement = messages.querySelector('.error');
    return errorElement ? errorElement.textContent : null;
  }

  /**
   * Get success message from status messages
   */
  getSuccessMessage() {
    const messages = this.getStatusMessages();
    const successElement = messages.querySelector('.success');
    return successElement ? successElement.textContent : null;
  }

  /**
   * Check which UI state is currently active (for UIStateManager compatibility)
   */
  getCurrentUIState() {
    const container = this.getClichesContainer();
    if (!container) return null;

    // Check visibility of state divs
    const emptyState = container.querySelector('#empty-state');
    const loadingState = container.querySelector('#loading-state');
    const resultsState = container.querySelector('#results-state');
    const errorState = container.querySelector('#error-state');

    if (emptyState && emptyState.style.display !== 'none') return 'empty';
    if (loadingState && loadingState.style.display !== 'none') return 'loading';
    if (resultsState && resultsState.style.display !== 'none') return 'results';
    if (errorState && errorState.style.display !== 'none') return 'error';

    // Default to empty if no specific state is visible
    return 'empty';
  }

  /**
   * Check if UI is in empty state (replaces CSS class check)
   */
  isEmptyState() {
    return this.getCurrentUIState() === 'empty';
  }

  /**
   * Check if UI is in loading state
   */
  isLoadingState() {
    return this.getCurrentUIState() === 'loading';
  }

  /**
   * Check if UI is in results state
   */
  isResultsState() {
    return this.getCurrentUIState() === 'results';
  }

  /**
   * Check if UI is in error state
   */
  isErrorState() {
    return this.getCurrentUIState() === 'error';
  }

  /**
   * Setup mock for successful direction load
   */
  setupSuccessfulDirectionLoad() {
    const directions = this.createMockDirections();
    const concepts = [
      this.createMockConcept('concept-1'),
      this.createMockConcept('concept-2'),
    ];

    // Setup the new method with the correct response format
    const directionsWithConcepts = directions.map((direction, idx) => ({
      direction: direction,
      concept: concepts[idx % concepts.length], // Assign concepts cyclically
    }));

    this.mockCharacterBuilderService.getAllThematicDirectionsWithConcepts.mockResolvedValue(
      directionsWithConcepts
    );

    // Keep backward compatibility
    this.mockCharacterBuilderService.getAllThematicDirections.mockResolvedValue(
      directions
    );

    // Mock getCharacterConcept to return the appropriate concept for each concept ID
    this.mockCharacterBuilderService.getCharacterConcept.mockImplementation(
      (conceptId) => {
        const concept = concepts.find((c) => c.id === conceptId);
        if (concept) {
          return Promise.resolve(concept);
        }
        // Return the first concept as fallback or create a new one for the ID
        return Promise.resolve(this.createMockConcept(conceptId));
      }
    );

    // Setup hasClichesForDirection to return false initially to trigger proper caching flow
    this.mockCharacterBuilderService.hasClichesForDirection.mockResolvedValue(
      false
    );

    return { directions, concepts };
  }

  /**
   * Setup mock for successful cliché generation
   */
  setupSuccessfulClicheGeneration() {
    const cliches = this.createMockClichesData();

    this.mockCharacterBuilderService.hasClichesForDirection.mockResolvedValue(
      false
    );
    this.mockCharacterBuilderService.generateClichesForDirection.mockResolvedValue(
      cliches
    );

    return cliches;
  }

  /**
   * Setup mock for existing clichés
   *
   * @param directionId
   * @param existingCliches
   */
  setupExistingCliches(directionId = 'dir-1', existingCliches = null) {
    const cliches = existingCliches || this.createMockClichesData();

    this.mockCharacterBuilderService.hasClichesForDirection.mockResolvedValue(
      true
    );
    this.mockCharacterBuilderService.getClichesByDirectionId.mockResolvedValue(
      cliches
    );

    return cliches;
  }

  /**
   * Simulate direction selection through UI
   *
   * @param {string} directionId - Direction ID to select
   */
  async simulateDirectionSelection(directionId) {
    const selector = this.getDirectionSelector();
    selector.value = directionId;

    // Clear previous event tracking for cleaner test results
    this.clearEventTracking();

    // Trigger change event
    const changeEvent = new Event('change', { bubbles: true });
    selector.dispatchEvent(changeEvent);

    // Wait for all async operations to complete
    await this.waitForAsyncOperations();

    // Give extra time for state updates
    await new Promise((resolve) => setTimeout(resolve, 10));
  }

  /**
   * Simulate generate button click
   */
  async simulateGenerateClick() {
    const generateBtn = this.getGenerateButton();

    // Enable button for click
    generateBtn.disabled = false;

    // Trigger click event
    const clickEvent = new Event('click', { bubbles: true });
    generateBtn.dispatchEvent(clickEvent);

    // Also trigger form submit
    const form = document.getElementById('cliches-form');
    if (form) {
      const submitEvent = new Event('submit', {
        bubbles: true,
        cancelable: true,
      });
      form.dispatchEvent(submitEvent);
    }

    // Allow event handlers to process
    await new Promise((resolve) => setTimeout(resolve, 0));
  }

  /**
   * Get dispatched events of a specific type
   *
   * @param {string} eventType - Event type to filter by
   */
  getDispatchedEvents(eventType = null) {
    if (!eventType) {
      return [...this.dispatchedEvents];
    }
    return this.dispatchedEvents.filter((e) => e.type === eventType);
  }

  /**
   * Create mock clichés data (alias for createMockClichesData)
   */
  createMockCliches() {
    return this.createMockClichesData();
  }

  /**
   * Create enhanced EventBus mock that tracks dispatches
   */
  createEnhancedEventBus() {
    const baseEventBus = createEventBus({ captureEvents: true });

    // Override dispatch method to track events and handle both formats
    const originalDispatch = baseEventBus.dispatch.bind(baseEventBus);
    baseEventBus.dispatch = jest.fn((eventTypeOrObject, payload) => {
      // Handle both old and new formats
      let eventName;
      let eventPayload;

      if (typeof eventTypeOrObject === 'object' && eventTypeOrObject !== null) {
        // Old format: dispatch({ type: 'EVENT', payload: {...} })
        eventName = eventTypeOrObject.type;
        eventPayload = eventTypeOrObject.payload || {};
      } else {
        // New format: dispatch('EVENT', {...})
        eventName = eventTypeOrObject;
        eventPayload = payload || {};
      }

      // Store events in the format expected by test assertions
      this.dispatchedEvents.push({
        type: eventName,
        payload: eventPayload,
        timestamp: Date.now(),
      });
      // Call original dispatch with the new two-argument format
      originalDispatch(eventName, eventPayload);

      // Mock event validation - return boolean as expected by tests
      // Return true for successful dispatch (mimics ValidatedEventDispatcher behavior)
      // Tests can override this behavior by setting validation failure responses
      return true;
    });

    // Track callbacks when using the 'subscribe' method
    const originalSubscribe = baseEventBus.subscribe;
    baseEventBus.subscribe = jest.fn((eventType, callback) => {
      if (!this.eventCallbacks.has(eventType)) {
        this.eventCallbacks.set(eventType, []);
      }
      this.eventCallbacks.get(eventType).push(callback);
      return originalSubscribe.call(baseEventBus, eventType, callback);
    });

    return baseEventBus;
  }

  /**
   * Get dispatched events by type
   *
   * @param eventType
   */
  getDispatchedEventsByType(eventType) {
    return this.dispatchedEvents.filter((event) => event.type === eventType);
  }

  /**
   * Clear event tracking
   */
  clearEventTracking() {
    this.dispatchedEvents = [];
  }

  /**
   * Get last dispatched event
   */
  getLastDispatchedEvent() {
    return this.dispatchedEvents[this.dispatchedEvents.length - 1] || null;
  }

  /**
   * Wait for specific event to be dispatched
   *
   * @param eventType
   * @param timeout
   */
  async waitForEvent(eventType, timeout = 1000) {
    const startTime = Date.now();

    while (Date.now() - startTime < timeout) {
      const events = this.getDispatchedEventsByType(eventType);
      if (events.length > 0) {
        return events[events.length - 1];
      }
      await new Promise((resolve) => setTimeout(resolve, 10));
    }

    throw new Error(`Event ${eventType} not dispatched within ${timeout}ms`);
  }

  /**
   * Simulate error in service call
   *
   * @param serviceName
   * @param methodName
   * @param error
   */
  simulateServiceError(
    serviceName,
    methodName,
    error = new Error('Test error')
  ) {
    const service = this[serviceName];
    if (service && service[methodName]) {
      service[methodName].mockRejectedValue(error);
    }
  }

  /**
   * Assert event was dispatched with specific payload
   *
   * @param eventType
   * @param expectedPayload
   */
  assertEventDispatched(eventType, expectedPayload = null) {
    const events = this.getDispatchedEventsByType(eventType);
    if (events.length === 0) {
      throw new Error(`Event ${eventType} was not dispatched`);
    }

    if (expectedPayload) {
      const lastEvent = events[events.length - 1];
      expect(lastEvent.payload).toMatchObject(expectedPayload);
    }

    return events[events.length - 1];
  }

  /**
   * Assert event sequence was dispatched in order
   *
   * @param expectedSequence
   */
  assertEventSequence(expectedSequence) {
    const actualSequence = this.dispatchedEvents.map((event) => event.type);
    const sequenceMatch = expectedSequence.every((eventType, index) => {
      const actualIndex = actualSequence.indexOf(eventType);
      return (
        actualIndex >= 0 &&
        (index === 0 ||
          actualIndex > actualSequence.indexOf(expectedSequence[index - 1]))
      );
    });

    expect(sequenceMatch).toBe(
      true,
      `Expected sequence ${expectedSequence.join(' → ')} but got ${actualSequence.join(' → ')}`
    );
  }

  /**
   * Get cache statistics from controller
   */
  getCacheStats() {
    return this.controller.getCacheStats();
  }

  /**
   * Get state history from controller
   */
  getStateHistory() {
    return this.controller.getStateHistory();
  }

  /**
   * Assert cache contains specific entries
   *
   * @param cacheType
   * @param key
   */
  assertCacheContains(cacheType, key) {
    const stats = this.getCacheStats();
    const cacheSize = stats[`${cacheType}CacheSize`];
    expect(cacheSize).toBeGreaterThan(0);
  }

  /**
   * Force populate caches for testing (when mocks bypass caching)
   */
  forcePopulateCaches() {
    // If the controller has cache manipulation methods, use them
    if (this.controller && this.controller._populateTestCaches) {
      this.controller._populateTestCaches();
    }
  }

  /**
   * Ensure direction selection actually triggers the expected flow
   * This method bypasses potential timing issues by directly calling the controller methods
   *
   * @param directionId
   */
  async ensureDirectionSelectionFlow(directionId) {
    // Set the direction selector value
    const selector = this.getDirectionSelector();
    selector.value = directionId;

    // Clear previous events for cleaner testing
    this.clearEventTracking();

    // Directly trigger the controller's direction selection handler
    // This ensures the expected flow executes regardless of event timing issues
    if (this.controller && this.controller._testDirectionSelection) {
      await this.controller._testDirectionSelection(directionId);
    } else {
      // Fallback to DOM event
      const changeEvent = new Event('change', { bubbles: true });
      selector.dispatchEvent(changeEvent);
      await this.waitForAsyncOperations();
    }
  }

  /**
   * Ensure generation actually triggers the expected flow
   * This method bypasses potential timing issues by directly calling the controller methods
   */
  async ensureGenerationFlow() {
    // Clear previous events for cleaner testing
    this.clearEventTracking();

    // Directly trigger the controller's generation handler
    if (this.controller && this.controller._testGeneration) {
      await this.controller._testGeneration();
    } else {
      // Fallback to DOM event
      await this.clickGenerateButton();
    }
  }

  /**
   * Assert state change was recorded
   *
   * @param action
   * @param expectedData
   */
  assertStateChangeRecorded(action, expectedData = null) {
    const history = this.getStateHistory();
    const matchingChanges = history.filter(
      (change) => change.action === action
    );

    expect(matchingChanges.length).toBeGreaterThan(0);

    if (expectedData) {
      const lastChange = matchingChanges[matchingChanges.length - 1];
      expect(lastChange.data).toMatchObject(expectedData);
    }

    return matchingChanges[matchingChanges.length - 1];
  }

  /**
   * Enhanced utility to flush promises and handle async operations
   */
  async flushPromises() {
    // Use setImmediate to ensure all microtasks complete
    await new Promise((resolve) => setImmediate(resolve));
    // Add additional wait for DOM updates and event propagation
    await new Promise((resolve) => setTimeout(resolve, 0));
  }

  /**
   * Wait for DOM and async operations to complete
   * This is more comprehensive than flushPromises for complex operations
   *
   * @param timeout
   */
  async waitForAsyncOperations(timeout = 1000) {
    const startTime = Date.now();

    // First flush immediate promises
    await this.flushPromises();

    // Wait for any pending operations
    while (Date.now() - startTime < timeout) {
      // Check if controller is still processing
      if (
        this.controller &&
        this.controller.isGenerating &&
        this.controller.isGenerating()
      ) {
        await new Promise((resolve) => setTimeout(resolve, 10));
        continue;
      }
      break;
    }

    // Final flush to ensure everything is settled
    await this.flushPromises();
  }

  /**
   * Setup mock for successful generation
   *
   * @param {string} directionId - Direction ID
   * @param {object} cliches - Clichés to return
   */
  setupSuccessfulGeneration(directionId, cliches) {
    const concept = this.createMockConcept();
    this.mockCharacterBuilderService.getCharacterConcept.mockResolvedValue(
      concept
    );
    this.mockCharacterBuilderService.hasClichesForDirection.mockResolvedValue(
      false
    );
    this.mockCharacterBuilderService.generateClichesForDirection.mockResolvedValue(
      cliches
    );
  }

  /**
   * Setup mock for failed generation
   *
   * @param {string} directionId - Direction ID
   */
  setupFailedGeneration(directionId) {
    const concept = this.createMockConcept();
    this.mockCharacterBuilderService.getCharacterConcept.mockResolvedValue(
      concept
    );
    this.mockCharacterBuilderService.hasClichesForDirection.mockResolvedValue(
      false
    );
    this.mockCharacterBuilderService.generateClichesForDirection.mockRejectedValue(
      new Error('Generation failed')
    );
  }

  /**
   * Click the generate button with enhanced async handling
   */
  async clickGenerateButton() {
    const generateBtn = this.getGenerateButton();
    generateBtn.disabled = false;

    // Trigger click event
    const clickEvent = new Event('click', { bubbles: true });
    generateBtn.dispatchEvent(clickEvent);

    // Also trigger form submit to match real behavior
    const form = document.getElementById('cliches-form');
    if (form) {
      const submitEvent = new Event('submit', {
        bubbles: true,
        cancelable: true,
      });
      form.dispatchEvent(submitEvent);
    }

    // Wait for comprehensive async operations
    await this.waitForAsyncOperations();
  }

  /**
   * Wait for direction selection to complete
   *
   * @param {string} directionId - Direction ID to wait for
   */
  async waitForDirectionSelection(directionId) {
    // Wait for direction selection event to be dispatched
    try {
      await this.waitForEvent('DIRECTION_SELECTION_COMPLETED', 2000);
    } catch (error) {
      // If event doesn't dispatch, just wait a bit for async operations
      await this.flushPromises();
      await new Promise((resolve) => setTimeout(resolve, 100));
    }
  }

  /**
   * Create a cliche object with specified properties
   *
   * @param {object} overrides - Properties to override defaults
   * @returns {object} - Cliche object
   */
  createCliche(overrides = {}) {
    const defaultCategories = {
      names: ['John Doe', 'Jane Smith'],
      physicalDescriptions: ['Tall and lean', 'Average build'],
      personalityTraits: ['Brooding', 'Mysterious'],
      skillsAbilities: ['Expert fighter', 'Master tracker'],
      typicalLikes: ['Solitude', 'Justice'],
      typicalDislikes: ['Crowds', 'Injustice'],
      commonFears: ['Failure', 'Loss'],
      genericGoals: ['Revenge', 'Redemption'],
      backgroundElements: ['Tragic past', 'Lost family'],
      overusedSecrets: ['Hidden power', 'Royal blood'],
      speechPatterns: ['Few words', 'Cryptic statements'],
    };

    const defaultCliche = {
      id: uuidv4(),
      directionId: 'direction-1',
      conceptId: 'concept-1',
      categories: defaultCategories,
      tropesAndStereotypes: ['Lone wolf', 'Dark past'],
      llmMetadata: {
        model: 'test-model',
        temperature: 0.7,
        tokens: 1000,
        responseTime: 500,
      },
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    return { ...defaultCliche, ...overrides };
  }

  /**
   * Create a character concept with specified properties
   *
   * @param {object} overrides - Properties to override defaults
   * @returns {object} - Character concept object
   */
  createCharacterConcept(overrides = {}) {
    const defaultConcept = {
      id: uuidv4(),
      text: 'A mysterious wanderer with a troubled past.',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    return { ...defaultConcept, ...overrides };
  }

  /**
   * Wait for a condition to be true
   *
   * @param {Function} condition - Function that returns boolean
   * @param {number} timeout - Maximum time to wait in ms
   * @param {number} interval - Check interval in ms
   * @returns {Promise<void>}
   */
  async waitFor(condition, timeout = 5000, interval = 100) {
    const startTime = Date.now();

    while (!condition()) {
      if (Date.now() - startTime > timeout) {
        throw new Error('Timeout waiting for condition');
      }
      await new Promise((resolve) => setTimeout(resolve, interval));
    }
  }

  /**
   * Load directions into the controller
   *
   * @param {Array} directions - Array of direction objects
   */
  loadDirections(directions = null) {
    const directionsToLoad = directions || this.createMockDirections();
    this.mockCharacterBuilderService.getAllThematicDirectionsWithConcepts.mockResolvedValue(
      directionsToLoad
    );
    return directionsToLoad;
  }

  /**
   * Setup the test bed to simulate failed cliche generation
   */
  setupFailedClicheGeneration() {
    this.mockCharacterBuilderService.generateClichesForDirection.mockRejectedValue(
      new Error('Cliche generation failed')
    );
  }

  /**
   * Create a thematic direction with specified properties
   *
   * @param {object} overrides - Properties to override defaults
   * @returns {object} - Thematic direction object
   */
  createThematicDirection(overrides = {}) {
    const defaultDirection = {
      id: uuidv4(),
      conceptId: 'concept-1',
      title: 'The Lone Wanderer',
      description: 'A solitary figure walking the path of redemption.',
      coreTension: 'Isolation vs Connection',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    return { ...defaultDirection, ...overrides };
  }

  /**
   * Mock LLM service with a specific response
   *
   * @param {object} response - The response to return from LLM service
   */
  mockLLMService(response) {
    if (this.mockClicheGenerator) {
      this.mockClicheGenerator.generateCliches.mockResolvedValue(response);
    }
  }

  /**
   * Mock LLM service to return an error
   *
   * @param {string} errorMessage - Error message
   */
  mockLLMServiceError(errorMessage = 'LLM service error') {
    if (this.mockClicheGenerator) {
      this.mockClicheGenerator.generateCliches.mockRejectedValue(
        new Error(errorMessage)
      );
    }
  }

  /**
   * Simulate database error
   *
   * @param {string} errorMessage - Error message
   */
  simulateDatabaseError(errorMessage = 'Database connection error') {
    // Mock all database-related methods to throw errors
    const error = new Error(errorMessage);

    this.mockCharacterBuilderService.storeCliches = jest
      .fn()
      .mockRejectedValue(error);
    this.mockCharacterBuilderService.getClichesByDirectionId = jest
      .fn()
      .mockRejectedValue(error);
    this.mockCharacterBuilderService.hasClichesForDirection = jest
      .fn()
      .mockRejectedValue(error);
    this.mockCharacterBuilderService.generateClichesForDirection = jest
      .fn()
      .mockRejectedValue(error);
  }

  /**
   * Get controller state for debugging
   */
  getControllerState() {
    if (this.controller && this.controller._testGetCurrentState) {
      return this.controller._testGetCurrentState();
    }
    return null;
  }

  /**
   * Reinitialize the test bed (for persistence testing)
   */
  async reinitialize() {
    // Clean up current instance
    this.cleanup();

    // Recreate DOM structure
    this.createDOMStructure();

    // Create required services for BaseCharacterBuilderController
    const controllerLifecycleOrchestrator =
      new ControllerLifecycleOrchestrator({
        logger: this.logger,
        eventBus: this.mockEventBus,
      });

    const mockDomElementManager = {
      cacheElement: jest.fn(),
      cacheElements: jest.fn(),
      getElement: jest.fn(),
      getAllElements: jest.fn().mockReturnValue({}),
      clearCache: jest.fn(),
    };

    const mockEventListenerRegistry = {
      register: jest.fn(),
      registerAll: jest.fn(),
      unregisterAll: jest.fn(),
      getRegisteredCount: jest.fn().mockReturnValue(0),
    };

    const mockAsyncUtilitiesToolkit = {
      setTimeout: jest.fn((fn, delay) => setTimeout(fn, delay)),
      setInterval: jest.fn((fn, delay) => setInterval(fn, delay)),
      clearTimeout: jest.fn((id) => clearTimeout(id)),
      clearInterval: jest.fn((id) => clearInterval(id)),
      requestAnimationFrame: jest.fn((fn) => requestAnimationFrame(fn)),
      cancelAnimationFrame: jest.fn((id) => cancelAnimationFrame(id)),
      debounce: jest.fn((fn) => fn),
      throttle: jest.fn((fn) => fn),
    };

    const mockPerformanceMonitor = {
      trackOperation: jest.fn().mockResolvedValue(undefined),
      getMetrics: jest.fn().mockReturnValue({}),
      clearMetrics: jest.fn(),
    };

    const mockMemoryManager = {
      createWeakRef: jest.fn((obj) => ({ deref: () => obj })),
      getAllRefs: jest.fn().mockReturnValue([]),
      clearAllRefs: jest.fn(),
    };

    const mockErrorHandlingStrategy = {
      handleError: jest.fn(),
      showError: jest.fn(),
      dispatchErrorEvent: jest.fn(),
    };

    const mockValidationService = {
      validateData: jest.fn().mockReturnValue({ valid: true, errors: [] }),
      handleValidationError: jest.fn(),
    };

    // Recreate controller with same mocks
    this.controller = new ClichesGeneratorController({
      logger: this.logger,
      characterBuilderService: this.mockCharacterBuilderService,
      eventBus: this.mockEventBus,
      schemaValidator: this.mockSchemaValidator,
      clicheGenerator: this.mockClicheGenerator,
      controllerLifecycleOrchestrator,
      domElementManager: mockDomElementManager,
      eventListenerRegistry: mockEventListenerRegistry,
      asyncUtilitiesToolkit: mockAsyncUtilitiesToolkit,
      performanceMonitor: mockPerformanceMonitor,
      memoryManager: mockMemoryManager,
      errorHandlingStrategy: mockErrorHandlingStrategy,
      validationService: mockValidationService,
    });

    this._controllerInitializeWrapped = false;
    this._wrapControllerInitialize();

    // Re-initialize the controller
    await this.controller.initialize();
  }

  /**
   * Wrap controller.initialize so repeated calls reset lifecycle state.
   */
  _wrapControllerInitialize() {
    if (this._controllerInitializeWrapped || !this.controller) {
      return;
    }

    const originalInitialize =
      typeof this.controller.initialize === 'function'
        ? this.controller.initialize.bind(this.controller)
        : null;

    if (!originalInitialize) {
      return;
    }

    this.controller.initialize = async (...args) => {
      if (
        this.controller &&
        typeof this.controller._resetInitializationState === 'function'
      ) {
        this.controller._resetInitializationState();
      }
      return originalInitialize(...args);
    };

    this._controllerInitializeWrapped = true;
  }

  /**
   * Get the database instance (mock)
   *
   * @returns {object} - Mock database
   */
  getDatabase() {
    // Return a mock database interface
    return {
      storeCliches: this.mockCharacterBuilderService.storeCliches,
      getClichesByDirectionId:
        this.mockCharacterBuilderService.getClichesByDirectionId,
      hasClichesForDirection:
        this.mockCharacterBuilderService.hasClichesForDirection,
    };
  }

  /**
   * Get the controller instance
   *
   * @returns {object} - Controller instance
   */
  getController() {
    return this.controller;
  }

  /**
   * Reset controller state for clean testing
   */
  resetControllerState() {
    if (this.controller) {
      // Access private fields through the controller's state
      // We can't directly access private fields, but we can wait for any pending operations
      // and ensure the controller is not in a generating state

      // Clear any pending operations by waiting
      return new Promise((resolve) => {
        const checkState = () => {
          // If controller has public methods to check state, use them
          if (this.controller.isGenerating && this.controller.isGenerating()) {
            setTimeout(checkState, 10);
          } else {
            resolve();
          }
        };
        checkState();
      });
    }
    return Promise.resolve();
  }

  /**
   * Initialize the test bed
   */
  async initialize() {
    // Initialize mocks if needed
    if (this.mockCharacterBuilderService.initialize) {
      await this.mockCharacterBuilderService.initialize();
    }

    // Initialize controller if it has an initialize method
    if (this.controller && this.controller.initialize) {
      await this.controller.initialize();
    }
  }

  /**
   * Add storeCliches method to mock service if not present
   */
  setupStoreClichesMock() {
    if (!this.mockCharacterBuilderService.storeCliches) {
      this.mockCharacterBuilderService.storeCliches = jest
        .fn()
        .mockResolvedValue(true);
    }
  }

  /**
   * Clean up test bed
   */
  cleanup() {
    // Clear all mocks
    jest.clearAllMocks();

    // Clear event tracking
    this.clearEventTracking();
    this.eventCallbacks.clear();

    // Clear DOM
    document.body.innerHTML = '';

    // Call parent cleanup
    super.cleanup();
  }
}

export default ClichesGeneratorControllerTestBed;
