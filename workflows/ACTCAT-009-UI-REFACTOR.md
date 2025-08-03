# ACTCAT-009: UI Renderer Refactoring to Use Shared Service

## Overview

Refactor `actionButtonsRenderer.js` to use the shared `ActionCategorizationService` instead of its internal categorization methods. This eliminates code duplication while maintaining identical UI behavior and preserving all existing functionality.

## Priority

**HIGH** - Critical for code deduplication and architectural consistency

## Dependencies

- **Blocks**: ACTCAT-001 (ActionCategorizationService)
- **Blocks**: ACTCAT-004 (Dependency injection integration)
- **Enables**: ACTCAT-010 (Regression testing)

## Acceptance Criteria

- [ ] All private categorization methods replaced with service calls
- [ ] Identical behavior to current implementation
- [ ] No changes to public API
- [ ] All existing tests continue to pass without modification
- [ ] No performance degradation
- [ ] Service properly injected through dependency injection
- [ ] Error handling maintains current resilience
- [ ] Configuration consistency with LLM component

## Implementation Steps

### Step 1: Analyze Current Implementation

**File to examine**: `src/domUI/actionButtonsRenderer.js`

Current private methods to replace:

- `#extractNamespace(actionId)` (lines ~207-220)
- `#shouldUseGrouping(actions)` (lines ~225-240)
- `#groupActionsByNamespace(actions)` (lines ~245-270)
- `#getSortedNamespaces(namespaces)` (lines ~275-284)

Current configuration constants to align with service:

- Grouping thresholds
- Namespace order
- Display formatting

### Step 2: Add Service Dependency to Constructor

**File**: `src/domUI/actionButtonsRenderer.js` (modify constructor)

```javascript
// Add import
import { IActionCategorizationService } from '../dependencyInjection/tokens.js';

// Update constructor signature
constructor({
  logger,
  documentContext,
  validatedEventDispatcher,
  domElementFactory,
  actionButtonsContainerSelector,
  sendButtonSelector = '#player-confirm-turn-button',
  speechInputSelector = '#speech-input',
  actionCategorizationService // Add this parameter
}) {
  // Existing validation for actionButtonsContainerSelector
  if (
    !actionButtonsContainerSelector ||
    typeof actionButtonsContainerSelector !== 'string' ||
    actionButtonsContainerSelector.trim() === ''
  ) {
    const errMsg = `[ActionButtonsRenderer] 'actionButtonsContainerSelector' is required and must be a non-empty string.`;
    (logger || console).error(errMsg);
    throw new Error(errMsg);
  }

  // Existing elementsConfig setup
  const elementsConfig = {
    listContainerElement: {
      selector: actionButtonsContainerSelector,
      required: true,
    },
    sendButtonElement: {
      selector: sendButtonSelector,
      required: false,
      expectedType: HTMLButtonElement,
    },
    speechInputElement: {
      selector: speechInputSelector,
      required: false,
      expectedType: HTMLInputElement,
    },
  };

  super({
    datasetKey: DATASET_ACTION_INDEX,
    logger,
    documentContext,
    validatedEventDispatcher,
    elementsConfig,
    domElementFactory,
  });

  // Add validation for the new service
  validateDependency(actionCategorizationService, 'IActionCategorizationService', null, {
    requiredMethods: ['extractNamespace', 'shouldUseGrouping', 'groupActionsByNamespace', 'getSortedNamespaces', 'formatNamespaceDisplayName']
  });

  this.#actionCategorizationService = actionCategorizationService;

  // ... rest of existing constructor logic remains unchanged
}
```

### Step 3: Create Configuration Method

**File**: `src/domUI/actionButtonsRenderer.js` (add private method)

```javascript
/**
 * Get categorization configuration for UI rendering
 * @private
 * @returns {CategorizationConfig} Configuration optimized for UI use
 */
#getUICategorizationConfig() {
  return {
    enabled: true,
    minActionsForGrouping: 6,
    minNamespacesForGrouping: 2,
    namespaceOrder: ['core', 'intimacy', 'sex', 'anatomy', 'clothing'],
    showCounts: true, // UI shows counts unlike LLM
    performance: {
      enableCaching: true,
      performanceLogging: false,
      slowOperationThresholdMs: 10
    },
    errorHandling: {
      logLevel: 'warn',
      fallbackBehavior: 'flatten',
      maxRetries: 1
    }
  };
}
```

### Step 4: Replace Private Methods with Service Calls

**File**: `src/domUI/actionButtonsRenderer.js` (replace existing methods)

#### Replace extractNamespace method

