# Scope DSL Clothing Target Resolution - Main Implementation Workflow

**Date**: 2025-01-24  
**Implementation Approach**: Approach 3 - Custom Step Resolver (Recommended)  
**Status**: Ready for Implementation  
**Target Files**: Phase 1 (Core Infrastructure)

## Executive Summary

This workflow implements the Scope DSL extension for clothing target resolution using the Custom Step Resolver approach. The implementation enables intuitive syntax like `actor.topmost_clothing.torso_upper` and `actor.topmost_clothing[]` to replace complex JSON Logic expressions for retrieving clothing items.

### Key Benefits

- **Intuitive syntax**: `actor.topmost_clothing.torso_upper` vs 30+ line JSON Logic expressions
- **High performance**: Direct equipment component access without filtering chains
- **Extensible architecture**: Easy addition of new clothing operations (`outer_clothing`, `base_clothing`)
- **Backward compatible**: No changes to existing scope DSL functionality
- **Clean integration**: Works within existing resolver dispatch system

### Architecture Overview

The implementation creates two specialized resolvers:

1. **ClothingStepResolver**: Handles clothing field access (`topmost_clothing`, `all_clothing`, etc.)
2. **SlotAccessResolver**: Handles specific slot access (`.torso_upper`, `.legs`, etc.)

These integrate into the existing dispatcher system in `src/scopeDsl/engine.js` with priority handling.

## Related Workflow Files

- **Phase 2**: [scope-dsl-clothing-implementation-phase2.workflow.md](./scope-dsl-clothing-implementation-phase2.workflow.md)
- **Phase 3**: [scope-dsl-clothing-implementation-phase3.workflow.md](./scope-dsl-clothing-implementation-phase3.workflow.md)
- **Phase 4**: [scope-dsl-clothing-implementation-phase4.workflow.md](./scope-dsl-clothing-implementation-phase4.workflow.md)

---

# Phase 1: Core Infrastructure (Week 1)

## Task 1.1: Create Clothing Step Resolver Foundation

**File**: `src/scopeDsl/nodes/clothingStepResolver.js`  
**Estimated Time**: 4 hours  
**Dependencies**: Understanding of existing step resolver architecture

### Implementation Details

Create the core clothing step resolver that handles clothing-specific field access patterns.

#### 1.1.1: Create Base File Structure (30 minutes)

```javascript
/**
 * @file Specialized resolver for clothing-related step operations
 * @description Handles clothing field access like topmost_clothing, all_clothing, outer_clothing
 * enabling syntax: actor.topmost_clothing[] and actor.topmost_clothing.torso_upper
 */

import { validateDependency } from '../../utils/validationCore.js';

/**
 * Creates a clothing step resolver for handling clothing-specific field access
 * @param {object} dependencies - Injected dependencies
 * @param {object} dependencies.entitiesGateway - Gateway for entity data access
 * @returns {object} NodeResolver with canResolve and resolve methods
 */
export default function createClothingStepResolver({ entitiesGateway }) {
  validateDependency(entitiesGateway, 'entitiesGateway');

  // Constants defined here...

  return {
    canResolve,
    resolve,
  };
}
```

#### 1.1.2: Define Clothing Field Constants (15 minutes)

Add comprehensive clothing field definitions:

```javascript
const CLOTHING_FIELDS = {
  topmost_clothing: 'topmost',
  all_clothing: 'all',
  outer_clothing: 'outer',
  base_clothing: 'base',
  underwear: 'underwear',
};

const CLOTHING_SLOTS = [
  'torso_upper',
  'torso_lower',
  'legs',
  'feet',
  'head_gear',
  'hands',
  'left_arm_clothing',
  'right_arm_clothing',
];

const LAYER_PRIORITY = {
  topmost: ['outer', 'base', 'underwear'],
  all: ['outer', 'base', 'underwear', 'accessories'],
  outer: ['outer'],
  base: ['base'],
  underwear: ['underwear'],
};
```

#### 1.1.3: Implement canResolve Method (15 minutes)

```javascript
function canResolve(node) {
  return (
    node.type === 'Step' &&
    node.field &&
    CLOTHING_FIELDS.hasOwnProperty(node.field)
  );
}
```

#### 1.1.4: Implement Core Resolve Method (2 hours)

