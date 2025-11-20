# AWAEXTTURENDSTAROB-004: Update Production Integration Test

## Metadata
- **Ticket ID:** AWAEXTTURENDSTAROB-004
- **Phase:** 1 - Minimal Change
- **Priority:** Critical
- **Estimated Effort:** 1 hour
- **Dependencies:** AWAEXTTURENDSTAROB-001 (must complete first)

## Objective

Remove `jest.isolateModulesAsync` and URL cache busting from the production integration test, proving that the module-level constant fix works correctly. This unblocks CI and demonstrates that environment changes are now respected without module isolation.

## Files to Modify

### Test Code
- `tests/integration/turns/states/awaitingExternalTurnEndState.production.integration.test.js`
  - Lines 56-70 (remove isolation wrapper and cache busting)
  - Line 111 (direct import, no URL manipulation)
  - Test setup (add environment variable management)

## Changes Required

### 1. Remove jest.isolateModulesAsync Wrapper
```javascript
// BEFORE (lines ~56-70):
await jest.isolateModulesAsync(async () => {
  const filePath = path.join(
    __dirname,
    '../../../src/turns/states/awaitingExternalTurnEndState.js'
  );
  const fileUrl = pathToFileURL(filePath);
  const cacheBustUrl = `${fileUrl.href}?t=${Date.now()}`;
  const { default: AwaitingExternalTurnEndState } = await import(cacheBustUrl);

  // ... test code ...
});

// AFTER:
// Direct import at top of test file:
import AwaitingExternalTurnEndState from '../../../src/turns/states/awaitingExternalTurnEndState.js';

// Test code directly in test function (no isolation wrapper)
```

### 2. Remove Unnecessary Imports
```javascript
// REMOVE these imports:
import path from 'path';
import { pathToFileURL } from 'url';

// KEEP these imports:
import { describe, it, expect, beforeEach, afterEach } from '@jest/globals';
import AwaitingExternalTurnEndState from '../../../src/turns/states/awaitingExternalTurnEndState.js';
// ... other necessary imports ...
```

### 3. Add Environment Variable Management
```javascript
// ADD to test file:
describe('AwaitingExternalTurnEndState - Production Environment Integration', () => {
  let originalNodeEnv;

  beforeEach(() => {
    // Store original environment
    originalNodeEnv = process.env.NODE_ENV;
    // Set production environment for test
    process.env.NODE_ENV = 'production';
  });

  afterEach(() => {
    // Restore original environment
    process.env.NODE_ENV = originalNodeEnv;
  });

  it('should use 30-second timeout in production environment', () => {
    // Test code without isolation
  });
});
```

### 4. Simplify Test Implementation
```javascript
// SIMPLIFIED TEST:
it('should use 30-second timeout in production environment', () => {
  // Arrange
  const mockSetTimeout = jest.fn((fn, ms) => 'timeout-id-123');
  const mockClearTimeout = jest.fn();
  const mockContext = { /* ... */ };
  const mockLogger = { /* ... */ };
  const mockEventBus = {
    dispatch: jest.fn(),
    subscribe: jest.fn(() => 'subscription-id')
  };
  const mockEndTurn = jest.fn();

  // Act
  const state = new AwaitingExternalTurnEndState({
    context: mockContext,
    logger: mockLogger,
    eventBus: mockEventBus,
    endTurn: mockEndTurn,
    setTimeoutFn: mockSetTimeout,
    clearTimeoutFn: mockClearTimeout,
  });

  state.enterState();

  // Assert
  expect(mockSetTimeout).toHaveBeenCalledWith(
    expect.any(Function),
    30_000 // Production timeout
  );
  expect(mockSetTimeout).toHaveBeenCalledTimes(1);
});
```

## Out of Scope

### Must NOT Change
- Other test files (separate tickets)
- Test helper utilities
- Mock implementations (unless simplifying)
- Test coverage requirements
- Other integration tests in the same file (if any)

### Must NOT Add
- New test cases (covered in Tickets 005-006)
- Environment provider tests (Phase 2)
- Additional assertions beyond timeout verification
- New test utilities

## Acceptance Criteria

### AC1: Test Runs Without Module Isolation
```javascript
// GIVEN: Test file with direct import (no jest.isolateModulesAsync)
// WHEN: Test executed with npm run test:integration
// THEN:
//   ✓ Test passes successfully
//   ✓ No module isolation wrapper used
//   ✓ No cache busting required
//   ✓ Test completes in < 100ms
```

