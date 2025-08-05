# THEDIRMIG-013: Add Warning Test Scenarios

## Overview

Create a new warning test file following the pattern established by the characterConceptsManager migration. This file tests edge cases, graceful degradation scenarios, and warning conditions that don't cause failures but should be handled properly.

## Priority

**MEDIUM** - Important for robustness

## Dependencies

- **Blocked by**: THEDIRMIG-012 (test infrastructure update)
- **Related**: Character concepts manager warning tests pattern
- **Enables**: Comprehensive test coverage

## Acceptance Criteria

- [ ] New warning test file created
- [ ] Tests cover component initialization failures
- [ ] Tests cover missing optional dependencies
- [ ] Tests cover degraded functionality scenarios
- [ ] Tests cover edge cases in data handling
- [ ] Tests verify warning logs are generated
- [ ] Tests ensure application continues functioning
- [ ] No false positives in warnings

## Implementation Steps

### Step 1: Analyze Character Concepts Warning Test Pattern

First, review the existing pattern:

```bash
# Find the character concepts warning test
find tests -name "*characterConcepts*warning*" -o -name "*characterConcepts*Warning*"

# Review its structure
grep -A 20 "describe.*Warning" tests/unit/domUI/characterConceptsManagerController.warnings.test.js
```

### Step 2: Create Warning Test File

**File**: `tests/unit/domUI/thematicDirectionsManagerController.warnings.test.js`

