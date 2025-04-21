// src/systems/movementSystem.js

// Core dependencies (adjust paths if necessary)
/** @typedef {import('../core/eventBus.js').default} EventBus */
/** @typedef {import('../entities/entityManager.js').default} EntityManager */

// Component Type ID (Import the constant)
import {POSITION_COMPONENT_ID} from "../types/components.js"; // Use the constant from types

/**
 * Handles the actual updating of an entity's position based on component data.
 * This system exposes a synchronous `executeMove` method to be called after
 * external validation, using the EntityManager for component data access and modification.
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
    constructor({eventBus, entityManager}) {
        if (!eventBus) {
            throw new Error("MovementSystem requires an EventBus instance.");
        }
        if (!entityManager) {
            throw new Error("MovementSystem requires an EntityManager instance.");
        }
        this.#eventBus = eventBus;
        this.#entityManager = entityManager;
    }

    /**
     * Initializes the system. No longer subscribes to move events.
     * This should be called after the system is instantiated.
     */
    initialize() {
        console.log("MovementSystem: Initialized. Ready to execute moves via executeMove().");
    }

    /**
     * Synchronously executes the final steps of an entity move, updating its
     * position component data via the EntityManager and notifying relevant systems.
     * Assumes prior validation (e.g., path validity, target location existence).
     *
     * @param {ExecuteMovePayload} payload - The details of the move to execute.
     * @returns {boolean} Returns `true` if the method completes successfully,
     * and `false` if an error occurs or an internal safety check fails.
     */
    executeMove(payload) {
        try {
            // Step 1: Fetch Position Component Data using EntityManager
            // AC1: Uses entityManager.getComponentData(entityId, 'core:position') (using POSITION_COMPONENT_ID)
            const positionData = this.#entityManager.getComponentData(payload.entityId, POSITION_COMPONENT_ID);

            // Step 2: Perform final internal safety checks using positionData
            // AC1 (Task): Update safety checks to use positionData
            if (!positionData) {
                console.error(`MovementSystem.executeMove: Entity [${payload.entityId}] lacks component data for '${POSITION_COMPONENT_ID}'. Cannot execute move.`);
                return false; // Stop execution if component data missing
            }
            // AC1 (Task): Update state mismatch check to use positionData
            if (positionData.locationId !== payload.previousLocationId) {
                console.warn(`MovementSystem.executeMove: State mismatch for entity [${payload.entityId}]. Expected previous location [${payload.previousLocationId}], but found [${positionData.locationId}]. Aborting move execution.`);
                return false; // Stop execution due to state inconsistency
            }
            // Note: The check for entity existence (!entity) from the original code is implicitly
            // handled by getComponentData returning undefined if the entity doesn't exist.

            // Step 3: Update Position Component Data via EntityManager
            // AC2: Uses entityManager.addComponent(entityId, 'core:position', updatedData) (using POSITION_COMPONENT_ID)
            // AC1 (Task): Replace direct mutation with EntityManager update
            const updatedPositionData = {...positionData}; // Create a copy
            updatedPositionData.locationId = payload.targetLocationId;
            // Optionally reset x, y coordinates if movement between locations implies this:
            // updatedPositionData.x = 0; // Example reset
            // updatedPositionData.y = 0; // Example reset

            let updateSuccessful = false;
            try {
                // Call EntityManager to update the component data. addComponent handles spatial index.
                updateSuccessful = this.#entityManager.addComponent(payload.entityId, POSITION_COMPONENT_ID, updatedPositionData);

                if (!updateSuccessful) {
                    // EntityManager.addComponent returns boolean and logs/throws on internal error
                    // Log here for specific context if needed, but EntityManager should handle primary logging.
                    console.error(`MovementSystem.executeMove: EntityManager.addComponent reported failure for '${POSITION_COMPONENT_ID}' on entity [${payload.entityId}].`);
                    return false;
                }
            } catch (error) {
                // Catch potential errors thrown by addComponent (e.g., validation)
                console.error(`MovementSystem.executeMove: Error calling EntityManager.addComponent for '${POSITION_COMPONENT_ID}' on entity [${payload.entityId}]:`, error);
                return false;
            }

            // Step 4: Remove direct EntityManager notification
            // AC3: The direct call to entityManager.notifyPositionChange within MovementSystem is removed.
            // REMOVED: this.#entityManager.notifyPositionChange(payload.entityId, payload.previousLocationId, payload.targetLocationId);
            // This notification is now handled internally by EntityManager.addComponent when POSITION_COMPONENT_ID changes.

            // Step 5: Dispatch success event via EventBus
            // AC5 (Acceptance Criteria): Movement execution continues to function correctly, including triggering the "event:entity_moved" event on success.
            const movedEventPayload = {
                entityId: payload.entityId,
                newLocationId: payload.targetLocationId,
                oldLocationId: payload.previousLocationId,
                direction: payload.direction
            };
            this.#eventBus.dispatch("event:entity_moved", movedEventPayload);

            // If all steps above completed successfully.
            return true;

        } catch (error) {
            // Log unexpected errors during the execution process
            console.error('MovementSystem: Unexpected error during executeMove:', {payload, error});
            return false; // Indicate failure due to unexpected error
        }
    }

} // End of MovementSystem class

export default MovementSystem;