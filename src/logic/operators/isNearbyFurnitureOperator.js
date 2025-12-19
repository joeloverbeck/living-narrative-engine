/**
 * @file isNearbyFurnitureOperator.js
 * @description JSON Logic operator to check if an entity IS the nearby furniture
 * that the actor can access while seated.
 */

import { validateDependency } from '../../utils/dependencyUtils.js';

/**
 * @class IsNearbyFurnitureOperator
 * @description Checks if an entity IS the nearby furniture that the actor
 * can access while seated (i.e., in the nearFurnitureIds list).
 *
 * Usage in JSON Logic:
 * {"isNearbyFurniture": [{"var": "entity.id"}]}
 *
 * Returns true if:
 * 1. Actor has sitting-states:sitting_on component
 * 2. The furniture actor is sitting on has furniture:near_furniture component
 * 3. The entity ID is in the nearFurnitureIds array
 *
 * NOTE: This operator checks if an entity IS nearby furniture (for targeting
 * furniture surfaces like tables that are containers).
 */
export class IsNearbyFurnitureOperator {
  /** @private */
  #entityManager;
  /** @private */
  #logger;

  /**
   * @param {Object} params - Dependencies
   * @param {Object} params.entityManager - Entity manager for lookups
   * @param {Object} params.logger - Logger instance
   */
  constructor({ entityManager, logger }) {
    validateDependency(entityManager, 'IEntityManager', logger, {
      requiredMethods: ['getComponentData'],
    });

    this.#entityManager = entityManager;
    this.#logger = logger;
  }

  /**
   * Evaluates whether the entity IS the nearby furniture.
   *
   * @param {Array} args - [entityId]
   * @param {Object} context - Evaluation context containing actor
   * @returns {boolean} True if entity is nearby furniture
   */
  evaluate(args, context) {
    const [entityId] = args;

    try {
      const actorId = context?.actor?.id;

      if (!actorId) {
        this.#logger.debug('isNearbyFurniture: No actor in context');
        return false;
      }

      // Check if actor is sitting
      const sittingOn = this.#entityManager.getComponentData(
        actorId,
        'sitting-states:sitting_on'
      );

      if (!sittingOn) {
        this.#logger.debug(
          `isNearbyFurniture: Actor ${actorId} is not sitting`
        );
        return false;
      }

      const furnitureId = sittingOn.furniture_id;
      if (!furnitureId) {
        this.#logger.debug(
          'isNearbyFurniture: No furniture_id in sitting_on component'
        );
        return false;
      }

      // Get the near_furniture component from the furniture actor is sitting on
      const nearFurniture = this.#entityManager.getComponentData(
        furnitureId,
        'furniture:near_furniture'
      );

      if (!nearFurniture || !Array.isArray(nearFurniture.nearFurnitureIds)) {
        this.#logger.debug(
          `isNearbyFurniture: Furniture ${furnitureId} has no near_furniture relationships`
        );
        return false;
      }

      // Check if the entity IS in the nearFurnitureIds list
      if (nearFurniture.nearFurnitureIds.includes(entityId)) {
        this.#logger.debug(
          `isNearbyFurniture: Entity ${entityId} is nearby furniture (in nearFurnitureIds of ${furnitureId})`
        );
        return true;
      }

      this.#logger.debug(
        `isNearbyFurniture: Entity ${entityId} is not in nearFurnitureIds of ${furnitureId}`
      );
      return false;
    } catch (err) {
      this.#logger.error('isNearbyFurniture operator error:', err);
      return false;
    }
  }
}

export default IsNearbyFurnitureOperator;
