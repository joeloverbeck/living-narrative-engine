// src/systems/inventorySystem.js

// --- Component ID Constants ---
import {
  INVENTORY_COMPONENT_ID,
  ITEM_COMPONENT_ID,
  NAME_COMPONENT_TYPE_ID
  // Note: A constant for 'component:description' is not defined in src/types/components.js
  // Using a string literal for now, but ideally should be defined.
} from '../types/components.js';

/** @typedef {import('../core/eventBus.js').default} EventBus */
/** @typedef {import('../entities/entityManager.js').default} EntityManager */
/** @typedef {import('../core/services/gameDataRepository.js').GameDataRepository} GameDataRepository */
/** @typedef {import('../core/gameStateManager.js').default} GameStateManager */
/** @typedef {import('../entities/entity.js').default} Entity */ // Keep for getPlayer return type hint

/**
 * @typedef {object} ItemRenderData
 * @property {string} id - The item instance ID.
 * @property {string} name - The display name of the item.
 * @property {any} icon - Placeholder for item icon data.
 * @property {string} description - The description of the item.
 */

/**
 * @typedef {object} InventoryRenderPayload
 * @property {ItemRenderData[]} items - Array of item data for rendering.
 */


/**
 * Handles inventory-related events using ID-based component data access.
 * Manages item pickup, drop, consumption, and inventory rendering requests
 * by interacting with the EntityManager to fetch, modify, and save component data.
 */
class InventorySystem {
  #eventBus;
  #entityManager;
  #repository;
  #gameStateManager;

  constructor({eventBus, entityManager, gameDataRepository, gameStateManager}) {
    if (!eventBus) throw new Error('InventorySystem requires options.eventBus.');
    if (!entityManager) throw new Error('InventorySystem requires options.entityManager.');
    if (!gameDataRepository) throw new Error('InventorySystem requires options.gameDataRepository.');
    if (!gameStateManager) throw new Error('InventorySystem requires options.gameStateManager.');

    this.#eventBus = eventBus;
    this.#entityManager = entityManager;
    this.#repository = gameDataRepository;
    this.#gameStateManager = gameStateManager;
    console.log('InventorySystem: Instance created.');
  }

  /**
     * Subscribes to relevant inventory and UI events.
     */
  initialize() {
    // Gameplay events
    this.#eventBus.subscribe('event:item_picked_up', this.#handleItemPickedUp.bind(this));
    this.#eventBus.subscribe('event:item_drop_attempted', this.#handleItemDropAttempted.bind(this));
    this.#eventBus.subscribe('event:item_consume_requested', this.#handleItemConsumeRequested.bind(this));

    // UI events
    this.#eventBus.subscribe('ui:request_inventory_render', this.#handleInventoryRenderRequest.bind(this));

    console.log("InventorySystem: Initialized and subscribed to 'event:item_picked_up', 'event:item_drop_attempted', 'event:item_consume_requested', and 'ui:request_inventory_render'.");
  }

  /**
     * Handles the "event:item_picked_up" event.
     * Adds the item to the picker's inventory component data.
     * @private
     */
  #handleItemPickedUp(eventData) {
    const {pickerId, itemId} = eventData;
    console.log(`InventorySystem (Pickup): Handling ${'event:item_picked_up'} for item ${itemId} by ${pickerId}`);

    // --- 1. Validate Entities and Component Presence ---
    // Check if picker *can* have an inventory (has the component).
    if (!this.#entityManager.hasComponent(pickerId, INVENTORY_COMPONENT_ID)) { //
      console.error(`InventorySystem (Pickup): Picker entity '${pickerId}' has no InventoryComponent data.`);
      // Optional: Dispatch UI message "You cannot carry items!"
      // this.#eventBus.dispatch("textUI:display_message", { text: "You cannot carry items!", type: 'error' });
      return;
    }

    // Check if item entity still exists (might have been removed by another system).
    const itemEntity = this.#entityManager.getEntityInstance(itemId); // Need instance for definition lookup fallback
    if (!itemEntity) {
      console.warn(`InventorySystem (Pickup): Item entity '${itemId}' not found when handling pickup. It might have already been removed.`);
      return;
    }

    // --- 2. Check Stacking / Duplicates ---
    const itemDef = this.#repository.getEntityDefinition(itemId); //
    const itemCompData = this.#entityManager.getComponentData(itemId, ITEM_COMPONENT_ID); // Fetch ItemComponent data

    // Determine stackability (Definition > Instance Data Fallback)
    const isStackable = itemDef?.components?.[ITEM_COMPONENT_ID]?.stackable === true || itemCompData?.stackable === true; //