```javascript
function resolve(node, ctx) {
  const { field, parent, isArray } = node;
  const parentResults = ctx.dispatcher.resolve(parent, ctx);
  const resultSet = new Set();

  // Add trace logging
  if (ctx.trace) {
    ctx.trace.addLog(
      'info',
      `ClothingStepResolver: Processing ${field} field, isArray: ${isArray}`,
      'ClothingStepResolver',
      { field, isArray, parentResultsSize: parentResults.size }
    );
  }

  // Process each parent entity
  for (const entityId of parentResults) {
    if (typeof entityId !== 'string') {
      continue; // Skip non-entity results
    }

    const clothingData = resolveClothingField(
      entityId,
      field,
      isArray,
      ctx.trace
    );
    clothingData.forEach((id) => resultSet.add(id));
  }

  if (ctx.trace) {
    ctx.trace.addLog(
      'info',
      `ClothingStepResolver: Resolution complete, found ${resultSet.size} items`,
      'ClothingStepResolver',
      { resultSize: resultSet.size }
    );
  }

  return resultSet;
}
```

#### 1.1.5: Implement resolveClothingField Method (1 hour)

```javascript
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

  const mode = CLOTHING_FIELDS[field];

  if (isArray) {
    // Return all items: actor.topmost_clothing[]
    return getAllClothingItems(equipment.equipped, mode, trace);
  } else {
    // Return slot access object for further resolution: actor.topmost_clothing.torso_upper
    return createSlotAccessObject(equipment.equipped, mode);
  }
}
```

#### 1.1.6: Implement Helper Methods (45 minutes)

```javascript
function getAllClothingItems(equipped, mode, trace) {
  const result = [];
  const layers = LAYER_PRIORITY[mode] || LAYER_PRIORITY.topmost;

  for (const [slotName, slotData] of Object.entries(equipped)) {
    for (const layer of layers) {
      if (slotData[layer]) {
        result.push(slotData[layer]);
        if (mode === 'topmost') {
          break; // Only take the topmost for topmost mode
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

function createSlotAccessObject(equipped, mode) {
  // Creates a virtual object for slot-specific access
  return [
    {
      __clothingSlotAccess: true,
      equipped,
      mode,
      type: 'clothing_slot_access',
    },
  ];
}
```

### 1.1.7: Validation Requirements

- **Input validation**: Check that `entitiesGateway` has required methods
- **Error handling**: Graceful handling of missing equipment components
- **Type safety**: Ensure return values are always arrays or sets
- **Performance**: Minimize equipment component lookups

### 1.1.8: Testing Requirements

Create test file: `tests/unit/scopeDsl/nodes/clothingStepResolver.test.js`

**Required test cases**:

1. `canResolve()` returns true for clothing fields
2. `canResolve()` returns false for non-clothing fields
3. Array syntax returns all topmost items
4. Dot notation creates slot access object
5. Missing equipment component returns empty result
6. Different clothing modes (topmost, all, outer, base, underwear)
7. Trace logging works correctly
8. Invalid entity IDs handled gracefully

---

## Task 1.2: Create Slot Access Resolver

**File**: `src/scopeDsl/nodes/slotAccessResolver.js`  
**Estimated Time**: 3 hours  
**Dependencies**: Task 1.1 complete

### Implementation Details

Create the resolver that handles specific clothing slot access after clothing field resolution.

#### 1.2.1: Create Base File Structure (30 minutes)

```javascript
/**
 * @file Handles access to specific clothing slots after clothing field resolution
 * @description Processes slot access like .torso_upper, .legs from clothing access objects
 * enabling syntax: actor.topmost_clothing.torso_upper
 */

import { validateDependency } from '../../utils/validationCore.js';

/**
 * Creates a slot access resolver for handling clothing slot-specific access
 * @param {object} dependencies - Injected dependencies
 * @param {object} dependencies.entitiesGateway - Gateway for entity data access
 * @returns {object} NodeResolver with canResolve and resolve methods
 */
export default function createSlotAccessResolver({ entitiesGateway }) {
  validateDependency(entitiesGateway, 'entitiesGateway');

  // Constants and helper functions defined here...

  return {
    canResolve,
    resolve,
  };
}
```

#### 1.2.2: Define Slot Constants (15 minutes)

