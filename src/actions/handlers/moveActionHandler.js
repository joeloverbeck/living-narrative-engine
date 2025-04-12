// src/actions/handlers/moveActionHandler.js

import {ConnectionsComponent} from '../../components/connectionsComponent.js';
import {PositionComponent} from '../../components/positionComponent.js';
import {validateRequiredCommandPart} from '../../utils/actionValidationUtils.js';

const DIRECTION_ALIASES = {
    'n': 'north', 's': 'south', 'e': 'east', 'w': 'west',
    'ne': 'northeast', 'nw': 'northwest', 'se': 'southeast', 'sw': 'southwest',
    'u': 'up', 'd': 'down',
    // Include canonical directions mapping to themselves for simplicity
    'north': 'north', 'south': 'south', 'east': 'east', 'west': 'west',
    'northeast': 'northeast', 'northwest': 'northwest', 'southeast': 'southeast', 'southwest': 'southwest',
    'up': 'up', 'down': 'down'
};

/** @typedef {import('../actionTypes.js').ActionContext} ActionContext */

/** @typedef {import('../actionTypes.js').ActionResult} ActionResult */

/**
 * Handles the 'core:action_move' action.
 * Validates the player's intent to move and emits 'event:move_attempted' if valid.
 * If validation fails or errors occur, emits 'action:move_failed'.
 * Does NOT modify player position directly. Relies on a MovementSystem to handle the event.
 * Relies solely on the provided context. Dispatches SEMANTIC events via context.dispatch.
 * @param {ActionContext} context - The action context.
 * @returns {ActionResult} - The result of the action validation (success/fail). Messages array is removed.
 */
export function executeMove(context) {
    // Destructure context, including dispatch and parsedCommand
    const {playerEntity, currentLocation, dataManager, entityManager, dispatch, parsedCommand} = context; // Added parsedCommand, removed targets
    let success = false; // Assume failure until event:move_attempted is dispatched

    // --- 1. Initial Validations ---
    if (!currentLocation) {
        const reasonCode = 'SETUP_ERROR';
        const details = 'Current location unknown';
        dispatch('action:move_failed', {
            actorId: playerEntity?.id || 'unknown',
            reasonCode: reasonCode,
            details: details
        });
        console.error("executeMove handler called with invalid currentLocation in context.");
        return {success: success};
    }

    // --- Validate required target (direction) using parsedCommand ---
    // Ticket 8: Use parsedCommand.directObjectPhrase
    if (!validateRequiredCommandPart(context, 'move', 'directObjectPhrase')) { // [cite: file:handlers/moveActionHandler.js]
        // validateRequiredCommandPart now handles the semantic event dispatch for missing target
        return {success: false};
    }

    // --- 2. Get Player's Position Component ---
    // (No changes needed in this section)
    const playerPositionComp = playerEntity.getComponent(PositionComponent);
    if (!playerPositionComp) {
        const reasonCode = 'SETUP_ERROR';
        const details = 'Player position unknown';
        dispatch('action:move_failed', {
            actorId: playerEntity.id,
            locationId: currentLocation.id,
            reasonCode: reasonCode,
            details: details
        });
        console.error(`executeMove: Player entity ${playerEntity.id} is missing PositionComponent.`);
        return {success: success};
    }
    const previousLocationId = playerPositionComp.locationId;

    if (previousLocationId !== currentLocation.id) {
        console.warn(`executeMove: Discrepancy between player PositionComponent location (${previousLocationId}) and context currentLocation (${currentLocation.id}). Proceeding based on context.`);
    }

    // --- 3. Process Direction and Connection ---
    // Ticket 8: Use parsedCommand.directObjectPhrase for direction
    const rawDirection = parsedCommand.directObjectPhrase.toLowerCase(); // Get the parsed phrase
    
    const direction = DIRECTION_ALIASES[rawDirection] || rawDirection;

    const connectionsComp = currentLocation.getComponent(ConnectionsComponent);
    if (!connectionsComp || !Array.isArray(connectionsComp.connections) || connectionsComp.connections.length === 0) {
        const reasonCode = 'NO_EXITS';
        dispatch('action:move_failed', {
            actorId: playerEntity.id,
            locationId: currentLocation.id,
            direction: direction,
            reasonCode: reasonCode
        });
        return {success: success};
    }

    // Use the appropriate method from ConnectionsComponent
    const connection = connectionsComp.getConnectionByDirection(direction); // Assuming this method exists and works

    // --- 4. Handle Connection Result and Validation ---
    // (No changes needed in this section regarding parsedCommand)
    if (connection) {
        const currentState = connection.state ?? connection.initial_state;
        if (currentState === 'locked') {
            const reasonCode = 'DIRECTION_LOCKED';
            dispatch('action:move_failed', {
                actorId: playerEntity.id,
                locationId: currentLocation.id,
                direction: direction,
                reasonCode: reasonCode,
                lockMessageOverride: connection.description_override
            });
            return {success: success};
        }

        const targetLocationId = connection.target;
        if (!targetLocationId) {
            const reasonCode = 'DATA_ERROR';
            const details = 'Invalid connection: missing target';
            dispatch('action:move_failed', {
                actorId: playerEntity.id,
                locationId: currentLocation.id,
                direction: direction,
                reasonCode: reasonCode,
                details: details
            });
            console.error(`Invalid connection data in ${currentLocation.id} for direction ${direction}: missing target.`);
            return {success: success};
        }

        const targetDefinition = dataManager.getEntityDefinition(targetLocationId);
        if (targetDefinition) {
            // --- Validation Passed - Dispatch Event ---
            try {
                const moveAttemptPayload = {
                    entityId: playerEntity.id,
                    targetLocationId: targetLocationId,
                    direction: direction,
                    previousLocationId: previousLocationId
                };
                dispatch('event:move_attempted', moveAttemptPayload);
                success = true;
            } catch (error) {
                const reasonCode = 'INTERNAL_DISPATCH_ERROR';
                dispatch('action:move_failed', {
                    actorId: playerEntity.id,
                    locationId: currentLocation.id,
                    direction: direction,
                    targetLocationId: targetLocationId,
                    reasonCode: reasonCode,
                    details: `Error during dispatch of event:move_attempted: ${error.message}`
                });
                console.error(`executeMove: Failed to dispatch move attempt event for ${playerEntity.id} moving to ${targetLocationId}`, error);
                success = false;
            }

        } else {
            const reasonCode = 'DATA_ERROR';
            const details = 'Target location definition not found';
            dispatch('action:move_failed', {
                actorId: playerEntity.id,
                locationId: currentLocation.id,
                direction: direction,
                targetLocationId: targetLocationId,
                reasonCode: reasonCode,
                details: details
            });
            console.error(`Move handler validation failed: Target location definition not found via dataManager for ID: ${targetLocationId}`);
        }
    } else {
        // No connection found for the specified direction
        const reasonCode = 'INVALID_DIRECTION';
        dispatch('action:move_failed', {
            actorId: playerEntity.id,
            locationId: currentLocation.id,
            direction: direction,
            reasonCode: reasonCode
        });
    }

    // --- 5. Return Result ---
    return {success: success};
}