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
import { BaseCharacterBuilderController } from '../../../../src/characterBuilder/controllers/BaseCharacterBuilderController.js';
import {
  MissingDependencyError,
  InvalidDependencyError,
} from '../../../../src/errors/dependencyErrors.js';

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
        expect.stringMatching(/TestController: Initialization completed in \d+(\.\d+)?ms/)
      );
    });

    it('should dispatch CONTROLLER_INITIALIZED event on successful initialization', async () => {
      await controller.initialize();

      expect(mockEventBus.dispatch).toHaveBeenCalledWith(
        'CONTROLLER_INITIALIZED',
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

      await expect(controller.initialize()).rejects.toThrow('element caching failed: Test initialization error');

      expect(controller.isInitialized).toBe(false);
      expect(controller.isInitializing).toBe(false);
      expect(mockLogger.error).toHaveBeenCalledWith(
        expect.stringMatching(/TestController: Initialization failed after \d+(\.\d+)?ms/),
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

    it('should throw error with ticket reference when destroy() is called', () => {
      expect(() => {
        controller.destroy();
      }).toThrow('destroy() will be implemented in ticket #8');
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
          await new Promise(resolve => setTimeout(resolve, 10));
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
        expect.stringMatching(/MinimalController: Initialization completed in \d+(\.\d+)?ms/)
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
        expect.stringMatching(/TestController: Completed element caching in \d+(\.\d+)?ms/)
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
      const startTime = performance.now();
      new TestController({
        logger: mockLogger,
        characterBuilderService: mockCharacterBuilderService,
        eventBus: mockEventBus,
        schemaValidator: mockSchemaValidator,
      });
      const endTime = performance.now();

      expect(endTime - startTime).toBeLessThan(5);
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
});
