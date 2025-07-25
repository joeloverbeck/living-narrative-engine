# Phase 2: Enhanced Filter Syntax Implementation

**Phase**: 2 of 3  
**Feature**: Property-Based Filtering on Resolved Items  
**Complexity**: Medium  
**Timeline**: 5-7 days  
**Prerequisites**: Phase 1 complete (not blocking)

## Phase Overview

Implement enhanced filter syntax that enables property-based filtering on any resolved items, not just entities. This allows filtering clothing items by tags, materials, or any other component properties.

### Key Requirements

- Create flexible evaluation contexts for non-entity items
- Support component property access in filters
- Maintain backward compatibility with entity filtering
- Enable multiple property access patterns

### Success Criteria

- Filters can access properties on clothing items, not just entities
- Complex nested property filters work correctly
- Existing entity filters continue to work unchanged
- Performance impact minimal (<5% overhead)

---

## Ticket 2.1: Create Flexible Evaluation Context Factory

**File**: `src/scopeDsl/core/entityHelpers.js`  
**Time Estimate**: 3 hours  
**Dependencies**: None  
**Complexity**: Medium

### Description

Enhance the `createEvaluationContext` function to handle non-entity items like clothing IDs, maintaining backward compatibility while adding support for component data access.

### Current Implementation Analysis

The current `createEvaluationContext` in `entityHelpers.js` only handles entities. We need to extend it to handle arbitrary items with component data.

### Implementation Details

#### Step 1: Add Helper Functions

Add these helper functions at the top of entityHelpers.js:

```javascript
/**
 * Attempts to resolve component data for an item ID
 * @param {string} itemId - The item identifier
 * @param {object} entitiesGateway - Gateway for entity/component operations
 * @returns {object|null} Component data or null
 */
function resolveItemComponents(itemId, entitiesGateway) {
  // First try as entity
  const entity = entitiesGateway.getEntity?.(itemId);
  if (entity) {
    return gatherEntityComponents(entity);
  }

  // Try direct component lookup
  if (entitiesGateway.getItemComponents) {
    return entitiesGateway.getItemComponents(itemId);
  }

  // Try component registry lookup if available
  if (entitiesGateway.componentRegistry?.getItemComponents) {
    return entitiesGateway.componentRegistry.getItemComponents(itemId);
  }

  return null;
}

/**
 * Flattens component data for easier property access
 * Transforms { 'core:tags': { tags: ['a', 'b'] } }
 * into { 'core:tags': { tags: ['a', 'b'] }, tags: ['a', 'b'] }
 *
 * @param {object} components - Component data object
 * @returns {object} Flattened component data
 */
function flattenComponents(components) {
  const flattened = {};

  for (const [componentId, data] of Object.entries(components)) {
    // Add full component
    flattened[componentId] = data;

    // Add flattened properties if it's an object
    if (data && typeof data === 'object' && !Array.isArray(data)) {
      for (const [key, value] of Object.entries(data)) {
        // Only add if key doesn't exist (avoid overwriting)
        if (!(key in flattened)) {
          flattened[key] = value;
        }
      }
    }
  }

  return flattened;
}
```

#### Step 2: Enhance createEvaluationContext Function

Replace the existing `createEvaluationContext` function:

```javascript
/**
 * Creates an evaluation context for JSON Logic filters
 * Now supports both entities and non-entity items
 *
 * @param {any} item - Entity ID, item ID, or other value
 * @param {object} actorEntity - The acting entity
 * @param {object} entitiesGateway - Gateway for entity/component operations
 * @param {object} locationProvider - Provider for location context
 * @param {object} [trace] - Optional trace context
 * @returns {object} Evaluation context for JSON Logic
 */
export function createEvaluationContext(
  item,
  actorEntity,
  entitiesGateway,
  locationProvider,
  trace
) {
  const source = 'createEvaluationContext';

  // Handle null/undefined
  if (item == null) {
    return null;
  }

  // Handle string items (entity IDs, item IDs, etc.)
  if (typeof item === 'string') {
    // Try to get as entity first
    const entity = entitiesGateway.getEntity?.(item);
    if (entity) {
      if (trace) {
        trace.addLog('debug', `Item ${item} resolved as entity`, source);
      }
      // Use existing entity context creation
      return createEntityEvaluationContext(
        entity,
        actorEntity,
        entitiesGateway,
        locationProvider
      );
    }

    // Not an entity - try to get component data
    const components = resolveItemComponents(item, entitiesGateway);
    if (components) {
      if (trace) {
        trace.addLog(
          'debug',
          `Item ${item} resolved as non-entity with components`,
          source
        );
      }

      const flattened = flattenComponents(components);

      return {
        // Core properties
        id: item,
        type: 'item', // Distinguish from entities

        // Component access patterns
        components, // Full namespaced components
        ...flattened, // Flattened for direct access

        // Computed properties for common patterns
        tags: flattened.tags || components['core:tags']?.tags || [],

        // Context properties (for compatibility)
        actor: actorEntity
          ? createEntityEvaluationContext(
              actorEntity,
              actorEntity,
              entitiesGateway,
              locationProvider
            )
          : null,

        location: locationProvider?.getLocation?.() || null,
      };
    }

    if (trace) {
      trace.addLog(
        'debug',
        `Item ${item} has no components, creating basic context`,
        source
      );
    }
  }

  // Fallback for non-string items or items without components
  return {
    id: String(item),
    value: item,
    type: typeof item,

    // Minimal context
    actor: actorEntity
      ? createEntityEvaluationContext(
          actorEntity,
          actorEntity,
          entitiesGateway,
          locationProvider
        )
      : null,

    location: locationProvider?.getLocation?.() || null,
  };
}

// Keep existing createEntityEvaluationContext function unchanged for backward compatibility
```

### Test Cases

Create file: `tests/unit/scopeDsl/core/entityHelpers.enhanced.test.js`

