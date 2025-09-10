# CLOREMLOG-008: Comprehensive Test Suite for Clothing Interactions

## Overview
**Priority**: Medium  
**Phase**: 2 (Architectural Improvement)  
**Estimated Effort**: 8-12 hours  
**Dependencies**: CLOREMLOG-005, CLOREMLOG-006, CLOREMLOG-007  
**Blocks**: Phase 3 tickets

## Problem Statement

With the unified clothing accessibility service, consolidated priority system, and updated resolvers now in place, the existing test suite needs to be expanded and updated to comprehensively test the new architecture and ensure all clothing interactions work correctly.

**Current Testing Gaps**:
- Tests scattered across multiple files without coordination
- Insufficient coverage of complex clothing interaction scenarios
- No comprehensive end-to-end testing of the complete clothing system
- Missing performance and stress testing for new architecture

**Target State**: Comprehensive, organized test suite that validates all clothing system functionality with high confidence and maintainability.

## Root Cause

**Incremental Development**: Tests were written as individual components were developed, without a holistic view of the clothing system. Now that the architecture is unified, tests need to be consolidated and expanded to match the new system design.

## Acceptance Criteria

### 1. Test Suite Organization
- [ ] **Reorganize existing tests**: Consolidate clothing tests into logical groupings
- [ ] **Remove duplicate tests**: Eliminate redundant test cases
- [ ] **Create test hierarchy**: Unit → Integration → End-to-End test structure
- [ ] **Standardize test patterns**: Consistent test structure and naming

### 2. Comprehensive Unit Test Coverage
- [ ] **ClothingAccessibilityService**: Complete unit test suite >95% coverage
- [ ] **ClothingPriorityManager**: All priority calculation scenarios
- [ ] **Updated resolvers**: ArrayIterationResolver and ClothingStepResolver
- [ ] **Coverage blocking**: All coverage blocking logic and edge cases

### 3. Integration Test Suite
- [ ] **Service integration**: ClothingAccessibilityService with all dependencies
- [ ] **Resolver integration**: Updated resolvers with unified service
- [ ] **Action discovery**: Clothing removal actions with new architecture
- [ ] **Scope resolution**: All clothing scopes with complete system

### 4. End-to-End Test Scenarios
- [ ] **Real character tests**: Multiple character configurations
- [ ] **Complex scenarios**: Multi-layer, cross-area, and edge case equipment
- [ ] **Performance testing**: Large wardrobes and stress scenarios
- [ ] **Error handling**: System failure and recovery scenarios

### 5. Regression Test Suite
- [ ] **Backward compatibility**: Ensure no behavior changes from Phase 1
- [ ] **Layla Agirre validation**: Specific regression test for original issue
- [ ] **Legacy compatibility**: Existing scopes and actions continue working
- [ ] **Performance baseline**: No significant performance degradation

## Implementation Details

### Test Suite Organization

#### New Test File Structure
```
tests/
├── unit/
│   ├── clothing/
│   │   ├── clothingAccessibilityService.test.js
│   │   ├── prioritySystem/
│   │   │   ├── clothingPriorityManager.test.js
│   │   │   └── priorityConfig.test.js
│   │   └── coverageSystem/
│   │       └── coverageAnalyzer.test.js
│   └── scopeDsl/
│       └── nodes/
│           ├── arrayIterationResolver.test.js (updated)
│           └── clothingStepResolver.test.js (updated)
├── integration/
│   ├── clothing/
│   │   ├── clothingSystemIntegration.test.js
│   │   ├── serviceResolverIntegration.test.js
│   │   └── actionDiscoveryIntegration.test.js
│   └── scopes/
│       ├── clothingCoverageBlocking.integration.test.js (from CLOREMLOG-003)
│       └── clothingSystemEndToEnd.integration.test.js
├── performance/
│   ├── clothing/
│   │   ├── clothingServicePerformance.test.js
│   │   └── largeWardrobePerformance.test.js
└── e2e/
    └── clothing/
        └── completeClothingWorkflow.e2e.test.js
```

### Comprehensive Unit Tests