    // Fetch current inventory data to check for existing item
    let inventoryData = this.#entityManager.getComponentData(pickerId, INVENTORY_COMPONENT_ID); //

    // Initialize inventory data structure if it doesn't exist or is invalid
    if (!inventoryData || typeof inventoryData !== 'object') { //
      inventoryData = {items: []};
      console.log(`InventorySystem (Pickup): Initialized inventory data for ${pickerId}.`); //
    }
    if (!Array.isArray(inventoryData.items)) { // Ensure 'items' array exists
      inventoryData.items = [];
      console.log(`InventorySystem (Pickup): Ensured 'items' array exists in inventory data for ${pickerId}.`); //
    }

    const alreadyHas = inventoryData.items.includes(itemId); // Check the data array

    if (!isStackable && alreadyHas) {
      console.warn(`InventorySystem (Pickup): Picker '${pickerId}' already has non-stackable item '${itemId}'. Pickup skipped.`);
      // Optional: Dispatch UI message
      // const itemNameData = this.#entityManager.getComponentData(itemId, NAME_COMPONENT_TYPE_ID);
      // this.#eventBus.dispatch("textUI:display_message", { text: `You already have a ${itemNameData?.value ?? itemId}.`, type: 'info' });
      return;
    }

    // --- 3. Add Item to Inventory Data ---
    // Modify the items array (simple push for now, stacking logic would go here)
    if (!alreadyHas) { // Avoid adding duplicates if stackable logic isn't fully implemented yet
      inventoryData.items.push(itemId); //
    }
    // TODO: Implement stacking logic if required (e.g., find item entry, increment count)

    // --- 4. Save Inventory Data Back ---
    try {
      // Use addComponent to overwrite/update the inventory data
      this.#entityManager.addComponent(pickerId, INVENTORY_COMPONENT_ID, inventoryData); //
      console.log(`InventorySystem (Pickup): Updated inventory data for '${pickerId}', added '${itemId}'. New items: [${inventoryData.items.join(', ')}]`); //
    } catch (error) {
      console.error(`InventorySystem (Pickup): Failed to save updated inventory data for ${pickerId}. Item ${itemId} might not be added. Error:`, error);
      // Consider if error handling/rollback is needed
    }

