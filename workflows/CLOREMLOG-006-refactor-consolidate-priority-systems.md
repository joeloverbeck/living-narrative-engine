# CLOREMLOG-006: Refactor and Consolidate Priority Systems

## Overview
**Priority**: Medium  
**Phase**: 2 (Architectural Improvement)  
**Estimated Effort**: 8-12 hours  
**Dependencies**: CLOREMLOG-005 (Unified Clothing Service)  
**Blocks**: CLOREMLOG-007, CLOREMLOG-008

## Problem Statement

The clothing system currently has two separate and inconsistent priority systems that don't coordinate with each other:

1. **Layer Priority** (`arrayIterationResolver.js`): `['outer', 'base', 'underwear']`
2. **Coverage Priority** (`priorityConstants.js`): `{outer: 100, base: 200, underwear: 300, direct: 400}`

This duplication creates maintenance burdens, inconsistent behavior, and makes it difficult to add new priority rules or clothing types.

**Specific Issues**:
- Priority calculations exist in multiple places
- Inconsistent priority values and orderings
- Hard to extend for new clothing types or contexts
- No single source of truth for clothing priorities

## Root Cause

**Technical Debt**: The priority systems evolved separately:
- `LAYER_PRIORITY` was added for scope resolution ordering
- `COVERAGE_PRIORITY` was added for coverage blocking logic
- No consolidation occurred when coverage blocking was implemented
- Different numbering schemes make integration difficult

## Acceptance Criteria

### 1. Unified Priority System Design
- [ ] **Single source of truth**: One priority system that serves all clothing needs
- [ ] **Extensible design**: Easy to add new layers, priorities, or clothing types
- [ ] **Context awareness**: Different priorities for different contexts (removal, equipping, display)
- [ ] **Performance optimized**: Cached priority calculations for frequent queries

### 2. Priority System Architecture
- [ ] **File**: `src/clothing/prioritySystem/clothingPriorityManager.js`
- [ ] **Configuration**: Externalized priority configuration for easy modification
- [ ] **Calculation engine**: Unified priority calculation with caching
- [ ] **Context support**: Different priority schemes for different use cases
- [ ] **Validation**: Priority consistency checking and validation

### 3. Migration and Integration
- [ ] **Update priority constants**: Consolidate existing constants into new system
- [ ] **Update array iteration**: Remove duplicate priority logic from resolver
- [ ] **Update clothing service**: Integrate with CLOREMLOG-005 unified service
- [ ] **Backward compatibility**: Ensure existing code continues to work during migration

### 4. Testing and Validation
- [ ] **Priority calculation tests**: Verify all priority calculations are correct
- [ ] **Performance tests**: Ensure priority lookups are fast
- [ ] **Integration tests**: Validate priority system works with clothing service
- [ ] **Migration tests**: Confirm no behavior changes during consolidation

## Implementation Details

### Unified Priority System Architecture

