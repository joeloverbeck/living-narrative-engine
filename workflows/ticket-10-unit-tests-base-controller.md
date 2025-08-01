# Ticket #10: Write Unit Tests for Base Controller

## Overview

Create comprehensive unit tests for the BaseCharacterBuilderController using the test infrastructure from ticket #9. Tests should cover all functionality implemented in tickets #1-8 with high coverage targets.

## Priority

**High** - Unit tests are essential for ensuring the base controller works correctly and preventing regressions.

## Dependencies

- Tickets #1-8: All base controller functionality (completed)
- Ticket #9: Test Infrastructure (completed)

## Estimated Effort

**3-4 hours**

## Acceptance Criteria

1. ✅ 90%+ code coverage for all methods
2. ✅ 80%+ branch coverage
3. ✅ All public methods tested
4. ✅ All protected methods tested
5. ✅ Error scenarios covered
6. ✅ Edge cases handled
7. ✅ Integration scenarios tested
8. ✅ Performance characteristics verified

## Test File Structure

### Main Test File

Create `tests/unit/characterBuilder/controllers/BaseCharacterBuilderController.test.js`:

```javascript
/**
 * @file Unit tests for BaseCharacterBuilderController
 * @description Comprehensive test coverage for base controller functionality
 */

import {
  describe,
  it,
  expect,
  beforeEach,
  afterEach,
  jest,
} from '@jest/globals';
import {
  BaseCharacterBuilderController,
  UI_STATES,
  ERROR_CATEGORIES,
} from '../../../../src/characterBuilder/controllers/BaseCharacterBuilderController.js';
import {
  BaseCharacterBuilderControllerTestBase,
  TestController,
  MockFactories,
  EventSimulation,
} from './BaseCharacterBuilderController.testbase.js';

describe('BaseCharacterBuilderController', () => {
  const testBase = new BaseCharacterBuilderControllerTestBase();

  beforeEach(() => {
    testBase.beforeEach();
    testBase.createController = function () {
      return new TestController(this.mockDependencies);
    };
  });

  afterEach(() => testBase.afterEach());

  // Test suites will be added here...
});
```

## Test Suites

### 1. Constructor and Dependency Validation Tests

```javascript
describe('Constructor and Dependencies', () => {
  it('should create instance with valid dependencies', () => {
    const controller = new TestController(testBase.mockDependencies);

    expect(controller).toBeInstanceOf(BaseCharacterBuilderController);
    expect(controller._logger).toBe(testBase.mockDependencies.logger);
    expect(controller._characterBuilderService).toBe(
      testBase.mockDependencies.characterBuilderService
    );
    expect(controller._eventBus).toBe(testBase.mockDependencies.eventBus);
    expect(controller._schemaValidator).toBe(
      testBase.mockDependencies.schemaValidator
    );
  });

  it('should throw error for missing logger', () => {
    const deps = { ...testBase.mockDependencies, logger: null };

    expect(() => new TestController(deps)).toThrow(
      "Missing required dependency 'logger'"
    );
  });

  it('should throw error for invalid logger interface', () => {
    const deps = {
      ...testBase.mockDependencies,
      logger: { info: jest.fn() }, // Missing required methods
    };

    expect(() => new TestController(deps)).toThrow('Invalid logger interface');
  });

  it('should validate all core dependencies', () => {
    const requiredDeps = [
      'characterBuilderService',
      'eventBus',
      'schemaValidator',
    ];

    requiredDeps.forEach((dep) => {
      const deps = { ...testBase.mockDependencies, [dep]: null };
      expect(() => new TestController(deps)).toThrow();
    });
  });

  it('should accept additional services', () => {
    const customService = { custom: jest.fn() };
    const deps = {
      ...testBase.mockDependencies,
      customService,
    };

    const controller = new TestController(deps);
    expect(controller._additionalServices.customService).toBe(customService);
  });

  it('should log successful initialization', () => {
    const controller = new TestController(testBase.mockDependencies);

    expect(testBase.mockDependencies.logger.info).toHaveBeenCalledWith(
      expect.stringContaining('Created with dependencies'),
      expect.any(Object)
    );
  });
});
```

