// src/systems/movementSystem.js

// Assuming components are in ../components/
import { PositionComponent } from '../components/positionComponent.js';

// Core dependencies (adjust paths if necessary)
/** @typedef {import('../core/eventBus.js').default} EventBus */
/** @typedef {import('../entities/entityManager.js').default} EntityManager */

// Entity definition (adjust path if necessary)
/** @typedef {import('../entities/entity.js').default} Entity */

/**
 * @typedef {object} ExecuteMovePayload
 * @property {string} entityId - ID of the entity being moved.
 * @property {string} targetLocationId - ID of the destination location entity.
 * @property {string} previousLocationId - ID of the starting location entity.
 * @property {string} direction - The canonical, lowercase direction of movement (e.g., 'north', 'south').
 */

/**
 * Handles the actual updating of an entity's position.
 * This system previously listened for 'event:move_attempted' but now exposes
 * a synchronous `executeMove` method to be called after external validation.
 */
class MovementSystem {
    /** @type {EventBus} */
    #eventBus;
    /** @type {EntityManager} */
    #entityManager;

    /**
     * @param {object} dependencies
     * @param {EventBus} dependencies.eventBus - The game's event bus.
     * @param {EntityManager} dependencies.entityManager - The entity manager instance.
     */
    constructor({ eventBus, entityManager }) {
        if (!eventBus) {
            throw new Error("MovementSystem requires an EventBus instance.");
        }
        if (!entityManager) {
            throw new Error("MovementSystem requires an EntityManager instance.");
        }
        this.#eventBus = eventBus;
        this.#entityManager = entityManager;

        // console.log("MovementSystem: Instance created."); // Kept console log from original
    }

    /**
     * Initializes the system. No longer subscribes to move events.
     * This should be called after the system is instantiated.
     */
    initialize() {
        // Subscription to 'event:move_attempted' was removed in TRG-7.1.
        console.log("MovementSystem: Initialized. Ready to execute moves via executeMove()."); // Kept console log
    }

    /**
     * Synchronously executes the final steps of an entity move, updating its
     * position and notifying relevant systems. Assumes prior validation.
     *
     * Intended to be called by a coordinator/handler *after* checks like
     * location existence and path blocking have passed.
     *
     * @param {ExecuteMovePayload} payload - The details of the move to execute.
     * @returns {boolean} Returns `true` if the method completes without internal errors,
     * and `false` if an error is caught during its execution or an internal safety check fails.
     */
    executeMove(payload) { // AC1 (Ticket): Method Definition, AC2 (Ticket): Signature
        // AC4 (Ticket): Basic Body Structure (try...catch)
        try {
            // --- Implementation for TRG-7.3 Start ---

            // AC1: Retrieve entity instance
            // Step 1: Fetch the entity trying to move
            const entity = this.#entityManager.getEntityInstance(payload.entityId);

            // AC2: Retrieve entity's PositionComponent (handle if entity is null)
            // Step 2: Get the entity's position component
            const positionComp = entity ? entity.getComponent(PositionComponent) : null;

            // AC3: Perform final internal safety checks
            // Step 3a: Check if the entity actually exists
            if (!entity) {
                console.error(`MovementSystem.executeMove: Failed to find entity with ID [${payload.entityId}]. Cannot execute move.`);
                return false; // Stop execution if entity not found
            }
            // Step 3b: Check if the entity has a position component
            if (!positionComp) {
                console.error(`MovementSystem.executeMove: Entity [${payload.entityId}] lacks a PositionComponent. Cannot execute move.`);
                return false; // Stop execution if component missing
            }
            // Step 3c (Optional but Recommended): Verify entity is at the expected starting location
            if (positionComp.locationId !== payload.previousLocationId) {
                console.warn(`MovementSystem.executeMove: State mismatch for entity [${payload.entityId}]. Expected previous location [${payload.previousLocationId}], but found [${positionComp.locationId}]. Aborting move execution.`);
                return false; // Stop execution due to state inconsistency
            }

            // AC4: Update PositionComponent's locationId
            // Step 4: Perform the actual state change - update the location ID
            positionComp.locationId = payload.targetLocationId;

            // AC5: Notify EntityManager of the position change
            // Step 5: Inform the EntityManager about the successful move for its tracking
            this.#entityManager.notifyPositionChange(payload.entityId, payload.previousLocationId, payload.targetLocationId);

            // AC6: Prepare event payload for entity_moved
            // Step 6a: Create the payload for the success event
            const movedEventPayload = {
                entityId: payload.entityId,
                newLocationId: payload.targetLocationId, // Use the target ID as the new location
                oldLocationId: payload.previousLocationId, // Include where the entity came from
                direction: payload.direction // Pass along the direction used
            };

            // AC7: Dispatch 'event:entity_moved' via EventBus
            // Step 6b: Announce the successful move to the rest of the game
            this.#eventBus.dispatch('event:entity_moved', movedEventPayload);

            // AC8: Verified no external validation logic added here.
            // AC9: Inline comments added for steps 1-7.

            // --- Implementation for TRG-7.3 End ---

            // AC10: Success Return (Try Block)
            // If all steps above completed without returning false or throwing, the move was successful.
            return true;

        } catch (error) {
            // AC7 (Ticket): Error Handling (Catch Block)
            // Log unexpected errors during the execution process
            console.error('MovementSystem: Unexpected error during executeMove:', { payload, error });
            return false; // Indicate failure due to unexpected error
        }
    }

} // End of MovementSystem class

// AC8 (Ticket): Syntax Check - Ensure the file has no syntax errors. (Assumed OK based on structure)
export default MovementSystem;