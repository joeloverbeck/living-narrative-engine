// src/actions/handlers/moveActionHandler.js

import { ConnectionsComponent } from '../../components/connectionsComponent.js';

// Import type definition JSDoc comments
/** @typedef {import('../actionTypes.js').ActionContext} ActionContext */
/** @typedef {import('../actionTypes.js').ActionResult} ActionResult */
/** @typedef {import('../actionTypes.js').ActionMessage} ActionMessage */

/**
 * Handles the 'core:action_move' action.
 * Relies solely on the provided context for game state and dependencies.
 * Signals a location change back to GameLoop via `ActionResult.newState`.
 *
 * @param {ActionContext} context - The action context.
 * @returns {ActionResult} - The result of the action.
 */
export function executeMove(context) {
    // Destructure context for easier access
    const { playerEntity, currentLocation, targets, dataManager, entityManager } = context; // Added playerEntity, dm, em for completeness, though not used heavily here yet
    /** @type {ActionMessage[]} */
    const messages = [];
    let success = false;
    let newState = undefined; // Explicitly undefined initially

    if (!currentLocation) {
        // Should ideally be caught by GameLoop before calling, but safety check
        messages.push({ text: "Cannot move: your current location is unknown.", type: 'error' });
        console.error("executeMove handler called with invalid currentLocation in context.");
        return { success, messages, newState };
    }

    if (targets.length === 0) {
        messages.push({ text: "Move where? (Specify a direction like 'north', 'south', 'east', or 'west')", type: 'error' });
        return { success, messages, newState };
    }

    const direction = targets[0].toLowerCase();

    const connectionsComp = currentLocation.getComponent(ConnectionsComponent);
    if (!connectionsComp || !Array.isArray(connectionsComp.connections) || connectionsComp.connections.length === 0) {
        messages.push({ text: "There are no obvious exits from here.", type: 'info' });
        // Optional: console.warn maybe too noisy if many rooms lack connections
        return { success, messages, newState };
    }

    const connection = connectionsComp.connections.find(
        conn => conn.direction && conn.direction.toLowerCase() === direction
    );

    if (connection) {
        // TODO: Add connection state checks (locked, blocked) using context.dataManager/entityManager if needed
        const targetLocationId = connection.target;
        if (!targetLocationId) {
            messages.push({ text: `The way ${direction} seems improperly constructed.`, type: 'error' });
            console.error(`Invalid connection data in ${currentLocation.id} for direction ${direction}: missing target.`);
            return { success, messages, newState };
        }

        // Verify the target location *definition* exists using context.dataManager
        // GameLoop will handle instance creation/retrieval using context.entityManager
        const targetDefinition = dataManager.getEntityDefinition(targetLocationId);
        if (targetDefinition) {
            success = true;
            messages.push({ text: `You move ${direction}.`, type: 'info' });
            // +++ Signal state change to GameLoop +++
            // Do NOT modify context.currentLocation here.
            newState = { currentLocationId: targetLocationId };
        } else {
            // This means the connection points to an ID that doesn't exist in the loaded data.
            messages.push({ text: `Something is wrong with the passage leading ${direction}.`, type: 'error' });
            console.error(`Move handler failed: Target location definition not found via dataManager for ID: ${targetLocationId}`);
            // success remains false
        }
    } else {
        messages.push({ text: "You can't go that way.", type: 'info' });
        // success remains false
    }

    // Return the complete ActionResult
    return { success, messages, newState };
}