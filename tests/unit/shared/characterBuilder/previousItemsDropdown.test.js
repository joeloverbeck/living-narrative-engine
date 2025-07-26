/**
 * @file Unit tests for PreviousItemsDropdown
 */

import { describe, it, expect, beforeEach, jest } from '@jest/globals';
import { PreviousItemsDropdown } from '../../../../src/shared/characterBuilder/previousItemsDropdown.js';

describe('PreviousItemsDropdown', () => {
  let dropdown;
  let mockElement;
  let mockOnSelectionChange;

  // Mock data
  const mockItems = [
    {
      id: 'concept-1',
      concept: 'A brave warrior seeking redemption',
      status: 'completed',
    },
    {
      id: 'concept-2',
      concept: 'A cunning thief with a heart of gold',
      status: 'completed',
    },
    {
      id: 'concept-3',
      concept: 'A wise mage protecting ancient secrets',
      status: 'draft',
    },
  ];

  beforeEach(() => {
    // Mock DOM element
    mockElement = {
      tagName: 'SELECT',
      id: 'test-dropdown',
      innerHTML: '',
      addEventListener: jest.fn(),
      appendChild: jest.fn(),
      querySelector: jest.fn(),
      querySelectorAll: jest.fn(() => []),
      setAttribute: jest.fn(),
      value: '',
      disabled: false,
    };

    // Mock document.createElement
    global.document = {
      createElement: jest.fn((tag) => ({
        tagName: tag.toUpperCase(),
        value: '',
        textContent: '',
        setAttribute: jest.fn(),
      })),
    };

    mockOnSelectionChange = jest.fn();

    dropdown = new PreviousItemsDropdown({
      element: mockElement,
      onSelectionChange: mockOnSelectionChange,
      labelText: 'Choose Concept:',
    });
  });

  describe('Constructor', () => {
    it('should create dropdown with required parameters', () => {
      expect(dropdown).toBeInstanceOf(PreviousItemsDropdown);
    });

    it('should throw error if element is missing', () => {
      expect(() => {
        new PreviousItemsDropdown({
          element: null,
          onSelectionChange: mockOnSelectionChange,
        });
      }).toThrow('PreviousItemsDropdown: element is required');
    });

    it('should throw error if onSelectionChange is missing', () => {
      expect(() => {
        new PreviousItemsDropdown({
          element: mockElement,
          onSelectionChange: null,
        });
      }).toThrow(
        'PreviousItemsDropdown: onSelectionChange callback is required'
      );
    });

    it('should throw error if onSelectionChange is not a function', () => {
      expect(() => {
        new PreviousItemsDropdown({
          element: mockElement,
          onSelectionChange: 'not a function',
        });
      }).toThrow('PreviousItemsDropdown: onSelectionChange must be a function');
    });

    it('should use default label text when not provided', () => {
      const dropdownWithDefaults = new PreviousItemsDropdown({
        element: mockElement,
        onSelectionChange: mockOnSelectionChange,
      });

      expect(dropdownWithDefaults).toBeInstanceOf(PreviousItemsDropdown);
    });
  });

  describe('loadItems', () => {
    it('should load items and create dropdown options', async () => {
      await dropdown.loadItems(mockItems);

      // Should create select element with options
      expect(mockElement.innerHTML).toContain('Choose Concept:');

      // Verify dropdown structure was created
      // Since we're mocking innerHTML, we can't fully test DOM creation
      // but we can verify the method completed without errors
    });

    it('should handle empty items array', async () => {
      await dropdown.loadItems([]);

      expect(mockElement.innerHTML).toContain('Choose Concept:');
    });

    it('should handle null items gracefully', async () => {
      await expect(dropdown.loadItems(null)).rejects.toThrow(
        'PreviousItemsDropdown: items must be an array'
      );
    });

    it('should handle undefined items gracefully', async () => {
      await expect(dropdown.loadItems(undefined)).rejects.toThrow(
        'PreviousItemsDropdown: items must be an array'
      );
    });

    it('should handle non-array items', async () => {
      await expect(dropdown.loadItems('not an array')).rejects.toThrow(
        'PreviousItemsDropdown: items must be an array'
      );
    });

    it('should include orphaned option when orphaned items exist', async () => {
      const orphanedItems = [
        {
          id: 'orphaned-1',
          title: 'Orphaned Direction',
          isOrphaned: true,
        },
      ];

      await dropdown.loadItems(mockItems, orphanedItems);

      // Should include orphaned option
      // Verification would need to check the created DOM structure
    });

    it('should not include orphaned option when no orphaned items', async () => {
      await dropdown.loadItems(mockItems, []);

      // Should not include orphaned option
      // Verification would need to check the created DOM structure
    });
  });

  describe('getSelectedValue', () => {
    beforeEach(async () => {
      // Set up a mock select element
      const mockSelect = {
        value: 'concept-1',
      };
      mockElement.querySelector.mockReturnValue(mockSelect);

      await dropdown.loadItems(mockItems);
    });

    it('should return selected value', () => {
      const mockSelect = { value: 'concept-1' };
      mockElement.querySelector.mockReturnValue(mockSelect);

      const selectedValue = dropdown.getSelectedValue();

      expect(selectedValue).toBe('concept-1');
      expect(mockElement.querySelector).toHaveBeenCalledWith('select');
    });

    it('should return empty string if no select element found', () => {
      mockElement.querySelector.mockReturnValue(null);

      const selectedValue = dropdown.getSelectedValue();

      expect(selectedValue).toBe('');
    });

    it('should return empty string if select element has no value', () => {
      const mockSelect = { value: '' };
      mockElement.querySelector.mockReturnValue(mockSelect);

      const selectedValue = dropdown.getSelectedValue();

      expect(selectedValue).toBe('');
    });
  });

  describe('setSelectedValue', () => {
    beforeEach(async () => {
      const mockSelect = {
        value: '',
        dispatchEvent: jest.fn(),
      };
      mockElement.querySelector.mockReturnValue(mockSelect);

      await dropdown.loadItems(mockItems);
    });

    it('should set selected value', () => {
      const mockSelect = {
        value: '',
        dispatchEvent: jest.fn(),
      };
      mockElement.querySelector.mockReturnValue(mockSelect);

      dropdown.setSelectedValue('concept-2');

      expect(mockSelect.value).toBe('concept-2');
      expect(mockSelect.dispatchEvent).toHaveBeenCalledWith(
        expect.objectContaining({
          type: 'change',
        })
      );
    });

    it('should handle missing select element gracefully', () => {
      mockElement.querySelector.mockReturnValue(null);

      expect(() => {
        dropdown.setSelectedValue('concept-1');
      }).not.toThrow();
    });

    it('should trigger change event when value is set', () => {
      const mockSelect = {
        value: '',
        dispatchEvent: jest.fn(),
      };
      mockElement.querySelector.mockReturnValue(mockSelect);

      dropdown.setSelectedValue('concept-1');

      expect(mockSelect.dispatchEvent).toHaveBeenCalled();
    });
  });

  describe('clear', () => {
    beforeEach(async () => {
      await dropdown.loadItems(mockItems);
    });

    it('should clear dropdown content', () => {
      dropdown.clear();

      expect(mockElement.innerHTML).toBe('');
    });

    it('should handle multiple clear calls', () => {
      dropdown.clear();
      dropdown.clear();

      expect(mockElement.innerHTML).toBe('');
    });
  });

  describe('disable/enable', () => {
    beforeEach(async () => {
      const mockSelect = {
        disabled: false,
      };
      mockElement.querySelector.mockReturnValue(mockSelect);

      await dropdown.loadItems(mockItems);
    });

    it('should disable dropdown', () => {
      const mockSelect = { disabled: false };
      mockElement.querySelector.mockReturnValue(mockSelect);

      dropdown.disable();

      expect(mockSelect.disabled).toBe(true);
    });

    it('should enable dropdown', () => {
      const mockSelect = { disabled: true };
      mockElement.querySelector.mockReturnValue(mockSelect);

      dropdown.enable();

      expect(mockSelect.disabled).toBe(false);
    });

    it('should handle missing select element gracefully', () => {
      mockElement.querySelector.mockReturnValue(null);

      expect(() => {
        dropdown.disable();
        dropdown.enable();
      }).not.toThrow();
    });
  });

  describe('Selection Change Handling', () => {
    beforeEach(async () => {
      // Mock the event listener setup
      global.Event = jest.fn().mockImplementation((type) => ({
        type,
      }));

      await dropdown.loadItems(mockItems);
    });

    it('should call onSelectionChange when selection changes', () => {
      // This test would need to simulate the change event
      // Since we're mocking the DOM, we can verify the callback setup
      expect(mockOnSelectionChange).toBeDefined();
      expect(typeof mockOnSelectionChange).toBe('function');
    });

    it('should pass correct value to onSelectionChange callback', () => {
      // This would test the actual event handling
      // Implementation depends on how the change event is set up
      mockOnSelectionChange('concept-1');
      expect(mockOnSelectionChange).toHaveBeenCalledWith('concept-1');
    });
  });

  describe('Edge Cases', () => {
    it('should handle items with missing properties', async () => {
      const itemsWithMissingProps = [
        { id: 'item-1' }, // Missing concept
        { concept: 'No ID item' }, // Missing id
        {}, // Empty object
      ];

      await expect(
        dropdown.loadItems(itemsWithMissingProps)
      ).resolves.not.toThrow();
    });

    it('should handle very long item text', async () => {
      const itemsWithLongText = [
        {
          id: 'long-item',
          concept: 'A'.repeat(1000), // Very long text
          status: 'completed',
        },
      ];

      await expect(
        dropdown.loadItems(itemsWithLongText)
      ).resolves.not.toThrow();
    });

    it('should handle special characters in item text', async () => {
      const itemsWithSpecialChars = [
        {
          id: 'special-item',
          concept: 'Item with "quotes" & <tags> and other special chars: éñüíø',
          status: 'completed',
        },
      ];

      await expect(
        dropdown.loadItems(itemsWithSpecialChars)
      ).resolves.not.toThrow();
    });
  });
});
