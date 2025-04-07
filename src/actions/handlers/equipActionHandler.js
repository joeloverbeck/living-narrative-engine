// src/actions/handlers/equipActionHandler.js
import {InventoryComponent} from '../../components/inventoryComponent.js';
import {EquipmentComponent} from '../../components/equipmentComponent.js';
import {ItemComponent} from '../../components/itemComponent.js'; // May not be needed if reading from definition
import {NameComponent} from '../../components/nameComponent.js';

/** @typedef {import('../actionTypes.js').ActionContext} ActionContext */
/** @typedef {import('../actionTypes.js').ActionResult} ActionResult */

export function executeEquip(context) {
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
        const errorMsg = "(Internal Error: Player is missing inventory or equipment capability.)";
        dispatch('ui:message_display', {text: errorMsg, type: 'error'});
        console.error("executeEquip: Player entity missing InventoryComponent or EquipmentComponent.");
        return {success: false, messages: [{text: errorMsg, type: 'error'}], newState: undefined};
    }

    // Find the item ID in inventory matching the name
    let itemIdToEquip = null;
    let itemDisplayName = targetItemName; // Fallback
    const inventoryItems = playerInventory.getItems(); // Get a copy

    for (const itemId of inventoryItems) {
        const itemInstance = entityManager.getEntityInstance(itemId); // Get instance for name
        if (itemInstance) {
            const nameComp = itemInstance.getComponent(NameComponent);
            if (nameComp && nameComp.value.toLowerCase() === targetItemName) {
                itemIdToEquip = itemId;
                itemDisplayName = nameComp.value; // Use proper name for messages
                break;
            }
        } else {
            console.warn(`executeEquip: Inventory contains ID '${itemId}' but instance not found.`);
        }
    }

    if (!itemIdToEquip) {
        const errorMsg = `You don't have a '${targetItemName}' to equip.`;
        dispatch('ui:message_display', {text: errorMsg, type: 'error'});
        return {success: false, messages: [{text: errorMsg, type: 'error'}], newState: undefined};
    }

    // Get item definition to check if equippable and find slot
    const itemDefinition = dataManager.getEntityDefinition(itemIdToEquip);
    if (!itemDefinition || !itemDefinition.components || !itemDefinition.components.Item) {
        const errorMsg = `(Internal Error: Cannot find definition for item '${itemIdToEquip}')`;
        dispatch('ui:message_display', {text: errorMsg, type: 'error'});
        console.error(`executeEquip: Failed to get definition for item ID: ${itemIdToEquip}`);
        return {success: false, messages: [{text: errorMsg, type: 'error'}], newState: undefined};
    }

    const itemCompData = itemDefinition.components.Item;
    const targetSlotId = itemCompData.equipSlot;

    if (!targetSlotId) {
        const errorMsg = `You cannot equip the ${itemDisplayName}.`;
        dispatch('ui:message_display', {text: errorMsg, type: 'warning'});
        return {success: false, messages: [{text: errorMsg, type: 'warning'}], newState: undefined};
    }

    // Check if the player *has* that slot defined in their EquipmentComponent
    if (!playerEquipment.hasSlot(targetSlotId)) {
        const errorMsg = `You don't have a slot to equip the ${itemDisplayName} (${targetSlotId}).`;
        dispatch('ui:message_display', {text: errorMsg, type: 'error'});
        console.error(`executeEquip: Player tried to equip to slot '${targetSlotId}' but component doesn't define it.`);
        return {success: false, messages: [{text: errorMsg, type: 'error'}], newState: undefined};
    }

    // Check if the slot is already occupied
    const currentItemInSlot = playerEquipment.getEquippedItem(targetSlotId);
    if (currentItemInSlot !== null) {
        const currentItemInstance = entityManager.getEntityInstance(currentItemInSlot);
        const currentItemName = currentItemInstance?.getComponent(NameComponent)?.value ?? 'something';
        const errorMsg = `You need to unequip the ${currentItemName} from your ${targetSlotId.split(':').pop()} slot first.`;
        dispatch('ui:message_display', {text: errorMsg, type: 'warning'});
        return {success: false, messages: [{text: errorMsg, type: 'warning'}], newState: undefined};
    }

    // --- All checks passed, perform the equip ---
    const removedFromInv = playerInventory.removeItem(itemIdToEquip);
    if (!removedFromInv) {
        // Should not happen if checks above worked, but good safeguard
        const errorMsg = `(Internal Error: Failed to remove ${itemDisplayName} from inventory.)`;
        dispatch('ui:message_display', {text: errorMsg, type: 'error'});
        console.error(`executeEquip: removeItem failed for ${itemIdToEquip} despite checks.`);
        return {success: false, messages: [{text: errorMsg, type: 'error'}], newState: undefined};
    }

    const equipped = playerEquipment.equipItem(targetSlotId, itemIdToEquip);
    if (!equipped) {
        // Should not happen, safeguard
        const errorMsg = `(Internal Error: Failed to place ${itemDisplayName} into slot ${targetSlotId}.)`;
        dispatch('ui:message_display', {text: errorMsg, type: 'error'});
        console.error(`executeEquip: equipItem failed for ${itemIdToEquip} into ${targetSlotId}.`);
        // Attempt to put item back? Complex recovery. Log and fail for now.
        playerInventory.addItem(itemIdToEquip); // Try to revert inventory change
        return {success: false, messages: [{text: errorMsg, type: 'error'}], newState: undefined};
    }

    success = true;
    const successMsg = `You equip the ${itemDisplayName}.`;
    dispatch('ui:message_display', {text: successMsg, type: 'success'});
    messages.push({text: successMsg, type: 'success'});

    // Dispatch the game event
    try {
        dispatch('event:item_equipped', {
            entity: playerEntity,
            itemId: itemIdToEquip,
            slotId: targetSlotId
        });
    } catch (e) {
        console.error("Failed to dispatch item_equipped event:", e);
    }


    return {success, messages, newState: undefined};
}