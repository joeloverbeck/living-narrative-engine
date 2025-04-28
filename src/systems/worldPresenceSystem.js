// src/systems/worldPresenceSystem.js

import {getDisplayName} from '../utils/messages.js';
import {POSITION_COMPONENT_ID} from '../types/components.js'; // Added import for component ID

/** @typedef {import('../core/eventBus.js').default} EventBus */
/** @typedef {import('../entities/entityManager.js').default} EntityManager */

/** @typedef {import('../entities/entity.js').default} Entity */

/**
 * Handles world-state interactions resulting from events, such as removing items
 * from their location when picked up or adding them when dropped.
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
      console.error('WorldPresenceSystem: EventBus dependency is missing.');
      throw new Error('WorldPresenceSystem requires an EventBus instance.');
    }
    if (!entityManager) {
      console.error('WorldPresenceSystem: EntityManager dependency is missing.');
      throw new Error('WorldPresenceSystem requires an EntityManager instance.');
    }
    this.#eventBus = eventBus;
    this.#entityManager = entityManager;
    console.log('WorldPresenceSystem: Instance created.');
  }

  /**
     * Subscribes the system to relevant game events.
     */
  initialize() {
    this.#eventBus.subscribe('event:item_picked_up', this.#handleItemPickedUp.bind(this));
    this.#eventBus.subscribe('event:item_drop_attempted', this.#handleItemDropAttempted.bind(this));
    this.#eventBus.subscribe('event:spawn_entity_requested', this._handleSpawnEntityRequested.bind(this));
    console.log('WorldPresenceSystem: Initialized and subscribed to item pickup/drop and entity spawn events.');
  }

  /**
     * Handles the "event:item_picked_up" event.
     * Updates the item's 'core:position' component data via the EntityManager
     * to remove it from its world location.
     *
     * @private
     */
  #handleItemPickedUp(eventData) {
    const {pickerId, itemId, locationId} = eventData; // locationId from event for validation

    console.log(`WorldPresenceSystem: Handling ${'event:item_picked_up'} for item ${itemId} picked by ${pickerId} from reported location ${locationId}`);

    // Get the current position component data using EntityManager
    const positionData = this.#entityManager.getComponentData(itemId, POSITION_COMPONENT_ID);

    if (!positionData) {
      // Handle cases where the item surprisingly has no position (shouldn't happen for a world item being picked up)
      console.warn(`WorldPresenceSystem: Picked-up item ${itemId} does not have '${POSITION_COMPONENT_ID}' component data. Cannot update world position.`);
      return; // Stop processing
    }

    // Store its current locationId before changing it
    const oldLocationId = positionData.locationId;

    // Optional Validation: Check if the component's location matches the event's reported location
    if (oldLocationId !== locationId) {
      console.warn(`WorldPresenceSystem: Mismatch for item ${itemId}. Event reported location ${locationId}, but component's current location is ${oldLocationId}. Using component's location for removal logic.`);
      // Note: We proceed using `oldLocationId` from the component as the authoritative source for removal.
    }

    // If the item is somehow already not in a location, log and potentially stop.
    if (oldLocationId === null || oldLocationId === undefined) {
      console.warn(`WorldPresenceSystem: Item ${itemId} already has a null/undefined locationId when handling pickup. Assuming it's already removed from world state.`);
      return; // Nothing to update in the world state.
    }

    // Prepare the updated component data
    const updatedPositionData = {...positionData}; // Shallow copy
    updatedPositionData.locationId = null;
    updatedPositionData.x = 0; // Explicitly reset coordinates
    updatedPositionData.y = 0;

    try {
      // Use EntityManager to add/update the component data.
      // EntityManager's addComponent handles spatial index updates internally.
      const added = this.#entityManager.addComponent(itemId, POSITION_COMPONENT_ID, updatedPositionData);
      if (!added) {
        // This case should ideally be covered by the catch block if addComponent throws
        // but adding a check for robustness in case addComponent returns false without throwing.
        console.error(`WorldPresenceSystem: Failed to update '${POSITION_COMPONENT_ID}' via EntityManager for item pickup [${itemId}]. addComponent returned false.`);
        return; // Stop processing
      }
      console.log(`WorldPresenceSystem: Updated '${POSITION_COMPONENT_ID}' component data via EntityManager to remove item ${itemId} from world.`);
      // REMOVED: this.#entityManager.notifyPositionChange(itemId, oldLocationId, null);

      console.log(`WorldPresenceSystem: Successfully processed world state update for picked-up item ${itemId}. EntityManager handled spatial index.`);

    } catch (error) {
      // Catch errors from addComponent (e.g., validation failure, entity not found)
      console.error(`WorldPresenceSystem: Error updating '${POSITION_COMPONENT_ID}' via EntityManager for item pickup [${itemId}]:`, error);
      // Reverting is complex; focus on logging. The EntityManager might have already partially updated state.
    }
  }

  /**
     * Handles the "event:item_drop_attempted" event.
     * Updates the item's 'core:position' component data via the EntityManager
     * to place it into the specified world location. Dispatches UI feedback.
     *
     * @private
     */
  #handleItemDropAttempted(eventData) {
    const {playerId, itemInstanceId, locationId: newLocationId} = eventData;
    const itemId = itemInstanceId; // Alias for clarity

    console.log(`WorldPresenceSystem: Handling ${'event:item_drop_attempted'} for item ${itemId} dropped by player ${playerId} into location ${newLocationId}`);

    // No need to get itemEntity instance if we operate solely via EntityManager methods and item ID
    // However, we still need it for the display name. If getDisplayName needs the entity, keep it.
    const itemEntity = this.#entityManager.getEntityInstance(itemId);
    if (!itemEntity) {
      console.error(`WorldPresenceSystem: Cannot find item entity instance with ID: ${itemId} required for display name. Cannot process drop fully.`);
      this.#eventBus.dispatch('textUI:display_message', {
        text: 'Internal error: Cannot identify dropped item.',
        type: 'error'
      });
      return;
    }

    // Check current position data using EntityManager
    const currentPositionData = this.#entityManager.getComponentData(itemId, POSITION_COMPONENT_ID);
    const oldLocationId = currentPositionData?.locationId ?? null; // Store old location, default to null if no component/locationId

    if (currentPositionData) {
      console.log(`WorldPresenceSystem: Item ${itemId} has existing '${POSITION_COMPONENT_ID}' data. Old location: ${oldLocationId}`);
    } else {
      console.log(`WorldPresenceSystem: Item ${itemId} lacks '${POSITION_COMPONENT_ID}' data. Will be added.`);
      // oldLocationId is correctly null here
    }
    // REMOVED: Logic for creating new PositionComponent and adding via entity.addComponent

    // Prepare the new position data object
    const newPositionData = {
      locationId: newLocationId,
      x: 0, // Default coordinates, could be enhanced
      y: 0
    };

    try {
      // Use EntityManager to add/update the component data.
      // EntityManager's addComponent handles spatial index updates internally.
      const added = this.#entityManager.addComponent(itemId, POSITION_COMPONENT_ID, newPositionData);
      if (!added) {
        // Handle case where addComponent might return false without throwing
        console.error(`WorldPresenceSystem: Failed to add/update '${POSITION_COMPONENT_ID}' via EntityManager for item drop [${itemId}]. addComponent returned false.`);
        this.#eventBus.dispatch('textUI:display_message', {text: 'Internal error placing item.', type: 'error'});
        return; // Stop processing
      }
      console.log(`WorldPresenceSystem: Set '${POSITION_COMPONENT_ID}' component data via EntityManager for dropped item ${itemId} to location ${newLocationId}.`);
      // REMOVED: this.#entityManager.notifyPositionChange(itemId, oldLocationId, newLocationId);

      // Dispatch success messages and events
      const itemName = getDisplayName(itemEntity); // Get item name for message
      const successMessage = `You drop the ${itemName}.`;
      this.#eventBus.dispatch('textUI:display_message', {text: successMessage, type: 'info'});

      this.#eventBus.dispatch('event:item_dropped', {
        playerId: playerId,
        itemId: itemId,
        locationId: newLocationId
      });

      console.log(`WorldPresenceSystem: Successfully processed drop for item ${itemId}. EntityManager handled spatial index.`);

    } catch (error) {
      // Catch errors from addComponent (validation, entity not found, etc.)
      console.error(`WorldPresenceSystem: Error adding/updating '${POSITION_COMPONENT_ID}' via EntityManager for item drop [${itemId}]:`, error);
      this.#eventBus.dispatch('textUI:display_message', {
        text: `Error dropping item: ${error.message || 'Internal error.'}`, // Provide a fallback message
        type: 'error'
      });
      // Reverting is complex here. The EntityManager might be in an inconsistent state.
      // Logged error is the main recourse.
    }
  }

  /**
     * Stub handler for spawning entity requests.
     * @private
     */
  _handleSpawnEntityRequested(payload) {
    console.log(`[WorldPresenceSystem] Stub Handler: Received event '${'event:spawn_entity_requested'}' with payload:`, payload);
    // Phase 1: Implement actual entity spawning logic here.
    // This will likely involve using EntityManager.createEntityInstanceFromDefinition,
    // setting its PositionComponent data via addComponent if needed based on payload,
    // and EntityManager will handle adding to spatial index.
  }


  // Optional: Add a method to unsubscribe if needed during engine shutdown/restart
  shutdown() {
    // Ensure correct binding if using bind in subscribe
    // Note: If initialize uses .bind(this), shutdown likely doesn't need it if passing the bound function reference
    // However, double-check EventBus implementation details. If storing the raw function, bind here too.
    // For simplicity, assuming bind was used in subscribe and is needed here too:
    this.#eventBus.unsubscribe('event:item_picked_up', this.#handleItemPickedUp.bind(this));
    this.#eventBus.unsubscribe('event:item_drop_attempted', this.#handleItemDropAttempted.bind(this));
    this.#eventBus.unsubscribe('event:spawn_entity_requested', this._handleSpawnEntityRequested.bind(this));
    console.log('WorldPresenceSystem: Unsubscribed from events.');
  }
}

export default WorldPresenceSystem;