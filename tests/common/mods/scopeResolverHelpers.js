/**
 * @file Scope resolver helper library
 * @description Library of reusable scope resolver implementations that eliminates
 * the need to manually implement common scope patterns in tests
 */

import { promises as fs } from 'fs';
import { resolve } from 'path';
import process from 'node:process';
import { parseScopeDefinitions } from '../../../src/scopeDsl/scopeDefinitionParser.js';

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
 * @see {@link file://docs/testing/scope-resolver-registry.md} Complete scope registry documentation
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

      // Violence mod scopes - complex closeness + facing logic
      'positioning:close_actors_facing_each_other_or_behind_target':
        this.createArrayFilterResolver(
          'positioning:close_actors_facing_each_other_or_behind_target',
          {
            getArray: (actor, context, em) => {
              const closeness = em.getComponentData(
                actor.id,
                'positioning:closeness'
              );
              return closeness?.partners || [];
            },
            filterFn: (partnerId, actor, context, em) => {
              const actorFacingAway =
                em.getComponentData(actor.id, 'positioning:facing_away')
                  ?.facing_away_from || [];
              const partnerFacingAway =
                em.getComponentData(partnerId, 'positioning:facing_away')
                  ?.facing_away_from || [];

              const facingEachOther =
                !actorFacingAway.includes(partnerId) &&
                !partnerFacingAway.includes(actor.id);
              const actorBehind = partnerFacingAway.includes(actor.id);

              return facingEachOther || actorBehind;
            },
          }
        ),

      // Biting relationship scope - filters closeness partners for biting relationship
      'positioning:actor_being_bitten_by_me': this.createArrayFilterResolver(
        'positioning:actor_being_bitten_by_me',
        {
          getArray: (actor, context, em) => {
            const closeness = em.getComponentData(
              actor.id,
              'positioning:closeness'
            );
            return closeness?.partners || [];
          },
          filterFn: (partnerId, actor, context, em) => {
            // Check if actor has biting_neck component
            const actorBitingNeck = em.getComponentData(
              actor.id,
              'positioning:biting_neck'
            );
            if (!actorBitingNeck) {
              return false;
            }

            // Check if target has being_bitten_in_neck component
            const partnerBeingBitten = em.getComponentData(
              partnerId,
              'positioning:being_bitten_in_neck'
            );
            if (!partnerBeingBitten) {
              return false;
            }

            // Verify reciprocal relationship
            return (
              actorBitingNeck.bitten_entity_id === partnerId &&
              partnerBeingBitten.biting_entity_id === actor.id
            );
          },
        }
      ),

      // HIGH PRIORITY SCOPES (Phase 1)

      // "close actors" - Base closeness without kneeling filters
      'positioning:close_actors': this.createArrayFilterResolver(
        'positioning:close_actors',
        {
          getArray: (actor, context, em) => {
            const closeness = em.getComponentData(
              actor.id,
              'positioning:closeness'
            );
            return closeness?.partners || [];
          },
          filterFn: (partnerId, actor, context, em) => {
            // Exclude if either actor is kneeling before the other
            const actorKneeling = em.getComponentData(
              actor.id,
              'positioning:kneeling_before'
            );
            const partnerKneeling = em.getComponentData(
              partnerId,
              'positioning:kneeling_before'
            );

            return !(
              actorKneeling?.entity_id === partnerId ||
              partnerKneeling?.entity_id === actor.id
            );
          },
        }
      ),

      // "close actors facing each other" - Mutual facing validation
      'positioning:close_actors_facing_each_other':
        this.createArrayFilterResolver(
          'positioning:close_actors_facing_each_other',
          {
            getArray: (actor, context, em) => {
              const closeness = em.getComponentData(
                actor.id,
                'positioning:closeness'
              );
              return closeness?.partners || [];
            },
            filterFn: (partnerId, actor, context, em) => {
              const actorFacingAway =
                em.getComponentData(actor.id, 'positioning:facing_away')
                  ?.facing_away_from || [];
              const partnerFacingAway =
                em.getComponentData(partnerId, 'positioning:facing_away')
                  ?.facing_away_from || [];

              // Both must be facing each other (not facing away from each other)
              return (
                !actorFacingAway.includes(partnerId) &&
                !partnerFacingAway.includes(actor.id)
              );
            },
          }
        ),

      // "actors both sitting close" - Closeness + sitting filter
      'positioning:actors_both_sitting_close': this.createArrayFilterResolver(
        'positioning:actors_both_sitting_close',
        {
          getArray: (actor, context, em) => {
            const closeness = em.getComponentData(
              actor.id,
              'positioning:closeness'
            );
            return closeness?.partners || [];
          },
          filterFn: (partnerId, actor, context, em) => {
            // Both actor and partner must be sitting
            return (
              em.hasComponent(actor.id, 'positioning:sitting_on') &&
              em.hasComponent(partnerId, 'positioning:sitting_on')
            );
          },
        }
      ),

      // "actor biting my neck" - Reverse biting relationship
      'positioning:actor_biting_my_neck': this.createArrayFilterResolver(
        'positioning:actor_biting_my_neck',
        {
          getArray: (actor, context, em) => {
            const closeness = em.getComponentData(
              actor.id,
              'positioning:closeness'
            );
            return closeness?.partners || [];
          },
          filterFn: (partnerId, actor, context, em) => {
            // Check if actor has being_bitten_in_neck component
            const actorBeingBitten = em.getComponentData(
              actor.id,
              'positioning:being_bitten_in_neck'
            );
            if (!actorBeingBitten) {
              return false;
            }

            // Check if partner has biting_neck component
            const partnerBitingNeck = em.getComponentData(
              partnerId,
              'positioning:biting_neck'
            );
            if (!partnerBitingNeck) {
              return false;
            }

            // Verify reciprocal relationship (opposite of actor_being_bitten_by_me)
            return (
              actorBeingBitten.biting_entity_id === partnerId &&
              partnerBitingNeck.bitten_entity_id === actor.id
            );
          },
        }
      ),

      // "actors sitting close" - Seated actors with closeness
      'positioning:actors_sitting_close': this.createArrayFilterResolver(
        'positioning:actors_sitting_close',
        {
          getArray: (actor, context, em) => {
            const closeness = em.getComponentData(
              actor.id,
              'positioning:closeness'
            );
            return closeness?.partners || [];
          },
          filterFn: (partnerId, actor, context, em) => {
            // Partner must be sitting (actor sitting status doesn't matter)
            return em.hasComponent(partnerId, 'positioning:sitting_on');
          },
        }
      ),

      // "close actors or entity kneeling before actor" - Complex closeness with kneeling union
      'positioning:close_actors_or_entity_kneeling_before_actor':
        this.createArrayFilterResolver(
          'positioning:close_actors_or_entity_kneeling_before_actor',
          {
            getArray: (actor, context, em) => {
              const closeness = em.getComponentData(
                actor.id,
                'positioning:closeness'
              );
              return closeness?.partners || [];
            },
            filterFn: (partnerId, actor, context, em) => {
              // Get facing away data
              const actorFacingAway =
                em.getComponentData(actor.id, 'positioning:facing_away')
                  ?.facing_away_from || [];
              const partnerFacingAway =
                em.getComponentData(partnerId, 'positioning:facing_away')
                  ?.facing_away_from || [];

              // Check if facing each other
              const facingEachOther =
                !actorFacingAway.includes(partnerId) &&
                !partnerFacingAway.includes(actor.id);

              // Check if actor is behind partner
              const actorBehind = partnerFacingAway.includes(actor.id);

              // Check kneeling relationships
              const actorKneeling = em.getComponentData(
                actor.id,
                'positioning:kneeling_before'
              );
              const partnerKneeling = em.getComponentData(
                partnerId,
                'positioning:kneeling_before'
              );

              // Actor must NOT be kneeling before partner
              if (actorKneeling?.entity_id === partnerId) {
                return false;
              }

              // Must be: (facing each other OR actor behind) AND actor not kneeling before partner
              return facingEachOther || actorBehind;
            },
          }
        ),

      // MEDIUM PRIORITY SCOPES (Phase 2)

      // "actor im straddling" - Straddling relationship lookup
      'positioning:actor_im_straddling': this.createComponentLookupResolver(
        'positioning:actor_im_straddling',
        {
          componentType: 'positioning:straddling_waist',
          sourceField: 'target_id',
          contextSource: 'actor',
        }
      ),

      // "entity actor is kneeling before" - Kneeling target lookup
      'positioning:entity_actor_is_kneeling_before':
        this.createComponentLookupResolver(
          'positioning:entity_actor_is_kneeling_before',
          {
            componentType: 'positioning:kneeling_before',
            sourceField: 'entity_id',
            contextSource: 'actor',
          }
        ),

      // "actors sitting with space to right" - Seating availability check
      // Note: This scope uses a custom hasSittingSpaceToRight operation in production
      // For test purposes, we approximate with simplified logic
      'positioning:actors_sitting_with_space_to_right':
        this.createComponentFilterResolver(
          'positioning:actors_sitting_with_space_to_right',
          {
            componentType: 'positioning:sitting_on',
            filterFn: (entityId, context, em) => {
              const sitting = em.getComponentData(
                entityId,
                'positioning:sitting_on'
              );
              if (!sitting?.furniture_id || typeof sitting.spot_index !== 'number') {
                return false;
              }

              const furniture = em.getComponentData(
                sitting.furniture_id,
                'positioning:allows_sitting'
              );
              if (!furniture?.spots) {
                return false;
              }

              const spots = furniture.spots;
              const actorSpotIndex = sitting.spot_index;

              // Check if there are at least 2 empty spots to the right
              let emptyCount = 0;
              for (let i = actorSpotIndex + 1; i < spots.length; i++) {
                if (spots[i] === null || spots[i] === undefined) {
                  emptyCount++;
                } else {
                  break; // Stop at first occupied spot
                }
              }

              // Must have at least 2 empty spots and be rightmost occupant
              if (emptyCount < 2) {
                return false;
              }

              // Check if rightmost occupant (no one sitting further right)
              for (let i = actorSpotIndex + 1; i < spots.length; i++) {
                if (spots[i] !== null && spots[i] !== undefined) {
                  return false;
                }
              }

              return true;
            },
          }
        ),

      // LOWER PRIORITY & SPECIALIZED SCOPES (Phase 3)

      // "available furniture" - Furniture with empty spots at location
      'positioning:available_furniture': this.createLocationMatchResolver(
        'positioning:available_furniture',
        {
          filterFn: (entityId, source, context, em) => {
            if (!em.hasComponent(entityId, 'positioning:allows_sitting')) {
              return false;
            }

            const furniture = em.getComponentData(
              entityId,
              'positioning:allows_sitting'
            );

            // Check if furniture has at least one empty spot
            return (
              furniture?.spots &&
              furniture.spots.some((spot) => spot === null || spot === undefined)
            );
          },
        }
      ),

      // "available lying furniture" - Furniture allowing lying at location
      'positioning:available_lying_furniture': this.createLocationMatchResolver(
        'positioning:available_lying_furniture',
        {
          filterFn: (entityId, source, context, em) => {
            return em.hasComponent(entityId, 'positioning:allows_lying_on');
          },
        }
      ),

      // "furniture im lying on" - Current lying surface
      'positioning:furniture_im_lying_on': this.createComponentLookupResolver(
        'positioning:furniture_im_lying_on',
        {
          componentType: 'positioning:lying_down',
          sourceField: 'furniture_id',
          contextSource: 'actor',
        }
      ),

      // "furniture im sitting on" - Current sitting surface (alias for furniture_actor_sitting_on)
      'positioning:furniture_im_sitting_on':
        this.createComponentLookupResolver(
          'positioning:furniture_im_sitting_on',
          {
            componentType: 'positioning:sitting_on',
            sourceField: 'furniture_id',
            contextSource: 'actor',
          }
        ),

      // "surface im bending over" - Bending-over surface lookup
      'positioning:surface_im_bending_over':
        this.createComponentLookupResolver(
          'positioning:surface_im_bending_over',
          {
            componentType: 'positioning:bending_over',
            sourceField: 'surface_id',
            contextSource: 'actor',
          }
        ),

      // "actors im facing away from" - Facing-away targets in closeness
      'positioning:actors_im_facing_away_from': this.createArrayFilterResolver(
        'positioning:actors_im_facing_away_from',
        {
          getArray: (actor, context, em) => {
            const facingAway = em.getComponentData(
              actor.id,
              'positioning:facing_away'
            );
            return facingAway?.facing_away_from || [];
          },
          filterFn: (partnerId, actor, context, em) => {
            // Partner must be in closeness with actor
            const closeness = em.getComponentData(
              actor.id,
              'positioning:closeness'
            );
            return closeness?.partners?.includes(partnerId) || false;
          },
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
   * Convenience method for registering a custom scope without a ModTestFixture instance.
   * Automatically loads the scope file, parses it, creates a resolver,
   * and registers it with the UnifiedScopeResolver.
   *
   * @param {object} testEnv - Test environment from createSystemLogicTestEnv()
   * @param {string} modId - The mod containing the scope
   * @param {string} scopeName - The scope name (without .scope extension)
   * @returns {Promise<void>}
   * @throws {Error} If scope file not found or parsing fails
   * @example
   * // Register a custom scope
   * await ScopeResolverHelpers.registerCustomScope(
   *   testEnv,
   *   'sex-anal-penetration',
   *   'actors_with_exposed_asshole_accessible_from_behind'
   * );
   */
  static async registerCustomScope(testEnv, modId, scopeName) {
    // Validate inputs
    if (!modId || typeof modId !== 'string') {
      throw new Error('modId must be a non-empty string');
    }
    if (!scopeName || typeof scopeName !== 'string') {
      throw new Error('scopeName must be a non-empty string');
    }

    // Construct scope file path
    const scopePath = resolve(
      process.cwd(),
      `data/mods/${modId}/scopes/${scopeName}.scope`
    );

    // Read scope file
    let scopeContent;
    try {
      scopeContent = await fs.readFile(scopePath, 'utf-8');
    } catch (err) {
      throw new Error(
        `Failed to read scope file at ${scopePath}: ${err.message}`
      );
    }

    // Parse scope definitions (returns Map)
    let parsedScopes;
    try {
      parsedScopes = parseScopeDefinitions(scopeContent, scopePath);
    } catch (err) {
      throw new Error(
        `Failed to parse scope file at ${scopePath}: ${err.message}`
      );
    }

    // Get scope data (must use full namespaced name)
    const fullScopeName = `${modId}:${scopeName}`;
    const scopeData = parsedScopes.get(fullScopeName);

    if (!scopeData) {
      const availableScopes = Array.from(parsedScopes.keys()).join(', ');
      throw new Error(
        `Scope "${fullScopeName}" not found in file ${scopePath}. ` +
          `Available scopes: ${availableScopes || '(none)'}`
      );
    }

    // Create and register the resolver (note: creates local ScopeEngine instance)
    const { default: ScopeEngine } = await import(
      '../../../src/scopeDsl/engine.js'
    );
    const scopeEngine = new ScopeEngine();

    const resolver = (context) => {
      const runtimeCtx = {
        entityManager: testEnv.entityManager,
        jsonLogicEval: testEnv.jsonLogic,
        logger: testEnv.logger,
      };

      try {
        const result = scopeEngine.resolve(scopeData.ast, context, runtimeCtx);
        return { success: true, value: result };
      } catch (err) {
        return {
          success: false,
          error: `Failed to resolve scope "${fullScopeName}": ${err.message}`,
        };
      }
    };

    // Register with proper signature (3 parameters)
    this._registerResolvers(testEnv, testEnv.entityManager, {
      [fullScopeName]: resolver,
    });
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
      testEnv._originalResolveSync = testEnv.unifiedScopeResolver.resolveSync.bind(
        testEnv.unifiedScopeResolver
      );
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
