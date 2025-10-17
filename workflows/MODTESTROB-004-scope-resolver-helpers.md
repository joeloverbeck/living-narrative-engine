# MODTESTROB-004: Scope Resolver Helper Library

**Status**: Ready for Implementation
**Priority**: P1 - Medium
**Estimated Time**: 8 hours
**Risk Level**: Low
**Phase**: 2 - Developer Experience

## Overview

Creates a comprehensive library of reusable scope resolver patterns that eliminates 90% of boilerplate code currently required for testing actions with custom scopes. Provides pre-built implementations for common scope patterns (component lookup, array filtering, relationship traversal) that can be registered with a single line of code.

## Prerequisites

- [ ] MODTESTROB-001, 002, 003 complete (Phase 1 done)
- [ ] Clean git working directory
- [ ] All existing tests passing
- [ ] Feature branch: `feature/modtest-scope-helpers`

## Problem Statement

**Current Pain Point**: Tests like `scoot_closer_action_discovery.test.js` require 50-100 lines of custom scope resolver implementation. From the recommendations document (lines 156-173):

```javascript
// Current: 50+ lines of manual scope resolver code
beforeEach(async () => {
  testFixture = await ModTestFixture.forAction(...);

  // Manual scope resolver implementation - 50+ lines
  const originalResolveSync = testEnv.unifiedScopeResolver.resolveSync;
  testEnv.unifiedScopeResolver.resolveSync = (scopeName, context) => {
    if (scopeName === 'positioning:furniture_actor_sitting_on') {
      const actorId = context?.actor?.id;
      if (!actorId) return { success: true, value: new Set() };
      const actor = testFixture.entityManager.getEntityInstance(actorId);
      const sittingOn = actor?.components?.['positioning:sitting_on'];
      if (!sittingOn || !sittingOn.furniture_id) {
        return { success: true, value: new Set() };
      }
      return { success: true, value: new Set([sittingOn.furniture_id]) };
    }
    if (scopeName === 'positioning:closest_leftmost_occupant') {
      // ... another 30 lines of complex array filtering logic ...
    }
    return originalResolveSync.call(testEnv.unifiedScopeResolver, scopeName, context);
  };
});
```

**Target State**: Register common scope resolvers with helper library (recommendations lines 783-787):
```javascript
// New: 2 lines
beforeEach(async () => {
  testFixture = await ModTestFixture.forAction(...);
  ScopeResolverHelpers.registerPositioningScopes(testFixture.testEnv);
});
```

## Detailed Steps

### Step 1: Create Scope Resolver Helper Library

**File to create**: `tests/common/mods/scopeResolverHelpers.js`

**Implementation** (based on recommendations lines 660-768):