### 2. Initialization Lifecycle Tests

```javascript
describe('Initialization Lifecycle', () => {
  it('should follow correct initialization sequence', async () => {
    const controller = testBase.controller;
    await controller.initialize();

    const callOrder = controller.getCallOrder();
    expect(callOrder).toEqual([
      '_preInitialize',
      '_cacheElements',
      '_initializeAdditionalServices',
      '_setupEventListeners',
      '_loadInitialData',
      '_initializeUIState',
      '_postInitialize',
    ]);

    expect(controller.isInitialized).toBe(true);
  });

  it('should prevent duplicate initialization', async () => {
    const controller = testBase.controller;
    await controller.initialize();

    // Clear method calls
    controller.methodCalls = [];

    // Try to initialize again
    await controller.initialize();

    expect(controller.methodCalls.length).toBe(0);
    expect(testBase.mockDependencies.logger.warn).toHaveBeenCalledWith(
      expect.stringContaining('Already initialized')
    );
  });

  it('should handle initialization errors gracefully', async () => {
    const controller = testBase.controller;

    // Make _cacheElements throw
    controller._cacheElements = jest.fn(() => {
      throw new Error('Element not found');
    });

    await expect(controller.initialize()).rejects.toThrow('Element not found');
    expect(controller.isInitialized).toBe(false);
    expect(controller._showError).toHaveBeenCalled();
  });

  it('should initialize character builder service', async () => {
    const controller = testBase.controller;
    await controller.initialize();

    expect(
      testBase.mockDependencies.characterBuilderService.initialize
    ).toHaveBeenCalled();
  });

  it('should dispatch initialization complete event', async () => {
    const controller = testBase.controller;
    await controller.initialize();

    expect(testBase.mockDependencies.eventBus.dispatch).toHaveBeenCalledWith(
      'CONTROLLER_INITIALIZED',
      expect.objectContaining({
        controllerName: 'TestController',
        initializationTime: expect.any(Number),
      })
    );
  });

  it('should measure initialization time', async () => {
    const controller = testBase.controller;
    await controller.initialize();

    const logCall = testBase.mockDependencies.logger.info.mock.calls.find(
      (call) => call[0].includes('Initialization completed')
    );

    expect(logCall).toBeTruthy();
    expect(logCall[0]).toMatch(/\d+\.\d+ms/);
  });

  it('should skip optional lifecycle methods if not implemented', async () => {
    class MinimalController extends BaseCharacterBuilderController {
      _cacheElements() {}
      _setupEventListeners() {}
    }

    const controller = new MinimalController(testBase.mockDependencies);
    await expect(controller.initialize()).resolves.not.toThrow();
  });
});
```

### 3. DOM Element Management Tests