```javascript
/**
 * @file Warning scenario tests for ThematicDirectionsManagerController
 * @description Tests edge cases and graceful degradation scenarios that generate warnings
 * but don't cause failures. Ensures the controller handles degraded conditions properly.
 */

import {
  describe,
  it,
  expect,
  beforeEach,
  afterEach,
  jest,
} from '@jest/globals';
import { BaseCharacterBuilderControllerTestBase } from '../../characterBuilder/controllers/BaseCharacterBuilderController.testbase.js';
import { ThematicDirectionsManagerController } from '../../../../src/thematicDirectionsManager/controllers/thematicDirectionsManagerController.js';
import { UI_STATES } from '../../../../src/shared/characterBuilder/uiStateManager.js';

describe('ThematicDirectionsManagerController - Warning Scenarios', () => {
  let testBase;
  let controller;
  let consoleWarnSpy;
  let loggerWarnSpy;

  beforeEach(async () => {
    testBase = new BaseCharacterBuilderControllerTestBase();
    await testBase.setup();

    // Add minimal DOM for warning tests
    testBase.addDOMElement(`
      <div id="directions-container">
        <div id="empty-state" class="cb-empty-state"></div>
        <div id="loading-state" class="cb-loading-state"></div>
        <div id="error-state" class="cb-error-state">
          <p id="error-message-text"></p>
        </div>
        <div id="results-state" class="cb-state-container">
          <div id="directions-list"></div>
        </div>
      </div>
      
      <!-- Some elements intentionally missing for tests -->
      <select id="concept-filter"></select>
      <input id="direction-filter" type="text" />
    `);

    // Spy on warning methods
    consoleWarnSpy = jest.spyOn(console, 'warn').mockImplementation();
    loggerWarnSpy = jest.spyOn(testBase.mocks.logger, 'warn');

    controller = new ThematicDirectionsManagerController(testBase.mocks);
  });

  afterEach(async () => {
    consoleWarnSpy.mockRestore();
    await testBase.cleanup();
  });

  describe('Component Initialization Warnings', () => {
    it('should warn but continue when InPlaceEditor fails to initialize', async () => {
      // Mock InPlaceEditor to throw during construction
      const mockError = new Error('InPlaceEditor initialization failed');
      global.InPlaceEditor = jest.fn(() => {
        throw mockError;
      });

      const mockDirections = [
        {
          id: '1',
          name: 'Test Direction',
          description: 'Test description',
          tags: ['test'],
        },
      ];

      testBase.mocks.characterBuilderService.getAllThematicDirectionsWithConcepts.mockResolvedValue(
        mockDirections
      );

      await controller.initialize();

      // Should log warning
      expect(loggerWarnSpy).toHaveBeenCalledWith(
        expect.stringContaining('InPlaceEditor'),
        expect.any(Object)
      );

      // But should still display directions
      const directionsList = document.getElementById('directions-list');
      expect(directionsList.innerHTML).toContain('Test Direction');

      // Cleanup
      delete global.InPlaceEditor;
    });

    it('should handle missing PreviousItemsDropdown gracefully', async () => {
      // Don't define PreviousItemsDropdown
      delete global.PreviousItemsDropdown;

      await expect(controller.initialize()).resolves.not.toThrow();

      // Should warn about missing component
      expect(loggerWarnSpy).toHaveBeenCalledWith(
        expect.stringContaining('PreviousItemsDropdown'),
        expect.any(Object)
      );

      // Concept filter should be disabled
      const conceptFilter = document.getElementById('concept-filter');
      expect(conceptFilter.disabled).toBe(true);
    });

    it('should continue when concept dropdown element is missing', async () => {
      // Remove concept filter element
      const conceptFilter = document.getElementById('concept-filter');
      conceptFilter.remove();

      // Mock PreviousItemsDropdown
      global.PreviousItemsDropdown = jest.fn();

      await controller.initialize();

      // Should warn about missing element
      expect(loggerWarnSpy).toHaveBeenCalledWith(
        expect.stringContaining('Concept filter element not found')
      );

      // But initialization should complete
      expect(controller).toBeTruthy();

      // Cleanup
      delete global.PreviousItemsDropdown;
    });
  });

  describe('Data Handling Warnings', () => {
    it('should warn when directions have invalid structure', async () => {
      const invalidDirections = [
        { id: '1', name: 'Valid Direction' },
        { id: '2' }, // Missing required fields
        { name: 'No ID' }, // Missing ID
        null, // Null entry
        { id: '3', name: '', description: null }, // Empty/null values
      ];

      testBase.mocks.characterBuilderService.getAllThematicDirectionsWithConcepts.mockResolvedValue(
        invalidDirections
      );

      await controller.initialize();

      // Should warn about invalid entries
      expect(loggerWarnSpy).toHaveBeenCalledWith(
        expect.stringContaining('Invalid direction'),
        expect.any(Object)
      );

      // Should only display valid directions
      const directionCards = document.querySelectorAll('.direction-card');
      expect(directionCards.length).toBeLessThan(invalidDirections.length);
    });

    it('should handle orphaned directions count mismatch', async () => {
      const directions = [
        { id: '1', name: 'Direction 1', orphaned: true },
        { id: '2', name: 'Direction 2', orphaned: false },
      ];

      testBase.mocks.characterBuilderService.getAllThematicDirectionsWithConcepts.mockResolvedValue(
        directions
      );

      // Return different count than actual orphaned
      testBase.mocks.characterBuilderService.getOrphanedThematicDirections.mockResolvedValue(
        [{ id: '1' }, { id: '3' }, { id: '4' }]
      ); // Count mismatch

      await controller.initialize();

      // Should warn about mismatch
      expect(loggerWarnSpy).toHaveBeenCalledWith(
        expect.stringContaining('Orphaned count mismatch'),
        expect.objectContaining({
          calculated: 1,
          reported: 3,
        })
      );
    });

    it('should handle concepts with circular references', async () => {
      const circularConcept = { id: 'c1', name: 'Concept 1' };
      circularConcept.parent = circularConcept; // Circular reference

      const directions = [
        {
          id: '1',
          name: 'Direction 1',
          concepts: [circularConcept],
        },
      ];

      testBase.mocks.characterBuilderService.getAllThematicDirectionsWithConcepts.mockResolvedValue(
        directions
      );

      await controller.initialize();

      // Should handle circular reference
      expect(loggerWarnSpy).toHaveBeenCalledWith(
        expect.stringContaining('Circular reference detected'),
        expect.any(Object)
      );

      // Should still display direction
      expect(document.querySelectorAll('.direction-card').length).toBe(1);
    });
  });

  describe('Event Handling Warnings', () => {
    it('should warn when event payload is malformed', async () => {
      await controller.initialize();

      // Dispatch event with malformed payload
      controller.eventBus.dispatch({
        type: 'core:thematic_direction_updated',
        payload: null, // Should have direction property
      });

      expect(loggerWarnSpy).toHaveBeenCalledWith(
        expect.stringContaining('Invalid event payload'),
        expect.any(Object)
      );

      // Should not crash
      expect(controller).toBeTruthy();
    });

    it('should handle update event for non-existent direction', async () => {
      await controller.initialize();

      // Dispatch update for direction that doesn't exist
      controller.eventBus.dispatch({
        type: 'core:thematic_direction_updated',
        payload: {
          direction: { id: 'non-existent', name: 'Ghost Direction' },
        },
      });

      expect(loggerWarnSpy).toHaveBeenCalledWith(
        expect.stringContaining('Direction not found for update'),
        expect.objectContaining({ directionId: 'non-existent' })
      );
    });

    it('should warn when modal action has no callback', async () => {
      await controller.initialize();

      // Show modal without onConfirm callback
      controller._showConfirmationModal({
        title: 'Test',
        message: 'Test message',
        // Missing onConfirm
      });

      // Try to confirm
      const confirmBtn = document.getElementById('modal-confirm-btn');
      confirmBtn.click();

      expect(loggerWarnSpy).toHaveBeenCalledWith(
        expect.stringContaining('No pending modal action')
      );
    });
  });

  describe('Filter Edge Cases', () => {
    it('should handle invalid filter values gracefully', async () => {
      await controller.initialize();

      // Set invalid filter values
      const filterInput = document.getElementById('direction-filter');

      // Very long filter string
      const longFilter = 'a'.repeat(1000);
      filterInput.value = longFilter;
      filterInput.dispatchEvent(new Event('input'));

      await new Promise((resolve) => setTimeout(resolve, 350)); // Wait for debounce

      // Should warn about long filter
      expect(loggerWarnSpy).toHaveBeenCalledWith(
        expect.stringContaining('Filter string too long'),
        expect.objectContaining({ length: 1000 })
      );

      // Should truncate and apply
      expect(controller.#currentFilter.length).toBeLessThan(1000);
    });

    it('should handle concept filter with invalid selection', async () => {
      // Mock dropdown to return invalid concept ID
      global.PreviousItemsDropdown = jest.fn(() => ({
        _element: document.getElementById('concept-filter'),
      }));

      await controller.initialize();

      // Manually trigger selection with invalid ID
      controller._handleConceptSelection('invalid-concept-id');

      expect(loggerWarnSpy).toHaveBeenCalledWith(
        expect.stringContaining('Invalid concept selected'),
        expect.objectContaining({ conceptId: 'invalid-concept-id' })
      );

      // Should clear the filter
      expect(controller.#currentConcept).toBeNull();

      // Cleanup
      delete global.PreviousItemsDropdown;
    });
  });

  describe('Resource Cleanup Warnings', () => {
    it('should warn but continue when editor cleanup fails', async () => {
      // Create mock editor that throws on destroy
      const mockEditor = {
        destroy: jest.fn(() => {
          throw new Error('Destroy failed');
        }),
      };

      global.InPlaceEditor = jest.fn(() => mockEditor);

      await controller.initialize();

      // Create an editor
      controller._createInPlaceEditor('test-id', 'dir1', 'name', {});

      // Destroy controller
      controller.destroy();

      // Should warn about failed cleanup
      expect(loggerWarnSpy).toHaveBeenCalledWith(
        expect.stringContaining('Failed to destroy InPlaceEditor'),
        expect.any(Object)
      );

      // But destroy should complete
      expect(controller.#isDestroyed).toBe(true);

      // Cleanup
      delete global.InPlaceEditor;
    });

    it('should handle multiple destroy calls without errors', async () => {
      await controller.initialize();

      // First destroy
      controller.destroy();

      // Second destroy should warn but not error
      controller.destroy();

      expect(loggerWarnSpy).toHaveBeenCalledWith(
        expect.stringContaining('Destroy already called')
      );

      // Third destroy for good measure
      expect(() => controller.destroy()).not.toThrow();
    });
  });

  describe('Performance Warnings', () => {
    it('should warn when rendering too many directions', async () => {
      // Create large dataset
      const manyDirections = Array.from({ length: 1000 }, (_, i) => ({
        id: `dir-${i}`,
        name: `Direction ${i}`,
        description: `Description ${i}`,
        tags: [`tag${i}`],
      }));

      testBase.mocks.characterBuilderService.getAllThematicDirectionsWithConcepts.mockResolvedValue(
        manyDirections
      );

      await controller.initialize();

      // Should warn about performance
      expect(loggerWarnSpy).toHaveBeenCalledWith(
        expect.stringContaining('Large number of directions'),
        expect.objectContaining({ count: 1000 })
      );

      // Consider pagination suggestion
      expect(loggerWarnSpy).toHaveBeenCalledWith(
        expect.stringContaining('Consider implementing pagination')
      );
    });

    it('should warn about slow operations', async () => {
      // Mock slow service call
      testBase.mocks.characterBuilderService.getAllThematicDirectionsWithConcepts.mockImplementation(
        () =>
          new Promise((resolve) => {
            setTimeout(() => resolve([]), 3000); // 3 second delay
          })
      );

      const initPromise = controller.initialize();

      // Fast forward time
      jest.advanceTimersByTime(3000);

      await initPromise;

      // Should warn about slow operation
      expect(loggerWarnSpy).toHaveBeenCalledWith(
        expect.stringContaining('Slow operation detected'),
        expect.objectContaining({
          operation: 'load directions data',
          duration: expect.any(Number),
        })
      );
    });
  });

  describe('Schema Validation Warnings', () => {
    it('should warn about schema validation failures but continue', async () => {
      const directions = [
        {
          id: '1',
          name: 'Test Direction',
          description: 'Test',
          extraField: 'Not in schema', // Extra field
        },
      ];

      // Mock schema validator to return warnings
      testBase.mocks.schemaValidator.validateAgainstSchema.mockResolvedValue({
        valid: true,
        warnings: ['Additional property "extraField" not allowed'],
      });

      testBase.mocks.characterBuilderService.getAllThematicDirectionsWithConcepts.mockResolvedValue(
        directions
      );

      await controller.initialize();

      // Should log schema warnings
      expect(loggerWarnSpy).toHaveBeenCalledWith(
        expect.stringContaining('Schema validation warnings'),
        expect.arrayContaining(['Additional property "extraField" not allowed'])
      );

      // But should still display direction
      expect(document.querySelectorAll('.direction-card').length).toBe(1);
    });
  });
});
```

