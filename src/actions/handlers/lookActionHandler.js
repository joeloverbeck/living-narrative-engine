// src/actions/handlers/lookActionHandler.js

import { NameComponent } from '../../components/nameComponent.js';
import { DescriptionComponent } from '../../components/descriptionComponent.js';
import { ConnectionsComponent } from '../../components/connectionsComponent.js';

// Import type definition JSDoc comments
/** @typedef {import('../actionTypes.js').ActionContext} ActionContext */
/** @typedef {import('../actionTypes.js').ActionResult} ActionResult */
/** @typedef {import('../actionTypes.js').ActionMessage} ActionMessage */

/**
 * Handles the 'core:action_look' action.
 * @param {ActionContext} context
 * @returns {ActionResult}
 */
export function executeLook(context) {
    const { currentLocation, targets, entityManager, playerEntity } = context;
    const messages = [];
    let success = true; // Looking generally succeeds, even if target not found

    if (!currentLocation) {
        messages.push({ text: "You can't see anything; your location is unknown.", type: 'error' });
        return { success: false, messages };
    }

    if (targets.length === 0) {
        // Look at the current location
        const nameComp = currentLocation.getComponent(NameComponent);
        const descComp = currentLocation.getComponent(DescriptionComponent);
        const connectionsComp = currentLocation.getComponent(ConnectionsComponent);

        const locationName = nameComp ? nameComp.value : `Unnamed Location (${currentLocation.id})`;
        const locationDesc = descComp ? descComp.text : "You are in an undescribed location.";

        let outputHtml = "";
        outputHtml += `<h2>${locationName}</h2>`;
        outputHtml += `<p>${locationDesc}</p>`;

        // TODO: Include items and NPCs present in the room description later
        // const itemsInRoom = ... entityManager.findEntitiesByLocation(currentLocation.id).filter(e => e.hasComponent(ItemComponent));
        // const NpcsInRoom = ... entityManager.findEntitiesByLocation(currentLocation.id).filter(e => e.hasComponent(NpcComponent));

        if (connectionsComp && Array.isArray(connectionsComp.connections) && connectionsComp.connections.length > 0) {
            const availableDirections = connectionsComp.connections
                .map(conn => conn.direction)
                .filter(dir => dir);
            outputHtml += `<p>Exits: ${availableDirections.join(', ')}</p>`;
        } else {
            outputHtml += `<p>There are no obvious exits.</p>`;
        }

        messages.push({ text: outputHtml, type: 'location' });

    } else {
        // Look at a specific target
        const targetName = targets.join(' ').toLowerCase();

        // TODO: Implement more robust target finding (check items in room, NPCs, self, items in inventory)
        // Simple placeholder logic:
        if (targetName === 'self' || targetName === 'me') {
            messages.push({ text: "You look yourself over. You seem to be in one piece.", type: 'info'});
            // Could add health status, equipment etc. later
        }
            // Example: Check if target is an item in the room (needs entity querying)
        // Example: Check if target is an item in player inventory
        else {
            // Generic placeholder / "not found" message for now
            messages.push({ text: `You look closely at '${targetName}'...`, type: 'info' });
            messages.push({ text: "Looking at specific things is not fully implemented.", type: 'warning' });
            // In a real implementation, set success = false if target not found
        }
    }

    return { success, messages }; // No newState change from looking
}