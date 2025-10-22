/**
 * @file Scope resolver helper library
 * @description Library of reusable scope resolver implementations that eliminates
 * the need to manually implement common scope patterns in tests
 */

/**
 * Resolves an entity reference from a scope context.
 *
 * @param {object} context - Scope evaluation context.
 * @param {string} contextSource - Property on the context containing the entity reference.
 * @param {import('../entities/index.js').SimpleEntityManager} entityManager - Entity manager instance.
 * @returns {{ entityId: string|null, entity: object|null }} Resolved entity information.
 */
function resolveContextEntity(context, contextSource, entityManager) {
  const reference = context?.[contextSource];

  if (!reference) {
    return { entityId: null, entity: null };
  }

  if (typeof reference === 'string') {
    const entityInstance = entityManager.getEntityInstance(reference);
    return { entityId: reference, entity: entityInstance ?? null };
  }

  if (typeof reference === 'object') {
    if (typeof reference.id === 'string') {
      return { entityId: reference.id, entity: reference };
    }

    if (
      Object.prototype.hasOwnProperty.call(reference, 'id') &&
      reference.id !== null &&
      reference.id !== undefined
    ) {
      const entityId = String(reference.id);
      return { entityId, entity: { ...reference, id: entityId } };
    }
  }

  return { entityId: null, entity: null };
}

/**
 * Library of reusable scope resolver implementations.
 *
 * Provides factory methods for creating scope resolvers following common patterns,
 * and registration methods that bundle multiple related scope resolvers together.
 *
 * @example
 * // In test setup:
 * beforeEach(async () => {
 *   testFixture = await ModTestFixture.forAction(...);
 *   ScopeResolverHelpers.registerPositioningScopes(testFixture.testEnv);
 * });
 */
