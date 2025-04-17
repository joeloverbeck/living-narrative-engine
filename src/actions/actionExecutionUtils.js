// --- Dependencies ---
import {ResolutionStatus, resolveTargetEntity} from '../services/entityFinderService.js';
import {validateRequiredCommandPart} from '../utils/actionValidationUtils.js';
import {TARGET_MESSAGES, getDisplayName} from '../utils/messages.js';
import {EVENT_DISPLAY_MESSAGE} from "../types/eventTypes.js";

// --- Type Imports ---
/** @typedef {import('./actionTypes.js').ActionContext} ActionContext */
/** @typedef {import('./actionTypes.js').ActionResult} ActionResult */
/** @typedef {import('../entities/entity.js').default} Entity */
/** @typedef {import('../services/entityFinderService.js').TargetResolutionScope} TargetResolutionScope */
/** @typedef {import('../components/component.js').ComponentConstructor} ComponentConstructor */

/** @typedef {import('./actionTypes.js').ActionMessage} ActionMessage */ // Ensure ActionMessage is defined/imported

/**
 * @typedef {object} HandleActionWithOptions
 * @property {TargetResolutionScope} scope
 * @property {ComponentConstructor[]} [requiredComponents]
 * @property {'directObjectPhrase' | 'indirectObjectPhrase'} commandPart
 * @property {string} actionVerb
 * @property {(context: ActionContext, targetEntity: Entity, messages: ActionMessage[]) => ActionResult | Promise<ActionResult>} onFoundUnique // Can return Promise
 * @property {object} [failureMessages]
 * @property {string | ((name: string) => string)} [failureMessages.notFound]
 * @property {string | ((verb: string, name: string, matches: Entity[]) => string)} [failureMessages.ambiguous]
 * @property {string | ((verb: string, scope: string) => string)} [failureMessages.filterEmpty]
 * @property {string} [failureMessages.invalidInput]
 */

/**
 * Core utility function for actions involving target resolution.
 * @param {ActionContext} context
 * @param {HandleActionWithOptions} options
 * @returns {Promise<ActionResult>}
 */
