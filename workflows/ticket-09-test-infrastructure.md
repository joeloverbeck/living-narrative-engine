# Ticket #9: Create Test Infrastructure

## Overview

Build comprehensive test infrastructure for the BaseCharacterBuilderController, including test helpers, mock factories, and a test base class that makes it easy to test both the base controller and its subclasses.

## Priority

**High** - Test infrastructure is critical for ensuring quality and enabling TDD for subclasses.

## Dependencies

- Tickets #1-8: All base controller functionality (completed)

## Estimated Effort

**2-3 hours**

## Acceptance Criteria

1. ✅ Test base class for easy controller testing
2. ✅ Mock factories for all dependencies
3. ✅ DOM setup utilities
4. ✅ Event simulation helpers
5. ✅ Assertion helpers for common checks
6. ✅ Test data builders
7. ✅ Coverage reporting setup
8. ✅ Integration with existing test patterns

## Implementation Details

### 1. Test Base Class

Create `tests/unit/characterBuilder/controllers/BaseCharacterBuilderController.testbase.js`:

```javascript
/**
 * @file Test base class for BaseCharacterBuilderController testing
 * @description Provides common setup, utilities, and helpers for testing controllers
 */

import {
  describe,
  it,
  expect,
  beforeEach,
  afterEach,
  jest,
} from '@jest/globals';
import { BaseCharacterBuilderController } from '../../../../src/characterBuilder/controllers/BaseCharacterBuilderController.js';

/**
 * Base test class for character builder controllers
 */
export class BaseCharacterBuilderControllerTestBase {
  constructor() {
    this.mockDependencies = null;
    this.controller = null;
    this.domCleanup = [];
  }

  /**
   * Setup test environment before each test
   */
  beforeEach() {
    // Setup mocks
    this.mockDependencies = this.createMockDependencies();

    // Setup DOM
    this.setupDOM();

    // Create controller instance
    this.controller = this.createController();
  }

  /**
   * Cleanup after each test
   */
  afterEach() {
    // Destroy controller
    if (this.controller && !this.controller.isDestroyed) {
      this.controller.destroy();
    }

    // Cleanup DOM
    this.cleanupDOM();

    // Clear all mocks
    jest.clearAllMocks();

    // Reset test state
    this.mockDependencies = null;
    this.controller = null;
  }

  /**
   * Create mock dependencies with sensible defaults
   * @returns {object} Mock dependencies
   */
  createMockDependencies() {
    return {
      logger: this.createMockLogger(),
      characterBuilderService: this.createMockCharacterBuilderService(),
      eventBus: this.createMockEventBus(),
      schemaValidator: this.createMockSchemaValidator(),
    };
  }

  /**
   * Create controller instance - override in test classes
   * @returns {BaseCharacterBuilderController}
   */
  createController() {
    throw new Error('Must override createController() in test class');
  }

  /**
   * Setup DOM elements for testing
   * @param {string} [html] - Custom HTML to use
   */
  setupDOM(html) {
    const defaultHTML = `
      <div id="test-container">
        <form id="test-form">
          <input id="test-input" type="text">
          <button id="submit-btn" type="submit">Submit</button>
          <button id="cancel-btn" type="button">Cancel</button>
        </form>
        
        <div id="empty-state" class="state-container">Empty State</div>
        <div id="loading-state" class="state-container" style="display: none;">
          <div class="spinner"></div>
          Loading...
        </div>
        <div id="results-state" class="state-container" style="display: none;">
          <div id="results-content"></div>
        </div>
        <div id="error-state" class="state-container" style="display: none;">
          <div class="error-message-text"></div>
          <button id="retry-btn">Retry</button>
        </div>
      </div>
    `;

    document.body.innerHTML = html || defaultHTML;

    // Track for cleanup
    this.domCleanup.push(() => {
      document.body.innerHTML = '';
    });
  }

  /**
   * Cleanup DOM after test
   */
  cleanupDOM() {
    this.domCleanup.forEach((cleanup) => cleanup());
    this.domCleanup = [];
    document.body.innerHTML = '';
  }

  /**
   * Add DOM element dynamically
   * @param {string} html - HTML to add
   * @returns {HTMLElement} Added element
   */
  addDOMElement(html) {
    const container = document.createElement('div');
    container.innerHTML = html;
    const element = container.firstElementChild;
    document.body.appendChild(element);

    // Track for cleanup
    this.domCleanup.push(() => element.remove());

    return element;
  }
}
```

