// src/systems/equipmentSystem.js

import {StatsComponent} from '../components/statsComponent.js';
import {InventoryComponent} from '../components/inventoryComponent.js';
import {EquipmentComponent} from '../components/equipmentComponent.js';
import {getDisplayName, TARGET_MESSAGES} from "../utils/messages.js";
import {
    EVENT_ITEM_EQUIP_ATTEMPTED,
    EVENT_ITEM_EQUIPPED,
    EVENT_ITEM_UNEQUIP_ATTEMPTED,
    EVENT_ITEM_UNEQUIPPED
} from "../types/eventTypes.js";

/** @typedef {import('../core/dataManager.js').default} DataManager */
/** @typedef {import('../entities/entityManager.js').default} EntityManager */
/** @typedef {import('../core/eventBus.js').default} EventBus */
/** @typedef {import('../entities/entity.js').default} Entity */
/** @typedef {import('../components/inventoryComponent').InventoryComponent} InventoryComponentType */

/** @typedef {import('../components/equipmentComponent').EquipmentComponent} EquipmentComponentType */

/**
 * Handles applying/removing effects from equipped items AND
 * coordinates the state changes for equipping/unequipping attempts.
 * Listens for EVENT_ITEM_EQUIP_ATTEMPTED, EVENT_ITEM_UNEQUIP_ATTEMPTED,
 * EVENT_ITEM_EQUIPPED, and EVENT_ITEM_UNEQUIPPED.
 */
class EquipmentSystem {
    /**
     * @param {{eventBus: EventBus, entityManager: EntityManager, dataManager: DataManager}} options
     */
    constructor({eventBus, entityManager, dataManager}) {
        if (!eventBus || !entityManager || !dataManager) {
            throw new Error("EquipmentSystem requires eventBus, entityManager, and dataManager.");
        }
        this.eventBus = eventBus;
        this.entityManager = entityManager;
        this.dataManager = dataManager;
        console.log("EquipmentSystem initialized.");
    }

    /**
     * Subscribes to relevant events. Call this after instantiation.
     */
    initialize() {
        this.eventBus.subscribe(EVENT_ITEM_EQUIP_ATTEMPTED, this.handleItemEquipAttempted.bind(this));
        this.eventBus.subscribe(EVENT_ITEM_UNEQUIP_ATTEMPTED, this.handleItemUnequipAttempted.bind(this));
        this.eventBus.subscribe(EVENT_ITEM_EQUIPPED, this.handleItemEquipped.bind(this));
        this.eventBus.subscribe(EVENT_ITEM_UNEQUIPPED, this.handleItemUnequipped.bind(this)); // Keep for effect removal
        console.log("EquipmentSystem subscribed to events: item_equip_attempted, item_unequip_attempted, item_equipped, item_unequipped.");
    }

