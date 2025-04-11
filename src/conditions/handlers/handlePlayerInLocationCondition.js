// src/conditions/handlers/handlePlayerInLocationCondition.js

/** @typedef {import('../../entities/entityManager.js').default} EntityManager */
/** @typedef {import('../../entities/entity.js').default} Entity */
/** @typedef {import('../../components/connectionsComponent.js').Connection} Connection */
/** @typedef {import('../../../data/schemas/item.schema.json').definitions.ConditionObject} ConditionObjectData */
/** @typedef {import('../../services/conditionEvaluationService.js').ConditionEvaluationContext} ConditionEvaluationContext */
/** @typedef {import('../../services/conditionEvaluationService.js').ConditionHandlerFunction} ConditionHandlerFunction */

import {getStringParam} from '../../utils/conditionUtils.js';

/**
 * Condition handler for 'player_in_location'.
 * Checks if the user entity is in the specified location.
 * @type {ConditionHandlerFunction}
 */
export const handlePlayerInLocationCondition = (objectToCheck, context, conditionData) => {
    const {userEntity, entityManager} = context;
    const requiredLocationId = getStringParam(conditionData, 'location_id');

    if (requiredLocationId === null) {
        console.warn(`[ConditionHandler] player_in_location condition missing required 'location_id' parameter.`);
        return false; // Fail explicitly if parameter missing
    }

    const PositionComponentClass = entityManager.componentRegistry.get('Position');

    if (!PositionComponentClass) {
        console.warn("[ConditionHandler] Position component class not registered.");
        return false;
    }

    if (!userEntity || typeof userEntity.getComponent !== 'function') {
        console.error(`[ConditionHandler] player_in_location: Invalid userEntity!`);
        return false;
    }

    const userPosComp = userEntity.getComponent(PositionComponentClass);

    return userPosComp?.locationId === requiredLocationId;
};