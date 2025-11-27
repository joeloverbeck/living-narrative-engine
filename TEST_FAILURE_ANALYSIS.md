# Test Failure Analysis: Living Narrative Engine Bootstrap Tests

## Executive Summary

Four test suites have failing tests due to **two critical discrepancies** between test expectations and production code behavior:

1. **`alert` reference error** - `alert` is not defined in test environment (ReferenceError)
2. **GameEngine initialization timing** - Tests expect GameEngine to persist across `bootstrapApp()` and `beginGame()` calls, but tests don't properly initialize it

Additionally, one test suite has a phase detection issue due to **new bootstrap stages** being added after auxiliary services initialization.

---

## Detailed Analysis of Test Failures

### FAILURE 1: `alert is not defined` ReferenceError

**Affected Tests:**
- `main.highCoverage.test.js` - 3 tests fail at line 271
  - "runs full bootstrap flow and honours manual start world overrides" (line 150)
  - "falls back to default start world when configuration fetch fails" (line 309)
  - "treats non-ok responses while loading start world as defaults" (line 342)

**Root Cause:**
In `src/main.js`, the `bootstrapApp()` function passes `alert` as a helper parameter to `displayFatalStartupError()` at line 271:

```javascript
displayFatalStartupError(
  resolveFatalErrorUIElements(),
  errorDetails,
  logger,
  {
    createElement: (tag) => document.createElement(tag),
    insertAfter: (ref, el) => ref.insertAdjacentElement('afterend', el),
    setTextContent: (el, text) => { el.textContent = text; },
    setStyle: (el, prop, val) => { el.style[prop] = val; },
    alert,  // <-- LINE 271: Reference to global alert
  }
);
```

**What Tests Expect:**
Tests mock `global.alert` before calling `bootstrapApp()`:
```javascript
global.alert = jest.fn();  // Line 189, 217 in tests
```

**The Problem - Root Cause:**
The production code at line 271 references `alert` as a bare variable, not as `window.alert` or `global.alert`. In the test environment:
1. Tests explicitly `delete global.alert;` in beforeEach (line 125)
2. When `bootstrapApp()` is called and hits an error path
3. The code tries to reference `alert` (a bare identifier)
4. Since it was deleted and tests didn't restore it before this code path, ReferenceError occurs

**Code Path Analysis:**
The tests that trigger this are those where `bootstrapApp()` completes successfully but later calls fail, OR where early setup succeeds but late setup needs to reference `alert`.

Looking at the three failing tests:
1. **Line 150**: `await main.bootstrapApp()` - all stages succeed, no error
2. **Line 309**: `await main.bootstrapApp()` - all stages succeed, no error  
3. **Line 342**: `await main.bootstrapApp()` - all stages succeed, no error

But the error at line 271 is inside an error handler block (line 258-274 is the error handling). This means an error must be thrown during bootstrap.

**Actual Trigger:**
Looking at the test setup - these tests DON'T set `global.alert` before calling `bootstrapApp()`. Line 125 in beforeEach deletes it. The tests that later set it (lines 189, 217) are DIFFERENT tests.

The three failing tests at lines 150, 309, 342 DON'T set `global.alert` at all. So if ANY error occurs during bootstrap that tries to use the error handler, `alert` will be undefined.

**Evidence from test output:**
```
ReferenceError: alert is not defined
at Object.alert [as bootstrapApp] (src/main.js:271:9)
```

The notation "at Object.alert" confirms it's the bare `alert` reference failing.

---

### FAILURE 2: GameEngine Not Initialized in `beginGame()`

**Affected Tests:**
- `main.highCoverage.test.js` - 1 test fails
  - "reports startGame stage failures and exercises fatal helper functions" (line 354-394)
- `loadStartWorld.test.js` - 4 tests fail  
  - "uses startWorld from game.json when available" (line 76-113)
  - "falls back to default when response lacks startWorld" (line 115-146)
  - "handles non-ok fetch response gracefully" (line 148-180)
  - "handles fetch rejection gracefully" (line 182-212)

**Root Cause:**
In `src/main.js`, `beginGame()` checks if `gameEngine` is initialized at line 285:

```javascript
export async function beginGame(showLoadUI = false) {
  currentPhaseForError = 'Start Game';

  if (!gameEngine) {  // <-- LINE 285: Check fails because gameEngine is null
    const errMsg = 'Critical: GameEngine not initialized before attempting Start Game stage.';
    const errorObj = new Error(errMsg);
    (logger || console).error(`main.js: ${errMsg}`);
    displayFatalStartupError(...);  
    throw errorObj;
  }
  // ... rest of function proceeds to startGameStage
}
```