### 2. Mock Factories

Continue in the same file:

```javascript
/**
 * Mock factory methods
 */
export class MockFactories {
  /**
   * Create mock logger
   * @returns {object} Mock logger
   */
  static createMockLogger() {
    return {
      debug: jest.fn(),
      info: jest.fn(),
      warn: jest.fn(),
      error: jest.fn(),
      _name: 'MockLogger',
    };
  }

  /**
   * Create mock character builder service
   * @param {object} [overrides] - Method overrides
   * @returns {object} Mock service
   */
  static createMockCharacterBuilderService(overrides = {}) {
    const defaults = {
      initialize: jest.fn().mockResolvedValue(undefined),
      getAllCharacterConcepts: jest.fn().mockResolvedValue([]),
      getCharacterConcept: jest.fn().mockResolvedValue(null),
      createCharacterConcept: jest.fn().mockResolvedValue({ id: 'new-id' }),
      updateCharacterConcept: jest.fn().mockResolvedValue({ id: 'updated-id' }),
      deleteCharacterConcept: jest.fn().mockResolvedValue(true),
      getThematicDirections: jest.fn().mockResolvedValue([]),
      generateThematicDirections: jest.fn().mockResolvedValue([]),
    };

    return {
      ...defaults,
      ...overrides,
      _name: 'MockCharacterBuilderService',
    };
  }

  /**
   * Create mock event bus
   * @param {object} [overrides] - Method overrides
   * @returns {object} Mock event bus
   */
  static createMockEventBus(overrides = {}) {
    const subscribers = new Map();

    const defaults = {
      dispatch: jest.fn((event, data) => {
        const handlers = subscribers.get(event) || [];
        handlers.forEach((handler) => handler(data));
      }),
      subscribe: jest.fn((event, handler) => {
        if (!subscribers.has(event)) {
          subscribers.set(event, []);
        }
        subscribers.get(event).push(handler);

        // Return unsubscribe function
        return () => {
          const handlers = subscribers.get(event) || [];
          const index = handlers.indexOf(handler);
          if (index > -1) {
            handlers.splice(index, 1);
          }
        };
      }),
      unsubscribe: jest.fn(),
      _subscribers: subscribers,
      _name: 'MockEventBus',
    };

    return {
      ...defaults,
      ...overrides,
    };
  }

  /**
   * Create mock schema validator
   * @param {object} [overrides] - Method overrides
   * @returns {object} Mock validator
   */
  static createMockSchemaValidator(overrides = {}) {
    const defaults = {
      validateAgainstSchema: jest.fn().mockReturnValue({
        isValid: true,
        errors: [],
      }),
      loadSchema: jest.fn().mockResolvedValue(true),
      hasSchema: jest.fn().mockReturnValue(true),
      _name: 'MockSchemaValidator',
    };

    return {
      ...defaults,
      ...overrides,
    };
  }

  /**
   * Create failing schema validator
   * @param {Array} errors - Validation errors
   * @returns {object} Mock validator that fails
   */
  static createFailingSchemaValidator(errors = ['Validation failed']) {
    return {
      ...this.createMockSchemaValidator(),
      validateAgainstSchema: jest.fn().mockReturnValue({
        isValid: false,
        errors,
      }),
    };
  }
}

// Add to BaseCharacterBuilderControllerTestBase
BaseCharacterBuilderControllerTestBase.prototype.createMockLogger =
  MockFactories.createMockLogger;
BaseCharacterBuilderControllerTestBase.prototype.createMockCharacterBuilderService =
  MockFactories.createMockCharacterBuilderService;
BaseCharacterBuilderControllerTestBase.prototype.createMockEventBus =
  MockFactories.createMockEventBus;
BaseCharacterBuilderControllerTestBase.prototype.createMockSchemaValidator =
  MockFactories.createMockSchemaValidator;
```

