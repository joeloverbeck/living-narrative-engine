# THEDIRMIG-012: Update Test Infrastructure for Base Controller

## Overview

Update all test files for ThematicDirectionsManagerController to use the BaseCharacterBuilderControllerTestBase infrastructure. This ensures consistent testing patterns across all character builder controllers and leverages shared test utilities.

## Priority

**HIGH** - Required for validation

## Dependencies

- **Blocked by**: THEDIRMIG-011 (complete implementation)
- **Enables**: THEDIRMIG-013 (warning tests)
- **Related**: All previous implementation tickets

## Acceptance Criteria

- [ ] All 5 test files updated to use BaseCharacterBuilderControllerTestBase
- [ ] DOM setup uses test base helpers
- [ ] Mock creation uses test base patterns
- [ ] Lifecycle testing follows base patterns
- [ ] Coverage maintained or improved
- [ ] No test regressions
- [ ] New tests for migrated functionality
- [ ] Tests are more maintainable

## Current Test Files

Based on the current codebase, there are 5 existing test files to consolidate and update:

1. `tests/unit/thematicDirectionsManager/controllers/thematicDirectionsManagerController.abstractMethods.test.js`
2. `tests/unit/thematicDirectionsManager/controllers/thematicDirectionsManagerController.conceptDisplay.test.js`
3. `tests/unit/thematicDirectionsManager/controllers/thematicDirectionsManagerController.stateManagement.test.js`
4. `tests/unit/thematicDirectionsManager/controllers/thematicDirectionsManagerController.modalManagement.test.js`
5. `tests/unit/thematicDirectionsManager/controllers/thematicDirectionsManagerController.resourceCleanup.test.js`

## Implementation Steps

### Step 1: Enhance BaseCharacterBuilderControllerTestBase (if needed)

First, verify the test base has UIStateManager support and enhance if necessary:

**Location**: `tests/unit/characterBuilder/controllers/BaseCharacterBuilderController.testbase.js`

The test base already includes UIStateManager support. Verify it provides:

- `setup()` - Initialize test environment
- `cleanup()` - Clean up after tests
- `createController()` - Factory for controller instances
- `addDOMElement()` - Add DOM elements for testing
- `mocks` - Pre-configured mock objects including UIStateManager
- UIStateManager DOM setup for state management testing

### Step 2: Consolidate Existing Test Files

Consolidate the 5 existing test files into a single comprehensive test file:

**Target File**: `tests/unit/thematicDirectionsManager/controllers/thematicDirectionsManagerController.test.js`

