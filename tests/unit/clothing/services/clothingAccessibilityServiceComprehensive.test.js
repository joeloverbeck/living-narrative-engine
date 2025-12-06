/**
 * @file Comprehensive unit tests for ClothingAccessibilityService
 * @description Addresses CLOREMLOG-008 requirements for comprehensive test coverage
 * including Layla Agirre regression, complex scenarios, and edge cases
 */

import { describe, it, expect, beforeEach, jest } from '@jest/globals';
import { ClothingAccessibilityService } from '../../../../src/clothing/services/clothingAccessibilityService.js';
import { ClothingTestDataFactory } from '../../../common/clothing/clothingTestDataFactory.js';
import { ClothingTestAssertions } from '../../../common/clothing/clothingTestAssertions.js';
import { InvalidArgumentError } from '../../../../src/errors/invalidArgumentError.js';

describe('ClothingAccessibilityService - Comprehensive Test Suite', () => {
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
      setComponentData: jest.fn(),
    };

    mockEntitiesGateway = {
      getComponentData: jest.fn(),
    };
  });

  describe('Layla Agirre Regression Suite', () => {
    beforeEach(() => {
      // Setup Layla Agirre specific configuration
      const equipment = ClothingTestDataFactory.createLaylaAgirreEquipment();
      const coverageMappings =
        ClothingTestDataFactory.createLaylaAgirreCoverageMappings();

      mockEntityManager.getComponentData = jest.fn(
        ClothingTestDataFactory.createMockEntityManagerImplementation(equipment)
      );

      mockEntitiesGateway.getComponentData = jest.fn(
        ClothingTestDataFactory.createMockEntitiesGatewayImplementation(
          coverageMappings
        )
      );

      service = new ClothingAccessibilityService({
        logger: mockLogger,
        entityManager: mockEntityManager,
        entitiesGateway: mockEntitiesGateway,
      });
    });

    it('should only return trousers as accessible in topmost mode (Layla Agirre bug fix)', () => {
      const result = service.getAccessibleItems('layla_agirre', {
        mode: 'topmost',
      });

      ClothingTestAssertions.assertLaylaAgirreScenario(result);
      expect(result).toHaveLength(1);
      expect(result[0]).toBe(
        'clothing:dark_olive_high_rise_double_pleat_trousers'
      );
    });

    it('should correctly identify boxer brief as blocked by trousers', () => {
      const result = service.isItemAccessible(
        'layla_agirre',
        'clothing:power_mesh_boxer_brief'
      );

      ClothingTestAssertions.assertAccessibilityResult(
        result,
        false,
        'Blocked by',
        ['clothing:dark_olive_high_rise_double_pleat_trousers']
      );
    });

    it('should identify trousers as the blocking item for boxer brief', () => {
      const blocker = service.getBlockingItem(
        'layla_agirre',
        'clothing:power_mesh_boxer_brief'
      );

      expect(blocker).toBe(
        'clothing:dark_olive_high_rise_double_pleat_trousers'
      );
    });

    it('should return both items in all mode', () => {
      const result = service.getAccessibleItems('layla_agirre', {
        mode: 'all',
      });

      ClothingTestAssertions.assertContainsItems(result, [
        'clothing:dark_olive_high_rise_double_pleat_trousers',
        'clothing:power_mesh_boxer_brief',
      ]);
    });

    it('should handle priority sorting correctly for Layla Agirre equipment', () => {
      const result = service.getAccessibleItems('layla_agirre', {
        mode: 'all',
        sortByPriority: true,
      });

      // Base layer (trousers) should come before underwear (boxer brief)
      expect(result[0]).toBe(
        'clothing:dark_olive_high_rise_double_pleat_trousers'
      );
      expect(result[1]).toBe('clothing:power_mesh_boxer_brief');
    });
  });

  describe('Complex Multi-Layer Scenarios', () => {
    beforeEach(() => {
      const equipment =
        ClothingTestDataFactory.createMultiLayerTorsoEquipment();
      const coverageMappings =
        ClothingTestDataFactory.createMultiLayerCoverageMappings();

      mockEntityManager.getComponentData = jest.fn(
        ClothingTestDataFactory.createMockEntityManagerImplementation(equipment)
      );

      mockEntitiesGateway.getComponentData = jest.fn(
        ClothingTestDataFactory.createMockEntitiesGatewayImplementation(
          coverageMappings
        )
      );

      service = new ClothingAccessibilityService({
        logger: mockLogger,
        entityManager: mockEntityManager,
        entitiesGateway: mockEntitiesGateway,
      });
    });

    it('should handle three-layer torso configuration correctly', () => {
      const topmostResult = service.getAccessibleItems('test-entity', {
        mode: 'topmost',
      });

      // Only outer layer should be accessible
      ClothingTestAssertions.assertOnlyAccessibleItems(
        topmostResult,
        ['clothing:winter_coat'],
        ['clothing:sweater', 'clothing:undershirt']
      );
    });

    it('should correctly order items by layer priority', () => {
      const result = service.getAccessibleItems('test-entity', {
        mode: 'all',
        sortByPriority: true,
      });

      // Should be ordered: outer > base > underwear
      expect(result).toEqual([
        'clothing:winter_coat',
        'clothing:sweater',
        'clothing:undershirt',
      ]);
    });

    it('should filter by specific layer correctly', () => {
      const baseResult = service.getAccessibleItems('test-entity', {
        mode: 'base',
      });

      expect(baseResult).toEqual(['clothing:sweater']);
    });

    it('should identify correct blocking relationships in multi-layer setup', () => {
      // Sweater is blocked by winter coat
      const sweaterAccessibility = service.isItemAccessible(
        'test-entity',
        'clothing:sweater'
      );
      expect(sweaterAccessibility.accessible).toBe(false);
      expect(sweaterAccessibility.blockingItems).toContain(
        'clothing:winter_coat'
      );

      // Undershirt is blocked by both coat and sweater
      const undershirtAccessibility = service.isItemAccessible(
        'test-entity',
        'clothing:undershirt'
      );
      expect(undershirtAccessibility.accessible).toBe(false);
      // Should identify at least one blocking item
      expect(undershirtAccessibility.blockingItems.length).toBeGreaterThan(0);
    });
  });

  describe('Cross-Area Equipment Scenarios', () => {
    beforeEach(() => {
      const equipment = ClothingTestDataFactory.createCrossAreaEquipment();
      const coverageMappings =
        ClothingTestDataFactory.createMultiLayerCoverageMappings();

      mockEntityManager.getComponentData = jest.fn(
        ClothingTestDataFactory.createMockEntityManagerImplementation(equipment)
      );

      mockEntitiesGateway.getComponentData = jest.fn(
        ClothingTestDataFactory.createMockEntitiesGatewayImplementation(
          coverageMappings
        )
      );

      service = new ClothingAccessibilityService({
        logger: mockLogger,
        entityManager: mockEntityManager,
        entitiesGateway: mockEntitiesGateway,
      });
    });

    it('should not block items in different body areas', () => {
      const result = service.getAccessibleItems('test-entity', {
        mode: 'topmost',
      });

      // Should include topmost from each area
      const expectedItems = [
        'clothing:hat', // head
        'clothing:jacket', // torso_upper
        'clothing:pants', // torso_lower
        'clothing:boots', // feet
      ];

      ClothingTestAssertions.assertContainsItems(result, expectedItems);
    });

    it('should filter by body area correctly', () => {
      const torsoUpperResult = service.getAccessibleItems('test-entity', {
        mode: 'all',
        bodyArea: 'torso_upper',
      });

      expect(torsoUpperResult).toContain('clothing:jacket');
      expect(torsoUpperResult).toContain('clothing:shirt');
      expect(torsoUpperResult).not.toContain('clothing:pants');
      expect(torsoUpperResult).not.toContain('clothing:boots');
    });

    it('should handle combined filters (layer and body area)', () => {
      const result = service.getAccessibleItems('test-entity', {
        mode: 'all',
        layer: 'base',
        bodyArea: 'feet',
      });

      expect(result).toEqual(['clothing:socks']);
    });
  });

  describe('Context-Specific Priority Behavior', () => {
    beforeEach(() => {
      const equipment = {
        equipped: {
          torso_upper: {
            outer: 'clothing:jacket',
            base: 'clothing:shirt',
            underwear: 'clothing:undershirt',
          },
        },
      };

      mockEntityManager.getComponentData = jest.fn((entityId, component) => {
        if (component === 'clothing:equipment') return equipment;
        if (component === 'clothing:coverage_mapping') {
          return { covers: ['torso_upper'], coveragePriority: 'base' };
        }
        return null;
      });

      mockEntitiesGateway.getComponentData = jest.fn((itemId, component) => {
        if (component === 'clothing:coverage_mapping') {
          const layer = itemId.includes('jacket')
            ? 'outer'
            : itemId.includes('shirt') && !itemId.includes('under')
              ? 'base'
              : 'underwear';
          return { covers: ['torso_upper'], coveragePriority: layer };
        }
        return null;
      });

      service = new ClothingAccessibilityService({
        logger: mockLogger,
        entityManager: mockEntityManager,
        entitiesGateway: mockEntitiesGateway,
      });
    });

    it('should apply removal context priority modifiers', () => {
      const result = service.getAccessibleItems('test-entity', {
        mode: 'all',
        sortByPriority: true,
        context: 'removal',
      });

      // Outer items get priority boost in removal context
      expect(result[0]).toBe('clothing:jacket');
    });

    it('should apply equipping context priority modifiers', () => {
      const result = service.getAccessibleItems('test-entity', {
        mode: 'all',
        sortByPriority: true,
        context: 'equipping',
      });

      // Should maintain standard priority order
      expect(result[0]).toBe('clothing:jacket');
      expect(result[1]).toBe('clothing:shirt');
      expect(result[2]).toBe('clothing:undershirt');
    });

    it('should handle unknown contexts with fallback', () => {
      const result = service.getAccessibleItems('test-entity', {
        mode: 'all',
        sortByPriority: true,
        context: 'unknown_context',
      });

      // Should fall back to standard priority
      expect(result).toHaveLength(3);
      expect(result[0]).toBe('clothing:jacket');
    });
  });

  describe('Error Handling and Edge Cases', () => {
    beforeEach(() => {
      service = new ClothingAccessibilityService({
        logger: mockLogger,
        entityManager: mockEntityManager,
        entitiesGateway: mockEntitiesGateway,
      });
    });

    it('should handle malformed equipment gracefully', () => {
      const malformedEquipment =
        ClothingTestDataFactory.createMalformedEquipment();
      mockEntityManager.getComponentData.mockReturnValue(malformedEquipment);

      const result = service.getAccessibleItems('test-entity', { mode: 'all' });

      // Should extract valid items and ignore malformed data
      expect(result).toContain('clothing:shirt');
      expect(result).toContain('clothing:ring');
      expect(result).not.toContain(null);
      expect(result).not.toContain(123);
    });

    it('should handle missing coverage mapping gracefully', () => {
      mockEntityManager.getComponentData.mockReturnValue({
        equipped: { torso: { base: 'item1' } },
      });

      mockEntitiesGateway.getComponentData.mockImplementation(() => {
        throw new Error('Coverage mapping not found');
      });

      expect(() => {
        service.getAccessibleItems('test-entity', { mode: 'topmost' });
      }).not.toThrow();
    });

    it('should handle entity manager failures gracefully', () => {
      mockEntityManager.getComponentData.mockImplementation(() => {
        throw new Error('Database connection failed');
      });

      const result = service.getAccessibleItems('test-entity');

      expect(result).toEqual([]);
      expect(mockLogger.warn).toHaveBeenCalledWith(
        'Failed to get equipment state',
        expect.objectContaining({ error: 'Database connection failed' })
      );
    });

    it('should validate input parameters', () => {
      expect(() => service.getAccessibleItems('')).toThrow(
        InvalidArgumentError
      );
      expect(() => service.getAccessibleItems(null)).toThrow(
        InvalidArgumentError
      );
      expect(() => service.getAccessibleItems('   ')).toThrow(
        InvalidArgumentError
      );

      expect(() => service.isItemAccessible('entity', '')).toThrow(
        InvalidArgumentError
      );
      expect(() => service.isItemAccessible('', 'item')).toThrow(
        InvalidArgumentError
      );

      expect(() => service.getBlockingItem('entity', null)).toThrow(
        InvalidArgumentError
      );
      expect(() => service.clearCache(undefined)).toThrow(InvalidArgumentError);
    });

    it('should handle empty equipment gracefully', () => {
      mockEntityManager.getComponentData.mockReturnValue({
        equipped: {},
      });

      const result = service.getAccessibleItems('test-entity');

      expect(result).toEqual([]);
    });

    it('should handle null equipped property', () => {
      mockEntityManager.getComponentData.mockReturnValue({
        someOtherProperty: 'value',
      });

      const result = service.getAccessibleItems('test-entity');

      expect(result).toEqual([]);
    });
  });

  describe('Mode-Specific Behavior', () => {
    beforeEach(() => {
      const equipment = {
        equipped: {
          torso_upper: {
            outer: 'clothing:coat',
            base: 'clothing:shirt',
            underwear: 'clothing:undershirt',
          },
          hands: {
            accessories: ['clothing:ring', 'clothing:bracelet'],
          },
        },
      };

      mockEntityManager.getComponentData.mockReturnValue(equipment);
      mockEntitiesGateway.getComponentData.mockReturnValue({
        covers: ['body_area'],
        coveragePriority: 'base',
      });

      service = new ClothingAccessibilityService({
        logger: mockLogger,
        entityManager: mockEntityManager,
        entitiesGateway: mockEntitiesGateway,
      });
    });

    it('should handle different modes correctly', () => {
      const results = {
        all: service.getAccessibleItems('test-entity', { mode: 'all' }),
        topmost: service.getAccessibleItems('test-entity', { mode: 'topmost' }),
        topmost_no_accessories: service.getAccessibleItems('test-entity', {
          mode: 'topmost_no_accessories',
        }),
        outer: service.getAccessibleItems('test-entity', { mode: 'outer' }),
        base: service.getAccessibleItems('test-entity', { mode: 'base' }),
        underwear: service.getAccessibleItems('test-entity', {
          mode: 'underwear',
        }),
      };

      ClothingTestAssertions.assertModeSpecificBehavior(results, {
        all: {
          shouldContain: [
            'clothing:coat',
            'clothing:shirt',
            'clothing:undershirt',
            'clothing:ring',
          ],
          count: 5,
        },
        topmost: {
          shouldContain: ['clothing:coat'],
          shouldNotContain: ['clothing:shirt', 'clothing:undershirt'],
        },
        topmost_no_accessories: {
          shouldContain: ['clothing:coat'],
          shouldNotContain: ['clothing:ring', 'clothing:bracelet'],
        },
        outer: {
          shouldContain: ['clothing:coat'],
          shouldNotContain: ['clothing:shirt', 'clothing:undershirt'],
          count: 1,
        },
        base: {
          shouldContain: ['clothing:shirt'],
          shouldNotContain: ['clothing:coat', 'clothing:undershirt'],
          count: 1,
        },
        underwear: {
          shouldContain: ['clothing:undershirt'],
          shouldNotContain: ['clothing:coat', 'clothing:shirt'],
          count: 1,
        },
      });
    });
  });

  describe('Backward Compatibility', () => {
    beforeEach(() => {
      service = new ClothingAccessibilityService({
        logger: mockLogger,
        entityManager: mockEntityManager,
        entitiesGateway: mockEntitiesGateway,
      });
    });

    it('should maintain compatibility with legacy equipment structure', () => {
      // Legacy structure that should still work
      mockEntityManager.getComponentData.mockReturnValue({
        equipped: {
          torso: {
            base: 'legacy:item1',
            underwear: 'legacy:item2',
          },
        },
      });

      const result = service.getAccessibleItems('test-entity', { mode: 'all' });

      expect(result).toContain('legacy:item1');
      expect(result).toContain('legacy:item2');
    });

    it('should work without coverage analyzer (backward compatibility)', () => {
      // Create service without entitiesGateway
      const legacyService = new ClothingAccessibilityService({
        logger: mockLogger,
        entityManager: mockEntityManager,
      });

      mockEntityManager.getComponentData.mockReturnValue({
        equipped: { torso: { base: 'item1' } },
      });

      const result = legacyService.getAccessibleItems('test-entity');
      expect(result).toContain('item1');

      const accessibility = legacyService.isItemAccessible(
        'test-entity',
        'item1'
      );
      expect(accessibility.accessible).toBe(true);
      expect(accessibility.reason).toBe('No coverage analyzer available');
    });
  });
});
