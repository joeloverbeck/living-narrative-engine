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

  it('should use target context when specified', () => {
    mockEntityManager.getComponentData = jest.fn((entityId, componentType) => {
      if (
        entityId === 'target1' &&
        componentType === 'positioning:sitting_on'
      ) {
        return { furniture_id: 'furniture2' };
      }
      return null;
    });

    const resolver = ScopeResolverHelpers.createComponentLookupResolver(
      'test:target_furniture',
      {
        componentType: 'positioning:sitting_on',
        sourceField: 'furniture_id',
        contextSource: 'target',
      }
    );

    const result = resolver.call(
      { entityManager: mockEntityManager },
      { target: { id: 'target1' } }
    );

    expect(result).toEqual({
      success: true,
      value: new Set(['furniture2']),
    });
  });

  it('should handle nested result fields', () => {
    mockEntityManager.getComponentData = jest.fn(() => {
      return {
        complexField: {
          nestedValue: 'nested_result',
        },
      };
    });

    const resolver = ScopeResolverHelpers.createComponentLookupResolver(
      'test:nested_lookup',
      {
        componentType: 'test:component',
        sourceField: 'complexField',
        resultField: 'nestedValue',
      }
    );

    const result = resolver.call(
      { entityManager: mockEntityManager },
      { actor: { id: 'actor1' } }
    );

    expect(result).toEqual({
      success: true,
      value: new Set(['nested_result']),
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
          componentType === 'sitting:allows_sitting'
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
            'sitting:allows_sitting'
          );
          return furniture?.spots || [];
        },
        filterFn: (entityId, actor) => {
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

  it('should return empty set if getArray returns non-array', () => {
    const resolver = ScopeResolverHelpers.createArrayFilterResolver(
      'test:array_filter',
      {
        getArray: () => null,
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

  it('should return empty set if context missing', () => {
    const resolver = ScopeResolverHelpers.createArrayFilterResolver(
      'test:array_filter',
      {
        getArray: () => ['item1', 'item2'],
        filterFn: () => true,
      }
    );

    const result = resolver.call({ entityManager: mockEntityManager }, {});

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
      getEntityIds: jest.fn(() => ['actor1', 'actor2', 'actor3']),
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
    mockEntityManager.hasComponent = jest.fn((entityId, componentType) => {
      if (
        componentType === 'core:actor' &&
        (entityId === 'actor1' || entityId === 'actor2')
      ) {
        return true;
      }
      return false;
    });

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

  it('should return empty set if no location component', () => {
    mockEntityManager.getComponentData = jest.fn(() => null);

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
      value: new Set(),
    });
  });

  it('should return empty set if context missing', () => {
    const resolver = ScopeResolverHelpers.createLocationMatchResolver(
      'test:same_location',
      {}
    );

    const result = resolver.call({ entityManager: mockEntityManager }, {});

    expect(result).toEqual({
      success: true,
      value: new Set(),
    });
  });
});

describe('ScopeResolverHelpers - Component Filter Pattern', () => {
  let mockEntityManager;

  beforeEach(() => {
    mockEntityManager = {
      getEntityIds: jest.fn(() => ['actor1', 'actor2', 'actor3']),
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

    const result = resolver.call({ entityManager: mockEntityManager }, {});

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
        filterFn: (entityId) => {
          return entityId === 'actor1'; // Only actor1
        },
      }
    );

    const result = resolver.call({ entityManager: mockEntityManager }, {});

    expect(result).toEqual({
      success: true,
      value: new Set(['actor1']),
    });
  });

  it('should return empty set if no entities have component', () => {
    mockEntityManager.hasComponent = jest.fn(() => false);

    const resolver = ScopeResolverHelpers.createComponentFilterResolver(
      'test:sitting_actors',
      {
        componentType: 'positioning:sitting_on',
      }
    );

    const result = resolver.call({ entityManager: mockEntityManager }, {});

    expect(result).toEqual({
      success: true,
      value: new Set(),
    });
  });
});

describe('ScopeResolverHelpers - Registration Helpers', () => {
  let mockTestEnv;
  let mockEntityManager;

  beforeEach(() => {
    mockEntityManager = {
      getComponentData: jest.fn(),
      getEntityIds: jest.fn(() => []),
      hasComponent: jest.fn(() => false),
    };

    mockTestEnv = {
      entityManager: mockEntityManager,
      unifiedScopeResolver: {
        resolveSync: jest.fn(() => {
          return { success: true, value: new Set() };
        }),
      },
    };
  });

  it('should register positioning scopes', () => {
    ScopeResolverHelpers.registerPositioningScopes(mockTestEnv);

    // Verify resolvers were registered
    expect(mockTestEnv._registeredResolvers).toBeDefined();
    expect(mockTestEnv._registeredResolvers.size).toBeGreaterThan(0);
    expect(
      mockTestEnv._registeredResolvers.has(
        'personal-space:furniture_actor_sitting_on'
      )
    ).toBe(true);
    expect(
      mockTestEnv._registeredResolvers.has('positioning:sitting_actors')
    ).toBe(true);
  });

  it('should register inventory scopes', () => {
    ScopeResolverHelpers.registerInventoryScopes(mockTestEnv);

    expect(mockTestEnv._registeredResolvers).toBeDefined();
    expect(mockTestEnv._registeredResolvers.size).toBeGreaterThan(0);
    expect(
      mockTestEnv._registeredResolvers.has('items:actor_inventory_items')
    ).toBe(true);
    expect(
      mockTestEnv._registeredResolvers.has('items:portable_items_at_location')
    ).toBe(true);
  });

  it('should register anatomy scopes', () => {
    ScopeResolverHelpers.registerAnatomyScopes(mockTestEnv);

    expect(mockTestEnv._registeredResolvers).toBeDefined();
    expect(mockTestEnv._registeredResolvers.size).toBeGreaterThan(0);
    expect(
      mockTestEnv._registeredResolvers.has('anatomy:actors_at_location')
    ).toBe(true);
    expect(
      mockTestEnv._registeredResolvers.has('anatomy:target_body_parts')
    ).toBe(true);
  });

  it('should preserve original resolver and fall back to it', () => {
    const originalResolver = mockTestEnv.unifiedScopeResolver.resolveSync;
    originalResolver.mockReturnValue({
      success: true,
      value: new Set(['original_result']),
    });

    ScopeResolverHelpers.registerPositioningScopes(mockTestEnv);

    // Call with an unregistered scope
    const result = mockTestEnv.unifiedScopeResolver.resolveSync(
      'unknown:scope',
      {}
    );

    expect(result).toEqual({
      success: true,
      value: new Set(['original_result']),
    });
    // The original resolver is stored and bound for proper context, so verify it exists and is callable
    expect(mockTestEnv._originalResolveSync).toBeDefined();
    expect(typeof mockTestEnv._originalResolveSync).toBe('function');
  });

  it('should use registered resolver instead of original', () => {
    const originalResolver = mockTestEnv.unifiedScopeResolver.resolveSync;
    originalResolver.mockReturnValue({
      success: true,
      value: new Set(['original_result']),
    });

    ScopeResolverHelpers.registerPositioningScopes(mockTestEnv);

    // Call with a registered scope
    const result = mockTestEnv.unifiedScopeResolver.resolveSync(
      'positioning:sitting_actors',
      {}
    );

    // Should use registered resolver, not original
    expect(result.success).toBe(true);
    expect(result.value).toEqual(new Set()); // Empty because no entities in mock
    expect(originalResolver).not.toHaveBeenCalled();
  });

  it('should allow multiple registration calls without conflict', () => {
    ScopeResolverHelpers.registerPositioningScopes(mockTestEnv);
    const firstResolverCount = mockTestEnv._registeredResolvers.size;

    ScopeResolverHelpers.registerInventoryScopes(mockTestEnv);
    const secondResolverCount = mockTestEnv._registeredResolvers.size;

    // Both sets of resolvers should be available
    expect(secondResolverCount).toBeGreaterThan(firstResolverCount);
    expect(
      mockTestEnv._registeredResolvers.has('positioning:sitting_actors')
    ).toBe(true);
    expect(
      mockTestEnv._registeredResolvers.has('items:portable_items_at_location')
    ).toBe(true);
  });
});

describe('ScopeResolverHelpers - New Positioning Scopes (TEAOUTTHR-006)', () => {
  let mockTestEnv;
  let mockEntityManager;

  beforeEach(() => {
    mockEntityManager = {
      getComponentData: jest.fn(),
      getEntityIds: jest.fn(() => []),
      getEntityInstance: jest.fn(),
      hasComponent: jest.fn(() => false),
    };

    mockTestEnv = {
      entityManager: mockEntityManager,
      unifiedScopeResolver: {
        resolveSync: jest.fn(),
      },
    };

    ScopeResolverHelpers.registerPositioningScopes(mockTestEnv);
  });

  describe('High Priority Scopes', () => {
    it('should register positioning:close_actors', () => {
      expect(
        mockTestEnv._registeredResolvers.has('positioning:close_actors')
      ).toBe(true);
    });

    it('should register positioning:close_actors_facing_each_other', () => {
      expect(
        mockTestEnv._registeredResolvers.has(
          'positioning:close_actors_facing_each_other'
        )
      ).toBe(true);
    });

    it('should register sitting:actors_both_sitting_close', () => {
      expect(
        mockTestEnv._registeredResolvers.has(
          'sitting:actors_both_sitting_close'
        )
      ).toBe(true);
    });

    it('should register sitting:actors_sitting_close', () => {
      expect(
        mockTestEnv._registeredResolvers.has('sitting:actors_sitting_close')
      ).toBe(true);
    });

    it('should register positioning:close_actors_or_entity_kneeling_before_actor', () => {
      expect(
        mockTestEnv._registeredResolvers.has(
          'positioning:close_actors_or_entity_kneeling_before_actor'
        )
      ).toBe(true);
    });
  });

  describe('Medium Priority Scopes', () => {
    it('should register straddling:actor_im_straddling', () => {
      expect(
        mockTestEnv._registeredResolvers.has('straddling:actor_im_straddling')
      ).toBe(true);
    });

    it('should register positioning:entity_actor_is_kneeling_before', () => {
      expect(
        mockTestEnv._registeredResolvers.has(
          'positioning:entity_actor_is_kneeling_before'
        )
      ).toBe(true);
    });

    it('should register personal-space:actors_sitting_with_space_to_right', () => {
      expect(
        mockTestEnv._registeredResolvers.has(
          'personal-space:actors_sitting_with_space_to_right'
        )
      ).toBe(true);
    });
  });

  describe('Lower Priority Scopes', () => {
    it('should register sitting:available_furniture', () => {
      expect(
        mockTestEnv._registeredResolvers.has('sitting:available_furniture')
      ).toBe(true);
    });

    it('should register lying:available_lying_furniture', () => {
      expect(
        mockTestEnv._registeredResolvers.has(
          'lying:available_lying_furniture'
        )
      ).toBe(true);
    });

    it('should register lying:furniture_im_lying_on', () => {
      expect(
        mockTestEnv._registeredResolvers.has(
          'lying:furniture_im_lying_on'
        )
      ).toBe(true);
    });

    it('should register sitting:furniture_im_sitting_on', () => {
      expect(
        mockTestEnv._registeredResolvers.has(
          'sitting:furniture_im_sitting_on'
        )
      ).toBe(true);
    });

    it('should register bending:surface_im_bending_over', () => {
      expect(
        mockTestEnv._registeredResolvers.has(
          'bending:surface_im_bending_over'
        )
      ).toBe(true);
    });

    it('should register positioning:actors_im_facing_away_from', () => {
      expect(
        mockTestEnv._registeredResolvers.has(
          'positioning:actors_im_facing_away_from'
        )
      ).toBe(true);
    });
  });

  it('should have 20+ total positioning-related scopes registered', () => {
    // Count all positioning-related scopes across multiple namespaces
    // (positioning, sitting, straddling, personal-space)
    const positioningRelatedPrefixes = [
      'positioning:',
      'sitting:',
      'straddling:',
      'personal-space:',
    ];
    const positioningScopes = Array.from(
      mockTestEnv._registeredResolvers.keys()
    ).filter((key) =>
      positioningRelatedPrefixes.some((prefix) => key.startsWith(prefix))
    );
    expect(positioningScopes.length).toBeGreaterThanOrEqual(20);
  });
});
