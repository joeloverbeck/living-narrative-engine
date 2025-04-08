// src/systems/movementSystem.js

import {PositionComponent} from '../components/positionComponent.js'; // Corrected path assumption

/** @typedef {import('../../eventBus.js').default} EventBus */
/** @typedef {import('../entities/entityManager.js').default} EntityManager */

/** @typedef {import('../entities/entity.js').default} Entity */

/**
 * Handles the actual updating of an entity's position based on move attempts.
 * Listens for 'event:move_attempted' and updates the PositionComponent,
 * notifies the EntityManager/SpatialIndex, and dispatches 'event:entity_moved'.
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

        console.log("MovementSystem: Instance created.");
    }

    /**
     * Subscribes the system to relevant events on the event bus.
     * This should be called after the system is instantiated.
     */
    initialize() {
        // Bind the handler to ensure 'this' context is correct when called by EventBus
        this.#eventBus.subscribe('event:move_attempted', this._handleMoveAttempted.bind(this));
        console.log("MovementSystem: Initialized and subscribed to 'event:move_attempted'.");
    }

    /**
     * Handles the 'event:move_attempted' event dispatched by action handlers.
     * Updates the entity's position, notifies the spatial index, and fires 'event:entity_moved'.
     * @private
     * @param {object} eventData - The payload from the 'event:move_attempted'.
     * @param {string} eventData.entityId - The ID of the entity attempting to move.
     * @param {string} eventData.targetLocationId - The ID of the destination location.
     * @param {string} eventData.previousLocationId - The ID of the location the entity is moving from.
     * @param {string} eventData.direction - The direction of movement (e.g., 'north').
     */
    _handleMoveAttempted(eventData) {
        const {entityId, targetLocationId, previousLocationId, direction} = eventData;

        if (!entityId || !targetLocationId || !previousLocationId || !direction) {
            console.error("MovementSystem: Received incomplete 'event:move_attempted' data.", eventData);
            return;
        }

        console.log(`MovementSystem: Handling move attempt for ${entityId} from ${previousLocationId} to ${targetLocationId} (${direction}).`);

        try {
            // 1. Retrieve the entity instance
            const entity = this.#entityManager.getEntityInstance(entityId);
            if (!entity) {
                console.error(`MovementSystem: Entity not found for ID: ${entityId}. Cannot process move attempt.`);
                // Optionally dispatch an error message if this occurs unexpectedly
                // this.#eventBus.dispatch('ui:message_display', { text: `Error: Entity ${entityId} vanished before move could complete.`, type: 'error' });
                return;
            }

            // 2. Retrieve the PositionComponent
            const positionComp = entity.getComponent(PositionComponent);
            if (!positionComp) {
                console.error(`MovementSystem: Entity ${entityId} is missing PositionComponent. Cannot process move.`);
                // Optionally dispatch an error message
                // this.#eventBus.dispatch('ui:message_display', { text: `Error: Entity ${entityId} has no position to update.`, type: 'error' });
                return;
            }

            // 3. Verify the 'previousLocationId' matches the component's current state
            // This acts as a safeguard against race conditions or stale events.
            if (positionComp.locationId !== previousLocationId) {
                console.warn(`MovementSystem: Stale move attempt for ${entityId}? Event previousLocation (${previousLocationId}) does not match component location (${positionComp.locationId}). Aborting move.`);
                // Optionally dispatch a message indicating confusion or failure
                // this.#eventBus.dispatch('ui:message_display', { text: `Your move ${direction} was interrupted or became invalid.`, type: 'warning' });
                return;
            }

            // 4. Update the PositionComponent's locationId
            // For simplicity, we are not handling x/y coordinates here. If needed, they
            // would likely be part of the eventData or reset to defaults (0,0).
            positionComp.locationId = targetLocationId;
            // positionComp.setLocation(targetLocationId); // Or use the setLocation method if preferred

            console.log(`MovementSystem: Updated ${entityId}'s PositionComponent location to ${targetLocationId}.`);

            // 5. Notify the EntityManager to update the spatial index
            // This is crucial for ensuring location queries remain accurate.
            this.#entityManager.notifyPositionChange(entityId, previousLocationId, targetLocationId);

            console.log(`MovementSystem: Notified EntityManager of position change for ${entityId}.`);

            // 6. Dispatch the 'event:entity_moved' event
            // This signals that the move has successfully completed.
            const movedEventPayload = {
                entityId: entityId,
                newLocationId: targetLocationId,
                oldLocationId: previousLocationId,
                direction: direction
            };
            this.#eventBus.dispatch('event:entity_moved', movedEventPayload);

            console.log(`MovementSystem: Dispatched 'event:entity_moved' for ${entityId}.`);

            // 7. (Optional) Dispatch UI confirmation message
            // As noted, the action handler might already provide feedback. Adding another
            // message here could be redundant unless specifically desired for confirmation
            // AFTER the state change is fully complete. Example:
            // this.#eventBus.dispatch('ui:message_display', { text: `Successfully moved ${direction} to [New Location Name].`, type: 'info' });
            // For now, we rely on 'event:entity_moved' for systems like TriggerSystem (e.g., auto-look)

        } catch (error) {
            console.error(`MovementSystem: Error processing move attempt for entity ${entityId}:`, error);
            // Dispatch a generic error message to the UI
            this.#eventBus.dispatch('ui:message_display', {
                text: `An internal error occurred while trying to move ${direction}. Please check the console.`,
                type: 'error'
            });
        }
    }
}

export default MovementSystem;