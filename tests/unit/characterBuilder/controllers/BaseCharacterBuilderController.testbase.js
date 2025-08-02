/**
 * @file Test base class for BaseCharacterBuilderController testing
 * @description Extends existing test infrastructure for character builder controllers
 */

import { jest } from '@jest/globals';
import { BaseTestBed } from '../../../common/baseTestBed.js';
import { createMockLogger } from '../../../common/mockFactories/loggerMocks.js';
import { createEventBus } from '../../../common/mockFactories/eventBus.js';
import { BaseCharacterBuilderController } from '../../../../src/characterBuilder/controllers/BaseCharacterBuilderController.js';

/**
 * Test base class for character builder controllers
 * Extends the project's existing BaseTestBed pattern
 */
export class BaseCharacterBuilderControllerTestBase extends BaseTestBed {
  constructor() {
    super();
    this.controller = null;
    this.domElements = [];
  }

  /**
   * Setup before each test
   *
   * @returns {Promise<void>}
   */
  async setup() {
    await super.setup();

    // Setup DOM for UIStateManager
    this.setupDOM();

    // Create mocks using existing patterns
    this.initializeFromFactories({
      logger: createMockLogger,
      eventBus: createEventBus,
      characterBuilderService:
        this.createMockCharacterBuilderService.bind(this),
      schemaValidator: this.createMockSchemaValidator.bind(this),
    });

    // Store references for easy access
    this.mockDependencies = this.mocks;
  }

  /**
   * Cleanup after each test
   *
   * @returns {Promise<void>}
   */
  async cleanup() {
    // Destroy controller if exists
    if (this.controller && !this.controller.isDestroyed) {
      await this.controller.destroy();
    }

    // Cleanup DOM
    this.cleanupDOM();

    // Reset mocks
    this.resetMocks();

    // Clear references
    this.controller = null;
    await super.cleanup();
  }

  /**
   * Create controller instance - override in test classes
   *
   * @returns {BaseCharacterBuilderController}
   */
  createController() {
    throw new Error('Must override createController() in test class');
  }

  /**
   * Setup minimal DOM for UIStateManager
   */
  setupDOM() {
    const html = `
      <div id="test-container">
        <div id="empty-state" class="state-container"></div>
        <div id="loading-state" class="state-container" style="display: none;"></div>
        <div id="results-state" class="state-container" style="display: none;"></div>
        <div id="error-state" class="state-container" style="display: none;">
          <div class="error-message-text"></div>
        </div>
      </div>
    `;

    document.body.innerHTML = html;
    this.domElements.push(document.body.innerHTML);
  }

  /**
   * Cleanup DOM
   */
  cleanupDOM() {
    document.body.innerHTML = '';
    this.domElements = [];
  }

  /**
   * Add DOM element for testing
   *
   * @param {string} html - HTML to add
   * @returns {HTMLElement} Added element
   */
  addDOMElement(html) {
    const container = document.createElement('div');
    container.innerHTML = html;
    const element = container.firstElementChild;
    document.body.appendChild(element);
    this.domElements.push(element);
    return element;
  }

  /**
   * Create mock CharacterBuilderService
   *
   * @returns {object} Mock service
   */
  createMockCharacterBuilderService() {
    return {
      initialize: jest.fn().mockResolvedValue(undefined),
      getAllCharacterConcepts: jest.fn().mockResolvedValue([]),
      getCharacterConcept: jest.fn().mockResolvedValue(null),
      createCharacterConcept: jest.fn().mockResolvedValue({ id: 'new-id' }),
      updateCharacterConcept: jest.fn().mockResolvedValue({ id: 'updated-id' }),
      deleteCharacterConcept: jest.fn().mockResolvedValue(true),
      getThematicDirections: jest.fn().mockResolvedValue([]),
      generateThematicDirections: jest.fn().mockResolvedValue([]),
      getAllThematicDirectionsWithConcepts: jest.fn().mockResolvedValue([]),
      getOrphanedThematicDirections: jest.fn().mockResolvedValue([]),
      updateThematicDirection: jest
        .fn()
        .mockResolvedValue({ id: 'updated-direction' }),
      deleteThematicDirection: jest.fn().mockResolvedValue(true),
    };
  }

