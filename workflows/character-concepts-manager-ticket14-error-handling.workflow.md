# Ticket 14: Error Handling and Recovery

## Overview

Implement comprehensive error handling throughout the Character Concepts Manager, including retry mechanisms, user-friendly error messages, and proper error logging.

## Dependencies

- All previous tickets (for integration)
- Existing error handling patterns in the codebase

## Implementation Details

### 1. Create Error Classes

Create specific error classes in `src/errors/characterBuilderErrors.js`:

```javascript
/**
 * @file Custom error classes for Character Builder functionality
 */

/**
 * Base error class for Character Builder errors
 */
export class CharacterBuilderError extends Error {
  constructor(message, code = 'UNKNOWN_ERROR', details = {}) {
    super(message);
    this.name = 'CharacterBuilderError';
    this.code = code;
    this.details = details;
    this.timestamp = new Date().toISOString();
  }
}

/**
 * Error for when a character concept is not found
 */
export class ConceptNotFoundError extends CharacterBuilderError {
  constructor(conceptId) {
    super(`Character concept not found: ${conceptId}`, 'CONCEPT_NOT_FOUND', {
      conceptId,
    });
    this.name = 'ConceptNotFoundError';
  }
}

/**
 * Error for database operations
 */
export class DatabaseError extends CharacterBuilderError {
  constructor(message, operation, originalError) {
    super(message, 'DATABASE_ERROR', {
      operation,
      originalError: originalError?.message,
    });
    this.name = 'DatabaseError';
    this.operation = operation;
  }
}

/**
 * Error for validation failures
 */
export class ValidationError extends CharacterBuilderError {
  constructor(message, field, value) {
    super(message, 'VALIDATION_ERROR', { field, value });
    this.name = 'ValidationError';
  }
}

/**
 * Error for network-related issues
 */
export class NetworkError extends CharacterBuilderError {
  constructor(message, url, statusCode) {
    super(message, 'NETWORK_ERROR', { url, statusCode });
    this.name = 'NetworkError';
  }
}

/**
 * Error for storage quota exceeded
 */
export class StorageQuotaError extends CharacterBuilderError {
  constructor(operation, estimatedSize) {
    super(
      'Storage quota exceeded. Please delete some data and try again.',
      'STORAGE_QUOTA_EXCEEDED',
      { operation, estimatedSize }
    );
    this.name = 'StorageQuotaError';
  }
}

/**
 * Error for concurrent modification
 */
export class ConcurrentModificationError extends CharacterBuilderError {
  constructor(resourceType, resourceId) {
    super(
      `${resourceType} was modified by another operation. Please refresh and try again.`,
      'CONCURRENT_MODIFICATION',
      { resourceType, resourceId }
    );
    this.name = 'ConcurrentModificationError';
  }
}
```

### 2. Implement Error Handler Service

Create `src/characterBuilder/errorHandler.js`:

```javascript
/**
 * @file Centralized error handling for Character Builder
 */

import { ensureValidLogger } from '../utils/loggerUtils.js';

export class CharacterBuilderErrorHandler {
  #logger;
  #eventBus;
  #errorHistory = [];
  #maxHistorySize = 50;

  constructor({ logger, eventBus }) {
    this.#logger = ensureValidLogger(logger);
    this.#eventBus = eventBus;
  }

  /**
   * Handle an error with appropriate logging and user feedback
   * @param {Error} error
   * @param {string} context - Where the error occurred
   * @param {Object} metadata - Additional error context
   * @returns {Object} Error response with user message and recovery options
   */
  handleError(error, context, metadata = {}) {
    // Log the error
    this.#logError(error, context, metadata);

    // Store in history
    this.#addToHistory(error, context, metadata);

    // Dispatch error event
    this.#dispatchErrorEvent(error, context, metadata);

    // Generate user-friendly response
    return this.#generateErrorResponse(error, context);
  }

  /**
   * Log error with appropriate level
   * @private
   */
  #logError(error, context, metadata) {
    const logData = {
      context,
      errorName: error.name,
      errorCode: error.code,
      message: error.message,
      stack: error.stack,
      metadata,
      timestamp: new Date().toISOString(),
    };

    // Determine log level based on error type
    if (this.#isCriticalError(error)) {
      this.#logger.error(`Critical error in ${context}`, logData);
    } else if (this.#isWarningError(error)) {
      this.#logger.warn(`Warning in ${context}`, logData);
    } else {
      this.#logger.info(`Handled error in ${context}`, logData);
    }
  }

  /**
   * Generate user-friendly error response
   * @private
   */
  #generateErrorResponse(error, context) {
    const response = {
      success: false,
      userMessage: this.#getUserMessage(error),
      errorCode: error.code || 'UNKNOWN_ERROR',
      canRetry: this.#canRetry(error),
      recoveryOptions: this.#getRecoveryOptions(error, context),
      timestamp: new Date().toISOString(),
    };

    // Add debug info in development
    if (process.env.NODE_ENV === 'development') {
      response.debug = {
        originalError: error.message,
        stack: error.stack,
        context,
      };
    }

    return response;
  }

  /**
   * Get user-friendly error message
   * @private
   */
  #getUserMessage(error) {
    const messageMap = {
      // Database errors
      DATABASE_ERROR:
        'Unable to access local storage. Please refresh the page and try again.',
      CONCEPT_NOT_FOUND: 'The requested character concept could not be found.',
      STORAGE_QUOTA_EXCEEDED:
        'Storage space is full. Please delete some old data and try again.',

      // Validation errors
      VALIDATION_ERROR: 'Please check your input and try again.',
      CONCEPT_TOO_SHORT:
        'Character concept must be at least 10 characters long.',
      CONCEPT_TOO_LONG: 'Character concept must not exceed 1000 characters.',

      // Network errors
      NETWORK_ERROR: 'Connection error. Please check your internet connection.',
      TIMEOUT_ERROR: 'The operation took too long. Please try again.',

      // Concurrency errors
      CONCURRENT_MODIFICATION:
        'This item was modified elsewhere. Please refresh to see the latest version.',

      // Default
      UNKNOWN_ERROR: 'An unexpected error occurred. Please try again.',
    };

    return (
      messageMap[error.code] || error.message || messageMap['UNKNOWN_ERROR']
    );
  }

  /**
   * Determine if error can be retried
   * @private
   */
  #canRetry(error) {
    const retryableCodes = ['DATABASE_ERROR', 'NETWORK_ERROR', 'TIMEOUT_ERROR'];

    return retryableCodes.includes(error.code);
  }

  /**
   * Get recovery options for the error
   * @private
   */
  #getRecoveryOptions(error, context) {
    const options = [];

    if (this.#canRetry(error)) {
      options.push({
        action: 'retry',
        label: 'Try Again',
        description: 'Attempt the operation again',
      });
    }

    if (error.code === 'STORAGE_QUOTA_EXCEEDED') {
      options.push({
        action: 'manage-storage',
        label: 'Manage Storage',
        description: 'Delete old data to free up space',
      });
    }

    if (error.code === 'CONCURRENT_MODIFICATION') {
      options.push({
        action: 'refresh',
        label: 'Refresh',
        description: 'Reload the latest data',
      });
    }

    // Always offer to go back
    options.push({
      action: 'go-back',
      label: 'Go Back',
      description: 'Return to the previous screen',
    });

    return options;
  }

  /**
   * Check if error is critical
   * @private
   */
  #isCriticalError(error) {
    const criticalCodes = [
      'DATABASE_CORRUPTION',
      'SECURITY_VIOLATION',
      'INVALID_STATE',
    ];

    return criticalCodes.includes(error.code);
  }

  /**
   * Check if error is just a warning
   * @private
   */
  #isWarningError(error) {
    const warningCodes = ['VALIDATION_ERROR', 'CONCEPT_NOT_FOUND'];

    return warningCodes.includes(error.code);
  }

  /**
   * Add error to history
   * @private
   */
  #addToHistory(error, context, metadata) {
    this.#errorHistory.unshift({
      error: {
        name: error.name,
        message: error.message,
        code: error.code,
      },
      context,
      metadata,
      timestamp: new Date().toISOString(),
    });

    // Limit history size
    if (this.#errorHistory.length > this.#maxHistorySize) {
      this.#errorHistory.pop();
    }
  }

  /**
   * Dispatch error event
   * @private
   */
  #dispatchErrorEvent(error, context, metadata) {
    this.#eventBus.dispatch({
      type: 'error:occurred',
      payload: {
        error: {
          name: error.name,
          message: error.message,
          code: error.code,
        },
        context,
        metadata,
        timestamp: new Date().toISOString(),
      },
    });
  }

  /**
   * Get error history
   * @returns {Array}
   */
  getErrorHistory() {
    return [...this.#errorHistory];
  }

  /**
   * Clear error history
   */
  clearErrorHistory() {
    this.#errorHistory = [];
  }
}
```

### 3. Implement Retry Manager

Create `src/utils/retryManager.js`:

```javascript
/**
 * @file Retry manager for handling transient failures
 */

export class RetryManager {
  #defaultOptions = {
    maxAttempts: 3,
    delay: 1000,
    backoffMultiplier: 2,
    maxDelay: 10000,
    retryableErrors: ['NetworkError', 'DatabaseError', 'TimeoutError'],
  };

  /**
   * Execute operation with retry logic
   * @param {Function} operation - The operation to retry
   * @param {Object} options - Retry options
   * @returns {Promise<any>}
   */
  async executeWithRetry(operation, options = {}) {
    const config = { ...this.#defaultOptions, ...options };
    let lastError;
    let delay = config.delay;

    for (let attempt = 1; attempt <= config.maxAttempts; attempt++) {
      try {
        // Execute the operation
        const result = await operation(attempt);
        return result;
      } catch (error) {
        lastError = error;

        // Check if error is retryable
        if (!this.#isRetryable(error, config.retryableErrors)) {
          throw error;
        }

        // Check if we have more attempts
        if (attempt >= config.maxAttempts) {
          throw this.#wrapError(error, attempt);
        }

        // Log retry attempt
        console.warn(
          `Retry attempt ${attempt}/${config.maxAttempts} after error:`,
          error.message
        );

        // Wait before next attempt
        await this.#wait(delay);

        // Calculate next delay with backoff
        delay = Math.min(delay * config.backoffMultiplier, config.maxDelay);
      }
    }

    throw lastError;
  }

  /**
   * Check if error is retryable
   * @private
   */
  #isRetryable(error, retryableErrors) {
    // Check error name
    if (retryableErrors.includes(error.name)) {
      return true;
    }

    // Check error code
    if (
      error.code &&
      ['NETWORK_ERROR', 'DATABASE_ERROR'].includes(error.code)
    ) {
      return true;
    }

    // Check for specific error messages
    const retryableMessages = ['network', 'timeout', 'temporary', 'transient'];

    return retryableMessages.some((msg) =>
      error.message?.toLowerCase().includes(msg)
    );
  }

  /**
   * Wait for specified duration
   * @private
   */
  #wait(ms) {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  /**
   * Wrap error with retry information
   * @private
   */
  #wrapError(originalError, attempts) {
    const error = new Error(
      `Operation failed after ${attempts} attempts: ${originalError.message}`
    );
    error.name = 'RetryExhaustedError';
    error.originalError = originalError;
    error.attempts = attempts;
    return error;
  }
}

// Export singleton instance
export const retryManager = new RetryManager();
```

### 4. Update Controller Error Handling

Update `CharacterConceptsManagerController` to use the error handler:

```javascript
// Add to constructor
constructor({ logger, characterBuilderService, eventBus }) {
    // ... existing code ...

    // Create error handler
    this.#errorHandler = new CharacterBuilderErrorHandler({ logger, eventBus });

    // Create retry manager
    this.#retryManager = new RetryManager();
}

// Update methods to use error handling
async #loadConceptsData() {
    this.#logger.info('Loading character concepts data');

    try {
        // Show loading state
        this.#uiStateManager.setState('loading');

        // Load with retry
        const conceptsWithCounts = await this.#retryManager.executeWithRetry(
            async (attempt) => {
                this.#logger.info(`Loading concepts (attempt ${attempt})`);

                // Use optimized method if available
                if (this.#characterBuilderService.getConceptsWithDirectionCountsOptimized) {
                    return await this.#characterBuilderService.getConceptsWithDirectionCountsOptimized();
                }

                // Fallback to regular method
                return await this.#characterBuilderService.getConceptsWithDirectionCounts();
            },
            {
                maxAttempts: 3,
                delay: 500
            }
        );

        // ... rest of method ...

    } catch (error) {
        const errorResponse = this.#errorHandler.handleError(
            error,
            'loadConceptsData',
            { action: 'loading-concepts' }
        );

        this.#showErrorWithRecovery(errorResponse);
    }
}

// Add error display with recovery options
#showErrorWithRecovery(errorResponse) {
    // Create error display with recovery options
    const errorHtml = `
        <div class="error-container">
            <h3>⚠️ Error</h3>
            <p class="error-message">${errorResponse.userMessage}</p>
            <div class="error-actions">
                ${errorResponse.recoveryOptions.map(option => `
                    <button
                        class="cb-button-secondary"
                        data-action="${option.action}"
                        title="${option.description}">
                        ${option.label}
                    </button>
                `).join('')}
            </div>
        </div>
    `;

    this.#elements.errorMessageText.innerHTML = errorHtml;
    this.#uiStateManager.setState('error');

    // Attach handlers for recovery options
    this.#attachRecoveryHandlers(errorResponse.recoveryOptions);
}

// Handle recovery actions
#attachRecoveryHandlers(recoveryOptions) {
    const buttons = this.#elements.errorState.querySelectorAll('[data-action]');

    buttons.forEach(button => {
        button.addEventListener('click', async (e) => {
            const action = e.target.dataset.action;

            switch (action) {
                case 'retry':
                    await this.#loadConceptsData();
                    break;

                case 'refresh':
                    window.location.reload();
                    break;

                case 'manage-storage':
                    this.#showStorageManager();
                    break;

                case 'go-back':
                    window.history.back();
                    break;
            }
        });
    });
}
```

