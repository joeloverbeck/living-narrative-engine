# Base Character Builder Controller Specification

## Overview

The Base Character Builder Controller is a foundational class that extracts common functionality from character builder page controllers, eliminating code duplication and ensuring consistent behavior across all character builder pages in the Living Narrative Engine.

### Purpose

- **Reduce Duplication**: Eliminate ~50% of controller code duplication across character builder pages
- **Ensure Consistency**: Provide standardized patterns for DOM handling, initialization, and error management
- **Simplify Testing**: Enable shared test patterns and common mock scenarios
- **Enable Easy Extension**: Allow new controllers to inherit proven patterns with minimal setup
- **Improve Maintainability**: Single point of modification for common controller behavior

## Requirements and Design Goals

### Functional Requirements

1. **Common Dependency Management**
   - Standardized constructor pattern with dependency validation
   - Support for logger, characterBuilderService, eventBus, and schemaValidator
   - Optional dependency injection for page-specific services
   - Consistent error handling for missing dependencies

2. **Template Method Pattern Implementation**
   - Abstract initialization workflow with customizable hooks
   - Standard lifecycle methods: `initialize()`, `cacheElements()`, `setupEventListeners()`
   - Customizable methods for page-specific behavior
   - Error boundaries for each lifecycle phase

3. **DOM Element Management**
   - Centralized element caching patterns
   - Consistent element validation and error handling
   - Support for optional elements with graceful degradation
   - Automatic element reference cleanup

4. **UI State Management Integration**
   - Built-in state management patterns (empty, loading, results, error)
   - Consistent state transition methods
   - Error display standardization
   - Loading indicator management

5. **Event Handling Standardization**
   - Common event listener setup patterns
   - Consistent event cleanup on destruction
   - Error handling for event operations
   - Support for both DOM and application events

### Non-Functional Requirements

1. **Performance**
   - Minimal inheritance overhead (< 5ms initialization impact)
   - Efficient DOM element caching
   - Lazy loading of optional features
   - Memory leak prevention through proper cleanup

2. **Extensibility**
   - Hook system for custom behavior injection
   - Override points for specialized functionality
   - Plugin architecture for additional features
   - Backward compatibility with existing controllers

3. **Developer Experience**
   - Clear API with comprehensive JSDoc documentation
   - Consistent error messages with actionable guidance
   - Debugging support with detailed logging
   - Migration path from existing controllers

4. **Testability**
   - Mockable dependencies with clear interfaces
   - Testable lifecycle methods
   - Isolated testing of individual features
   - Integration test support

## Implementation Guidelines

### Core Architecture

```javascript
// src/characterBuilder/controllers/BaseCharacterBuilderController.js
/**
 * Base class for all character builder page controllers
 * Provides common functionality and standardized patterns
 */
export class BaseCharacterBuilderController {
  /**
   * @param {object} dependencies
   * @param {ILogger} dependencies.logger - Logger instance
   * @param {CharacterBuilderService} dependencies.characterBuilderService - Character builder service
   * @param {ISafeEventDispatcher} dependencies.eventBus - Event dispatcher
   * @param {ISchemaValidator} dependencies.schemaValidator - Schema validator
   * @param {object} [dependencies.additionalServices={}] - Page-specific services
   */
  constructor(dependencies) {
    // Implementation details below
  }

  /**
   * Initialize the controller - template method pattern
   * @returns {Promise<void>}
   */
  async initialize() {
    // Implementation details below
  }

  // Additional methods defined below...
}
```

### Constructor Implementation

