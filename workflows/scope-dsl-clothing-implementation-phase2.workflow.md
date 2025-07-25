# Scope DSL Clothing Target Resolution - Phase 2: Extended Operations

**Phase**: 2 (Extended Operations)  
**Timeline**: Week 2  
**Prerequisites**: Phase 1 Core Infrastructure complete  
**Focus**: Layer-specific operations, array handling, performance optimization

## Phase 2 Overview

Phase 2 extends the core clothing resolution functionality with advanced features including layer-specific operations, optimized array handling, performance caching, and comprehensive filter integration. This phase ensures the clothing system can handle complex queries efficiently and integrates seamlessly with existing scope DSL features.

### Key Deliverables

- Enhanced layer-specific clothing operations
- Optimized array iteration and filtering
- Performance caching system
- Advanced error handling and recovery
- Extended test coverage for complex scenarios

### Related Files

- **Phase 1**: [scope-dsl-clothing-implementation-main.workflow.md](./scope-dsl-clothing-implementation-main.workflow.md)
- **Phase 3**: [scope-dsl-clothing-implementation-phase3.workflow.md](./scope-dsl-clothing-implementation-phase3.workflow.md)
- **Phase 4**: [scope-dsl-clothing-implementation-phase4.workflow.md](./scope-dsl-clothing-implementation-phase4.workflow.md)

---

# Phase 2 Tasks

## Task 2.1: Enhance Layer-Specific Operations

**Files**: Extend existing resolver files  
**Estimated Time**: 4 hours  
**Dependencies**: Phase 1 complete

### 2.1.1: Add Advanced Layer Filtering (2 hours)

**File**: `src/scopeDsl/nodes/clothingStepResolver.js` (enhancements)

#### Add Advanced Layer Constants

```javascript
// Add to existing constants section
const ADVANCED_CLOTHING_FIELDS = {
  // Existing fields
  ...CLOTHING_FIELDS,

  // New layer combination fields
  visible_clothing: 'visible', // outer + accessories
  removable_clothing: 'removable', // outer + base (not underwear)
  formal_clothing: 'formal', // tagged formal items
  casual_clothing: 'casual', // tagged casual items
  dirty_clothing: 'dirty', // items with dirty condition
  clean_clothing: 'clean', // items without dirty condition
};

const LAYER_COMBINATIONS = {
  visible: ['outer', 'accessories'],
  removable: ['outer', 'base'],
  formal: ['outer', 'base', 'underwear', 'accessories'],
  casual: ['outer', 'base', 'underwear', 'accessories'],
  dirty: ['outer', 'base', 'underwear', 'accessories'],
  clean: ['outer', 'base', 'underwear', 'accessories'],
};

const CONDITION_FILTERS = {
  formal: (itemId, entitiesGateway) => {
    const wearable = entitiesGateway.getComponentData(
      itemId,
      'clothing:wearable'
    );
    return wearable?.tags?.includes('formal') || false;
  },
  casual: (itemId, entitiesGateway) => {
    const wearable = entitiesGateway.getComponentData(
      itemId,
      'clothing:wearable'
    );
    return !wearable?.tags?.includes('formal') || false;
  },
  dirty: (itemId, entitiesGateway) => {
    const condition = entitiesGateway.getComponentData(
      itemId,
      'clothing:condition'
    );
    return condition?.dirty === true;
  },
  clean: (itemId, entitiesGateway) => {
    const condition = entitiesGateway.getComponentData(
      itemId,
      'clothing:condition'
    );
    return !condition?.dirty;
  },
};
```

#### Update canResolve Method

```javascript
function canResolve(node) {
  return (
    node.type === 'Step' &&
    node.field &&
    ADVANCED_CLOTHING_FIELDS.hasOwnProperty(node.field)
  );
}
```

#### Enhance getAllClothingItems Method

```javascript
function getAllClothingItems(equipped, mode, trace, entitiesGateway) {
  const result = [];

  // Determine layers to check based on mode
  let layers;
  if (LAYER_COMBINATIONS[mode]) {
    layers = LAYER_COMBINATIONS[mode];
  } else {
    layers = LAYER_PRIORITY[mode] || LAYER_PRIORITY.topmost;
  }

  // Collect items from equipment slots
  for (const [slotName, slotData] of Object.entries(equipped)) {
    for (const layer of layers) {
      if (slotData[layer]) {
        const itemId = slotData[layer];

        // Apply condition filter if needed
        if (CONDITION_FILTERS[mode]) {
          if (CONDITION_FILTERS[mode](itemId, entitiesGateway)) {
            result.push(itemId);
          }
        } else {
          result.push(itemId);
          if (mode === 'topmost') {
            break; // Only take topmost for topmost mode
          }
        }
      }
    }
  }

  if (trace) {
    trace.addLog(
      'info',
      `ClothingStepResolver: Found ${result.length} clothing items in mode ${mode}`,
      'ClothingStepResolver',
      { mode, itemCount: result.length, items: result }
    );
  }

  return result;
}
```