### 3. Event Simulation Helpers

```javascript
/**
 * Event simulation utilities
 */
export class EventSimulation {
  /**
   * Simulate click event
   * @param {HTMLElement|string} elementOrSelector - Element or selector
   * @param {object} [options] - Event options
   */
  static click(elementOrSelector, options = {}) {
    const element = this.getElement(elementOrSelector);
    const event = new MouseEvent('click', {
      bubbles: true,
      cancelable: true,
      ...options,
    });
    element.dispatchEvent(event);
  }

  /**
   * Simulate form submission
   * @param {HTMLElement|string} formOrSelector - Form element or selector
   * @param {object} [data] - Form data
   */
  static submitForm(formOrSelector, data = {}) {
    const form = this.getElement(formOrSelector);

    // Fill form data
    Object.entries(data).forEach(([name, value]) => {
      const input = form.querySelector(`[name="${name}"]`);
      if (input) {
        input.value = value;
      }
    });

    const event = new Event('submit', {
      bubbles: true,
      cancelable: true,
    });
    form.dispatchEvent(event);
  }

  /**
   * Simulate input event
   * @param {HTMLElement|string} inputOrSelector - Input element or selector
   * @param {string} value - Input value
   */
  static input(inputOrSelector, value) {
    const input = this.getElement(inputOrSelector);
    input.value = value;

    const event = new Event('input', {
      bubbles: true,
      cancelable: true,
    });
    input.dispatchEvent(event);
  }

  /**
   * Simulate keyboard event
   * @param {HTMLElement|string} elementOrSelector - Element or selector
   * @param {string} key - Key to press
   * @param {string} [type='keydown'] - Event type
   */
  static keyboard(elementOrSelector, key, type = 'keydown') {
    const element = this.getElement(elementOrSelector);
    const event = new KeyboardEvent(type, {
      key,
      bubbles: true,
      cancelable: true,
    });
    element.dispatchEvent(event);
  }

  /**
   * Get element from selector or element
   * @private
   */
  static getElement(elementOrSelector) {
    if (typeof elementOrSelector === 'string') {
      const element = document.querySelector(elementOrSelector);
      if (!element) {
        throw new Error(`Element not found: ${elementOrSelector}`);
      }
      return element;
    }
    return elementOrSelector;
  }

  /**
   * Wait for async operations
   * @param {number} [ms=0] - Milliseconds to wait
   * @returns {Promise}
   */
  static async wait(ms = 0) {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  /**
   * Wait for next tick
   * @returns {Promise}
   */
  static async nextTick() {
    return new Promise((resolve) => process.nextTick(resolve));
  }
}

// Add to test base
BaseCharacterBuilderControllerTestBase.prototype.click = EventSimulation.click;
BaseCharacterBuilderControllerTestBase.prototype.submitForm =
  EventSimulation.submitForm;
BaseCharacterBuilderControllerTestBase.prototype.input = EventSimulation.input;
BaseCharacterBuilderControllerTestBase.prototype.keyboard =
  EventSimulation.keyboard;
BaseCharacterBuilderControllerTestBase.prototype.wait = EventSimulation.wait;
BaseCharacterBuilderControllerTestBase.prototype.nextTick =
  EventSimulation.nextTick;
```

### 4. Assertion Helpers