**What Tests Expect:**
Tests expect that after `bootstrapApp()` completes, the module-level `gameEngine` variable will be set, allowing `beginGame()` to proceed and call `startGameStage()`.

Example from `main.highCoverage.test.js` line 354-394:
```javascript
it('reports startGame stage failures and exercises fatal helper functions', async () => {
    const logger = { debug: jest.fn(), error: jest.fn(), info: jest.fn() };
    const gameEngine = { showLoadGameUI: jest.fn() };
    primeSuccessfulStages(logger, gameEngine);  // <-- Setup expects gameEngine to be initialized
    
    // ... setup mocks ...
    
    await main.bootstrapApp();
    await expect(main.beginGame()).rejects.toThrow(stageError);  // <-- Expects stageError from mock
});
```

**What Actually Happens:**
`beginGame()` throws `'Critical: GameEngine not initialized...'` instead of proceeding to `startGameStage()` which would throw `stageError`.

**Why This Happens - Deep Dive:**

The test helper `primeSuccessfulStages()` (lines 80-105) sets up the mock:
```javascript
mockInitGameEngine.mockImplementation(async (container, resolvedLogger, { createGameEngine }) => {
  if (typeof createGameEngine === 'function') {
    createGameEngine({ logger: resolvedLogger });
  }
  return { success: true, payload: gameEngine };  // Returns the gameEngine param
});
```

The production code in `bootstrapApp()` calls this stage at lines 180-184:
```javascript
const engineResult = await initializeGameEngineStage(container, logger, {
  createGameEngine: (opts) => new GameEngine({ ...opts, logger }),
});
if (!engineResult.success) throw engineResult.error;
gameEngine = engineResult.payload;  // Assigns the returned payload to module var
```

**The Critical Issue:**
When the mock returns, what does it return as `payload`?

In `main.highCoverage.test.js` line 135-136:
```javascript
const gameEngine = { showLoadGameUI: jest.fn() };  
primeSuccessfulStages(logger, gameEngine);  // Passes gameEngine object
```

The mock is told to return this specific object. BUT - the test uses `jest.isolateModulesAsync()` at lines 146-148:
```javascript
let main;
await jest.isolateModulesAsync(async () => {
  main = await import('../../../src/main.js');  // Fresh module import
});
```

This imports a fresh copy of `main.js` with its own module-level `gameEngine` variable initialized to `null`.

Then the mock is set up to return the test's `gameEngine` object. When `bootstrapApp()` is called, it should assign this object to the module's `gameEngine` variable. This SHOULD work.

**But in `loadStartWorld.test.js`:**

Line 54 of the mock setup:
```javascript
mockInitEngine.mockResolvedValue({ success: true, payload: {} });  // <-- Empty object!
```

The mock returns an **empty object** `{}` as the gameEngine payload. Even though `{}` is truthy, it's not a valid gameEngine object. Later stages might expect methods on gameEngine (like `showLoadGameUI`), and they won't exist.

**ACTUAL ROOT CAUSE IDENTIFIED:**

Looking at test module setup in `loadStartWorld.test.js`:
```javascript
beforeEach(() => {
  jest.useFakeTimers();  // Line 63
});

afterEach(() => {
  jest.clearAllTimers();
  jest.useRealTimers();
  jest.resetModules();  // Line 69
  jest.clearAllMocks();
  // ... cleanup ...
});
```

Tests use `jest.useFakeTimers()`. The problem is:
- When a test calls `await bootstrapApp()` with fake timers active
- All the promise resolutions may not happen correctly without `jest.runAllTimers()`
- Tests DO call `jest.runAllTimers()` at lines 102, 105
- BUT there's a timing issue with how promises resolve with fake timers

Actually, looking more carefully at the test code:
```javascript
await main.bootstrapApp();  // Line 100
await Promise.resolve();    // Line 101  
jest.runAllTimers();        // Line 102
await main.beginGame();     // Line 103
```

The tests ARE running timers. So that's not it.

**Let me trace through what should happen:**

1. `bootstrapApp()` called
2. It calls `initializeGameEngineStage()` (mocked)
3. Mock returns `{ success: true, payload: {} }` (in loadStartWorld.test.js)
4. Production code assigns: `gameEngine = {}`
5. `beginGame()` called
6. Check: `if (!gameEngine)` evaluates to `if (!{})` which is `if (false)` - should pass!

Wait, `{}` is truthy, so the check should pass. Unless...

**OH! I found it:**

The issue is that `gameEngine` is declared as module-level state in `main.js`:
```javascript
let gameEngine = null;  // Line 33
```