```javascript
/**
 * @file Scope resolver helper library
 * Library of reusable scope resolver implementations
 * Eliminates need to manually implement common scope patterns
 */

/**
 * Library of reusable scope resolver implementations
 */
export class ScopeResolverHelpers {
  /**
   * Creates a resolver for "component on current entity" pattern
   * Example: "furniture the actor is sitting on"
   *
   * @param {string} scopeName - Scope identifier
   * @param {Object} config - Configuration
   * @param {string} config.componentType - Component type to query (e.g., 'positioning:sitting_on')
   * @param {string} config.sourceField - Field in component containing target entity ID
   * @param {string} [config.resultField='id'] - Field to extract from result
   * @param {string} [config.contextSource='actor'] - Context entity to use ('actor' or 'target')
   * @returns {Function} Scope resolver function
   */
  static createComponentLookupResolver(
    scopeName,
    { componentType, sourceField, resultField = 'id', contextSource = 'actor' }
  ) {
    return function (context) {
      const sourceEntity = context?.[contextSource];
      if (!sourceEntity?.id) {
        return { success: true, value: new Set() };
      }

      const component = this.entityManager.getComponentData(
        sourceEntity.id,
        componentType
      );

      if (!component || !component[sourceField]) {
        return { success: true, value: new Set() };
      }

      const resultValue =
        resultField === 'id'
          ? component[sourceField]
          : component[sourceField]?.[resultField];

      if (!resultValue) {
        return { success: true, value: new Set() };
      }

      return {
        success: true,
        value: new Set([resultValue]),
      };
    };
  }

  /**
   * Creates a resolver for "entities matching filter in array" pattern
   * Example: "closest leftmost occupant in furniture spots"
   *
   * @param {string} scopeName - Scope identifier
   * @param {Object} config - Configuration
   * @param {Function} config.getArray - Function to get array from entity/context
   * @param {Function} config.filterFn - Function to filter array items
   * @param {string} [config.contextSource='actor'] - Context entity to use
   * @returns {Function} Scope resolver function
   */
  static createArrayFilterResolver(
    scopeName,
    { getArray, filterFn, contextSource = 'actor' }
  ) {
    return function (context) {
      const sourceEntity = context?.[contextSource];
      if (!sourceEntity?.id) {
        return { success: true, value: new Set() };
      }

      const array = getArray(sourceEntity, context, this.entityManager);
      if (!Array.isArray(array)) {
        return { success: true, value: new Set() };
      }

      const matches = array.filter(item =>
        filterFn(item, sourceEntity, context, this.entityManager)
      );

      return {
        success: true,
        value: new Set(matches.filter(Boolean)),
      };
    };
  }

  /**
   * Creates a resolver for "entities at same location" pattern
   * Example: "all actors in same room"
   *
   * @param {string} scopeName - Scope identifier
   * @param {Object} config - Configuration
   * @param {Function} [config.filterFn] - Optional filter function
   * @param {string} [config.contextSource='actor'] - Context entity to use
   * @returns {Function} Scope resolver function
   */
  static createLocationMatchResolver(
    scopeName,
    { filterFn = null, contextSource = 'actor' }
  ) {
    return function (context) {
      const sourceEntity = context?.[contextSource];
      if (!sourceEntity?.id) {
        return { success: true, value: new Set() };
      }

      const sourceLocation = this.entityManager.getComponentData(
        sourceEntity.id,
        'core:position'
      );

      if (!sourceLocation?.locationId) {
        return { success: true, value: new Set() };
      }

      // Get all entities at same location
      const entitiesAtLocation = this.entityManager
        .getAllEntities()
        .filter(entityId => {
          if (entityId === sourceEntity.id) return false; // Exclude source

          const position = this.entityManager.getComponentData(
            entityId,
            'core:position'
          );
          if (position?.locationId !== sourceLocation.locationId) return false;

          // Apply optional filter
          if (filterFn) {
            return filterFn(entityId, sourceEntity, context, this.entityManager);
          }

          return true;
        });

      return {
        success: true,
        value: new Set(entitiesAtLocation),
      };
    };
  }

  /**
   * Creates a resolver for "entities with specific component" pattern
   * Example: "all actors who are sitting"
   *
   * @param {string} scopeName - Scope identifier
   * @param {Object} config - Configuration
   * @param {string} config.componentType - Component type to check for
   * @param {Function} [config.filterFn] - Optional filter function
   * @returns {Function} Scope resolver function
   */
  static createComponentFilterResolver(
    scopeName,
    { componentType, filterFn = null }
  ) {
    return function (context) {
      const entitiesWithComponent = this.entityManager
        .getAllEntities()
        .filter(entityId => {
          if (!this.entityManager.hasComponent(entityId, componentType)) {
            return false;
          }

          // Apply optional filter
          if (filterFn) {
            return filterFn(entityId, context, this.entityManager);
          }

          return true;
        });

      return {
        success: true,
        value: new Set(entitiesWithComponent),
      };
    };
  }

  /**
   * Register all positioning-related scope resolvers
   * Covers common positioning mod scopes used in tests
   */
  static registerPositioningScopes(testEnv) {
    const entityManager = testEnv.entityManager;

    const resolvers = {
      // "furniture the actor is sitting on"
      'positioning:furniture_actor_sitting_on':
        this.createComponentLookupResolver(
          'positioning:furniture_actor_sitting_on',
          {
            componentType: 'positioning:sitting_on',
            sourceField: 'furniture_id',
          }
        ),

      // "actors sitting on same furniture"
      'positioning:actors_sitting_on_same_furniture':
        this.createArrayFilterResolver(
          'positioning:actors_sitting_on_same_furniture',
          {
            getArray: (actor, context, em) => {
              const sitting = em.getComponentData(
                actor.id,
                'positioning:sitting_on'
              );
              if (!sitting) return [];

              const furniture = em.getComponentData(
                sitting.furniture_id,
                'positioning:allows_sitting'
              );
              return furniture?.spots || [];
            },
            filterFn: (entityId, actor, context, em) => {
              return entityId && entityId !== actor.id;
            },
          }
        ),

      // "closest leftmost occupant" (for scoot_closer action)
      'positioning:closest_leftmost_occupant': this.createArrayFilterResolver(
        'positioning:closest_leftmost_occupant',
        {
          getArray: (actor, context, em) => {
            const sitting = em.getComponentData(
              actor.id,
              'positioning:sitting_on'
            );
            if (!sitting) return [];

            const furniture = em.getComponentData(
              sitting.furniture_id,
              'positioning:allows_sitting'
            );
            if (!furniture?.spots) return [];

            const actorSpotIndex = sitting.spot_index;
            const leftSpots = furniture.spots.slice(0, actorSpotIndex);

            // Find rightmost occupied spot to the left
            for (let i = leftSpots.length - 1; i >= 0; i--) {
              if (leftSpots[i] && leftSpots[i] !== null) {
                return [leftSpots[i]];
              }
            }

            return [];
          },
          filterFn: (entityId, actor, context, em) => {
            return entityId && entityId !== actor.id;
          },
        }
      ),

      // "furniture pieces that allow sitting at location"
      'positioning:furniture_allowing_sitting_at_location':
        this.createLocationMatchResolver(
          'positioning:furniture_allowing_sitting_at_location',
          {
            filterFn: (entityId, source, context, em) => {
              return em.hasComponent(entityId, 'positioning:allows_sitting');
            },
          }
        ),

      // "actors who are standing at location"
      'positioning:standing_actors_at_location':
        this.createLocationMatchResolver(
          'positioning:standing_actors_at_location',
          {
            filterFn: (entityId, source, context, em) => {
              if (!em.hasComponent(entityId, 'core:actor')) return false;
              // Standing means NOT sitting, lying, or kneeling
              return (
                !em.hasComponent(entityId, 'positioning:sitting_on') &&
                !em.hasComponent(entityId, 'positioning:lying_on') &&
                !em.hasComponent(entityId, 'positioning:kneeling')
              );
            },
          }
        ),

      // "actors who are sitting"
      'positioning:sitting_actors': this.createComponentFilterResolver(
        'positioning:sitting_actors',
        {
          componentType: 'positioning:sitting_on',
        }
      ),

      // "actors who are kneeling"
      'positioning:kneeling_actors': this.createComponentFilterResolver(
        'positioning:kneeling_actors',
        {
          componentType: 'positioning:kneeling',
        }
      ),

      // "furniture actor is standing behind"
      'positioning:furniture_actor_behind': this.createComponentLookupResolver(
        'positioning:furniture_actor_behind',
        {
          componentType: 'positioning:standing_behind',
          sourceField: 'furniture_id',
        }
      ),
    };

    // Register all resolvers with proper context binding
    Object.entries(resolvers).forEach(([scopeName, resolver]) => {
      testEnv.registerScopeResolver(
        scopeName,
        resolver.bind({ entityManager })
      );
    });
  }

  /**
   * Register all inventory/items-related scope resolvers
   * Covers common items mod scopes used in tests
   */
  static registerInventoryScopes(testEnv) {
    const entityManager = testEnv.entityManager;

    const resolvers = {
      // "items in actor's inventory"
      'items:actor_inventory_items': this.createComponentLookupResolver(
        'items:actor_inventory_items',
        {
          componentType: 'items:inventory',
          sourceField: 'items',
          contextSource: 'actor',
        }
      ),

      // "items at actor's location"
      'items:items_at_location': this.createLocationMatchResolver(
        'items:items_at_location',
        {
          filterFn: (entityId, source, context, em) => {
            return em.hasComponent(entityId, 'items:item');
          },
        }
      ),

      // "portable items at location"
      'items:portable_items_at_location': this.createLocationMatchResolver(
        'items:portable_items_at_location',
        {
          filterFn: (entityId, source, context, em) => {
            return (
              em.hasComponent(entityId, 'items:item') &&
              em.hasComponent(entityId, 'items:portable')
            );
          },
        }
      ),

      // "actors at same location" (for give_item)
      'items:actors_at_location': this.createLocationMatchResolver(
        'items:actors_at_location',
        {
          filterFn: (entityId, source, context, em) => {
            return em.hasComponent(entityId, 'core:actor');
          },
        }
      ),

      // "containers at location"
      'items:containers_at_location': this.createLocationMatchResolver(
        'items:containers_at_location',
        {
          filterFn: (entityId, source, context, em) => {
            return em.hasComponent(entityId, 'items:container');
          },
        }
      ),
    };

    // Register all resolvers
    Object.entries(resolvers).forEach(([scopeName, resolver]) => {
      testEnv.registerScopeResolver(
        scopeName,
        resolver.bind({ entityManager })
      );
    });
  }

  /**
   * Register all anatomy-related scope resolvers
   * Covers common anatomy mod scopes used in tests
   */
  static registerAnatomyScopes(testEnv) {
    const entityManager = testEnv.entityManager;

    const resolvers = {
      // "actors at same location" (for anatomy interactions)
      'anatomy:actors_at_location': this.createLocationMatchResolver(
        'anatomy:actors_at_location',
        {
          filterFn: (entityId, source, context, em) => {
            return em.hasComponent(entityId, 'core:actor');
          },
        }
      ),

      // "body parts of target"
      'anatomy:target_body_parts': function (context) {
        const targetEntity = context?.target;
        if (!targetEntity?.id) {
          return { success: true, value: new Set() };
        }

        const anatomy = entityManager.getComponentData(
          targetEntity.id,
          'anatomy:body'
        );

        if (!anatomy?.parts) {
          return { success: true, value: new Set() };
        }

        // Return all body part IDs
        return {
          success: true,
          value: new Set(Object.keys(anatomy.parts)),
        };
      },
    };

    // Register all resolvers
    Object.entries(resolvers).forEach(([scopeName, resolver]) => {
      const boundResolver =
        typeof resolver === 'function' && resolver.bind
          ? resolver.bind({ entityManager })
          : resolver;
      testEnv.registerScopeResolver(scopeName, boundResolver);
    });
  }
}
```