```javascript
/**
 * Custom assertion helpers
 */
export class ControllerAssertions {
  /**
   * Assert controller is initialized
   * @param {BaseCharacterBuilderController} controller
   */
  static assertInitialized(controller) {
    expect(controller.isInitialized).toBe(true);
    expect(controller.isDestroyed).toBe(false);
  }

  /**
   * Assert controller is destroyed
   * @param {BaseCharacterBuilderController} controller
   */
  static assertDestroyed(controller) {
    expect(controller.isDestroyed).toBe(true);
    expect(controller.isInitialized).toBe(false);
  }

  /**
   * Assert UI state
   * @param {BaseCharacterBuilderController} controller
   * @param {string} expectedState
   */
  static assertUIState(controller, expectedState) {
    expect(controller.currentState).toBe(expectedState);

    // Check DOM state
    const stateElement = document.getElementById(`${expectedState}-state`);
    expect(stateElement?.style.display).not.toBe('none');
  }

  /**
   * Assert element is cached
   * @param {BaseCharacterBuilderController} controller
   * @param {string} key
   */
  static assertElementCached(controller, key) {
    const elements = controller.elements;
    expect(elements[key]).toBeTruthy();
    expect(elements[key]).toBeInstanceOf(HTMLElement);
  }

  /**
   * Assert event listener is registered
   * @param {BaseCharacterBuilderController} controller
   * @param {string} event
   * @param {HTMLElement|string} [element]
   */
  static assertEventListenerRegistered(controller, event, element) {
    const stats = controller._getEventListenerStats();
    expect(stats.total).toBeGreaterThan(0);

    if (element) {
      // More specific check would require exposing listener details
      expect(stats.dom).toBeGreaterThan(0);
    }
  }

  /**
   * Assert error was handled
   * @param {BaseCharacterBuilderController} controller
   * @param {object} mockLogger
   * @param {string} [errorMessage]
   */
  static assertErrorHandled(controller, mockLogger, errorMessage) {
    expect(mockLogger.error).toHaveBeenCalled();

    if (errorMessage) {
      const calls = mockLogger.error.mock.calls;
      const hasMessage = calls.some((call) =>
        call.some(
          (arg) => typeof arg === 'string' && arg.includes(errorMessage)
        )
      );
      expect(hasMessage).toBe(true);
    }
  }

  /**
   * Assert method was called with error handling
   * @param {Function} method
   * @param {string} operationName
   */
  static async assertErrorHandlingWorks(method, operationName) {
    const error = new Error('Test error');
    const failingOperation = jest.fn().mockRejectedValue(error);

    await expect(method(failingOperation, operationName)).rejects.toThrow(
      'Test error'
    );
  }
}

// Add assertion methods to test base
BaseCharacterBuilderControllerTestBase.prototype.assertInitialized = function (
  controller
) {
  ControllerAssertions.assertInitialized(controller || this.controller);
};
BaseCharacterBuilderControllerTestBase.prototype.assertDestroyed = function (
  controller
) {
  ControllerAssertions.assertDestroyed(controller || this.controller);
};
BaseCharacterBuilderControllerTestBase.prototype.assertUIState = function (
  state,
  controller
) {
  ControllerAssertions.assertUIState(controller || this.controller, state);
};
BaseCharacterBuilderControllerTestBase.prototype.assertElementCached =
  function (key, controller) {
    ControllerAssertions.assertElementCached(
      controller || this.controller,
      key
    );
  };
```

### 5. Test Data Builders

```javascript
/**
 * Test data builders
 */
export class TestDataBuilders {
  /**
   * Build character concept
   * @param {object} [overrides]
   * @returns {object}
   */
  static buildCharacterConcept(overrides = {}) {
    return {
      id: `concept-${Date.now()}`,
      text: 'A brave knight on a quest',
      createdAt: new Date().toISOString(),
      thematicDirections: [],
      ...overrides,
    };
  }

  /**
   * Build thematic direction
   * @param {object} [overrides]
   * @returns {object}
   */
  static buildThematicDirection(overrides = {}) {
    return {
      id: `direction-${Date.now()}`,
      title: "The Hero's Journey",
      description: 'A classic tale of growth and adventure',
      themes: ['courage', 'growth', 'adventure'],
      ...overrides,
    };
  }

  /**
   * Build validation error
   * @param {object} [overrides]
   * @returns {object}
   */
  static buildValidationError(overrides = {}) {
    return {
      instancePath: '/field',
      schemaPath: '#/properties/field/type',
      message: 'must be string',
      ...overrides,
    };
  }

  /**
   * Build form data
   * @param {object} [overrides]
   * @returns {object}
   */
  static buildFormData(overrides = {}) {
    return {
      name: 'Test Character',
      description: 'Test description',
      type: 'hero',
      ...overrides,
    };
  }
}

// Add to test base
BaseCharacterBuilderControllerTestBase.prototype.buildCharacterConcept =
  TestDataBuilders.buildCharacterConcept;
BaseCharacterBuilderControllerTestBase.prototype.buildThematicDirection =
  TestDataBuilders.buildThematicDirection;
BaseCharacterBuilderControllerTestBase.prototype.buildValidationError =
  TestDataBuilders.buildValidationError;
BaseCharacterBuilderControllerTestBase.prototype.buildFormData =
  TestDataBuilders.buildFormData;
```

