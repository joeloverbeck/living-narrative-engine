# CLIGEN-007: Error Handling & Validation

## Overview

Implement comprehensive error handling and validation mechanisms for the Clichés Generator feature, ensuring robust operation, graceful degradation, and clear user feedback across all failure scenarios.

## Status

- **Status**: Ready for Implementation
- **Priority**: High
- **Estimated Time**: 3 hours
- **Complexity**: Medium
- **Dependencies**: CLIGEN-005 (Controller), CLIGEN-006 (State Management)
- **Blocks**: CLIGEN-008 (Service Integration)

## Objectives

1. **Create Domain-Specific Error Classes**: Define custom error types for cliché generation failures
2. **Implement Validation Logic**: Validate all user inputs and data integrity
3. **Establish Error Recovery**: Create strategies for graceful degradation
4. **Enhance User Feedback**: Provide clear, actionable error messages
5. **Integrate Event System**: Dispatch errors through EventBus for monitoring

## Technical Requirements

### Error Class Hierarchy

```javascript
// Base error for all cliché-related errors
class ClicheError extends Error

// Specific error types
class ClicheGenerationError extends ClicheError
class ClicheValidationError extends ClicheError
class ClicheStorageError extends ClicheError
class ClicheLLMError extends ClicheError
class ClicheDataIntegrityError extends ClicheError
```

### Validation Requirements

1. **Input Validation**
   - Direction ID must be non-empty UUID
   - Concept must exist and be valid
   - No duplicate generation requests while in progress

2. **Data Validation**
   - LLM response must match expected schema
   - All required categories must be present
   - Each category must have 3-5 items
   - Items must be non-empty strings

3. **State Validation**
   - Valid state transitions only
   - Prerequisites met before generation
   - Consistency between UI and data state

### Error Scenarios to Handle

| Scenario             | Error Type               | Recovery Strategy                 | User Message                                                        |
| -------------------- | ------------------------ | --------------------------------- | ------------------------------------------------------------------- |
| LLM timeout          | ClicheLLMError           | Retry with exponential backoff    | "Generation is taking longer than expected. Retrying..."            |
| Invalid LLM response | ClicheValidationError    | Request regeneration              | "Invalid response received. Please try again."                      |
| Storage failure      | ClicheStorageError       | Retry storage, fallback to memory | "Unable to save clichés. They will be available this session only." |
| Network error        | ClicheLLMError           | Check connection, retry           | "Network error. Please check your connection."                      |
| Duplicate generation | ClicheValidationError    | Show existing clichés             | "Clichés already exist for this direction."                         |
| Missing direction    | ClicheDataIntegrityError | Reload directions                 | "Selected direction not found. Refreshing..."                       |
| Malformed data       | ClicheValidationError    | Log and skip item                 | "Some data could not be processed."                                 |

## Implementation Tasks

### Task 1: Create Error Classes (30 minutes)

**File**: `src/errors/clicheErrors.js`

```javascript
/**
 * @file Domain-specific error classes for cliché generation
 */

/**
 * Base error class for all cliché-related errors
 */
export class ClicheError extends Error {
  constructor(message, details = {}) {
    super(message);
    this.name = 'ClicheError';
    this.code = details.code || 'CLICHE_ERROR';
    this.details = details;
    if (Error.captureStackTrace) {
      Error.captureStackTrace(this, ClicheError);
    }
  }
}

/**
 * Error thrown when LLM generation fails
 */
export class ClicheGenerationError extends ClicheError {
  constructor(message, details = {}) {
    super(message, { ...details, code: 'CLICHE_GENERATION_ERROR' });
    this.name = 'ClicheGenerationError';
    this.directionId = details.directionId;
    this.conceptId = details.conceptId;
  }
}

/**
 * Error thrown when validation fails
 */
export class ClicheValidationError extends ClicheError {
  constructor(message, validationErrors = [], details = {}) {
    super(message, {
      ...details,
      code: 'CLICHE_VALIDATION_ERROR',
      validationErrors,
    });
    this.name = 'ClicheValidationError';
    this.validationErrors = validationErrors;
  }
}

/**
 * Error thrown when storage operations fail
 */
export class ClicheStorageError extends ClicheError {
  constructor(message, operation, details = {}) {
    super(message, { ...details, code: 'CLICHE_STORAGE_ERROR', operation });
    this.name = 'ClicheStorageError';
    this.operation = operation;
  }
}

/**
 * Error thrown when LLM service fails
 */
export class ClicheLLMError extends ClicheError {
  constructor(message, statusCode = null, details = {}) {
    super(message, { ...details, code: 'CLICHE_LLM_ERROR', statusCode });
    this.name = 'ClicheLLMError';
    this.statusCode = statusCode;
  }
}

/**
 * Error thrown when data integrity is compromised
 */
export class ClicheDataIntegrityError extends ClicheError {
  constructor(message, dataType, details = {}) {
    super(message, {
      ...details,
      code: 'CLICHE_DATA_INTEGRITY_ERROR',
      dataType,
    });
    this.name = 'ClicheDataIntegrityError';
    this.dataType = dataType;
  }
}
```

