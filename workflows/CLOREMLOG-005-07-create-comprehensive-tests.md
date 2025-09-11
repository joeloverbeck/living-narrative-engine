# CLOREMLOG-005-07: Create Comprehensive Test Suite

## Overview
**Parent**: CLOREMLOG-005  
**Priority**: High  
**Estimated Effort**: 3 hours  
**Dependencies**: CLOREMLOG-005-01 through CLOREMLOG-005-06  
**Blocks**: CLOREMLOG-005-08

## Problem Statement
The new ClothingAccessibilityService requires comprehensive testing including unit tests, integration tests, and performance benchmarks to ensure correctness and efficiency.

## Acceptance Criteria

### 1. Unit Test Coverage (>95%)
- [ ] Test all public methods
- [ ] Test error conditions
- [ ] Test caching behavior
- [ ] Test priority calculations
- [ ] Test coverage blocking logic

### 2. Integration Tests
- [ ] Test with real entity manager
- [ ] Test Layla Agirre scenario
- [ ] Test DI container integration
- [ ] Test with ArrayIterationResolver

### 3. Performance Tests
- [ ] Benchmark against current implementation
- [ ] Test with large wardrobes (100+ items)
- [ ] Test cache efficiency
- [ ] Memory usage profiling

## Implementation Details

