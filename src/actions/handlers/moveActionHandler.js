// src/actions/handlers/moveActionHandler.js

import {ConnectionsComponent} from '../../components/connectionsComponent.js';
import {PositionComponent} from '../../components/positionComponent.js';
import {validateRequiredTargets} from '../../utils/actionValidationUtils.js';

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
    // Destructure context, including dispatch
    const {playerEntity, currentLocation, targets, dataManager, entityManager, dispatch} = context;
    let success = false; // Assume failure until event:move_attempted is dispatched

    // --- 1. Initial Validations ---
    if (!currentLocation) {
        const reasonCode = 'SETUP_ERROR';
        const details = 'Current location unknown';
        dispatch('action:move_failed', {
            actorId: playerEntity?.id || 'unknown', // Include actorId if possible
            reasonCode: reasonCode,
            details: details
        });
        console.error("executeMove handler called with invalid currentLocation in context.");
        return {success: success}; // Return immediately on fundamental setup error
    }

    // --- Validate required target (direction) ---
    // Relies on validateRequiredTargets to dispatch its own semantic event if needed.
    if (!validateRequiredTargets(context, 'move')) {
        // validateRequiredTargets now handles the semantic event dispatch for missing target
        return {success: false}; // Keep success as false, no messages array needed
    }

    // --- 2. Get Player's Position Component ---
    const playerPositionComp = playerEntity.getComponent(PositionComponent);
    if (!playerPositionComp) {
        const reasonCode = 'SETUP_ERROR';
        const details = 'Player position unknown';
        dispatch('action:move_failed', {
            actorId: playerEntity.id,
            locationId: currentLocation.id, // Add location context if available
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
    const direction = targets[0].toLowerCase();

    const connectionsComp = currentLocation.getComponent(ConnectionsComponent);
    if (!connectionsComp || !Array.isArray(connectionsComp.connections) || connectionsComp.connections.length === 0) {
        const reasonCode = 'NO_EXITS';
        dispatch('action:move_failed', {
            actorId: playerEntity.id,
            locationId: currentLocation.id,
            direction: direction, // Direction attempted is still relevant
            reasonCode: reasonCode
        });
        return {success: success}; // Not a failure in the sense of error, but move did not succeed.
    }

    const connection = connectionsComp.getConnection(direction);

    // --- 4. Handle Connection Result and Validation ---
    if (connection) {
        const currentState = connection.state ?? connection.initial_state;
        if (currentState === 'locked') {
            const reasonCode = 'DIRECTION_LOCKED';
            dispatch('action:move_failed', {
                actorId: playerEntity.id,
                locationId: currentLocation.id,
                direction: direction,
                reasonCode: reasonCode,
                // Pass optional override message hint for NotificationUISystem
                lockMessageOverride: connection.description_override
            });
            return {success: success}; // Move did not succeed.
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
                // Dispatch the core semantic event indicating a valid move attempt
                dispatch('event:move_attempted', moveAttemptPayload);
                success = true; // Mark as successful *dispatch* of the attempt
                // REMOVED: Direct dispatch of "You move {direction}" message
                console.log(`executeMove: Dispatched event:move_attempted for entity ${playerEntity.id} to ${targetLocationId} (direction: ${direction})`);
            } catch (error) {
                // Handle internal errors during the *dispatch* process itself
                const reasonCode = 'INTERNAL_DISPATCH_ERROR';
                dispatch('action:move_failed', {
                    actorId: playerEntity.id,
                    locationId: currentLocation.id,
                    direction: direction, // Context is helpful
                    targetLocationId: targetLocationId,
                    reasonCode: reasonCode,
                    details: `Error during dispatch of event:move_attempted: ${error.message}`
                });
                console.error(`executeMove: Failed to dispatch move attempt event for ${playerEntity.id} moving to ${targetLocationId}`, error);
                success = false; // Ensure success is false if dispatch failed
            }

        } else {
            const reasonCode = 'DATA_ERROR';
            const details = 'Target location definition not found';
            dispatch('action:move_failed', {
                actorId: playerEntity.id,
                locationId: currentLocation.id,
                direction: direction,
                targetLocationId: targetLocationId, // Include the problematic ID
                reasonCode: reasonCode,
                details: details
            });
            console.error(`Move handler validation failed: Target location definition not found via dataManager for ID: ${targetLocationId}`);
            // success remains false
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
        // success remains false
    }

    // --- 5. Return Result ---
    // Return only success status. Messages are handled via semantic events.
    return {success: success};
}