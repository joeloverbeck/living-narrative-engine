# Ticket #7: Create Error Handling Framework

## Overview

Build a comprehensive error handling framework in the BaseCharacterBuilderController that provides consistent error logging, user feedback, and recovery mechanisms across all character builder pages.

## Priority

**Medium** - Error handling improves robustness but builds on existing features.

## Dependencies

- Ticket #1: Base Controller Class Structure (completed)
- Ticket #5: UI State Management (completed - for error display)

## Production Context

**IMPORTANT**: This workflow assumes a simple controller structure, but the production BaseCharacterBuilderController is highly sophisticated with 2,400+ lines of test coverage and advanced infrastructure.

### Existing Production Files

- **Controller**: `src/characterBuilder/controllers/BaseCharacterBuilderController.js`
- **Tests**: `tests/unit/characterBuilder/controllers/BaseCharacterBuilderController.test.js`
- **Error Classes**: `src/errors/dependencyErrors.js`, `src/actions/errors/actionErrorTypes.js`
- **Schema Validation**: `src/validation/ajvSchemaValidator.js`, `src/utils/schemaValidationUtils.js`
- **UI State Management**: `src/shared/characterBuilder/uiStateManager.js`
- **Test Infrastructure**: `tests/common/testbed.js`

### Production Infrastructure Already Available

- Advanced error handling with `ActionErrorContext` pattern
- Comprehensive validation with `AjvSchemaValidator` and `validateAgainstSchema` utility
- Sophisticated UI state management with state hooks and transitions
- Event handling infrastructure with delegation, debouncing, and async operations
- 8-phase lifecycle management with detailed error context
- DOM element management with caching and validation

## Estimated Effort

**1-2 hours**

## Acceptance Criteria

1. ✅ Unified error handling methods for service operations
2. ✅ Data validation error handling with schema integration
3. ✅ User-friendly error message generation
4. ✅ Error recovery mechanisms
5. ✅ Consistent error event dispatching
6. ✅ Error context preservation for debugging
7. ✅ Retry logic for transient failures
8. ✅ Error categorization (user, system, validation, network)

## Implementation Details

**NOTE**: Many of these patterns already exist in the BaseCharacterBuilderController. Review existing implementation in `src/characterBuilder/controllers/BaseCharacterBuilderController.js` before adding new code.

### 1. Error Type Definitions

The following constants may already exist or can be added to `BaseCharacterBuilderController.js`:

```javascript
/**
 * Error categories for consistent handling
 * @readonly
 * @enum {string}
 */
export const ERROR_CATEGORIES = {
  VALIDATION: 'validation',
  NETWORK: 'network',
  SYSTEM: 'system',
  USER: 'user',
  PERMISSION: 'permission',
  NOT_FOUND: 'not_found',
};

/**
 * Error severity levels
 * @readonly
 * @enum {string}
 */
export const ERROR_SEVERITY = {
  INFO: 'info',
  WARNING: 'warning',
  ERROR: 'error',
  CRITICAL: 'critical',
};
```

### 2. Main Error Handling Method

