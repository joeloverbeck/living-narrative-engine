# CLOREMLOG-005-02: Implement Equipment State Management

## Overview
**Parent**: CLOREMLOG-005  
**Priority**: High  
**Estimated Effort**: 2 hours  
**Dependencies**: CLOREMLOG-005-01  
**Blocks**: CLOREMLOG-005-03, CLOREMLOG-005-04

## Problem Statement
The service needs internal helper methods to extract and manage equipment state from entities. This includes parsing equipment components and organizing items by slot and layer.

## Acceptance Criteria

### 1. Implement Equipment State Extraction
- [ ] Add private method `#getEquipmentState(entityId)`
- [ ] Handle missing equipment component gracefully
- [ ] Return normalized equipment structure

### 2. Implement Slot and Layer Parsing
- [ ] Add private method `#parseEquipmentSlots(equipment)`
- [ ] Extract items with slot, layer, and itemId
- [ ] Handle nested slot/layer structure

### 3. Add Validation and Error Handling
- [ ] Validate equipment structure
- [ ] Log warnings for invalid data
- [ ] Return safe defaults on errors

## Implementation Details

### Equipment State Management Methods
```javascript
// Add to ClothingAccessibilityService class

/**
 * Get equipment state from entity
 * @private
 * @param {string} entityId - Entity ID
 * @returns {object} Equipment state or empty object
 */
#getEquipmentState(entityId) {
  try {
    const equipment = this.#entityManager.getComponent(entityId, 'clothing:equipment');
    if (!equipment || !equipment.equipped) {
      return {};
    }
    return equipment.equipped;
  } catch (error) {
    this.#logger.warn('Failed to get equipment state', { entityId, error: error.message });
    return {};
  }
}

/**
 * Parse equipment slots into flat array of items
 * @private
 * @param {object} equipment - Equipment state object
 * @returns {Array} Array of { itemId, slot, layer }
 */
#parseEquipmentSlots(equipment) {
  const items = [];
  
  for (const [slotName, slotData] of Object.entries(equipment)) {
    if (!slotData || typeof slotData !== 'object') {
      continue;
    }
    
    for (const [layer, itemId] of Object.entries(slotData)) {
      if (itemId && typeof itemId === 'string') {
        items.push({
          itemId,
          slot: slotName,
          layer
        });
      }
    }
  }
  
  return items;
}

/**
 * Get all equipped items for an entity
 * @private
 * @param {string} entityId - Entity ID
 * @returns {Array} Array of equipped items with metadata
 */
#getEquippedItems(entityId) {
  const equipment = this.#getEquipmentState(entityId);
  return this.#parseEquipmentSlots(equipment);
}

/**
 * Check if entity has any equipped items
 * @private
 * @param {string} entityId - Entity ID
 * @returns {boolean} True if entity has equipped items
 */
#hasEquippedItems(entityId) {
  const items = this.#getEquippedItems(entityId);
  return items.length > 0;
}
```

### Update Core Methods to Use Equipment State
```javascript
getAccessibleItems(entityId, options = {}) {
  assertNonBlankString(entityId, 'entityId', 'getAccessibleItems', this.#logger);
  
  // Check cache first
  const cacheKey = this.#generateCacheKey(entityId, options);
  if (this.#cache.has(cacheKey)) {
    const cached = this.#cache.get(cacheKey);
    if (Date.now() - cached.timestamp < 5000) { // 5 second TTL
      return cached.result;
    }
  }
  
  // Get equipped items
  const equippedItems = this.#getEquippedItems(entityId);
  if (equippedItems.length === 0) {
    return [];
  }
  
  // TODO: Apply filtering and coverage analysis (next ticket)
  const result = equippedItems.map(item => item.itemId);
  
  // Cache result
  this.#cache.set(cacheKey, {
    result,
    timestamp: Date.now()
  });
  
  return result;
}

/**
 * Generate cache key for query
 * @private
 */
#generateCacheKey(entityId, options) {
  return `${entityId}:${JSON.stringify(options)}`;
}
```

## Testing Requirements

### Update Unit Tests
```javascript
describe('Equipment State Management', () => {
  describe('getAccessibleItems with equipment', () => {
    it('should return equipped item IDs', () => {
      mockEntityManager.getComponent.mockReturnValue({
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
      
      const result = service.getAccessibleItems('test-entity');
      expect(result).toContain('clothing:shirt');
      expect(result).toContain('clothing:jacket');
      expect(result).toContain('clothing:underwear');
      expect(result).toContain('clothing:pants');
    });
    
    it('should handle missing equipment component', () => {
      mockEntityManager.getComponent.mockReturnValue(null);
      
      const result = service.getAccessibleItems('test-entity');
      expect(result).toEqual([]);
    });
    
    it('should handle malformed equipment data', () => {
      mockEntityManager.getComponent.mockReturnValue({
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
  });
  
  describe('Caching behavior', () => {
    it('should cache results for 5 seconds', () => {
      mockEntityManager.getComponent.mockReturnValue({
        equipped: { slot: { base: 'item1' } }
      });
      
      // First call
      service.getAccessibleItems('entity1');
      expect(mockEntityManager.getComponent).toHaveBeenCalledTimes(1);
      
      // Second call (should use cache)
      service.getAccessibleItems('entity1');
      expect(mockEntityManager.getComponent).toHaveBeenCalledTimes(1);
    });
    
    it('should invalidate cache after TTL', () => {
      jest.useFakeTimers();
      
      mockEntityManager.getComponent.mockReturnValue({
        equipped: { slot: { base: 'item1' } }
      });
      
      service.getAccessibleItems('entity1');
      jest.advanceTimersByTime(6000); // Past 5 second TTL
      service.getAccessibleItems('entity1');
      
      expect(mockEntityManager.getComponent).toHaveBeenCalledTimes(2);
      
      jest.useRealTimers();
    });
  });
});
```

## Success Metrics
- [ ] Equipment state extraction working correctly
- [ ] Caching implemented with TTL
- [ ] Error handling for malformed data
- [ ] Unit tests pass with >95% coverage

## Notes
- Equipment structure follows pattern: `equipped[slot][layer] = itemId`
- Cache TTL is hardcoded to 5 seconds for now
- Next ticket will add coverage analysis integration