// src/actions/handlers/unequipActionHandler.js

// Import necessary components and utilities
import {InventoryComponent} from '../../components/inventoryComponent.js';
import {EquipmentComponent} from '../../components/equipmentComponent.js';
import {getDisplayName, TARGET_MESSAGES} from "../../utils/messages.js";
import {resolveTargetEntity} from '../../services/targetResolutionService.js'; // ***** IMPORT NEW SERVICE *****

/** @typedef {import('../actionTypes.js').ActionContext} ActionContext */

/** @typedef {import('../actionTypes.js').ActionResult} ActionResult */
/** @typedef {import('../../src/entities/entity.js').default} Entity */

export function executeUnequip(context) {
    const {playerEntity, targets, entityManager, dispatch} = context;
    const messages = [];
    // let success = false; // Determined later

    if (targets.length === 0) {
        const errorMsg = TARGET_MESSAGES.PROMPT_WHAT('unequip') + " (item name or slot name)";
        dispatch('ui:message_display', {text: errorMsg, type: 'error'});
        return {success: false, messages: [{text: errorMsg, type: 'error'}], newState: undefined};
    }

    const targetName = targets.join(' ');

    const playerInventory = playerEntity.getComponent(InventoryComponent);
    const playerEquipment = playerEntity.getComponent(EquipmentComponent);

    if (!playerInventory || !playerEquipment) {
        const errorMsg = TARGET_MESSAGES.INTERNAL_ERROR_COMPONENT('Inventory/Equipment');
        dispatch('ui:message_display', {text: errorMsg, type: 'error'});
        console.error("executeUnequip: Player entity missing Inventory/Equipment.");
        return {success: false, messages: [{text: errorMsg, type: 'error'}], newState: undefined};
    }

    let slotIdToUnequip = null;
    let itemInstanceToUnequip = null; // The resolved entity instance

    // --- Strategy: Check slot name first, then resolve by item name ---

    // 1. Try matching slot name (remains unchanged)
    const potentialSlotId = `core:slot_${targetName.toLowerCase().replace(/\s+/g, '_')}`;
    if (playerEquipment.hasSlot(potentialSlotId)) {
        const itemIdInSlot = playerEquipment.getEquippedItem(potentialSlotId);
        if (itemIdInSlot) {
            slotIdToUnequip = potentialSlotId;
            itemInstanceToUnequip = entityManager.getEntityInstance(itemIdInSlot);
            if (!itemInstanceToUnequip) {
                console.error(`executeUnequip: Found item ID ${itemIdInSlot} in slot ${slotIdToUnequip} but instance is missing!`);
                const errorMsg = TARGET_MESSAGES.INTERNAL_ERROR + " (Equipped item instance missing)";
                dispatch('ui:message_display', {text: errorMsg, type: 'error'});
                return {success: false, messages: [{text: errorMsg, type: 'error'}], newState: undefined};
            }
            console.debug(`executeUnequip: Matched slot name '${targetName}' to slot ${slotIdToUnequip}`);
        } else {
            const errorMsg = TARGET_MESSAGES.UNEQUIP_SLOT_EMPTY(targetName);
            dispatch('ui:message_display', {text: errorMsg, type: 'warning'});
            return {success: false, messages: [{text: errorMsg, type: 'warning'}], newState: undefined};
        }
    } else {
        // --- 2. If not a slot name, Resolve Target Item by Name using Service ---
        console.debug(`executeUnequip: '${targetName}' not a direct slot match, resolving equipped item name.`);

        itemInstanceToUnequip = resolveTargetEntity(context, {
            scope: 'equipment',
            requiredComponents: [], // Just NameComponent implicitly needed
            actionVerb: 'unequip',
            targetName: targetName,
            notFoundMessageKey: 'NOT_FOUND_UNEQUIPPABLE', // Specific message
            // emptyScopeMessage: "You have nothing equipped.", // Custom empty message
        });

        // --- Handle Resolver Result ---
        if (!itemInstanceToUnequip) {
            // Failure message dispatched by resolver
            return {success: false, messages, newState: undefined};
        }

        // --- Find the Slot for the Resolved Item ---
        const equippedItemsMap = playerEquipment.getAllEquipped();
        slotIdToUnequip = Object.keys(equippedItemsMap).find(slotId => equippedItemsMap[slotId] === itemInstanceToUnequip.id);

        if (!slotIdToUnequip) {
            // Should not happen if resolver found item in 'equipment' scope
            console.error(`executeUnequip: Found unique item ${itemInstanceToUnequip.id} by name but couldn't find its slot!`);
            const errorMsg = TARGET_MESSAGES.INTERNAL_ERROR + " (Cannot find resolved item's slot)";
            dispatch('ui:message_display', {text: errorMsg, type: 'error'});
            return {success: false, messages: [{text: errorMsg, type: 'error'}], newState: undefined};
        }
        console.debug(`executeUnequip: Matched item name '${targetName}' to item ${itemInstanceToUnequip.id} in slot ${slotIdToUnequip}`);
    }


    // --- 3. Perform the Unequip ---
    // (itemInstanceToUnequip and slotIdToUnequip are now guaranteed to be set if we reach here)
    const itemIdToUnequip = itemInstanceToUnequip.id;
    const itemDisplayName = getDisplayName(itemInstanceToUnequip);

    // Inventory space check could be added here if needed

    const actuallyUnequippedId = playerEquipment.unequipItem(slotIdToUnequip);

    // Verification check
    if (actuallyUnequippedId !== itemIdToUnequip) {
        const errorMsg = `(Internal Error: Failed to unequip ${itemDisplayName} from slot ${slotIdToUnequip}. Mismatch detected.)`;
        dispatch('ui:message_display', {text: errorMsg, type: 'error'});
        console.error(`executeUnequip: unequipItem inconsistency for slot ${slotIdToUnequip}. Expected ${itemIdToUnequip}, got ${actuallyUnequippedId}`);
        return {success: false, messages: [{text: errorMsg, type: 'error'}], newState: undefined};
    }
    messages.push({text: `Unequipped ${itemIdToUnequip} from ${slotIdToUnequip}`, type: "internal"});


    // Add back to inventory *after* successful removal from equipment
    playerInventory.addItem(itemIdToUnequip);
    messages.push({text: `Added ${itemIdToUnequip} to inventory`, type: "internal"});


    let success = true;
    const successMsg = `You unequip the ${itemDisplayName}.`;
    dispatch('ui:message_display', {text: successMsg, type: 'success'});
    messages.push({text: successMsg, type: 'success'});

    // Dispatch the game event
    try {
        dispatch('event:item_unequipped', {
            entity: playerEntity,
            itemId: itemIdToUnequip,
            slotId: slotIdToUnequip,
            itemInstance: itemInstanceToUnequip // Pass instance if useful
        });
        messages.push({text: `Dispatched event:item_unequipped for ${itemIdToUnequip}`, type: "internal"});
    } catch (e) {
        console.error("Failed to dispatch item_unequipped event:", e);
        messages.push({text: "Internal warning: Failed to dispatch item_unequipped event.", type: 'warning'});
    }

    return {success, messages, newState: undefined};
}