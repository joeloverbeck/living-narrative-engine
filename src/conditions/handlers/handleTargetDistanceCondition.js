// src/conditions/handlers/handleTargetDistanceCondition.js

// Keep necessary imports
/** @typedef {import('../../entities/entity.js').default} Entity */
/** @typedef {import('../../../data/schemas/item.schema.json').definitions.ConditionObject} ConditionObjectData */
/** @typedef {import('../../services/conditionEvaluationService.js').ConditionEvaluationContext} ConditionEvaluationContext */
/** @typedef {import('../../services/conditionEvaluationService.js').ConditionHandlerFunction} ConditionHandlerFunction */
/** @typedef {import('../../components/positionComponent.js').PositionComponent} PositionComponent */

import {getNumberParam} from '../../utils/conditionUtils.js';

/**
 * Condition handler for 'target_distance'.
 * Checks if the distance between the user entity and the objectToCheck (expected Entity) is within a given range.
 * @type {ConditionHandlerFunction}
 */
export const handleTargetDistanceCondition = (objectToCheck, context, conditionData) => {
    const {userEntity, dataAccess} = context; // Use dataAccess
    const maxDistance = getNumberParam(conditionData, 'max_distance');
    const minDistance = getNumberParam(conditionData, 'min_distance', 0);

    if (maxDistance === null || maxDistance < 0 || minDistance === null || minDistance < 0 || maxDistance < minDistance) {
        console.warn(`[ConditionHandler] Invalid distance parameters for target_distance: min=${minDistance}, max=${maxDistance}`);
        return false;
    }

    // Ensure objectToCheck is an Entity
    if (typeof objectToCheck?.getComponent !== 'function') {
        console.warn(`ConditionEvaluationService: Condition 'target_distance' used on non-entity target. Condition fails.`);
        return false;
    }
    // Ensure user is an entity
    if (typeof userEntity?.getComponent !== 'function') {
        console.error(`[ConditionHandler] User entity invalid for 'target_distance'. Condition fails.`);
        return false;
    }

    // Distance to self is 0
    if (objectToCheck.id === userEntity.id) {
        return 0 >= minDistance && 0 <= maxDistance;
    }

    // --- MODIFIED: Use dataAccess to get component class ---
    const PositionComponentClass = dataAccess.getComponentClassByKey('Position');
    if (!PositionComponentClass) {
        console.warn("[ConditionHandler] Position component class not found via dataAccess.");
        return false;
    }

    // Use the retrieved class with the entity's getComponent method
    /** @type {PositionComponent | null} */
    const userPosComp = userEntity.getComponent(PositionComponentClass);
    /** @type {PositionComponent | null} */
    const targetPosComp = objectToCheck.getComponent(PositionComponentClass);

    if (!userPosComp || !targetPosComp || !userPosComp.locationId || userPosComp.locationId !== targetPosComp.locationId) {
        return false;
    }

    const ux = userPosComp.x ?? 0;
    const uy = userPosComp.y ?? 0;
    const tx = targetPosComp.x ?? 0;
    const ty = targetPosComp.y ?? 0;

    const dx = ux - tx;
    const dy = uy - ty;
    const distanceSq = dx * dx + dy * dy;
    const minDistanceSq = minDistance * minDistance;
    const maxDistanceSq = maxDistance * maxDistance;

    return distanceSq >= minDistanceSq && distanceSq <= maxDistanceSq;
};