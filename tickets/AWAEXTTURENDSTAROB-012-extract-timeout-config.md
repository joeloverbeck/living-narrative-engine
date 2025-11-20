# AWAEXTTURENDSTAROB-012: Extract TimeoutConfiguration Class

## Metadata
- **Ticket ID:** AWAEXTTURENDSTAROB-012
- **Phase:** 3 - Robustness (Optional Future Enhancement)
- **Priority:** Low
- **Estimated Effort:** 3-4 hours
- **Dependencies:** Phase 2 complete (AWAEXTTURENDSTAROB-007 through 011)

## Objective

Extract timeout configuration logic into a dedicated `TimeoutConfiguration` class following single responsibility principle. This improves testability, reusability, and separation of concerns, making the configuration logic available for other turn states in the future.

## Files to Create/Modify

### New Files
- `src/turns/config/timeoutConfiguration.js` (NEW)

### Modified Files
- `src/turns/states/awaitingExternalTurnEndState.js`
  - Remove `#resolveDefaultTimeout()` method
  - Remove static constants `DEFAULT_TIMEOUT_PRODUCTION`, `DEFAULT_TIMEOUT_DEVELOPMENT`
  - Delegate to `TimeoutConfiguration` in constructor

## Changes Required

### 1. Create TimeoutConfiguration Class
```javascript
// FILE: src/turns/config/timeoutConfiguration.js
/**
 * @file Timeout configuration for turn states
 * Encapsulates timeout resolution logic with environment detection
 */

import { ProcessEnvironmentProvider } from '../../environment/ProcessEnvironmentProvider.js';
import { InvalidArgumentError } from '../../errors/invalidArgumentError.js';

/**
 * Manages timeout configuration for turn states
 * @class
 */
class TimeoutConfiguration {
  /**
   * Default timeout for production environment (30 seconds)
   * @type {number}
   * @static
   * @readonly
   */
  static DEFAULT_TIMEOUT_PRODUCTION = 30_000;

  /**
   * Default timeout for development environment (3 seconds)
   * @type {number}
   * @static
   * @readonly
   */
  static DEFAULT_TIMEOUT_DEVELOPMENT = 3_000;

  #environmentProvider;
  #explicitTimeoutMs;
  #logger;
  #resolvedTimeout;

  /**
   * Creates a timeout configuration instance
   * @param {Object} options
   * @param {number} [options.timeoutMs] - Explicit timeout in milliseconds
   * @param {IEnvironmentProvider} [options.environmentProvider] - Environment provider
   * @param {ILogger} [options.logger] - Logger for warnings
   */
  constructor({ timeoutMs, environmentProvider, logger } = {}) {
    this.#explicitTimeoutMs = timeoutMs;
    this.#environmentProvider = environmentProvider ?? new ProcessEnvironmentProvider();
    this.#logger = logger;
    this.#resolvedTimeout = null; // Lazy resolution
  }

  /**
   * Gets the configured timeout value
   * Resolves on first call and caches result
   * @returns {number} Timeout in milliseconds
   */
  getTimeoutMs() {
    if (this.#resolvedTimeout === null) {
      this.#resolvedTimeout = this.#resolveTimeout();
      this.#validateTimeout(this.#resolvedTimeout);
    }
    return this.#resolvedTimeout;
  }

  /**
   * Resolves timeout from explicit value or environment
   * @returns {number} Resolved timeout
   * @private
   */
  #resolveTimeout() {
    // Explicit timeout takes precedence
    if (this.#explicitTimeoutMs !== undefined && this.#explicitTimeoutMs !== null) {
      return this.#explicitTimeoutMs;
    }

    // Use environment provider
    try {
      const env = this.#environmentProvider.getEnvironment();
      const isProduction = env?.IS_PRODUCTION ?? true; // Fail-safe to production
      return isProduction
        ? TimeoutConfiguration.DEFAULT_TIMEOUT_PRODUCTION
        : TimeoutConfiguration.DEFAULT_TIMEOUT_DEVELOPMENT;
    } catch (error) {
      // If environment provider fails, use production timeout as safe default
      this.#logger?.warn?.(
        'Environment provider failed, defaulting to production timeout',
        error
      );
      return TimeoutConfiguration.DEFAULT_TIMEOUT_PRODUCTION;
    }
  }

  /**
   * Validates timeout is positive finite number
   * @param {number} timeout - Timeout to validate
   * @throws {InvalidArgumentError} If timeout is invalid
   * @private
   */
  #validateTimeout(timeout) {
    if (!Number.isFinite(timeout) || timeout <= 0) {
      throw new InvalidArgumentError(
        `timeoutMs must be a positive finite number, got: ${timeout} (type: ${typeof timeout})`
      );
    }
  }
}

export default TimeoutConfiguration;
```