#### Core Priority Manager
```javascript
/**
 * @file Unified clothing priority management system
 * Consolidates layer priority and coverage priority into single system
 * with context-aware priority calculation and caching.
 */

import { validateDependency } from '../../utils/dependencyUtils.js';

export class ClothingPriorityManager {
  #logger;
  #priorityConfig;
  #calculationCache;
  #contextMappings;

  constructor({ logger, priorityConfig = DEFAULT_PRIORITY_CONFIG }) {
    validateDependency(logger, 'ILogger', logger, {
      requiredMethods: ['debug', 'warn', 'error']
    });
    
    this.#logger = logger;
    this.#priorityConfig = priorityConfig;
    this.#calculationCache = new Map();
    this.#contextMappings = this.buildContextMappings(priorityConfig);
  }

  /**
   * Calculate priority for a clothing item in given context
   * @param {string} layer - Clothing layer (outer, base, underwear, direct)
   * @param {string} context - Usage context (removal, equipping, display)
   * @param {Object} modifiers - Additional priority modifiers
   * @returns {number} Calculated priority (lower = higher priority)
   */
  calculatePriority(layer, context = 'removal', modifiers = {}) {
    const cacheKey = this.createCacheKey(layer, context, modifiers);
    
    if (this.#calculationCache.has(cacheKey)) {
      return this.#calculationCache.get(cacheKey);
    }

    const priority = this.computePriority(layer, context, modifiers);
    this.#calculationCache.set(cacheKey, priority);
    
    return priority;
  }

  /**
   * Get layer ordering for a specific context
   * @param {string} context - Usage context
   * @returns {Array<string>} Ordered list of layers (highest to lowest priority)
   */
  getLayerOrder(context = 'removal') {
    const contextConfig = this.#contextMappings.get(context);
    if (!contextConfig) {
      this.#logger.warn(`Unknown context: ${context}, using default`);
      return this.#priorityConfig.defaultOrder;
    }

    return contextConfig.layerOrder;
  }

  /**
   * Compare two items by priority
   * @param {Object} item1 - First item with layer and context
   * @param {Object} item2 - Second item with layer and context  
   * @returns {number} Comparison result (negative = item1 higher priority)
   */
  comparePriority(item1, item2) {
    const priority1 = this.calculatePriority(item1.layer, item1.context, item1.modifiers);
    const priority2 = this.calculatePriority(item2.layer, item2.context, item2.modifiers);
    
    return priority1 - priority2;
  }

  /**
   * Check if layer1 has higher priority than layer2 in given context
   * @param {string} layer1 - First layer
   * @param {string} layer2 - Second layer
   * @param {string} context - Usage context
   * @returns {boolean} True if layer1 has higher priority
   */
  hasHigherPriority(layer1, layer2, context = 'removal') {
    const priority1 = this.calculatePriority(layer1, context);
    const priority2 = this.calculatePriority(layer2, context);
    
    return priority1 < priority2; // Lower number = higher priority
  }

  /**
   * Clear priority calculation cache
   */
  clearCache() {
    this.#calculationCache.clear();
  }

  // Private methods...
  private computePriority(layer, context, modifiers) {
    // Implementation details...
  }

  private createCacheKey(layer, context, modifiers) {
    // Implementation details...
  }

  private buildContextMappings(config) {
    // Implementation details...
  }
}
```

#### Priority Configuration System
```javascript
// src/clothing/prioritySystem/priorityConfig.js

/**
 * Unified priority configuration for all clothing contexts
 * Consolidates previous LAYER_PRIORITY and COVERAGE_PRIORITY systems
 */
export const DEFAULT_PRIORITY_CONFIG = {
  // Base priority values (lower = higher priority)
  basePriorities: {
    outer: 100,     // Highest priority (coats, jackets)
    base: 200,      // Medium priority (shirts, pants)  
    underwear: 300, // Lower priority (undergarments)
    direct: 400     // Lowest priority (skin contact items)
  },

  // Context-specific configurations
  contexts: {
    removal: {
      description: 'Priority for clothing removal actions',
      layerOrder: ['outer', 'base', 'underwear', 'direct'],
      modifiers: {
        // Outer items easier to remove
        outer: 0,
        base: 0,
        underwear: 50,   // Slightly harder to access
        direct: 100      // Hardest to access
      }
    },

    equipping: {
      description: 'Priority for clothing equipping actions',
      layerOrder: ['direct', 'underwear', 'base', 'outer'],
      modifiers: {
        // Reverse order for equipping
        direct: 0,
        underwear: 0,
        base: 0,
        outer: 0
      }
    },

    display: {
      description: 'Priority for clothing display and inspection',
      layerOrder: ['outer', 'base', 'underwear', 'direct'],
      modifiers: {
        // All items equally visible for inspection
        outer: 0,
        base: 0,
        underwear: 0,
        direct: 0
      }
    },

    topmost: {
      description: 'Legacy topmost mode compatibility',
      layerOrder: ['outer', 'base', 'underwear'],
      modifiers: {
        outer: 0,
        base: 0,
        underwear: 0,
        direct: 999  // Direct items not included in topmost
      }
    }
  },

  // Default configuration
  defaultOrder: ['outer', 'base', 'underwear', 'direct'],
  
  // Extension points for new clothing types
  extensionLayers: {
    // Future layers can be added here
    // accessories: 50,  // Between outer and base
    // seasonal: 75      // Context-dependent layers
  }
};
```

