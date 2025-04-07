// src/actions/handlers/takeActionHandler.js

/** @typedef {import('../actionTypes.js').ActionContext} ActionContext */
/** @typedef {import('../actionTypes.js').ActionResult} ActionResult */
/** @typedef {import('../../entities/entity.js').default} Entity */
import {InventoryComponent} from '../../components/inventoryComponent.js';
import {ItemComponent} from '../../components/itemComponent.js';
import {NameComponent} from '../../components/nameComponent.js';
import {EntitiesPresentComponent} from '../../components/entitiesPresentComponent.js';

/**
 * Handles the 'take' action ('core:action_take'). Allows the player to pick up items
 * from the current location. Dispatches UI messages via context.dispatch.
 * MVP: Handles taking a single item by name, assumes names are unique in the location for now.
 * @param {ActionContext} context - The context for the action.
 * @returns {ActionResult} The result of the action (success/fail, empty messages array).
 */
export function executeTake(context) {
    const {playerEntity, currentLocation, targets, entityManager, dispatch} = context;

    // Basic validation
    if (!playerEntity || !currentLocation) {
        console.error("executeTake: Missing player or location in context.");
        // Dispatch error message to UI
        dispatch('ui:message_display', {text: "Internal error: Cannot perform action.", type: 'error'});
        // Return failure, messages array is now empty as it was dispatched
        return {success: false, messages: []};
    }

    if (!targets || targets.length === 0) {
        // Dispatch feedback to UI
        dispatch('ui:message_display', {text: "Take what?", type: 'info'});
        return {success: false, messages: []};
    }

    const targetName = targets.join(' ').trim().toLowerCase(); // Handle multi-word targets simply

    // Find the item in the current location
    const locationEntitiesPresent = currentLocation.getComponent(EntitiesPresentComponent);
    if (!locationEntitiesPresent || locationEntitiesPresent.entityIds.length === 0) {
        // Dispatch feedback to UI
        dispatch('ui:message_display', {text: "There's nothing here to take.", type: 'info'});
        return {success: false, messages: []};
    }

    let targetItemEntity = null;
    let targetItemId = null;

    for (const entityId of locationEntitiesPresent.entityIds) {
        const entity = entityManager.getEntityInstance(entityId);
        if (!entity) {
            continue; // Skip if entity instance not found
        }

        const nameComp = entity.getComponent(NameComponent);
        const itemComp = entity.getComponent(ItemComponent);

        // Check if it's an item and has a name matching the target
        if (itemComp && nameComp && nameComp.value.toLowerCase() === targetName) {
            targetItemEntity = entity;
            targetItemId = entityId;
            break; // Found the first match (MVP limitation)
        }
    }

    // Process the take action if item was found
    if (targetItemEntity && targetItemId) {
        const playerInventory = playerEntity.getComponent(InventoryComponent);
        if (!playerInventory) {
            console.error(`executeTake: Player entity ${playerEntity.id} missing InventoryComponent!`);
            // Dispatch error message to UI
            dispatch('ui:message_display', {text: "Internal error: Your inventory is broken!", type: 'error'});
            return {success: false, messages: []};
        }

        // --- Check if Item is Takeable (Future Enhancement Placeholder) ---
        // const itemDetails = targetItemEntity.getComponent(ItemComponent);
        // if (itemDetails && itemDetails.takeable === false) {
        //     dispatch('ui:message_display', { text: `You cannot take the ${targetName}.`, type: 'info' });
        //     return { success: false, messages: [] };
        // }
        // --- End Placeholder ---

        // Add item to player inventory
        playerInventory.addItem(targetItemId);

        // Remove item from location's entities list
        const removed = locationEntitiesPresent.removeEntity(targetItemId);
        if (!removed) {
            console.warn(`executeTake: Failed to remove ${targetItemId} from location ${currentLocation.id}'s EntitiesPresentComponent after supposedly finding it.`);
            // Optionally dispatch a warning? Probably not necessary for player.
        }

        // Dispatch internal game event (NOT a UI message)
        dispatch('event:item_taken', {
            player: playerEntity,
            item: targetItemEntity,
            location: currentLocation
        });

        // Dispatch success message to UI
        const itemName = targetItemEntity.getComponent(NameComponent).value; // Get the proper case name
        dispatch('ui:message_display', {text: `You take the ${itemName}.`, type: 'info'});

        // Return success result (messages array is empty)
        return {
            success: true,
            messages: [],
            newState: undefined // No core state change needed from the handler itself
        };

    } else {
        // Item not found - Dispatch feedback to UI
        dispatch('ui:message_display', {text: `You don't see any item '${targets.join(' ')}' here.`, type: 'info'});
        return {
            success: false,
            messages: [],
            newState: undefined
        };
    }
}