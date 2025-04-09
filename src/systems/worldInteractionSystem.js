// src/systems/worldInteractionSystem.js

import { PositionComponent } from '../components/positionComponent.js';

/** @typedef {import('../../eventBus.js').default} EventBus */
/** @typedef {import('../entities/entityManager.js').default} EntityManager */
/** @typedef {import('../entities/entity.js').default} Entity */

/**
 * Handles world-state interactions resulting from events, such as removing items
 * from their location when picked up.
 */
class WorldInteractionSystem {
    #eventBus;
    #entityManager;

    /**
     * @param {object} options
     * @param {EventBus} options.eventBus - The game's event bus.
     * @param {EntityManager} options.entityManager - The game's entity manager.
     */
    constructor({ eventBus, entityManager }) {
        if (!eventBus) {
            console.error("WorldInteractionSystem: EventBus dependency is missing.");
            throw new Error("WorldInteractionSystem requires an EventBus instance.");
        }
        if (!entityManager) {
            console.error("WorldInteractionSystem: EntityManager dependency is missing.");
            throw new Error("WorldInteractionSystem requires an EntityManager instance.");
        }
        this.#eventBus = eventBus;
        this.#entityManager = entityManager;
        console.log("WorldInteractionSystem: Instance created.");
    }

    /**
     * Subscribes the system to relevant game events.
     */
    initialize() {
        // Task 2: Subscribe to the event
        this.#eventBus.subscribe('event:item_picked_up', this.#handleItemPickedUp.bind(this));
        console.log("WorldInteractionSystem: Initialized and subscribed to 'event:item_picked_up'.");
    }

    /**
     * Handles the 'event:item_picked_up' event.
     * Updates the item's PositionComponent to remove it from its world location
     * and notifies the EntityManager to update the spatial index.
     *
     * @private
     * @param {{ pickerId: string, itemId: string, locationId: string }} eventData - Data from the event.
     */
    #handleItemPickedUp(eventData) {
        // Task 3: Implement the handler function
        const { pickerId, itemId, locationId } = eventData; // locationId from event might be useful for validation

        console.log(`WorldInteractionSystem: Handling event:item_picked_up for item ${itemId} picked by ${pickerId} from reported location ${locationId}`);

        // Get the item entity
        const itemEntity = this.#entityManager.getEntityInstance(itemId);
        if (!itemEntity) {
            // Handle cases where the entity might not be found (e.g., race condition, already removed?)
            console.error(`WorldInteractionSystem: Cannot find item entity instance with ID: ${itemId}. Cannot update world position.`);
            return; // Stop processing
        }

        // Get the PositionComponent
        const positionComp = itemEntity.getComponent(PositionComponent);
        if (!positionComp) {
            // Handle cases where the item surprisingly has no position (shouldn't happen for a world item being picked up)
            console.warn(`WorldInteractionSystem: Picked-up item entity ${itemId} does not have a PositionComponent. Cannot update world position.`);
            return; // Stop processing
        }

        // Store its current locationId before changing it
        const oldLocationId = positionComp.locationId;

        // Optional Validation: Check if the component's location matches the event's reported location
        if (oldLocationId !== locationId) {
            console.warn(`WorldInteractionSystem: Mismatch for item ${itemId}. Event reported location ${locationId}, but component's current location is ${oldLocationId}. Using component's location for removal logic.`);
            // Note: We proceed using `oldLocationId` from the component as the authoritative source for removal.
        }

        // If the item is somehow already not in a location, log and potentially stop.
        if (oldLocationId === null) {
            console.warn(`WorldInteractionSystem: Item ${itemId} already has a null locationId when handling pickup. Assuming it's already removed from world state.`);
            return; // Nothing to update in the world state.
        }

        try {
            // Set the PositionComponent's locationId to null
            // Resetting coordinates is good practice, though less critical when locationId is null.
            positionComp.setLocation(null, 0, 0);
            console.log(`WorldInteractionSystem: Set PositionComponent locationId to null for item ${itemId}.`);

            // Notify the EntityManager about the change for spatial index update
            this.#entityManager.notifyPositionChange(itemId, oldLocationId, null);
            console.log(`WorldInteractionSystem: Successfully processed world state update for picked-up item ${itemId}. Notified EntityManager.`);

        } catch (error) {
            console.error(`WorldInteractionSystem: Error updating position or notifying EntityManager for item ${itemId}:`, error);
            // Attempt to revert? Difficult state to manage. Logged error is main recourse.
            // Maybe try to restore old location? positionComp.setLocation(oldLocationId, oldX, oldY); // Requires storing old coords too
        }
    }

    // Optional: Add a method to unsubscribe if needed during engine shutdown/restart
    // shutdown() {
    //     this.#eventBus.unsubscribe('event:item_picked_up', this.#handleItemPickedUp);
    //     console.log("WorldInteractionSystem: Unsubscribed from events.");
    // }
}

export default WorldInteractionSystem;