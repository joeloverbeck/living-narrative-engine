# Specification: Backoff Strategy Injection for TraitsGenerator

**Version**: 1.0
**Date**: 2025-01-24
**Status**: Approved
**Author**: System Architecture

## Executive Summary

Expose the exponential backoff retry strategy in `TraitsGenerator` as an injectable dependency to enable fast, synchronous testing while maintaining production-grade retry behavior. This enhancement eliminates 6+ seconds of test execution time and aligns with the project's existing retry infrastructure and dependency injection patterns.

## Problem Statement

### Current State

`TraitsGenerator.generateTraits()` implements retry logic with hardcoded exponential backoff:

```javascript
// Line 450-466 in TraitsGenerator.js
if (attempt <= maxRetries) {
  // Calculate exponential backoff delay (1s, 2s, 4s, ...)
  const delayMs = Math.pow(2, attempt) * 1000;

  await new Promise((resolve) => setTimeout(resolve, delayMs));
}
```

### Pain Points

1. **Test Performance**: The slow test in `TraitsGenerator.nullCliches.test.js` adds ~6 seconds due to retry delays (2s + 4s)
2. **Code Duplication**: Retry logic duplicates existing `RetryManager` functionality
3. **Test Complexity**: Tests require mocking `setTimeout` or accepting long delays
4. **Inflexibility**: Cannot configure backoff strategy per environment

### Why This Enhancement Is Desirable

#### ✅ Alignment with Architecture
- Codebase already has `RetryManager` class (`src/actions/tracing/resilience/retryManager.js`)
- `IRetryManager` interface exists in DI token system
- Dependency injection pattern used consistently

#### ✅ Performance Impact
- Eliminates 6-second delay from failing test scenarios
- Improves developer feedback loop
- Enables faster CI/CD pipelines

#### ✅ Maintainability Benefits
- **DRY Principle**: Centralizes retry logic
- **Separation of Concerns**: Business logic separate from retry mechanics
- **Testability**: Easy to inject zero-delay strategy for tests

#### ✅ Future-Proof
- Easy to modify backoff strategy (e.g., add jitter, circuit breaker)
- Configurable per environment (dev vs. production)
- Follows established patterns in codebase

## Goals & Non-Goals

### Goals
- ✅ Inject `IRetryManager` dependency into `TraitsGenerator`
- ✅ Replace hardcoded backoff with `retryManager.retry()`
- ✅ Enable zero-delay testing while preserving production behavior
- ✅ Maintain backward compatibility with existing API
- ✅ Improve test execution speed by 6+ seconds

### Non-Goals
- ❌ Change external API of `TraitsGenerator.generateTraits()`
- ❌ Modify retry configuration for other services
- ❌ Add circuit breaker functionality (future enhancement)
- ❌ Change the default retry behavior for production

## Architecture & Design

### Dependency Injection Pattern

```javascript
// Current Constructor (TraitsGenerator.js)
constructor({
  logger,
  llmJsonService,
  llmStrategyFactory,
  llmConfigManager,
  eventBus,
  tokenEstimator,
}) { ... }

// Enhanced Constructor
constructor({
  logger,
  llmJsonService,
  llmStrategyFactory,
  llmConfigManager,
  eventBus,
  tokenEstimator,
  retryManager,  // NEW: Injected retry strategy
}) { ... }
```

### Retry Manager Integration

#### Interface: `IRetryManager`

```javascript
/**
 * @interface IRetryManager
 * @see src/interfaces/IRetryManager.js
 */
export class IRetryManager {
  /**
   * Executes an operation with retry logic.
   *
   * @param {function(number): Promise<any>} attemptFn - Function performing a single attempt
   * @param {function(any, number): Promise<{retry: boolean, data?: any}>} responseHandler - Handler to process results
   * @returns {Promise<any>} Result of the successful attempt
   */
  async perform(attemptFn, responseHandler) { ... }
}
```

#### Production Implementation: `RetryManager`

Existing implementation at `src/actions/tracing/resilience/retryManager.js`:

```javascript
export class RetryManager {
  async retry(operation, options = {}) {
    const {
      maxAttempts = 3,
      delay = 1000,
      exponentialBackoff = true,
      maxDelay = 30000,
      jitter = true,
    } = options;
    // ... exponential backoff implementation
  }
}
```