```javascript
const CLOTHING_SLOTS = [
  'torso_upper',
  'torso_lower',
  'legs',
  'feet',
  'head_gear',
  'hands',
  'left_arm_clothing',
  'right_arm_clothing',
];

const LAYER_PRIORITY = {
  topmost: ['outer', 'base', 'underwear'],
  all: ['outer', 'base', 'underwear', 'accessories'],
  outer: ['outer'],
  base: ['base'],
  underwear: ['underwear'],
};
```

#### 1.2.3: Implement canResolve Method (15 minutes)

```javascript
function canResolve(node) {
  return (
    node.type === 'Step' && node.field && CLOTHING_SLOTS.includes(node.field)
  );
}
```

#### 1.2.4: Implement Core Resolve Method (1.5 hours)

```javascript
function resolve(node, ctx) {
  const { field, parent } = node;
  const parentResults = ctx.dispatcher.resolve(parent, ctx);
  const resultSet = new Set();

  if (ctx.trace) {
    ctx.trace.addLog(
      'info',
      `SlotAccessResolver: Processing slot ${field}`,
      'SlotAccessResolver',
      { field, parentResultsSize: parentResults.size }
    );
  }

  for (const item of parentResults) {
    if (typeof item === 'object' && item.__clothingSlotAccess) {
      // This is a clothing slot access object from ClothingStepResolver
      const slotItem = resolveSlotAccess(item, field, ctx.trace);
      if (slotItem) {
        resultSet.add(slotItem);
      }
    } else if (typeof item === 'string') {
      // Regular entity - try to access component field (backward compatibility)
      const componentData = entitiesGateway.getComponentData(item, field);
      if (componentData !== null && componentData !== undefined) {
        addToResultSet(resultSet, componentData);
      }
    }
  }

  if (ctx.trace) {
    ctx.trace.addLog(
      'info',
      `SlotAccessResolver: Resolution complete, found ${resultSet.size} items`,
      'SlotAccessResolver',
      { resultSize: resultSet.size }
    );
  }

  return resultSet;
}
```

#### 1.2.5: Implement Helper Methods (45 minutes)

```javascript
function resolveSlotAccess(clothingAccess, slotName, trace) {
  const { equipped, mode } = clothingAccess;
  const slotData = equipped[slotName];

  if (!slotData) {
    if (trace) {
      trace.addLog(
        'info',
        `SlotAccessResolver: No data found for slot ${slotName}`,
        'SlotAccessResolver',
        { slotName }
      );
    }
    return null;
  }

  const layers = LAYER_PRIORITY[mode] || LAYER_PRIORITY.topmost;

  for (const layer of layers) {
    if (slotData[layer]) {
      if (trace) {
        trace.addLog(
          'info',
          `SlotAccessResolver: Found item in slot ${slotName}, layer ${layer}`,
          'SlotAccessResolver',
          { slotName, layer, itemId: slotData[layer] }
        );
      }
      return slotData[layer];
    }
  }

  return null;
}

function addToResultSet(resultSet, data) {
  if (Array.isArray(data)) {
    data.forEach((item) => resultSet.add(item));
  } else if (typeof data === 'string') {
    resultSet.add(data);
  } else if (data !== null && data !== undefined) {
    resultSet.add(data);
  }
}
```

### 1.2.6: Validation Requirements

- **Input validation**: Verify clothing access objects have required properties
- **Type safety**: Handle various data types in result sets
- **Backward compatibility**: Support regular component field access
- **Error resilience**: Graceful handling of malformed slot data

### 1.2.7: Testing Requirements

Create test file: `tests/unit/scopeDsl/nodes/slotAccessResolver.test.js`

**Required test cases**:

1. `canResolve()` identifies clothing slot fields correctly
2. Resolves slot access from clothing access objects
3. Handles missing slot data gracefully
4. Supports different layer priority modes
5. Maintains backward compatibility with regular entities
6. Array data handled correctly in result sets
7. Trace logging functionality
8. Invalid clothing access objects handled safely

---

## Task 1.3: Integrate Resolvers into Dispatcher

**File**: `src/scopeDsl/engine.js`  
**Estimated Time**: 1 hour  
**Dependencies**: Tasks 1.1 and 1.2 complete

### Implementation Details

