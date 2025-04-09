// src/actions/handlers/lookActionHandler.js

// Import necessary components and utilities
import { NameComponent } from '../../components/nameComponent.js';
import { DescriptionComponent } from '../../components/descriptionComponent.js';
import { ConnectionsComponent } from '../../components/connectionsComponent.js';
import { ItemComponent } from '../../components/itemComponent.js';
import { InventoryComponent } from '../../components/inventoryComponent.js'; // Needed for inventory scope

// Import the findTarget utility and messages
import { findTarget } from '../../utils/targetFinder.js';
import { TARGET_MESSAGES, getDisplayName } from '../../utils/messages.js';

/** @typedef {import('../actionTypes.js').ActionContext} ActionContext */
/** @typedef {import('../actionTypes.js').ActionResult} ActionResult */
/** @typedef {import('../../src/entities/entity.js').default} Entity */
/** @typedef {import('../../types').LocationRenderData} LocationRenderData */

/**
 * Handles the 'core:action_look' action. Dispatches messages directly via context.dispatch.
 * Uses findTarget for looking at specific targets (location + inventory scope).
 * @param {ActionContext} context
 * @returns {ActionResult}
 */
export function executeLook(context) {
    const { currentLocation, targets, entityManager, playerEntity, dispatch } = context;
    const messages = []; // Keep for internal logging if needed
    let success = true; // Assume success unless target not found/ambiguous

    if (!currentLocation) {
        const errorMsg = "You can't see anything; your location is unknown.";
        dispatch('ui:message_display', { text: errorMsg, type: 'error' });
        return { success: false, messages: [{ text: errorMsg, type: 'error' }] };
    }

    if (targets.length === 0) {
        // --- Look at the current location (Existing logic is mostly fine) ---
        const nameComp = currentLocation.getComponent(NameComponent);
        const descComp = currentLocation.getComponent(DescriptionComponent);
        const connectionsComp = currentLocation.getComponent(ConnectionsComponent);

        const locationName = nameComp ? nameComp.value : `Unnamed Location (${currentLocation.id})`;
        const locationDesc = descComp ? descComp.text : "You are in an undescribed location.";

        const entityIdsInLocation = entityManager.getEntitiesInLocation(currentLocation.id);
        const entitiesInLocation = Array.from(entityIdsInLocation)
            .map(id => entityManager.getEntityInstance(id))
            .filter(entity => entity); // Filter out potential nulls

        let itemsVisible = entitiesInLocation
            .filter(entity => entity.hasComponent(ItemComponent))
            .map(itemEntity => getDisplayName(itemEntity)); // Use getDisplayName

        let npcsVisible = entitiesInLocation
            .filter(entity => entity.id !== playerEntity.id && !entity.hasComponent(ItemComponent))
            .map(npcEntity => getDisplayName(npcEntity)); // Use getDisplayName

        let availableDirections = [];
        if (connectionsComp && Array.isArray(connectionsComp.connections)) {
            availableDirections = connectionsComp.connections
                .filter(conn => conn.state !== 'hidden')
                .map(conn => conn.direction)
                .filter(dir => dir);
        }

        const locationData = {
            name: locationName,
            description: locationDesc,
            exits: availableDirections,
            items: itemsVisible.length > 0 ? itemsVisible : undefined,
            npcs: npcsVisible.length > 0 ? npcsVisible : undefined,
        };

        dispatch('ui:display_location', locationData);
        // Add a simple text message as well for consistency? Or rely solely on structured data.
        // messages.push({ text: `Looked at ${locationName}`, type: 'internal' });

    } else {
        // --- Look at a specific target ---
        const targetName = targets.join(' '); // Keep case for messages

        // Handle "look self" or "look me"
        if (targetName.toLowerCase() === 'self' || targetName.toLowerCase() === 'me') {
            // TODO: Enhance "look self" - show health, equipped items?
            const lookSelfMsg = "You look yourself over. You seem to be in one piece.";
            dispatch('ui:message_display', { text: lookSelfMsg, type: 'info' });
            messages.push({ text: lookSelfMsg, type: 'info' });
        } else {
            // --- Use findTarget for other targets ---

            // 1. Determine Search Scope (Location + Player Inventory)
            const combinedSearchScope = [];

            // Add entities from current location (excluding player) with NameComponent
            const entityIdsInLocation = entityManager.getEntitiesInLocation(currentLocation.id);
            if (entityIdsInLocation) {
                for (const entityId of entityIdsInLocation) {
                    if (entityId === playerEntity.id) continue; // Exclude self
                    const entity = entityManager.getEntityInstance(entityId);
                    if (entity && entity.hasComponent(NameComponent)) {
                        combinedSearchScope.push(entity);
                    } else if (entity) {
                        // console.warn(`lookActionHandler: Entity ${entityId} in location lacks NameComponent.`);
                    }
                }
            }

            // Add items from player inventory with NameComponent
            const playerInventory = playerEntity.getComponent(InventoryComponent);
            if (playerInventory) {
                const inventoryItemIds = playerInventory.getItems();
                for (const itemId of inventoryItemIds) {
                    const itemInstance = entityManager.getEntityInstance(itemId);
                    if (itemInstance && itemInstance.hasComponent(NameComponent)) {
                        // Avoid adding duplicates if an item could somehow be in both lists (unlikely)
                        if (!combinedSearchScope.some(e => e.id === itemInstance.id)) {
                            combinedSearchScope.push(itemInstance);
                        }
                    } else if (itemInstance) {
                        // console.warn(`lookActionHandler: Inventory item ${itemId} lacks NameComponent.`);
                    }
                }
            }

            // 2. Call findTarget Utility
            const findResult = findTarget(targetName, combinedSearchScope);
            let targetEntity = null;

            // 3. Handle Results
            switch (findResult.status) {
                case 'NOT_FOUND': {
                    // Use a message appropriate for combined scope search
                    const errorMsg = TARGET_MESSAGES.NOT_FOUND_LOCATION(targetName); // Or a custom one like "You don't see '${targetName}' here or in your inventory."
                    dispatch('ui:message_display', { text: errorMsg, type: 'info' });
                    messages.push({ text: errorMsg, type: 'info' });
                    success = false; // Indicate the specific look failed
                    break;
                }
                case 'FOUND_AMBIGUOUS': {
                    // Ask for clarification using standard prompt
                    const errorMsg = TARGET_MESSAGES.AMBIGUOUS_PROMPT('look at', targetName, findResult.matches);
                    dispatch('ui:message_display', { text: errorMsg, type: 'warning' });
                    messages.push({ text: errorMsg, type: 'warning' });
                    success = false; // Ambiguity pauses the action
                    break;
                }
                case 'FOUND_UNIQUE': {
                    // Display the description of the found entity
                    targetEntity = findResult.matches[0];
                    const name = getDisplayName(targetEntity);
                    const descComp = targetEntity.getComponent(DescriptionComponent);
                    const description = descComp ? descComp.text : `You look closely at the ${name}, but see nothing particularly interesting.`; // Fallback description

                    dispatch('ui:message_display', { text: description, type: 'info' });
                    messages.push({ text: `Looked at ${name} (${targetEntity.id})`, type: 'internal' });
                    success = true;
                    break;
                }
                default: {
                    // Should not happen
                    const errorMsg = TARGET_MESSAGES.INTERNAL_ERROR + " (Unexpected findTarget status)";
                    dispatch('ui:message_display', { text: errorMsg, type: 'error' });
                    console.error("executeLook: Unexpected status from findTarget:", findResult.status);
                    success = false;
                    break;
                }
            }
        }
    }

    // Return result (success might be false if specific target look failed)
    return { success, messages };
}