```javascript
import { describe, it, expect, beforeEach, jest } from '@jest/globals';
import { createEvaluationContext } from '../../../../src/scopeDsl/core/entityHelpers.js';

describe('Enhanced Evaluation Context', () => {
  let mockEntitiesGateway;
  let mockLocationProvider;
  let mockActorEntity;

  beforeEach(() => {
    mockActorEntity = {
      id: 'actor1',
      components: new Map([['core:actor', { name: 'Test Actor' }]]),
    };

    mockLocationProvider = {
      getLocation: () => ({ id: 'location1' }),
    };

    mockEntitiesGateway = {
      getEntity: jest.fn(),
      getComponentData: jest.fn(),
      getItemComponents: jest.fn(),
    };
  });

  describe('Item component resolution', () => {
    it('should create context for non-entity items with components', () => {
      const itemComponents = {
        'core:tags': { tags: ['waterproof', 'armor'] },
        'clothing:material': { type: 'leather', quality: 'high' },
        'clothing:armor': { rating: 5, durability: 100 },
      };

      mockEntitiesGateway.getEntity.mockReturnValue(null);
      mockEntitiesGateway.getItemComponents.mockReturnValue(itemComponents);

      const context = createEvaluationContext(
        'leather_jacket_001',
        mockActorEntity,
        mockEntitiesGateway,
        mockLocationProvider
      );

      expect(context).toMatchObject({
        id: 'leather_jacket_001',
        type: 'item',
        components: itemComponents,
        // Flattened properties
        tags: ['waterproof', 'armor'],
        type: 'leather',
        quality: 'high',
        rating: 5,
        durability: 100,
      });
    });

    it('should handle nested component properties', () => {
      const itemComponents = {
        'clothing:armor': {
          protection: {
            physical: 10,
            magical: 5,
          },
        },
      };

      mockEntitiesGateway.getEntity.mockReturnValue(null);
      mockEntitiesGateway.getItemComponents.mockReturnValue(itemComponents);

      const context = createEvaluationContext(
        'armor1',
        mockActorEntity,
        mockEntitiesGateway
      );

      expect(context.components['clothing:armor'].protection.physical).toBe(10);
      expect(context.protection.physical).toBe(10); // Flattened access
    });

    it('should preserve entity handling for backward compatibility', () => {
      const mockEntity = {
        id: 'entity1',
        components: new Map([['core:named', { name: 'Test Entity' }]]),
      };

      mockEntitiesGateway.getEntity.mockReturnValue(mockEntity);

      const context = createEvaluationContext(
        'entity1',
        mockActorEntity,
        mockEntitiesGateway,
        mockLocationProvider
      );

      // Should use existing entity evaluation context
      expect(context.id).toBe('entity1');
      expect(context.actor).toBeDefined();
      expect(context.location).toBeDefined();
    });

    it('should handle items without components', () => {
      mockEntitiesGateway.getEntity.mockReturnValue(null);
      mockEntitiesGateway.getItemComponents.mockReturnValue(null);

      const context = createEvaluationContext(
        'unknown_item',
        mockActorEntity,
        mockEntitiesGateway
      );

      expect(context).toMatchObject({
        id: 'unknown_item',
        value: 'unknown_item',
        type: 'string',
      });
    });

    it('should handle non-string items', () => {
      const context = createEvaluationContext(
        42,
        mockActorEntity,
        mockEntitiesGateway
      );

      expect(context).toMatchObject({
        id: '42',
        value: 42,
        type: 'number',
      });
    });

    it('should avoid property name conflicts when flattening', () => {
      const itemComponents = {
        'core:tags': { tags: ['a', 'b'] },
        'special:component': { tags: ['c', 'd'] }, // Conflicting property name
      };

      mockEntitiesGateway.getEntity.mockReturnValue(null);
      mockEntitiesGateway.getItemComponents.mockReturnValue(itemComponents);

      const context = createEvaluationContext(
        'item1',
        mockActorEntity,
        mockEntitiesGateway
      );

      // First component's 'tags' should win
      expect(context.tags).toEqual(['a', 'b']);
      // But both are accessible via components
      expect(context.components['core:tags'].tags).toEqual(['a', 'b']);
      expect(context.components['special:component'].tags).toEqual(['c', 'd']);
    });
  });

  describe('Trace logging', () => {
    it('should log item resolution steps when trace is provided', () => {
      const mockTrace = {
        addLog: jest.fn(),
      };

      mockEntitiesGateway.getEntity.mockReturnValue(null);
      mockEntitiesGateway.getItemComponents.mockReturnValue({
        'core:tags': { tags: [] },
      });

      createEvaluationContext(
        'item1',
        mockActorEntity,
        mockEntitiesGateway,
        mockLocationProvider,
        mockTrace
      );

      expect(mockTrace.addLog).toHaveBeenCalledWith(
        'debug',
        'Item item1 resolved as non-entity with components',
        'createEvaluationContext'
      );
    });
  });
});
```

### Verification Steps

1. Run new tests: `npm run test:unit -- entityHelpers.enhanced.test.js`
2. Run existing tests to ensure no regression: `npm run test:unit -- entityHelpers.test.js`
3. Verify all test cases pass
4. Check performance with large component objects

### Acceptance Criteria

- [ ] Non-entity items get proper evaluation contexts
- [ ] Component properties are accessible via multiple patterns
- [ ] Existing entity evaluation unchanged
- [ ] Proper fallbacks for items without components
- [ ] Trace logging works correctly

---

## Ticket 2.2: Enhance Entities Gateway with Item Lookup

**File**: `src/scopeDsl/engine.js`  
**Time Estimate**: 2 hours  
**Dependencies**: Ticket 2.1  
**Complexity**: Medium

### Description

Add item component lookup capabilities to the entities gateway created by the Scope DSL engine, enabling the filter resolver to access component data for non-entity items.

### Implementation Details

#### Step 1: Locate Gateway Creation

Find the `_createEntitiesGateway` method in `engine.js` (around line 200-250).

#### Step 2: Add Item Component Lookup

Enhance the gateway with item lookup capability:

```javascript
// In engine.js, within _createEntitiesGateway method
_createEntitiesGateway(runtimeCtx) {
  const componentRegistry = runtimeCtx?.componentRegistry;
  const entityManager = runtimeCtx?.entityManager;

  return {
    // Existing methods
    getEntity: (entityId) => {
      if (!entityManager) {
        return null;
      }
      return entityManager.getEntity(entityId);
    },

    getComponentData: (entityId, componentId) => {
      const entity = entityManager?.getEntity(entityId);
      if (!entity) {
        return null;
      }
      return entity.getComponent(componentId);
    },

    getComponentValue: (entityId, componentId, path, defaultValue = null) => {
      const data = this.getComponentData(entityId, componentId);
      if (!data) {
        return defaultValue;
      }
      return this._getValueAtPath(data, path, defaultValue);
    },

    hasEntity: (entityId) => {
      return entityManager?.hasEntity(entityId) || false;
    },

    hasComponent: (entityId, componentId) => {
      const entity = entityManager?.getEntity(entityId);
      return entity?.hasComponent(componentId) || false;
    },

    // NEW: Item component lookup method
    getItemComponents: (itemId) => {
      // First check if it's actually an entity
      const entity = entityManager?.getEntity(itemId);
      if (entity) {
        // Convert entity components to plain object
        const components = {};
        for (const [componentId, data] of entity.components) {
          components[componentId] = data;
        }
        return components;
      }

      // Check component registry for item definitions
      if (componentRegistry) {
        // Try to get item template/definition
        const itemDef = componentRegistry.getDefinition?.(`item:${itemId}`);
        if (itemDef?.components) {
          return itemDef.components;
        }

        // Try clothing-specific lookup
        const clothingDef = componentRegistry.getDefinition?.(`clothing:${itemId}`);
        if (clothingDef?.components) {
          return clothingDef.components;
        }

        // Generic item component lookup
        if (componentRegistry.getItemComponents) {
          return componentRegistry.getItemComponents(itemId);
        }
      }

      // Check if item ID references a component with data
      if (itemId.includes(':')) {
        const componentData = componentRegistry?.getSchema?.(itemId);
        if (componentData?.defaultData) {
          return { [itemId]: componentData.defaultData };
        }
      }

      return null;
    },

    // Optional: Convenience method for getting all entities with a component
    getEntitiesWithComponent: (componentId) => {
      if (!componentRegistry || !entityManager) {
        return new Set();
      }

      // This might need to be implemented in your component registry
      if (componentRegistry.getEntitiesWithComponent) {
        return componentRegistry.getEntitiesWithComponent(componentId);
      }

      // Fallback: scan all entities (less efficient)
      const result = new Set();
      if (entityManager.getAllEntities) {
        for (const entity of entityManager.getAllEntities()) {
          if (entity.hasComponent(componentId)) {
            result.add(entity.id);
          }
        }
      }

      return result;
    }
  };
}
```

