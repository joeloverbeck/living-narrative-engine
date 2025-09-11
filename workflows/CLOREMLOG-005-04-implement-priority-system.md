# CLOREMLOG-005-04: Implement Unified Priority System

## Overview
**Parent**: CLOREMLOG-005  
**Priority**: High  
**Estimated Effort**: 2 hours  
**Dependencies**: CLOREMLOG-005-03  
**Blocks**: CLOREMLOG-005-05, CLOREMLOG-005-06

## Problem Statement
The service needs a unified priority calculation system that combines coverage priorities, layer priorities, and context-aware modifiers. This consolidates logic currently scattered across multiple files.

## Acceptance Criteria

### 1. Create Priority Calculator
- [ ] Import priority constants from `priorityConstants.js`
- [ ] Implement unified priority calculation
- [ ] Add context-aware modifiers (removal, equipping, inspection)
- [ ] Cache priority calculations for performance

### 2. Integrate Priority System
- [ ] Use priority calculator in `getAccessibleItems`
- [ ] Sort items by calculated priority
- [ ] Handle tie-breaking with stable sort

### 3. Add Priority Configuration
- [ ] Support configurable priority weights
- [ ] Allow context-specific priority overrides
- [ ] Maintain backward compatibility

## Implementation Details

### Priority Calculator Implementation
```javascript
// Add to ClothingAccessibilityService

import { 
  COVERAGE_PRIORITY, 
  LAYER_PRIORITY_WITHIN_COVERAGE,
  PRIORITY_CONFIG 
} from '../../scopeDsl/prioritySystem/priorityConstants.js';

/**
 * Calculate unified priority for an item
 * @private
 * @param {object} item - Item with slot, layer, coveragePriority
 * @param {string} context - Context (removal, equipping, inspection)
 * @returns {number} Calculated priority (lower = higher priority)
 */
#calculateItemPriority(item, context = 'removal') {
  const cacheKey = `${item.itemId}:${item.layer}:${context}`;
  
  // Check priority cache
  if (this.#priorityCache && this.#priorityCache.has(cacheKey)) {
    return this.#priorityCache.get(cacheKey);
  }
  
  // Get coverage priority from item or fallback to layer
  const coveragePriority = this.#getItemCoveragePriority(item);
  const coverageValue = COVERAGE_PRIORITY[coveragePriority] || 
                        COVERAGE_PRIORITY.direct;
  
  // Get layer priority for tie-breaking
  const layerValue = LAYER_PRIORITY_WITHIN_COVERAGE[item.layer] || 
                     LAYER_PRIORITY_WITHIN_COVERAGE.base;
  
  // Calculate composite priority
  let priority = coverageValue + (layerValue / 100); // Layer as decimal for tie-breaking
  
  // Apply context modifiers
  priority = this.#applyContextModifiers(priority, item, context);
  
  // Cache the result
  if (this.#priorityCache) {
    this.#priorityCache.set(cacheKey, priority);
  }
  
  return priority;
}

/**
 * Get coverage priority for an item
 * @private
 */
#getItemCoveragePriority(item) {
  try {
    // Try to get from coverage_mapping component
    const coverageMapping = this.#entityManager.getComponent(
      item.itemId, 
      'clothing:coverage_mapping'
    );
    
    if (coverageMapping && coverageMapping.coveragePriority) {
      return coverageMapping.coveragePriority;
    }
  } catch (error) {
    this.#logger.debug('Could not get coverage mapping', { 
      itemId: item.itemId,
      error: error.message 
    });
  }
  
  // Fallback to layer-based priority
  const layerToCoverage = {
    outer: 'outer',
    base: 'base',
    underwear: 'underwear',
    accessories: 'base'
  };
  
  return layerToCoverage[item.layer] || 'direct';
}

/**
 * Apply context-specific priority modifiers
 * @private
 */
#applyContextModifiers(basePriority, item, context) {
  // Context modifiers can adjust priority based on use case
  switch (context) {
    case 'removal':
      // For removal, outer items should be more accessible
      if (item.layer === 'outer') {
        return basePriority * 0.9; // 10% priority boost
      }
      break;
      
    case 'equipping':
      // For equipping, empty slots have highest priority
      // This is handled elsewhere, just return base
      break;
      
    case 'inspection':
      // For inspection, all items equally accessible
      // Could return a flat priority
      break;
  }
  
  return basePriority;
}

/**
 * Sort items by priority with stable tie-breaking
 * @private
 */
#sortByPriority(items, context) {
  // Calculate priorities for all items
  const itemsWithPriority = items.map((item, index) => ({
    ...item,
    priority: this.#calculateItemPriority(item, context),
    originalIndex: index // For stable sort
  }));
  
  // Sort by priority, then by original index for stability
  itemsWithPriority.sort((a, b) => {
    const priorityDiff = a.priority - b.priority;
    if (priorityDiff !== 0) return priorityDiff;
    return a.originalIndex - b.originalIndex;
  });
  
  // Remove temporary fields
  return itemsWithPriority.map(({ priority, originalIndex, ...item }) => item);
}
```

