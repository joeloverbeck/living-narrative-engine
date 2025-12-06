/**
 * @file Complete clothing system integration tests
 * @description Tests the integration of ClothingAccessibilityService with all dependent systems
 * including EntityManager, ScopeEngine, ActionDiscoveryService, and coverage analysis
 */

import { describe, it, expect, beforeEach, jest } from '@jest/globals';
import { ClothingAccessibilityService } from '../../../src/clothing/services/clothingAccessibilityService.js';
import { ClothingTestDataFactory } from '../../common/clothing/clothingTestDataFactory.js';
import { ClothingTestAssertions } from '../../common/clothing/clothingTestAssertions.js';

/**
 * Integration test suite for complete clothing system
 * Addresses CLOREMLOG-008 requirements for system integration testing
 */
describe('Complete Clothing System Integration', () => {
  let clothingService;
  let mockLogger;
  let mockEntityManager;
  let mockEntitiesGateway;
  let mockScopeEngine;
  let mockActionDiscoveryService;

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
      setComponentData: jest.fn(),
      createEntity: jest.fn(),
      addComponent: jest.fn(),
    };

    mockEntitiesGateway = {
      getComponentData: jest.fn(),
    };

    mockScopeEngine = {
      resolve: jest.fn(),
    };

    mockActionDiscoveryService = {
      discoverActions: jest.fn(),
    };
  });

  describe('Layla Agirre Regression Suite - Full Integration', () => {
    beforeEach(() => {
      // Setup complete Layla Agirre scenario
      const equipment = ClothingTestDataFactory.createLaylaAgirreEquipment();
      const coverageMappings =
        ClothingTestDataFactory.createLaylaAgirreCoverageMappings();

      mockEntityManager.getComponentData.mockImplementation(
        (entityId, component) => {
          if (component === 'clothing:equipment') {
            return equipment;
          }
          if (component === 'core:actor') {
            return { name: 'Layla Agirre' };
          }
          return null;
        }
      );

      mockEntitiesGateway.getComponentData.mockImplementation(
        (itemId, component) => {
          if (component === 'clothing:coverage_mapping') {
            return coverageMappings[itemId];
          }
          if (component === 'clothing:item') {
            return {
              name: itemId.includes('trousers')
                ? 'Dark Olive Trousers'
                : 'Power Mesh Boxer Brief',
              slot: 'torso_lower',
            };
          }
          return null;
        }
      );

      clothingService = new ClothingAccessibilityService({
        logger: mockLogger,
        entityManager: mockEntityManager,
        entitiesGateway: mockEntitiesGateway,
      });

      // Mock scope engine to use clothing service
      mockScopeEngine.resolve.mockImplementation((scopeName, context) => {
        if (scopeName === 'clothing:topmost_clothing') {
          return clothingService.getAccessibleItems(context.entityId, {
            mode: 'topmost',
          });
        }
        return [];
      });

      // Mock action discovery to filter based on accessibility
      mockActionDiscoveryService.discoverActions.mockImplementation(
        (entityId) => {
          const accessible = clothingService.getAccessibleItems(entityId, {
            mode: 'topmost',
          });
          return accessible.map((itemId) => ({
            actionId: 'clothing:remove_clothing',
            targets: {
              primary: {
                scope: 'clothing:topmost_clothing',
                entity: itemId,
              },
            },
          }));
        }
      );
    });

    it('should resolve topmost clothing correctly through scope engine', () => {
      const result = mockScopeEngine.resolve('clothing:topmost_clothing', {
        entityId: 'layla_agirre',
      });

      ClothingTestAssertions.assertLaylaAgirreScenario(result);
    });

    it('should show only accessible removal actions', () => {
      const actions =
        mockActionDiscoveryService.discoverActions('layla_agirre');

      expect(actions).toHaveLength(1);
      expect(actions[0].actionId).toBe('clothing:remove_clothing');
      expect(actions[0].targets.primary.entity).toBe(
        'clothing:dark_olive_high_rise_double_pleat_trousers'
      );
    });

    it('should maintain consistency across service boundaries', () => {
      // Get accessible items directly from service
      const directResult = clothingService.getAccessibleItems('layla_agirre', {
        mode: 'topmost',
      });

      // Get through scope engine
      const scopeResult = mockScopeEngine.resolve('clothing:topmost_clothing', {
        entityId: 'layla_agirre',
      });

      // Get through action discovery
      const actions =
        mockActionDiscoveryService.discoverActions('layla_agirre');
      const actionTargets = actions.map((a) => a.targets.primary.entity);

      // All should be consistent
      expect(directResult).toEqual(scopeResult);
      expect(directResult).toEqual(actionTargets);
    });
  });

  describe('Complex Clothing Scenarios - System Integration', () => {
    beforeEach(() => {
      // Setup complex multi-layer, multi-slot equipment
      const equipment = ClothingTestDataFactory.createCrossAreaEquipment();
      const coverageMappings =
        ClothingTestDataFactory.createMultiLayerCoverageMappings();

      mockEntityManager.getComponentData.mockImplementation(
        (entityId, component) => {
          if (component === 'clothing:equipment') {
            return equipment;
          }
          return null;
        }
      );

      mockEntitiesGateway.getComponentData.mockImplementation(
        (itemId, component) => {
          if (component === 'clothing:coverage_mapping') {
            return coverageMappings[itemId];
          }
          return null;
        }
      );

      clothingService = new ClothingAccessibilityService({
        logger: mockLogger,
        entityManager: mockEntityManager,
        entitiesGateway: mockEntitiesGateway,
      });
    });

    it('should handle multi-layer torso configuration', () => {
      // Add multi-layer torso equipment
      mockEntityManager.getComponentData.mockImplementation(
        (entityId, component) => {
          if (component === 'clothing:equipment') {
            return {
              equipped: {
                torso_upper: {
                  outer: 'clothing:coat',
                  base: 'clothing:shirt',
                  underwear: 'clothing:undershirt',
                },
              },
            };
          }
          return null;
        }
      );

      const result = clothingService.getAccessibleItems('test-entity', {
        mode: 'topmost',
      });

      // Should only return outer layer
      expect(result).toEqual(['clothing:coat']);
    });

    it('should not block items in different body areas', () => {
      const result = clothingService.getAccessibleItems('test-entity', {
        mode: 'topmost',
      });

      // Should include topmost from each area
      expect(result).toContain('clothing:hat');
      expect(result).toContain('clothing:jacket');
      expect(result).toContain('clothing:pants');
      expect(result).toContain('clothing:boots');

      // Should not include blocked items
      expect(result).not.toContain('clothing:shirt');
      expect(result).not.toContain('clothing:underwear');
      expect(result).not.toContain('clothing:socks');
    });

    it('should handle partial equipment configurations', () => {
      const partialEquipment = ClothingTestDataFactory.createPartialEquipment();
      mockEntityManager.getComponentData.mockImplementation(
        (entityId, component) => {
          if (component === 'clothing:equipment') {
            return partialEquipment;
          }
          return null;
        }
      );

      const result = clothingService.getAccessibleItems('test-entity', {
        mode: 'topmost',
      });

      expect(result).toContain('clothing:shirt');
      expect(result).toContain('clothing:shoes');
      expect(result).toHaveLength(2);
    });
  });

  describe('Performance Integration', () => {
    beforeEach(() => {
      clothingService = new ClothingAccessibilityService({
        logger: mockLogger,
        entityManager: mockEntityManager,
        entitiesGateway: mockEntitiesGateway,
      });
    });

    it('should handle large character wardrobes efficiently', () => {
      const largeEquipment =
        ClothingTestDataFactory.createLargeWardrobeEquipment(100);
      mockEntityManager.getComponentData.mockReturnValue(largeEquipment);
      mockEntitiesGateway.getComponentData.mockReturnValue({
        covers: ['body_area'],
        coveragePriority: 'base',
      });

      const duration = ClothingTestAssertions.assertPerformanceWithin(
        () =>
          clothingService.getAccessibleItems('large-wardrobe-entity', {
            mode: 'topmost',
          }),
        50,
        'Large wardrobe integration'
      );

      expect(duration).toBeLessThan(50);
    });

    it('should maintain performance with cache across operations', () => {
      mockEntityManager.getComponentData.mockReturnValue({
        equipped: {
          torso: { base: 'item1', underwear: 'item2' },
        },
      });

      // First call - populate cache
      const firstStart = performance.now();
      clothingService.getAccessibleItems('cache-test-entity', {
        mode: 'topmost',
      });
      const firstTime = performance.now() - firstStart;

      // Multiple subsequent calls should use cache
      const cachedStart = performance.now();
      for (let i = 0; i < 10; i++) {
        clothingService.getAccessibleItems('cache-test-entity', {
          mode: 'topmost',
        });
      }
      const cachedTime = (performance.now() - cachedStart) / 10;

      // Cached calls should be much faster
      if (firstTime > 0.1) {
        expect(cachedTime).toBeLessThan(firstTime / 2);
      }
    });
  });

  describe('Error Recovery Integration', () => {
    beforeEach(() => {
      clothingService = new ClothingAccessibilityService({
        logger: mockLogger,
        entityManager: mockEntityManager,
        entitiesGateway: mockEntitiesGateway,
      });
    });

    it('should handle missing coverage mapping gracefully', () => {
      mockEntityManager.getComponentData.mockReturnValue({
        equipped: {
          torso: { base: 'item-without-coverage' },
        },
      });

      mockEntitiesGateway.getComponentData.mockReturnValue(null);

      const result = clothingService.getAccessibleItems('test-entity', {
        mode: 'topmost',
      });

      // Should still return the item even without coverage data
      expect(result).toContain('item-without-coverage');
    });

    it('should handle malformed equipment data gracefully', () => {
      const malformedEquipment =
        ClothingTestDataFactory.createMalformedEquipment();
      mockEntityManager.getComponentData.mockReturnValue(malformedEquipment);

      expect(() => {
        clothingService.getAccessibleItems('malformed-entity', { mode: 'all' });
      }).not.toThrow();

      const result = clothingService.getAccessibleItems('malformed-entity', {
        mode: 'all',
      });

      // Should extract valid items
      expect(result).toContain('clothing:shirt');
      expect(result).toContain('clothing:ring');
    });

    it('should recover from entity manager failures', () => {
      let callCount = 0;
      mockEntityManager.getComponentData.mockImplementation(() => {
        callCount++;
        if (callCount === 1) {
          throw new Error('Temporary database error');
        }
        return { equipped: { torso: { base: 'recovered-item' } } };
      });

      // First call fails
      const result1 = clothingService.getAccessibleItems('test-entity');
      expect(result1).toEqual([]);
      expect(mockLogger.warn).toHaveBeenCalled();

      // Clear cache to allow retry
      clothingService.clearCache('test-entity');

      // Second call succeeds
      const result2 = clothingService.getAccessibleItems('test-entity');
      expect(result2).toContain('recovered-item');
    });

    it('should handle service integration failures gracefully', () => {
      // Simulate scope engine failure
      mockScopeEngine.resolve.mockImplementation(() => {
        throw new Error('Scope resolution failed');
      });

      // Direct service call should still work
      mockEntityManager.getComponentData.mockReturnValue({
        equipped: { torso: { base: 'fallback-item' } },
      });

      const result = clothingService.getAccessibleItems('test-entity');
      expect(result).toContain('fallback-item');
    });
  });

  describe('Dynamic Equipment Updates', () => {
    beforeEach(() => {
      clothingService = new ClothingAccessibilityService({
        logger: mockLogger,
        entityManager: mockEntityManager,
        entitiesGateway: mockEntitiesGateway,
      });
    });

    it('should reflect equipment changes immediately', () => {
      // Initial equipment
      mockEntityManager.getComponentData.mockReturnValue({
        equipped: {
          torso: {
            base: 'shirt',
            underwear: 'undershirt',
          },
        },
      });

      const result1 = clothingService.getAccessibleItems('dynamic-entity', {
        mode: 'topmost',
      });
      expect(result1).toContain('shirt');

      // Clear cache to simulate equipment change
      clothingService.clearCache('dynamic-entity');

      // Updated equipment - added outer layer
      mockEntityManager.getComponentData.mockReturnValue({
        equipped: {
          torso: {
            outer: 'jacket',
            base: 'shirt',
            underwear: 'undershirt',
          },
        },
      });

      const result2 = clothingService.getAccessibleItems('dynamic-entity', {
        mode: 'topmost',
      });
      expect(result2).toContain('jacket');
      expect(result2).not.toContain('shirt'); // Now blocked
    });

    it('should handle equipment removal correctly', () => {
      // Start with multi-layer equipment
      mockEntityManager.getComponentData.mockReturnValue({
        equipped: {
          torso: {
            outer: 'jacket',
            base: 'shirt',
          },
        },
      });

      mockEntitiesGateway.getComponentData.mockImplementation((itemId) => {
        if (itemId === 'jacket') {
          return { covers: ['torso'], coveragePriority: 'outer' };
        }
        if (itemId === 'shirt') {
          return { covers: ['torso'], coveragePriority: 'base' };
        }
        return null;
      });

      const result1 = clothingService.getAccessibleItems('removal-entity', {
        mode: 'topmost',
      });
      expect(result1).toEqual(['jacket']);

      // Simulate removing jacket
      clothingService.clearCache('removal-entity');
      mockEntityManager.getComponentData.mockReturnValue({
        equipped: {
          torso: {
            base: 'shirt',
          },
        },
      });

      const result2 = clothingService.getAccessibleItems('removal-entity', {
        mode: 'topmost',
      });
      expect(result2).toEqual(['shirt']);
    });
  });
});