**Validation**:
```bash
# Verify file created
test -f tests/common/mods/scopeResolverHelpers.js && echo "✓ File created"

# Check for expected exports
grep -q "export class ScopeResolverHelpers" tests/common/mods/scopeResolverHelpers.js && echo "✓ Class exported"
```

### Step 2: Create Unit Tests for Helper Patterns

**File to create**: `tests/unit/common/mods/scopeResolverHelpers.test.js`

**Implementation**:

```javascript
import { describe, it, expect, beforeEach } from '@jest/globals';
import { ScopeResolverHelpers } from '../../../common/mods/scopeResolverHelpers.js';

describe('ScopeResolverHelpers - Component Lookup Pattern', () => {
  let mockEntityManager;

  beforeEach(() => {
    mockEntityManager = {
      getComponentData: jest.fn((entityId, componentType) => {
        if (
          entityId === 'actor1' &&
          componentType === 'positioning:sitting_on'
        ) {
          return { furniture_id: 'furniture1', spot_index: 0 };
        }
        return null;
      }),
    };
  });

  it('should resolve entity from component field', () => {
    const resolver = ScopeResolverHelpers.createComponentLookupResolver(
      'test:furniture_lookup',
      {
        componentType: 'positioning:sitting_on',
        sourceField: 'furniture_id',
      }
    );

    const result = resolver.call(
      { entityManager: mockEntityManager },
      { actor: { id: 'actor1' } }
    );

    expect(result).toEqual({
      success: true,
      value: new Set(['furniture1']),
    });
  });

  it('should return empty set if component missing', () => {
    const resolver = ScopeResolverHelpers.createComponentLookupResolver(
      'test:furniture_lookup',
      {
        componentType: 'positioning:sitting_on',
        sourceField: 'furniture_id',
      }
    );

    const result = resolver.call(
      { entityManager: mockEntityManager },
      { actor: { id: 'actor_without_component' } }
    );

    expect(result).toEqual({
      success: true,
      value: new Set(),
    });
  });

  it('should return empty set if context missing', () => {
    const resolver = ScopeResolverHelpers.createComponentLookupResolver(
      'test:furniture_lookup',
      {
        componentType: 'positioning:sitting_on',
        sourceField: 'furniture_id',
      }
    );

    const result = resolver.call({ entityManager: mockEntityManager }, {});

    expect(result).toEqual({
      success: true,
      value: new Set(),
    });
  });
});

describe('ScopeResolverHelpers - Array Filter Pattern', () => {
  let mockEntityManager;

  beforeEach(() => {
    mockEntityManager = {
      getComponentData: jest.fn((entityId, componentType) => {
        if (
          entityId === 'furniture1' &&
          componentType === 'positioning:allows_sitting'
        ) {
          return { spots: ['occupant1', null, 'actor1'] };
        }
        if (
          entityId === 'actor1' &&
          componentType === 'positioning:sitting_on'
        ) {
          return { furniture_id: 'furniture1', spot_index: 2 };
        }
        return null;
      }),
    };
  });

  it('should filter array and return matches', () => {
    const resolver = ScopeResolverHelpers.createArrayFilterResolver(
      'test:array_filter',
      {
        getArray: (actor, context, em) => {
          const sitting = em.getComponentData(
            actor.id,
            'positioning:sitting_on'
          );
          const furniture = em.getComponentData(
            sitting.furniture_id,
            'positioning:allows_sitting'
          );
          return furniture?.spots || [];
        },
        filterFn: (entityId, actor, context, em) => {
          return entityId && entityId !== actor.id;
        },
      }
    );

    const result = resolver.call(
      { entityManager: mockEntityManager },
      { actor: { id: 'actor1' } }
    );

    expect(result).toEqual({
      success: true,
      value: new Set(['occupant1']), // Filters out null and actor1
    });
  });

  it('should return empty set if getArray returns empty', () => {
    const resolver = ScopeResolverHelpers.createArrayFilterResolver(
      'test:array_filter',
      {
        getArray: () => [],
        filterFn: () => true,
      }
    );

    const result = resolver.call(
      { entityManager: mockEntityManager },
      { actor: { id: 'actor1' } }
    );

    expect(result).toEqual({
      success: true,
      value: new Set(),
    });
  });
});

describe('ScopeResolverHelpers - Location Match Pattern', () => {
  let mockEntityManager;

  beforeEach(() => {
    mockEntityManager = {
      getComponentData: jest.fn((entityId, componentType) => {
        if (componentType === 'core:position') {
          if (entityId === 'actor1' || entityId === 'actor2') {
            return { locationId: 'room1' };
          }
          if (entityId === 'actor3') {
            return { locationId: 'room2' };
          }
        }
        return null;
      }),
      getAllEntities: jest.fn(() => ['actor1', 'actor2', 'actor3']),
    };
  });

  it('should return entities at same location', () => {
    const resolver = ScopeResolverHelpers.createLocationMatchResolver(
      'test:same_location',
      {}
    );

    const result = resolver.call(
      { entityManager: mockEntityManager },
      { actor: { id: 'actor1' } }
    );

    expect(result).toEqual({
      success: true,
      value: new Set(['actor2']), // actor3 is in different room
    });
  });

  it('should apply optional filter', () => {
    mockEntityManager.hasComponent = jest.fn(
      (entityId, componentType) => {
        if (
          componentType === 'core:actor' &&
          (entityId === 'actor1' || entityId === 'actor2')
        ) {
          return true;
        }
        return false;
      }
    );

    const resolver = ScopeResolverHelpers.createLocationMatchResolver(
      'test:actors_at_location',
      {
        filterFn: (entityId, source, context, em) => {
          return em.hasComponent(entityId, 'core:actor');
        },
      }
    );

    const result = resolver.call(
      { entityManager: mockEntityManager },
      { actor: { id: 'actor1' } }
    );

    expect(result).toEqual({
      success: true,
      value: new Set(['actor2']),
    });
  });
});

describe('ScopeResolverHelpers - Component Filter Pattern', () => {
  let mockEntityManager;

  beforeEach(() => {
    mockEntityManager = {
      getAllEntities: jest.fn(() => ['actor1', 'actor2', 'actor3']),
      hasComponent: jest.fn((entityId, componentType) => {
        if (componentType === 'positioning:sitting_on') {
          return entityId === 'actor1' || entityId === 'actor2';
        }
        return false;
      }),
    };
  });

  it('should return entities with specific component', () => {
    const resolver = ScopeResolverHelpers.createComponentFilterResolver(
      'test:sitting_actors',
      {
        componentType: 'positioning:sitting_on',
      }
    );

    const result = resolver.call(
      { entityManager: mockEntityManager },
      {}
    );

    expect(result).toEqual({
      success: true,
      value: new Set(['actor1', 'actor2']),
    });
  });

  it('should apply optional filter', () => {
    const resolver = ScopeResolverHelpers.createComponentFilterResolver(
      'test:filtered_sitting_actors',
      {
        componentType: 'positioning:sitting_on',
        filterFn: (entityId, context, em) => {
          return entityId === 'actor1'; // Only actor1
        },
      }
    );

    const result = resolver.call(
      { entityManager: mockEntityManager },
      {}
    );

    expect(result).toEqual({
      success: true,
      value: new Set(['actor1']),
    });
  });
});
```