### Task 2: Implement Validation Utilities (45 minutes)

**File**: `src/characterBuilder/validators/clicheValidator.js`

```javascript
/**
 * @file Validation utilities for cliché generation
 */

import { ClicheValidationError } from '../../errors/clicheErrors.js';
import { assertPresent } from '../../utils/dependencyUtils.js';
import { string } from '../../utils/validationCore.js';

/**
 * Validates direction selection
 */
export function validateDirectionSelection(directionId, directionsData) {
  string.assertNonBlank(directionId, 'directionId', 'direction selection');

  const direction = directionsData.find((d) => d.id === directionId);
  if (!direction) {
    throw new ClicheValidationError(
      'Selected direction not found',
      ['Direction does not exist in available options'],
      { directionId }
    );
  }

  return direction;
}

/**
 * Validates cliché generation prerequisites
 */
export function validateGenerationPrerequisites(
  direction,
  concept,
  isGenerating
) {
  if (isGenerating) {
    throw new ClicheValidationError('Generation already in progress', [
      'Cannot start new generation while another is running',
    ]);
  }

  assertPresent(direction, 'Direction must be selected');
  assertPresent(concept, 'Concept must be available');

  if (!direction.id || !direction.title) {
    throw new ClicheValidationError(
      'Invalid direction data',
      ['Direction missing required fields'],
      { direction }
    );
  }

  if (!concept.id || !concept.text) {
    throw new ClicheValidationError(
      'Invalid concept data',
      ['Concept missing required fields'],
      { concept }
    );
  }
}

/**
 * Validates LLM response structure
 */
export function validateLLMResponse(response) {
  const errors = [];

  if (!response || typeof response !== 'object') {
    throw new ClicheValidationError(
      'Invalid LLM response format',
      ['Response must be an object'],
      { response }
    );
  }

  // Validate categories
  const requiredCategories = [
    'names',
    'physicalDescriptions',
    'personalityTraits',
    'skillsAbilities',
    'typicalLikes',
    'typicalDislikes',
    'commonFears',
    'genericGoals',
    'backgroundElements',
    'overusedSecrets',
    'speechPatterns',
  ];

  const categories = response.categories || {};

  for (const category of requiredCategories) {
    if (!Array.isArray(categories[category])) {
      errors.push(`Category '${category}' must be an array`);
      continue;
    }

    if (categories[category].length < 3 || categories[category].length > 5) {
      errors.push(
        `Category '${category}' must have 3-5 items (found ${categories[category].length})`
      );
    }

    const invalidItems = categories[category].filter(
      (item) => typeof item !== 'string' || item.trim() === ''
    );

    if (invalidItems.length > 0) {
      errors.push(`Category '${category}' contains invalid items`);
    }
  }

  // Validate tropes
  if (!Array.isArray(response.tropesAndStereotypes)) {
    errors.push('tropesAndStereotypes must be an array');
  } else if (response.tropesAndStereotypes.length < 3) {
    errors.push('tropesAndStereotypes must have at least 3 items');
  }

  if (errors.length > 0) {
    throw new ClicheValidationError('LLM response validation failed', errors, {
      response,
    });
  }

  return true;
}

/**
 * Validates cliché data before storage
 */
export function validateClicheData(cliche) {
  const errors = [];

  if (!cliche.id) errors.push('Cliché ID is required');
  if (!cliche.directionId) errors.push('Direction ID is required');
  if (!cliche.conceptId) errors.push('Concept ID is required');
  if (!cliche.categories) errors.push('Categories are required');
  if (!cliche.tropesAndStereotypes) errors.push('Tropes are required');
  if (!cliche.createdAt) errors.push('Creation timestamp is required');

  if (errors.length > 0) {
    throw new ClicheValidationError('Invalid cliché data', errors, { cliche });
  }

  return true;
}

/**
 * Sanitizes user input
 */
export function sanitizeInput(input) {
  if (typeof input !== 'string') return input;

  // Remove potential XSS vectors
  return input
    .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '')
    .replace(/<iframe\b[^<]*(?:(?!<\/iframe>)<[^<]*)*<\/iframe>/gi, '')
    .replace(/javascript:/gi, '')
    .replace(/on\w+\s*=/gi, '')
    .trim();
}
```

