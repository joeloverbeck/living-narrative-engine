# Character Builder Controller Test Guide

## Overview

This guide documents the comprehensive integration and E2E test suites for the Character Builder controllers, implemented as part of BASCHACUICONREF-012. These tests validate the 2,200+ line `BaseCharacterBuilderController` and its derived controllers through their interactions with real services like `DOMElementManager`, `EventListenerRegistry`, `ControllerLifecycleOrchestrator`, `AsyncUtilitiesToolkit`, `ValidationService`, and the UI state manager.

## Test Organization

### Integration Tests

Integration tests are located in `tests/integration/characterBuilder/controllers/` and focus on controller-service interactions, lifecycle management, and UI state coordination.

#### BaseCharacterBuilderController Integration Tests

| Test Suite | File | Purpose |
|------------|------|---------|
| **DI Registration** | `BaseCharacterBuilderController.di.integration.test.js` | Tests dependency injection registration and service resolution |
| **DOM Caching** | `BaseCharacterBuilderController.domCaching.integration.test.js` | Tests DOM element caching map, cache invalidation, and memory management |
| **Lifecycle** | `BaseCharacterBuilderController.lifecycle.integration.test.js` | Tests lifecycle orchestration, initialize/reinitialize/destroy flows, phase transitions |
| **Async Utilities** | `BaseCharacterBuilderController.asyncUtilities.integration.test.js` | Tests debounce, throttle, timeout management, async toolkit registration/cleanup |
| **Validation** | `BaseCharacterBuilderController.validation.integration.test.js` | Tests schema validation, error propagation, ValidationService integration |
| **Utilities** | `BaseCharacterBuilderController.utilities.integration.test.js` | Tests utility helpers, performance monitoring, memory management |
| **Error Handling** | `BaseCharacterBuilderController.errorHandling.integration.test.js` | Tests error recovery, error handling strategy integration |
| **Recovery** | `BaseCharacterBuilderController.recovery.integration.test.js` | Tests error recovery workflows and resilience patterns |

#### Controller-Specific Integration Tests

| Controller | Test Suite | File | Focus Areas |
|------------|------------|------|-------------|
| **TraitsGenerator** | UI State & DOM | `TraitsGeneratorController.uiState.integration.test.js` | UI state transitions, DOM caching, event-driven workflows |
| **TraitsGenerator** | Main Integration | `traitsGeneratorController.integration.test.js` | Service layer integration, event flows |
| **TraitsGenerator** | Additional Flows | `traitsGeneratorController.additionalFlows.integration.test.js` | Edge cases, complex workflows |
| **TraitsGenerator** | Error States | `traitsGeneratorController.errorStates.integration.test.js` | Error handling, recovery scenarios |
| **SpeechPatternsGenerator** | Lifecycle | `SpeechPatternsGeneratorController.lifecycle.integration.test.js` | Lifecycle management, DOM caching, event listeners, cleanup |
| **TraitsRewriter** | Main Integration | `TraitsRewriterController.integration.test.js` | Rewriter-specific workflows |

### E2E Tests

E2E tests are located in `tests/e2e/` and `tests/e2e/characterBuilder/`, validating complete user journeys using the Jest-based harness (jsdom, not Playwright/Puppeteer).

| Test Suite | File | Purpose |
|------------|------|---------|
| **Controller Workflows** | `characterBuilder/characterBuilderControllers.e2e.test.js` | Complete user journeys, UI state transitions, event flows, service integration |
| **Traits Generator** | `traitsGenerator.e2e.test.js` | Traits generation user workflow |
| **User Workflow** | `traitsGeneratorUserWorkflow.e2e.test.js` | Step-by-step user interaction validation |
| **Accessibility** | `traitsGeneratorAccessibility.e2e.test.js` | WCAG compliance, keyboard navigation |
| **Error Handling** | `traitsGeneratorErrorHandling.e2e.test.js` | Error recovery user experience |
| **Export** | `traitsGeneratorExport.e2e.test.js` | Export functionality validation |

## Test Commands

### Running Integration Tests