```javascript
// REMOVE the existing #extractNamespace method entirely
// Replace calls to this.#extractNamespace(actionId) with:
// this.#actionCategorizationService.extractNamespace(actionId)
```

#### Replace shouldUseGrouping method

```javascript
// REMOVE the existing #shouldUseGrouping method entirely
// Replace calls to this.#shouldUseGrouping(actions) with:
// this.#actionCategorizationService.shouldUseGrouping(actions, this.#getUICategorizationConfig())
```

#### Replace groupActionsByNamespace method

```javascript
// REMOVE the existing #groupActionsByNamespace method entirely
// Replace calls to this.#groupActionsByNamespace(actions) with:
// this.#actionCategorizationService.groupActionsByNamespace(actions, this.#getUICategorizationConfig())
```

#### Replace getSortedNamespaces method

```javascript
// REMOVE the existing #getSortedNamespaces method entirely
// Replace calls to this.#getSortedNamespaces(namespaces) with:
// this.#actionCategorizationService.getSortedNamespaces(namespaces, this.#getUICategorizationConfig())
```

### Step 5: Update Method That Uses Categorization

**File**: `src/domUI/actionButtonsRenderer.js` (modify existing method)

Find the method that currently calls the private categorization methods (likely in the render method) and update it:

```javascript
// Example of how to update the render method (exact location depends on current implementation)
_renderActionButtons(actions) {
  try {
    const config = this.#getUICategorizationConfig();

    if (this.#actionCategorizationService.shouldUseGrouping(actions, config)) {
      this.#logger.debug('ActionButtonsRenderer: Using grouped rendering');
      return this.#renderGroupedActions(actions, config);
    } else {
      this.#logger.debug('ActionButtonsRenderer: Using flat rendering');
      return this.#renderFlatActions(actions);
    }
  } catch (error) {
    this.#logger.error('ActionButtonsRenderer: Error in action rendering, falling back to flat format', {
      error: error.message,
      actionCount: actions.length
    });

    // Fallback to flat rendering
    return this.#renderFlatActions(actions);
  }
}

#renderGroupedActions(actions, config) {
  const grouped = this.#actionCategorizationService.groupActionsByNamespace(actions, config);
  const sortedNamespaces = this.#actionCategorizationService.getSortedNamespaces([...grouped.keys()], config);

  // ... rest of existing grouped rendering logic
  // Just replace the internal method calls with service calls
}
```

### Step 6: Update Error Handling

**File**: `src/domUI/actionButtonsRenderer.js` (enhance error handling)

```javascript
/**
 * Handle categorization service errors gracefully
 * @private
 */
#handleCategorizationError(error, actions, operation) {
  this.#logger.error(`ActionButtonsRenderer: Categorization service error in ${operation}`, {
    error: error.message,
    actionCount: actions?.length || 0,
    operation
  });

  // For critical operations, fall back to flat rendering
  if (operation === 'shouldUseGrouping' || operation === 'groupActionsByNamespace') {
    this.#logger.warn('ActionButtonsRenderer: Falling back to flat rendering due to service error');
    return false; // or appropriate fallback value
  }

  // For non-critical operations, return safe defaults
  return operation === 'extractNamespace' ? 'unknown' : [];
}
```

### Step 7: Update DI Registration

**File**: `src/dependencyInjection/uiRegistrations.js` (modify existing)

```javascript
// Update the ActionButtonsRenderer registration to include the new dependency
container.register({
  token: 'ActionButtonsRenderer', // or appropriate token
  factory: (c) =>
    new ActionButtonsRenderer({
      logger: c.resolve(ILogger),
      documentContext: c.resolve(IDocumentContext),
      validatedEventDispatcher: c.resolve(IValidatedEventDispatcher),
      domElementFactory: c.resolve('DomElementFactory'),
      actionButtonsContainerSelector: '#actions-container', // or from config
      actionCategorizationService: c.resolve(IActionCategorizationService), // Add this line
    }),
  lifetime: 'singleton',
});
```

### Step 8: Create Backward Compatibility Tests

**File**: `tests/unit/domUI/actionButtonsRenderer.compatibility.test.js`