### Unit Test Suite
```javascript
// tests/unit/clothing/services/clothingAccessibilityService.test.js

import { describe, it, expect, beforeEach, jest } from '@jest/globals';
import { ClothingAccessibilityService } from '../../../../src/clothing/services/clothingAccessibilityService.js';
import createCoverageAnalyzer from '../../../../src/clothing/analysis/coverageAnalyzer.js';

describe('ClothingAccessibilityService', () => {
  let service;
  let mockLogger;
  let mockEntityManager;
  let mockEntitiesGateway;

  beforeEach(() => {
    mockLogger = {
      debug: jest.fn(),
      info: jest.fn(),
      warn: jest.fn(),
      error: jest.fn()
    };
    
    mockEntityManager = {
      getComponent: jest.fn(),
      hasComponent: jest.fn()
    };
    
    mockEntitiesGateway = {
      getComponentData: jest.fn()
    };
    
    service = new ClothingAccessibilityService({
      logger: mockLogger,
      entityManager: mockEntityManager,
      entitiesGateway: mockEntitiesGateway
    });
  });

  describe('Constructor', () => {
    it('should validate required dependencies', () => {
      expect(() => new ClothingAccessibilityService({}))
        .toThrow();
    });
    
    it('should initialize with valid dependencies', () => {
      expect(service).toBeDefined();
      expect(service.getAccessibleItems).toBeDefined();
    });
    
    it('should handle coverage analyzer initialization failure', () => {
      mockEntitiesGateway.getComponentData = null; // Invalid
      
      const svc = new ClothingAccessibilityService({
        logger: mockLogger,
        entityManager: mockEntityManager,
        entitiesGateway: mockEntitiesGateway
      });
      
      expect(svc).toBeDefined();
      expect(mockLogger.warn).toHaveBeenCalled();
    });
  });

  describe('getAccessibleItems', () => {
    describe('Basic functionality', () => {
      it('should return empty array for entity with no equipment', () => {
        mockEntityManager.getComponent.mockReturnValue(null);
        
        const result = service.getAccessibleItems('entity1');
        expect(result).toEqual([]);
      });
      
      it('should return all items when no coverage blocking', () => {
        mockEntityManager.getComponent.mockReturnValue({
          equipped: {
            torso: {
              base: 'shirt',
              outer: 'jacket'
            }
          }
        });
        
        const result = service.getAccessibleItems('entity1', { mode: 'all' });
        expect(result).toContain('shirt');
        expect(result).toContain('jacket');
      });
    });

    describe('Mode-specific behavior', () => {
      beforeEach(() => {
        mockEntityManager.getComponent.mockImplementation((id, component) => {
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
          if (component === 'clothing:coverage_mapping') {
            const mapping = {
              'jacket': { covers: ['torso'], coveragePriority: 'outer' },
              'shirt': { covers: ['torso'], coveragePriority: 'base' },
              'undershirt': { covers: ['torso'], coveragePriority: 'underwear' }
            };
            return mapping[id];
          }
          return null;
        });
        
        mockEntitiesGateway.getComponentData.mockImplementation((id, component) => {
          return mockEntityManager.getComponent(id, component);
        });
      });
      
      it('should return only topmost items in topmost mode', () => {
        const result = service.getAccessibleItems('entity1', { 
          mode: 'topmost' 
        });
        expect(result).toEqual(['jacket']);
      });
      
      it('should return all items in all mode', () => {
        const result = service.getAccessibleItems('entity1', { 
          mode: 'all' 
        });
        expect(result.length).toBe(3);
      });
      
      it('should filter by layer when specified', () => {
        const result = service.getAccessibleItems('entity1', { 
          mode: 'all',
          layer: 'base' 
        });
        expect(result).toEqual(['shirt']);
      });
    });

    describe('Coverage blocking', () => {
      it('should block underwear covered by base layer', () => {
        mockEntityManager.getComponent.mockImplementation((id, component) => {
          if (component === 'clothing:equipment') {
            return {
              equipped: {
                torso_lower: {
                  base: 'trousers',
                  underwear: 'boxer_brief'
                }
              }
            };
          }
          if (component === 'clothing:coverage_mapping') {
            const mapping = {
              'trousers': { 
                covers: ['torso_lower'], 
                coveragePriority: 'base' 
              },
              'boxer_brief': { 
                covers: ['torso_lower'], 
                coveragePriority: 'underwear' 
              }
            };
            return mapping[id];
          }
          return null;
        });
        
        mockEntitiesGateway.getComponentData.mockImplementation((id, component) => {
          return mockEntityManager.getComponent(id, component);
        });
        
        const result = service.getAccessibleItems('layla_agirre', { 
          mode: 'topmost' 
        });
        
        expect(result).toEqual(['trousers']);
        expect(result).not.toContain('boxer_brief');
      });
    });

    describe('Priority sorting', () => {
      it('should sort items by priority', () => {
        mockEntityManager.getComponent.mockReturnValue({
          equipped: {
            slot1: { outer: 'item1' },
            slot2: { base: 'item2' },
            slot3: { underwear: 'item3' }
          }
        });
        
        const result = service.getAccessibleItems('entity1', { 
          mode: 'all',
          sortByPriority: true 
        });
        
        // Should be ordered: outer, base, underwear
        expect(result[0]).toBe('item1');
        expect(result[1]).toBe('item2');
        expect(result[2]).toBe('item3');
      });
    });
  });

  describe('isItemAccessible', () => {
    it('should return accessible for unblocked item', () => {
      mockEntityManager.getComponent.mockReturnValue({
        equipped: { slot: { base: 'item1' } }
      });
      
      const result = service.isItemAccessible('entity1', 'item1');
      expect(result.accessible).toBe(true);
      expect(result.reason).toContain('accessible');
    });
    
    it('should return not accessible for blocked item', () => {
      // Setup blocking scenario
      mockEntityManager.getComponent.mockImplementation((id, component) => {
        if (component === 'clothing:equipment') {
          return {
            equipped: {
              torso: {
                outer: 'blocker',
                base: 'blocked'
              }
            }
          };
        }
        if (component === 'clothing:coverage_mapping') {
          const mapping = {
            'blocker': { covers: ['torso'], coveragePriority: 'outer' },
            'blocked': { covers: ['torso'], coveragePriority: 'base' }
          };
          return mapping[id];
        }
        return null;
      });
      
      mockEntitiesGateway.getComponentData.mockImplementation((id, component) => {
        return mockEntityManager.getComponent(id, component);
      });
      
      const result = service.isItemAccessible('entity1', 'blocked');
      expect(result.accessible).toBe(false);
      expect(result.reason).toContain('Blocked');
      expect(result.blockingItems).toContain('blocker');
    });
  });

  describe('getBlockingItem', () => {
    it('should return null for accessible item', () => {
      mockEntityManager.getComponent.mockReturnValue({
        equipped: { slot: { base: 'item1' } }
      });
      
      const result = service.getBlockingItem('entity1', 'item1');
      expect(result).toBeNull();
    });
    
    it('should return blocking item ID', () => {
      // Use same blocking setup as above
      const result = service.getBlockingItem('entity1', 'blocked');
      expect(result).toBe('blocker');
    });
  });

  describe('Caching', () => {
    beforeEach(() => {
      jest.useFakeTimers();
    });
    
    afterEach(() => {
      jest.useRealTimers();
    });
    
    it('should cache results for 5 seconds', () => {
      mockEntityManager.getComponent.mockReturnValue({
        equipped: { slot: { base: 'item1' } }
      });
      
      service.getAccessibleItems('entity1');
      service.getAccessibleItems('entity1');
      
      expect(mockEntityManager.getComponent).toHaveBeenCalledTimes(1);
    });
    
    it('should invalidate cache after TTL', () => {
      mockEntityManager.getComponent.mockReturnValue({
        equipped: { slot: { base: 'item1' } }
      });
      
      service.getAccessibleItems('entity1');
      jest.advanceTimersByTime(6000);
      service.getAccessibleItems('entity1');
      
      expect(mockEntityManager.getComponent).toHaveBeenCalledTimes(2);
    });
    
    it('should clear cache for specific entity', () => {
      mockEntityManager.getComponent.mockReturnValue({
        equipped: { slot: { base: 'item1' } }
      });
      
      service.getAccessibleItems('entity1');
      service.clearCache('entity1');
      service.getAccessibleItems('entity1');
      
      expect(mockEntityManager.getComponent).toHaveBeenCalledTimes(2);
    });
  });

  describe('Error handling', () => {
    it('should handle entity manager errors gracefully', () => {
      mockEntityManager.getComponent.mockImplementation(() => {
        throw new Error('Database error');
      });
      
      const result = service.getAccessibleItems('entity1');
      expect(result).toEqual([]);
      expect(mockLogger.warn).toHaveBeenCalled();
    });
    
    it('should handle coverage analyzer errors', () => {
      mockEntityManager.getComponent.mockReturnValue({
        equipped: { slot: { base: 'item1' } }
      });
      
      // Force coverage analyzer error
      mockEntitiesGateway.getComponentData.mockImplementation(() => {
        throw new Error('Coverage error');
      });
      
      const result = service.getAccessibleItems('entity1', { 
        mode: 'topmost' 
      });
      
      // Should fall back to returning all items
      expect(result).toContain('item1');
      expect(mockLogger.warn).toHaveBeenCalled();
    });
  });
});
```

