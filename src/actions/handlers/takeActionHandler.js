// src/actions/handlers/takeActionHandler.js

/** @typedef {import('../actionTypes.js').ActionContext} ActionContext */
/** @typedef {import('../actionTypes.js').ActionResult} ActionResult */
/** @typedef {import('../../entities/entity.js').default} Entity */
import {ItemComponent} from '../../components/itemComponent.js';
import {NameComponent} from '../../components/nameComponent.js';
// Remove the import for EntitiesPresentComponent as it's no longer used here
// import {EntitiesPresentComponent} from '../../components/entitiesPresentComponent.js';

/**
 * Handles the 'take' action ('core:action_take'). Allows the player to pick up items
 * from the current location using spatial queries. Dispatches UI messages via context.dispatch.
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

    // Find the item in the current location using the entity manager's spatial query
    const entityIdsInLocation = entityManager.getEntitiesInLocation(currentLocation.id);

    // Check if the location is empty according to the spatial index
    if (!entityIdsInLocation || entityIdsInLocation.size === 0) {
        // Dispatch feedback to UI
        dispatch('ui:message_display', {text: "There's nothing here to take.", type: 'info'});
        return {success: false, messages: []};
    }

    let targetItemEntity = null;
    let targetItemId = null;

    // Iterate through the entity IDs returned by the spatial query
    for (const entityId of entityIdsInLocation) {
        const entity = entityManager.getEntityInstance(entityId);
        if (!entity) {
            // Should generally not happen if spatial index is correct, but good to check
            console.warn(`executeTake: Entity instance not found for ID ${entityId} from spatial query.`);
            continue; // Skip if entity instance not found
        }

        // Ensure we don't try to pick up the player themselves
        if (entity.id === playerEntity.id) {
            continue;
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
        // Could add checks here, e.g., if item has CannotTakeComponent
        // if (targetItemEntity.hasComponent(CannotTakeComponent)) {
        //    dispatch('ui:message_display', {text: `You cannot take the ${itemName}.`, type: 'info'});
        //    return { success: false, messages: [] };
        // }
        // --- End Placeholder ---

        // 1. Get Item Name for UI Message
        const itemName = targetItemEntity.getComponent(NameComponent)?.value ?? targetName; // Use optional chaining

        // 2. Dispatch UI success message *first*
        dispatch('ui:message_display', {text: `You take the ${itemName}.`, type: 'info'});

        // 3. Dispatch the internal game event to trigger inventory update and entity removal
        dispatch('event:item_picked_up', {
            pickerId: playerEntity.id,
            itemId: targetItemId,
            locationId: currentLocation.id // Include location ID for spatial index updates
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