// src/conditions/handlers/handleConnectionStateIsCondition.js

/** @typedef {import('../../entities/entityManager.js').default} EntityManager */
/** @typedef {import('../../entities/entity.js').default} Entity */
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
    const requiredState = getStringParam(conditionData, 'state');

    if (requiredState === null) {
        console.warn(`[ConditionHandler] connection_state_is condition missing required 'state' parameter.`);
        return false;
    }

    // This condition makes sense only if objectToCheck is a Connection
    // Duck-type check: Has connectionId and NO getComponent method (to differentiate from Entity)
    if (!objectToCheck || typeof objectToCheck.getComponent === 'function' || !objectToCheck.connectionId) {
        // console.warn(`[ConditionHandler] 'connection_state_is' used on non-connection object. Condition fails.`);
        return false; // Not a connection object (or not the expected shape)
    }

    // Cast for type safety after check (optional, depends on JS/TS setup)
    /** @type {Connection} */
    const connection = objectToCheck;

    return connection.state === requiredState;
};