// src/actions/handlers/unequipActionHandler.js

// --- Standard Imports ---
import {InventoryComponent} from '../../components/inventoryComponent.js';
import {EquipmentComponent} from '../../components/equipmentComponent.js';
import {resolveTargetEntity} from '../../services/entityFinderService.js';
import {validateRequiredCommandPart} from '../../utils/actionValidationUtils.js';
// --- Refactored Imports ---
import {TARGET_MESSAGES, getDisplayName} from '../../utils/messages.js'; // Import TARGET_MESSAGES and getDisplayName


/** @typedef {import('../actionTypes.js').ActionContext} ActionContext */

/** @typedef {import('../actionTypes.js').ActionResult} ActionResult */
/** @typedef {import('../../entities/entity.js').default} Entity */

export function executeUnequip(context) {
    const {playerEntity, entityManager, dispatch, parsedCommand} = context;
    const messages = [];

    // --- Validate required command part ---
    if (!validateRequiredCommandPart(context, 'unequip', 'directObjectPhrase')) {
        return {success: false, messages: [], newState: undefined};
    }

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
    const potentialSlotId = `core:slot_${targetName.toLowerCase().replace(/\s+/g, '_')}`;
    if (playerEquipment.hasSlot(potentialSlotId)) {
        const itemIdInSlot = playerEquipment.getEquippedItem(potentialSlotId);
        if (itemIdInSlot) {
            // Found an item in the explicitly named slot
            slotIdToUnequip = potentialSlotId;
            itemInstanceToUnequip = entityManager.getEntityInstance(itemIdInSlot);
            if (!itemInstanceToUnequip) {
                console.error(`unequipActionHandler: Found item ID ${itemIdInSlot} in slot ${slotIdToUnequip} but instance is missing!`);
                const errorMsg = TARGET_MESSAGES.INTERNAL_ERROR + " (Equipped item instance missing)";
                dispatch('ui:message_display', {text: errorMsg, type: 'error'});
                return {success: false, messages: [{text: errorMsg, type: 'error'}], newState: undefined};
            }
            console.debug(`unequipActionHandler: Matched slot name '${targetName}' to slot ${slotIdToUnequip}`);
            // Proceed to step 3 (Dispatch Event)
        } else {
            // Slot exists but is empty
            const errorMsg = TARGET_MESSAGES.UNEQUIP_SLOT_EMPTY(targetName); // Pass the user-provided slot name
            dispatch('ui:message_display', {text: errorMsg, type: 'warning'});
            messages.push({
                text: `Unequip failed: Slot '${targetName}' (${potentialSlotId}) is empty.`,
                type: 'internal'
            });
            return {success: false, messages: messages, newState: undefined};
        }
    } else {
        // --- 2. If not a slot name, Resolve Target Item by Name using Service ---
        console.debug(`unequipActionHandler: '${targetName}' not a direct slot match, resolving equipped item name.`);
        messages.push({text: `Attempting to resolve equipped item by name: '${targetName}'.`, type: 'internal'});

        // Removed notFoundMessageKey
        const resolution = resolveTargetEntity(context, {
            scope: 'equipment', // Search equipped items
            requiredComponents: [], // Any equipped item matches
            // actionVerb: 'unequip', // Keep for potential use
            targetName: targetName,
        });

        // --- Handle Resolver Result (within else block) ---
        switch (resolution.status) {
            case 'FOUND_UNIQUE':
                itemInstanceToUnequip = resolution.entity;
                // Now find the slot for this resolved item
                const equippedItemsMap = playerEquipment.getAllEquipped();
                slotIdToUnequip = Object.keys(equippedItemsMap).find(slotId => equippedItemsMap[slotId] === itemInstanceToUnequip.id);

                if (!slotIdToUnequip) {
                    console.error(`unequipActionHandler: Found unique item ${itemInstanceToUnequip.id} ('${getDisplayName(itemInstanceToUnequip)}') by name but couldn't find its slot!`);
                    const errorMsg = TARGET_MESSAGES.INTERNAL_ERROR + " (Cannot find resolved item's slot)";
                    dispatch('ui:message_display', {text: errorMsg, type: 'error'});
                    return {success: false, messages: [{text: errorMsg, type: 'error'}], newState: undefined};
                }
                console.debug(`unequipActionHandler: Matched item name '${targetName}' to item ${itemInstanceToUnequip.id} in slot ${slotIdToUnequip}`);
                messages.push({
                    text: `Resolved item name '${targetName}' to ${itemInstanceToUnequip.id} in slot ${slotIdToUnequip}.`,
                    type: 'internal'
                });
                // Proceed to step 3 (Dispatch Event)
                break; // Break from switch, execution continues below

            case 'NOT_FOUND':
                dispatch('ui:message_display', {
                    text: TARGET_MESSAGES.NOT_FOUND_UNEQUIPPABLE(targetName),
                    type: 'info'
                });
                messages.push({
                    text: `Unequip resolution failed for '${targetName}', reason: NOT_FOUND.`,
                    type: 'internal'
                });
                return {success: false, messages: messages, newState: undefined}; // Return directly

            case 'AMBIGUOUS':
                const ambiguousMsg = TARGET_MESSAGES.AMBIGUOUS_PROMPT('unequip', targetName, resolution.candidates);
                dispatch('ui:message_display', {text: ambiguousMsg, type: 'warning'});
                messages.push({
                    text: `Unequip resolution failed for '${targetName}', reason: AMBIGUOUS.`,
                    type: 'internal'
                });
                return {success: false, messages: messages, newState: undefined}; // Return directly

            case 'FILTER_EMPTY':
                // No items equipped at all
                dispatch('ui:message_display', {text: TARGET_MESSAGES.SCOPE_EMPTY_PERSONAL('unequip'), type: 'info'}); // Or a more specific "nothing equipped" message
                messages.push({
                    text: `Unequip resolution failed for '${targetName}', reason: FILTER_EMPTY (Nothing equipped).`,
                    type: 'internal'
                });
                return {success: false, messages: messages, newState: undefined}; // Return directly

            case 'INVALID_INPUT':
                dispatch('ui:message_display', {text: TARGET_MESSAGES.INTERNAL_ERROR, type: 'error'});
                messages.push({
                    text: `Unequip resolution failed for '${targetName}', reason: INVALID_INPUT.`,
                    type: 'internal_error'
                });
                console.error(`executeUnequip: resolveTargetEntity returned INVALID_INPUT for target '${targetName}'. Context/Config issue?`);
                return {success: false, messages: messages, newState: undefined}; // Return directly

            default:
                dispatch('ui:message_display', {text: TARGET_MESSAGES.INTERNAL_ERROR, type: 'error'});
                console.error(`executeUnequip: Unhandled resolution status: ${resolution.status}`);
                messages.push({text: `Unhandled status: ${resolution.status}`, type: 'internal_error'});
                return {success: false, messages: messages, newState: undefined}; // Return directly
        }
        // If switch case was 'FOUND_UNIQUE', execution continues here
    }

    // --- 3. Validation Complete - Fire Unequip Attempt Event ---
    // This block is reached if either:
    // a) Slot name matched an equipped item (itemInstanceToUnequip and slotIdToUnequip are set).
    // b) Item name resolved uniquely to an equipped item (itemInstanceToUnequip and slotIdToUnequip are set).

    if (!itemInstanceToUnequip || !slotIdToUnequip) {
        // Should not happen if logic above is correct, but safety check.
        console.error("unequipActionHandler: Reached dispatch phase but item or slot ID is missing!");
        dispatch('ui:message_display', {text: TARGET_MESSAGES.INTERNAL_ERROR, type: 'error'});
        return {success: false, messages: messages, newState: undefined};
    }

    try {
        dispatch('event:item_unequip_attempted', {
            playerEntity: playerEntity,
            itemInstanceToUnequip: itemInstanceToUnequip,
            slotIdToUnequip: slotIdToUnequip
        });
        messages.push({
            text: `Dispatched event:item_unequip_attempted for ${itemInstanceToUnequip.id} from ${slotIdToUnequip}`,
            type: "internal"
        });
        console.debug(`unequipActionHandler: Dispatched event:item_unequip_attempted for ${itemInstanceToUnequip.id}`);
        return {success: true, messages, newState: undefined}; // Validation and dispatch successful
    } catch (e) {
        // Log internal error if dispatch fails
        console.error("unequipActionHandler: Failed to dispatch event:item_unequip_attempted:", e);
        const errorMsg = TARGET_MESSAGES.INTERNAL_ERROR + " (Event dispatch failed)";
        dispatch('ui:message_display', {text: errorMsg, type: 'error'});
        messages.push({text: "Internal error: Failed to dispatch item_unequip_attempted event.", type: 'error'});
        return {success: false, messages, newState: undefined};
    }
}