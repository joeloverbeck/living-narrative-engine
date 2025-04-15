// src/conditions/handlers/handleTargetDistanceCondition.js

// Keep necessary imports
/** @typedef {import('../../entities/entity.js').default} Entity */
/** @typedef {import('../../../data/schemas/item.schema.json').definitions.ConditionObject} ConditionObjectData */
/** @typedef {import('../../services/conditionEvaluationService.js').ConditionEvaluationContext} ConditionEvaluationContext */
/** @typedef {import('../../services/conditionEvaluationService.js').ConditionHandlerFunction} ConditionHandlerFunction */
/** @typedef {import('../../components/positionComponent.js').PositionComponent} PositionComponent */

import {getNumberParam} from '../../utils/conditionParamUtils.js'
import {calculateDistanceSquared} from '../../utils/geometryUtils.js';

/**
 * Condition handler for 'target_distance'.
 * Checks if the distance between the user entity and the objectToCheck (expected Entity) is within a given range.
 * Uses squared distances for comparison to avoid unnecessary Math.sqrt calls.
 * @type {ConditionHandlerFunction}
 */
export const handleTargetDistanceCondition = (objectToCheck, context, conditionData) => {
    const {userEntity, dataAccess} = context; // Use dataAccess
    const maxDistance = getNumberParam(conditionData, 'max_distance');
    const minDistance = getNumberParam(conditionData, 'min_distance', 0); // Default min distance is 0

    // Validate distance parameters
    if (maxDistance === null || maxDistance < 0 || minDistance === null || minDistance < 0 || maxDistance < minDistance) {
        console.warn(`[ConditionHandler] Invalid distance parameters for target_distance: min=${minDistance}, max=${maxDistance}`);
        return false;
    }

    // Ensure objectToCheck is an Entity
    if (typeof objectToCheck?.getComponent !== 'function') {
        console.warn(`[ConditionHandler] Condition 'target_distance' used on non-entity target. Condition fails.`);
        return false;
    }
    // Ensure user is an entity
    if (typeof userEntity?.getComponent !== 'function') {
        console.error(`[ConditionHandler] User entity invalid for 'target_distance'. Condition fails.`);
        return false;
    }

    // Handle distance to self
    if (objectToCheck.id === userEntity.id) {
        // If minDistance is 0, the condition is met. Otherwise, it's not.
        return 0 >= minDistance && 0 <= maxDistance;
    }

    // Get PositionComponent class via dataAccess
    const PositionComponentClass = dataAccess.getComponentClassByKey('Position');
    if (!PositionComponentClass) {
        console.warn("[ConditionHandler] Position component class not found via dataAccess. Cannot check distance.");
        return false;
    }

    // Get PositionComponent instances from entities
    /** @type {PositionComponent | null} */
    const userPosComp = userEntity.getComponent(PositionComponentClass);
    /** @type {PositionComponent | null} */
    const targetPosComp = objectToCheck.getComponent(PositionComponentClass);

    // Check if both components exist and are in the same location
    if (!userPosComp || !targetPosComp || !userPosComp.locationId || userPosComp.locationId !== targetPosComp.locationId) {
        // If positions are invalid or entities are in different locations, they are effectively infinitely far apart
        // for the purpose of this check (or at least, not within any reasonable maxDistance).
        return false;
    }

    // The utility handles default coordinates (e.g., 0) if x/y are missing
    const distanceSq = calculateDistanceSquared(userPosComp, targetPosComp);
    // Handle potential NaN result from utility if input was somehow invalid despite checks
    if (isNaN(distanceSq)) {
        console.warn(`[ConditionHandler] Distance calculation resulted in NaN between ${userEntity.id} and ${objectToCheck.id}.`);
        return false;
    }

    // Compare squared distances
    const minDistanceSq = minDistance * minDistance;
    const maxDistanceSq = maxDistance * maxDistance;

    return distanceSq >= minDistanceSq && distanceSq <= maxDistanceSq;
};