#### Test Implementation: `NoDelayRetryManager`

```javascript
/**
 * Zero-delay retry manager for fast testing
 */
export class NoDelayRetryManager {
  async retry(operation, options = {}) {
    const { maxAttempts = 3 } = options;

    for (let attempt = 1; attempt <= maxAttempts; attempt++) {
      try {
        return await operation();
      } catch (error) {
        if (attempt === maxAttempts) throw error;
        // No delay - immediate retry
      }
    }
  }
}
```

### Refactored #generateWithRetry Method

**Before:**

```javascript
async #generateWithRetry(params, maxRetries = 2) {
  for (let attempt = 1; attempt <= maxRetries + 1; attempt++) {
    try {
      // ... generation logic
      return parsedResponse;
    } catch (error) {
      if (attempt <= maxRetries) {
        const delayMs = Math.pow(2, attempt) * 1000;
        await new Promise((resolve) => setTimeout(resolve, delayMs));
      }
    }
  }
}
```

**After:**

```javascript
async #generateWithRetry(params, maxRetries = 2) {
  const operation = async () => {
    const prompt = buildTraitsGenerationPrompt(
      params.concept.concept,
      params.direction,
      params.userInputs,
      params.cliches
    );

    const llmResponse = await this.#callLLM(prompt, params.llmConfigId);
    const parsedResponse = await this.#parseResponse(llmResponse);
    this.#validateResponseStructure(parsedResponse);
    this.#validateResponseQuality(parsedResponse);

    return parsedResponse;
  };

  try {
    return await this.#retryManager.retry(operation, {
      maxAttempts: maxRetries + 1,
      delay: 1000,
      exponentialBackoff: true,
    });
  } catch (error) {
    // Error handling remains the same
    throw new TraitsGenerationError(
      `Generation failed after ${maxRetries + 1} attempts`,
      { /* ... */ },
      error
    );
  }
}
```

## Implementation Plan

### Phase 1: Dependency Injection Setup

#### 1.1 Update DI Tokens

**File**: `src/dependencyInjection/tokens/characterBuilderTokens.js`

```javascript
export const characterBuilderTokens = freeze({
  // ... existing tokens
  IRetryManager: 'IRetryManager',  // ADD THIS
});
```

**Validation**: Check if token already exists; if so, skip this step.

#### 1.2 Register RetryManager

**File**: `src/dependencyInjection/registrations/characterBuilderRegistrations.js`

```javascript
import { RetryManager } from '../../actions/tracing/resilience/retryManager.js';
import { characterBuilderTokens } from '../tokens/characterBuilderTokens.js';

// In registration function:
container.register(
  characterBuilderTokens.IRetryManager,
  RetryManager,
  { lifecycle: 'singleton' }
);

// Update TraitsGenerator registration
container.register(
  characterBuilderTokens.ITraitsGenerator,
  TraitsGenerator,
  {
    lifecycle: 'transient',
    dependencies: [
      coreTokens.ILogger,
      llmTokens.ILlmJsonService,
      llmTokens.IConfigurableLLMAdapter,
      llmTokens.ILLMConfigurationManager,
      coreTokens.ISafeEventDispatcher,
      llmTokens.ITokenEstimator,
      characterBuilderTokens.IRetryManager,  // ADD THIS
    ],
  }
);
```

### Phase 2: Refactor TraitsGenerator

#### 2.1 Update Constructor

**File**: `src/characterBuilder/services/TraitsGenerator.js`

**Location**: Lines 45-97

**Changes**:

```javascript
/**
 * @typedef {import('../../interfaces/IRetryManager.js').IRetryManager} IRetryManager
 */

constructor({
  logger,
  llmJsonService,
  llmStrategyFactory,
  llmConfigManager,
  eventBus,
  tokenEstimator,
  retryManager,  // NEW PARAMETER
}) {
  // ... existing validations

  validateDependency(retryManager, 'IRetryManager', logger, {
    requiredMethods: ['retry'],
  });

  this.#logger = logger;
  this.#llmJsonService = llmJsonService;
  this.#llmStrategyFactory = llmStrategyFactory;
  this.#llmConfigManager = llmConfigManager;
  this.#eventBus = eventBus;
  this.#tokenEstimator = tokenEstimator;
  this.#retryManager = retryManager;  // NEW FIELD
}
```