```javascript
/**
 * Handle errors with consistent logging and user feedback
 * @protected
 * @param {Error|string} error - The error that occurred
 * @param {object} [context={}] - Error context
 * @param {string} [context.operation] - Operation that failed
 * @param {string} [context.category] - Error category
 * @param {string} [context.severity] - Error severity
 * @param {string} [context.userMessage] - Custom user message
 * @param {boolean} [context.showToUser=true] - Whether to show error to user
 * @param {object} [context.metadata] - Additional error metadata
 * @returns {object} Error details for further handling
 * @example
 * // Handle service error
 * this._handleError(error, {
 *   operation: 'loadCharacterConcepts',
 *   category: ERROR_CATEGORIES.NETWORK,
 *   userMessage: 'Failed to load character concepts. Please try again.'
 * });
 *
 * // Handle validation error
 * this._handleError(validationError, {
 *   operation: 'saveCharacter',
 *   category: ERROR_CATEGORIES.VALIDATION,
 *   severity: ERROR_SEVERITY.WARNING
 * });
 */
_handleError(error, context = {}) {
  const errorDetails = this._buildErrorDetails(error, context);

  // Log the error
  this._logError(errorDetails);

  // Show to user if appropriate
  if (context.showToUser !== false) {
    this._showErrorToUser(errorDetails);
  }

  // Dispatch error event for monitoring
  this._dispatchErrorEvent(errorDetails);

  // Check if recoverable
  if (this._isRecoverableError(errorDetails)) {
    this._attemptErrorRecovery(errorDetails);
  }

  return errorDetails;
}

/**
 * Build comprehensive error details
 * @private
 */
_buildErrorDetails(error, context) {
  const isErrorObject = error instanceof Error;

  return {
    message: isErrorObject ? error.message : String(error),
    stack: isErrorObject ? error.stack : new Error().stack,
    name: isErrorObject ? error.name : 'Error',
    timestamp: new Date().toISOString(),
    controller: this.constructor.name,
    operation: context.operation || 'unknown',
    category: context.category || this._categorizeError(error),
    severity: context.severity || ERROR_SEVERITY.ERROR,
    userMessage: context.userMessage || this._generateUserMessage(error, context),
    metadata: {
      ...context.metadata,
      url: window.location.href,
      userAgent: navigator.userAgent,
    },
    isRecoverable: this._determineRecoverability(error, context),
  };
}

/**
 * Categorize error automatically
 * @private
 */
_categorizeError(error) {
  const message = error.message || error.toString();

  if (message.includes('validation') || message.includes('invalid')) {
    return ERROR_CATEGORIES.VALIDATION;
  }
  if (message.includes('network') || message.includes('fetch')) {
    return ERROR_CATEGORIES.NETWORK;
  }
  if (message.includes('permission') || message.includes('unauthorized')) {
    return ERROR_CATEGORIES.PERMISSION;
  }
  if (message.includes('not found') || message.includes('404')) {
    return ERROR_CATEGORIES.NOT_FOUND;
  }

  return ERROR_CATEGORIES.SYSTEM;
}

/**
 * Generate user-friendly error message
 * @private
 */
_generateUserMessage(error, context) {
  // If custom message provided, use it
  if (context.userMessage) {
    return context.userMessage;
  }

  // Generate based on category
  switch (context.category || this._categorizeError(error)) {
    case ERROR_CATEGORIES.VALIDATION:
      return 'Please check your input and try again.';
    case ERROR_CATEGORIES.NETWORK:
      return 'Connection error. Please check your internet and try again.';
    case ERROR_CATEGORIES.PERMISSION:
      return 'You don\'t have permission to perform this action.';
    case ERROR_CATEGORIES.NOT_FOUND:
      return 'The requested resource was not found.';
    default:
      return 'An error occurred. Please try again or contact support.';
  }
}
```

### 3. Error Logging

```javascript
/**
 * Log error with appropriate level
 * @private
 */
_logError(errorDetails) {
  const logData = {
    message: errorDetails.message,
    operation: errorDetails.operation,
    category: errorDetails.category,
    metadata: errorDetails.metadata,
  };

  switch (errorDetails.severity) {
    case ERROR_SEVERITY.INFO:
      this._logger.info(
        `${this.constructor.name}: ${errorDetails.operation} info`,
        logData
      );
      break;
    case ERROR_SEVERITY.WARNING:
      this._logger.warn(
        `${this.constructor.name}: ${errorDetails.operation} warning`,
        logData
      );
      break;
    case ERROR_SEVERITY.CRITICAL:
      this._logger.error(
        `${this.constructor.name}: CRITICAL ERROR in ${errorDetails.operation}`,
        errorDetails
      );
      break;
    default:
      this._logger.error(
        `${this.constructor.name}: Error in ${errorDetails.operation}`,
        logData
      );
  }
}

/**
 * Show error to user using existing UI state management infrastructure
 * @private
 */
_showErrorToUser(errorDetails) {
  // Use existing UIStateManager integration (already implemented in BaseCharacterBuilderController)
  // The controller already has sophisticated error display via _showError method
  if (typeof this._showError === 'function') {
    // Use existing _showError implementation that integrates with UIStateManager
    this._showError(errorDetails.userMessage);
  } else {
    // Fallback to existing error state display if _showError not available
    // Use existing UI_STATES.ERROR from UIStateManager integration
    if (typeof this._showState === 'function') {
      this._showState('error', {
        message: errorDetails.userMessage,
        category: errorDetails.category,
        severity: errorDetails.severity,
      });
    } else {
      // Final fallback to console (should not happen in production)
      console.error('Error display not available:', errorDetails.userMessage);
    }
  }
}

/**
 * Dispatch error event for monitoring using existing event bus infrastructure
 * @private
 */
_dispatchErrorEvent(errorDetails) {
  // Use existing eventBus integration (BaseCharacterBuilderController already has this)
  if (this.eventBus) {
    // Follow existing SYSTEM_ERROR_OCCURRED event pattern used throughout the codebase
    this.eventBus.dispatch('SYSTEM_ERROR_OCCURRED', {
      error: errorDetails.message,
      context: errorDetails.operation,
      category: errorDetails.category,
      severity: errorDetails.severity,
      controller: errorDetails.controller,
      timestamp: errorDetails.timestamp,
      stack: errorDetails.stack,
      metadata: errorDetails.metadata,
    });
  }
}
```

