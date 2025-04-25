// src/conditions/operationHandlers/handleConnectionStateIsCondition.js

// --- Necessary Imports ---
// JSDoc Type Imports
/** @typedef {import('../../components/connectionsComponent.js').Connection} Connection */ // Keep for backward compatibility reference
/** @typedef {import('../../services/conditionEvaluationService.js').ConditionEvaluationContext} ConditionEvaluationContext */
/** @typedef {import('../../services/conditionEvaluationService.js').ConditionHandlerFunction} ConditionHandlerFunction */
/** @typedef {import('../../entities/entity.js').default} Entity */ // Needed for type checking

// Class/Module Imports
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
    // Check PRESENCE of the key first. Allows state: null/undefined.
    if (!conditionData || !Object.prototype.hasOwnProperty.call(conditionData, 'state')) {
        console.warn(`[ConditionHandler:connection_state_is] Condition missing required 'state' parameter in conditionData:`, conditionData);
        return false;
    }
    // Get the actual value directly (can be string, undefined, null, etc.)
    const requiredState = conditionData.state;

    // --- 2. Basic Input Validation ---
    if (!objectToCheck) {
        console.warn(`[ConditionHandler:connection_state_is] Received null or undefined objectToCheck.`);
        return false;
    }

    // --- 3. Check if objectToCheck is an Entity ---
    const isEntity = typeof objectToCheck?.getComponent === 'function';
    let currentState = undefined;

    if (isEntity) {
        /** @type {Entity} */
        const entityToCheck = objectToCheck;
        const passageComponent = context.dataAccess.getComponentForEntity(entityToCheck, PassageDetailsComponent);

        if (passageComponent) {
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
            currentState = objectToCheck.state;
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