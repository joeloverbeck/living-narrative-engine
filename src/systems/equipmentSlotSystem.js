// src/systems/equipmentSlotSystem.js

// **** NEW IMPORTS ****
import {InventoryComponent} from '../components/inventoryComponent.js';
import {EquipmentComponent} from '../components/equipmentComponent.js';
import {getDisplayName, TARGET_MESSAGES} from "../utils/messages.js";
/** @typedef {import('../entities/entity.js').default} Entity */
/** @typedef {import('../components/inventoryComponent').InventoryComponent} InventoryComponentType */
/** @typedef {import('../components/equipmentComponent').EquipmentComponent} EquipmentComponentType */
// **** END NEW IMPORTS ****


/** @typedef {import('../core/eventBus.js').default} EventBus */
/** @typedef {import('../entities/entityManager.js').default} EntityManager */

/** @typedef {import('../core/services/gameDataRepository.js').GameDataRepository} GameDataRepository */

/**
 * Manages the definition, availability, and validation logic related to equipment slots.
 * NOW ALSO handles the core state transition logic for equipping and unequipping items,
 * moving items between InventoryComponent and EquipmentComponent, and dispatching
 * the final "event:item_equipped" or "event:item_unequipped" events upon success.
 */
class EquipmentSlotSystem {
    #eventBus;
    #entityManager;
    #repository; // Renamed from gameDataRepository

    constructor({eventBus, entityManager, gameDataRepository}) { // Updated param name
        if (!eventBus || !entityManager || !gameDataRepository) { // Updated check
            throw new Error("EquipmentSlotSystem requires eventBus, entityManager, and gameDataRepository."); // Updated error
        }
        this.#eventBus = eventBus;
        this.#entityManager = entityManager;
        this.#repository = gameDataRepository; // Updated assignment
        console.log("EquipmentSlotSystem instance created.");
    }

    /**
     * Initializes the system. Subscribes to equip/unequip attempt events.
     * Called by the GameEngine during startup.
     */
    initialize() {
        // **** NEW: Subscribe to attempt events ****
        this.#eventBus.subscribe("event:item_equip_attempted", this.handleItemEquipAttempted.bind(this));
        this.#eventBus.subscribe("event:item_unequip_attempted", this.handleItemUnequipAttempted.bind(this));
        console.log("EquipmentSlotSystem initialized and subscribed to events: item_equip_attempted, item_unequip_attempted.");
    }

    // --- Core State Transition Handlers (Moved from EquipmentSystem) ---

