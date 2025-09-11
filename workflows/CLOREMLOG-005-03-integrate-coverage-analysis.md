# CLOREMLOG-005-03: Integrate Coverage Analysis

## Overview
**Parent**: CLOREMLOG-005  
**Priority**: High  
**Estimated Effort**: 3 hours  
**Dependencies**: CLOREMLOG-005-01, CLOREMLOG-005-02  
**Blocks**: CLOREMLOG-005-04, CLOREMLOG-005-05

## Problem Statement
The service needs to integrate the existing coverage analyzer to determine which items block access to others based on coverage priorities and body area overlap.

## Acceptance Criteria

### 1. Integrate Coverage Analyzer Factory
- [ ] Import existing `createCoverageAnalyzer` from `src/clothing/analysis/coverageAnalyzer.js`
- [ ] Initialize analyzer in constructor when provided
- [ ] Handle analyzer initialization failures gracefully

### 2. Implement Coverage Blocking Logic
- [ ] Add coverage analysis to `getAccessibleItems` method
- [ ] Filter blocked items based on coverage rules
- [ ] Support different modes (topmost, all, layer-specific)

### 3. Implement Blocking Detection Methods
- [ ] Complete `isItemAccessible` implementation
- [ ] Complete `getBlockingItem` implementation
- [ ] Return detailed accessibility information

## Implementation Details

### Coverage Analyzer Integration
```javascript
// Update constructor
import createCoverageAnalyzer from '../../clothing/analysis/coverageAnalyzer.js';

constructor({ logger, entityManager, entitiesGateway }) {
  validateDependency(logger, 'ILogger', logger, {
    requiredMethods: ['debug', 'warn', 'error', 'info']
  });
  validateDependency(entityManager, 'IEntityManager', logger, {
    requiredMethods: ['getComponent', 'hasComponent']
  });
  
  this.#logger = logger;
  this.#entityManager = entityManager;
  this.#cache = new Map();
  
  // Initialize coverage analyzer if entitiesGateway provided
  if (entitiesGateway) {
    try {
      this.#coverageAnalyzer = createCoverageAnalyzer({ 
        entitiesGateway, 
        errorHandler: null 
      });
      this.#logger.debug('ClothingAccessibilityService: Coverage analyzer initialized');
    } catch (error) {
      this.#logger.warn('Failed to initialize coverage analyzer', { 
        error: error.message 
      });
      this.#coverageAnalyzer = null;
    }
  } else {
    this.#coverageAnalyzer = null;
  }
}
```

### Coverage-Aware Accessibility Methods
```javascript
/**
 * Apply coverage blocking analysis to items
 * @private
 * @param {Array} items - Array of equipped items
 * @param {string} entityId - Entity ID
 * @param {object} equipment - Equipment state
 * @param {string} mode - Query mode
 * @returns {Array} Filtered items based on coverage
 */
#applyCoverageBlocking(items, entityId, equipment, mode) {
  // Only apply coverage blocking for topmost mode
  const shouldApplyBlocking = mode === 'topmost' || mode === 'topmost_no_accessories';
  
  if (!shouldApplyBlocking || !this.#coverageAnalyzer) {
    return items;
  }
  
  try {
    const coverageAnalysis = this.#coverageAnalyzer.analyzeCoverageBlocking(
      equipment, 
      entityId
    );
    
    // Filter out blocked items
    return items.filter(item => 
      coverageAnalysis.isAccessible(item.itemId, item.slot, item.layer)
    );
  } catch (error) {
    this.#logger.warn('Coverage analysis failed, returning all items', {
      entityId,
      error: error.message
    });
    return items;
  }
}

/**
 * Updated getAccessibleItems with coverage analysis
 */
getAccessibleItems(entityId, options = {}) {
  const {
    mode = 'topmost',
    bodyArea = null,
    layer = null,
    context = 'removal'
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
  const result = this.#applyModeLogic(accessibleItems, mode);
  
  return this.#cacheAndReturn(cacheKey, result.map(item => item.itemId));
}

/**
 * Check if specific item is accessible
 */
isItemAccessible(entityId, itemId) {
  assertNonBlankString(entityId, 'entityId', 'isItemAccessible', this.#logger);
  assertNonBlankString(itemId, 'itemId', 'isItemAccessible', this.#logger);
  
  if (!this.#coverageAnalyzer) {
    return { 
      accessible: true, 
      reason: 'No coverage analyzer available' 
    };
  }
  
  const equipment = this.#getEquipmentState(entityId);
  
  try {
    const coverageAnalysis = this.#coverageAnalyzer.analyzeCoverageBlocking(
      equipment, 
      entityId
    );
    
    const accessible = coverageAnalysis.isAccessible(itemId);
    const blockingItems = coverageAnalysis.getBlockingItems(itemId);
    
    return {
      accessible,
      reason: accessible 
        ? 'Item is accessible' 
        : `Blocked by: ${blockingItems.join(', ')}`,
      blockingItems: blockingItems || []
    };
  } catch (error) {
    this.#logger.warn('Failed to check accessibility', { 
      entityId, 
      itemId, 
      error: error.message 
    });
    return { 
      accessible: true, 
      reason: 'Coverage check failed, assuming accessible' 
    };
  }
}

/**
 * Get item blocking access to target
 */
getBlockingItem(entityId, itemId) {
  assertNonBlankString(entityId, 'entityId', 'getBlockingItem', this.#logger);
  assertNonBlankString(itemId, 'itemId', 'getBlockingItem', this.#logger);
  
  const result = this.isItemAccessible(entityId, itemId);
  
  if (result.accessible) {
    return null;
  }
  
  // Return first blocking item
  return result.blockingItems && result.blockingItems.length > 0 
    ? result.blockingItems[0] 
    : null;
}
```