    /**
     * Coordinates the actual state changes for an unequip attempt.
     * @param {{ playerEntity: Entity, itemInstanceToUnequip: Entity, slotIdToUnequip: string }} eventData
     */
    handleItemUnequipAttempted(eventData) {
        const {playerEntity, itemInstanceToUnequip, slotIdToUnequip} = eventData;
        const itemIdToUnequip = itemInstanceToUnequip.id;
        const itemDisplayName = getDisplayName(itemInstanceToUnequip); // For messages

        if (!playerEntity || !itemInstanceToUnequip || !slotIdToUnequip) {
            console.error("EquipmentSystem (Unequip Attempt): Invalid eventData received:", eventData);
            this.eventBus.dispatch('ui:message_display', {text: TARGET_MESSAGES.INTERNAL_ERROR, type: 'error'});
            return;
        }
        console.log(`EquipmentSystem (Unequip Attempt): Handling attempt for player ${playerEntity.id}, item ${itemIdToUnequip} from slot ${slotIdToUnequip}`);


        const playerInventory = playerEntity.getComponent(InventoryComponent);
        const playerEquipment = playerEntity.getComponent(EquipmentComponent);

        // --- Sanity Check: Ensure components still exist ---
        if (!playerInventory || !playerEquipment) {
            console.error(`EquipmentSystem (Unequip Attempt): Player ${playerEntity.id} missing Inventory or Equipment component during unequip attempt.`);
            this.eventBus.dispatch('ui:message_display', {
                text: TARGET_MESSAGES.INTERNAL_ERROR_COMPONENT('Inventory/Equipment'),
                type: 'error'
            });
            return;
        }

        // --- Step 1: Remove item from Equipment slot ---
        const actuallyUnequippedId = playerEquipment.unequipItem(slotIdToUnequip);

        // --- Consistency Check: Did we unequip the expected item? ---
        if (actuallyUnequippedId !== itemIdToUnequip) {
            // This could happen if the state changed between validation and execution,
            // or if the slot was already empty (though validation should prevent this).
            const errorMsg = `${TARGET_MESSAGES.INTERNAL_ERROR} (Failed to unequip ${itemDisplayName})`;
            console.error(`EquipmentSystem (Unequip Attempt): unequipItem inconsistency for slot ${slotIdToUnequip}. Expected ${itemIdToUnequip}, got ${actuallyUnequippedId}. Item: '${itemDisplayName}'.`);
            this.eventBus.dispatch('ui:message_display', {text: errorMsg, type: 'error'});
            // Do NOT proceed to add to inventory if unequip failed or was inconsistent.
            return;
        }
        console.log(`EquipmentSystem (Unequip Attempt): Removed ${itemIdToUnequip} from slot ${slotIdToUnequip} for ${playerEntity.id}.`);

        // --- Step 2: Add item back to Inventory ---
        // Assuming addItem doesn't fail in this context (e.g., no capacity limits checked here)
        playerInventory.addItem(itemIdToUnequip);
        console.log(`EquipmentSystem (Unequip Attempt): Added ${itemIdToUnequip} to inventory of ${playerEntity.id}.`);


        // --- Step 3: Success - Dispatch final event and UI message ---
        const successMsg = `You unequip the ${itemDisplayName}.`;
        this.eventBus.dispatch('ui:message_display', {text: successMsg, type: 'success'});

        try {
            // Dispatch the final 'unequipped' event for other systems (like this one, for stats removal)
            this.eventBus.dispatch(EVENT_ITEM_UNEQUIPPED, {
                entity: playerEntity,
                itemId: itemIdToUnequip,
                slotId: slotIdToUnequip,
                itemInstance: itemInstanceToUnequip // Pass instance if needed downstream
            });
        } catch (e) {
            // Log error if event dispatch fails, but state change is already done.
            console.error("EquipmentSystem (Unequip Attempt): Failed to dispatch item_unequipped event:", e);
            this.eventBus.dispatch('ui:message_display', {
                text: `${TARGET_MESSAGES.INTERNAL_ERROR} (Unequipped, but failed final notification)`,
                type: 'warning'
            });
        }
    }

    // --- handleItemEquipAttempted remains the same as provided in the prompt ---
    /**
     * Handler: Coordinates the actual state changes for an equip attempt.
     * @param {{ playerEntity: Entity, itemInstanceToEquip: Entity, targetSlotId: string }} eventData
     */
    handleItemEquipAttempted(eventData) {
        const {playerEntity, itemInstanceToEquip, targetSlotId} = eventData;
        const itemIdToEquip = itemInstanceToEquip.id;
        const itemDisplayName = getDisplayName(itemInstanceToEquip); // For messages

        if (!playerEntity || !itemInstanceToEquip || !targetSlotId) {
            console.error("EquipmentSystem (Equip Attempt): Invalid eventData received:", eventData);
            this.eventBus.dispatch('ui:message_display', {text: TARGET_MESSAGES.INTERNAL_ERROR, type: 'error'});
            return;
        }

        const playerInventory = playerEntity.getComponent(InventoryComponent);
        const playerEquipment = playerEntity.getComponent(EquipmentComponent);

        // --- Sanity Check: Ensure components still exist ---
        if (!playerInventory || !playerEquipment) {
            console.error(`EquipmentSystem (Equip Attempt): Player ${playerEntity.id} missing Inventory or Equipment component during equip attempt.`);
            this.eventBus.dispatch('ui:message_display', {
                text: TARGET_MESSAGES.INTERNAL_ERROR_COMPONENT('Inventory/Equipment'),
                type: 'error'
            });
            return;
        }

        // --- Step 1: Remove item from Inventory ---
        const removedFromInv = playerInventory.removeItem(itemIdToEquip);
        if (!removedFromInv) {
            const errorMsg = `${TARGET_MESSAGES.INTERNAL_ERROR} (Item ${itemDisplayName} not found in inventory during equip attempt)`;
            console.warn(`EquipmentSystem (Equip Attempt): Failed to remove item ${itemIdToEquip} (${itemDisplayName}) from ${playerEntity.id}'s inventory. It might have been removed between validation and execution.`);
            this.eventBus.dispatch('ui:message_display', {text: errorMsg, type: 'error'});
            return;
        }
        console.log(`EquipmentSystem (Equip Attempt): Removed ${itemIdToEquip} from inventory of ${playerEntity.id}.`);

        // --- Step 2: Add item to Equipment slot ---
        const equipped = playerEquipment.equipItem(targetSlotId, itemIdToEquip);
        if (!equipped) {
            const errorMsg = `${TARGET_MESSAGES.INTERNAL_ERROR} (Failed to equip ${itemDisplayName} into slot ${targetSlotId})`;
            console.error(`EquipmentSystem (Equip Attempt): equipItem failed for ${itemIdToEquip} into ${targetSlotId} on ${playerEntity.id}.`);

            // *** ROLLBACK: Attempt to add the item back to inventory ***
            console.warn(`EquipmentSystem (Equip Attempt): Rolling back inventory removal for ${itemIdToEquip}.`);
            playerInventory.addItem(itemIdToEquip);

            this.eventBus.dispatch('ui:message_display', {text: errorMsg, type: 'error'});
            return;
        }
        console.log(`EquipmentSystem (Equip Attempt): Equipped ${itemIdToEquip} to ${targetSlotId} for ${playerEntity.id}.`);

        // --- Step 3: Success - Dispatch final event and UI message ---
        const successMsg = `You equip the ${itemDisplayName}.`;
        this.eventBus.dispatch('ui:message_display', {text: successMsg, type: 'success'});

        try {
            this.eventBus.dispatch(EVENT_ITEM_EQUIPPED, {
                entity: playerEntity,
                itemId: itemIdToEquip,
                slotId: targetSlotId,
                itemInstance: itemInstanceToEquip
            });
            console.log(`EquipmentSystem (Equip Attempt): Dispatched ${EVENT_ITEM_EQUIPPED} for ${itemIdToEquip}.`);
        } catch (e) {
            console.error("EquipmentSystem (Equip Attempt): Failed to dispatch item_equipped event:", e);
            this.eventBus.dispatch('ui:message_display', {
                text: `${TARGET_MESSAGES.INTERNAL_ERROR} (Equipped, but failed final notification)`,
                type: 'warning'
            });
        }
    }


