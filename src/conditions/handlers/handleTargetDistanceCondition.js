// src/conditions/handlers/handleTargetDistanceCondition.js

/** @typedef {import('../../entities/entityManager.js').default} EntityManager */
/** @typedef {import('../../entities/entity.js').default} Entity */
/** @typedef {import('../../components/connectionsComponent.js').Connection} Connection */
/** @typedef {import('../../../data/schemas/item.schema.json').definitions.ConditionObject} ConditionObjectData */
/** @typedef {import('../../services/conditionEvaluationService.js').ConditionEvaluationContext} ConditionEvaluationContext */
/** @typedef {import('../../services/conditionEvaluationService.js').ConditionHandlerFunction} ConditionHandlerFunction */

import {getNumberParam} from '../../utils/conditionUtils.js';

/**
 * Condition handler for 'target_distance'.
 * Checks if the distance between the user entity and the objectToCheck (expected Entity) is within a given range.
 * @type {ConditionHandlerFunction}
 */
export const handleTargetDistanceCondition = (objectToCheck, context, conditionData) => {
    const {userEntity, entityManager} = context;
    const maxDistance = getNumberParam(conditionData, 'max_distance');
    const minDistance = getNumberParam(conditionData, 'min_distance', 0);

    if (maxDistance === null || maxDistance < 0 || minDistance === null || minDistance < 0 || maxDistance < minDistance) {
        console.warn(`[ConditionHandler] Invalid distance parameters for target_distance: min=<span class="math-inline">\{minDistance\}, max\=</span>{maxDistance}`);
        return false;
    }

    // Ensure objectToCheck is an Entity
    if (typeof objectToCheck?.getComponent !== 'function') {
        // Use the exact message expected by the test
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

    const PositionComponent = entityManager.componentRegistry.get('Position');
    if (!PositionComponent) {
        console.warn("[ConditionHandler] Position component class not registered.");
        return false;
    }

    const userPosComp = userEntity.getComponent(PositionComponent);
    const targetPosComp = objectToCheck.getComponent(PositionComponent);

    // Cannot calculate distance if either is missing position or they are in different locations
    if (!userPosComp || !targetPosComp || !userPosComp.locationId || userPosComp.locationId !== targetPosComp.locationId) {
        return false;
    }

    // Use 0 for undefined x/y coordinates within the same location
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
