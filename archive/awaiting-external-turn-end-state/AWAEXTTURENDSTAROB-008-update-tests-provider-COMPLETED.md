# AWAEXTTURENDSTAROB-008: Update Tests to Use TestEnvironmentProvider

## Metadata

- **Ticket ID:** AWAEXTTURENDSTAROB-008
- **Phase:** 2 - Standard Patterns
- **Priority:** High
- **Estimated Effort:** 2 hours
- **Dependencies:** AWAEXTTURENDSTAROB-007 (must complete first)
- **Status:** ✅ COMPLETED

## Objective

Refactor existing tests to use `TestEnvironmentProvider` injection instead of `process.env.NODE_ENV` manipulation. This eliminates global environment state, improves test isolation, and demonstrates the DI pattern working correctly.

## Files to Modify

### Test Files

- `tests/unit/turns/states/awaitingExternalTurnEndState.environmentConfig.test.js`
  - All test cases using `process.env.NODE_ENV`
  - Import `TestEnvironmentProvider`
  - Replace environment manipulation with provider injection

- `tests/integration/turns/states/awaitingExternalTurnEndState.production.integration.test.js`
  - Production timeout test
  - Replace `NODE_ENV` setting with provider injection

## Changes Required

### 1. Update environmentConfig.test.js - Add Import

```javascript
// ADD to imports:
import { TestEnvironmentProvider } from '../../../../src/configuration/TestEnvironmentProvider.js';

// REMOVE or keep for reference (no longer using):
// process.env.NODE_ENV manipulation
```

### 2. Update environmentConfig.test.js - Remove Environment Setup

```javascript
// REMOVE beforeEach/afterEach environment management:
beforeEach(() => {
  originalNodeEnv = process.env.NODE_ENV;
  // ... mock setup ...
});

afterEach(() => {
  // DELETE: process.env.NODE_ENV = originalNodeEnv;
});

// REPLACE WITH simpler setup (no environment restoration needed):
beforeEach(() => {
  // ... mock setup only (no environment capture) ...
});

afterEach(() => {
  // No environment restoration needed
});
```

### 3. Update Test 1: Production Environment

```javascript
// BEFORE:
it('should use 30-second timeout in production environment', async () => {
  process.env.NODE_ENV = 'production';
  const mockSetTimeout = jest.fn(() => 'timeout-id');

  const state = new AwaitingExternalTurnEndState(mockHandler, {
    setTimeoutFn: mockSetTimeout,
  });
  await state.enterState(mockHandler, null);

  expect(mockSetTimeout).toHaveBeenCalledWith(expect.any(Function), 30_000);
});

// AFTER:
it('should use 30-second timeout in production environment', async () => {
  // Arrange
  const productionProvider = new TestEnvironmentProvider({
    IS_PRODUCTION: true,
  });
  const mockSetTimeout = jest.fn(() => 'timeout-id');

  // Act
  const state = new AwaitingExternalTurnEndState(mockHandler, {
    environmentProvider: productionProvider,
    setTimeoutFn: mockSetTimeout,
  });
  await state.enterState(mockHandler, null);

  // Assert
  expect(mockSetTimeout).toHaveBeenCalledWith(expect.any(Function), 30_000);
  expect(mockSetTimeout).toHaveBeenCalledTimes(1);
});
```

### 4. Update Test 2: Development Environment

```javascript
// AFTER:
it('should use 3-second timeout in development environment', async () => {
  // Arrange
  const developmentProvider = new TestEnvironmentProvider({
    IS_PRODUCTION: false,
  });
  const mockSetTimeout = jest.fn(() => 'timeout-id');

  // Act
  const state = new AwaitingExternalTurnEndState(mockHandler, {
    environmentProvider: developmentProvider,
    setTimeoutFn: mockSetTimeout,
  });
  await state.enterState(mockHandler, null);

  // Assert
  expect(mockSetTimeout).toHaveBeenCalledWith(expect.any(Function), 3_000);
});
```

### 5. Update Test 3: Test Environment (Now Just Another Development Test)

