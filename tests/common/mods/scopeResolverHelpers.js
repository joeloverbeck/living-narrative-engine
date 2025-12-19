/**
 * @file Scope resolver helper library
 * @description Library of reusable scope resolver implementations that eliminates
 * the need to manually implement common scope patterns in tests
 */

import { promises as fs } from 'fs';
import { resolve } from 'path';
import process from 'node:process';
import { parseScopeDefinitions } from '../../../src/scopeDsl/scopeDefinitionParser.js';
import ScopeConditionAnalyzer from '../engine/scopeConditionAnalyzer.js';
import { ParameterValidator } from '../../../src/scopeDsl/core/parameterValidator.js';
import { ParameterValidationError } from '../../../src/scopeDsl/errors/parameterValidationError.js';
import { ClothingAccessibilityService } from '../../../src/clothing/services/clothingAccessibilityService.js';
import * as coreTokens from '../../../src/dependencyInjection/tokens/tokens-core.js';

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

      const sourceEntity = sourceEntityRef ??
        entityManager.getEntityInstance(sourceEntityId) ?? {
          id: sourceEntityId,
        };

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

      const sourceEntity = sourceEntityRef ??
        entityManager.getEntityInstance(sourceEntityId) ?? {
          id: sourceEntityId,
        };

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
      'personal-space:furniture_actor_sitting_on':
        this.createComponentLookupResolver(
          'personal-space:furniture_actor_sitting_on',
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
                'sitting:allows_sitting'
              );
              return furniture?.spots || [];
            },
            filterFn: (entityId, actor) => {
              return entityId && entityId !== actor.id;
            },
          }
        ),

      // "closest leftmost occupant" (for scoot_closer action)
      'personal-space:closest_leftmost_occupant':
        this.createArrayFilterResolver(
          'personal-space:closest_leftmost_occupant',
          {
            getArray: (actor, context, em) => {
              const sitting = em.getComponentData(
                actor.id,
                'positioning:sitting_on'
              );
              if (!sitting) return [];

              const furniture = em.getComponentData(
                sitting.furniture_id,
                'sitting:allows_sitting'
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
      'personal-space:closest_rightmost_occupant':
        this.createArrayFilterResolver(
          'personal-space:closest_rightmost_occupant',
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
                'sitting:allows_sitting'
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
              return em.hasComponent(entityId, 'sitting:allows_sitting');
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
                'personal-space-states:closeness'
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
              'personal-space-states:closeness'
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
              'personal-space-states:closeness'
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
                'personal-space-states:closeness'
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
      'sitting:actors_both_sitting_close': this.createArrayFilterResolver(
        'sitting:actors_both_sitting_close',
        {
          getArray: (actor, context, em) => {
            const closeness = em.getComponentData(
              actor.id,
              'personal-space-states:closeness'
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

      // "actors sitting close" - Seated actors with closeness
      'sitting:actors_sitting_close': this.createArrayFilterResolver(
        'sitting:actors_sitting_close',
        {
          getArray: (actor, context, em) => {
            const closeness = em.getComponentData(
              actor.id,
              'personal-space-states:closeness'
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
                'personal-space-states:closeness'
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
      'straddling:actor_im_straddling': this.createComponentLookupResolver(
        'straddling:actor_im_straddling',
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
      'personal-space:actors_sitting_with_space_to_right':
        this.createComponentFilterResolver(
          'personal-space:actors_sitting_with_space_to_right',
          {
            componentType: 'positioning:sitting_on',
            filterFn: (entityId, context, em) => {
              const sitting = em.getComponentData(
                entityId,
                'positioning:sitting_on'
              );
              if (
                !sitting?.furniture_id ||
                typeof sitting.spot_index !== 'number'
              ) {
                return false;
              }

              const furniture = em.getComponentData(
                sitting.furniture_id,
                'sitting:allows_sitting'
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
      'sitting:available_furniture': this.createLocationMatchResolver(
        'sitting:available_furniture',
        {
          filterFn: (entityId, source, context, em) => {
            if (!em.hasComponent(entityId, 'sitting:allows_sitting')) {
              return false;
            }

            const furniture = em.getComponentData(
              entityId,
              'sitting:allows_sitting'
            );

            // Check if furniture has at least one empty spot
            return (
              furniture?.spots &&
              furniture.spots.some(
                (spot) => spot === null || spot === undefined
              )
            );
          },
        }
      ),

      // "available lying furniture" - Furniture allowing lying at location
      'lying:available_lying_furniture': this.createLocationMatchResolver(
        'lying:available_lying_furniture',
        {
          filterFn: (entityId, source, context, em) => {
            return em.hasComponent(entityId, 'lying:allows_lying_on');
          },
        }
      ),

      // "furniture im lying on" - Current lying surface
      'lying:furniture_im_lying_on': this.createComponentLookupResolver(
        'lying:furniture_im_lying_on',
        {
          componentType: 'positioning:lying_down',
          sourceField: 'furniture_id',
          contextSource: 'actor',
        }
      ),

      // "furniture im sitting on" - Current sitting surface (alias for furniture_actor_sitting_on)
      'sitting:furniture_im_sitting_on': this.createComponentLookupResolver(
        'sitting:furniture_im_sitting_on',
        {
          componentType: 'positioning:sitting_on',
          sourceField: 'furniture_id',
          contextSource: 'actor',
        }
      ),

      // "surface im bending over" - Bending-over surface lookup
      'bending:surface_im_bending_over': this.createComponentLookupResolver(
        'bending:surface_im_bending_over',
        {
          componentType: 'bending-states:bending_over',
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
              'personal-space-states:closeness'
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
            return (
              em.hasComponent(entityId, 'items:item') &&
              em.hasComponent(entityId, 'items:portable')
            );
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

      // "non-portable items at location"
      'items:non_portable_items_at_location': this.createLocationMatchResolver(
        'items:non_portable_items_at_location',
        {
          filterFn: (entityId, source, context, em) => {
            return (
              em.hasComponent(entityId, 'items:item') &&
              !em.hasComponent(entityId, 'items:portable')
            );
          },
        }
      ),

      // "items at actor's location" (union of portable and non-portable)
      'items:items_at_actor_location': this.createLocationMatchResolver(
        'items:items_at_actor_location',
        {
          filterFn: (entityId, source, context, em) => {
            return em.hasComponent(entityId, 'items:item');
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
      'containers-core:containers_at_location': this.createLocationMatchResolver(
        'containers-core:containers_at_location',
        {
          filterFn: (entityId, source, context, em) => {
            return em.hasComponent(entityId, 'containers-core:container');
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
   * Register all clothing-related scope resolvers.
   * Covers common clothing mod scopes used in tests.
   *
   * @param {object} testEnv - Test environment from ModTestFixture
   */
  static registerClothingScopes(testEnv) {
    const logger = testEnv.logger || console;

    const resolvers = {
      // "topmost clothing items worn by actor"
      'clothing:topmost_clothing': function (context) {
        // Get CURRENT entityManager from testEnv (not captured at registration time)
        const currentEntityManager = testEnv.entityManager;

        const { entityId: actorEntityId } = resolveContextEntity(
          context,
          'actor',
          currentEntityManager
        );

        if (!actorEntityId) {
          return { success: true, value: new Set() };
        }

        try {
          // Create ClothingAccessibilityService with CURRENT entityManager
          const clothingService = new ClothingAccessibilityService({
            logger,
            entityManager: currentEntityManager,
            entitiesGateway: testEnv.entitiesGateway || null,
          });

          // Use ClothingAccessibilityService to get accessible items
          const accessibleItems = clothingService.getAccessibleItems(
            actorEntityId,
            { mode: 'topmost', context: 'removal' }
          );

          // Convert array to Set
          return {
            success: true,
            value: new Set(accessibleItems),
          };
        } catch (error) {
          logger.warn('Failed to resolve clothing:topmost_clothing scope', {
            actorId: actorEntityId,
            error: error.message,
          });
          return { success: true, value: new Set() };
        }
      },
    };

    // Register all resolvers
    this._registerResolvers(testEnv, testEnv.entityManager, resolvers);
  }

  /**
   * Convenience method for registering a custom scope without a ModTestFixture instance.
   * Automatically loads the scope file, parses it, creates a resolver,
   * and registers it with the UnifiedScopeResolver.
   *
   * This method mirrors the complete implementation from ModTestFixture.registerCustomScope(),
   * including automatic condition loading for scopes that use condition_ref.
   *
   * @param {object} testEnv - Test environment from createSystemLogicTestEnv()
   * @param {string} modId - The mod containing the scope
   * @param {string} scopeName - The scope name (without .scope extension)
   * @param {object} [options] - Configuration options
   * @param {boolean} [options.loadConditions] - Whether to automatically load condition dependencies
   * @param {number} [options.maxDepth] - Maximum recursion depth for transitive dependency discovery
   * @returns {Promise<void>}
   * @throws {Error} If scope file not found, parsing fails, or referenced conditions are missing
   * @example
   * // Register a custom scope (conditions loaded automatically)
   * await ScopeResolverHelpers.registerCustomScope(
   *   testEnv,
   *   'sex-anal-penetration',
   *   'actors_with_exposed_asshole_accessible_from_behind'
   * );
   * @example
   * // Register a scope without loading conditions
   * await ScopeResolverHelpers.registerCustomScope(
   *   testEnv,
   *   'positioning',
   *   'close_actors',
   *   { loadConditions: false }
   * );
   */
  static async registerCustomScope(testEnv, modId, scopeName, options = {}) {
    const { loadConditions = true, maxDepth = 5 } = options;
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

    // Load condition dependencies if requested (mirrors ModTestFixture.registerCustomScope)
    if (loadConditions) {
      // Extract condition references from the parsed AST
      const conditionRefs =
        ScopeConditionAnalyzer.extractConditionRefs(scopeData);

      if (conditionRefs.size > 0) {
        // Discover transitive dependencies
        const allConditions =
          await ScopeConditionAnalyzer.discoverTransitiveDependencies(
            Array.from(conditionRefs),
            ScopeConditionAnalyzer.loadConditionDefinition.bind(
              ScopeConditionAnalyzer
            ),
            maxDepth
          );

        // Validate conditions exist
        const validation = await ScopeConditionAnalyzer.validateConditions(
          allConditions,
          scopePath
        );

        if (validation.missing.length > 0) {
          throw new Error(
            `Scope "${fullScopeName}" references missing conditions:\n` +
              validation.missing.map((id) => `  - ${id}`).join('\n') +
              `\n\nReferenced in: ${scopePath}`
          );
        }

        // Load all discovered conditions into the test environment registry
        await this._loadConditionsIntoRegistry(
          testEnv,
          Array.from(allConditions)
        );
      }
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
        tracer: context?.tracer, // Pass tracer from context for scope tracing
        get container() {
          // Prefer a real container if the test environment exposes one
          if (testEnv.container && typeof testEnv.container.resolve === 'function') {
            return testEnv.container;
          }

          // Fallback: synthesize a minimal container that can serve BodyGraphService
          if (testEnv.bodyGraphService) {
            return {
              resolve: (token) =>
                token === coreTokens.BodyGraphService ? testEnv.bodyGraphService : undefined,
            };
          }

          return null;
        },
      };

      try {
        // Extract actorEntity from context - ScopeEngine expects just actorEntity, not full context
        // The context can be:
        // 1. An entity directly (has id, components)
        // 2. An enriched context object (has actorEntity property from _registerResolvers)
        // 3. An actor context (has actor property)
        const actorEntity = context.actorEntity || context.actor || context;

        // Validate the extracted actorEntity to ensure it's an entity instance
        // Skip validation if context was enriched by _registerResolvers (has tracer + actorEntity)
        // In that case, the entity was already validated as having id/components
        const isEnrichedContext = context?.tracer && context?.actorEntity;
        if (!isEnrichedContext) {
          ParameterValidator.validateActorEntity(
            actorEntity,
            `ScopeResolverHelpers.registerCustomScope[${fullScopeName}]`
          );
        }

        const result = scopeEngine.resolve(
          scopeData.ast,
          actorEntity,
          runtimeCtx
        );
        return { success: true, value: result };
      } catch (err) {
        if (err instanceof ParameterValidationError) {
          // Enhanced error with full context for test debugging
          return {
            success: false,
            error: err.toString(),
            context: err.context,
          };
        }

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
      testEnv._originalResolveSync =
        testEnv.unifiedScopeResolver.resolveSync.bind(
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
    // The second parameter can be either an actorEntity or a context object.
    // We need to ensure the tracer is available to the custom resolvers.
    testEnv.unifiedScopeResolver.resolveSync = (scopeName, contextOrActor) => {
      // Check if the input already has a tracer
      // If not, and we have a testEnv._scopeTracer, inject it
      let enrichedInput = contextOrActor;

      // Only inject tracer if:
      // 1. testEnv._scopeTracer exists
      // 2. Input doesn't already have a tracer
      if (testEnv._scopeTracer && !contextOrActor?.tracer) {
        // Don't modify the original, create a shallow copy with tracer
        // If it's an entity (has id and components), wrap in context
        if (contextOrActor?.id && contextOrActor?.components) {
          enrichedInput = {
            actorEntity: contextOrActor,
            tracer: testEnv._scopeTracer,
          };
        } else if (contextOrActor && typeof contextOrActor === 'object') {
          // It's likely a context object, add tracer to it
          enrichedInput = {
            ...contextOrActor,
            tracer: testEnv._scopeTracer,
          };
        }
      }

      // Check if we have a registered resolver for this scope
      if (testEnv._registeredResolvers.has(scopeName)) {
        return testEnv._registeredResolvers.get(scopeName)(enrichedInput);
      }

      // Fall back to original resolver
      return testEnv._originalResolveSync.call(
        testEnv.unifiedScopeResolver,
        scopeName,
        enrichedInput
      );
    };
  }

  /**
   * Internal helper to load condition definitions into the test environment's data registry.
   * Mirrors the logic from ModTestFixture.loadDependencyConditions().
   *
   * @private
   * @param {object} testEnv - Test environment
   * @param {string[]} conditionIds - Array of condition IDs to load (e.g., ["positioning:actor-facing"])
   * @returns {Promise<void>}
   * @throws {Error} If condition files cannot be loaded
   */
  static async _loadConditionsIntoRegistry(testEnv, conditionIds) {
    // Initialize loaded conditions map if not exists
    if (!testEnv._loadedConditions) {
      testEnv._loadedConditions = new Map();
    }

    // Load each condition
    const loadPromises = conditionIds.map(async (id) => {
      // Skip if already loaded
      if (testEnv._loadedConditions.has(id)) {
        return;
      }

      // Validate ID format
      if (typeof id !== 'string' || !id.includes(':')) {
        throw new Error(
          `Invalid condition ID format: "${id}". Expected "modId:conditionId"`
        );
      }

      const parts = id.split(':');
      if (parts.length !== 2 || !parts[0] || !parts[1]) {
        throw new Error(
          `Invalid condition ID format: "${id}". Expected "modId:conditionId"`
        );
      }

      const [modId, conditionName] = parts;

      // Construct file path (absolute path from project root)
      const conditionPath = resolve(
        process.cwd(),
        `data/mods/${modId}/conditions/${conditionName}.condition.json`
      );

      try {
        // Read condition file
        const conditionContent = await fs.readFile(conditionPath, 'utf-8');
        const conditionDef = JSON.parse(conditionContent);

        // Store for later lookup
        testEnv._loadedConditions.set(id, conditionDef);
      } catch (err) {
        throw new Error(
          `Failed to load condition "${id}" from ${conditionPath}: ${err.message}`
        );
      }
    });

    // Wait for all conditions to load
    await Promise.all(loadPromises);

    // Extend the dataRegistry to return loaded conditions
    // Store original if not already stored
    if (!testEnv._originalGetConditionDefinition) {
      testEnv._originalGetConditionDefinition =
        testEnv.dataRegistry.getConditionDefinition.bind(testEnv.dataRegistry);
    }

    // Override getConditionDefinition to check loaded conditions first
    testEnv.dataRegistry.getConditionDefinition = (id) => {
      // Check if this is one of our loaded conditions
      if (testEnv._loadedConditions.has(id)) {
        return testEnv._loadedConditions.get(id);
      }
      // Chain to original (may be another extended version or the base implementation)
      return testEnv._originalGetConditionDefinition(id);
    };
  }
}
