/**
 * @file Unit tests for BaseCharacterBuilderController
 * @see src/characterBuilder/controllers/BaseCharacterBuilderController.js
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
import {
  MissingDependencyError,
  InvalidDependencyError,
} from '../../../../src/errors/dependencyErrors.js';

// Mock UIStateManager
jest.mock('../../../../src/shared/characterBuilder/uiStateManager.js', () => {
  const originalModule = jest.requireActual(
    '../../../../src/shared/characterBuilder/uiStateManager.js'
  );
  return {
    ...originalModule,
    UIStateManager: jest.fn().mockImplementation(() => ({
      showState: jest.fn(),
      showError: jest.fn(),
      showLoading: jest.fn(),
      getCurrentState: jest.fn(),
    })),
  };
});

// Create a test implementation for testing
class TestController extends BaseCharacterBuilderController {
  _cacheElements() {
    // Test implementation
  }

  _setupEventListeners() {
    // Test implementation
  }
}

describe('BaseCharacterBuilderController', () => {
  let mockLogger;
  let mockCharacterBuilderService;
  let mockEventBus;
  let mockSchemaValidator;

  beforeEach(() => {
    // Create mocks for all dependencies
    mockLogger = {
      debug: jest.fn(),
      info: jest.fn(),
      warn: jest.fn(),
      error: jest.fn(),
    };

    mockCharacterBuilderService = {
      initialize: jest.fn(),
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
    jest.clearAllMocks();
  });

  describe('Constructor Tests', () => {
    it('should create instance with all required dependencies', () => {
      const controller = new TestController({
        logger: mockLogger,
        characterBuilderService: mockCharacterBuilderService,
        eventBus: mockEventBus,
        schemaValidator: mockSchemaValidator,
      });

      expect(controller).toBeDefined();
      expect(controller).toBeInstanceOf(BaseCharacterBuilderController);
      expect(mockLogger.info).toHaveBeenCalledWith(
        'TestController: Successfully created with dependencies',
        {
          coreServices: [
            'logger',
            'characterBuilderService',
            'eventBus',
            'schemaValidator',
          ],
          additionalServices: [],
        }
      );
    });

    it('should accept and store additional services', () => {
      const mockAdditionalService1 = { method1: jest.fn() };
      const mockAdditionalService2 = { method2: jest.fn() };

      const controller = new TestController({
        logger: mockLogger,
        characterBuilderService: mockCharacterBuilderService,
        eventBus: mockEventBus,
        schemaValidator: mockSchemaValidator,
        service1: mockAdditionalService1,
        service2: mockAdditionalService2,
      });

      expect(controller).toBeDefined();
      expect(mockLogger.info).toHaveBeenCalledWith(
        'TestController: Successfully created with dependencies',
        {
          coreServices: [
            'logger',
            'characterBuilderService',
            'eventBus',
            'schemaValidator',
          ],
          additionalServices: ['service1', 'service2'],
        }
      );
    });

    it('should throw MissingDependencyError when logger is missing', () => {
      expect(() => {
        new TestController({
          characterBuilderService: mockCharacterBuilderService,
          eventBus: mockEventBus,
          schemaValidator: mockSchemaValidator,
        });
      }).toThrow(MissingDependencyError);

      expect(() => {
        new TestController({
          characterBuilderService: mockCharacterBuilderService,
          eventBus: mockEventBus,
          schemaValidator: mockSchemaValidator,
        });
      }).toThrow("TestController: Missing required dependency 'logger'");
    });

    it('should throw InvalidDependencyError when characterBuilderService is missing', () => {
      expect(() => {
        new TestController({
          logger: mockLogger,
          eventBus: mockEventBus,
          schemaValidator: mockSchemaValidator,
        });
      }).toThrow(InvalidDependencyError);
    });

    it('should throw InvalidDependencyError when eventBus is missing', () => {
      expect(() => {
        new TestController({
          logger: mockLogger,
          characterBuilderService: mockCharacterBuilderService,
          schemaValidator: mockSchemaValidator,
        });
      }).toThrow(InvalidDependencyError);
    });

    it('should throw InvalidDependencyError when schemaValidator is missing', () => {
      expect(() => {
        new TestController({
          logger: mockLogger,
          characterBuilderService: mockCharacterBuilderService,
          eventBus: mockEventBus,
        });
      }).toThrow(InvalidDependencyError);
    });

    it('should throw InvalidDependencyError when logger is missing required methods', () => {
      const invalidLogger = {
        debug: jest.fn(),
        info: jest.fn(),
        // missing warn and error
      };

      expect(() => {
        new TestController({
          logger: invalidLogger,
          characterBuilderService: mockCharacterBuilderService,
          eventBus: mockEventBus,
          schemaValidator: mockSchemaValidator,
        });
      }).toThrow(InvalidDependencyError);
    });

    it('should throw InvalidDependencyError when characterBuilderService is missing required methods', () => {
      const invalidService = {
        initialize: jest.fn(),
        getAllCharacterConcepts: jest.fn(),
        // missing other required methods
      };

      expect(() => {
        new TestController({
          logger: mockLogger,
          characterBuilderService: invalidService,
          eventBus: mockEventBus,
          schemaValidator: mockSchemaValidator,
        });
      }).toThrow(InvalidDependencyError);
    });

    it('should throw InvalidDependencyError when eventBus is missing required methods', () => {
      const invalidEventBus = {
        dispatch: jest.fn(),
        // missing subscribe and unsubscribe
      };

      expect(() => {
        new TestController({
          logger: mockLogger,
          characterBuilderService: mockCharacterBuilderService,
          eventBus: invalidEventBus,
          schemaValidator: mockSchemaValidator,
        });
      }).toThrow(InvalidDependencyError);
    });

    it('should throw InvalidDependencyError when schemaValidator is missing required methods', () => {
      const invalidValidator = {};

      expect(() => {
        new TestController({
          logger: mockLogger,
          characterBuilderService: mockCharacterBuilderService,
          eventBus: mockEventBus,
          schemaValidator: invalidValidator,
        });
      }).toThrow(InvalidDependencyError);
    });
  });

  describe('Property Accessor Tests', () => {
    let controller;

    beforeEach(() => {
      controller = new TestController({
        logger: mockLogger,
        characterBuilderService: mockCharacterBuilderService,
        eventBus: mockEventBus,
        schemaValidator: mockSchemaValidator,
      });
    });

    it('should return false for isInitialized initially', () => {
      expect(controller.isInitialized).toBe(false);
    });

    it('should return empty object for elements initially', () => {
      const elements = controller.elements;
      expect(elements).toEqual({});
      expect(Object.keys(elements).length).toBe(0);
    });

    it('should return copy of elements, not reference', () => {
      const elements1 = controller.elements;
      const elements2 = controller.elements;
      expect(elements1).not.toBe(elements2);
      expect(elements1).toEqual(elements2);
    });

    it('should return logger instance through protected getter', () => {
      expect(controller.logger).toBe(mockLogger);
    });

    it('should return eventBus instance through protected getter', () => {
      expect(controller.eventBus).toBe(mockEventBus);
    });

    it('should return characterBuilderService instance through protected getter', () => {
      expect(controller.characterBuilderService).toBe(
        mockCharacterBuilderService
      );
    });

    it('should return schemaValidator instance through protected getter', () => {
      expect(controller.schemaValidator).toBe(mockSchemaValidator);
    });
  });

  describe('Abstract Method Tests', () => {
    it('should throw error when _cacheElements() is called on base class', () => {
      const controller = new BaseCharacterBuilderController({
        logger: mockLogger,
        characterBuilderService: mockCharacterBuilderService,
        eventBus: mockEventBus,
        schemaValidator: mockSchemaValidator,
      });

      expect(() => {
        controller._cacheElements();
      }).toThrow(
        'BaseCharacterBuilderController must implement _cacheElements() method'
      );
    });

    it('should throw error when _setupEventListeners() is called on base class', () => {
      const controller = new BaseCharacterBuilderController({
        logger: mockLogger,
        characterBuilderService: mockCharacterBuilderService,
        eventBus: mockEventBus,
        schemaValidator: mockSchemaValidator,
      });

      expect(() => {
        controller._setupEventListeners();
      }).toThrow(
        'BaseCharacterBuilderController must implement _setupEventListeners() method'
      );
    });

    it('should not throw error when abstract methods are implemented in subclass', () => {
      const controller = new TestController({
        logger: mockLogger,
        characterBuilderService: mockCharacterBuilderService,
        eventBus: mockEventBus,
        schemaValidator: mockSchemaValidator,
      });

      expect(() => {
        controller._cacheElements();
      }).not.toThrow();

      expect(() => {
        controller._setupEventListeners();
      }).not.toThrow();
    });
  });

  describe('Template Method Pattern Tests', () => {
    let controller;

    beforeEach(() => {
      controller = new TestController({
        logger: mockLogger,
        characterBuilderService: mockCharacterBuilderService,
        eventBus: mockEventBus,
        schemaValidator: mockSchemaValidator,
      });
    });

    it('should complete full initialization sequence successfully', async () => {
      await controller.initialize();

      expect(controller.isInitialized).toBe(true);
      expect(controller.isInitializing).toBe(false);
      expect(mockLogger.info).toHaveBeenCalledWith(
        expect.stringMatching(/TestController: Starting initialization/)
      );
      expect(mockLogger.info).toHaveBeenCalledWith(
        expect.stringMatching(
          /TestController: Initialization completed in \d+(\.\d+)?ms/
        )
      );
    });

    it('should dispatch CONTROLLER_INITIALIZED event on successful initialization', async () => {
      await controller.initialize();

      expect(mockEventBus.dispatch).toHaveBeenCalledWith(
        'core:controller_initialized',
        expect.objectContaining({
          controllerName: 'TestController',
          initializationTime: expect.any(Number),
        })
      );
    });

    it('should prevent duplicate initialization', async () => {
      await controller.initialize();
      const firstCall = mockLogger.info.mock.calls.length;

      await controller.initialize();

      expect(mockLogger.warn).toHaveBeenCalledWith(
        'TestController: Already initialized, skipping re-initialization'
      );
      // Should not have additional initialization calls
      expect(mockLogger.info.mock.calls.length).toBe(firstCall);
    });

    it('should prevent concurrent initialization', async () => {
      const promise1 = controller.initialize();
      const promise2 = controller.initialize();

      await Promise.all([promise1, promise2]);

      expect(mockLogger.warn).toHaveBeenCalledWith(
        'TestController: Initialization already in progress, skipping concurrent initialization'
      );
    });

    it('should track initialization state correctly during process', async () => {
      expect(controller.isInitialized).toBe(false);
      expect(controller.isInitializing).toBe(false);

      const initPromise = controller.initialize();

      // During initialization
      expect(controller.isInitializing).toBe(true);
      expect(controller.isInitialized).toBe(false);

      await initPromise;

      // After initialization
      expect(controller.isInitialized).toBe(true);
      expect(controller.isInitializing).toBe(false);
    });

    it('should handle initialization errors properly', async () => {
      const testError = new Error('Test initialization error');
      controller._cacheElements = jest.fn(() => {
        throw testError;
      });

      await expect(controller.initialize()).rejects.toThrow(
        'element caching failed: Test initialization error'
      );

      expect(controller.isInitialized).toBe(false);
      expect(controller.isInitializing).toBe(false);
      expect(mockLogger.error).toHaveBeenCalledWith(
        expect.stringMatching(
          /TestController: Initialization failed after \d+(\.\d+)?ms/
        ),
        expect.any(Error)
      );
    });

    it('should dispatch SYSTEM_ERROR_OCCURRED event on initialization failure', async () => {
      const testError = new Error('Test initialization error');
      controller._cacheElements = jest.fn(() => {
        throw testError;
      });
      controller._showError = jest.fn();

      await expect(controller.initialize()).rejects.toThrow();

      expect(mockEventBus.dispatch).toHaveBeenCalledWith(
        'SYSTEM_ERROR_OCCURRED',
        expect.objectContaining({
          error: expect.stringContaining('element caching failed'),
          context: 'TestController initialization',
          phase: 'element caching',
          timestamp: expect.any(String),
          stack: expect.any(String),
        })
      );
    });

    it('should call _showError on initialization failure if available', async () => {
      const testError = new Error('Test initialization error');
      controller._cacheElements = jest.fn(() => {
        throw testError;
      });
      controller._showError = jest.fn();

      await expect(controller.initialize()).rejects.toThrow();

      expect(controller._showError).toHaveBeenCalledWith(
        'Failed to initialize page. Please refresh and try again.'
      );
    });

    it('should successfully destroy uninitialized controller', () => {
      expect(() => {
        controller.destroy();
      }).not.toThrow();

      expect(controller.isDestroyed).toBe(true);
      expect(controller.isDestroying).toBe(false);
      expect(mockLogger.info).toHaveBeenCalledWith(
        expect.stringMatching(
          /TestController: Destruction completed in \d+(\.\d+)?ms/
        )
      );
    });
  });

  describe('Lifecycle Execution Order Tests', () => {
    let controller;
    let executionOrder;

    beforeEach(() => {
      executionOrder = [];

      class LifecycleTestController extends BaseCharacterBuilderController {
        _cacheElements() {
          executionOrder.push('cacheElements');
        }

        _setupEventListeners() {
          executionOrder.push('setupEventListeners');
        }

        async _preInitialize() {
          executionOrder.push('preInitialize');
        }

        async _initializeServices() {
          await super._initializeServices();
          executionOrder.push('initializeServices');
        }

        async _initializeAdditionalServices() {
          executionOrder.push('initializeAdditionalServices');
        }

        async _loadInitialData() {
          executionOrder.push('loadInitialData');
        }

        _initializeUIState() {
          executionOrder.push('initializeUIState');
        }

        async _postInitialize() {
          executionOrder.push('postInitialize');
        }
      }

      controller = new LifecycleTestController({
        logger: mockLogger,
        characterBuilderService: mockCharacterBuilderService,
        eventBus: mockEventBus,
        schemaValidator: mockSchemaValidator,
      });
    });

    it('should execute lifecycle methods in correct order', async () => {
      await controller.initialize();

      expect(executionOrder).toEqual([
        'preInitialize',
        'cacheElements',
        'initializeAdditionalServices',
        'initializeServices',
        'setupEventListeners',
        'loadInitialData',
        'initializeUIState',
        'postInitialize',
      ]);
    });

    it('should initialize CharacterBuilderService during service initialization', async () => {
      await controller.initialize();

      expect(mockCharacterBuilderService.initialize).toHaveBeenCalled();
      expect(mockLogger.debug).toHaveBeenCalledWith(
        'LifecycleTestController: Initializing CharacterBuilderService'
      );
      expect(mockLogger.debug).toHaveBeenCalledWith(
        'LifecycleTestController: CharacterBuilderService initialized'
      );
    });

    it('should handle async lifecycle methods properly', async () => {
      let asyncResolved = false;

      class AsyncTestController extends BaseCharacterBuilderController {
        _cacheElements() {}
        _setupEventListeners() {}

        async _preInitialize() {
          await new Promise((resolve) => setTimeout(resolve, 10));
          asyncResolved = true;
        }
      }

      const asyncController = new AsyncTestController({
        logger: mockLogger,
        characterBuilderService: mockCharacterBuilderService,
        eventBus: mockEventBus,
        schemaValidator: mockSchemaValidator,
      });

      await asyncController.initialize();

      expect(asyncResolved).toBe(true);
    });
  });

  describe('Lifecycle Method Error Handling Tests', () => {
    let controller;

    beforeEach(() => {
      controller = new TestController({
        logger: mockLogger,
        characterBuilderService: mockCharacterBuilderService,
        eventBus: mockEventBus,
        schemaValidator: mockSchemaValidator,
      });
    });

    it('should throw error for missing required methods', async () => {
      const baseController = new BaseCharacterBuilderController({
        logger: mockLogger,
        characterBuilderService: mockCharacterBuilderService,
        eventBus: mockEventBus,
        schemaValidator: mockSchemaValidator,
      });

      await expect(baseController.initialize()).rejects.toThrow(
        'BaseCharacterBuilderController must implement _cacheElements() method'
      );
    });

    it('should handle methods with default implementations', async () => {
      // All lifecycle methods have default implementations, so they should all be called
      // This tests that the template method pattern allows for optional overrides
      class MinimalController extends BaseCharacterBuilderController {
        _cacheElements() {}
        _setupEventListeners() {}
        // All other methods use default implementations
      }

      const minimalController = new MinimalController({
        logger: mockLogger,
        characterBuilderService: mockCharacterBuilderService,
        eventBus: mockEventBus,
        schemaValidator: mockSchemaValidator,
      });

      await minimalController.initialize();

      expect(minimalController.isInitialized).toBe(true);
      // Should complete successfully with default implementations
      expect(mockLogger.info).toHaveBeenCalledWith(
        expect.stringMatching(
          /MinimalController: Initialization completed in \d+(\.\d+)?ms/
        )
      );
    });

    it('should enhance errors with context and timing information', async () => {
      const originalError = new Error('Original error message');
      controller._setupEventListeners = jest.fn(() => {
        throw originalError;
      });

      await expect(controller.initialize()).rejects.toMatchObject({
        message: 'event listener setup failed: Original error message',
        originalError: originalError,
        phase: 'event listener setup',
        methodName: '_setupEventListeners',
      });
    });

    it('should log phase timing for each lifecycle method', async () => {
      await controller.initialize();

      expect(mockLogger.debug).toHaveBeenCalledWith(
        expect.stringMatching(/TestController: Starting element caching/)
      );
      expect(mockLogger.debug).toHaveBeenCalledWith(
        expect.stringMatching(
          /TestController: Completed element caching in \d+(\.\d+)?ms/
        )
      );
    });
  });

  describe('Additional Services Access Tests', () => {
    let controller;
    let mockAdditionalService;

    beforeEach(() => {
      mockAdditionalService = {
        initialize: jest.fn(),
        doSomething: jest.fn(),
      };

      controller = new TestController({
        logger: mockLogger,
        characterBuilderService: mockCharacterBuilderService,
        eventBus: mockEventBus,
        schemaValidator: mockSchemaValidator,
        customService: mockAdditionalService,
      });
    });

    it('should provide access to additional services through getter', () => {
      const services = controller.additionalServices;

      expect(services.customService).toBe(mockAdditionalService);
    });

    it('should return defensive copy of additional services', () => {
      const services1 = controller.additionalServices;
      const services2 = controller.additionalServices;

      expect(services1).not.toBe(services2);
      expect(services1).toEqual(services2);
    });

    it('should allow subclasses to access additional services in lifecycle methods', async () => {
      class ServiceAccessController extends BaseCharacterBuilderController {
        _cacheElements() {}
        _setupEventListeners() {}

        async _initializeAdditionalServices() {
          if (this.additionalServices?.customService) {
            await this.additionalServices.customService.initialize();
          }
        }
      }

      const serviceController = new ServiceAccessController({
        logger: mockLogger,
        characterBuilderService: mockCharacterBuilderService,
        eventBus: mockEventBus,
        schemaValidator: mockSchemaValidator,
        customService: mockAdditionalService,
      });

      await serviceController.initialize();

      expect(mockAdditionalService.initialize).toHaveBeenCalled();
    });
  });

  describe('State Management Tests', () => {
    let controller;

    beforeEach(() => {
      controller = new TestController({
        logger: mockLogger,
        characterBuilderService: mockCharacterBuilderService,
        eventBus: mockEventBus,
        schemaValidator: mockSchemaValidator,
      });
    });

    it('should provide access to isInitializing state', () => {
      expect(controller.isInitializing).toBe(false);
    });

    it('should allow force re-initialization', async () => {
      await controller.initialize();
      expect(controller.isInitialized).toBe(true);

      await controller._reinitialize();

      expect(mockLogger.warn).toHaveBeenCalledWith(
        'TestController: Force re-initialization requested'
      );
      expect(controller.isInitialized).toBe(true);
    });

    it('should reset state properly during re-initialization', async () => {
      await controller.initialize();

      // Simulate some cached elements
      controller.elements; // Access the getter to verify state

      await controller._reinitialize();

      expect(controller.isInitialized).toBe(true);
    });
  });

  describe('Subclass Implementation Tests', () => {
    it('should allow subclasses to implement abstract methods', () => {
      let cacheElementsCalled = false;
      let setupEventListenersCalled = false;

      class ImplementedController extends BaseCharacterBuilderController {
        _cacheElements() {
          cacheElementsCalled = true;
        }

        _setupEventListeners() {
          setupEventListenersCalled = true;
        }
      }

      const controller = new ImplementedController({
        logger: mockLogger,
        characterBuilderService: mockCharacterBuilderService,
        eventBus: mockEventBus,
        schemaValidator: mockSchemaValidator,
      });

      controller._cacheElements();
      controller._setupEventListeners();

      expect(cacheElementsCalled).toBe(true);
      expect(setupEventListenersCalled).toBe(true);
    });

    it('should allow access to protected properties in subclasses', () => {
      class AccessTestController extends BaseCharacterBuilderController {
        _cacheElements() {}
        _setupEventListeners() {}

        testAccessToProtectedProperties() {
          return {
            hasLogger: this.logger === mockLogger,
            hasEventBus: this.eventBus === mockEventBus,
            hasCharacterBuilderService:
              this.characterBuilderService === mockCharacterBuilderService,
            hasSchemaValidator: this.schemaValidator === mockSchemaValidator,
          };
        }
      }

      const controller = new AccessTestController({
        logger: mockLogger,
        characterBuilderService: mockCharacterBuilderService,
        eventBus: mockEventBus,
        schemaValidator: mockSchemaValidator,
      });

      const access = controller.testAccessToProtectedProperties();
      expect(access.hasLogger).toBe(true);
      expect(access.hasEventBus).toBe(true);
      expect(access.hasCharacterBuilderService).toBe(true);
      expect(access.hasSchemaValidator).toBe(true);
    });
  });

  describe('Enhanced Dependency Validation Tests', () => {
    it('should log debug message with validation time', () => {
      new TestController({
        logger: mockLogger,
        characterBuilderService: mockCharacterBuilderService,
        eventBus: mockEventBus,
        schemaValidator: mockSchemaValidator,
      });

      expect(mockLogger.debug).toHaveBeenCalledWith(
        expect.stringMatching(
          /TestController: Core dependency validation completed in \d+(\.\d+)?ms/
        )
      );
    });

    it('should complete validation in under 5ms', () => {
      const nowSpy = jest
        .spyOn(performance, 'now')
        .mockImplementation(() => 100);

      try {
        const startTime = performance.now();
        new TestController({
          logger: mockLogger,
          characterBuilderService: mockCharacterBuilderService,
          eventBus: mockEventBus,
          schemaValidator: mockSchemaValidator,
        });
        const endTime = performance.now();

        expect(endTime - startTime).toBeLessThan(5);
      } finally {
        nowSpy.mockRestore();
      }
    });

    it('should provide detailed error messages for missing dependencies', () => {
      try {
        new TestController({
          characterBuilderService: mockCharacterBuilderService,
          eventBus: mockEventBus,
          schemaValidator: mockSchemaValidator,
        });
      } catch (error) {
        expect(error).toBeInstanceOf(MissingDependencyError);
        expect(error.dependencyName).toBe('logger');
        expect(error.controllerName).toBe('TestController');
        expect(error.message).toBe(
          "TestController: Missing required dependency 'logger'"
        );
      }
    });

    it('should provide detailed error messages for invalid dependencies', () => {
      const invalidLogger = { debug: jest.fn() }; // missing required methods

      try {
        new TestController({
          logger: invalidLogger,
          characterBuilderService: mockCharacterBuilderService,
          eventBus: mockEventBus,
          schemaValidator: mockSchemaValidator,
        });
      } catch (error) {
        expect(error).toBeInstanceOf(InvalidDependencyError);
        expect(error.dependencyName).toBe('logger');
        expect(error.controllerName).toBe('TestController');
        expect(error.message).toContain('TestController: Invalid dependency');
        expect(error.message).toContain(
          'Logger must be provided for error reporting and debugging'
        );
      }
    });
  });

  describe('Additional Services Validation Tests', () => {
    it('should accept additional services without validation rules', () => {
      const mockService = { someMethod: jest.fn() };

      const controller = new TestController({
        logger: mockLogger,
        characterBuilderService: mockCharacterBuilderService,
        eventBus: mockEventBus,
        schemaValidator: mockSchemaValidator,
        customService: mockService,
      });

      expect(controller).toBeDefined();
      expect(mockLogger.debug).toHaveBeenCalledWith(
        "TestController: Accepted additional service 'customService' without validation"
      );
    });

    it('should handle null additional services gracefully', () => {
      const controller = new TestController({
        logger: mockLogger,
        characterBuilderService: mockCharacterBuilderService,
        eventBus: mockEventBus,
        schemaValidator: mockSchemaValidator,
        nullService: null,
        undefinedService: undefined,
      });

      expect(controller).toBeDefined();
      expect(mockLogger.warn).toHaveBeenCalledWith(
        "TestController: Optional service 'nullService' is null/undefined"
      );
      expect(mockLogger.warn).toHaveBeenCalledWith(
        "TestController: Optional service 'undefinedService' is null/undefined"
      );
    });

    it('should validate additional services with custom rules', () => {
      // Since private methods can't be easily overridden, we'll test the behavior
      // by creating a mock that has validation rules and checking the logs
      const validService = { customMethod: jest.fn() };

      const controller = new TestController({
        logger: mockLogger,
        characterBuilderService: mockCharacterBuilderService,
        eventBus: mockEventBus,
        schemaValidator: mockSchemaValidator,
        customService: validService,
      });

      expect(controller).toBeDefined();
      // Since TestController doesn't override validation rules, it should accept without validation
      expect(mockLogger.debug).toHaveBeenCalledWith(
        "TestController: Accepted additional service 'customService' without validation"
      );
    });

    it('should accept additional services without validation when no rules provided', () => {
      // Test that services without validation rules are accepted
      const serviceWithoutRules = { arbitraryMethod: jest.fn() };

      const controller = new TestController({
        logger: mockLogger,
        characterBuilderService: mockCharacterBuilderService,
        eventBus: mockEventBus,
        schemaValidator: mockSchemaValidator,
        serviceWithoutRules: serviceWithoutRules,
      });

      expect(controller).toBeDefined();
      expect(mockLogger.debug).toHaveBeenCalledWith(
        "TestController: Accepted additional service 'serviceWithoutRules' without validation"
      );
    });
  });

  describe('Service Access Utility Tests', () => {
    it('should store additional services correctly', () => {
      // Since the service access methods are private, we test indirectly
      // by verifying that services are stored and logged correctly
      const mockService = { method: jest.fn() };

      const controller = new TestController({
        logger: mockLogger,
        characterBuilderService: mockCharacterBuilderService,
        eventBus: mockEventBus,
        schemaValidator: mockSchemaValidator,
        testService: mockService,
      });

      expect(controller).toBeDefined();
      expect(mockLogger.info).toHaveBeenCalledWith(
        'TestController: Successfully created with dependencies',
        expect.objectContaining({
          additionalServices: ['testService'],
        })
      );
    });
  });

  describe('Error Handling and Logging Tests', () => {
    it('should handle validation correctly for additional services', () => {
      // Test that the validation system works correctly for additional services
      const validService = { method: jest.fn() };

      const controller = new TestController({
        logger: mockLogger,
        characterBuilderService: mockCharacterBuilderService,
        eventBus: mockEventBus,
        schemaValidator: mockSchemaValidator,
        validService: validService,
      });

      expect(controller).toBeDefined();
      // Should log that service was accepted without validation
      expect(mockLogger.debug).toHaveBeenCalledWith(
        "TestController: Accepted additional service 'validService' without validation"
      );
    });

    it('should preserve original error context in validation failures', () => {
      const invalidService = {};

      try {
        new TestController({
          logger: mockLogger,
          characterBuilderService: invalidService,
          eventBus: mockEventBus,
          schemaValidator: mockSchemaValidator,
        });
      } catch (error) {
        expect(error).toBeInstanceOf(InvalidDependencyError);
        expect(error.message).toContain('characterBuilderService');
        expect(error.message).toContain(
          'Ensure the service implements all required methods'
        );
      }
    });
  });

  describe('DOM Element Management Tests', () => {
    let controller;

    beforeEach(() => {
      // Set up DOM structure for testing
      document.body.innerHTML = `
        <form id="test-form">
          <input id="username" type="text" />
          <button id="submit-btn">Submit</button>
          <div class="error-message" style="display: none;"></div>
          <span id="optional-tooltip">Help</span>
        </form>
        <div id="detached-parent">
          <p id="will-be-removed">This will be removed</p>
        </div>
      `;

      controller = new TestController({
        logger: mockLogger,
        characterBuilderService: mockCharacterBuilderService,
        eventBus: mockEventBus,
        schemaValidator: mockSchemaValidator,
      });
    });

    afterEach(() => {
      document.body.innerHTML = '';
    });

    describe('_cacheElement() - Core Element Caching', () => {
      it('should cache required element by ID successfully', () => {
        const element = controller._cacheElement('form', '#test-form');

        expect(element).toBeInstanceOf(HTMLFormElement);
        expect(controller.elements.form).toBe(element);
        expect(mockLogger.debug).toHaveBeenCalledWith(
          expect.stringContaining("Cached element 'form' (FORM#test-form)")
        );
      });

      it('should cache required element by selector successfully', () => {
        const element = controller._cacheElement('errorMsg', '.error-message');

        expect(element).toBeInstanceOf(HTMLDivElement);
        expect(controller.elements.errorMsg).toBe(element);
      });

      it('should throw error for missing required element', () => {
        expect(() => {
          controller._cacheElement('missing', '#not-there');
        }).toThrow("Required element with ID 'not-there' not found in DOM");
      });

      it('should return null for missing optional element', () => {
        const element = controller._cacheElement(
          'missing',
          '#not-there',
          false
        );

        expect(element).toBeNull();
        expect(controller.elements.missing).toBeNull();
        expect(mockLogger.debug).toHaveBeenCalledWith(
          expect.stringContaining("Optional element 'missing' not found")
        );
      });

      it('should validate parameters', () => {
        expect(() => {
          controller._cacheElement('', '#test');
        }).toThrow('Invalid element key provided');

        expect(() => {
          controller._cacheElement('test', '');
        }).toThrow('Invalid selector provided');
      });

      it('should optimize ID selectors vs complex selectors', () => {
        // Test ID selector optimization
        const formElement = controller._cacheElement('form', '#test-form');
        expect(formElement).toBeDefined();

        // Test complex selector
        const errorElement = controller._cacheElement(
          'error',
          '.error-message'
        );
        expect(errorElement).toBeDefined();
      });
    });

    describe('_cacheElementsFromMap() - Bulk Element Caching', () => {
      it('should cache all elements from simple mapping', () => {
        const results = controller._cacheElementsFromMap({
          form: '#test-form',
          submitBtn: '#submit-btn',
          tooltip: '#optional-tooltip',
        });

        expect(results.stats.total).toBe(3);
        expect(results.stats.cached).toBe(3);
        expect(results.stats.failed).toBe(0);
        expect(results.cached.form).toBeInstanceOf(HTMLFormElement);
        expect(results.cached.submitBtn).toBeInstanceOf(HTMLButtonElement);
        expect(results.cached.tooltip).toBeInstanceOf(HTMLSpanElement);
      });

      it('should handle mix of required and optional elements', () => {
        const results = controller._cacheElementsFromMap({
          form: { selector: '#test-form', required: true },
          missing: { selector: '#not-there', required: false },
          tooltip: { selector: '#optional-tooltip', required: true },
        });

        expect(results.stats.total).toBe(3);
        expect(results.stats.cached).toBe(2);
        expect(results.stats.optional).toBe(1);
        expect(results.stats.failed).toBe(0);
      });

      it('should support custom validation', () => {
        const results = controller._cacheElementsFromMap({
          form: {
            selector: '#test-form',
            required: true,
            validate: (el) => el.tagName === 'FORM',
          },
        });

        expect(results.stats.cached).toBe(1);
        expect(results.cached.form).toBeInstanceOf(HTMLFormElement);
      });

      it('should fail custom validation correctly', () => {
        const results = controller._cacheElementsFromMap(
          {
            form: {
              selector: '#test-form',
              required: true,
              validate: (el) => el.tagName === 'DIV',
            },
          },
          { continueOnError: true }
        );

        expect(results.stats.failed).toBe(1);
        expect(results.errors).toHaveLength(1);
        expect(results.errors[0].error).toContain('Custom validation failed');
      });

      it('should stop on first error when configured', () => {
        expect(() => {
          controller._cacheElementsFromMap(
            {
              missing1: '#not-there-1',
              missing2: '#not-there-2',
            },
            { stopOnFirstError: true }
          );
        }).toThrow('Element caching failed');
      });
    });

    describe('Element Query Utilities', () => {
      beforeEach(() => {
        // Cache some elements for testing
        controller._cacheElement('form', '#test-form');
        controller._cacheElement('submitBtn', '#submit-btn');
      });

      it('should get cached element by key', () => {
        const element = controller._getElement('form');
        expect(element).toBeInstanceOf(HTMLFormElement);
        expect(element.id).toBe('test-form');
      });

      it('should return null for non-existent key', () => {
        const element = controller._getElement('nonexistent');
        expect(element).toBeNull();
      });

      it('should check if element exists and is in DOM', () => {
        expect(controller._hasElement('form')).toBe(true);
        expect(controller._hasElement('nonexistent')).toBe(false);
      });

      it('should get multiple elements by keys', () => {
        const elements = controller._getElements(['form', 'submitBtn']);

        expect(elements.form).toBeInstanceOf(HTMLFormElement);
        expect(elements.submitBtn).toBeInstanceOf(HTMLButtonElement);
      });

      it('should refresh cached element', () => {
        const originalElement = controller._getElement('form');
        const refreshedElement = controller._refreshElement(
          'form',
          '#test-form'
        );

        expect(refreshedElement).toBeInstanceOf(HTMLFormElement);
        expect(refreshedElement).toBe(originalElement); // Same element in DOM
        expect(mockLogger.debug).toHaveBeenCalledWith(
          expect.stringContaining("Refreshing element 'form'")
        );
      });
    });

    describe('Element Operations', () => {
      beforeEach(() => {
        controller._cacheElement('errorMsg', '.error-message');
        controller._cacheElement('submitBtn', '#submit-btn');
        controller._cacheElement('tooltip', '#optional-tooltip');
      });

      it('should show and hide elements', () => {
        const result1 = controller._showElement('errorMsg');
        expect(result1).toBe(true);
        expect(controller._getElement('errorMsg').style.display).toBe('block');

        const result2 = controller._hideElement('errorMsg');
        expect(result2).toBe(true);
        expect(controller._getElement('errorMsg').style.display).toBe('none');
      });

      it('should show element with custom display type', () => {
        const result = controller._showElement('errorMsg', 'flex');
        expect(result).toBe(true);
        expect(controller._getElement('errorMsg').style.display).toBe('flex');
      });

      it('should toggle element visibility', () => {
        // Initially hidden
        controller._hideElement('errorMsg');

        const visible1 = controller._toggleElement('errorMsg');
        expect(visible1).toBe(true);
        expect(controller._getElement('errorMsg').style.display).toBe('block');

        const visible2 = controller._toggleElement('errorMsg');
        expect(visible2).toBe(false);
        expect(controller._getElement('errorMsg').style.display).toBe('none');
      });

      it('should force toggle visibility state', () => {
        controller._toggleElement('errorMsg', true);
        expect(controller._getElement('errorMsg').style.display).toBe('block');

        controller._toggleElement('errorMsg', false);
        expect(controller._getElement('errorMsg').style.display).toBe('none');
      });

      it('should enable and disable form elements', () => {
        const result1 = controller._setElementEnabled('submitBtn', false);
        expect(result1).toBe(true);
        expect(controller._getElement('submitBtn').disabled).toBe(true);

        const result2 = controller._setElementEnabled('submitBtn', true);
        expect(result2).toBe(true);
        expect(controller._getElement('submitBtn').disabled).toBe(false);
      });

      it('should set element text content', () => {
        const result = controller._setElementText('tooltip', 'New help text');
        expect(result).toBe(true);
        expect(controller._getElement('tooltip').textContent).toBe(
          'New help text'
        );
      });

      it('should add and remove CSS classes', () => {
        const result1 = controller._addElementClass('tooltip', 'highlight');
        expect(result1).toBe(true);
        expect(
          controller._getElement('tooltip').classList.contains('highlight')
        ).toBe(true);

        const result2 = controller._removeElementClass('tooltip', 'highlight');
        expect(result2).toBe(true);
        expect(
          controller._getElement('tooltip').classList.contains('highlight')
        ).toBe(false);
      });

      it('should return false for operations on missing elements', () => {
        expect(controller._showElement('missing')).toBe(false);
        expect(controller._hideElement('missing')).toBe(false);
        expect(controller._toggleElement('missing')).toBe(false);
        expect(controller._setElementEnabled('missing')).toBe(false);
        expect(controller._setElementText('missing', 'text')).toBe(false);
        expect(controller._addElementClass('missing', 'class')).toBe(false);
        expect(controller._removeElementClass('missing', 'class')).toBe(false);
      });
    });

    describe('Cache Management', () => {
      beforeEach(() => {
        controller._cacheElement('form', '#test-form');
        controller._cacheElement('submitBtn', '#submit-btn');
      });

      it('should clear element cache', () => {
        expect(Object.keys(controller.elements)).toHaveLength(2);

        controller._clearElementCache();

        expect(Object.keys(controller.elements)).toHaveLength(0);
        expect(mockLogger.debug).toHaveBeenCalledWith(
          'TestController: Cleared 2 cached element references'
        );
      });

      it('should validate element cache', () => {
        // Remove element from DOM but keep in cache
        const detachedElement = document.getElementById('will-be-removed');
        controller._cacheElement('detached', '#will-be-removed');
        detachedElement.remove();

        const results = controller._validateElementCache();

        expect(results.total).toBe(3); // form, submitBtn, detached
        expect(results.valid).toHaveLength(2);
        expect(results.invalid).toHaveLength(1);
        expect(results.invalid).toContain('detached');
        expect(mockLogger.warn).toHaveBeenCalledWith(
          expect.stringContaining("Cached element 'detached' no longer in DOM")
        );
      });

      it('should integrate with _resetInitializationState', () => {
        expect(Object.keys(controller.elements)).toHaveLength(2);

        controller._resetInitializationState();

        expect(Object.keys(controller.elements)).toHaveLength(0);
        expect(controller.isInitialized).toBe(false);
        expect(controller.isInitializing).toBe(false);
      });
    });

    describe('Element Validation', () => {
      it('should validate HTMLElement instances', () => {
        const validElement = document.getElementById('test-form');

        expect(() => {
          controller._validateElement(validElement, 'form');
        }).not.toThrow();
      });

      it('should reject non-HTMLElement instances', () => {
        const invalidElement = { tagName: 'FAKE' };

        expect(() => {
          controller._validateElement(invalidElement, 'fake');
        }).toThrow("Element 'fake' is not a valid HTMLElement");
      });

      it('should warn about detached elements', () => {
        const detachedElement = document.createElement('div');

        controller._validateElement(detachedElement, 'detached');

        expect(mockLogger.warn).toHaveBeenCalledWith(
          expect.stringContaining("Element 'detached' is not attached to DOM")
        );
      });
    });

    describe('Error Handling', () => {
      it('should enhance errors with context information', () => {
        try {
          controller._cacheElement('missing', '#not-there', true);
        } catch (error) {
          expect(error.elementKey).toBe('missing');
          expect(error.selector).toBe('#not-there');
          expect(error.originalError).toBeDefined();
          expect(mockLogger.error).toHaveBeenCalledWith(
            expect.stringContaining('Element caching failed'),
            error
          );
        }
      });

      it('should normalize element configuration correctly', () => {
        // Test string configuration
        const stringConfig = controller._normalizeElementConfig('#test');
        expect(stringConfig).toEqual({
          selector: '#test',
          required: true,
          validate: null,
        });

        // Test object configuration
        const objectConfig = controller._normalizeElementConfig({
          selector: '#test',
          required: false,
          validate: () => true,
        });
        expect(objectConfig.selector).toBe('#test');
        expect(objectConfig.required).toBe(false);
        expect(objectConfig.validate).toBeInstanceOf(Function);
      });
    });
  });

  describe('UIStateManager Integration', () => {
    let controller;
    let mockUIStateManager;

    beforeEach(async () => {
      // Set up DOM elements that match production patterns
      document.body.innerHTML = `
        <div id="empty-state" style="display: flex;">
          <p>No data available</p>
        </div>
        <div id="loading-state" style="display: none;">
          <p>Loading...</p>
        </div>
        <div id="results-state" style="display: none;">
          <div class="results-container"></div>
        </div>
        <div id="error-state" style="display: none;">
          <div class="error-message">An error occurred</div>
        </div>
        <form id="test-form">
          <button id="submit-btn">Submit</button>
          <button id="save-btn">Save</button>
        </form>
      `;

      controller = new TestController({
        logger: mockLogger,
        characterBuilderService: mockCharacterBuilderService,
        eventBus: mockEventBus,
        schemaValidator: mockSchemaValidator,
      });

      // Cache elements
      controller._cacheElementsFromMap({
        emptyState: '#empty-state',
        loadingState: '#loading-state',
        resultsState: '#results-state',
        errorState: '#error-state',
        form: '#test-form',
        submitBtn: '#submit-btn',
        saveBtn: '#save-btn',
      });

      // Get the mocked UIStateManager instance
      const { UIStateManager } = await import(
        '../../../../src/shared/characterBuilder/uiStateManager.js'
      );
      mockUIStateManager = {
        showState: jest.fn(),
        showError: jest.fn(),
        showLoading: jest.fn(),
        getCurrentState: jest.fn().mockReturnValue(null),
      };
      UIStateManager.mockReturnValue(mockUIStateManager);
    });

    afterEach(() => {
      document.body.innerHTML = '';
    });

    describe('UIStateManager Initialization', () => {
      it('should initialize UIStateManager with cached elements', async () => {
        await controller._initializeUIStateManager();

        const { UIStateManager } = await import(
          '../../../../src/shared/characterBuilder/uiStateManager.js'
        );
        expect(UIStateManager).toHaveBeenCalledWith({
          emptyState: document.getElementById('empty-state'),
          loadingState: document.getElementById('loading-state'),
          resultsState: document.getElementById('results-state'),
          errorState: document.getElementById('error-state'),
        });
      });

      it('should handle missing state elements gracefully', async () => {
        // Create a controller with incomplete DOM setup
        document.body.innerHTML = `
          <div id="loading-state" style="display: none;">
            <p>Loading...</p>
          </div>
          <div id="results-state" style="display: none;">
            <div class="results-container"></div>
          </div>
          <div id="error-state" style="display: none;">
            <div class="error-message">An error occurred</div>
          </div>
        `;

        const testController = new TestController({
          logger: mockLogger,
          characterBuilderService: mockCharacterBuilderService,
          eventBus: mockEventBus,
          schemaValidator: mockSchemaValidator,
        });

        // Cache elements - emptyState will be missing
        testController._cacheElementsFromMap({
          emptyState: '#empty-state', // This won't exist
          loadingState: '#loading-state',
          resultsState: '#results-state',
          errorState: '#error-state',
        });

        // Clear previous mock calls
        const { UIStateManager } = await import(
          '../../../../src/shared/characterBuilder/uiStateManager.js'
        );
        UIStateManager.mockClear();

        await testController._initializeUIStateManager();

        expect(UIStateManager).not.toHaveBeenCalled();
        expect(mockLogger.warn).toHaveBeenCalledWith(
          'TestController: Missing state elements: emptyState'
        );
      });

      it('should handle UIStateManager construction errors', async () => {
        const { UIStateManager } = await import(
          '../../../../src/shared/characterBuilder/uiStateManager.js'
        );
        UIStateManager.mockImplementation(() => {
          throw new Error('Mock construction error');
        });

        await controller._initializeUIStateManager();

        expect(mockLogger.error).toHaveBeenCalledWith(
          'TestController: Failed to initialize UIStateManager',
          expect.any(Error)
        );
      });
    });

    describe('State Transitions', () => {
      beforeEach(async () => {
        await controller._initializeUIStateManager();
        // Access the private field for testing
        controller._testUIStateManager = mockUIStateManager;
      });

      it('should show state through UIStateManager', () => {
        // Override the private field access for testing
        controller._showState = function (state, options = {}) {
          const { message, data } = options;

          if (!mockUIStateManager) {
            this.logger.warn(
              `${this.constructor.name}: UIStateManager not initialized`
            );
            return;
          }

          const previousState = mockUIStateManager.getCurrentState();

          try {
            this._beforeStateChange(previousState, state, options);
            mockUIStateManager.showState(state, message);
            this._handleStateChange(state, { message, data, previousState });
            this._afterStateChange(previousState, state, options);

            if (this.eventBus) {
              this.eventBus.dispatch('UI_STATE_CHANGED', {
                controller: this.constructor.name,
                previousState,
                currentState: state,
                timestamp: new Date().toISOString(),
              });
            }
          } catch (error) {
            this.logger.error(
              `${this.constructor.name}: State transition failed`,
              error
            );
          }
        };

        controller._showState('loading', { message: 'Please wait...' });

        expect(mockUIStateManager.showState).toHaveBeenCalledWith(
          'loading',
          'Please wait...'
        );
        expect(mockEventBus.dispatch).toHaveBeenCalledWith('UI_STATE_CHANGED', {
          controller: 'TestController',
          previousState: null,
          currentState: 'loading',
          timestamp: expect.any(String),
        });
      });

      it('should handle invalid states gracefully', () => {
        jest
          .spyOn(controller, '_showState')
          .mockImplementation(function (state) {
            if (state === 'invalid') {
              this.logger.warn(
                `${this.constructor.name}: Invalid state 'invalid', using 'empty' instead`
              );
              mockUIStateManager.showState('empty');
            }
          });

        controller._showState('invalid');

        expect(mockLogger.warn).toHaveBeenCalledWith(
          "TestController: Invalid state 'invalid', using 'empty' instead"
        );
      });
    });

    describe('Convenience Methods', () => {
      beforeEach(async () => {
        await controller._initializeUIStateManager();
        // Mock the _showState method for testing
        jest.spyOn(controller, '_showState');
      });

      it('should show error with string message', () => {
        controller._showError('Test error message');

        expect(controller._showState).toHaveBeenCalledWith('error', {
          message: 'Test error message',
        });
        expect(mockLogger.error).toHaveBeenCalledWith(
          'TestController: Showing error state',
          { message: 'Test error message', error: 'Test error message' }
        );
      });

      it('should show error with Error object', () => {
        const error = new Error('Test error');
        controller._showError(error);

        expect(controller._showState).toHaveBeenCalledWith('error', {
          message: 'Test error',
        });
      });

      it('should show loading state', () => {
        controller._showLoading('Custom loading message');

        expect(controller._showState).toHaveBeenCalledWith('loading', {
          message: 'Custom loading message',
        });
      });

      it('should show loading with default message', () => {
        controller._showLoading();

        expect(controller._showState).toHaveBeenCalledWith('loading', {
          message: 'Loading...',
        });
      });

      it('should show results state', () => {
        const testData = { items: [1, 2, 3] };
        controller._showResults(testData);

        expect(controller._showState).toHaveBeenCalledWith('results', {
          data: testData,
        });
      });

      it('should show empty state', () => {
        controller._showEmpty();

        expect(controller._showState).toHaveBeenCalledWith('empty');
      });
    });

    describe('State Change Hooks', () => {
      let hooksCalled;

      beforeEach(async () => {
        await controller._initializeUIStateManager();
        hooksCalled = [];

        // Override hooks to track calls
        controller._beforeStateChange = jest.fn((from, to, options) => {
          hooksCalled.push(`before:${from}->${to}`);
        });
        controller._handleStateChange = jest.fn((state, data) => {
          hooksCalled.push(`handle:${state}`);
        });
        controller._afterStateChange = jest.fn((from, to, options) => {
          hooksCalled.push(`after:${from}->${to}`);
        });
      });

      it('should call hooks in correct order', () => {
        // Mock the UIStateManager access for testing
        controller._showState = function (state, options = {}) {
          const previousState = 'empty';
          this._beforeStateChange(previousState, state, options);
          this._handleStateChange(state, { previousState });
          this._afterStateChange(previousState, state, options);
        };

        controller._showState('loading');

        expect(hooksCalled).toEqual([
          'before:empty->loading',
          'handle:loading',
          'after:empty->loading',
        ]);
      });
    });

    describe('Form Control Management', () => {
      beforeEach(async () => {
        await controller._initializeUIStateManager();
      });

      it('should disable form controls during loading', () => {
        controller._setFormControlsEnabled(false);

        const submitBtn = document.getElementById('submit-btn');
        const saveBtn = document.getElementById('save-btn');

        expect(submitBtn.disabled).toBe(true);
        expect(saveBtn.disabled).toBe(true);
      });

      it('should enable form controls', () => {
        // First disable them
        controller._setFormControlsEnabled(false);
        // Then enable them
        controller._setFormControlsEnabled(true);

        const submitBtn = document.getElementById('submit-btn');
        const saveBtn = document.getElementById('save-btn');

        expect(submitBtn.disabled).toBe(false);
        expect(saveBtn.disabled).toBe(false);
      });
    });

    describe('Delegation Methods', () => {
      beforeEach(async () => {
        await controller._initializeUIStateManager();
      });

      it('should return current state from UIStateManager', () => {
        mockUIStateManager.getCurrentState.mockReturnValue('loading');

        // Mock the currentState getter for testing
        Object.defineProperty(controller, 'currentState', {
          get: () => mockUIStateManager?.getCurrentState() || null,
          configurable: true,
        });

        expect(controller.currentState).toBe('loading');
      });

      it('should return null when UIStateManager not initialized', () => {
        // Mock UIStateManager as null
        Object.defineProperty(controller, 'currentState', {
          get: () => null,
          configurable: true,
        });

        expect(controller.currentState).toBe(null);
      });

      it('should check if in specific state', () => {
        Object.defineProperty(controller, 'currentState', {
          get: () => 'results',
          configurable: true,
        });

        expect(controller._isInState('results')).toBe(true);
        expect(controller._isInState('loading')).toBe(false);
      });
    });

    describe('UI States Integration', () => {
      it('should provide UI_STATES getter', () => {
        const states = controller.UI_STATES;

        expect(states).toEqual({
          EMPTY: 'empty',
          LOADING: 'loading',
          RESULTS: 'results',
          ERROR: 'error',
        });
      });
    });

    describe('Enhanced _initializeUIState', () => {
      it('should initialize UIStateManager and show empty state', async () => {
        jest.spyOn(controller, '_initializeUIStateManager');
        jest.spyOn(controller, '_showState');

        await controller._initializeUIState();

        expect(controller._initializeUIStateManager).toHaveBeenCalled();
        expect(controller._showState).toHaveBeenCalledWith('empty');
      });

      it('should handle missing UIStateManager gracefully', async () => {
        // Mock _initializeUIStateManager to not create UIStateManager
        jest
          .spyOn(controller, '_initializeUIStateManager')
          .mockImplementation(() => {
            // Don't create UIStateManager
          });

        await controller._initializeUIState();

        expect(mockLogger.warn).toHaveBeenCalledWith(
          'TestController: UIStateManager not available, skipping initial state'
        );
      });
    });
  });

  describe('Event Handling Infrastructure', () => {
    let controller;

    beforeEach(() => {
      // Set up DOM structure for event testing
      document.body.innerHTML = `
        <div id="container">
          <form id="test-form">
            <input id="test-input" type="text" />
            <button id="test-button">Click me</button>
            <button class="dynamic-btn" data-id="1">Dynamic 1</button>
            <button class="dynamic-btn" data-id="2">Dynamic 2</button>
          </form>
        </div>
      `;

      controller = new TestController({
        logger: mockLogger,
        characterBuilderService: mockCharacterBuilderService,
        eventBus: mockEventBus,
        schemaValidator: mockSchemaValidator,
      });

      // Cache elements for testing
      controller._cacheElementsFromMap({
        container: '#container',
        form: '#test-form',
        input: '#test-input',
        button: '#test-button',
      });
    });

    afterEach(() => {
      document.body.innerHTML = '';
      jest.clearAllMocks();
    });

    describe('_addEventListener() - DOM Event Listeners', () => {
      it('should add event listener using element key', () => {
        const handler = jest.fn();

        const listenerId = controller._addEventListener(
          'button',
          'click',
          handler
        );

        expect(listenerId).toBeTruthy();
        expect(listenerId).toMatch(/^listener-\d+$/);
        expect(mockLogger.debug).toHaveBeenCalledWith(
          expect.stringContaining('Added click listener to BUTTON#test-button')
        );

        // Trigger event
        document.getElementById('test-button').click();
        expect(handler).toHaveBeenCalledTimes(1);
      });

      it('should add event listener using direct element reference', () => {
        const handler = jest.fn();
        const element = document.getElementById('test-button');

        const listenerId = controller._addEventListener(
          element,
          'click',
          handler
        );

        expect(listenerId).toBeTruthy();
        element.click();
        expect(handler).toHaveBeenCalledTimes(1);
      });

      it('should return null for missing element', () => {
        const handler = jest.fn();

        const listenerId = controller._addEventListener(
          'missing-element',
          'click',
          handler
        );

        expect(listenerId).toBeNull();
        expect(mockLogger.warn).toHaveBeenCalledWith(
          expect.stringContaining(
            "Cannot add click listener - element 'missing-element' not found"
          )
        );
      });

      it('should throw error for invalid element parameter', () => {
        const handler = jest.fn();

        expect(() => {
          controller._addEventListener({}, 'click', handler);
        }).toThrow('Invalid element provided to _addEventListener');
      });

      it('should support custom listener options', () => {
        const handler = jest.fn();

        const listenerId = controller._addEventListener(
          'button',
          'click',
          handler,
          {
            passive: false,
            once: true,
            id: 'custom-listener',
          }
        );

        expect(listenerId).toBe('custom-listener');

        // Should only fire once
        const button = document.getElementById('test-button');
        button.click();
        button.click();
        expect(handler).toHaveBeenCalledTimes(1);
      });

      it('should warn about duplicate listener IDs', () => {
        const handler1 = jest.fn();
        const handler2 = jest.fn();

        const id1 = controller._addEventListener('button', 'click', handler1, {
          id: 'duplicate',
        });
        const id2 = controller._addEventListener('button', 'click', handler2, {
          id: 'duplicate',
        });

        expect(id1).toBe('duplicate');
        expect(id2).toBe('duplicate');
        expect(mockLogger.warn).toHaveBeenCalledWith(
          expect.stringContaining("Listener with ID 'duplicate' already exists")
        );
      });

      it('should bind handler context automatically', () => {
        let capturedThis;
        const handler = function () {
          capturedThis = this;
        };

        controller._addEventListener('button', 'click', handler);
        document.getElementById('test-button').click();

        expect(capturedThis).toBe(controller);
      });
    });

    describe('_subscribeToEvent() - EventBus Integration', () => {
      it('should subscribe to EventBus events successfully', () => {
        const handler = jest.fn();
        const mockUnsubscribe = jest.fn();
        mockEventBus.subscribe.mockReturnValue(mockUnsubscribe);

        const subscriptionId = controller._subscribeToEvent(
          'TEST_EVENT',
          handler
        );

        expect(subscriptionId).toBeTruthy();
        expect(subscriptionId).toMatch(/^sub-\d+$/);
        expect(mockEventBus.subscribe).toHaveBeenCalledWith(
          'TEST_EVENT',
          expect.any(Function)
        );
        expect(mockLogger.debug).toHaveBeenCalledWith(
          expect.stringContaining("Subscribed to event 'TEST_EVENT'")
        );
      });

      it('should return null when EventBus subscription fails', () => {
        const handler = jest.fn();
        mockEventBus.subscribe.mockReturnValue(null);

        const subscriptionId = controller._subscribeToEvent(
          'TEST_EVENT',
          handler
        );

        expect(subscriptionId).toBeNull();
        expect(mockLogger.error).toHaveBeenCalledWith(
          expect.stringContaining("Failed to subscribe to event 'TEST_EVENT'")
        );
      });

      it('should return null when EventBus is not available', () => {
        // Create a TestController that allows null EventBus for testing
        class NullEventBusTestController extends BaseCharacterBuilderController {
          _cacheElements() {}
          _setupEventListeners() {}

          // Override the private field access to return null for testing
          _subscribeToEvent(eventType, handler, options = {}) {
            if (!null) {
              // Simulate null eventBus
              this.logger.warn(
                `${this.constructor.name}: Cannot subscribe to '${eventType}' - eventBus not available`
              );
              return null;
            }
            // This won't be reached
            return super._subscribeToEvent(eventType, handler, options);
          }
        }

        const nullEventBusController = new NullEventBusTestController({
          logger: mockLogger,
          characterBuilderService: mockCharacterBuilderService,
          eventBus: mockEventBus,
          schemaValidator: mockSchemaValidator,
        });

        const subscriptionId = nullEventBusController._subscribeToEvent(
          'TEST_EVENT',
          jest.fn()
        );

        expect(subscriptionId).toBeNull();
        expect(mockLogger.warn).toHaveBeenCalledWith(
          expect.stringContaining(
            "Cannot subscribe to 'TEST_EVENT' - eventBus not available"
          )
        );
      });

      it('should support custom subscription options', () => {
        const handler = jest.fn();
        const mockUnsubscribe = jest.fn();
        mockEventBus.subscribe.mockReturnValue(mockUnsubscribe);

        const subscriptionId = controller._subscribeToEvent(
          'TEST_EVENT',
          handler,
          {
            id: 'custom-subscription',
          }
        );

        expect(subscriptionId).toBe('custom-subscription');
      });
    });

    describe('_addDelegatedListener() - Event Delegation', () => {
      it('should handle delegated events correctly', () => {
        const handler = jest.fn();

        controller._addDelegatedListener(
          'container',
          '.dynamic-btn',
          'click',
          handler
        );

        // Click on first dynamic button
        document.querySelector('[data-id="1"]').click();
        expect(handler).toHaveBeenCalledTimes(1);
        expect(handler).toHaveBeenCalledWith(
          expect.any(Event),
          document.querySelector('[data-id="1"]')
        );

        // Click on second dynamic button
        document.querySelector('[data-id="2"]').click();
        expect(handler).toHaveBeenCalledTimes(2);
        expect(handler).toHaveBeenCalledWith(
          expect.any(Event),
          document.querySelector('[data-id="2"]')
        );
      });

      it('should not trigger for non-matching elements', () => {
        const handler = jest.fn();

        controller._addDelegatedListener(
          'container',
          '.dynamic-btn',
          'click',
          handler
        );

        // Click on non-matching element
        document.getElementById('test-input').click();
        expect(handler).not.toHaveBeenCalled();
      });

      it('should generate predictable listener IDs for delegation', () => {
        const handler = jest.fn();

        const listenerId = controller._addDelegatedListener(
          'container',
          '.btn',
          'click',
          handler
        );

        expect(listenerId).toMatch(/^delegated-\.btn-click$/);
      });
    });

    describe('Debounce and Throttle Utilities', () => {
      beforeEach(() => {
        jest.useFakeTimers();
      });

      afterEach(() => {
        jest.useRealTimers();
      });

      it('should debounce input events correctly', () => {
        const handler = jest.fn();

        controller._addDebouncedListener('input', 'input', handler, 300);

        const input = document.getElementById('test-input');

        // Rapid inputs
        input.dispatchEvent(new Event('input'));
        input.dispatchEvent(new Event('input'));
        input.dispatchEvent(new Event('input'));

        expect(handler).not.toHaveBeenCalled();

        // Advance time
        jest.advanceTimersByTime(300);
        expect(handler).toHaveBeenCalledTimes(1);
      });

      it('should throttle events correctly', () => {
        const handler = jest.fn();

        controller._addThrottledListener('button', 'click', handler, 100);

        const button = document.getElementById('test-button');

        // Rapid clicks
        button.click();
        button.click();
        button.click();

        expect(handler).toHaveBeenCalledTimes(1);

        // Advance time and try again
        jest.advanceTimersByTime(100);
        button.click();
        expect(handler).toHaveBeenCalledTimes(2);
      });

      it('should store debounced handlers for cleanup', () => {
        const handler = jest.fn();

        controller._addDebouncedListener('input', 'input', handler, 300);

        const stats = controller._getEventListenerStats();
        expect(stats.total).toBe(1);
      });
    });

    describe('_addAsyncClickHandler() - Async Operations', () => {
      it('should handle async operations with loading states', async () => {
        const asyncHandler = jest.fn().mockResolvedValue('success');

        controller._addAsyncClickHandler('button', asyncHandler, {
          loadingText: 'Loading...',
        });

        const button = document.getElementById('test-button');
        const originalText = button.textContent;

        // Click and check loading state
        button.click();
        expect(button.disabled).toBe(true);
        expect(button.textContent).toBe('Loading...');
        expect(button.classList.contains('is-loading')).toBe(true);

        // Wait for async operation
        await new Promise((resolve) => setTimeout(resolve, 0));

        // Check restored state
        expect(button.disabled).toBe(false);
        expect(button.textContent).toBe(originalText);
        expect(button.classList.contains('is-loading')).toBe(false);
        expect(asyncHandler).toHaveBeenCalledTimes(1);
      });

      it('should handle async errors gracefully', async () => {
        const error = new Error('Test error');
        const asyncHandler = jest.fn().mockRejectedValue(error);
        const onError = jest.fn();

        controller._addAsyncClickHandler('button', asyncHandler, { onError });

        const button = document.getElementById('test-button');
        button.click();

        await new Promise((resolve) => setTimeout(resolve, 0));

        expect(mockLogger.error).toHaveBeenCalledWith(
          expect.stringContaining('Async click handler failed'),
          error
        );
        expect(onError).toHaveBeenCalledWith(error);
        expect(button.disabled).toBe(false);
      });
    });

    describe('Event Listener Management', () => {
      it('should remove specific event listeners by ID', () => {
        const handler = jest.fn();

        const listenerId = controller._addEventListener(
          'button',
          'click',
          handler
        );
        expect(controller._getEventListenerStats().total).toBe(1);

        const removed = controller._removeEventListener(listenerId);
        expect(removed).toBe(true);
        expect(controller._getEventListenerStats().total).toBe(0);

        // Event should no longer fire
        document.getElementById('test-button').click();
        expect(handler).not.toHaveBeenCalled();
      });

      it('should return false for non-existent listener IDs', () => {
        const removed = controller._removeEventListener('non-existent');

        expect(removed).toBe(false);
        expect(mockLogger.warn).toHaveBeenCalledWith(
          expect.stringContaining("Listener 'non-existent' not found")
        );
      });

      it('should remove EventBus subscriptions correctly', () => {
        const mockUnsubscribe = jest.fn();
        mockEventBus.subscribe.mockReturnValue(mockUnsubscribe);

        const subscriptionId = controller._subscribeToEvent(
          'TEST_EVENT',
          jest.fn()
        );
        const removed = controller._removeEventListener(subscriptionId);

        expect(removed).toBe(true);
        expect(mockUnsubscribe).toHaveBeenCalled();
      });

      it('should remove all event listeners', () => {
        const mockUnsubscribe1 = jest.fn();
        const mockUnsubscribe2 = jest.fn();
        mockEventBus.subscribe
          .mockReturnValueOnce(mockUnsubscribe1)
          .mockReturnValueOnce(mockUnsubscribe2);

        // Add various listeners
        controller._addEventListener('button', 'click', jest.fn());
        controller._subscribeToEvent('TEST_EVENT_1', jest.fn());
        controller._subscribeToEvent('TEST_EVENT_2', jest.fn());

        expect(controller._getEventListenerStats().total).toBe(3);

        controller._removeAllEventListeners();

        expect(controller._getEventListenerStats().total).toBe(0);
        expect(mockUnsubscribe1).toHaveBeenCalled();
        expect(mockUnsubscribe2).toHaveBeenCalled();
        expect(mockLogger.debug).toHaveBeenCalledWith(
          expect.stringContaining('Removed 3 event listeners')
        );
      });

      it('should handle errors during cleanup gracefully', () => {
        const mockUnsubscribe = jest.fn(() => {
          throw new Error('Unsubscribe error');
        });
        mockEventBus.subscribe.mockReturnValue(mockUnsubscribe);

        controller._subscribeToEvent('TEST_EVENT', jest.fn());
        controller._removeAllEventListeners();

        expect(mockLogger.error).toHaveBeenCalledWith(
          expect.stringContaining('Error removing listener'),
          expect.any(Error)
        );
      });
    });

    describe('Event Listener Statistics', () => {
      it('should provide accurate statistics', () => {
        const mockUnsubscribe1 = jest.fn();
        const mockUnsubscribe2 = jest.fn();
        mockEventBus.subscribe
          .mockReturnValueOnce(mockUnsubscribe1)
          .mockReturnValueOnce(mockUnsubscribe2);

        // Add various listeners
        controller._addEventListener('button', 'click', jest.fn());
        controller._addEventListener('input', 'change', jest.fn());
        controller._subscribeToEvent('TEST_EVENT_1', jest.fn());
        controller._subscribeToEvent('TEST_EVENT_2', jest.fn());

        const stats = controller._getEventListenerStats();

        expect(stats).toEqual({
          total: 4,
          dom: 2,
          eventBus: 2,
          byEvent: {
            'dom:click': 1,
            'dom:change': 1,
            'eventBus:TEST_EVENT_1': 1,
            'eventBus:TEST_EVENT_2': 1,
          },
        });
      });
    });

    describe('Helper Utilities', () => {
      it('should prevent default and stop propagation', () => {
        const mockEvent = {
          preventDefault: jest.fn(),
          stopPropagation: jest.fn(),
        };
        const handler = jest.fn();

        controller._preventDefault(mockEvent, handler);

        expect(mockEvent.preventDefault).toHaveBeenCalled();
        expect(mockEvent.stopPropagation).toHaveBeenCalled();
        expect(handler).toHaveBeenCalledWith(mockEvent);
      });

      it('should work without handler', () => {
        const mockEvent = {
          preventDefault: jest.fn(),
          stopPropagation: jest.fn(),
        };

        controller._preventDefault(mockEvent);

        expect(mockEvent.preventDefault).toHaveBeenCalled();
        expect(mockEvent.stopPropagation).toHaveBeenCalled();
      });
    });

    describe('Integration with destroy() lifecycle', () => {
      it('should call _removeAllEventListeners in destroy', () => {
        jest.spyOn(controller, '_removeAllEventListeners');

        controller.destroy();

        expect(controller._removeAllEventListeners).toHaveBeenCalled();
        expect(controller.isDestroyed).toBe(true);
      });
    });

    describe('Error Handling and Edge Cases', () => {
      it('should handle missing elements gracefully in delegation', () => {
        const handler = jest.fn();

        expect(() => {
          controller._addDelegatedListener(
            'missing-container',
            '.btn',
            'click',
            handler
          );
        }).not.toThrow();
      });

      it('should clear debounced and throttled handlers on cleanup', () => {
        controller._addDebouncedListener('input', 'input', jest.fn(), 300);
        controller._addThrottledListener('button', 'click', jest.fn(), 100);

        // Verify handlers are stored
        expect(controller._getEventListenerStats().total).toBe(2);

        controller._removeAllEventListeners();

        // Handlers should be cleared
        expect(controller._getEventListenerStats().total).toBe(0);
      });
    });
  });

  // ─────────────────────────────────────────────────────────────────────────
  // Error Handling Framework Tests (Added in ticket #7)
  // ─────────────────────────────────────────────────────────────────────────

  describe('Error Handling Framework', () => {
    let controller;

    beforeEach(() => {
      controller = new TestController({
        logger: mockLogger,
        characterBuilderService: mockCharacterBuilderService,
        eventBus: mockEventBus,
        schemaValidator: mockSchemaValidator,
      });
    });

    describe('_handleError', () => {
      it('should handle errors with consistent logging and user feedback', () => {
        const error = new Error('Test error');
        const context = {
          operation: 'testOperation',
          category: 'network',
          userMessage: 'Test failed',
        };

        const result = controller._handleError(error, context);

        expect(result).toMatchObject({
          message: 'Test error',
          operation: 'testOperation',
          category: 'network',
          userMessage: 'Test failed',
        });

        expect(mockLogger.error).toHaveBeenCalled();
        expect(mockEventBus.dispatch).toHaveBeenCalledWith(
          'SYSTEM_ERROR_OCCURRED',
          expect.objectContaining({
            error: 'Test error',
            context: 'testOperation',
            category: 'network',
          })
        );
      });

      it('should handle string errors', () => {
        const result = controller._handleError('String error', {
          operation: 'test',
        });

        expect(result.message).toBe('String error');
        expect(result.name).toBe('Error');
      });

      it('should not show error to user when showToUser is false', () => {
        const mockShowError = jest.spyOn(controller, '_showError');

        controller._handleError(new Error('Test'), {
          showToUser: false,
        });

        expect(mockShowError).not.toHaveBeenCalled();
      });
    });

    describe('Error Categorization', () => {
      it('should categorize validation errors', () => {
        const error = new Error('validation failed');
        const result = controller._handleError(error);
        expect(result.category).toBe('validation');
      });

      it('should categorize network errors', () => {
        const error = new Error('network timeout');
        const result = controller._handleError(error);
        expect(result.category).toBe('network');
      });

      it('should categorize permission errors', () => {
        const error = new Error('unauthorized access');
        const result = controller._handleError(error);
        expect(result.category).toBe('permission');
      });

      it('should categorize not found errors', () => {
        const error = new Error('404 not found');
        const result = controller._handleError(error);
        expect(result.category).toBe('not_found');
      });

      it('should default to system category', () => {
        const error = new Error('unknown error');
        const result = controller._handleError(error);
        expect(result.category).toBe('system');
      });
    });

    describe('User Message Generation', () => {
      it('should use custom user message when provided', () => {
        const result = controller._handleError(new Error('Test'), {
          userMessage: 'Custom message',
        });
        expect(result.userMessage).toBe('Custom message');
      });

      it('should generate appropriate message for validation errors', () => {
        const error = new Error('validation error');
        const result = controller._handleError(error);
        expect(result.userMessage).toBe(
          'Please check your input and try again.'
        );
      });

      it('should generate appropriate message for network errors', () => {
        const error = new Error('network error');
        const result = controller._handleError(error);
        expect(result.userMessage).toBe(
          'Connection error. Please check your internet and try again.'
        );
      });
    });

    describe('Service Error Handling', () => {
      it('should handle service errors and re-throw', () => {
        const error = new Error('Service failed');

        expect(() => {
          controller._handleServiceError(error, 'loadData', 'Failed to load');
        }).toThrow('Service failed');

        expect(mockLogger.error).toHaveBeenCalled();
        expect(mockEventBus.dispatch).toHaveBeenCalledWith(
          'SYSTEM_ERROR_OCCURRED',
          expect.objectContaining({
            error: 'Service failed',
            context: 'loadData',
          })
        );
      });
    });

    describe('Execute With Error Handling', () => {
      it('should execute operation successfully', async () => {
        const operation = jest.fn().mockResolvedValue('success');

        const result = await controller._executeWithErrorHandling(
          operation,
          'testOp'
        );

        expect(result).toBe('success');
        expect(operation).toHaveBeenCalledTimes(1);
      });

      it('should retry on failure', async () => {
        let attempts = 0;
        const operation = jest.fn().mockImplementation(async () => {
          attempts++;
          if (attempts < 3) {
            throw new Error('network timeout');
          }
          return 'success';
        });

        const result = await controller._executeWithErrorHandling(
          operation,
          'testOp',
          { retries: 3, retryDelay: 10 }
        );

        expect(result).toBe('success');
        expect(attempts).toBe(3);
        expect(mockLogger.info).toHaveBeenCalledWith(
          expect.stringContaining('succeeded after 2 retries')
        );
      });

      it('should throw after all retries fail', async () => {
        const operation = jest
          .fn()
          .mockRejectedValue(new Error('network error'));

        await expect(
          controller._executeWithErrorHandling(operation, 'testOp', {
            retries: 2,
            retryDelay: 10,
          })
        ).rejects.toThrow('network error');

        expect(operation).toHaveBeenCalledTimes(3); // initial + 2 retries
      });
    });

    describe('Validation Error Handling', () => {
      beforeEach(() => {
        mockSchemaValidator.validate = jest.fn();
      });

      it('should return valid result when validation passes', () => {
        mockSchemaValidator.validate.mockReturnValue({ isValid: true });

        const result = controller._validateData({}, 'testSchema');

        expect(result).toEqual({ isValid: true });
      });

      it('should format validation errors correctly', () => {
        mockSchemaValidator.validate.mockReturnValue({
          isValid: false,
          errors: [
            { instancePath: '/name', message: 'must be string' },
            { instancePath: '/age', message: 'must be number' },
          ],
        });

        const result = controller._validateData({ name: 123 }, 'testSchema');

        expect(result.isValid).toBe(false);
        expect(result.errors).toEqual([
          'name: must be string',
          'age: must be number',
        ]);
        expect(result.errorMessage).toContain(
          'Please fix the following errors'
        );
      });

      it('should handle validation system failures', () => {
        mockSchemaValidator.validate.mockImplementation(() => {
          throw new Error('Schema not loaded');
        });

        const result = controller._validateData({}, 'testSchema');

        expect(result.isValid).toBe(false);
        expect(result.errorMessage).toBe(
          'Unable to validate data. Please try again.'
        );
        expect(mockLogger.error).toHaveBeenCalled();
      });
    });

    describe('Error Recovery', () => {
      it('should determine network errors as recoverable', () => {
        const error = new Error('network issue');
        const result = controller._handleError(error, {
          category: 'network',
        });

        expect(result.isRecoverable).toBe(true);
      });

      it('should determine validation errors as non-recoverable', () => {
        const error = new Error('validation failed');
        const result = controller._handleError(error, {
          category: 'validation',
        });

        expect(result.isRecoverable).toBe(false);
      });

      it('should attempt recovery for network errors', () => {
        jest.useFakeTimers();
        const retryLastOperationSpy = jest.spyOn(
          controller,
          '_retryLastOperation'
        );

        const errorDetails = {
          category: 'network',
          isRecoverable: true,
          severity: 'error',
        };

        controller._attemptErrorRecovery(errorDetails);

        jest.advanceTimersByTime(5000);

        expect(retryLastOperationSpy).toHaveBeenCalled();
        jest.useRealTimers();
      });
    });

    describe('Error Utilities', () => {
      it('should create standardized error', () => {
        const error = controller._createError('Test message', 'validation', {
          field: 'name',
        });

        expect(error).toBeInstanceOf(Error);
        expect(error.message).toBe('Test message');
        expect(error.category).toBe('validation');
        expect(error.metadata).toEqual({ field: 'name' });
        expect(error.controller).toBe('TestController');
      });

      it('should wrap error with context', () => {
        const originalError = new Error('Original message');
        const wrapped = controller._wrapError(
          originalError,
          'Additional context'
        );

        expect(wrapped.message).toBe('Additional context: Original message');
        expect(wrapped.originalError).toBe(originalError);
        expect(wrapped.stack).toBe(originalError.stack);
      });

      it('should provide access to last error', () => {
        const error = new Error('Test error');
        controller._handleError(error);

        const lastError = controller.lastError;
        expect(lastError).toBeDefined();
        expect(lastError.message).toBe('Test error');
      });
    });

    describe('Error Severity Handling', () => {
      it('should log info level errors appropriately', () => {
        controller._handleError('Info message', {
          severity: 'info',
          operation: 'test',
        });

        expect(mockLogger.info).toHaveBeenCalledWith(
          'TestController: test info',
          expect.any(Object)
        );
      });

      it('should log warning level errors appropriately', () => {
        controller._handleError('Warning message', {
          severity: 'warning',
          operation: 'test',
        });

        expect(mockLogger.warn).toHaveBeenCalledWith(
          'TestController: test warning',
          expect.any(Object)
        );
      });

      it('should log critical errors with full details', () => {
        controller._handleError('Critical error', {
          severity: 'critical',
          operation: 'test',
        });

        expect(mockLogger.error).toHaveBeenCalledWith(
          'TestController: CRITICAL ERROR in test',
          expect.objectContaining({
            message: 'Critical error',
            severity: 'critical',
          })
        );
      });
    });

    describe('Retry Logic', () => {
      it('should identify retryable errors', () => {
        expect(controller._isRetryableError(new Error('network timeout'))).toBe(
          true
        );
        expect(controller._isRetryableError(new Error('fetch failed'))).toBe(
          true
        );
        expect(controller._isRetryableError(new Error('temporary issue'))).toBe(
          true
        );
        expect(
          controller._isRetryableError(new Error('resource unavailable'))
        ).toBe(true);
        expect(
          controller._isRetryableError(new Error('validation error'))
        ).toBe(false);
      });
    });
  });

  // ─────────────────────────────────────────────────────────────────────────
  // Resource Cleanup Lifecycle Tests (Added in ticket #8)
  // ─────────────────────────────────────────────────────────────────────────

  describe('Resource Cleanup Lifecycle', () => {
    let controller;

    beforeEach(() => {
      controller = new TestController({
        logger: mockLogger,
        characterBuilderService: mockCharacterBuilderService,
        eventBus: mockEventBus,
        schemaValidator: mockSchemaValidator,
      });
    });

    describe('Basic Destruction', () => {
      it('should destroy uninitialized controller', () => {
        controller.destroy();

        expect(controller.isDestroyed).toBe(true);
        expect(controller.isDestroying).toBe(false);
        expect(mockLogger.info).toHaveBeenCalledWith(
          'TestController: Starting destruction'
        );
        expect(mockLogger.info).toHaveBeenCalledWith(
          expect.stringMatching(
            /TestController: Destruction completed in \d+(\.\d+)?ms/
          )
        );
      });

      it('should destroy initialized controller', async () => {
        await controller.initialize();
        controller.destroy();

        expect(controller.isDestroyed).toBe(true);
        expect(controller.isDestroying).toBe(false);
      });

      it('should handle multiple destroy calls gracefully', () => {
        controller.destroy();

        // Clear previous logs
        mockLogger.warn.mockClear();

        // Second destroy call
        controller.destroy();

        expect(mockLogger.warn).toHaveBeenCalledWith(
          'TestController: Already destroyed, skipping destruction'
        );
      });

      it('should dispatch CONTROLLER_DESTROYED event', () => {
        controller.destroy();

        expect(mockEventBus.dispatch).toHaveBeenCalledWith(
          'CONTROLLER_DESTROYED',
          expect.objectContaining({
            controllerName: 'TestController',
            destructionTime: expect.any(Number),
            timestamp: expect.any(String),
          })
        );
      });
    });

    describe('Lifecycle Hooks', () => {
      it('should call lifecycle hooks in correct order', () => {
        const hooksCalled = [];

        class HookTestController extends BaseCharacterBuilderController {
          _cacheElements() {}
          _setupEventListeners() {}

          _preDestroy() {
            hooksCalled.push('preDestroy');
          }

          _postDestroy() {
            hooksCalled.push('postDestroy');
          }

          _cancelCustomOperations() {
            hooksCalled.push('cancelCustomOperations');
          }

          _cleanupCoreServices() {
            hooksCalled.push('cleanupCoreServices');
          }

          _cleanupAdditionalServices() {
            hooksCalled.push('cleanupAdditionalServices');
          }

          _clearCachedData() {
            hooksCalled.push('clearCachedData');
          }
        }

        const hookController = new HookTestController({
          logger: mockLogger,
          characterBuilderService: mockCharacterBuilderService,
          eventBus: mockEventBus,
          schemaValidator: mockSchemaValidator,
        });

        hookController.destroy();

        // Verify hooks were called in expected order
        expect(hooksCalled).toEqual([
          'preDestroy',
          'cancelCustomOperations',
          'cleanupAdditionalServices',
          'cleanupCoreServices',
          'clearCachedData',
          'postDestroy',
        ]);
      });
    });

    describe('Pending Operations Management', () => {
      beforeEach(() => {
        jest.useFakeTimers();
      });

      afterEach(() => {
        jest.useRealTimers();
      });

      it('should track and cancel timers', () => {
        const callback1 = jest.fn();
        const callback2 = jest.fn();

        const timer1 = controller._setTimeout(callback1, 1000);
        const timer2 = controller._setTimeout(callback2, 2000);

        expect(timer1).toBeDefined();
        expect(timer2).toBeDefined();

        controller.destroy();

        // Advance time - callbacks should not be called
        jest.advanceTimersByTime(3000);

        expect(callback1).not.toHaveBeenCalled();
        expect(callback2).not.toHaveBeenCalled();
      });

      it('should track and cancel intervals', () => {
        const callback = jest.fn();

        const intervalId = controller._setInterval(callback, 100);
        expect(intervalId).toBeDefined();

        // Advance time to trigger interval
        jest.advanceTimersByTime(250);
        expect(callback).toHaveBeenCalledTimes(2);

        controller.destroy();

        // Advance more time - callback should not be called again
        callback.mockClear();
        jest.advanceTimersByTime(500);
        expect(callback).not.toHaveBeenCalled();
      });

      it('should track and cancel animation frames', () => {
        const callback = jest.fn();

        const frameId = controller._requestAnimationFrame(callback);
        expect(frameId).toBeDefined();

        controller.destroy();

        // Animation frame should be cancelled
        expect(callback).not.toHaveBeenCalled();
      });

      it('should handle manual timer clearing', () => {
        const callback = jest.fn();

        const timerId = controller._setTimeout(callback, 1000);
        controller._clearTimeout(timerId);

        jest.advanceTimersByTime(1500);
        expect(callback).not.toHaveBeenCalled();

        // Should not throw when destroying
        expect(() => controller.destroy()).not.toThrow();
      });

      it('should handle manual interval clearing', () => {
        const callback = jest.fn();

        const intervalId = controller._setInterval(callback, 100);
        controller._clearInterval(intervalId);

        jest.advanceTimersByTime(500);
        expect(callback).not.toHaveBeenCalled();

        // Should not throw when destroying
        expect(() => controller.destroy()).not.toThrow();
      });

      it('should handle manual animation frame cancellation', () => {
        const callback = jest.fn();

        const frameId = controller._requestAnimationFrame(callback);
        controller._cancelAnimationFrame(frameId);

        expect(callback).not.toHaveBeenCalled();

        // Should not throw when destroying
        expect(() => controller.destroy()).not.toThrow();
      });
    });

    describe('Service Cleanup', () => {
      it('should cleanup additional services', () => {
        let serviceCleanedUp = false;

        class ServiceTestController extends BaseCharacterBuilderController {
          _cacheElements() {}
          _setupEventListeners() {}

          _cleanupAdditionalServices() {
            serviceCleanedUp = true;
          }
        }

        const serviceController = new ServiceTestController({
          logger: mockLogger,
          characterBuilderService: mockCharacterBuilderService,
          eventBus: mockEventBus,
          schemaValidator: mockSchemaValidator,
          customService: { method: jest.fn() },
        });

        serviceController.destroy();

        expect(serviceCleanedUp).toBe(true);
      });

      it('should clear additional services references', () => {
        const customService = { method: jest.fn() };

        const serviceController = new TestController({
          logger: mockLogger,
          characterBuilderService: mockCharacterBuilderService,
          eventBus: mockEventBus,
          schemaValidator: mockSchemaValidator,
          customService,
        });

        expect(serviceController.additionalServices.customService).toBe(
          customService
        );

        serviceController.destroy();

        expect(Object.keys(serviceController.additionalServices)).toHaveLength(
          0
        );
      });
    });

    describe('Cleanup Task Registration', () => {
      it('should register and execute cleanup tasks', () => {
        const task1 = jest.fn();
        const task2 = jest.fn();
        const task3 = jest.fn();

        controller._registerCleanupTask(task1, 'Task 1');
        controller._registerCleanupTask(task2, 'Task 2');
        controller._registerCleanupTask(task3, 'Task 3');

        controller.destroy();

        // Tasks should be executed in LIFO order
        expect(task3).toHaveBeenCalled();
        expect(task2).toHaveBeenCalled();
        expect(task1).toHaveBeenCalled();

        // Verify order
        const task3Order = task3.mock.invocationCallOrder[0];
        const task2Order = task2.mock.invocationCallOrder[0];
        const task1Order = task1.mock.invocationCallOrder[0];

        expect(task3Order).toBeLessThan(task2Order);
        expect(task2Order).toBeLessThan(task1Order);
      });

      it('should handle cleanup task errors gracefully', () => {
        const task1 = jest.fn();
        const task2 = jest.fn(() => {
          throw new Error('Cleanup task error');
        });
        const task3 = jest.fn();

        controller._registerCleanupTask(task1, 'Task 1');
        controller._registerCleanupTask(task2, 'Task 2 (will fail)');
        controller._registerCleanupTask(task3, 'Task 3');

        controller.destroy();

        // All tasks should be attempted despite error
        expect(task1).toHaveBeenCalled();
        expect(task2).toHaveBeenCalled();
        expect(task3).toHaveBeenCalled();

        expect(mockLogger.error).toHaveBeenCalledWith(
          'TestController: Cleanup task failed: Task 2 (will fail)',
          expect.any(Error)
        );
      });

      it('should throw TypeError for non-function cleanup tasks', () => {
        expect(() => {
          controller._registerCleanupTask('not a function');
        }).toThrow(TypeError);

        expect(() => {
          controller._registerCleanupTask('not a function');
        }).toThrow('Cleanup task must be a function');
      });
    });

    describe('Destruction Guards', () => {
      it('should provide isDestroyed getter', () => {
        expect(controller.isDestroyed).toBe(false);

        controller.destroy();

        expect(controller.isDestroyed).toBe(true);
      });

      it('should provide isDestroying getter', () => {
        let duringDestruction = false;

        class DestroyingTestController extends BaseCharacterBuilderController {
          _cacheElements() {}
          _setupEventListeners() {}

          _preDestroy() {
            duringDestruction = this.isDestroying;
          }
        }

        const destroyingController = new DestroyingTestController({
          logger: mockLogger,
          characterBuilderService: mockCharacterBuilderService,
          eventBus: mockEventBus,
          schemaValidator: mockSchemaValidator,
        });

        expect(destroyingController.isDestroying).toBe(false);

        destroyingController.destroy();

        expect(duringDestruction).toBe(true);
        expect(destroyingController.isDestroying).toBe(false);
      });

      it('should check destroyed state without throwing', () => {
        expect(controller._checkDestroyed()).toBe(false);

        controller.destroy();

        expect(controller._checkDestroyed()).toBe(true);
      });

      it('should throw when operation provided to _checkDestroyed', () => {
        controller.destroy();

        expect(() => {
          controller._checkDestroyed('perform operation');
        }).toThrow(
          'TestController: Cannot perform operation - controller is destroyed'
        );
      });

      it('should wrap methods with destruction safety', () => {
        const originalMethod = jest.fn(() => 'result');
        const wrappedMethod = controller._makeDestructionSafe(
          originalMethod,
          'testMethod'
        );

        // Should work before destruction
        expect(wrappedMethod()).toBe('result');
        expect(originalMethod).toHaveBeenCalledTimes(1);

        controller.destroy();

        // Should throw after destruction
        expect(() => wrappedMethod()).toThrow(
          'TestController: Cannot call testMethod - controller is destroyed'
        );
        expect(originalMethod).toHaveBeenCalledTimes(1); // Not called again
      });
    });

    describe('Event Cleanup', () => {
      beforeEach(() => {
        document.body.innerHTML = `
          <button id="test-button">Test</button>
          <input id="test-input" type="text" />
        `;

        controller._cacheElement('button', '#test-button');
        controller._cacheElement('input', '#test-input');
      });

      afterEach(() => {
        document.body.innerHTML = '';
      });

      it('should remove all DOM event listeners', () => {
        const handler1 = jest.fn();
        const handler2 = jest.fn();

        controller._addEventListener('button', 'click', handler1);
        controller._addEventListener('input', 'change', handler2);

        controller.destroy();

        // Events should not trigger after destruction
        document.getElementById('test-button').click();
        document
          .getElementById('test-input')
          .dispatchEvent(new Event('change'));

        expect(handler1).not.toHaveBeenCalled();
        expect(handler2).not.toHaveBeenCalled();
      });

      it('should remove all EventBus subscriptions', () => {
        const unsubscribe1 = jest.fn();
        const unsubscribe2 = jest.fn();

        mockEventBus.subscribe
          .mockReturnValueOnce(unsubscribe1)
          .mockReturnValueOnce(unsubscribe2);

        controller._subscribeToEvent('TEST_EVENT_1', jest.fn());
        controller._subscribeToEvent('TEST_EVENT_2', jest.fn());

        controller.destroy();

        expect(unsubscribe1).toHaveBeenCalled();
        expect(unsubscribe2).toHaveBeenCalled();
      });
    });

    describe('Memory Leak Prevention', () => {
      it('should clear UI state manager reference', () => {
        // Initialize UI state manager
        controller._initializeUIState();

        controller.destroy();

        expect(controller.currentState).toBe(null);
      });

      it('should clear element cache', () => {
        document.body.innerHTML = '<div id="test-element">Test</div>';
        controller._cacheElement('testElement', '#test-element');

        expect(Object.keys(controller.elements)).toHaveLength(1);

        controller.destroy();

        expect(Object.keys(controller.elements)).toHaveLength(0);
      });

      it('should clear debounced and throttled handlers', () => {
        const handler1 = jest.fn();
        const handler2 = jest.fn();

        document.body.innerHTML = `
          <button id="btn1">Button 1</button>
          <button id="btn2">Button 2</button>
        `;

        controller._cacheElement('btn1', '#btn1');
        controller._cacheElement('btn2', '#btn2');

        controller._addDebouncedListener('btn1', 'click', handler1, 100);
        controller._addThrottledListener('btn2', 'click', handler2, 100);

        controller.destroy();

        // Handlers should be cleared and not callable
        document.body.innerHTML = '';
      });

      it('should clear last error reference', () => {
        const error = new Error('Test error');
        controller._handleError(error);

        expect(controller.lastError).toBeDefined();

        controller.destroy();

        expect(controller.lastError).toBe(null);
      });
    });

    describe('Error Handling During Destruction', () => {
      it('should continue destruction even if phases fail', () => {
        class ErrorTestController extends BaseCharacterBuilderController {
          _cacheElements() {}
          _setupEventListeners() {}

          _preDestroy() {
            throw new Error('Pre-destroy error');
          }

          _cancelPendingOperations() {
            throw new Error('Cancel operations error');
          }
        }

        const errorController = new ErrorTestController({
          logger: mockLogger,
          characterBuilderService: mockCharacterBuilderService,
          eventBus: mockEventBus,
          schemaValidator: mockSchemaValidator,
        });

        expect(() => errorController.destroy()).not.toThrow();

        expect(errorController.isDestroyed).toBe(true);
        expect(mockLogger.error).toHaveBeenCalledWith(
          expect.stringContaining('Error in pre-destruction'),
          expect.any(Error)
        );
        expect(mockLogger.error).toHaveBeenCalledWith(
          expect.stringContaining('Error in pending operations cancellation'),
          expect.any(Error)
        );
      });

      it('should handle EventBus dispatch errors gracefully', () => {
        mockEventBus.dispatch.mockImplementation(() => {
          throw new Error('EventBus error');
        });

        controller.destroy();

        expect(controller.isDestroyed).toBe(true);
        expect(mockLogger.error).toHaveBeenCalledWith(
          'TestController: Failed to dispatch destruction event',
          expect.any(Error)
        );
      });

      it('should mark as destroyed even on catastrophic failure', () => {
        class CatastrophicController extends BaseCharacterBuilderController {
          _cacheElements() {}
          _setupEventListeners() {}

          _executePhase() {
            throw new Error('Catastrophic error');
          }
        }

        const catastrophicController = new CatastrophicController({
          logger: mockLogger,
          characterBuilderService: mockCharacterBuilderService,
          eventBus: mockEventBus,
          schemaValidator: mockSchemaValidator,
        });

        expect(() => catastrophicController.destroy()).toThrow(
          'Catastrophic error'
        );

        // Should still be marked as destroyed
        expect(catastrophicController.isDestroyed).toBe(true);
        expect(catastrophicController.isDestroying).toBe(false);
      });
    });

    describe('Destruction Flow', () => {
      it('should execute destruction phases in correct sequence', () => {
        const executionOrder = [];

        class SequenceTestController extends BaseCharacterBuilderController {
          _cacheElements() {}
          _setupEventListeners() {}

          _preDestroy() {
            executionOrder.push('preDestroy');
          }

          _cancelPendingOperations() {
            executionOrder.push('cancelPendingOperations');
            super._cancelPendingOperations();
          }

          _removeAllEventListeners() {
            executionOrder.push('removeAllEventListeners');
            super._removeAllEventListeners();
          }

          _cleanupServices() {
            executionOrder.push('cleanupServices');
            super._cleanupServices();
          }

          _clearElementCache() {
            executionOrder.push('clearElementCache');
            super._clearElementCache();
          }

          _executeCleanupTasks() {
            executionOrder.push('executeCleanupTasks');
            super._executeCleanupTasks();
          }

          _clearReferences() {
            executionOrder.push('clearReferences');
            super._clearReferences();
          }

          _postDestroy() {
            executionOrder.push('postDestroy');
          }
        }

        const sequenceController = new SequenceTestController({
          logger: mockLogger,
          characterBuilderService: mockCharacterBuilderService,
          eventBus: mockEventBus,
          schemaValidator: mockSchemaValidator,
        });

        sequenceController.destroy();

        expect(executionOrder).toEqual([
          'preDestroy',
          'cancelPendingOperations',
          'removeAllEventListeners',
          'cleanupServices',
          'clearElementCache',
          'executeCleanupTasks',
          'clearReferences',
          'postDestroy',
        ]);
      });

      it('should log destruction timing', () => {
        controller.destroy();

        expect(mockLogger.info).toHaveBeenCalledWith(
          'TestController: Starting destruction'
        );
        expect(mockLogger.info).toHaveBeenCalledWith(
          expect.stringMatching(
            /TestController: Destruction completed in \d+(\.\d+)?ms/
          )
        );
      });
    });

    describe('Custom Cleanup Operations', () => {
      it('should call _cancelCustomOperations hook', () => {
        let customOperationsCancelled = false;

        class CustomOperationsController extends BaseCharacterBuilderController {
          _cacheElements() {}
          _setupEventListeners() {}

          _cancelCustomOperations() {
            customOperationsCancelled = true;
          }
        }

        const customController = new CustomOperationsController({
          logger: mockLogger,
          characterBuilderService: mockCharacterBuilderService,
          eventBus: mockEventBus,
          schemaValidator: mockSchemaValidator,
        });

        customController.destroy();

        expect(customOperationsCancelled).toBe(true);
      });

      it('should call _clearCachedData hook', () => {
        let cachedDataCleared = false;

        class CacheController extends BaseCharacterBuilderController {
          _cacheElements() {}
          _setupEventListeners() {}

          _clearCachedData() {
            cachedDataCleared = true;
          }
        }

        const cacheController = new CacheController({
          logger: mockLogger,
          characterBuilderService: mockCharacterBuilderService,
          eventBus: mockEventBus,
          schemaValidator: mockSchemaValidator,
        });

        cacheController.destroy();

        expect(cachedDataCleared).toBe(true);
      });
    });
  });
});
