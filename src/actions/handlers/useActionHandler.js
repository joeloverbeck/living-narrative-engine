// src/actions/handlers/useActionHandler.js

/** @typedef {import('../actionTypes.js').ActionContext} ActionContext */
/** @typedef {import('../actionTypes.js').ActionResult} ActionResult */
/** @typedef {import('../../components/inventoryComponent.js').InventoryComponent} InventoryComponent */
/** @typedef {import('../../components/nameComponent.js').NameComponent} NameComponent */
/** @typedef {import('../../components/positionComponent.js').PositionComponent} PositionComponent */ // Added for target finding
/** @typedef {import('../../src/entities/entity.js').default} Entity */
/** @typedef {import('../../events/eventTypes.js').ItemUseAttemptedEventPayload} ItemUseAttemptedEventPayload */ // Added for event payload type

import { InventoryComponent } from '../../components/inventoryComponent.js';
import { NameComponent } from '../../components/nameComponent.js';
import { PositionComponent } from '../../components/positionComponent.js';

// Import the findTarget utility and messages
import { findTarget } from '../../utils/targetFinder.js';
import { TARGET_MESSAGES, getDisplayName } from '../../utils/messages.js';

/**
 * Handles the 'core:action_use' action (REF-USE-02 Refactor).
 * Validates player intent to use an item from inventory, identifies the unique item instance
 * and an optional explicit target entity nearby, then fires 'event:item_use_attempted'.
 * Does NOT check usability, conditions, apply effects, or consume the item.
 * Uses findTarget for partial, case-insensitive matching within player's inventory and nearby entities.
 *
 * @param {ActionContext} context - The action context.
 * @returns {ActionResult} - The result of the intent validation.
 */