```javascript
/**
 * @file Unit tests for ThematicDirectionsManagerController
 */

import {
  describe,
  it,
  expect,
  beforeEach,
  afterEach,
  jest,
} from '@jest/globals';
import { BaseCharacterBuilderControllerTestBase } from '../../../characterBuilder/controllers/BaseCharacterBuilderController.testbase.js';
import { ThematicDirectionsManagerController } from '../../../../src/thematicDirectionsManager/controllers/thematicDirectionsManagerController.js';
import { UI_STATES } from '../../../../src/shared/characterBuilder/uiStateManager.js';

describe('ThematicDirectionsManagerController', () => {
  let testBase;
  let controller;

  beforeEach(async () => {
    // Initialize test base
    testBase = new BaseCharacterBuilderControllerTestBase();
    await testBase.setup();

    // Add thematic directions specific DOM
    testBase.addDOMElement(`
      <div id="directions-container">
        <div id="empty-state" class="cb-empty-state">
          <p class="empty-message">No thematic directions found</p>
          <button id="refresh-btn">Refresh</button>
        </div>
        
        <div id="loading-state" class="cb-loading-state" style="display: none">
          <div class="spinner"></div>
          <p>Loading directions...</p>
        </div>
        
        <div id="error-state" class="cb-error-state" style="display: none">
          <p class="error-message" id="error-message-text"></p>
          <button id="retry-btn">Try Again</button>
        </div>
        
        <div id="results-state" class="cb-state-container" style="display: none">
          <div id="directions-list"></div>
        </div>
      </div>
      
      <div id="directions-results"></div>
      
      <!-- Filters -->
      <select id="concept-filter"></select>
      <input id="direction-filter" type="text" />
      <button id="filter-clear">Clear</button>
      
      <!-- Actions -->
      <button id="cleanup-orphans-btn">Cleanup Orphans</button>
      <button id="add-direction-btn">Add Direction</button>
      
      <!-- Stats -->
      <span id="total-directions">0</span>
      <span id="orphaned-directions">0</span>
      
      <!-- Modal -->
      <div id="modal-overlay" style="display: none"></div>
      <div id="confirmation-modal" style="display: none">
        <h2 id="modal-title"></h2>
        <p id="modal-message"></p>
        <button id="modal-confirm-btn">Confirm</button>
        <button id="modal-cancel-btn">Cancel</button>
      </div>
    `);

    // Override createController for our specific controller
    testBase.createController = function () {
      return new ThematicDirectionsManagerController(this.mocks);
    };

    // Create controller instance
    controller = testBase.createController();
  });

  afterEach(async () => {
    await testBase.cleanup();
  });

  describe('Constructor', () => {
    it('should initialize with base controller dependencies', () => {
      expect(controller).toBeInstanceOf(ThematicDirectionsManagerController);
      expect(controller.logger).toBe(testBase.mocks.logger);
      expect(controller.characterBuilderService).toBe(
        testBase.mocks.characterBuilderService
      );
      expect(controller.uiStateManager).toBe(testBase.mocks.uiStateManager);
      expect(controller.eventBus).toBe(testBase.mocks.eventBus);
    });

    it('should initialize page-specific fields', () => {
      // Test private field initialization through behavior
      expect(() => controller.initialize()).not.toThrow();
    });
  });

  describe('Lifecycle Methods', () => {
    it('should implement required abstract methods', () => {
      expect(typeof controller._cacheElements).toBe('function');
      expect(typeof controller._setupEventListeners).toBe('function');
    });

    it('should cache all required elements', async () => {
      await controller.initialize();

      // Test that elements are cached by trying to access them
      expect(() => controller._getElement('directionsContainer')).not.toThrow();
      expect(() => controller._getElement('conceptFilter')).not.toThrow();
      expect(() => controller._getElement('modalConfirmBtn')).not.toThrow();
    });

    it('should load initial data during initialization', async () => {
      const mockDirections = [
        { id: '1', name: 'Direction 1', description: 'Desc 1' },
      ];

      testBase.mocks.characterBuilderService.getAllThematicDirectionsWithConcepts.mockResolvedValue(
        mockDirections
      );
      testBase.mocks.characterBuilderService.getAllCharacterConcepts.mockResolvedValue(
        []
      );
      testBase.mocks.characterBuilderService.getOrphanedThematicDirections.mockResolvedValue(
        []
      );

      await controller.initialize();

      expect(
        testBase.mocks.characterBuilderService
          .getAllThematicDirectionsWithConcepts
      ).toHaveBeenCalled();
    });
  });

  describe('State Management', () => {
    it('should show empty state when no directions', async () => {
      testBase.mocks.characterBuilderService.getAllThematicDirectionsWithConcepts.mockResolvedValue(
        []
      );

      await controller.initialize();

      // The base testBase tracks setState calls
      expect(testBase.mocks.uiStateManager.setState).toHaveBeenCalledWith(
        UI_STATES.EMPTY
      );
    });

    it('should show results state when directions exist', async () => {
      testBase.mocks.characterBuilderService.getAllThematicDirectionsWithConcepts.mockResolvedValue(
        [{ id: '1', name: 'Test' }]
      );

      await controller.initialize();

      expect(testBase.mocks.uiStateManager.setState).toHaveBeenCalledWith(
        UI_STATES.RESULTS
      );
    });

    it('should show loading state during data fetch', async () => {
      // Make the service call hang
      let resolvePromise;
      const pendingPromise = new Promise((resolve) => {
        resolvePromise = resolve;
      });

      testBase.mocks.characterBuilderService.getAllThematicDirectionsWithConcepts.mockReturnValue(
        pendingPromise
      );

      const initPromise = controller.initialize();

      // Should show loading
      expect(testBase.mocks.uiStateManager.setState).toHaveBeenCalledWith(
        UI_STATES.LOADING
      );

      // Resolve and wait
      resolvePromise([]);
      await initPromise;
    });
  });

  describe('InPlaceEditor Management', () => {
    it('should create editors when displaying directions', async () => {
      const mockDirections = [
        { id: '1', name: 'Direction 1', description: 'Desc 1', tags: ['tag1'] },
      ];

      testBase.mocks.characterBuilderService.getAllThematicDirectionsWithConcepts.mockResolvedValue(
        mockDirections
      );

      await controller.initialize();

      // Verify editors were created (check through DOM)
      const directionsList = document.getElementById('directions-list');
      expect(directionsList.innerHTML).toContain('direction-1-name');
      expect(directionsList.innerHTML).toContain('direction-1-description');
    });

    it('should clean up editors on destroy', async () => {
      await controller.initialize();

      // Spy on cleanup method
      const cleanupSpy = jest.spyOn(controller, '_destroyAllInPlaceEditors');

      controller.destroy();

      expect(cleanupSpy).toHaveBeenCalled();
    });
  });

  describe('Event Handling', () => {
    it('should handle refresh button click', async () => {
      await controller.initialize();

      const refreshBtn = document.getElementById('refresh-btn');
      const loadDataSpy = jest.spyOn(controller, '_loadDirectionsData');

      refreshBtn.click();

      expect(loadDataSpy).toHaveBeenCalled();
    });

    it('should handle filter input with debouncing', async () => {
      await controller.initialize();

      const filterInput = document.getElementById('direction-filter');
      const filterSpy = jest.spyOn(controller, '_handleFilterChange');

      // Simulate input
      filterInput.value = 'test';
      filterInput.dispatchEvent(new Event('input'));

      // Should not be called immediately due to debouncing
      expect(filterSpy).not.toHaveBeenCalled();

      // Wait for debounce
      await new Promise((resolve) => setTimeout(resolve, 350));

      expect(filterSpy).toHaveBeenCalledWith('test');
    });
  });

  describe('Modal Management', () => {
    it('should show confirmation modal', async () => {
      await controller.initialize();

      controller._showConfirmationModal({
        title: 'Test Modal',
        message: 'Test Message',
        onConfirm: jest.fn(),
      });

      const modalTitle = document.getElementById('modal-title');
      const modalMessage = document.getElementById('modal-message');

      expect(modalTitle.textContent).toBe('Test Modal');
      expect(modalMessage.textContent).toBe('Test Message');
      expect(
        document.getElementById('confirmation-modal').style.display
      ).not.toBe('none');
    });

    it('should handle modal confirm', async () => {
      await controller.initialize();

      const confirmSpy = jest.fn();
      controller._showConfirmationModal({
        title: 'Test',
        message: 'Test',
        onConfirm: confirmSpy,
      });

      const confirmBtn = document.getElementById('modal-confirm-btn');
      confirmBtn.click();

      expect(confirmSpy).toHaveBeenCalled();
    });
  });

  describe('Resource Cleanup', () => {
    it('should clean up all resources on destroy', async () => {
      await controller.initialize();

      // Create some resources
      controller._showConfirmationModal({
        title: 'Test',
        message: 'Test',
        onConfirm: jest.fn(),
      });

      // Destroy
      expect(() => controller.destroy()).not.toThrow();

      // Verify cleanup
      expect(document.getElementById('confirmation-modal').style.display).toBe(
        'none'
      );
    });

    it('should handle multiple destroy calls', async () => {
      await controller.initialize();

      expect(() => {
        controller.destroy();
        controller.destroy();
      }).not.toThrow();
    });
  });
});
```

