// src/actions/handlers/useActionHandler.js

/** @typedef {import('../actionTypes.js').ActionContext} ActionContext */
/** @typedef {import('../actionTypes.js').ActionResult} ActionResult */
/** @typedef {import('../../components/inventoryComponent.js').InventoryComponent} InventoryComponent */
/** @typedef {import('../../components/healthComponent.js').HealthComponent} HealthComponent */
/** @typedef {import('../../components/usableComponent.js').UsableComponent} UsableComponent */

import {InventoryComponent} from '../../components/inventoryComponent.js';
import {HealthComponent} from '../../components/healthComponent.js';

/**
 * Handles the 'core:action_use' action for using items directly from the player's inventory.
 * MVP implementation focuses on single, consumable items like potions.
 * @param {ActionContext} context - The action context.
 * @returns {ActionResult} - The result of the action.
 */
export function executeUse(context) {
    const {playerEntity, targets, dataManager, dispatch} = context;
    /** @type {import('../actionTypes.js').ActionMessage[]} */
    const messages = [];
    let success = false;

    // --- 1. Check for Target ---
    if (targets.length === 0) {
        const errorMsg = "Use what?";
        dispatch('ui:message_display', {text: errorMsg, type: 'error'});
        messages.push({text: errorMsg, type: 'error'});
        return {success: false, messages};
    }
    const targetName = targets.join(' ').toLowerCase(); // Normalize target name for matching

    // --- 2. Get Player Inventory ---
    const inventoryComponent = playerEntity.getComponent(InventoryComponent);
    if (!inventoryComponent) {
        // This shouldn't happen if the player entity is set up correctly
        console.error(`executeUse: Player entity ${playerEntity.id} missing InventoryComponent.`);
        const errorMsg = "Internal Error: Cannot access your inventory.";
        dispatch('ui:message_display', {text: errorMsg, type: 'error'});
        messages.push({text: errorMsg, type: 'error'});
        return {success: false, messages};
    }

    // --- 3. Find Item in Inventory ---
    let foundItemId = null;
    let foundItemDefinition = null;
    let foundItemName = null;

    const itemIds = inventoryComponent.getItems();
    for (const itemId of itemIds) {
        const itemDef = dataManager.getEntityDefinition(itemId);
        if (itemDef?.components?.Name?.value) {
            const currentItemName = itemDef.components.Name.value;
            // MVP Matching: Case-insensitive substring check
            if (currentItemName.toLowerCase().includes(targetName)) {
                foundItemId = itemId;
                foundItemDefinition = itemDef;
                foundItemName = currentItemName; // Store the proper name for messages
                break; // Found the first match
            }
        } else {
            console.warn(`executeUse: Item definition missing or invalid Name component for ID: ${itemId} in player inventory.`);
        }
    }

    // --- 4. Handle Item Not Found ---
    if (!foundItemId || !foundItemDefinition) {
        const errorMsg = `You don't have anything like "${targetName}".`;
        dispatch('ui:message_display', {text: errorMsg, type: 'info'}); // Use 'info' as it's a common player mistake
        messages.push({text: errorMsg, type: 'info'});
        return {success: false, messages};
    }

    // --- 5. Check Usability ---
    // We directly access the definition's component data loaded by DataManager
    const usableData = foundItemDefinition.components?.Usable;

    if (!usableData) {
        const errorMsg = `You can't use the ${foundItemName} that way.`;
        dispatch('ui:message_display', {text: errorMsg, type: 'warning'});
        messages.push({text: errorMsg, type: 'warning'});
        return {success: false, messages};
    }

    // --- 6. Apply Effect ---
    let effectApplied = false;
    switch (usableData.effect_type) {
        case 'heal':
            const healthComponent = playerEntity.getComponent(HealthComponent);
            const healAmount = usableData.effect_details?.amount;

            if (!healthComponent) {
                console.error(`executeUse: Player entity ${playerEntity.id} missing HealthComponent needed for 'heal' effect.`);
                const errorMsg = "Internal Error: Cannot access your health.";
                dispatch('ui:message_display', {text: errorMsg, type: 'error'});
                messages.push({text: errorMsg, type: 'error'});
                return {success: false, messages}; // Critical failure
            }

            if (typeof healAmount !== 'number' || healAmount <= 0) {
                console.error(`executeUse: Invalid heal amount specified for item ${foundItemId}:`, healAmount);
                const errorMsg = `Internal Error: The ${foundItemName} seems misconfigured.`;
                dispatch('ui:message_display', {text: errorMsg, type: 'error'});
                messages.push({text: errorMsg, type: 'error'});
                return {success: false, messages}; // Config error
            }

            if (healthComponent.current >= healthComponent.max) {
                const infoMsg = "You are already at full health.";
                dispatch('ui:message_display', {text: infoMsg, type: 'info'});
                messages.push({text: infoMsg, type: 'info'});
                // Don't consume if no effect happened (optional design choice)
                // return { success: false, messages }; // Or let it proceed but don't consume
                // For MVP, let's just prevent healing but allow consumption (simpler)
            } else {
                const oldHealth = healthComponent.current;
                healthComponent.current = Math.min(healthComponent.max, oldHealth + healAmount);
                const actualHeal = healthComponent.current - oldHealth;
                // Optional: More specific heal message
                // const healMsg = `You recovered ${actualHeal} health.`;
                // dispatch('ui:message_display', { text: healMsg, type: 'success' });
                // messages.push({ text: healMsg, type: 'success' });
                effectApplied = true; // Mark that healing occurred (or was attempted)
            }
            success = true; // Mark action as successful even if already full health (item was targeted correctly)
            break;

        // Future effect types would go here
        // case 'unlock': ...
        // case 'light': ...

        default:
            console.warn(`executeUse: Unsupported effect_type "${usableData.effect_type}" for item ${foundItemId}.`);
            const errorMsg = `Using the ${foundItemName} doesn't seem to do anything right now.`;
            dispatch('ui:message_display', {text: errorMsg, type: 'warning'});
            messages.push({text: errorMsg, type: 'warning'});
            // Return failure because the defined effect couldn't be handled
            return {success: false, messages};
    }

    // --- 7. Consume Item (if applicable and effect was applied or action was valid) ---
    // Only consume if the action 'succeeded' in targeting a usable item,
    // and the item is marked consumable.
    if (success && usableData.consumable) {
        const removed = inventoryComponent.removeItem(foundItemId);
        if (!removed) {
            // This indicates an inconsistency - item was found but couldn't be removed
            console.error(`executeUse: Failed to remove consumed item ${foundItemId} from player inventory!`);
            // Don't necessarily fail the whole action, but log the error
        }
    }

    // --- 8. Dispatch Success Message ---
    // Dispatch the specific message from the item's data
    dispatch('ui:message_display', {text: usableData.use_message, type: 'info'}); // Use 'info' or 'success' based on preference
    messages.push({text: usableData.use_message, type: 'info'});


    // --- 9. Return Result ---
    return {success, messages};
}