### 4. Service Error Handling

```javascript
/**
 * Handle service errors with consistent logging and user feedback
 * @protected
 * @param {Error} error - The error that occurred
 * @param {string} operation - Description of the operation that failed
 * @param {string} [userMessage] - Custom user-friendly message
 * @throws {Error} Re-throws the error after handling
 */
_handleServiceError(error, operation, userMessage) {
  this._handleError(error, {
    operation,
    category: ERROR_CATEGORIES.SYSTEM,
    userMessage,
    showToUser: true,
  });

  // Re-throw for caller to handle if needed
  throw error;
}

/**
 * Execute operation with error handling
 * @protected
 * @param {Function} operation - Async operation to execute
 * @param {string} operationName - Name for logging
 * @param {object} [options={}] - Options
 * @param {string} [options.userErrorMessage] - Custom error message
 * @param {number} [options.retries=0] - Number of retries for transient failures
 * @param {number} [options.retryDelay=1000] - Delay between retries in ms
 * @returns {Promise<any>} Operation result
 * @example
 * const data = await this._executeWithErrorHandling(
 *   () => this._characterBuilderService.getData(),
 *   'loadData',
 *   {
 *     userErrorMessage: 'Failed to load data',
 *     retries: 3
 *   }
 * );
 */
async _executeWithErrorHandling(operation, operationName, options = {}) {
  const {
    userErrorMessage,
    retries = 0,
    retryDelay = 1000,
  } = options;

  let lastError;
  let attempt = 0;

  while (attempt <= retries) {
    try {
      this._logger.debug(
        `${this.constructor.name}: Executing ${operationName} (attempt ${attempt + 1}/${retries + 1})`
      );

      const result = await operation();

      if (attempt > 0) {
        this._logger.info(
          `${this.constructor.name}: ${operationName} succeeded after ${attempt} retries`
        );
      }

      return result;

    } catch (error) {
      lastError = error;
      attempt++;

      const isRetryable = this._isRetryableError(error) && attempt <= retries;

      this._handleError(error, {
        operation: operationName,
        userMessage: userErrorMessage,
        showToUser: !isRetryable, // Don't show to user if we're retrying
        metadata: {
          attempt,
          maxRetries: retries,
          isRetrying: isRetryable,
        },
      });

      if (isRetryable) {
        this._logger.info(
          `${this.constructor.name}: Retrying ${operationName} after ${retryDelay}ms`
        );
        await new Promise(resolve => setTimeout(resolve, retryDelay * attempt));
      } else {
        break;
      }
    }
  }

  // All retries failed
  throw lastError;
}
```

### 5. Validation Error Handling

