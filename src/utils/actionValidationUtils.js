// src/utils/actionValidationUtils.js

import {TARGET_MESSAGES} from './messages.js';

/** @typedef {import('../actions/actionTypes.js').ActionContext} ActionContext */

/**
 * Checks if the targets array in the context is empty. If it is, dispatches
 * a standard "PROMPT_WHAT" message for the given action verb and returns false.
 * Otherwise, returns true.
 *
 * @param {ActionContext} context - The action context containing targets and dispatch.
 * @param {string} actionVerb - The verb associated with the action (e.g., 'attack', 'drop').
 * @returns {boolean} - True if targets exist (validation passed), false otherwise.
 */
export function validateRequiredTargets(context, actionVerb) {
    if (!context || !context.targets) {
        console.error("validateRequiredTargets: Invalid context or missing targets array.");
        // Optionally dispatch a generic internal error, but context might be too broken.
        return false;
    }

    if (context.targets.length === 0) {
        const errorMsg = TARGET_MESSAGES.PROMPT_WHAT(actionVerb);
        // Ensure dispatch is available before using it
        if (context.dispatch && typeof context.dispatch === 'function') {
            context.dispatch('ui:message_display', {text: errorMsg, type: 'error'});
        } else {
            console.error(`validateRequiredTargets: context.dispatch is not available for action '${actionVerb}'. Cannot display prompt.`);
        }
        return false; // Validation failed
    }

    return true; // Validation passed
}