export function executeUse(context) {
    // Added eventBus, removed dataManager
    const { playerEntity, targets, entityManager, dispatch, eventBus } = context;
    /** @type {import('../actionTypes.js').ActionMessage[]} */
    const messages = [];
    // let success = false; // No longer needed here, determined by reaching the end

    // --- 1. Check for Target Input (Item Name) ---
    if (targets.length === 0) {
        const errorMsg = TARGET_MESSAGES.PROMPT_WHAT('use');
        dispatch('ui:message_display', { text: errorMsg, type: 'error' });
        messages.push({ text: "Intent Failed: No item target provided.", type: 'internal' });
        return { success: false, messages };
    }
    const fullTargetString = targets.join(' '); // Used for finding item

    // --- 2. Get Player Inventory ---
    const inventoryComponent = playerEntity.getComponent(InventoryComponent);
    if (!inventoryComponent) {
        console.error(`executeUse: Player entity ${playerEntity.id} missing InventoryComponent.`);
        const errorMsg = TARGET_MESSAGES.INTERNAL_ERROR_COMPONENT('Inventory');
        dispatch('ui:message_display', { text: errorMsg, type: 'error' });
        messages.push({ text: "Intent Failed: Player missing InventoryComponent.", type: 'error' });
        return { success: false, messages };
    }

    // --- 3. Determine Search Scope (Items in inventory with NameComponent) ---
    const itemIds = inventoryComponent.getItems();
    const searchableInventoryItems = [];
    for (const itemId of itemIds) {
        // Assumption: itemId in inventory IS the entity instance ID
        const itemInstance = entityManager.getEntityInstance(itemId);
        // Must exist and have NameComponent for findTarget
        if (itemInstance && itemInstance.hasComponent(NameComponent)) {
            searchableInventoryItems.push(itemInstance);
        } else if (itemInstance) {
            console.warn(`executeUse: Item instance ${itemId} in inventory lacks NameComponent.`);
        } else {
            // This case means inventoryComponent has an ID for an entity that no longer exists in entityManager.
            // This indicates a potential state inconsistency issue elsewhere (e.g., item removed without updating inventory).
            console.warn(`executeUse: Inventory contains ID '${itemId}' but entity instance not found in EntityManager.`);
            // Should we clean up the inventory here? For now, just warn and skip.
            // inventoryComponent.removeItem(itemId); // Potential cleanup, but might hide bugs.
        }
    }

    if (searchableInventoryItems.length === 0) {
        // If inventory is completely empty or has no items with names
        const errorMsg = TARGET_MESSAGES.NOT_FOUND_INVENTORY(fullTargetString); // Use full string for message
        dispatch('ui:message_display', { text: errorMsg, type: 'info' });
        messages.push({ text: "Intent Failed: No searchable items in inventory.", type: 'internal' });
        return { success: false, messages };
    }


    // --- 4. Find Target Item using Utility ---
    // Kept and modified slightly for clarity
    // We search using the *full* target string initially.
    const findItemResult = findTarget(fullTargetString, searchableInventoryItems);
    let targetItemEntity = null; // The unique Entity instance found in inventory
    let itemInstanceId = null; // The ID of the specific instance found
    let itemDefinitionId = null; // The definition ID (template) of the item
    // let finalItemName = fullTargetString; // Fallback for messages if needed early

    switch (findItemResult.status) {
        case 'NOT_FOUND': {
            const errorMsg = TARGET_MESSAGES.NOT_FOUND_INVENTORY(fullTargetString);
            dispatch('ui:message_display', { text: errorMsg, type: 'info' });
            messages.push({ text: `Intent Failed: Item matching '${fullTargetString}' not found.`, type: 'internal' });
            return { success: false, messages };
        }
        case 'FOUND_AMBIGUOUS': {
            // Use the original fullTargetString for the ambiguous message context
            const errorMsg = TARGET_MESSAGES.AMBIGUOUS_PROMPT('use', fullTargetString, findItemResult.matches);
            dispatch('ui:message_display', { text: errorMsg, type: 'warning' });
            messages.push({ text: `Intent Failed: Ambiguous item target '${fullTargetString}'.`, type: 'internal' });
            return { success: false, messages }; // Ambiguity pauses the action
        }
        case 'FOUND_UNIQUE':
            targetItemEntity = findItemResult.matches[0];
            itemInstanceId = targetItemEntity.id; // Assume instance ID is entity ID
            // Assumption: Entity ID is also the Definition ID used by DataManager
            // If instances get unique IDs later, this needs targetItemEntity.definitionId or similar.
            itemDefinitionId = targetItemEntity.id;
            const foundItemName = getDisplayName(targetItemEntity);
            messages.push({ text: `Intent Parse: Found unique item instance: ${foundItemName} (Instance: ${itemInstanceId}, Definition: ${itemDefinitionId})`, type: 'internal' });
            break; // Proceed
        default: { // Should not happen
            const errorMsg = TARGET_MESSAGES.INTERNAL_ERROR + " (Unexpected findTarget status for item)";
            dispatch('ui:message_display', { text: errorMsg, type: 'error' });
            console.error("executeUse: Unexpected status from findTarget for item:", findItemResult.status);
            messages.push({ text: `Intent Failed: Internal error finding item. Status: ${findItemResult.status}`, type: 'error' });
            return { success: false, messages };
        }
    }

    // --- 5. Identify Explicit Target Entity ---
    let explicitTargetEntityId = null;
    const foundItemNameWords = getDisplayName(targetItemEntity).toLowerCase().split(' ');
    const targetWords = fullTargetString.toLowerCase().split(' ');

    // Basic heuristic: Find where the item name ends in the input targets
    // This is naive and might fail with complex names or phrasing.
    // Example: "use small red potion on goblin" -> targets = ["small", "red", "potion", "on", "goblin"]
    // foundItemNameWords = ["small", "red", "potion"]
    // We need to find the index AFTER "potion".
    let itemWordsEndIndex = -1;
    if (targetWords.length > 0 && foundItemNameWords.length > 0) {
        // Try matching the full found name first
        let match = true;
        for(let i = 0; i < foundItemNameWords.length; i++) {
            if (i >= targetWords.length || targetWords[i] !== foundItemNameWords[i]) {
                match = false;
                break;
            }
        }
        if (match) {
            itemWordsEndIndex = foundItemNameWords.length -1;
        } else {
            // Fallback: find the last word of the item name in the target list
            // This is highly ambiguous, e.g., "use the old shield" -> might find "shield" at index 3.
            // For now, let's stick to the first approach or a simpler one:
            // Use the number of words in the found item's name as the split point.
            itemWordsEndIndex = foundItemNameWords.length - 1;
        }
    }

    const remainingTargetWords = targets.slice(itemWordsEndIndex + 1).filter(word => word.toLowerCase() !== 'on' && word.toLowerCase() !== 'at'); // Remove common prepositions
    if (remainingTargetWords.length > 0) {
        const explicitTargetName = remainingTargetWords.join(' ');
        messages.push({ text: `Intent Parse: Identified potential explicit target name: '${explicitTargetName}'`, type: 'internal' });

        // Now, try to find this target *nearby* the player
        // Requires player PositionComponent and EntityManager access
        const playerPos = playerEntity.getComponent(PositionComponent);
        if (playerPos?.locationId) {
            const entitiesInLocation = entityManager.getEntitiesInLocation(playerPos.locationId);
            const searchableNearbyEntities = [];
            for (const entityId of entitiesInLocation) {
                if (entityId === playerEntity.id) continue; // Exclude self
                const entityInstance = entityManager.getEntityInstance(entityId);
                // Check for NameComponent before adding to searchable list
                if (entityInstance?.hasComponent(NameComponent)) {
                    searchableNearbyEntities.push(entityInstance);
                }
            }

            if (searchableNearbyEntities.length > 0) {
                const findExplicitTargetResult = findTarget(explicitTargetName, searchableNearbyEntities);

                switch (findExplicitTargetResult.status) {
                    case 'FOUND_UNIQUE':
                        const targetEntity = findExplicitTargetResult.matches[0];
                        explicitTargetEntityId = targetEntity.id;
                        messages.push({ text: `Intent Parse: Resolved explicit target to entity ID: ${explicitTargetEntityId} (${getDisplayName(targetEntity)})`, type: 'internal' });
                        break;
                    case 'FOUND_AMBIGUOUS':
                        // As per ticket, don't *validate* yet, but ambiguity here prevents clear intent.
                        // Dispatch UI message and fail the action handler.
                    { // Use block scope for const
                        const errorMsg = TARGET_MESSAGES.TARGET_AMBIGUOUS_CONTEXT('use', explicitTargetName, findExplicitTargetResult.matches);
                        dispatch('ui:message_display', { text: errorMsg, type: 'warning' });
                        messages.push({ text: `Intent Failed: Ambiguous explicit target specified: '${explicitTargetName}'.`, type: 'internal' });
                        return { success: false, messages };
                    }
                    case 'NOT_FOUND':
                        // If they specified a target name but it wasn't found nearby, the intent is clear
                        // but the target is invalid *contextually*. This validation happens *later*.
                        // For the handler, we just record that no ID could be resolved *yet*.
                        explicitTargetEntityId = null; // Explicitly set to null as resolution failed
                        messages.push({ text: `Intent Parse: Explicit target name '${explicitTargetName}' provided but not resolved to a nearby entity ID. Validation deferred to system.`, type: 'internal' });
                        break;
                }
            } else {
                messages.push({ text: `Intent Parse: No other searchable entities found nearby to resolve explicit target '${explicitTargetName}'. Validation deferred.`, type: 'internal' });
            }
        } else {
            messages.push({ text: `Intent Parse: Cannot resolve explicit target '${explicitTargetName}' because player location is unknown. Validation deferred.`, type: 'internal' });
            // Player missing position - this might be an error case depending on game logic
            console.warn(`executeUse: Player ${playerEntity.id} missing PositionComponent or locationId; cannot resolve explicit target.`);
        }
    } else {
        messages.push({ text: `Intent Parse: No explicit target name specified after item name.`, type: 'internal' });
        explicitTargetEntityId = null; // No target specified
    }

    // --- 6. Construct and Dispatch Event (New Logic) ---
    // Ensure eventBus is available
    if (!eventBus) {
        console.error("executeUse: Critical Error! eventBus is not available in the action context.");
        const errorMsg = TARGET_MESSAGES.INTERNAL_ERROR + " (Event system unavailable)";
        dispatch('ui:message_display', { text: errorMsg, type: 'error' });
        messages.push({ text: "Intent Failed: Event bus missing.", type: 'error' });
        return { success: false, messages };
    }

    /** @type {ItemUseAttemptedEventPayload} */
    const eventPayload = {
        userEntityId: playerEntity.id,
        itemInstanceId: itemInstanceId,
        itemDefinitionId: itemDefinitionId, // Using the same ID based on current assumptions
        explicitTargetEntityId: explicitTargetEntityId // Null if not specified or not resolved
    };

    try {
        console.debug(`executeUse: Dispatching event:item_use_attempted`, eventPayload);
        eventBus.dispatch('event:item_use_attempted', eventPayload);
        messages.push({ text: `Intent Success: Fired event:item_use_attempted for item ${itemDefinitionId}.`, type: 'internal' });
    } catch (error) {
        console.error(`executeUse: Error dispatching event:item_use_attempted:`, error);
        const errorMsg = TARGET_MESSAGES.INTERNAL_ERROR + " (Event dispatch failed)";
        dispatch('ui:message_display', { text: errorMsg, type: 'error' });
        messages.push({ text: `Intent Failed: Error dispatching event. ${error.message}`, type: 'error' });
        return { success: false, messages }; // Fail if event dispatch fails
    }

    // --- 7. Return Success (Intent validated) ---
    // Messages array now only contains internal logs or reflects failures handled above.
    return { success: true, messages };
}