```javascript
describe('DOM Element Management', () => {
  describe('_cacheElement', () => {
    it('should cache element by ID selector', () => {
      const controller = testBase.controller;
      const element = controller._cacheElement('testInput', '#test-input');

      expect(element).toBeInstanceOf(HTMLInputElement);
      expect(controller.elements.testInput).toBe(element);
    });

    it('should cache element by class selector', () => {
      document.body.innerHTML = '<div class="test-class"></div>';
      const controller = testBase.controller;
      const element = controller._cacheElement('testDiv', '.test-class');

      expect(element).toBeInstanceOf(HTMLDivElement);
    });

    it('should throw for missing required element', () => {
      const controller = testBase.controller;

      expect(() => controller._cacheElement('missing', '#not-found')).toThrow(
        "Required element with ID 'not-found' not found"
      );
    });

    it('should return null for missing optional element', () => {
      const controller = testBase.controller;
      const element = controller._cacheElement('optional', '#not-found', false);

      expect(element).toBeNull();
      expect(controller.elements.optional).toBeNull();
    });

    it('should validate cached elements', () => {
      const controller = testBase.controller;

      // Create a non-HTMLElement object
      const notAnElement = { fake: true };
      document.getElementById = jest.fn().mockReturnValue(notAnElement);

      expect(() => controller._cacheElement('invalid', '#fake')).toThrow(
        'not a valid HTMLElement'
      );
    });
  });

  describe('_cacheElementsFromMap', () => {
    it('should cache multiple elements from map', () => {
      const controller = testBase.controller;
      const result = controller._cacheElementsFromMap({
        form: '#test-form',
        input: '#test-input',
        submitBtn: '#submit-btn',
      });

      expect(result.stats.cached).toBe(3);
      expect(controller.elements.form).toBeInstanceOf(HTMLFormElement);
      expect(controller.elements.input).toBeInstanceOf(HTMLInputElement);
      expect(controller.elements.submitBtn).toBeInstanceOf(HTMLButtonElement);
    });

    it('should handle configuration objects', () => {
      const controller = testBase.controller;
      const result = controller._cacheElementsFromMap({
        required: { selector: '#test-form', required: true },
        optional: { selector: '#not-found', required: false },
      });

      expect(result.stats.cached).toBe(1);
      expect(result.stats.optional).toBe(1);
      expect(result.errors).toHaveLength(0);
    });

    it('should continue on optional element errors by default', () => {
      const controller = testBase.controller;
      const result = controller._cacheElementsFromMap({
        exists: '#test-form',
        missing: '#not-found',
      });

      expect(result.stats.cached).toBe(1);
      expect(result.stats.failed).toBe(1);
      expect(result.errors).toHaveLength(1);
    });

    it('should stop on first error when configured', () => {
      const controller = testBase.controller;

      expect(() =>
        controller._cacheElementsFromMap(
          {
            missing: '#not-found',
            exists: '#test-form',
          },
          { stopOnFirstError: true }
        )
      ).toThrow();
    });
  });

  describe('Element utilities', () => {
    beforeEach(async () => {
      await testBase.controller.initialize();
    });

    it('should get cached elements', () => {
      const form = testBase.controller._getElement('form');
      expect(form).toBeInstanceOf(HTMLFormElement);

      const missing = testBase.controller._getElement('notCached');
      expect(missing).toBeNull();
    });

    it('should check element availability', () => {
      expect(testBase.controller._hasElement('form')).toBe(true);
      expect(testBase.controller._hasElement('notCached')).toBe(false);
    });

    it('should show/hide elements', () => {
      const element = testBase.controller._getElement('emptyState');

      testBase.controller._hideElement('emptyState');
      expect(element.style.display).toBe('none');

      testBase.controller._showElement('emptyState');
      expect(element.style.display).toBe('block');
    });

    it('should toggle element visibility', () => {
      const element = testBase.controller._getElement('emptyState');
      element.style.display = 'block';

      testBase.controller._toggleElement('emptyState');
      expect(element.style.display).toBe('none');

      testBase.controller._toggleElement('emptyState', true);
      expect(element.style.display).toBe('block');
    });

    it('should enable/disable form controls', () => {
      const button = testBase.controller._getElement('submitBtn');

      testBase.controller._setElementEnabled('submitBtn', false);
      expect(button.disabled).toBe(true);

      testBase.controller._setElementEnabled('submitBtn', true);
      expect(button.disabled).toBe(false);
    });

    it('should set element text content', () => {
      const element = document.createElement('div');
      testBase.controller._elements.testDiv = element;

      testBase.controller._setElementText('testDiv', 'Hello World');
      expect(element.textContent).toBe('Hello World');
    });

    it('should manage CSS classes', () => {
      const element = testBase.controller._getElement('form');

      testBase.controller._addElementClass('form', 'active');
      expect(element.classList.contains('active')).toBe(true);

      testBase.controller._removeElementClass('form', 'active');
      expect(element.classList.contains('active')).toBe(false);
    });
  });
});
```