Integrate the new clothing resolvers into the existing resolver dispatch system.

#### 1.3.1: Add Resolver Imports (5 minutes)

Add imports at the top of `src/scopeDsl/engine.js`:

```javascript
import createClothingStepResolver from './nodes/clothingStepResolver.js';
import createSlotAccessResolver from './nodes/slotAccessResolver.js';
```

#### 1.3.2: Update \_createResolvers Method (45 minutes)

Modify the `_createResolvers` method to include clothing resolvers with proper priority:

```javascript
_createResolvers({ locationProvider, entitiesGateway, logicEval }) {
  // Create clothing resolvers
  const clothingStepResolver = createClothingStepResolver({ entitiesGateway });
  const slotAccessResolver = createSlotAccessResolver({ entitiesGateway });

  return [
    // Clothing resolvers get priority for their specific fields
    clothingStepResolver,
    slotAccessResolver,

    // Existing resolvers maintain their order
    createSourceResolver({ entitiesGateway, locationProvider }),
    createStepResolver({ entitiesGateway }),
    createFilterResolver({ logicEval, entitiesGateway, locationProvider }),
    createUnionResolver(),
    createArrayIterationResolver(),
  ];
}
```

#### 1.3.3: Add JSDoc Documentation (10 minutes)

Update JSDoc comments to document the new resolvers:

```javascript
/**
 * Constructs the list of node resolvers with clothing support.
 *
 * @private
 * @param {object} deps - Resolver dependencies.
 * @param {object} deps.locationProvider - Location provider.
 * @param {object} deps.entitiesGateway - Entities gateway.
 * @param {object} deps.logicEval - Logic evaluator.
 * @returns {Array<object>} Array of resolver objects including clothing resolvers.
 */
```

### 1.3.4: Validation Requirements

- **Resolver priority**: Ensure clothing resolvers are checked before generic step resolver
- **Dependency injection**: Verify all resolvers receive required dependencies
- **Backward compatibility**: Existing functionality must remain unchanged

### 1.3.5: Testing Requirements

Update existing engine tests and create new integration tests:

**File**: `tests/unit/scopeDsl/engine.test.js` (additions)

1. Engine initializes with clothing resolvers
2. Clothing resolvers have correct priority in dispatcher
3. Existing functionality unaffected

---

## Task 1.4: Create Unit Tests for Core Functionality

**Files**: Multiple test files  
**Estimated Time**: 6 hours  
**Dependencies**: Tasks 1.1, 1.2, 1.3 complete

### 1.4.1: ClothingStepResolver Unit Tests (2.5 hours)

**File**: `tests/unit/scopeDsl/nodes/clothingStepResolver.test.js`

#### Test Structure Template:

```javascript
import { describe, it, expect, beforeEach } from '@jest/globals';
import createClothingStepResolver from '../../../../src/scopeDsl/nodes/clothingStepResolver.js';

describe('ClothingStepResolver', () => {
  let resolver;
  let mockEntitiesGateway;
  let mockEquipmentData;
  let mockContext;

  beforeEach(() => {
    // Setup mocks and test data
    mockEquipmentData = {
      equipped: {
        torso_upper: {
          outer: 'jacket_1',
          base: 'shirt_1',
          underwear: 'undershirt_1',
        },
        torso_lower: {
          outer: 'pants_1',
          base: 'shorts_1',
        },
      },
    };

    mockEntitiesGateway = {
      getComponentData: jest.fn().mockReturnValue(mockEquipmentData),
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

  describe('canResolve', () => {
    it('should return true for topmost_clothing field', () => {
      const node = { type: 'Step', field: 'topmost_clothing' };
      expect(resolver.canResolve(node)).toBe(true);
    });

    it('should return true for all_clothing field', () => {
      const node = { type: 'Step', field: 'all_clothing' };
      expect(resolver.canResolve(node)).toBe(true);
    });

    it('should return false for non-clothing fields', () => {
      const node = { type: 'Step', field: 'regular_component' };
      expect(resolver.canResolve(node)).toBe(false);
    });

    it('should return false for non-Step nodes', () => {
      const node = { type: 'Source', field: 'topmost_clothing' };
      expect(resolver.canResolve(node)).toBe(false);
    });
  });

  describe('resolve - array syntax', () => {
    it('should return all topmost items for actor.topmost_clothing[]', () => {
      const node = {
        type: 'Step',
        field: 'topmost_clothing',
        isArray: true,
        parent: { type: 'Source' },
      };

      const result = resolver.resolve(node, mockContext);

      // Should return topmost items from both slots
      expect(result).toEqual(new Set(['jacket_1', 'pants_1']));
      expect(mockEntitiesGateway.getComponentData).toHaveBeenCalledWith(
        'actor_1',
        'clothing:equipment'
      );
    });

    it('should return all items for actor.all_clothing[]', () => {
      const node = {
        type: 'Step',
        field: 'all_clothing',
        isArray: true,
        parent: { type: 'Source' },
      };

      const result = resolver.resolve(node, mockContext);

      // Should return all items from all layers
      expect(result.size).toBe(5); // All clothing items
      expect(result).toContain('jacket_1');
      expect(result).toContain('shirt_1');
      expect(result).toContain('undershirt_1');
      expect(result).toContain('pants_1');
      expect(result).toContain('shorts_1');
    });

    it('should return empty set when no equipment component exists', () => {
      mockEntitiesGateway.getComponentData.mockReturnValue(null);

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

  describe('resolve - dot notation setup', () => {
    it('should create slot access object for actor.topmost_clothing.torso_upper setup', () => {
      const node = {
        type: 'Step',
        field: 'topmost_clothing',
        isArray: false,
        parent: { type: 'Source' },
      };

      const result = resolver.resolve(node, mockContext);
      const resultArray = Array.from(result);

      expect(resultArray).toHaveLength(1);
      const slotAccessObject = resultArray[0];
      expect(slotAccessObject.__clothingSlotAccess).toBe(true);
      expect(slotAccessObject.equipped).toEqual(mockEquipmentData.equipped);
      expect(slotAccessObject.mode).toBe('topmost');
    });
  });

  describe('layer-specific resolution', () => {
    it('should resolve outer_clothing correctly', () => {
      const node = {
        type: 'Step',
        field: 'outer_clothing',
        isArray: true,
        parent: { type: 'Source' },
      };

      const result = resolver.resolve(node, mockContext);

      // Should only return outer layer items
      expect(result).toEqual(new Set(['jacket_1', 'pants_1']));
    });

    it('should resolve base_clothing correctly', () => {
      const node = {
        type: 'Step',
        field: 'base_clothing',
        isArray: true,
        parent: { type: 'Source' },
      };

      const result = resolver.resolve(node, mockContext);

      // Should only return base layer items
      expect(result).toEqual(new Set(['shirt_1', 'shorts_1']));
    });
  });

  describe('trace logging', () => {
    it('should log resolution steps when trace is provided', () => {
      const node = {
        type: 'Step',
        field: 'topmost_clothing',
        isArray: true,
        parent: { type: 'Source' },
      };

      resolver.resolve(node, mockContext);

      expect(mockContext.trace.addLog).toHaveBeenCalledWith(
        'info',
        expect.stringContaining('ClothingStepResolver: Processing'),
        'ClothingStepResolver',
        expect.any(Object)
      );
    });
  });
});
```

### 1.4.2: SlotAccessResolver Unit Tests (2.5 hours)

**File**: `tests/unit/scopeDsl/nodes/slotAccessResolver.test.js`

#### Key Test Cases:

1. **canResolve functionality**
2. **Slot access from clothing objects**
3. **Layer priority handling**
4. **Missing slot graceful handling**
5. **Backward compatibility with regular entities**
6. **Array data handling in results**
7. **Trace logging verification**
8. **Error resilience with malformed data**

### 1.4.3: Engine Integration Tests (1 hour)

**File**: `tests/unit/scopeDsl/engine.test.js` (additions)

#### Key Test Cases:

1. Engine initializes with clothing resolvers
2. Resolver priority order maintained
3. Existing engine functionality unchanged
4. Clothing resolvers accessible through dispatcher

---

## Task 1.5: Create Integration Tests

**File**: `tests/integration/scopeDsl/clothingResolverChain.test.js`  
**Estimated Time**: 3 hours  
**Dependencies**: All Phase 1 tasks complete

### 1.5.1: Full Resolution Chain Tests (2 hours)

