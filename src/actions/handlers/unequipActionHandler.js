// src/actions/handlers/unequipActionHandler.js

import {InventoryComponent} from '../../components/inventoryComponent.js';
import {EquipmentComponent} from '../../components/equipmentComponent.js';
import {getDisplayName, TARGET_MESSAGES} from '../../utils/messages.js';
import {resolveTargetEntity} from '../../services/entityFinderService.js';
import {validateRequiredCommandPart} from '../../utils/actionValidationUtils.js';

/** @typedef {import('../actionTypes.js').ActionContext} ActionContext */

/** @typedef {import('../actionTypes.js').ActionResult} ActionResult */
/** @typedef {import('../../entities/entity.js').default} Entity */

export function executeUnequip(context) {
    // --- Refactor: Destructure parsedCommand, remove targets ---
    const {playerEntity, entityManager, dispatch, parsedCommand} = context;
    const messages = []; // For internal/debug messages returned by the handler

    // --- Validate required command part (uses parsedCommand.directObjectPhrase implicitly) ---
    // Acceptance Criterion 1: validateRequiredCommandPart uses 'directObjectPhrase'
    if (!validateRequiredCommandPart(context, 'unequip', 'directObjectPhrase')) { // [cite: file:handlers/unequipActionHandler.js]
        return {success: false, messages: [], newState: undefined}; // Validation failed, message dispatched by utility
    }

    // --- Refactor: Get target name from parsedCommand ---
    // Acceptance Criterion 2: Variable assigned from context.parsedCommand.directObjectPhrase
    // Acceptance Criterion 4: Code no longer accesses context.targets
    const targetName = parsedCommand.directObjectPhrase; // Could be slot name or item name

    const playerInventory = playerEntity.getComponent(InventoryComponent);
    const playerEquipment = playerEntity.getComponent(EquipmentComponent);

    // --- Internal Error: Missing Essential Components ---
    if (!playerInventory || !playerEquipment) {
        const errorMsg = TARGET_MESSAGES.INTERNAL_ERROR_COMPONENT('Inventory/Equipment');
        dispatch('ui:message_display', {text: errorMsg, type: 'error'});
        console.error("unequipActionHandler: Player entity missing Inventory/Equipment components.");
        return {success: false, messages: [{text: errorMsg, type: 'error'}], newState: undefined};
    }

    let slotIdToUnequip = null;
    let itemInstanceToUnequip = null; // The resolved entity instance

    // --- Strategy: Check slot name first, then resolve by item name ---

    // 1. Try matching slot name
    // Acceptance Criterion 3: Subsequent logic uses the new targetName variable
    const potentialSlotId = `core:slot_${targetName.toLowerCase().replace(/\s+/g, '_')}`;
    if (playerEquipment.hasSlot(potentialSlotId)) {
        const itemIdInSlot = playerEquipment.getEquippedItem(potentialSlotId);
        if (itemIdInSlot) {
            // Found an item in the explicitly named slot
            slotIdToUnequip = potentialSlotId;
            itemInstanceToUnequip = entityManager.getEntityInstance(itemIdInSlot);
            // --- Internal Error: Missing Item Instance ---
            if (!itemInstanceToUnequip) {
                console.error(`unequipActionHandler: Found item ID ${itemIdInSlot} in slot ${slotIdToUnequip} but instance is missing!`);
                const errorMsg = TARGET_MESSAGES.INTERNAL_ERROR + " (Equipped item instance missing)";
                dispatch('ui:message_display', {text: errorMsg, type: 'error'});
                return {success: false, messages: [{text: errorMsg, type: 'error'}], newState: undefined};
            }
            console.debug(`unequipActionHandler: Matched slot name '${targetName}' to slot ${slotIdToUnequip}`);
        } else {
            // --- Validation Error: Slot is Empty ---
            // Acceptance Criterion 3: Subsequent logic uses the new targetName variable
            const errorMsg = TARGET_MESSAGES.UNEQUIP_SLOT_EMPTY(targetName); // Pass the user-provided slot name
            dispatch('ui:message_display', {text: errorMsg, type: 'warning'});
            return {success: false, messages: [{text: errorMsg, type: 'warning'}], newState: undefined};
        }
    } else {
        // --- 2. If not a slot name, Resolve Target Item by Name using Service ---
        // Acceptance Criterion 3: Subsequent logic uses the new targetName variable
        console.debug(`unequipActionHandler: '${targetName}' not a direct slot match, resolving equipped item name.`);

        // Acceptance Criterion 3: Subsequent logic uses the new targetName variable
        itemInstanceToUnequip = resolveTargetEntity(context, {
            scope: 'equipment',
            requiredComponents: [],
            actionVerb: 'unequip',
            targetName: targetName, // Use the name from parsedCommand
            notFoundMessageKey: 'NOT_FOUND_UNEQUIPPABLE',
        });

        // --- Handle Resolver Result ---
        if (!itemInstanceToUnequip) {
            // Failure message (not found / ambiguous) was already dispatched by resolveTargetEntity
            // messages array in context might contain details if needed, but we return failure.
            return {success: false, messages: context.messages || [], newState: undefined};
        }

        // --- Find the Slot for the Resolved Item ---
        const equippedItemsMap = playerEquipment.getAllEquipped();
        slotIdToUnequip = Object.keys(equippedItemsMap).find(slotId => equippedItemsMap[slotId] === itemInstanceToUnequip.id);

        // --- Internal Error: Cannot Find Slot for Resolved Item ---
        if (!slotIdToUnequip) {
            console.error(`unequipActionHandler: Found unique item ${itemInstanceToUnequip.id} ('${getDisplayName(itemInstanceToUnequip)}') by name but couldn't find its slot!`);
            const errorMsg = TARGET_MESSAGES.INTERNAL_ERROR + " (Cannot find resolved item's slot)";
            dispatch('ui:message_display', {text: errorMsg, type: 'error'});
            return {success: false, messages: [{text: errorMsg, type: 'error'}], newState: undefined};
        }
        // Acceptance Criterion 3: Subsequent logic uses the new targetName variable
        console.debug(`unequipActionHandler: Matched item name '${targetName}' to item ${itemInstanceToUnequip.id} in slot ${slotIdToUnequip}`);
    }

    // --- 3. Validation Complete - Fire Unequip Attempt Event ---
    // At this point, we have successfully validated the intent and resolved:
    // - playerEntity
    // - itemInstanceToUnequip (the Entity instance)
    // - slotIdToUnequip (the string ID of the slot)

    // Dispatch the new event for Systems to handle the actual state change
    try {
        dispatch('event:item_unequip_attempted', {
            playerEntity: playerEntity,
            itemInstanceToUnequip: itemInstanceToUnequip,
            slotIdToUnequip: slotIdToUnequip
        });
        // Add an internal message indicating the event was fired successfully
        messages.push({
            text: `Dispatched event:item_unequip_attempted for ${itemInstanceToUnequip.id} from ${slotIdToUnequip}`,
            type: "internal"
        });
        console.debug(`unequipActionHandler: Dispatched event:item_unequip_attempted for ${itemInstanceToUnequip.id}`);
    } catch (e) {
        // Log internal error if dispatch fails, but return failure to prevent inconsistent state
        console.error("unequipActionHandler: Failed to dispatch event:item_unequip_attempted:", e);
        const errorMsg = TARGET_MESSAGES.INTERNAL_ERROR + " (Event dispatch failed)";
        dispatch('ui:message_display', {text: errorMsg, type: 'error'});
        messages.push({text: "Internal error: Failed to dispatch item_unequip_attempted event.", type: 'error'});
        return {success: false, messages, newState: undefined};
    }

    // Return success *for the validation phase*. The actual success/failure of the unequip
    // will be communicated by the listening System(s).
    return {success: true, messages, newState: undefined};
}