#### Step 3: Add Support for Clothing Item Components

Since clothing items are a primary use case, add specialized support:

```javascript
// Add this helper method to the engine class
_resolveClothingItemComponents(itemId, componentRegistry) {
  // Common clothing component patterns
  const clothingComponents = {
    'core:tags': { tags: [] },
    'clothing:wearable': { slots: [], layer: 'base' },
    'clothing:material': { type: 'fabric' },
    'clothing:condition': { durability: 100, dirty: false }
  };

  // Try to load from registry
  const registeredComponents = componentRegistry?.getItemComponents?.(itemId);
  if (registeredComponents) {
    return { ...clothingComponents, ...registeredComponents };
  }

  // Check for clothing-specific definitions
  const clothingDef = componentRegistry?.getDefinition?.(`clothing:definitions:${itemId}`);
  if (clothingDef) {
    return { ...clothingComponents, ...clothingDef };
  }

  // Return defaults for unknown items
  return clothingComponents;
}
```

### Test Cases

Create file: `tests/unit/scopeDsl/engine.itemLookup.test.js`

```javascript
import { describe, it, expect, beforeEach, jest } from '@jest/globals';
import createScopeDslEngine from '../../../src/scopeDsl/engine.js';

describe('Scope DSL Engine - Item Component Lookup', () => {
  let engine;
  let mockDependencies;
  let mockRuntimeCtx;

  beforeEach(() => {
    mockDependencies = {
      logger: { debug: jest.fn(), error: jest.fn() },
      validator: { validateNode: jest.fn().mockReturnValue(true) },
    };

    mockRuntimeCtx = {
      entityManager: {
        getEntity: jest.fn(),
        hasEntity: jest.fn(),
      },
      componentRegistry: {
        getDefinition: jest.fn(),
        getItemComponents: jest.fn(),
        getSchema: jest.fn(),
      },
    };

    engine = createScopeDslEngine(mockDependencies);
  });

  describe('getItemComponents', () => {
    it('should return entity components when item is an entity', () => {
      const mockEntity = {
        id: 'entity1',
        components: new Map([
          ['core:named', { name: 'Test' }],
          ['core:tags', { tags: ['test'] }],
        ]),
      };

      mockRuntimeCtx.entityManager.getEntity.mockReturnValue(mockEntity);

      const gateway = engine._createEntitiesGateway(mockRuntimeCtx);
      const components = gateway.getItemComponents('entity1');

      expect(components).toEqual({
        'core:named': { name: 'Test' },
        'core:tags': { tags: ['test'] },
      });
    });

    it('should return item definition from component registry', () => {
      const itemComponents = {
        'core:tags': { tags: ['waterproof', 'armor'] },
        'clothing:material': { type: 'leather' },
      };

      mockRuntimeCtx.entityManager.getEntity.mockReturnValue(null);
      mockRuntimeCtx.componentRegistry.getItemComponents.mockReturnValue(
        itemComponents
      );

      const gateway = engine._createEntitiesGateway(mockRuntimeCtx);
      const components = gateway.getItemComponents('leather_jacket_001');

      expect(components).toEqual(itemComponents);
    });

    it('should check clothing-specific definitions', () => {
      const clothingDef = {
        components: {
          'clothing:wearable': { slots: ['torso:upper'], layer: 'outer' },
          'core:tags': { tags: ['jacket'] },
        },
      };

      mockRuntimeCtx.entityManager.getEntity.mockReturnValue(null);
      mockRuntimeCtx.componentRegistry.getItemComponents.mockReturnValue(null);
      mockRuntimeCtx.componentRegistry.getDefinition
        .mockReturnValueOnce(null) // item: lookup
        .mockReturnValueOnce(clothingDef); // clothing: lookup

      const gateway = engine._createEntitiesGateway(mockRuntimeCtx);
      const components = gateway.getItemComponents('jacket_001');

      expect(components).toEqual(clothingDef.components);
    });

    it('should return null for unknown items', () => {
      mockRuntimeCtx.entityManager.getEntity.mockReturnValue(null);
      mockRuntimeCtx.componentRegistry.getItemComponents.mockReturnValue(null);
      mockRuntimeCtx.componentRegistry.getDefinition.mockReturnValue(null);

      const gateway = engine._createEntitiesGateway(mockRuntimeCtx);
      const components = gateway.getItemComponents('unknown_item');

      expect(components).toBeNull();
    });

    it('should handle component schema lookup for namespaced IDs', () => {
      const schemaDefault = {
        defaultData: { protection: 5 },
      };

      mockRuntimeCtx.entityManager.getEntity.mockReturnValue(null);
      mockRuntimeCtx.componentRegistry.getSchema.mockReturnValue(schemaDefault);

      const gateway = engine._createEntitiesGateway(mockRuntimeCtx);
      const components = gateway.getItemComponents('armor:leather_vest');

      expect(components).toEqual({
        'armor:leather_vest': { protection: 5 },
      });
    });
  });

  describe('Integration with filter resolution', () => {
    it('should enable property filtering on items', () => {
      const mockActor = {
        id: 'actor1',
        components: new Map(),
      };

      // Mock clothing items returned by a scope expression
      const clothingItems = new Set(['jacket1', 'shirt1']);

      // Mock item components
      mockRuntimeCtx.componentRegistry.getItemComponents
        .mockReturnValueOnce({
          'core:tags': { tags: ['waterproof'] },
          'clothing:material': { type: 'leather' },
        })
        .mockReturnValueOnce({
          'core:tags': { tags: ['casual'] },
          'clothing:material': { type: 'cotton' },
        });

      // This is a conceptual test - actual implementation would involve filter resolver
      const gateway = engine._createEntitiesGateway(mockRuntimeCtx);

      // Verify gateway can look up components for filtering
      expect(gateway.getItemComponents('jacket1')).toHaveProperty('core:tags');
      expect(gateway.getItemComponents('shirt1')).toHaveProperty('core:tags');
    });
  });
});
```

### Verification Steps

1. Run new tests: `npm run test:unit -- engine.itemLookup.test.js`
2. Run existing engine tests: `npm run test:unit -- engine.test.js`
3. Verify no regression in engine functionality
4. Test with mock component registry

### Acceptance Criteria

- [ ] Gateway can look up components for non-entity items
- [ ] Entity lookup still works correctly
- [ ] Multiple fallback strategies implemented
- [ ] Clothing-specific lookups supported
- [ ] Null handling appropriate

---

## Ticket 2.3: Update Filter Resolver to Use Enhanced Contexts

**File**: `src/scopeDsl/nodes/filterResolver.js`  
**Time Estimate**: 2 hours  
**Dependencies**: Tickets 2.1, 2.2  
**Complexity**: Low

### Description

Update the filter resolver to use the enhanced evaluation context factory, enabling property-based filtering on all resolved items.

### Implementation Details

Since the filter resolver already uses `createEvaluationContext` from entityHelpers, the main change is ensuring it passes the enhanced entities gateway.

#### Step 1: Verify Imports

Ensure the filter resolver imports the enhanced version:

```javascript
import { createEvaluationContext } from '../core/entityHelpers.js';
```

#### Step 2: Update Resolution Logic

The existing code in filterResolver.js should already work, but let's add trace logging for non-entity items:

```javascript
// In filterResolver.js, within the resolve method
// Around line 130-150 where items are filtered

for (const item of parentResult) {
  try {
    // Enhanced context creation handles both entities and items
    const evalCtx = createEvaluationContext(
      item,
      actorEntity,
      entitiesGateway,
      locationProvider,
      trace
    );

    if (!evalCtx) {
      if (trace) {
        trace.addLog(
          'debug',
          `No evaluation context for item: ${item}`,
          source
        );
      }
      continue;
    }

    // Log the context type for debugging
    if (trace && evalCtx.type === 'item') {
      trace.addLog('debug', `Filtering non-entity item: ${item}`, source, {
        hasComponents: !!evalCtx.components,
        componentCount: evalCtx.components
          ? Object.keys(evalCtx.components).length
          : 0,
      });
    }

    const evalResult = logicEval.evaluate(node.logic, evalCtx);

    if (trace) {
      trace.addLog(
        'debug',
        `Filter evaluation for ${item}: ${evalResult}`,
        source,
        {
          logic: node.logic,
          contextType: evalCtx.type,
        }
      );
    }

    if (evalResult) {
      result.add(item);
    }
  } catch (error) {
    if (trace) {
      trace.addLog(
        'error',
        `Error filtering item ${item}: ${error.message}`,
        source
      );
    }
    // Continue with next item rather than failing entire filter
  }
}
```

### Test Cases

Create file: `tests/unit/scopeDsl/nodes/filterResolver.enhanced.test.js`

```javascript
import { describe, it, expect, beforeEach, jest } from '@jest/globals';
import createFilterResolver from '../../../../src/scopeDsl/nodes/filterResolver.js';

describe('Filter Resolver - Enhanced Property Filtering', () => {
  let filterResolver;
  let mockDeps;
  let mockCtx;

  beforeEach(() => {
    mockDeps = {
      logicEval: {
        evaluate: jest.fn(),
      },
      entitiesGateway: {
        getEntity: jest.fn(),
        getItemComponents: jest.fn(),
      },
      locationProvider: {
        getLocation: () => ({ id: 'loc1' }),
      },
    };

    mockCtx = {
      actorEntity: { id: 'actor1', components: new Map() },
      dispatcher: { resolve: jest.fn() },
      trace: { addLog: jest.fn() },
    };

    filterResolver = createFilterResolver(mockDeps);
  });

  describe('Property-based filtering on items', () => {
    it('should filter clothing items by tags', () => {
      // Setup parent result with clothing items
      const parentResult = new Set(['jacket1', 'shirt1', 'pants1']);
      mockCtx.dispatcher.resolve.mockReturnValue(parentResult);

      // Mock item components
      mockDeps.entitiesGateway.getEntity.mockReturnValue(null); // Not entities
      mockDeps.entitiesGateway.getItemComponents
        .mockReturnValueOnce({
          'core:tags': { tags: ['waterproof', 'armor'] },
        })
        .mockReturnValueOnce({
          'core:tags': { tags: ['casual'] },
        })
        .mockReturnValueOnce({
          'core:tags': { tags: ['waterproof', 'casual'] },
        });

      // Setup filter logic
      const filterNode = {
        type: 'Filter',
        logic: { in: ['waterproof', { var: 'tags' }] },
        parent: { type: 'Source' },
      };

      // Mock logic evaluation
      mockDeps.logicEval.evaluate.mockImplementation((logic, ctx) => {
        return ctx.tags && ctx.tags.includes('waterproof');
      });

      const result = filterResolver.resolve(filterNode, mockCtx);

      expect(result).toBeInstanceOf(Set);
      expect(Array.from(result)).toEqual(['jacket1', 'pants1']);
    });

    it('should filter by nested component properties', () => {
      const parentResult = new Set(['armor1', 'armor2']);
      mockCtx.dispatcher.resolve.mockReturnValue(parentResult);

      mockDeps.entitiesGateway.getEntity.mockReturnValue(null);
      mockDeps.entitiesGateway.getItemComponents
        .mockReturnValueOnce({
          'clothing:armor': { protection: { physical: 10, magical: 5 } },
        })
        .mockReturnValueOnce({
          'clothing:armor': { protection: { physical: 5, magical: 10 } },
        });

      const filterNode = {
        type: 'Filter',
        logic: {
          '>': [{ var: 'components.clothing:armor.protection.physical' }, 7],
        },
        parent: { type: 'Source' },
      };

      mockDeps.logicEval.evaluate.mockImplementation((logic, ctx) => {
        return ctx.components?.['clothing:armor']?.protection?.physical > 7;
      });

      const result = filterResolver.resolve(filterNode, mockCtx);

      expect(Array.from(result)).toEqual(['armor1']);
    });

    it('should handle mixed entity and item filtering', () => {
      const parentResult = new Set(['entity1', 'item1']);
      mockCtx.dispatcher.resolve.mockReturnValue(parentResult);

      // entity1 is an entity
      mockDeps.entitiesGateway.getEntity
        .mockReturnValueOnce({
          id: 'entity1',
          components: new Map([['core:tags', { tags: ['special'] }]]),
        })
        .mockReturnValueOnce(null); // item1 is not

      // item1 components
      mockDeps.entitiesGateway.getItemComponents.mockReturnValue({
        'core:tags': { tags: ['special'] },
      });

      const filterNode = {
        type: 'Filter',
        logic: { in: ['special', { var: 'components.core:tags.tags' }] },
        parent: { type: 'Source' },
      };

      mockDeps.logicEval.evaluate.mockReturnValue(true); // Both pass

      const result = filterResolver.resolve(filterNode, mockCtx);

      expect(Array.from(result).sort()).toEqual(['entity1', 'item1']);
    });

    it('should use flattened property access', () => {
      const parentResult = new Set(['item1']);
      mockCtx.dispatcher.resolve.mockReturnValue(parentResult);

      mockDeps.entitiesGateway.getEntity.mockReturnValue(null);
      mockDeps.entitiesGateway.getItemComponents.mockReturnValue({
        'clothing:material': { type: 'leather', quality: 'high' },
      });

      // Test both access patterns
      const filterNode1 = {
        type: 'Filter',
        logic: { '==': [{ var: 'type' }, 'leather'] }, // Flattened
        parent: { type: 'Source' },
      };

      const filterNode2 = {
        type: 'Filter',
        logic: {
          '==': [{ var: 'components.clothing:material.type' }, 'leather'],
        }, // Full path
        parent: { type: 'Source' },
      };

      mockDeps.logicEval.evaluate.mockReturnValue(true);

      const result1 = filterResolver.resolve(filterNode1, mockCtx);
      const result2 = filterResolver.resolve(filterNode2, mockCtx);

      expect(Array.from(result1)).toEqual(['item1']);
      expect(Array.from(result2)).toEqual(['item1']);
    });

    it('should handle items without components gracefully', () => {
      const parentResult = new Set(['item1', 'item2']);
      mockCtx.dispatcher.resolve.mockReturnValue(parentResult);

      mockDeps.entitiesGateway.getEntity.mockReturnValue(null);
      mockDeps.entitiesGateway.getItemComponents
        .mockReturnValueOnce(null) // item1 has no components
        .mockReturnValueOnce({ 'core:tags': { tags: ['valid'] } });

      const filterNode = {
        type: 'Filter',
        logic: { in: ['valid', { var: 'tags' }] },
        parent: { type: 'Source' },
      };

      mockDeps.logicEval.evaluate
        .mockReturnValueOnce(false) // item1 fails
        .mockReturnValueOnce(true); // item2 passes

      const result = filterResolver.resolve(filterNode, mockCtx);

      expect(Array.from(result)).toEqual(['item2']);
    });
  });

  describe('Complex filter scenarios', () => {
    it('should support AND conditions on properties', () => {
      const parentResult = new Set(['item1']);
      mockCtx.dispatcher.resolve.mockReturnValue(parentResult);

      mockDeps.entitiesGateway.getEntity.mockReturnValue(null);
      mockDeps.entitiesGateway.getItemComponents.mockReturnValue({
        'core:tags': { tags: ['waterproof', 'armor'] },
        'clothing:armor': { rating: 10 },
      });

      const filterNode = {
        type: 'Filter',
        logic: {
          and: [
            { in: ['waterproof', { var: 'tags' }] },
            { '>': [{ var: 'rating' }, 5] },
          ],
        },
        parent: { type: 'Source' },
      };

      mockDeps.logicEval.evaluate.mockReturnValue(true);

      const result = filterResolver.resolve(filterNode, mockCtx);

      expect(Array.from(result)).toEqual(['item1']);
    });

    it('should handle OR conditions', () => {
      const parentResult = new Set(['item1', 'item2', 'item3']);
      mockCtx.dispatcher.resolve.mockReturnValue(parentResult);

      mockDeps.entitiesGateway.getEntity.mockReturnValue(null);
      mockDeps.entitiesGateway.getItemComponents
        .mockReturnValueOnce({ 'clothing:material': { type: 'leather' } })
        .mockReturnValueOnce({ 'clothing:material': { type: 'metal' } })
        .mockReturnValueOnce({ 'clothing:material': { type: 'cloth' } });

      const filterNode = {
        type: 'Filter',
        logic: {
          or: [
            { '==': [{ var: 'type' }, 'leather'] },
            { '==': [{ var: 'type' }, 'metal'] },
          ],
        },
        parent: { type: 'Source' },
      };

      mockDeps.logicEval.evaluate
        .mockReturnValueOnce(true) // leather
        .mockReturnValueOnce(true) // metal
        .mockReturnValueOnce(false); // cloth

      const result = filterResolver.resolve(filterNode, mockCtx);

      expect(Array.from(result).sort()).toEqual(['item1', 'item2']);
    });
  });

  describe('Error handling', () => {
    it('should continue filtering when one item fails', () => {
      const parentResult = new Set(['item1', 'item2']);
      mockCtx.dispatcher.resolve.mockReturnValue(parentResult);

      mockDeps.entitiesGateway.getEntity.mockReturnValue(null);
      mockDeps.entitiesGateway.getItemComponents
        .mockReturnValueOnce({ 'core:tags': { tags: ['valid'] } })
        .mockReturnValueOnce({ 'core:tags': { tags: ['valid'] } });

      const filterNode = {
        type: 'Filter',
        logic: { in: ['valid', { var: 'tags' }] },
        parent: { type: 'Source' },
      };

      // First evaluation throws error
      mockDeps.logicEval.evaluate
        .mockImplementationOnce(() => {
          throw new Error('Evaluation error');
        })
        .mockReturnValueOnce(true);

      const result = filterResolver.resolve(filterNode, mockCtx);

      // Should still include item2 despite item1 error
      expect(Array.from(result)).toEqual(['item2']);
      expect(mockCtx.trace.addLog).toHaveBeenCalledWith(
        'error',
        expect.stringContaining('Error filtering item'),
        expect.any(String)
      );
    });
  });
});
```

