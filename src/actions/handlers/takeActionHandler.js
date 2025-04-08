// src/actions/handlers/takeActionHandler.js

/** @typedef {import('../actionTypes.js').ActionContext} ActionContext */
/** @typedef {import('../actionTypes.js').ActionResult} ActionResult */
/** @typedef {import('../../entities/entity.js').default} Entity */
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
        dispatch('ui:message_display', {text: "Internal error: Cannot perform action.", type: 'error'});
        return {success: false, messages: []};
    }

    if (!targets || targets.length === 0) {
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
        // --- Check if Item is Takeable (Future Enhancement Placeholder) ---
        // ... (keep placeholder if needed) ...
        // --- End Placeholder ---

        // 1. Get Item Name for UI Message
        const itemName = targetItemEntity.getComponent(NameComponent)?.value ?? targetName; // Use optional chaining

        // 2. Dispatch UI success message *first*
        dispatch('ui:message_display', {text: `You take the ${itemName}.`, type: 'info'});

        // 3. Dispatch the internal game event
        dispatch('event:item_picked_up', {
            pickerId: playerEntity.id,
            itemId: targetItemId,
            locationId: currentLocation.id // Include location ID
        });

        // Return success result (messages array is empty as they were dispatched)
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