### Task 3: Implement Error Handler Service (45 minutes)

**File**: `src/characterBuilder/services/clicheErrorHandler.js`

```javascript
/**
 * @file Error handling service for cliché generation
 */

import {
  ClicheError,
  ClicheLLMError,
  ClicheStorageError,
  ClicheValidationError,
} from '../../errors/clicheErrors.js';

/**
 * Centralized error handler for cliché operations
 */
export class ClicheErrorHandler {
  #logger;
  #eventBus;
  #retryConfig;

  constructor({ logger, eventBus }) {
    this.#logger = logger;
    this.#eventBus = eventBus;

    this.#retryConfig = {
      maxRetries: 3,
      baseDelay: 1000,
      maxDelay: 10000,
      backoffMultiplier: 2,
    };
  }

  /**
   * Handles errors with appropriate recovery strategies
   */
  async handleError(error, context = {}) {
    this.#logger.error(
      `Cliché error in ${context.operation || 'unknown'}:`,
      error
    );

    // Dispatch error event for monitoring
    this.#eventBus.dispatch({
      type: 'CLICHE_ERROR_OCCURRED',
      payload: {
        error: {
          name: error.name,
          message: error.message,
          code: error.code,
          details: error.details,
          stack: error.stack,
        },
        context,
        timestamp: new Date().toISOString(),
      },
    });

    // Determine recovery strategy
    if (error instanceof ClicheLLMError) {
      return this.#handleLLMError(error, context);
    }

    if (error instanceof ClicheStorageError) {
      return this.#handleStorageError(error, context);
    }

    if (error instanceof ClicheValidationError) {
      return this.#handleValidationError(error, context);
    }

    // Default handling for unknown errors
    return this.#handleUnknownError(error, context);
  }

  /**
   * Handles LLM-specific errors
   */
  async #handleLLMError(error, context) {
    const { attempt = 1 } = context;

    // Check if we should retry
    if (attempt < this.#retryConfig.maxRetries) {
      const delay = this.#calculateRetryDelay(attempt);

      this.#logger.info(
        `Retrying LLM operation (attempt ${attempt + 1}/${this.#retryConfig.maxRetries}) after ${delay}ms`
      );

      return {
        shouldRetry: true,
        delay,
        userMessage: `Generation is taking longer than expected. Retrying (${attempt + 1}/${this.#retryConfig.maxRetries})...`,
        nextAttempt: attempt + 1,
      };
    }

    return {
      shouldRetry: false,
      userMessage:
        'Unable to generate clichés at this time. Please try again later.',
      fallbackAction: 'SHOW_MANUAL_ENTRY',
    };
  }

  /**
   * Handles storage errors
   */
  async #handleStorageError(error, context) {
    // Try to use in-memory storage as fallback
    this.#logger.warn('Storage failed, using in-memory fallback');

    return {
      shouldRetry: false,
      userMessage:
        'Unable to save clichés permanently. They will be available for this session only.',
      fallbackAction: 'USE_MEMORY_STORAGE',
      canContinue: true,
    };
  }

  /**
   * Handles validation errors
   */
  async #handleValidationError(error, context) {
    const userMessages = {
      'Direction does not exist': 'Please select a valid thematic direction.',
      'Generation already in progress':
        'Please wait for the current generation to complete.',
      'Invalid LLM response':
        'Received invalid data. Please try generating again.',
    };

    const message = error.validationErrors?.[0] || error.message;

    return {
      shouldRetry: false,
      userMessage:
        userMessages[message] ||
        'Validation error occurred. Please check your input.',
      validationErrors: error.validationErrors,
      canContinue: false,
    };
  }

  /**
   * Handles unknown errors
   */
  async #handleUnknownError(error, context) {
    this.#logger.error('Unknown error encountered:', error);

    return {
      shouldRetry: false,
      userMessage:
        'An unexpected error occurred. Please refresh the page and try again.',
      requiresRefresh: true,
    };
  }

  /**
   * Calculates retry delay with exponential backoff
   */
  #calculateRetryDelay(attempt) {
    const delay = Math.min(
      this.#retryConfig.baseDelay *
        Math.pow(this.#retryConfig.backoffMultiplier, attempt - 1),
      this.#retryConfig.maxDelay
    );

    // Add jitter to prevent thundering herd
    const jitter = Math.random() * 0.3 * delay;

    return Math.floor(delay + jitter);
  }

  /**
   * Creates user-friendly error message
   */
  formatUserMessage(error, context = {}) {
    if (error instanceof ClicheError) {
      const messages = {
        CLICHE_GENERATION_ERROR:
          'Unable to generate clichés. Please try again.',
        CLICHE_VALIDATION_ERROR: 'Invalid input. Please check your selection.',
        CLICHE_STORAGE_ERROR: 'Unable to save data. Please try again.',
        CLICHE_LLM_ERROR:
          'Generation service is unavailable. Please try again later.',
        CLICHE_DATA_INTEGRITY_ERROR:
          'Data corruption detected. Please refresh the page.',
      };

      return messages[error.code] || error.message;
    }

    return 'An error occurred. Please try again.';
  }
}
```

### Task 4: Update Controller Error Handling (60 minutes)

**Updates to**: `src/clichesGenerator/controllers/ClichesGeneratorController.js`

Add these methods to the existing controller:

```javascript
import {
  ClicheError,
  ClicheGenerationError,
  ClicheValidationError,
  ClicheStorageError
} from '../../errors/clicheErrors.js';
import {
  validateDirectionSelection,
  validateGenerationPrerequisites,
  validateLLMResponse,
  validateClicheData
} from '../../characterBuilder/validators/clicheValidator.js';
import { ClicheErrorHandler } from '../../characterBuilder/services/clicheErrorHandler.js';

