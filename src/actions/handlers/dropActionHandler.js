// src/actions/handlers/dropActionHandler.js

/** @typedef {import('../actionTypes.js').ActionContext} ActionContext */
/** @typedef {import('../actionTypes.js').ActionResult} ActionResult */
/** @typedef {import('../../entities/entity.js').default} Entity */

import { InventoryComponent } from '../../components/inventoryComponent.js';
import { PositionComponent } from '../../components/positionComponent.js';
import { NameComponent } from '../../components/nameComponent.js';
import { findTarget } from '../../utils/targetFinder.js'; // Assuming utility exists
import { getDisplayName, TARGET_MESSAGES } from '../../utils/messages.js'; // Assuming utility exists

/**
 * Handles the 'drop' action ('core:action_drop'). Allows the player to drop items
 * from their inventory into the current location.
 * @param {ActionContext} context - The context for the action.
 * @returns {ActionResult} The result of the action.
 */
export function executeDrop(context) {
    const { playerEntity, currentLocation, targets, entityManager, dispatch } = context;
    const messages = [];

    // --- Basic Validation ---
    if (!playerEntity || !currentLocation) {
        console.error("executeDrop: Missing player or location in context.");
        dispatch('ui:message_display', { text: TARGET_MESSAGES.INTERNAL_ERROR, type: 'error' });
        return { success: false, messages: [{ text: TARGET_MESSAGES.INTERNAL_ERROR, type: 'error' }] };
    }

    if (!targets || targets.length === 0) {
        const errorMsg = TARGET_MESSAGES.PROMPT_WHAT('drop');
        dispatch('ui:message_display', { text: errorMsg, type: 'error' });
        return { success: false, messages: [{ text: errorMsg, type: 'error' }] };
    }

    const targetName = targets.join(' ');

    // --- Get Player Inventory ---
    const playerInventory = playerEntity.getComponent(InventoryComponent);
    if (!playerInventory) {
        const errorMsg = TARGET_MESSAGES.INTERNAL_ERROR_COMPONENT('Inventory');
        dispatch('ui:message_display', { text: errorMsg, type: 'error' });
        console.error("executeDrop: Player entity missing InventoryComponent.");
        return { success: false, messages: [{ text: errorMsg, type: 'error' }] };
    }

    // --- 1. Determine Search Scope (Items in Player Inventory) ---
    const itemIdsInInventory = playerInventory.getItems();
    const searchableItems = [];
    for (const itemId of itemIdsInInventory) {
        const entity = entityManager.getEntityInstance(itemId);
        // Must exist and have NameComponent for matching
        if (entity && entity.hasComponent(NameComponent)) {
            searchableItems.push(entity);
        } else if (entity) {
            console.warn(`executeDrop: Item ${itemId} in inventory lacks NameComponent.`);
        } else {
            console.warn(`executeDrop: Item ID ${itemId} in inventory but instance not found.`);
        }
    }

    if (searchableItems.length === 0) {
        dispatch('ui:message_display', { text: TARGET_MESSAGES.NOTHING_CARRIED, type: 'info' }); // Assuming message exists
        return { success: false, messages: [{ text: TARGET_MESSAGES.NOTHING_CARRIED, type: 'info' }] };
    }


    // --- 2. Find Target Item using Utility ---
    const findResult = findTarget(targetName, searchableItems);
    let targetItemEntity = null;
    let targetItemId = null;

    switch (findResult.status) {
        case 'NOT_FOUND': {
            const errorMsg = TARGET_MESSAGES.NOT_FOUND_INVENTORY(targetName);
            dispatch('ui:message_display', { text: errorMsg, type: 'info' });
            return { success: false, messages: [{ text: errorMsg, type: 'info' }] };
        }
        case 'FOUND_AMBIGUOUS': {
            const errorMsg = TARGET_MESSAGES.AMBIGUOUS_PROMPT('drop', targetName, findResult.matches);
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
            console.error("executeDrop: Unexpected status from findTarget:", findResult.status);
            return { success: false, messages: [{ text: errorMsg, type: 'error' }] };
        }
    }

    // --- 3. Perform the Drop Action ---
    const itemName = getDisplayName(targetItemEntity); // Get name before removing

    // a. Remove itemId from playerEntity's InventoryComponent
    const removed = playerInventory.removeItem(targetItemId); // Assuming removeItem method exists
    if (!removed) {
        // This case should ideally not happen if findTarget worked correctly
        const errorMsg = TARGET_MESSAGES.INTERNAL_ERROR + ` (Failed to remove ${itemName} from inventory)`;
        dispatch('ui:message_display', { text: errorMsg, type: 'error' });
        console.error(`executeDrop: Failed to remove item ${targetItemId} which was found by findTarget.`);
        return { success: false, messages: [{ text: errorMsg, type: 'error' }] };
    }
    messages.push({ text: `Removed ${itemName} (${targetItemId}) from inventory`, type: 'internal' });


    // b. Get/Ensure itemEntity has PositionComponent
    let positionComp = targetItemEntity.getComponent(PositionComponent);
    if (!positionComp) {
        // Items should ideally always have a PositionComponent, even if locationId is null. Add one if missing.
        console.warn(`executeDrop: Item ${targetItemId} missing PositionComponent. Adding one.`);
        try {
            // Assuming addComponent takes component class and initial data
            positionComp = new PositionComponent({ locationId: null, x: 0, y: 0 });
            targetItemEntity.addComponent(positionComp);
        } catch (addCompError) {
            const errorMsg = TARGET_MESSAGES.INTERNAL_ERROR + ` (Failed to add PositionComponent to ${itemName})`;
            dispatch('ui:message_display', { text: errorMsg, type: 'error' });
            console.error(`executeDrop: Failed to add PositionComponent to item ${targetItemId}:`, addCompError);
            // Attempt to revert inventory removal? Risky. Log and fail.
            playerInventory.addItem(targetItemId); // Try putting it back
            return { success: false, messages: [{ text: errorMsg, type: 'error' }] };
        }
    }

    // c. Set PositionComponent's locationId to currentLocation.id
    // Using 0,0 for x,y as default. Could use player's x,y if available and relevant.
    const oldLocationId = positionComp.locationId; // Should be null if coming from inventory
    positionComp.setLocation(currentLocation.id, 0, 0); // [cite: 8]
    messages.push({ text: `Set ${itemName} (${targetItemId}) position to ${currentLocation.id}`, type: 'internal' });

    // d. Call entityManager.notifyPositionChange
    entityManager.notifyPositionChange(targetItemId, oldLocationId, currentLocation.id); // Notify SpatialIndexManager
    messages.push({ text: `Notified position change for ${itemName} (${targetItemId})`, type: 'internal' });

    // e. Add relevant UI messages
    const successMsg = `You drop the ${itemName}.`;
    dispatch('ui:message_display', { text: successMsg, type: 'success' });
    messages.push({ text: successMsg, type: 'success' });

    // f. (Optional) Dispatch game event
    try {
        dispatch('event:item_dropped', {
            dropperId: playerEntity.id,
            itemId: targetItemId,
            locationId: currentLocation.id,
            itemInstance: targetItemEntity
        });
        messages.push({ text: `Dispatched event:item_dropped for ${itemName}`, type: 'internal' });
    } catch (e) {
        console.error("Failed to dispatch item_dropped event:", e);
        messages.push({text: "Internal warning: Failed to dispatch item_dropped event.", type: 'warning'});
    }


    // --- Return Success ---
    return {
        success: true,
        messages: messages,
        newState: undefined
    };
}
