# AWAEXTTURENDSTAROB-007: Add IEnvironmentProvider Constructor Option

## Metadata
- **Ticket ID:** AWAEXTTURENDSTAROB-007
- **Phase:** 2 - Standard Patterns
- **Priority:** High
- **Estimated Effort:** 2-3 hours
- **Dependencies:** Phase 1 complete (AWAEXTTURENDSTAROB-001 through 006)

## Objective

Add optional `environmentProvider` parameter to constructor following the project's dependency injection pattern. This enables testability through `TestEnvironmentProvider` injection while maintaining backward compatibility with existing code.

## Files to Modify

### Production Code
- `src/turns/states/awaitingExternalTurnEndState.js`
  - Imports (add `ProcessEnvironmentProvider`)
  - Constructor (add `environmentProvider` parameter)
  - Constructor (instantiate default provider)
  - Private fields (add `#environmentProvider`)
  - `#resolveDefaultTimeout()` method (use provider instead of `getEnvironmentMode`)

## Changes Required

### 1. Add Import for ProcessEnvironmentProvider
```javascript
// ADD to imports:
import { ProcessEnvironmentProvider } from '../../environment/ProcessEnvironmentProvider.js';

// KEEP existing import (will be removed in later change):
import { getEnvironmentMode } from '../utils/environmentUtils.js';
```

### 2. Add Constructor Parameter
```javascript
// UPDATE constructor signature (~line 88):
constructor({
  context,
  logger,
  eventBus,
  endTurn,
  timeoutMs,
  environmentProvider, // ADD: Optional provider for DI
  setTimeoutFn = setTimeout,
  clearTimeoutFn = clearTimeout,
} = {}) {
  // ... rest of constructor ...
}
```

### 3. Store Environment Provider
```javascript
// ADD to private fields (~line 60):
/**
 * Environment provider for detecting production/development mode
 * @type {IEnvironmentProvider}
 * @private
 */
#environmentProvider;
```

### 4. Initialize Provider in Constructor
```javascript
// UPDATE constructor initialization (~line 95):
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

  // ADD: Initialize environment provider (default to ProcessEnvironmentProvider)
  this.#environmentProvider = environmentProvider ?? new ProcessEnvironmentProvider();

  // Resolve and store timeout configuration
  this.#configuredTimeout = timeoutMs ?? this.#resolveDefaultTimeout();

  // ... rest of constructor ...
}
```

### 5. Update #resolveDefaultTimeout Method
```javascript
// UPDATE #resolveDefaultTimeout to use provider (~line 75):
/**
 * Resolves the default timeout based on the current environment.
 * Falls back to production timeout if environment detection fails.
 * @returns {number} Timeout duration in milliseconds
 * @private
 */
#resolveDefaultTimeout() {
  try {
    // CHANGE: Use environment provider instead of getEnvironmentMode
    const env = this.#environmentProvider.getEnvironment();
    const isProduction = env?.IS_PRODUCTION ?? true; // Fail-safe to production
    return isProduction
      ? AwaitingExternalTurnEndState.DEFAULT_TIMEOUT_PRODUCTION
      : AwaitingExternalTurnEndState.DEFAULT_TIMEOUT_DEVELOPMENT;
  } catch (error) {
    // If environment provider throws, use production timeout as safe default
    this.#logger?.warn?.(
      'Environment provider failed, defaulting to production timeout',
      error
    );
    return AwaitingExternalTurnEndState.DEFAULT_TIMEOUT_PRODUCTION;
  }
}
```

### 6. (Optional) Remove getEnvironmentMode Import Later
```javascript
// NOTE: Can remove in cleanup:
// import { getEnvironmentMode } from '../utils/environmentUtils.js';
// This import no longer needed after provider change, but can be kept temporarily
```

## Out of Scope

### Must NOT Change
- Test files (updated in Ticket 008)
- `IEnvironmentProvider` interface definition (use existing)
- `ProcessEnvironmentProvider` implementation (use existing)
- `TestEnvironmentProvider` implementation (use existing)
- Configuration class extraction (Phase 3)
- Other constructor parameters
- Event handling logic

### Must NOT Add
- Environment provider validation (beyond null check via `??`)
- Multiple provider types in constructor
- Provider factory pattern
- Provider registration system

## Acceptance Criteria

### AC1: Default Uses ProcessEnvironmentProvider
```javascript
// GIVEN: Constructor called without environmentProvider
// WHEN: State instantiated
// THEN:
//   ✓ ProcessEnvironmentProvider created automatically
//   ✓ Provider.getEnvironment() called for timeout resolution
//   ✓ Existing behavior unchanged (backward compatible)
//   ✓ Production environment → 30s timeout
//   ✓ Development environment → 3s timeout
```

### AC2: Accepts Custom Environment Provider
```javascript
// GIVEN: Constructor called with custom environmentProvider
const mockProvider = {
  getEnvironment: jest.fn(() => ({ IS_PRODUCTION: true }))
};

// WHEN: State instantiated with { environmentProvider: mockProvider }
const state = new AwaitingExternalTurnEndState({
  environmentProvider: mockProvider,
  ...
});

// THEN:
//   ✓ Custom provider used instead of ProcessEnvironmentProvider
//   ✓ mockProvider.getEnvironment() called
//   ✓ Timeout based on provider response (30s for IS_PRODUCTION: true)
```

### AC3: Provider Returns Development Environment
```javascript
// GIVEN: Custom provider returning development environment
const devProvider = {
  getEnvironment: () => ({ IS_PRODUCTION: false })
};

// WHEN: State instantiated with devProvider
// THEN:
//   ✓ this.#configuredTimeout === 3_000
//   ✓ Development timeout used
```