### Mode-Specific Logic
```javascript
/**
 * Apply mode-specific filtering logic
 * @private
 */
#applyModeLogic(items, mode) {
  const LAYER_PRIORITY = {
    topmost: ['outer', 'base', 'underwear'],
    all: ['outer', 'base', 'underwear', 'accessories'],
    outer: ['outer'],
    base: ['base'],
    underwear: ['underwear'],
  };
  
  const layers = LAYER_PRIORITY[mode] || LAYER_PRIORITY.topmost;
  
  if (mode === 'topmost') {
    // For topmost, only return the highest priority item per slot
    const slotMap = new Map();
    
    for (const item of items) {
      const layerIndex = layers.indexOf(item.layer);
      if (layerIndex === -1) continue;
      
      const existing = slotMap.get(item.slot);
      if (!existing || layers.indexOf(existing.layer) > layerIndex) {
        slotMap.set(item.slot, item);
      }
    }
    
    return Array.from(slotMap.values());
  }
  
  // For other modes, filter by allowed layers
  return items.filter(item => layers.includes(item.layer));
}
```

## Testing Requirements

### Integration Tests
```javascript
describe('Coverage Blocking Integration', () => {
  it('should block underwear when covered by base layer (Layla Agirre scenario)', () => {
    // Setup Layla Agirre equipment state
    mockEntityManager.getComponent.mockImplementation((entityId, component) => {
      if (component === 'clothing:equipment') {
        return {
          equipped: {
            torso_lower: {
              base: 'asudem:trousers',
              underwear: 'asudem:boxer_brief'
            }
          }
        };
      }
      if (component === 'clothing:coverage_mapping') {
        if (entityId === 'asudem:trousers') {
          return { covers: ['torso_lower'], coveragePriority: 'base' };
        }
        if (entityId === 'asudem:boxer_brief') {
          return { covers: ['torso_lower'], coveragePriority: 'underwear' };
        }
      }
      return null;
    });
    
    const result = service.getAccessibleItems('layla_agirre', { mode: 'topmost' });
    expect(result).toEqual(['asudem:trousers']);
    expect(result).not.toContain('asudem:boxer_brief');
  });
  
  it('should check item accessibility correctly', () => {
    // Setup blocking scenario
    const result = service.isItemAccessible('layla_agirre', 'asudem:boxer_brief');
    expect(result.accessible).toBe(false);
    expect(result.reason).toContain('Blocked by');
    expect(result.blockingItems).toContain('asudem:trousers');
  });
  
  it('should identify blocking item', () => {
    const blocker = service.getBlockingItem('layla_agirre', 'asudem:boxer_brief');
    expect(blocker).toBe('asudem:trousers');
  });
});
```

## Success Metrics
- [ ] Coverage analyzer integrated successfully
- [ ] Layla Agirre scenario passes (boxer brief blocked by trousers)
- [ ] All query modes working correctly
- [ ] Accessibility checking methods complete
- [ ] Unit and integration tests pass

## Notes
- Coverage blocking only applies to 'topmost' mode
- Other modes (all, base, underwear) don't apply blocking
- Fallback to permissive behavior on analyzer failures
- Priority: outer > base > underwear (lower value = higher priority)