### Verification Steps

1. Run new tests: `npm run test:unit -- filterResolver.enhanced.test.js`
2. Run existing filter tests: `npm run test:unit -- filterResolver.test.js`
3. Verify trace logging works correctly
4. Check error handling doesn't break filtering

### Acceptance Criteria

- [ ] Filter resolver uses enhanced evaluation contexts
- [ ] Property filtering works on non-entity items
- [ ] Multiple access patterns supported
- [ ] Error handling doesn't break entire filter
- [ ] Trace logging provides useful debugging info

---

## Ticket 2.4: Integration Testing for Enhanced Filters

**File**: `tests/integration/scopeDsl/enhancedFilters.test.js`  
**Time Estimate**: 3 hours  
**Dependencies**: Tickets 2.1-2.3  
**Complexity**: Medium

### Description

Create comprehensive integration tests that verify the enhanced filter syntax works correctly with the complete Scope DSL engine, including real-world scenarios with clothing items.

### Implementation Details

Create complete integration test suite:

```javascript
import { describe, it, expect, beforeEach } from '@jest/globals';
import createScopeDslEngine from '../../../src/scopeDsl/engine.js';
import { createMockEntity } from '../../common/testHelpers/entityHelpers.js';
import { createTestDependencies } from '../../common/testHelpers/dependencyHelpers.js';

describe('Enhanced Filter Syntax - Integration Tests', () => {
  let engine;
  let actorEntity;
  let runtimeCtx;
  let mockComponentRegistry;

  beforeEach(() => {
    const deps = createTestDependencies();
    engine = createScopeDslEngine(deps);

    // Create actor with clothing
    actorEntity = createMockEntity('test:actor', {
      'clothing:wearing': {
        slots: {
          'torso:upper': {
            items: ['leather_jacket', 'tshirt'],
            topmost: 'leather_jacket',
          },
          'torso:lower': {
            items: ['jeans'],
            topmost: 'jeans',
          },
          feet: {
            items: ['boots'],
            topmost: 'boots',
          },
        },
      },
      'inventory:items': {
        items: ['sword1', 'potion1', 'spare_shirt'],
      },
    });

    // Mock component registry with item definitions
    mockComponentRegistry = {
      getItemComponents: (itemId) => {
        const items = {
          leather_jacket: {
            'core:tags': { tags: ['waterproof', 'armor', 'outer'] },
            'clothing:material': { type: 'leather', quality: 'high' },
            'clothing:armor': {
              rating: 8,
              protection: { physical: 8, magical: 2 },
            },
            'clothing:wearable': { slots: ['torso:upper'], layer: 'outer' },
          },
          tshirt: {
            'core:tags': { tags: ['casual', 'base'] },
            'clothing:material': { type: 'cotton', quality: 'normal' },
            'clothing:wearable': { slots: ['torso:upper'], layer: 'base' },
          },
          jeans: {
            'core:tags': { tags: ['casual', 'durable'] },
            'clothing:material': { type: 'denim', quality: 'normal' },
            'clothing:wearable': { slots: ['torso:lower'], layer: 'base' },
          },
          boots: {
            'core:tags': { tags: ['waterproof', 'durable', 'armor'] },
            'clothing:material': { type: 'leather', quality: 'high' },
            'clothing:armor': {
              rating: 3,
              protection: { physical: 3, magical: 0 },
            },
            'clothing:wearable': { slots: ['feet'], layer: 'outer' },
          },
          spare_shirt: {
            'core:tags': { tags: ['casual', 'clean'] },
            'clothing:material': { type: 'cotton', quality: 'normal' },
            'clothing:condition': { durability: 100, dirty: false },
          },
          sword1: {
            'core:tags': { tags: ['weapon', 'metal'] },
            'weapon:stats': { damage: 10, type: 'slashing' },
          },
          potion1: {
            'core:tags': { tags: ['consumable', 'healing'] },
            'consumable:effects': { healing: 50 },
          },
        };
        return items[itemId] || null;
      },
    };

    // Mock entity manager
    const entityManager = {
      getEntity: (id) => {
        if (id === actorEntity.id) return actorEntity;
        return null;
      },
    };

    runtimeCtx = {
      entityManager,
      componentRegistry: mockComponentRegistry,
    };
  });

  describe('Basic property filtering', () => {
    it('should filter clothing by tags', () => {
      const expression =
        'actor.all_clothing[][{"in": ["waterproof", {"var": "tags"}]}]';
      const ast = engine.parse(expression);
      const result = engine.resolve(ast, actorEntity, runtimeCtx);

      expect(Array.from(result).sort()).toEqual(['boots', 'leather_jacket']);
    });

    it('should filter by material type', () => {
      const expression =
        'actor.all_clothing[][{"==": [{"var": "components.clothing:material.type"}, "leather"]}]';
      const ast = engine.parse(expression);
      const result = engine.resolve(ast, actorEntity, runtimeCtx);

      expect(Array.from(result).sort()).toEqual(['boots', 'leather_jacket']);
    });

    it('should filter by armor rating', () => {
      const expression =
        'actor.all_clothing[][{">": [{"var": "components.clothing:armor.rating"}, 5]}]';
      const ast = engine.parse(expression);
      const result = engine.resolve(ast, actorEntity, runtimeCtx);

      expect(Array.from(result)).toEqual(['leather_jacket']);
    });
  });

  describe('Complex property filtering', () => {
    it('should support nested property access', () => {
      const expression =
        'actor.all_clothing[][{">": [{"var": "components.clothing:armor.protection.physical"}, 5]}]';
      const ast = engine.parse(expression);
      const result = engine.resolve(ast, actorEntity, runtimeCtx);

      expect(Array.from(result)).toEqual(['leather_jacket']);
    });

    it('should support AND conditions', () => {
      const expression = `actor.all_clothing[][{
        "and": [
          {"in": ["armor", {"var": "tags"}]},
          {"==": [{"var": "components.clothing:material.type"}, "leather"]}
        ]
      }]`;
      const ast = engine.parse(expression);
      const result = engine.resolve(ast, actorEntity, runtimeCtx);

      expect(Array.from(result).sort()).toEqual(['boots', 'leather_jacket']);
    });

    it('should support OR conditions', () => {
      const expression = `actor.all_clothing[][{
        "or": [
          {"in": ["waterproof", {"var": "tags"}]},
          {"==": [{"var": "quality"}, "high"]}
        ]
      }]`;
      const ast = engine.parse(expression);
      const result = engine.resolve(ast, actorEntity, runtimeCtx);

      expect(Array.from(result).sort()).toEqual(['boots', 'leather_jacket']);
    });
  });

  describe('Specific clothing slot filtering', () => {
    it('should filter topmost clothing by properties', () => {
      const expression =
        'actor.topmost_clothing[][{"in": ["outer", {"var": "tags"}]}]';
      const ast = engine.parse(expression);
      const result = engine.resolve(ast, actorEntity, runtimeCtx);

      expect(Array.from(result)).toEqual(['leather_jacket']);
    });

    it('should filter specific slot with properties', () => {
      const expression =
        'actor.topmost_clothing.torso_upper[{"in": ["armor", {"var": "tags"}]}]';
      const ast = engine.parse(expression);
      const result = engine.resolve(ast, actorEntity, runtimeCtx);

      expect(Array.from(result)).toEqual(['leather_jacket']);
    });
  });

  describe('Combined with union operator', () => {
    it('should filter united results', () => {
      const expression =
        '(actor.topmost_clothing.torso_upper | actor.topmost_clothing.feet)[{"in": ["waterproof", {"var": "tags"}]}]';
      const ast = engine.parse(expression);
      const result = engine.resolve(ast, actorEntity, runtimeCtx);

      expect(Array.from(result).sort()).toEqual(['boots', 'leather_jacket']);
    });
  });

  describe('Inventory filtering', () => {
    it('should filter inventory items by type', () => {
      const expression =
        'actor.inventory[][{"in": ["weapon", {"var": "tags"}]}]';
      const ast = engine.parse(expression);
      const result = engine.resolve(ast, actorEntity, runtimeCtx);

      expect(Array.from(result)).toEqual(['sword1']);
    });

    it('should filter all items by property', () => {
      const expression = '(actor.inventory | actor.all_clothing)[]';
      const ast = engine.parse(expression);
      const result = engine.resolve(ast, actorEntity, runtimeCtx);

      expect(result.size).toBe(7); // All items combined
    });
  });

  describe('Edge cases', () => {
    it('should handle missing properties gracefully', () => {
      const expression =
        'actor.all_clothing[][{"==": [{"var": "nonexistent"}, "value"]}]';
      const ast = engine.parse(expression);
      const result = engine.resolve(ast, actorEntity, runtimeCtx);

      expect(Array.from(result)).toEqual([]);
    });

    it('should handle null/undefined in filters', () => {
      const expression =
        'actor.all_clothing[][{"!=": [{"var": "components.clothing:condition.dirty"}, null]}]';
      const ast = engine.parse(expression);
      const result = engine.resolve(ast, actorEntity, runtimeCtx);

      // Only spare_shirt has condition component
      expect(Array.from(result)).toEqual(['spare_shirt']);
    });

    it('should handle empty parent results', () => {
      actorEntity.components.set('clothing:wearing', { slots: {} });

      const expression =
        'actor.all_clothing[][{"in": ["armor", {"var": "tags"}]}]';
      const ast = engine.parse(expression);
      const result = engine.resolve(ast, actorEntity, runtimeCtx);

      expect(Array.from(result)).toEqual([]);
    });
  });

  describe('Performance with large datasets', () => {
    it('should handle filtering large clothing collections efficiently', () => {
      // Create actor with many clothing items
      const manyItems = Array.from({ length: 100 }, (_, i) => `item${i}`);
      actorEntity.components.set('inventory:items', { items: manyItems });

      // Mock components for all items
      mockComponentRegistry.getItemComponents = (itemId) => {
        const num = parseInt(itemId.replace('item', ''));
        return {
          'core:tags': {
            tags: num % 2 === 0 ? ['even', 'test'] : ['odd', 'test'],
          },
          'test:data': { value: num },
        };
      };

      const start = Date.now();
      const expression = 'actor.inventory[][{"in": ["even", {"var": "tags"}]}]';
      const ast = engine.parse(expression);
      const result = engine.resolve(ast, actorEntity, runtimeCtx);
      const duration = Date.now() - start;

      expect(result.size).toBe(50); // Half the items
      expect(duration).toBeLessThan(100); // Should be fast
    });
  });

  describe('Real-world scenarios', () => {
    it('should find all protective outer clothing', () => {
      const expression = `actor.all_clothing[][{
        "and": [
          {"in": ["armor", {"var": "tags"}]},
          {"==": [{"var": "components.clothing:wearable.layer"}, "outer"]}
        ]
      }]`;
      const ast = engine.parse(expression);
      const result = engine.resolve(ast, actorEntity, runtimeCtx);

      expect(Array.from(result).sort()).toEqual(['boots', 'leather_jacket']);
    });

    it('should find high-quality items', () => {
      const expression = `(actor.all_clothing | actor.inventory)[][{
        "==": [{"var": "components.clothing:material.quality"}, "high"]
      }]`;
      const ast = engine.parse(expression);
      const result = engine.resolve(ast, actorEntity, runtimeCtx);

      expect(Array.from(result).sort()).toEqual(['boots', 'leather_jacket']);
    });

    it('should support condition-based filtering', () => {
      // Add some dirty items
      mockComponentRegistry.getItemComponents = (itemId) => {
        const baseComponents = {
          tshirt: {
            'core:tags': { tags: ['casual', 'base'] },
            'clothing:condition': { durability: 80, dirty: true },
          },
          spare_shirt: {
            'core:tags': { tags: ['casual', 'clean'] },
            'clothing:condition': { durability: 100, dirty: false },
          },
        };
        return baseComponents[itemId] || null;
      };

      const expression =
        'actor.all_clothing[][{"==": [{"var": "components.clothing:condition.dirty"}, false]}]';
      const ast = engine.parse(expression);
      const result = engine.resolve(ast, actorEntity, runtimeCtx);

      expect(Array.from(result)).toEqual(['spare_shirt']);
    });
  });
});
```

