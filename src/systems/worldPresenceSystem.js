// src/systems/worldPresenceSystem.js

import {PositionComponent} from '../components/positionComponent.js';
import {getDisplayName} from "../utils/messages.js";

/** @typedef {import('../core/eventBus.js').default} EventBus */
/** @typedef {import('../entities/entityManager.js').default} EntityManager */

/** @typedef {import('../entities/entity.js').default} Entity */

/**
 * Handles world-state interactions resulting from events, such as removing items
 * from their location when picked up.
 */
class WorldPresenceSystem {
    #eventBus;
    #entityManager;

    /**
     * @param {object} options
     * @param {EventBus} options.eventBus - The game's event bus.
     * @param {EntityManager} options.entityManager - The game's entity manager.
     */
    constructor({eventBus, entityManager}) {
        if (!eventBus) {
            console.error("WorldPresenceSystem: EventBus dependency is missing.");
            throw new Error("WorldPresenceSystem requires an EventBus instance.");
        }
        if (!entityManager) {
            console.error("WorldPresenceSystem: EntityManager dependency is missing.");
            throw new Error("WorldPresenceSystem requires an EntityManager instance.");
        }
        this.#eventBus = eventBus;
        this.#entityManager = entityManager;
        console.log("WorldPresenceSystem: Instance created.");
    }

    /**
     * Subscribes the system to relevant game events.
     */
    initialize() {
        this.#eventBus.subscribe('event:item_picked_up', this.#handleItemPickedUp.bind(this));
        this.#eventBus.subscribe('event:item_drop_attempted', this.#handleItemDropAttempted.bind(this));
        console.log("WorldPresenceSystem: Initialized and subscribed to 'event:item_picked_up'.");
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
        const {pickerId, itemId, locationId} = eventData; // locationId from event might be useful for validation

        console.log(`WorldPresenceSystem: Handling event:item_picked_up for item ${itemId} picked by ${pickerId} from reported location ${locationId}`);

        // Get the item entity
        const itemEntity = this.#entityManager.getEntityInstance(itemId);
        if (!itemEntity) {
            // Handle cases where the entity might not be found (e.g., race condition, already removed?)
            console.error(`WorldPresenceSystem: Cannot find item entity instance with ID: ${itemId}. Cannot update world position.`);
            return; // Stop processing
        }

        // Get the PositionComponent
        const positionComp = itemEntity.getComponent(PositionComponent);
        if (!positionComp) {
            // Handle cases where the item surprisingly has no position (shouldn't happen for a world item being picked up)
            console.warn(`WorldPresenceSystem: Picked-up item entity ${itemId} does not have a PositionComponent. Cannot update world position.`);
            return; // Stop processing
        }

        // Store its current locationId before changing it
        const oldLocationId = positionComp.locationId;

        // Optional Validation: Check if the component's location matches the event's reported location
        if (oldLocationId !== locationId) {
            console.warn(`WorldPresenceSystem: Mismatch for item ${itemId}. Event reported location ${locationId}, but component's current location is ${oldLocationId}. Using component's location for removal logic.`);
            // Note: We proceed using `oldLocationId` from the component as the authoritative source for removal.
        }

        // If the item is somehow already not in a location, log and potentially stop.
        if (oldLocationId === null) {
            console.warn(`WorldPresenceSystem: Item ${itemId} already has a null locationId when handling pickup. Assuming it's already removed from world state.`);
            return; // Nothing to update in the world state.
        }

        try {
            // Set the PositionComponent's locationId to null
            // Resetting coordinates is good practice, though less critical when locationId is null.
            positionComp.setLocation(null, 0, 0);
            console.log(`WorldPresenceSystem: Set PositionComponent locationId to null for item ${itemId}.`);

            // Notify the EntityManager about the change for spatial index update
            this.#entityManager.notifyPositionChange(itemId, oldLocationId, null);
            console.log(`WorldPresenceSystem: Successfully processed world state update for picked-up item ${itemId}. Notified EntityManager.`);

        } catch (error) {
            console.error(`WorldPresenceSystem: Error updating position or notifying EntityManager for item ${itemId}:`, error);
            // Attempt to revert? Difficult state to manage. Logged error is main recourse.
            // Maybe try to restore old location? positionComp.setLocation(oldLocationId, oldX, oldY); // Requires storing old coords too
        }
    }

    /**
     * Handles the 'event:item_drop_attempted' event.
     * Updates the item's PositionComponent to place it into the specified world location
     * and notifies the EntityManager to update the spatial index. Dispatches UI feedback.
     *
     * @private
     * @param {{ playerId: string, itemInstanceId: string, locationId: string }} eventData - Data from the event.
     */
    #handleItemDropAttempted(eventData) {
        const {playerId, itemInstanceId, locationId: newLocationId} = eventData;
        const itemId = itemInstanceId; // Alias for clarity within this handler

