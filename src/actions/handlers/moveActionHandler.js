// src/actions/handlers/moveActionHandler.js

import { ConnectionsComponent } from '../../components/connectionsComponent.js';
import { PositionComponent } from '../../components/positionComponent.js';
// Import the component needed for the refactoring
import { PassageDetailsComponent } from '../../components/passageDetailsComponent.js';
import { validateRequiredCommandPart } from '../../utils/actionValidationUtils.js';

// No changes needed for DIRECTION_ALIASES
const DIRECTION_ALIASES = {
    'n': 'north', 's': 'south', 'e': 'east', 'w': 'west',
    'ne': 'northeast', 'nw': 'northwest', 'se': 'southeast', 'sw': 'southwest',
    'u': 'up', 'd': 'down',
    'north': 'north', 'south': 'south', 'east': 'east', 'west': 'west',
    'northeast': 'northeast', 'northwest': 'northwest', 'southeast': 'southeast', 'southwest': 'southwest',
    'up': 'up', 'down': 'down'
};

/** @typedef {import('../actionTypes.js').ActionContext} ActionContext */
/** @typedef {import('../actionTypes.js').ActionResult} ActionResult */
/** @typedef {import('../../ecs/entity').Entity} Entity */
/** @typedef {import('../../ecs/entityManager.js').EntityManager} EntityManager */
/** @typedef {import('../../data/dataManager.js').DataManager} DataManager */
/** @typedef {import('../../events/eventDispatcher.js').EventDispatcher} EventDispatcher */
/** @typedef {import('../../commands/commandParser.js').ParsedCommand} ParsedCommand */


/**
 * Handles the 'core:move' action based on CONN-8 refactoring.
 * This version uses Connection Entities and PassageDetailsComponent.
 *
 * Workflow:
 * 1. Basic validation (context, player position, command structure).
 * 2. Get direction from command.
 * 3. Use current location's ConnectionsComponent to find the Connection Entity ID for the direction.
 * 4. Fetch the Connection Entity using the EntityManager.
 * 5. Get the PassageDetailsComponent from the Connection Entity.
 * 6. Extract target location ID and blocker entity ID from PassageDetailsComponent.
 * 7. Dispatch 'event:move_attempted' with detailed payload if validation passes.
 * 8. Dispatch 'action:move_failed' if any validation step fails.
 *
 * Does NOT modify player position directly. Relies on a MovementSystem listening
 * to 'event:move_attempted'.
 *
 * @param {ActionContext} context - The action context.
 * @property {Entity} playerEntity - The entity attempting to move.
 * @property {Entity} currentLocation - The current location entity of the player.
 * @property {EntityManager} entityManager - Manages entities and components.
 * @property {DataManager} dataManager - Manages entity definitions (potentially unused here now).
 * @property {EventDispatcher} dispatch - Used to dispatch events.
 * @property {ParsedCommand} parsedCommand - The parsed player command.
 * @returns {ActionResult} - The result of the action validation (success/fail).
 */
