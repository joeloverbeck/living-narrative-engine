// src/actions/actionExecutionUtils.js

// --- Dependencies ---
// Assuming these utilities/services exist and are importable
// Replace with actual paths if different
import {ResolutionStatus, resolveTargetEntity} from '../services/entityFinderService.js';
import {validateRequiredCommandPart} from '../utils/actionValidationUtils.js';
import {TARGET_MESSAGES, getDisplayName} from '../utils/messages.js';

// --- Type Imports ---
/** @typedef {import('./actionTypes.js').ActionContext} ActionContext */
/** @typedef {import('./actionTypes.js').ActionResult} ActionResult */
/** @typedef {import('../entities/entity.js').default} Entity */
/** @typedef {import('../services/entityFinderService.js').TargetResolutionScope} TargetResolutionScope */
/** @typedef {import('../components/component.js').ComponentConstructor} ComponentConstructor */

/**
 * @typedef {object} HandleActionWithOptions
 * @property {TargetResolutionScope} scope - The scope for target resolution (e.g., 'inventory', 'location', 'nearby').
 * @property {ComponentConstructor[]} [requiredComponents] - Optional array of component constructors the target must have.
 * @property {'directObjectPhrase' | 'indirectObjectPhrase'} commandPart - The part of the parsed command holding the target name (e.g., 'directObjectPhrase').
 * @property {string} actionVerb - The verb being performed (e.g., 'take', 'attack', 'use X on'). Used for messages.
 * @property {(context: ActionContext, targetEntity: Entity, messages: import('./actionTypes.js').ActionMessage[]) => ActionResult | Promise<ActionResult>} onFoundUnique - Callback function executed when a unique target is found. Receives context, the found entity, and the current messages array. Should return an ActionResult.
 * @property {object} [failureMessages] - Optional overrides for default failure messages.
 * @property {string | ((name: string) => string)} [failureMessages.notFound] - Override for NOT_FOUND message or function.
 * @property {string | ((verb: string, name: string, matches: Entity[]) => string)} [failureMessages.ambiguous] - Override for AMBIGUOUS message or function.
 * @property {string | ((verb: string, scope: string) => string)} [failureMessages.filterEmpty] - Override for FILTER_EMPTY message or function.
 * @property {string} [failureMessages.invalidInput] - Override for INVALID_INPUT message.
 */

/**
 * Core utility function to handle the common pattern of validating a command part,
 * resolving a target entity, handling resolution statuses, and executing a callback
 * on successful unique resolution.
 *
 * @param {ActionContext} context - The action context.
 * @param {HandleActionWithOptions} options - Configuration options for the execution flow.
 * @returns {Promise<ActionResult>} A promise that resolves to the action result.
 */