    /**
     * Handler: Coordinates the actual state changes for an equip attempt.
     * Moves item from inventory to equipment slot. Dispatches final event/messages.
     * @param {{ playerEntity: Entity, itemInstanceToEquip: Entity, targetSlotId: string }} eventData
     */
    handleItemEquipAttempted(eventData) {
        // **** LOGIC COPIED FROM EquipmentSystem.handleItemEquipAttempted ****
        const {playerEntity, itemInstanceToEquip, targetSlotId} = eventData;
        const itemIdToEquip = itemInstanceToEquip.id;
        const itemDisplayName = getDisplayName(itemInstanceToEquip); // For messages

        if (!playerEntity || !itemInstanceToEquip || !targetSlotId) {
            console.error("EquipmentSlotSystem (Equip Attempt): Invalid eventData received:", eventData);
            this.#eventBus.dispatch("event:display_message", {text: TARGET_MESSAGES.INTERNAL_ERROR, type: 'error'});
            return;
        }
        console.log(`EquipmentSlotSystem (Equip Attempt): Handling attempt for player ${playerEntity.id}, item ${itemIdToEquip} into slot ${targetSlotId}`); // **** Prefix updated ****


        const playerInventory = playerEntity.getComponent(InventoryComponent);
        const playerEquipment = playerEntity.getComponent(EquipmentComponent);

        // --- Sanity Check: Ensure components still exist ---
        if (!playerInventory || !playerEquipment) {
            console.error(`EquipmentSlotSystem (Equip Attempt): Player ${playerEntity.id} missing Inventory or Equipment component during equip attempt.`); // **** Prefix updated ****
            this.#eventBus.dispatch("event:display_message", {
                text: TARGET_MESSAGES.INTERNAL_ERROR_COMPONENT('Inventory/Equipment'),
                type: 'error'
            });
            return;
        }

        // --- Step 1: Remove item from Inventory ---
        const removedFromInv = playerInventory.removeItem(itemIdToEquip);
        if (!removedFromInv) {
            const errorMsg = `${TARGET_MESSAGES.INTERNAL_ERROR} (Item ${itemDisplayName} not found in inventory during equip attempt)`;
            console.warn(`EquipmentSlotSystem (Equip Attempt): Failed to remove item ${itemIdToEquip} (${itemDisplayName}) from ${playerEntity.id}'s inventory. It might have been removed between validation and execution.`); // **** Prefix updated ****
            this.#eventBus.dispatch("event:display_message", {text: errorMsg, type: 'error'});
            return;
        }
        console.log(`EquipmentSlotSystem (Equip Attempt): Removed ${itemIdToEquip} from inventory of ${playerEntity.id}.`); // **** Prefix updated ****

        // --- Step 2: Add item to Equipment slot ---
        const equipped = playerEquipment.equipItem(targetSlotId, itemIdToEquip);
        if (!equipped) {
            const errorMsg = `${TARGET_MESSAGES.INTERNAL_ERROR} (Failed to equip ${itemDisplayName} into slot ${targetSlotId})`;
            console.error(`EquipmentSlotSystem (Equip Attempt): equipItem failed for ${itemIdToEquip} into ${targetSlotId} on ${playerEntity.id}.`); // **** Prefix updated ****

            // *** ROLLBACK: Attempt to add the item back to inventory ***
            console.warn(`EquipmentSlotSystem (Equip Attempt): Rolling back inventory removal for ${itemIdToEquip}.`); // **** Prefix updated ****
            playerInventory.addItem(itemIdToEquip);

            this.#eventBus.dispatch("event:display_message", {text: errorMsg, type: 'error'});
            return;
        }
        console.log(`EquipmentSlotSystem (Equip Attempt): Equipped ${itemIdToEquip} to ${targetSlotId} for ${playerEntity.id}.`); // **** Prefix updated ****

        // --- Step 3: Success - Dispatch final event and UI message ---
        const successMsg = `You equip the ${itemDisplayName}.`;
        this.#eventBus.dispatch("event:display_message", {text: successMsg, type: 'success'});

        try {
            // Dispatch the final 'equipped' event for other systems (like EquipmentEffectSystem)
            this.#eventBus.dispatch("event:item_equipped", {
                entity: playerEntity,
                itemId: itemIdToEquip,
                slotId: targetSlotId,
                itemInstance: itemInstanceToEquip // Pass instance if needed downstream
            });
            console.log(`EquipmentSlotSystem (Equip Attempt): Dispatched ${"event:item_equipped"} for ${itemIdToEquip}.`); // **** Prefix updated ****
        } catch (e) {
            console.error("EquipmentSlotSystem (Equip Attempt): Failed to dispatch item_equipped event:", e); // **** Prefix updated ****
            this.#eventBus.dispatch("event:display_message", {
                text: `${TARGET_MESSAGES.INTERNAL_ERROR} (Equipped, but failed final notification)`,
                type: 'warning'
            });
        }
    }

    /**
     * Handler: Coordinates the actual state changes for an unequip attempt.
     * Moves item from equipment slot to inventory. Dispatches final event/messages.
     * @param {{ playerEntity: Entity, itemInstanceToUnequip: Entity, slotIdToUnequip: string }} eventData
     */
    handleItemUnequipAttempted(eventData) {
        // **** LOGIC COPIED FROM EquipmentSystem.handleItemUnequipAttempted ****
        const {playerEntity, itemInstanceToUnequip, slotIdToUnequip} = eventData;
        const itemIdToUnequip = itemInstanceToUnequip.id;
        const itemDisplayName = getDisplayName(itemInstanceToUnequip); // For messages

        if (!playerEntity || !itemInstanceToUnequip || !slotIdToUnequip) {
            console.error("EquipmentSlotSystem (Unequip Attempt): Invalid eventData received:", eventData); // **** Prefix updated ****
            this.#eventBus.dispatch("event:display_message", {text: TARGET_MESSAGES.INTERNAL_ERROR, type: 'error'});
            return;
        }
        console.log(`EquipmentSlotSystem (Unequip Attempt): Handling attempt for player ${playerEntity.id}, item ${itemIdToUnequip} from slot ${slotIdToUnequip}`); // **** Prefix updated ****


        const playerInventory = playerEntity.getComponent(InventoryComponent);
        const playerEquipment = playerEntity.getComponent(EquipmentComponent);

        // --- Sanity Check: Ensure components still exist ---
        if (!playerInventory || !playerEquipment) {
            console.error(`EquipmentSlotSystem (Unequip Attempt): Player ${playerEntity.id} missing Inventory or Equipment component during unequip attempt.`); // **** Prefix updated ****
            this.#eventBus.dispatch("event:display_message", {
                text: TARGET_MESSAGES.INTERNAL_ERROR_COMPONENT('Inventory/Equipment'),
                type: 'error'
            });
            return;
        }

        // --- Step 1: Remove item from Equipment slot ---
        const actuallyUnequippedId = playerEquipment.unequipItem(slotIdToUnequip);

        // --- Consistency Check: Did we unequip the expected item? ---
        // NOTE: Rollback here is tricky. If unequipItem failed internally or returned wrong ID, the state might be inconsistent.
        // Adding the item back might duplicate it if it *was* unequipped but returned null.
        // For now, we log error and stop. More robust state recovery could be added later.
        if (actuallyUnequippedId !== itemIdToUnequip) {
            const errorMsg = `${TARGET_MESSAGES.INTERNAL_ERROR} (Failed to unequip ${itemDisplayName} correctly)`;
            console.error(`EquipmentSlotSystem (Unequip Attempt): unequipItem inconsistency for slot ${slotIdToUnequip}. Expected ${itemIdToUnequip}, got ${actuallyUnequippedId}. Item: '${itemDisplayName}'. State might be inconsistent.`); // **** Prefix updated ****
            this.#eventBus.dispatch("event:display_message", {text: errorMsg, type: 'error'});
            // Consider if a forced state check/reset is needed here in a real scenario.
            return;
        }
        console.log(`EquipmentSlotSystem (Unequip Attempt): Removed ${itemIdToUnequip} from slot ${slotIdToUnequip} for ${playerEntity.id}.`); // **** Prefix updated ****

        // --- Step 2: Add item back to Inventory ---
        // If this fails (e.g., inventory full in a future implementation), we have an issue.
        // For now, assume InventoryComponent.addItem always succeeds.
        playerInventory.addItem(itemIdToUnequip);
        console.log(`EquipmentSlotSystem (Unequip Attempt): Added ${itemIdToUnequip} to inventory of ${playerEntity.id}.`); // **** Prefix updated ****


        // --- Step 3: Success - Dispatch final event and UI message ---
        const successMsg = `You unequip the ${itemDisplayName}.`;
        this.#eventBus.dispatch("event:display_message", {text: successMsg, type: 'success'});

        try {
            // Dispatch the final 'unequipped' event for other systems (like EquipmentEffectSystem)
            this.#eventBus.dispatch("event:item_unequipped", {
                entity: playerEntity,
                itemId: itemIdToUnequip,
                slotId: slotIdToUnequip,
                itemInstance: itemInstanceToUnequip // Pass instance if needed downstream
            });
            console.log(`EquipmentSlotSystem (Unequip Attempt): Dispatched ${"event:item_unequipped"} for ${itemIdToUnequip}.`); // **** Prefix updated ****
        } catch (e) {
            console.error("EquipmentSlotSystem (Unequip Attempt): Failed to dispatch item_unequipped event:", e); // **** Prefix updated ****
            this.#eventBus.dispatch("event:display_message", {
                text: `${TARGET_MESSAGES.INTERNAL_ERROR} (Unequipped, but failed final notification)`,
                type: 'warning'
            });
        }
    }


    // --- Existing Foundational Methods (Keep as placeholders or implement later) ---

    /**
     * Gets the defined equipment slots for a given entity type or instance.
     * @param {string} entityIdOrDefinitionId
     * @returns {Record<string, any> | null} // Structure TBD
     */
    getEntitySlots(entityIdOrDefinitionId) {
        console.warn(`EquipmentSlotSystem.getEntitySlots not implemented yet for ${entityIdOrDefinitionId}.`);
        // Future: Lookup based on entity components or data definitions
        return null;
    }

    /**
     * Checks if a specific slot exists for an entity.
     * @param {string} entityId
     * @param {string} slotId
     * @returns {boolean}
     */
    hasSlot(entityId, slotId) {
        console.warn(`EquipmentSlotSystem.hasSlot not implemented yet for entity ${entityId}, slot ${slotId}.`);
        // Future implementation: Should check entity's EquipmentComponent or definition
        const entity = this.entityManager.getEntityInstance(entityId);
        const eqComp = entity?.getComponent(EquipmentComponent);
        if (eqComp) {
            return eqComp.hasSlot(slotId); // Delegate if possible
        }
        // Fallback or definition check needed here
        return false; // Placeholder
    }

    /**
     * Validates if an item can potentially be equipped in a specific slot based on rules.
     * NOTE: This validation logic likely belongs *before* the *_attempted event is fired,
     * perhaps within the action handler (e.g., equipActionHandler) using this system's methods.
     * Or, this system could listen to a *pre-validation* event.
     * For now, it remains a placeholder.
     * @param {string} itemId
     * @param {string} slotId
     * @param {string} entityId
     * @returns {boolean}
     */
    canItemGoInSlot(itemId, slotId, entityId) {
        console.warn(`EquipmentSlotSystem.canItemGoInSlot not implemented yet for item ${itemId}, slot ${slotId}, entity ${entityId}.`);
        // Future implementation: Check item's Equippable component rules vs slot properties
        return false; // Placeholder
    }
}

// Export the class as the default export
export default EquipmentSlotSystem;