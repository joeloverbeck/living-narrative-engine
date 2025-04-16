// src/actions/handlers/openActionHandler.js

/**
 * @fileoverview Action handler for the 'core:open' action (Event-Driven).
 * Dispatches an event:open_attempted for the OpenableSystem to handle.
 * This file is refactored (Ticket 3) to use handleActionWithTargetResolution.
 */

// --- Refactored Imports ---
// Utilities and Services
import {handleActionWithTargetResolution, dispatchEventWithCatch} from '../actionExecutionUtils.js'; //
import {TARGET_MESSAGES, getDisplayName} from '../../utils/messages.js'; //
// Core Components
import OpenableComponent from '../../components/openableComponent.js'; //
// Type Imports
/** @typedef {import('../actionTypes.js').ActionContext} ActionContext */ //
/** @typedef {import('../actionTypes.js').ActionResult} ActionResult */ //
/** @typedef {import('../actionTypes.js').ActionMessage} ActionMessage */ //
/** @typedef {import('../../entities/entity.js').default} Entity */ //
/** @typedef {import('../actionExecutionUtils.js').HandleActionWithOptions} HandleActionWithOptions */ //
// Import the newly defined event payload type
/** @typedef {import('../../types/eventTypes.js').OpenAttemptedEventPayload} OpenAttemptedEventPayload */ //

/**
 * Handles the 'core:open' action intent. It uses the handleActionWithTargetResolution
 * utility to resolve the target entity specified in the command (from the directObjectPhrase).
 * The target must be nearby and possess an OpenableComponent.
 *
 * If a unique, valid target is found, this handler dispatches an 'event:open_attempted'
 * event via dispatchEventWithCatch. The actual opening logic (checking locks, changing state)
 * is handled by systems listening to this event (e.g., OpenableSystem).
 *
 * @param {ActionContext} context - The action context containing player, location, command, and services.
 * @returns {Promise<ActionResult>} A Promise resolving to the ActionResult.
 * Success indicates that the intent to open was validated and the 'event:open_attempted'
 * was successfully dispatched. It does *not* guarantee the target entity was actually opened.
 * Failure indicates an issue with target resolution or event dispatch.
 */
export async function executeOpen(context) { // AC 5: Function is async

    /**
     * AC 2: Define onFoundUnique Callback
     * Callback executed when a unique, valid target (with OpenableComponent) is found.
     * Dispatches the event:open_attempted event.
     *
     * @param {ActionContext} innerContext - The action context passed through.
     * @param {Entity} targetEntity - The uniquely resolved target entity.
     * @param {ActionMessage[]} messages - The array of messages accumulated so far (mutated by dispatchEventWithCatch).
     * @returns {ActionResult} - Result indicating success/failure of the event dispatch.
     */
    const onFoundUnique = (innerContext, targetEntity, messages) => {
        // Extract IDs
        const actorId = innerContext.playerEntity.id;
        const targetEntityId = targetEntity.id;
        const targetName = getDisplayName(targetEntity); // For logging

        // Construct the event payload
        /** @type {OpenAttemptedEventPayload} */
        const eventPayload = { // AC 2: Construct payload
            actorId,
            targetEntityId
        };

        // Define log details for dispatchEventWithCatch
        const logDetails = {
            success: `Dispatched event:open_attempted for actor ${actorId} on target ${targetName} (${targetEntityId})`,
            errorUser: TARGET_MESSAGES.INTERNAL_ERROR || "Something went wrong trying to open that.", // Fallback if TARGET_MESSAGES not fully loaded
            errorInternal: `Failed to dispatch event:open_attempted for actor ${actorId} on target ${targetName} (${targetEntityId}).`
        };

        // AC 2: Use dispatchEventWithCatch to dispatch event:open_attempted
        const dispatchResult = dispatchEventWithCatch(
            innerContext,
            'event:open_attempted',
            eventPayload,
            messages, // Pass messages array to be mutated
            logDetails
        );

        // AC 2: Return ActionResult based on dispatch success
        return {
            success: dispatchResult.success,
            messages: [], // Return empty array; utility merges mutated messages
            newState: undefined
        };
    }; // End of onFoundUnique callback definition

    // AC 3: Define options Object
    /** @type {HandleActionWithOptions} */
    const options = {
        // AC 4: Configure options
        scope: 'nearby_including_blockers',                        // AC 4: scope
        requiredComponents: [OpenableComponent], // AC 4: requiredComponents
        commandPart: 'directObjectPhrase',      // AC 4: commandPart
        actionVerb: 'open',                      // AC 4: actionVerb
        onFoundUnique: onFoundUnique,           // AC 4: onFoundUnique callback
        failureMessages: {                      // AC 4: Optional failureMessages
            // TICKET 5 IMPLEMENTATION: Use specific messages for 'open' action failures
            notFound: TARGET_MESSAGES.NOT_FOUND_OPENABLE, // Use specific 'open' not found message
            filterEmpty: TARGET_MESSAGES.FILTER_EMPTY_OPENABLE, // Use specific 'open' filter empty message
            // AMBIGUOUS will use the default (TARGET_MESSAGES.AMBIGUOUS_PROMPT) which is suitable
        },
    };

    // AC 5: Final line calls the utility
    return await handleActionWithTargetResolution(context, options);
}