### Step 3: Create Integration Test File

**File**: `tests/integration/thematicDirectionsManager/controllers/thematicDirectionsManagerController.integration.test.js`

```javascript
/**
 * @file Integration tests for ThematicDirectionsManagerController
 */

import { describe, it, expect, beforeEach, afterEach } from '@jest/globals';
import { BaseCharacterBuilderControllerTestBase } from '../../../unit/characterBuilder/controllers/BaseCharacterBuilderController.testbase.js';
import { ThematicDirectionsManagerController } from '../../../../src/thematicDirectionsManager/controllers/thematicDirectionsManagerController.js';
import { createTestContainerWithDefaults } from '../../../common/testContainerFactory.js';

describe('ThematicDirectionsManagerController Integration', () => {
  let testBase;
  let controller;
  let container;

  beforeEach(async () => {
    // Create real container for integration testing
    container = createTestContainerWithDefaults();

    // Initialize test base with real services where appropriate
    testBase = new BaseCharacterBuilderControllerTestBase();
    await testBase.setup();

    // Add full DOM structure
    testBase.addDOMElement(getFullDOMStructure());

    // Mix real and mock services for integration testing
    const dependencies = {
      logger: container.resolve('ILogger'),
      characterBuilderService: testBase.mocks.characterBuilderService, // Mock for predictable data
      uiStateManager: container.resolve('IUIStateManager'),
      eventBus: container.resolve('IEventBus'),
      schemaValidator: container.resolve('ISchemaValidator'),
    };

    controller = new ThematicDirectionsManagerController(dependencies);
  });

  afterEach(async () => {
    if (controller && !controller.isDestroyed) {
      controller.destroy();
    }
    await testBase.cleanup();
    if (container && container.dispose) {
      container.dispose();
    }
  });

  describe('Full Lifecycle Integration', () => {
    it('should complete full initialization cycle', async () => {
      const mockDirections = getMockDirectionsData();
      testBase.mocks.characterBuilderService.getAllThematicDirectionsWithConcepts.mockResolvedValue(
        mockDirections
      );

      await controller.initialize();

      // Verify all lifecycle methods were called in order
      const directionsListElement = document.getElementById('directions-list');
      expect(directionsListElement.children.length).toBe(mockDirections.length);
    });

    it('should handle real event flow', async () => {
      await controller.initialize();

      // Simulate user interaction flow
      const filterInput = document.getElementById('direction-filter');
      filterInput.value = 'test';
      filterInput.dispatchEvent(new Event('input'));

      // Wait for debounce and processing
      await new Promise((resolve) => setTimeout(resolve, 400));

      // Verify filtering applied
      const visibleCards = document.querySelectorAll(
        '.direction-card:not(.hidden)'
      );
      expect(visibleCards.length).toBeLessThanOrEqual(
        document.querySelectorAll('.direction-card').length
      );
    });
  });

  describe('Cross-Component Integration', () => {
    it('should integrate with event bus for updates', async () => {
      await controller.initialize();

      const eventBus = controller.eventBus;
      const updateData = {
        direction: { id: '1', name: 'Updated Direction' },
      };

      // Dispatch update event
      eventBus.dispatch({
        type: 'core:thematic_direction_updated',
        payload: updateData,
      });

      // Allow event processing
      await new Promise((resolve) => setTimeout(resolve, 100));

      // Verify UI updated
      const directionElement = document.querySelector(
        '[data-direction-id="1"]'
      );
      expect(directionElement).toBeTruthy();
    });

    it('should handle service errors gracefully', async () => {
      testBase.mocks.characterBuilderService.getAllThematicDirectionsWithConcepts.mockRejectedValue(
        new Error('Service unavailable')
      );

      await controller.initialize();

      // Should show error state
      const errorState = document.getElementById('error-state');
      expect(errorState.style.display).not.toBe('none');

      // Retry should work
      testBase.mocks.characterBuilderService.getAllThematicDirectionsWithConcepts.mockResolvedValue(
        []
      );

      const retryBtn = document.getElementById('retry-btn');
      retryBtn.click();

      await new Promise((resolve) => setTimeout(resolve, 100));

      expect(errorState.style.display).toBe('none');
    });
  });

  describe('Performance Integration', () => {
    it('should handle large datasets efficiently', async () => {
      const largeDataset = generateLargeDirectionsDataset(100);
      testBase.mocks.characterBuilderService.getAllThematicDirectionsWithConcepts.mockResolvedValue(
        largeDataset
      );

      const startTime = performance.now();
      await controller.initialize();
      const endTime = performance.now();

      expect(endTime - startTime).toBeLessThan(1000); // Should initialize in < 1 second

      // Verify all items rendered
      const directionCards = document.querySelectorAll('.direction-card');
      expect(directionCards.length).toBe(largeDataset.length);
    });
  });
});

// Helper functions
function getFullDOMStructure() {
  return `
    <!-- Full HTML structure matching thematic-directions-manager.html -->
    <div id="directions-container">
      <!-- State containers -->
      <div id="empty-state" class="cb-empty-state">
        <p class="empty-message">No thematic directions found</p>
        <button id="refresh-btn">Refresh</button>
        <button id="add-direction-btn">Add Direction</button>
      </div>
      
      <div id="loading-state" class="cb-loading-state" style="display: none">
        <div class="spinner"></div>
        <p>Loading directions...</p>
        <div class="progress-bar" style="display: none">
          <div class="progress-bar-fill"></div>
        </div>
      </div>
      
      <div id="error-state" class="cb-error-state" style="display: none">
        <p class="error-message" id="error-message-text"></p>
        <button id="retry-btn">Try Again</button>
      </div>
      
      <div id="results-state" class="cb-state-container" style="display: none">
        <div class="filters-section">
          <select id="concept-filter">
            <option value="">All Concepts</option>
          </select>
          <input id="direction-filter" type="text" placeholder="Search directions..." />
          <button id="filter-clear" style="display: none">Clear Filters</button>
          <div id="active-filters" style="display: none"></div>
        </div>
        
        <div class="stats-section">
          <span>Total: <span id="total-directions">0</span></span>
          <span>Orphaned: <span id="orphaned-directions">0</span></span>
          <span>Filtered: <span id="filtered-count">0</span></span>
        </div>
        
        <div id="directions-results">
          <div id="directions-list"></div>
        </div>
        
        <button id="cleanup-orphans-btn">Cleanup Orphaned</button>
      </div>
    </div>
    
    <!-- Modal -->
    <div id="modal-overlay" class="modal-overlay" style="display: none"></div>
    <div id="confirmation-modal" class="modal" style="display: none">
      <div class="modal-header">
        <h2 id="modal-title"></h2>
      </div>
      <div class="modal-body">
        <p id="modal-message"></p>
      </div>
      <div class="modal-footer">
        <button id="modal-confirm-btn" class="btn-primary">Confirm</button>
        <button id="modal-cancel-btn" class="btn-secondary">Cancel</button>
      </div>
    </div>
    
    <!-- Success notification -->
    <div id="success-notification" class="notification notification-success"></div>
  `;
}

function getMockDirectionsData() {
  return [
    {
      id: '1',
      name: 'Adventure Theme',
      description: 'Bold and daring adventures',
      tags: ['adventure', 'exploration'],
      concepts: [{ id: 'c1', name: 'Explorer' }],
    },
    {
      id: '2',
      name: 'Mystery Theme',
      description: 'Enigmatic and mysterious',
      tags: ['mystery', 'suspense'],
      concepts: [{ id: 'c2', name: 'Detective' }],
    },
  ];
}

function generateLargeDirectionsDataset(count) {
  return Array.from({ length: count }, (_, i) => ({
    id: `dir-${i}`,
    name: `Direction ${i}`,
    description: `Description for direction ${i}`,
    tags: [`tag${i % 5}`, `tag${i % 3}`],
    concepts: [{ id: `c${i % 10}`, name: `Concept ${i % 10}` }],
  }));
}
```