```javascript
/**
 * @file ActionButtonsRenderer Backward Compatibility Tests
 * Ensures refactoring maintains identical behavior
 */

import { describe, it, expect, beforeEach, afterEach } from '@jest/globals';
import ActionButtonsRenderer from '../../../src/domUI/actionButtonsRenderer.js';
import { createTestContainerWithActionCategorization } from '../../../src/dependencyInjection/actionCategorizationRegistrations.js';

describe('ActionButtonsRenderer Backward Compatibility', () => {
  let container;
  let renderer;
  let mockLogger;
  let mockDocumentContext;
  let mockEventDispatcher;
  let mockDomElementFactory;

  beforeEach(() => {
    mockLogger = {
      info: jest.fn(),
      warn: jest.fn(),
      error: jest.fn(),
      debug: jest.fn(),
    };

    mockDocumentContext = {
      getElementById: jest.fn(),
      querySelector: jest.fn(),
      querySelectorAll: jest.fn(),
    };

    mockEventDispatcher = {
      dispatch: jest.fn(),
      subscribe: jest.fn(),
    };

    mockDomElementFactory = {
      createElement: jest.fn(),
      createButton: jest.fn(),
    };

    // Set up DOM environment
    document.body.innerHTML = '<div id="actions-container"></div>';

    container = createTestContainerWithActionCategorization({
      logger: mockLogger,
    });

    renderer = new ActionButtonsRenderer({
      logger: mockLogger,
      documentContext: mockDocumentContext,
      validatedEventDispatcher: mockEventDispatcher,
      domElementFactory: mockDomElementFactory,
      actionButtonsContainerSelector: '#actions-container',
      actionCategorizationService: container.resolve(
        'IActionCategorizationService'
      ),
    });
  });

  afterEach(() => {
    document.body.innerHTML = '';
    if (container && container.dispose) {
      container.dispose();
    }
    jest.clearAllMocks();
  });

  describe('Namespace Extraction Compatibility', () => {
    it('should extract namespaces identically to original implementation', () => {
      const testCases = [
        { input: 'core:wait', expected: 'core' },
        { input: 'intimacy:kiss', expected: 'intimacy' },
        { input: 'clothing:remove_shirt', expected: 'clothing' },
        { input: 'no_colon_action', expected: 'unknown' },
        { input: 'none', expected: 'none' },
        { input: 'self', expected: 'self' },
        { input: '', expected: 'unknown' },
        { input: null, expected: 'unknown' },
        { input: undefined, expected: 'unknown' },
      ];

      const service = container.resolve('IActionCategorizationService');

      for (const { input, expected } of testCases) {
        const result = service.extractNamespace(input);
        expect(result).toBe(expected);
      }
    });
  });

  describe('Grouping Decision Compatibility', () => {
    it('should make grouping decisions identically to original', () => {
      const service = container.resolve('IActionCategorizationService');
      const config = {
        enabled: true,
        minActionsForGrouping: 6,
        minNamespacesForGrouping: 2,
        namespaceOrder: ['core', 'intimacy', 'clothing'],
        showCounts: true,
      };

      // Test case: sufficient actions and namespaces
      const sufficientActions = [
        { actionId: 'core:wait' },
        { actionId: 'core:go' },
        { actionId: 'intimacy:kiss' },
        { actionId: 'intimacy:hug' },
        { actionId: 'clothing:remove' },
        { actionId: 'clothing:wear' },
      ];

      expect(service.shouldUseGrouping(sufficientActions, config)).toBe(true);

      // Test case: insufficient actions
      const insufficientActions = [
        { actionId: 'core:wait' },
        { actionId: 'intimacy:kiss' },
      ];

      expect(service.shouldUseGrouping(insufficientActions, config)).toBe(
        false
      );

      // Test case: insufficient namespaces
      const singleNamespaceActions = [
        { actionId: 'core:wait' },
        { actionId: 'core:go' },
        { actionId: 'core:examine' },
        { actionId: 'core:speak' },
        { actionId: 'core:follow' },
        { actionId: 'core:rest' },
      ];

      expect(service.shouldUseGrouping(singleNamespaceActions, config)).toBe(
        false
      );
    });
  });

  describe('Grouping Behavior Compatibility', () => {
    it('should group actions identically to original implementation', () => {
      const service = container.resolve('IActionCategorizationService');
      const config = {
        enabled: true,
        minActionsForGrouping: 6,
        minNamespacesForGrouping: 2,
        namespaceOrder: ['core', 'intimacy', 'clothing'],
        showCounts: true,
      };

      const actions = [
        { index: 1, actionId: 'clothing:remove' },
        { index: 2, actionId: 'core:wait' },
        { index: 3, actionId: 'intimacy:kiss' },
        { index: 4, actionId: 'core:go' },
        { index: 5, actionId: 'clothing:wear' },
        { index: 6, actionId: 'intimacy:hug' },
      ];

      const grouped = service.groupActionsByNamespace(actions, config);

      // Verify grouping structure
      expect(grouped.size).toBe(3);
      expect(grouped.has('core')).toBe(true);
      expect(grouped.has('intimacy')).toBe(true);
      expect(grouped.has('clothing')).toBe(true);

      // Verify group contents
      expect(grouped.get('core')).toHaveLength(2);
      expect(grouped.get('intimacy')).toHaveLength(2);
      expect(grouped.get('clothing')).toHaveLength(2);

      // Verify action preservation
      expect(grouped.get('core')[0].index).toBe(2); // First core action
      expect(grouped.get('core')[1].index).toBe(4); // Second core action
      expect(grouped.get('intimacy')[0].index).toBe(3);
      expect(grouped.get('clothing')[0].index).toBe(1);
    });

    it('should maintain namespace order identically to original', () => {
      const service = container.resolve('IActionCategorizationService');
      const config = {
        namespaceOrder: ['core', 'intimacy', 'clothing', 'anatomy'],
      };

      const namespaces = [
        'anatomy',
        'unknown',
        'core',
        'zebra',
        'intimacy',
        'clothing',
        'alpha',
      ];
      const sorted = service.getSortedNamespaces(namespaces, config);

      // Priority order first: core, intimacy, clothing, anatomy
      // Then alphabetical: alpha, unknown, zebra
      expect(sorted).toEqual([
        'core',
        'intimacy',
        'clothing',
        'anatomy',
        'alpha',
        'unknown',
        'zebra',
      ]);
    });
  });

  describe('Error Handling Compatibility', () => {
    it('should handle errors gracefully like original implementation', () => {
      const service = container.resolve('IActionCategorizationService');

      // Should not throw for invalid inputs
      expect(() => service.extractNamespace(null)).not.toThrow();
      expect(() => service.shouldUseGrouping(null)).not.toThrow();
      expect(() => service.groupActionsByNamespace(null)).not.toThrow();
      expect(() => service.getSortedNamespaces(null)).not.toThrow();

      // Should return appropriate fallback values
      expect(service.extractNamespace(null)).toBe('unknown');
      expect(service.shouldUseGrouping(null)).toBe(false);
      expect(service.groupActionsByNamespace(null)).toEqual(new Map());
      expect(service.getSortedNamespaces(null)).toEqual([]);
    });
  });

  describe('Performance Compatibility', () => {
    it('should maintain performance characteristics', () => {
      const service = container.resolve('IActionCategorizationService');
      const config = {
        enabled: true,
        minActionsForGrouping: 6,
        minNamespacesForGrouping: 2,
        namespaceOrder: ['core', 'intimacy', 'clothing'],
        showCounts: true,
      };

      // Create large action set
      const actions = Array.from({ length: 100 }, (_, i) => ({
        index: i + 1,
        actionId: `namespace${i % 10}:action${i}`,
        commandString: `command ${i}`,
        description: `Description ${i}`,
      }));

      const startTime = performance.now();

      const shouldGroup = service.shouldUseGrouping(actions, config);
      if (shouldGroup) {
        const grouped = service.groupActionsByNamespace(actions, config);
        const namespaces = [...grouped.keys()];
        service.getSortedNamespaces(namespaces, config);
      }

      const endTime = performance.now();

      // Should complete in reasonable time (same as original)
      expect(endTime - startTime).toBeLessThan(20); // 20ms threshold
    });
  });

  describe('Integration with Existing Methods', () => {
    it('should integrate seamlessly with existing renderer methods', () => {
      // This test would verify that the refactored renderer still works
      // with existing UI methods and event handling

      const actions = [
        {
          index: 1,
          actionId: 'core:wait',
          commandString: 'wait',
          description: 'Wait',
        },
        {
          index: 2,
          actionId: 'intimacy:kiss',
          commandString: 'kiss',
          description: 'Kiss',
        },
      ];

      // Test that rendering methods still work (mock the actual rendering)
      expect(() => {
        // This would call the actual render method
        // renderer.renderActions(actions);
      }).not.toThrow();
    });
  });
});
```

