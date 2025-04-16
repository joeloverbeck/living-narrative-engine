// src/systems/worldPresenceSystem.js

import {PositionComponent} from '../components/positionComponent.js';
import {getDisplayName} from "../utils/messages.js";
import {
    EVENT_ITEM_DROP_ATTEMPTED,
    EVENT_ITEM_DROPPED,
    EVENT_ITEM_PICKED_UP,
    EVENT_SPAWN_ENTITY_REQUESTED
} from "../types/eventTypes";

/** @typedef {import('../core/eventBus.js').default} EventBus */
/** @typedef {import('../entities/entityManager.js').default} EntityManager */

/** @typedef {import('../entities/entity.js').default} Entity */
// --- Payload Type Imports ---
/** @typedef {import('../types/eventTypes.js').ItemPickedUpEventPayload} ItemPickedUpEventPayload */
/** @typedef {import('../types/eventTypes.js').ItemDropAttemptedEventPayload} ItemDropAttemptedEventPayload */
/** @typedef {import('../types/eventTypes.js').ItemDroppedEventPayload} ItemDroppedEventPayload */

/** @typedef {import('../types/eventTypes.js').SpawnEntityRequestedEventPayload} SpawnEntityRequestedEventPayload */

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
        this.#eventBus.subscribe(EVENT_ITEM_PICKED_UP, this.#handleItemPickedUp.bind(this));
        this.#eventBus.subscribe(EVENT_ITEM_DROP_ATTEMPTED, this.#handleItemDropAttempted.bind(this));
        console.log("WorldPresenceSystem: Initialized and subscribed to '" + EVENT_ITEM_PICKED_UP + "'.");

        this.#eventBus.subscribe(EVENT_SPAWN_ENTITY_REQUESTED, this._handleSpawnEntityRequested.bind(this));
        console.log("WorldPresenceSystem: Initialized and subscribed to item pickup/drop and entity spawn events.");
    }

    /**
     * Handles the EVENT_ITEM_PICKED_UP event.
     * Updates the item's PositionComponent to remove it from its world location
     * and notifies the EntityManager to update the spatial index.
     *
     * @private
     * @param {ItemPickedUpEventPayload} eventData - Data from the event.
     */
    #handleItemPickedUp(eventData) {
        // Task 3: Implement the handler function
        const {pickerId, itemId, locationId} = eventData; // locationId from event might be useful for validation

        console.log(`WorldPresenceSystem: Handling ${EVENT_ITEM_PICKED_UP} for item ${itemId} picked by ${pickerId} from reported location ${locationId}`);

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
     * Handles the EVENT_ITEM_DROP_ATTEMPTED event.
     * Updates the item's PositionComponent to place it into the specified world location
     * and notifies the EntityManager to update the spatial index. Dispatches UI feedback.
     *
     * @private
     * @param {ItemDropAttemptedEventPayload} eventData - Data from the event.
     */
    #handleItemDropAttempted(eventData) {
        const {playerId, itemInstanceId, locationId: newLocationId} = eventData;
        const itemId = itemInstanceId; // Alias for clarity within this handler

        console.log(`WorldPresenceSystem: Handling ${EVENT_ITEM_DROP_ATTEMPTED} for item ${itemId} dropped by player ${playerId} into location ${newLocationId}`);

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
            this.#eventBus.dispatch(EVENT_ITEM_DROPPED, {
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

    /**
     * Stub handler for spawning entity requests.
     * @private
     * @param {SpawnEntityRequestedEventPayload} payload
     */
    _handleSpawnEntityRequested(payload) {
        console.log(`[WorldPresenceSystem] Stub Handler: Received event '${EVENT_SPAWN_ENTITY_REQUESTED}' with payload:`, payload);
        // Phase 1: Implement actual entity spawning logic here.
        // This will likely involve using EntityManager.createEntityInstanceFromDefinition,
        // setting its PositionComponent based on the payload, and potentially adding to spatial index.
    }


    // Optional: Add a method to unsubscribe if needed during engine shutdown/restart
    shutdown() {
        this.#eventBus.unsubscribe(EVENT_ITEM_PICKED_UP, this.#handleItemPickedUp.bind(this)); // Ensure correct binding if using bind in subscribe
        this.#eventBus.unsubscribe(EVENT_ITEM_DROP_ATTEMPTED, this.#handleItemDropAttempted);
        console.log("WorldPresenceSystem: Unsubscribed from events.");
    }
}

export default WorldPresenceSystem;