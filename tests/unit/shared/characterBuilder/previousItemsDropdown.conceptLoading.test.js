/**
 * @file Unit test for PreviousItemsDropdown concept loading functionality
 * @description Tests the specific scenario of loading character concepts into the dropdown
 */

import {
  describe,
  it,
  expect,
  beforeEach,
  afterEach,
  jest,
} from '@jest/globals';
import { PreviousItemsDropdown } from '../../../../src/shared/characterBuilder/previousItemsDropdown.js';

describe('PreviousItemsDropdown - Concept Loading', () => {
  let selectElement;
  let dropdown;
  let mockSelectionHandler;

  beforeEach(() => {
    // Create a fresh DOM environment for each test
    document.body.innerHTML =
      '<select id="test-selector" class="cb-select"></select>';

    selectElement = document.getElementById('test-selector');
    mockSelectionHandler = jest.fn();

    dropdown = new PreviousItemsDropdown({
      element: selectElement,
      onSelectionChange: mockSelectionHandler,
      labelText: 'Choose Concept:',
    });
  });

  afterEach(() => {
    if (dropdown) {
      dropdown.destroy();
    }
    document.body.innerHTML = '';
  });

  describe('Concept Data Loading', () => {
    it('should load character concepts with correct structure', async () => {
      const mockConcepts = [
        {
          id: 'concept-1',
          concept:
            'A brave warrior seeking redemption after a terrible mistake',
          status: 'active',
          createdAt: '2024-01-01T00:00:00.000Z',
        },
        {
          id: 'concept-2',
          concept:
            'A cunning rogue with a heart of gold who steals from the rich to help the poor',
          status: 'active',
          createdAt: '2024-01-02T00:00:00.000Z',
        },
        {
          id: 'concept-3',
          concept: 'A wise mage seeking ancient knowledge',
          status: 'draft',
          createdAt: '2024-01-03T00:00:00.000Z',
        },
      ];

      // Load concepts into dropdown
      await dropdown.loadItems(mockConcepts);

      // Check that options were created
      const options = Array.from(selectElement.options);

      // Should have: empty option + orphaned option + 3 concepts = 5 options
      expect(options).toHaveLength(5);

      // Verify default options exist
      expect(options[0].value).toBe('');
      expect(options[0].textContent).toBe('-- All Items --');

      expect(options[1].value).toBe('orphaned');
      expect(options[1].textContent).toBe('🚨 Orphaned Items');

      // Verify concept options
      expect(options[2].value).toBe('concept-1');
      expect(options[2].textContent).toBe(
        'A brave warrior seeking redemption after a terrible mistake'
      );

      expect(options[3].value).toBe('concept-2');
      expect(options[3].textContent).toBe(
        'A cunning rogue with a heart of gold who steals from the ...'
      );

      expect(options[4].value).toBe('concept-3');
      expect(options[4].textContent).toBe(
        'A wise mage seeking ancient knowledge'
      );
    });

    it('should handle long concept text by truncating appropriately', async () => {
      const mockConcepts = [
        {
          id: 'long-concept',
          concept:
            'This is an extremely long character concept that should definitely be truncated because it exceeds the reasonable length limit for dropdown display and user experience',
          status: 'active',
          createdAt: '2024-01-01T00:00:00.000Z',
        },
      ];

      await dropdown.loadItems(mockConcepts);

      const options = Array.from(selectElement.options);
      const conceptOption = options.find(
        (option) => option.value === 'long-concept'
      );

      expect(conceptOption).toBeDefined();
      expect(conceptOption.textContent).toHaveLength(60); // 57 chars + '...' = 60
      expect(conceptOption.textContent).toEndWith('...');
      expect(conceptOption.textContent).toBe(
        'This is an extremely long character concept that should d...'
      );
    });

    it('should handle empty concepts array gracefully', async () => {
      const mockConcepts = [];

      await dropdown.loadItems(mockConcepts);

      const options = Array.from(selectElement.options);

      // Should have only default options: empty + orphaned = 2 options
      expect(options).toHaveLength(2);
      expect(options[0].value).toBe('');
      expect(options[1].value).toBe('orphaned');
    });

    it('should handle null concepts array', async () => {
      await expect(dropdown.loadItems(null)).rejects.toThrow(
        'PreviousItemsDropdown: items must be an array'
      );
    });

    it('should handle undefined concepts array', async () => {
      await expect(dropdown.loadItems(undefined)).rejects.toThrow(
        'PreviousItemsDropdown: items must be an array'
      );
    });

    it('should handle non-array input', async () => {
      await expect(dropdown.loadItems('not-an-array')).rejects.toThrow(
        'PreviousItemsDropdown: items must be an array'
      );
      await expect(dropdown.loadItems({})).rejects.toThrow(
        'PreviousItemsDropdown: items must be an array'
      );
      await expect(dropdown.loadItems(123)).rejects.toThrow(
        'PreviousItemsDropdown: items must be an array'
      );
    });
  });

  describe('Concept Selection', () => {
    it('should trigger selection handler when concept is selected', async () => {
      const mockConcepts = [
        {
          id: 'concept-1',
          concept: 'A brave warrior seeking redemption',
          status: 'active',
          createdAt: '2024-01-01T00:00:00.000Z',
        },
      ];

      await dropdown.loadItems(mockConcepts);

      // Select the concept
      selectElement.value = 'concept-1';
      selectElement.dispatchEvent(new Event('change', { bubbles: true }));

      expect(mockSelectionHandler).toHaveBeenCalledWith('concept-1');
      expect(mockSelectionHandler).toHaveBeenCalledTimes(1);
    });

    it('should return correct selected item object', async () => {
      const mockConcepts = [
        {
          id: 'concept-1',
          concept: 'A brave warrior seeking redemption',
          status: 'active',
          createdAt: '2024-01-01T00:00:00.000Z',
        },
        {
          id: 'concept-2',
          concept: 'A cunning rogue',
          status: 'draft',
          createdAt: '2024-01-02T00:00:00.000Z',
        },
      ];

      await dropdown.loadItems(mockConcepts);

      // Select concept-2
      dropdown.selectItem('concept-2');

      const selectedItem = dropdown.getSelectedItem();
      expect(selectedItem).toEqual(mockConcepts[1]);
      expect(selectedItem.id).toBe('concept-2');
      expect(selectedItem.concept).toBe('A cunning rogue');
    });

    it('should handle orphaned selection', async () => {
      const mockConcepts = [
        {
          id: 'concept-1',
          concept: 'A brave warrior',
          status: 'active',
          createdAt: '2024-01-01T00:00:00.000Z',
        },
      ];

      await dropdown.loadItems(mockConcepts);

      // Select orphaned option
      selectElement.value = 'orphaned';
      selectElement.dispatchEvent(new Event('change', { bubbles: true }));

      expect(mockSelectionHandler).toHaveBeenCalledWith('orphaned');
      expect(dropdown.getSelectedItemId()).toBe('orphaned');
      expect(dropdown.getSelectedItem()).toBeNull(); // No actual item for "orphaned"
    });

    it('should handle empty selection (all concepts)', async () => {
      const mockConcepts = [
        {
          id: 'concept-1',
          concept: 'A brave warrior',
          status: 'active',
          createdAt: '2024-01-01T00:00:00.000Z',
        },
      ];

      await dropdown.loadItems(mockConcepts);

      // Select empty option (all concepts)
      selectElement.value = '';
      selectElement.dispatchEvent(new Event('change', { bubbles: true }));

      expect(mockSelectionHandler).toHaveBeenCalledWith('');
      expect(dropdown.getSelectedItemId()).toBe('');
      expect(dropdown.getSelectedItem()).toBeNull();
    });
  });

  describe('Integration with ThematicDirectionsManager Expected Flow', () => {
    it('should work with the expected data format from getAllThematicDirectionsWithConcepts', async () => {
      // Simulate the data format that comes from the service
      const mockDirectionsWithConcepts = [
        {
          direction: {
            id: 'dir-1',
            conceptId: 'concept-1',
            title: 'Test Direction 1',
          },
          concept: {
            id: 'concept-1',
            concept: 'A brave warrior seeking redemption',
            status: 'active',
            createdAt: '2024-01-01T00:00:00.000Z',
          },
        },
        {
          direction: {
            id: 'dir-2',
            conceptId: 'concept-2',
            title: 'Test Direction 2',
          },
          concept: {
            id: 'concept-2',
            concept: 'A cunning rogue with a mysterious past',
            status: 'active',
            createdAt: '2024-01-02T00:00:00.000Z',
          },
        },
        {
          direction: {
            id: 'dir-3',
            conceptId: 'missing-concept',
            title: 'Orphaned Direction',
          },
          concept: null, // Orphaned direction
        },
      ];

      // Extract concepts the same way the controller should
      const conceptsWithDirections = mockDirectionsWithConcepts
        .filter((item) => item.concept !== null)
        .map((item) => item.concept)
        .filter(
          (concept, index, array) =>
            // Remove duplicates by id
            array.findIndex((c) => c.id === concept.id) === index
        );

      expect(conceptsWithDirections).toHaveLength(2);

      // Load into dropdown
      await dropdown.loadItems(conceptsWithDirections);

      const options = Array.from(selectElement.options);

      // Should have: empty + orphaned + 2 concepts = 4 options
      expect(options).toHaveLength(4);

      // Verify the concepts are loaded correctly
      const conceptOptions = options.filter((option) =>
        option.value.startsWith('concept-')
      );
      expect(conceptOptions).toHaveLength(2);
      expect(conceptOptions[0].value).toBe('concept-1');
      expect(conceptOptions[1].value).toBe('concept-2');
    });

    it('should match the expected dropdown configuration for thematic directions', async () => {
      // Test the exact configuration expected by ThematicDirectionsManagerController
      const concepts = [
        {
          id: 'concept-1',
          concept: 'Test concept for thematic directions',
          status: 'active',
          createdAt: '2024-01-01T00:00:00.000Z',
        },
      ];

      // Use the same options that the controller uses
      const options = {
        emptyText: '-- All Items --', // Default value
        valueProperty: 'id', // Default value
        labelProperty: 'concept', // Default value - this is what the controller expects!
      };

      await dropdown.loadItems(concepts, options);

      const selectOptions = Array.from(selectElement.options);
      const conceptOption = selectOptions.find(
        (option) => option.value === 'concept-1'
      );

      expect(conceptOption).toBeDefined();
      expect(conceptOption.textContent).toBe(
        'Test concept for thematic directions'
      );

      // Verify the dropdown is using the correct property for labeling
      // This is crucial for the bug - if labelProperty is wrong, concepts won't show properly
      expect(conceptOption.textContent).toBe(concepts[0].concept);
    });
  });

  describe('Error Conditions and Edge Cases', () => {
    it('should handle concepts with missing required properties', async () => {
      const mockConcepts = [
        { id: 'concept-1' }, // Missing 'concept' property
        { concept: 'Missing ID concept' }, // Missing 'id' property
        { id: 'concept-3', concept: '' }, // Empty concept text
        { id: 'concept-4', concept: null }, // Null concept text
      ];

      await dropdown.loadItems(mockConcepts);

      const options = Array.from(selectElement.options);

      // Should handle gracefully - empty/null concepts should still create options
      expect(options.length).toBeGreaterThanOrEqual(2); // At least empty + orphaned

      // Find the options that were created
      const conceptOptions = options.filter((option) =>
        option.value.startsWith('concept-')
      );

      // Should handle missing properties gracefully
      conceptOptions.forEach((option) => {
        expect(option.value).toBeTruthy(); // Should have some value
        expect(option.textContent).toBeDefined(); // Should have some text (even if empty)
      });
    });

    it('should clear previous options when loading new concepts', async () => {
      const firstConcepts = [{ id: 'concept-1', concept: 'First concept' }];

      const secondConcepts = [
        { id: 'concept-2', concept: 'Second concept' },
        { id: 'concept-3', concept: 'Third concept' },
      ];

      // Load first set
      await dropdown.loadItems(firstConcepts);
      expect(selectElement.options).toHaveLength(3); // empty + orphaned + concept-1

      // Load second set - should replace, not append
      await dropdown.loadItems(secondConcepts);
      expect(selectElement.options).toHaveLength(4); // empty + orphaned + concept-2 + concept-3

      // Verify old concept is gone, new ones are present
      const optionValues = Array.from(selectElement.options).map(
        (option) => option.value
      );
      expect(optionValues).not.toContain('concept-1');
      expect(optionValues).toContain('concept-2');
      expect(optionValues).toContain('concept-3');
    });
  });
});
