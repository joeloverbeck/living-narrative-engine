// src/systems/inventorySystem.js

// --- Component Imports ---
import { InventoryComponent } from '../components/inventoryComponent.js';
import { ItemComponent } from '../components/itemComponent.js';
import { NameComponent } from '../components/nameComponent.js';
import {
    EVENT_ITEM_CONSUME_REQUESTED,
    EVENT_ITEM_DROP_ATTEMPTED,
    EVENT_ITEM_DROPPED,
    EVENT_ITEM_PICKED_UP
} from "../types/eventTypes.js"; // Added for item details

/** @typedef {import('../core/eventBus.js').default} EventBus */
/** @typedef {import('../entities/entityManager.js').default} EntityManager */
/** @typedef {import('../core/dataManager.js').default} DataManager */
/** @typedef {import('../core/gameStateManager.js').default} GameStateManager */ // Added
/** @typedef {import('../entities/entity.js').default} Entity */

// Add JSDoc type imports for payloads if not already present globally
/** @typedef {import('../types/eventTypes.js').ItemPickedUpEventPayload} ItemPickedUpEventPayload */
/** @typedef {import('../types/eventTypes.js').ItemDropAttemptedEventPayload} ItemDropAttemptedEventPayload */
/** @typedef {import('../types/eventTypes.js').ItemConsumeRequestedEventPayload} ItemConsumeRequestedEventPayload */
/** @typedef {import('../types/eventTypes.js').InventoryRenderPayload} InventoryRenderPayload */ // Added


/**
 * Handles inventory-related events, including item pickup, drop, consumption,
 * and responding to UI requests for inventory rendering.
 */
class InventorySystem {
    #eventBus;
    #entityManager;
    #dataManager;
    #gameStateManager; // Added

    /**
     * @param {object} options
     * @param {EventBus} options.eventBus
     * @param {EntityManager} options.entityManager
     * @param {DataManager} options.dataManager
     * @param {GameStateManager} options.gameStateManager // Added
     */
    constructor(options) {
        const { eventBus, entityManager, dataManager, gameStateManager } = options || {}; // Added gameStateManager

        if (!eventBus) throw new Error("InventorySystem requires options.eventBus.");
        if (!entityManager) throw new Error("InventorySystem requires options.entityManager.");
        if (!dataManager) throw new Error("InventorySystem requires options.dataManager.");
        if (!gameStateManager) throw new Error("InventorySystem requires options.gameStateManager."); // Added check

        this.#eventBus = eventBus;
        this.#entityManager = entityManager;
        this.#dataManager = dataManager;
        this.#gameStateManager = gameStateManager; // Added assignment

        console.log("InventorySystem: Instance created.");
    }

    /**
     * Subscribes to relevant inventory and UI events.
     */
    initialize() {
        // Gameplay events
        this.#eventBus.subscribe(EVENT_ITEM_PICKED_UP, this.#handleItemPickedUp.bind(this));
        this.#eventBus.subscribe(EVENT_ITEM_DROP_ATTEMPTED, this.#handleItemDropAttempted.bind(this));
        this.#eventBus.subscribe(EVENT_ITEM_CONSUME_REQUESTED, this.#handleItemConsumeRequested.bind(this));

        // UI events
        this.#eventBus.subscribe('ui:request_inventory_render', this.#handleInventoryRenderRequest.bind(this)); // Added

        console.log("InventorySystem: Initialized and subscribed to '" + EVENT_ITEM_PICKED_UP + "', '" + EVENT_ITEM_DROP_ATTEMPTED + "', '" + EVENT_ITEM_CONSUME_REQUESTED + "', and 'ui:request_inventory_render'."); // Updated log
    }