  /**
   * Create mock SchemaValidator
   *
   * @returns {object} Mock validator
   */
  createMockSchemaValidator() {
    return {
      validateAgainstSchema: jest.fn().mockReturnValue({
        isValid: true,
        errors: [],
      }),
      loadSchema: jest.fn().mockResolvedValue(true),
      hasSchema: jest.fn().mockReturnValue(true),
    };
  }
}

/**
 * Event simulation utilities for character builder UI
 */
export class EventSimulation {
  /**
   * Simulate click event
   *
   * @param {string} selector - Element selector
   */
  static click(selector) {
    const element = document.querySelector(selector);
    if (!element) throw new Error(`Element not found: ${selector}`);
    element.dispatchEvent(new MouseEvent('click', { bubbles: true }));
  }

  /**
   * Simulate form submission
   *
   * @param {string} selector - Form selector
   */
  static submitForm(selector) {
    const form = document.querySelector(selector);
    if (!form) throw new Error(`Form not found: ${selector}`);
    form.dispatchEvent(
      new Event('submit', { bubbles: true, cancelable: true })
    );
  }

  /**
   * Set input value and trigger input event
   *
   * @param {string} selector - Input selector
   * @param {string} value - Value to set
   */
  static setInputValue(selector, value) {
    const input = document.querySelector(selector);
    if (!input) throw new Error(`Input not found: ${selector}`);
    input.value = value;
    input.dispatchEvent(new Event('input', { bubbles: true }));
  }

  /**
   * Wait for async operations
   *
   * @param {number} [ms] - Milliseconds to wait
   * @returns {Promise}
   */
  static wait(ms = 0) {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }
}

// Add helper methods to test base
BaseCharacterBuilderControllerTestBase.prototype.click = function (selector) {
  EventSimulation.click(selector);
};

BaseCharacterBuilderControllerTestBase.prototype.submitForm = function (
  selector
) {
  EventSimulation.submitForm(selector);
};

BaseCharacterBuilderControllerTestBase.prototype.setInputValue = function (
  selector,
  value
) {
  EventSimulation.setInputValue(selector, value);
};

BaseCharacterBuilderControllerTestBase.prototype.wait = EventSimulation.wait;

/**
 * Assertion helpers for controller testing
 */
export class ControllerAssertions {
  /**
   * Assert controller is initialized
   *
   * @param {BaseCharacterBuilderController} controller
   */
  static assertInitialized(controller) {
    expect(controller.isInitialized).toBe(true);
    expect(controller.isDestroyed).toBe(false);
  }

  /**
   * Assert controller is destroyed
   *
   * @param {BaseCharacterBuilderController} controller
   */
  static assertDestroyed(controller) {
    expect(controller.isDestroyed).toBe(true);
    // Note: isInitialized remains true even after destruction in base controller
  }

  /**
   * Assert UI is in expected state
   *
   * @param {string} expectedState - One of: empty, loading, results, error
   */
  static assertUIState(expectedState) {
    const stateElement = document.getElementById(`${expectedState}-state`);
    expect(stateElement).toBeTruthy();
    expect(stateElement.style.display).not.toBe('none');
  }

  /**
   * Assert error message is displayed
   *
   * @param {string} expectedMessage
   */
  static assertErrorMessage(expectedMessage) {
    const errorText = document.querySelector('.error-message-text');
    expect(errorText).toBeTruthy();
    expect(errorText.textContent).toContain(expectedMessage);
  }
}

// Add assertion methods to test base
BaseCharacterBuilderControllerTestBase.prototype.assertInitialized =
  function () {
    ControllerAssertions.assertInitialized(this.controller);
  };

BaseCharacterBuilderControllerTestBase.prototype.assertDestroyed = function () {
  ControllerAssertions.assertDestroyed(this.controller);
};

BaseCharacterBuilderControllerTestBase.prototype.assertUIState = function (
  state
) {
  ControllerAssertions.assertUIState(state);
};

BaseCharacterBuilderControllerTestBase.prototype.assertErrorMessage = function (
  message
) {
  ControllerAssertions.assertErrorMessage(message);
};

/**
 * Test data builders for character builder tests
 */
export class TestDataBuilders {
  /**
   * Build character concept
   *
   * @param {object} [overrides]
   * @returns {object}
   */
  static buildCharacterConcept(overrides = {}) {
    return {
      id: `concept-${Date.now()}`,
      concept: 'A brave knight on a quest',
      createdAt: new Date().toISOString(),
      thematicDirections: [],
      ...overrides,
    };
  }