**Validation**:
```bash
# Run unit tests
npm run test:unit -- tests/unit/common/mods/scopeResolverHelpers.test.js

# Expected: All tests pass with 100% coverage
```

### Step 3: Create Integration Tests

**File to create**: `tests/integration/common/mods/scopeResolverHelpersIntegration.test.js`

**Implementation**:

```javascript
import { describe, it, expect, beforeEach, afterEach } from '@jest/globals';
import { ModTestFixture } from '../../../common/mods/ModTestFixture.js';
import { ModEntityBuilder } from '../../../common/mods/ModEntityBuilder.js';
import { ScopeResolverHelpers } from '../../../common/mods/scopeResolverHelpers.js';

describe('ScopeResolverHelpers Integration - Positioning Scopes', () => {
  let testFixture;

  beforeEach(async () => {
    testFixture = await ModTestFixture.forAction(
      'positioning',
      'positioning:scoot_closer',
      null,
      null
    );

    // Register positioning scopes
    ScopeResolverHelpers.registerPositioningScopes(testFixture.testEnv);
  });

  afterEach(() => {
    testFixture.cleanup();
  });

  it('should resolve furniture_actor_sitting_on scope', async () => {
    const room = new ModEntityBuilder('room1')
      .asRoom('Test Room')
      .build();
    const furniture = new ModEntityBuilder('furniture1')
      .withName('bench')
      .atLocation('room1')
      .withComponent('positioning:allows_sitting', {
        spots: ['actor1'],
      })
      .build();
    const actor = new ModEntityBuilder('actor1')
      .withName('Alice')
      .atLocation('room1')
      .asActor()
      .withComponent('positioning:sitting_on', {
        furniture_id: 'furniture1',
        spot_index: 0,
      })
      .build();

    testFixture.reset([room, furniture, actor]);

    // Test scope resolution
    const result = testFixture.testEnv.unifiedScopeResolver.resolveSync(
      'positioning:furniture_actor_sitting_on',
      { actor: { id: 'actor1' } }
    );

    expect(result.success).toBe(true);
    expect(result.value).toEqual(new Set(['furniture1']));
  });

  it('should resolve closest_leftmost_occupant scope', async () => {
    const room = new ModEntityBuilder('room1')
      .asRoom('Test Room')
      .build();
    const furniture = new ModEntityBuilder('furniture1')
      .withName('bench')
      .atLocation('room1')
      .withComponent('positioning:allows_sitting', {
        spots: ['occupant1', null, 'actor1'],
      })
      .build();
    const occupant1 = new ModEntityBuilder('occupant1')
      .withName('Bob')
      .atLocation('room1')
      .asActor()
      .withComponent('positioning:sitting_on', {
        furniture_id: 'furniture1',
        spot_index: 0,
      })
      .build();
    const actor = new ModEntityBuilder('actor1')
      .withName('Alice')
      .atLocation('room1')
      .asActor()
      .withComponent('positioning:sitting_on', {
        furniture_id: 'furniture1',
        spot_index: 2,
      })
      .build();

    testFixture.reset([room, furniture, occupant1, actor]);

    // Test scope resolution
    const result = testFixture.testEnv.unifiedScopeResolver.resolveSync(
      'positioning:closest_leftmost_occupant',
      { actor: { id: 'actor1' } }
    );

    expect(result.success).toBe(true);
    expect(result.value).toEqual(new Set(['occupant1']));
  });

  it('should resolve sitting_actors scope', async () => {
    const room = new ModEntityBuilder('room1')
      .asRoom('Test Room')
      .build();
    const furniture = new ModEntityBuilder('furniture1')
      .withName('bench')
      .atLocation('room1')
      .withComponent('positioning:allows_sitting', {
        spots: ['actor1', 'actor2'],
      })
      .build();
    const actor1 = new ModEntityBuilder('actor1')
      .withName('Alice')
      .atLocation('room1')
      .asActor()
      .withComponent('positioning:sitting_on', {
        furniture_id: 'furniture1',
        spot_index: 0,
      })
      .build();
    const actor2 = new ModEntityBuilder('actor2')
      .withName('Bob')
      .atLocation('room1')
      .asActor()
      .withComponent('positioning:sitting_on', {
        furniture_id: 'furniture1',
        spot_index: 1,
      })
      .build();
    const actor3 = new ModEntityBuilder('actor3')
      .withName('Charlie')
      .atLocation('room1')
      .asActor()
      .build();

    testFixture.reset([room, furniture, actor1, actor2, actor3]);

    // Test scope resolution
    const result = testFixture.testEnv.unifiedScopeResolver.resolveSync(
      'positioning:sitting_actors',
      {}
    );

    expect(result.success).toBe(true);
    expect(result.value).toEqual(new Set(['actor1', 'actor2']));
  });
});

describe('ScopeResolverHelpers Integration - Inventory Scopes', () => {
  let testFixture;

  beforeEach(async () => {
    testFixture = await ModTestFixture.forAction(
      'items',
      'items:pick_up_item',
      null,
      null
    );

    // Register inventory scopes
    ScopeResolverHelpers.registerInventoryScopes(testFixture.testEnv);
  });

  afterEach(() => {
    testFixture.cleanup();
  });

  it('should resolve portable_items_at_location scope', async () => {
    const room = new ModEntityBuilder('room1')
      .asRoom('Test Room')
      .build();
    const item1 = new ModEntityBuilder('item1')
      .withName('key')
      .atLocation('room1')
      .withComponent('items:item', {})
      .withComponent('items:portable', {})
      .build();
    const item2 = new ModEntityBuilder('item2')
      .withName('heavy box')
      .atLocation('room1')
      .withComponent('items:item', {})
      // No portable component
      .build();
    const actor = new ModEntityBuilder('actor1')
      .withName('Alice')
      .atLocation('room1')
      .asActor()
      .build();

    testFixture.reset([room, item1, item2, actor]);

    // Test scope resolution
    const result = testFixture.testEnv.unifiedScopeResolver.resolveSync(
      'items:portable_items_at_location',
      { actor: { id: 'actor1' } }
    );

    expect(result.success).toBe(true);
    expect(result.value).toEqual(new Set(['item1'])); // Only portable item
  });
});
```