### 2.1.2: Add Layer Priority Customization (1 hour)

#### Add Configurable Layer Priority

```javascript
// Add to clothingStepResolver.js
const CUSTOM_LAYER_PRIORITIES = {
  weather_appropriate: (equipped, weatherCondition) => {
    // Custom logic for weather-based priority
    if (weatherCondition === 'cold') {
      return ['outer', 'base', 'underwear'];
    } else if (weatherCondition === 'hot') {
      return ['base', 'underwear'];
    }
    return ['outer', 'base', 'underwear'];
  },

  activity_appropriate: (equipped, activity) => {
    // Custom logic for activity-based priority
    if (activity === 'formal') {
      return ['outer', 'base'];
    } else if (activity === 'sleep') {
      return ['underwear', 'base'];
    }
    return ['outer', 'base', 'underwear'];
  },
};

function getLayerPriority(mode, context = {}) {
  if (CUSTOM_LAYER_PRIORITIES[mode]) {
    return CUSTOM_LAYER_PRIORITIES[mode](context.equipped, context.condition);
  }
  return LAYER_PRIORITY[mode] || LAYER_PRIORITY.topmost;
}
```

### 2.1.3: Add Validation and Error Handling (1 hour)

#### Enhanced Input Validation

```javascript
// Add to clothingStepResolver.js
function validateEquipmentData(equipped, trace) {
  if (!equipped || typeof equipped !== 'object') {
    if (trace) {
      trace.addLog(
        'warning',
        'ClothingStepResolver: Invalid equipment data structure',
        'ClothingStepResolver',
        { equipped }
      );
    }
    return false;
  }

  // Validate slot structure
  for (const [slotName, slotData] of Object.entries(equipped)) {
    if (!CLOTHING_SLOTS.includes(slotName)) {
      if (trace) {
        trace.addLog(
          'warning',
          `ClothingStepResolver: Unknown clothing slot: ${slotName}`,
          'ClothingStepResolver',
          { slotName }
        );
      }
      continue;
    }

    if (slotData && typeof slotData !== 'object') {
      if (trace) {
        trace.addLog(
          'warning',
          `ClothingStepResolver: Invalid slot data for ${slotName}`,
          'ClothingStepResolver',
          { slotName, slotData }
        );
      }
      return false;
    }
  }

  return true;
}

// Update resolveClothingField to use validation
function resolveClothingField(entityId, field, isArray, trace) {
  const equipment = entitiesGateway.getComponentData(
    entityId,
    'clothing:equipment'
  );

  if (!equipment?.equipped) {
    if (trace) {
      trace.addLog(
        'info',
        `ClothingStepResolver: No equipment component found for entity ${entityId}`,
        'ClothingStepResolver',
        { entityId }
      );
    }
    return [];
  }

  // Validate equipment data structure
  if (!validateEquipmentData(equipment.equipped, trace)) {
    return [];
  }

  const mode = ADVANCED_CLOTHING_FIELDS[field];

  if (isArray) {
    return getAllClothingItems(
      equipment.equipped,
      mode,
      trace,
      entitiesGateway
    );
  } else {
    return createSlotAccessObject(equipment.equipped, mode);
  }
}
```

---

## Task 2.2: Optimize Array Operations

**Files**: New performance utilities and resolver enhancements  
**Estimated Time**: 3 hours  
**Dependencies**: Task 2.1 complete

### 2.2.1: Create Clothing Cache Manager (1.5 hours)

**File**: `src/scopeDsl/core/clothingCacheManager.js`