#### ClothingAccessibilityService Test Suite
```javascript
// tests/unit/clothing/clothingAccessibilityService.test.js
import { describe, it, expect, beforeEach } from '@jest/globals';
import { createTestBed } from '../../common/testBed.js';

describe('ClothingAccessibilityService', () => {
  let testBed;
  let clothingService;
  let mockEntityManager;
  let mockCoverageAnalyzer;
  let mockPriorityManager;

  beforeEach(() => {
    testBed = createTestBed();
    mockEntityManager = testBed.createMockEntityManager();
    mockCoverageAnalyzer = testBed.createMockCoverageAnalyzer();
    mockPriorityManager = testBed.createMockPriorityManager();
    
    clothingService = new ClothingAccessibilityService({
      logger: testBed.getMockLogger(),
      entityManager: mockEntityManager,
      coverageAnalyzer: mockCoverageAnalyzer,
      priorityManager: mockPriorityManager
    });
  });

  describe('getAccessibleItems', () => {
    it('should return topmost accessible items for Layla Agirre scenario', () => {
      // Reproduce exact Layla Agirre equipment configuration
      const entityId = 'test:layla_agirre';
      mockEntityManager.getComponent.mockReturnValue({
        equipped: {
          torso_lower: {
            base: 'clothing:dark_olive_high_rise_double_pleat_trousers',
            underwear: 'clothing:power_mesh_boxer_brief'
          }
        }
      });

      // Mock coverage analyzer to block underwear
      mockCoverageAnalyzer.analyzeCoverageBlocking.mockReturnValue({
        isAccessible: (itemId) => itemId !== 'clothing:power_mesh_boxer_brief'
      });

      // Mock priority manager
      mockPriorityManager.getLayerOrder.mockReturnValue(['outer', 'base', 'underwear']);

      const result = clothingService.getAccessibleItems(entityId, { mode: 'topmost' });

      expect(result).toHaveLength(1);
      expect(result[0].itemId).toBe('clothing:dark_olive_high_rise_double_pleat_trousers');
    });

    it('should handle empty equipment gracefully', () => {
      const entityId = 'test:empty_entity';
      mockEntityManager.getComponent.mockReturnValue({ equipped: {} });

      const result = clothingService.getAccessibleItems(entityId);

      expect(result).toEqual([]);
    });

    it('should support different query modes', () => {
      // Test all mode, by-layer mode, etc.
    });

    it('should handle different contexts correctly', () => {
      // Test removal, equipping, display contexts
    });

    it('should cache results for performance', () => {
      // Test caching behavior
    });
  });

  describe('isItemAccessible', () => {
    it('should correctly identify blocked items', () => {
      // Test coverage blocking identification
    });

    it('should return detailed accessibility reasons', () => {
      // Test reason reporting for debugging
    });
  });

  describe('getBlockingItem', () => {
    it('should identify which item is blocking access', () => {
      // Test blocking item identification
    });

    it('should return null when no blocking item exists', () => {
      // Test non-blocked scenarios
    });
  });

  describe('Error Handling', () => {
    it('should gracefully handle coverage analyzer failures', () => {
      mockCoverageAnalyzer.analyzeCoverageBlocking.mockImplementation(() => {
        throw new Error('Coverage analysis failed');
      });

      expect(() => clothingService.getAccessibleItems('test:entity')).not.toThrow();
    });

    it('should gracefully handle entity manager failures', () => {
      mockEntityManager.getComponent.mockImplementation(() => {
        throw new Error('Entity not found');
      });

      expect(() => clothingService.getAccessibleItems('test:invalid')).not.toThrow();
    });
  });

  describe('Performance', () => {
    it('should handle large wardrobes efficiently', () => {
      const largeWardrobe = createLargeWardrobeEquipment();
      mockEntityManager.getComponent.mockReturnValue({ equipped: largeWardrobe });

      const startTime = performance.now();
      clothingService.getAccessibleItems('test:large_wardrobe');
      const endTime = performance.now();

      expect(endTime - startTime).toBeLessThan(10); // 10ms budget
    });

    it('should benefit from caching on repeated queries', () => {
      // Test cache performance improvement
    });
  });
});
```