// In constructor, add:
this.#errorHandler = new ClicheErrorHandler({
  logger: this.logger,
  eventBus: this.eventBus
});

/**
 * Enhanced error handling for direction selection
 */
async #handleDirectionSelectionWithValidation(event) {
  try {
    const directionId = event.target.value;

    if (!directionId) {
      this.#updateUIState('empty');
      return;
    }

    // Validate selection
    const direction = validateDirectionSelection(directionId, this.#directionsData);

    await this.#processDirectionSelection(direction);

  } catch (error) {
    const recovery = await this.#errorHandler.handleError(error, {
      operation: 'directionSelection',
      directionId: event.target.value
    });

    this.#showErrorMessage(recovery.userMessage);

    if (recovery.requiresRefresh) {
      await this.#reloadDirections();
    }
  }
}

/**
 * Enhanced error handling for cliché generation
 */
async #handleGenerateClichesWithValidation() {
  let attempt = 1;

  while (attempt <= 3) {
    try {
      // Validate prerequisites
      validateGenerationPrerequisites(
        this.#currentDirection,
        this.#currentConcept,
        this.#isGenerating
      );

      this.#isGenerating = true;
      this.#updateUIState('generating');

      // Generate clichés
      const result = await this.characterBuilderService.generateClichesForDirection(
        this.#currentConcept,
        this.#currentDirection
      );

      // Validate response
      validateLLMResponse(result.llmResponse);
      validateClicheData(result);

      // Store and display
      await this.#storeAndDisplayCliches(result);

      this.#isGenerating = false;
      break;

    } catch (error) {
      this.#isGenerating = false;

      const recovery = await this.#errorHandler.handleError(error, {
        operation: 'generateCliches',
        attempt,
        directionId: this.#currentDirection?.id
      });

      if (recovery.shouldRetry && attempt < 3) {
        await this.#delay(recovery.delay);
        attempt = recovery.nextAttempt;
        this.#showStatusMessage(recovery.userMessage);
        continue;
      }

      this.#showErrorMessage(recovery.userMessage);

      if (recovery.fallbackAction === 'USE_MEMORY_STORAGE') {
        // Store in memory only
        this.#clichesCache.set(this.#currentDirection.id, result);
        await this.#displayCliches(result);
      }

      break;
    }
  }
}

