// src/actions/handlers/unequipActionHandler.js
import {InventoryComponent} from '../../components/inventoryComponent.js';
import {EquipmentComponent} from '../../components/equipmentComponent.js';
import {NameComponent} from '../../components/nameComponent.js';

/** @typedef {import('../actionTypes.js').ActionContext} ActionContext */
/** @typedef {import('../actionTypes.js').ActionResult} ActionResult */

export function executeUnequip(context) {
    const {playerEntity, targets, entityManager, dispatch} = context;
    const messages = [];
    let success = false;

    if (targets.length === 0) {
        dispatch('ui:message_display', {text: "Unequip what (item name or slot name)?", type: 'error'});
        return {success: false, messages: [{text: "Unequip what?", type: 'error'}], newState: undefined};
    }

    const targetName = targets.join(' ').toLowerCase();

    const playerInventory = playerEntity.getComponent(InventoryComponent);
    const playerEquipment = playerEntity.getComponent(EquipmentComponent);

    if (!playerInventory || !playerEquipment) {
        const errorMsg = "(Internal Error: Player is missing inventory or equipment capability.)";
        dispatch('ui:message_display', {text: errorMsg, type: 'error'});
        console.error("executeUnequip: Player entity missing InventoryComponent or EquipmentComponent.");
        return {success: false, messages: [{text: errorMsg, type: 'error'}], newState: undefined};
    }

    let slotIdToUnequip = null;
    let itemIdToUnequip = null;
    let itemDisplayName = targetName; // Fallback

    // Strategy:
    // 1. Check if targetName matches a SLOT ID directly (e.g., "unequip head").
    // 2. If not, check if targetName matches the NAME of an EQUIPPED item.

    const potentialSlotId = `core:slot_${targetName}`; // Simple convention check
    if (playerEquipment.hasSlot(potentialSlotId)) {
        itemIdToUnequip = playerEquipment.getEquippedItem(potentialSlotId);
        if (itemIdToUnequip) {
            slotIdToUnequip = potentialSlotId;
        } else {
            const errorMsg = `You have nothing equipped in your ${targetName} slot.`;
            dispatch('ui:message_display', {text: errorMsg, type: 'warning'});
            return {success: false, messages: [{text: errorMsg, type: 'warning'}], newState: undefined};
        }
    } else {
        // Check if targetName matches an equipped item's name
        const equippedItems = playerEquipment.getAllEquipped();
        for (const slotId in equippedItems) {
            const currentItemId = equippedItems[slotId];
            if (currentItemId) {
                const itemInstance = entityManager.getEntityInstance(currentItemId);
                const nameComp = itemInstance?.getComponent(NameComponent);
                if (nameComp && nameComp.value.toLowerCase() === targetName) {
                    itemIdToUnequip = currentItemId;
                    slotIdToUnequip = slotId;
                    break;
                }
            }
        }
    }

    if (!itemIdToUnequip || !slotIdToUnequip) {
        const errorMsg = `You don't have '${targetName}' equipped.`;
        dispatch('ui:message_display', {text: errorMsg, type: 'warning'});
        return {success: false, messages: [{text: errorMsg, type: 'warning'}], newState: undefined};
    }

    // Get display name for messages
    const itemInstance = entityManager.getEntityInstance(itemIdToUnequip);
    itemDisplayName = itemInstance?.getComponent(NameComponent)?.value ?? itemIdToUnequip;

    // --- Perform the unequip ---
    // Note: Inventory space check skipped for simplicity now

    const actuallyUnequippedId = playerEquipment.unequipItem(slotIdToUnequip);

    if (actuallyUnequippedId !== itemIdToUnequip) {
        // Should not happen if logic above is correct
        const errorMsg = `(Internal Error: Failed to unequip ${itemDisplayName} from slot ${slotIdToUnequip}.)`;
        dispatch('ui:message_display', {text: errorMsg, type: 'error'});
        console.error(`executeUnequip: unequipItem inconsistency for slot ${slotIdToUnequip}. Expected ${itemIdToUnequip}, got ${actuallyUnequippedId}`);
        // Attempt to revert? Maybe just log and fail.
        if (actuallyUnequippedId) playerEquipment.equipItem(slotIdToUnequip, actuallyUnequippedId); // Try put back wrong item? Risky.
        return {success: false, messages: [{text: errorMsg, type: 'error'}], newState: undefined};
    }

    playerInventory.addItem(itemIdToUnequip); // Add back to inventory

    success = true;
    const successMsg = `You unequip the ${itemDisplayName}.`;
    dispatch('ui:message_display', {text: successMsg, type: 'success'});
    messages.push({text: successMsg, type: 'success'});

    // Dispatch the game event
    try {
        dispatch('event:item_unequipped', {
            entity: playerEntity,
            itemId: itemIdToUnequip,
            slotId: slotIdToUnequip
        });
    } catch (e) {
        console.error("Failed to dispatch item_unequipped event:", e);
    }

    return {success, messages, newState: undefined};
}