#### ClothingPriorityManager Test Suite
```javascript
// tests/unit/clothing/prioritySystem/clothingPriorityManager.test.js
describe('ClothingPriorityManager', () => {
  describe('Priority Calculation', () => {
    it('should calculate priorities according to configuration', () => {
      const priorityManager = new ClothingPriorityManager({ logger: mockLogger });

      expect(priorityManager.calculatePriority('outer', 'removal')).toBeLessThan(
        priorityManager.calculatePriority('base', 'removal')
      );
      expect(priorityManager.calculatePriority('base', 'removal')).toBeLessThan(
        priorityManager.calculatePriority('underwear', 'removal')
      );
    });

    it('should handle equipping context with reverse priority', () => {
      // Test equipping context (underwear first, then base, then outer)
    });

    it('should apply context-specific modifiers correctly', () => {
      // Test modifier application
    });
  });

  describe('Layer Ordering', () => {
    it('should return correct order for each context', () => {
      const priorityManager = new ClothingPriorityManager({ logger: mockLogger });

      expect(priorityManager.getLayerOrder('removal')).toEqual(['outer', 'base', 'underwear', 'direct']);
      expect(priorityManager.getLayerOrder('equipping')).toEqual(['direct', 'underwear', 'base', 'outer']);
    });

    it('should handle unknown contexts with fallback', () => {
      // Test fallback behavior for unknown contexts
    });
  });

  describe('Priority Comparison', () => {
    it('should correctly compare items of different priorities', () => {
      const priorityManager = new ClothingPriorityManager({ logger: mockLogger });

      const outerItem = { layer: 'outer', context: 'removal' };
      const baseItem = { layer: 'base', context: 'removal' };

      expect(priorityManager.comparePriority(outerItem, baseItem)).toBeLessThan(0);
    });
  });

  describe('Backward Compatibility', () => {
    it('should produce same results as legacy COVERAGE_PRIORITY', () => {
      // Ensure no breaking changes from consolidation
    });

    it('should support legacy LAYER_PRIORITY behavior', () => {
      // Test topmost mode compatibility
    });
  });
});
```

### Integration Test Suites

#### Complete System Integration Test
```javascript
// tests/integration/clothing/clothingSystemIntegration.test.js
describe('Complete Clothing System Integration', () => {
  let testBed;
  let entityManager;
  let scopeEngine;
  let actionDiscoveryService;

  beforeEach(() => {
    testBed = createTestBed();
    entityManager = testBed.getEntityManager();
    scopeEngine = testBed.getScopeEngine();
    actionDiscoveryService = testBed.getActionDiscoveryService();
  });

  describe('Layla Agirre Regression Suite', () => {
    it('should resolve topmost clothing correctly', () => {
      // Create Layla Agirre with problematic equipment
      const entityId = createLaylaAgirreEntity();

      const result = scopeEngine.resolve('clothing:topmost_clothing', { entityId });

      expect(result).toHaveLength(1);
      expect(result[0].itemId).toBe('clothing:dark_olive_high_rise_double_pleat_trousers');
    });

    it('should show only accessible removal actions', () => {
      const entityId = createLaylaAgirreEntity();

      const actions = actionDiscoveryService.discoverActions(entityId);
      const removeActions = actions.filter(action => action.actionId === 'clothing:remove_clothing');

      expect(removeActions).toHaveLength(1);
      expect(removeActions[0].targets.primary.scope).toBe('clothing:topmost_clothing');
    });
  });

  describe('Complex Clothing Scenarios', () => {
    it('should handle multi-layer torso configuration', () => {
      const entityId = createMultiLayerTorsoEntity();
      const result = scopeEngine.resolve('clothing:topmost_clothing', { entityId });
      
      // Should only return outer layer items
      expect(result.every(item => item.layer === 'outer')).toBe(true);
    });

    it('should not block items in different body areas', () => {
      const entityId = createCrossAreaEntity();
      const result = scopeEngine.resolve('clothing:topmost_clothing', { entityId });
      
      // Should include items from head, torso, and feet
      const bodyAreas = [...new Set(result.map(item => item.bodyArea))];
      expect(bodyAreas.length).toBeGreaterThan(1);
    });

    it('should handle partial equipment configurations', () => {
      const entityId = createPartialEquipmentEntity();
      const result = scopeEngine.resolve('clothing:topmost_clothing', { entityId });
      
      expect(result).toBeDefined();
      expect(Array.isArray(result)).toBe(true);
    });
  });

  describe('Performance Integration', () => {
    it('should handle large character wardrobes efficiently', () => {
      const entityId = createLargeWardrobeEntity();

      const startTime = performance.now();
      const result = scopeEngine.resolve('clothing:topmost_clothing', { entityId });
      const endTime = performance.now();

      expect(endTime - startTime).toBeLessThan(20); // 20ms budget for complex scenarios
      expect(result).toBeDefined();
    });
  });

  describe('Error Recovery Integration', () => {
    it('should handle missing coverage mapping gracefully', () => {
      const entityId = createEntityWithMissingCoverageData();

      expect(() => {
        scopeEngine.resolve('clothing:topmost_clothing', { entityId });
      }).not.toThrow();
    });

    it('should handle malformed equipment data gracefully', () => {
      const entityId = createEntityWithMalformedEquipment();

      expect(() => {
        scopeEngine.resolve('clothing:topmost_clothing', { entityId });
      }).not.toThrow();
    });
  });
});
```