```javascript
// AFTER (can keep as-is with provider for consistency):
it('should use 3-second timeout in test environment', async () => {
  // Arrange
  const testProvider = new TestEnvironmentProvider({
    IS_PRODUCTION: false,
    IS_TEST: true,
  });
  const mockSetTimeout = jest.fn(() => 'timeout-id');

  // Act
  const state = new AwaitingExternalTurnEndState(mockHandler, {
    environmentProvider: testProvider,
    setTimeoutFn: mockSetTimeout,
  });
  await state.enterState(mockHandler, null);

  // Assert
  expect(mockSetTimeout).toHaveBeenCalledWith(expect.any(Function), 3_000);
});
```

### 6. Update Test 4: Undefined NODE_ENV → Default Behavior Test

```javascript
// BEFORE:
it('should use 3-second timeout when NODE_ENV is undefined in Jest environment', async () => {
  delete process.env.NODE_ENV;
  const mockSetTimeout = jest.fn(() => 'timeout-id');

  const state = new AwaitingExternalTurnEndState(mockHandler, {
    setTimeoutFn: mockSetTimeout,
  });
  await state.enterState(mockHandler, null);

  expect(mockSetTimeout).toHaveBeenCalledWith(expect.any(Function), 3_000);
});

// AFTER:
it('should use 3-second timeout when NODE_ENV is undefined in Jest environment', async () => {
  // Arrange
  // Use TestEnvironmentProvider to explicitly test Jest environment behavior
  const testProvider = new TestEnvironmentProvider({
    IS_PRODUCTION: false,
    IS_TEST: true,
  });
  const mockSetTimeout = jest.fn(() => 'timeout-id');

  // Act
  const state = new AwaitingExternalTurnEndState(mockHandler, {
    environmentProvider: testProvider,
    setTimeoutFn: mockSetTimeout,
  });
  await state.enterState(mockHandler, null);

  // Assert
  expect(mockSetTimeout).toHaveBeenCalledWith(expect.any(Function), 3_000);
});
```

### 7. Update Tests 5-6: Explicit Override Tests

```javascript
// AFTER (minimal change - just add provider for consistency):
it('should use explicit timeout over production default', async () => {
  // Arrange
  const productionProvider = new TestEnvironmentProvider({
    IS_PRODUCTION: true,
  });
  const mockSetTimeout = jest.fn(() => 'timeout-id');

  // Act
  const state = new AwaitingExternalTurnEndState(mockHandler, {
    environmentProvider: productionProvider,
    timeoutMs: 5_000, // Explicit override
    setTimeoutFn: mockSetTimeout,
  });
  await state.enterState(mockHandler, null);

  // Assert
  expect(mockSetTimeout).toHaveBeenCalledWith(expect.any(Function), 5_000);
});

it('should use explicit timeout over development default', async () => {
  // Arrange
  const developmentProvider = new TestEnvironmentProvider({
    IS_PRODUCTION: false,
  });
  const mockSetTimeout = jest.fn(() => 'timeout-id');

  // Act
  const state = new AwaitingExternalTurnEndState(mockHandler, {
    environmentProvider: developmentProvider,
    timeoutMs: 10_000, // Explicit override
    setTimeoutFn: mockSetTimeout,
  });
  await state.enterState(mockHandler, null);

  // Assert
  expect(mockSetTimeout).toHaveBeenCalledWith(expect.any(Function), 10_000);
});
```

### 8. Update production.integration.test.js

```javascript
// ADD to imports:
import { TestEnvironmentProvider } from '../../../../src/configuration/TestEnvironmentProvider.js';

// UPDATE test:
describe('AwaitingExternalTurnEndState production defaults integration', () => {
  // REMOVE environment management in beforeEach/afterEach:
  // let originalEnv;
  // beforeEach(() => { originalEnv = process.env.NODE_ENV; });
  // afterEach(() => { process.env.NODE_ENV = originalEnv; });

  // Keep other cleanup (timers, mocks, modules)

  test('schedules production timeout and cleans up using default timer helpers', async () => {
    // Arrange
    const productionProvider = new TestEnvironmentProvider({
      IS_PRODUCTION: true,
    });

    // ... existing mock setup ...

    // Act - REMOVE process.env.NODE_ENV manipulation, ADD provider
    const state = new AwaitingExternalTurnEndState(handler, {
      environmentProvider: productionProvider, // ADD
      // No setTimeoutFn/clearTimeoutFn - uses spies on global
    });

    await state.enterState(handler, null);

    // Assert
    expect(setTimeoutSpy).toHaveBeenCalledTimes(1);
    expect(setTimeoutSpy).toHaveBeenCalledWith(expect.any(Function), 30_000);

    // ... rest of test assertions ...
  });
});
```