/**
 * Graceful error recovery with state restoration
 */
async #recoverFromError(error, previousState) {
  try {
    // Log error context
    this.logger.error('Recovering from error:', error);

    // Restore previous state if available
    if (previousState) {
      this.#restoreState(previousState);
    }

    // Clear error indicators
    this.#clearErrorMessages();

    // Re-enable UI
    this.#enableControls();

    // Dispatch recovery event
    this.eventBus.dispatch({
      type: 'CLICHE_ERROR_RECOVERED',
      payload: {
        error: error.message,
        timestamp: new Date().toISOString()
      }
    });

  } catch (recoveryError) {
    this.logger.error('Failed to recover from error:', recoveryError);
    this.#showCriticalError();
  }
}

/**
 * Display user-friendly error messages
 */
#showErrorMessage(message, severity = 'error') {
  const messageHtml = `
    <div class="cb-message cb-message--${severity}" role="alert">
      <span class="cb-message__icon" aria-hidden="true">⚠️</span>
      <span class="cb-message__text">${this.#sanitizeForDisplay(message)}</span>
      <button class="cb-message__close" aria-label="Close message">×</button>
    </div>
  `;

  this.#statusMessages.innerHTML = messageHtml;

  // Auto-dismiss after 10 seconds for non-critical errors
  if (severity !== 'critical') {
    setTimeout(() => this.#clearErrorMessages(), 10000);
  }
}

/**
 * Utility: Delay for retry logic
 */
#delay(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * Utility: Sanitize text for safe display
 */
#sanitizeForDisplay(text) {
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}
```

### Task 5: Add UI Error States (30 minutes)

**Updates to**: Error display templates in the controller

```javascript
/**
 * Error state templates
 */
#getErrorStateHTML(error, context = {}) {
  const templates = {
    network: `
      <div class="cb-error-state">
        <div class="cb-error-icon">🌐</div>
        <h3>Connection Error</h3>
        <p>Unable to connect to the generation service.</p>
        <button class="cb-btn cb-btn--primary" onclick="location.reload()">
          Refresh Page
        </button>
      </div>
    `,

    validation: `
      <div class="cb-error-state">
        <div class="cb-error-icon">⚠️</div>
        <h3>Invalid Input</h3>
        <p>${error.message}</p>
        <ul class="cb-error-list">
          ${error.validationErrors?.map(e => `<li>${e}</li>`).join('') || ''}
        </ul>
      </div>
    `,

    generation: `
      <div class="cb-error-state">
        <div class="cb-error-icon">🚫</div>
        <h3>Generation Failed</h3>
        <p>Unable to generate clichés for this direction.</p>
        <button class="cb-btn cb-btn--secondary" data-retry="true">
          Try Again
        </button>
      </div>
    `,

    storage: `
      <div class="cb-error-state cb-error-state--warning">
        <div class="cb-error-icon">💾</div>
        <h3>Storage Warning</h3>
        <p>Clichés are available but couldn't be saved permanently.</p>
        <p class="cb-text-small">They will be lost when you close this page.</p>
      </div>
    `,

    critical: `
      <div class="cb-error-state cb-error-state--critical">
        <div class="cb-error-icon">🔥</div>
        <h3>Critical Error</h3>
        <p>Something went wrong. Please refresh the page.</p>
        <button class="cb-btn cb-btn--danger" onclick="location.reload()">
          Refresh Now
        </button>
      </div>
    `
  };

  return templates[context.type] || templates.critical;
}
```

## Testing Requirements

### Unit Tests

**File**: `tests/unit/errors/clicheErrors.test.js`

```javascript
describe('ClicheError Classes', () => {
  it('should create proper error hierarchy');
  it('should include all required properties');
  it('should serialize to JSON correctly');
  it('should maintain stack traces');
});
```

**File**: `tests/unit/characterBuilder/validators/clicheValidator.test.js`

```javascript
import { describe, it, expect, beforeEach } from '@jest/globals';
import { characterBuilderIntegrationTestBed } from '../../../common/characterBuilder/characterBuilderIntegrationTestBed.js';