#### 2.2 Refactor #generateWithRetry Method

**File**: `src/characterBuilder/services/TraitsGenerator.js`

**Location**: Lines 407-504

**Changes**:

```javascript
/**
 * Generate traits with retry logic for transient failures
 *
 * @param {object} params - Generation parameters
 * @param {number} [maxRetries] - Maximum number of retry attempts
 * @returns {Promise<object>} Parsed and validated response
 * @throws {TraitsGenerationError} If all attempts fail
 * @private
 */
async #generateWithRetry(params, maxRetries = 2) {
  let attemptCount = 0;

  const operation = async () => {
    attemptCount++;

    try {
      // Build the prompt
      const prompt = buildTraitsGenerationPrompt(
        params.concept.concept,
        params.direction,
        params.userInputs,
        params.cliches
      );

      this.#logger.debug('TraitsGenerator: Built prompt', {
        promptLength: prompt.length,
        conceptId: params.concept.id,
        directionId: params.direction.id,
        attempt: attemptCount,
        maxRetries,
      });

      // Get LLM response
      const llmResponse = await this.#callLLM(prompt, params.llmConfigId);

      // Parse and validate response
      const parsedResponse = await this.#parseResponse(llmResponse);
      this.#validateResponseStructure(parsedResponse);
      this.#validateResponseQuality(parsedResponse);

      this.#logger.debug('TraitsGenerator: Generation succeeded', {
        conceptId: params.concept.id,
        directionId: params.direction.id,
        attempt: attemptCount,
      });

      return parsedResponse;
    } catch (error) {
      this.#logger.warn(
        `TraitsGenerator: Attempt ${attemptCount} failed`,
        {
          error: error.message,
          attempt: attemptCount,
          maxRetries,
          conceptId: params.concept.id,
          directionId: params.direction.id,
        }
      );
      throw error;  // Let RetryManager handle retry logic
    }
  };

  try {
    // Delegate retry logic to injected RetryManager
    return await this.#retryManager.retry(operation, {
      maxAttempts: maxRetries + 1,
      delay: 1000,
      exponentialBackoff: true,
      maxDelay: 30000,
    });
  } catch (error) {
    this.#logger.error('TraitsGenerator: All retry attempts exhausted', {
      totalAttempts: attemptCount,
      maxRetries,
      conceptId: params.concept.id,
      directionId: params.direction.id,
      finalError: error.message,
    });

    // All attempts failed, throw the last error
    if (error instanceof TraitsGenerationError) {
      // Add retry context to existing error
      throw new TraitsGenerationError(
        `${error.message} (after ${attemptCount} attempts)`,
        {
          ...error.context,
          totalAttempts: attemptCount,
          maxRetries,
        },
        error.cause
      );
    }

    throw new TraitsGenerationError(
      `Generation failed after ${attemptCount} attempts: ${error.message}`,
      {
        conceptId: params.concept.id,
        directionId: params.direction.id,
        totalAttempts: attemptCount,
        maxRetries,
        stage: 'retry_exhausted',
      },
      error
    );
  }
}
```

### Phase 3: Update Tests

#### 3.1 Create Test Helper

**File**: `tests/common/mocks/noDelayRetryManager.js` (NEW FILE)

```javascript
/**
 * @file Zero-delay retry manager for fast testing
 * Implements IRetryManager interface with synchronous retries
 */

/**
 * Retry manager that performs retries without delays
 * Used in unit tests to avoid setTimeout waits
 */
export class NoDelayRetryManager {
  /**
   * Retry an operation without delays
   *
   * @param {Function} operation - The operation to retry
   * @param {object} options - Retry options
   * @returns {Promise} Result of the operation
   */
  async retry(operation, options = {}) {
    const { maxAttempts = 3 } = options;

    let lastError;

    for (let attempt = 1; attempt <= maxAttempts; attempt++) {
      try {
        return await operation();
      } catch (error) {
        lastError = error;

        if (attempt === maxAttempts) {
          throw error;
        }
        // No delay - immediate retry for fast testing
      }
    }

    throw lastError;
  }
}
```

