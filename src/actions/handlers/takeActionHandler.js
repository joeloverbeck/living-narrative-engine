// src/actions/handlers/takeActionHandler.js

/** @typedef {import('../actionTypes.js').ActionContext} ActionContext */
/** @typedef {import('../actionTypes.js').ActionResult} ActionResult */
/** @typedef {import('../../entities/entity.js').default} Entity */

import {getDisplayName} from "../../utils/messages.js";
import {ItemComponent} from "../../components/itemComponent.js";
import {resolveTargetEntity} from '../../services/targetResolutionService.js';
import {validateRequiredTargets} from '../../utils/actionValidationUtils.js';

/**
 * Handles the 'take' action ('core:action_take'). Allows the player to pick up items
 * from the current location using TargetResolutionService.
 * Dispatches semantic events (e.g., 'action:take_succeeded', 'action:take_failed')
 * instead of directly dispatching UI messages.
 * @param {ActionContext} context - The context for the action.
 * @returns {ActionResult} The result of the action.
 */
export function executeTake(context) {
    const {playerEntity, currentLocation, targets, dispatch} = context;
    const messages = []; // Still useful for internal logging

    // Basic validation
    if (!playerEntity || !currentLocation) {
        console.error("executeTake: Missing player or location in context.");
        // Dispatch semantic failure event instead of UI message
        dispatch('action:take_failed', {
            actorId: playerEntity?.id || 'unknown', // Include actor if possible
            targetName: targets.join(' '),
            reasonCode: 'SETUP_ERROR',
            locationId: currentLocation?.id || 'unknown'
        });
        messages.push({text: "Setup error: Missing player or location.", type: 'internal_error'});
        return {success: false, messages: messages}; // Keep internal messages
    }

    const actorId = playerEntity.id;
    const locationId = currentLocation.id;
    const targetName = targets.join(' ');

    // --- Validate required targets ---
    // NOTE: Assumes validateRequiredTargets *either* doesn't dispatch UI messages
    //       or is acceptable for now. Ideally, it would return a validation result.
    //       If it *does* dispatch UI messages, they need to be removed there too.
    if (!validateRequiredTargets(context, 'take')) {
        // If validation fails AND dispatches its own UI message, that breaks the pattern.
        // Assuming here it *doesn't* dispatch UI, or we accept it for now.
        // If it *doesn't* dispatch, we should dispatch a semantic failure here:
        /*
        dispatch('action:take_failed', {
            actorId: actorId,
            targetName: targetName,
            reasonCode: 'VALIDATION_FAILED',
            locationId: locationId
        });
        messages.push({ text: `Validation failed for taking '${targetName}'`, type: 'internal' });
        */
        // For now, align with original code's assumption that the utility handles messaging
        return {success: false, messages: [], newState: undefined};
    }


    // --- 1. Resolve Target Item using Service ---
    // NOTE: Assumes resolveTargetEntity *might* dispatch UI messages directly for
    //       'not found' or 'empty scope'. Ideally, it would return null/error
    //       and we dispatch the semantic event here.
    const targetItemEntity = resolveTargetEntity(context, {
        scope: 'location_items',
        requiredComponents: [ItemComponent],
        actionVerb: 'take',
        targetName: targetName,
        // Pass flags to suppress direct UI messages if the service supports it
        suppressUIMessages: true, // <--- Hypothetical flag
        // The following messages are now potentially handled by NotificationUISystem
        notFoundMessageKey: 'NOT_FOUND_TAKEABLE', // We might use this key in the semantic event
        emptyScopeMessage: "There's nothing here to take.", // Or this info
    });

    // --- 2. Handle Resolver Result ---
    if (!targetItemEntity) {
        // If resolveTargetEntity didn't find the item (and didn't dispatch UI message)
        // dispatch the semantic failure event here.
        // We need to know *why* it failed (not found vs empty scope).
        // This requires resolveTargetEntity to provide more info than just null.
        // Let's assume for now it returns null for 'not found' and we infer.
        // A better approach is the resolver returning an error object/code.

        // Infer reason (example - needs refinement based on resolveTargetEntity behavior)
        const itemsInLocation = context.entityManager.getItemsAtLocation(locationId); // Need entityManager back? Or pass it to resolver context
        const reasonCode = itemsInLocation.length === 0 ? 'SCOPE_EMPTY' : 'TARGET_NOT_FOUND';

        dispatch('action:take_failed', {
            actorId: actorId,
            targetName: targetName,
            reasonCode: reasonCode, // e.g., 'TARGET_NOT_FOUND' or 'SCOPE_EMPTY'
            locationId: locationId
        });
        messages.push({text: `Target resolution failed for '${targetName}', reason: ${reasonCode}`, type: 'internal'});
        // Return success: false, as the action didn't complete.
        return {success: false, messages};
    }

    // --- 3. Perform the Take Action ---
    const targetItemId = targetItemEntity.id;
    const itemName = getDisplayName(targetItemEntity);

    // Dispatch the internal game event FIRST to trigger state changes
    let success = false; // Default false
    try {
        dispatch('event:item_picked_up', {
            pickerId: actorId, // Use actorId consistently
            itemId: targetItemId,
            locationId: locationId
        });
        success = true; // Set success only if dispatch works

        // Dispatch semantic SUCCESS event
        dispatch('action:take_succeeded', {
            actorId: actorId,
            itemId: targetItemId,
            itemName: itemName,
            locationId: locationId
        });
        messages.push({text: `Dispatched action:take_succeeded for ${itemName} (${targetItemId})`, type: 'internal'});

    } catch (dispatchError) {
        // Log internal error
        const internalLogMsg = `Internal error occurred during item pick up event dispatch for ${itemName}.`;
        messages.push({text: internalLogMsg, type: 'error'}); // Keep internal log specific
        console.error(`Take Handler: Failed to dispatch event:item_picked_up for ${itemName} (${targetItemId}):`, dispatchError);

        // Dispatch semantic FAILURE event
        dispatch('action:take_failed', {
            actorId: actorId,
            targetName: itemName, // We know the item name at this point
            reasonCode: 'INTERNAL_PICKUP_ERROR',
            locationId: locationId,
            details: dispatchError // Optionally pass error details
        });
        messages.push({text: `Dispatched action:take_failed for ${itemName} due to pickup error`, type: 'internal'});
        // success remains false
    }

    // Return result
    return {
        success,
        messages, // Contains only internal messages now
        newState: undefined
    };
}