### 4. UI State Management Tests

```javascript
describe('UI State Management', () => {
  beforeEach(async () => {
    await testBase.controller.initialize();
  });

  it('should show correct state and hide others', () => {
    testBase.controller._showState(UI_STATES.LOADING);

    expect(document.getElementById('loading-state').style.display).toBe(
      'block'
    );
    expect(document.getElementById('empty-state').style.display).toBe('none');
    expect(document.getElementById('results-state').style.display).toBe('none');
    expect(document.getElementById('error-state').style.display).toBe('none');
  });

  it('should handle invalid states gracefully', () => {
    testBase.controller._showState('invalid-state');

    expect(testBase.mockDependencies.logger.warn).toHaveBeenCalledWith(
      expect.stringContaining("Invalid state 'invalid-state'")
    );
    expect(testBase.controller.currentState).toBe(UI_STATES.EMPTY);
  });

  it('should track state transitions', () => {
    testBase.controller._showState(UI_STATES.LOADING);
    testBase.controller._showState(UI_STATES.RESULTS);

    expect(testBase.mockDependencies.logger.debug).toHaveBeenCalledWith(
      expect.stringContaining('State transition: loading → results')
    );
  });

  it('should dispatch state change events', () => {
    testBase.controller._showState(UI_STATES.ERROR);

    expect(testBase.mockDependencies.eventBus.dispatch).toHaveBeenCalledWith(
      'UI_STATE_CHANGED',
      expect.objectContaining({
        controller: 'TestController',
        previousState: UI_STATES.EMPTY,
        currentState: UI_STATES.ERROR,
      })
    );
  });

  it('should setup error state with message', () => {
    testBase.controller._showError('Test error message');

    const errorText = document.querySelector('.error-message-text');
    expect(errorText.textContent).toBe('Test error message');
    expect(testBase.controller.currentState).toBe(UI_STATES.ERROR);
  });

  it('should handle Error objects in _showError', () => {
    const error = new Error('Error object message');
    testBase.controller._showError(error);

    const errorText = document.querySelector('.error-message-text');
    expect(errorText.textContent).toBe('Error object message');
  });

  it('should disable form controls in loading state', () => {
    const button = testBase.controller._getElement('submitBtn');

    testBase.controller._showLoading();
    expect(button.disabled).toBe(true);

    testBase.controller._showResults({});
    expect(button.disabled).toBe(false);
  });

  it('should check current state', () => {
    testBase.controller._showState(UI_STATES.RESULTS);

    expect(testBase.controller._isInState(UI_STATES.RESULTS)).toBe(true);
    expect(testBase.controller._isInState(UI_STATES.LOADING)).toBe(false);
  });
});
```

### 5. Event Handling Tests

