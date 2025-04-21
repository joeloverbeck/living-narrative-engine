// src/conditions/handlers/handleTargetDistanceCondition.js

// Keep necessary imports
/** @typedef {import('../../entities/entity.js').default} Entity */
/** @typedef {import('../../services/conditionEvaluationService.js').ConditionEvaluationContext} ConditionEvaluationContext */
/** @typedef {import('../../services/conditionEvaluationService.js').ConditionHandlerFunction} ConditionHandlerFunction */

import {getNumberParam} from '../../utils/conditionParamUtils.js';
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

    // Ensure objectToCheck is an Entity (basic check)
    // Note: dataAccess.getComponentForEntity will perform a more robust check later
    if (typeof objectToCheck?.id === 'undefined') { // Check if it vaguely looks like an entity/object we can process
        console.warn(`[ConditionHandler] Condition 'target_distance' used on potentially non-entity target. Condition fails.`);
        return false;
    }
    // Ensure user is an entity
    if (typeof userEntity?.id === 'undefined') {
        console.error(`[ConditionHandler] User entity invalid for 'target_distance'. Condition fails.`);
        return false;
    }

    // Handle distance to self
    if (objectToCheck.id === userEntity.id) {
        // If minDistance is 0, the condition is met. Otherwise, it's not.
        // Comparison logic is correct here.
        return 0 >= minDistance && 0 <= maxDistance;
    }

    // --- CHANGE START ---

    // Get PositionComponent class via dataAccess
    const PositionComponentClass = dataAccess.getComponentClassByKey('Position');
    if (!PositionComponentClass) {
        // Use console.error as this is a setup issue if Position isn't registered
        console.error("[ConditionHandler] Position component class not registered/found via dataAccess. Cannot check distance.");
        return false;
    }

    // Get PositionComponent instances using dataAccess
    const userPosComp = (dataAccess.getComponentForEntity(userEntity, PositionComponentClass));
    const targetPosComp = (dataAccess.getComponentForEntity(/** @type {Entity} */ (objectToCheck), PositionComponentClass));

    // --- CHANGE END ---

    // Check if both components exist and are in the same location
    // (Make sure locationId, x, y properties exist on the actual PositionComponent)
    if (!userPosComp || !targetPosComp || typeof userPosComp.locationId === 'undefined' || userPosComp.locationId !== targetPosComp.locationId) {
        // If positions are invalid/missing or entities are in different locations, they are effectively infinitely far apart.
        // Log if components are missing specifically
        if (!userPosComp) console.warn(`[ConditionHandler] User entity ${userEntity.id} missing Position component for distance check.`);
        if (!targetPosComp) console.warn(`[ConditionHandler] Target entity ${objectToCheck.id} missing Position component for distance check.`);
        return false;
    }

    // The utility handles default coordinates (e.g., 0) if x/y are missing
    const distanceSq = calculateDistanceSquared(userPosComp, targetPosComp);

    // Handle potential NaN result from utility if input was somehow invalid despite checks
    if (isNaN(distanceSq)) {
        console.warn(`[ConditionHandler] Distance calculation resulted in NaN between ${userEntity.id} and ${objectToCheck.id}.`);
        return false;
    }

    // Compare squared distances - This logic was already correct.
    const minDistanceSq = minDistance * minDistance;
    const maxDistanceSq = maxDistance * maxDistance;

    // --- TEMPORARY DEBUG LOGGING ---
    console.log(`--- Debug target_distance ---`);
    console.log(`Entity IDs: User=${userEntity.id}, Target=${objectToCheck.id}`);
    console.log(`Input Params: min=${minDistance}, max=${maxDistance}`);
    // console.log('User Pos Comp:', userPosComp); // Log object structure if needed
    // console.log('Target Pos Comp:', targetPosComp); // Log object structure if needed
    console.log(`Calculated: distanceSq=${distanceSq} (type: ${typeof distanceSq})`);
    console.log(`Compared vs: minDistanceSq=${minDistanceSq} (type: ${typeof minDistanceSq}), maxDistanceSq=${maxDistanceSq} (type: ${typeof maxDistanceSq})`);
    console.log(`Check 1 (>= min): ${distanceSq >= minDistanceSq}`);
    console.log(`Check 2 (<= max): ${distanceSq <= maxDistanceSq}`);
    console.log(`Final Result: ${distanceSq >= minDistanceSq && distanceSq <= maxDistanceSq}`);
    console.log(`--------------------------`);
    // --- END DEBUG LOGGING ---

    return distanceSq >= minDistanceSq && distanceSq <= maxDistanceSq;
};