    // Note: Item removal from world is handled elsewhere.
  }


  /**
     * Handles the "event:item_drop_attempted" event.
     * Removes the specified item from the player's inventory component data.
     * @private
     */
  #handleItemDropAttempted(eventData) {
    const {playerId, itemInstanceId} = eventData;
    console.log(`InventorySystem (Drop): Handling ${'event:item_drop_attempted'} for player ${playerId}, item ${itemInstanceId}`);

    // --- 1. Retrieve Inventory Data ---
    let inventoryData = this.#entityManager.getComponentData(playerId, INVENTORY_COMPONENT_ID); //

    // Check if player has inventory data and it's valid
    if (!inventoryData || !Array.isArray(inventoryData.items)) { //
      console.error(`InventorySystem (Drop): Player '${playerId}' has no valid InventoryComponent data when attempting to drop ${itemInstanceId}.`);
      return;
    }

    // --- 2. Check if Item Exists in Inventory ---
    const itemIndex = inventoryData.items.indexOf(itemInstanceId); //
    if (itemIndex === -1) {
      console.warn(`InventorySystem (Drop): Consistency check failed. Player ${playerId}'s inventory data does not contain item ${itemInstanceId} when attempting drop. Event ignored.`);
      return;
    }

    // --- 3. Remove Item from Inventory Data ---
    let itemRemoved = false;
    // Create a *new* array excluding the item or modify in place
    inventoryData.items.splice(itemIndex, 1); // Modify in place
    itemRemoved = true; // Track removal happened

    // --- 4. Save Modified Data Back ---
    if (itemRemoved) {
      try {
        // Use addComponent to overwrite the inventory data with the modified version
        this.#entityManager.addComponent(playerId, INVENTORY_COMPONENT_ID, inventoryData); //
        console.log(`InventorySystem (Drop): Successfully removed item ${itemInstanceId} from player ${playerId}'s inventory data. New items: [${inventoryData.items.join(', ')}]`); //
      } catch (error) {
        console.error(`InventorySystem (Drop): Failed to save updated inventory data for ${playerId} after removing ${itemInstanceId}. Error:`, error);
        // Consider consequences of failed save (inventory state mismatch)
      }
    } else {
      // This case should technically not be reached due to the check above, but log defensively.
      console.error(`InventorySystem (Drop): Failed to remove item ${itemInstanceId} from player ${playerId}'s inventory data array, even though index was found.`);
    }

    // Note: Placing item in world is handled elsewhere.
  }


  /**
     * Handles the "event:item_consume_requested" event.
     * Removes the specified item from the user's inventory component data.
     * @private
     */
  #handleItemConsumeRequested(payload) {
    const {userId, itemInstanceId} = payload;
    console.log(`InventorySystem (Consume): Handling ${'event:item_consume_requested'} for user ${userId}, item ${itemInstanceId}`);

    // --- 1. Retrieve Inventory Data ---
    let inventoryData = this.#entityManager.getComponentData(userId, INVENTORY_COMPONENT_ID); //

    // Check if user has inventory data and it's valid
    if (!inventoryData || !Array.isArray(inventoryData.items)) { //
      console.error(`InventorySystem (Consume): User '${userId}' has no valid InventoryComponent data when attempting to consume ${itemInstanceId}.`);
      return;
    }

    // --- 2. Check if Item Exists in Inventory ---
    const itemIndex = inventoryData.items.indexOf(itemInstanceId); //
    if (itemIndex === -1) {
      console.warn(`InventorySystem (Consume): User ${userId}'s inventory data does not contain item ${itemInstanceId} when attempting consumption. Item might have already been removed or event is stale.`);
      return;
    }

    // --- 3. Remove Item from Inventory Data ---
    let itemRemoved = false;
    inventoryData.items.splice(itemIndex, 1); // Modify in place
    itemRemoved = true;

    // --- 4. Save Modified Data Back ---
    if (itemRemoved) {
      try {
        this.#entityManager.addComponent(userId, INVENTORY_COMPONENT_ID, inventoryData); //
        console.log(`InventorySystem (Consume): Successfully consumed (removed) item ${itemInstanceId} from user ${userId}'s inventory data. New items: [${inventoryData.items.join(', ')}]`); //
      } catch (error) {
        console.error(`InventorySystem (Consume): Failed to save updated inventory data for ${userId} after consuming ${itemInstanceId}. Error:`, error);
      }
    } else {
      console.error(`InventorySystem (Consume): Failed to remove item ${itemInstanceId} from user ${userId}'s inventory data array during consumption, even though index was found.`);
    }
  }


  /**
     * Handles the 'ui:request_inventory_render' event.
     * Fetches player inventory data using EntityManager and dispatches 'ui:render_inventory'.
     * @private
     * @param {object} [payload] - Optional payload from the event (currently unused).
     */
  #handleInventoryRenderRequest(payload = {}) {
    console.log("InventorySystem: Handling 'ui:request_inventory_render'.");

    const player = this.#gameStateManager.getPlayer();
    if (!player) {
      console.error('InventorySystem: Cannot render inventory, player entity not found in GameStateManager.');
      this.#eventBus.dispatch('ui:render_inventory', {items: []});
      return;
    }

    // Fetch inventory data using EntityManager
    const inventoryData = this.#entityManager.getComponentData(player.id, INVENTORY_COMPONENT_ID); //

    // Get item IDs from the data, default to empty array if no data or no items property
    const itemIds = inventoryData?.items ?? []; //

    if (!inventoryData || itemIds.length === 0) {
      console.log(`InventorySystem: Player ${player.id} has no inventory items according to component data. Rendering empty inventory.`);
      this.#eventBus.dispatch('ui:render_inventory', {items: []});
      return;
    }

    const itemsData = [];

    for (const itemId of itemIds) {
      // Fetch name data for each item using EntityManager
      const nameData = this.#entityManager.getComponentData(itemId, NAME_COMPONENT_TYPE_ID); //
      const itemName = nameData?.value ?? '(Unknown Item)'; // Access the 'value' property
      const icon = null; // Placeholder

      // Fetch description data using EntityManager
      // Assuming 'component:description' is the intended ID. Define it in types/components.js!
      const DESCRIPTION_COMPONENT_ID = 'component:description'; // Placeholder ID
      const descriptionData = this.#entityManager.getComponentData(itemId, DESCRIPTION_COMPONENT_ID); //
      const description = descriptionData?.value ?? ''; // Assuming description component has a 'value' field

      // Check if the item entity instance still exists (optional, but good for robustness)
      if (!this.#entityManager.getEntityInstance(itemId)) { //
        console.warn(`InventorySystem: Inventory data for player ${player.id} contains item ID '${itemId}' but instance not found in EntityManager. Skipping render for this item.`);
        continue;
      }


      itemsData.push({id: itemId, name: itemName, icon: icon, description: description});
    }

    /** @type {InventoryRenderPayload} */
    const renderPayload = {items: itemsData};
    this.#eventBus.dispatch('ui:render_inventory', renderPayload);
    console.log(`InventorySystem: Dispatched 'ui:render_inventory' with ${itemsData.length} items from component data for player ${player.id}.`);
  }
}

export default InventorySystem;