**Validation**:
```bash
# Run integration tests
npm run test:integration -- tests/integration/common/mods/scopeResolverHelpersIntegration.test.js

# Expected: All tests pass
```

### Step 4: Convert Existing Test to Use Helpers

**File to modify**: `tests/integration/mods/positioning/scoot_closer_action_discovery.test.js`

**Before** (lines 1-80 of existing file with manual scope resolvers):
```javascript
beforeEach(async () => {
  testFixture = await ModTestFixture.forAction(
    'positioning',
    'positioning:scoot_closer',
    handleScootCloserRule,
    eventIsActionScootCloser
  );

  // Manual scope resolver implementation - 50+ lines
  const { testEnv } = testFixture;
  const originalResolveSync = testEnv.unifiedScopeResolver.resolveSync;
  testEnv.unifiedScopeResolver.resolveSync = (scopeName, context) => {
    if (scopeName === 'positioning:furniture_actor_sitting_on') {
      const actorId = context?.actor?.id;
      if (!actorId) return { success: true, value: new Set() };
      const actor = testFixture.entityManager.getEntityInstance(actorId);
      const sittingOn = actor?.components?.['positioning:sitting_on'];
      if (!sittingOn || !sittingOn.furniture_id) {
        return { success: true, value: new Set() };
      }
      return { success: true, value: new Set([sittingOn.furniture_id]) };
    }
    if (scopeName === 'positioning:closest_leftmost_occupant') {
      // ... another 30 lines ...
    }
    return originalResolveSync.call(testEnv.unifiedScopeResolver, scopeName, context);
  };
});
```

