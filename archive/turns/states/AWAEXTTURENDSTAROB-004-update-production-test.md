# AWAEXTTURENDSTAROB-004: Update Production Integration Test

## Metadata

- **Ticket ID:** AWAEXTTURENDSTAROB-004
- **Phase:** 1 - Minimal Change
- **Priority:** Critical
- **Estimated Effort:** 1 hour
- **Status:** ✅ COMPLETED
- **Dependencies:** ~~AWAEXTTURENDSTAROB-001~~ (ticket not found - constants already at module level)

## Objective

Remove `jest.isolateModulesAsync` and URL cache busting from the production integration test, proving that the module-level timeout constants work correctly without module isolation. This demonstrates that environment changes are now respected at construction time (not module load time).

## Assumptions Reassessed

### ✅ VALIDATED ASSUMPTIONS

1. Production integration test exists at correct path
2. Test currently uses `jest.isolateModulesAsync` (lines 61-69)
3. Test uses URL cache busting with `Date.now()`
4. Timeout constants are at module level (`DEFAULT_TIMEOUT_PRODUCTION` = 30,000ms)
5. Environment management already exists in test (lines 36-46)

### ⚠️ CORRECTED ASSUMPTIONS

1. **Constructor signature**: Uses `(handler, options)` pattern, not `{context, logger, eventBus, ...}`
2. **Cache busting method**: Uses `new URL()` with `import.meta.url`, not `path.join()` + `pathToFileURL()`
3. **Environment management**: Already implemented, no need to add
4. **Line numbers**: Isolation is lines 61-69, state construction is line 106
5. **AWAEXTTURENDSTAROB-001**: Ticket doesn't exist, but constants are already at module level

## Files to Modify

### Test Code

- `tests/integration/turns/states/awaitingExternalTurnEndState.production.integration.test.js`
  - Lines 61-69: Remove isolation wrapper and cache busting
  - Line 1: Add direct import
  - Line 106: Use imported class directly (already correct)
  - Lines 36-46: Keep existing environment management (no changes needed)

## Changes Required

### 1. Add Direct Import at Top of File

```javascript
// ADD at top of file (after other imports):
import AwaitingExternalTurnEndState from '../../../../src/turns/states/awaitingExternalTurnEndState.js';
```

### 2. Remove jest.isolateModulesAsync Wrapper

```javascript
// BEFORE (lines 61-69):
await jest.isolateModulesAsync(async () => {
  const { pathToFileURL } = await import('node:url');
  const moduleUrl = new URL(
    `../../../../src/turns/states/awaitingExternalTurnEndState.js?prod=${Date.now()}`,
    import.meta.url
  );
  const fileUrl = pathToFileURL(moduleUrl.pathname).href;
  ({ AwaitingExternalTurnEndState } = await import(
    `${fileUrl}${moduleUrl.search}`
  ));
});

// AFTER:
// (Remove entire block - use direct import from top of file)
```

### 3. Update Variable Declaration

```javascript
// BEFORE (line 60):
let AwaitingExternalTurnEndState;

// AFTER:
// (Remove - no longer needed with direct import)
```

### 4. Keep Existing Environment Management

```javascript
// ALREADY EXISTS (lines 36-46) - NO CHANGES NEEDED:
let originalEnv;

beforeEach(() => {
  originalEnv = process.env.NODE_ENV;
  // Test will set NODE_ENV = 'production' in specific test
});

afterEach(() => {
  process.env.NODE_ENV = originalEnv;
  jest.useRealTimers();
  jest.restoreAllMocks();
  jest.resetModules();
});
```

### 5. Actual Constructor Pattern (Reference)

```javascript
// ACTUAL CONSTRUCTOR SIGNATURE (for reference):
constructor(
  handler, // First positional parameter
  ({
    timeoutMs,
    setTimeoutFn = (...args) => setTimeout(...args),
    clearTimeoutFn = (...args) => clearTimeout(...args),
  } = {})
);

// ACTUAL TEST USAGE (line 106):
const state = new AwaitingExternalTurnEndState(handler);
// Note: Test relies on default timer functions, which is fine
```

## Out of Scope

### Must NOT Change

- Environment management (already correct)
- Test helper classes (`TestTurnHandler`, etc.)
- Mock implementations (already appropriate)
- Constructor parameters (already correct)
- Test assertions (already comprehensive)
- Cleanup verification logic (already thorough)

### Must NOT Add

- New test cases (separate tickets)
- Environment provider tests (Phase 2)
- Additional assertions
- New test utilities

## Acceptance Criteria

### AC1: Test Runs Without Module Isolation ✅

```javascript
// GIVEN: Test file with direct import (no jest.isolateModulesAsync)
// WHEN: Test executed with npm run test:integration
// THEN:
//   ✓ Test passes successfully
//   ✓ No module isolation wrapper used
//   ✓ No cache busting required
//   ✓ Test completes in < 100ms
```

### AC2: Production Timeout Verified ✅

```javascript
// GIVEN: process.env.NODE_ENV = 'production'
// WHEN: State created and enterState() called
// THEN:
//   ✓ mockSetTimeout called with 30_000ms
//   ✓ Timeout value matches production default exactly
//   ✓ Only one setTimeout call made
```

### AC3: Environment Variable Management Works ✅

```javascript
// GIVEN: beforeEach/afterEach manage NODE_ENV (already exists)
// WHEN: Multiple tests run in sequence
// THEN:
//   ✓ Each test gets clean production environment
//   ✓ afterEach restores original NODE_ENV
//   ✓ No environment leakage between tests
```

### AC4: No URL Manipulation Required ✅