```bash
# Run all character builder integration tests
npm run test:integration -- tests/integration/characterBuilder/

# Run BaseCharacterBuilderController integration tests
npm run test:integration -- tests/integration/characterBuilder/controllers/

# Run specific controller integration tests
npm run test:integration -- tests/integration/characterBuilder/controllers/BaseCharacterBuilderController.domCaching.integration.test.js
npm run test:integration -- tests/integration/characterBuilder/controllers/BaseCharacterBuilderController.lifecycle.integration.test.js
npm run test:integration -- tests/integration/characterBuilder/controllers/BaseCharacterBuilderController.asyncUtilities.integration.test.js
npm run test:integration -- tests/integration/characterBuilder/controllers/BaseCharacterBuilderController.validation.integration.test.js

# Run controller-specific integration tests
npm run test:integration -- tests/integration/characterBuilder/controllers/TraitsGeneratorController.uiState.integration.test.js
npm run test:integration -- tests/integration/characterBuilder/controllers/SpeechPatternsGeneratorController.lifecycle.integration.test.js

# Run all existing controller integration tests
npm run test:integration -- tests/integration/characterBuilder/traitsGeneratorController.integration.test.js
npm run test:integration -- tests/integration/characterBuilder/traitsGeneratorController.additionalFlows.integration.test.js
npm run test:integration -- tests/integration/characterBuilder/traitsGeneratorController.errorStates.integration.test.js
```

### Running E2E Tests

```bash
# Run all character builder E2E tests
npm run test:e2e -- tests/e2e/characterBuilder/

# Run controller workflow E2E tests
npm run test:e2e -- tests/e2e/characterBuilder/characterBuilderControllers.e2e.test.js

# Run traits generator E2E tests
npm run test:e2e -- tests/e2e/traitsGenerator.e2e.test.js
npm run test:e2e -- tests/e2e/traitsGeneratorUserWorkflow.e2e.test.js
npm run test:e2e -- tests/e2e/traitsGeneratorAccessibility.e2e.test.js
npm run test:e2e -- tests/e2e/traitsGeneratorErrorHandling.e2e.test.js
npm run test:e2e -- tests/e2e/traitsGeneratorExport.e2e.test.js
```

### Running All Tests (CI)

```bash
# Run complete test suite (includes integration and E2E)
npm run test:ci
```

## Coverage Mapping

This table maps each controller responsibility to the test suites that cover it:

| Responsibility | Integration Tests | E2E Tests | Notes |
|----------------|-------------------|-----------|-------|
| **DOM Element Caching** | `BaseCharacterBuilderController.domCaching.integration.test.js` | `characterBuilderControllers.e2e.test.js` | Cache map, invalidation, performance |
| **Lifecycle Orchestration** | `BaseCharacterBuilderController.lifecycle.integration.test.js` | `characterBuilderControllers.e2e.test.js` | Init/reinit/destroy phases |
| **Async Utilities** | `BaseCharacterBuilderController.asyncUtilities.integration.test.js` | - | Debounce, throttle, timeout management |
| **Validation** | `BaseCharacterBuilderController.validation.integration.test.js` | `traitsGeneratorUserWorkflow.e2e.test.js` | Schema validation, error propagation |
| **Error Recovery** | `BaseCharacterBuilderController.errorHandling.integration.test.js`, `BaseCharacterBuilderController.recovery.integration.test.js` | `traitsGeneratorErrorHandling.e2e.test.js`, `characterBuilderControllers.e2e.test.js` | Error handling strategy, recovery workflows |
| **UI State Management** | `TraitsGeneratorController.uiState.integration.test.js` | `characterBuilderControllers.e2e.test.js`, `traitsGeneratorUserWorkflow.e2e.test.js` | State transitions, UIStateManager integration |
| **Event Listener Management** | `SpeechPatternsGeneratorController.lifecycle.integration.test.js`, `BaseCharacterBuilderController.utilities.integration.test.js` | `characterBuilderControllers.e2e.test.js` | Registration, cleanup, EventListenerRegistry |
| **Performance Monitoring** | `BaseCharacterBuilderController.utilities.integration.test.js` | - | PerformanceMonitor integration, markers |
| **Memory Management** | `BaseCharacterBuilderController.domCaching.integration.test.js`, `BaseCharacterBuilderController.utilities.integration.test.js` | - | Weak references, cleanup, leak prevention |
| **DOMElementManager Integration** | `BaseCharacterBuilderController.domCaching.integration.test.js` | `characterBuilderControllers.e2e.test.js` | Element queries, caching coordination |
| **Service Composition** | `BaseCharacterBuilderController.di.integration.test.js` | - | DI container, service resolution |

## Test Patterns and Best Practices

### Using BaseCharacterBuilderControllerIntegrationTestBase

The test base helper provides common setup and utilities for controller integration tests:

```javascript
import { BaseCharacterBuilderControllerIntegrationTestBase } from './BaseCharacterBuilderController.integration.testbase.js';

let testBase;
let controller;

beforeEach(async () => {
  testBase = new BaseCharacterBuilderControllerIntegrationTestBase();
  await testBase.setup({
    includeFullDOM: true,          // Setup complete DOM structure
    mockGlobalFunctions: true,      // Mock setTimeout, fetch, etc.
    additionalMocks: ['localStorage'], // Optional mocks
  });

  controller = new TestController(testBase.getDependencies());
});

afterEach(async () => {
  if (controller && typeof controller.destroy === 'function') {
    await controller.destroy();
  }
  await testBase.cleanup();
});
```

### Testing UI State Transitions

```javascript
// Verify state transition
testBed.uiState.currentState = UI_STATES.LOADING;
testBed.uiElements.loadingState.hidden = false;
testBed.uiElements.emptyState.hidden = true;

expect(testBed.uiState.currentState).toBe(UI_STATES.LOADING);
expect(testBed.getLoadingIndicator().hidden).toBe(false);
```

### Testing DOM Caching

```javascript
// Test element caching
const element = controller.cacheElement('results-state', '#results-state');
expect(element).toBeTruthy();
expect(controller.hasCachedElement('results-state')).toBe(true);

// Test cache reuse
const cachedElement = controller.getCachedElement('results-state');
expect(cachedElement).toBe(element);
```

### Testing Lifecycle Phases

```javascript
// Test initialization
await controller.initialize();
expect(controller.isInitialized()).toBe(true);

// Test reinitialization
await controller.reinitialize();
expect(controller.isInitialized()).toBe(true);

// Test destruction
await controller.destroy();
expect(controller.isDestroyed()).toBe(true);
```

### Testing Async Utilities

```javascript
// Test debounce
const mockFn = jest.fn();
const debounced = controller.createDebounced(mockFn, 100);

debounced();
expect(mockFn).not.toHaveBeenCalled();

jest.advanceTimersByTime(100);
expect(mockFn).toHaveBeenCalledTimes(1);
```

## Failure Debugging

### Common Issues and Solutions

#### 1. "Element not found" errors

**Symptom**: Tests fail with "Required element not found: #element-id"

**Solution**: 
- Verify DOM structure in test setup includes the required element
- Check element ID matches exactly (case-sensitive)
- Use `includeFullDOM: true` in testBase.setup()

#### 2. Event listener cleanup warnings

**Symptom**: Memory leak warnings or "removeEventListener called on null"

**Solution**:
- Ensure `controller.destroy()` is called in `afterEach`
- Verify EventListenerRegistry is properly initialized
- Check that listeners are registered through the registry

#### 3. Async timing issues

**Symptom**: Tests intermittently fail with "Expected X but received Y"

**Solution**:
- Use `jest.useFakeTimers()` and `jest.advanceTimersByTime()`
- Await async operations with proper error handling
- Verify mock async functions return promises

#### 4. Cache invalidation not working

**Symptom**: Cached elements not cleared after destroy

**Solution**:
- Call `controller.clearElementCache()` in destroy
- Verify cache cleanup in `afterEach` hook
- Check that cache references are actually cleared (null)

## Migration Context

These tests provide baseline confidence in the existing controller/services composition before the refactor described in the BASCHACUICONREF migration initiative. They ensure:

1. **Current Functionality Preserved**: All existing workflows continue to function correctly
2. **Service Integration Validated**: Real service interactions are tested, not just mocked
3. **Memory Safety Confirmed**: Proper cleanup prevents memory leaks
4. **Performance Baseline Established**: Performance characteristics are documented
5. **Refactoring Safety Net**: Tests will catch regressions during future refactoring

## Related Documentation

- [Character Builder Architecture](../architecture/character-builder.md)
- [Testing Strategy](./testing-strategy.md)
- [Mod Testing Guide](./mod-testing-guide.md)
- [BaseCharacterBuilderController Specification](../../specs/base-character-builder-controller.spec.md)

## Maintenance

### Adding New Test Scenarios

When adding new controller responsibilities or service integrations:

1. Add integration tests in `tests/integration/characterBuilder/controllers/`
2. Add E2E coverage in `tests/e2e/characterBuilder/`
3. Update this documentation with new test commands
4. Update the coverage mapping table
5. Run full test suite to verify no regressions

### Keeping Tests Green

- Run integration tests after any controller changes: `npm run test:integration -- tests/integration/characterBuilder/`
- Run E2E tests before major releases: `npm run test:e2e`
- Address failures immediately - don't accumulate technical debt
- Update tests when refactoring - keep tests aligned with code

## Notes

- All tests use Jest with jsdom (not Playwright/Puppeteer)
- Tests are designed to be fast and deterministic
- Mocked services prevent external dependencies
- CI runs complete test suite automatically
- Tests document expected behavior for future refactoring
