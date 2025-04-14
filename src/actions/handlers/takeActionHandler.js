// src/actions/handlers/takeActionHandler.js

/** @typedef {import('../actionTypes.js').ActionContext} ActionContext */
/** @typedef {import('../actionTypes.js').ActionResult} ActionResult */
/** @typedef {import('../../entities/entity.js').default} Entity */

import {getDisplayName} from "../../utils/messages.js";
import {ItemComponent} from "../../components/itemComponent.js";
import {resolveTargetEntity} from '../../services/entityFinderService.js';
import {validateRequiredCommandPart} from '../../utils/actionValidationUtils.js';

/**
 * Handles the 'take' action ('core:take'). Allows the player to pick up items
 * from the current location using TargetResolutionService.
 * Dispatches semantic events (e.g., 'action:take_succeeded', 'action:take_failed')
 * instead of directly dispatching UI messages.
 * @param {ActionContext} context - The context for the action.
 * @returns {ActionResult} The result of the action.
 */
export function executeTake(context) {
    // Destructure context, including parsedCommand. Note: 'targets' is no longer needed here.
    const {playerEntity, currentLocation, dispatch, parsedCommand} = context;
    const messages = []; // Still useful for internal logging

    // Basic validation
    if (!playerEntity || !currentLocation) {
        console.error("executeTake: Missing player or location in context.");
        // Dispatch semantic failure event instead of UI message
        dispatch('action:take_failed', {
            actorId: playerEntity?.id || 'unknown', // Include actor if possible
            // Use parsed phrase if available, otherwise indicate missing target
            targetName: parsedCommand?.directObjectPhrase || '(missing target)',
            reasonCode: 'SETUP_ERROR',
            locationId: currentLocation?.id || 'unknown'
        });
        messages.push({text: "Setup error: Missing player or location.", type: 'internal_error'});
        return {success: false, messages: messages}; // Keep internal messages
    }

    const actorId = playerEntity.id;
    const locationId = currentLocation.id;

    // --- Validate required command part (direct object) using parsedCommand ---
    // This call fulfills AC1.
    if (!validateRequiredCommandPart(context, 'take', 'directObjectPhrase')) { // [cite: file:handlers/takeActionHandler.js]
        // Assuming the utility handles dispatching the semantic failure event now.
        return {success: false, messages: [], newState: undefined};
    }

    // --- Get target name directly from parsedCommand ---
    // This line fulfills AC2 and AC3 (by replacing the old targets.join(' ') logic).
    const targetName = parsedCommand.directObjectPhrase;

    messages.push({
        text: `Intent: Player ${actorId} attempting to take '${targetName}' in ${locationId}`,
        type: 'internal'
    });


    // --- 1. Resolve Target Item using Service ---
    // NOTE: Assumes resolveTargetEntity *might* dispatch UI messages directly for
    //       'not found' or 'empty scope'. Ideally, it would return null/error
    //       and we dispatch the semantic event here.
    const targetItemEntity = resolveTargetEntity(context, {
        scope: 'location_items',
        requiredComponents: [ItemComponent],
        actionVerb: 'take',
        // Use the targetName derived from parsedCommand.directObjectPhrase. This fulfills AC4.
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
        // Use the correct method name and check the size of the returned Set
        const entityIdsInLocation = context.entityManager.getEntitiesInLocation(locationId);
        const reasonCode = entityIdsInLocation.size === 0 ? 'SCOPE_EMPTY' : 'TARGET_NOT_FOUND';

        dispatch('action:take_failed', {
            actorId: actorId,
            targetName: targetName, // Use the name from parsedCommand
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