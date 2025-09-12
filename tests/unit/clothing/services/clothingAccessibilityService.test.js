import { describe, it, expect, beforeEach, jest } from '@jest/globals';
import { ClothingAccessibilityService } from '../../../../src/clothing/services/clothingAccessibilityService.js';
import { InvalidArgumentError } from '../../../../src/errors/invalidArgumentError.js';

/**
 * Helper to create minimal mocks for dependencies
 *
 * @returns {object} Object containing mocked dependencies
 */
function createMocks() {
  return {
    logger: {
      debug: jest.fn(),
      info: jest.fn(),
      warn: jest.fn(),
      error: jest.fn()
    },
    entityManager: {
      getComponentData: jest.fn(),
      hasComponent: jest.fn(),
      setComponentData: jest.fn()
    },
    entitiesGateway: {
      getComponentData: jest.fn()
    }
  };
}

describe('ClothingAccessibilityService', () => {
  let service;
  let mockLogger;
  let mockEntityManager;
  let mockEntitiesGateway;

  beforeEach(() => {
    ({ logger: mockLogger, entityManager: mockEntityManager, entitiesGateway: mockEntitiesGateway } = createMocks());
    
    service = new ClothingAccessibilityService({
      logger: mockLogger,
      entityManager: mockEntityManager,
      entitiesGateway: mockEntitiesGateway
    });
  });

  describe('constructor', () => {
    it('should validate required dependencies', () => {
      expect(service).toBeInstanceOf(ClothingAccessibilityService);
      expect(mockLogger.info).toHaveBeenCalledWith('ClothingAccessibilityService: Initialized');
    });

    it('should throw error when logger is missing', () => {
      expect(() => {
        new ClothingAccessibilityService({
          entityManager: mockEntityManager,
          entitiesGateway: mockEntitiesGateway
        });
      }).toThrow(InvalidArgumentError);
    });

    it('should throw error when entityManager is missing', () => {
      expect(() => {
        new ClothingAccessibilityService({
          logger: mockLogger,
          entitiesGateway: mockEntitiesGateway
        });
      }).toThrow(InvalidArgumentError);
    });

    it('should work without entitiesGateway (optional dependency)', () => {
      const serviceWithoutGateway = new ClothingAccessibilityService({
        logger: mockLogger,
        entityManager: mockEntityManager
      });
      
      expect(serviceWithoutGateway).toBeInstanceOf(ClothingAccessibilityService);
      expect(mockLogger.info).toHaveBeenCalledWith('ClothingAccessibilityService: Initialized');
    });

    it('should create coverage analyzer when entitiesGateway is provided', () => {
      expect(mockLogger.debug).toHaveBeenCalledWith('ClothingAccessibilityService: Coverage analyzer initialized');
    });
  });

  describe('getAccessibleItems', () => {
    describe('with equipment', () => {
      it('should return equipped item IDs', () => {
        mockEntityManager.getComponentData.mockReturnValue({
          equipped: {
            torso_upper: {
              base: 'clothing:shirt',
              outer: 'clothing:jacket'
            },
            torso_lower: {
              underwear: 'clothing:underwear',
              base: 'clothing:pants'
            }
          }
        });
        
        // Use 'all' mode to get all items without coverage blocking
        const result = service.getAccessibleItems('test-entity', { mode: 'all' });
        expect(result).toContain('clothing:shirt');
        expect(result).toContain('clothing:jacket');
        expect(result).toContain('clothing:underwear');
        expect(result).toContain('clothing:pants');
      });
      
      it('should handle missing equipment component', () => {
        mockEntityManager.getComponentData.mockReturnValue(null);
        
        const result = service.getAccessibleItems('test-entity');
        expect(result).toEqual([]);
      });
      
      it('should handle malformed equipment data', () => {
        mockEntityManager.getComponentData.mockReturnValue({
          equipped: {
            invalid_slot: 'not-an-object',
            valid_slot: {
              base: 'clothing:item'
            }
          }
        });
        
        const result = service.getAccessibleItems('test-entity');
        expect(result).toEqual(['clothing:item']);
      });
      
      it('should handle arrays of items in equipment layers', () => {
        mockEntityManager.getComponentData.mockReturnValue({
          equipped: {
            hands: {
              accessories: ['clothing:ring1', 'clothing:ring2', 'clothing:bracelet']
            },
            torso_upper: {
              base: 'clothing:shirt'
            }
          }
        });
        
        // Use 'all' mode to include accessories
        const result = service.getAccessibleItems('test-entity', { mode: 'all' });
        expect(result).toContain('clothing:ring1');
        expect(result).toContain('clothing:ring2');
        expect(result).toContain('clothing:bracelet');
        expect(result).toContain('clothing:shirt');
      });

      it('should handle empty equipped object', () => {
        mockEntityManager.getComponentData.mockReturnValue({
          equipped: {}
        });
        
        const result = service.getAccessibleItems('test-entity');
        expect(result).toEqual([]);
      });

      it('should handle equipment with no equipped property', () => {
        mockEntityManager.getComponentData.mockReturnValue({
          someOtherProperty: 'value'
        });
        
        const result = service.getAccessibleItems('test-entity');
        expect(result).toEqual([]);
      });

      it('should handle exception when getting component data', () => {
        mockEntityManager.getComponentData.mockImplementation(() => {
          throw new Error('Database error');
        });
        
        const result = service.getAccessibleItems('test-entity');
        expect(result).toEqual([]);
        expect(mockLogger.warn).toHaveBeenCalledWith(
          'Failed to get equipment state',
          { entityId: 'test-entity', error: 'Database error' }
        );
      });

      it('should handle non-string items in arrays', () => {
        mockEntityManager.getComponentData.mockReturnValue({
          equipped: {
            hands: {
              accessories: ['clothing:ring1', null, 123, 'clothing:ring2']
            }
          }
        });
        
        // Use 'all' mode to include accessories
        const result = service.getAccessibleItems('test-entity', { mode: 'all' });
        expect(result).toEqual(['clothing:ring1', 'clothing:ring2']);
      });

      it('should handle null slot data', () => {
        mockEntityManager.getComponentData.mockReturnValue({
          equipped: {
            torso_upper: null,
            torso_lower: {
              base: 'clothing:pants'
            }
          }
        });
        
        const result = service.getAccessibleItems('test-entity');
        expect(result).toEqual(['clothing:pants']);
      });
    });

    describe('caching behavior', () => {
      beforeEach(() => {
        jest.clearAllTimers();
        jest.useFakeTimers();
      });

      afterEach(() => {
        jest.runOnlyPendingTimers();
        jest.useRealTimers();
      });

      it('should cache results for 5 seconds', () => {
        mockEntityManager.getComponentData.mockReturnValue({
          equipped: { slot: { base: 'item1' } }
        });
        
        // First call - will call getComponentData twice (once for equipment, once for coverage priority)
        service.getAccessibleItems('entity1');
        const firstCallCount = mockEntityManager.getComponentData.mock.calls.length;
        
        // Second call within TTL (should use cache)
        jest.advanceTimersByTime(4000);
        service.getAccessibleItems('entity1');
        expect(mockEntityManager.getComponentData).toHaveBeenCalledTimes(firstCallCount); // Should not increase
      });
      
      it('should invalidate cache after TTL', () => {
        mockEntityManager.getComponentData.mockReturnValue({
          equipped: { slot: { base: 'item1' } }
        });
        
        // First call
        service.getAccessibleItems('entity1');
        const firstCallCount = mockEntityManager.getComponentData.mock.calls.length;
        
        // Second call after TTL (should fetch again)
        jest.advanceTimersByTime(6000); // Past 5 second TTL
        service.getAccessibleItems('entity1');
        expect(mockEntityManager.getComponentData.mock.calls.length).toBeGreaterThan(firstCallCount);
      });

      it('should use different cache keys for different options', () => {
        mockEntityManager.getComponentData.mockReturnValue({
          equipped: { slot: { base: 'item1' } }
        });
        
        const initialCallCount = mockEntityManager.getComponentData.mock.calls.length;
        // Call with different options
        service.getAccessibleItems('entity1', { layer: 'base' });
        service.getAccessibleItems('entity1', { layer: 'outer' });
        service.getAccessibleItems('entity1', {});
        
        // Should have multiple calls due to different cache keys + coverage priority lookups
        const finalCallCount = mockEntityManager.getComponentData.mock.calls.length;
        expect(finalCallCount).toBeGreaterThan(initialCallCount + 2); // At least 3 different cache keys
      });

      it('should cache empty results', () => {
        mockEntityManager.getComponentData.mockReturnValue(null);
        
        // First call
        service.getAccessibleItems('entity1');
        expect(mockEntityManager.getComponentData).toHaveBeenCalledTimes(1);
        
        // Second call (should use cache even for empty result)
        service.getAccessibleItems('entity1');
        expect(mockEntityManager.getComponentData).toHaveBeenCalledTimes(1);
      });
    });

    it('should accept options parameter', () => {
      const options = { includeBlocked: true, layer: 'base' };
      mockEntityManager.getComponentData.mockReturnValue({
        equipped: { slot: { base: 'item1' } }
      });
      
      const result = service.getAccessibleItems('test-entity', options);
      expect(result).toEqual(['item1']);
    });

    it('should throw error for invalid entityId', () => {
      expect(() => service.getAccessibleItems('')).toThrow(InvalidArgumentError);
      expect(() => service.getAccessibleItems(null)).toThrow(InvalidArgumentError);
      expect(() => service.getAccessibleItems(undefined)).toThrow(InvalidArgumentError);
    });

    it('should throw error for blank entityId', () => {
      expect(() => service.getAccessibleItems('   ')).toThrow(InvalidArgumentError);
    });
  });

  describe('isItemAccessible', () => {
    it('should return accessibility info when no coverage analyzer available', () => {
      // Create service without coverage analyzer
      const serviceWithoutAnalyzer = new ClothingAccessibilityService({
        logger: mockLogger,
        entityManager: mockEntityManager
      });
      
      const result = serviceWithoutAnalyzer.isItemAccessible('test-entity', 'test-item');
      
      expect(result).toEqual({
        accessible: true,
        reason: 'No coverage analyzer available',
        blockingItems: []
      });
    });

    it('should throw error for invalid entityId', () => {
      expect(() => service.isItemAccessible('', 'test-item')).toThrow(InvalidArgumentError);
      expect(() => service.isItemAccessible(null, 'test-item')).toThrow(InvalidArgumentError);
      expect(() => service.isItemAccessible(undefined, 'test-item')).toThrow(InvalidArgumentError);
    });

    it('should throw error for invalid itemId', () => {
      expect(() => service.isItemAccessible('test-entity', '')).toThrow(InvalidArgumentError);
      expect(() => service.isItemAccessible('test-entity', null)).toThrow(InvalidArgumentError);
      expect(() => service.isItemAccessible('test-entity', undefined)).toThrow(InvalidArgumentError);
    });

    it('should throw error for blank parameters', () => {
      expect(() => service.isItemAccessible('   ', 'test-item')).toThrow(InvalidArgumentError);
      expect(() => service.isItemAccessible('test-entity', '   ')).toThrow(InvalidArgumentError);
    });
  });

  describe('getBlockingItem', () => {
    it('should return null when item is accessible', () => {
      // Create service without coverage analyzer (items will be accessible)
      const serviceWithoutAnalyzer = new ClothingAccessibilityService({
        logger: mockLogger,
        entityManager: mockEntityManager
      });
      
      const result = serviceWithoutAnalyzer.getBlockingItem('test-entity', 'test-item');
      
      expect(result).toBeNull();
    });

    it('should throw error for invalid entityId', () => {
      expect(() => service.getBlockingItem('', 'test-item')).toThrow(InvalidArgumentError);
      expect(() => service.getBlockingItem(null, 'test-item')).toThrow(InvalidArgumentError);
      expect(() => service.getBlockingItem(undefined, 'test-item')).toThrow(InvalidArgumentError);
    });

    it('should throw error for invalid itemId', () => {
      expect(() => service.getBlockingItem('test-entity', '')).toThrow(InvalidArgumentError);
      expect(() => service.getBlockingItem('test-entity', null)).toThrow(InvalidArgumentError);
      expect(() => service.getBlockingItem('test-entity', undefined)).toThrow(InvalidArgumentError);
    });

    it('should throw error for blank parameters', () => {
      expect(() => service.getBlockingItem('   ', 'test-item')).toThrow(InvalidArgumentError);
      expect(() => service.getBlockingItem('test-entity', '   ')).toThrow(InvalidArgumentError);
    });
  });

  describe('clearCache', () => {
    beforeEach(() => {
      // Provide a mock return value for getComponentData
      mockEntityManager.getComponentData.mockReturnValue({
        equipped: { slot: { base: 'item1' } }
      });
    });

    it('should clear cache for entity', () => {
      service.clearCache('test-entity');
      
      expect(mockLogger.debug).toHaveBeenCalledWith(
        'ClothingAccessibilityService: Cache cleared for entity',
        { entityId: 'test-entity', entriesCleared: 0 }
      );
    });

    it('should clear multiple cache entries for same entity', () => {
      // Simulate cache entries by calling methods that would populate cache
      service.getAccessibleItems('test-entity');
      service.getAccessibleItems('test-entity', { layer: 'base' });
      
      // Now clear cache
      service.clearCache('test-entity');
      
      expect(mockLogger.debug).toHaveBeenCalledWith(
        'ClothingAccessibilityService: Cache cleared for entity',
        expect.objectContaining({ entityId: 'test-entity' })
      );
    });

    it('should throw error for invalid entityId', () => {
      expect(() => service.clearCache('')).toThrow(InvalidArgumentError);
      expect(() => service.clearCache(null)).toThrow(InvalidArgumentError);
      expect(() => service.clearCache(undefined)).toThrow(InvalidArgumentError);
    });

    it('should throw error for blank entityId', () => {
      expect(() => service.clearCache('   ')).toThrow(InvalidArgumentError);
    });

    it('should only clear cache for specific entity', () => {
      // Populate cache with entries for multiple entities
      service.getAccessibleItems('entity1');
      service.getAccessibleItems('entity2');
      
      // Clear cache for entity1 only
      service.clearCache('entity1');
      
      // Verify logger was called with correct entity
      expect(mockLogger.debug).toHaveBeenCalledWith(
        'ClothingAccessibilityService: Cache cleared for entity',
        expect.objectContaining({ entityId: 'entity1' })
      );
    });
    
    it('should handle clearing cache with actual cache entries', () => {
      // Call methods that would populate cache
      service.getAccessibleItems('test-entity-123');
      service.getAccessibleItems('test-entity-123', { layer: 'base' });
      service.getAccessibleItems('test-entity-123', { includeBlocked: true });
      
      // Clear cache for the entity - this will iterate through keys
      service.clearCache('test-entity-123');
      
      // Verify the debug log was called with the entity
      expect(mockLogger.debug).toHaveBeenCalledWith(
        'ClothingAccessibilityService: Cache cleared for entity',
        expect.objectContaining({ 
          entityId: 'test-entity-123',
          entriesCleared: 3 
        })
      );
    });

    it('should properly clear cache and refetch after clear', () => {
      mockEntityManager.getComponentData.mockReturnValue({
        equipped: { slot: { base: 'item1' } }
      });
      
      // First call populates cache
      service.getAccessibleItems('test-entity');
      const firstCallCount = mockEntityManager.getComponentData.mock.calls.length;
      
      // Clear cache
      service.clearCache('test-entity');
      
      // Next call should fetch again (cache was cleared)
      service.getAccessibleItems('test-entity');
      const finalCallCount = mockEntityManager.getComponentData.mock.calls.length;
      expect(finalCallCount).toBeGreaterThan(firstCallCount);
    });
  });

  describe('coverage analyzer integration', () => {
    it('should not create coverage analyzer when entitiesGateway is not provided', () => {
      const freshMocks = createMocks();
      const serviceWithoutGateway = new ClothingAccessibilityService({
        logger: freshMocks.logger,
        entityManager: freshMocks.entityManager
      });
      
      expect(serviceWithoutGateway).toBeInstanceOf(ClothingAccessibilityService);
      // Should not have the "Coverage analyzer initialized" debug message
      const debugCalls = freshMocks.logger.debug.mock.calls;
      const analyzerCreatedCall = debugCalls.find(call => 
        call[0] === 'ClothingAccessibilityService: Coverage analyzer initialized'
      );
      expect(analyzerCreatedCall).toBeUndefined();
    });
  });

  describe('Priority System', () => {
    describe('Priority calculation', () => {
      it('should prioritize outer > base > underwear', () => {
        mockEntityManager.getComponentData.mockImplementation((entityId, component) => {
          if (component === 'clothing:equipment') {
            return {
              equipped: {
                torso: {
                  outer: 'jacket',
                  base: 'shirt', 
                  underwear: 'undershirt'
                }
              }
            };
          }
          return null;
        });
        
        const result = service.getAccessibleItems('entity1', { 
          mode: 'all',
          sortByPriority: true 
        });
        
        expect(result).toEqual(['jacket', 'shirt', 'undershirt']);
      });
      
      it('should apply context modifiers for removal context', () => {
        mockEntityManager.getComponentData.mockImplementation((entityId, component) => {
          if (component === 'clothing:equipment') {
            return {
              equipped: {
                torso: {
                  outer: 'jacket',
                  base: 'shirt'
                }
              }
            };
          }
          return null;
        });
        
        // Test that outer items get priority boost in removal context
        const result = service.getAccessibleItems('entity1', {
          mode: 'all',
          sortByPriority: true,
          context: 'removal'
        });
        
        // Jacket should come first due to removal context priority boost
        expect(result[0]).toBe('jacket');
      });
      
      it('should handle tie-breaking with stable sort', () => {
        // Set up mock data with multiple items of same layer
        mockEntityManager.getComponentData.mockImplementation((entityId, component) => {
          if (component === 'clothing:equipment') {
            return {
              equipped: {
                torso: {
                  base: 'shirt1'
                },
                arms: {
                  base: 'shirt2'
                }
              }
            };
          }
          return null;
        });
        
        const result = service.getAccessibleItems('entity1', {
          mode: 'all',
          sortByPriority: true
        });
        
        // Both are base layer, should maintain original order
        expect(result).toEqual(['shirt1', 'shirt2']);
      });

      it('should respect sortByPriority option when false', () => {
        mockEntityManager.getComponentData.mockImplementation((entityId, component) => {
          if (component === 'clothing:equipment') {
            return {
              equipped: {
                torso: {
                  underwear: 'undershirt',
                  outer: 'jacket',
                  base: 'shirt'
                }
              }
            };
          }
          return null;
        });
        
        const result = service.getAccessibleItems('entity1', { 
          mode: 'all',
          sortByPriority: false 
        });
        
        // Without sorting, items should be in parse order
        expect(result).toContain('undershirt');
        expect(result).toContain('jacket');
        expect(result).toContain('shirt');
        // But order should not be strictly outer > base > underwear
        expect(result).not.toEqual(['jacket', 'shirt', 'undershirt']);
      });
    });
    
    describe('Priority caching', () => {
      it('should cache priority calculations', () => {
        mockEntityManager.getComponentData.mockReturnValue({
          equipped: {
            torso: { base: 'shirt' }
          }
        });
        
        // First call
        const result1 = service.getAccessibleItems('entity1', {
          mode: 'all',
          sortByPriority: true
        });
        
        // Clear the main cache to ensure we're testing priority cache
        service.clearAllCache();
        
        // Second call with different query but same items for priority calculation
        const result2 = service.getAccessibleItems('entity1', {
          mode: 'all',
          sortByPriority: true,
          context: 'removal' // Same context as default
        });
        
        // Both should return the same item
        expect(result1).toEqual(result2);
      });
      
      it('should clear priority cache when clearCache is called', () => {
        mockEntityManager.getComponentData.mockReturnValue({
          equipped: {
            torso: { base: 'shirt' }
          }
        });
        
        // Populate caches
        service.getAccessibleItems('entity1', {
          mode: 'all',
          sortByPriority: true
        });
        
        // Clear cache for entity
        service.clearCache('entity1');
        
        // Next call should work correctly (testing that clear doesn't break things)
        const result = service.getAccessibleItems('entity1', {
          mode: 'all',
          sortByPriority: true
        });
        
        expect(result).toEqual(['shirt']);
      });
      
      it('should handle large number of items for cache management', () => {
        // Create a large equipment set
        const largeEquipment = {
          equipped: {}
        };
        
        for (let i = 0; i < 100; i++) {
          largeEquipment.equipped[`slot${i}`] = {
            base: `item${i}`
          };
        }
        
        mockEntityManager.getComponentData.mockReturnValue(largeEquipment);
        
        // This should trigger cache management if cache grows too large
        const result = service.getAccessibleItems('entity1', {
          mode: 'all',
          sortByPriority: true
        });
        
        // Should handle 100 items without error
        expect(result).toHaveLength(100);
      });
    });

    describe('Coverage priority fallback', () => {
      it('should use layer-based priority when coverage_mapping is unavailable', () => {
        mockEntityManager.getComponentData.mockImplementation((entityId, component) => {
          if (component === 'clothing:equipment') {
            return {
              equipped: {
                torso: {
                  outer: 'jacket',
                  accessories: 'badge'
                }
              }
            };
          }
          // Return null for coverage_mapping component
          return null;
        });
        
        const result = service.getAccessibleItems('entity1', {
          mode: 'all',
          sortByPriority: true
        });
        
        // Outer should come before accessories (direct priority)
        expect(result[0]).toBe('jacket');
      });
    });
  });
});