```javascript
// GIVEN: Import statement at top of file
// WHEN: Test file loaded by Jest
// THEN:
//   ✓ No new URL() usage
//   ✓ No pathToFileURL conversion
//   ✓ No Date.now() cache busting
//   ✓ Standard ES6 import works
```

### AC5: Test Is Simpler and More Readable ✅

```javascript
// GIVEN: Refactored test code
// WHEN: Developer reads test
// THEN:
//   ✓ No complex async isolation patterns
//   ✓ Clear test structure maintained
//   ✓ Straightforward environment setup
//   ✓ Net reduction in lines of code
```

### AC6: All Integration Tests Still Pass ✅

```javascript
// GIVEN: All integration tests in directory
// WHEN: npm run test:integration -- awaitingExternalTurnEndState
// THEN:
//   ✓ All tests pass
//   ✓ No regression in other tests
//   ✓ Production test validates correctly
```

## Invariants

### Test Quality Guarantees (Maintained)

1. **Test Isolation**: Environment properly managed in beforeEach/afterEach
2. **No Side Effects**: Tests clean up after themselves
3. **Fast Execution**: Mock timers used, no real delays
4. **Clear Assertions**: Comprehensive verification of timeout value, cleanup, and error handling

### Test Coverage Guarantees (Maintained)

1. **Production Timeout**: Verifies 30s timeout in production
2. **Environment Respect**: Proves NODE_ENV affects timeout resolution
3. **No Module Caching Issues**: Direct import proves constants work without isolation

### Project Standards (Followed)

1. **Test Helpers**: Uses TestTurnHandler and TurnContext from test infrastructure
2. **Proper Mocking**: jest.spyOn() used for timer functions
3. **AAA Pattern**: Clear Arrange, Act, Assert structure
4. **Descriptive Names**: Test name clearly describes behavior

## Testing Commands

### After Implementation

```bash
# Run this specific test file
npm run test:integration -- awaitingExternalTurnEndState.production

# Run all integration tests for the state
npm run test:integration -- awaitingExternalTurnEndState

# Verify no test fragility
npm run test:integration -- awaitingExternalTurnEndState --runInBand

# Full integration suite
npm run test:integration

# Full test suite (includes unit + integration)
npm run test:ci
```

## Implementation Notes

### Before/After Comparison

**Before (Lines 60-69):**

```javascript
let AwaitingExternalTurnEndState;

await jest.isolateModulesAsync(async () => {
  const { pathToFileURL } = await import('node:url');
  const moduleUrl = new URL(
    `../../../../src/turns/states/awaitingExternalTurnEndState.js?prod=${Date.now()}`,
    import.meta.url
  );
  const fileUrl = pathToFileURL(moduleUrl.pathname).href;
  ({ AwaitingExternalTurnEndState } = await import(
    `${fileUrl}${moduleUrl.search}`
  ));
});
```

**After (Line 1):**

```javascript
// Add at top of file:
import AwaitingExternalTurnEndState from '../../../../src/turns/states/awaitingExternalTurnEndState.js';

// Lines 60-69 removed entirely
```

### Why This Works Without Isolation

**Key Insight**: The `#resolveDefaultTimeout()` method is called in the constructor, not at module load time:

```javascript
// In awaitingExternalTurnEndState.js constructor:
constructor(handler, { timeoutMs, setTimeoutFn, clearTimeoutFn } = {}) {
  // ...
  this.#timeoutMs = timeoutMs ?? this.#resolveDefaultTimeout();  // Called here
}

#resolveDefaultTimeout() {
  const mode = getEnvironmentMode();  // Reads process.env.NODE_ENV
  return mode === 'production'
    ? DEFAULT_TIMEOUT_PRODUCTION
    : DEFAULT_TIMEOUT_DEVELOPMENT;
}
```

**Timeline**:

1. Module imported (constants defined at module level)
2. beforeEach sets `process.env.NODE_ENV = 'production'`
3. Test constructs state (constructor reads current NODE_ENV value)
4. #resolveDefaultTimeout() returns 30,000ms for production

**Proof**: Standard integration test (`awaitingExternalTurnEndState.integration.test.js`) uses direct import and works correctly.

### Environment Safety

- Original NODE_ENV stored in `beforeEach` (line 38)
- Restored in `afterEach` (line 43)
- `jest.resetModules()` called to ensure clean slate (line 46)
- No global environment state leakage

## Definition of Done

- [x] Ticket assumptions reassessed and corrected
- [x] `jest.isolateModulesAsync` wrapper removed (lines 61-69)
- [x] Variable declaration removed (line 60)
- [x] Direct import added at top of file
- [x] Environment management verified (already exists, no changes)
- [x] Test simplified by removing isolation
- [x] Test verifies 30_000ms timeout
- [x] All 6 acceptance criteria verified
- [x] All invariants maintained
- [x] Test passes locally
- [x] Test passes in CI
- [x] All integration tests pass
- [x] Diff manually reviewed (10 lines removed, 1 line added)

## Outcome

### What Was Changed

1. **Added direct import** at top of file instead of dynamic import
2. **Removed module isolation** wrapper (9 lines deleted)
3. **Removed variable declaration** for dynamically imported class
4. **Net reduction**: 10 lines removed, 1 line added = -9 lines

### What Was NOT Changed

- Environment management (already existed and working)
- Constructor calls (already correct)
- Test assertions (already comprehensive)
- Mock setup (already appropriate)

### Validation Results

- ✅ Test passes without module isolation
- ✅ Production timeout (30,000ms) correctly verified
- ✅ All integration tests pass
- ✅ Environment detection works at construction time
- ✅ Code is simpler and more maintainable