```javascript
/**
 * @file Clothing cache manager for scope DSL performance optimization
 * @description Caches equipment data and resolved clothing items to improve performance
 */

import { validateDependency } from '../../utils/validationCore.js';

/**
 * Cache manager for clothing-related data in scope DSL resolution
 */
export default class ClothingCacheManager {
  constructor({ logger } = {}) {
    this.logger = logger;
    this.equipmentCache = new Map();
    this.resolutionCache = new Map();
    this.cacheHits = 0;
    this.cacheMisses = 0;
    this.maxCacheSize = 1000;
    this.cacheTimeout = 30000; // 30 seconds
  }

  /**
   * Gets cached equipment data for an entity
   * @param {string} entityId - Entity ID
   * @returns {object|null} Cached equipment data or null
   */
  getCachedEquipment(entityId) {
    const cacheKey = `equipment:${entityId}`;
    const cached = this.equipmentCache.get(cacheKey);

    if (cached && Date.now() - cached.timestamp < this.cacheTimeout) {
      this.cacheHits++;
      return cached.data;
    }

    this.cacheMisses++;
    return null;
  }

  /**
   * Caches equipment data for an entity
   * @param {string} entityId - Entity ID
   * @param {object} equipmentData - Equipment data to cache
   */
  cacheEquipment(entityId, equipmentData) {
    const cacheKey = `equipment:${entityId}`;

    // Prevent cache overflow
    if (this.equipmentCache.size >= this.maxCacheSize) {
      this.evictOldestEntry(this.equipmentCache);
    }

    this.equipmentCache.set(cacheKey, {
      data: equipmentData,
      timestamp: Date.now(),
    });
  }

  /**
   * Gets cached resolution result
   * @param {string} entityId - Entity ID
   * @param {string} field - Clothing field
   * @param {boolean} isArray - Whether array resolution
   * @returns {Array|null} Cached result or null
   */
  getCachedResolution(entityId, field, isArray) {
    const cacheKey = `resolution:${entityId}:${field}:${isArray}`;
    const cached = this.resolutionCache.get(cacheKey);

    if (cached && Date.now() - cached.timestamp < this.cacheTimeout) {
      this.cacheHits++;
      return cached.data;
    }

    this.cacheMisses++;
    return null;
  }

  /**
   * Caches resolution result
   * @param {string} entityId - Entity ID
   * @param {string} field - Clothing field
   * @param {boolean} isArray - Whether array resolution
   * @param {Array} result - Resolution result to cache
   */
  cacheResolution(entityId, field, isArray, result) {
    const cacheKey = `resolution:${entityId}:${field}:${isArray}`;

    // Prevent cache overflow
    if (this.resolutionCache.size >= this.maxCacheSize) {
      this.evictOldestEntry(this.resolutionCache);
    }

    this.resolutionCache.set(cacheKey, {
      data: [...result], // Clone array to prevent mutation
      timestamp: Date.now(),
    });
  }

  /**
   * Evicts the oldest cache entry
   * @param {Map} cache - Cache to evict from
   * @private
   */
  evictOldestEntry(cache) {
    const firstKey = cache.keys().next().value;
    if (firstKey) {
      cache.delete(firstKey);
    }
  }

  /**
   * Clears all caches
   */
  clearCache() {
    this.equipmentCache.clear();
    this.resolutionCache.clear();
    this.cacheHits = 0;
    this.cacheMisses = 0;
  }

  /**
   * Gets cache statistics
   * @returns {object} Cache performance statistics
   */
  getStats() {
    const totalRequests = this.cacheHits + this.cacheMisses;
    const hitRate =
      totalRequests > 0 ? (this.cacheHits / totalRequests) * 100 : 0;

    return {
      equipmentCacheSize: this.equipmentCache.size,
      resolutionCacheSize: this.resolutionCache.size,
      cacheHits: this.cacheHits,
      cacheMisses: this.cacheMisses,
      hitRate: Math.round(hitRate * 100) / 100,
    };
  }

  /**
   * Invalidates cache for specific entity
   * @param {string} entityId - Entity ID to invalidate
   */
  invalidateEntity(entityId) {
    // Remove equipment cache
    this.equipmentCache.delete(`equipment:${entityId}`);

    // Remove resolution caches for this entity
    for (const key of this.resolutionCache.keys()) {
      if (key.includes(`:${entityId}:`)) {
        this.resolutionCache.delete(key);
      }
    }
  }
}
```

### 2.2.2: Integrate Cache into Resolvers (1 hour)

**File**: `src/scopeDsl/nodes/clothingStepResolver.js` (enhancements)

```javascript
// Add cache manager import
import ClothingCacheManager from '../core/clothingCacheManager.js';

// Update createClothingStepResolver function
export default function createClothingStepResolver({
  entitiesGateway,
  logger,
}) {
  validateDependency(entitiesGateway, 'entitiesGateway');

  // Initialize cache manager
  const cacheManager = new ClothingCacheManager({ logger });

  // Enhanced resolveClothingField with caching
  function resolveClothingField(entityId, field, isArray, trace) {
    // Check cache first
    const cachedResult = cacheManager.getCachedResolution(
      entityId,
      field,
      isArray
    );
    if (cachedResult) {
      if (trace) {
        trace.addLog(
          'info',
          `ClothingStepResolver: Using cached result for ${entityId}.${field}`,
          'ClothingStepResolver',
          { entityId, field, isArray, cacheHit: true }
        );
      }
      return cachedResult;
    }

    // Check equipment cache
    let equipment = cacheManager.getCachedEquipment(entityId);
    if (!equipment) {
      equipment = entitiesGateway.getComponentData(
        entityId,
        'clothing:equipment'
      );
      if (equipment) {
        cacheManager.cacheEquipment(entityId, equipment);
      }
    }

    if (!equipment?.equipped) {
      if (trace) {
        trace.addLog(
          'info',
          `ClothingStepResolver: No equipment component found for entity ${entityId}`,
          'ClothingStepResolver',
          { entityId }
        );
      }
      return [];
    }

    if (!validateEquipmentData(equipment.equipped, trace)) {
      return [];
    }

    const mode = ADVANCED_CLOTHING_FIELDS[field];
    let result;

    if (isArray) {
      result = getAllClothingItems(
        equipment.equipped,
        mode,
        trace,
        entitiesGateway
      );
    } else {
      result = createSlotAccessObject(equipment.equipped, mode);
    }

    // Cache the result
    cacheManager.cacheResolution(entityId, field, isArray, result);

    if (trace) {
      trace.addLog(
        'info',
        `ClothingStepResolver: Cached result for ${entityId}.${field}`,
        'ClothingStepResolver',
        { entityId, field, isArray, resultSize: result.length }
      );
    }

    return result;
  }

  // Add cache management methods to returned resolver
  const resolver = {
    canResolve,
    resolve,

    // Cache management methods
    clearCache: () => cacheManager.clearCache(),
    getCacheStats: () => cacheManager.getStats(),
    invalidateEntity: (entityId) => cacheManager.invalidateEntity(entityId),
  };

  return resolver;
}
```