```javascript
describe('Event Handling', () => {
  beforeEach(async () => {
    await testBase.controller.initialize();
  });

  describe('DOM Events', () => {
    it('should add event listener with element key', () => {
      const handler = jest.fn();
      const listenerId = testBase.controller._addEventListener(
        'submitBtn',
        'click',
        handler
      );

      expect(listenerId).toMatch(/^listener-\d+$/);

      // Trigger event
      testBase.controller._getElement('submitBtn').click();
      expect(handler).toHaveBeenCalledWith(expect.any(Event));
    });

    it('should add event listener with element reference', () => {
      const element = document.getElementById('submit-btn');
      const handler = jest.fn();

      testBase.controller._addEventListener(element, 'click', handler);

      element.click();
      expect(handler).toHaveBeenCalled();
    });

    it('should handle missing elements gracefully', () => {
      const handler = jest.fn();
      const listenerId = testBase.controller._addEventListener(
        'nonExistent',
        'click',
        handler
      );

      expect(listenerId).toBeNull();
      expect(testBase.mockDependencies.logger.warn).toHaveBeenCalledWith(
        expect.stringContaining("element 'nonExistent' not found")
      );
    });

    it('should support event listener options', () => {
      const handler = jest.fn();
      const element = testBase.controller._getElement('form');

      testBase.controller._addEventListener('form', 'submit', handler, {
        capture: true,
        once: true,
        passive: false,
      });

      // Verify once option works
      element.dispatchEvent(new Event('submit'));
      element.dispatchEvent(new Event('submit'));

      expect(handler).toHaveBeenCalledTimes(1);
    });
  });

  describe('Event Bus', () => {
    it('should subscribe to application events', () => {
      const handler = jest.fn();
      const subId = testBase.controller._subscribeToEvent(
        'TEST_EVENT',
        handler
      );

      expect(subId).toMatch(/^sub-\d+$/);

      // Dispatch event
      testBase.mockDependencies.eventBus.dispatch('TEST_EVENT', {
        data: 'test',
      });
      expect(handler).toHaveBeenCalledWith({ data: 'test' });
    });

    it('should handle missing eventBus gracefully', () => {
      testBase.controller._eventBus = null;
      const handler = jest.fn();

      const subId = testBase.controller._subscribeToEvent('TEST', handler);

      expect(subId).toBeNull();
      expect(testBase.mockDependencies.logger.warn).toHaveBeenCalled();
    });
  });

  describe('Event Delegation', () => {
    it('should handle delegated events', () => {
      // Add dynamic content
      const container = testBase.controller._getElement('resultsState');
      container.innerHTML =
        '<button class="delete-btn" data-id="123">Delete</button>';

      const handler = jest.fn();
      testBase.controller._addDelegatedListener(
        'resultsState',
        '.delete-btn',
        'click',
        handler
      );

      // Click the dynamic button
      container.querySelector('.delete-btn').click();

      expect(handler).toHaveBeenCalledWith(
        expect.any(Event),
        expect.objectContaining({ className: 'delete-btn' })
      );
    });
  });

  describe('Debounce and Throttle', () => {
    it('should debounce event handlers', async () => {
      const handler = jest.fn();
      testBase.controller._addDebouncedListener(
        'testInput',
        'input',
        handler,
        100
      );

      const input = testBase.controller._getElement('testInput');

      // Rapid events
      EventSimulation.input(input, 'a');
      EventSimulation.input(input, 'ab');
      EventSimulation.input(input, 'abc');

      expect(handler).not.toHaveBeenCalled();

      // Wait for debounce
      await EventSimulation.wait(150);

      expect(handler).toHaveBeenCalledTimes(1);
    });

    it('should throttle event handlers', async () => {
      const handler = jest.fn();
      testBase.controller._addThrottledListener(window, 'scroll', handler, 100);

      // Rapid events
      for (let i = 0; i < 5; i++) {
        window.dispatchEvent(new Event('scroll'));
        await EventSimulation.wait(30);
      }

      // Should be called immediately and then throttled
      expect(handler).toHaveBeenCalledTimes(1);

      // Wait for throttle period
      await EventSimulation.wait(100);
      window.dispatchEvent(new Event('scroll'));

      expect(handler).toHaveBeenCalledTimes(2);
    });
  });

  describe('Event Cleanup', () => {
    it('should remove specific event listener', () => {
      const handler = jest.fn();
      const listenerId = testBase.controller._addEventListener(
        'submitBtn',
        'click',
        handler
      );

      // Remove listener
      const removed = testBase.controller._removeEventListener(listenerId);
      expect(removed).toBe(true);

      // Should not trigger
      testBase.controller._getElement('submitBtn').click();
      expect(handler).not.toHaveBeenCalled();
    });

    it('should remove all event listeners', () => {
      // Add multiple listeners
      testBase.controller._addEventListener('submitBtn', 'click', jest.fn());
      testBase.controller._addEventListener('form', 'submit', jest.fn());
      testBase.controller._subscribeToEvent('TEST', jest.fn());

      const stats = testBase.controller._getEventListenerStats();
      expect(stats.total).toBeGreaterThan(0);

      // Remove all
      testBase.controller._removeAllEventListeners();

      const newStats = testBase.controller._getEventListenerStats();
      expect(newStats.total).toBe(0);
    });
  });
});
```