export async function handleActionWithTargetResolution(context, options) {
    const {eventBus} = context;

    if (!eventBus || typeof eventBus.dispatch !== 'function') {
        console.error(`handleActionWithTargetResolution: context.eventBus or context.eventBus.dispatch is missing or not a function.`);
        return {
            success: false,
            messages: [{text: 'Internal setup error: EventBus dispatch unavailable.', type: 'internal_error'}],
            newState: undefined
        };
    }

    /** @type {ActionMessage[]} */
    const messages = [];

    // --- 1. Validate Required Command Part ---
    let isValidCommandPart;
    try {
        isValidCommandPart = await validateRequiredCommandPart(context, options.actionVerb, options.commandPart);
    } catch (validationError) {
        console.error(`handleActionWithTargetResolution: >>> ERROR caught calling validateRequiredCommandPart:`, validationError);
        // Ensure a valid ActionResult structure is returned on error
        // Add internal message indicating validation failure source
        messages.push({type: 'internal', text: `Validation failed for command part: ${options.commandPart}`});
        return {success: false, messages, newState: undefined};
    }

    // console.log(`handleActionWithTargetResolution: validateRequiredCommandPart result for part "${options.commandPart}": ${isValidCommandPart}`); // Log kept

    if (!isValidCommandPart) {
        // Add internal log; user message should be dispatched by validator
        messages.push({
            text: `Validation failed: Required command part '${options.commandPart}' missing.`,
            type: 'internal'
        });
        return {success: false, messages, newState: undefined};
    }

    const targetName = context.parsedCommand[options.commandPart]?.trim();
    // Safety check - should be caught by validator, but good practice
    if (!targetName) {
        console.error(`handleActionWithTargetResolution: Command part '${options.commandPart}' null/empty after validation passed.`);
        messages.push({text: 'Internal Error: targetName missing after validation.', type: 'internal_error'});
        // Dispatch generic error if targetName is unexpectedly missing
        await eventBus.dispatch(EVENT_DISPLAY_MESSAGE, {text: TARGET_MESSAGES.INTERNAL_ERROR, type: 'error'});
        return {success: false, messages, newState: undefined};
    }
    messages.push({
        text: `Action: ${options.actionVerb}, Command Part: ${options.commandPart}, Target Name: '${targetName}'`,
        type: 'internal'
    });

    // --- 2. Resolve Target Entity ---
    let resolution;
    try {
        // console.log(`handleActionWithTargetResolution: Calling resolveTargetEntity...`); // Log kept
        resolution = resolveTargetEntity(context, {
            scope: options.scope,
            requiredComponents: options.requiredComponents,
            actionVerb: options.actionVerb,
            targetName: targetName,
            customFilter: options.customFilter
        });
        // console.log(`handleActionWithTargetResolution: resolveTargetEntity returned.`); // Log kept
    } catch (error) {
        console.error(`handleActionWithTargetResolution: *** Error caught during resolveTargetEntity call! ***`, error);
        messages.push({
            text: `Internal Error during resolveTargetEntity: ${error.message}`,
            type: 'internal_error',
            details: error
        });
        await eventBus.dispatch(EVENT_DISPLAY_MESSAGE, {text: TARGET_MESSAGES.INTERNAL_ERROR, type: 'error'});
        return {success: false, messages, newState: undefined};
    }

    // console.log(`handleActionWithTargetResolution: For target "${targetName}", resolution status is: ${resolution?.status ?? 'ERROR_DURING_CALL'}`); // Log kept

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
                const callbackResult = await options.onFoundUnique(context, targetEntity, messages);

                // <<< --- ADDED LOGGING for callbackResult --- >>>
                console.log("handleActionWithTargetResolution: Received callbackResult:", JSON.stringify(callbackResult));
                console.log(`handleActionWithTargetResolution: typeof callbackResult?.success: ${typeof callbackResult?.success}, value: ${callbackResult?.success}`);
                // <<< --- END LOGGING --- >>>

                // Combine messages *after* callback potentially modified the messages array
                const finalMessages = messages.concat(callbackResult?.messages || []); // Use optional chaining for safety

                // Construct the final result carefully
                const finalResult = {
                    // Ensure 'success' is explicitly boolean, default to false if missing from callback
                    success: typeof callbackResult?.success === 'boolean' ? callbackResult.success : false,
                    // Ensure 'newState' is included, defaulting to undefined if missing
                    newState: callbackResult?.newState,
                    // Assign the combined messages
                    messages: finalMessages,
                };

                // Validate the structure we are about to return
                if (typeof finalResult.success !== 'boolean') {
                    console.error("handleActionWithTargetResolution: CRITICAL - finalResult.success is still not a boolean before return!", finalResult);
                    // Force failure if validation fails here
                    finalResult.success = false;
                }


                console.log("handleActionWithTargetResolution: Returning final result from FOUND_UNIQUE:", JSON.stringify(finalResult));
                return finalResult;

            } catch (error) {
                // --- 5. Handle Errors in Callback ---
                console.error(`handleActionWithTargetResolution: Error executing onFoundUnique callback for action '${options.actionVerb}' on target '${targetName}':`, error);
                const userErrorMessage = TARGET_MESSAGES.INTERNAL_ERROR;
                // Use await here as eventBus dispatch is async
                await eventBus.dispatch(EVENT_DISPLAY_MESSAGE, {text: userErrorMessage, type: 'error'});
                messages.push({
                    text: `Internal Error during onFoundUnique: ${error.message}`,
                    type: 'internal_error',
                    details: error
                });
                // Return a valid failure structure
                return {success: false, messages, newState: undefined};
            }
        }

        // --- Cases for NOT_FOUND, AMBIGUOUS, FILTER_EMPTY, INVALID_INPUT, default ---
        // (These cases already return {success: false, messages, newState: undefined})
        // No changes needed here, but ensure they await eventBus.dispatch correctly.
        case ResolutionStatus.NOT_FOUND: {
            let messageText;
            if (options.failureMessages?.notFound) {
                messageText = typeof options.failureMessages.notFound === 'function'
                    ? options.failureMessages.notFound(targetName)
                    : options.failureMessages.notFound;
            } else {
                const messageKey = `NOT_FOUND_${options.scope.toUpperCase()}`;
                messageText = TARGET_MESSAGES[messageKey]
                    ? TARGET_MESSAGES[messageKey](targetName)
                    : TARGET_MESSAGES.NOT_FOUND_LOCATION(targetName);
            }
            await eventBus.dispatch(EVENT_DISPLAY_MESSAGE, {text: messageText, type: 'info'}); // Await dispatch
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
            await eventBus.dispatch(EVENT_DISPLAY_MESSAGE, {text: messageText, type: 'warning'}); // Await dispatch
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
                messageText = (options.scope === 'inventory' || options.scope === 'equipment')
                    ? TARGET_MESSAGES.SCOPE_EMPTY_PERSONAL(options.actionVerb)
                    : TARGET_MESSAGES.SCOPE_EMPTY_GENERIC(options.actionVerb, options.scope);
            }
            await eventBus.dispatch(EVENT_DISPLAY_MESSAGE, {text: messageText, type: 'info'}); // Await dispatch
            messages.push({
                text: `Resolution Failed: FILTER_EMPTY for scope '${options.scope}'. User message: "${messageText}"`,
                type: 'internal'
            });
            return {success: false, messages, newState: undefined};
        }

        case ResolutionStatus.INVALID_INPUT: {
            const messageText = options.failureMessages?.invalidInput || TARGET_MESSAGES.INTERNAL_ERROR;
            await eventBus.dispatch(EVENT_DISPLAY_MESSAGE, {text: messageText, type: 'error'}); // Await dispatch
            messages.push({
                text: `Resolution Failed: INVALID_INPUT. User message: "${messageText}"`,
                type: 'internal_error'
            });
            console.error(`handleActionWithTargetResolution: resolveTargetEntity returned INVALID_INPUT for action '${options.actionVerb}', target '${targetName}'. Check configuration.`);
            return {success: false, messages, newState: undefined};
        }

        default: {
            const messageText = TARGET_MESSAGES.INTERNAL_ERROR;
            await eventBus.dispatch(EVENT_DISPLAY_MESSAGE, {text: messageText, type: 'error'}); // Await dispatch
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
export async function dispatchEventWithCatch(context, eventName, payload, messages, logDetails) { // Mak
    // Access eventBus directly from context
    const {eventBus} = context;

    if (!eventBus || typeof eventBus.dispatch !== 'function') { // Check eventBus and its dispatch method
        console.error(`dispatchEventWithCatch: context.eventBus or context.eventBus.dispatch is missing or not a function.`);
        messages.push({
            text: `Internal Error: context.eventBus.dispatch is missing for event ${eventName}`,
            type: 'internal_error'
        });
        return {success: false};
    }

    try {
        // CORRECTED CALL: Use await and call dispatch on the eventBus instance
        await eventBus.dispatch(eventName, payload);

        // Log success internally
        messages.push({text: logDetails.success, type: 'internal'});
        console.debug(`dispatchEventWithCatch: Successfully dispatched '${eventName}'`);
        const successResult = {success: true};
        console.log(`[DEBUG dispatchEventWithCatch] Returning on success: ${JSON.stringify(successResult)}`); // Add this
        return successResult;

    } catch (error) {
        // Log error to console
        console.error(`dispatchEventWithCatch: Error dispatching event '${eventName}':`, error);

        // Determine user-facing error message
        const userErrorMessage = typeof logDetails.errorUser === 'function'
            ? logDetails.errorUser(error)
            : logDetails.errorUser;

        // Dispatch user-facing error message
        // Safety check: Ensure ui:message_display dispatch doesn't cause infinite loop if IT fails
        try {
            // CORRECTED CALL (Needs await too!)
            await eventBus.dispatch(EVENT_DISPLAY_MESSAGE, {text: userErrorMessage, type: 'error'});
        } catch (uiError) {
            console.error(`dispatchEventWithCatch: CRITICAL - Failed to dispatch ui:message_display after catching error for event '${eventName}':`, uiError);
        }

        // Log internal error message
        messages.push({
            text: `${logDetails.errorInternal} Error: ${error.message}`,
            type: 'error',
            details: error
        });

        return {success: false};
    }
}