### Step 9: Performance Validation

**File**: `tests/performance/actionButtonsRenderer.performance.test.js`

```javascript
/**
 * @file ActionButtonsRenderer Performance Tests
 * Validates no performance regression after refactoring
 */

import { describe, it, expect, beforeEach } from '@jest/globals';
import ActionButtonsRenderer from '../../../src/domUI/actionButtonsRenderer.js';
import { createTestContainerWithActionCategorization } from '../../../src/dependencyInjection/actionCategorizationRegistrations.js';

describe('ActionButtonsRenderer Performance Validation', () => {
  let container;
  let renderer;

  beforeEach(() => {
    container = createTestContainerWithActionCategorization();

    // Set up minimal DOM
    document.body.innerHTML = '<div id="actions-container"></div>';

    renderer = new ActionButtonsRenderer({
      logger: {
        info: jest.fn(),
        warn: jest.fn(),
        error: jest.fn(),
        debug: jest.fn(),
      },
      documentContext: document,
      validatedEventDispatcher: { dispatch: jest.fn(), subscribe: jest.fn() },
      domElementFactory: { createElement: jest.fn(), createButton: jest.fn() },
      actionButtonsContainerSelector: '#actions-container',
      actionCategorizationService: container.resolve(
        'IActionCategorizationService'
      ),
    });
  });

  afterEach(() => {
    document.body.innerHTML = '';
    if (container && container.dispose) {
      container.dispose();
    }
  });

  it('should maintain performance for large action sets', () => {
    const actions = Array.from({ length: 50 }, (_, i) => ({
      index: i + 1,
      actionId: `namespace${i % 8}:action${i}`,
      commandString: `command ${i}`,
      description: `Description for action ${i}`,
    }));

    const iterations = 10;
    const times = [];

    for (let i = 0; i < iterations; i++) {
      const startTime = performance.now();

      // Test the categorization logic (would be called during rendering)
      const service = container.resolve('IActionCategorizationService');
      const config = {
        enabled: true,
        minActionsForGrouping: 6,
        minNamespacesForGrouping: 2,
        namespaceOrder: ['core', 'intimacy', 'clothing'],
        showCounts: true,
      };

      if (service.shouldUseGrouping(actions, config)) {
        service.groupActionsByNamespace(actions, config);
      }

      const endTime = performance.now();
      times.push(endTime - startTime);
    }

    const avgTime = times.reduce((sum, time) => sum + time, 0) / times.length;
    const maxTime = Math.max(...times);

    expect(avgTime).toBeLessThan(10); // 10ms average
    expect(maxTime).toBeLessThan(20); // 20ms maximum
  });

  it('should not degrade memory usage', () => {
    const actions = Array.from({ length: 100 }, (_, i) => ({
      index: i + 1,
      actionId: `test:action${i}`,
      commandString: `command ${i}`,
      description: `Description ${i}`,
    }));

    const service = container.resolve('IActionCategorizationService');

    // Force garbage collection if available
    if (global.gc) {
      global.gc();
    }

    const initialMemory = process.memoryUsage().heapUsed;

    // Perform many operations
    for (let i = 0; i < 100; i++) {
      service.shouldUseGrouping(actions);
      service.groupActionsByNamespace(actions);
    }

    if (global.gc) {
      global.gc();
    }

    const finalMemory = process.memoryUsage().heapUsed;
    const memoryIncrease = finalMemory - initialMemory;

    // Memory increase should be minimal (less than 1MB)
    expect(memoryIncrease).toBeLessThan(1024 * 1024);
  });
});
```