export function executeMove(context) {
    // Destructure context for easier access
    // dataManager might not be needed anymore for target validation here, but kept for context signature consistency.
    const { playerEntity, currentLocation, entityManager, dispatch, parsedCommand } = context;
    let success = false; // Assume failure until event:move_attempted is dispatched successfully

    // --- 1. Initial Validations (Largely unchanged) ---
    if (!playerEntity) {
        console.error("executeMove: Critical error - playerEntity is missing in context.");
        return { success: false };
    }
    const actorId = playerEntity.id;

    if (!currentLocation) {
        const reasonCode = 'SETUP_ERROR';
        const details = 'Current location unknown';
        dispatch('action:move_failed', { actorId, reasonCode, details });
        console.error("executeMove handler called with invalid currentLocation in context.");
        return { success: false };
    }
    const currentLocationId = currentLocation.id;

    if (!validateRequiredCommandPart(context, 'move', 'directObjectPhrase')) {
        return { success: false };
    }

    // --- 2. Get Player's Position Component (Unchanged) ---
    const playerPositionComp = playerEntity.getComponent(PositionComponent);
    if (!playerPositionComp) {
        const reasonCode = 'SETUP_ERROR';
        const details = 'Player position component missing';
        dispatch('action:move_failed', {
            actorId,
            locationId: currentLocationId,
            reasonCode,
            details
        });
        console.error(`executeMove: Player entity ${actorId} is missing PositionComponent.`);
        return { success: false };
    }
    const previousLocationId = playerPositionComp.locationId;

    if (previousLocationId !== currentLocationId) {
        console.warn(`executeMove: Discrepancy between player PositionComponent location (${previousLocationId}) and context currentLocation (${currentLocationId}). Proceeding based on context's currentLocation.`);
    }

    // --- 3. Process Direction and Get Connections Component ---
    const rawDirection = parsedCommand.directObjectPhrase.toLowerCase();
    const direction = DIRECTION_ALIASES[rawDirection] || rawDirection;

    const connectionsComp = currentLocation.getComponent(ConnectionsComponent);
    if (!connectionsComp) {
        const reasonCode = 'NO_EXITS_CONFIGURED';
        const details = 'Location is missing ConnectionsComponent.'
        dispatch('action:move_failed', {
            actorId,
            locationId: currentLocationId,
            direction,
            reasonCode,
            details
        });
        console.error(`executeMove: Location entity ${currentLocationId} is missing ConnectionsComponent.`);
        return { success: false };
    }

    // --- 4. Get Connection Entity ID ---
    const connectionEntityId = connectionsComp.getConnectionByDirection(direction); // AC1

    if (!connectionEntityId) {
        const reasonCode = 'INVALID_DIRECTION';
        dispatch('action:move_failed', {
            actorId,
            locationId: currentLocationId,
            direction,
            reasonCode
        });
        return { success: false };
    }

    // --- 5. Fetch Connection Entity ---
    // Implementation Task 3: Use entityManager.getEntityInstance
    // ***** THIS LINE WAS CORRECTED *****
    const connectionEntity = entityManager.getEntityInstance(connectionEntityId); // AC2
    // ***** END CORRECTION *****

    if (!connectionEntity) {
        const reasonCode = 'DATA_ERROR';
        const details = `Connection entity not found for ID: ${connectionEntityId}`;
        dispatch('action:move_failed', {
            actorId,
            locationId: currentLocationId,
            direction,
            connectionEntityId,
            reasonCode,
            details
        });
        console.error(`executeMove: Connection entity instance not found in entityManager for ID: ${connectionEntityId}, referenced by location ${currentLocationId}.`);
        return { success: false };
    }

    // --- 6. Get Passage Details Component ---
    const passageDetailsComp = connectionEntity.getComponent(PassageDetailsComponent); // AC3

    if (!passageDetailsComp) {
        const reasonCode = 'SETUP_ERROR';
        const details = `PassageDetailsComponent missing on connection entity: ${connectionEntityId}`;
        dispatch('action:move_failed', {
            actorId,
            locationId: currentLocationId,
            direction,
            connectionEntityId,
            reasonCode,
            details
        });
        console.error(`executeMove: Connection entity ${connectionEntityId} is missing PassageDetailsComponent.`);
        return { success: false };
    }

    // --- 7. Extract Target Information ---
    let targetLocationId;
    try {
        targetLocationId = passageDetailsComp.getOtherLocationId(currentLocationId); // Part of AC4
    } catch (error) {
        const reasonCode = 'DATA_ERROR';
        const details = `Error extracting target location from passage ${connectionEntityId}: ${error.message}`;
        dispatch('action:move_failed', {
            actorId,
            locationId: currentLocationId,
            direction,
            connectionEntityId,
            reasonCode,
            details
        });
        console.error(`executeMove: Error calling getOtherLocationId on passage ${connectionEntityId} from location ${currentLocationId}.`, error);
        return { success: false };
    }

    if (!targetLocationId || typeof targetLocationId !== 'string') {
        const reasonCode = 'DATA_ERROR';
        const details = `Invalid target location ID ('${targetLocationId}') obtained from passage details on entity: ${connectionEntityId}`;
        dispatch('action:move_failed', {
            actorId,
            locationId: currentLocationId,
            direction,
            connectionEntityId,
            targetLocationId: targetLocationId || 'undefined',
            reasonCode,
            details
        });
        console.error(`executeMove: Invalid targetLocationId retrieved from PassageDetailsComponent on ${connectionEntityId}. Expected string, got: ${targetLocationId}`);
        return { success: false };
    }

    const blockerEntityId = passageDetailsComp.getBlockerId(); // Part of AC4

    // --- 8. Dispatch Move Attempt Event ---
    try {
        const moveAttemptPayload = {
            entityId: actorId,
            targetLocationId: targetLocationId,
            direction: direction,
            previousLocationId: previousLocationId,
            connectionEntityId: connectionEntityId,
            ...(blockerEntityId && { blockerEntityId: blockerEntityId })
        };

        dispatch('event:move_attempted', moveAttemptPayload);
        success = true;

    } catch (error) {
        const reasonCode = 'INTERNAL_DISPATCH_ERROR';
        const details = `Error dispatching event:move_attempted: ${error.message}`;
        dispatch('action:move_failed', {
            actorId,
            locationId: currentLocationId,
            direction,
            connectionEntityId,
            targetLocationId,
            reasonCode,
            details
        });
        console.error(`executeMove: Failed to dispatch 'event:move_attempted' for ${actorId} moving towards ${targetLocationId} via ${connectionEntityId}`, error);
        success = false;
    }

    // --- 9. Return Result ---
    return { success: success };
}