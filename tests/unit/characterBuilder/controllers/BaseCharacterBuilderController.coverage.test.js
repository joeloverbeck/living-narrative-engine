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
      subscribe: jest.fn(),
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

  describe('Optional Method Handling (lines 1875-1884)', () => {
    it('should throw error when required method is missing', async () => {
      controller = new MinimalTestController({
        logger: mockLogger,
        characterBuilderService: mockCharacterBuilderService,
        eventBus: mockEventBus,
        schemaValidator: mockSchemaValidator,
      });

      // Test calling a phase with a missing required method
      await expect(
        controller._executeLifecycleMethod(
          '_requiredMethod',
          'requiredPhase',
          true
        )
      ).rejects.toThrow(
        'MinimalTestController must implement _requiredMethod() method'
      );
    });

    it('should skip optional method when not implemented', async () => {
      controller = new MinimalTestController({
        logger: mockLogger,
        characterBuilderService: mockCharacterBuilderService,
        eventBus: mockEventBus,
        schemaValidator: mockSchemaValidator,
      });

      // Test calling a phase with a missing optional method
      await controller._executeLifecycleMethod(
        '_optionalMethod',
        'optionalPhase',
        false
      );

      // Verify debug message was logged
      expect(mockLogger.debug).toHaveBeenCalledWith(
        expect.stringContaining(
          'Skipping optionalPhase (method not implemented)'
        )
      );
    });
  });

  describe('Error Display Fallback (lines 2055-2056)', () => {
    it('should fallback to _showState when _showError is not available', async () => {
      controller = new TestControllerWithPrivates({
        logger: mockLogger,
        characterBuilderService: mockCharacterBuilderService,
        eventBus: mockEventBus,
        schemaValidator: mockSchemaValidator,
      });

      // Remove _showError method
      delete controller._showError;

      // Trigger initialization error handling
      const error = new Error('Test initialization error');
      error.phase = 'test-phase';

      controller._handleInitializationError(error);

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

    it('should display errors using the best available presentation method', () => {
      const errorDetails = {
        userMessage: 'Primary error',
        category: ERROR_CATEGORIES.SYSTEM,
        severity: ERROR_SEVERITY.ERROR,
      };

      controller._showError = jest.fn();
      controller._showErrorToUser(errorDetails);
      expect(controller._showError).toHaveBeenCalledWith('Primary error');

      controller._showError = undefined;
      controller._showState = jest.fn();
      controller._showErrorToUser({
        userMessage: 'Fallback error',
        category: ERROR_CATEGORIES.NETWORK,
        severity: ERROR_SEVERITY.WARNING,
      });
      expect(controller._showState).toHaveBeenCalledWith(
        'error',
        expect.objectContaining({
          message: 'Fallback error',
        })
      );

      const originalConsoleError = console.error;
      const consoleSpy = jest.fn();
      console.error = consoleSpy;
      controller._showState = undefined;
      controller._showErrorToUser({
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
      controller._showErrorToUser = jest.fn();
      controller._attemptErrorRecovery = jest.fn();

      const result = controller._handleError(new Error('network outage'), {
        operation: 'fetchData',
        category: ERROR_CATEGORIES.NETWORK,
        metadata: { retryCount: 1 },
      });

      expect(controller._showErrorToUser).toHaveBeenCalledWith(result);
      expect(controller._attemptErrorRecovery).toHaveBeenCalledWith(
        expect.objectContaining({ category: ERROR_CATEGORIES.NETWORK })
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
    });

    it('should handle validators that return non-array errors', () => {
      mockSchemaValidator.validate.mockReturnValue({
        isValid: false,
        errors: null,
      });

      const result = controller._validateData({}, 'emptySchema');

      expect(result.isValid).toBe(false);
      expect(result.errors).toEqual(['Invalid data format']);
      expect(result.errorMessage).toBe('Invalid data format');
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

    it('should register cleanup tasks and execute them in LIFO order', () => {
      const executionOrder = [];
      controller._registerCleanupTask(() => executionOrder.push('first'), 'first task');
      controller._registerCleanupTask(() => executionOrder.push('second'), 'second task');
      controller._registerCleanupTask(() => {
        executionOrder.push('third');
        throw new Error('cleanup failure');
      }, 'failing task');

      mockLogger.error.mockClear();
      controller._executeCleanupTasks();

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
});