  /**
   * Build thematic direction
   *
   * @param {object} [overrides]
   * @returns {object}
   */
  static buildThematicDirection(overrides = {}) {
    return {
      id: `direction-${Date.now()}`,
      title: "The Hero's Journey",
      description: 'A classic tale of growth and adventure',
      themes: ['courage', 'growth', 'adventure'],
      characterConceptId: `concept-${Date.now()}`,
      ...overrides,
    };
  }

  /**
   * Build validation error
   *
   * @param {object} [overrides]
   * @returns {object}
   */
  static buildValidationError(overrides = {}) {
    return {
      instancePath: '/text',
      schemaPath: '#/properties/text/type',
      message: 'must be string',
      ...overrides,
    };
  }
}

// Add builder methods to test base
BaseCharacterBuilderControllerTestBase.prototype.buildCharacterConcept =
  TestDataBuilders.buildCharacterConcept;

BaseCharacterBuilderControllerTestBase.prototype.buildThematicDirection =
  TestDataBuilders.buildThematicDirection;

BaseCharacterBuilderControllerTestBase.prototype.buildValidationError =
  TestDataBuilders.buildValidationError;

/**
 * Concrete test controller for testing base class
 */
export class TestController extends BaseCharacterBuilderController {
  constructor(dependencies) {
    super(dependencies);
    this.methodCalls = [];
  }

  // Track method calls for testing
  _trackCall(method) {
    this.methodCalls.push({ method, timestamp: Date.now() });
  }

  // Required abstract methods
  _cacheElements() {
    this._trackCall('_cacheElements');
    this._cacheElementsFromMap({
      emptyState: '#empty-state',
      loadingState: '#loading-state',
      resultsState: '#results-state',
      errorState: '#error-state',
      errorMessageText: '.error-message-text',
    });
  }

  _setupEventListeners() {
    this._trackCall('_setupEventListeners');
  }

  // Override _showError to set the error message text for testing
  _showError(error, options = {}) {
    this._trackCall('_showError');
    const message = typeof error === 'string' ? error : error.message;

    // Show error state
    const errorState = document.getElementById('error-state');
    const errorText = document.querySelector('.error-message-text');

    if (errorState) {
      errorState.style.display = 'block';
    }
    if (errorText) {
      errorText.textContent = message;
    }

    // Hide other states
    ['empty-state', 'loading-state', 'results-state'].forEach((id) => {
      const element = document.getElementById(id);
      if (element) {
        element.style.display = 'none';
      }
    });
  }

  // Override _showResults to set UI state properly
  _showResults(data) {
    this._trackCall('_showResults');
    this._showState('results', { data });
  }

  // Override _showState to handle UI state changes
  _showState(state, options = {}) {
    this._trackCall('_showState');

    // Map state names to element IDs
    const states = ['empty', 'loading', 'results', 'error'];

    states.forEach((s) => {
      const element = document.getElementById(`${s}-state`);
      if (element) {
        element.style.display = s === state ? 'block' : 'none';
      }
    });
  }

  // Abstract destroy lifecycle methods
  _preDestroy() {
    this._trackCall('_preDestroy');
  }

  _postDestroy() {
    this._trackCall('_postDestroy');
  }

  _cancelCustomOperations() {
    this._trackCall('_cancelCustomOperations');
  }

  _cleanupCoreServices() {
    this._trackCall('_cleanupCoreServices');
  }

  _cleanupAdditionalServices() {
    this._trackCall('_cleanupAdditionalServices');
  }

  _clearCachedData() {
    this._trackCall('_clearCachedData');
  }

  // Optional lifecycle methods for testing
  async _preInitialize() {
    this._trackCall('_preInitialize');
  }

  async _initializeAdditionalServices() {
    this._trackCall('_initializeAdditionalServices');
  }

  async _loadInitialData() {
    this._trackCall('_loadInitialData');
  }

  async _postInitialize() {
    this._trackCall('_postInitialize');
  }

  // Test helpers
  wasMethodCalled(methodName) {
    return this.methodCalls.some((c) => c.method === methodName);
  }

  getCallOrder() {
    return this.methodCalls.map((c) => c.method);
  }
}