### 2. Update AwaitingExternalTurnEndState
```javascript
// FILE: src/turns/states/awaitingExternalTurnEndState.js

// ADD import:
import TimeoutConfiguration from '../../config/timeoutConfiguration.js';

// REMOVE static constants:
// static DEFAULT_TIMEOUT_PRODUCTION = 30_000;
// static DEFAULT_TIMEOUT_DEVELOPMENT = 3_000;

// REMOVE private method #resolveDefaultTimeout()

// UPDATE constructor:
constructor({
  context,
  logger,
  eventBus,
  endTurn,
  timeoutMs,
  environmentProvider,
  setTimeoutFn = setTimeout,
  clearTimeoutFn = clearTimeout,
} = {}) {
  // ... existing validation ...

  // REPLACE timeout resolution:
  // OLD:
  // this.#configuredTimeout = timeoutMs ?? this.#resolveDefaultTimeout();

  // NEW:
  const timeoutConfig = new TimeoutConfiguration({
    timeoutMs,
    environmentProvider,
    logger,
  });
  this.#configuredTimeout = timeoutConfig.getTimeoutMs();

  // Validate timeout (validation now also in TimeoutConfiguration)
  if (!Number.isFinite(this.#configuredTimeout) || this.#configuredTimeout <= 0) {
    throw new InvalidArgumentError(
      `timeoutMs must be a positive finite number, got: ${this.#configuredTimeout} (type: ${typeof this.#configuredTimeout})`
    );
  }

  // ... rest of constructor ...
}
```

## Out of Scope

### Must NOT Change
- TimeoutConfiguration unit tests (Ticket 013)
- Property-based tests (Tickets 014-015)
- Other turn state classes (future enhancement)
- Event handling logic
- Lifecycle methods

### Must NOT Add
- Configuration persistence
- Dynamic timeout updates
- Multiple timeout profiles
- Timeout scaling based on load

## Acceptance Criteria

### AC1: TimeoutConfiguration Class Created
```javascript
// GIVEN: New TimeoutConfiguration class
// WHEN: Class instantiated with options
// THEN:
//   ✓ Class exports correctly
//   ✓ Static constants defined
//   ✓ Constructor accepts timeoutMs, environmentProvider, logger
//   ✓ getTimeoutMs() method exists
```

### AC2: Production Provider Returns 30s
```javascript
// GIVEN: TimeoutConfiguration with production provider
const config = new TimeoutConfiguration({
  environmentProvider: new TestEnvironmentProvider({ IS_PRODUCTION: true })
});

// WHEN: getTimeoutMs() called
const timeout = config.getTimeoutMs();

// THEN:
//   ✓ timeout === 30_000
//   ✓ Result cached (subsequent calls return same value)
```

### AC3: Development Provider Returns 3s
```javascript
// GIVEN: TimeoutConfiguration with development provider
const config = new TimeoutConfiguration({
  environmentProvider: new TestEnvironmentProvider({ IS_PRODUCTION: false })
});

// WHEN: getTimeoutMs() called
// THEN:
//   ✓ Returns 3_000
```

### AC4: Explicit Timeout Overrides Provider
```javascript
// GIVEN: Configuration with explicit timeout + production provider
const config = new TimeoutConfiguration({
  timeoutMs: 5_000,
  environmentProvider: new TestEnvironmentProvider({ IS_PRODUCTION: true })
});

// WHEN: getTimeoutMs() called
// THEN:
//   ✓ Returns 5_000 (not 30_000)
//   ✓ Provider not called (lazy resolution)
```

### AC5: Invalid Timeout Throws
```javascript
// GIVEN: Configuration with invalid timeout
const config = new TimeoutConfiguration({ timeoutMs: NaN });