export class ScopeResolverHelpers {
  /**
   * Creates a resolver for "component on current entity" pattern.
   * Example: "furniture the actor is sitting on"
   *
   * @param {string} scopeName - Scope identifier
   * @param {object} config - Configuration
   * @param {string} config.componentType - Component type to query (e.g., 'positioning:sitting_on')
   * @param {string} config.sourceField - Field in component containing target entity ID
   * @param {string} [config.resultField] - Field to extract from result
   * @param {string} [config.contextSource] - Context entity to use ('actor' or 'target')
   * @returns {Function} Scope resolver function
   */
  static createComponentLookupResolver(
    scopeName,
    { componentType, sourceField, resultField = 'id', contextSource = 'actor' }
  ) {
    return function (context) {
      const { entityManager } = this;
      const { entityId: sourceEntityId } = resolveContextEntity(
        context,
        contextSource,
        entityManager
      );

      if (!sourceEntityId) {
        return { success: true, value: new Set() };
      }

      const component = entityManager.getComponentData(
        sourceEntityId,
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
   * Creates a resolver for "entities matching filter in array" pattern.
   * Example: "closest leftmost occupant in furniture spots"
   *
   * @param {string} scopeName - Scope identifier
   * @param {object} config - Configuration
   * @param {Function} config.getArray - Function to get array from entity/context
   * @param {Function} config.filterFn - Function to filter array items
   * @param {string} [config.contextSource] - Context entity to use
   * @returns {Function} Scope resolver function
   */
  static createArrayFilterResolver(
    scopeName,
    { getArray, filterFn, contextSource = 'actor' }
  ) {
    return function (context) {
      const { entityManager } = this;
      const { entityId: sourceEntityId, entity: sourceEntityRef } =
        resolveContextEntity(context, contextSource, entityManager);

      if (!sourceEntityId) {
        return { success: true, value: new Set() };
      }

      const sourceEntity =
        sourceEntityRef ?? entityManager.getEntityInstance(sourceEntityId) ?? { id: sourceEntityId };

      const array = getArray(sourceEntity, context, entityManager);
      if (!Array.isArray(array)) {
        return { success: true, value: new Set() };
      }

      const matches = array.filter((item) =>
        filterFn(item, sourceEntity, context, entityManager)
      );

      return {
        success: true,
        value: new Set(matches.filter(Boolean)),
      };
    };
  }

  /**
   * Creates a resolver for "entities at same location" pattern.
   * Example: "all actors in same room"
   *
   * @param {string} scopeName - Scope identifier
   * @param {object} config - Configuration
   * @param {Function} [config.filterFn] - Optional filter function
   * @param {string} [config.contextSource] - Context entity to use
   * @returns {Function} Scope resolver function
   */
  static createLocationMatchResolver(
    scopeName,
    { filterFn = null, contextSource = 'actor' }
  ) {
    return function (context) {
      const { entityManager } = this;
      const { entityId: sourceEntityId, entity: sourceEntityRef } =
        resolveContextEntity(context, contextSource, entityManager);

      if (!sourceEntityId) {
        return { success: true, value: new Set() };
      }

      const sourceEntity =
        sourceEntityRef ?? entityManager.getEntityInstance(sourceEntityId) ?? { id: sourceEntityId };

      const sourceLocation = entityManager.getComponentData(
        sourceEntity.id,
        'core:position'
      );

      if (!sourceLocation?.locationId) {
        return { success: true, value: new Set() };
      }

      // Get all entities at same location
      const entitiesAtLocation = entityManager
        .getEntityIds()
        .filter((entityId) => {
          if (entityId === sourceEntity.id) return false; // Exclude source

          const position = entityManager.getComponentData(
            entityId,
            'core:position'
          );
          if (position?.locationId !== sourceLocation.locationId) return false;

          // Apply optional filter
          if (filterFn) {
            return filterFn(entityId, sourceEntity, context, entityManager);
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
   * Creates a resolver for "entities with specific component" pattern.
   * Example: "all actors who are sitting"
   *
   * @param {string} scopeName - Scope identifier
   * @param {object} config - Configuration
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
        .getEntityIds()
        .filter((entityId) => {
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
   * Register all positioning-related scope resolvers.
   * Covers common positioning mod scopes used in tests.
   *
   * @param {object} testEnv - Test environment from ModTestFixture
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
            filterFn: (entityId, actor) => {
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
          filterFn: (entityId, actor) => {
            return entityId && entityId !== actor.id;
          },
        }
      ),

      // "closest rightmost occupant" (for scoot_closer_right action)
      'positioning:closest_rightmost_occupant': this.createArrayFilterResolver(
        'positioning:closest_rightmost_occupant',
        {
          getArray: (actor, context, em) => {
            const sitting = em.getComponentData(
              actor.id,
              'positioning:sitting_on'
            );
            if (!sitting) {
              return [];
            }

            const furniture = em.getComponentData(
              sitting.furniture_id,
              'positioning:allows_sitting'
            );
            if (!furniture?.spots) {
              return [];
            }

            const spots = furniture.spots;
            const actorSpotIndex = sitting.spot_index;

            if (typeof actorSpotIndex !== 'number') {
              return [];
            }

            if (actorSpotIndex + 1 >= spots.length) {
              return [];
            }

            if (spots[actorSpotIndex + 1] !== null) {
              return [];
            }

            for (let i = actorSpotIndex + 2; i < spots.length; i++) {
              const occupantId = spots[i];
              if (occupantId && occupantId !== actor.id) {
                return [occupantId];
              }
            }

            return [];
          },
          filterFn: (entityId, actor) => {
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
    this._registerResolvers(testEnv, entityManager, resolvers);
  }

  /**
   * Register all inventory/items-related scope resolvers.
   * Covers common items mod scopes used in tests.
   *
   * @param {object} testEnv - Test environment from ModTestFixture
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
    this._registerResolvers(testEnv, entityManager, resolvers);
  }

  /**
   * Register all anatomy-related scope resolvers.
   * Covers common anatomy mod scopes used in tests.
   *
   * @param {object} testEnv - Test environment from ModTestFixture
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
    this._registerResolvers(testEnv, entityManager, resolvers);
  }

  /**
   * Internal helper to register scope resolvers with testEnv.
   * Wraps the current pattern of overriding testEnv.unifiedScopeResolver.resolveSync.
   *
   * @private
   * @param {object} testEnv - Test environment
   * @param {object} entityManager - Entity manager instance
   * @param {object} resolvers - Map of scope names to resolver functions
   */
  static _registerResolvers(testEnv, entityManager, resolvers) {
    // Store original resolver if not already stored
    if (!testEnv._originalResolveSync) {
      testEnv._originalResolveSync = testEnv.unifiedScopeResolver.resolveSync;
    }

    // Store registered resolvers map if not exists
    if (!testEnv._registeredResolvers) {
      testEnv._registeredResolvers = new Map();
    }

    // Add new resolvers to the map
    Object.entries(resolvers).forEach(([scopeName, resolver]) => {
      const boundResolver =
        typeof resolver === 'function' && resolver.bind
          ? resolver.bind({
              get entityManager() {
                return testEnv.entityManager || entityManager;
              },
            })
          : resolver;
      testEnv._registeredResolvers.set(scopeName, boundResolver);
    });

    // Override resolveSync to use registered resolvers with fallback
    testEnv.unifiedScopeResolver.resolveSync = (scopeName, context) => {
      // Check if we have a registered resolver for this scope
      if (testEnv._registeredResolvers.has(scopeName)) {
        return testEnv._registeredResolvers.get(scopeName)(context);
      }

      // Fall back to original resolver
      return testEnv._originalResolveSync.call(
        testEnv.unifiedScopeResolver,
        scopeName,
        context
      );
    };
  }
}