export async function handleActionWithTargetResolution(context, options) {
    const {dispatch} = context;
    /** @type {import('./actionTypes.js').ActionMessage[]} */
    const messages = []; // Collect internal messages

    // --- 1. Validate Required Command Part ---
    if (!validateRequiredCommandPart(context, options.actionVerb, options.commandPart)) {
        // Message already dispatched by the validation utility
        messages.push({
            text: `Validation failed: Missing required command part '${options.commandPart}' for verb '${options.actionVerb}'.`,
            type: 'internal'
        });
        return {success: false, messages, newState: undefined};
    }
    const targetName = context.parsedCommand[options.commandPart];
    if (!targetName) {
        // This case should ideally be caught by validateRequiredCommandPart, but safety check.
        console.error(`handleActionWithTargetResolution: Command part '${options.commandPart}' was validated but is still missing/empty.`);
        dispatch('ui:message_display', {text: TARGET_MESSAGES.INTERNAL_ERROR, type: 'error'});
        messages.push({
            text: `Internal Error: targetName missing after validation for ${options.commandPart}.`,
            type: 'internal_error'
        });
        return {success: false, messages, newState: undefined};
    }
    messages.push({
        text: `Action: ${options.actionVerb}, Command Part: ${options.commandPart}, Target Name: '${targetName}'`,
        type: 'internal'
    });


    // --- 2. Resolve Target Entity ---
    const resolution = resolveTargetEntity(context, {
        scope: options.scope,
        requiredComponents: options.requiredComponents,
        actionVerb: options.actionVerb,
        targetName: targetName,
        // Note: failureMessages from options aren't directly passed to resolveTargetEntity,
        // as this function handles the message dispatch based on the *returned status*.
    });
    messages.push({text: `Target resolution status: ${resolution.status}`, type: 'internal'});

    // --- 3. Handle Resolution Status ---
    switch (resolution.status) {
        case ResolutionStatus.FOUND_UNIQUE: {
            const targetEntity = resolution.entity;
            messages.push({
                text: `Target resolved uniquely: ${getDisplayName(targetEntity)} (${targetEntity.id})`,
                type: 'internal'
            });
            try {
                // --- 4. Execute Callback on Success ---
                // Pass context, the found entity, and the current messages array
                const callbackResult = await options.onFoundUnique(context, targetEntity, messages);

                // Combine messages from this utility with messages from the callback
                const finalMessages = messages.concat(callbackResult.messages || []);

                // Return the result from the callback, ensuring messages are combined
                return {
                    ...callbackResult,
                    messages: finalMessages,
                };
            } catch (error) {
                // --- 5. Handle Errors in Callback ---
                console.error(`handleActionWithTargetResolution: Error executing onFoundUnique callback for action '${options.actionVerb}' on target '${targetName}':`, error);
                const userErrorMessage = TARGET_MESSAGES.INTERNAL_ERROR;
                dispatch('ui:message_display', {text: userErrorMessage, type: 'error'});
                messages.push({
                    text: `Internal Error during onFoundUnique: ${error.message}`,
                    type: 'internal_error',
                    details: error
                });
                return {success: false, messages, newState: undefined};
            }
        }

        case ResolutionStatus.NOT_FOUND: {
            let messageText;
            if (options.failureMessages?.notFound) {
                messageText = typeof options.failureMessages.notFound === 'function'
                    ? options.failureMessages.notFound(targetName)
                    : options.failureMessages.notFound;
            } else {
                // Default lookup logic (example, adjust based on actual TARGET_MESSAGES structure)
                const messageKey = `NOT_FOUND_${options.scope.toUpperCase()}`;
                messageText = TARGET_MESSAGES[messageKey]
                    ? TARGET_MESSAGES[messageKey](targetName)
                    : TARGET_MESSAGES.NOT_FOUND_LOCATION(targetName); // Fallback to a generic location message
            }
            dispatch('ui:message_display', {text: messageText, type: 'info'});
            messages.push({text: `Resolution Failed: NOT_FOUND. User message: "${messageText}"`, type: 'internal'});
            return {success: false, messages, newState: undefined};
        }

        case ResolutionStatus.AMBIGUOUS: {
            let messageText;
            if (options.failureMessages?.ambiguous) {
                messageText = typeof options.failureMessages.ambiguous === 'function'
                    ? options.failureMessages.ambiguous(options.actionVerb, targetName, resolution.candidates)
                    : options.failureMessages.ambiguous;
            } else {
                messageText = TARGET_MESSAGES.AMBIGUOUS_PROMPT(options.actionVerb, targetName, resolution.candidates);
            }
            dispatch('ui:message_display', {text: messageText, type: 'warning'});
            messages.push({
                text: `Resolution Failed: AMBIGUOUS. Candidates: ${resolution.candidates.map(c => c.id).join(', ')}. User message: "${messageText}"`,
                type: 'internal'
            });
            return {success: false, messages, newState: undefined};
        }

        case ResolutionStatus.FILTER_EMPTY: {
            let messageText;
            if (options.failureMessages?.filterEmpty) {
                messageText = typeof options.failureMessages.filterEmpty === 'function'
                    ? options.failureMessages.filterEmpty(options.actionVerb, options.scope)
                    : options.failureMessages.filterEmpty;
            } else {
                // Determine default based on scope
                messageText = (options.scope === 'inventory' || options.scope === 'equipment')
                    ? TARGET_MESSAGES.SCOPE_EMPTY_PERSONAL(options.actionVerb)
                    : TARGET_MESSAGES.SCOPE_EMPTY_GENERIC(options.actionVerb, options.scope); // Provide scope context
            }
            dispatch('ui:message_display', {text: messageText, type: 'info'});
            messages.push({
                text: `Resolution Failed: FILTER_EMPTY for scope '${options.scope}'. User message: "${messageText}"`,
                type: 'internal'
            });
            return {success: false, messages, newState: undefined};
        }

        case ResolutionStatus.INVALID_INPUT: {
            const messageText = options.failureMessages?.invalidInput || TARGET_MESSAGES.INTERNAL_ERROR;
            dispatch('ui:message_display', {text: messageText, type: 'error'});
            messages.push({
                text: `Resolution Failed: INVALID_INPUT. User message: "${messageText}"`,
                type: 'internal_error'
            });
            console.error(`handleActionWithTargetResolution: resolveTargetEntity returned INVALID_INPUT for action '${options.actionVerb}', target '${targetName}'. Check configuration.`);
            return {success: false, messages, newState: undefined};
        }

        default: {
            const messageText = TARGET_MESSAGES.INTERNAL_ERROR;
            dispatch('ui:message_display', {text: messageText, type: 'error'});
            messages.push({
                text: `Resolution Failed: Unexpected status '${resolution.status}'.`,
                type: 'internal_error'
            });
            console.error(`handleActionWithTargetResolution: Unhandled resolution status from resolveTargetEntity: ${resolution.status}`);
            return {success: false, messages, newState: undefined};
        }
    }
}