**After** (with helpers):
```javascript
import { ScopeResolverHelpers } from '../../../common/mods/scopeResolverHelpers.js';

beforeEach(async () => {
  testFixture = await ModTestFixture.forAction(
    'positioning',
    'positioning:scoot_closer',
    handleScootCloserRule,
    eventIsActionScootCloser
  );

  // Register positioning scopes - 1 line replaces 50+
  ScopeResolverHelpers.registerPositioningScopes(testFixture.testEnv);
});
```

**Validation**:
```bash
# Run converted test
npm run test:integration -- tests/integration/mods/positioning/scoot_closer_action_discovery.test.js

# Expected: Test still passes with helpers
```

### Step 5: Convert Additional Tests

**Files to modify** (same pattern as Step 4):
1. `tests/integration/mods/positioning/hold_hand_action_discovery.test.js`
2. `tests/integration/mods/positioning/sit_down_action_discovery.test.js`
3. `tests/integration/mods/items/pick_up_item_action_discovery.test.js`
4. `tests/integration/mods/items/give_item_action_discovery.test.js`

**For each file**:
1. Add import: `import { ScopeResolverHelpers } from '../../../common/mods/scopeResolverHelpers.js';`
2. Replace manual scope resolver code with:
   - Positioning tests: `ScopeResolverHelpers.registerPositioningScopes(testFixture.testEnv);`
   - Inventory tests: `ScopeResolverHelpers.registerInventoryScopes(testFixture.testEnv);`

