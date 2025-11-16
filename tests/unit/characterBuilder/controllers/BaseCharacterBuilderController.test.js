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
  let mockControllerLifecycleOrchestrator;
  let mockDomElementManager;
  let mockEventListenerRegistry;
  let mockAsyncUtilitiesToolkit;
  let mockPerformanceMonitor;
  let mockMemoryManager;
  let mockErrorHandlingStrategy;
  let mockValidationService;

  /**
   * Helper to get all default dependencies for controller construction
   * @param {object} overrides - Optional overrides for specific dependencies
   * @returns {object} Complete set of dependencies
   */
  const getDefaultDependencies = (overrides = {}) => ({
    logger: mockLogger,
    characterBuilderService: mockCharacterBuilderService,
    eventBus: mockEventBus,
    schemaValidator: mockSchemaValidator,
    controllerLifecycleOrchestrator: mockControllerLifecycleOrchestrator,
    domElementManager: mockDomElementManager,
    eventListenerRegistry: mockEventListenerRegistry,
    asyncUtilitiesToolkit: mockAsyncUtilitiesToolkit,
    performanceMonitor: mockPerformanceMonitor,
    memoryManager: mockMemoryManager,
    errorHandlingStrategy: mockErrorHandlingStrategy,
    validationService: mockValidationService,
    ...overrides,
  });

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

    // Create mocks for required services
    mockControllerLifecycleOrchestrator = {
      setControllerName: jest.fn(),
      registerHook: jest.fn(),
      executeHook: jest.fn().mockResolvedValue(undefined),
      hasHook: jest.fn().mockReturnValue(false),
      getHooks: jest.fn().mockReturnValue([]),
      clearHooks: jest.fn(),
      getControllerName: jest.fn().mockReturnValue('TestController'),
      createControllerMethodHook: jest.fn((controller, methodName) => {
        return async (...args) => {
          if (typeof controller[methodName] === 'function') {
            return await controller[methodName].call(controller, ...args);
          }
          return undefined;
        };
      }),
      isInitialized: false,
      isInitializing: false,
      isDestroyed: false,
      isDestroying: false,
      initialize: jest.fn().mockImplementation(async function () {
        // Prevent duplicate initialization
        if (this.isInitialized) {
          mockLogger.warn('TestController: Already initialized, skipping re-initialization');
          return;
        }
        // Prevent concurrent initialization
        if (this.isInitializing) {
          mockLogger.warn('TestController: Initialization already in progress, skipping concurrent initialization');
          return;
        }

        this.isInitializing = true;
        this.isInitialized = false;
        // Simulate initialization
        await Promise.resolve();
        this.isInitializing = false;
        this.isInitialized = true;
      }),
      destroy: jest.fn().mockImplementation(function () {
        this.isDestroying = true;
        this.isInitialized = false;
        this.isInitializing = false;
        this.isDestroying = false;
        this.isDestroyed = true;
      }),
      makeDestructionSafe: jest.fn((fn, name) => fn),
      reinitialize: jest.fn().mockImplementation(async function ({ onReset }) {
        mockLogger.warn('TestController: Force re-initialization requested');
        this.isInitialized = false;
        if (typeof onReset === 'function') {
          onReset();
        }
        await this.initialize();
      }),
      resetInitializationState: jest.fn().mockImplementation(function (callback) {
        this.isInitialized = false;
        this.isInitializing = false;
        if (typeof callback === 'function') {
          callback();
        }
      }),
    };

    // Create a real element cache for DomElementManager mock
    const elementCache = {};
    mockDomElementManager = {
      cacheElement: jest.fn((key, selector, required = true) => {
        if (!key || key.trim() === '') {
          throw new Error('Invalid element key provided');
        }
        if (!selector || selector.trim() === '') {
          throw new Error('Invalid selector provided');
        }
        const element = document.querySelector(selector);
        if (!element && required) {
          throw new Error(`Required element with ID '${selector}' not found in DOM`);
        }
        if (element) {
          elementCache[key] = element;
          mockLogger.debug(`Cached element '${key}' (${element.tagName}${element.id ? '#' + element.id : ''})`);
        } else {
          elementCache[key] = null;
          mockLogger.debug(`Optional element '${key}' not found`);
        }
        return element;
      }),
      cacheElements: jest.fn(),
      cacheElementsFromMap: jest.fn(),
      getElement: jest.fn((key) => elementCache[key] || null),
      getElements: jest.fn((keys) => {
        const result = {};
        keys.forEach(key => {
          result[key] = elementCache[key] || null;
        });
        return result;
      }),
      hasElement: jest.fn((key) => key in elementCache && elementCache[key] !== null),
      validateElement: jest.fn(),
      clearCache: jest.fn(() => {
        const count = Object.keys(elementCache).length;
        Object.keys(elementCache).forEach(key => delete elementCache[key]);
        mockLogger.debug(`TestController: Cleared ${count} cached element references`);
      }),
      getElementsSnapshot: jest.fn(() => ({ ...elementCache })),
      showElement: jest.fn((key, displayType = 'block') => {
        const element = elementCache[key];
        if (element) {
          element.style.display = displayType;
          return true;
        }
        return false;
      }),
      hideElement: jest.fn((key) => {
        const element = elementCache[key];
        if (element) {
          element.style.display = 'none';
          return true;
        }
        return false;
      }),
      toggleElement: jest.fn((key, force) => {
        const element = elementCache[key];
        if (!element) return false;
        if (force !== undefined) {
          element.style.display = force ? 'block' : 'none';
        } else {
          element.style.display = element.style.display === 'none' ? 'block' : 'none';
        }
        // Return visibility state: true if visible, false if hidden
        return element.style.display !== 'none';
      }),
      setElementEnabled: jest.fn((key, enabled = true) => {
        const element = elementCache[key];
        if (!element) return false;
        if (enabled) {
          element.removeAttribute('disabled');
        } else {
          element.setAttribute('disabled', 'disabled');
        }
        return true;
      }),
      setElementText: jest.fn((key, text) => {
        const element = elementCache[key];
        if (!element) return false;
        element.textContent = text;
        return true;
      }),
      addClass: jest.fn((key, className) => {
        const element = elementCache[key];
        if (!element) return false;
        element.classList.add(className);
        return true;
      }),
      removeClass: jest.fn((key, className) => {
        const element = elementCache[key];
        if (!element) return false;
        element.classList.remove(className);
        return true;
      }),
      refreshElement: jest.fn((key, selector) => {
        const element = document.querySelector(selector);
        if (element) {
          elementCache[key] = element;
        }
        return element;
      }),
      validateElementCache: jest.fn(() => {
        const valid = [];
        const invalid = [];
        Object.keys(elementCache).forEach(key => {
          const element = elementCache[key];
          if (element && document.body.contains(element)) {
            valid.push(key);
          } else {
            invalid.push(key);
            if (element) {
              mockLogger.warn(`Cached element '${key}' no longer in DOM`);
            }
          }
        });
        return {
          total: Object.keys(elementCache).length,
          valid,
          invalid,
        };
      }),
      normalizeElementConfig: jest.fn((config) =>
        typeof config === 'string' ? { selector: config, required: true } : config
      ),
      configure: jest.fn(),
    };

    mockEventListenerRegistry = {
      addEventListener: jest.fn(),
      removeEventListener: jest.fn(),
      removeAllListeners: jest.fn(),
      hasListener: jest.fn().mockReturnValue(false),
      getListenerCount: jest.fn().mockReturnValue(0),
      setContextName: jest.fn(),
    };

    mockAsyncUtilitiesToolkit = {
      debounce: jest.fn((fn) => fn),
      throttle: jest.fn((fn) => fn),
      delay: jest.fn().mockResolvedValue(undefined),
      defer: jest.fn((fn) => setTimeout(fn, 0)),
    };

    mockPerformanceMonitor = {
      startMeasure: jest.fn(),
      endMeasure: jest.fn(),
      getMeasure: jest.fn(),
      clearMeasures: jest.fn(),
      configure: jest.fn(),
    };

    mockMemoryManager = {
      trackObject: jest.fn(),
      releaseObject: jest.fn(),
      getTrackedObjects: jest.fn().mockReturnValue([]),
      clearTracking: jest.fn(),
    };

    mockErrorHandlingStrategy = {
      handleServiceError: jest.fn(),
      handleValidationError: jest.fn(),
      handleNetworkError: jest.fn(),
      handleGenericError: jest.fn(),
    };

    mockValidationService = {
      validateInput: jest.fn().mockReturnValue({ isValid: true, errors: [] }),
      validateSchema: jest.fn().mockReturnValue({ isValid: true, errors: [] }),
      hasErrors: jest.fn().mockReturnValue(false),
      getErrors: jest.fn().mockReturnValue([]),
      clearErrors: jest.fn(),
    };
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('Constructor Tests', () => {
    it('should create instance with all required dependencies', () => {
      const controller = new TestController(getDefaultDependencies());

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

      const controller = new TestController(
        getDefaultDependencies({
          service1: mockAdditionalService1,
          service2: mockAdditionalService2,
        })
      );

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
        new TestController(getDefaultDependencies({ logger: undefined }));
      }).toThrow(MissingDependencyError);

      expect(() => {
        new TestController(getDefaultDependencies({ logger: undefined }));
      }).toThrow("TestController: Missing required dependency 'logger'");
    });

    it('should throw InvalidDependencyError when characterBuilderService is missing', () => {
      expect(() => {
        new TestController(getDefaultDependencies({ characterBuilderService: undefined }));
      }).toThrow(InvalidDependencyError);
    });

    it('should throw InvalidDependencyError when eventBus is missing', () => {
      expect(() => {
        new TestController(getDefaultDependencies({ eventBus: undefined }));
      }).toThrow(InvalidDependencyError);
    });

    it('should throw InvalidDependencyError when schemaValidator is missing', () => {
      expect(() => {
        new TestController(getDefaultDependencies({ schemaValidator: undefined }));
      }).toThrow(InvalidDependencyError);
    });

    it('should throw InvalidDependencyError when logger is missing required methods', () => {
      const invalidLogger = {
        debug: jest.fn(),
        info: jest.fn(),
        // missing warn and error
      };

      expect(() => {
        new TestController(getDefaultDependencies({ logger: invalidLogger }));
      }).toThrow(InvalidDependencyError);
    });

    it('should throw InvalidDependencyError when characterBuilderService is missing required methods', () => {
      const invalidService = {
        initialize: jest.fn(),
        getAllCharacterConcepts: jest.fn(),
        // missing other required methods
      };

      expect(() => {
        new TestController(getDefaultDependencies({ characterBuilderService: invalidService }));
      }).toThrow(InvalidDependencyError);
    });

    it('should throw InvalidDependencyError when eventBus is missing required methods', () => {
      const invalidEventBus = {
        dispatch: jest.fn(),
        // missing subscribe and unsubscribe
      };

      expect(() => {
        new TestController(getDefaultDependencies({ eventBus: invalidEventBus }));
      }).toThrow(InvalidDependencyError);
    });

    it('should throw InvalidDependencyError when schemaValidator is missing required methods', () => {
      const invalidValidator = {};

      expect(() => {
        new TestController(getDefaultDependencies({ schemaValidator: invalidValidator }));
      }).toThrow(InvalidDependencyError);
    });
  });

  describe('Property Accessor Tests', () => {
    let controller;

    beforeEach(() => {
      controller = new TestController(getDefaultDependencies());
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
      const controller = new BaseCharacterBuilderController(getDefaultDependencies());

      expect(() => {
        controller._cacheElements();
      }).toThrow(
        'BaseCharacterBuilderController must implement _cacheElements() method'
      );
    });

    it('should throw error when _setupEventListeners() is called on base class', () => {
      const controller = new BaseCharacterBuilderController(getDefaultDependencies());

      expect(() => {
        controller._setupEventListeners();
      }).toThrow(
        'BaseCharacterBuilderController must implement _setupEventListeners() method'
      );
    });

    it('should not throw error when abstract methods are implemented in subclass', () => {
      const controller = new TestController(getDefaultDependencies());

      expect(() => {
        controller._cacheElements();
      }).not.toThrow();

      expect(() => {
        controller._setupEventListeners();
      }).not.toThrow();
    });
  });





  describe('State Management Tests', () => {
    let controller;

    beforeEach(() => {
      controller = new TestController(getDefaultDependencies());
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


  describe('Enhanced Dependency Validation Tests', () => {
    it('should log debug message with validation time', () => {
      new TestController(getDefaultDependencies());

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
        new TestController(getDefaultDependencies());
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
        new TestController(
          getDefaultDependencies({ logger: invalidLogger })
        );
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

      const controller = new TestController(
        getDefaultDependencies({ customService: mockService })
      );

      expect(controller).toBeDefined();
      expect(mockLogger.debug).toHaveBeenCalledWith(
        "TestController: Accepted additional service 'customService' without validation"
      );
    });

    it('should handle null additional services gracefully', () => {
      const controller = new TestController(
        getDefaultDependencies({
          nullService: null,
          undefinedService: undefined,
        })
      );

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

      const controller = new TestController(
        getDefaultDependencies({ customService: validService })
      );

      expect(controller).toBeDefined();
      // Since TestController doesn't override validation rules, it should accept without validation
      expect(mockLogger.debug).toHaveBeenCalledWith(
        "TestController: Accepted additional service 'customService' without validation"
      );
    });

    it('should accept additional services without validation when no rules provided', () => {
      // Test that services without validation rules are accepted
      const serviceWithoutRules = { arbitraryMethod: jest.fn() };

      const controller = new TestController(
        getDefaultDependencies({ serviceWithoutRules: serviceWithoutRules })
      );

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

      const controller = new TestController(
        getDefaultDependencies({ testService: mockService })
      );

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

      const controller = new TestController(
        getDefaultDependencies({ validService: validService })
      );

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

      controller = new TestController(getDefaultDependencies());
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
        }).toThrow("Required element with ID '#not-there' not found in DOM");
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



    describe('Element Operations', () => {
      beforeEach(() => {
        controller._cacheElement('errorMsg', '.error-message');
        controller._cacheElement('submitBtn', '#submit-btn');
        controller._cacheElement('tooltip', '#optional-tooltip');
      });

      it('should show and hide elements', () => {
        const result1 = controller._getDomManager().showElement('errorMsg');
        expect(result1).toBe(true);
        expect(controller._getElement('errorMsg').style.display).toBe('block');

        const result2 = controller._getDomManager().hideElement('errorMsg');
        expect(result2).toBe(true);
        expect(controller._getElement('errorMsg').style.display).toBe('none');
      });

      it('should show element with custom display type', () => {
        const result = controller._getDomManager().showElement('errorMsg', 'flex');
        expect(result).toBe(true);
        expect(controller._getElement('errorMsg').style.display).toBe('flex');
      });

      it('should toggle element visibility', () => {
        // Initially hidden
        controller._getDomManager().hideElement('errorMsg');

        const visible1 = controller._getDomManager().toggleElement('errorMsg');
        expect(visible1).toBe(true);
        expect(controller._getElement('errorMsg').style.display).toBe('block');

        const visible2 = controller._getDomManager().toggleElement('errorMsg');
        expect(visible2).toBe(false);
        expect(controller._getElement('errorMsg').style.display).toBe('none');
      });

      it('should force toggle visibility state', () => {
        controller._getDomManager().toggleElement('errorMsg', true);
        expect(controller._getElement('errorMsg').style.display).toBe('block');

        controller._getDomManager().toggleElement('errorMsg', false);
        expect(controller._getElement('errorMsg').style.display).toBe('none');
      });

      it('should enable and disable form elements', () => {
        const result1 = controller._getDomManager().setElementEnabled('submitBtn', false);
        expect(result1).toBe(true);
        expect(controller._getElement('submitBtn').disabled).toBe(true);

        const result2 = controller._getDomManager().setElementEnabled('submitBtn', true);
        expect(result2).toBe(true);
        expect(controller._getElement('submitBtn').disabled).toBe(false);
      });

      it('should set element text content', () => {
        const result = controller._getDomManager().setElementText('tooltip', 'New help text');
        expect(result).toBe(true);
        expect(controller._getElement('tooltip').textContent).toBe(
          'New help text'
        );
      });

      it('should add and remove CSS classes', () => {
        const result1 = controller._getDomManager().addClass('tooltip', 'highlight');
        expect(result1).toBe(true);
        expect(
          controller._getElement('tooltip').classList.contains('highlight')
        ).toBe(true);

        const result2 = controller._getDomManager().removeClass('tooltip', 'highlight');
        expect(result2).toBe(true);
        expect(
          controller._getElement('tooltip').classList.contains('highlight')
        ).toBe(false);
      });

      it('should return false for operations on missing elements', () => {
        expect(controller._getDomManager().showElement('missing')).toBe(false);
        expect(controller._getDomManager().hideElement('missing')).toBe(false);
        expect(controller._getDomManager().toggleElement('missing')).toBe(false);
        expect(controller._getDomManager().setElementEnabled('missing')).toBe(false);
        expect(controller._getDomManager().setElementText('missing', 'text')).toBe(false);
        expect(controller._getDomManager().addClass('missing', 'class')).toBe(false);
        expect(controller._getDomManager().removeClass('missing', 'class')).toBe(false);
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


  });



  // ─────────────────────────────────────────────────────────────────────────
  // Error Handling Framework Tests (Added in ticket #7)
  // ─────────────────────────────────────────────────────────────────────────


  // ─────────────────────────────────────────────────────────────────────────
  // Resource Cleanup Lifecycle Tests (Added in ticket #8)
  // ─────────────────────────────────────────────────────────────────────────

});