```javascript
class BaseCharacterBuilderController {
  // Protected fields - accessible to subclasses
  _logger;
  _characterBuilderService;
  _eventBus;
  _schemaValidator;
  _additionalServices;
  _elements = {};
  _isInitialized = false;
  _eventListeners = [];

  constructor({
    logger,
    characterBuilderService,
    eventBus,
    schemaValidator,
    ...additionalServices
  }) {
    // Validate required dependencies
    this._validateCoreDependencies({
      logger,
      characterBuilderService,
      eventBus,
      schemaValidator,
    });

    // Store dependencies
    this._logger = logger;
    this._characterBuilderService = characterBuilderService;
    this._eventBus = eventBus;
    this._schemaValidator = schemaValidator;
    this._additionalServices = additionalServices;

    // Log initialization
    this._logger.info(
      `${this.constructor.name}: Created with dependencies`,
      {
        additionalServices: Object.keys(additionalServices),
      }
    );
  }

  /**
   * Validate core dependencies required by all character builder controllers
   * @private
   */
  _validateCoreDependencies(dependencies) {
    const { logger, characterBuilderService, eventBus, schemaValidator } = dependencies;

    validateDependency(logger, 'ILogger', logger, {
      requiredMethods: ['debug', 'info', 'warn', 'error'],
    });

    validateDependency(characterBuilderService, 'CharacterBuilderService', logger, {
      requiredMethods: [
        'initialize',
        'getAllCharacterConcepts',
        'createCharacterConcept',
        'updateCharacterConcept',
        'deleteCharacterConcept',
      ],
    });

    validateDependency(eventBus, 'ISafeEventDispatcher', logger, {
      requiredMethods: ['dispatch', 'subscribe', 'unsubscribe'],
    });

    validateDependency(schemaValidator, 'ISchemaValidator', logger, {
      requiredMethods: ['validateAgainstSchema'],
    });
  }
}
```

### Template Method Pattern Implementation

```javascript
class BaseCharacterBuilderController {
  /**
   * Template method for controller initialization
   * Defines the standard initialization sequence with customization hooks
   */
  async initialize() {
    if (this._isInitialized) {
      this._logger.warn(`${this.constructor.name}: Already initialized`);
      return;
    }

    try {
      this._logger.info(`${this.constructor.name}: Starting initialization`);

      // Pre-initialization hook
      await this._preInitialize();

      // Step 1: Cache DOM elements
      this._cacheElements();

      // Step 2: Initialize services
      await this._initializeServices();

      // Step 3: Set up event listeners
      this._setupEventListeners();

      // Step 4: Load initial data
      await this._loadInitialData();

      // Step 5: Initialize UI state
      this._initializeUIState();

      // Post-initialization hook
      await this._postInitialize();

      this._isInitialized = true;
      this._logger.info(`${this.constructor.name}: Initialization completed`);

    } catch (error) {
      this._logger.error(
        `${this.constructor.name}: Initialization failed`,
        error
      );
      this._handleInitializationError(error);
      throw error;
    }
  }

  /**
   * Pre-initialization hook - override in subclasses for custom setup
   * @protected
   */
  async _preInitialize() {
    // Default implementation - no-op
    // Subclasses can override for custom pre-initialization logic
  }

  /**
   * Cache DOM elements - must be implemented by subclasses
   * @abstract
   * @protected
   */
  _cacheElements() {
    throw new Error(
      `${this.constructor.name} must implement _cacheElements() method`
    );
  }

  /**
   * Initialize services - template method with default implementation
   * @protected
   */
  async _initializeServices() {
    // Initialize character builder service
    if (this._characterBuilderService) {
      await this._characterBuilderService.initialize();
      this._logger.debug(`${this.constructor.name}: CharacterBuilderService initialized`);
    }

    // Initialize additional services
    await this._initializeAdditionalServices();
  }

  /**
   * Initialize additional page-specific services - override in subclasses
   * @protected 
   */
  async _initializeAdditionalServices() {
    // Default implementation - no-op
    // Subclasses can override to initialize page-specific services
  }

  /**
   * Set up event listeners - must be implemented by subclasses
   * @abstract
   * @protected
   */
  _setupEventListeners() {
    throw new Error(
      `${this.constructor.name} must implement _setupEventListeners() method`
    );
  }

  /**
   * Load initial data - override in subclasses
   * @protected
   */
  async _loadInitialData() {
    // Default implementation - no-op
    // Subclasses can override to load page-specific data
  }

  /**
   * Initialize UI state - override in subclasses
   * @protected
   */
  _initializeUIState() {
    // Default implementation - show empty state
    this._showState('empty');
  }

  /**
   * Post-initialization hook - override in subclasses for custom finalization
   * @protected
   */
  async _postInitialize() {
    // Default implementation - no-op
    // Subclasses can override for custom post-initialization logic
  }
}
```