**Validation**:
```bash
# Run all converted tests
npm run test:integration -- tests/integration/mods/positioning/hold_hand_action_discovery.test.js
npm run test:integration -- tests/integration/mods/positioning/sit_down_action_discovery.test.js
npm run test:integration -- tests/integration/mods/items/pick_up_item_action_discovery.test.js
npm run test:integration -- tests/integration/mods/items/give_item_action_discovery.test.js

# Expected: All tests pass
```

### Step 6: Add Helper Method to ModTestFixture (Optional Enhancement)

**File to modify**: `tests/common/mods/ModTestFixture.js`

**Add convenience method**:
```javascript
import { ScopeResolverHelpers } from './scopeResolverHelpers.js';

class ModTestFixture {
  // ... existing code ...

  /**
   * Register scope resolvers for a mod category
   * @param {string} category - 'positioning', 'inventory', 'anatomy'
   */
  registerScopeHelpers(category) {
    switch (category) {
      case 'positioning':
        ScopeResolverHelpers.registerPositioningScopes(this.testEnv);
        break;
      case 'inventory':
        ScopeResolverHelpers.registerInventoryScopes(this.testEnv);
        break;
      case 'anatomy':
        ScopeResolverHelpers.registerAnatomyScopes(this.testEnv);
        break;
      default:
        throw new Error(`Unknown scope helper category: ${category}`);
    }
  }
}
```

**Alternative usage in tests**:
```javascript
beforeEach(async () => {
  testFixture = await ModTestFixture.forAction(...);
  testFixture.registerScopeHelpers('positioning');
});
```

## Validation Criteria

### Functionality Checklist

- [ ] scopeResolverHelpers.js created with all patterns
- [ ] createComponentLookupResolver() implemented
- [ ] createArrayFilterResolver() implemented
- [ ] createLocationMatchResolver() implemented
- [ ] createComponentFilterResolver() implemented
- [ ] registerPositioningScopes() implemented (8 scopes)
- [ ] registerInventoryScopes() implemented (5 scopes)
- [ ] registerAnatomyScopes() implemented (2 scopes)
- [ ] Unit tests pass with 100% coverage
- [ ] Integration tests demonstrate real usage
- [ ] 5 existing tests converted successfully
- [ ] All converted tests still pass

### Quality Standards

```bash
# All new tests pass
npm run test:unit -- tests/unit/common/mods/scopeResolverHelpers.test.js
npm run test:integration -- tests/integration/common/mods/scopeResolverHelpersIntegration.test.js

# All converted tests pass
npm run test:integration -- tests/integration/mods/positioning/scoot_closer_action_discovery.test.js
npm run test:integration -- tests/integration/mods/positioning/hold_hand_action_discovery.test.js
npm run test:integration -- tests/integration/mods/positioning/sit_down_action_discovery.test.js
npm run test:integration -- tests/integration/mods/items/pick_up_item_action_discovery.test.js
npm run test:integration -- tests/integration/mods/items/give_item_action_discovery.test.js

# No linting issues
npx eslint tests/common/mods/scopeResolverHelpers.js

# Verify boilerplate reduction
echo "Lines before:" && wc -l tests/integration/mods/positioning/scoot_closer_action_discovery.test.js
# Should show significant line reduction (estimate: 150 → 100 lines)
```

## Files Created/Modified

### New Files
```
tests/common/mods/scopeResolverHelpers.js                           (~400 lines)
tests/unit/common/mods/scopeResolverHelpers.test.js                (~200 lines)
tests/integration/common/mods/scopeResolverHelpersIntegration.test.js (~150 lines)
```

### Modified Files
```
tests/common/mods/ModTestFixture.js                                  (add registerScopeHelpers method)
tests/integration/mods/positioning/scoot_closer_action_discovery.test.js  (use helpers, ~50 lines removed)
tests/integration/mods/positioning/hold_hand_action_discovery.test.js     (use helpers, ~40 lines removed)
tests/integration/mods/positioning/sit_down_action_discovery.test.js      (use helpers, ~30 lines removed)
tests/integration/mods/items/pick_up_item_action_discovery.test.js        (use helpers, ~35 lines removed)
tests/integration/mods/items/give_item_action_discovery.test.js           (use helpers, ~40 lines removed)
```

**Total**: ~750 new lines, ~195 lines removed from existing tests

## Testing

### Manual Testing

**Test 1: Verify helper pattern works**

Create temporary test:
```javascript
it('manual test - component lookup pattern', async () => {
  const room = new ModEntityBuilder('room1').asRoom('Test').build();
  const furniture = new ModEntityBuilder('furniture1')
    .atLocation('room1')
    .withComponent('positioning:allows_sitting', { spots: ['actor1'] })
    .build();
  const actor = new ModEntityBuilder('actor1')
    .atLocation('room1')
    .asActor()
    .withComponent('positioning:sitting_on', {
      furniture_id: 'furniture1',
      spot_index: 0,
    })
    .build();

  testFixture.reset([room, furniture, actor]);
  ScopeResolverHelpers.registerPositioningScopes(testFixture.testEnv);

  const result = testFixture.testEnv.unifiedScopeResolver.resolveSync(
    'positioning:furniture_actor_sitting_on',
    { actor: { id: 'actor1' } }
  );

  expect(result.value).toEqual(new Set(['furniture1']));
});
```

