// src/systems/inventorySystem.js

import {InventoryComponent} from '../components/inventoryComponent.js';
import {ItemComponent} from '../components/itemComponent.js';

/** @typedef {import('../../eventBus.js').default} EventBus */
/** @typedef {import('../entities/entityManager.js').default} EntityManager */
/** @typedef {import('../../dataManager.js').default} DataManager */

/** @typedef {import('../entities/entity.js').default} Entity */

/**
 * Handles inventory-related events, primarily item pickup.
 */
class InventorySystem {
    #eventBus;
    #entityManager;
    #dataManager;

    /**
     * @param {object} options
     * @param {EventBus} options.eventBus
     * @param {EntityManager} options.entityManager
     * @param {DataManager} options.dataManager
     */
    constructor(options) {
        const {eventBus, entityManager, dataManager} = options || {};

        if (!eventBus) throw new Error("InventorySystem requires options.eventBus.");
        if (!entityManager) throw new Error("InventorySystem requires options.entityManager.");
        if (!dataManager) throw new Error("InventorySystem requires options.dataManager.");

        this.#eventBus = eventBus;
        this.#entityManager = entityManager;
        this.#dataManager = dataManager;

        console.log("InventorySystem: Instance created.");
    }

    /**
     * Subscribes to relevant inventory events.
     */
    initialize() {
        this.#eventBus.subscribe('event:item_picked_up', this.#handleItemPickedUp.bind(this));
        this.#eventBus.subscribe('event:item_drop_attempted', this.#handleItemDropAttempted.bind(this));
        console.log("InventorySystem: Initialized and subscribed to 'event:item_picked_up'.");
    }

    /**
     * Handles the 'event:item_picked_up' event.
     * Adds the item to the picker's inventory.
     * Assumes the item's removal from the world/spatial index is handled elsewhere
     * (e.g., by the system dispatching the event or another listener reacting to it).
     * @private
     * @param {{ pickerId: string, itemId: string }} eventData - Data from the event.
     */
    #handleItemPickedUp(eventData) {
        // locationId is destructured but no longer used in this method after refactoring.
        const {pickerId, itemId} = eventData;
        console.log(`InventorySystem: Handling event:item_picked_up for item ${itemId} by ${pickerId}`); // Removed location from log

        // --- 1. Validate Entities and Components ---
        const pickerEntity = this.#entityManager.getEntityInstance(pickerId);
        if (!pickerEntity) {
            console.error(`InventorySystem: Picker entity '${pickerId}' not found.`);
            return;
        }

        const itemEntity = this.#entityManager.getEntityInstance(itemId);
        if (!itemEntity) {
            // This might happen if the event fires slightly after the item is already removed by another system.
            // Or if the removeEntityInstance call happens before all listeners finish.
            // For robustness, log a warning but don't necessarily treat as a critical error unless it causes problems.
            console.warn(`InventorySystem: Item entity '${itemId}' not found when handling pickup. It might have already been removed.`);
            // Depending on game logic, we might still want to proceed to add to inventory if the item *should* exist conceptually.
            // However, if the entity is gone, we might lack info (like stackability if not in definition).
            // Sticking with the original logic: return if item entity not found at this point.
            return;
        }

        const inventoryComp = pickerEntity.getComponent(InventoryComponent);
        if (!inventoryComp) {
            console.error(`InventorySystem: Picker entity '${pickerId}' has no InventoryComponent.`);
            // Maybe dispatch a UI error? For now, just log and stop.
            // this.#eventBus.dispatch('ui:message_display', { text: "You cannot carry items!", type: 'error' });
            return;
        }

        // --- 2. Check Stacking / Duplicates ---
        // Attempt to get definition first for authoritative data
        const itemDef = this.#dataManager.getEntityDefinition(itemEntity.id); // Use itemEntity.id for clarity
        const itemCompInstance = itemEntity.getComponent(ItemComponent);