### Common Utility Methods

```javascript
class BaseCharacterBuilderController {
  /**
   * Cache a single DOM element with validation
   * @protected
   * @param {string} key - Key to store element under
   * @param {string} selector - CSS selector or element ID
   * @param {boolean} [required=true] - Whether element is required
   * @returns {HTMLElement|null} The cached element
   */
  _cacheElement(key, selector, required = true) {
    const element = selector.startsWith('#') 
      ? document.getElementById(selector.slice(1))
      : document.querySelector(selector);

    if (!element && required) {
      const error = new Error(`Required element not found: ${selector}`);
      this._logger.error(`${this.constructor.name}: ${error.message}`);
      throw error;
    }

    if (!element && !required) {
      this._logger.debug(
        `${this.constructor.name}: Optional element not found: ${selector}`
      );
    }

    this._elements[key] = element;
    return element;
  }

  /**
   * Cache multiple DOM elements from a mapping
   * @protected
   * @param {object} elementMap - Map of key -> selector pairs
   * @param {object} [options={}] - Caching options
   * @param {boolean} [options.continueOnError=true] - Continue if optional elements missing
   */
  _cacheElementsFromMap(elementMap, options = {}) {
    const { continueOnError = true } = options;

    for (const [key, config] of Object.entries(elementMap)) {
      try {
        const selector = typeof config === 'string' ? config : config.selector;
        const required = typeof config === 'string' ? true : (config.required !== false);
        
        this._cacheElement(key, selector, required);
      } catch (error) {
        if (!continueOnError) {
          throw error;
        }
        this._logger.warn(
          `${this.constructor.name}: Failed to cache element ${key}: ${error.message}`
        );
      }
    }
  }

  /**
   * Add event listener with automatic tracking for cleanup
   * @protected
   * @param {HTMLElement} element - Element to attach listener to
   * @param {string} event - Event type
   * @param {Function} handler - Event handler
   * @param {object} [options] - Event listener options
   */
  _addEventListener(element, event, handler, options) {
    if (!element) {
      this._logger.warn(
        `${this.constructor.name}: Cannot add ${event} listener to null element`
      );
      return;
    }

    element.addEventListener(event, handler, options);
    
    // Track for cleanup
    this._eventListeners.push({
      element,
      event,
      handler,
      options,
    });

    this._logger.debug(
      `${this.constructor.name}: Added ${event} listener to ${element.tagName}#${element.id}`
    );
  }

  /**
   * Show UI state - standardized state management
   * @protected
   * @param {string} state - State to show (empty, loading, results, error)
   * @param {object} [data] - Optional data for state
   */
  _showState(state, data = {}) {
    const states = ['empty', 'loading', 'results', 'error'];
    
    // Hide all state containers
    states.forEach(stateName => {
      const element = this._elements[`${stateName}State`];
      if (element) {
        element.style.display = 'none';
      }
    });

    // Show requested state
    const targetElement = this._elements[`${state}State`];
    if (targetElement) {
      targetElement.style.display = 'block';
      this._logger.debug(`${this.constructor.name}: Showing ${state} state`);
    } else {
      this._logger.warn(
        `${this.constructor.name}: State element not found: ${state}State`
      );
    }

    // Handle state-specific logic
    this._handleStateChange(state, data);
  }

  /**
   * Handle state change - override in subclasses for custom behavior
   * @protected
   * @param {string} state - The new state
   * @param {object} data - State data
   */
  _handleStateChange(state, data) {
    // Default implementation - no-op
    // Subclasses can override for state-specific behavior
  }

  /**
   * Show error state with message
   * @protected
   * @param {string|Error} error - Error message or Error object
   */
  _showError(error) {
    const message = typeof error === 'string' ? error : error.message;
    
    const errorElement = this._elements.errorMessageText;
    if (errorElement) {
      errorElement.textContent = message;
    }

    this._showState('error');
    this._logger.error(`${this.constructor.name}: Showing error: ${message}`);
  }

  /**
   * Handle initialization errors
   * @private
   * @param {Error} error
   */
  _handleInitializationError(error) {
    const userMessage = 'Failed to initialize page. Please refresh and try again.';
    this._showError(userMessage);
    
    // Dispatch error event for logging/monitoring
    if (this._eventBus) {
      this._eventBus.dispatch('SYSTEM_ERROR_OCCURRED', {
        error: error.message,
        context: `${this.constructor.name} initialization`,
        timestamp: new Date().toISOString(),
      });
    }
  }

  /**
   * Cleanup resources - call when controller is destroyed
   * @public
   */
  destroy() {
    this._logger.info(`${this.constructor.name}: Starting cleanup`);

    // Remove event listeners
    this._eventListeners.forEach(({ element, event, handler, options }) => {
      element.removeEventListener(event, handler, options);
    });
    this._eventListeners = [];

    // Clear element references
    this._elements = {};

    // Mark as uninitialized
    this._isInitialized = false;

    this._logger.info(`${this.constructor.name}: Cleanup completed`);
  }

  /**
   * Get initialization status
   * @public
   * @returns {boolean}
   */
  get isInitialized() {
    return this._isInitialized;
  }

  /**
   * Get cached elements (for testing)
   * @public
   * @returns {object}
   */
  get elements() {
    return { ...this._elements };
  }
}
```

### Error Handling and Validation

```javascript
class BaseCharacterBuilderController {
  /**
   * Validate form data against schema
   * @protected
   * @param {object} data - Data to validate
   * @param {string} schemaId - Schema ID for validation
   * @returns {{isValid: boolean, errors?: Array}} Validation result
   */
  _validateData(data, schemaId) {
    try {
      const result = this._schemaValidator.validateAgainstSchema(data, schemaId);
      return {
        isValid: result.isValid,
        errors: result.errors || [],
      };
    } catch (error) {
      this._logger.error(
        `${this.constructor.name}: Schema validation failed`,
        error
      );
      return {
        isValid: false,
        errors: [`Validation error: ${error.message}`],
      };
    }
  }