### Integration Test Suite
```javascript
// tests/integration/clothing/clothingAccessibilityService.integration.test.js

import { describe, it, expect, beforeEach } from '@jest/globals';
import { SimpleEntityManager } from '../../common/entities/index.js';
import { ClothingAccessibilityService } from '../../../src/clothing/services/clothingAccessibilityService.js';
import createCoverageAnalyzer from '../../../src/clothing/analysis/coverageAnalyzer.js';

describe('ClothingAccessibilityService Integration', () => {
  let entityManager;
  let service;
  let logger;

  beforeEach(() => {
    logger = {
      debug: jest.fn(),
      info: jest.fn(),
      warn: jest.fn(),
      error: jest.fn()
    };
    
    entityManager = new SimpleEntityManager([]);
    
    // Create entities gateway adapter
    const entitiesGateway = {
      getComponentData: (entityId, componentId) => 
        entityManager.getComponent(entityId, componentId)
    };
    
    service = new ClothingAccessibilityService({
      logger,
      entityManager,
      entitiesGateway
    });
  });

  describe('Layla Agirre scenario', () => {
    beforeEach(() => {
      // Create Layla entity
      entityManager.createEntity('layla_agirre');
      entityManager.addComponent('layla_agirre', 'core:actor', {
        name: 'Layla Agirre'
      });
      entityManager.addComponent('layla_agirre', 'clothing:equipment', {
        equipped: {
          torso_lower: {
            base: 'asudem:trousers',
            underwear: 'asudem:boxer_brief'
          }
        }
      });
      
      // Create clothing items
      entityManager.createEntity('asudem:trousers');
      entityManager.addComponent('asudem:trousers', 'clothing:coverage_mapping', {
        covers: ['torso_lower'],
        coveragePriority: 'base'
      });
      
      entityManager.createEntity('asudem:boxer_brief');
      entityManager.addComponent('asudem:boxer_brief', 'clothing:coverage_mapping', {
        covers: ['torso_lower'],
        coveragePriority: 'underwear'
      });
    });
    
    it('should only return trousers as accessible in topmost mode', () => {
      const result = service.getAccessibleItems('layla_agirre', {
        mode: 'topmost'
      });
      
      expect(result).toEqual(['asudem:trousers']);
      expect(result).not.toContain('asudem:boxer_brief');
    });
    
    it('should correctly identify boxer brief as blocked', () => {
      const result = service.isItemAccessible('layla_agirre', 'asudem:boxer_brief');
      
      expect(result.accessible).toBe(false);
      expect(result.blockingItems).toContain('asudem:trousers');
    });
    
    it('should identify trousers as the blocking item', () => {
      const blocker = service.getBlockingItem('layla_agirre', 'asudem:boxer_brief');
      expect(blocker).toBe('asudem:trousers');
    });
  });

  describe('Complex wardrobe scenario', () => {
    beforeEach(() => {
      // Create entity with full outfit
      entityManager.createEntity('fully_dressed');
      entityManager.addComponent('fully_dressed', 'clothing:equipment', {
        equipped: {
          head: { outer: 'hat' },
          torso_upper: {
            outer: 'coat',
            base: 'shirt',
            underwear: 'undershirt'
          },
          torso_lower: {
            outer: 'skirt',
            base: 'leggings',
            underwear: 'underwear'
          },
          feet: {
            outer: 'boots',
            base: 'socks'
          }
        }
      });
      
      // Create coverage mappings for all items
      const items = [
        { id: 'hat', covers: ['head'], priority: 'outer' },
        { id: 'coat', covers: ['torso_upper'], priority: 'outer' },
        { id: 'shirt', covers: ['torso_upper'], priority: 'base' },
        { id: 'undershirt', covers: ['torso_upper'], priority: 'underwear' },
        { id: 'skirt', covers: ['torso_lower'], priority: 'outer' },
        { id: 'leggings', covers: ['torso_lower'], priority: 'base' },
        { id: 'underwear', covers: ['torso_lower'], priority: 'underwear' },
        { id: 'boots', covers: ['feet'], priority: 'outer' },
        { id: 'socks', covers: ['feet'], priority: 'base' }
      ];
      
      items.forEach(item => {
        entityManager.createEntity(item.id);
        entityManager.addComponent(item.id, 'clothing:coverage_mapping', {
          covers: item.covers,
          coveragePriority: item.priority
        });
      });
    });
    
    it('should return only topmost items per slot', () => {
      const result = service.getAccessibleItems('fully_dressed', {
        mode: 'topmost'
      });
      
      expect(result).toContain('hat');
      expect(result).toContain('coat');
      expect(result).toContain('skirt');
      expect(result).toContain('boots');
      expect(result).not.toContain('shirt');
      expect(result).not.toContain('undershirt');
      expect(result).not.toContain('leggings');
      expect(result).not.toContain('underwear');
      expect(result).not.toContain('socks');
    });
    
    it('should return all items in all mode', () => {
      const result = service.getAccessibleItems('fully_dressed', {
        mode: 'all'
      });
      
      expect(result.length).toBe(9);
    });
  });
});
```

