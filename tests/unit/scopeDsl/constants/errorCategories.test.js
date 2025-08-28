/**
 * @file Unit tests for ErrorCategories constant
 */

import { describe, it, expect } from '@jest/globals';
import { ErrorCategories } from '../../../../src/scopeDsl/constants/errorCategories.js';

describe('ErrorCategories', () => {
  describe('Constant Structure', () => {
    it('should be defined and exported', () => {
      expect(ErrorCategories).toBeDefined();
      expect(typeof ErrorCategories).toBe('object');
    });

    it('should be frozen and immutable', () => {
      expect(Object.isFrozen(ErrorCategories)).toBe(true);
      
      // Attempt to modify should throw in strict mode
      expect(() => {
        ErrorCategories.MISSING_CONTEXT = 'modified_value';
      }).toThrow();

      // Attempt to add new property should throw in strict mode
      expect(() => {
        ErrorCategories.NEW_CATEGORY = 'new_value';
      }).toThrow();
    });

    it('should have all expected categories', () => {
      const expectedCategories = [
        'MISSING_CONTEXT',
        'INVALID_DATA',
        'RESOLUTION_FAILURE',
        'CYCLE_DETECTED',
        'DEPTH_EXCEEDED',
        'PARSE_ERROR',
        'CONFIGURATION',
        'UNKNOWN',
      ];

      expectedCategories.forEach(category => {
        expect(ErrorCategories).toHaveProperty(category);
        expect(typeof ErrorCategories[category]).toBe('string');
        expect(ErrorCategories[category]).toBeTruthy();
      });
    });

    it('should have exactly 8 categories', () => {
      const categories = Object.keys(ErrorCategories);
      expect(categories).toHaveLength(8);
    });
  });

  describe('Category Values', () => {
    it('should have correct category values', () => {
      expect(ErrorCategories.MISSING_CONTEXT).toBe('missing_context');
      expect(ErrorCategories.INVALID_DATA).toBe('invalid_data');
      expect(ErrorCategories.RESOLUTION_FAILURE).toBe('resolution_failure');
      expect(ErrorCategories.CYCLE_DETECTED).toBe('cycle_detected');
      expect(ErrorCategories.DEPTH_EXCEEDED).toBe('depth_exceeded');
      expect(ErrorCategories.PARSE_ERROR).toBe('parse_error');
      expect(ErrorCategories.CONFIGURATION).toBe('configuration');
      expect(ErrorCategories.UNKNOWN).toBe('unknown');
    });

    it('should have unique category values', () => {
      const values = Object.values(ErrorCategories);
      const uniqueValues = [...new Set(values)];
      expect(uniqueValues).toHaveLength(values.length);
    });

    it('should use snake_case format for all values', () => {
      Object.values(ErrorCategories).forEach(value => {
        expect(value).toMatch(/^[a-z]+(_[a-z]+)*$/);
      });
    });
  });

  describe('Category Mapping', () => {
    it('should provide reverse mapping capability', () => {
      const reverseMap = {};
      Object.entries(ErrorCategories).forEach(([key, value]) => {
        reverseMap[value] = key;
      });

      expect(reverseMap['missing_context']).toBe('MISSING_CONTEXT');
      expect(reverseMap['invalid_data']).toBe('INVALID_DATA');
      expect(reverseMap['resolution_failure']).toBe('RESOLUTION_FAILURE');
      expect(reverseMap['cycle_detected']).toBe('CYCLE_DETECTED');
      expect(reverseMap['depth_exceeded']).toBe('DEPTH_EXCEEDED');
      expect(reverseMap['parse_error']).toBe('PARSE_ERROR');
      expect(reverseMap['configuration']).toBe('CONFIGURATION');
      expect(reverseMap['unknown']).toBe('UNKNOWN');
    });
  });

  describe('Backward Compatibility', () => {
    it('should maintain compatibility with existing error handler expectations', () => {
      // These values should match what the error handler expects
      const expectedMappings = {
        MISSING_CONTEXT: 'missing_context',
        INVALID_DATA: 'invalid_data',
        RESOLUTION_FAILURE: 'resolution_failure',
        CYCLE_DETECTED: 'cycle_detected',
        DEPTH_EXCEEDED: 'depth_exceeded',
        PARSE_ERROR: 'parse_error',
        CONFIGURATION: 'configuration',
        UNKNOWN: 'unknown',
      };

      Object.entries(expectedMappings).forEach(([key, expectedValue]) => {
        expect(ErrorCategories[key]).toBe(expectedValue);
      });
    });
  });

  describe('Edge Cases', () => {
    it('should not have null or undefined values', () => {
      Object.values(ErrorCategories).forEach(value => {
        expect(value).not.toBeNull();
        expect(value).not.toBeUndefined();
        expect(value).not.toBe('');
      });
    });

    it('should not have numeric values', () => {
      Object.values(ErrorCategories).forEach(value => {
        expect(typeof value).toBe('string');
        expect(isNaN(Number(value))).toBe(true);
      });
    });

    it('should handle iteration correctly', () => {
      let count = 0;
      for (const category in ErrorCategories) {
        count++;
        expect(typeof ErrorCategories[category]).toBe('string');
      }
      expect(count).toBe(8);
    });
  });
});