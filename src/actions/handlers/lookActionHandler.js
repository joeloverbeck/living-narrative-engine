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

        // Dispatch Name as H2 (HTML within message text)
        dispatch('ui:message_display', {text: `<h2>${locationName}</h2>`, type: 'location-name'}); // Use specific type?

        // Dispatch Description
        dispatch('ui:message_display', {text: `<p>${locationDesc}</p>`, type: 'location-desc'});

        // --- Display Items Present ---
        let itemsVisible = [];
        if (presentComp && Array.isArray(presentComp.entityIds)) {
            itemsVisible = presentComp.entityIds
                .map(id => entityManager.getEntityInstance(id))
                .filter(entity => entity && entity.hasComponent(ItemComponent)) // Check if it's an item
                .map(itemEntity => itemEntity.getComponent(NameComponent)?.value || itemEntity.id); // Get name or ID
        }
        if (itemsVisible.length > 0) {
            dispatch('ui:message_display', {
                text: `<p>Items here: ${itemsVisible.join(', ')}</p>`,
                type: 'location-items'
            });
        }

        // --- Display NPCs/Entities Present (excluding player and items) ---
        let npcsVisible = [];
        if (presentComp && Array.isArray(presentComp.entityIds)) {
            npcsVisible = presentComp.entityIds
                .map(id => entityManager.getEntityInstance(id))
                .filter(entity => entity && entity.id !== playerEntity.id && !entity.hasComponent(ItemComponent)) // Exclude player and items
                .map(npcEntity => npcEntity.getComponent(NameComponent)?.value || npcEntity.id); // Get name or ID
        }
        if (npcsVisible.length > 0) {
            dispatch('ui:message_display', {text: `<p>You see: ${npcsVisible.join(', ')}</p>`, type: 'location-npcs'});
        }

        // --- Display Exits ---
        if (connectionsComp && Array.isArray(connectionsComp.connections) && connectionsComp.connections.length > 0) {
            const availableDirections = connectionsComp.connections
                .filter(conn => conn.state !== 'hidden') // Respect hidden state
                .map(conn => conn.direction)
                .filter(dir => dir);
            if (availableDirections.length > 0) {
                dispatch('ui:message_display', {
                    text: `<p>Exits: ${availableDirections.join(', ')}</p>`,
                    type: 'location-exits'
                });
            } else {
                dispatch('ui:message_display', {text: `<p>There are no obvious exits.</p>`, type: 'location-exits'});
            }
        } else {
            dispatch('ui:message_display', {text: `<p>There are no obvious exits.</p>`, type: 'location-exits'});
        }

        // Add the combined output to messages if needed for logging/testing
        // messages.push({ text: `Looked at location ${locationName}`, type: 'internal' }); // Example

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