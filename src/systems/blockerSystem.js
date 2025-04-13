// src/systems/blockerSystem.js

// --- Type Imports for JSDoc ---
/** @typedef {import('../core/eventBus.js').default} EventBus */
/** @typedef {import('../entities/entityManager.js').default} EntityManager */
/** @typedef {import('../entities/entity.js').default} Entity */
/** @typedef {import('../core/appContainer.js').default} AppContainer */ // Optional, if needed elsewhere

// --- Component Imports ---
// We need to import the components to check their state.
import OpenableComponent from '../components/openableComponent.js';
import LockableComponent from '../components/lockableComponent.js';
import BreakableComponent from '../components/breakableComponent.js';
// We also need NameComponent for getDisplayName, although it's used via the utility fn
// import NameComponent from '../components/nameComponent.js'; // Usually not needed directly if getDisplayName handles it

// --- Utility Imports ---
// Import the helper function to get entity names for messages
import {getDisplayName} from '../utils/messages.js'; // Adjust path if necessary

/**
 * System responsible for checking if movement or interactions are blocked by entities.
 */
class BlockerSystem {
    /** @type {EventBus} */
    #eventBus;
    /** @type {EntityManager} */
    #entityManager;

    /**
     * Constructs the BlockerSystem.
     * @param {object} dependencies - The dependencies injected by the container.
     * @param {EventBus} dependencies.eventBus - The game's event bus.
     * @param {EntityManager} dependencies.entityManager - Manages game entities.
     */
    constructor({eventBus, entityManager}) {
        if (!eventBus || !entityManager) {
            throw new Error("BlockerSystem requires EventBus and EntityManager dependencies.");
        }
        this.#eventBus = eventBus;
        this.#entityManager = entityManager;
        console.log("BlockerSystem: Instance created.");
    }

    /**
     * Initializes the system, subscribing to relevant events.
     * Called by the GameEngine during startup.
     */
    initialize() {
        // Subscribe to movement attempts - Logic implemented below
        this.#eventBus.subscribe('event:move_attempted', this._handleMoveAttempted.bind(this));
        console.log("BlockerSystem: Initialized and subscribed to 'event:move_attempted'.");
    }

    /**
     * Handles the 'event:move_attempted' event. Checks if the associated
     * blockerEntityId prevents movement based on its component states
     * (Openable, Lockable, Breakable). If blocked, dispatches 'action:move_failed'.
     *
     * @param {object} payload - The event data.
     * @param {string} payload.entityId - The ID of the entity attempting to move.
     * @param {string} payload.previousLocationId - The current location ID of the moving entity.
     * @param {string} payload.direction - The direction of attempted movement.
     * @param {string} [payload.blockerEntityId] - Optional ID of the entity blocking the exit.
     * @private
     */
    _handleMoveAttempted(payload) {
        // Destructure payload for easier access
        const {blockerEntityId, entityId, previousLocationId, direction} = payload;

        // --- AC 2: Check for Blocker ID ---
        if (!blockerEntityId) {
            // If no blocker ID is provided in the event payload, this system has nothing to check.
            // Movement might still fail for other reasons (e.g., no exit), but not due to an entity block handled here.
            // console.debug(`BlockerSystem: No blockerEntityId in move attempt from ${entityId} at ${previousLocationId} towards ${direction}. Allowing pass.`);
            return; // Nothing to block here, let other systems handle it.
        }

        // --- AC 3: Fetch Blocker Entity ---
        const blockerEntity = this.#entityManager.getEntityInstance(blockerEntityId);

        // --- AC 4: Handle Missing Blocker Entity ---
        if (!blockerEntity) {
            // The move event specified a blocker, but that entity doesn't actually exist in the active entity list.
            // This indicates a potential data inconsistency or an issue elsewhere.
            console.error(`BlockerSystem: Blocker entity ID "${blockerEntityId}" specified in move attempt for actor ${entityId}, but entity instance not found.`);
            this.#eventBus.dispatch('action:move_failed', {
                reasonCode: 'BLOCKER_NOT_FOUND',
                actorId: entityId,                // The one trying to move
                locationId: previousLocationId,   // Where the actor currently is
                direction: direction,
                blockerEntityId: blockerEntityId, // The ID that couldn't be found
                details: `The path seems blocked by something that isn't there anymore (ID: ${blockerEntityId}).` // User-friendly detail
            });
            return; // Prevent further processing since the blocker is missing.
        }

        // The blocker entity was found, now check its state.

        // --- AC 5: Evaluate Blocker State ---
        let isBlocked = false;        // Flag to track if *any* component blocks movement
        let isLockedReason = false;   // Flag to specifically identify if a Lockable component is the blocker

        // Check OpenableComponent: Movement is blocked if the component exists and its state is 'closed'.
        const openable = blockerEntity.getComponent(OpenableComponent);
        if (openable && openable.isOpen === false) {
            isBlocked = true;
        }

        // Check LockableComponent: Movement is blocked if the component exists and its state is 'locked'.
        const lockable = blockerEntity.getComponent(LockableComponent);
        if (lockable && lockable.isLocked === true) {
            isBlocked = true;
            isLockedReason = true; // Mark that being locked is a reason for blocking.
        }

        // Check BreakableComponent: Movement is blocked if the component exists and its state is NOT 'broken'.
        const breakable = blockerEntity.getComponent(BreakableComponent);
        if (breakable && breakable.isBroken === false) {
            isBlocked = true;
        }

        // --- AC 6: Dispatch Blocked Action ---
        if (isBlocked) {
            // At least one component indicates movement should be blocked.

            // Determine the most specific reason code. 'Locked' takes precedence if applicable.
            const reasonCode = isLockedReason ? 'DIRECTION_LOCKED' : 'DIRECTION_BLOCKED';

            // Get a user-friendly name for the blocker entity for feedback messages.
            const blockerDisplayName = getDisplayName(blockerEntity);

            // console.debug(`BlockerSystem: Movement blocked for ${entityId} by ${blockerDisplayName} (${blockerEntityId}). Reason: ${reasonCode}`);

            // Dispatch the failure event with all necessary details.
            this.#eventBus.dispatch('action:move_failed', {
                reasonCode: reasonCode,
                actorId: entityId,
                locationId: previousLocationId, // Actor is still in the previous location
                direction: direction,
                blockerEntityId: blockerEntity.id, // Use the confirmed entity's ID
                blockerDisplayName: blockerDisplayName // Include the name for UI feedback
            });
        }

        // --- AC 7: Allow Passage ---
        // If execution reaches this point, it means:
        // 1. A blockerEntityId *was* provided.
        // 2. The blockerEntity *was* found.
        // 3. None of the relevant components (Openable, Lockable, Breakable) were in a state that blocks movement.
        // Therefore, this system does not block the move based on entity state.
        // console.debug(`BlockerSystem: Blocker entity ${getDisplayName(blockerEntity)} (${blockerEntityId}) exists but state allows passage for ${entityId}.`);
    }

    // Add other methods as needed for different blocking scenarios (e.g., interaction attempts in future tickets)

}

export default BlockerSystem;