### 2.2.3: Optimize Array Iteration Performance (30 minutes)

**File**: `src/scopeDsl/nodes/clothingStepResolver.js` (enhancements)

```javascript
// Enhanced getAllClothingItems with performance optimizations
function getAllClothingItems(equipped, mode, trace, entitiesGateway) {
  const result = [];

  // Pre-determine layers to avoid repeated lookups
  let layers;
  if (LAYER_COMBINATIONS[mode]) {
    layers = LAYER_COMBINATIONS[mode];
  } else {
    layers = LAYER_PRIORITY[mode] || LAYER_PRIORITY.topmost;
  }

  // Use for...of for better performance than Object.entries
  const slotNames = Object.keys(equipped);
  for (let i = 0; i < slotNames.length; i++) {
    const slotName = slotNames[i];
    const slotData = equipped[slotName];

    if (!slotData) continue;

    // Use for loop instead of for...of for better performance
    for (let j = 0; j < layers.length; j++) {
      const layer = layers[j];
      const itemId = slotData[layer];

      if (itemId) {
        // Apply condition filter if needed
        if (CONDITION_FILTERS[mode]) {
          if (CONDITION_FILTERS[mode](itemId, entitiesGateway)) {
            result.push(itemId);
          }
        } else {
          result.push(itemId);
          if (mode === 'topmost') {
            break; // Only take topmost for topmost mode
          }
        }
      }
    }
  }

  if (trace) {
    trace.addLog(
      'info',
      `ClothingStepResolver: Found ${result.length} clothing items in mode ${mode}`,
      'ClothingStepResolver',
      { mode, itemCount: result.length }
    );
  }

  return result;
}
```

---

## Task 2.3: Advanced Filter Integration

**Files**: Filter resolver enhancements  
**Estimated Time**: 3 hours  
**Dependencies**: Task 2.2 complete

### 2.3.1: Add Clothing-Specific JSON Logic Operators (2 hours)

**File**: `src/logic/jsonLogicCustomOperators.js` (additions)

```javascript
// Add clothing-specific operators to existing custom operators

/**
 * Checks if an item is in a specific clothing layer
 * @param {Array} args - [itemId, layer]
 * @returns {boolean}
 */
function isInClothingLayer(args, data) {
  const [itemId, layer] = args;

  if (!itemId || !layer) return false;

  // Access the entitiesGateway from data context
  const entitiesGateway = data?.__entitiesGateway;
  if (!entitiesGateway) return false;

  const wearable = entitiesGateway.getComponentData(
    itemId,
    'clothing:wearable'
  );
  return wearable?.layer === layer;
}

/**
 * Checks if an item is equipped in a specific slot
 * @param {Array} args - [actorId, itemId, slot]
 * @returns {boolean}
 */
function isEquippedInSlot(args, data) {
  const [actorId, itemId, slot] = args;

  if (!actorId || !itemId || !slot) return false;

  const entitiesGateway = data?.__entitiesGateway;
  if (!entitiesGateway) return false;

  const equipment = entitiesGateway.getComponentData(
    actorId,
    'clothing:equipment'
  );
  if (!equipment?.equipped?.[slot]) return false;

  const slotData = equipment.equipped[slot];
  return Object.values(slotData).includes(itemId);
}

/**
 * Checks if clothing item has specific tags
 * @param {Array} args - [itemId, tags]
 * @returns {boolean}
 */
function hasClothingTags(args, data) {
  const [itemId, tags] = args;

  if (!itemId || !tags) return false;

  const entitiesGateway = data?.__entitiesGateway;
  if (!entitiesGateway) return false;

  const wearable = entitiesGateway.getComponentData(
    itemId,
    'clothing:wearable'
  );
  if (!wearable?.tags) return false;

  const tagsArray = Array.isArray(tags) ? tags : [tags];
  return tagsArray.some((tag) => wearable.tags.includes(tag));
}

/**
 * Checks if clothing item is dirty
 * @param {Array} args - [itemId]
 * @returns {boolean}
 */
function isClothingDirty(args, data) {
  const [itemId] = args;

  if (!itemId) return false;

  const entitiesGateway = data?.__entitiesGateway;
  if (!entitiesGateway) return false;

  const condition = entitiesGateway.getComponentData(
    itemId,
    'clothing:condition'
  );
  return condition?.dirty === true;
}

// Export additions to existing operators
export const clothingOperators = {
  isInClothingLayer,
  isEquippedInSlot,
  hasClothingTags,
  isClothingDirty,
};

// Add to existing operators object
// (This would be integrated into the existing file)
```