### Performance Test Suite

#### Performance and Stress Testing
```javascript
// tests/performance/clothing/clothingServicePerformance.test.js
describe('Clothing Service Performance', () => {
  describe('Response Time Benchmarks', () => {
    it('should resolve simple clothing queries within 5ms', () => {
      const service = createClothingService();
      const entityId = createSimpleClothingEntity();

      const times = [];
      for (let i = 0; i < 100; i++) {
        const start = performance.now();
        service.getAccessibleItems(entityId, { mode: 'topmost' });
        const end = performance.now();
        times.push(end - start);
      }

      const averageTime = times.reduce((a, b) => a + b) / times.length;
      expect(averageTime).toBeLessThan(5);
    });

    it('should resolve complex clothing queries within 15ms', () => {
      // Test complex scenarios with multiple layers and coverage blocking
    });

    it('should handle cache misses efficiently', () => {
      // Test performance when cache is empty
    });
  });

  describe('Memory Usage', () => {
    it('should not leak memory during repeated queries', () => {
      const service = createClothingService();
      const entityId = createTestEntity();

      const initialMemory = process.memoryUsage().heapUsed;

      for (let i = 0; i < 1000; i++) {
        service.getAccessibleItems(entityId);
        service.clearCache(entityId); // Force cache recreation
      }

      const finalMemory = process.memoryUsage().heapUsed;
      const memoryGrowth = finalMemory - initialMemory;

      expect(memoryGrowth).toBeLessThan(1024 * 1024); // < 1MB growth
    });

    it('should limit cache size appropriately', () => {
      // Test cache eviction and size limits
    });
  });

  describe('Scalability', () => {
    it('should handle 100+ clothing items without performance degradation', () => {
      const service = createClothingService();
      const entityId = createMassiveWardrobeEntity(100);

      const startTime = performance.now();
      service.getAccessibleItems(entityId);
      const endTime = performance.now();

      expect(endTime - startTime).toBeLessThan(50); // 50ms for 100+ items
    });

    it('should handle concurrent queries efficiently', () => {
      // Test multiple simultaneous queries
    });
  });
});
```

### End-to-End Test Suite

#### Complete Workflow Testing
```javascript
// tests/e2e/clothing/completeClothingWorkflow.e2e.test.js
describe('Complete Clothing Workflow E2E', () => {
  describe('Character Creation to Action Discovery', () => {
    it('should work end-to-end for new character with clothing', () => {
      // 1. Create character
      const entityId = 'test:e2e_character';
      entityManager.createEntity(entityId);

      // 2. Equip clothing items
      const equipment = {
        torso_upper: { base: 'clothing:t_shirt' },
        torso_lower: { base: 'clothing:jeans', underwear: 'clothing:underwear' },
        feet: { base: 'clothing:sneakers' }
      };
      entityManager.setComponent(entityId, 'core:equipment', { equipped: equipment });

      // 3. Discover available actions
      const actions = actionDiscoveryService.discoverActions(entityId);
      const clothingActions = actions.filter(a => a.actionId === 'clothing:remove_clothing');

      // 4. Verify actions match expected accessibility
      expect(clothingActions.length).toBeGreaterThan(0);
      
      // 5. Execute clothing scope resolution
      const accessibleItems = scopeEngine.resolve('clothing:topmost_clothing', { entityId });
      
      // 6. Verify results are consistent
      expect(accessibleItems.length).toBe(3); // t_shirt, jeans, sneakers
      expect(accessibleItems.find(item => item.itemId === 'clothing:underwear')).toBeUndefined();
    });

    it('should handle equipment changes dynamically', () => {
      // Test that removing outer layer makes inner layer accessible
    });

    it('should work with complex character recipes', () => {
      // Test with actual character recipe data
    });
  });

  describe('Error Scenarios E2E', () => {
    it('should handle missing clothing data gracefully', () => {
      // Test with incomplete or missing clothing item definitions
    });

    it('should recover from service failures', () => {
      // Test system resilience when components fail
    });
  });
});
```