### 5. Add Storage Quota Handling

Implement storage quota checking and management:

```javascript
/**
 * Check storage quota before operations
 * @private
 */
async #checkStorageQuota() {
    if (!navigator.storage?.estimate) {
        // Storage API not supported
        return true;
    }

    try {
        const { usage, quota } = await navigator.storage.estimate();
        const percentUsed = (usage / quota) * 100;

        if (percentUsed > 90) {
            throw new StorageQuotaError('save', usage);
        }

        if (percentUsed > 80) {
            this.#showStorageWarning(percentUsed);
        }

        return true;

    } catch (error) {
        this.#logger.warn('Failed to check storage quota', error);
        return true; // Allow operation to proceed
    }
}

/**
 * Show storage warning
 * @private
 */
#showStorageWarning(percentUsed) {
    const warning = document.createElement('div');
    warning.className = 'storage-warning';
    warning.innerHTML = `
        <p>⚠️ Storage space is ${Math.round(percentUsed)}% full</p>
        <button class="dismiss-btn" aria-label="Dismiss">×</button>
    `;

    document.body.appendChild(warning);

    // Auto dismiss after 5 seconds
    setTimeout(() => warning.remove(), 5000);

    // Manual dismiss
    warning.querySelector('.dismiss-btn').addEventListener('click', () => {
        warning.remove();
    });
}
```

### 6. Add Global Error Boundary

Implement a global error boundary for unhandled errors:

```javascript
/**
 * Set up global error boundary
 * @private
 */
#setupGlobalErrorBoundary() {
    // Handle unhandled promise rejections
    window.addEventListener('unhandledrejection', (event) => {
        const errorResponse = this.#errorHandler.handleError(
            event.reason,
            'unhandledRejection',
            { promise: event.promise }
        );

        // Show error notification
        this.#showErrorNotification(errorResponse.userMessage);

        // Prevent default browser error handling
        event.preventDefault();
    });

    // Handle global errors
    window.addEventListener('error', (event) => {
        const error = new Error(event.message);
        error.stack = event.error?.stack;

        const errorResponse = this.#errorHandler.handleError(
            error,
            'globalError',
            {
                filename: event.filename,
                lineno: event.lineno,
                colno: event.colno
            }
        );

        // Show error notification for non-script errors
        if (!event.filename?.includes('extension://')) {
            this.#showErrorNotification(errorResponse.userMessage);
        }

        // Prevent default browser error handling in production
        if (process.env.NODE_ENV === 'production') {
            event.preventDefault();
        }
    });
}
```

### 7. Add Offline Handling

Implement offline detection and handling:

```javascript
/**
 * Set up offline/online handling
 * @private
 */
#setupOfflineHandling() {
    // Check initial state
    this.#updateOnlineState(navigator.onLine);

    // Listen for changes
    window.addEventListener('online', () => {
        this.#updateOnlineState(true);
        this.#showNotification('Connection restored', 'success');

        // Refresh data when coming back online
        this.#loadConceptsData();
    });

    window.addEventListener('offline', () => {
        this.#updateOnlineState(false);
        this.#showNotification(
            'You are offline. Some features may not work properly.',
            'warning'
        );
    });
}

/**
 * Update UI based on online state
 * @private
 */
#updateOnlineState(isOnline) {
    this.#isOnline = isOnline;

    // Update UI
    document.body.classList.toggle('offline', !isOnline);

    // Disable certain features when offline
    if (!isOnline) {
        // Disable features that require network
        // For IndexedDB app, most features should still work
    }
}
```

### 8. Add Error Recovery CSS

Add styles for error handling UI:

```css
/* Error recovery styles */
.error-container {
  text-align: center;
  padding: 2rem;
}

.error-container h3 {
  color: #e74c3c;
  margin-bottom: 1rem;
}

.error-message {
  color: var(--text-secondary);
  margin-bottom: 2rem;
  font-size: 1.1rem;
}

.error-actions {
  display: flex;
  gap: 1rem;
  justify-content: center;
  flex-wrap: wrap;
}

.error-actions button {
  min-width: 120px;
}

/* Storage warning */
.storage-warning {
  position: fixed;
  top: 20px;
  left: 50%;
  transform: translateX(-50%);
  background: #f39c12;
  color: white;
  padding: 1rem 2rem;
  border-radius: 8px;
  display: flex;
  align-items: center;
  gap: 1rem;
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.2);
  z-index: 1000;
  animation: slideDown 0.3s ease-out;
}

@keyframes slideDown {
  from {
    transform: translateX(-50%) translateY(-100%);
    opacity: 0;
  }
  to {
    transform: translateX(-50%) translateY(0);
    opacity: 1;
  }
}

.storage-warning .dismiss-btn {
  background: transparent;
  border: none;
  color: white;
  font-size: 1.5rem;
  cursor: pointer;
  padding: 0;
  line-height: 1;
}

/* Offline indicator */
body.offline::before {
  content: 'Offline Mode';
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  background: #95a5a6;
  color: white;
  text-align: center;
  padding: 0.5rem;
  font-size: 0.875rem;
  z-index: 9999;
}

/* Error notification */
.error-notification {
  background: #fee;
  border-left: 4px solid #e74c3c;
  color: #721c24;
}

/* Retry animation */
.retrying {
  position: relative;
}

.retrying::after {
  content: '';
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: rgba(255, 255, 255, 0.8);
  display: flex;
  align-items: center;
  justify-content: center;
}

.retrying::after {
  content: 'Retrying...';
  font-weight: 600;
  color: var(--narrative-purple);
}
```

### 9. Add Error Analytics

Track errors for improvement:

```javascript
/**
 * Track error for analytics
 * @private
 */
#trackError(error, context, metadata) {
    // Send to analytics service if available
    if (window.analytics?.track) {
        window.analytics.track('Error Occurred', {
            errorName: error.name,
            errorCode: error.code,
            errorMessage: error.message,
            context,
            ...metadata
        });
    }

    // Store locally for debugging
    const errorLog = {
        timestamp: new Date().toISOString(),
        error: {
            name: error.name,
            code: error.code,
            message: error.message
        },
        context,
        metadata,
        userAgent: navigator.userAgent,
        url: window.location.href
    };

    // Store in session storage for debugging
    try {
        const errors = JSON.parse(
            sessionStorage.getItem('conceptManagerErrors') || '[]'
        );
        errors.push(errorLog);

        // Keep only last 20 errors
        if (errors.length > 20) {
            errors.shift();
        }

        sessionStorage.setItem('conceptManagerErrors', JSON.stringify(errors));
    } catch (e) {
        // Ignore storage errors
    }
}
```

### 10. Add Debug Error Panel

Add a debug panel for development:

```javascript
/**
 * Show debug error panel in development
 * @private
 */
#showDebugErrorPanel() {
    if (process.env.NODE_ENV !== 'development') return;

    const panel = document.createElement('div');
    panel.id = 'debug-error-panel';
    panel.className = 'debug-error-panel';
    panel.innerHTML = `
        <h3>Error History</h3>
        <div class="error-list">
            ${this.#errorHandler.getErrorHistory().map(entry => `
                <div class="error-entry">
                    <strong>${entry.error.name}</strong>: ${entry.error.message}
                    <br><small>${entry.context} - ${entry.timestamp}</small>
                </div>
            `).join('')}
        </div>
        <button onclick="this.parentElement.remove()">Close</button>
    `;

    document.body.appendChild(panel);
}
```

## Acceptance Criteria

1. ✅ Custom error classes created for different error types
2. ✅ Centralized error handler implemented
3. ✅ Retry logic with exponential backoff
4. ✅ User-friendly error messages displayed
5. ✅ Recovery options provided for errors
6. ✅ Storage quota checking and warnings
7. ✅ Global error boundary catches unhandled errors
8. ✅ Offline handling implemented
9. ✅ Error tracking for analytics
10. ✅ Debug panel available in development

## Testing Requirements

1. Test each error type with appropriate handling
2. Test retry logic with simulated failures
3. Test storage quota warnings and errors
4. Test offline/online transitions
5. Test error recovery options
6. Test global error boundary
7. Test error analytics tracking
8. Verify user-friendly messages

## Notes

- Consider implementing error reporting to a service
- Test error handling with various browser scenarios
- Ensure errors don't cascade or create loops
- Monitor error rates in production
- Consider implementing user feedback for errors
