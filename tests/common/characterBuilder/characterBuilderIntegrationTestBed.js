/**
 * @file Integration test bed for CharacterBuilderService
 * Provides utilities for testing the character builder service with real dependencies
 */

import { jest } from '@jest/globals';
import { v4 as uuidv4 } from 'uuid';
import BaseTestBed from '../baseTestBed.js';
import AppContainer from '../../../src/dependencyInjection/appContainer.js';
import { configureMinimalContainer } from '../../../src/dependencyInjection/minimalContainerConfig.js';
import { tokens } from '../../../src/dependencyInjection/tokens.js';
import { CHARACTER_BUILDER_EVENTS } from '../../../src/characterBuilder/services/characterBuilderService.js';
import { CHARACTER_CONCEPT_STATUS } from '../../../src/characterBuilder/models/characterConcept.js';

/**
 * Test bed for CharacterBuilderService integration tests
 */
export class CharacterBuilderIntegrationTestBed extends BaseTestBed {
  #container;
  #characterBuilderService;
  #characterDatabase;
  #eventBus;
  #logger;
  #llmJsonService;
  #capturedEvents = [];
  #eventListener;
  #mockLlmResponses = new Map();
  #llmCallCount = 0;
  #simulateFailures = {
    storage: false,
    llm: false,
    failureCount: 0,
    maxFailures: 0,
  };
  #unsubscribeFunctions = [];

  constructor() {
    super();
  }

  /**
   * Initialize the test bed with real dependencies
   */
  async initialize() {
    // Create container with character builder enabled
    this.#container = new AppContainer();
    
    // Mock LLM services BEFORE configuring container to prevent initialization
    await this.#preConfigureMocks();
    
    await configureMinimalContainer(this.#container, {
      includeCharacterBuilder: true,
    });

    // Get logger first
    this.#logger = this.#container.resolve(tokens.ILogger);

    // Additional mocking after container setup
    await this.#setupLlmMocks();

    // Get real services
    this.#characterBuilderService = this.#container.resolve(
      tokens.CharacterBuilderService
    );
    this.#characterDatabase = this.#container.resolve(
      tokens.CharacterDatabase
    );
    this.#eventBus = this.#container.resolve(tokens.ISafeEventDispatcher);
    try {
      this.#llmJsonService = this.#container.resolve(tokens.LlmJsonService);
    } catch (error) {
      this.#logger.warn('Could not resolve LlmJsonService', error);
    }

    // Set up event capturing
    this.#eventListener = (type, payload) => {
      this.#capturedEvents.push({ type, payload, timestamp: Date.now() });
    };

    // Listen to all character builder events
    Object.values(CHARACTER_BUILDER_EVENTS).forEach((eventType) => {
      const unsubscribe = this.#eventBus.subscribe(eventType, (event) =>
        this.#eventListener(eventType, event.payload)
      );
      if (unsubscribe) {
        this.#unsubscribeFunctions.push(unsubscribe);
      }
    });

    // Initialize the service
    await this.#characterBuilderService.initialize();
  }

  /**
   * Pre-configure mocks before container setup
   */
  async #preConfigureMocks() {
    // Mock global fetch to prevent any network calls during setup
    global.fetch = jest.fn().mockRejectedValue(new Error('Network calls disabled in tests'));
  }

  /**
   * Set up LLM service mocks
   */
  async #setupLlmMocks() {
    // Mock the LLM configuration manager first
    const tokens = (await import('../../../src/dependencyInjection/tokens.js')).tokens;
    
    // Create a mock LLM Configuration Manager that doesn't make network calls
    const mockConfig = {
      configId: 'test-config',
      model: 'test-model',
      baseUrl: 'http://localhost:3001',
      displayName: 'Test Config',
      modelIdentifier: 'test-model',
      endpointUrl: 'http://localhost:3001',
      apiType: 'test',
      jsonOutputStrategy: {
        method: 'tool_calling',
        toolName: 'test_tool'
      },
      promptElements: [],
      promptAssemblyOrder: []
    };

    const mockLlmConfigManager = {
      getActiveConfiguration: jest.fn().mockResolvedValue(mockConfig),
      setActiveConfiguration: jest.fn().mockResolvedValue(true),
      loadConfiguration: jest.fn().mockResolvedValue(mockConfig),
      getAllConfigurations: jest.fn().mockResolvedValue({
        defaultConfigId: 'test-config',
        configs: { 'test-config': mockConfig }
      }),
      getAvailableOptions: jest.fn().mockResolvedValue([
        { configId: 'test-config', displayName: 'Test Config' }
      ]),
      getActiveConfigId: jest.fn().mockResolvedValue('test-config'),
      validateConfiguration: jest.fn().mockReturnValue([]),
      init: jest.fn().mockResolvedValue(),
      isInitialized: jest.fn().mockReturnValue(true),
      isOperational: jest.fn().mockReturnValue(true)
    };

    // Replace the service in the container
    this.#container.setOverride(tokens.ILLMConfigurationManager, mockLlmConfigManager);
    this.#logger.debug('LLM configuration manager replaced with mock');

    // Mock the LLM adapter
    const llmAdapter = this.#container.resolve(tokens.LLMAdapter);

    if (!llmAdapter) {
      this.#logger.warn('LLM adapter not available, skipping mock setup');
      return;
    }

    const originalGetAIDecision = llmAdapter.getAIDecision?.bind(llmAdapter);

    if (!originalGetAIDecision) {
      this.#logger.warn('getAIDecision method not found on LLM adapter');
      return;
    }

    llmAdapter.getAIDecision = jest
      .fn()
      .mockImplementation(async (prompt, ...args) => {
        this.#llmCallCount++;

        // Check if we should simulate failures
        if (this.#simulateFailures.llm) {
          if (this.#simulateFailures.failureCount < this.#simulateFailures.maxFailures) {
            this.#simulateFailures.failureCount++;
            throw new Error('Simulated LLM failure for testing');
          }
          // Reset after reaching max failures
          this.#simulateFailures.failureCount = 0;
        }

        // Check for mock response
        const mockKey = this.#getMockKey([prompt]);
        if (this.#mockLlmResponses.has(mockKey)) {
          const response = this.#mockLlmResponses.get(mockKey);
          if (response instanceof Promise) {
            return response;
          }
          return JSON.stringify(response);
        }

        // Default mock response for thematic directions
        const defaultResponse = {
          thematic_directions: [
            {
              title: 'The Wanderer',
              description: 'A traveler seeking knowledge across lands',
              themes: ['exploration', 'wisdom', 'journey'],
              suggested_traits: ['curious', 'resilient', 'observant'],
              potential_conflicts: ['homesickness', 'cultural misunderstandings'],
              narrative_hooks: ['ancient map discovery', 'mysterious guide'],
            },
            {
              title: 'The Scholar',
              description: 'A keeper of forgotten lore and ancient wisdom',
              themes: ['knowledge', 'mystery', 'tradition'],
              suggested_traits: ['intelligent', 'patient', 'methodical'],
              potential_conflicts: ['forbidden knowledge', 'academic rivals'],
              narrative_hooks: ['lost library', 'prophetic texts'],
            },
            {
              title: 'The Outcast',
              description: 'One who walks between worlds, belonging to none',
              themes: ['isolation', 'identity', 'redemption'],
              suggested_traits: ['independent', 'adaptable', 'guarded'],
              potential_conflicts: ['trust issues', 'past catching up'],
              narrative_hooks: ['hidden heritage', 'unlikely allies'],
            },
          ],
        };

        return JSON.stringify(defaultResponse);
      });
  }

  /**
   * Get a key for mocking based on LLM call arguments
   *
   * @param args
   */
  #getMockKey(args) {
    return JSON.stringify(args[0]); // Use prompt as key
  }

  /**
   * Set a mock response for specific LLM calls
   *
   * @param promptPattern
   * @param response
   */
  setMockLlmResponse(promptPattern, response) {
    this.#mockLlmResponses.set(promptPattern, response);
  }

  /**
   * Enable failure simulation
   *
   * @param type
   * @param maxFailures
   */
  simulateFailures(type, maxFailures = 1) {
    if (type === 'storage') {
      this.#simulateFailures.storage = true;
      this.#simulateFailures.maxFailures = maxFailures;
    } else if (type === 'llm') {
      this.#simulateFailures.llm = true;
      this.#simulateFailures.maxFailures = maxFailures;
    }
  }

  /**
   * Disable failure simulation
   */
  clearFailureSimulation() {
    this.#simulateFailures = {
      storage: false,
      llm: false,
      failureCount: 0,
      maxFailures: 0,
    };
  }

  /**
   * Get captured events
   *
   * @param type
   */
  getCapturedEvents(type = null) {
    if (type) {
      return this.#capturedEvents.filter((event) => event.type === type);
    }
    return [...this.#capturedEvents];
  }

  /**
   * Clear captured events
   */
  clearCapturedEvents() {
    this.#capturedEvents = [];
  }

  /**
   * Get event of specific type
   *
   * @param type
   */
  getLastEvent(type) {
    const events = this.getCapturedEvents(type);
    return events[events.length - 1] || null;
  }

  /**
   * Wait for a specific event to be dispatched
   *
   * @param eventType
   * @param timeout
   */
  async waitForEvent(eventType, timeout = 5000) {
    const startTime = Date.now();
    while (Date.now() - startTime < timeout) {
      const event = this.getLastEvent(eventType);
      if (event) {
        return event;
      }
      await new Promise((resolve) => setTimeout(resolve, 10));
    }
    throw new Error(`Timeout waiting for event: ${eventType}`);
  }

  /**
   * Get the character builder service
   */
  getService() {
    return this.#characterBuilderService;
  }

  /**
   * Get the event bus
   */
  getEventBus() {
    return this.#eventBus;
  }

  /**
   * Get LLM call count
   */
  getLlmCallCount() {
    return this.#llmCallCount;
  }

  /**
   * Reset LLM call count
   */
  resetLlmCallCount() {
    this.#llmCallCount = 0;
  }

  /**
   * Create test character concept data
   *
   * @param overrides
   */
  createTestConceptData(overrides = {}) {
    return {
      concept: 'A mysterious wanderer with a hidden past',
      metadata: {
        tags: ['mysterious', 'wanderer'],
        source: 'test',
      },
      ...overrides,
    };
  }

  /**
   * Clean up test data
   */
  async cleanup() {
    try {
      // Clear all character concepts and directions
      const getConceptsPromise = this.#characterBuilderService.getAllCharacterConcepts();
      const concepts = await Promise.race([
        getConceptsPromise,
        new Promise((_, reject) => 
          setTimeout(() => reject(new Error('Timeout getting concepts')), 5000)
        )
      ]).catch((error) => {
        this.#logger.warn('Failed to get concepts during cleanup', error);
        return [];
      });

      for (const concept of concepts) {
        try {
          await this.#characterBuilderService.deleteCharacterConcept(concept.id);
        } catch (deleteError) {
          this.#logger.warn('Failed to delete concept during cleanup', deleteError);
        }
      }

      // Clear event listeners
      this.#unsubscribeFunctions.forEach((unsubscribe) => {
        try {
          unsubscribe();
        } catch (unsubError) {
          this.#logger.warn('Failed to unsubscribe event listener', unsubError);
        }
      });
      this.#unsubscribeFunctions = [];

      // Clear mocks
      this.#mockLlmResponses.clear();
      this.clearFailureSimulation();
      this.clearCapturedEvents();

      // Close database connection
      if (this.#characterDatabase && this.#characterDatabase.close) {
        try {
          await Promise.race([
            this.#characterDatabase.close(),
            new Promise((resolve) => setTimeout(resolve, 2000))
          ]);
        } catch (closeError) {
          this.#logger.warn('Failed to close database', closeError);
        }
      }
    } catch (error) {
      this.#logger.error('Error during test cleanup', error);
    }
  }

  /**
   * Simulate storage failure for next N operations
   *
   * @param operations
   */
  async simulateStorageFailure(operations = ['storeCharacterConcept']) {
    const storageService = this.#container.resolve(
      tokens.CharacterStorageService
    );

    operations.forEach((op) => {
      if (storageService[op]) {
        const original = storageService[op].bind(storageService);
        let callCount = 0;

        storageService[op] = jest.fn().mockImplementation(async (...args) => {
          if (
            this.#simulateFailures.storage &&
            callCount < this.#simulateFailures.maxFailures
          ) {
            callCount++;
            throw new Error(`Simulated storage failure for ${op}`);
          }
          return original(...args);
        });
      }
    });
  }

  /**
   * Get delay for retry testing
   *
   * @param attempt
   * @param baseDelay
   * @param maxDelay
   */
  getRetryDelay(attempt, baseDelay = 10, maxDelay = 50) {
    return Math.min(baseDelay * Math.pow(2, attempt - 1), maxDelay);
  }

  /**
   * Verify retry timing
   *
   * @param operation
   * @param expectedAttempts
   */
  async verifyRetryTiming(operation, expectedAttempts) {
    const startTime = Date.now();
    
    try {
      await operation();
    } catch (error) {
      // Expected to fail
    }

    const elapsed = Date.now() - startTime;
    const minExpectedTime = this.calculateMinRetryTime(expectedAttempts);
    
    return {
      elapsed,
      minExpectedTime,
      withinBounds: elapsed >= minExpectedTime,
    };
  }

  /**
   * Calculate minimum expected retry time
   *
   * @param attempts
   */
  calculateMinRetryTime(attempts) {
    let totalTime = 0;
    for (let i = 1; i < attempts; i++) {
      totalTime += this.getRetryDelay(i);
    }
    return totalTime;
  }
}

export default CharacterBuilderIntegrationTestBed;