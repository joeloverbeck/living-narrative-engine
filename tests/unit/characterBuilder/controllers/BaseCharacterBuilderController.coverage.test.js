/**
 * @file Additional coverage tests for BaseCharacterBuilderController
 * @see src/characterBuilder/controllers/BaseCharacterBuilderController.js
 *
 * This file contains tests specifically targeting uncovered lines to improve branch coverage
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
  ERROR_CATEGORIES,
  ERROR_SEVERITY,
} from '../../../../src/characterBuilder/controllers/BaseCharacterBuilderController.js';
import { CHARACTER_BUILDER_EVENTS } from '../../../../src/characterBuilder/services/characterBuilderService.js';
import { InvalidDependencyError } from '../../../../src/errors/dependencyErrors.js';

// Mock UIStateManager at module level
let mockUIStateManagerInstance = null;

jest.mock('../../../../src/shared/characterBuilder/uiStateManager.js', () => {
  const originalModule = jest.requireActual(
    '../../../../src/shared/characterBuilder/uiStateManager.js'
  );
  return {
    ...originalModule,
    UIStateManager: jest.fn().mockImplementation(() => {
      mockUIStateManagerInstance = {
        showState: jest.fn(),
        showError: jest.fn(),
        showLoading: jest.fn(),
        getCurrentState: jest.fn().mockReturnValue('empty'),
      };
      return mockUIStateManagerInstance;
    }),
  };
});

// Helper to get the current mock instance
const getMockUIStateManager = () => mockUIStateManagerInstance;

// Define UI states for testing
const UI_STATES = {
  LOADING: 'loading',
  READY: 'ready',
  ERROR: 'error',
};

// Enhanced test controller with exposed private methods for testing
class TestControllerWithPrivates extends BaseCharacterBuilderController {
  static _testValidationRules = {};

  _cacheElements() {
    // Test implementation
  }

  _setupEventListeners() {
    // Test implementation
  }

  // Store additional services for testing
  constructor(dependencies, validationRules) {
    // Store validation rules on the class before super
    if (validationRules) {
      TestControllerWithPrivates._testValidationRules = validationRules;
    }

    super(dependencies);

    // Store additional services for testing access
    this._testAdditionalServices = {};
    Object.keys(dependencies).forEach((key) => {
      if (
        ![
          'logger',
          'characterBuilderService',
          'eventBus',
          'schemaValidator',
        ].includes(key)
      ) {
        this._testAdditionalServices[key] = dependencies[key];
      }
    });

    // Also store on instance for access
    this._instanceValidationRules = validationRules || {};
  }

  // Override to provide validation rules for testing
  _getAdditionalServiceValidationRules() {
    return TestControllerWithPrivates._testValidationRules;
  }

  // Expose private methods for testing
  testHasService(serviceName) {
    return this._testAdditionalServices[serviceName] !== undefined;
  }

  testGetService(serviceName) {
    return this._testAdditionalServices[serviceName];
  }

  // Method for testing optional method handling
  async _optionalMethod() {
    // This is an optional method
  }

  // Override to test error display fallback
  _showState(state, data) {
    this._showStateCallCount = (this._showStateCallCount || 0) + 1;
    this._lastShowStateCall = { state, data };

    // Also call parent to trigger real logic for testing
    try {
      super._showState(state, data);
    } catch (error) {
      // Expected if UIStateManager not initialized properly
      this._stateError = error;
    }
  }

  // Override _getElement to provide mock elements for UIStateManager initialization
  _getElement(key) {
    // Create mock DOM elements for state manager initialization
    const mockElement = {
      tagName: key === 'characterForm' ? 'FORM' : 'DIV',
      id: `mock-${key}`,
      style: {},
      classList: {
        add: jest.fn(),
        remove: jest.fn(),
        contains: jest.fn(),
      },
      // Add querySelectorAll for form elements
      querySelectorAll: jest.fn().mockReturnValue([]),
      querySelector: jest.fn().mockReturnValue(null),
      // Add common DOM methods
      setAttribute: jest.fn(),
      getAttribute: jest.fn(),
      removeAttribute: jest.fn(),
      addEventListener: jest.fn(),
      removeEventListener: jest.fn(),
    };

    // Store mock elements for later access if needed
    this._mockElements = this._mockElements || {};
    this._mockElements[key] = mockElement;

    return mockElement;
  }

  // Public getter for testing
  get additionalServices() {
    return this._testAdditionalServices || {};
  }
}

// Test controller without optional methods
class MinimalTestController extends BaseCharacterBuilderController {
  _cacheElements() {
    // Required implementation
  }

  _setupEventListeners() {
    // Required implementation
  }

  // No optional methods implemented
}

describe('BaseCharacterBuilderController - Coverage Tests', () => {
  let mockLogger;
  let mockCharacterBuilderService;
  let mockEventBus;
  let mockSchemaValidator;
  let controller;

  beforeEach(() => {
    // Reset all mocks
    jest.clearAllMocks();
    jest.useFakeTimers();

    // Create standard mocks
    mockLogger = {
      debug: jest.fn(),
      info: jest.fn(),
      warn: jest.fn(),
      error: jest.fn(),
    };

    mockCharacterBuilderService = {
      initialize: jest.fn().mockResolvedValue(),
      getAllCharacterConcepts: jest.fn(),
      createCharacterConcept: jest.fn(),
      updateCharacterConcept: jest.fn(),
      deleteCharacterConcept: jest.fn(),
      getCharacterConcept: jest.fn(),
      generateThematicDirections: jest.fn(),
      getThematicDirections: jest.fn(),
    };

    mockEventBus = {
      dispatch: jest.fn(),
      subscribe: jest.fn().mockImplementation(() => jest.fn()),
      unsubscribe: jest.fn(),
    };

    mockSchemaValidator = {
      validateAgainstSchema: jest.fn(),
      validate: jest.fn().mockReturnValue({ isValid: true, errors: null }),
    };
  });

  afterEach(() => {
    jest.clearAllTimers();
    jest.useRealTimers();
    if (controller && typeof controller.destroy === 'function') {
      controller.destroy();
    }
  });

  describe('Additional Service Validation Errors (lines 315-326)', () => {
    it('should handle validation error for additional service with validation rules', () => {
      // Create a mock service that will fail validation
      const mockInvalidService = {
        someMethod: 'not a function', // Invalid - should be a function
      };

      // Define validation rules that will cause the service to fail
      const validationRules = {
        customService: {
          requiredMethods: ['someMethod'],
        },
      };

      // Attempt to create controller with invalid service - this will throw during dependency validation
      expect(() => {
        new TestControllerWithPrivates(
          {
            logger: mockLogger,
            characterBuilderService: mockCharacterBuilderService,
            eventBus: mockEventBus,
            schemaValidator: mockSchemaValidator,
            customService: mockInvalidService,
          },
          validationRules
        );
      }).toThrow(InvalidDependencyError);
    });

    it('should accept additional services without throwing', () => {
      const mockValidService = {
        requiredMethod: jest.fn(),
        anotherRequired: jest.fn(),
      };

      // Should not throw when service is valid
      expect(() => {
        controller = new TestControllerWithPrivates({
          logger: mockLogger,
          characterBuilderService: mockCharacterBuilderService,
          eventBus: mockEventBus,
          schemaValidator: mockSchemaValidator,
          complexService: mockValidService,
        });
      }).not.toThrow();

      // Verify controller was created with additional service
      expect(controller).toBeDefined();
      expect(controller.testHasService('complexService')).toBe(true);
    });

    it('should validate additional services when matching rules are provided', () => {
      const analyticsService = { track: jest.fn() };
      const validationRules = {
        analyticsService: {
          requiredMethods: ['track'],
        },
      };

      controller = new TestControllerWithPrivates(
        {
          logger: mockLogger,
          characterBuilderService: mockCharacterBuilderService,
          eventBus: mockEventBus,
          schemaValidator: mockSchemaValidator,
          analyticsService,
        },
        validationRules
      );

      expect(controller).toBeDefined();
      expect(controller.additionalServices.analyticsService).toBe(analyticsService);
      expect(mockLogger.debug).toHaveBeenCalledWith(
        expect.stringContaining("Validated additional service 'analyticsService'")
      );
    });
  });

  describe('Private Service Methods (lines 363-374)', () => {
    beforeEach(() => {
      controller = new TestControllerWithPrivates({
        logger: mockLogger,
        characterBuilderService: mockCharacterBuilderService,
        eventBus: mockEventBus,
        schemaValidator: mockSchemaValidator,
        extraService1: { method1: jest.fn() },
        extraService2: { method2: jest.fn() },
      });
    });

    it('should check if service exists using #hasService', () => {
      // Test that services are properly stored and accessible
      expect(controller.additionalServices).toBeDefined();
      expect(Object.keys(controller.additionalServices).length).toBeGreaterThan(
        0
      );

      // Verify the controller has the additional services
      expect(controller.testHasService('extraService1')).toBe(true);
      expect(controller.testHasService('extraService2')).toBe(true);
      expect(controller.testHasService('nonExistentService')).toBe(false);
    });

    it('should retrieve service using #getService', () => {
      const service1 = controller.testGetService('extraService1');
      expect(service1).toBeDefined();
      expect(service1.method1).toBeDefined();

      const service2 = controller.testGetService('extraService2');
      expect(service2).toBeDefined();
      expect(service2.method2).toBeDefined();

      const nonExistent = controller.testGetService('nonExistentService');
      expect(nonExistent).toBeUndefined();
    });
  });

  describe('DOM element caching safeguards (lines 595-609)', () => {
    it('should throw descriptive error when required selector is missing', () => {
      controller = new TestControllerWithPrivates({
        logger: mockLogger,
        characterBuilderService: mockCharacterBuilderService,
        eventBus: mockEventBus,
        schemaValidator: mockSchemaValidator,
      });

      expect(() =>
        controller._cacheElement('missingButton', '.missing-button')
      ).toThrow(
        new Error(
          "TestControllerWithPrivates: Failed to cache element 'missingButton'. Required element matching selector '.missing-button' not found in DOM"
        )
      );
    });
  });

  describe('State Transition Error Handling (lines 1079-1085)', () => {
    it('should handle error during state transition and fallback to error state', async () => {
      controller = new TestControllerWithPrivates({
        logger: mockLogger,
        characterBuilderService: mockCharacterBuilderService,
        eventBus: mockEventBus,
        schemaValidator: mockSchemaValidator,
      });

      // Initialize UIStateManager first - this will create our mock
      await controller._initializeUIStateManager();

      // Get the mock instance created during initialization
      const mockUIStateManager = getMockUIStateManager();

      // Mock the showState to throw an error
      mockUIStateManager.showState.mockImplementation(() => {
        throw new Error('State transition failed');
      });

      // Attempt state transition that will fail
      await controller._showState(UI_STATES.READY);

      // Verify error was logged
      expect(mockLogger.error).toHaveBeenCalledWith(
        expect.stringContaining('State transition failed'),
        expect.any(Error)
      );

      // Verify fallback to error state was attempted
      expect(mockUIStateManager.showError).toHaveBeenCalledWith(
        'An error occurred while updating the display'
      );
    });

    it('should dispatch state change event when eventBus is available', async () => {
      controller = new TestControllerWithPrivates({
        logger: mockLogger,
        characterBuilderService: mockCharacterBuilderService,
        eventBus: mockEventBus,
        schemaValidator: mockSchemaValidator,
      });

      // Initialize UIStateManager first - this will create our mock
      await controller._initializeUIStateManager();

      // Clear any previous calls
      mockEventBus.dispatch.mockClear();

      await controller._showState(UI_STATES.LOADING);

      expect(mockEventBus.dispatch).toHaveBeenCalledWith(
        'core:ui_state_changed',
        expect.objectContaining({
          controller: 'TestControllerWithPrivates',
          currentState: UI_STATES.LOADING,
          timestamp: expect.any(String),
        })
      );
    });
  });

  describe('Event bus subscription fallbacks (lines 1389-1414)', () => {
    beforeEach(() => {
      controller = new TestControllerWithPrivates({
        logger: mockLogger,
        characterBuilderService: mockCharacterBuilderService,
        eventBus: mockEventBus,
        schemaValidator: mockSchemaValidator,
      });
    });

    it('should unsubscribe tracked listeners and warn when event bus is unavailable', () => {
      const unsubscribe = jest.fn();
      mockEventBus.subscribe.mockReturnValueOnce(unsubscribe);

      const subscriptionId = controller._subscribeToEvent(
        'unit:test',
        function handler() {}
      );

      expect(subscriptionId).toBeTruthy();

      controller._detachEventBus();

      expect(unsubscribe).toHaveBeenCalledTimes(1);

      mockLogger.warn.mockClear();

      const result = controller._subscribeToEvent('unit:test', () => {});
      expect(result).toBeNull();
      expect(mockLogger.warn).toHaveBeenCalledWith(
        expect.stringContaining("Cannot subscribe to 'unit:test'")
      );
      // Ensure no new subscriptions were attempted after detaching
      expect(mockEventBus.subscribe).toHaveBeenCalledTimes(1);
    });
  });

  describe('Container resolution helper (line 1482)', () => {
    it('should return provided elements without modification', () => {
      controller = new TestControllerWithPrivates({
        logger: mockLogger,
        characterBuilderService: mockCharacterBuilderService,
        eventBus: mockEventBus,
        schemaValidator: mockSchemaValidator,
      });

      const container = document.createElement('section');
      const resolvedContainer = controller._getContainer(container);

      expect(resolvedContainer).toBe(container);
    });
  });

  describe('Initialization error handling (lines 2033-2055)', () => {
    it('should dispatch initialization errors to the event bus', async () => {
      controller = new TestControllerWithPrivates({
        logger: mockLogger,
        characterBuilderService: mockCharacterBuilderService,
        eventBus: mockEventBus,
        schemaValidator: mockSchemaValidator,
      });

      controller._showError = jest.fn();
      controller._showState = jest.fn();

      const initializationError = new Error('init failure');
      initializationError.phase = 'setup';

      mockEventBus.dispatch.mockClear();

      await controller._handleInitializationError(initializationError);

      expect(mockEventBus.dispatch).toHaveBeenCalledWith(
        'SYSTEM_ERROR_OCCURRED',
        expect.objectContaining({
          error: 'init failure',
          context: 'TestControllerWithPrivates initialization',
          phase: 'setup',
          timestamp: expect.any(String),
          stack: expect.any(String),
        })
      );
    });
  });

  // Tests for _executeLifecycleMethod removed - this method doesn't exist on BaseCharacterBuilderController
  // Lifecycle method execution is handled internally by ControllerLifecycleOrchestrator
  // See controllerLifecycleOrchestrator.test.js for lifecycle orchestration tests

  describe('Error Display Fallback (lines 2055-2056)', () => {
    it('should fallback to _showState when _showError is not available', async () => {
      controller = new TestControllerWithPrivates({
        logger: mockLogger,
        characterBuilderService: mockCharacterBuilderService,
        eventBus: mockEventBus,
        schemaValidator: mockSchemaValidator,
      });

      // Remove _showError method by overriding the prototype implementation
      controller._showError = undefined;

      // Trigger initialization error handling
      const error = new Error('Test initialization error');
      error.phase = 'test-phase';

      await controller._handleInitializationError(error);

      // Verify _showState was called as fallback
      expect(controller._lastShowStateCall).toEqual({
        state: 'error',
        data: {
          message: 'Failed to initialize page. Please refresh and try again.',
        },
      });
    });
  });

  describe('Error Recovery Mechanisms (lines 2626-2635)', () => {
    it('should attempt reinitalization for system errors during initialization', () => {
      controller = new TestControllerWithPrivates({
        logger: mockLogger,
        characterBuilderService: mockCharacterBuilderService,
        eventBus: mockEventBus,
        schemaValidator: mockSchemaValidator,
      });

      // Mock the _reinitialize method
      controller._reinitialize = jest.fn();

      // Trigger system error recovery
      const errorDetails = {
        category: ERROR_CATEGORIES.SYSTEM,
        operation: 'initialization',
      };

      controller._attemptErrorRecovery(errorDetails);

      // Fast-forward timers
      jest.advanceTimersByTime(2000);

      // Verify reinitialize was called
      expect(controller._reinitialize).toHaveBeenCalled();
    });

    it('should attempt retry for network errors', () => {
      controller = new TestControllerWithPrivates({
        logger: mockLogger,
        characterBuilderService: mockCharacterBuilderService,
        eventBus: mockEventBus,
        schemaValidator: mockSchemaValidator,
      });

      // Mock the retry method
      controller._retryLastOperation = jest.fn();

      // Trigger network error recovery
      const errorDetails = {
        category: ERROR_CATEGORIES.NETWORK,
        severity: ERROR_SEVERITY.RECOVERABLE,
      };

      controller._attemptErrorRecovery(errorDetails);

      // Fast-forward timers
      jest.advanceTimersByTime(5000);

      // Verify retry was called
      expect(controller._retryLastOperation).toHaveBeenCalled();
    });

    it('should log when retrying a network error fails', () => {
      controller = new TestControllerWithPrivates({
        logger: mockLogger,
        characterBuilderService: mockCharacterBuilderService,
        eventBus: mockEventBus,
        schemaValidator: mockSchemaValidator,
      });

      const retryFailure = new Error('Retry failure');
      controller._retryLastOperation = jest.fn(() => {
        throw retryFailure;
      });

      mockLogger.error.mockClear();

      controller._attemptErrorRecovery({
        category: ERROR_CATEGORIES.NETWORK,
        severity: ERROR_SEVERITY.RECOVERABLE,
      });

      jest.advanceTimersByTime(5000);

      expect(mockLogger.error).toHaveBeenCalledWith(
        expect.stringContaining('Recovery retry failed'),
        retryFailure
      );
    });

    it('should not attempt recovery for unrecognized error categories', () => {
      controller = new TestControllerWithPrivates({
        logger: mockLogger,
        characterBuilderService: mockCharacterBuilderService,
        eventBus: mockEventBus,
        schemaValidator: mockSchemaValidator,
      });

      controller._reinitialize = jest.fn();
      controller._retryLastOperation = jest.fn();

      // Trigger unknown error category
      const errorDetails = {
        category: 'UNKNOWN_CATEGORY',
      };

      controller._attemptErrorRecovery(errorDetails);

      // Fast-forward timers
      jest.advanceTimersByTime(10000);

      // Verify no recovery methods were called
      expect(controller._reinitialize).not.toHaveBeenCalled();
      expect(controller._retryLastOperation).not.toHaveBeenCalled();
    });
  });

  describe('Animation Frame Cleanup (lines 2972-2973)', () => {
    it('should clean up pending animation frames from set after callback', () => {
      controller = new TestControllerWithPrivates({
        logger: mockLogger,
        characterBuilderService: mockCharacterBuilderService,
        eventBus: mockEventBus,
        schemaValidator: mockSchemaValidator,
      });

      // Mock requestAnimationFrame
      let animationCallback;
      global.requestAnimationFrame = jest.fn((callback) => {
        animationCallback = callback;
        return 123; // Return a frame ID
      });

      // Call the animation frame method
      const callbackSpy = jest.fn();
      controller._requestAnimationFrame(callbackSpy);

      // Verify frame was added to pending set
      expect(global.requestAnimationFrame).toHaveBeenCalled();

      // Execute the animation frame callback
      if (animationCallback) {
        animationCallback(performance.now());
      }

      // Verify callback was executed
      expect(callbackSpy).toHaveBeenCalledWith(expect.any(Number));
    });

    it('should track multiple animation frames', () => {
      controller = new TestControllerWithPrivates({
        logger: mockLogger,
        characterBuilderService: mockCharacterBuilderService,
        eventBus: mockEventBus,
        schemaValidator: mockSchemaValidator,
      });

      const callbacks = [];
      let frameId = 1;

      global.requestAnimationFrame = jest.fn((callback) => {
        callbacks.push(callback);
        return frameId++;
      });

      // Request multiple animation frames
      const callback1 = jest.fn();
      const callback2 = jest.fn();
      const callback3 = jest.fn();

      controller._requestAnimationFrame(callback1);
      controller._requestAnimationFrame(callback2);
      controller._requestAnimationFrame(callback3);

      // Execute callbacks
      callbacks.forEach((cb, index) => {
        cb(performance.now() + index);
      });

      // Verify all callbacks were executed
      expect(callback1).toHaveBeenCalled();
      expect(callback2).toHaveBeenCalled();
      expect(callback3).toHaveBeenCalled();
    });
  });

  describe('Destruction Guard (lines 3094-3097)', () => {
    it('should warn when destruction is already in progress', async () => {
      controller = new TestControllerWithPrivates({
        logger: mockLogger,
        characterBuilderService: mockCharacterBuilderService,
        eventBus: mockEventBus,
        schemaValidator: mockSchemaValidator,
      });

      // First destroy call
      controller.destroy();

      // Second destroy call while first is in progress
      controller.destroy();

      // Verify warning was logged - the actual message is "Already destroyed, skipping destruction"
      expect(mockLogger.warn).toHaveBeenCalledWith(
        expect.stringContaining('Already destroyed')
      );
    });

    it('should handle multiple rapid destroy calls', async () => {
      controller = new TestControllerWithPrivates({
        logger: mockLogger,
        characterBuilderService: mockCharacterBuilderService,
        eventBus: mockEventBus,
        schemaValidator: mockSchemaValidator,
      });

      // Call destroy multiple times rapidly
      controller.destroy();
      controller.destroy();
      controller.destroy();

      // Should see multiple warnings for subsequent calls - actual message is "Already destroyed"
      expect(mockLogger.warn).toHaveBeenCalledTimes(2);
      expect(mockLogger.warn).toHaveBeenCalledWith(
        expect.stringContaining('Already destroyed')
      );
    });

    it('should prevent destroy when already destroyed', () => {
      controller = new TestControllerWithPrivates({
        logger: mockLogger,
        characterBuilderService: mockCharacterBuilderService,
        eventBus: mockEventBus,
        schemaValidator: mockSchemaValidator,
      });

      // First call to actually destroy it
      controller.destroy();

      // Second call should trigger the warning
      controller.destroy();

      // Verify warning was logged
      expect(mockLogger.warn).toHaveBeenCalledWith(
        expect.stringContaining('Already destroyed')
      );
    });
  });

  describe('Edge Cases and Complex Scenarios', () => {
    it('should handle service validation with partial method implementation', () => {
      const partialService = {
        method1: jest.fn(),
        // method2 is missing
      };

      const validationRules = {
        partialService: {
          requiredMethods: ['method1', 'method2'],
        },
      };

      expect(() => {
        new TestControllerWithPrivates(
          {
            logger: mockLogger,
            characterBuilderService: mockCharacterBuilderService,
            eventBus: mockEventBus,
            schemaValidator: mockSchemaValidator,
            partialService,
          },
          validationRules
        );
      }).toThrow(InvalidDependencyError);
    });

    it('should handle concurrent state transitions with errors', async () => {
      controller = new TestControllerWithPrivates({
        logger: mockLogger,
        characterBuilderService: mockCharacterBuilderService,
        eventBus: mockEventBus,
        schemaValidator: mockSchemaValidator,
      });

      // Initialize UIStateManager first - this will create our mock
      await controller._initializeUIStateManager();

      // Get the mock instance and make it fail intermittently
      const mockUIStateManager = getMockUIStateManager();
      let callCount = 0;
      mockUIStateManager.showState.mockImplementation(() => {
        callCount++;
        if (callCount % 2 === 0) {
          throw new Error('Intermittent state failure');
        }
      });

      // Trigger multiple state transitions
      await Promise.all([
        controller._showState(UI_STATES.LOADING),
        controller._showState(UI_STATES.READY),
        controller._showState(UI_STATES.ERROR),
      ]);

      // Verify errors were handled
      expect(mockLogger.error).toHaveBeenCalled();
    });

    it('should handle error recovery with cascading failures', () => {
      controller = new TestControllerWithPrivates({
        logger: mockLogger,
        characterBuilderService: mockCharacterBuilderService,
        eventBus: mockEventBus,
        schemaValidator: mockSchemaValidator,
      });

      // Mock methods to simulate cascading failures
      controller._reinitialize = jest.fn().mockImplementation(() => {
        throw new Error('Reinitialize failed');
      });

      // Trigger system error recovery
      const errorDetails = {
        category: ERROR_CATEGORIES.SYSTEM,
        operation: 'initialization',
      };

      // Should not throw even if recovery fails
      expect(() => {
        controller._attemptErrorRecovery(errorDetails);
        jest.advanceTimersByTime(2000);
      }).not.toThrow();
    });
  });

  describe('Error utilities coverage (lines 2124-2334)', () => {
    beforeEach(() => {
      controller = new TestControllerWithPrivates({
        logger: mockLogger,
        characterBuilderService: mockCharacterBuilderService,
        eventBus: mockEventBus,
        schemaValidator: mockSchemaValidator,
      });

      // Create spies BEFORE any test code runs to ensure they're captured by the strategy
      jest.spyOn(controller, '_showError');
      jest.spyOn(controller, '_showErrorToUser');
      jest.spyOn(controller, '_handleError');
    });

    it('should generate user-friendly messages for each category and respect custom messages', () => {
      const validationMessage = controller._generateUserMessage(new Error('invalid input'), {
        category: ERROR_CATEGORIES.VALIDATION,
      });
      const networkMessage = controller._generateUserMessage(new Error('network down'), {
        category: ERROR_CATEGORIES.NETWORK,
      });
      const permissionMessage = controller._generateUserMessage(new Error('no access'), {
        category: ERROR_CATEGORIES.PERMISSION,
      });
      const notFoundMessage = controller._generateUserMessage(new Error('404 not found'), {
        category: ERROR_CATEGORIES.NOT_FOUND,
      });
      const customMessage = controller._generateUserMessage(new Error('anything'), {
        userMessage: 'Custom override message.',
      });

      expect(validationMessage).toBe('Please check your input and try again.');
      expect(networkMessage).toBe('Connection error. Please check your internet and try again.');
      expect(permissionMessage).toBe("You don't have permission to perform this action.");
      expect(notFoundMessage).toBe('The requested resource was not found.');
      expect(customMessage).toBe('Custom override message.');
    });

    it('should log errors using the appropriate severity channel', () => {
      controller._logError({
        message: 'informational message',
        operation: 'infoOp',
        category: ERROR_CATEGORIES.SYSTEM,
        severity: ERROR_SEVERITY.INFO,
        metadata: { traceId: 'info' },
      });

      controller._logError({
        message: 'warning message',
        operation: 'warnOp',
        category: ERROR_CATEGORIES.USER,
        severity: ERROR_SEVERITY.WARNING,
        metadata: { traceId: 'warn' },
      });

      controller._logError({
        message: 'critical message',
        operation: 'critOp',
        category: ERROR_CATEGORIES.SYSTEM,
        severity: ERROR_SEVERITY.CRITICAL,
        metadata: { traceId: 'critical' },
      });

      controller._logError({
        message: 'default message',
        operation: 'defaultOp',
        category: ERROR_CATEGORIES.SYSTEM,
        severity: ERROR_SEVERITY.ERROR,
        metadata: { traceId: 'default' },
      });

      expect(mockLogger.info).toHaveBeenCalledWith(
        expect.stringContaining('infoOp info'),
        expect.objectContaining({ message: 'informational message' })
      );
      expect(mockLogger.warn).toHaveBeenCalledWith(
        expect.stringContaining('warnOp warning'),
        expect.objectContaining({ message: 'warning message' })
      );
      expect(mockLogger.error).toHaveBeenCalledWith(
        expect.stringContaining('CRITICAL ERROR in critOp'),
        expect.objectContaining({ message: 'critical message' })
      );
      expect(mockLogger.error).toHaveBeenCalledWith(
        expect.stringContaining('Error in defaultOp'),
        expect.objectContaining({ message: 'default message' })
      );
    });

    it('should display errors using _showError when available', () => {
      const errorDetails = {
        userMessage: 'Primary error',
        category: ERROR_CATEGORIES.SYSTEM,
        severity: ERROR_SEVERITY.ERROR,
      };

      controller._showErrorToUser(errorDetails);
      // Strategy calls _showError with (message, details)
      expect(controller._showError).toHaveBeenCalledWith('Primary error', errorDetails);
    });

    it('should fallback to _showState when _showError is not available', () => {
      // Create a new controller WITHOUT _showError method
      const controllerWithoutShowError = new TestControllerWithPrivates({
        logger: mockLogger,
        characterBuilderService: mockCharacterBuilderService,
        eventBus: mockEventBus,
        schemaValidator: mockSchemaValidator,
      });

      // Remove _showError before strategy initialization
      controllerWithoutShowError._showError = undefined;
      jest.spyOn(controllerWithoutShowError, '_showState');

      controllerWithoutShowError._showErrorToUser({
        userMessage: 'Fallback error',
        category: ERROR_CATEGORIES.NETWORK,
        severity: ERROR_SEVERITY.WARNING,
      });

      expect(controllerWithoutShowError._showState).toHaveBeenCalledWith(
        'error',
        expect.objectContaining({
          message: 'Fallback error',
        })
      );
    });

    it('should fallback to console.error when no display methods are available', () => {
      // Create a new controller WITHOUT _showError or _showState
      const controllerNoDisplay = new TestControllerWithPrivates({
        logger: mockLogger,
        characterBuilderService: mockCharacterBuilderService,
        eventBus: mockEventBus,
        schemaValidator: mockSchemaValidator,
      });

      // Remove both before strategy initialization
      controllerNoDisplay._showError = undefined;
      controllerNoDisplay._showState = undefined;

      const originalConsoleError = console.error;
      const consoleSpy = jest.fn();
      console.error = consoleSpy;

      controllerNoDisplay._showErrorToUser({
        userMessage: 'Console only error',
        category: ERROR_CATEGORIES.USER,
        severity: ERROR_SEVERITY.WARNING,
      });

      expect(consoleSpy).toHaveBeenCalledWith(
        'Error display not available:',
        'Console only error'
      );
      console.error = originalConsoleError;
    });

    it('should dispatch structured error events', () => {
      mockEventBus.dispatch.mockClear();
      const details = {
        message: 'failure',
        operation: 'loadResources',
        category: ERROR_CATEGORIES.SYSTEM,
        severity: ERROR_SEVERITY.ERROR,
        controller: 'TestControllerWithPrivates',
        timestamp: '2024-03-20T10:00:00.000Z',
        stack: 'stack trace',
        metadata: { requestId: 'evt-1' },
        userMessage: 'Friendly failure',
      };

      controller._dispatchErrorEvent(details);

      expect(mockEventBus.dispatch).toHaveBeenCalledWith(
        'SYSTEM_ERROR_OCCURRED',
        expect.objectContaining({
          error: 'failure',
          context: 'loadResources',
          category: ERROR_CATEGORIES.SYSTEM,
          severity: ERROR_SEVERITY.ERROR,
          controller: 'TestControllerWithPrivates',
          metadata: { requestId: 'evt-1' },
        })
      );
    });

    it('should build comprehensive error details and attempt recovery for recoverable scenarios', () => {
      const result = controller._handleError(new Error('network outage'), {
        operation: 'fetchData',
        category: ERROR_CATEGORIES.NETWORK,
        metadata: { retryCount: 1 },
      });

      // Verify error was displayed via _showError (called by strategy)
      expect(controller._showError).toHaveBeenCalled();

      // Verify recovery was attempted (check logger for recovery message)
      expect(mockLogger.info).toHaveBeenCalledWith(
        expect.stringContaining('Attempting recovery from network error')
      );
      expect(controller.lastError).toEqual(result);
      expect(result.userMessage).toBe(
        'Connection error. Please check your internet and try again.'
      );
      expect(result.metadata).toEqual(
        expect.objectContaining({ retryCount: 1, url: expect.any(String) })
      );
    });

    it('should respect showToUser=false when handling errors', () => {
      controller._showErrorToUser = jest.fn();
      controller._attemptErrorRecovery = jest.fn();

      const details = controller._handleError('validation failed', {
        operation: 'validateForm',
        category: ERROR_CATEGORIES.VALIDATION,
        severity: ERROR_SEVERITY.WARNING,
        showToUser: false,
      });

      expect(controller._showErrorToUser).not.toHaveBeenCalled();
      expect(controller._attemptErrorRecovery).not.toHaveBeenCalled();
      expect(details.userMessage).toBe('Please check your input and try again.');
    });

    it('should validate data and format validation errors', () => {
      mockSchemaValidator.validate.mockReturnValue({
        isValid: false,
        errors: [
          'Simple error',
          { instancePath: '/profile/name', message: 'is required' },
          { message: 'Generic issue' },
        ],
      });

      mockLogger.warn.mockClear();

      const result = controller._validateData(
        { profile: { name: '' } },
        'profileSchema',
        { operation: 'saveProfile' }
      );

      expect(mockSchemaValidator.validate).toHaveBeenCalledWith(
        'profileSchema',
        { profile: { name: '' } }
      );
      expect(result.isValid).toBe(false);
      expect(result.errors).toEqual([
        'Simple error',
        'profile.name: is required',
        'Generic issue',
      ]);
      expect(result.errorMessage).toContain('Please fix the following errors');
      expect(result.failureMessage).toContain(
        "Validation failed for schema 'profileSchema'"
      );
      expect(mockLogger.warn).toHaveBeenCalledWith(
        expect.stringContaining("Validation failed for schema 'profileSchema'"),
        expect.objectContaining({
          operation: 'saveProfile',
          schemaId: 'profileSchema',
        })
      );
    });

    it('should handle validators that return non-array errors', () => {
      mockSchemaValidator.validate.mockReturnValue({
        isValid: false,
        errors: null,
      });

      mockLogger.warn.mockClear();

      const result = controller._validateData({}, 'emptySchema');

      expect(result.isValid).toBe(false);
      expect(result.errors).toEqual(['Invalid data format']);
      expect(result.errorMessage).toBe('Invalid data format');
      expect(result.failureMessage).toContain(
        "Validation failed for schema 'emptySchema'"
      );
      expect(mockLogger.warn).toHaveBeenCalledWith(
        expect.stringContaining("Validation failed for schema 'emptySchema'"),
        expect.objectContaining({
          operation: 'validateData',
          schemaId: 'emptySchema',
        })
      );
    });

    it('should recover gracefully when schema validation throws', () => {
      const validationError = new Error('Schema not loaded');
      mockSchemaValidator.validate.mockImplementation(() => {
        throw validationError;
      });
      const handleErrorSpy = jest.spyOn(controller, '_handleError');

      const result = controller._validateData(
        { id: '123' },
        'failingSchema',
        { operation: 'validateData' }
      );

      expect(handleErrorSpy).toHaveBeenCalledWith(
        validationError,
        expect.objectContaining({
          operation: 'validateData',
          category: ERROR_CATEGORIES.SYSTEM,
        })
      );
      expect(result.isValid).toBe(false);
      expect(result.errors[0]).toContain('Schema not loaded');
    });

    it('should determine error recoverability accurately', () => {
      expect(
        controller._determineRecoverability(new Error('temporary outage'), {
          category: ERROR_CATEGORIES.SYSTEM,
        })
      ).toBe(true);
      expect(
        controller._determineRecoverability(new Error('network issue'), {
          category: ERROR_CATEGORIES.NETWORK,
        })
      ).toBe(true);
      expect(
        controller._determineRecoverability(new Error('validation error'), {
          category: ERROR_CATEGORIES.VALIDATION,
        })
      ).toBe(false);
      expect(
        controller._determineRecoverability(new Error('permission denied'), {
          category: ERROR_CATEGORIES.PERMISSION,
        })
      ).toBe(false);
      expect(
        controller._determineRecoverability(new Error('irrecoverable'), {
          category: ERROR_CATEGORIES.SYSTEM,
        })
      ).toBe(false);
    });

    it('should evaluate recoverable error details correctly', () => {
      expect(
        controller._isRecoverableError({
          isRecoverable: true,
          severity: ERROR_SEVERITY.WARNING,
        })
      ).toBe(true);
      expect(
        controller._isRecoverableError({
          isRecoverable: true,
          severity: ERROR_SEVERITY.CRITICAL,
        })
      ).toBe(false);
      expect(
        controller._isRecoverableError({
          isRecoverable: false,
          severity: ERROR_SEVERITY.ERROR,
        })
      ).toBe(false);
    });

    it('should create and wrap errors with contextual information', () => {
      const createdError = controller._createError('Boom', ERROR_CATEGORIES.SYSTEM, {
        id: 'err-1',
      });
      expect(createdError.message).toBe('Boom');
      expect(createdError.category).toBe(ERROR_CATEGORIES.SYSTEM);
      expect(createdError.metadata).toEqual({ id: 'err-1' });
      expect(createdError.controller).toBe('TestControllerWithPrivates');

      const originalError = new Error('root cause');
      const wrapped = controller._wrapError(originalError, 'While processing');
      expect(wrapped.message).toBe('While processing: root cause');
      expect(wrapped.originalError).toBe(originalError);
      expect(wrapped.stack).toBe(originalError.stack);
    });
  });

  describe('Performance instrumentation coverage (lines 3004-3188)', () => {
    let originalPerformance;

    beforeEach(() => {
      controller = new TestControllerWithPrivates({
        logger: mockLogger,
        characterBuilderService: mockCharacterBuilderService,
        eventBus: mockEventBus,
        schemaValidator: mockSchemaValidator,
      });

      originalPerformance = global.performance;
      global.performance = {
        now: jest.fn(),
        mark: jest.fn(),
        measure: jest.fn(),
        clearMarks: jest.fn(),
        clearMeasures: jest.fn(),
      };
    });

    afterEach(() => {
      global.performance = originalPerformance;
    });

    it('should record performance marks and handle failures gracefully', () => {
      performance.now.mockReturnValueOnce(25);
      controller._performanceMark('load-start');
      expect(performance.mark).toHaveBeenCalledWith('load-start');
      expect(mockLogger.debug).toHaveBeenCalledWith('Performance mark: load-start', {
        timestamp: 25,
      });

      performance.mark.mockImplementationOnce(() => {
        throw new Error('mark failed');
      });
      performance.now.mockReturnValueOnce(30);
      controller._performanceMark('load-failed');
      expect(mockLogger.warn).toHaveBeenCalledWith(
        'Failed to create performance mark: load-failed',
        expect.any(Error)
      );
    });

    it('should measure durations and dispatch performance warnings when threshold exceeded', () => {
      mockEventBus.dispatch.mockClear();
      performance.now
        .mockReturnValueOnce(5) // start mark
        .mockReturnValueOnce(155); // end mark created inside _performanceMeasure

      controller._performanceMark('init-start');
      const duration = controller._performanceMeasure('init', 'init-start');

      expect(duration).toBe(150);
      expect(performance.measure).toHaveBeenCalledWith('init', 'init-start', 'init-end');
      expect(mockEventBus.dispatch).toHaveBeenCalledWith(
        CHARACTER_BUILDER_EVENTS.CHARACTER_BUILDER_PERFORMANCE_WARNING,
        expect.objectContaining({
          controller: 'TestControllerWithPrivates',
          measurement: 'init',
          duration: 150,
        })
      );
    });

    it('should warn when measuring without available marks', () => {
      mockLogger.warn.mockClear();
      const duration = controller._performanceMeasure(
        'missing',
        'missing-start',
        'missing-end'
      );

      expect(duration).toBeNull();
      expect(mockLogger.warn).toHaveBeenCalledWith(
        'Performance marks not found for measurement: missing',
        expect.objectContaining({
          startMark: 'missing-start',
          endMark: 'missing-end',
          hasStartMark: false,
          hasEndMark: false,
        })
      );
    });

    it('should expose and clear performance measurements', () => {
      performance.now
        .mockReturnValueOnce(5)
        .mockReturnValueOnce(55)
        .mockReturnValueOnce(10)
        .mockReturnValueOnce(70);

      controller._performanceMark('keep-start');
      controller._performanceMeasure('keep', 'keep-start');
      controller._performanceMark('test-start');
      controller._performanceMeasure('test-measure', 'test-start');

      const snapshot = controller._getPerformanceMeasurements();
      expect(snapshot).toBeInstanceOf(Map);
      expect(snapshot.get('keep')).toEqual(
        expect.objectContaining({ duration: expect.any(Number) })
      );

      performance.clearMarks.mockClear();
      performance.clearMeasures.mockClear();
      mockLogger.debug.mockClear();
      controller._clearPerformanceData('test');
      expect(performance.clearMarks).toHaveBeenCalled();
      expect(performance.clearMeasures).toHaveBeenCalled();
      expect(mockLogger.debug).toHaveBeenCalledWith('Cleared performance data', {
        prefix: 'test',
      });

      controller._clearPerformanceData();
      expect(mockLogger.debug).toHaveBeenCalledWith('Cleared performance data', {
        prefix: null,
      });
    });
  });

  describe('Function wrapping utilities coverage (lines 3208-3494)', () => {
    beforeEach(() => {
      controller = new TestControllerWithPrivates({
        logger: mockLogger,
        characterBuilderService: mockCharacterBuilderService,
        eventBus: mockEventBus,
        schemaValidator: mockSchemaValidator,
      });
      jest.setSystemTime(0);
    });

    it('should debounce functions with leading, trailing, and maxWait support', () => {
      const fn = jest.fn().mockImplementation((value) => `processed-${value}`);
      const debounced = controller._debounce(fn, 50, {
        leading: true,
        trailing: true,
        maxWait: 80,
      });

      const firstResult = debounced('first');
      expect(firstResult).toBe('processed-first');
      expect(fn).toHaveBeenCalledTimes(1);

      jest.advanceTimersByTime(10);
      debounced('second');

      jest.advanceTimersByTime(30);
      debounced('third');
      expect(debounced.pending()).toBe(true);
      expect(fn).toHaveBeenCalledTimes(1);

      jest.advanceTimersByTime(40); // triggers maxWait execution
      expect(fn).toHaveBeenCalledTimes(2);

      jest.advanceTimersByTime(20); // allow trailing timer to settle
      expect(debounced.pending()).toBe(false);

      jest.advanceTimersByTime(80);
      const previousCalls = fn.mock.calls.length;
      debounced('fourth');
      expect(fn.mock.calls.length).toBeGreaterThan(previousCalls);
      expect(fn.mock.calls.at(-1)).toBeDefined();

      debounced('fifth');
      expect(debounced.pending()).toBe(true);
      debounced.flush();
      expect(fn.mock.calls.length).toBeGreaterThan(previousCalls + 1);

      debounced.cancel();
      expect(debounced.pending()).toBe(false);
    });

    it('should throttle functions and support cancel/flush semantics', () => {
      const fn = jest.fn().mockImplementation((value) => `throttled-${value}`);
      const throttled = controller._throttle(fn, 100, {
        leading: true,
        trailing: true,
      });

      const firstResult = throttled('initial');
      expect(firstResult).toBeUndefined();
      expect(fn).not.toHaveBeenCalled();

      jest.advanceTimersByTime(100);
      expect(fn).toHaveBeenCalledTimes(1);
      expect(fn).toHaveBeenLastCalledWith('initial');

      throttled('delayed');
      expect(fn).toHaveBeenCalledTimes(1);

      jest.advanceTimersByTime(100);
      expect(fn).toHaveBeenCalledTimes(2);
      expect(fn).toHaveBeenLastCalledWith('delayed');

      throttled('queued');
      throttled.flush();
      expect(fn).toHaveBeenCalledTimes(3);

      throttled('cancelled');
      throttled.cancel();
      jest.advanceTimersByTime(200);
      expect(fn).toHaveBeenCalledTimes(3);
    });

    it('should cache debounced and throttled handlers by key', () => {
      const fn = jest.fn();
      const debounced = controller._getDebouncedHandler('key-1', fn, 20);
      const debouncedAgain = controller._getDebouncedHandler('key-1', fn, 20);
      expect(debounced).toBe(debouncedAgain);

      const throttled = controller._getThrottledHandler('key-2', fn, 30);
      const throttledAgain = controller._getThrottledHandler('key-2', fn, 30);
      expect(throttled).toBe(throttledAgain);
    });

    it('should clear scheduled timers when maxWait triggers immediate debounce execution', () => {
      const fn = jest.fn();
      const toolkit = controller._getAsyncUtilitiesToolkit();
      const clearTimeoutSpy = jest.spyOn(toolkit, 'clearTimeout');
      const nowSpy = jest.spyOn(Date, 'now');

      nowSpy
        .mockReturnValueOnce(100)
        .mockReturnValueOnce(110)
        .mockReturnValueOnce(170)
        .mockReturnValueOnce(180);

      const debounced = controller._debounce(fn, 30, {
        maxWait: 50,
        leading: false,
        trailing: true,
      });

      debounced('first');
      expect(fn).toHaveBeenCalledTimes(1);

      debounced('second');
      expect(fn).toHaveBeenCalledTimes(2);
      expect(clearTimeoutSpy).toHaveBeenCalled();

      debounced.cancel();

      clearTimeoutSpy.mockRestore();
      nowSpy.mockRestore();
    });

    it('should cancel debounced handlers and clear all pending timers', () => {
      const fn = jest.fn();
      const toolkit = controller._getAsyncUtilitiesToolkit();
      const clearTimeoutSpy = jest.spyOn(toolkit, 'clearTimeout');
      const nowSpy = jest.spyOn(Date, 'now').mockReturnValueOnce(0);

      const debounced = controller._debounce(fn, 40, {
        maxWait: 100,
        leading: false,
        trailing: true,
      });

      debounced('queued');
      expect(clearTimeoutSpy).not.toHaveBeenCalled();

      debounced.cancel();
      expect(clearTimeoutSpy).toHaveBeenCalledTimes(2);

      clearTimeoutSpy.mockRestore();
      nowSpy.mockRestore();
    });

    it('should clear pending throttle timers when leading edge execution occurs', () => {
      const fn = jest.fn();
      const toolkit = controller._getAsyncUtilitiesToolkit();
      const clearTimeoutSpy = jest.spyOn(toolkit, 'clearTimeout');
      const nowSpy = jest.spyOn(Date, 'now');

      nowSpy
        .mockReturnValueOnce(0)
        .mockReturnValueOnce(120)
        .mockReturnValueOnce(130);

      const throttled = controller._throttle(fn, 100, {
        leading: true,
        trailing: true,
      });

      throttled('first');
      expect(fn).not.toHaveBeenCalled();

      throttled('second');
      expect(fn).toHaveBeenCalledTimes(1);
      expect(clearTimeoutSpy).toHaveBeenCalled();

      clearTimeoutSpy.mockRestore();
      nowSpy.mockRestore();
    });

    it('should register cleanup tasks and execute them in LIFO order during destruction', () => {
      const executionOrder = [];
      controller._registerCleanupTask(() => executionOrder.push('first'), 'first task');
      controller._registerCleanupTask(() => executionOrder.push('second'), 'second task');
      controller._registerCleanupTask(() => {
        executionOrder.push('third');
        throw new Error('cleanup failure');
      }, 'failing task');

      mockLogger.error.mockClear();
      // _executeCleanupTasks doesn't exist - cleanup happens during destroy()
      controller.destroy();

      expect(executionOrder).toEqual(['third', 'second', 'first']);
      expect(mockLogger.error).toHaveBeenCalledWith(
        expect.stringContaining('Cleanup task failed: failing task'),
        expect.any(Error)
      );
    });

    it('should reject invalid cleanup tasks', () => {
      expect(() => controller._registerCleanupTask(null)).toThrow(
        new TypeError('Cleanup task must be a function')
      );
    });
  });
  describe('Initialization and error utilities coverage', () => {
    it('normalizes element configuration from string and object inputs', () => {
      controller = new TestControllerWithPrivates({
        logger: mockLogger,
        characterBuilderService: mockCharacterBuilderService,
        eventBus: mockEventBus,
        schemaValidator: mockSchemaValidator,
      });

      const normalizedString = controller._normalizeElementConfig('.selector');
      expect(normalizedString).toEqual({
        selector: '.selector',
        required: true,
        validate: null,
      });

      const validateFn = jest.fn();
      const normalizedObject = controller._normalizeElementConfig({
        selector: '#component',
        required: false,
        validate: validateFn,
      });

      expect(normalizedObject).toEqual({
        selector: '#component',
        required: false,
        validate: validateFn,
      });
    });

    it('initializes character builder service and additional services when available', async () => {
      mockCharacterBuilderService.initialize.mockResolvedValue();

      controller = new TestControllerWithPrivates({
        logger: mockLogger,
        characterBuilderService: mockCharacterBuilderService,
        eventBus: mockEventBus,
        schemaValidator: mockSchemaValidator,
      });

      const additionalServicesSpy = jest
        .spyOn(controller, '_initializeAdditionalServices')
        .mockResolvedValue();

      await controller._initializeServices();

      expect(mockCharacterBuilderService.initialize).toHaveBeenCalledTimes(1);
      expect(additionalServicesSpy).toHaveBeenCalledTimes(1);
      expect(mockLogger.debug).toHaveBeenCalledWith(
        expect.stringContaining('Initializing CharacterBuilderService')
      );

      additionalServicesSpy.mockRestore();
    });

    it('initializes UI state manager when available and warns when missing', async () => {
      controller = new TestControllerWithPrivates({
        logger: mockLogger,
        characterBuilderService: mockCharacterBuilderService,
        eventBus: mockEventBus,
        schemaValidator: mockSchemaValidator,
      });

      await controller._initializeUIStateManager();
      controller._lastShowStateCall = null;

      await controller._initializeUIState();

      expect(controller._lastShowStateCall).toEqual({
        state: 'empty',
        data: undefined,
      });

      await controller.destroy();

      controller = new TestControllerWithPrivates({
        logger: mockLogger,
        characterBuilderService: mockCharacterBuilderService,
        eventBus: mockEventBus,
        schemaValidator: mockSchemaValidator,
      });

      controller._initializeUIStateManager = undefined;
      mockLogger.warn.mockClear();

      await controller._initializeUIState();

      expect(mockLogger.warn).toHaveBeenCalledWith(
        expect.stringContaining('UIStateManager not available')
      );
    });

    it('handles initialization errors with UI feedback and event dispatch', async () => {
      controller = new TestControllerWithPrivates({
        logger: mockLogger,
        characterBuilderService: mockCharacterBuilderService,
        eventBus: mockEventBus,
        schemaValidator: mockSchemaValidator,
      });

      const initError = new Error('boot failure');
      controller._onInitializationError = jest.fn().mockResolvedValue();

      const showErrorSpy = jest
        .spyOn(controller, '_showError')
        .mockImplementation(() => {});

      await controller._handleInitializationError(initError);

      expect(showErrorSpy).toHaveBeenCalledWith(
        'Failed to initialize page. Please refresh and try again.'
      );
      expect(mockEventBus.dispatch).toHaveBeenCalledWith(
        'SYSTEM_ERROR_OCCURRED',
        expect.objectContaining({
          error: 'boot failure',
          context: expect.stringContaining('initialization'),
        })
      );
      expect(controller._onInitializationError).toHaveBeenCalledWith(
        initError
      );

      showErrorSpy.mockRestore();
    });

    it('falls back to error state when _showError is unavailable', async () => {
      controller = new TestControllerWithPrivates({
        logger: mockLogger,
        characterBuilderService: mockCharacterBuilderService,
        eventBus: mockEventBus,
        schemaValidator: mockSchemaValidator,
      });

      const originalShowError = controller._showError;
      controller._showError = undefined;
      const originalShowState = controller._showState;
      const showStateSpy = jest.fn();
      controller._showState = showStateSpy;
      controller._onInitializationError = jest.fn().mockResolvedValue();

      await controller._handleInitializationError(new Error('fatal'));

      expect(showStateSpy).toHaveBeenCalledWith('error', {
        message: 'Failed to initialize page. Please refresh and try again.',
      });

      controller._showError = originalShowError;
      controller._showState = originalShowState;
    });
  });

  describe('Validation, retry, and recovery utilities coverage', () => {
    it('determines retryable errors based on message content', () => {
      controller = new TestControllerWithPrivates({
        logger: mockLogger,
        characterBuilderService: mockCharacterBuilderService,
        eventBus: mockEventBus,
        schemaValidator: mockSchemaValidator,
      });

      expect(controller._isRetryableError(new Error('Network timeout'))).toBe(
        true
      );
      expect(controller._isRetryableError(new Error('Validation failed'))).toBe(
        false
      );
    });

    it('retries operations when errors are retryable and respects retry delay', async () => {
      controller = new TestControllerWithPrivates({
        logger: mockLogger,
        characterBuilderService: mockCharacterBuilderService,
        eventBus: mockEventBus,
        schemaValidator: mockSchemaValidator,
      });

      const operation = jest
        .fn()
        .mockRejectedValueOnce(new Error('Network unreachable'))
        .mockResolvedValueOnce('success');

      const promise = controller._executeWithErrorHandling(operation, 'loadData', {
        userErrorMessage: 'Unable to load',
        retries: 1,
        retryDelay: 100,
      });

      await Promise.resolve();
      jest.advanceTimersByTime(100);

      const result = await promise;
      expect(result).toBe('success');

      // Verify the operation was called twice (initial + 1 retry)
      expect(operation).toHaveBeenCalledTimes(2);

      // Verify error was logged (indicating handleError was called)
      expect(mockLogger.error).toHaveBeenCalled();
    });

    it('throws non-retryable errors after handling', async () => {
      controller = new TestControllerWithPrivates({
        logger: mockLogger,
        characterBuilderService: mockCharacterBuilderService,
        eventBus: mockEventBus,
        schemaValidator: mockSchemaValidator,
      });

      const failingOperation = jest
        .fn()
        .mockRejectedValue(new Error('validation broke'));

      jest
        .spyOn(controller, '_handleError')
        .mockImplementation(() => ({}));

      await expect(
        controller._executeWithErrorHandling(failingOperation, 'saveData', {
          retries: 1,
        })
      ).rejects.toThrow('validation broke');
    });

    it('validates data successfully and formats validation failures', () => {
      controller = new TestControllerWithPrivates({
        logger: mockLogger,
        characterBuilderService: mockCharacterBuilderService,
        eventBus: mockEventBus,
        schemaValidator: mockSchemaValidator,
      });

      mockSchemaValidator.validate.mockReturnValueOnce({
        isValid: true,
      });

      expect(controller._validateData({ name: 'Alice' }, 'schema')).toEqual({
        isValid: true,
      });

      const ajvErrors = [
        'simple string',
        { instancePath: '/name', message: 'is required' },
        { message: 'missing property' },
      ];

      mockSchemaValidator.validate.mockReturnValueOnce({
        isValid: false,
        errors: ajvErrors,
      });

      const result = controller._validateData({ name: '' }, 'schema', {
        operation: 'submitForm',
      });

      expect(result.isValid).toBe(false);
      expect(result.errors).toEqual([
        'simple string',
        'name: is required',
        'missing property',
      ]);
      expect(result.errorMessage).toContain('Please fix the following errors');
      expect(mockLogger.warn).toHaveBeenCalledWith(
        expect.stringContaining('Validation failed for schema'),
        expect.objectContaining({ schemaId: 'schema' })
      );
    });

    it('handles schema validator exceptions gracefully', () => {
      controller = new TestControllerWithPrivates({
        logger: mockLogger,
        characterBuilderService: mockCharacterBuilderService,
        eventBus: mockEventBus,
        schemaValidator: mockSchemaValidator,
      });

      mockSchemaValidator.validate.mockImplementation(() => {
        throw new Error('schema unavailable');
      });

      const handleErrorSpy = jest
        .spyOn(controller, '_handleError')
        .mockImplementation(() => ({}));

      const result = controller._validateData({ field: 'value' }, 'schema', {
        operation: 'validateData',
      });

      expect(handleErrorSpy).toHaveBeenCalledWith(
        expect.any(Error),
        expect.objectContaining({
          metadata: expect.objectContaining({
            schemaId: 'schema',
            dataKeys: ['field'],
          }),
        })
      );
      expect(result).toEqual({
        isValid: false,
        errors: ['Validation error: schema unavailable'],
        errorMessage: 'Unable to validate data. Please try again.',
      });
    });

    it('builds validation error messages and determines recoverability correctly', () => {
      controller = new TestControllerWithPrivates({
        logger: mockLogger,
        characterBuilderService: mockCharacterBuilderService,
        eventBus: mockEventBus,
        schemaValidator: mockSchemaValidator,
      });

      expect(controller._buildValidationErrorMessage(['Only one'])).toBe(
        'Only one'
      );

      const combinedMessage = controller._buildValidationErrorMessage([
        'First issue',
        'Second issue',
      ]);
      expect(combinedMessage).toContain('• First issue');
      expect(combinedMessage).toContain('• Second issue');

      expect(
        controller._determineRecoverability(new Error('temporary outage'), {
          category: ERROR_CATEGORIES.SYSTEM,
        })
      ).toBe(true);
      expect(
        controller._determineRecoverability(new Error('No network'), {
          category: ERROR_CATEGORIES.NETWORK,
        })
      ).toBe(true);
      expect(
        controller._determineRecoverability(new Error('bad input'), {
          category: ERROR_CATEGORIES.VALIDATION,
        })
      ).toBe(false);
    });

    it('attempts recovery for network and system errors', () => {
      controller = new TestControllerWithPrivates({
        logger: mockLogger,
        characterBuilderService: mockCharacterBuilderService,
        eventBus: mockEventBus,
        schemaValidator: mockSchemaValidator,
      });

      controller._retryLastOperation = jest.fn(() => {
        throw new Error('retry failure');
      });

      controller._attemptErrorRecovery({
        category: ERROR_CATEGORIES.NETWORK,
      });

      jest.advanceTimersByTime(5000);
      expect(controller._retryLastOperation).toHaveBeenCalled();
      expect(mockLogger.error).toHaveBeenCalledWith(
        expect.stringContaining('Recovery retry failed'),
        expect.any(Error)
      );

      controller._reinitialize = jest.fn();
      mockLogger.error.mockClear();

      controller._attemptErrorRecovery({
        category: ERROR_CATEGORIES.SYSTEM,
        operation: 'initialization',
      });

      jest.advanceTimersByTime(2000);
      expect(controller._reinitialize).toHaveBeenCalled();
    });
  });

  describe('Timer and rate limiting helper coverage', () => {
    let originalRequestAnimationFrame;
    let originalCancelAnimationFrame;

    beforeEach(() => {
      originalRequestAnimationFrame = global.requestAnimationFrame;
      originalCancelAnimationFrame = global.cancelAnimationFrame;
    });

    afterEach(() => {
      global.requestAnimationFrame = originalRequestAnimationFrame;
      global.cancelAnimationFrame = originalCancelAnimationFrame;
    });

    it('manages intervals and animation frames correctly', () => {
      controller = new TestControllerWithPrivates({
        logger: mockLogger,
        characterBuilderService: mockCharacterBuilderService,
        eventBus: mockEventBus,
        schemaValidator: mockSchemaValidator,
      });

      const intervalCallback = jest.fn();
      const intervalId = controller._setInterval(intervalCallback, 50);
      jest.advanceTimersByTime(50);
      expect(intervalCallback).toHaveBeenCalledTimes(1);

      controller._clearInterval(intervalId);
      jest.advanceTimersByTime(50);
      expect(intervalCallback).toHaveBeenCalledTimes(1);

      const rafCallbacks = new Map();
      let nextFrameId = 1;

      global.requestAnimationFrame = jest.fn((cb) => {
        const id = nextFrameId++;
        rafCallbacks.set(id, cb);
        return id;
      });

      global.cancelAnimationFrame = jest.fn((id) => {
        rafCallbacks.delete(id);
      });

      const frameCallback = jest.fn();
      const firstFrameId = controller._requestAnimationFrame(frameCallback);
      expect(global.requestAnimationFrame).toHaveBeenCalled();

      controller._cancelAnimationFrame(firstFrameId);
      expect(global.cancelAnimationFrame).toHaveBeenCalledWith(firstFrameId);

      const secondFrameId = controller._requestAnimationFrame(frameCallback);
      const storedCallback = rafCallbacks.get(secondFrameId);
      storedCallback(123);
      expect(frameCallback).toHaveBeenCalledWith(123);
    });

    it('debounces calls with trailing execution, max wait, and utilities', () => {
      controller = new TestControllerWithPrivates({
        logger: mockLogger,
        characterBuilderService: mockCharacterBuilderService,
        eventBus: mockEventBus,
        schemaValidator: mockSchemaValidator,
      });

      jest.setSystemTime(0);
      const trailingFn = jest.fn();
      const debouncedTrailing = controller._debounce(trailingFn, 100, {
        leading: false,
        trailing: true,
        maxWait: 200,
      });

      debouncedTrailing('first');
      expect(debouncedTrailing.pending()).toBe(true);
      jest.advanceTimersByTime(50);
      debouncedTrailing('second');
      jest.advanceTimersByTime(75);
      debouncedTrailing('third');
      jest.advanceTimersByTime(75);

      expect(trailingFn).toHaveBeenCalledTimes(1);
      expect(trailingFn).toHaveBeenCalledWith('third');

      const flushFn = jest.fn();
      const debouncedFlush = controller._debounce(flushFn, 100, {
        leading: false,
        trailing: true,
      });

      debouncedFlush('value');
      debouncedFlush.flush();
      expect(flushFn).toHaveBeenCalledTimes(1);

      debouncedFlush('later');
      debouncedFlush.cancel();
      jest.advanceTimersByTime(200);
      expect(flushFn).toHaveBeenCalledTimes(1);
    });

    it('throttles calls with trailing execution and supports flush', () => {
      controller = new TestControllerWithPrivates({
        logger: mockLogger,
        characterBuilderService: mockCharacterBuilderService,
        eventBus: mockEventBus,
        schemaValidator: mockSchemaValidator,
      });

      jest.setSystemTime(0);
      const throttledFn = jest.fn();
      const throttled = controller._throttle(throttledFn, 100, {
        leading: true,
        trailing: true,
      });

      throttled('initial');
      expect(throttledFn).toHaveBeenCalledTimes(0);

      jest.advanceTimersByTime(100);
      expect(throttledFn).toHaveBeenCalledTimes(1);

      throttled('queued');
      expect(throttledFn).toHaveBeenCalledTimes(1);

      jest.advanceTimersByTime(100);
      expect(throttledFn).toHaveBeenCalledTimes(2);

      const trailingOnlyFn = jest.fn();
      const trailingOnly = controller._throttle(trailingOnlyFn, 100, {
        leading: false,
        trailing: true,
      });

      trailingOnly('first');
      jest.advanceTimersByTime(100);
      expect(trailingOnlyFn).toHaveBeenCalledTimes(1);

      trailingOnly('second');
      trailingOnly.flush();
      expect(trailingOnlyFn).toHaveBeenCalledTimes(2);
    });

    it('reuses debounced and throttled handlers for identical keys', () => {
      controller = new TestControllerWithPrivates({
        logger: mockLogger,
        characterBuilderService: mockCharacterBuilderService,
        eventBus: mockEventBus,
        schemaValidator: mockSchemaValidator,
      });

      const fn = jest.fn();

      const debouncedA = controller._getDebouncedHandler('search', fn, 100);
      const debouncedB = controller._getDebouncedHandler('search', fn, 100);
      expect(debouncedA).toBe(debouncedB);

      const throttledA = controller._getThrottledHandler('scroll', fn, 100);
      const throttledB = controller._getThrottledHandler('scroll', fn, 100);
      expect(throttledA).toBe(throttledB);
    });
  });
});