### Additional Test File for Error Cases

Create `tests/integration/scopeDsl/enhancedFilters.errors.test.js`:

```javascript
import { describe, it, expect, beforeEach } from '@jest/globals';
import createScopeDslEngine from '../../../src/scopeDsl/engine.js';

describe('Enhanced Filters - Error Handling', () => {
  let engine;
  let actorEntity;
  let runtimeCtx;

  beforeEach(() => {
    engine = createScopeDslEngine({
      logger: { debug: jest.fn(), error: jest.fn() },
    });

    actorEntity = {
      id: 'actor1',
      components: new Map([['test:data', { items: ['item1'] }]]),
    };

    runtimeCtx = {
      entityManager: { getEntity: () => null },
      componentRegistry: {
        getItemComponents: () => {
          throw new Error('Registry error');
        },
      },
    };
  });

  it('should handle component lookup errors gracefully', () => {
    const expression = 'actor.items[][{"==": [{"var": "type"}, "test"]}]';
    const ast = engine.parse(expression);

    // Should not throw, but return empty set
    const result = engine.resolve(ast, actorEntity, runtimeCtx);
    expect(result).toBeInstanceOf(Set);
    expect(result.size).toBe(0);
  });

  it('should handle malformed filter expressions', () => {
    const expression = 'actor.items[][{"invalid": "filter"}]';
    const ast = engine.parse(expression);

    // JSON Logic should handle gracefully
    const result = engine.resolve(ast, actorEntity, runtimeCtx);
    expect(result).toBeInstanceOf(Set);
  });
});
```