### Step 4: Create Base Integration Test (Optional)

**File**: `tests/unit/thematicDirectionsManager/controllers/thematicDirectionsManagerController.baseIntegration.test.js`

This file is optional and can be combined with the main unit test file if the test suite becomes manageable in size.

```javascript
/**
 * @file Base controller integration tests for ThematicDirectionsManagerController
 * Tests base controller functionality integration
 */

import { describe, it, expect, beforeEach, afterEach } from '@jest/globals';
import { BaseCharacterBuilderControllerTestBase } from '../../../characterBuilder/controllers/BaseCharacterBuilderController.testbase.js';
import { ThematicDirectionsManagerController } from '../../../../src/thematicDirectionsManager/controllers/thematicDirectionsManagerController.js';

describe('ThematicDirectionsManagerController - Base Controller Integration', () => {
  let testBase;
  let controller;

  beforeEach(async () => {
    testBase = new BaseCharacterBuilderControllerTestBase();
    await testBase.setup();

    // Minimal DOM for base controller tests
    testBase.addDOMElement(`
      <div id="directions-container">
        <div id="empty-state" class="cb-empty-state"></div>
        <div id="loading-state" class="cb-loading-state"></div>
        <div id="error-state" class="cb-error-state">
          <p id="error-message-text"></p>
        </div>
        <div id="results-state" class="cb-state-container"></div>
      </div>
    `);

    controller = new ThematicDirectionsManagerController(testBase.mocks);
  });

  afterEach(async () => {
    await testBase.cleanup();
  });

  describe('Base Controller Features', () => {
    it('should inherit base controller lifecycle', async () => {
      const lifecycleSpy = {
        preInit: jest.spyOn(controller, '_preInitialize'),
        cache: jest.spyOn(controller, '_cacheElements'),
        events: jest.spyOn(controller, '_setupEventListeners'),
        services: jest.spyOn(controller, '_initializeAdditionalServices'),
        data: jest.spyOn(controller, '_loadInitialData'),
        ui: jest.spyOn(controller, '_initializeUIState'),
        post: jest.spyOn(controller, '_postInitialize'),
      };

      await controller.initialize();

      // Verify lifecycle methods called in order
      expect(lifecycleSpy.preInit).toHaveBeenCalled();
      expect(lifecycleSpy.cache).toHaveBeenCalled();
      expect(lifecycleSpy.events).toHaveBeenCalled();
      expect(lifecycleSpy.services).toHaveBeenCalled();
      expect(lifecycleSpy.data).toHaveBeenCalled();
      expect(lifecycleSpy.ui).toHaveBeenCalled();
      expect(lifecycleSpy.post).toHaveBeenCalled();

      // Verify order
      expect(lifecycleSpy.cache.mock.invocationCallOrder[0]).toBeLessThan(
        lifecycleSpy.events.mock.invocationCallOrder[0]
      );
    });

    it('should use base controller error handling', async () => {
      const error = new Error('Test error');
      testBase.mocks.characterBuilderService.getAllThematicDirectionsWithConcepts.mockRejectedValue(
        error
      );

      await controller.initialize();

      // Should handle error through base controller
      expect(testBase.mocks.logger.error).toHaveBeenCalled();
      expect(document.getElementById('error-state').style.display).not.toBe(
        'none'
      );
    });

    it('should leverage base controller state management', async () => {
      await controller.initialize();

      // Test state transitions
      controller._showLoading('Test loading...');
      expect(testBase.mocks.uiStateManager.setState).toHaveBeenCalledWith(
        'loading'
      );

      controller._showError('Test error');
      expect(testBase.mocks.uiStateManager.setState).toHaveBeenCalledWith(
        'error'
      );

      controller._showState('results');
      expect(testBase.mocks.uiStateManager.setState).toHaveBeenCalledWith(
        'results'
      );
    });

    it('should use base controller element access', async () => {
      await controller.initialize();

      // Should be able to get cached elements
      const container = controller._getElement('directionsContainer');
      expect(container).toBe(document.getElementById('directions-container'));

      // Should handle missing elements gracefully
      const missing = controller._getElement('nonexistent');
      expect(missing).toBeNull();
    });

    it('should cleanup through base controller destroy', async () => {
      await controller.initialize();

      const preDestroySpy = jest.spyOn(controller, '_preDestroy');
      const postDestroySpy = jest.spyOn(controller, '_postDestroy');

      controller.destroy();

      expect(preDestroySpy).toHaveBeenCalled();
      expect(postDestroySpy).toHaveBeenCalled();
    });
  });

  describe('Base Controller Utilities', () => {
    it('should use executeWithErrorHandling', async () => {
      let attemptCount = 0;
      const flakeyOperation = jest.fn(() => {
        attemptCount++;
        if (attemptCount < 2) {
          throw new Error('Temporary failure');
        }
        return 'success';
      });

      const result = await controller._executeWithErrorHandling(
        flakeyOperation,
        'test operation',
        { retries: 2 }
      );

      expect(result).toBe('success');
      expect(attemptCount).toBe(2); // First attempt failed, retry succeeded
    });

    it('should use base controller event helpers', async () => {
      await controller.initialize();

      const mockHandler = jest.fn();
      const button = document.createElement('button');
      button.id = 'test-button';
      document.body.appendChild(button);

      // Use base controller event helper
      controller._addEventListener('test-button', 'click', mockHandler);

      button.click();
      expect(mockHandler).toHaveBeenCalled();

      // Cleanup should remove listener
      controller.destroy();
      mockHandler.mockClear();

      button.click();
      expect(mockHandler).not.toHaveBeenCalled();
    });
  });
});
```