### Performance Test Suite
```javascript
// tests/performance/clothing/clothingAccessibilityService.performance.test.js

import { describe, it, expect, beforeEach } from '@jest/globals';
import { performance } from 'perf_hooks';
import { ClothingAccessibilityService } from '../../../src/clothing/services/clothingAccessibilityService.js';

describe('ClothingAccessibilityService Performance', () => {
  let service;
  let mockEntityManager;
  let mockEntitiesGateway;

  beforeEach(() => {
    // Create mock with large wardrobe
    mockEntityManager = {
      getComponent: jest.fn((id, component) => {
        if (component === 'clothing:equipment') {
          // Generate 100+ items
          const equipment = {};
          for (let i = 0; i < 20; i++) {
            equipment[`slot_${i}`] = {
              outer: `outer_${i}`,
              base: `base_${i}`,
              underwear: `underwear_${i}`,
              accessories: `accessory_${i}`
            };
          }
          return { equipped: equipment };
        }
        return null;
      }),
      hasComponent: jest.fn(() => true)
    };
    
    mockEntitiesGateway = {
      getComponentData: jest.fn(() => ({
        covers: ['body_area'],
        coveragePriority: 'base'
      }))
    };
    
    service = new ClothingAccessibilityService({
      logger: { debug: () => {}, info: () => {}, warn: () => {}, error: () => {} },
      entityManager: mockEntityManager,
      entitiesGateway: mockEntitiesGateway
    });
  });

  it('should handle large wardrobes efficiently', () => {
    const start = performance.now();
    
    for (let i = 0; i < 100; i++) {
      service.getAccessibleItems('entity1', { mode: 'topmost' });
    }
    
    const duration = performance.now() - start;
    const avgTime = duration / 100;
    
    expect(avgTime).toBeLessThan(10); // Less than 10ms per query
  });

  it('should demonstrate cache efficiency', () => {
    // First call - no cache
    const uncachedStart = performance.now();
    service.getAccessibleItems('entity1', { mode: 'topmost' });
    const uncachedTime = performance.now() - uncachedStart;
    
    // Second call - cached
    const cachedStart = performance.now();
    service.getAccessibleItems('entity1', { mode: 'topmost' });
    const cachedTime = performance.now() - cachedStart;
    
    // Cached should be at least 10x faster
    expect(cachedTime).toBeLessThan(uncachedTime / 10);
  });

  it('should scale linearly with item count', () => {
    const measurements = [];
    
    for (let itemCount of [10, 20, 40, 80]) {
      mockEntityManager.getComponent.mockImplementation((id, component) => {
        if (component === 'clothing:equipment') {
          const equipment = {};
          for (let i = 0; i < itemCount / 4; i++) {
            equipment[`slot_${i}`] = {
              outer: `outer_${i}`,
              base: `base_${i}`,
              underwear: `underwear_${i}`,
              accessories: `accessory_${i}`
            };
          }
          return { equipped: equipment };
        }
        return null;
      });
      
      // Clear cache
      service.clearCache('entity1');
      
      const start = performance.now();
      service.getAccessibleItems('entity1', { mode: 'all' });
      const duration = performance.now() - start;
      
      measurements.push({ itemCount, duration });
    }
    
    // Check that performance scales roughly linearly
    const ratio1 = measurements[1].duration / measurements[0].duration;
    const ratio2 = measurements[2].duration / measurements[1].duration;
    const ratio3 = measurements[3].duration / measurements[2].duration;
    
    // Ratios should be close to 2 (linear scaling)
    expect(ratio1).toBeGreaterThan(1.5);
    expect(ratio1).toBeLessThan(3);
    expect(ratio2).toBeGreaterThan(1.5);
    expect(ratio2).toBeLessThan(3);
    expect(ratio3).toBeGreaterThan(1.5);
    expect(ratio3).toBeLessThan(3);
  });

  describe('Memory usage', () => {
    it('should not leak memory with cache management', () => {
      if (global.gc) {
        global.gc(); // Force garbage collection if available
      }
      
      const initialMemory = process.memoryUsage().heapUsed;
      
      // Perform many operations
      for (let i = 0; i < 1000; i++) {
        service.getAccessibleItems(`entity_${i}`, { 
          mode: 'topmost',
          uniqueOption: i // Force different cache keys
        });
      }
      
      if (global.gc) {
        global.gc();
      }
      
      const finalMemory = process.memoryUsage().heapUsed;
      const memoryIncrease = finalMemory - initialMemory;
      
      // Should not increase by more than 10MB
      expect(memoryIncrease).toBeLessThan(10 * 1024 * 1024);
    });
  });
});
```

## Success Metrics
- [ ] Unit test coverage >95%
- [ ] All integration tests pass
- [ ] Performance meets or exceeds current implementation
- [ ] No memory leaks detected
- [ ] Layla Agirre scenario correctly handled

## Notes
- Run with `npm run test:unit tests/unit/clothing/services/`
- Run with `npm run test:integration tests/integration/clothing/`
- Run with `npm run test:performance tests/performance/clothing/`
- Memory tests may require `--expose-gc` flag