/**
 * @typedef {object} DispatchLogDetails
 * @property {string} success - Message template for internal success log. Should include placeholder for event name/payload if desired.
 * @property {string | ((error: Error) => string)} errorUser - Message template or function to generate the user-facing error message.
 * @property {string} errorInternal - Base message template for internal error log. Should include placeholder for event name/payload if desired.
 */

/**
 * Dispatches an event within a try...catch block, handling errors,
 * logging results internally, and providing user feedback on failure.
 * Mutates the provided messages array.
 *
 * @param {ActionContext} context - The action context, containing the dispatch function.
 * @param {string} eventName - The name of the event to dispatch.
 * @param {any} payload - The payload for the event.
 * @param {ActionMessage[]} messages - The array to store internal log messages.
 * @param {DispatchLogDetails} logDetails - Configuration for logging and error messages.
 * @returns {{ success: boolean }} - Indicates whether the dispatch was successful.
 */
export function dispatchEventWithCatch(context, eventName, payload, messages, logDetails) {
    const {dispatch} = context;

    if (!dispatch || typeof dispatch !== 'function') {
        console.error(`dispatchEventWithCatch: context.dispatch is missing or not a function.`);
        // Attempt to add an internal error message even if dispatch fails
        messages.push({
            text: `Internal Error: context.dispatch is missing for event ${eventName}`,
            type: 'internal_error'
        });
        return {success: false};
    }

    try {
        dispatch(eventName, payload);

        // Log success internally
        messages.push({text: logDetails.success, type: 'internal'}); // AC: Add success message
        console.debug(`dispatchEventWithCatch: Successfully dispatched '${eventName}'`); // Optional debug log
        return {success: true}; // AC: Return true on success

    } catch (error) {
        // Log error to console
        console.error(`dispatchEventWithCatch: Error dispatching event '${eventName}':`, error); // AC: Log caught error

        // Determine user-facing error message
        const userErrorMessage = typeof logDetails.errorUser === 'function'
            ? logDetails.errorUser(error)
            : logDetails.errorUser;

        // Dispatch user-facing error message
        // Safety check: Ensure ui:message_display dispatch doesn't cause infinite loop if IT fails
        try {
            dispatch('ui:message_display', {text: userErrorMessage, type: 'error'}); // AC: Dispatch user error message
        } catch (uiError) {
            console.error(`dispatchEventWithCatch: CRITICAL - Failed to dispatch ui:message_display after catching error for event '${eventName}':`, uiError);
        }


        // Log internal error message
        messages.push({ // AC: Add detailed error message
            text: `${logDetails.errorInternal} Error: ${error.message}`,
            type: 'error', // Use 'error' type for internal logs of failures
            details: error // Optionally include the error object
        });

        return {success: false}; // AC: Return false on failure
    }
} // AC: Function implemented and exported (assuming file structure)