```javascript
/**
 * Validate data against schema with error handling
 * Uses the existing AjvSchemaValidator interface and validateAgainstSchema utility
 * @protected
 * @param {object} data - Data to validate
 * @param {string} schemaId - Schema ID for validation
 * @param {object} [context={}] - Validation context options for enhanced error handling
 * @returns {{isValid: boolean, errors?: Array, errorMessage?: string}} Validation result
 */
_validateData(data, schemaId, context = {}) {
  try {
    // Use the sophisticated validateAgainstSchema utility from schemaValidationUtils.js
    // with proper context configuration for enhanced error handling
    const validationContext = {
      validationDebugMessage: `${this.constructor.name}: Validating data against schema '${schemaId}'`,
      notLoadedMessage: `${this.constructor.name}: Schema '${schemaId}' not loaded`,
      notLoadedLogLevel: 'error',
      skipIfSchemaNotLoaded: false,
      failureMessage: (errors) => `${this.constructor.name}: Validation failed for schema '${schemaId}' with ${errors.length} error(s)`,
      failureContext: {
        operation: context.operation || 'validateData',
        controller: this.constructor.name,
        schemaId
      },
      failureThrowMessage: 'Schema validation failed',
      appendErrorDetails: true,
      ...context
    };

    // The AjvSchemaValidator validateAgainstSchema method returns boolean directly
    const isValid = this.schemaValidator.validateAgainstSchema(data, schemaId, validationContext);

    if (isValid) {
      return { isValid: true };
    }

    // If validation failed, get the detailed validation result for error formatting
    const detailedResult = this.schemaValidator.validate(schemaId, data);
    const formattedErrors = this._formatValidationErrors(detailedResult.errors);

    return {
      isValid: false,
      errors: formattedErrors,
      errorMessage: this._buildValidationErrorMessage(formattedErrors),
    };

  } catch (error) {
    // Handle schema loading errors or validation system failures
    this._handleError(error, {
      operation: context.operation || 'validateData',
      category: ERROR_CATEGORIES.SYSTEM,
      userMessage: 'Validation failed. Please check your input.',
      metadata: { schemaId, dataKeys: Object.keys(data || {}) },
    });

    return {
      isValid: false,
      errors: [`Validation error: ${error.message}`],
      errorMessage: 'Unable to validate data. Please try again.',
    };
  }
}

/**
 * Format validation errors for display
 * @private
 */
_formatValidationErrors(errors) {
  if (!Array.isArray(errors)) {
    return ['Invalid data format'];
  }

  return errors.map(error => {
    if (typeof error === 'string') {
      return error;
    }

    // Handle AJV error format
    if (error.instancePath && error.message) {
      const field = error.instancePath.replace(/^\//, '').replace(/\//g, '.');
      return field ? `${field}: ${error.message}` : error.message;
    }

    return error.message || 'Unknown validation error';
  });
}

/**
 * Build user-friendly validation error message
 * @private
 */
_buildValidationErrorMessage(errors) {
  if (errors.length === 1) {
    return errors[0];
  }

  return `Please fix the following errors:\n${errors.map(e => `• ${e}`).join('\n')}`;
}
```

### 6. Error Recovery

```javascript
/**
 * Determine if error is recoverable
 * @private
 */
_determineRecoverability(error, context) {
  // Network errors are often recoverable
  if (context.category === ERROR_CATEGORIES.NETWORK) {
    return true;
  }

  // Some system errors might be transient
  if (error.message && error.message.includes('temporary')) {
    return true;
  }

  // Validation and permission errors are not recoverable
  if ([ERROR_CATEGORIES.VALIDATION, ERROR_CATEGORIES.PERMISSION].includes(context.category)) {
    return false;
  }

  return false;
}

/**
 * Check if error is retryable
 * @private
 */
_isRetryableError(error) {
  const retryableMessages = [
    'network',
    'timeout',
    'fetch',
    'temporary',
    'unavailable',
  ];

  const errorMessage = error.message?.toLowerCase() || '';
  return retryableMessages.some(msg => errorMessage.includes(msg));
}

/**
 * Check if error is recoverable
 * @private
 */
_isRecoverableError(errorDetails) {
  return errorDetails.isRecoverable &&
         errorDetails.severity !== ERROR_SEVERITY.CRITICAL;
}

/**
 * Attempt to recover from error
 * @private
 */
_attemptErrorRecovery(errorDetails) {
  this._logger.info(
    `${this.constructor.name}: Attempting recovery from ${errorDetails.category} error`
  );

  switch (errorDetails.category) {
    case ERROR_CATEGORIES.NETWORK:
      // Retry after delay
      setTimeout(() => {
        this._retryLastOperation();
      }, 5000);
      break;

    case ERROR_CATEGORIES.SYSTEM:
      // Attempt to reinitialize
      if (errorDetails.operation === 'initialization') {
        setTimeout(() => {
          this._reinitialize();
        }, 2000);
      }
      break;

    default:
      // No automatic recovery
      break;
  }
}

/**
 * Retry last operation (override in subclasses)
 * @protected
 */
_retryLastOperation() {
  // Default implementation - no-op
  // Subclasses can override to implement retry logic
}
```