### Step 3: Add Integration Warning Tests

**File**: `tests/integration/domUI/thematicDirectionsManagerWarnings.test.js`

```javascript
/**
 * @file Integration warning tests for ThematicDirectionsManagerController
 * @description Tests warning scenarios in integrated environment
 */

import {
  describe,
  it,
  expect,
  beforeEach,
  afterEach,
  jest,
} from '@jest/globals';
import { createTestContainerWithDefaults } from '../../common/testContainerFactory.js';
import { ThematicDirectionsManagerController } from '../../../src/thematicDirectionsManager/controllers/thematicDirectionsManagerController.js';

describe('ThematicDirectionsManagerController - Integration Warnings', () => {
  let container;
  let controller;
  let logger;
  let warnSpy;

  beforeEach(() => {
    container = createTestContainerWithDefaults();
    logger = container.resolve('ILogger');
    warnSpy = jest.spyOn(logger, 'warn');

    // Create full DOM
    document.body.innerHTML = getFullDOMStructure();
  });

  afterEach(() => {
    if (controller && !controller.isDestroyed) {
      controller.destroy();
    }
    if (container && container.dispose) {
      container.dispose();
    }
    document.body.innerHTML = '';
  });

  describe('Service Integration Warnings', () => {
    it('should handle partial service failures', async () => {
      const characterBuilderService = container.resolve(
        'ICharacterBuilderService'
      );

      // Mock mixed responses
      jest
        .spyOn(characterBuilderService, 'getAllThematicDirectionsWithConcepts')
        .mockResolvedValue([{ id: '1', name: 'Direction 1' }]);

      jest
        .spyOn(characterBuilderService, 'getAllCharacterConcepts')
        .mockRejectedValue(new Error('Concepts service unavailable'));

      jest
        .spyOn(characterBuilderService, 'getOrphanedThematicDirections')
        .mockResolvedValue([]);

      controller = new ThematicDirectionsManagerController({
        logger,
        characterBuilderService,
        uiStateManager: container.resolve('IUIStateManager'),
        eventBus: container.resolve('IEventBus'),
        schemaValidator: container.resolve('ISchemaValidator'),
      });

      await controller.initialize();

      // Should warn about concepts failure
      expect(warnSpy).toHaveBeenCalledWith(
        expect.stringContaining('Failed to load concepts'),
        expect.any(Error)
      );

      // But should still show directions
      const directionCards = document.querySelectorAll('.direction-card');
      expect(directionCards.length).toBe(1);

      // Concept filter should be disabled
      const conceptFilter = document.getElementById('concept-filter');
      expect(conceptFilter.disabled).toBe(true);
    });

    it('should warn about event bus issues but continue', async () => {
      const eventBus = container.resolve('IEventBus');
      const characterBuilderService = container.resolve(
        'ICharacterBuilderService'
      );

      // Mock event bus to throw on certain events
      const originalDispatch = eventBus.dispatch.bind(eventBus);
      jest.spyOn(eventBus, 'dispatch').mockImplementation((event) => {
        if (event.type === 'ANALYTICS_TRACK') {
          throw new Error('Analytics service unavailable');
        }
        return originalDispatch(event);
      });

      controller = new ThematicDirectionsManagerController({
        logger,
        characterBuilderService,
        uiStateManager: container.resolve('IUIStateManager'),
        eventBus,
        schemaValidator: container.resolve('ISchemaValidator'),
      });

      await controller.initialize();

      // Trigger an action that sends analytics
      const filterInput = document.getElementById('direction-filter');
      filterInput.value = 'test';
      filterInput.dispatchEvent(new Event('input'));

      await new Promise((resolve) => setTimeout(resolve, 350));

      // Should warn about analytics failure
      expect(warnSpy).toHaveBeenCalledWith(
        expect.stringContaining('Failed to track analytics'),
        expect.any(Error)
      );

      // But filtering should still work
      // (verify by checking that filter was applied)
    });
  });

  describe('Browser Compatibility Warnings', () => {
    it('should warn about missing browser features', async () => {
      // Mock missing IntersectionObserver
      const originalIO = window.IntersectionObserver;
      delete window.IntersectionObserver;

      const characterBuilderService = container.resolve(
        'ICharacterBuilderService'
      );
      controller = new ThematicDirectionsManagerController({
        logger,
        characterBuilderService,
        uiStateManager: container.resolve('IUIStateManager'),
        eventBus: container.resolve('IEventBus'),
        schemaValidator: container.resolve('ISchemaValidator'),
      });

      await controller.initialize();

      // Should warn about missing feature
      expect(warnSpy).toHaveBeenCalledWith(
        expect.stringContaining('IntersectionObserver not supported'),
        expect.any(Object)
      );

      // Restore
      window.IntersectionObserver = originalIO;
    });
  });
});

function getFullDOMStructure() {
  // Return full HTML structure for integration tests
  return `
    <div id="directions-container">
      <!-- Full structure matching thematic-directions-manager.html -->
      <!-- ... -->
    </div>
  `;
}
```