Test complete resolution from parse through execution:

```javascript
import { describe, it, expect, beforeEach } from '@jest/globals';
import createScopeEngine from '../../../src/scopeDsl/engine.js';
import createDefaultDslParser from '../../../src/scopeDsl/parser/defaultDslParser.js';

describe('Clothing Resolver Chain Integration', () => {
  let engine;
  let parser;
  let mockRuntimeContext;
  let mockActorEntity;

  beforeEach(() => {
    // Setup complete test environment
    engine = new createScopeEngine();
    parser = createDefaultDslParser();

    // Create comprehensive mock data
    const mockEquipmentData = {
      equipped: {
        torso_upper: {
          outer: 'leather_jacket_001',
          base: 'cotton_shirt_002',
          underwear: 'undershirt_003',
        },
        torso_lower: {
          outer: 'jeans_004',
          base: 'shorts_005',
        },
        feet: {
          outer: 'boots_006',
        },
      },
    };

    mockActorEntity = { id: 'player_character' };

    mockRuntimeContext = {
      entityManager: {
        getComponentData: jest.fn((entityId, componentId) => {
          if (
            entityId === 'player_character' &&
            componentId === 'clothing:equipment'
          ) {
            return mockEquipmentData;
          }
          return null;
        }),
        hasComponent: jest.fn().mockReturnValue(true),
        getEntitiesWithComponent: jest.fn().mockReturnValue([]),
        getEntity: jest.fn().mockReturnValue(mockActorEntity),
      },
    };
  });

  describe('Complete resolution chain', () => {
    it('should resolve actor.topmost_clothing.torso_upper from parse to result', () => {
      // Parse the scope expression
      const ast = parser.parse('actor.topmost_clothing.torso_upper');

      // Resolve through engine
      const result = engine.resolve(ast, mockActorEntity, mockRuntimeContext);

      // Should return the topmost item in torso_upper slot (outer layer)
      expect(result).toEqual(new Set(['leather_jacket_001']));
    });

    it('should resolve actor.topmost_clothing[] to get all topmost items', () => {
      const ast = parser.parse('actor.topmost_clothing[]');
      const result = engine.resolve(ast, mockActorEntity, mockRuntimeContext);

      // Should return topmost from each equipped slot
      expect(result).toEqual(
        new Set(['leather_jacket_001', 'jeans_004', 'boots_006'])
      );
    });

    it('should handle multiple slot access in sequence', () => {
      const astUpper = parser.parse('actor.topmost_clothing.torso_upper');
      const astLower = parser.parse('actor.topmost_clothing.torso_lower');

      const resultUpper = engine.resolve(
        astUpper,
        mockActorEntity,
        mockRuntimeContext
      );
      const resultLower = engine.resolve(
        astLower,
        mockActorEntity,
        mockRuntimeContext
      );

      expect(resultUpper).toEqual(new Set(['leather_jacket_001']));
      expect(resultLower).toEqual(new Set(['jeans_004']));
    });
  });

  describe('Layer-specific resolution', () => {
    it('should resolve outer_clothing[] correctly', () => {
      const ast = parser.parse('actor.outer_clothing[]');
      const result = engine.resolve(ast, mockActorEntity, mockRuntimeContext);

      expect(result).toEqual(
        new Set(['leather_jacket_001', 'jeans_004', 'boots_006'])
      );
    });

    it('should resolve base_clothing[] correctly', () => {
      const ast = parser.parse('actor.base_clothing[]');
      const result = engine.resolve(ast, mockActorEntity, mockRuntimeContext);

      expect(result).toEqual(new Set(['cotton_shirt_002', 'shorts_005']));
    });
  });

  describe('Error handling', () => {
    it('should handle missing equipment component gracefully', () => {
      mockRuntimeContext.entityManager.getComponentData.mockReturnValue(null);

      const ast = parser.parse('actor.topmost_clothing[]');
      const result = engine.resolve(ast, mockActorEntity, mockRuntimeContext);

      expect(result).toEqual(new Set());
    });

    it('should handle empty equipment slots gracefully', () => {
      mockRuntimeContext.entityManager.getComponentData.mockReturnValue({
        equipped: {},
      });

      const ast = parser.parse('actor.topmost_clothing.torso_upper');
      const result = engine.resolve(ast, mockActorEntity, mockRuntimeContext);

      expect(result).toEqual(new Set());
    });
  });
});
```

