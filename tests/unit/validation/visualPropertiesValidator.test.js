/**
 * @file Unit tests for visual properties validator
 */

import { describe, it, expect, jest } from '@jest/globals';
import {
  validateVisualProperties,
  hasVisualProperties,
  countActionsWithVisualProperties,
} from '../../../src/validation/visualPropertiesValidator.js';

// Mock the colorValidation module
jest.mock('../../../src/utils/colorValidation.js', () => ({
  validateColor: jest.fn((color) => {
    // Simple mock validation - accepts strings starting with # or named colors
    if (typeof color !== 'string') return false;
    return color.startsWith('#') || ['red', 'white', 'black'].includes(color);
  }),
  getColorErrorMessage: jest.fn((color) => `Invalid color: ${color}`),
}));

describe('visualPropertiesValidator', () => {
  describe('validateVisualProperties', () => {
    it('should validate valid visual properties', () => {
      const visual = {
        backgroundColor: '#ff0000',
        textColor: '#ffffff',
        hoverBackgroundColor: '#cc0000',
        hoverTextColor: '#ffcccc',
      };

      const result = validateVisualProperties(visual, 'test:action');

      expect(result).toEqual(visual);
    });

    it('should validate partial visual properties', () => {
      const visual = {
        backgroundColor: '#ff0000',
        textColor: '#ffffff',
      };

      const result = validateVisualProperties(visual, 'test:action');

      expect(result).toEqual(visual);
    });

    it('should validate single visual property', () => {
      const visual = {
        backgroundColor: 'red',
      };

      const result = validateVisualProperties(visual, 'test:action');

      expect(result).toEqual(visual);
    });

    it('should throw error for invalid color value', () => {
      const visual = {
        backgroundColor: 'invalid-color',
      };

      expect(() => {
        validateVisualProperties(visual, 'test:action');
      }).toThrow('Invalid visual properties for action test:action');
    });

    it('should throw error for non-object visual properties', () => {
      expect(() => {
        validateVisualProperties(null, 'test:action');
      }).toThrow(
        'Invalid visual properties for action test:action: expected object'
      );

      expect(() => {
        validateVisualProperties('string', 'test:action');
      }).toThrow(
        'Invalid visual properties for action test:action: expected object'
      );
    });

    it('should throw error for unknown properties', () => {
      const visual = {
        backgroundColor: '#ff0000',
        unknownProperty: 'value',
      };

      expect(() => {
        validateVisualProperties(visual, 'test:action');
      }).toThrow('Unknown visual properties: unknownProperty');
    });

    it('should handle empty object', () => {
      const visual = {};
      const result = validateVisualProperties(visual, 'test:action');
      expect(result).toEqual({});
    });
  });

  describe('hasVisualProperties', () => {
    it('should return true for objects with visual properties', () => {
      const data = {
        id: 'test:action',
        visual: {
          backgroundColor: '#ff0000',
        },
      };

      expect(hasVisualProperties(data)).toBe(true);
    });

    it('should return false for objects without visual properties', () => {
      const data = {
        id: 'test:action',
      };

      expect(hasVisualProperties(data)).toBe(false);
    });

    it('should return false for objects with empty visual property', () => {
      const data = {
        id: 'test:action',
        visual: {},
      };

      expect(hasVisualProperties(data)).toBe(false);
    });

    it('should return false for null visual property', () => {
      const data = {
        id: 'test:action',
        visual: null,
      };

      expect(hasVisualProperties(data)).toBe(false);
    });

    it('should return false for non-object visual property', () => {
      const data = {
        id: 'test:action',
        visual: 'string',
      };

      expect(hasVisualProperties(data)).toBe(false);
    });

    it('should return false for null or undefined data', () => {
      expect(hasVisualProperties(null)).toBe(false);
      expect(hasVisualProperties(undefined)).toBe(false);
    });

    it('should return false for non-object data', () => {
      expect(hasVisualProperties('string')).toBe(false);
      expect(hasVisualProperties(123)).toBe(false);
      expect(hasVisualProperties(true)).toBe(false);
    });
  });

  describe('countActionsWithVisualProperties', () => {
    it('should count actions with visual properties', () => {
      const actions = [
        { id: 'action1', visual: { backgroundColor: '#ff0000' } },
        { id: 'action2', visual: { textColor: '#ffffff' } },
        { id: 'action3' },
        { id: 'action4', visual: {} },
        { id: 'action5', visual: { backgroundColor: '#00ff00' } },
      ];

      expect(countActionsWithVisualProperties(actions)).toBe(3);
    });

    it('should return 0 for empty array', () => {
      expect(countActionsWithVisualProperties([])).toBe(0);
    });

    it('should return 0 for array with no visual properties', () => {
      const actions = [{ id: 'action1' }, { id: 'action2' }, { id: 'action3' }];

      expect(countActionsWithVisualProperties(actions)).toBe(0);
    });

    it('should return 0 for non-array input', () => {
      expect(countActionsWithVisualProperties(null)).toBe(0);
      expect(countActionsWithVisualProperties(undefined)).toBe(0);
      expect(countActionsWithVisualProperties('string')).toBe(0);
      expect(countActionsWithVisualProperties({})).toBe(0);
    });

    it('should handle mixed valid and invalid visual properties', () => {
      const actions = [
        { id: 'action1', visual: { backgroundColor: '#ff0000' } }, // Valid
        { id: 'action2', visual: null }, // Invalid
        { id: 'action3', visual: {} }, // Invalid (empty)
        { id: 'action4', visual: { textColor: 'white' } }, // Valid
        { id: 'action5', visual: 'string' }, // Invalid
      ];

      expect(countActionsWithVisualProperties(actions)).toBe(2);
    });
  });
});