### 7. Error Utilities

```javascript
/**
 * Create a standardized error
 * @protected
 * @param {string} message - Error message
 * @param {string} [category] - Error category
 * @param {object} [metadata] - Additional metadata
 * @returns {Error} Standardized error
 */
_createError(message, category, metadata) {
  const error = new Error(message);
  error.category = category;
  error.metadata = metadata;
  error.controller = this.constructor.name;
  return error;
}

/**
 * Wrap error with additional context
 * @protected
 * @param {Error} error - Original error
 * @param {string} context - Additional context
 * @returns {Error} Wrapped error
 */
_wrapError(error, context) {
  const wrappedError = new Error(`${context}: ${error.message}`);
  wrappedError.originalError = error;
  wrappedError.stack = error.stack;
  return wrappedError;
}

/**
 * Get last error details (for debugging)
 * @protected
 * @returns {object|null} Last error details
 */
get lastError() {
  return this._lastError || null;
}
```

### 8. Add Error Tracking

Update constructor to include error tracking:

```javascript
// Add to field declarations
/** @private @type {object} */
_lastError = null;

// Update _handleError to track last error
_handleError(error, context = {}) {
  const errorDetails = this._buildErrorDetails(error, context);

  // Track last error
  this._lastError = errorDetails;

  // ... rest of implementation
}
```

## Technical Considerations

**NOTE**: The BaseCharacterBuilderController already has sophisticated error handling infrastructure that should be considered during implementation:

### Existing Controller Complexity

The production BaseCharacterBuilderController has:

- **2,400+ lines of comprehensive test coverage** indicating high complexity
- **Advanced DOM Element Management** with caching, validation, and bulk operations
- **Sophisticated UI State Management** integration with UIStateManager class
- **Comprehensive Event Handling Infrastructure** with delegation, debouncing, and async operations
- **8-Phase Lifecycle Management** with detailed error context at each phase
- **Existing Error Enhancement Patterns** that add context, timing, and phase information

### Integration with Existing Systems

#### UI State Management Integration

- Reference existing `UIStateManager` class (`src/shared/characterBuilder/uiStateManager.js`)
- Use existing `UI_STATES` constants (EMPTY, LOADING, RESULTS, ERROR)
- Integrate with existing state transition hooks and event bus notifications

#### Event System Integration

- Leverage existing event listener management with comprehensive statistics
- Use existing `SYSTEM_ERROR_OCCURRED` event dispatching pattern
- Integrate with existing event cleanup and lifecycle management

#### Error Categorization

- Build upon existing `ActionErrorContext` pattern from `src/actions/errors/actionErrorTypes.js`
- Leverage existing domain-specific error classes (40+ specialized errors)
- Use existing `MissingDependencyError` and `InvalidDependencyError` patterns

### Debugging Support

- Preserve full error context and stack traces following existing patterns
- Use existing error enhancement utilities for phase tracking and timing
- Integrate with existing comprehensive logging infrastructure
- Provide methods to access error history following existing patterns

### Recovery Strategies

- Automatic retry for transient failures using existing service patterns
- Graceful degradation leveraging existing UI state management
- Clear feedback during recovery attempts via existing state hooks

## Testing Requirements

**NOTE**: The BaseCharacterBuilderController already has extensive test coverage that should be extended rather than replaced.

### Existing Test Infrastructure

The production controller has **2,400+ lines of test coverage** in `tests/unit/characterBuilder/controllers/BaseCharacterBuilderController.test.js` that includes:

- **Constructor Tests** - Comprehensive dependency validation patterns
- **Lifecycle Tests** - 8-phase initialization with error context tracking
- **DOM Element Management Tests** - Caching, validation, and bulk operation error handling
- **UI State Management Tests** - Integration with UIStateManager and error state transitions
- **Event Handling Tests** - Comprehensive event listener management with error scenarios

### Additional Test Cases Needed

Building on the existing framework, add tests for:

1. **Enhanced Error Handling**
   - Integration with existing error enhancement patterns
   - Error context preservation following existing patterns
   - Integration with existing `SYSTEM_ERROR_OCCURRED` event dispatching

2. **Error Categories Integration**
   - Integration with existing `ActionErrorContext` patterns
   - Compatibility with existing domain-specific error classes
   - Proper use of existing `MissingDependencyError` and `InvalidDependencyError`

3. **Service Operations with Existing Infrastructure**
   - Retry logic integration with existing lifecycle patterns
   - Integration with existing event bus error dispatching
   - Compatibility with existing DOM element management error handling

4. **Validation Integration**
   - Integration with existing AjvSchemaValidator interface
   - Use of sophisticated validateAgainstSchema utility patterns
   - Compatibility with existing schema loading and context patterns

5. **Recovery Mechanisms with UI State Management**
   - Integration with existing UIStateManager state transitions
   - Compatibility with existing form control management
   - Use of existing state change hooks and event bus notifications

### Mock Error Scenarios

```javascript
// Test different error types
it('should handle network errors with retry', async () => {
  let attempts = 0;
  const operation = jest.fn(async () => {
    attempts++;
    if (attempts < 3) {
      throw new Error('Network timeout');
    }
    return 'success';
  });

  const result = await controller._executeWithErrorHandling(
    operation,
    'testOperation',
    { retries: 3 }
  );

  expect(result).toBe('success');
  expect(attempts).toBe(3);
});

// Test validation errors
it('should format validation errors correctly', () => {
  const validationErrors = [
    { instancePath: '/name', message: 'must be string' },
    { instancePath: '/age', message: 'must be number' },
  ];

  const result = controller._formatValidationErrors(validationErrors);

  expect(result).toEqual(['name: must be string', 'age: must be number']);
});
```

## Definition of Done

- [ ] All error handling methods implemented
- [ ] Error categorization working correctly
- [ ] User messages are helpful and clear
- [ ] Retry logic functioning properly
- [ ] Recovery mechanisms in place
- [ ] Unit tests cover all error scenarios
- [ ] JSDoc documentation complete
- [ ] Integration with UI state management verified

## Notes for Implementer

**IMPORTANT**: This implementation should integrate with and enhance existing infrastructure rather than replace it.

### Production Code Integration

- **Study Existing Patterns** - Review the 2,400+ lines of existing test coverage to understand patterns
- **Leverage Existing Infrastructure** - Use `UIStateManager`, `AjvSchemaValidator`, and existing error classes
- **Follow Project Conventions** - Use dependency injection, existing validation patterns, and event bus integration
- **Maintain Test Coverage** - Extend existing comprehensive test suites rather than creating new ones

### Implementation Guidelines

- Keep user messages friendly and non-technical following existing `UIStateManager` patterns
- Ensure all errors are logged using existing logger interfaces and event dispatching
- Test with real service failures using existing test bed infrastructure (`tests/common/testbed.js`)
- Consider i18n for error messages in future (project has localization considerations)
- Make recovery attempts transparent using existing UI state transitions
- Preserve error context following existing `ActionErrorContext` patterns

### Required File References

- Existing error classes: `src/errors/dependencyErrors.js`, `src/actions/errors/actionErrorTypes.js`
- Schema validation: `src/validation/ajvSchemaValidator.js`, `src/utils/schemaValidationUtils.js`
- UI state management: `src/shared/characterBuilder/uiStateManager.js`
- Test infrastructure: `tests/unit/characterBuilder/controllers/BaseCharacterBuilderController.test.js`
- Production controller: `src/characterBuilder/controllers/BaseCharacterBuilderController.js`
