// src/utils/actionValidationUtils.js

/** @typedef {import('../actions/actionTypes.js').ActionContext} ActionContext */

// Import TARGET_MESSAGES if needed for dispatching PROMPT_WHAT (though maybe the caller should do that)
// import { TARGET_MESSAGES } from './messages.js';

/**
 * Defines the specific parts of a ParsedCommand object that might be required by an action.
 * @typedef {'directObjectPhrase' | 'indirectObjectPhrase'} RequiredCommandPart
 */

/**
 * Checks if a required part of the parsed command exists and is non-empty within the context.
 *
 * If the specified required part is missing or empty, this function dispatches a semantic
 * 'action:validation_failed' event *using context.eventBus.dispatch* and returns `false`.
 * Otherwise, it returns `true`.
 *
 * @param {ActionContext} context - The action context. Must contain `playerEntity`, `eventBus`, and `parsedCommand`.
 * @param {string} actionVerb - The verb associated with the action (e.g., 'take', 'put', 'use').
 * @param {RequiredCommandPart} requiredPart - The specific property name within `context.parsedCommand` that is required.
 * @returns {Promise<boolean>} - A Promise resolving to `true` if validation passed, `false` otherwise.
 * @async - Now async due to using eventBus.dispatch
 */
export async function validateRequiredCommandPart(context, actionVerb, requiredPart) {
    console.log(`>>> ENTERING validateRequiredCommandPart (Action: ${actionVerb}, Part: ${requiredPart})`); // <<< LOG ADDED
    let isValid = false; // Default to invalid

    try {
        // --- 1. Validate Core Context Prerequisites ---
        if (!context) {
            console.error(`[validateRequiredCommandPart] Invalid context provided for action '${actionVerb}'. Cannot validate.`);
            console.log(`<<< EXITING validateRequiredCommandPart, returning: false (invalid context)`); // <<< LOG ADDED
            return false;
        }
        if (!context.parsedCommand) {
            console.error(`[validateRequiredCommandPart] context.parsedCommand is missing for action '${actionVerb}'. Cannot validate required part '${requiredPart}'.`);
            console.log(`<<< EXITING validateRequiredCommandPart, returning: false (missing parsedCommand)`); // <<< LOG ADDED
            return false;
        }
        // Check prerequisites for dispatching failure message using eventBus
        const canDispatch = context.eventBus && typeof context.eventBus.dispatch === 'function' && context.playerEntity;
        if (!canDispatch) {
            // Log if dispatch isn't possible, but proceed with validation logic
            console.warn(`[validateRequiredCommandPart] context.eventBus.dispatch or context.playerEntity is not available for action '${actionVerb}'. Validation failure events cannot be dispatched.`);
        }

        // --- 2. Check for the Specific Required Part ---
        let isMissing = false;
        let reasonCode = 'VALIDATION_ERROR_UNKNOWN';

        switch (requiredPart) {
            case 'directObjectPhrase':
                isMissing = !context.parsedCommand.directObjectPhrase;
                reasonCode = 'MISSING_DIRECT_OBJECT';
                break;
            case 'indirectObjectPhrase':
                isMissing = !context.parsedCommand.indirectObjectPhrase;
                reasonCode = 'MISSING_INDIRECT_OBJECT';
                break;
            default:
                console.error(`[validateRequiredCommandPart] Invalid requiredPart '${requiredPart}' specified during validation check for action '${actionVerb}'.`);
                isMissing = true;
                reasonCode = 'INVALID_VALIDATION_RULE';
                break;
        }

        // --- 3. Dispatch Failure Event if Missing ---
        if (isMissing) {
            if (canDispatch) {
                console.log(`[validateRequiredCommandPart] Validation failed for action '${actionVerb}'. Reason: ${reasonCode}. Dispatching event...`); // Log before dispatch
                try {
                    // *** Use eventBus.dispatch and await it ***
                    await context.eventBus.dispatch('action:validation_failed', {
                        actorId: context.playerEntity.id,
                        actionVerb: actionVerb,
                        reasonCode: reasonCode
                    });
                    console.log(`[validateRequiredCommandPart] Dispatched 'action:validation_failed'.`); // Log after dispatch
                } catch (dispatchError) {
                    console.error(`[validateRequiredCommandPart] Error occurred trying to dispatch 'action:validation_failed':`, dispatchError);
                }

            } else {
                console.error(`[validateRequiredCommandPart] Validation failed for action '${actionVerb}'. Reason: ${reasonCode}. Dispatch skipped due to missing prerequisites.`);
            }
            isValid = false; // Ensure isValid is false if missing
        } else {
            // --- 4. Validation Passed ---
            isValid = true;
        }

    } catch (error) {
        console.error(">>> CRITICAL ERROR inside validateRequiredCommandPart logic:", error); // <<< LOG ADDED
        isValid = false; // Ensure failure on unexpected error
    }

    console.log(`<<< EXITING validateRequiredCommandPart, returning: ${isValid}`); // <<< LOG ADDED
    return isValid; // Return the final determined state
}