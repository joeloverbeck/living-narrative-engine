/**
 * @file Unit tests for OrientationResolver
 * Validates all orientation schemes and edge cases for the shared resolver module.
 */

import { describe, it, expect } from '@jest/globals';
import { OrientationResolver } from '../../../../src/anatomy/shared/orientationResolver.js';

describe('OrientationResolver', () => {
  describe('bilateral scheme', () => {
    it('should resolve left/right for count=2 (1-based indexing)', () => {
      // Note: Tests use 1-based indices to match actual caller behavior
      expect(
        OrientationResolver.resolveOrientation('bilateral', 1, 2)
      ).toBe('left');
      expect(
        OrientationResolver.resolveOrientation('bilateral', 2, 2)
      ).toBe('right');
    });

    it('should resolve quadrupedal positions for count=4 (1-based indexing)', () => {
      // Note: Position names follow actual implementation (left_front not front_left)
      expect(
        OrientationResolver.resolveOrientation('bilateral', 1, 4)
      ).toBe('left_front');
      expect(
        OrientationResolver.resolveOrientation('bilateral', 2, 4)
      ).toBe('right_front');
      expect(
        OrientationResolver.resolveOrientation('bilateral', 3, 4)
      ).toBe('left_rear');
      expect(
        OrientationResolver.resolveOrientation('bilateral', 4, 4)
      ).toBe('right_rear');
    });

    it('should handle quadrupedal arrangement explicitly (1-based indexing)', () => {
      expect(
        OrientationResolver.resolveOrientation('quadrupedal', 1, 4)
      ).toBe('left_front');
      expect(
        OrientationResolver.resolveOrientation('quadrupedal', 2, 4)
      ).toBe('right_front');
      expect(
        OrientationResolver.resolveOrientation('quadrupedal', 3, 4)
      ).toBe('left_rear');
      expect(
        OrientationResolver.resolveOrientation('quadrupedal', 4, 4)
      ).toBe('right_rear');
    });

    it('should alternate left/right for counts other than 2 or 4', () => {
      // Count of 6 should alternate left/right
      expect(
        OrientationResolver.resolveOrientation('bilateral', 1, 6)
      ).toBe('left');
      expect(
        OrientationResolver.resolveOrientation('bilateral', 2, 6)
      ).toBe('right');
      expect(
        OrientationResolver.resolveOrientation('bilateral', 3, 6)
      ).toBe('left');
      expect(
        OrientationResolver.resolveOrientation('bilateral', 4, 6)
      ).toBe('right');
      expect(
        OrientationResolver.resolveOrientation('bilateral', 5, 6)
      ).toBe('left');
      expect(
        OrientationResolver.resolveOrientation('bilateral', 6, 6)
      ).toBe('right');
    });

    it('should fallback to index string for out-of-bounds (1-based indexing)', () => {
      // Out of bounds for count=4
      expect(
        OrientationResolver.resolveOrientation('bilateral', 5, 4)
      ).toBe('5');
      expect(
        OrientationResolver.resolveOrientation('bilateral', 10, 4)
      ).toBe('10');
    });
  });

  describe('radial scheme', () => {
    it('should resolve octagonal compass directions for count=8 (1-based indexing)', () => {
      // Note: Uses anatomical terms (anterior/posterior) not directional (front/back)
      const expected = [
        'anterior',
        'anterior_right',
        'right',
        'posterior_right',
        'posterior',
        'posterior_left',
        'left',
        'anterior_left',
      ];

      // Note: Using 1-based indexing (starting at 1, not 0)
      for (let i = 1; i <= 8; i++) {
        expect(OrientationResolver.resolveOrientation('radial', i, 8)).toBe(
          expected[i - 1]
        );
      }
    });

    it('should use custom positions when provided (1-based indexing)', () => {
      const positions = ['north', 'east', 'south', 'west'];
      expect(
        OrientationResolver.resolveOrientation('radial', 1, 4, positions)
      ).toBe('north');
      expect(
        OrientationResolver.resolveOrientation('radial', 2, 4, positions)
      ).toBe('east');
      expect(
        OrientationResolver.resolveOrientation('radial', 3, 4, positions)
      ).toBe('south');
      expect(
        OrientationResolver.resolveOrientation('radial', 4, 4, positions)
      ).toBe('west');
    });

    it('should fallback to index string if positions not provided (1-based indexing)', () => {
      // Count of 6 (not 8, so no default octagonal positions)
      expect(OrientationResolver.resolveOrientation('radial', 1, 6)).toBe('1');
      expect(OrientationResolver.resolveOrientation('radial', 5, 6)).toBe('5');
      expect(OrientationResolver.resolveOrientation('radial', 6, 6)).toBe('6');
    });

    it('should fallback to index string if custom positions array too short (1-based indexing)', () => {
      const positions = ['alpha', 'beta']; // Only 2 positions
      expect(
        OrientationResolver.resolveOrientation('radial', 1, 5, positions)
      ).toBe('alpha');
      expect(
        OrientationResolver.resolveOrientation('radial', 2, 5, positions)
      ).toBe('beta');
      expect(
        OrientationResolver.resolveOrientation('radial', 3, 5, positions)
      ).toBe('3'); // Fallback
      expect(
        OrientationResolver.resolveOrientation('radial', 4, 5, positions)
      ).toBe('4'); // Fallback
    });

    it('should handle empty positions array (1-based indexing)', () => {
      // Count 8 with empty array should still use octagonal default
      expect(OrientationResolver.resolveOrientation('radial', 1, 8, [])).toBe(
        'anterior'
      );

      // Count 6 with empty array should fallback to index
      expect(OrientationResolver.resolveOrientation('radial', 1, 6, [])).toBe(
        '1'
      );
    });

    it('should fallback to index string for out-of-bounds octagonal (1-based indexing)', () => {
      expect(OrientationResolver.resolveOrientation('radial', 9, 8)).toBe('9');
      expect(
        OrientationResolver.resolveOrientation('radial', 10, 8)
      ).toBe('10');
    });
  });

  describe('custom scheme', () => {
    it('should use provided positions (1-based indexing)', () => {
      const positions = ['alpha', 'beta', 'gamma', 'delta'];
      expect(
        OrientationResolver.resolveOrientation('custom', 1, 4, positions)
      ).toBe('alpha');
      expect(
        OrientationResolver.resolveOrientation('custom', 2, 4, positions)
      ).toBe('beta');
      expect(
        OrientationResolver.resolveOrientation('custom', 3, 4, positions)
      ).toBe('gamma');
      expect(
        OrientationResolver.resolveOrientation('custom', 4, 4, positions)
      ).toBe('delta');
    });

    it('should fallback to index if no positions (1-based indexing)', () => {
      expect(OrientationResolver.resolveOrientation('custom', 1, 1)).toBe('1');
      expect(OrientationResolver.resolveOrientation('custom', 5, 5)).toBe('5');
    });

    it('should fallback to index if positions undefined (1-based indexing)', () => {
      expect(
        OrientationResolver.resolveOrientation('custom', 1, 3, undefined)
      ).toBe('1');
      expect(
        OrientationResolver.resolveOrientation('custom', 3, 3, undefined)
      ).toBe('3');
    });

    it('should fallback to index if positions empty array (1-based indexing)', () => {
      expect(OrientationResolver.resolveOrientation('custom', 1, 3, [])).toBe(
        '1'
      );
      expect(OrientationResolver.resolveOrientation('custom', 2, 3, [])).toBe(
        '2'
      );
    });

    it('should fallback to index if out of bounds (1-based indexing)', () => {
      const positions = ['first', 'second'];
      expect(
        OrientationResolver.resolveOrientation('custom', 1, 5, positions)
      ).toBe('first');
      expect(
        OrientationResolver.resolveOrientation('custom', 2, 5, positions)
      ).toBe('second');
      expect(
        OrientationResolver.resolveOrientation('custom', 3, 5, positions)
      ).toBe('3'); // Fallback
      expect(
        OrientationResolver.resolveOrientation('custom', 5, 5, positions)
      ).toBe('5'); // Fallback
    });
  });

  describe('indexed scheme', () => {
    it('should return index as string (1-based indexing)', () => {
      expect(
        OrientationResolver.resolveOrientation('indexed', 1, 10)
      ).toBe('1');
      expect(
        OrientationResolver.resolveOrientation('indexed', 7, 10)
      ).toBe('7');
      expect(
        OrientationResolver.resolveOrientation('indexed', 10, 10)
      ).toBe('10');
    });

    it('should handle any count value', () => {
      expect(
        OrientationResolver.resolveOrientation('indexed', 1, 1)
      ).toBe('1');
      expect(
        OrientationResolver.resolveOrientation('indexed', 50, 100)
      ).toBe('50');
      expect(
        OrientationResolver.resolveOrientation('indexed', 999, 1000)
      ).toBe('999');
    });
  });

  describe('edge cases', () => {
    it('should handle unknown schemes as indexed', () => {
      expect(
        OrientationResolver.resolveOrientation('unknown', 3, 5)
      ).toBe('3');
      expect(
        OrientationResolver.resolveOrientation('invalid', 7, 10)
      ).toBe('7');
      expect(OrientationResolver.resolveOrientation(null, 1, 2)).toBe('1');
    });

    it('should handle zero count gracefully', () => {
      expect(() =>
        OrientationResolver.resolveOrientation('bilateral', 0, 0)
      ).not.toThrow();
      expect(() =>
        OrientationResolver.resolveOrientation('radial', 0, 0)
      ).not.toThrow();
      expect(() =>
        OrientationResolver.resolveOrientation('indexed', 0, 0)
      ).not.toThrow();
    });

    it('should handle negative index gracefully', () => {
      expect(() =>
        OrientationResolver.resolveOrientation('bilateral', -1, 2)
      ).not.toThrow();
      expect(() =>
        OrientationResolver.resolveOrientation('radial', -5, 8)
      ).not.toThrow();

      // Negative index should result in negative array index, which returns fallback
      expect(
        OrientationResolver.resolveOrientation('bilateral', -1, 2)
      ).toBe('-1');
    });

    it('should handle very large indices', () => {
      expect(
        OrientationResolver.resolveOrientation('bilateral', 1000, 2)
      ).toBe('1000');
      expect(
        OrientationResolver.resolveOrientation('radial', 999, 8)
      ).toBe('999');
      expect(
        OrientationResolver.resolveOrientation('custom', 500, 10, [
          'a',
          'b',
          'c',
        ])
      ).toBe('500');
    });

    it('should never return undefined for any scheme', () => {
      const schemes = ['bilateral', 'radial', 'indexed', 'custom', 'unknown'];
      const indices = [1, 5, 10, 50, -1, 0];
      const counts = [1, 2, 4, 8, 16, 0];

      for (const scheme of schemes) {
        for (const index of indices) {
          for (const count of counts) {
            const result = OrientationResolver.resolveOrientation(
              scheme,
              index,
              count
            );
            expect(result).toBeDefined();
            expect(typeof result).toBe('string');
          }
        }
      }
    });

    it('should handle null/undefined positions parameter', () => {
      expect(
        OrientationResolver.resolveOrientation('radial', 1, 6, null)
      ).toBe('1');
      expect(
        OrientationResolver.resolveOrientation('radial', 1, 6, undefined)
      ).toBe('1');
      expect(
        OrientationResolver.resolveOrientation('custom', 1, 3, null)
      ).toBe('1');
      expect(
        OrientationResolver.resolveOrientation('custom', 1, 3, undefined)
      ).toBe('1');
    });

    it('should handle null/undefined arrangement parameter', () => {
      expect(
        OrientationResolver.resolveOrientation('bilateral', 1, 2, [], null)
      ).toBe('left');
      expect(
        OrientationResolver.resolveOrientation('bilateral', 1, 2, [], undefined)
      ).toBe('left');
    });
  });

  describe('parameter validation', () => {
    it('should handle missing optional parameters', () => {
      // Should use default empty array for positions
      expect(
        OrientationResolver.resolveOrientation('radial', 1, 6)
      ).toBe('1');

      // Should use default null for arrangement
      expect(
        OrientationResolver.resolveOrientation('bilateral', 1, 2)
      ).toBe('left');
    });

    it('should handle all parameters provided', () => {
      const positions = ['custom1', 'custom2'];
      expect(
        OrientationResolver.resolveOrientation(
          'custom',
          1,
          2,
          positions,
          'someArrangement'
        )
      ).toBe('custom1');
    });
  });

  describe('consistency checks', () => {
    it('should return consistent results for same input', () => {
      // Call multiple times with same parameters
      for (let i = 0; i < 10; i++) {
        expect(
          OrientationResolver.resolveOrientation('bilateral', 1, 2)
        ).toBe('left');
        expect(
          OrientationResolver.resolveOrientation('radial', 3, 8)
        ).toBe('right');
        expect(
          OrientationResolver.resolveOrientation('indexed', 5, 10)
        ).toBe('5');
      }
    });

    it('should maintain order for sequential calls', () => {
      const bilateralResults = [];
      for (let i = 1; i <= 4; i++) {
        bilateralResults.push(
          OrientationResolver.resolveOrientation('bilateral', i, 4)
        );
      }
      expect(bilateralResults).toEqual([
        'left_front',
        'right_front',
        'left_rear',
        'right_rear',
      ]);

      const radialResults = [];
      for (let i = 1; i <= 8; i++) {
        radialResults.push(
          OrientationResolver.resolveOrientation('radial', i, 8)
        );
      }
      expect(radialResults).toEqual([
        'anterior',
        'anterior_right',
        'right',
        'posterior_right',
        'posterior',
        'posterior_left',
        'left',
        'anterior_left',
      ]);
    });
  });
});