### Step 5: Remove Old Test Files and Add Test Utilities

**Remove after consolidation**:
- `tests/unit/thematicDirectionsManager/controllers/thematicDirectionsManagerController.abstractMethods.test.js`
- `tests/unit/thematicDirectionsManager/controllers/thematicDirectionsManagerController.conceptDisplay.test.js`
- `tests/unit/thematicDirectionsManager/controllers/thematicDirectionsManagerController.stateManagement.test.js`
- `tests/unit/thematicDirectionsManager/controllers/thematicDirectionsManagerController.modalManagement.test.js`
- `tests/unit/thematicDirectionsManager/controllers/thematicDirectionsManagerController.resourceCleanup.test.js`

**Create shared test utilities if needed**:

```javascript
// tests/common/thematicDirectionsTestHelpers.js

export function createMockDirection(overrides = {}) {
  return {
    id: 'test-id',
    name: 'Test Direction',
    description: 'Test description',
    tags: ['test'],
    concepts: [],
    orphaned: false,
    ...overrides,
  };
}

export function createMockConcept(overrides = {}) {
  return {
    id: 'concept-id',
    name: 'Test Concept',
    description: 'Concept description',
    ...overrides,
  };
}

export function setupInPlaceEditorMocks() {
  const mockEditor = {
    destroy: jest.fn(),
    setValue: jest.fn(),
    getValue: jest.fn(),
    enable: jest.fn(),
    disable: jest.fn(),
  };

  global.InPlaceEditor = jest.fn(() => mockEditor);

  return mockEditor;
}

export function setupPreviousItemsDropdownMocks() {
  const mockDropdown = {
    _element: null,
    refresh: jest.fn(),
    setValue: jest.fn(),
    getValue: jest.fn(),
    clear: jest.fn(),
  };

  global.PreviousItemsDropdown = jest.fn(() => mockDropdown);

  return mockDropdown;
}
```