### 6. Error Handling Tests

```javascript
describe('Error Handling', () => {
  beforeEach(async () => {
    await testBase.controller.initialize();
  });

  describe('Error categorization', () => {
    it('should categorize validation errors', () => {
      const error = new Error('Invalid input validation failed');
      const details = testBase.controller._handleError(error);

      expect(details.category).toBe(ERROR_CATEGORIES.VALIDATION);
    });

    it('should categorize network errors', () => {
      const error = new Error('Network request failed');
      const details = testBase.controller._handleError(error);

      expect(details.category).toBe(ERROR_CATEGORIES.NETWORK);
    });

    it('should use provided category', () => {
      const error = new Error('Some error');
      const details = testBase.controller._handleError(error, {
        category: ERROR_CATEGORIES.PERMISSION,
      });

      expect(details.category).toBe(ERROR_CATEGORIES.PERMISSION);
    });
  });

  describe('User messages', () => {
    it('should generate appropriate user messages', () => {
      const cases = [
        {
          error: new Error('validation error'),
          expected: 'Please check your input and try again.',
        },
        {
          error: new Error('network timeout'),
          expected:
            'Connection error. Please check your internet and try again.',
        },
        {
          error: new Error('permission denied'),
          expected: "You don't have permission to perform this action.",
        },
      ];

      cases.forEach(({ error, expected }) => {
        const details = testBase.controller._handleError(error, {
          showToUser: false, // Don't show in UI
        });
        expect(details.userMessage).toBe(expected);
      });
    });

    it('should use custom user message', () => {
      const error = new Error('Technical error');
      const details = testBase.controller._handleError(error, {
        userMessage: 'Custom message for user',
      });

      expect(details.userMessage).toBe('Custom message for user');
    });
  });

  describe('Service error handling', () => {
    it('should execute operation with error handling', async () => {
      const operation = jest.fn().mockResolvedValue('success');

      const result = await testBase.controller._executeWithErrorHandling(
        operation,
        'testOperation'
      );

      expect(result).toBe('success');
      expect(operation).toHaveBeenCalled();
    });

    it('should retry transient failures', async () => {
      let attempts = 0;
      const operation = jest.fn(async () => {
        attempts++;
        if (attempts < 3) {
          throw new Error('Network timeout');
        }
        return 'success';
      });

      const result = await testBase.controller._executeWithErrorHandling(
        operation,
        'retryableOperation',
        { retries: 3, retryDelay: 10 }
      );

      expect(result).toBe('success');
      expect(attempts).toBe(3);
    });

    it('should fail after max retries', async () => {
      const operation = jest
        .fn()
        .mockRejectedValue(new Error('Persistent error'));

      await expect(
        testBase.controller._executeWithErrorHandling(
          operation,
          'failingOperation',
          { retries: 2, retryDelay: 10 }
        )
      ).rejects.toThrow('Persistent error');

      expect(operation).toHaveBeenCalledTimes(3); // Initial + 2 retries
    });
  });

  describe('Validation errors', () => {
    it('should format validation errors correctly', () => {
      const errors = [
        { instancePath: '/name', message: 'must be string' },
        { instancePath: '/age', message: 'must be number' },
        'Custom error message',
      ];

      const formatted = testBase.controller._formatValidationErrors(errors);

      expect(formatted).toEqual([
        'name: must be string',
        'age: must be number',
        'Custom error message',
      ]);
    });

    it('should validate data against schema', () => {
      const data = { name: 'Test' };
      const result = testBase.controller._validateData(data, 'test-schema');

      expect(result.isValid).toBe(true);
    });

    it('should handle validation failures', () => {
      testBase.mockDependencies.schemaValidator.validateAgainstSchema.mockReturnValue(
        {
          isValid: false,
          errors: [{ instancePath: '/name', message: 'required' }],
        }
      );

      const result = testBase.controller._validateData({}, 'test-schema');

      expect(result.isValid).toBe(false);
      expect(result.errorMessage).toContain('name: required');
    });
  });
});
```