## Common Warning Patterns to Test

### Pattern 1: Optional Component Missing

```javascript
it('should continue without optional component', async () => {
  delete global.OptionalComponent;

  await controller.initialize();

  expect(loggerWarnSpy).toHaveBeenCalledWith(
    expect.stringContaining('OptionalComponent not available')
  );

  // Feature should be disabled but app continues
  expect(controller.optionalFeatureEnabled).toBe(false);
});
```

### Pattern 2: Degraded Functionality

```javascript
it('should operate in degraded mode when service unavailable', async () => {
  mockService.method.mockRejectedValue(new Error('Service down'));

  await controller.initialize();

  expect(loggerWarnSpy).toHaveBeenCalledWith(
    expect.stringContaining('Operating in degraded mode')
  );

  // Basic functionality still works
  expect(controller.isOperational).toBe(true);
});
```

### Pattern 3: Data Validation Warnings

```javascript
it('should warn about suspicious data but continue', async () => {
  const suspiciousData = {
    count: -1, // Negative count
    percentage: 150, // Over 100%
    date: 'invalid-date',
  };

  await controller.processData(suspiciousData);

  expect(loggerWarnSpy).toHaveBeenCalledWith(
    expect.stringContaining('Suspicious data detected')
  );

  // Should use safe defaults
  expect(controller.count).toBe(0);
  expect(controller.percentage).toBe(100);
});
```