### Verification Steps

1. Run integration tests: `npm run test:integration -- enhancedFilters.test.js`
2. Run error handling tests: `npm run test:integration -- enhancedFilters.errors.test.js`
3. Verify all scenarios pass
4. Check performance tests complete quickly
5. Ensure real-world examples work correctly

### Acceptance Criteria

- [ ] Property filtering works in complete engine
- [ ] Complex filters with AND/OR work correctly
- [ ] Clothing-specific scenarios validated
- [ ] Union + filter combinations work
- [ ] Performance acceptable for large datasets
- [ ] Error handling doesn't break resolution

---

## Ticket 2.5: Documentation for Enhanced Filters

**Files**: Multiple documentation files  
**Time Estimate**: 2 hours  
**Dependencies**: Tickets 2.1-2.4  
**Complexity**: Low

### Description

Create comprehensive documentation for the enhanced filter syntax, including examples, patterns, and migration guide.

### Implementation Details

#### Create Enhanced Filter Guide

Create file: `docs/scope-dsl-filters.md`

````markdown
# Scope DSL Enhanced Filter Syntax

## Overview

The Scope DSL now supports property-based filtering on any resolved items, not just entities. This enables powerful queries on clothing items, inventory items, and other non-entity data.

## Basic Syntax

```scope
scope_expression[filter_expression]
```
````

The filter expression uses JSON Logic syntax to evaluate properties of each item in the scope result.

## Property Access Patterns

### 1. Direct Property Access (Flattened)

For simple property access, use the flattened property name:

```scope
# Access 'tags' property directly
actor.all_clothing[][{"in": ["waterproof", {"var": "tags"}]}]

# Access 'type' property
actor.inventory[][{"==": [{"var": "type"}, "weapon"]}]
```

### 2. Component-Based Access

For explicit component access, use the full path:

```scope
# Access tags through component
actor.all_clothing[][{"in": ["armor", {"var": "components.core:tags.tags"}]}]

# Access nested properties
actor.all_clothing[][{">": [{"var": "components.clothing:armor.protection.physical"}, 5]}]
```

### 3. Safe Property Access

When properties might not exist, use default values:

```scope
# Will not fail if property is missing
actor.items[][{"==": [{"var": ["quality", "normal"]}, "high"]}]
```

## Common Patterns

### Filtering Clothing by Properties

```scope
# Find all waterproof clothing
waterproof_gear := actor.all_clothing[][{"in": ["waterproof", {"var": "tags"}]}]

# Find armor with high protection
strong_armor := actor.all_clothing[][{">": [{"var": "components.clothing:armor.rating"}, 7]}]

# Find leather items
leather_items := actor.all_clothing[][{"==": [{"var": "components.clothing:material.type"}, "leather"]}]

# Find dirty clothes
dirty_clothes := actor.all_clothing[][{"==": [{"var": "components.clothing:condition.dirty"}, true]}]
```

### Complex Conditions

```scope
# AND conditions - protective outer wear
protective_outer := actor.all_clothing[][{
  "and": [
    {"in": ["armor", {"var": "tags"}]},
    {"==": [{"var": "components.clothing:wearable.layer"}, "outer"]}
  ]
}]

# OR conditions - waterproof or high-quality
premium_items := actor.all_clothing[][{
  "or": [
    {"in": ["waterproof", {"var": "tags"}]},
    {"==": [{"var": "quality"}, "high"]}
  ]
}]

# Nested conditions
special_armor := actor.all_clothing[][{
  "and": [
    {"in": ["armor", {"var": "tags"}]},
    {
      "or": [
        {">": [{"var": "components.clothing:armor.rating"}, 8]},
        {"in": ["magical", {"var": "tags"}]}
      ]
    }
  ]
}]
```

### Combining with Unions

```scope
# Filter combined results from multiple sources
all_protective := (actor.equipped | actor.inventory)[][{"in": ["armor", {"var": "tags"}]}]

# Union specific slots then filter
upper_lower_armor := (actor.topmost_clothing.torso_upper | actor.topmost_clothing.torso_lower)[][{
  "in": ["armor", {"var": "tags"}]
}]
```

## Property Reference

### Common Clothing Properties

