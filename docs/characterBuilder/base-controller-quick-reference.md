# BaseCharacterBuilderController Quick Reference

**Note**: The BaseCharacterBuilderController is located at `src/characterBuilder/controllers/BaseCharacterBuilderController.js` in the project structure.

## Essential Methods to Implement

```javascript
class MyController extends BaseCharacterBuilderController {
  // REQUIRED: Cache your DOM elements
  _cacheElements() {
    this._cacheElementsFromMap({
      elementKey: '#element-id',
      optional: { selector: '.class', required: false },
    });
  }

  // REQUIRED: Set up event listeners
  _setupEventListeners() {
    this._addEventListener('elementKey', 'event', handler);
    this._subscribeToEvent('APP_EVENT', handler);
  }
}
```

## Lifecycle Hooks (All Optional)

```javascript
async _preInitialize() { }      // Before initialization
async _initializeAdditionalServices() { }  // Service setup
async _loadInitialData() { }    // Load page data
async _initializeUIState() { }  // Set initial UI state (ASYNC!)
async _postInitialize() { }     // After initialization

_preDestroy() { }               // Before cleanup (SYNC!)
_postDestroy() { }              // After cleanup (SYNC!)
```

## Common Operations

### State Management

```javascript
this._showState('loading'); // Shows loading state
this._showError('Message'); // Shows error with message
this._showResults(data); // Shows results state
this._showEmpty(); // Shows empty state
```

### DOM Utilities

```javascript
this._getElement('key'); // Get cached element
this._showElement('key'); // Show element
this._hideElement('key'); // Hide element
this._toggleElement('key'); // Toggle visibility
this._setElementEnabled('key', true / false);
this._setElementText('key', 'text');
```

#### DOMElementManager service

DOM caching and manipulation now flow through the shared
`DOMElementManager` (`src/characterBuilder/services/domElementManager.js`).
Controllers still call `_cacheElementsFromMap()` and related helpers, but
the underlying service provides consistent logging, validation, and
performance metrics. If you need advanced behaviors (e.g., conditional
refreshing) you can access the service via `this._getDomManager()` and
call the same helper methods directly.

### Event Handling

```javascript
// DOM events with auto-cleanup
this._addEventListener('key', 'click', handler);

// Debounced events
this._addDebouncedListener('key', 'input', handler, 300);

// Throttled events
this._addThrottledListener('key', 'scroll', handler, 100);

// Delegated events
this._addDelegatedListener('container', '.btn', 'click', handler);

// App events
this._subscribeToEvent('EVENT', handler);
```

### Error Handling

```javascript
// With retries
await this._executeWithErrorHandling(asyncOperation, 'operation name', {
  retries: 3,
  userErrorMessage: 'Custom message',
});

// Simple error handling
this._handleServiceError(error, 'operation', 'User message');

// Validation
const result = this._validateData(data, 'schemaId');
if (!result.isValid) {
  this._showError(result.errorMessage);
}
```

### Timers (Auto-cleanup)

```javascript
this._setTimeout(callback, 1000);
this._setInterval(callback, 1000);
this._clearTimeout(timerId);
this._clearInterval(intervalId);
```

## Field Access

```javascript
// Base class fields accessed via getters
this.logger; // Logger instance
this.eventBus; // Event bus
this.characterBuilderService; // Character service
this.schemaValidator; // Schema validator

// Note: Cached DOM elements (_elements) are private and not accessible directly
// Use _getElement('key') to access cached elements

// Additional services are passed in constructor and stored privately
// Access them through constructor dependency injection
```

## Advanced Features

### Form Handling

```javascript
// Prevent default with callback
this._preventDefault(event, () => this._handleSubmit());

// Form validation - implement custom validation logic
// Base class provides _validateData() for schema validation
const result = this._validateData(formData, 'schemaId');
if (!result.isValid) {
  this._showError(result.errorMessage);
}

// Note: Base class doesn't provide field-level validation helpers
// Implement custom methods for:
// - Required field validation
// - Email validation
// - Length validation
// - Field error display
```

### UI State Management

```javascript
// UIStateManager integration (automatic if DOM structure exists)
this._showLoading('Processing...');
this._showResults();
this._showEmpty();
this._showError('Error message');

// Manual state management
this._showState('loading'); // 'loading', 'results', 'empty', 'error'
```

### Data Utilities

```javascript
// HTML escaping for security (import utility)
import { DomUtils } from '../../../utils/domUtils.js';
const escaped = DomUtils.escapeHtml(userInput);
// Also available: DomUtils.textToHtml(text) - converts newlines to <br>

// Text utilities - implement custom methods as needed
// Base class doesn't provide text formatting utilities like:
// - Date formatting
// - Number formatting
// - Text truncation
// Implement these in your controller as needed
```