### 2.3.2: Enhance Filter Resolver for Clothing Context (1 hour)

**File**: `src/scopeDsl/nodes/filterResolver.js` (enhancements)

```javascript
// Add clothing context to existing filter resolver

// Update the resolve method to include entitiesGateway in logic context
function resolve(node, ctx) {
  const { logic, parent } = node;
  const parentResults = ctx.dispatcher.resolve(parent, ctx);
  const resultSet = new Set();

  if (ctx.trace) {
    ctx.trace.addLog(
      'info',
      `FilterResolver: Filtering ${parentResults.size} items`,
      'FilterResolver',
      { parentSize: parentResults.size }
    );
  }

  for (const item of parentResults) {
    // Enhanced context for clothing operations
    const logicContext = {
      entity:
        typeof item === 'string'
          ? getEntityForLogicContext(item, entitiesGateway)
          : item,
      item,
      __entitiesGateway: entitiesGateway, // Add gateway for clothing operators
      __locationProvider: locationProvider,
    };

    try {
      const passes = logicEval.evaluate(logic, logicContext);
      if (passes) {
        resultSet.add(item);
      }
    } catch (error) {
      if (ctx.trace) {
        ctx.trace.addLog(
          'error',
          `FilterResolver: Logic evaluation failed for item ${item}`,
          'FilterResolver',
          { item, error: error.message, logic }
        );
      }
      // Continue processing other items
    }
  }

  if (ctx.trace) {
    ctx.trace.addLog(
      'info',
      `FilterResolver: Filter complete, ${resultSet.size} items passed`,
      'FilterResolver',
      { resultSize: resultSet.size }
    );
  }

  return resultSet;
}
```

---

## Task 2.4: Enhanced Error Handling and Recovery

**Files**: Error handling enhancements across resolvers  
**Estimated Time**: 2 hours  
**Dependencies**: All previous tasks complete

### 2.4.1: Add Comprehensive Error Recovery (1 hour)

**File**: `src/scopeDsl/errors/clothingResolutionError.js`

```javascript
/**
 * @file Clothing-specific resolution errors
 * @description Custom errors for clothing scope DSL operations
 */

/**
 * Error thrown when clothing equipment data is malformed
 */
export class ClothingEquipmentError extends Error {
  constructor(entityId, details) {
    super(`Invalid clothing equipment data for entity ${entityId}`);
    this.name = 'ClothingEquipmentError';
    this.entityId = entityId;
    this.details = details;
  }
}

/**
 * Error thrown when clothing slot is invalid
 */
export class InvalidClothingSlotError extends Error {
  constructor(slotName, validSlots) {
    super(
      `Invalid clothing slot: ${slotName}. Valid slots: ${validSlots.join(', ')}`
    );
    this.name = 'InvalidClothingSlotError';
    this.slotName = slotName;
    this.validSlots = validSlots;
  }
}

/**
 * Error thrown when clothing layer is invalid
 */
export class InvalidClothingLayerError extends Error {
  constructor(layer, validLayers) {
    super(
      `Invalid clothing layer: ${layer}. Valid layers: ${validLayers.join(', ')}`
    );
    this.name = 'InvalidClothingLayerError';
    this.layer = layer;
    this.validLayers = validLayers;
  }
}
```

### 2.4.2: Add Error Recovery to Resolvers (1 hour)

**File**: `src/scopeDsl/nodes/clothingStepResolver.js` (enhancements)