## Quality Gates

### Functionality Preservation

- [ ] All existing tests pass without modification
- [ ] Identical UI behavior in all scenarios
- [ ] Same performance characteristics
- [ ] Error handling maintains current resilience
- [ ] No breaking changes to public API

### Code Quality

- [ ] All private categorization methods removed
- [ ] Service integration follows project patterns
- [ ] Proper dependency injection usage
- [ ] Consistent error handling and logging
- [ ] Configuration aligns with LLM component

### Integration Quality

- [ ] Service resolves correctly from DI container
- [ ] Error fallback behavior works correctly
- [ ] Memory usage remains stable
- [ ] Performance targets maintained

## Performance Targets

- [ ] No performance regression (±5% tolerance)
- [ ] Service call overhead <1ms
- [ ] Memory usage increase <100KB
- [ ] UI responsiveness maintained

## Files Created

- [ ] `tests/unit/domUI/actionButtonsRenderer.compatibility.test.js`
- [ ] `tests/performance/actionButtonsRenderer.performance.test.js`

## Files Modified

- [ ] `src/domUI/actionButtonsRenderer.js`
- [ ] `src/dependencyInjection/uiRegistrations.js`

## Dependencies

- **Completes**: ACTCAT-001, ACTCAT-004
- **Enables**: ACTCAT-010

## Definition of Done

- [ ] All acceptance criteria met
- [ ] Private methods replaced with service calls
- [ ] All existing tests pass
- [ ] Performance validation complete
- [ ] No regression in UI behavior
- [ ] Service integration working correctly
- [ ] Error handling maintains resilience
- [ ] Code review approved