        console.log(`WorldPresenceSystem: Handling event:item_drop_attempted for item ${itemId} dropped by player ${playerId} into location ${newLocationId}`);

        // 1. Get the item entity
        const itemEntity = this.#entityManager.getEntityInstance(itemId);
        if (!itemEntity) {
            // Handle cases where the entity might not be found (should not happen if action handler validated)
            console.error(`WorldPresenceSystem: Cannot find item entity instance with ID: ${itemId}. Cannot process drop.`);
            // Consider dispatching an internal error message?
            // this.#eventBus.dispatch('ui:message_display', { text: "Internal error: Dropped item disappeared.", type: 'error' });
            return; // Stop processing
        }

        // 2. Get or add a PositionComponent
        let positionComp = itemEntity.getComponent(PositionComponent);
        let oldLocationId = null; // Assume coming from inventory initially

        if (positionComp) {
            // Item already has a position component (perhaps it was already on the ground?)
            // Store its current location *before* changing it.
            oldLocationId = positionComp.locationId;
            console.log(`WorldPresenceSystem: Item ${itemId} already has PositionComponent. Old location: ${oldLocationId}`);
        } else {
            // Item lacks a position component (likely coming from inventory)
            console.log(`WorldPresenceSystem: Item ${itemId} lacks PositionComponent. Adding new one.`);
            try {
                positionComp = new PositionComponent({locationId: null, x: 0, y: 0}); // Start with null location
                itemEntity.addComponent(positionComp);
                console.log(`WorldPresenceSystem: Added PositionComponent to item ${itemId}.`);
                // oldLocationId remains null, which is correct for coming from inventory.
            } catch (error) {
                console.error(`WorldPresenceSystem: Failed to create or add PositionComponent for item ${itemId}:`, error);
                // Dispatch error?
                this.#eventBus.dispatch('ui:message_display', {text: "Internal error placing item.", type: 'error'});
                return; // Cannot proceed without a position component
            }
        }

        // 3. Set the new location and coordinates
        try {
            // Use default coordinates (0,0) for now. Could enhance later to use player coords.
            positionComp.setLocation(newLocationId, 0, 0);
            console.log(`WorldPresenceSystem: Set PositionComponent locationId to ${newLocationId} for dropped item ${itemId}.`);

            // 4. Notify the EntityManager about the change for spatial index update
            this.#entityManager.notifyPositionChange(itemId, oldLocationId, newLocationId);
            console.log(`WorldPresenceSystem: Notified EntityManager of position change for item ${itemId} (from ${oldLocationId} to ${newLocationId}).`);

            // 5. Dispatch the final UI success message
            const itemName = getDisplayName(itemEntity); // Get item name for message
            const successMessage = `You drop the ${itemName}.`;
            this.#eventBus.dispatch('ui:message_display', {text: successMessage, type: 'info'}); // Or 'action_feedback' type?

            // 6. (Optional) Dispatch a follow-up event
            this.#eventBus.dispatch('event:item_dropped', {
                playerId: playerId,
                itemId: itemId,
                locationId: newLocationId
            });

            console.log(`WorldPresenceSystem: Successfully processed drop for item ${itemId}.`);

        } catch (error) {
            console.error(`WorldPresenceSystem: Error updating position, notifying EntityManager, or dispatching events for dropped item ${itemId}:`, error);
            // Attempt to revert? Very tricky. Log and maybe send UI error.
            this.#eventBus.dispatch('ui:message_display', {
                text: `Error dropping item: ${error.message}`,
                type: 'error'
            });

            // Attempt to revert the position component state if possible?
            // Only revert if we know the old state and the setLocation succeeded but notify/dispatch failed.
            if (positionComp && positionComp.locationId === newLocationId) { // Check if setLocation was the successful part
                try {
                    console.warn(`WorldPresenceSystem: Attempting to revert PositionComponent for ${itemId} back to ${oldLocationId}`);
                    positionComp.setLocation(oldLocationId, 0, 0); // Revert coords too? Needs more state tracking.
                    // Also need to revert the spatial index change if notifyPositionChange was called but failed *after* index update
                    // This highlights the need for transactional updates or robust error handling/recovery.
                } catch (revertError) {
                    console.error(`WorldPresenceSystem: Failed to revert position component state for ${itemId}:`, revertError);
                }
            }
        }
    }


    // Optional: Add a method to unsubscribe if needed during engine shutdown/restart
    shutdown() {
        this.#eventBus.unsubscribe('event:item_picked_up', this.#handleItemPickedUp);
        this.#eventBus.unsubscribe('event:item_drop_attempted', this.#handleItemDropAttempted);
        console.log("WorldPresenceSystem: Unsubscribed from events.");
    }
}

export default WorldPresenceSystem;