```javascript
import {
  ClothingEquipmentError,
  InvalidClothingSlotError,
  InvalidClothingLayerError,
} from '../errors/clothingResolutionError.js';

// Enhanced error handling in resolveClothingField
function resolveClothingField(entityId, field, isArray, trace) {
  try {
    // Existing cache and equipment retrieval logic...

    if (!equipment?.equipped) {
      if (trace) {
        trace.addLog(
          'info',
          `ClothingStepResolver: No equipment component found for entity ${entityId}`,
          'ClothingStepResolver',
          { entityId }
        );
      }
      return [];
    }

    // Enhanced validation with error recovery
    if (!validateEquipmentData(equipment.equipped, trace)) {
      if (trace) {
        trace.addLog(
          'warning',
          `ClothingStepResolver: Equipment validation failed for ${entityId}, attempting recovery`,
          'ClothingStepResolver',
          { entityId }
        );
      }

      // Attempt to recover valid slot data
      const recoveredEquipment = recoverEquipmentData(
        equipment.equipped,
        trace
      );
      if (Object.keys(recoveredEquipment).length === 0) {
        return [];
      }
      equipment.equipped = recoveredEquipment;
    }

    const mode = ADVANCED_CLOTHING_FIELDS[field];
    if (!mode) {
      throw new Error(`Unknown clothing field: ${field}`);
    }

    let result;
    if (isArray) {
      result = getAllClothingItems(
        equipment.equipped,
        mode,
        trace,
        entitiesGateway
      );
    } else {
      result = createSlotAccessObject(equipment.equipped, mode);
    }

    // Cache successful results
    cacheManager.cacheResolution(entityId, field, isArray, result);
    return result;
  } catch (error) {
    if (trace) {
      trace.addLog(
        'error',
        `ClothingStepResolver: Resolution failed for ${entityId}.${field}`,
        'ClothingStepResolver',
        { entityId, field, error: error.message }
      );
    }

    // Return empty result on error to prevent cascading failures
    return [];
  }
}

// Equipment data recovery function
function recoverEquipmentData(equipped, trace) {
  const recovered = {};

  for (const [slotName, slotData] of Object.entries(equipped)) {
    // Only keep valid slots
    if (
      CLOTHING_SLOTS.includes(slotName) &&
      slotData &&
      typeof slotData === 'object'
    ) {
      recovered[slotName] = slotData;
    } else if (trace) {
      trace.addLog(
        'warning',
        `ClothingStepResolver: Skipping invalid slot data: ${slotName}`,
        'ClothingStepResolver',
        { slotName, slotData }
      );
    }
  }

  return recovered;
}
```

---

## Task 2.5: Comprehensive Testing for Extended Operations

**Files**: Multiple test files  
**Estimated Time**: 4 hours  
**Dependencies**: All Phase 2 tasks complete

### 2.5.1: Test Advanced Layer Operations (2 hours)

**File**: `tests/unit/scopeDsl/nodes/clothingStepResolver.advanced.test.js`