  /**
   * Handle service errors with consistent logging and user feedback
   * @protected
   * @param {Error} error - The error that occurred
   * @param {string} operation - Description of the operation that failed
   * @param {string} [userMessage] - Custom user-friendly message
   */
  _handleServiceError(error, operation, userMessage) {
    this._logger.error(
      `${this.constructor.name}: ${operation} failed`,
      error
    );

    const displayMessage = userMessage || 
      `Failed to ${operation.toLowerCase()}. Please try again.`;
    
    this._showError(displayMessage);

    // Dispatch error event
    this._eventBus.dispatch('SYSTEM_ERROR_OCCURRED', {
      error: error.message,
      operation,
      context: this.constructor.name,
      timestamp: new Date().toISOString(),
    });
  }

  /**
   * Execute operation with error handling
   * @protected
   * @param {Function} operation - Async operation to execute
   * @param {string} operationName - Name for logging
   * @param {string} [userErrorMessage] - Custom error message for users
   * @returns {Promise<any>} Operation result
   */
  async _executeWithErrorHandling(operation, operationName, userErrorMessage) {
    try {
      this._logger.debug(`${this.constructor.name}: Starting ${operationName}`);
      const result = await operation();
      this._logger.debug(`${this.constructor.name}: Completed ${operationName}`);
      return result;
    } catch (error) {
      this._handleServiceError(error, operationName, userErrorMessage);
      throw error;
    }
  }
}
```

## API Documentation

### Constructor Pattern

```javascript
// Standard usage
class MyController extends BaseCharacterBuilderController {
  constructor(dependencies) {
    super(dependencies);
    
    // Page-specific initialization
    this._myCustomService = dependencies.myCustomService;
  }
}