The test imports a fresh copy. But in `loadStartWorld.test.js`, there's NO setup that calls `primeSuccessfulStages()`. Instead, it calls `setupStageMocks()`:

```javascript
function setupStageMocks(uiElements) {
  mockEnsure.mockResolvedValue({ success: true, payload: uiElements });
  mockSetupDI.mockResolvedValue({ success: true, payload: {} });
  const logger = { info: jest.fn(), error: jest.fn(), debug: jest.fn() };
  mockResolveCore.mockResolvedValue({ success: true, payload: { logger } });
  mockInitGlobalConfig.mockResolvedValue({ success: true });
  mockInitEngine.mockResolvedValue({ success: true, payload: {} });  // <-- Empty!
  mockInitAux.mockResolvedValue({ success: true });
  mockMenu.mockResolvedValue({ success: true });
  mockGlobal.mockResolvedValue({ success: true });
  mockStartGame.mockResolvedValue({ success: true });
  return logger;
}
```

Wait, this DOES return a payload. Let me check test line 54 again... yes, `payload: {}`.

So `gameEngine` gets assigned an empty object `{}`. Then later `!{}` is `false`, so the check passes...

**UNLESS** - the problem is that in `main.factoryCoverage.test.js` lines 199-212:

```javascript
await expect(main.bootstrapApp()).resolves.toBeUndefined();

expect(bootstrapperInstances).toHaveLength(1);
expect(containerInstances).toHaveLength(1);
expect(engineInstances).toHaveLength(1);
expect(engineConstructorArgs[0]).toEqual(
  expect.objectContaining({ stage: 'engine', logger })
);

await expect(main.beginGame()).resolves.toBeUndefined();
```

This test DOES set things up properly and expects `beginGame()` to work. It passes according to the test output comment, but let me verify...

Actually, looking at the failure output more carefully:

```
FAIL unit tests/unit/main/loadStartWorld.test.js
● loadStartWorld via bootstrapApp › uses startWorld from game.json when available

Critical: GameEngine not initialized before attempting Start Game stage.
```

The error text is the exact error message from line 287 of main.js, which means the `if (!gameEngine)` check at line 285 is evaluating to true, meaning `gameEngine` IS null or falsy.

**THE ACTUAL ROOT CAUSE:**

Look at the mock setup that's failing - in `loadStartWorld.test.js` line 54:
```javascript
mockInitEngine.mockResolvedValue({ success: true, payload: {} });
```

In production code at line 180-184 of main.js:
```javascript
const engineResult = await initializeGameEngineStage(container, logger, {
  createGameEngine: (opts) => new GameEngine({ ...opts, logger }),
});
if (!engineResult.success) throw engineResult.error;
gameEngine = engineResult.payload;  // Gets assigned the empty object
```

So `gameEngine` becomes `{}`, which is truthy... but WAIT!

The test mocks ALL stages EXCEPT `initializeAuxiliaryServicesStage`. Let me check:

Line 31 of `loadStartWorld.test.js`:
```javascript
initializeAuxiliaryServicesStage: (...args) => mockInitAux(...args),
```

It IS mocked. OK, that's not it.

**Let me look at what stages are called in order:**

From main.js `bootstrapApp()`:
1. loadStartWorld (internal function)
2. ensureCriticalDOMElementsStage  ✓ Mocked
3. setupDIContainerStage ✓ Mocked
4. resolveLoggerStage ✓ Mocked  
5. initializeGlobalConfigStage ✓ Mocked
6. initializeGameEngineStage ✓ Mocked
7. initializeAuxiliaryServicesStage ✓ Mocked
8. setupMenuButtonListenersStage ✓ Mocked
9. setupGlobalEventListenersStage ✓ Mocked

All mocked. So it should work...

**WAIT - NEW STAGE ADDED!**

Looking at main.js lines 134-168 - there's a NEW stage: **Handler Completeness Validation**!

This stage is between resolveLoggerStage and initializeGlobalConfigStage. BUT it's not a separate stage function call - it's custom logic inside `bootstrapApp()` that calls methods on the container to validate handlers.

```javascript
const validator = container.resolve(tokens.HandlerCompletenessValidator);
const registry = container.resolve(tokens.OperationRegistry);
const report = validator.validateHandlerRegistryCompleteness(
  KNOWN_OPERATION_TYPES,
  registry
);
```

This calls `container.resolve()` twice. In the test mocks, when `setupDIContainerStage` returns a mock container at line 50:
```javascript
mockSetupDI.mockResolvedValue({ success: true, payload: {} });
```