```javascript
import { describe, it, expect, beforeEach } from '@jest/globals';
import createClothingStepResolver from '../../../../src/scopeDsl/nodes/clothingStepResolver.js';

describe('ClothingStepResolver - Advanced Features', () => {
  let resolver;
  let mockEntitiesGateway;
  let mockContext;

  beforeEach(() => {
    mockEntitiesGateway = {
      getComponentData: jest.fn(),
    };

    resolver = createClothingStepResolver({
      entitiesGateway: mockEntitiesGateway,
    });

    mockContext = {
      dispatcher: {
        resolve: jest.fn().mockReturnValue(new Set(['actor_1'])),
      },
      trace: {
        addLog: jest.fn(),
      },
    };
  });

  describe('visible_clothing operations', () => {
    beforeEach(() => {
      mockEntitiesGateway.getComponentData.mockImplementation(
        (entityId, componentId) => {
          if (componentId === 'clothing:equipment') {
            return {
              equipped: {
                torso_upper: {
                  outer: 'visible_jacket',
                  base: 'hidden_shirt',
                },
                accessories: {
                  accessories: 'visible_watch',
                },
              },
            };
          }
          return null;
        }
      );
    });

    it('should return only visible clothing items', () => {
      const node = {
        type: 'Step',
        field: 'visible_clothing',
        isArray: true,
        parent: { type: 'Source' },
      };

      const result = resolver.resolve(node, mockContext);

      expect(result).toEqual(new Set(['visible_jacket', 'visible_watch']));
      expect(result).not.toContain('hidden_shirt');
    });
  });

  describe('condition-based filtering', () => {
    beforeEach(() => {
      mockEntitiesGateway.getComponentData.mockImplementation(
        (entityId, componentId) => {
          if (componentId === 'clothing:equipment') {
            return {
              equipped: {
                torso_upper: {
                  outer: 'dirty_jacket',
                  base: 'clean_shirt',
                },
              },
            };
          } else if (componentId === 'clothing:condition') {
            if (entityId === 'dirty_jacket') {
              return { dirty: true };
            } else if (entityId === 'clean_shirt') {
              return { dirty: false };
            }
          }
          return null;
        }
      );
    });

    it('should filter dirty clothing correctly', () => {
      const node = {
        type: 'Step',
        field: 'dirty_clothing',
        isArray: true,
        parent: { type: 'Source' },
      };

      const result = resolver.resolve(node, mockContext);

      expect(result).toEqual(new Set(['dirty_jacket']));
      expect(result).not.toContain('clean_shirt');
    });

    it('should filter clean clothing correctly', () => {
      const node = {
        type: 'Step',
        field: 'clean_clothing',
        isArray: true,
        parent: { type: 'Source' },
      };

      const result = resolver.resolve(node, mockContext);

      expect(result).toEqual(new Set(['clean_shirt']));
      expect(result).not.toContain('dirty_jacket');
    });
  });

  describe('formal/casual filtering', () => {
    beforeEach(() => {
      mockEntitiesGateway.getComponentData.mockImplementation(
        (entityId, componentId) => {
          if (componentId === 'clothing:equipment') {
            return {
              equipped: {
                torso_upper: {
                  outer: 'business_suit',
                  base: 'casual_tshirt',
                },
              },
            };
          } else if (componentId === 'clothing:wearable') {
            if (entityId === 'business_suit') {
              return { tags: ['formal', 'business'] };
            } else if (entityId === 'casual_tshirt') {
              return { tags: ['casual', 'everyday'] };
            }
          }
          return null;
        }
      );
    });

    it('should filter formal clothing correctly', () => {
      const node = {
        type: 'Step',
        field: 'formal_clothing',
        isArray: true,
        parent: { type: 'Source' },
      };

      const result = resolver.resolve(node, mockContext);

      expect(result).toEqual(new Set(['business_suit']));
      expect(result).not.toContain('casual_tshirt');
    });
  });

  describe('error recovery', () => {
    it('should recover from invalid slot data', () => {
      mockEntitiesGateway.getComponentData.mockReturnValue({
        equipped: {
          torso_upper: {
            outer: 'valid_jacket',
          },
          invalid_slot: 'invalid_data', // This should be filtered out
          legs: {
            base: 'valid_pants',
          },
        },
      });

      const node = {
        type: 'Step',
        field: 'topmost_clothing',
        isArray: true,
        parent: { type: 'Source' },
      };

      const result = resolver.resolve(node, mockContext);

      // Should return valid items despite invalid slot
      expect(result).toEqual(new Set(['valid_jacket', 'valid_pants']));

      // Should log warning about invalid slot
      expect(mockContext.trace.addLog).toHaveBeenCalledWith(
        'warning',
        expect.stringContaining('invalid slot data'),
        'ClothingStepResolver',
        expect.any(Object)
      );
    });

    it('should handle completely malformed equipment data', () => {
      mockEntitiesGateway.getComponentData.mockReturnValue({
        equipped: 'invalid_string_data',
      });

      const node = {
        type: 'Step',
        field: 'topmost_clothing',
        isArray: true,
        parent: { type: 'Source' },
      };

      const result = resolver.resolve(node, mockContext);

      expect(result).toEqual(new Set());
    });
  });
});
```

### 2.5.2: Test Cache Performance (1 hour)

**File**: `tests/unit/scopeDsl/core/clothingCacheManager.test.js`

```javascript
describe('ClothingCacheManager', () => {
  let cacheManager;

  beforeEach(() => {
    cacheManager = new ClothingCacheManager();
  });

  describe('equipment caching', () => {
    it('should cache and retrieve equipment data', () => {
      const entityId = 'actor_1';
      const equipmentData = { equipped: { torso_upper: { outer: 'jacket' } } };

      // Cache the data
      cacheManager.cacheEquipment(entityId, equipmentData);

      // Retrieve cached data
      const cached = cacheManager.getCachedEquipment(entityId);

      expect(cached).toEqual(equipmentData);
    });

    it('should return null for non-cached entities', () => {
      const cached = cacheManager.getCachedEquipment('non_existent');
      expect(cached).toBeNull();
    });

    it('should expire cached data after timeout', () => {
      const entityId = 'actor_1';
      const equipmentData = { equipped: {} };

      // Set very short timeout for testing
      cacheManager.cacheTimeout = 1;
      cacheManager.cacheEquipment(entityId, equipmentData);

      // Wait for expiration
      setTimeout(() => {
        const cached = cacheManager.getCachedEquipment(entityId);
        expect(cached).toBeNull();
      }, 10);
    });
  });

  describe('cache statistics', () => {
    it('should track cache hits and misses', () => {
      const entityId = 'actor_1';
      const equipmentData = { equipped: {} };

      // Miss
      cacheManager.getCachedEquipment(entityId);

      // Cache and hit
      cacheManager.cacheEquipment(entityId, equipmentData);
      cacheManager.getCachedEquipment(entityId);

      const stats = cacheManager.getStats();
      expect(stats.cacheHits).toBe(1);
      expect(stats.cacheMisses).toBe(1);
      expect(stats.hitRate).toBe(50);
    });
  });

  describe('cache size management', () => {
    it('should evict oldest entries when cache is full', () => {
      // Set small cache size for testing
      cacheManager.maxCacheSize = 2;

      // Fill cache beyond capacity
      cacheManager.cacheEquipment('entity_1', { equipped: {} });
      cacheManager.cacheEquipment('entity_2', { equipped: {} });
      cacheManager.cacheEquipment('entity_3', { equipped: {} });

      // First entity should be evicted
      expect(cacheManager.getCachedEquipment('entity_1')).toBeNull();
      expect(cacheManager.getCachedEquipment('entity_2')).not.toBeNull();
      expect(cacheManager.getCachedEquipment('entity_3')).not.toBeNull();
    });
  });
});
```