#### 3.2 Update TraitsGenerator.nullCliches.test.js

**File**: `tests/unit/characterBuilder/services/TraitsGenerator.nullCliches.test.js`

**Changes**:

```javascript
import { NoDelayRetryManager } from '../../../common/mocks/noDelayRetryManager.js';

// In createMockDependencies or beforeEach:
const createMockDependencies = () => ({
  logger: createMockLogger(),
  llmJsonService: createMockLlmJsonService(),
  llmStrategyFactory: createMockLlmStrategyFactory(),
  llmConfigManager: createMockLlmConfigManager(),
  eventBus: createMockEventBus(),
  tokenEstimator: createMockTokenEstimator(),
  retryManager: new NoDelayRetryManager(),  // ADD THIS
});

// Update the slow test to use maxRetries: 0 for immediate failure
it('should throw TraitsGenerationError when cliches is an array (invalid type)', async () => {
  const params = {
    concept: TEST_CONCEPT,
    direction: TEST_DIRECTION,
    userInputs: TEST_USER_INPUTS,
    cliches: [], // Array is invalid
  };

  // Use maxRetries: 0 to fail immediately
  await expect(
    traitsGenerator.generateTraits(params, { maxRetries: 0 })
  ).rejects.toThrow("Cannot read properties of undefined");
});
```

**Expected Impact**: Test execution time reduced from ~6 seconds to <100ms.

#### 3.3 Update Other TraitsGenerator Tests

**Files to Update**:
- `tests/unit/characterBuilder/services/TraitsGenerator.test.js` (if exists)
- `tests/integration/characterBuilder/traitsGeneratorIntegration.test.js` (if exists)

**Pattern**:

```javascript
// Unit tests: Use NoDelayRetryManager
beforeEach(() => {
  traitsGenerator = new TraitsGenerator({
    // ... other deps
    retryManager: new NoDelayRetryManager(),
  });
});

// Integration tests: Use real RetryManager
beforeEach(() => {
  traitsGenerator = new TraitsGenerator({
    // ... other deps
    retryManager: new RetryManager(),
  });
});
```

#### 3.4 Add Retry Behavior Tests

**File**: `tests/unit/characterBuilder/services/TraitsGenerator.retry.test.js` (NEW FILE)

```javascript
/**
 * @file Tests for retry behavior in TraitsGenerator
 * Verifies retry logic with mock RetryManager
 */

import { describe, it, expect, beforeEach, jest } from '@jest/globals';
import { TraitsGenerator } from '../../../../src/characterBuilder/services/TraitsGenerator.js';
import { NoDelayRetryManager } from '../../../common/mocks/noDelayRetryManager.js';

describe('TraitsGenerator - Retry Behavior', () => {
  let traitsGenerator;
  let mocks;
  let mockRetryManager;

  beforeEach(() => {
    mockRetryManager = new NoDelayRetryManager();
    jest.spyOn(mockRetryManager, 'retry');

    mocks = {
      logger: createMockLogger(),
      // ... other mocks
      retryManager: mockRetryManager,
    };

    traitsGenerator = new TraitsGenerator(mocks);
  });

  it('should delegate retry logic to RetryManager', async () => {
    // Arrange
    setupSuccessfulMockResponse(mocks);
    const params = createValidParams();

    // Act
    await traitsGenerator.generateTraits(params, { maxRetries: 2 });

    // Assert
    expect(mockRetryManager.retry).toHaveBeenCalledWith(
      expect.any(Function),
      expect.objectContaining({
        maxAttempts: 3,  // maxRetries + 1
        delay: 1000,
        exponentialBackoff: true,
      })
    );
  });

  it('should respect maxRetries option', async () => {
    // Test with different maxRetries values
    // ...
  });

  it('should throw TraitsGenerationError after exhausting retries', async () => {
    // Simulate all retries failing
    // ...
  });
});
```

## Affected Files Summary

### Files to Modify