```javascript
{
  // Core properties (flattened access)
  "tags": ["array", "of", "tags"],           // var: "tags"
  "type": "material_type",                   // var: "type"
  "quality": "quality_level",                // var: "quality"
  "layer": "clothing_layer",                 // var: "layer"
  "rating": 10,                              // var: "rating"

  // Component-based access
  "components": {
    "core:tags": {
      "tags": ["array", "of", "tags"]        // var: "components.core:tags.tags"
    },
    "clothing:material": {
      "type": "leather",                     // var: "components.clothing:material.type"
      "quality": "high"                      // var: "components.clothing:material.quality"
    },
    "clothing:armor": {
      "rating": 10,                          // var: "components.clothing:armor.rating"
      "protection": {
        "physical": 8,                       // var: "components.clothing:armor.protection.physical"
        "magical": 2                         // var: "components.clothing:armor.protection.magical"
      }
    },
    "clothing:condition": {
      "durability": 80,                      // var: "components.clothing:condition.durability"
      "dirty": false                         // var: "components.clothing:condition.dirty"
    }
  }
}
```

## JSON Logic Operators

### Comparison Operators

- `==` - Equals
- `!=` - Not equals
- `>` - Greater than
- `>=` - Greater than or equal
- `<` - Less than
- `<=` - Less than or equal

### Array Operators

- `in` - Check if value is in array
- `all` - All elements match condition
- `some` - At least one element matches

### Logical Operators

- `and` - All conditions must be true
- `or` - At least one condition must be true
- `!` - Negation
- `!!` - Double negation (convert to boolean)

### Special Operators

- `var` - Access variable/property
- `if` - Conditional logic
- `map` - Transform array
- `filter` - Filter array
- `reduce` - Reduce array

## Migration Guide

### Before (Entity-Only Filtering)

```scope
# Limited to entity properties only
actor.followers[{"==": [{"var": "faction"}, "player"]}]
```

### After (Enhanced Property Filtering)

```scope
# Can now filter any items by their properties
actor.all_clothing[][{"in": ["armor", {"var": "tags"}]}]
actor.inventory[][{"==": [{"var": "type"}, "weapon"]}]
```

### Key Differences

1. **Evaluation Context**: Filters now create appropriate contexts for any item type
2. **Property Access**: Both flattened and component-based access supported
3. **Non-Entity Items**: Can filter clothing IDs, item IDs, and other non-entity results
4. **Backward Compatible**: All existing entity filters continue to work

## Performance Considerations

1. **Property Access**: Flattened properties are slightly faster than component paths
2. **Complex Conditions**: AND/OR conditions are evaluated lazily (short-circuit)
3. **Large Collections**: Filters scale linearly with collection size
4. **Caching**: Component lookups are cached within a resolution cycle

## Troubleshooting

### Filter Returns Empty Set

1. Check property names match exactly
2. Verify items have the expected components
3. Use trace logging to debug: `game.debug.scopeDsl = true`

### Property Not Found

1. Check both flattened and component-based access
2. Verify component namespace is correct (e.g., `clothing:material` not `material`)
3. Use default values for optional properties

### Type Mismatches

1. JSON Logic is strict about types
2. Numbers and strings are not automatically converted
3. Use explicit type conversion if needed

## Examples

### Complete Example: Finding Suitable Armor

```scope
# Find all armor pieces that provide good protection and are in good condition
suitable_armor := actor.all_clothing[][{
  "and": [
    {"in": ["armor", {"var": "tags"}]},
    {">": [{"var": "components.clothing:armor.rating"}, 5]},
    {">": [{"var": "components.clothing:condition.durability"}, 50]},
    {"==": [{"var": "components.clothing:condition.dirty"}, false]}
  ]
}]

# Find the best piece (would need additional logic for sorting)
best_armor := suitable_armor[][{
  "==": [
    {"var": "components.clothing:armor.rating"},
    {"max": {"map": [
      {"var": "suitable_armor"},
      {"var": "components.clothing:armor.rating"}
    ]}}
  ]
}]
```

### Finding Matching Outfits

```scope
# Find all black leather items
black_leather := actor.all_clothing[][{
  "and": [
    {"==": [{"var": "components.clothing:material.type"}, "leather"]},
    {"in": ["black", {"var": "components.clothing:appearance.colors"}]}
  ]
}]

# Find complete formal outfit
formal_wear := actor.all_clothing[][{
  "in": ["formal", {"var": "tags"}]
}]
```

````

#### Update API Reference

Add to `docs/api-reference.md`:

```markdown
## Filter Resolver API

### Enhanced Evaluation Context

The filter resolver now creates evaluation contexts for any item type:

```javascript
// Entity context (existing)
{
  id: "entity_id",
  components: { /* entity components */ },
  actor: { /* actor context */ },
  location: { /* location context */ }
}

// Item context (new)
{
  id: "item_id",
  type: "item",
  components: { /* item components */ },
  // Flattened properties for easy access
  tags: ["tag1", "tag2"],
  quality: "high",
  // ... other flattened properties
  actor: { /* actor context */ },
  location: { /* location context */ }
}
````

### Property Access Patterns

1. **Direct Access**: `{"var": "propertyName"}`
2. **Component Access**: `{"var": "components.componentId.propertyName"}`
3. **Nested Access**: `{"var": "components.componentId.nested.property"}`
4. **Safe Access**: `{"var": ["propertyName", "defaultValue"]}`

````

#### Update CLAUDE.md

Add to the Scope DSL section:

```markdown
### Enhanced Filter Syntax

Filters now support property-based filtering on any resolved items:

```scope
# Filter clothing by tags
actor.all_clothing[][{"in": ["waterproof", {"var": "tags"}]}]

# Filter by component properties
actor.inventory[][{"==": [{"var": "components.weapon:stats.damage"}, 10]}]

# Complex filters with AND/OR
actor.all_clothing[][{
  "and": [
    {"in": ["armor", {"var": "tags"}]},
    {">": [{"var": "rating"}, 5]}
  ]
}]
````

Property access supports both flattened (direct) and component-based patterns.

```

### Verification Steps
1. Review all documentation for accuracy
2. Test all code examples
3. Ensure migration guide is clear
4. Verify API reference is complete

### Acceptance Criteria
- [ ] Comprehensive filter guide created
- [ ] API reference updated
- [ ] CLAUDE.md includes new syntax
- [ ] All examples are valid and tested
- [ ] Migration path clearly explained

---

## Phase 2 Summary

### Deliverables Checklist
- [ ] Flexible evaluation context factory implemented
- [ ] Entities gateway enhanced with item lookup
- [ ] Filter resolver updated to use new contexts
- [ ] Comprehensive integration tests passing
- [ ] Documentation complete and accurate

### Test Coverage Requirements
- [ ] Unit tests for evaluation context: 95%+
- [ ] Unit tests for gateway enhancements: 90%+
- [ ] Integration tests for all scenarios: 90%+
- [ ] Edge cases and error handling: 85%+

### Final Verification
1. Run full test suite: `npm run test:ci`
2. Run linting: `npm run lint`
3. Run type checking: `npm run typecheck`
4. Manual test with example expressions
5. Verify performance impact <5%

### Time Summary
- Ticket 2.1: 3 hours (Evaluation context)
- Ticket 2.2: 2 hours (Gateway enhancement)
- Ticket 2.3: 2 hours (Filter resolver update)
- Ticket 2.4: 3 hours (Integration tests)
- Ticket 2.5: 2 hours (Documentation)
- **Total: 12 hours**

### Next Phase
Once all Phase 2 tickets are complete and verified, proceed to [Phase 3: Integration Testing & Polish](./scope-dsl-union-filter-phase3-integration-testing.workflow.md)
```