describe('Cliché Validators', () => {
  let testBed;

  beforeEach(() => {
    testBed = new characterBuilderIntegrationTestBed();
  });

  describe('validateDirectionSelection', () => {
    it('should accept valid direction ID');
    it('should reject missing direction');
    it('should reject invalid direction');
  });

  describe('validateLLMResponse', () => {
    it('should accept valid response');
    it('should reject missing categories');
    it('should reject invalid item counts');
    it('should provide detailed validation errors');
  });
});
```

**File**: `tests/unit/characterBuilder/services/clicheErrorHandler.test.js`

```javascript
describe('ClicheErrorHandler', () => {
  it('should handle LLM errors with retry');
  it('should handle storage errors with fallback');
  it('should handle validation errors appropriately');
  it('should calculate exponential backoff correctly');
  it('should dispatch error events');
});
```

### Integration Tests

**File**: `tests/integration/clichesGenerator/errorHandling.test.js`

```javascript
import { describe, it, expect, beforeEach, afterEach } from '@jest/globals';
import { characterBuilderIntegrationTestBed } from '../../common/characterBuilder/characterBuilderIntegrationTestBed.js';

describe('Clichés Generator Error Handling', () => {
  let testBed;

  beforeEach(() => {
    testBed = new characterBuilderIntegrationTestBed();
  });

  afterEach(() => {
    testBed.cleanup();
  });

  it('should recover from LLM timeout');
  it('should handle network failures gracefully');
  it('should validate and reject malformed responses');
  it('should fall back to memory storage on DB failure');
  it('should show appropriate user messages');
});
```

## Success Criteria

- [ ] All error scenarios have custom error classes
- [ ] Validation catches all invalid inputs
- [ ] Error recovery strategies implemented
- [ ] User sees clear, actionable error messages
- [ ] Errors are logged and dispatched to EventBus
- [ ] Retry logic works with exponential backoff
- [ ] Graceful degradation for non-critical failures
- [ ] No unhandled promise rejections
- [ ] All error paths tested (>90% coverage)
- [ ] UI shows appropriate error states

## Risk Mitigation

| Risk                 | Impact | Mitigation                                        |
| -------------------- | ------ | ------------------------------------------------- |
| Silent failures      | High   | Comprehensive error logging and event dispatching |
| Poor user experience | Medium | Clear error messages and recovery options         |
| Data loss            | High   | Fallback to memory storage                        |
| Cascading failures   | Medium | Circuit breaker pattern for retries               |

## Dependencies

### Required Files (Must Exist)

- `src/clichesGenerator/controllers/ClichesGeneratorController.js`
- `src/characterBuilder/services/CharacterBuilderService.js`
- `src/utils/validationCore.js`
- `src/utils/dependencyUtils.js`

### Files to Create

- `src/errors/clicheErrors.js`
- `src/characterBuilder/validators/clicheValidator.js`
- `src/characterBuilder/services/clicheErrorHandler.js`

### Files to Modify

- `src/clichesGenerator/controllers/ClichesGeneratorController.js` (add error handling)

## Implementation Notes

1. **Error Boundaries**: Implement try-catch blocks at all async boundaries
2. **Event Dispatching**: All errors must be dispatched to EventBus for monitoring
3. **User Feedback**: Every error must result in user-visible feedback
4. **Recovery Options**: Provide actionable recovery options where possible
5. **Logging**: Use structured logging with error context
6. **Testing**: Mock all external dependencies in tests

## Completion Checklist

- [ ] Error class hierarchy created
- [ ] Validation utilities implemented
- [ ] Error handler service created
- [ ] Controller updated with error handling
- [ ] UI error states implemented
- [ ] Unit tests written and passing
- [ ] Integration tests written and passing
- [ ] Documentation updated
- [ ] Code reviewed
- [ ] No lint errors

---

**Ticket Status**: Ready for implementation
**Next Steps**: Implement error classes, then validators, then service, then update controller
