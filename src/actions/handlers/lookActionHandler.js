// src/actions/handlers/lookActionHandler.js

import {NameComponent} from '../../components/nameComponent.js';
import {DescriptionComponent} from '../../components/descriptionComponent.js';
import {ConnectionsComponent} from '../../components/connectionsComponent.js';
import {EntitiesPresentComponent} from '../../components/entitiesPresentComponent.js'; // Added for future use
import {ItemComponent} from '../../components/itemComponent.js'; // Added for future use

// Import type definition JSDoc comments
/** @typedef {import('../actionTypes.js').ActionContext} ActionContext */
/** @typedef {import('../actionTypes.js').ActionResult} ActionResult */

/** @typedef {import('../actionTypes.js').ActionMessage} ActionMessage */

/**
 * Handles the 'core:action_look' action. Dispatches messages directly via context.dispatch.
 * @param {ActionContext} context
 * @returns {ActionResult}
 */
export function executeLook(context) {
    // Destructure context, including dispatch
    const {currentLocation, targets, entityManager, playerEntity, dispatch} = context;
    const messages = []; // Keep for potential non-UI use or logging
    let success = true; // Looking generally succeeds

    if (!currentLocation) {
        const errorMsg = "You can't see anything; your location is unknown.";
        dispatch('ui:message_display', {text: errorMsg, type: 'error'});
        messages.push({text: errorMsg, type: 'error'}); // Optional retain for result
        return {success: false, messages};
    }

    if (targets.length === 0) {
        // Look at the current location
        const nameComp = currentLocation.getComponent(NameComponent);
        const descComp = currentLocation.getComponent(DescriptionComponent);
        const connectionsComp = currentLocation.getComponent(ConnectionsComponent);
        const presentComp = currentLocation.getComponent(EntitiesPresentComponent);

        const locationName = nameComp ? nameComp.value : `Unnamed Location (${currentLocation.id})`;
        const locationDesc = descComp ? descComp.text : "You are in an undescribed location.";

        let itemsVisible = [];
        if (presentComp && Array.isArray(presentComp.entityIds)) {
            itemsVisible = presentComp.entityIds
                .map(id => entityManager.getEntityInstance(id))
                .filter(entity => entity && entity.hasComponent(ItemComponent))
                .map(itemEntity => itemEntity.getComponent(NameComponent)?.value || itemEntity.id);
        }

        let npcsVisible = [];
        if (presentComp && Array.isArray(presentComp.entityIds)) {
            npcsVisible = presentComp.entityIds
                .map(id => entityManager.getEntityInstance(id))
                .filter(entity => entity && entity.id !== playerEntity.id && !entity.hasComponent(ItemComponent))
                .map(npcEntity => npcEntity.getComponent(NameComponent)?.value || npcEntity.id);
        }

        let availableDirections = [];
        if (connectionsComp && Array.isArray(connectionsComp.connections)) {
            availableDirections = connectionsComp.connections
                .filter(conn => conn.state !== 'hidden')
                .map(conn => conn.direction)
                .filter(dir => dir);
        }

        // --- Construct the structured data payload ---
        /** @type {LocationRenderData} */
        const locationData = {
            name: locationName,
            description: locationDesc,
            exits: availableDirections,
            // Only include optional fields if they have content
            items: itemsVisible.length > 0 ? itemsVisible : undefined,
            npcs: npcsVisible.length > 0 ? npcsVisible : undefined,
        };

        // --- Dispatch the single structured event for the renderer ---
        dispatch('ui:display_location', locationData);
    } else {
        // Look at a specific target
        const targetName = targets.join(' ').toLowerCase();

        // TODO: Implement more robust target finding (check NPCs, items in room, self, items in inventory)
        if (targetName === 'self' || targetName === 'me') {
            const lookSelfMsg = "You look yourself over. You seem to be in one piece.";
            dispatch('ui:message_display', {text: lookSelfMsg, type: 'info'});
            messages.push({text: lookSelfMsg, type: 'info'}); // Optional retain
            // Could add health status, equipment etc. later
        }

        // Example: Check if target is an entity in the room (NPCs/Items)
        // Example: Check if target is an item in player inventory
        else {
            // Generic placeholder / "not found" message for now
            const lookTargetMsg1 = `You look closely at '${targetName}'...`;
            const lookTargetMsg2 = "Looking at specific things is not fully implemented.";
            dispatch('ui:message_display', {text: lookTargetMsg1, type: 'info'});
            dispatch('ui:message_display', {text: lookTargetMsg2, type: 'warning'});
            messages.push({text: lookTargetMsg1, type: 'info'}); // Optional retain
            messages.push({text: lookTargetMsg2, type: 'warning'}); // Optional retain
            // In a real implementation, set success = false if target not found
        }
    }

    return {success, messages}; // Return result (messages might be empty if not retained)
}