    /**
     * Handles the EVENT_ITEM_PICKED_UP event.
     * Adds the item to the picker's inventory.
     * Assumes the item's removal from the world/spatial index is handled elsewhere
     * (e.g., by the system dispatching the event or another listener reacting to it).
     * @private
     * @param {ItemPickedUpEventPayload} eventData - Data from the event. // Updated type hint
     */
    #handleItemPickedUp(eventData) {
        // locationId is destructured but no longer used in this method after refactoring.
        const { pickerId, itemId } = eventData;
        console.log(`InventorySystem: Handling ${EVENT_ITEM_PICKED_UP} for item ${itemId} by ${pickerId}`); // Removed location from log

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
        // is assumed to be handled by another system listening to EVENT_ITEM_PICKED_UP
        // or by the system that initially dispatched the event (e.g., InteractionSystem).
        // This system (InventorySystem) is now *only* responsible for managing the inventory component state.
    }

    /**
     * Handles the EVENT_ITEM_DROP_ATTEMPTED event.
     * Removes the specified item from the player's inventory state.
     * Does not handle placing the item in the world.
     * @private
     * @param {ItemDropAttemptedEventPayload} eventData - Data from the event. // Updated type hint
     */
    #handleItemDropAttempted(eventData) {
        const { playerId, itemInstanceId } = eventData; // locationId is available but not needed for inventory removal
        console.log(`InventorySystem (Drop): Handling ${EVENT_ITEM_DROP_ATTEMPTED} for player ${playerId}, item ${itemInstanceId}`);

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
        // to EVENT_ITEM_DROP_ATTEMPTED or a subsequent event like EVENT_ITEM_DROPPED.
    }

    /**
     * Handles the EVENT_ITEM_CONSUME_REQUESTED event.
     * Removes the specified item from the user's inventory.
     * @private
     * @param {ItemConsumeRequestedEventPayload} payload - Data from the event.
     */
    #handleItemConsumeRequested(payload) {
        const { userId, itemInstanceId } = payload;
        console.log(`InventorySystem (Consume): Handling ${EVENT_ITEM_CONSUME_REQUESTED} for user ${userId}, item ${itemInstanceId}`);

        const userEntity = this.#entityManager.getEntityInstance(userId);
        if (!userEntity) {
            console.error(`InventorySystem (Consume): User entity '${userId}' not found when handling consumption request.`);
            return; // Cannot proceed without the user entity
        }

        const inventoryComp = userEntity.getComponent(InventoryComponent);
        if (!inventoryComp) {
            console.error(`InventorySystem (Consume): User entity '${userId}' has no InventoryComponent when handling consumption request.`);
            return; // Cannot proceed without the inventory component
        }

        // Attempt removal
        const removed = inventoryComp.removeItem(itemInstanceId);

        if (removed) {
            console.log(`InventorySystem (Consume): Successfully consumed item ${itemInstanceId} from user ${userId}'s inventory.`);
        } else {
            // This might happen if the event fires twice due to some race condition,
            // or if the item was removed by another means (e.g., a direct effect, another system reacting faster)
            // between the usage action finishing and this handler executing. Log as a warning.
            console.warn(`InventorySystem (Consume): Failed to remove item ${itemInstanceId} from user ${userId}'s inventory during consumption request. Item might have already been removed or never existed in inventory.`);
        }
    }

    /**
     * Handles the 'ui:request_inventory_render' event.
     * Fetches player inventory data and dispatches 'ui:render_inventory'.
     * Logic moved from GameEngine.#handleInventoryRenderRequest.
     * @private
     * @param {object} [payload] - Optional payload from the event (currently unused).
     */
    #handleInventoryRenderRequest(payload = {}) {
        // No need for #isInitialized check like in GameEngine
        console.log("InventorySystem: Handling 'ui:request_inventory_render'.");

        const player = this.#gameStateManager.getPlayer();
        if (!player) {
            console.error("InventorySystem: Cannot render inventory, player entity not found in GameStateManager.");
            // Dispatch empty inventory event for UI consistency
            this.#eventBus.dispatch('ui:render_inventory', { items: [] });
            return;
        }

        const inventoryComp = player.getComponent(InventoryComponent);
        if (!inventoryComp) {
            console.log(`InventorySystem: Player ${player.id} has no InventoryComponent. Rendering empty inventory.`);
            this.#eventBus.dispatch('ui:render_inventory', { items: [] });
            return;
        }

        const itemIds = inventoryComp.getItems();
        const itemsData = [];

        for (const itemId of itemIds) {
            const itemInstance = this.#entityManager.getEntityInstance(itemId);
            if (!itemInstance) {
                console.warn(`InventorySystem: Inventory contains item ID '${itemId}' but instance not found in EntityManager. Skipping.`);
                continue;
            }

            const nameComp = itemInstance.getComponent(NameComponent);
            const itemName = nameComp ? nameComp.value : '(Unknown Item)';
            const icon = null; // Placeholder for icon data

            // Example: trying to get description - uses the component key 'Description'.
            // Ensure a component with this key is registered if description is needed.
            const descriptionComp = itemInstance.getComponent('Description');
            const description = descriptionComp ? descriptionComp.value : '';

            itemsData.push({ id: itemId, name: itemName, icon: icon, description: description });
        }

        /** @type {InventoryRenderPayload} */
        const renderPayload = { items: itemsData };
        this.#eventBus.dispatch('ui:render_inventory', renderPayload);
        console.log(`InventorySystem: Dispatched 'ui:render_inventory' with ${itemsData.length} items for player ${player.id}.`);
    }
}

export default InventorySystem;