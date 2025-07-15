/**
 * @file Shared test bed for anatomy visualizer components
 * @description Provides unified mock setup and utilities for anatomy visualizer tests
 */

import { jest } from '@jest/globals';
import { JSDOM } from 'jsdom';
import BaseTestBed from '../baseTestBed.js';
import { ENTITY_CREATED_ID } from '../../../src/constants/eventIds.js';

/**
 * Shared test bed for anatomy visualizer components
 * Provides unified mock setup and caching for better performance
 */
export class AnatomyVisualizerTestBed extends BaseTestBed {
  constructor() {
    super();
    this.#initializeMocks();
    this.#setupCachedDependencies();
  }

  /**
   * Initialize all mock dependencies used by anatomy visualizer tests
   * @private
   */
  #initializeMocks() {
    this.mocks = {
      mockVisualizerState: this.#createVisualizerStateMock(),
      mockAnatomyLoadingDetector: this.#createAnatomyLoadingDetectorMock(),
      mockEventDispatcher: this.#createEventDispatcherMock(),
      mockEntityManager: this.#createEntityManagerMock(),
      mockLogger: this.#createLoggerMock(),
    };

    // Assign mocks as direct properties for easier access
    Object.entries(this.mocks).forEach(([key, value]) => {
      this[key] = value;
    });
  }

  /**
   * Setup cached dependencies that can be reused across tests
   * @private
   */
  #setupCachedDependencies() {
    this.cachedModules = new Map();
    this.domCache = null;
    this.containerCache = null;
  }

  /**
   * Create mock for VisualizerState
   * @private
   */
  #createVisualizerStateMock() {
    return {
      getCurrentState: jest.fn(),
      getSelectedEntity: jest.fn(),
      getAnatomyData: jest.fn(),
      getError: jest.fn(),
      selectEntity: jest.fn(),
      setAnatomyData: jest.fn(),
      startRendering: jest.fn(),
      completeRendering: jest.fn(),
      setError: jest.fn(),
      reset: jest.fn(),
      retry: jest.fn(),
      subscribe: jest.fn(),
      dispose: jest.fn(),
    };
  }

  /**
   * Create mock for AnatomyLoadingDetector
   * @private
   */
  #createAnatomyLoadingDetectorMock() {
    return {
      waitForAnatomyReady: jest.fn(),
      waitForEntityCreation: jest.fn(),
      waitForEntityWithAnatomy: jest.fn(),
      dispose: jest.fn(),
    };
  }

  /**
   * Create mock for EventDispatcher
   * @private
   */
  #createEventDispatcherMock() {
    return {
      subscribe: jest.fn(),
      dispatch: jest.fn(),
      unsubscribe: jest.fn(),
    };
  }

  /**
   * Create mock for EntityManager
   * @private
   */
  #createEntityManagerMock() {
    return {
      getEntityInstance: jest.fn(),
      createEntityInstance: jest.fn(),
      addComponent: jest.fn(),
    };
  }

  /**
   * Create mock for Logger
   * @private
   */
  #createLoggerMock() {
    return {
      warn: jest.fn(),
      error: jest.fn(),
      debug: jest.fn(),
      info: jest.fn(),
    };
  }

  /**
   * Get or create DOM environment (cached for performance)
   * @returns {JSDOM} DOM instance
   */
  getDOMEnvironment() {
    if (!this.domCache) {
      this.domCache = new JSDOM('<!DOCTYPE html><html><body></body></html>', {
        url: 'http://localhost',
        pretendToBeVisual: true,
      });
    }
    return this.domCache;
  }

  /**
   * Setup global DOM environment
   */
  setupGlobalDOM() {
    const dom = this.getDOMEnvironment();
    global.window = dom.window;
    global.document = dom.window.document;
    global.navigator = dom.window.navigator;
  }

  /**
   * Cleanup global DOM environment
   */
  cleanupGlobalDOM() {
    if (this.domCache) {
      this.domCache.window.close();
      delete global.window;
      delete global.document;
      delete global.navigator;
    }
  }

  /**
   * Get cached module or load it
   * @param {string} modulePath - Path to the module
   * @returns {any} Module exports
   */
  getCachedModule(modulePath) {
    if (!this.cachedModules.has(modulePath)) {
      this.cachedModules.set(modulePath, require(modulePath));
    }
    return this.cachedModules.get(modulePath);
  }

  /**
   * Create a mock entity with anatomy data
   * @param {object} options - Configuration options
   * @returns {object} Mock entity instance
   */
  createMockEntityWithAnatomy(options = {}) {
    const {
      entityId = 'test:entity:123',
      recipeId = 'anatomy:human_male',
      hasValidAnatomy = true,
      anatomyData = null,
    } = options;

    const defaultAnatomyData = {
      recipeId,
      body: {
        root: 'test:root:123',
        parts: {
          'test:part1': 'entity1',
          'test:part2': 'entity2',
        },
      },
    };

    return {
      id: entityId,
      getComponentData: jest.fn().mockReturnValue(
        hasValidAnatomy ? (anatomyData || defaultAnatomyData) : null
      ),
    };
  }

  /**
   * Setup event subscription simulation
   * @param {string} entityId - Entity ID to simulate events for
   * @returns {function} Function to trigger the event
   */
  setupEventSubscription(entityId) {
    let eventHandler;
    const mockUnsubscribe = jest.fn();

    this.mockEventDispatcher.subscribe.mockImplementation((eventType, handler) => {
      if (eventType === ENTITY_CREATED_ID) {
        eventHandler = handler;
      }
      return mockUnsubscribe;
    });

    return () => {
      if (eventHandler) {
        eventHandler({
          type: ENTITY_CREATED_ID,
          payload: { instanceId: entityId },
        });
      }
    };
  }

  /**
   * Create parameterized test data for anatomy validation scenarios
   * @returns {Array} Array of test scenarios
   */
  getAnatomyValidationScenarios() {
    return [
      {
        name: 'should detect valid anatomy with all required fields',
        anatomyData: {
          recipeId: 'test:recipe',
          body: {
            root: 'test:root:123',
            parts: { 'test:part1': 'entity1' },
          },
        },
        expected: true,
      },
      {
        name: 'should reject null anatomy data',
        anatomyData: null,
        expected: false,
      },
      {
        name: 'should reject empty anatomy data',
        anatomyData: {},
        expected: false,
      },
      {
        name: 'should reject anatomy without body',
        anatomyData: { recipeId: 'test:recipe' },
        expected: false,
      },
      {
        name: 'should reject anatomy without root',
        anatomyData: {
          recipeId: 'test:recipe',
          body: { parts: { 'test:part1': 'entity1' } },
        },
        expected: false,
      },
      {
        name: 'should reject anatomy without parts',
        anatomyData: {
          recipeId: 'test:recipe',
          body: { root: 'test:root:123' },
        },
        expected: false,
      },
      {
        name: 'should reject anatomy with invalid root type',
        anatomyData: {
          recipeId: 'test:recipe',
          body: { root: null, parts: { 'test:part1': 'entity1' } },
        },
        expected: false,
      },
      {
        name: 'should reject anatomy with invalid parts type',
        anatomyData: {
          recipeId: 'test:recipe',
          body: { root: 'test:root:123', parts: 'invalid' },
        },
        expected: false,
      },
    ];
  }

  /**
   * Setup fake timers for testing timeout/retry logic
   */
  setupFakeTimers() {
    jest.useFakeTimers();
  }

  /**
   * Fast-forward time for timeout testing
   * @param {number} ms - Milliseconds to advance
   */
  advanceTime(ms) {
    jest.advanceTimersByTime(ms);
  }

  /**
   * Run a function with automatic timer cleanup
   * @param {function} fn - Function to run
   * @returns {Promise} Result of the function
   */
  async withFakeTimers(fn) {
    this.setupFakeTimers();
    try {
      return await fn();
    } finally {
      jest.useRealTimers();
    }
  }

  /**
   * Cleanup method override
   * @override
   */
  async cleanup() {
    this.cleanupGlobalDOM();
    this.cachedModules.clear();
    this.domCache = null;
    this.containerCache = null;
    await super.cleanup();
  }
}

export default AnatomyVisualizerTestBed;