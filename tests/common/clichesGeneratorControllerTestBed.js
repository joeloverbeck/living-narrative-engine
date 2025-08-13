/**
 * @file Test bed for ClichesGeneratorController testing
 */

import { jest } from '@jest/globals';
import { BaseTestBed } from './baseTestBed.js';
import { ClichesGeneratorController } from '../../src/clichesGenerator/controllers/ClichesGeneratorController.js';
import { Cliche } from '../../src/characterBuilder/models/cliche.js';
import { createEventBus } from './mockFactories/eventBus.js';
import { v4 as uuidv4 } from 'uuid';

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

    // Mock services
    this.mockCharacterBuilderService = {
      initialize: jest.fn().mockResolvedValue(true),
      getAllThematicDirections: jest.fn(),
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

    // Create DOM structure
    this.createDOMStructure();

    // Create controller instance
    this.controller = new ClichesGeneratorController({
      logger: this.logger,
      characterBuilderService: this.mockCharacterBuilderService,
      eventBus: this.mockEventBus,
      schemaValidator: this.mockSchemaValidator,
      clicheGenerator: this.mockClicheGenerator,
    });
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
        
        <div id="cliches-container" class="empty-state">
          <p>Select a thematic direction to view or generate clichés.</p>
        </div>
        <div id="status-messages"></div>
        
        <button id="back-to-menu-btn">Back to Menu</button>
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
      text: 'A test character concept that describes an interesting character.',
      createdAt: new Date().toISOString(),
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

    const event = new Event('change', { bubbles: true });
    selector.dispatchEvent(event);

    // Wait for async operations
    await this.flushPromises();
  }

  /**
   * Trigger cliché generation
   */
  async triggerGeneration() {
    const button = this.getGenerateButton();
    button.disabled = false;

    const event = new Event('click', { bubbles: true });
    button.dispatchEvent(event);

    // Wait for async operations
    await this.flushPromises();
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
   * Setup mock for successful direction load
   */
  setupSuccessfulDirectionLoad() {
    const directions = this.createMockDirections();
    const concepts = [
      this.createMockConcept('concept-1'),
      this.createMockConcept('concept-2'),
    ];

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

    // Trigger change event
    const changeEvent = new Event('change', { bubbles: true });
    selector.dispatchEvent(changeEvent);

    // Allow event handlers to process
    await new Promise((resolve) => setTimeout(resolve, 0));
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
  getDispatchedEvents(eventType) {
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

    // Override dispatch method to track events
    const originalDispatch = baseEventBus.dispatch.bind(baseEventBus);
    baseEventBus.dispatch = jest.fn((eventName, payload = {}) => {
      // Store events in the format expected by test assertions
      this.dispatchedEvents.push({
        type: eventName,
        payload: payload,
        timestamp: Date.now(),
      });
      // Call original dispatch with correct two-argument format
      return originalDispatch(eventName, payload);
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
   * Get all dispatched events
   */
  getDispatchedEvents() {
    return [...this.dispatchedEvents];
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
   * Utility to flush promises
   */
  async flushPromises() {
    return new Promise((resolve) => setImmediate(resolve));
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
   * Click the generate button
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

    // Wait for async operations
    await this.flushPromises();

    // Additional wait to ensure finally block execution
    await new Promise((resolve) => setTimeout(resolve, 100));
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
   * Reinitialize the test bed (for persistence testing)
   */
  async reinitialize() {
    // Clean up current instance
    this.cleanup();

    // Recreate DOM structure
    this.createDOMStructure();

    // Recreate controller with same mocks
    this.controller = new ClichesGeneratorController({
      logger: this.logger,
      characterBuilderService: this.mockCharacterBuilderService,
      eventBus: this.mockEventBus,
      schemaValidator: this.mockSchemaValidator,
      clicheGenerator: this.mockClicheGenerator,
    });

    // Re-initialize the controller
    await this.controller.initialize();
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