### 6. Test Controller Implementation

```javascript
/**
 * Concrete test controller for testing base class
 */
export class TestController extends BaseCharacterBuilderController {
  constructor(dependencies) {
    super(dependencies);
    this.methodCalls = [];
    this._testData = null;
  }

  // Track method calls for testing
  _trackCall(method, args) {
    this.methodCalls.push({ method, args, timestamp: Date.now() });
  }

  // Implement required abstract methods
  _cacheElements() {
    this._trackCall('_cacheElements');

    this._cacheElementsFromMap({
      form: '#test-form',
      submitBtn: '#submit-btn',
      cancelBtn: { selector: '#cancel-btn', required: false },
      testInput: '#test-input',
      emptyState: '#empty-state',
      loadingState: '#loading-state',
      resultsState: '#results-state',
      errorState: '#error-state',
      errorMessageText: '.error-message-text',
    });
  }

  _setupEventListeners() {
    this._trackCall('_setupEventListeners');

    this._addEventListener('form', 'submit', (e) => {
      e.preventDefault();
      this._handleFormSubmit();
    });

    if (this._elements.cancelBtn) {
      this._addEventListener('cancelBtn', 'click', () => {
        this._handleCancel();
      });
    }
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
    this._testData = { loaded: true };
  }

  _initializeUIState() {
    this._trackCall('_initializeUIState');
    super._initializeUIState();
  }

  async _postInitialize() {
    this._trackCall('_postInitialize');
  }

  // Test methods
  _handleFormSubmit() {
    this._trackCall('_handleFormSubmit');
  }

  _handleCancel() {
    this._trackCall('_handleCancel');
  }

  // Helpers for testing
  getMethodCallCount(methodName) {
    return this.methodCalls.filter((c) => c.method === methodName).length;
  }

  wasMethodCalled(methodName) {
    return this.getMethodCallCount(methodName) > 0;
  }

  getCallOrder() {
    return this.methodCalls.map((c) => c.method);
  }
}
```

### 7. Integration Test Helpers

Create `tests/unit/characterBuilder/controllers/BaseCharacterBuilderController.integration.js`:

```javascript
/**
 * Integration test helpers for character builder controllers
 */

import { CharacterBuilderBootstrap } from '../../../../src/characterBuilder/CharacterBuilderBootstrap.js';
import { BaseCharacterBuilderControllerTestBase } from './BaseCharacterBuilderController.testbase.js';

export class ControllerIntegrationTestHelper extends BaseCharacterBuilderControllerTestBase {
  /**
   * Create controller with real bootstrap
   * @param {Function} ControllerClass
   * @param {object} [options]
   * @returns {Promise<object>}
   */
  async createWithBootstrap(ControllerClass, options = {}) {
    const bootstrap = new CharacterBuilderBootstrap();

    // Mock container resolution
    const mockContainer = {
      resolve: (token) => {
        switch (token.toString()) {
          case 'Symbol(ILogger)':
            return this.mockDependencies.logger;
          case 'Symbol(CharacterBuilderService)':
            return this.mockDependencies.characterBuilderService;
          case 'Symbol(ISafeEventDispatcher)':
            return this.mockDependencies.eventBus;
          case 'Symbol(ISchemaValidator)':
            return this.mockDependencies.schemaValidator;
          default:
            throw new Error(`Unknown token: ${token.toString()}`);
        }
      },
    };

    const result = await bootstrap.bootstrap({
      pageName: options.pageName || 'test-page',
      controllerClass: ControllerClass,
      container: mockContainer,
      ...options,
    });

    this.controller = result.controller;
    return result;
  }

  /**
   * Test controller lifecycle
   * @param {Function} ControllerClass
   */
  async testFullLifecycle(ControllerClass) {
    // Create and initialize
    const { controller } = await this.createWithBootstrap(ControllerClass);

    this.assertInitialized(controller);

    // Test operations
    await this.wait(10);

    // Destroy
    await controller.destroy();

    this.assertDestroyed(controller);
  }
}
```