### 7. Resource Cleanup Tests

```javascript
describe('Resource Cleanup and Lifecycle', () => {
  it('should destroy uninitialized controller', async () => {
    const controller = new TestController(testBase.mockDependencies);

    await expect(controller.destroy()).resolves.not.toThrow();
    expect(controller.isDestroyed).toBe(true);
  });

  it('should destroy initialized controller', async () => {
    const controller = testBase.controller;
    await controller.initialize();

    // Add some listeners and timers
    controller._addEventListener('submitBtn', 'click', jest.fn());
    const timerId = controller._setTimeout(jest.fn(), 1000);

    await controller.destroy();

    expect(controller.isDestroyed).toBe(true);
    expect(controller.isInitialized).toBe(false);
    expect(controller._eventListeners.length).toBe(0);
  });

  it('should prevent duplicate destruction', async () => {
    const controller = testBase.controller;
    await controller.destroy();

    // Clear logs
    testBase.mockDependencies.logger.warn.mockClear();

    // Try to destroy again
    await controller.destroy();

    expect(testBase.mockDependencies.logger.warn).toHaveBeenCalledWith(
      expect.stringContaining('Already destroyed')
    );
  });

  it('should clean up timers', () => {
    jest.useFakeTimers();
    const controller = testBase.controller;

    const callback = jest.fn();
    const timerId = controller._setTimeout(callback, 1000);

    // Destroy before timer fires
    controller.destroy();

    jest.advanceTimersByTime(1500);
    expect(callback).not.toHaveBeenCalled();

    jest.useRealTimers();
  });

  it('should clean up intervals', () => {
    jest.useFakeTimers();
    const controller = testBase.controller;

    const callback = jest.fn();
    const intervalId = controller._setInterval(callback, 100);

    jest.advanceTimersByTime(250);
    expect(callback).toHaveBeenCalledTimes(2);

    controller.destroy();
    callback.mockClear();

    jest.advanceTimersByTime(200);
    expect(callback).not.toHaveBeenCalled();

    jest.useRealTimers();
  });

  it('should execute cleanup tasks in reverse order', async () => {
    const controller = testBase.controller;
    const order = [];

    controller._registerCleanupTask(() => order.push('task1'), 'Task 1');
    controller._registerCleanupTask(() => order.push('task2'), 'Task 2');
    controller._registerCleanupTask(() => order.push('task3'), 'Task 3');

    await controller.destroy();

    expect(order).toEqual(['task3', 'task2', 'task1']);
  });

  it('should handle cleanup task errors', async () => {
    const controller = testBase.controller;

    controller._registerCleanupTask(() => {
      throw new Error('Cleanup failed');
    }, 'Failing task');

    controller._registerCleanupTask(() => {
      // This should still run
    }, 'Success task');

    await expect(controller.destroy()).resolves.not.toThrow();
    expect(controller.isDestroyed).toBe(true);
  });

  it('should prevent operations on destroyed controller', async () => {
    const controller = testBase.controller;
    await controller.destroy();

    expect(() => controller._checkDestroyed('testOperation')).toThrow(
      "Cannot perform 'testOperation' on destroyed controller"
    );
  });

  it('should clear all references', async () => {
    const controller = testBase.controller;
    await controller.initialize();
    await controller.destroy();

    expect(controller._characterBuilderService).toBeNull();
    expect(controller._eventBus).toBeNull();
    expect(controller._schemaValidator).toBeNull();
    expect(controller._additionalServices).toEqual({});
    expect(controller._elements).toEqual({});
  });
});
```