## Out of Scope

### Must NOT Change

- Production code (already updated in Ticket 007)
- New integration test files (Tickets 009-011)
- Regression tests (keep using real NODE_ENV for regression verification)
- Test helpers in `/tests/common/`
- Other unrelated tests

### Must NOT Add

- New test cases (covered in other tickets)
- Provider validation tests (Ticket 009)
- Property-based tests (Phase 3)

## Acceptance Criteria

### AC1: No process.env.NODE_ENV Manipulation

```javascript
// GIVEN: Updated test files
// WHEN: Code review performed
// THEN:
//   ✓ No process.env.NODE_ENV assignments in environmentConfig.test.js
//   ✓ No process.env.NODE_ENV assignments in production.integration.test.js
//   ✓ No delete process.env.NODE_ENV statements
//   ✓ All environment control via TestEnvironmentProvider
```

### AC2: TestEnvironmentProvider Used in All Environment Tests

```javascript
// GIVEN: Tests requiring specific environments
// WHEN: Tests executed
// THEN:
//   ✓ Production tests use TestEnvironmentProvider({ IS_PRODUCTION: true })
//   ✓ Development tests use TestEnvironmentProvider({ IS_PRODUCTION: false })
//   ✓ No global environment state manipulation
```

### AC3: Tests More Isolated

```javascript
// GIVEN: Multiple tests in same file
// WHEN: Tests run in any order
// THEN:
//   ✓ No environment leakage between tests
//   ✓ Each test gets clean provider instance
//   ✓ Tests can run in parallel safely
//   ✓ No beforeEach/afterEach environment restoration needed
```

### AC4: All Tests Still Pass

```javascript
// GIVEN: Updated test files
// WHEN: npm run test:unit && npm run test:integration
// THEN:
//   ✓ environmentConfig.test.js passes (all 10+ tests)
//   ✓ production.integration.test.js passes
//   ✓ No regression in test behavior
//   ✓ Coverage maintained or improved
```

### AC5: Tests More Readable

```javascript
// GIVEN: Updated test code
// WHEN: Developer reads test
// THEN:
//   ✓ Provider injection clearly shows environment intent
//   ✓ No hidden global state changes
//   ✓ Test setup simpler (no environment cleanup)
//   ✓ Test dependencies explicit in test body
```

### AC6: Regression Tests Unchanged

```javascript
// GIVEN: Regression test files (Ticket 006)
// WHEN: Those tests remain as-is
// THEN:
//   ✓ Regression tests still use process.env.NODE_ENV
//   ✓ Regression tests verify real environment detection works
//   ✓ Different purpose (unit tests vs regression tests)
```

## Invariants

### Test Quality Standards (Must Maintain)

1. **Isolation**: Each test independent, no shared state
2. **Fast**: All tests complete quickly (<500ms total)
3. **Clear**: Provider injection makes environment explicit
4. **Complete**: All environment scenarios still tested

### Coverage Requirements (Must Maintain or Improve)

1. **Branches**: ≥95% for configuration logic
2. **Functions**: 100% for timeout resolution
3. **Lines**: ≥95% for validation
4. **Edge Cases**: All scenarios still covered

### Project Standards (Must Follow)

1. **TestBed Usage**: Continue using createTestBed()
2. **Mock Patterns**: jest.fn() for dependencies
3. **Import Style**: ES6 imports with .js extensions
4. **Provider Pattern**: Use project's TestEnvironmentProvider

## Testing Commands

### After Implementation

```bash
# Run updated unit tests
npm run test:unit -- environmentConfig.test.js

# Run updated integration test
npm run test:integration -- production.integration.test.js

# Run all state tests
npm run test:unit -- awaitingExternalTurnEndState
npm run test:integration -- awaitingExternalTurnEndState

# Verify regression tests still work
npm run test:regression -- environmentDetection.regression.test.js

# Full test suite
npm run test:ci
```

### Coverage Verification

```bash
# Verify coverage maintained
npm run test:unit -- awaitingExternalTurnEndState --coverage

# Check specific file coverage
npm run test:unit -- environmentConfig.test.js --coverage --collectCoverageFrom='src/turns/states/awaitingExternalTurnEndState.js'
```

## Implementation Notes

### TestEnvironmentProvider Usage Pattern