## Warning Categories to Cover

1. **Initialization Warnings**
   - Missing optional components
   - Failed component setup
   - Partial initialization

2. **Data Warnings**
   - Invalid data structure
   - Missing expected fields
   - Suspicious values

3. **Integration Warnings**
   - Service failures
   - Event handling issues
   - External dependency problems

4. **Performance Warnings**
   - Large datasets
   - Slow operations
   - Memory concerns

5. **Browser/Environment Warnings**
   - Missing APIs
   - Compatibility issues
   - Resource constraints

6. **User Action Warnings**
   - Invalid inputs
   - Uncommon operations
   - Edge case interactions

## Files Created

- [ ] `tests/unit/domUI/thematicDirectionsManagerController.warnings.test.js`
- [ ] `tests/integration/domUI/thematicDirectionsManagerWarnings.test.js`

## Files Modified

- None (new files only)

## Definition of Done

- [ ] Warning test file created
- [ ] Component initialization warnings tested
- [ ] Data handling warnings tested
- [ ] Event handling warnings tested
- [ ] Filter edge cases tested
- [ ] Resource cleanup warnings tested
- [ ] Performance warnings tested
- [ ] Schema validation warnings tested
- [ ] Integration warning tests created
- [ ] All tests pass
- [ ] Warning scenarios documented
- [ ] No false positive warnings
- [ ] Code committed with descriptive message