## Common Test Patterns

### Pattern 1: Testing Lifecycle Hooks

```javascript
it('should call lifecycle hooks in correct order', async () => {
  const callOrder = [];

  jest.spyOn(controller, '_preInitialize').mockImplementation(async () => {
    callOrder.push('preInit');
  });

  jest.spyOn(controller, '_cacheElements').mockImplementation(() => {
    callOrder.push('cache');
  });

  // ... spy on other methods

  await controller.initialize();

  expect(callOrder).toEqual([
    'preInit',
    'cache',
    'events',
    'services',
    'data',
    'ui',
    'post',
  ]);
});
```

### Pattern 2: Testing Error Scenarios

```javascript
it('should handle and recover from errors', async () => {
  // First call fails
  testBase.mocks.service.method
    .mockRejectedValueOnce(new Error('Temporary error'))
    .mockResolvedValueOnce({ success: true });

  await controller.initialize();

  // Should retry and succeed
  expect(testBase.mocks.service.method).toHaveBeenCalledTimes(2);
});
```

### Pattern 3: Testing Component Integration

```javascript
it('should initialize components in correct order', async () => {
  const initOrder = [];

  jest.spyOn(window, 'InPlaceEditor').mockImplementation(() => {
    initOrder.push('editor');
    return mockEditor;
  });

  jest.spyOn(window, 'PreviousItemsDropdown').mockImplementation(() => {
    initOrder.push('dropdown');
    return mockDropdown;
  });

  await controller.initialize();

  expect(initOrder).toEqual(['dropdown', 'editor', 'editor', ...]); // dropdown first
});
```