### 2.5.3: Test Filter Integration (1 hour)

**File**: `tests/integration/scopeDsl/clothingFilterIntegration.test.js`

```javascript
describe('Clothing Filter Integration', () => {
  let engine;
  let parser;
  let mockRuntimeContext;

  beforeEach(() => {
    // Setup test environment with clothing operators
    engine = new createScopeEngine();
    parser = createDefaultDslParser();

    mockRuntimeContext = {
      entityManager: {
        getComponentData: jest.fn(),
        hasComponent: jest.fn().mockReturnValue(true),
        getEntitiesWithComponent: jest.fn().mockReturnValue([]),
        getEntity: jest.fn(),
      },
      jsonLogicEval: {
        evaluate: jest.fn(),
      },
    };
  });

  it('should work with clothing-specific JSON Logic operators', () => {
    // Setup mock data for formal clothing filtering
    mockRuntimeContext.entityManager.getComponentData.mockImplementation(
      (entityId, componentId) => {
        if (componentId === 'clothing:equipment') {
          return {
            equipped: {
              torso_upper: {
                outer: 'business_suit',
                base: 'casual_shirt',
              },
            },
          };
        } else if (componentId === 'clothing:wearable') {
          if (entityId === 'business_suit') {
            return { tags: ['formal'] };
          } else if (entityId === 'casual_shirt') {
            return { tags: ['casual'] };
          }
        }
        return null;
      }
    );

    // Mock JSON Logic evaluation to use our clothing operators
    mockRuntimeContext.jsonLogicEval.evaluate.mockImplementation(
      (logic, context) => {
        if (logic.hasClothingTags) {
          const [itemId, tags] = logic.hasClothingTags;
          const wearable = mockRuntimeContext.entityManager.getComponentData(
            itemId,
            'clothing:wearable'
          );
          return wearable?.tags?.includes(tags);
        }
        return true;
      }
    );

    const ast = parser.parse(
      'actor.topmost_clothing[][{"hasClothingTags": [{"var": "item"}, "formal"]}]'
    );
    const result = engine.resolve(ast, mockActorEntity, mockRuntimeContext);

    expect(result).toEqual(new Set(['business_suit']));
  });
});
```

---

## Phase 2 Completion Checklist

### Enhanced Features Implemented

- [ ] Advanced layer-specific operations (visible_clothing, removable_clothing, etc.)
- [ ] Condition-based filtering (dirty_clothing, clean_clothing, formal_clothing, casual_clothing)
- [ ] Performance caching system with statistics tracking
- [ ] Enhanced error handling and data recovery
- [ ] Custom JSON Logic operators for clothing

### Performance Optimizations

- [ ] Equipment data caching with configurable timeout
- [ ] Resolution result caching for repeated queries
- [ ] Optimized array iteration algorithms
- [ ] Cache eviction strategy for memory management

### Test Coverage Added

- [ ] Advanced layer operation tests
- [ ] Cache performance and management tests
- [ ] Error recovery and resilience tests
- [ ] Filter integration tests with clothing operators
- [ ] Performance benchmarking tests

### Integration Points

- [ ] Cache manager integrated into clothing resolvers
- [ ] Custom JSON Logic operators registered
- [ ] Filter resolver enhanced for clothing context
- [ ] Error recovery mechanisms tested

### Documentation Updated

- [ ] Advanced clothing operations documented
- [ ] Cache configuration options documented
- [ ] Performance optimization guidelines added
- [ ] Error handling patterns documented

### Performance Targets Met

- [ ] <5ms average resolution time maintained
- [ ] > 90% cache hit rate achieved in typical usage
- [ ] Memory usage stays under 2MB for cache system
- [ ] Error recovery doesn't impact performance significantly

### Next Steps

Proceed to **Phase 3** for action template integration, comprehensive error handling, and production-ready documentation.

**Continue to**: [scope-dsl-clothing-implementation-phase3.workflow.md](./scope-dsl-clothing-implementation-phase3.workflow.md)