### AC4: Provider Throws Error - Graceful Degradation
```javascript
// GIVEN: Provider that throws error
const errorProvider = {
  getEnvironment: () => { throw new Error('Provider failed'); }
};

// WHEN: State instantiated with errorProvider
// THEN:
//   ✓ Error caught in #resolveDefaultTimeout
//   ✓ Warning logged via this.#logger
//   ✓ Defaults to production timeout (30s)
//   ✓ State remains functional (no throw from constructor)
```

### AC5: Explicit Timeout Still Overrides Provider
```javascript
// GIVEN: Custom provider + explicit timeoutMs
const mockProvider = {
  getEnvironment: () => ({ IS_PRODUCTION: true }) // Would give 30s
};

// WHEN: State instantiated with { environmentProvider: mockProvider, timeoutMs: 5_000 }
// THEN:
//   ✓ this.#configuredTimeout === 5_000
//   ✓ Explicit timeout takes precedence
//   ✓ Provider not called (short-circuit via ?? operator)
```

### AC6: Backward Compatibility - Existing Code Unaffected
```javascript
// GIVEN: Existing code without environmentProvider parameter
const state = new AwaitingExternalTurnEndState({
  context: { ... },
  logger: mockLogger,
  eventBus: mockEventBus,
  endTurn: mockEndTurn,
  // NO environmentProvider
});

// WHEN: State created and used
// THEN:
//   ✓ No errors thrown
//   ✓ Behavior identical to before this change
//   ✓ ProcessEnvironmentProvider used by default
//   ✓ Environment detected correctly
```

### AC7: Existing Tests Still Pass
```javascript
// GIVEN: All existing unit and integration tests
// WHEN: npm run test:unit && npm run test:integration
// THEN:
//   ✓ All tests pass without modification
//   ✓ No regression in existing behavior
//   ✓ Coverage maintained or improved
```

## Invariants

### DI Pattern Compliance (Must Follow)
1. **Optional Parameter**: Provider is optional with sensible default
2. **Interface-Based**: Accepts any `IEnvironmentProvider` implementation
3. **Backward Compatible**: Existing code works without changes
4. **Fail-Safe**: Provider errors don't crash state

### Configuration Guarantees (Must Maintain)
1. **Safe Default**: Missing/failing provider → production timeout
2. **Override Precedence**: Explicit timeoutMs > provider > default
3. **Evaluated at Construction**: Provider called during instantiation

### State Lifecycle Invariants (Must Maintain)
1. **Single Timeout**: At most one timeout scheduled
2. **Resource Cleanup**: All resources cleared on exit/destroy
3. **Context Validity**: All operations verify context exists

### API Contract Preservation (Must Maintain)
1. **Constructor Signature**: Only adds optional parameter
2. **Lifecycle Methods**: Unchanged
3. **Event Handling**: Unchanged
4. **Timeout Behavior**: Fundamental flow unchanged

## Testing Commands

### After Implementation
```bash
# Lint modified file
npx eslint src/turns/states/awaitingExternalTurnEndState.js

# Type check
npm run typecheck

# Run unit tests
npm run test:unit -- awaitingExternalTurnEndState

# Run integration tests
npm run test:integration -- awaitingExternalTurnEndState

# Run Phase 1 regression tests
npm run test:regression -- environmentDetection.regression.test.js

# Full test suite
npm run test:ci
```

### Manual Verification
```bash
# In Node.js REPL:
# const { ProcessEnvironmentProvider } = require('./src/environment/ProcessEnvironmentProvider.js');
# const provider = new ProcessEnvironmentProvider();
# provider.getEnvironment();
# Should return: { IS_PRODUCTION: true/false }
```

## Implementation Notes

### IEnvironmentProvider Interface (Reference)
```javascript
// From src/interfaces/IEnvironmentProvider.js
// (Do NOT modify, just reference)
interface IEnvironmentProvider {
  /**
   * Returns environment information
   * @returns {{ IS_PRODUCTION: boolean }}
   */
  getEnvironment(): { IS_PRODUCTION: boolean };
}
```

### ProcessEnvironmentProvider Usage
```javascript
// From src/environment/ProcessEnvironmentProvider.js
// (Do NOT modify, just use)
class ProcessEnvironmentProvider {
  getEnvironment() {
    return {
      IS_PRODUCTION: process.env.NODE_ENV === 'production'
    };
  }
}
```

### Error Handling Pattern
```javascript
try {
  const env = this.#environmentProvider.getEnvironment();
  // Use env.IS_PRODUCTION
} catch (error) {
  this.#logger?.warn?.('Provider failed', error);
  // Return production timeout as fail-safe
}
```

### Default Parameter Pattern
```javascript
// Use nullish coalescing for default
this.#environmentProvider = environmentProvider ?? new ProcessEnvironmentProvider();

// NOT:
this.#environmentProvider = environmentProvider || new ProcessEnvironmentProvider();
// (nullish coalescing allows explicit null/undefined but not other falsy values)
```

## Definition of Done

- [ ] Import `ProcessEnvironmentProvider` added
- [ ] `environmentProvider` parameter added to constructor
- [ ] Private field `#environmentProvider` added
- [ ] Provider initialized with default in constructor
- [ ] `#resolveDefaultTimeout()` updated to use provider
- [ ] Error handling added for provider.getEnvironment()
- [ ] Warning logged if provider fails
- [ ] All 7 acceptance criteria verified
- [ ] All invariants maintained
- [ ] ESLint passes
- [ ] TypeScript passes
- [ ] All existing tests pass (no modifications)
- [ ] Code review completed
- [ ] Diff manually reviewed (~30 lines changed)