### Service Integration

```javascript
// Service calls with error handling
const data = await this._executeWithErrorHandling(
  () => this.characterBuilderService.getData(),
  'load data',
  {
    retries: 2,
    userErrorMessage: 'Failed to load data',
    onRetry: (attempt) => this.logger.info(`Retry attempt ${attempt}`),
  }
);
```

## Testing Integration

```javascript
// Use the test base class (adjust path based on your test file location)
import { BaseCharacterBuilderControllerTestBase } from '../../../tests/unit/characterBuilder/controllers/BaseCharacterBuilderController.testbase.js';

describe('MyController', () => {
  const testBase = new BaseCharacterBuilderControllerTestBase();

  beforeEach(async () => {
    await testBase.setup();
    testBase.addDOMElement(`<!-- Your HTML -->`);
  });

  afterEach(async () => await testBase.cleanup());

  // Override controller creation
  testBase.createController = function () {
    return new MyController(this.mocks);
  };

  it('should work', async () => {
    testBase.controller = testBase.createController();
    await testBase.controller.initialize();
    // Test logic here
  });
});
```

## Element Caching Patterns

```javascript
_cacheElements() {
  this._cacheElementsFromMap({
    // Required elements
    form: '#my-form',
    submitBtn: '#submit-btn',

    // Optional elements
    advancedPanel: { selector: '#advanced-panel', required: false },

    // State containers (for UIStateManager)
    emptyState: '#empty-state',
    loadingState: '#loading-state',
    resultsState: '#results-state',
    errorState: '#error-state',
    errorMessageText: '#error-message-text',

    // Dynamic elements (may not exist initially)
    dynamicContent: { selector: '.dynamic', required: false }
  });
}
```

## Event Listener Patterns

```javascript
_setupEventListeners() {
  // Form submission
  this._addEventListener('form', 'submit', (e) => {
    this._preventDefault(e, () => this._handleSubmit());
  });

  // Input validation with debouncing
  this._addDebouncedListener('searchInput', 'input',
    this._handleSearch.bind(this), 300);

  // Button clicks
  this._addEventListener('submitBtn', 'click', this._handleSubmit.bind(this));

  // Application events
  this._subscribeToEvent('DATA_UPDATED', this._refreshData.bind(this));
  this._subscribeToEvent('USER_LOGGED_OUT', this._handleLogout.bind(this));

  // Conditional listeners
  if (this._elements.advancedBtn) {
    this._addEventListener('advancedBtn', 'click', this._toggleAdvanced.bind(this));
  }
}
```

## Common Method Patterns

```javascript
// Data loading with error handling
async _loadData() {
  try {
    this._showLoading('Loading data...');
    const data = await this.characterBuilderService.getData();
    this._processData(data);
    this._showResults();
  } catch (error) {
    this._handleServiceError(error, 'load data', 'Failed to load data');
  }
}

// Form validation - implement custom validation logic
_validateForm() {
  const name = this._getElement('nameInput')?.value?.trim();
  const email = this._getElement('emailInput')?.value?.trim();

  if (!name) {
    this._showError('Name is required');
    return false;
  }

  if (!email || !email.includes('@')) {
    this._showError('Valid email is required');
    return false;
  }

  return true;
}

// Display results (with import at top of file)
// import { DomUtils } from '../../../utils/domUtils.js';

_displayResults(data) {
  const container = this._getElement('resultsContainer');
  if (!container) return;

  container.innerHTML = data.map(item => `
    <div class="item">
      <h3>${DomUtils.escapeHtml(item.title)}</h3>
      <p>${DomUtils.escapeHtml(item.description)}</p>
    </div>
  `).join('');
}
```

## Don'ts

❌ Don't override `initialize()` or `destroy()`  
❌ Don't use private fields (#) for shared data  
❌ Don't manually remove event listeners  
❌ Don't directly manipulate element.style  
❌ Don't skip calling `super()` in constructor  
❌ Don't access private base class fields directly  
❌ Don't forget to call `super._initializeUIState()` if overriding  
❌ Don't use `console.log()` - use `this.logger`  
❌ Don't throw generic errors - use domain-specific errors  
❌ Don't skip validation - use base class validators

## Do's

✅ Use getter methods for base class fields  
✅ Override lifecycle hooks for custom logic  
✅ Use base class helper methods  
✅ Let base class handle cleanup automatically  
✅ Call `super()` first in constructor  
✅ Use `_cacheElementsFromMap()` for bulk caching  
✅ Use `_addEventListener()` for automatic cleanup  
✅ Use `_executeWithErrorHandling()` for service calls  
✅ Use `_showState()` for UI state management  
✅ Test with `BaseCharacterBuilderControllerTestBase`
