/**
 * @file Integration test for existing clichés display regression
 * @description Tests the regression where existing clichés don't display in the right panel
 * after selecting a thematic direction that has clichés already generated.
 */

import { describe, it, expect, beforeEach, afterEach } from '@jest/globals';
import { ClichesGeneratorControllerTestBed } from '../../common/clichesGeneratorControllerTestBed.js';

describe('Existing Clichés Display Regression Test', () => {
  let testBed;

  beforeEach(async () => {
    testBed = new ClichesGeneratorControllerTestBed();
    await testBed.setup();
  });

  afterEach(async () => {
    await testBed.cleanup();
  });

  describe('Regression: Existing Clichés Not Displaying', () => {
    it('should display existing clichés in right panel when direction with clichés is selected', async () => {
      // Arrange: Set up a direction with existing clichés
      const concept = testBed.createCharacterConcept({
        id: 'concept-1',
        concept: 'A mysterious warrior with a dark past',
      });

      const direction = testBed.createThematicDirection({
        id: 'direction-1',
        conceptId: 'concept-1',
        title: 'Dark and Brooding',
        description: 'A character haunted by their past',
      });

      // Generate and store clichés for this direction
      const cliches = testBed.createCliche({
        id: 'cliche-1',
        directionId: 'direction-1',
        conceptId: 'concept-1',
      });

      // Ensure the cliches object has required methods for validation
      cliches.getTotalCount = jest.fn().mockReturnValue(5);
      cliches.getDisplayData = jest.fn().mockReturnValue({
        categories: [
          {
            id: 'names',
            title: 'Character Names',
            count: 3,
            items: ['Shadow', 'Blade', 'Dark'],
          },
        ],
        tropesAndStereotypes: ['Brooding loner', 'Tragic past'],
        metadata: {
          createdAt: new Date().toISOString(),
          totalCount: 5,
        },
      });

      // Set up mock responses
      testBed.mockCharacterBuilderService.getAllThematicDirectionsWithConcepts.mockResolvedValue(
        [{ direction, concept }]
      );
      testBed.mockCharacterBuilderService.hasClichesForDirection.mockResolvedValue(
        true
      );
      testBed.mockCharacterBuilderService.getClichesByDirectionId.mockResolvedValue(
        cliches
      );

      // Initialize controller with DOM elements
      const controller = await testBed.setup();

      // Get references to UI elements that should change
      const generateBtn = document.getElementById('generate-btn');
      const resultsState = document.getElementById('results-state');
      const emptyState = document.getElementById('empty-state');

      // Verify initial state (after directions are loaded, button should be ready)
      expect(generateBtn.disabled).toBe(true); // Should be disabled initially

      // Act: Select the direction that has existing clichés
      const directionSelector = document.getElementById('direction-selector');
      directionSelector.value = direction.id;
      directionSelector.dispatchEvent(new Event('change'));

      // Wait for async operations to complete
      await new Promise((resolve) => setTimeout(resolve, 100));

      // Assert: Verify the UI shows existing clichés correctly
      expect(generateBtn.textContent).toBe('Regenerate Clichés');
      expect(generateBtn.disabled).toBe(false);

      // The critical assertion: results should be visible, empty should be hidden
      // This is the main regression - existing clichés should show in results state
      expect(resultsState.style.display).not.toBe('none');
      expect(emptyState.style.display).toBe('none');

      // Verify clichés content is actually rendered
      const clicheCategories =
        resultsState.querySelectorAll('.cliche-category');
      expect(clicheCategories.length).toBeGreaterThan(0);

      // Verify event was dispatched
      const events = testBed.getDispatchedEvents();
      const loadedEvent = events.find(
        (e) => e.type === 'core:existing_cliches_loaded'
      );
      expect(loadedEvent).toBeDefined();
      expect(loadedEvent.payload.directionId).toBe(direction.id);
      expect(loadedEvent.payload.count).toBeGreaterThan(0);
    });

    it('should show empty state when direction has no existing clichés', async () => {
      // Arrange: Set up a direction without existing clichés
      const concept = testBed.createCharacterConcept({
        id: 'concept-2',
        concept: 'A brave knight',
      });

      const direction = testBed.createThematicDirection({
        id: 'direction-2',
        conceptId: 'concept-2',
        title: 'Noble Hero',
        description: 'A righteous character',
      });

      // Set up mock responses - no existing clichés
      testBed.mockCharacterBuilderService.getAllThematicDirectionsWithConcepts.mockResolvedValue(
        [{ direction, concept }]
      );
      testBed.mockCharacterBuilderService.hasClichesForDirection.mockResolvedValue(
        false
      );
      testBed.mockCharacterBuilderService.getClichesByDirectionId.mockResolvedValue(
        null
      );

      // Initialize controller with DOM elements
      const controller = await testBed.setup();

      // Get references to UI elements
      const generateBtn = document.getElementById('generate-btn');
      const resultsState = document.getElementById('results-state');
      const emptyState = document.getElementById('empty-state');

      // Act: Select the direction that has no existing clichés
      const directionSelector = document.getElementById('direction-selector');
      directionSelector.value = direction.id;
      directionSelector.dispatchEvent(new Event('change'));

      // Wait for async operations
      await new Promise((resolve) => setTimeout(resolve, 100));

      // Assert: Verify the UI shows empty state correctly
      expect(generateBtn.textContent).toBe('Generate Clichés');
      expect(generateBtn.disabled).toBe(false);

      // Should show empty state, not results
      expect(emptyState.style.display).not.toBe('none');
      expect(resultsState.style.display).toBe('none');

      // Verify no existing clichés loaded event was dispatched
      const events = testBed.getDispatchedEvents();
      const loadedEvent = events.find(
        (e) => e.type === 'core:existing_cliches_loaded'
      );
      expect(loadedEvent).toBeUndefined();
    });
  });
});