## Testing Utilities and Helpers

### Test Data Factory
```javascript
// tests/common/clothingTestDataFactory.js
export class ClothingTestDataFactory {
  static createLaylaAgirreEquipment() {
    return {
      torso_lower: {
        base: 'clothing:dark_olive_high_rise_double_pleat_trousers',
        underwear: 'clothing:power_mesh_boxer_brief'
      }
    };
  }

  static createMultiLayerEquipment() {
    return {
      torso_upper: {
        outer: 'clothing:winter_coat',
        base: 'clothing:sweater',
        underwear: 'clothing:undershirt'
      }
    };
  }

  static createLargeWardrobeEquipment(itemCount = 50) {
    const equipment = {};
    const slots = ['head', 'torso_upper', 'torso_lower', 'arms', 'legs', 'feet'];
    const layers = ['outer', 'base', 'underwear'];
    
    for (let i = 0; i < itemCount; i++) {
      const slot = slots[i % slots.length];
      const layer = layers[i % layers.length];
      
      if (!equipment[slot]) equipment[slot] = {};
      equipment[slot][layer] = `clothing:item_${i}`;
    }
    
    return equipment;
  }
}
```

### Test Assertion Helpers
```javascript
// tests/common/clothingTestAssertions.js
export class ClothingTestAssertions {
  static assertOnlyAccessibleItems(result, expectedAccessible, expectedBlocked) {
    const resultIds = result.map(item => item.itemId);
    
    expectedAccessible.forEach(itemId => {
      expect(resultIds).toContain(itemId);
    });
    
    expectedBlocked.forEach(itemId => {
      expect(resultIds).not.toContain(itemId);
    });
  }

  static assertCorrectLayerPriority(result, expectedOrder) {
    const layers = result.map(item => item.layer);
    const uniqueLayers = [...new Set(layers)];
    
    expect(uniqueLayers).toEqual(expectedOrder);
  }

  static assertPerformanceWithin(fn, maxTimeMs) {
    const start = performance.now();
    fn();
    const end = performance.now();
    
    expect(end - start).toBeLessThan(maxTimeMs);
  }
}
```

## Risk Assessment

### Testing Risks
| Risk | Probability | Impact | Mitigation |
|------|-------------|---------|-------------|
| Incomplete test coverage | Medium | High | Systematic test planning and coverage monitoring |
| Flaky integration tests | Medium | Medium | Robust test setup and cleanup |
| Performance test instability | Low | Low | Conservative performance thresholds |
| Test maintenance burden | Medium | Low | Good test organization and utilities |

### Quality Risks
| Risk | Probability | Impact | Mitigation |
|------|-------------|---------|-------------|
| Missing edge cases | Medium | Medium | Comprehensive scenario planning |
| Test suite execution time | Low | Low | Efficient test design and parallel execution |
| False positives/negatives | Low | Medium | Careful assertion design |

## Definition of Done
- [ ] All unit tests achieve >95% coverage for new components
- [ ] Integration tests validate complete system behavior
- [ ] Performance tests establish baseline and detect regressions
- [ ] End-to-end tests cover complete workflows
- [ ] Regression tests prevent future issues
- [ ] Test suite runs reliably in CI/CD pipeline
- [ ] Test documentation provides clear guidance
- [ ] Test utilities are reusable and maintainable

## Dependencies and Integration

### Upstream Dependencies
- **CLOREMLOG-005**: ClothingAccessibilityService implementation
- **CLOREMLOG-006**: ClothingPriorityManager implementation
- **CLOREMLOG-007**: Updated resolvers with service integration

### Downstream Impact
- **Phase 3**: Provides test foundation for performance optimization
- **Future development**: Establishes testing patterns for clothing system enhancements
- **Quality assurance**: Prevents regression and ensures system reliability

## Success Metrics
- **Coverage**: >95% unit test coverage for all clothing components
- **Performance**: <10ms average response time for typical queries
- **Reliability**: 0 test failures in CI/CD pipeline
- **Maintainability**: Clear test organization and comprehensive documentation
- **Confidence**: High confidence in clothing system reliability and correctness

## Notes
- Focus on realistic scenarios that reflect actual game usage
- Performance tests should establish baselines for future optimization work
- Test organization should make it easy to add new tests as the system evolves
- Error handling tests are critical for system reliability
- Documentation should help future developers understand and extend the test suite