// src/conditions/handlers/handleConnectionStateIsCondition.js

// Keep necessary imports (no EntityManager was needed)
/** @typedef {import('../../components/connectionsComponent.js').Connection} Connection */
/** @typedef {import('../../../data/schemas/item.schema.json').definitions.ConditionObject} ConditionObjectData */
/** @typedef {import('../../services/conditionEvaluationService.js').ConditionEvaluationContext} ConditionEvaluationContext */
/** @typedef {import('../../services/conditionEvaluationService.js').ConditionHandlerFunction} ConditionHandlerFunction */

import {getStringParam} from '../../utils/conditionUtils.js';

/**
 * Condition handler for 'connection_state_is'.
 * Checks if the objectToCheck (expected Connection) has a specific state value.
 * @type {ConditionHandlerFunction}
 */
export const handleConnectionStateIsCondition = (objectToCheck, context, conditionData) => {
    // No context.entityManager or context.dataAccess was used here.
    const requiredState = getStringParam(conditionData, 'state');

    if (requiredState === null) {
        console.warn(`[ConditionHandler] connection_state_is condition missing required 'state' parameter.`);
        return false;
    }

    if (!objectToCheck || typeof objectToCheck.getComponent === 'function' || !objectToCheck.connectionId) {
        return false;
    }

    /** @type {Connection} */
    const connection = objectToCheck;
    return connection.state === requiredState;
};