### 8. Performance Tests

```javascript
describe('Performance', () => {
  it('should initialize within reasonable time', async () => {
    const startTime = performance.now();
    await testBase.controller.initialize();
    const duration = performance.now() - startTime;

    expect(duration).toBeLessThan(100); // Should init in < 100ms
  });

  it('should cache elements efficiently', () => {
    const controller = testBase.controller;
    const startTime = performance.now();

    // Cache many elements
    for (let i = 0; i < 50; i++) {
      const elem = document.createElement('div');
      elem.id = `test-elem-${i}`;
      document.body.appendChild(elem);
      controller._cacheElement(`elem${i}`, `#test-elem-${i}`);
    }

    const duration = performance.now() - startTime;
    expect(duration).toBeLessThan(50); // Should be fast
  });

  it('should validate dependencies quickly', () => {
    const startTime = performance.now();

    // Create multiple controllers
    for (let i = 0; i < 10; i++) {
      new TestController(testBase.mockDependencies);
    }

    const duration = performance.now() - startTime;
    expect(duration).toBeLessThan(50); // < 5ms per controller
  });
});
```

### 9. Integration Tests

```javascript
describe('Integration Scenarios', () => {
  it('should work with real event flow', async () => {
    const controller = testBase.controller;
    await controller.initialize();

    // Simulate user interaction
    testBase.controller._showState(UI_STATES.EMPTY);

    // User fills form
    EventSimulation.input('#test-input', 'Test Value');

    // User submits
    EventSimulation.submitForm('#test-form');

    expect(controller.wasMethodCalled('_handleFormSubmit')).toBe(true);
  });

  it('should handle error recovery flow', async () => {
    const controller = testBase.controller;
    await controller.initialize();

    // Simulate service failure
    const error = new Error('Service unavailable');
    controller._handleServiceError(error, 'loadData', 'Failed to load data');

    expect(controller.currentState).toBe(UI_STATES.ERROR);

    // User clicks retry
    const retryBtn = document.getElementById('retry-btn');
    if (retryBtn) {
      retryBtn.click();
      // Would trigger retry logic in real implementation
    }
  });

  it('should maintain state across operations', async () => {
    const controller = testBase.controller;
    await controller.initialize();

    // Perform multiple operations
    controller._showLoading();
    expect(controller.currentState).toBe(UI_STATES.LOADING);

    // Simulate data load
    await EventSimulation.wait(10);
    controller._showResults({ data: 'test' });
    expect(controller.currentState).toBe(UI_STATES.RESULTS);

    // Error occurs
    controller._showError('Something went wrong');
    expect(controller.currentState).toBe(UI_STATES.ERROR);
  });
});
```

## Test Coverage Report Setup

Add to `package.json`:

```json
{
  "scripts": {
    "test:base-controller": "jest tests/unit/characterBuilder/controllers/BaseCharacterBuilderController.test.js --coverage",
    "test:base-controller:watch": "jest tests/unit/characterBuilder/controllers/BaseCharacterBuilderController.test.js --watch"
  }
}
```

## Definition of Done

- [ ] All test suites implemented
- [ ] 90%+ statement coverage achieved
- [ ] 90%+ function coverage achieved
- [ ] 80%+ branch coverage achieved
- [ ] All tests passing
- [ ] Performance benchmarks met
- [ ] Edge cases covered
- [ ] Integration scenarios tested

## Notes for Implementer

- Run tests frequently during development
- Use coverage reports to find untested code
- Add tests for any bugs found
- Keep tests focused and fast
- Use descriptive test names
- Mock external dependencies properly
- Test both success and failure paths
