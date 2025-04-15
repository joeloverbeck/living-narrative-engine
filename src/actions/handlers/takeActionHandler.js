// src/actions/handlers/takeActionHandler.js

/** @typedef {import('../actionTypes.js').ActionContext} ActionContext */
/** @typedef {import('../actionTypes.js').ActionResult} ActionResult */
/** @typedef {import('../../entities/entity.js').default} Entity */

// --- Standard Imports ---
import {ItemComponent} from "../../components/itemComponent.js";
import {resolveTargetEntity} from '../../services/entityFinderService.js';
import {validateRequiredCommandPart} from '../../utils/actionValidationUtils.js';
// --- Refactored Imports ---
import {TARGET_MESSAGES, getDisplayName} from "../../utils/messages.js"; // Import TARGET_MESSAGES and getDisplayName

/**
 * Handles the 'take' action ('core:take'). Allows the player to pick up items
 * from the current location. Uses the updated resolveTargetEntity service.
 * Dispatches UI messages based on resolution status and semantic events on success/failure.
 * @param {ActionContext} context - The context for the action.
 * @returns {ActionResult} The result of the action attempt.
 */
export function executeTake(context) {
    // Destructure context, including parsedCommand.
    const {playerEntity, currentLocation, dispatch, parsedCommand} = context;
    const messages = []; // Still useful for internal logging

    // Basic validation
    if (!playerEntity || !currentLocation) {
        console.error("executeTake: Missing player or location in context.");
        // Dispatch UI message for this critical setup error
        dispatch('ui:message_display', {text: TARGET_MESSAGES.INTERNAL_ERROR, type: 'error'});
        messages.push({text: "Setup error: Missing player or location.", type: 'internal_error'});
        return {success: false, messages: messages};
    }

    const actorId = playerEntity.id;
    const locationId = currentLocation.id;

    // --- Validate required command part (direct object) using parsedCommand ---
    if (!validateRequiredCommandPart(context, 'take', 'directObjectPhrase')) {
        // validateRequiredCommandPart should dispatch its own feedback (e.g., PROMPT_WHAT)
        return {success: false, messages: [], newState: undefined};
    }

    // --- Get target name directly from parsedCommand ---
    const targetName = parsedCommand.directObjectPhrase;

    messages.push({
        text: `Intent: Player ${actorId} attempting to take '${targetName}' in ${locationId}`,
        type: 'internal'
    });

    // --- 1. Resolve Target Item using Service ---
    // Removed message override configs (notFoundMessageKey, emptyScopeMessage)
    const resolution = resolveTargetEntity(context, {
        scope: 'location_items',
        requiredComponents: [ItemComponent],
        // actionVerb: 'take', // Kept for potential future message construction if needed
        targetName: targetName,
    });

    // --- 2. Handle Resolver Result ---
    switch (resolution.status) {
        case 'FOUND_UNIQUE': {
            const targetItemEntity = resolution.entity; // Get the resolved entity
            const targetItemId = targetItemEntity.id;
            const itemName = getDisplayName(targetItemEntity);

            // --- 3. Perform the Take Action (Dispatch Events) ---
            let success = false; // Default false
            try {
                // Dispatch internal game event FIRST
                dispatch('event:item_picked_up', {
                    pickerId: actorId,
                    itemId: targetItemId,
                    locationId: locationId
                });
                success = true; // Set success only if dispatch works

                // Dispatch semantic SUCCESS event (could also be handled by a system listening to item_picked_up)
                // For now, keeping it here for direct feedback loop example.
                dispatch('action:take_succeeded', {
                    actorId: actorId,
                    itemId: targetItemId,
                    itemName: itemName,
                    locationId: locationId
                });
                messages.push({
                    text: `Dispatched action:take_succeeded for ${itemName} (${targetItemId})`,
                    type: 'internal'
                });

            } catch (dispatchError) {
                // Log internal error
                const internalLogMsg = `Internal error occurred during item pick up event dispatch for ${itemName}.`;
                messages.push({text: internalLogMsg, type: 'error'});
                console.error(`Take Handler: Failed to dispatch event:item_picked_up for ${itemName} (${targetItemId}):`, dispatchError);

                // Dispatch semantic FAILURE event
                dispatch('action:take_failed', {
                    actorId: actorId,
                    targetName: itemName,
                    reasonCode: 'INTERNAL_PICKUP_ERROR',
                    locationId: locationId,
                    details: dispatchError
                });
                messages.push({
                    text: `Dispatched action:take_failed for ${itemName} due to pickup error`,
                    type: 'internal'
                });
                // success remains false

                // Also dispatch generic UI error since the event failed
                dispatch('ui:message_display', {text: TARGET_MESSAGES.INTERNAL_ERROR, type: 'error'});
            }

            return {success, messages, newState: undefined};
        }

        case 'NOT_FOUND':
            // Dispatch UI message based on status
            dispatch('ui:message_display', {text: TARGET_MESSAGES.NOT_FOUND_TAKEABLE(targetName), type: 'info'});
            messages.push({text: `Target resolution failed for '${targetName}', reason: NOT_FOUND`, type: 'internal'});
            return {success: false, messages};

        case 'AMBIGUOUS':
            // Dispatch UI message based on status
            const ambiguousMsg = TARGET_MESSAGES.AMBIGUOUS_PROMPT('take', targetName, resolution.candidates);
            dispatch('ui:message_display', {text: ambiguousMsg, type: 'warning'});
            messages.push({text: `Target resolution failed for '${targetName}', reason: AMBIGUOUS`, type: 'internal'});
            return {success: false, messages};

        case 'FILTER_EMPTY':
            // Dispatch UI message based on status
            dispatch('ui:message_display', {text: TARGET_MESSAGES.TAKE_EMPTY_LOCATION, type: 'info'});
            messages.push({
                text: `Target resolution failed for '${targetName}', reason: FILTER_EMPTY (Location has no items)`,
                type: 'internal'
            });
            return {success: false, messages};

        case 'INVALID_INPUT':
            // Dispatch UI message based on status
            dispatch('ui:message_display', {text: TARGET_MESSAGES.INTERNAL_ERROR, type: 'error'});
            messages.push({
                text: `Target resolution failed for '${targetName}', reason: INVALID_INPUT`,
                type: 'internal_error'
            });
            console.error(`executeTake: resolveTargetEntity returned INVALID_INPUT for target '${targetName}'. Context/Config issue?`);
            return {success: false, messages};

        default:
            // Should not happen
            dispatch('ui:message_display', {text: TARGET_MESSAGES.INTERNAL_ERROR, type: 'error'});
            console.error(`executeTake: Unhandled resolution status: ${resolution.status}`);
            messages.push({text: `Unhandled status: ${resolution.status}`, type: 'internal_error'});
            return {success: false, messages};
    }
}