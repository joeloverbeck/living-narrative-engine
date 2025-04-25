// src/conditions/operationHandlers/handlePlayerInLocationCondition.js

// Keep necessary imports
/** @typedef {import('../../entities/entity.js').default} Entity */
/** @typedef {import('../../services/conditionEvaluationService.js').ConditionEvaluationContext} ConditionEvaluationContext */
/** @typedef {import('../../services/conditionEvaluationService.js').ConditionHandlerFunction} ConditionHandlerFunction */

import {getStringParam} from '../../utils/conditionParamUtils.js'

/**
 * Condition handler for 'player_in_location'.
 * Checks if the user entity is in the specified location.
 * @type {ConditionHandlerFunction}
 */
export const handlePlayerInLocationCondition = (objectToCheck, context, conditionData) => {
    const {userEntity, dataAccess} = context; // Use dataAccess
    const requiredLocationId = getStringParam(conditionData, 'location_id');

    if (requiredLocationId === null) {
        console.warn(`[ConditionHandler] player_in_location condition missing required 'location_id' parameter.`);
        return false;
    }

    const PositionComponentClass = dataAccess.getComponentClassByKey('Position');
    if (!PositionComponentClass) {
        console.warn("[ConditionHandler] Position component class not found via dataAccess.");
        return false;
    }

    if (!userEntity || typeof userEntity.getComponent !== 'function') {
        console.error(`[ConditionHandler] player_in_location: Invalid userEntity!`);
        return false;
    }

    // Use the retrieved class with the entity's getComponent method
    const userPosComp = userEntity.getComponent(PositionComponentClass);

    return userPosComp?.locationId === requiredLocationId;
};