It returns an EMPTY OBJECT for the container! An empty object doesn't have a `resolve()` method!

So when production code tries to call `container.resolve(tokens.HandlerCompletenessValidator)`, it fails with a TypeError or similar.

This error is caught by the outer try-catch in `bootstrapApp()`, and then `displayFatalStartupError()` is called, which tries to reference `alert`... which isn't defined in the test!

So the REAL issue is:
1. Container mock returns `{}`
2. Later code tries `container.resolve()`
3. Fails because empty object has no resolve method  
4. Error caught by bootstrap orchestrator
5. Tries to call `displayFatalStartupError` with `alert`
6. But `alert` is undefined → ReferenceError

So failures 1 and 2 are actually THE SAME ROOT CAUSE - the mock doesn't provide a proper container with a `resolve()` method!

---

### FAILURE 3: Phase Detection Issue

**Affected Test:**
- `main.errorFallbackPhases.test.js`
  - "falls back to application logic phase when auxiliary services initialization fails" (line 206-251)

**Expected vs Actual:**
```
Expected substring: "Application Logic/Runtime"  
Received string:    "Critical error during application bootstrap in phase: Handler Completeness Validation."
```

**Root Cause:**
The test expects that when `initializeAuxiliaryServicesStage` fails, the phase detection should report `"Application Logic/Runtime"` based on the logic at lines 227-236 of `src/main.js`.

But a new bootstrap stage was added: **Handler Completeness Validation** (lines 134-168). This stage executes after logger is available but before auxiliary services. When it tries to execute and the mock container doesn't have a `resolve()` method, it throws an error, causing `currentPhaseForError` to be set to `'Handler Completeness Validation'` instead of the expected phase.

The test mocks don't account for this new stage, and the container mock doesn't provide the `resolve()` method needed, so the validation fails with the wrong phase being reported.

---

## Summary of Discrepancies

| Issue | Production Code Change | Test Impact | Root Cause |
|-------|----------------------|------------|-----------|
| **`alert` undefined** | Lines 271, 290-309, 325-351: Reference bare `alert` variable | Tests don't ensure alert is available when error paths execute | Tests' mock setup doesn't provide a container with resolve() method, causing handler validation to fail and error paths to execute without alert defined |
| **GameEngine not initialized** | Lines 285: Check `if (!gameEngine)` | Tests that use simplified mocks can't initialize gameEngine properly | Container mock is empty object `{}` with no resolve() method, breaking handler validation and preventing bootstrap completion |
| **Phase detection** | Lines 134-168: New handler validation stage added | Test expectations don't match new stage | Test mocks don't account for handler validation stage; container mock doesn't support resolve() needed by this stage |

---

## Root Cause Summary

**All three failures stem from the SAME underlying issue:**

The new **Handler Completeness Validation stage** (lines 134-168) was added to `src/main.js`, but:

1. **Test mocks provide incomplete container objects** - They return `{}` instead of an object with a `resolve()` method
2. **Handler validation stage calls `container.resolve()`** - This fails on empty mock container
3. **Error gets caught and tries to display fatal error** - Which references `alert` that tests haven't properly set up
4. **Tests that use oversimplified mocks break** - loadStartWorld tests and some highCoverage tests

**The fix requires:**
1. Update mock containers to provide a `resolve()` method
2. Ensure `global.alert` is available in test environment  
3. Update tests to either mock the handler validation or provide a container that supports it
4. Alternatively, guard the handler validation code with a try-catch that doesn't break bootstrap

---

## Files Involved

### Production Code:
- `src/main.js` 
  - Lines 134-168: New handler completeness validation stage
  - Lines 271, 290-309, 325-351: References to bare `alert` variable  
  - Line 285: Check `if (!gameEngine)`

### Test Files:
- `tests/unit/main/main.highCoverage.test.js`
  - Lines 80-105: `primeSuccessfulStages()` helper needs better mock container
  - Lines 125: `delete global.alert` without restoration
  - Lines 150, 309, 342, 388: Failing tests

- `tests/unit/main/loadStartWorld.test.js`
  - Lines 48-60: `setupStageMocks()` creates empty container `{}`  
  - Line 54: Empty container mock `{ success: true, payload: {} }`
  - Lines 76-212: All four failing tests in this suite

- `tests/unit/main/main.factoryCoverage.test.js`
  - Lines 144-177: Container mock needs `resolve()` method
  - Lines 199, 255, 275: Related failures

- `tests/unit/main/main.errorFallbackPhases.test.js`
  - Lines 15-35: Mock stage definitions missing handler validation
  - Lines 206-251: Phase detection test fails