### 1.5.2: Performance Integration Tests (1 hour)

```javascript
describe('Clothing Resolution Performance', () => {
  it('should resolve clothing queries efficiently', () => {
    const iterations = 1000;
    const ast = parser.parse('actor.topmost_clothing[]');

    const startTime = performance.now();

    for (let i = 0; i < iterations; i++) {
      engine.resolve(ast, mockActorEntity, mockRuntimeContext);
    }

    const endTime = performance.now();
    const averageTime = (endTime - startTime) / iterations;

    // Should complete in under 5ms per resolution
    expect(averageTime).toBeLessThan(5);
  });
});
```

---

## Task 1.6: Documentation and Code Quality

**Files**: Various documentation updates  
**Estimated Time**: 2 hours  
**Dependencies**: All previous tasks complete

### 1.6.1: Update Project Documentation (1 hour)

**File**: `docs/scope-dsl.md` (additions)

Add clothing syntax documentation:

````markdown
## Clothing Target Resolution

The Scope DSL supports specialized clothing operations for efficient clothing item targeting.

### Basic Syntax

```dsl
// Get all topmost clothing items
all_removable := actor.topmost_clothing[]

// Get specific slot's topmost item
upper_shirt := actor.topmost_clothing.torso_upper
lower_pants := actor.topmost_clothing.torso_lower

// Get items from specific layers
all_outer := actor.outer_clothing[]
all_base := actor.base_clothing[]
all_underwear := actor.underwear[]
```
````

### Supported Fields

- `topmost_clothing` - Returns topmost layer items (outer > base > underwear priority)
- `all_clothing` - Returns items from all layers
- `outer_clothing` - Returns only outer layer items
- `base_clothing` - Returns only base layer items
- `underwear` - Returns only underwear layer items

### Supported Slots

- `torso_upper` - Upper torso clothing
- `torso_lower` - Lower torso clothing
- `legs` - Leg clothing
- `feet` - Footwear
- `head_gear` - Head covering
- `hands` - Hand covering
- `left_arm_clothing` - Left arm covering
- `right_arm_clothing` - Right arm covering

```

### 1.6.2: Add JSDoc Comments (30 minutes)

Ensure all functions have comprehensive JSDoc documentation with:
- Parameter descriptions
- Return value descriptions
- Usage examples
- Error conditions

### 1.6.3: Code Quality Validation (30 minutes)

Run and ensure passing:
- `npm run lint` - ESLint validation
- `npm run format` - Prettier formatting
- `npm run typecheck` - TypeScript type checking

---

## Phase 1 Completion Checklist

### Core Files Created
- [ ] `src/scopeDsl/nodes/clothingStepResolver.js` - Complete implementation
- [ ] `src/scopeDsl/nodes/slotAccessResolver.js` - Complete implementation
- [ ] Updated `src/scopeDsl/engine.js` - Resolver integration

### Test Files Created
- [ ] `tests/unit/scopeDsl/nodes/clothingStepResolver.test.js` - Comprehensive unit tests
- [ ] `tests/unit/scopeDsl/nodes/slotAccessResolver.test.js` - Comprehensive unit tests
- [ ] `tests/integration/scopeDsl/clothingResolverChain.test.js` - Integration tests

### Functionality Verified
- [ ] `actor.topmost_clothing[]` returns all topmost items
- [ ] `actor.topmost_clothing.torso_upper` returns specific slot item
- [ ] Layer-specific queries work (`outer_clothing[]`, `base_clothing[]`, etc.)
- [ ] Missing equipment handled gracefully
- [ ] Trace logging works correctly
- [ ] Performance meets requirements (<5ms per resolution)
- [ ] Backward compatibility maintained

### Code Quality Standards
- [ ] All lint checks pass
- [ ] All type checks pass
- [ ] Code formatting consistent
- [ ] JSDoc documentation complete
- [ ] Error handling comprehensive

### Next Steps

Proceed to **Phase 2** for extended operations, array handling optimizations, and performance enhancements.

**Continue to**: [scope-dsl-clothing-implementation-phase2.workflow.md](./scope-dsl-clothing-implementation-phase2.workflow.md)
```
