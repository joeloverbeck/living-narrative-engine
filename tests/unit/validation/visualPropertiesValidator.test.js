/**
 * @file Unit tests for visual properties validator
 */

import {
  describe,
  it,
  expect,
  jest,
  beforeEach,
  afterEach,
} from '@jest/globals';
import {
  validateVisualProperties,
  hasVisualProperties,
  countActionsWithVisualProperties,
} from '../../../src/validation/visualPropertiesValidator.js';
import {
  VALID_COLORS,
  INVALID_COLORS,
  runVisualPropertiesPerformanceTest,
} from '../../common/mockFactories/visualProperties.js';

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

  describe('edge cases and comprehensive validation', () => {
    let consoleSpy;

    beforeEach(() => {
      consoleSpy = jest.spyOn(console, 'warn').mockImplementation();
    });

    afterEach(() => {
      consoleSpy.mockRestore();
    });

    it('should handle null and undefined inputs gracefully', () => {
      expect(() => validateVisualProperties(null, 'test:action')).toThrow(
        'Invalid visual properties for action test:action: expected object'
      );
      expect(() => validateVisualProperties(undefined, 'test:action')).toThrow(
        'Invalid visual properties for action test:action: expected object'
      );
    });

    it('should handle arrays and primitive types correctly', () => {
      // Arrays are objects in JavaScript, so they won't throw the "expected object" error
      // But they should still be handled properly (empty array = no properties)
      const result = validateVisualProperties([], 'test:action');
      expect(result).toEqual({});

      expect(() => validateVisualProperties(123, 'test:action')).toThrow(
        'Invalid visual properties for action test:action: expected object'
      );
      expect(() => validateVisualProperties(true, 'test:action')).toThrow(
        'Invalid visual properties for action test:action: expected object'
      );
    });

    it('should provide clear error messages for each property', () => {
      const testCases = [
        { prop: 'backgroundColor', value: 'invalid' },
        { prop: 'textColor', value: 123 },
        { prop: 'hoverBackgroundColor', value: null },
        { prop: 'hoverTextColor', value: {} },
      ];

      testCases.forEach(({ prop, value }) => {
        const visual = { [prop]: value };
        expect(() => validateVisualProperties(visual, 'test:action')).toThrow(
          'Invalid visual properties for action test:action'
        );
      });
    });

    it('should warn about multiple unknown properties', () => {
      const visual = {
        backgroundColor: '#ff0000',
        unknownProp1: 'value1',
        unknownProp2: 'value2',
        anotherUnknown: 'value3',
      };

      expect(() => validateVisualProperties(visual, 'test:action')).toThrow(
        'Unknown visual properties: unknownProp1, unknownProp2, anotherUnknown'
      );
    });

    it('should handle deeply nested invalid structures', () => {
      const visual = {
        backgroundColor: '#ff0000',
        nested: { invalid: 'structure' },
      };

      expect(() => validateVisualProperties(visual, 'test:action')).toThrow(
        'Unknown visual properties: nested'
      );
    });

    it('should validate all color formats from VALID_COLORS', () => {
      Object.entries(VALID_COLORS).forEach(([format, color]) => {
        // Skip non-string formats for this validator
        if (typeof color !== 'string') return;

        const visual = { backgroundColor: color };

        // Update mock to handle more color formats
        const {
          validateColor,
        } = require('../../../src/utils/colorValidation.js');
        validateColor.mockImplementationOnce(() => true);

        expect(() =>
          validateVisualProperties(visual, 'test:action')
        ).not.toThrow();
      });
    });

    it('should reject all invalid color formats from INVALID_COLORS', () => {
      Object.entries(INVALID_COLORS).forEach(([format, color]) => {
        // Skip null/undefined as they're handled differently
        if (color === null || color === undefined) return;

        const visual = { backgroundColor: color };

        // Update mock to reject invalid colors
        const {
          validateColor,
        } = require('../../../src/utils/colorValidation.js');
        validateColor.mockImplementationOnce(() => false);

        expect(() => validateVisualProperties(visual, 'test:action')).toThrow();
      });
    });
  });

  describe('performance benchmarks', () => {
    it('should validate 1000 colors in under 100ms', () => {
      const {
        validateColor,
      } = require('../../../src/utils/colorValidation.js');

      const result = runVisualPropertiesPerformanceTest(
        () => {
          validateColor('#ff0000');
        },
        1000,
        100
      );

      expect(result.passed).toBe(true);
      expect(result.duration).toBeLessThan(100);
      console.log(
        `Validated ${result.iterations} colors in ${result.duration.toFixed(2)}ms`
      );
    });

    it('should validate complex visual properties quickly', () => {
      const complexVisual = {
        backgroundColor: '#ff0000',
        textColor: '#ffffff',
        hoverBackgroundColor: '#cc0000',
        hoverTextColor: '#ffcccc',
      };

      const result = runVisualPropertiesPerformanceTest(
        () => {
          try {
            validateVisualProperties(complexVisual, 'test:action');
          } catch (e) {
            // Ignore validation errors for performance test
          }
        },
        500,
        100
      );

      expect(result.passed).toBe(true);
      console.log(
        `Validated ${result.iterations} complex visual properties in ${result.duration.toFixed(2)}ms`
      );
    });

    it('should handle large batches of actions efficiently', () => {
      const actions = Array(100)
        .fill(null)
        .map((_, i) => ({
          id: `action${i}`,
          visual: i % 2 === 0 ? { backgroundColor: '#ff0000' } : null,
        }));

      const startTime = performance.now();
      const count = countActionsWithVisualProperties(actions);
      const endTime = performance.now();

      expect(count).toBe(50);
      expect(endTime - startTime).toBeLessThan(10);
      console.log(
        `Counted visual properties in ${actions.length} actions in ${(endTime - startTime).toFixed(2)}ms`
      );
    });
  });
});