### Updated getAccessibleItems with Priority
```javascript
getAccessibleItems(entityId, options = {}) {
  const {
    mode = 'topmost',
    bodyArea = null,
    layer = null,
    context = 'removal',
    sortByPriority = true // New option
  } = options;
  
  assertNonBlankString(entityId, 'entityId', 'getAccessibleItems', this.#logger);
  
  // Check cache
  const cacheKey = this.#generateCacheKey(entityId, options);
  const cached = this.#getCachedResult(cacheKey);
  if (cached) return cached;
  
  // Get equipment state
  const equipment = this.#getEquipmentState(entityId);
  const equippedItems = this.#parseEquipmentSlots(equipment);
  
  if (equippedItems.length === 0) {
    return this.#cacheAndReturn(cacheKey, []);
  }
  
  // Filter by layer if specified
  let filteredItems = layer 
    ? equippedItems.filter(item => item.layer === layer)
    : equippedItems;
  
  // Filter by body area if specified
  if (bodyArea) {
    filteredItems = this.#filterByBodyArea(filteredItems, bodyArea);
  }
  
  // Apply coverage blocking
  const accessibleItems = this.#applyCoverageBlocking(
    filteredItems, 
    entityId, 
    equipment, 
    mode
  );
  
  // Apply mode-specific logic
  let result = this.#applyModeLogic(accessibleItems, mode);
  
  // Sort by priority if requested
  if (sortByPriority) {
    result = this.#sortByPriority(result, context);
  }
  
  return this.#cacheAndReturn(cacheKey, result.map(item => item.itemId));
}
```

### Priority Cache Management
```javascript
// Add to constructor
constructor({ logger, entityManager, entitiesGateway }) {
  // ... existing initialization ...
  
  // Initialize priority cache if caching enabled
  if (PRIORITY_CONFIG.enableCaching) {
    this.#priorityCache = new Map();
    this.#maxPriorityCacheSize = PRIORITY_CONFIG.maxCacheSize || 1000;
  } else {
    this.#priorityCache = null;
  }
}

/**
 * Clear all caches for an entity
 */
clearCache(entityId) {
  assertNonBlankString(entityId, 'entityId', 'clearCache', this.#logger);
  
  // Clear query cache
  for (const key of this.#cache.keys()) {
    if (key.startsWith(`${entityId}:`)) {
      this.#cache.delete(key);
    }
  }
  
  // Clear priority cache for entity's items
  if (this.#priorityCache) {
    const items = this.#getEquippedItems(entityId);
    for (const item of items) {
      for (const key of this.#priorityCache.keys()) {
        if (key.startsWith(`${item.itemId}:`)) {
          this.#priorityCache.delete(key);
        }
      }
    }
  }
  
  this.#logger.debug('Cleared cache for entity', { entityId });
}

/**
 * Manage priority cache size
 * @private
 */
#managePriorityCacheSize() {
  if (!this.#priorityCache || 
      this.#priorityCache.size <= this.#maxPriorityCacheSize) {
    return;
  }
  
  // Remove oldest entries (FIFO)
  const entriesToRemove = this.#priorityCache.size - this.#maxPriorityCacheSize;
  const keys = Array.from(this.#priorityCache.keys());
  
  for (let i = 0; i < entriesToRemove; i++) {
    this.#priorityCache.delete(keys[i]);
  }
}
```

## Testing Requirements

### Priority Calculation Tests
```javascript
describe('Priority System', () => {
  describe('Priority calculation', () => {
    it('should prioritize outer > base > underwear', () => {
      mockEntityManager.getComponent.mockImplementation((entityId, component) => {
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
    
    it('should apply context modifiers', () => {
      const items = [
        { itemId: 'jacket', layer: 'outer', slot: 'torso' },
        { itemId: 'shirt', layer: 'base', slot: 'torso' }
      ];
      
      // Test removal context gives outer items priority boost
      const removalResult = service.#sortByPriority(items, 'removal');
      expect(removalResult[0].itemId).toBe('jacket');
    });
    
    it('should handle tie-breaking with stable sort', () => {
      const items = [
        { itemId: 'shirt1', layer: 'base', slot: 'torso' },
        { itemId: 'shirt2', layer: 'base', slot: 'torso' }
      ];
      
      const sorted = service.#sortByPriority(items, 'removal');
      expect(sorted[0].itemId).toBe('shirt1'); // Original order preserved
      expect(sorted[1].itemId).toBe('shirt2');
    });
  });
  
  describe('Priority caching', () => {
    it('should cache priority calculations', () => {
      const spy = jest.spyOn(service, '#calculateItemPriority');
      
      const item = { itemId: 'test', layer: 'base' };
      service.#calculateItemPriority(item, 'removal');
      service.#calculateItemPriority(item, 'removal'); // Should use cache
      
      expect(spy).toHaveBeenCalledTimes(1);
    });
    
    it('should manage cache size limits', () => {
      // Test cache eviction when size exceeds limit
      for (let i = 0; i < 1100; i++) {
        const item = { itemId: `item${i}`, layer: 'base' };
        service.#calculateItemPriority(item, 'removal');
      }
      
      expect(service.#priorityCache.size).toBeLessThanOrEqual(1000);
    });
  });
});
```

## Success Metrics
- [ ] Priority calculation working correctly
- [ ] Items sorted by priority in results
- [ ] Context modifiers applied appropriately
- [ ] Priority caching improves performance
- [ ] All tests pass with >95% coverage

## Notes
- Priority formula: coverage_priority + (layer_priority / 100)
- Lower priority values = higher priority items
- Context modifiers allow fine-tuning for different use cases
- Cache management prevents memory leaks