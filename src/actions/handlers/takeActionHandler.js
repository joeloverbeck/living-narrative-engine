// src/actions/handlers/takeActionHandler.js

/** @typedef {import('../actionTypes.js').ActionContext} ActionContext */
/** @typedef {import('../actionTypes.js').ActionResult} ActionResult */
/** @typedef {import('../../entities/entity.js').default} Entity */

import {getDisplayName, TARGET_MESSAGES} from "../../utils/messages.js";
import {ItemComponent} from "../../components/itemComponent.js";
import {resolveTargetEntity} from '../../services/targetResolutionService.js'; // ***** IMPORT NEW SERVICE *****

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

    if (!targets || targets.length === 0) {
        const errorMsg = TARGET_MESSAGES.PROMPT_WHAT('take');
        dispatch('ui:message_display', {text: errorMsg, type: 'error'});
        return {success: false, messages: [{text: errorMsg, type: 'error'}]};
    }

    const targetName = targets.join(' ');

    // --- 1. Resolve Target Item using Service ---
    const targetItemEntity = resolveTargetEntity(context, {
        scope: 'location_items', // Only items in the location
        requiredComponents: [ItemComponent], // Ensure it's an item (already implied by scope, but explicit)
        actionVerb: 'take',
        targetName: targetName,
        notFoundMessageKey: 'NOT_FOUND_TAKEABLE', // Specific message
        emptyScopeMessage: "There's nothing here to take.", // Custom empty message
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
        const errorMsg = TARGET_MESSAGES.INTERNAL_ERROR + " (Item pick up event dispatch failed)";
        dispatch('ui:message_display', {text: errorMsg, type: 'error'});
        messages.push({text: errorMsg, type: 'error'});
        console.error("Take Handler: Failed to dispatch event:item_picked_up event:", dispatchError);
        // success remains false
    }

    // Return result
    return {
        success,
        messages, // Contains internal logs and potentially the dispatch error message
        newState: undefined
    };
}