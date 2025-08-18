# CORMOTGEN-013: Implement Retry Logic and Error Handling

## Ticket ID

CORMOTGEN-013

## Title

Add comprehensive retry logic and error handling for Core Motivations generation

## Status

TODO

## Priority

HIGH

## Estimated Effort

3-4 hours

## Dependencies

- CORMOTGEN-011 (CoreMotivationsGenerator service)
- CORMOTGEN-012 (LLM integration)

## Related Specs

- specs/core-motivations-generator.spec.md (Section 3.3)
- Error handling pattern: src/utils/httpRetryManager.js

## Description

Implement robust retry logic with exponential backoff and comprehensive error handling for all failure scenarios in Core Motivations generation.

## Technical Requirements

### 1. Retry Manager

```javascript
class MotivationRetryManager {
  constructor(config = {}) {
    this.maxRetries = config.maxRetries || 3;
    this.baseDelay = config.baseDelay || 1000;
    this.maxDelay = config.maxDelay || 10000;
    this.backoffFactor = config.backoffFactor || 2;
  }

  async executeWithRetry(fn, context) {
    let lastError;

    for (let attempt = 0; attempt <= this.maxRetries; attempt++) {
      try {
        return await fn.call(context);
      } catch (error) {
        lastError = error;

        if (!this.#shouldRetry(error, attempt)) {
          throw error;
        }

        const delay = this.#calculateDelay(attempt);
        await this.#wait(delay);

        this.#logRetry(attempt, error, delay);
      }
    }

    throw new MaxRetriesError(lastError, this.maxRetries);
  }

  #shouldRetry(error, attempt) {
    // Don't retry on validation errors
    if (error.code === 'VALIDATION_ERROR') return false;

    // Don't retry on auth errors
    if (error.code === 'UNAUTHORIZED') return false;

    // Retry on network and timeout errors
    if (
      error.code === 'NETWORK_ERROR' ||
      error.code === 'TIMEOUT' ||
      error.code === 'SERVICE_UNAVAILABLE'
    ) {
      return attempt < this.maxRetries;
    }

    // Retry on rate limits with longer delay
    if (error.code === 'RATE_LIMITED') {
      this.baseDelay = 5000;
      return attempt < this.maxRetries;
    }

    return false;
  }
}
```

### 2. Error Classification

```javascript
class MotivationErrorHandler {
  classifyError(error) {
    // Network errors
    if (error.message.includes('fetch') || error.message.includes('network')) {
      return {
        code: 'NETWORK_ERROR',
        retryable: true,
        userMessage: 'Network error. Please check your connection.',
      };
    }

    // LLM errors
    if (error.message.includes('token limit')) {
      return {
        code: 'TOKEN_LIMIT',
        retryable: true,
        userMessage: 'Content too long. Reducing size and retrying...',
      };
    }

    // Validation errors
    if (error.name === 'ValidationError') {
      return {
        code: 'VALIDATION_ERROR',
        retryable: false,
        userMessage: 'Invalid data format. Please try again.',
      };
    }

    // Default
    return {
      code: 'UNKNOWN_ERROR',
      retryable: true,
      userMessage: 'An error occurred. Retrying...',
    };
  }
}
```

### 3. Error Recovery Strategies

```javascript
async #handleGenerationError(error, context) {
  const classification = this.#errorHandler.classifyError(error);

  switch (classification.code) {
    case 'TOKEN_LIMIT':
      // Reduce prompt size
      context.cliches = context.cliches.slice(0, 10);
      return await this.#retryWithReducedContext(context);

    case 'NETWORK_ERROR':
      // Wait and retry
      await this.#waitForNetwork();
      return await this.generate(context);

    case 'RATE_LIMITED':
      // Use exponential backoff
      await this.#handleRateLimit(error);
      return await this.generate(context);

    case 'VALIDATION_ERROR':
      // Log and throw - can't recover
      this.#logger.error('Validation error:', error);
      throw error;

    default:
      // Generic retry
      return await this.#retryManager.executeWithRetry(
        () => this.generate(context),
        this
      );
  }
}
```

### 4. User-Friendly Error Messages

```javascript
const ERROR_MESSAGES = {
  NETWORK_ERROR: 'Connection issue. Please check your internet and try again.',
  TOKEN_LIMIT: 'The content is too long. Try with fewer clichés.',
  RATE_LIMITED: 'Too many requests. Please wait a moment.',
  VALIDATION_ERROR: 'Invalid response from AI. Please try again.',
  TIMEOUT: 'Request timed out. Please try again.',
  SERVICE_UNAVAILABLE: 'Service temporarily unavailable. Please try later.',
  UNKNOWN_ERROR: 'An unexpected error occurred. Please try again.',
};
```

## Implementation Steps

1. Create retry manager class
2. Implement exponential backoff
3. Add error classification
4. Create recovery strategies
5. Implement specific handlers
6. Add user-friendly messages
7. Integrate with service
8. Add comprehensive logging

## Validation Criteria

- [ ] Retries work with exponential backoff
- [ ] Non-retryable errors fail immediately
- [ ] Rate limiting is handled properly
- [ ] Token limit errors reduce prompt
- [ ] User messages are helpful
- [ ] All errors are logged
- [ ] Recovery strategies work

## Testing Requirements

- Test each error type
- Test retry limits
- Test backoff calculations
- Mock various failure scenarios
- Verify error messages

## Checklist

- [ ] Create retry manager
- [ ] Implement backoff logic
- [ ] Add error classification
- [ ] Create recovery strategies
- [ ] Add user messages
- [ ] Integrate with service
- [ ] Add logging
- [ ] Write tests