### Integration with Existing Systems

#### Update Priority Constants
```javascript
// src/scopeDsl/prioritySystem/priorityConstants.js

import { DEFAULT_PRIORITY_CONFIG } from '../../clothing/prioritySystem/priorityConfig.js';

/**
 * @deprecated Use ClothingPriorityManager instead
 * Kept for backward compatibility during migration
 */
export const COVERAGE_PRIORITY = Object.freeze(
  DEFAULT_PRIORITY_CONFIG.basePriorities
);

/**
 * @deprecated Use ClothingPriorityManager.getLayerOrder() instead
 * Kept for backward compatibility during migration
 */
export const LEGACY_LAYER_PRIORITY = {
  topmost: DEFAULT_PRIORITY_CONFIG.contexts.topmost.layerOrder,
  // Add other legacy mappings as needed
};
```

#### Update Array Iteration Resolver
```javascript
// In src/scopeDsl/nodes/arrayIterationResolver.js

// Replace existing LAYER_PRIORITY with priority manager
import { ClothingPriorityManager } from '../../clothing/prioritySystem/clothingPriorityManager.js';

class ArrayIterationResolver {
  #priorityManager;

  constructor({ priorityManager, ...otherDeps }) {
    this.#priorityManager = priorityManager;
    // ... other initialization
  }

  getAllClothingItems(clothingAccess, trace) {
    const { equipped, mode, entityId } = clothingAccess;
    
    // Use priority manager instead of hardcoded LAYER_PRIORITY
    const layers = this.#priorityManager.getLayerOrder(mode);
    
    // ... rest of method using priority manager for comparisons
  }
}
```

### Performance Optimization

#### Priority Calculation Caching
```javascript
class PriorityCache {
  constructor(maxSize = 1000, ttlMs = 30000) {
    this.cache = new Map();
    this.maxSize = maxSize;
    this.ttl = ttlMs;
    this.accessTimes = new Map();
  }

  get(key) {
    const entry = this.cache.get(key);
    if (!entry) return null;

    const now = Date.now();
    if (now - entry.timestamp > this.ttl) {
      this.delete(key);
      return null;
    }

    this.accessTimes.set(key, now);
    return entry.value;
  }

  set(key, value) {
    // LRU eviction if at max size
    if (this.cache.size >= this.maxSize && !this.cache.has(key)) {
      this.evictLeastRecentlyUsed();
    }

    const now = Date.now();
    this.cache.set(key, { value, timestamp: now });
    this.accessTimes.set(key, now);
  }

  delete(key) {
    this.cache.delete(key);
    this.accessTimes.delete(key);
  }

  private evictLeastRecentlyUsed() {
    let oldestKey = null;
    let oldestTime = Date.now();

    for (const [key, time] of this.accessTimes) {
      if (time < oldestTime) {
        oldestTime = time;
        oldestKey = key;
      }
    }

    if (oldestKey) {
      this.delete(oldestKey);
    }
  }
}
```

## Testing Requirements

### Unit Test Structure
```javascript
// tests/unit/clothing/prioritySystem/clothingPriorityManager.test.js
describe('ClothingPriorityManager', () => {
  describe('Priority Calculation', () => {
    it('should calculate consistent priorities across contexts', () => {
      // Test priority calculations for different contexts
    });

    it('should handle priority modifiers correctly', () => {
      // Test modifier application
    });

    it('should cache priority calculations for performance', () => {
      // Test caching behavior
    });
  });

  describe('Layer Ordering', () => {
    it('should return correct layer order for removal context', () => {
      // Test removal context ordering
    });

    it('should return correct layer order for equipping context', () => {
      // Test equipping context ordering (reverse)
    });

    it('should handle unknown contexts gracefully', () => {
      // Test fallback behavior
    });
  });

  describe('Priority Comparison', () => {
    it('should correctly compare items of different layers', () => {
      // Test outer vs base vs underwear comparisons
    });

    it('should handle same-layer comparisons', () => {
      // Test items in same layer
    });
  });

  describe('Backward Compatibility', () => {
    it('should produce same results as legacy COVERAGE_PRIORITY', () => {
      // Ensure no breaking changes
    });

    it('should support legacy LAYER_PRIORITY orderings', () => {
      // Test topmost mode compatibility
    });
  });
});
```

