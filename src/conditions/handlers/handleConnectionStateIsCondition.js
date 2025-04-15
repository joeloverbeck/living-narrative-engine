// src/conditions/handlers/handleConnectionStateIsCondition.js

// --- Necessary Imports ---
// JSDoc Type Imports
/** @typedef {import('../../components/connectionsComponent.js').Connection} Connection */ // Keep for backward compatibility reference
/** @typedef {import('../../../data/schemas/item.schema.json').definitions.ConditionObject} ConditionObjectData */
/** @typedef {import('../../services/conditionEvaluationService.js').ConditionEvaluationContext} ConditionEvaluationContext */
/** @typedef {import('../../services/conditionEvaluationService.js').ConditionHandlerFunction} ConditionHandlerFunction */
/** @typedef {import('../../entities/entity.js').default} Entity */ // Needed for type checking

// Class/Module Imports
import {getStringParam} from '../../utils/conditionUtils.js';
// Import the component class needed for the entity lookup
import {PassageDetailsComponent} from '../../components/passageDetailsComponent.js';

/**
 * Condition handler for 'connection_state_is'.
 * Checks if the objectToCheck (either a Connection Entity with PassageDetailsComponent
 * or a plain Connection structure) has a specific state value.
 *
 * @type {ConditionHandlerFunction}
 * @param {Entity | Connection | object} objectToCheck - The object to check. Expected to be an Entity with PassageDetailsComponent or a plain Connection-like object.
 * @param {ConditionEvaluationContext} context - The evaluation context, including dataAccess.
 * @param {ConditionObjectData} conditionData - The condition data containing the 'state' parameter.
 * @returns {boolean} - True if the state matches the required state, false otherwise.
 */
export const handleConnectionStateIsCondition = (objectToCheck, context, conditionData) => {
    // --- 1. Get Required State ---
    const requiredState = getStringParam(conditionData, 'state');

    if (requiredState === null) {
        // AC4: Handle missing required 'state' parameter
        console.warn(`[ConditionHandler:connection_state_is] Condition missing required 'state' parameter in conditionData:`, conditionData);
        return false;
    }

    // --- 2. Basic Input Validation ---
    if (!objectToCheck) {
        console.warn(`[ConditionHandler:connection_state_is] Received null or undefined objectToCheck.`);
        return false;
    }

    // --- 3. Check if objectToCheck is an Entity ---
    // AC1: Check if objectToCheck is an entity
    const isEntity = typeof objectToCheck?.getComponent === 'function';

    let currentState = undefined; // Variable to hold the state found

    if (isEntity) {
        // --- 3.a Entity Path ---
        /** @type {Entity} */
        const entityToCheck = objectToCheck; // Cast for clarity

        // AC2: Attempt to retrieve PassageDetailsComponent using context.dataAccess
        const passageComponent = context.dataAccess.getComponentForEntity(entityToCheck, PassageDetailsComponent);

        if (passageComponent) {
            // AC3: Get state from the component
            // Note: Ensure PassageDetailsComponent *has* a getState() method as expected.
            if (typeof passageComponent.getState === 'function') {
                currentState = passageComponent.getState();
            } else {
                // This case should ideally not happen if the component adheres to its interface
                console.error(`[ConditionHandler:connection_state_is] PassageDetailsComponent on entity ${entityToCheck.id} lacks a getState() method.`);
                return false; // Treat as failure if method is missing
            }
        } else {
            // AC4: Handle entity lacking the required component
            console.warn(`[ConditionHandler:connection_state_is] Entity ${entityToCheck.id} was checked, but it lacks the required PassageDetailsComponent.`);
            return false;
        }
    } else {
        // --- 3.b Non-Entity Path (Backward Compatibility) ---
        // AC5: Process non-entity inputs (assuming old Connection structure)
        // The original code implicitly checked for `objectToCheck.state`.
        // We retain this logic for plain objects.
        if (Object.prototype.hasOwnProperty.call(objectToCheck, 'state')) {
            /** @type {Connection | object} */ // Could be the old Connection type or similar POJO
            const plainConnectionObject = objectToCheck;
            currentState = plainConnectionObject.state;
        } else {
            // The object is neither an entity nor does it have a 'state' property directly.
            console.warn(`[ConditionHandler:connection_state_is] Input object is not an entity and lacks a 'state' property. Cannot evaluate condition.`, objectToCheck);
            return false;
        }
    }

    // --- 4. Compare State ---
    // AC3 (Comparison part): Compare the retrieved state (currentState) with the requiredState.
    // Handles cases where currentState might be explicitly undefined vs. requiredState.
    return currentState === requiredState;
};