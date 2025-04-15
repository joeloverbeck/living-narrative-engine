// src/actions/handlers/openActionHandler.js

/**
 * @fileoverview Action handler for the 'core:open' action (Event-Driven).
 * Dispatches an event:open_attempted for the OpenableSystem to handle.
 */

// --- Type Imports ---
/** @typedef {import('../actionTypes.js').ActionContext} ActionContext */
/** @typedef {import('../actionTypes.js').ActionResult} ActionResult */
/** @typedef {import('../actionTypes.js').ActionMessage} ActionMessage */
/** @typedef {import('../../types/eventTypes.js').OpenAttemptedEventPayload} OpenAttemptedEventPayload */ // Assumes type is defined here

// --- Utility Imports ---
import {TARGET_MESSAGES} from '../../utils/messages.js'; // For generic error message
import {dispatchEventWithCatch} from '../actionExecutionUtils.js'; // Utility for safe event dispatching

/**
 * Handles the 'core:open' action intent.
 * This function is invoked by the ActionExecutor *after* target resolution
 * and applicability checks have confirmed a valid target.
 * Its sole responsibility is to dispatch the 'event:open_attempted' event.
 *
 * @param {ActionContext} context - The action context.
 * @param {string} targetEntityId - The unique ID of the entity to attempt opening (passed by ActionExecutor).
 * @returns {Promise<ActionResult>} - The result indicates if the *intent* was successfully dispatched.
 */
export async function executeOpen(context, targetEntityId) {
    const {playerEntity, dispatch} = context; // Get player for actorId and dispatch function
    /** @type {ActionMessage[]} */
    const messages = []; // For internal logging

    // --- 1. Runtime Checks ---
    if (!playerEntity) {
        console.error("executeOpen: Critical error - playerEntity is missing in context.");
        // Attempt to dispatch UI error, though context might be broken
        if (dispatch) dispatch('ui:message_display', {text: TARGET_MESSAGES.INTERNAL_ERROR, type: 'error'});
        messages.push({text: "Internal Error: Missing playerEntity in context.", type: 'error'});
        return {success: false, messages};
    }

    if (!targetEntityId || typeof targetEntityId !== 'string') {
        console.error(`executeOpen: Invalid targetEntityId received: ${targetEntityId}`);
        if (dispatch) dispatch('ui:message_display', {text: TARGET_MESSAGES.INTERNAL_ERROR, type: 'error'});
        messages.push({text: `Internal Error: Invalid targetEntityId (${targetEntityId}).`, type: 'error'});
        return {success: false, messages};
    }

    const actorId = playerEntity.id;
    messages.push({text: `Open attempt: Actor ${actorId} on Target ${targetEntityId}`, type: 'internal'});

    // --- 2. Define Event Payload ---
    /** @type {OpenAttemptedEventPayload} */
    const eventPayload = {
        actorId: actorId,
        targetEntityId: targetEntityId,
    };

    // --- 3. Dispatch Event using Utility ---
    const dispatchResult = dispatchEventWithCatch(
        context,
        'event:open_attempted',
        eventPayload,
        messages, // Pass messages array for the utility to add internal logs
        {
            // Log details for the dispatch utility
            success: `Dispatched event:open_attempted for actor ${actorId} on target ${targetEntityId}`,
            errorUser: TARGET_MESSAGES.INTERNAL_ERROR, // Generic user message on dispatch failure
            errorInternal: `Failed to dispatch event:open_attempted for actor ${actorId} on target ${targetEntityId}.` // Internal log message on dispatch failure
        }
    );

    // --- 4. Return Result ---
    // The success status reflects whether the event dispatch itself succeeded.
    // The actual opening action is handled asynchronously by OpenableSystem.
    // Messages array includes logs added by dispatchEventWithCatch.
    return {
        success: dispatchResult.success,
        messages: messages,
        newState: undefined // No immediate state change from this handler
    };
}