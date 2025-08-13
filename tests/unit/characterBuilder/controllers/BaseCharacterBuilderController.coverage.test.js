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
});
