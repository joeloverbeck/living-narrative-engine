// src/systems/inventorySystem.js

import {InventoryComponent} from '../components/inventoryComponent.js';
import {ItemComponent} from '../components/itemComponent.js';
import {EntitiesPresentComponent} from '../components/entitiesPresentComponent.js'; // Import EntitiesPresentComponent

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
        console.log("InventorySystem: Initialized and subscribed to 'event:item_picked_up'.");
    }

    /**
     * Handles the 'event:item_picked_up' event.
     * Adds the item to the picker's inventory and removes it from the world.
     * @private
     * @param {{ pickerId: string, itemId: string, locationId: string }} eventData - Data from the event.
     */
    #handleItemPickedUp(eventData) {
        const {pickerId, itemId, locationId} = eventData;
        console.log(`InventorySystem: Handling event:item_picked_up for item ${itemId} by ${pickerId} from ${locationId}`);

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
            return;
        }

        const inventoryComp = pickerEntity.getComponent(InventoryComponent);
        if (!inventoryComp) {
            console.error(`InventorySystem: Picker entity '${pickerId}' has no InventoryComponent.`);
            // Maybe dispatch a UI error? For now, just log and stop.
            // this.#eventBus.dispatch('ui:message_display', { text: "You cannot carry items!", type: 'error' });
            return;
        }

        const locationEntity = this.#entityManager.getEntityInstance(locationId);
        if (!locationEntity) {
            console.error(`InventorySystem: Location entity '${locationId}' not found.`);
            return; // Cannot remove item from location if location doesn't exist
        }

        const entitiesPresentComp = locationEntity.getComponent(EntitiesPresentComponent);
        if (!entitiesPresentComp) {
            console.warn(`InventorySystem: Location entity '${locationId}' has no EntitiesPresentComponent. Cannot verify item removal from location list.`);
            // Continue for now, but this might indicate an issue elsewhere.
        }

        // --- 2. Check Stacking / Duplicates ---
        const itemDef = this.#dataManager.getEntityDefinition(itemId);
        // Fallback to checking instance component if definition lookup fails (shouldn't normally happen)
        const itemCompInstance = itemEntity.getComponent(ItemComponent);

        // Determine stackability safely, defaulting to false
        const isStackable = itemDef?.components?.Item?.stackable === true || itemCompInstance?.stackable === true;
        const alreadyHas = inventoryComp.hasItem(itemId);

        if (!isStackable && alreadyHas) {
            console.warn(`InventorySystem: Picker '${pickerId}' already has non-stackable item '${itemId}'. Pickup skipped.`);
            // Optionally dispatch a UI message:
            // this.#eventBus.dispatch('ui:message_display', { text: `You already have a ${itemDef?.components?.Name?.value ?? itemId}.`, type: 'info' });
            return; // Stop processing
        }

        // --- 3. Add Item to Inventory ---
        inventoryComp.addItem(itemId);
        console.log(`InventorySystem: Added '${itemId}' to inventory of '${pickerId}'.`);

        // --- 4. Remove Item from Location's List ---
        if (entitiesPresentComp) {
            const removedFromLocationList = entitiesPresentComp.removeEntity(itemId);
            if (removedFromLocationList) {
                console.log(`InventorySystem: Removed '${itemId}' from EntitiesPresentComponent of location '${locationId}'.`);
            } else {
                console.warn(`InventorySystem: Item '${itemId}' was not found in EntitiesPresentComponent of location '${locationId}' during removal step.`);
            }
        }
    }
}

export default InventorySystem;