// Usage with additional services
const controller = new MyController({
  logger: container.resolve(tokens.ILogger),
  characterBuilderService: container.resolve(tokens.CharacterBuilderService),
  eventBus: container.resolve(tokens.ISafeEventDispatcher),
  schemaValidator: container.resolve(tokens.ISchemaValidator),
  myCustomService: container.resolve(tokens.MyCustomService),
});
```

### Required Implementation Methods

```javascript
class MyController extends BaseCharacterBuilderController {
  /**
   * REQUIRED: Cache DOM elements needed by the controller
   * @protected
   */
  _cacheElements() {
    // Option 1: Manual caching
    this._cacheElement('form', '#my-form');
    this._cacheElement('submitBtn', '#submit-btn');
    this._cacheElement('optional', '#optional-element', false);

    // Option 2: Bulk caching from map
    this._cacheElementsFromMap({
      form: '#my-form',
      submitBtn: '#submit-btn',
      cancelBtn: { selector: '#cancel-btn', required: false },
      emptyState: '#empty-state',
      loadingState: '#loading-state',
      resultsState: '#results-state',
      errorState: '#error-state',
      errorMessageText: '#error-message-text',
    });
  }

  /**
   * REQUIRED: Set up event listeners
   * @protected
   */
  _setupEventListeners() {
    // Use helper method for automatic cleanup
    this._addEventListener(this._elements.form, 'submit', (e) => {
      e.preventDefault();
      this._handleFormSubmit();
    });

    this._addEventListener(this._elements.submitBtn, 'click', () => {
      this._handleSubmit();
    });

    // Optional elements check
    if (this._elements.cancelBtn) {
      this._addEventListener(this._elements.cancelBtn, 'click', () => {
        this._handleCancel();
      });
    }
  }
}
```

### Optional Override Methods

```javascript
class MyController extends BaseCharacterBuilderController {
  /**
   * OPTIONAL: Pre-initialization setup
   * @protected
   */
  async _preInitialize() {
    // Custom setup before standard initialization
    await this._loadUserPreferences();
  }

  /**
   * OPTIONAL: Initialize additional services
   * @protected
   */
  async _initializeAdditionalServices() {
    if (this._myCustomService) {
      await this._myCustomService.initialize();
    }
  }

  /**
   * OPTIONAL: Load initial data
   * @protected
   */
  async _loadInitialData() {
    try {
      const data = await this._characterBuilderService.getInitialData();
      this._processInitialData(data);
    } catch (error) {
      this._handleServiceError(error, 'load initial data');
    }
  }

  /**
   * OPTIONAL: Initialize UI state
   * @protected
   */
  _initializeUIState() {
    // Custom initial state logic
    if (this._hasData()) {
      this._showState('results');
    } else {
      this._showState('empty');
    }
  }

  /**
   * OPTIONAL: Handle state changes
   * @protected
   */
  _handleStateChange(state, data) {
    switch (state) {
      case 'loading':
        this._disableButtons();
        break;
      case 'results':
        this._enableButtons();
        this._updateResultsDisplay(data);
        break;
      case 'error':
        this._enableButtons();
        break;
    }
  }

