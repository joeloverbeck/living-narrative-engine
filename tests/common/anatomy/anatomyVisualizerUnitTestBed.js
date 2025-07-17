/**
 * @file Lightweight test bed for anatomy visualizer unit tests (no DOM)
 * @description Provides mock setup without JSDOM for faster unit test execution
 */

import { jest } from '@jest/globals';
import BaseTestBed from '../baseTestBed.js';
import { ENTITY_CREATED_ID } from '../../../src/constants/eventIds.js';

/**
 * Lightweight test bed for anatomy visualizer unit tests
 * Provides mock setup without DOM dependencies for better performance
 */
export class AnatomyVisualizerUnitTestBed extends BaseTestBed {
  constructor() {
    super();
    this.#initializeMocks();
  }

  /**
   * Initialize all mock dependencies used by anatomy visualizer tests
   *
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
   * Create mock for VisualizerState
   *
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
   *
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
   *
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
   *
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
   *
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
   * Create a mock entity with anatomy data
   *
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
      getComponentData: jest
        .fn()
        .mockReturnValue(
          hasValidAnatomy ? anatomyData || defaultAnatomyData : null
        ),
    };
  }

  /**
   * Setup event subscription simulation
   *
   * @param {string} entityId - Entity ID to simulate events for
   * @returns {Function} Function to trigger the event
   */
  setupEventSubscription(entityId) {
    let eventHandler;
    const mockUnsubscribe = jest.fn();

    this.mockEventDispatcher.subscribe.mockImplementation(
      (eventType, handler) => {
        if (eventType === ENTITY_CREATED_ID) {
          eventHandler = handler;
        }
        return mockUnsubscribe;
      }
    );

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
   *
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
   *
   * @param {number} ms - Milliseconds to advance
   */
  advanceTime(ms) {
    jest.advanceTimersByTime(ms);
  }

  /**
   * Run a function with automatic timer cleanup
   *
   * @param {Function} fn - Function to run
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
   *
   * @override
   */
  async cleanup() {
    await super.cleanup();
  }
}

export default AnatomyVisualizerUnitTestBed;