```javascript
// Production environment
const productionProvider = new TestEnvironmentProvider({ IS_PRODUCTION: true });

// Development environment
const developmentProvider = new TestEnvironmentProvider({
  IS_PRODUCTION: false,
});

// Inject in state creation
const state = new AwaitingExternalTurnEndState({
  environmentProvider: productionProvider,
  // ... other dependencies ...
});
```

### Migration Checklist Per Test

For each test using `process.env.NODE_ENV`:

1. [ ] Create appropriate `TestEnvironmentProvider` instance
2. [ ] Add `environmentProvider` to state constructor call
3. [ ] Remove `process.env.NODE_ENV` assignment
4. [ ] Remove environment restoration in afterEach
5. [ ] Verify test still passes
6. [ ] Verify test name still accurate

### Before/After Example

```javascript
// BEFORE:
beforeEach(() => {
  originalNodeEnv = process.env.NODE_ENV;
});

afterEach(() => {
  process.env.NODE_ENV = originalNodeEnv;
});

it('should use 30s timeout in production', () => {
  process.env.NODE_ENV = 'production';
  const state = new AwaitingExternalTurnEndState({...});
  // ...
});

// AFTER:
// No beforeEach/afterEach needed for environment

it('should use 30s timeout in production', () => {
  const provider = new TestEnvironmentProvider({ IS_PRODUCTION: true });
  const state = new AwaitingExternalTurnEndState({
    environmentProvider: provider,
    ...
  });
  // ...
});
```

## Definition of Done

- [x] `TestEnvironmentProvider` imported in both test files
- [x] All `process.env.NODE_ENV` assignments removed
- [x] Environment restoration code removed (beforeEach/afterEach)
- [x] All environment tests updated to use provider injection
- [x] Production integration test updated
- [x] All 6 acceptance criteria verified
- [x] All invariants maintained
- [x] All updated tests pass
- [x] Coverage maintained (≥95% branches, 100% functions)
- [x] Code review completed
- [x] Diff manually reviewed (~50-80 lines changed across 2 files)

## Outcome

### What Was Changed

**Files Modified:**

1. `tests/unit/turns/states/awaitingExternalTurnEndState.environmentConfig.test.js` (40 lines changed)
   - Added `TestEnvironmentProvider` import from correct path (`src/configuration/`)
   - Removed `originalNodeEnv` variable and all `process.env.NODE_ENV` manipulation
   - Updated all 7 environment-based tests to use `TestEnvironmentProvider` injection
   - Simplified beforeEach/afterEach (no environment restoration needed)

2. `tests/integration/turns/states/awaitingExternalTurnEndState.production.integration.test.js` (15 lines changed)
   - Added `TestEnvironmentProvider` import
   - Removed all `process.env.NODE_ENV` manipulation code
   - Removed environment restoration logic in beforeEach/afterEach
   - Updated state construction to use `environmentProvider` option

**Test Results:**

- All 11 unit tests pass ✅
- Integration test passes ✅
- All 95+ related state tests still pass ✅
- No test coverage regression

### Deviations from Original Plan

1. **Import Path Correction**: Ticket assumed `src/environment/` but actual path is `src/configuration/TestEnvironmentProvider.js`

2. **Constructor Pattern**: Ticket assumed `testBed.createStateBasics()` pattern, but actual tests use direct constructor: `new AwaitingExternalTurnEndState(handler, options)`

3. **Test Structure**: Tests don't use `createTestBed()` - they manually create mocks, so the ticket examples were adjusted to match actual test patterns

4. **Integration Test Complexity**: The integration test had more complex environment manipulation (with `hadNodeEnv` checks) than ticket anticipated - all removed cleanly

### Benefits Achieved

- ✅ **Zero Global State Manipulation**: No more `process.env.NODE_ENV` assignments
- ✅ **Better Test Isolation**: Each test gets clean provider instance
- ✅ **More Explicit Dependencies**: Provider injection makes environment requirements clear
- ✅ **Simpler Test Setup**: No beforeEach/afterEach environment restoration needed
- ✅ **Maintained Coverage**: All edge cases still tested (production, development, test, custom, invalid inputs)

### Impact

- **0 breaking changes** - Production code unchanged (already updated in Ticket 007)
- **0 test behavior changes** - All tests verify same contracts
- **Improved maintainability** - Tests now follow DI pattern consistently