  /**
   * OPTIONAL: Post-initialization finalization
   * @protected
   */
  async _postInitialize() {
    // Custom finalization logic
    await this._checkForUpdates();
  }
}
```

### Lifecycle Hooks and Events

```javascript
class MyController extends BaseCharacterBuilderController {
  async initialize() {
    // The base class handles the full lifecycle:
    // 1. _preInitialize()
    // 2. _cacheElements() [REQUIRED]
    // 3. _initializeServices()
    // 4. _setupEventListeners() [REQUIRED]
    // 5. _loadInitialData()
    // 6. _initializeUIState()
    // 7. _postInitialize()
    
    await super.initialize();
    
    // Additional initialization if needed
    this._startPeriodicUpdates();
  }

  // Override lifecycle methods as needed
  async _preInitialize() {
    await this._validateEnvironment();
  }

  async _postInitialize() {
    this._scheduleDataRefresh();
  }
}
```

## Migration Guide

### Step 1: Identify Current Controller Structure

Analyze existing controller for common patterns:

```javascript
// BEFORE: Existing controller
class MyController {
  constructor({ logger, characterBuilderService, eventBus }) {
    // Manual dependency validation
    validateDependency(logger, 'ILogger', ...);
    validateDependency(characterBuilderService, 'CharacterBuilderService', ...);
    // ... more validation
    
    this.#logger = logger;
    this.#characterBuilderService = characterBuilderService;
    this.#elements = {};
  }

  async initialize() {
    // Manual initialization sequence
    this.#cacheElements();
    await this.#characterBuilderService.initialize();
    this.#setupEventListeners();
    // ... more initialization
  }

  #cacheElements() { /* ... */ }
  #setupEventListeners() { /* ... */ }
}
```

### Step 2: Create New Controller Extending Base Class

```javascript
// AFTER: Migrated controller
import { BaseCharacterBuilderController } from '../characterBuilder/controllers/BaseCharacterBuilderController.js';

class MyController extends BaseCharacterBuilderController {
  constructor(dependencies) {
    // Base class handles dependency validation
    super(dependencies);
    
    // Only page-specific dependencies need manual handling
    if (dependencies.customService) {
      this._customService = dependencies.customService;
    }
  }

  // REQUIRED: Implement abstract methods
  _cacheElements() {
    this._cacheElementsFromMap({
      form: '#my-form',
      submitBtn: '#submit-btn',
      // ... other elements
    });
  }

  _setupEventListeners() {
    this._addEventListener(this._elements.form, 'submit', (e) => {
      e.preventDefault();
      this._handleFormSubmit();
    });
    // ... other listeners
  }

  // OPTIONAL: Override lifecycle methods as needed
  async _loadInitialData() {
    const data = await this._characterBuilderService.getMyData();
    this._processData(data);
  }

  // Page-specific methods remain unchanged
  async _handleFormSubmit() { /* ... */ }
  _processData(data) { /* ... */ }
}
```

### Step 3: Update Element References

```javascript
// BEFORE: Private fields with # syntax
class MyController {
  #elements = {};
  
  #cacheElements() {
    this.#elements.form = document.getElementById('my-form');
  }
  
  #handleSubmit() {
    this.#elements.form.reset();
  }
}

// AFTER: Protected fields accessible to base class
class MyController extends BaseCharacterBuilderController {
  _cacheElements() {
    this._cacheElement('form', '#my-form');
  }
  
  _handleSubmit() {
    this._elements.form.reset();
  }
}
```

### Step 4: Update Error Handling

```javascript
// BEFORE: Manual error handling
class MyController {
  async #loadData() {
    try {
      const data = await this.#service.getData();
      return data;
    } catch (error) {
      this.#logger.error('Failed to load data', error);
      this.#showError('Failed to load data. Please try again.');
      throw error;
    }
  }
}