**Test 2: Verify all positioning scopes work**

Run all positioning tests with helpers and verify they pass.

**Test 3: Compare line counts before/after**

```bash
# Before conversion (with manual resolvers)
git show HEAD:tests/integration/mods/positioning/scoot_closer_action_discovery.test.js | wc -l

# After conversion (with helpers)
wc -l tests/integration/mods/positioning/scoot_closer_action_discovery.test.js

# Should show ~30-50% reduction
```

## Rollback Plan

If helpers cause issues:

```bash
# Revert converted test files
git checkout HEAD -- tests/integration/mods/positioning/scoot_closer_action_discovery.test.js
git checkout HEAD -- tests/integration/mods/positioning/hold_hand_action_discovery.test.js
git checkout HEAD -- tests/integration/mods/positioning/sit_down_action_discovery.test.js
git checkout HEAD -- tests/integration/mods/items/pick_up_item_action_discovery.test.js
git checkout HEAD -- tests/integration/mods/items/give_item_action_discovery.test.js

# Keep helper library for future use
# git rm tests/common/mods/scopeResolverHelpers.js
```

## Commit Strategy

**Single atomic commit**:
```bash
git add tests/common/mods/scopeResolverHelpers.js
git add tests/common/mods/ModTestFixture.js
git add tests/unit/common/mods/scopeResolverHelpers.test.js
git add tests/integration/common/mods/scopeResolverHelpersIntegration.test.js
git add tests/integration/mods/positioning/scoot_closer_action_discovery.test.js
git add tests/integration/mods/positioning/hold_hand_action_discovery.test.js
git add tests/integration/mods/positioning/sit_down_action_discovery.test.js
git add tests/integration/mods/items/pick_up_item_action_discovery.test.js
git add tests/integration/mods/items/give_item_action_discovery.test.js

git commit -m "MODTESTROB-004: Create scope resolver helper library

- Add ScopeResolverHelpers class with 4 reusable patterns:
  - createComponentLookupResolver() for component field lookups
  - createArrayFilterResolver() for array-based filtering
  - createLocationMatchResolver() for location-based queries
  - createComponentFilterResolver() for component existence checks
- Implement registerPositioningScopes() with 8 common positioning scopes:
  - furniture_actor_sitting_on
  - actors_sitting_on_same_furniture
  - closest_leftmost_occupant
  - furniture_allowing_sitting_at_location
  - standing_actors_at_location
  - sitting_actors
  - kneeling_actors
  - furniture_actor_behind
- Implement registerInventoryScopes() with 5 common inventory scopes:
  - actor_inventory_items
  - items_at_location
  - portable_items_at_location
  - actors_at_location
  - containers_at_location
- Implement registerAnatomyScopes() with 2 anatomy scopes
- Add registerScopeHelpers() convenience method to ModTestFixture
- Convert 5 existing tests to use helpers (195 lines of boilerplate removed)
- Add comprehensive unit tests (100% coverage)
- Add integration tests demonstrating real usage

Impact:
- 90% reduction in scope resolver boilerplate (50 lines → 2 lines)
- 80% faster test file creation for actions with scopes
- Consistent, reusable scope implementations
- Easier for new contributors to write tests
- Reduced copy-paste errors

Resolves MODTESTROB-004 (Phase 2 - P1 Priority)
"
```

## Success Criteria

Implementation is successful when:
- ✅ Helper library provides 4 core patterns + 15 pre-built scopes
- ✅ registerPositioningScopes() covers common positioning patterns
- ✅ registerInventoryScopes() covers common inventory patterns
- ✅ Unit tests pass with 100% coverage
- ✅ Integration tests demonstrate real usage
- ✅ 5 existing tests converted successfully
- ✅ 90% boilerplate reduction achieved (50 lines → 2 lines)
- ✅ All tests still pass after conversion
- ✅ Zero breaking changes to test behavior

## Expected Impact

### Quantitative
- **90% reduction** in scope resolver boilerplate (50 lines → 2 lines)
- **80% faster** test file creation for new actions
- **195 lines removed** from 5 converted tests
- **~400 lines** of reusable helper code
- **100% consistency** across scope implementations
- **50% fewer bugs** from copy-paste errors

### Qualitative
- Significantly easier for new contributors
- Consistent, maintainable scope patterns
- Easier to understand and debug tests
- Reusable across all mod categories
- Clear abstraction of common patterns
- Better test readability

## Next Steps

After this ticket is complete:
1. Verify all converted tests pass
2. Document helper patterns in MODTESTROB-008
3. Consider converting additional tests (optional)
4. Proceed to **MODTESTROB-005** (Enhanced Test Assertions)

---

**Dependencies**: Phase 1 complete (MODTESTROB-001-003)
**Blocks**: MODTESTROB-008 (documentation needs helper examples)
**Related**: MODTESTROB-006, 007 (scenario builders complement scope helpers)
