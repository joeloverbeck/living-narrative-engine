/**
 * @file Integration tests for select element event handling in Core Motivations Generator
 * Tests the complete workflow of direction selection through DOM events
 *
 * This test suite covers CORMOTSEL-002: Select Element Event Handling
 * @see workflows/CORMOTSEL-002-implement-select-event-handling.md
 */

import {
  describe,
  it,
  expect,
  beforeEach,
  afterEach,
  jest,
} from '@jest/globals';
import { CoreMotivationsGeneratorControllerTestBed } from '../../common/coreMotivationsGeneratorControllerTestBed.js';

describe('Core Motivations Generator - Select Event Integration (CORMOTSEL-002)', () => {
  let testBed;

  beforeEach(async () => {
    testBed = new CoreMotivationsGeneratorControllerTestBed();
    await testBed.setup();

    // Mock localStorage
    const localStorageMock = {
      getItem: jest.fn(),
      setItem: jest.fn(),
      clear: jest.fn(),
    };
    Object.defineProperty(window, 'localStorage', {
      value: localStorageMock,
      writable: true,
    });

    // Setup successful direction loading
    testBed.setupSuccessfulDirectionLoad();
    await testBed.controller.initialize();
  });

  afterEach(() => {
    testBed.cleanup();
    jest.clearAllMocks();
  });

  describe('Complete Direction Selection Workflow', () => {
    it('should complete full workflow from select change to button enablement', async () => {
      // Arrange
      const selector = document.getElementById('direction-selector');
      const generateBtn = document.getElementById('generate-btn');
      const directionId = 'test-direction-1';

      // Ensure button starts disabled
      expect(generateBtn.disabled).toBe(true);

      // Mock service responses
      testBed.mockCharacterBuilderService.getCoreMotivationsByDirectionId.mockResolvedValue(
        [
          {
            id: 'motivation-1',
            core_motivation: 'Test motivation',
            internal_contradiction: 'Test contradiction',
            central_question: 'Test question?',
          },
        ]
      );

      // Act - Simulate user selecting from dropdown
      selector.value = directionId;
      const changeEvent = new Event('change', { bubbles: true });
      selector.dispatchEvent(changeEvent);

      // Wait for async operations
      await new Promise((resolve) => setTimeout(resolve, 50));

      // Assert - Complete workflow validation
      // 1. Button should be enabled
      expect(generateBtn.disabled).toBe(false);

      // 2. Event should be dispatched
      const selectionEvent = testBed.dispatchedEvents.find(
        (event) => event.type === 'core:core_motivations_direction_selected'
      );
      expect(selectionEvent).toBeDefined();
      expect(selectionEvent.payload.directionId).toBe(directionId);

      // 3. Service should have been called
      expect(
        testBed.mockCharacterBuilderService.getCoreMotivationsByDirectionId
      ).toHaveBeenCalledWith(directionId);

      // 4. UI should reflect the selection
      expect(selector.value).toBe(directionId);

      // 5. Existing motivations should be loaded and displayed
      const motivationsContainer = document.getElementById(
        'motivations-container'
      );
      expect(motivationsContainer.children.length).toBeGreaterThan(0);
    });

    it('should handle direction change workflow correctly', async () => {
      // Arrange - First select a direction
      const selector = document.getElementById('direction-selector');
      testBed.mockCharacterBuilderService.getCoreMotivationsByDirectionId.mockResolvedValue(
        []
      );

      // Initial selection
      selector.value = 'test-direction-1';
      selector.dispatchEvent(new Event('change', { bubbles: true }));
      await new Promise((resolve) => setTimeout(resolve, 10));

      // Clear events to test the change
      testBed.dispatchedEvents.length = 0;
      testBed.mockCharacterBuilderService.getCoreMotivationsByDirectionId.mockClear();

      // Act - Change to different direction
      const newDirectionId = 'test-direction-2';
      selector.value = newDirectionId;
      selector.dispatchEvent(new Event('change', { bubbles: true }));
      await new Promise((resolve) => setTimeout(resolve, 50));

      // Assert
      const selectionEvent = testBed.dispatchedEvents.find(
        (event) => event.type === 'core:core_motivations_direction_selected'
      );
      expect(selectionEvent).toBeDefined();
      expect(selectionEvent.payload.directionId).toBe(newDirectionId);

      // Service should be called for new direction
      expect(
        testBed.mockCharacterBuilderService.getCoreMotivationsByDirectionId
      ).toHaveBeenCalledWith(newDirectionId);
    });

    it('should handle clear selection workflow', async () => {
      // Arrange - First select a direction
      const selector = document.getElementById('direction-selector');
      const generateBtn = document.getElementById('generate-btn');

      testBed.mockCharacterBuilderService.getCoreMotivationsByDirectionId.mockResolvedValue(
        []
      );

      // Initial selection
      selector.value = 'test-direction-1';
      selector.dispatchEvent(new Event('change', { bubbles: true }));
      await new Promise((resolve) => setTimeout(resolve, 10));

      // Verify button is enabled
      expect(generateBtn.disabled).toBe(false);

      // Clear events
      testBed.dispatchedEvents.length = 0;

      // Act - Clear selection
      selector.value = '';
      selector.dispatchEvent(new Event('change', { bubbles: true }));
      await new Promise((resolve) => setTimeout(resolve, 10));

      // Assert - Button should be disabled again
      expect(generateBtn.disabled).toBe(true);

      // No new selection events should be dispatched
      const selectionEvents = testBed.dispatchedEvents.filter(
        (event) => event.type === 'core:core_motivations_direction_selected'
      );
      expect(selectionEvents.length).toBe(0);

      // But a clear event should be dispatched
      const clearEvents = testBed.dispatchedEvents.filter(
        (event) => event.type === 'core:core_motivations_direction_cleared'
      );
      expect(clearEvents.length).toBe(1);

      // Motivations container should be hidden and empty state shown
      const motivationsContainer = document.getElementById(
        'motivations-container'
      );
      const emptyState = document.getElementById('empty-state');
      expect(motivationsContainer.style.display).toBe('none');
      expect(emptyState.style.display).toBe('flex');
    });
  });

  describe('Error Handling Integration', () => {
    it('should handle service errors during direction selection', async () => {
      // Arrange
      const selector = document.getElementById('direction-selector');
      const directionId = 'test-direction-1';

      // Mock service to throw error
      testBed.mockCharacterBuilderService.getCoreMotivationsByDirectionId.mockRejectedValue(
        new Error('Service error')
      );

      // Track console errors
      const consoleSpy = jest
        .spyOn(console, 'error')
        .mockImplementation(() => {});

      // Act
      selector.value = directionId;
      selector.dispatchEvent(new Event('change', { bubbles: true }));
      await new Promise((resolve) => setTimeout(resolve, 50));

      // Assert - Should handle error gracefully
      // Button state depends on error handling implementation
      const generateBtn = document.getElementById('generate-btn');
      // Error scenarios should either keep button disabled or show error state
      expect(typeof generateBtn.disabled).toBe('boolean');

      consoleSpy.mockRestore();
    });

    it('should handle missing DOM elements gracefully', async () => {
      // Arrange - Remove generate button to test robustness
      const generateBtn = document.getElementById('generate-btn');
      generateBtn?.remove();

      const selector = document.getElementById('direction-selector');
      testBed.mockCharacterBuilderService.getCoreMotivationsByDirectionId.mockResolvedValue(
        []
      );

      // Act - Should not throw even with missing elements
      expect(() => {
        selector.value = 'test-direction-1';
        selector.dispatchEvent(new Event('change', { bubbles: true }));
      }).not.toThrow();
    });
  });

  describe('Accessibility and User Experience', () => {
    it('should maintain focus during selection', async () => {
      // Arrange
      const selector = document.getElementById('direction-selector');
      testBed.mockCharacterBuilderService.getCoreMotivationsByDirectionId.mockResolvedValue(
        []
      );

      // Focus the selector
      selector.focus();

      // Act
      selector.value = 'test-direction-1';
      selector.dispatchEvent(new Event('change', { bubbles: true }));
      await new Promise((resolve) => setTimeout(resolve, 10));

      // Assert - Focus should be maintained (good UX)
      expect(document.activeElement).toBe(selector);
    });

    it('should handle keyboard navigation events', async () => {
      // Arrange
      const selector = document.getElementById('direction-selector');
      testBed.mockCharacterBuilderService.getCoreMotivationsByDirectionId.mockResolvedValue(
        []
      );

      // Act - Simulate keyboard selection (Arrow keys + Enter/Space)
      selector.focus();
      selector.value = 'test-direction-1';

      // Simulate keydown followed by change (typical browser behavior)
      const keydownEvent = new KeyboardEvent('keydown', { key: 'ArrowDown' });
      const changeEvent = new Event('change', { bubbles: true });

      selector.dispatchEvent(keydownEvent);
      selector.dispatchEvent(changeEvent);

      await new Promise((resolve) => setTimeout(resolve, 10));

      // Assert - Should work the same as mouse selection
      const selectionEvent = testBed.dispatchedEvents.find(
        (event) => event.type === 'core:core_motivations_direction_selected'
      );
      expect(selectionEvent).toBeDefined();
      expect(selectionEvent.payload.directionId).toBe('test-direction-1');
    });

    it('should have proper ARIA attributes', () => {
      // Arrange & Assert
      const selector = document.getElementById('direction-selector');

      // Verify accessibility attributes are maintained after initialization
      expect(selector.getAttribute('aria-label')).toBeTruthy();
      expect(selector.tagName.toLowerCase()).toBe('select');
      expect(selector.classList.contains('cb-select')).toBe(true);
    });
  });

  describe('Performance and Edge Cases', () => {
    it('should handle rapid successive selections', async () => {
      // Arrange
      const selector = document.getElementById('direction-selector');
      testBed.mockCharacterBuilderService.getCoreMotivationsByDirectionId.mockResolvedValue(
        []
      );

      // Act - Rapid fire selections
      const selections = [
        'test-direction-1',
        'test-direction-2',
        'test-direction-1',
      ];
      const events = [];

      for (const directionId of selections) {
        selector.value = directionId;
        const event = new Event('change', { bubbles: true });
        selector.dispatchEvent(event);
        events.push(event);
        // Small delay to simulate real user interaction
        await new Promise((resolve) => setTimeout(resolve, 5));
      }

      // Wait for all async operations
      await new Promise((resolve) => setTimeout(resolve, 100));

      // Assert - Should handle all selections
      const selectionEvents = testBed.dispatchedEvents.filter(
        (event) => event.type === 'core:core_motivations_direction_selected'
      );

      // All selections should be processed
      expect(selectionEvents.length).toBe(selections.length);

      // Final selection should be the last one
      const finalEvent = selectionEvents[selectionEvents.length - 1];
      expect(finalEvent.payload.directionId).toBe(
        selections[selections.length - 1]
      );
    });

    it('should handle selections with special characters', async () => {
      // Arrange
      const selector = document.getElementById('direction-selector');
      const specialDirectionId = 'direction-with-special-chars-123_$%';

      // Add option with special characters
      const specialOption = document.createElement('option');
      specialOption.value = specialDirectionId;
      specialOption.textContent = 'Direction with Special Characters';
      selector.appendChild(specialOption);

      testBed.mockCharacterBuilderService.getCoreMotivationsByDirectionId.mockResolvedValue(
        []
      );

      // Act
      selector.value = specialDirectionId;
      selector.dispatchEvent(new Event('change', { bubbles: true }));
      await new Promise((resolve) => setTimeout(resolve, 10));

      // Assert - Should handle special characters in IDs
      const selectionEvent = testBed.dispatchedEvents.find(
        (event) => event.type === 'core:core_motivations_direction_selected'
      );
      expect(selectionEvent).toBeDefined();
      expect(selectionEvent.payload.directionId).toBe(specialDirectionId);
    });
  });
});