## Test Coverage Goals

- **Unit Tests**: Focus on individual method behavior
- **Integration Tests**: Test component interactions
- **Base Integration**: Verify base controller features work correctly

Target coverage:

- Statements: 90%+
- Branches: 85%+
- Functions: 95%+
- Lines: 90%+

## Files Modified

- [ ] `tests/unit/characterBuilder/controllers/BaseCharacterBuilderController.testbase.js` (if UIStateManager enhancement needed)

## Files Created

- [ ] `tests/unit/thematicDirectionsManager/controllers/thematicDirectionsManagerController.test.js` (consolidated)
- [ ] `tests/integration/thematicDirectionsManager/controllers/thematicDirectionsManagerController.integration.test.js`
- [ ] `tests/unit/thematicDirectionsManager/controllers/thematicDirectionsManagerController.baseIntegration.test.js` (optional)

## Files Removed

- [ ] `tests/unit/thematicDirectionsManager/controllers/thematicDirectionsManagerController.abstractMethods.test.js`
- [ ] `tests/unit/thematicDirectionsManager/controllers/thematicDirectionsManagerController.conceptDisplay.test.js`
- [ ] `tests/unit/thematicDirectionsManager/controllers/thematicDirectionsManagerController.stateManagement.test.js`
- [ ] `tests/unit/thematicDirectionsManager/controllers/thematicDirectionsManagerController.modalManagement.test.js`
- [ ] `tests/unit/thematicDirectionsManager/controllers/thematicDirectionsManagerController.resourceCleanup.test.js`

- [ ] `tests/common/thematicDirectionsTestHelpers.js` (optional)

## Definition of Done

- [ ] All test files use BaseCharacterBuilderControllerTestBase
- [ ] DOM setup uses test base helpers
- [ ] Mock patterns consistent with base
- [ ] Lifecycle testing follows patterns
- [ ] New tests for migrated features
- [ ] Coverage maintained or improved
- [ ] No test regressions
- [ ] Tests run faster
- [ ] Tests are more maintainable
- [ ] All tests pass
- [ ] Code committed with descriptive message