### 8. Jest Configuration

Update or create `jest.config.js` to include coverage:

```javascript
// Add to existing jest.config.js
module.exports = {
  // ... existing config ...

  collectCoverageFrom: [
    'src/characterBuilder/controllers/**/*.js',
    '!src/**/*.test.js',
    '!src/**/*.testbase.js',
  ],

  coverageThreshold: {
    global: {
      branches: 80,
      functions: 90,
      lines: 90,
      statements: 90,
    },
  },

  coveragePathIgnorePatterns: ['/node_modules/', '/tests/'],
};
```

## Example Test Using Infrastructure

```javascript
import { describe, it, expect, beforeEach, afterEach } from '@jest/globals';
import {
  BaseCharacterBuilderControllerTestBase,
  TestController,
} from './BaseCharacterBuilderController.testbase.js';

describe('ExampleController', () => {
  const testBase = new BaseCharacterBuilderControllerTestBase();

  beforeEach(() => testBase.beforeEach());
  afterEach(() => testBase.afterEach());

  // Override controller creation
  testBase.createController = function () {
    return new TestController(this.mockDependencies);
  };

  it('should initialize successfully', async () => {
    await testBase.controller.initialize();

    testBase.assertInitialized();
    expect(testBase.controller.wasMethodCalled('_cacheElements')).toBe(true);
    expect(testBase.controller.wasMethodCalled('_setupEventListeners')).toBe(
      true
    );
  });

  it('should handle form submission', async () => {
    await testBase.controller.initialize();

    testBase.submitForm('#test-form', {
      name: 'Test',
    });

    expect(testBase.controller.wasMethodCalled('_handleFormSubmit')).toBe(true);
  });

  it('should show error state', async () => {
    await testBase.controller.initialize();

    testBase.controller._showError('Test error');

    testBase.assertUIState('error');
    expect(document.querySelector('.error-message-text').textContent).toBe(
      'Test error'
    );
  });
});
```

## Technical Considerations

### Test Isolation

- Each test gets fresh mocks and DOM
- No shared state between tests
- Proper cleanup after each test
- Mock implementations reset

### Performance

- Reuse mock factories
- Minimize DOM operations
- Use shallow rendering where possible
- Batch assertions

### Maintainability

- Centralized mock definitions
- Reusable test patterns
- Clear test structure
- Good error messages

## Testing Requirements

### Infrastructure Tests

1. **Mock Factories**
   - All mocks have required methods
   - Override functionality works
   - Event bus simulation works

2. **DOM Utilities**
   - Setup and cleanup work properly
   - Dynamic elements tracked
   - No DOM leaks between tests

3. **Event Simulation**
   - Events dispatch correctly
   - Form data populated
   - Async helpers work

4. **Assertions**
   - All assertions accurate
   - Good error messages
   - Work with test controller

## Definition of Done

- [ ] Test base class implemented
- [ ] All mock factories created
- [ ] Event simulation utilities working
- [ ] Assertion helpers comprehensive
- [ ] Test data builders complete
- [ ] Example tests provided
- [ ] Documentation complete
- [ ] Integration with existing test patterns

## Notes for Implementer

- Build on existing test patterns in the project
- Make tests easy to write and understand
- Provide good examples
- Consider future testing needs
- Ensure compatibility with Jest
- Keep test utilities performant
