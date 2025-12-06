import { describe, it, expect, beforeEach, jest } from '@jest/globals';
import { ClothingAccessibilityService } from '../../../src/clothing/services/clothingAccessibilityService.js';

/**
 * Integration tests for ClothingAccessibilityService coverage blocking functionality
 */
describe('ClothingAccessibilityService - Coverage Blocking Integration', () => {
  let service;
  let mockLogger;
  let mockEntityManager;
  let mockEntitiesGateway;

  beforeEach(() => {
    mockLogger = {
      debug: jest.fn(),
      info: jest.fn(),
      warn: jest.fn(),
      error: jest.fn(),
    };

    mockEntityManager = {
      getComponentData: jest.fn(),
      hasComponent: jest.fn(),
    };

    mockEntitiesGateway = {
      getComponentData: jest.fn(),
    };
  });

  describe('Coverage Blocking Integration', () => {
    describe('Layla Agirre scenario - trousers blocking boxer brief', () => {
      beforeEach(() => {
        // Setup Layla Agirre equipment state
        mockEntityManager.getComponentData.mockImplementation(
          (entityId, component) => {
            if (component === 'clothing:equipment') {
              return {
                equipped: {
                  torso_lower: {
                    base: 'asudem:trousers',
                    underwear: 'asudem:boxer_brief',
                  },
                },
              };
            }
            return null;
          }
        );

        // Setup coverage mapping for items
        mockEntitiesGateway.getComponentData.mockImplementation(
          (entityId, component) => {
            if (component === 'clothing:coverage_mapping') {
              if (entityId === 'asudem:trousers') {
                return {
                  covers: ['torso_lower'],
                  coveragePriority: 'base',
                };
              }
              if (entityId === 'asudem:boxer_brief') {
                return {
                  covers: ['torso_lower'],
                  coveragePriority: 'underwear',
                };
              }
            }
            return null;
          }
        );

        service = new ClothingAccessibilityService({
          logger: mockLogger,
          entityManager: mockEntityManager,
          entitiesGateway: mockEntitiesGateway,
        });
      });

      it('should block underwear when covered by base layer in topmost mode', () => {
        const result = service.getAccessibleItems('layla_agirre', {
          mode: 'topmost',
        });

        expect(result).toEqual(['asudem:trousers']);
        expect(result).not.toContain('asudem:boxer_brief');
      });

      it('should check item accessibility correctly', () => {
        const result = service.isItemAccessible(
          'layla_agirre',
          'asudem:boxer_brief'
        );

        expect(result.accessible).toBe(false);
        expect(result.reason).toContain('Blocked by');
        expect(result.blockingItems).toContain('asudem:trousers');
      });

      it('should identify blocking item', () => {
        const blocker = service.getBlockingItem(
          'layla_agirre',
          'asudem:boxer_brief'
        );

        expect(blocker).toBe('asudem:trousers');
      });

      it('should allow access to trousers (not blocked)', () => {
        const result = service.isItemAccessible(
          'layla_agirre',
          'asudem:trousers'
        );

        expect(result.accessible).toBe(true);
        expect(result.reason).toBe('Item is accessible');
        expect(result.blockingItems).toEqual([]);
      });

      it('should return null when checking blocking item for accessible item', () => {
        const blocker = service.getBlockingItem(
          'layla_agirre',
          'asudem:trousers'
        );

        expect(blocker).toBeNull();
      });
    });

    describe('Mode-specific behavior', () => {
      beforeEach(() => {
        // Setup equipment with multiple layers
        mockEntityManager.getComponentData.mockImplementation(
          (entityId, component) => {
            if (component === 'clothing:equipment') {
              return {
                equipped: {
                  torso_upper: {
                    outer: 'clothing:jacket',
                    base: 'clothing:shirt',
                    underwear: 'clothing:undershirt',
                  },
                  hands: {
                    accessories: 'clothing:gloves',
                  },
                },
              };
            }
            return null;
          }
        );

        // Setup coverage mappings
        mockEntitiesGateway.getComponentData.mockImplementation(
          (entityId, component) => {
            if (component === 'clothing:coverage_mapping') {
              switch (entityId) {
                case 'clothing:jacket':
                  return { covers: ['torso_upper'], coveragePriority: 'outer' };
                case 'clothing:shirt':
                  return { covers: ['torso_upper'], coveragePriority: 'base' };
                case 'clothing:undershirt':
                  return {
                    covers: ['torso_upper'],
                    coveragePriority: 'underwear',
                  };
                case 'clothing:gloves':
                  return { covers: ['hands'], coveragePriority: 'direct' };
                default:
                  return null;
              }
            }
            return null;
          }
        );

        service = new ClothingAccessibilityService({
          logger: mockLogger,
          entityManager: mockEntityManager,
          entitiesGateway: mockEntitiesGateway,
        });
      });

      it('should apply blocking only in topmost mode', () => {
        // Topmost mode - should block lower layers
        const topmostResult = service.getAccessibleItems('test-entity', {
          mode: 'topmost',
        });
        expect(topmostResult).toContain('clothing:jacket');
        expect(topmostResult).not.toContain('clothing:shirt');
        expect(topmostResult).not.toContain('clothing:undershirt');

        // All mode - should not apply blocking
        const allResult = service.getAccessibleItems('test-entity', {
          mode: 'all',
        });
        expect(allResult).toContain('clothing:jacket');
        expect(allResult).toContain('clothing:shirt');
        expect(allResult).toContain('clothing:undershirt');
        expect(allResult).toContain('clothing:gloves');
      });

      it('should filter by layer in specific layer modes', () => {
        // Outer mode - only outer layer
        const outerResult = service.getAccessibleItems('test-entity', {
          mode: 'outer',
        });
        expect(outerResult).toEqual(['clothing:jacket']);

        // Base mode - only base layer
        const baseResult = service.getAccessibleItems('test-entity', {
          mode: 'base',
        });
        expect(baseResult).toEqual(['clothing:shirt']);

        // Underwear mode - only underwear layer
        const underwearResult = service.getAccessibleItems('test-entity', {
          mode: 'underwear',
        });
        expect(underwearResult).toEqual(['clothing:undershirt']);
      });

      it('should not include accessories in topmost_no_accessories mode', () => {
        const result = service.getAccessibleItems('test-entity', {
          mode: 'topmost_no_accessories',
        });

        expect(result).toContain('clothing:jacket');
        expect(result).not.toContain('clothing:gloves');
      });
    });

    describe('Complex coverage scenarios', () => {
      beforeEach(() => {
        // Setup complex multi-slot equipment
        mockEntityManager.getComponentData.mockImplementation(
          (entityId, component) => {
            if (component === 'clothing:equipment') {
              return {
                equipped: {
                  torso_upper: {
                    outer: 'clothing:coat',
                    base: 'clothing:sweater',
                  },
                  torso_lower: {
                    outer: 'clothing:long_coat_lower', // Same coat covering lower torso
                    base: 'clothing:pants',
                    underwear: 'clothing:underwear',
                  },
                },
              };
            }
            return null;
          }
        );

        // Setup coverage for multi-area items
        mockEntitiesGateway.getComponentData.mockImplementation(
          (entityId, component) => {
            if (component === 'clothing:coverage_mapping') {
              switch (entityId) {
                case 'clothing:coat':
                  return { covers: ['torso_upper'], coveragePriority: 'outer' };
                case 'clothing:long_coat_lower':
                  return { covers: ['torso_lower'], coveragePriority: 'outer' };
                case 'clothing:sweater':
                  return { covers: ['torso_upper'], coveragePriority: 'base' };
                case 'clothing:pants':
                  return { covers: ['torso_lower'], coveragePriority: 'base' };
                case 'clothing:underwear':
                  return {
                    covers: ['torso_lower'],
                    coveragePriority: 'underwear',
                  };
                default:
                  return null;
              }
            }
            return null;
          }
        );

        service = new ClothingAccessibilityService({
          logger: mockLogger,
          entityManager: mockEntityManager,
          entitiesGateway: mockEntitiesGateway,
        });
      });

      it('should handle multi-slot coverage correctly', () => {
        const result = service.getAccessibleItems('test-entity', {
          mode: 'topmost',
        });

        // Should only get topmost items from each slot
        expect(result).toContain('clothing:coat');
        expect(result).toContain('clothing:long_coat_lower');
        expect(result).not.toContain('clothing:sweater');
        expect(result).not.toContain('clothing:pants');
        expect(result).not.toContain('clothing:underwear');
      });

      it('should filter by body area correctly', () => {
        const upperResult = service.getAccessibleItems('test-entity', {
          mode: 'all',
          bodyArea: 'torso_upper',
        });

        expect(upperResult).toContain('clothing:coat');
        expect(upperResult).toContain('clothing:sweater');
        expect(upperResult).not.toContain('clothing:pants');
        expect(upperResult).not.toContain('clothing:underwear');

        const lowerResult = service.getAccessibleItems('test-entity', {
          mode: 'all',
          bodyArea: 'torso_lower',
        });

        expect(lowerResult).toContain('clothing:long_coat_lower');
        expect(lowerResult).toContain('clothing:pants');
        expect(lowerResult).toContain('clothing:underwear');
        expect(lowerResult).not.toContain('clothing:coat');
      });
    });

    describe('Error handling and fallback behavior', () => {
      it('should handle missing coverage analyzer gracefully', () => {
        // Create service without entitiesGateway
        const serviceWithoutAnalyzer = new ClothingAccessibilityService({
          logger: mockLogger,
          entityManager: mockEntityManager,
        });

        mockEntityManager.getComponentData.mockReturnValue({
          equipped: {
            torso: {
              base: 'clothing:shirt',
              underwear: 'clothing:undershirt',
            },
          },
        });

        // Should apply mode filtering but not coverage blocking when no analyzer is available
        // In topmost mode, only highest priority item per slot is returned
        const result = serviceWithoutAnalyzer.getAccessibleItems(
          'test-entity',
          { mode: 'topmost' }
        );
        expect(result).toContain('clothing:shirt');
        expect(result).not.toContain('clothing:undershirt'); // filtered by mode logic

        // isItemAccessible should be permissive
        const accessible = serviceWithoutAnalyzer.isItemAccessible(
          'test-entity',
          'clothing:undershirt'
        );
        expect(accessible.accessible).toBe(true);
        expect(accessible.reason).toBe('No coverage analyzer available');
      });
    });

    it('should handle service creation without coverage analyzer', () => {
      // Create service without entitiesGateway
      const serviceWithoutAnalyzer = new ClothingAccessibilityService({
        logger: mockLogger,
        entityManager: mockEntityManager,
      });

      mockEntityManager.getComponentData.mockReturnValue({
        equipped: {
          torso: {
            base: 'clothing:shirt',
            underwear: 'clothing:undershirt',
          },
        },
      });

      // Should work without coverage analyzer
      const result = serviceWithoutAnalyzer.getAccessibleItems('test-entity', {
        mode: 'topmost',
      });
      expect(result).toContain('clothing:shirt'); // Mode logic still works

      // isItemAccessible should be permissive without analyzer
      const accessible = serviceWithoutAnalyzer.isItemAccessible(
        'test-entity',
        'clothing:undershirt'
      );
      expect(accessible.accessible).toBe(true);
      expect(accessible.reason).toBe('No coverage analyzer available');
    });

    it('should handle complex entity equipment structures', () => {
      // Setup entity with various slot types and layers
      mockEntityManager.getComponentData.mockImplementation(
        (entityId, component) => {
          if (component === 'clothing:equipment') {
            return {
              equipped: {
                head: { base: 'clothing:hat' },
                face: { accessories: 'clothing:glasses' },
                torso_upper: {
                  underwear: 'clothing:undershirt',
                  base: 'clothing:shirt',
                  outer: 'clothing:jacket',
                },
                torso_lower: {
                  underwear: 'clothing:underwear',
                  base: 'clothing:pants',
                },
                feet: {
                  base: 'clothing:socks',
                  outer: 'clothing:shoes',
                },
                hands: {
                  accessories: [
                    'clothing:ring1',
                    'clothing:ring2',
                    'clothing:watch',
                  ],
                },
              },
            };
          }
          return null;
        }
      );

      // Setup coverage mappings for all items
      mockEntitiesGateway.getComponentData.mockImplementation(
        (entityId, component) => {
          if (component === 'clothing:coverage_mapping') {
            const coverageMap = {
              'clothing:hat': { covers: ['head'], coveragePriority: 'base' },
              'clothing:glasses': {
                covers: ['face'],
                coveragePriority: 'direct',
              },
              'clothing:undershirt': {
                covers: ['torso_upper'],
                coveragePriority: 'underwear',
              },
              'clothing:shirt': {
                covers: ['torso_upper'],
                coveragePriority: 'base',
              },
              'clothing:jacket': {
                covers: ['torso_upper'],
                coveragePriority: 'outer',
              },
              'clothing:underwear': {
                covers: ['torso_lower'],
                coveragePriority: 'underwear',
              },
              'clothing:pants': {
                covers: ['torso_lower'],
                coveragePriority: 'base',
              },
              'clothing:socks': { covers: ['feet'], coveragePriority: 'base' },
              'clothing:shoes': { covers: ['feet'], coveragePriority: 'outer' },
              'clothing:ring1': {
                covers: ['hands'],
                coveragePriority: 'direct',
              },
              'clothing:ring2': {
                covers: ['hands'],
                coveragePriority: 'direct',
              },
              'clothing:watch': {
                covers: ['hands'],
                coveragePriority: 'direct',
              },
            };
            return coverageMap[entityId];
          }
          return null;
        }
      );

      service = new ClothingAccessibilityService({
        logger: mockLogger,
        entityManager: mockEntityManager,
        entitiesGateway: mockEntitiesGateway,
      });

      // Test comprehensive topmost mode
      const topmostResult = service.getAccessibleItems('complex-entity', {
        mode: 'topmost',
      });
      expect(topmostResult).toContain('clothing:hat');
      expect(topmostResult).toContain('clothing:jacket'); // Topmost torso_upper
      expect(topmostResult).toContain('clothing:pants'); // Topmost torso_lower
      expect(topmostResult).toContain('clothing:shoes'); // Topmost feet

      // Accessories and direct items should be included
      expect(topmostResult.length).toBeGreaterThanOrEqual(4); // At least the main items

      // Should NOT contain blocked lower layers
      expect(topmostResult).not.toContain('clothing:undershirt');
      expect(topmostResult).not.toContain('clothing:shirt');
      expect(topmostResult).not.toContain('clothing:underwear');
      expect(topmostResult).not.toContain('clothing:socks');

      // Test all mode returns everything
      const allResult = service.getAccessibleItems('complex-entity', {
        mode: 'all',
      });
      expect(allResult.length).toBe(12); // All items present
    });
  });

  describe('Advanced integration scenarios', () => {
    it('should demonstrate comprehensive functionality with complex equipment', () => {
      // This test demonstrates all major features working together
      // Setup complex equipment with various modes and scenarios
      mockEntityManager.getComponentData.mockImplementation(
        (entityId, component) => {
          if (component === 'clothing:equipment') {
            return {
              equipped: {
                head: { outer: 'hat' },
                torso_upper: {
                  outer: 'coat',
                  base: 'shirt',
                  underwear: 'undershirt',
                },
                torso_lower: {
                  outer: 'skirt',
                  base: 'leggings',
                  underwear: 'underwear',
                },
                feet: {
                  outer: 'boots',
                  base: 'socks',
                },
              },
            };
          }
          return null;
        }
      );

      // Setup coverage mappings for items
      mockEntitiesGateway.getComponentData.mockImplementation(
        (entityId, component) => {
          if (component === 'clothing:coverage_mapping') {
            const coverageMap = {
              hat: { covers: ['head'], coveragePriority: 'outer' },
              coat: { covers: ['torso_upper'], coveragePriority: 'outer' },
              shirt: { covers: ['torso_upper'], coveragePriority: 'base' },
              undershirt: {
                covers: ['torso_upper'],
                coveragePriority: 'underwear',
              },
              skirt: { covers: ['torso_lower'], coveragePriority: 'outer' },
              leggings: { covers: ['torso_lower'], coveragePriority: 'base' },
              underwear: {
                covers: ['torso_lower'],
                coveragePriority: 'underwear',
              },
              boots: { covers: ['feet'], coveragePriority: 'outer' },
              socks: { covers: ['feet'], coveragePriority: 'base' },
            };
            return coverageMap[entityId];
          }
          return null;
        }
      );

      service = new ClothingAccessibilityService({
        logger: mockLogger,
        entityManager: mockEntityManager,
        entitiesGateway: mockEntitiesGateway,
      });

      // Test topmost mode returns only accessible items
      const topmostResult = service.getAccessibleItems('integration-test', {
        mode: 'topmost',
      });
      expect(topmostResult).toContain('hat');
      expect(topmostResult).toContain('coat');
      expect(topmostResult).toContain('skirt');
      expect(topmostResult).toContain('boots');

      // Should not contain covered items
      expect(topmostResult).not.toContain('shirt');
      expect(topmostResult).not.toContain('undershirt');

      // Test all mode returns everything
      const allResult = service.getAccessibleItems('integration-test', {
        mode: 'all',
      });
      expect(allResult.length).toBe(9);

      // Test specific layer filtering
      const outerResult = service.getAccessibleItems('integration-test', {
        mode: 'outer',
      });
      expect(outerResult).toEqual(
        expect.arrayContaining(['hat', 'coat', 'skirt', 'boots'])
      );

      // Test priority sorting
      const sortedResult = service.getAccessibleItems('integration-test', {
        mode: 'all',
        sortByPriority: true,
      });
      expect(sortedResult.length).toBe(9);
    });
  });
});