| File | Changes | Lines Affected | Risk |
|------|---------|----------------|------|
| `src/characterBuilder/services/TraitsGenerator.js` | Add `retryManager` DI, refactor `#generateWithRetry` | ~38, ~407-504 | Medium |
| `src/dependencyInjection/tokens/characterBuilderTokens.js` | Add `IRetryManager` token | +1 line | Low |
| `src/dependencyInjection/registrations/characterBuilderRegistrations.js` | Register `RetryManager`, wire to `TraitsGenerator` | +10 lines | Low |
| `tests/unit/characterBuilder/services/TraitsGenerator.nullCliches.test.js` | Add `NoDelayRetryManager`, update slow test | ~165-175, ~222-237 | Low |

### Files to Create

| File | Purpose | Risk |
|------|---------|------|
| `tests/common/mocks/noDelayRetryManager.js` | Zero-delay retry manager for tests | Low |
| `tests/unit/characterBuilder/services/TraitsGenerator.retry.test.js` | Test retry behavior | Low |
| `specs/backoff-strategy-injection-traitsgen.spec.md` | This specification | None |

## Testing Strategy

### Unit Tests

1. **Retry Delegation**
   - Verify `RetryManager.retry()` is called with correct options
   - Validate retry attempt counts
   - Confirm error propagation

2. **Fast Test Execution**
   - Measure test execution time before/after
   - Ensure <100ms for failing scenarios (was 6+ seconds)

3. **Edge Cases**
   - `maxRetries: 0` (no retries)
   - `maxRetries: 5` (many retries)
   - First attempt succeeds (no retries needed)

### Integration Tests

1. **Production Behavior**
   - Verify actual exponential backoff in integration tests
   - Confirm retry delays occur in production configuration
   - Test with real `RetryManager` instance

2. **Error Scenarios**
   - All retries fail → correct error thrown
   - Transient failure → eventual success
   - Permanent failure → immediate failure

### Performance Validation

**Before Enhancement:**
- Slow test: ~6 seconds (2s + 4s backoff delays)

**After Enhancement:**
- Slow test: <100ms (zero-delay retries)
- Performance improvement: **~60x faster**

## Migration Path

### Backward Compatibility

✅ **No Breaking Changes**:
- External API remains identical
- Default retry behavior unchanged
- All existing tests continue to pass

### Rollout Strategy

1. **Phase 1**: Infrastructure setup (DI tokens, registrations)
2. **Phase 2**: Refactor `TraitsGenerator` with optional `retryManager`
3. **Phase 3**: Update tests to use `NoDelayRetryManager`
4. **Phase 4**: Validate performance improvements
5. **Phase 5**: Make `retryManager` required (remove fallback)

### Rollback Plan

If issues arise:
1. Revert to hardcoded `setTimeout` in `#generateWithRetry`
2. Remove `retryManager` from constructor
3. Keep infrastructure for future use

## Success Metrics

| Metric | Before | After | Target |
|--------|--------|-------|--------|
| Test execution time (slow test) | ~6s | <100ms | <200ms |
| Code duplication (retry logic) | Yes | No | Eliminated |
| Test complexity | High (mock setTimeout) | Low (inject manager) | Simple |
| Production retry behavior | Hardcoded | Configurable | ✅ |

## Future Enhancements

This enhancement enables future improvements:

1. **Jitter Support**: Add randomized jitter to avoid thundering herd
2. **Circuit Breaker**: Integrate circuit breaker pattern for cascading failures
3. **Adaptive Backoff**: Adjust backoff based on error type
4. **Retry Metrics**: Track retry statistics for monitoring
5. **Configuration**: Externalize retry config to environment variables

## References

- **Existing Implementation**: `src/actions/tracing/resilience/retryManager.js`
- **DI Pattern**: `src/dependencyInjection/registrations/actionTracingRegistrations.js`
- **Interface**: `src/interfaces/IRetryManager.js`
- **Similar Service**: `src/actions/tracing/resilience/resilientServiceWrapper.js`

## Approval & Sign-Off

**Specification Approved By**: System Architecture
**Implementation Approved By**: _Pending_
**Testing Approved By**: _Pending_

---

**Next Steps**: Proceed with implementation following Phase 1-3 plan.
