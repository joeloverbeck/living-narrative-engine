// src/utils/actionValidationUtils.js

/** @typedef {import('../actions/actionTypes.js').ActionContext} ActionContext */

/**
 * Defines the specific parts of a ParsedCommand object that might be required by an action.
 * @typedef {'directObjectPhrase' | 'indirectObjectPhrase'} RequiredCommandPart
 */

/**
 * Checks if a required part of the parsed command exists and is non-empty within the context.
 *
 * This function is intended to replace checks that previously relied on `context.targets.length`.
 * If the specified required part (e.g., direct object phrase) is missing or empty in
 * `context.parsedCommand`, this function dispatches a semantic 'action:validation_failed'
 * event with a specific reason code (e.g., 'MISSING_DIRECT_OBJECT') and returns `false`.
 * Otherwise, it returns `true`.
 *
 * @param {ActionContext} context - The action context. Must contain `playerEntity`, `dispatch`, and `parsedCommand`.
 * @param {string} actionVerb - The verb associated with the action (e.g., 'take', 'put', 'use'), used for the failure event.
 * @param {RequiredCommandPart} requiredPart - The specific property name within `context.parsedCommand` that is required for this action's validation step (e.g., 'directObjectPhrase').
 * @returns {boolean} - `true` if the required command part exists and is non-empty (validation passed), `false` otherwise.
 */
export function validateRequiredCommandPart(context, actionVerb, requiredPart) {
    // --- 1. Validate Core Context Prerequisites ---
    if (!context) {
        console.error(`[validateRequiredCommandPart] Invalid context provided for action '${actionVerb}'. Cannot validate.`);
        return false;
    }
    if (!context.parsedCommand) {
        // This indicates a problem earlier in the action processing chain (likely Sub-Ticket 4 dependency).
        console.error(`[validateRequiredCommandPart] context.parsedCommand is missing for action '${actionVerb}'. Cannot validate required part '${requiredPart}'.`);
        // We cannot proceed with validation logic. Can't dispatch reliably either without full context.
        return false;
    }
    // Check prerequisites for dispatching a potential failure message
    const canDispatch = context.dispatch && typeof context.dispatch === 'function' && context.playerEntity;
    if (!canDispatch) {
        console.warn(`[validateRequiredCommandPart] context.dispatch or context.playerEntity is not available for action '${actionVerb}'. Validation failure events cannot be dispatched.`);
        // Note: We still proceed with validation logic below, but won't be able to dispatch failure.
    }

    // --- 2. Check for the Specific Required Part ---
    let isMissing = false;
    let reasonCode = 'VALIDATION_ERROR_UNKNOWN'; // Default/fallback reason

    switch (requiredPart) {
        case 'directObjectPhrase':
            // A direct object is considered missing if the phrase is null, undefined, or an empty string.
            isMissing = !context.parsedCommand.directObjectPhrase; // Checks for null, undefined, ""
            reasonCode = 'MISSING_DIRECT_OBJECT';
            break;
        case 'indirectObjectPhrase':
            // An indirect object is considered missing if the phrase is null, undefined, or an empty string.
            isMissing = !context.parsedCommand.indirectObjectPhrase; // Checks for null, undefined, ""
            reasonCode = 'MISSING_INDIRECT_OBJECT';
            break;
        // Add cases for other potential required parts (e.g., 'prepositionalPhrase') if needed in the future.
        default:
            // This indicates an error in how the validation function itself was called.
            console.error(`[validateRequiredCommandPart] Invalid requiredPart '${requiredPart}' specified during validation check for action '${actionVerb}'.`);
            // Treat this as a validation failure because the requirement itself is invalid.
            isMissing = true;
            reasonCode = 'INVALID_VALIDATION_RULE'; // Specific code for bad validation call
            break;
    }

    // --- 3. Dispatch Failure Event if Missing ---
    if (isMissing) {
        if (canDispatch) {
            context.dispatch('action:validation_failed', {
                actorId: context.playerEntity.id,
                actionVerb: actionVerb,
                reasonCode: reasonCode // Use the specific reason determined above
            });
        } else {
            // Log the failure again if dispatch wasn't possible, providing the reason.
            console.error(`[validateRequiredCommandPart] Validation failed for action '${actionVerb}'. Reason: ${reasonCode}. Dispatch skipped due to missing prerequisites.`);
        }
        return false; // Validation failed
    }

    // --- 4. Validation Passed ---
    return true;
}