        // Determine stackability safely, defaulting to false
        // Check definition first, then instance component as fallback
        const isStackable = itemDef?.components?.Item?.stackable === true || itemCompInstance?.stackable === true;
        const alreadyHas = inventoryComp.hasItem(itemId);

        if (!isStackable && alreadyHas) {
            console.warn(`InventorySystem: Picker '${pickerId}' already has non-stackable item '${itemId}'. Pickup skipped.`);
            // Optionally dispatch a UI message:
            // this.#eventBus.dispatch('ui:message_display', { text: `You already have a ${itemDef?.components?.Name?.value ?? itemId}.`, type: 'info' });
            return; // Stop processing
        }

        // --- 3. Add Item to Inventory ---
        // Assuming addItem handles stacking logic internally if needed (e.g., incrementing count vs. adding new entry)
        inventoryComp.addItem(itemId); // Might need enhancement if stacking requires quantity logic here
        console.log(`InventorySystem: Added '${itemId}' to inventory of '${pickerId}'.`);

        // Note: The actual removal of the item entity from the world (EntityManager.removeEntityInstance)
        // is assumed to be handled by another system listening to 'event:item_picked_up'
        // or by the system that initially dispatched the event (e.g., InteractionSystem).
        // This system (InventorySystem) is now *only* responsible for managing the inventory component state.
    }

    /**
     * Handles the 'event:item_drop_attempted' event.
     * Removes the specified item from the player's inventory state.
     * Does not handle placing the item in the world.
     * @private
     * @param {{ playerId: string, itemInstanceId: string, locationId: string }} eventData - Data from the event.
     */
    #handleItemDropAttempted(eventData) {
        const {playerId, itemInstanceId} = eventData; // locationId is available but not needed for inventory removal
        console.log(`InventorySystem (Drop): Handling event:item_drop_attempted for player ${playerId}, item ${itemInstanceId}`);

        // --- 1. Retrieve Player Entity and Inventory ---
        const playerEntity = this.#entityManager.getEntityInstance(playerId);
        if (!playerEntity) {
            // Should generally not happen if event source (dropActionHandler) validated the player
            console.error(`InventorySystem (Drop): Player entity '${playerId}' not found when handling drop event.`);
            return; // Cannot proceed without the player entity
        }

        const inventoryComp = playerEntity.getComponent(InventoryComponent);
        if (!inventoryComp) {
            // Should also not happen if dropActionHandler validated it, but check defensively
            console.error(`InventorySystem (Drop): Player entity '${playerId}' has no InventoryComponent when handling drop event.`);
            return; // Cannot proceed without the inventory component
        }

        // --- 2. Consistency Check ---
        // Verify the item is still in the inventory before attempting removal.
        // This handles potential race conditions or stale event data.
        if (!inventoryComp.hasItem(itemInstanceId)) {
            console.warn(`InventorySystem (Drop): Consistency check failed. Player ${playerId}'s inventory does not contain item ${itemInstanceId} when attempting drop. Event ignored.`);
            // Log a warning as per AC, but do not crash.
            return; // Stop processing this event
        }

        // --- 3. Remove Item from Inventory ---
        const removed = inventoryComp.removeItem(itemInstanceId);

        // --- 4. Log Result ---
        if (removed) {
            console.log(`InventorySystem (Drop): Successfully removed item ${itemInstanceId} from player ${playerId}'s inventory.`);
        } else {
            // This case *shouldn't* be reachable if the 'hasItem' check above passed,
            // but log an error defensively in case of unexpected component behavior.
            console.error(`InventorySystem (Drop): Failed to remove item ${itemInstanceId} from player ${playerId}'s inventory, even though it passed the consistency check.`);
        }

        // Note: This system's responsibility ends here. Placing the item in the world
        // or dispatching UI messages would be handled by other systems listening
        // to 'event:item_drop_attempted' or a subsequent event like 'event:item_dropped'.
    }
}

export default InventorySystem;