    // --- handleItemEquipped remains the same ---
    /**
     * Existing Handler: Applies effects when an item is successfully equipped.
     * @param {{entity: Entity, itemId: string, slotId: string, itemInstance?: Entity}} eventData
     */
    handleItemEquipped(eventData) {
        const {entity, itemId} = eventData;
        if (!entity || !itemId) {
            console.warn("EquipmentSystem (Equipped): Invalid eventData received:", eventData);
            return;
        }
        const itemDefinition = this.dataManager.getEntityDefinition(itemId);
        if (!itemDefinition || !itemDefinition.components || !itemDefinition.components.Equippable) {
            if (!itemDefinition) {
                console.warn(`EquipmentSystem (Equipped): Could not find item definition for '${itemId}'.`);
            }
            return; // No effects to apply
        }
        const equippableCompData = itemDefinition.components.Equippable;
        const effects = equippableCompData.equipEffects;
        if (Array.isArray(effects) && effects.length > 0) {
            const statsComp = entity.getComponent(StatsComponent);
            if (statsComp) {
                const modsToAdd = [];
                for (const effect of effects) {
                    if (effect.type === 'stat_mod' && effect.stat && typeof effect.value === 'number') {
                        modsToAdd.push({stat: effect.stat, value: effect.value});
                    } else {
                        console.warn(`EquipmentSystem (Equipped): Unsupported/invalid effect on item '${itemId}':`, effect);
                    }
                }
                if (modsToAdd.length > 0) {
                    statsComp.addModifier(itemId, modsToAdd); // Use itemId as sourceId
                    console.log(`EquipmentSystem (Equipped): Applied ${modsToAdd.length} stat modifier(s) from '${itemId}' to entity '${entity.id}'.`);
                }
            } else {
                console.warn(`EquipmentSystem (Equipped): Entity '${entity.id}' equipped item '${itemId}' with effects, but has no StatsComponent.`);
            }
        }
    }

    // --- handleItemUnequipped remains the same, now triggered by handleItemUnequipAttempted ---
    /**
     * Existing Handler: Removes effects when an item is unequipped.
     * Triggered AFTER the state change is confirmed by handleItemUnequipAttempted.
     * @param {{entity: Entity, itemId: string, slotId: string, itemInstance?: Entity}} eventData
     */
    handleItemUnequipped(eventData) {
        const {entity, itemId} = eventData;
        if (!entity || !itemId) {
            console.warn("EquipmentSystem (Unequipped - Effects): Invalid eventData received:", eventData);
            return;
        }

        const statsComp = entity.getComponent(StatsComponent);
        if (statsComp) {
            const removed = statsComp.removeModifier(itemId); // Use itemId as sourceId
            if (removed) {
                // Attempt to get display name for logging, fallback to ID
                const itemInstance = eventData.itemInstance || this.entityManager.getEntityInstance(itemId);
                const itemDisplayName = itemInstance ? getDisplayName(itemInstance) : itemId;
                console.log(`EquipmentSystem (Unequipped - Effects): Removed stat modifier(s) associated with item '${itemDisplayName}' (${itemId}) from entity '${entity.id}'.`);
            }
        }
        // No UI message needed here usually, the main unequip message was sent already.
    }
}

export default EquipmentSystem;