### AC2: Production Timeout Verified
```javascript
// GIVEN: process.env.NODE_ENV = 'production'
// WHEN: State created and enterState() called
// THEN:
//   ✓ mockSetTimeout called with 30_000ms
//   ✓ Timeout value matches production default exactly
//   ✓ Only one setTimeout call made
```

### AC3: Environment Variable Management Works
```javascript
// GIVEN: beforeEach sets NODE_ENV to 'production'
// WHEN: Multiple tests run in sequence
// THEN:
//   ✓ Each test gets clean production environment
//   ✓ afterEach restores original NODE_ENV
//   ✓ No environment leakage between tests
```

### AC4: No URL Manipulation Required
```javascript
// GIVEN: Import statement at top of file
// WHEN: Test file loaded by Jest
// THEN:
//   ✓ No path.join usage
//   ✓ No pathToFileURL conversion
//   ✓ No Date.now() cache busting
//   ✓ Standard ES6 import works
```

### AC5: Test Is Simpler and More Readable
```javascript
// GIVEN: Refactored test code
// WHEN: Developer reads test
// THEN:
//   ✓ No complex async isolation patterns
//   ✓ Clear arrange-act-assert structure
//   ✓ Straightforward environment setup
//   ✓ Fewer lines of code than before
```

### AC6: All Integration Tests Still Pass
```javascript
// GIVEN: All integration tests in directory
// WHEN: npm run test:integration -- awaitingExternalTurnEndState
// THEN:
//   ✓ All tests pass
//   ✓ No regression in other tests
//   ✓ Production test validates correctly
```

## Invariants

### Test Quality Guarantees (Must Maintain)
1. **Test Isolation**: Each test gets clean environment state
2. **No Side Effects**: Tests don't affect each other
3. **Fast Execution**: Tests complete quickly (no real timers)
4. **Clear Assertions**: Tests verify specific behavior

### Test Coverage Guarantees (Must Maintain)
1. **Production Timeout**: Verifies 30s timeout in production
2. **Environment Respect**: Proves environment changes work
3. **No Module Caching Issues**: Demonstrates fix effectiveness

### Project Standards (Must Follow)
1. **Use TestBed Helpers**: Import from `/tests/common/` if needed
2. **Mock Properly**: Use jest.fn() for all dependencies
3. **AAA Pattern**: Arrange, Act, Assert structure
4. **Descriptive Names**: Test names describe behavior

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

**Before (Lines ~70):**
```javascript
await jest.isolateModulesAsync(async () => {
  const filePath = path.join(__dirname, '../../../src/turns/states/...');
  const fileUrl = pathToFileURL(filePath);
  const cacheBustUrl = `${fileUrl.href}?t=${Date.now()}`;
  const { default: AwaitingExternalTurnEndState } = await import(cacheBustUrl);

  const state = new AwaitingExternalTurnEndState({...});
  // ... test code ...
});
```

**After (Lines ~30):**
```javascript
// Top of file
import AwaitingExternalTurnEndState from '../../../src/turns/states/awaitingExternalTurnEndState.js';

// In test
beforeEach(() => {
  process.env.NODE_ENV = 'production';
});

afterEach(() => {
  process.env.NODE_ENV = originalNodeEnv;
});

it('should use 30-second timeout in production environment', () => {
  const state = new AwaitingExternalTurnEndState({...});
  state.enterState();
  expect(mockSetTimeout).toHaveBeenCalledWith(expect.any(Function), 30_000);
});
```

### Environment Safety
- Always store original `NODE_ENV` in `beforeEach`
- Always restore in `afterEach`
- Never rely on global environment state
- Use descriptive variable names (`originalNodeEnv`)

## Definition of Done

- [ ] `jest.isolateModulesAsync` wrapper removed
- [ ] `path` and `pathToFileURL` imports removed
- [ ] Direct import added at top of file
- [ ] `beforeEach` sets `NODE_ENV = 'production'`
- [ ] `afterEach` restores original `NODE_ENV`
- [ ] Test simplified to direct instantiation
- [ ] Test verifies 30_000ms timeout
- [ ] All 6 acceptance criteria verified
- [ ] All invariants maintained
- [ ] Test passes locally
- [ ] Test passes in CI
- [ ] All integration tests pass
- [ ] Code review completed
- [ ] Diff manually reviewed (<50 lines changed, likely negative diff)