// AFTER: Use base class error handling utilities
class MyController extends BaseCharacterBuilderController {
  async _loadData() {
    return this._executeWithErrorHandling(
      () => this._characterBuilderService.getData(),
      'load data',
      'Failed to load data. Please try again.'
    );
  }
}
```

### Step 5: Test and Verify

1. **Verify Functionality**: Ensure all existing functionality works as before
2. **Check Error Handling**: Confirm error scenarios display properly
3. **Validate Performance**: Ensure initialization time is acceptable
4. **Test Cleanup**: Verify proper resource cleanup on destroy

## Testing Approach

### Unit Tests for Base Class

```javascript
describe('BaseCharacterBuilderController', () => {
  let mockDependencies;
  let controller;

  beforeEach(() => {
    mockDependencies = {
      logger: createMockLogger(),
      characterBuilderService: createMockCharacterBuilderService(),
      eventBus: createMockEventBus(),
      schemaValidator: createMockSchemaValidator(),
    };
  });

  describe('constructor', () => {
    it('should validate required dependencies', () => {
      expect(() => new TestController({})).toThrow('Missing required dependency');
    });

    it('should store dependencies correctly', () => {
      controller = new TestController(mockDependencies);
      expect(controller._logger).toBe(mockDependencies.logger);
      expect(controller._characterBuilderService).toBe(mockDependencies.characterBuilderService);
    });
  });

  describe('initialization lifecycle', () => {
    beforeEach(() => {
      controller = new TestController(mockDependencies);
    });

    it('should follow proper initialization sequence', async () => {
      const spy = jest.spyOn(controller, '_cacheElements');
      await controller.initialize();
      
      expect(spy).toHaveBeenCalled();
      expect(controller.isInitialized).toBe(true);
    });

    it('should handle initialization errors gracefully', async () => {
      controller._cacheElements = jest.fn(() => {
        throw new Error('Element not found');
      });
      
      await expect(controller.initialize()).rejects.toThrow('Element not found');
      expect(controller.isInitialized).toBe(false);
    });
  });

  describe('element caching', () => {
    beforeEach(() => {
      controller = new TestController(mockDependencies);
      document.body.innerHTML = '<div id="test-element"></div>';
    });

    it('should cache required elements successfully', () => {
      const element = controller._cacheElement('test', '#test-element');
      expect(element).toBeDefined();
      expect(controller.elements.test).toBe(element);
    });

    it('should throw error for missing required elements', () => {
      expect(() => controller._cacheElement('missing', '#missing-element'))
        .toThrow('Required element not found');
    });

    it('should handle missing optional elements gracefully', () => {
      const element = controller._cacheElement('optional', '#missing-element', false);
      expect(element).toBeNull();
      expect(controller.elements.optional).toBeNull();
    });
  });

  describe('state management', () => {
    beforeEach(() => {
      controller = new TestController(mockDependencies);
      document.body.innerHTML = `
        <div id="empty-state" style="display: block;"></div>
        <div id="loading-state" style="display: none;"></div>
        <div id="results-state" style="display: none;"></div>
        <div id="error-state" style="display: none;"></div>
      `;
      controller._cacheElementsFromMap({
        emptyState: '#empty-state',
        loadingState: '#loading-state',
        resultsState: '#results-state',
        errorState: '#error-state',
      });
    });

    it('should show correct state and hide others', () => {
      controller._showState('loading');
      
      expect(controller._elements.loadingState.style.display).toBe('block');
      expect(controller._elements.emptyState.style.display).toBe('none');
      expect(controller._elements.resultsState.style.display).toBe('none');
      expect(controller._elements.errorState.style.display).toBe('none');
    });
  });
});

// Test controller implementation for testing
class TestController extends BaseCharacterBuilderController {
  _cacheElements() {
    // Test implementation
  }

