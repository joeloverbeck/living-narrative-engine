// src/actions/handlers/equipActionHandler.js

import {InventoryComponent} from '../../components/inventoryComponent.js';
import {EquipmentComponent} from '../../components/equipmentComponent.js';
import {EquippableComponent} from '../../components/equippableComponent.js';
import {NameComponent} from '../../components/nameComponent.js';

/** @typedef {import('../actionTypes.js').ActionContext} ActionContext */
/** @typedef {import('../actionTypes.js').ActionResult} ActionResult */

export function executeEquip(context) {
    // context destructuring remains the same
    const {playerEntity, targets, entityManager, dataManager, dispatch} = context;
    const messages = [];
    let success = false;

    if (targets.length === 0) {
        dispatch('ui:message_display', {text: "Equip what?", type: 'error'});
        return {success: false, messages: [{text: "Equip what?", type: 'error'}], newState: undefined};
    }

    const targetItemName = targets.join(' ').toLowerCase();

    const playerInventory = playerEntity.getComponent(InventoryComponent);
    const playerEquipment = playerEntity.getComponent(EquipmentComponent);

    if (!playerInventory || !playerEquipment) {
        // Error handling remains the same...
        const errorMsg = "(Internal Error: Player is missing inventory or equipment capability.)";
        dispatch('ui:message_display', {text: errorMsg, type: 'error'});
        console.error("executeEquip: Player entity missing InventoryComponent or EquipmentComponent.");
        return {success: false, messages: [{text: errorMsg, type: 'error'}], newState: undefined};
    }

    // Find the item instance in inventory matching the name
    let itemInstanceToEquip = null; // Store the instance now
    let itemIdToEquip = null;
    let itemDisplayName = targetItemName; // Fallback

    const inventoryItems = playerInventory.getItems();

    for (const itemId of inventoryItems) {
        const itemInstance = entityManager.getEntityInstance(itemId);
        if (itemInstance) {
            const nameComp = itemInstance.getComponent(NameComponent);
            if (nameComp && nameComp.value.toLowerCase() === targetItemName) {
                itemInstanceToEquip = itemInstance; // <-- Store the instance
                itemIdToEquip = itemId;
                itemDisplayName = nameComp.value;
                break;
            }
        } else {
            console.warn(`executeEquip: Inventory contains ID '${itemId}' but instance not found.`);
        }
    }

    if (!itemInstanceToEquip) {  // <-- Check for instance now
        const errorMsg = `You don't have a '${targetItemName}' to equip.`;
        dispatch('ui:message_display', {text: errorMsg, type: 'error'});
        return {success: false, messages: [{text: errorMsg, type: 'error'}], newState: undefined};
    }

    // --- NEW: Check if the item INSTANCE has EquippableComponent ---
    const equippableComp = itemInstanceToEquip.getComponent(EquippableComponent);

    if (!equippableComp) {
        const errorMsg = `You cannot equip the ${itemDisplayName}.`;
        dispatch('ui:message_display', {text: errorMsg, type: 'warning'});
        return {success: false, messages: [{text: errorMsg, type: 'warning'}], newState: undefined};
    }

    // --- Get the target slot from the component ---
    const targetSlotId = equippableComp.getSlotId();

    // Check if the player *has* that slot defined in their EquipmentComponent
    if (!playerEquipment.hasSlot(targetSlotId)) {
        const errorMsg = `You don't have a slot to equip the ${itemDisplayName} (${targetSlotId}).`;
        dispatch('ui:message_display', {text: errorMsg, type: 'error'});
        console.error(`executeEquip: Player tried to equip to slot '${targetSlotId}' but component doesn't define it.`);
        return {success: false, messages: [{text: errorMsg, type: 'error'}], newState: undefined};
    }

    // Check if the slot is already occupied (remains the same)
    const currentItemInSlot = playerEquipment.getEquippedItem(targetSlotId);
    if (currentItemInSlot !== null) {
        const currentItemInstance = entityManager.getEntityInstance(currentItemInSlot);
        const currentItemName = currentItemInstance?.getComponent(NameComponent)?.value ?? 'something';
        // Extract user-friendly slot name if possible
        const slotName = targetSlotId.includes(':') ? targetSlotId.split(':').pop() : targetSlotId;
        const errorMsg = `You need to unequip the ${currentItemName} from your ${slotName} slot first.`;
        dispatch('ui:message_display', {text: errorMsg, type: 'warning'});
        return {success: false, messages: [{text: errorMsg, type: 'warning'}], newState: undefined};
    }

    // --- All checks passed, perform the equip ---
    // Logic remains the same, using itemIdToEquip
    const removedFromInv = playerInventory.removeItem(itemIdToEquip);
    if (!removedFromInv) {
        // Safeguard remains the same...
        const errorMsg = `(Internal Error: Failed to remove ${itemDisplayName} from inventory.)`;
        dispatch('ui:message_display', {text: errorMsg, type: 'error'});
        console.error(`executeEquip: removeItem failed for ${itemIdToEquip} despite checks.`);
        return {success: false, messages: [{text: errorMsg, type: 'error'}], newState: undefined};
    }

    const equipped = playerEquipment.equipItem(targetSlotId, itemIdToEquip);
    if (!equipped) {
        // Safeguard remains the same...
        const errorMsg = `(Internal Error: Failed to place ${itemDisplayName} into slot ${targetSlotId}.)`;
        dispatch('ui:message_display', {text: errorMsg, type: 'error'});
        console.error(`executeEquip: equipItem failed for ${itemIdToEquip} into ${targetSlotId}.`);
        playerInventory.addItem(itemIdToEquip); // Try to revert inventory change
        return {success: false, messages: [{text: errorMsg, type: 'error'}], newState: undefined};
    }

    success = true;
    const successMsg = `You equip the ${itemDisplayName}.`;
    dispatch('ui:message_display', {text: successMsg, type: 'success'});
    messages.push({text: successMsg, type: 'success'});

    // Dispatch the game event (remains the same)
    try {
        dispatch('event:item_equipped', {
            entity: playerEntity,
            itemId: itemIdToEquip,
            slotId: targetSlotId
            // Consider passing itemInstanceToEquip if systems prefer instance over ID
            // itemInstance: itemInstanceToEquip
        });
    } catch (e) {
        console.error("Failed to dispatch item_equipped event:", e);
    }


    return {success, messages, newState: undefined};
}