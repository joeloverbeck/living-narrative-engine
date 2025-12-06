/**
 * @file Property-based tests for OrientationResolver
 * @description Uses fast-check for comprehensive random input testing
 * Part of ANASYSREF-007: Comprehensive Testing Strategy
 */

import { describe, it, expect } from '@jest/globals';
import * as fc from 'fast-check';
import { OrientationResolver } from '../../../../src/anatomy/shared/orientationResolver.js';

describe('OrientationResolver - Property-Based Tests', () => {
  describe('Universal Properties', () => {
    it('should always return a valid string (never undefined)', () => {
      fc.assert(
        fc.property(
          fc.constantFrom(
            'bilateral',
            'radial',
            'indexed',
            'custom',
            'quadrupedal'
          ),
          fc.integer({ min: 1, max: 30 }),
          fc.integer({ min: 1, max: 30 }),
          (scheme, index, count) => {
            const result = OrientationResolver.resolveOrientation(
              scheme,
              index,
              count
            );
            return typeof result === 'string' && result.length > 0;
          }
        )
      );
    });

    it('should be deterministic (same inputs produce same outputs)', () => {
      fc.assert(
        fc.property(
          fc.constantFrom('bilateral', 'radial', 'indexed'),
          fc.integer({ min: 1, max: 16 }),
          fc.integer({ min: 1, max: 16 }),
          (scheme, index, count) => {
            const result1 = OrientationResolver.resolveOrientation(
              scheme,
              index,
              count
            );
            const result2 = OrientationResolver.resolveOrientation(
              scheme,
              index,
              count
            );
            return result1 === result2;
          }
        )
      );
    });

    it('should never return empty string', () => {
      fc.assert(
        fc.property(
          fc.constantFrom('bilateral', 'radial', 'indexed', 'custom'),
          fc.integer({ min: 1, max: 20 }),
          fc.integer({ min: 1, max: 20 }),
          (scheme, index, count) => {
            const result = OrientationResolver.resolveOrientation(
              scheme,
              index,
              count
            );
            return result.length > 0;
          }
        )
      );
    });

    it('should handle edge case inputs gracefully', () => {
      fc.assert(
        fc.property(
          fc.constantFrom('bilateral', 'radial', 'indexed', 'custom'),
          fc.integer({ min: -10, max: 100 }),
          fc.integer({ min: 0, max: 50 }),
          (scheme, index, count) => {
            // Should never throw
            expect(() => {
              OrientationResolver.resolveOrientation(scheme, index, count);
            }).not.toThrow();
            return true;
          }
        )
      );
    });
  });

  describe('Bilateral Scheme Properties', () => {
    it('should produce unique orientations for bilateral scheme (count > 4)', () => {
      fc.assert(
        fc.property(
          fc.integer({ min: 5, max: 20 }), // Count > 4 (not quadrupedal)
          (count) => {
            const orientations = [];
            // Note: OrientationResolver uses 1-based indexing
            for (let i = 1; i <= count; i++) {
              orientations.push(
                OrientationResolver.resolveOrientation('bilateral', i, count)
              );
            }
            // For bilateral with count > 4, we expect alternating left/right
            const leftCount = orientations.filter((o) => o === 'left').length;
            const rightCount = orientations.filter((o) => o === 'right').length;
            return Math.abs(leftCount - rightCount) <= 1; // Should be roughly equal
          }
        )
      );
    });

    it('should produce exactly 2 unique values for count=2 (left/right)', () => {
      const result1 = OrientationResolver.resolveOrientation('bilateral', 1, 2);
      const result2 = OrientationResolver.resolveOrientation('bilateral', 2, 2);

      expect(new Set([result1, result2]).size).toBe(2);
      expect([result1, result2].sort()).toEqual(['left', 'right']);
    });

    it('should produce exactly 4 unique values for count=4 (quadrupedal)', () => {
      const orientations = [];
      for (let i = 1; i <= 4; i++) {
        orientations.push(
          OrientationResolver.resolveOrientation('bilateral', i, 4)
        );
      }

      expect(new Set(orientations).size).toBe(4);
      expect(orientations.sort()).toEqual([
        'left_front',
        'left_rear',
        'right_front',
        'right_rear',
      ]);
    });

    it('should maintain alternating pattern for even counts > 4', () => {
      fc.assert(
        fc.property(
          fc.integer({ min: 3, max: 10 }).map((n) => n * 2), // Even numbers 6-20
          (count) => {
            const orientations = [];
            for (let i = 1; i <= count; i++) {
              orientations.push(
                OrientationResolver.resolveOrientation('bilateral', i, count)
              );
            }

            // Odd indices should all be same side, even indices should all be same side
            const oddOrientations = orientations.filter((_, i) => i % 2 === 0);
            const evenOrientations = orientations.filter((_, i) => i % 2 === 1);

            const oddUnique = new Set(oddOrientations);
            const evenUnique = new Set(evenOrientations);

            // Each side should have only one unique value
            return oddUnique.size === 1 && evenUnique.size === 1;
          }
        )
      );
    });
  });

  describe('Indexed Scheme Properties', () => {
    it('should return index as string for all valid inputs', () => {
      fc.assert(
        fc.property(
          fc.integer({ min: 1, max: 100 }),
          fc.integer({ min: 1, max: 100 }),
          (index, count) => {
            const result = OrientationResolver.resolveOrientation(
              'indexed',
              index,
              count
            );
            return result === String(index);
          }
        )
      );
    });

    it('should generate unique orientations for all indices', () => {
      fc.assert(
        fc.property(fc.integer({ min: 1, max: 20 }), (count) => {
          const orientations = [];
          for (let i = 1; i <= count; i++) {
            orientations.push(
              OrientationResolver.resolveOrientation('indexed', i, count)
            );
          }

          // All should be unique
          return new Set(orientations).size === count;
        })
      );
    });

    it('should maintain sequential order', () => {
      fc.assert(
        fc.property(fc.integer({ min: 1, max: 20 }), (count) => {
          const orientations = [];
          for (let i = 1; i <= count; i++) {
            orientations.push(
              OrientationResolver.resolveOrientation('indexed', i, count)
            );
          }

          // Should be sequential
          const expected = Array.from({ length: count }, (_, i) =>
            String(i + 1)
          );
          return JSON.stringify(orientations) === JSON.stringify(expected);
        })
      );
    });
  });

  describe('Radial Scheme Properties', () => {
    it('should produce unique orientations for count=8 (octagonal)', () => {
      const orientations = [];
      for (let i = 1; i <= 8; i++) {
        orientations.push(
          OrientationResolver.resolveOrientation('radial', i, 8)
        );
      }

      // All 8 should be unique
      expect(new Set(orientations).size).toBe(8);

      // Should include expected compass directions
      expect(orientations).toContain('anterior');
      expect(orientations).toContain('posterior');
      expect(orientations).toContain('left');
      expect(orientations).toContain('right');
    });

    it('should fallback to indexed for non-octagonal counts without positions', () => {
      fc.assert(
        fc.property(
          fc.integer({ min: 1, max: 20 }).filter((n) => n !== 8), // Exclude 8
          (count) => {
            const orientations = [];
            for (let i = 1; i <= count; i++) {
              orientations.push(
                OrientationResolver.resolveOrientation('radial', i, count)
              );
            }

            // Should fall back to indexed (numeric strings)
            return orientations.every((o) => /^\d+$/.test(o));
          }
        )
      );
    });

    it('should use custom positions when provided and within bounds', () => {
      fc.assert(
        fc.property(
          fc.integer({ min: 2, max: 10 }),
          fc.array(fc.string({ minLength: 1, maxLength: 20 }), {
            minLength: 2,
            maxLength: 10,
          }),
          (count, positions) => {
            const usablePositions = positions.slice(0, count);
            if (usablePositions.length < count) {
              return true; // Skip if not enough positions
            }

            const orientations = [];
            for (let i = 1; i <= count; i++) {
              orientations.push(
                OrientationResolver.resolveOrientation(
                  'radial',
                  i,
                  count,
                  usablePositions
                )
              );
            }

            // All should match the provided positions
            return orientations.every((o, idx) => o === usablePositions[idx]);
          }
        )
      );
    });
  });

  describe('Custom Scheme Properties', () => {
    it('should use provided positions when available', () => {
      fc.assert(
        fc.property(
          fc.integer({ min: 1, max: 10 }),
          fc.array(fc.string({ minLength: 1, maxLength: 20 }), {
            minLength: 1,
            maxLength: 10,
          }),
          (count, positions) => {
            const orientations = [];
            for (let i = 1; i <= count; i++) {
              orientations.push(
                OrientationResolver.resolveOrientation(
                  'custom',
                  i,
                  count,
                  positions
                )
              );
            }

            // Within bounds should use positions, out of bounds should use index
            for (let i = 0; i < count; i++) {
              if (i < positions.length) {
                if (orientations[i] !== positions[i]) {
                  return false;
                }
              } else {
                if (orientations[i] !== String(i + 1)) {
                  return false;
                }
              }
            }
            return true;
          }
        )
      );
    });

    it('should fallback to indexed when no positions provided', () => {
      fc.assert(
        fc.property(fc.integer({ min: 1, max: 20 }), (count) => {
          const orientations = [];
          for (let i = 1; i <= count; i++) {
            orientations.push(
              OrientationResolver.resolveOrientation('custom', i, count)
            );
          }

          // Should be indexed (numeric strings)
          return orientations.every((o, idx) => o === String(idx + 1));
        })
      );
    });
  });

  describe('Quadrupedal Scheme Properties', () => {
    it('should produce exactly 4 unique quadrupedal orientations', () => {
      const orientations = [];
      for (let i = 1; i <= 4; i++) {
        orientations.push(
          OrientationResolver.resolveOrientation('quadrupedal', i, 4)
        );
      }

      expect(new Set(orientations).size).toBe(4);
      expect(orientations.sort()).toEqual([
        'left_front',
        'left_rear',
        'right_front',
        'right_rear',
      ]);
    });

    it('should match bilateral behavior for count=4', () => {
      for (let i = 1; i <= 4; i++) {
        const bilateralResult = OrientationResolver.resolveOrientation(
          'bilateral',
          i,
          4
        );
        const quadrupedalResult = OrientationResolver.resolveOrientation(
          'quadrupedal',
          i,
          4
        );
        expect(bilateralResult).toBe(quadrupedalResult);
      }
    });
  });

  describe('Out of Bounds Behavior', () => {
    it('should fallback to index string for out of bounds indices', () => {
      fc.assert(
        fc.property(
          fc.constantFrom('bilateral', 'radial', 'custom'),
          fc.integer({ min: 1, max: 10 }),
          fc.integer({ min: 11, max: 50 }), // Index > count
          (scheme, count, index) => {
            const result = OrientationResolver.resolveOrientation(
              scheme,
              index,
              count
            );
            return result === String(index);
          }
        )
      );
    });

    it('should handle negative indices gracefully', () => {
      fc.assert(
        fc.property(
          fc.constantFrom('bilateral', 'radial', 'indexed', 'custom'),
          fc.integer({ min: -10, max: -1 }),
          fc.integer({ min: 1, max: 10 }),
          (scheme, index, count) => {
            const result = OrientationResolver.resolveOrientation(
              scheme,
              index,
              count
            );
            // Should return the index as string (fallback behavior)
            return result === String(index);
          }
        )
      );
    });
  });

  describe('Position Array Edge Cases', () => {
    it('should handle null positions array', () => {
      fc.assert(
        fc.property(
          fc.constantFrom('radial', 'custom'),
          fc.integer({ min: 1, max: 10 }),
          (scheme, count) => {
            expect(() => {
              for (let i = 1; i <= count; i++) {
                OrientationResolver.resolveOrientation(scheme, i, count, null);
              }
            }).not.toThrow();
            return true;
          }
        )
      );
    });

    it('should handle undefined positions array', () => {
      fc.assert(
        fc.property(
          fc.constantFrom('radial', 'custom'),
          fc.integer({ min: 1, max: 10 }),
          (scheme, count) => {
            expect(() => {
              for (let i = 1; i <= count; i++) {
                OrientationResolver.resolveOrientation(
                  scheme,
                  i,
                  count,
                  undefined
                );
              }
            }).not.toThrow();
            return true;
          }
        )
      );
    });

    it('should handle empty positions array', () => {
      fc.assert(
        fc.property(
          fc.constantFrom('radial', 'custom'),
          fc.integer({ min: 1, max: 10 }),
          (scheme, count) => {
            expect(() => {
              for (let i = 1; i <= count; i++) {
                OrientationResolver.resolveOrientation(scheme, i, count, []);
              }
            }).not.toThrow();
            return true;
          }
        )
      );
    });

    it('should handle positions array shorter than count', () => {
      fc.assert(
        fc.property(
          fc.constantFrom('radial', 'custom'),
          fc.integer({ min: 5, max: 15 }),
          fc.array(fc.string({ minLength: 1 }), { minLength: 1, maxLength: 3 }),
          (scheme, count, positions) => {
            expect(() => {
              for (let i = 1; i <= count; i++) {
                OrientationResolver.resolveOrientation(
                  scheme,
                  i,
                  count,
                  positions
                );
              }
            }).not.toThrow();
            return true;
          }
        )
      );
    });
  });

  describe('Consistency Across Calls', () => {
    it('should produce consistent results across multiple calls', () => {
      fc.assert(
        fc.property(
          fc.constantFrom('bilateral', 'radial', 'indexed', 'custom'),
          fc.integer({ min: 1, max: 16 }),
          fc.integer({ min: 1, max: 16 }),
          (scheme, index, count) => {
            const results = [];
            for (let i = 0; i < 5; i++) {
              results.push(
                OrientationResolver.resolveOrientation(scheme, index, count)
              );
            }
            // All results should be identical
            return results.every((r) => r === results[0]);
          }
        )
      );
    });

    it('should generate same sequence for same parameters', () => {
      fc.assert(
        fc.property(
          fc.constantFrom('bilateral', 'radial', 'indexed'),
          fc.integer({ min: 1, max: 10 }),
          (scheme, count) => {
            const sequence1 = [];
            const sequence2 = [];

            for (let i = 1; i <= count; i++) {
              sequence1.push(
                OrientationResolver.resolveOrientation(scheme, i, count)
              );
            }

            for (let i = 1; i <= count; i++) {
              sequence2.push(
                OrientationResolver.resolveOrientation(scheme, i, count)
              );
            }

            return JSON.stringify(sequence1) === JSON.stringify(sequence2);
          }
        )
      );
    });
  });
});