  _setupEventListeners() {
    // Test implementation
  }
}
```

### Integration Tests with Real Controllers

```javascript
describe('Character Builder Controller Integration', () => {
  let testBed;
  let controller;

  beforeEach(() => {
    testBed = new CharacterBuilderTestBed();
    testBed.setupDOM();
  });

  afterEach(() => {
    testBed.cleanup();
  });

  it('should integrate with CharacterBuilderBootstrap', async () => {
    const bootstrap = new CharacterBuilderBootstrap();
    const result = await bootstrap.bootstrap({
      pageName: 'test-page',
      controllerClass: TestController,
    });

    expect(result.controller).toBeInstanceOf(TestController);
    expect(result.controller.isInitialized).toBe(true);
  });

  it('should handle real service interactions', async () => {
    controller = testBed.createController(TestController);
    await controller.initialize();

    // Test actual service calls
    const data = await controller._characterBuilderService.getAllCharacterConcepts();
    expect(data).toBeDefined();
  });
});
```

### Migration Testing Strategy

```javascript
describe('Controller Migration', () => {
  it('should maintain backward compatibility', async () => {
    // Test that migrated controller provides same public API
    const oldController = new OldController(dependencies);
    const newController = new NewMigratedController(dependencies);

    await oldController.initialize();
    await newController.initialize();

    // Verify same public methods exist
    expect(typeof newController.handleAction).toBe('function');
    expect(typeof newController.getData).toBe('function');
  });

  it('should produce identical results', async () => {
    const oldResult = await oldController.processData(testData);
    const newResult = await newController.processData(testData);

    expect(newResult).toEqual(oldResult);
  });
});
```

## Performance Considerations

### Inheritance Overhead

1. **Minimal Performance Impact**
   - Base class initialization: < 5ms additional overhead
   - Method call overhead: < 0.1ms per call
   - Memory usage: ~2KB additional per controller instance

2. **Optimization Strategies**
   - Lazy loading of optional features
   - Efficient event listener management
   - Minimal object creation during initialization
   - Proper cleanup to prevent memory leaks

### Memory Management

```javascript
class BaseCharacterBuilderController {
  destroy() {
    // Proper cleanup prevents memory leaks
    this._eventListeners.forEach(({ element, event, handler }) => {
      element.removeEventListener(event, handler);
    });
    this._eventListeners = [];
    this._elements = {};
    this._isInitialized = false;
  }
}
```

### Performance Monitoring

```javascript
class BaseCharacterBuilderController {
  async initialize() {
    const startTime = performance.now();
    
    // ... initialization logic
    
    const initTime = performance.now() - startTime;
    this._logger.debug(
      `${this.constructor.name}: Initialized in ${initTime.toFixed(2)}ms`
    );
    
    // Log performance metrics for monitoring
    if (initTime > 100) {
      this._logger.warn(
        `${this.constructor.name}: Slow initialization detected: ${initTime.toFixed(2)}ms`
      );
    }
  }
}
```

## Future Enhancements

### Phase 2 Considerations

1. **Advanced State Management**
   - State machine implementation for complex UI flows
   - Undo/redo functionality for form operations
   - Persistent state across page reloads

2. **Plugin Architecture**
   - Hook system for third-party extensions
   - Configurable behavior injection
   - Runtime feature toggling

3. **Performance Optimizations**
   - Virtual scrolling for large data sets
   - Debounced event handling
   - Background data prefetching

4. **Accessibility Enhancements**
   - ARIA label management
   - Keyboard navigation patterns
   - Screen reader optimization

## Conclusion

The Base Character Builder Controller provides a robust foundation that eliminates 50% of code duplication while ensuring consistent behavior across all character builder pages. The template method pattern allows for easy customization while maintaining standardized core functionality.

Implementation of this base class will:
- **Reduce maintenance burden** by centralizing common functionality
- **Improve developer productivity** through reusable patterns
- **Enhance code quality** with consistent error handling and validation
- **Enable easier testing** through shared test utilities and patterns
- **Facilitate future enhancements** with a solid architectural foundation

The migration path is straightforward and can be implemented incrementally, allowing for gradual adoption without disrupting existing functionality.