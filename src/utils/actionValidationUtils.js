// src/utils/actionValidationUtils.js

// TARGET_MESSAGES is no longer directly used here for dispatching.
// It will be used by NotificationUISystem instead.
// import {TARGET_MESSAGES} from './messages.js';

/** @typedef {import('../actions/actionTypes.js').ActionContext} ActionContext */

/**
 * Checks if the targets array in the context is empty. If it is, dispatches
 * a semantic 'action:validation_failed' event with reason 'MISSING_TARGET'
 * and returns false. Otherwise, returns true.
 *
 * @param {ActionContext} context - The action context containing targets, dispatch, and playerEntity.
 * @param {string} actionVerb - The verb associated with the action (e.g., 'move', 'attack', 'drop').
 * @returns {boolean} - True if targets exist (validation passed), false otherwise.
 */
export function validateRequiredTargets(context, actionVerb) {
    if (!context || !context.targets) {
        console.error("validateRequiredTargets: Invalid context or missing targets array.");
        // Cannot reliably dispatch without context.
        return false;
    }

    if (context.targets.length === 0) {
        // Ensure dispatch and playerEntity are available before dispatching semantic event
        if (context.dispatch && typeof context.dispatch === 'function' && context.playerEntity) {
            // Dispatch semantic failure event instead of UI message
            context.dispatch('action:validation_failed', {
                actorId: context.playerEntity.id,
                actionVerb: actionVerb,
                reasonCode: 'MISSING_TARGET' // Specific reason code
            });
        } else {
            console.error(`validateRequiredTargets: context.dispatch or context.playerEntity is not available for action '${actionVerb}'. Cannot dispatch validation failure event.`);
        }
        return false; // Validation failed
    }

    return true; // Validation passed
}