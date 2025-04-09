// src/actions/handlers/takeActionHandler.js

/** @typedef {import('../actionTypes.js').ActionContext} ActionContext */
/** @typedef {import('../actionTypes.js').ActionResult} ActionResult */
/** @typedef {import('../../entities/entity.js').default} Entity */

import {getDisplayName, TARGET_MESSAGES} from "../../utils/messages.js";
import {ItemComponent} from "../../components/itemComponent.js";
import {NameComponent} from "../../components/nameComponent.js";
import {findTarget} from "../../utils/targetFinder.js";

/**
 * Handles the 'take' action ('core:action_take'). Allows the player to pick up items
 * from the current location using findTarget for partial matching.
 * Dispatches UI messages via context.dispatch.
 * @param {ActionContext} context - The context for the action.
 * @returns {ActionResult} The result of the action.
 */
export function executeTake(context) {
    const { playerEntity, currentLocation, targets, entityManager, dispatch } = context;

    // Basic validation
    if (!playerEntity || !currentLocation) {
        console.error("executeTake: Missing player or location in context.");
        dispatch('ui:message_display', { text: TARGET_MESSAGES.INTERNAL_ERROR, type: 'error' });
        return { success: false, messages: [] };
    }

    if (!targets || targets.length === 0) {
        const errorMsg = TARGET_MESSAGES.PROMPT_WHAT('take');
        dispatch('ui:message_display', { text: errorMsg, type: 'error' }); // Use error type for prompt
        return { success: false, messages: [{ text: errorMsg, type: 'error' }] };
    }

    const targetName = targets.join(' '); // Keep case for messages

    // --- 1. Determine Search Scope (Takable items in location) ---
    const entityIdsInLocation = entityManager.getEntitiesInLocation(currentLocation.id);
    const searchableItems = [];
    if (entityIdsInLocation) {
        for (const entityId of entityIdsInLocation) {
            // Exclude self (shouldn't have ItemComponent anyway, but good practice)
            if (entityId === playerEntity.id) continue;

            const entity = entityManager.getEntityInstance(entityId);
            // Must exist, have ItemComponent, and NameComponent for matching
            // Future: Add check for TakableComponent or !CannotTakeComponent if needed
            if (entity && entity.hasComponent(ItemComponent) && entity.hasComponent(NameComponent)) {
                searchableItems.push(entity);
            }
        }
    }

    // Check if location is empty of searchable items *before* calling findTarget
    if (searchableItems.length === 0) {
        dispatch('ui:message_display', { text: "There's nothing here to take.", type: 'info' });
        return { success: false, messages: [] };
    }


    // --- 2. Find Target Item using Utility ---
    const findResult = findTarget(targetName, searchableItems);
    let targetItemEntity = null;
    let targetItemId = null;

    switch (findResult.status) {
        case 'NOT_FOUND': {
            const errorMsg = TARGET_MESSAGES.NOT_FOUND_TAKEABLE(targetName);
            dispatch('ui:message_display', { text: errorMsg, type: 'info' }); // Use info type for "not found"
            return { success: false, messages: [{ text: errorMsg, type: 'info' }] };
        }
        case 'FOUND_AMBIGUOUS': {
            const errorMsg = TARGET_MESSAGES.AMBIGUOUS_PROMPT('take', targetName, findResult.matches);
            dispatch('ui:message_display', { text: errorMsg, type: 'warning' });
            return { success: false, messages: [{ text: errorMsg, type: 'warning' }] };
        }
        case 'FOUND_UNIQUE':
            targetItemEntity = findResult.matches[0];
            targetItemId = targetItemEntity.id;
            break; // Proceed with the action
        default: {
            const errorMsg = TARGET_MESSAGES.INTERNAL_ERROR + " (Unexpected findTarget status)";
            dispatch('ui:message_display', { text: errorMsg, type: 'error' });
            console.error("executeTake: Unexpected status from findTarget:", findResult.status);
            return { success: false, messages: [] };
        }
    }

    // --- 3. Perform the Take Action ---
    // Future Enhancement: Check if item is takeable (e.g., not too heavy, not nailed down)
    // if (targetItemEntity.hasComponent(CannotTakeComponent)) { ... }

    // Get Item Name for UI Message
    const itemName = getDisplayName(targetItemEntity);

    // Dispatch UI success message *first*
    dispatch('ui:message_display', { text: `You take the ${itemName}.`, type: 'success' }); // Use success type

    // Dispatch the internal game event to trigger inventory update and entity removal
    try {
        dispatch('event:item_picked_up', {
            pickerId: playerEntity.id,
            itemId: targetItemId,
            locationId: currentLocation.id // For spatial index updates
        });
    } catch (dispatchError) {
        const errorMsg = TARGET_MESSAGES.INTERNAL_ERROR + " (Item pick up event dispatch failed)";
        dispatch('ui:message_display', { text: errorMsg, type: 'error' });
        console.error("Take Handler: Failed to dispatch event:item_picked_up event:", dispatchError);
        // Should we revert the UI message? Probably not, but the internal state might be inconsistent.
        return { success: false, messages: [{ text: errorMsg, type: 'error' }] }; // Action failed if event fails
    }


    // Return success result
    return {
        success: true,
        messages: [{text: `Took ${itemName} (${targetItemId})`, type: 'internal'}], // Internal log
        newState: undefined
    };
}