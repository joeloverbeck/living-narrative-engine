// src/actions/handlers/takeActionHandler.js

/** @typedef {import('../actionTypes.js').ActionContext} ActionContext */
/** @typedef {import('../actionTypes.js').ActionResult} ActionResult */
/** @typedef {import('../../entities/entity.js').default} Entity */

import {getDisplayName, TARGET_MESSAGES} from "../../utils/messages.js";
import {ItemComponent} from "../../components/itemComponent.js";
import {resolveTargetEntity} from '../../services/targetResolutionService.js';
import {validateRequiredTargets} from '../../utils/actionValidationUtils.js'; // ***** IMPORT NEW UTILITY *****

/**
 * Handles the 'take' action ('core:action_take'). Allows the player to pick up items
 * from the current location using TargetResolutionService.
 * Dispatches UI messages via context.dispatch.
 * @param {ActionContext} context - The context for the action.
 * @returns {ActionResult} The result of the action.
 */
export function executeTake(context) {
    const {playerEntity, currentLocation, targets, dispatch} = context; // Removed entityManager
    const messages = [];

    // Basic validation
    if (!playerEntity || !currentLocation) {
        console.error("executeTake: Missing player or location in context.");
        dispatch('ui:message_display', {text: TARGET_MESSAGES.INTERNAL_ERROR, type: 'error'});
        return {success: false, messages: []};
    }

    // --- Validate required targets ---
    if (!validateRequiredTargets(context, 'take')) {
        return {success: false, messages: [], newState: undefined}; // Validation failed, message dispatched by utility
    }

    const targetName = targets.join(' ');

    // --- 1. Resolve Target Item using Service ---
    const targetItemEntity = resolveTargetEntity(context, {
        scope: 'location_items',
        requiredComponents: [ItemComponent],
        actionVerb: 'take',
        targetName: targetName,
        notFoundMessageKey: 'NOT_FOUND_TAKEABLE',
        emptyScopeMessage: "There's nothing here to take.",
    });

    // --- 2. Handle Resolver Result ---
    if (!targetItemEntity) {
        // Failure message dispatched by resolver
        return {success: false, messages};
    }

    // --- 3. Perform the Take Action ---
    const targetItemId = targetItemEntity.id;
    const itemName = getDisplayName(targetItemEntity);

    // Dispatch UI success message *first*
    dispatch('ui:message_display', {text: `You take the ${itemName}.`, type: 'success'});
    messages.push({text: `Displayed take success for ${itemName}`, type: 'internal'});

    // Dispatch the internal game event to trigger inventory update and entity removal
    let success = false; // Default false
    try {
        dispatch('event:item_picked_up', {
            pickerId: playerEntity.id,
            itemId: targetItemId,
            locationId: currentLocation.id // For spatial index updates
        });
        success = true; // Set success only if dispatch works
        messages.push({text: `Dispatched event:item_picked_up for ${itemName} (${targetItemId})`, type: 'internal'});
    } catch (dispatchError) {
        // Replace concatenated hardcoded string with direct use of TARGET_MESSAGES.INTERNAL_ERROR
        // The specific error context is logged to the console below.
        const userFacingErrorMsg = TARGET_MESSAGES.INTERNAL_ERROR;
        const internalLogMsg = `Internal error occurred during item pick up event dispatch for ${itemName}.`;

        dispatch('ui:message_display', {text: userFacingErrorMsg, type: 'error'});
        messages.push({text: internalLogMsg, type: 'error'}); // Keep internal log specific
        console.error(`Take Handler: Failed to dispatch event:item_picked_up for ${itemName} (${targetItemId}):`, dispatchError);
        // success remains false
    }

    // Return result
    return {
        success,
        messages,
        newState: undefined
    };
}