// WHEN: getTimeoutMs() called
// THEN:
//   ✓ Throws InvalidArgumentError
//   ✓ Error message includes "NaN"
```

### AC6: State Uses TimeoutConfiguration
```javascript
// GIVEN: AwaitingExternalTurnEndState created
const state = new AwaitingExternalTurnEndState({
  context: {...},
  logger: mockLogger,
  eventBus: mockEventBus,
  endTurn: mockEndTurn,
  environmentProvider: productionProvider,
});

// WHEN: State created
// THEN:
//   ✓ TimeoutConfiguration instantiated internally
//   ✓ Configuration used for timeout resolution
//   ✓ Behavior identical to before refactoring
```

### AC7: All Existing Tests Pass
```javascript
// GIVEN: All existing unit, integration, regression tests
// WHEN: npm run test:ci
// THEN:
//   ✓ All tests pass without modification
//   ✓ No regression in behavior
//   ✓ Coverage maintained
```

## Invariants

### Configuration Class Guarantees (Must Provide)
1. **Single Responsibility**: Only handles timeout configuration
2. **Immutable**: Configuration resolved once and cached
3. **Validation**: Throws on invalid timeout values
4. **Safe Defaults**: Provider errors default to production timeout

### Separation of Concerns (Must Achieve)
1. **Encapsulation**: All timeout logic in TimeoutConfiguration
2. **Reusability**: Can be used by other turn states
3. **Testability**: Configuration testable independently
4. **Delegation**: State delegates to configuration class

### Backward Compatibility (Must Maintain)
1. **State Constructor**: Unchanged external interface
2. **Behavior**: Identical timeout resolution
3. **Error Handling**: Same error types and messages
4. **Tests**: All existing tests pass unchanged

## Testing Commands

### After Implementation
```bash
# Lint new and modified files
npx eslint src/turns/config/timeoutConfiguration.js
npx eslint src/turns/states/awaitingExternalTurnEndState.js

# Type check
npm run typecheck

# Run existing tests (should pass without modification)
npm run test:unit -- awaitingExternalTurnEndState
npm run test:integration -- awaitingExternalTurnEndState
npm run test:regression -- awaitingExternalTurnEndState

# Full test suite
npm run test:ci
```

## Implementation Notes

### Lazy Resolution Pattern
```javascript
// Timeout resolved on first getTimeoutMs() call
// Cached for subsequent calls
// Avoids provider call if explicit timeout provided

#resolvedTimeout = null;

getTimeoutMs() {
  if (this.#resolvedTimeout === null) {
    this.#resolvedTimeout = this.#resolveTimeout();
    this.#validateTimeout(this.#resolvedTimeout);
  }
  return this.#resolvedTimeout;
}
```

### Single Responsibility Benefits
- **TimeoutConfiguration**: Resolves and validates timeout
- **AwaitingExternalTurnEndState**: Manages state lifecycle
- Clear separation, easier to test and maintain

### Reusability for Future
```javascript
// Other turn states can now use:
import TimeoutConfiguration from '../config/timeoutConfiguration.js';

const config = new TimeoutConfiguration({ environmentProvider, logger });
const timeout = config.getTimeoutMs();
```

### Migration Path
1. Create TimeoutConfiguration class
2. Update AwaitingExternalTurnEndState to use it
3. Verify all tests pass
4. Future: Migrate other turn states (out of scope)

## Definition of Done

- [ ] TimeoutConfiguration class created
- [ ] Static constants moved to TimeoutConfiguration
- [ ] Constructor accepts timeoutMs, environmentProvider, logger
- [ ] getTimeoutMs() method implemented with lazy resolution
- [ ] #resolveTimeout() private method implemented
- [ ] #validateTimeout() private method implemented
- [ ] AwaitingExternalTurnEndState updated to use TimeoutConfiguration
- [ ] #resolveDefaultTimeout() removed from state
- [ ] Static constants removed from state
- [ ] All 7 acceptance criteria verified
- [ ] All invariants maintained
- [ ] ESLint passes on new and modified files
- [ ] TypeScript passes
- [ ] All existing tests pass without modification
- [ ] Code review completed
- [ ] Diff manually reviewed (~150 lines: +100 new, -50 removed, ~50 modified)