### Integration Testing
- [ ] **Service integration**: Test with CLOREMLOG-005 clothing accessibility service
- [ ] **Resolver integration**: Test with updated array iteration resolver
- [ ] **Performance testing**: Benchmark priority calculations vs legacy systems
- [ ] **Migration testing**: Ensure no behavior changes during consolidation

### Performance Benchmarks
```javascript
describe('Priority System Performance', () => {
  it('should calculate priorities within performance budget', () => {
    const priorityManager = new ClothingPriorityManager({ logger });
    
    const startTime = performance.now();
    
    // Perform 1000 priority calculations
    for (let i = 0; i < 1000; i++) {
      priorityManager.calculatePriority('base', 'removal');
    }
    
    const endTime = performance.now();
    const duration = endTime - startTime;
    
    // Should complete within 10ms
    expect(duration).toBeLessThan(10);
  });

  it('should benefit from caching on repeated calculations', () => {
    // Test cache performance improvement
  });
});
```

## Risk Assessment

### Implementation Risks
| Risk | Probability | Impact | Mitigation |
|------|-------------|---------|-------------|
| Breaking existing priority logic | Medium | High | Comprehensive backward compatibility testing |
| Performance regression | Low | Medium | Benchmark testing and optimization |
| Configuration complexity | Medium | Low | Simple, well-documented configuration |
| Cache memory usage | Low | Low | Bounded cache with LRU eviction |

### Migration Risks
| Risk | Probability | Impact | Mitigation |
|------|-------------|---------|-------------|
| Inconsistent behavior during migration | Low | Medium | Staged migration with validation |
| Priority calculation bugs | Medium | Medium | Extensive test coverage |
| Integration issues | Low | High | Thorough integration testing |

## Definition of Done
- [ ] Unified priority system replaces both legacy systems
- [ ] All priority calculations produce consistent results
- [ ] Performance is equal to or better than legacy systems
- [ ] Backward compatibility maintained during migration
- [ ] Unit tests achieve >95% coverage
- [ ] Integration tests validate system-wide behavior
- [ ] Configuration system allows easy extension
- [ ] Documentation covers migration and usage

## Dependencies and Integration

### Upstream Dependencies
- **CLOREMLOG-005**: Unified clothing accessibility service for integration
- **Legacy systems**: Existing priority constants and layer priority logic

### Downstream Impact
- **CLOREMLOG-007**: Clothing resolvers will use consolidated priority system
- **CLOREMLOG-008**: Test suites will validate consolidated behavior
- **Future development**: Foundation for extensible priority system

## Migration Strategy
1. **Create new system**: Build unified priority manager alongside legacy systems
2. **Backward compatibility**: Provide legacy interfaces during transition
3. **Gradual integration**: Update one component at a time
4. **Validation**: Ensure identical behavior during migration
5. **Cleanup**: Remove legacy systems once migration complete

## Extension Points
- **New clothing types**: Easy addition of new layers and priorities
- **Context-specific rules**: Support for different priority schemes by context
- **Dynamic priorities**: Runtime priority modification based on game state
- **Rule-based modifiers**: Complex priority modification based on item properties

## Notes
- Focus on maintaining exact compatibility during migration
- Priority system should be data-driven and configurable
- Performance is critical as this system is used frequently
- Design for future extensibility while keeping current usage simple
- Clear migration documentation is essential for successful adoption