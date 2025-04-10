// src/actions/handlers/useActionHandler.js

/** @typedef {import('../actionTypes.js').ActionContext} ActionContext */
/** @typedef {import('../actionTypes.js').ActionResult} ActionResult */
/** @typedef {import('../../components/inventoryComponent.js').InventoryComponent} InventoryComponent */
/** @typedef {import('../../components/nameComponent.js').NameComponent} NameComponent */
/** @typedef {import('../../components/positionComponent.js').PositionComponent} PositionComponent */
/** @typedef {import('../../components/connectionsComponent.js').ConnectionsComponent} ConnectionsComponent */
/** @typedef {import('../../components/connectionsComponent.js').Connection} Connection */
/** @typedef {import('../../src/entities/entity.js').default} Entity */
/** @typedef {import('../../events/eventTypes.js').ItemUseAttemptedEventPayload} ItemUseAttemptedEventPayload */

import {InventoryComponent} from '../../components/inventoryComponent.js';
import {NameComponent} from '../../components/nameComponent.js';
import {PositionComponent} from '../../components/positionComponent.js';
import {ConnectionsComponent} from '../../components/connectionsComponent.js';
import {ItemComponent} from '../../components/itemComponent.js';
import {TARGET_MESSAGES, getDisplayName} from '../../utils/messages.js';
// Import the new connection resolver
import {resolveTargetEntity, resolveTargetConnection} from '../../services/targetResolutionService.js';
import {validateRequiredTargets} from '../../utils/actionValidationUtils.js';

/**
 * Handles the 'core:action_use' action.
 * Validates player intent, identifies the item instance and an optional explicit
 * target (either an entity OR a connection), then fires 'event:item_use_attempted'.
 * Does NOT check usability, conditions, apply effects, or consume the item.
 *
 * @param {ActionContext} context - The action context.
 * @returns {ActionResult} - The result of the intent validation.
 */
export function executeUse(context) {
    const {playerEntity, targets, entityManager, dispatch, eventBus, currentLocation} = context; // Added currentLocation
    /** @type {import('../actionTypes.js').ActionMessage[]} */
    const messages = [];

    // --- 1. Validate required target (item name) ---
    if (!validateRequiredTargets(context, 'use')) {
        return {success: false, messages: [], newState: undefined}; // Validation failed, message dispatched by utility
    }
    const fullTargetString = targets.join(' '); // Full user input string e.g., "iron key > north door" or "potion on goblin" or just "potion"

    // --- 2. Get Player Inventory (Still needed for pre-check) ---
    // (Inventory check remains the same)
    const inventoryComponent = playerEntity.getComponent(InventoryComponent);
    if (!inventoryComponent) {
        console.error(`executeUse: Player entity ${playerEntity.id} missing InventoryComponent.`);
        const errorMsg = TARGET_MESSAGES.INTERNAL_ERROR_COMPONENT('Inventory');
        dispatch('ui:message_display', {text: errorMsg, type: 'error'});
        messages.push({text: "Intent Failed: Player missing InventoryComponent.", type: 'internal'});
        return {success: false, messages};
    }
    if (inventoryComponent.getItems().length === 0) {
        dispatch('ui:message_display', {text: TARGET_MESSAGES.NOTHING_CARRIED, type: 'info'});
        messages.push({text: TARGET_MESSAGES.NOTHING_CARRIED, type: 'internal'});
        return {success: false, messages};
    }

    // --- 3. Find Target Item using Service ---
    // We need to parse the item name *first*, then handle the rest of the string.
    // resolveTargetEntity might resolve partial item names. We'll try resolving
    // the *entire* string as an item first. If that fails, we could try parsing,
    // but a simpler approach is to resolve the item based on the first part, then
    // treat the rest as the explicit target. Let's stick with trying to resolve
    // the full string for now, assuming resolveTargetEntity handles partial item names well.

    // Try resolving the item based on the potentially ambiguous full string.
    // We might need a better way to separate item name vs target name later.
    const targetItemEntity = resolveTargetEntity(context, {
        scope: 'inventory',
        requiredComponents: [ItemComponent],
        actionVerb: 'use',
        targetName: fullTargetString, // Use full string initially
        notFoundMessageKey: 'NOT_FOUND_INVENTORY',
    });

    // --- Handle Item Resolver Result ---
    if (!targetItemEntity) {
        // If resolving the full string fails, it's ambiguous or not found.
        // resolveTargetEntity should have dispatched a message.
        messages.push({
            text: `Intent Failed: Could not resolve unique item from '${fullTargetString}' in inventory.`,
            type: 'internal'
        });
        return {success: false, messages};
    }

    // --- Successfully found unique item ---
    const itemInstanceId = targetItemEntity.id;
    // TODO: itemDefinitionId should likely come from a component on the instance, not be the instance ID itself.
    // Assuming ItemComponent or similar holds a reference like `definitionId`.
    const itemComponent = targetItemEntity.getComponent(ItemComponent);
    // Use instance ID as fallback if no definition specified
    const itemDefinitionId = itemComponent?.definitionId || itemInstanceId;
    const foundItemName = getDisplayName(targetItemEntity);
    messages.push({text: `Intent Parse: Found item: ${foundItemName} (${itemInstanceId})`, type: 'internal'});


    // --- 4. Identify Explicit Target (Entity OR Connection) ---
    let explicitTargetEntityId = null;
    let explicitTargetConnectionId = null;
    let remainingTargetString = '';

    // Simple Parsing: Assume the resolved item name is the beginning of the full string.
    // Find where the item name ends and what follows.
    // Use regex to find the item name (case-insensitive) at the start, followed by optional separators.
    const itemNamePattern = new RegExp(`^${foundItemName.replace(/[-\/\\^$*+?.()|[\]{}]/g, '\\$&')}(\\s+(?:>|on|at)\\s+|\\s+)`, 'i');
    const matchResult = fullTargetString.match(itemNamePattern);

    if (matchResult) {
        // Separator found (like '>', 'on', 'at', or just space)
        remainingTargetString = fullTargetString.substring(matchResult[0].length).trim();
        messages.push({
            text: `Intent Parse: Separator found. Potential target: '${remainingTargetString}'`,
            type: 'internal'
        });
    } else if (fullTargetString.toLowerCase().startsWith(foundItemName.toLowerCase() + ' ')) {
        // Item name followed by space, but no explicit separator (> on at)
        remainingTargetString = fullTargetString.substring(foundItemName.length).trim();
        messages.push({
            text: `Intent Parse: Space separator. Potential target: '${remainingTargetString}'`,
            type: 'internal'
        });
    } else if (fullTargetString.toLowerCase() !== foundItemName.toLowerCase()) {
        // Resolved name doesn't match start of string, maybe alias/partial match used by resolver?
        // This makes parsing difficult. For now, assume no explicit target in this case.
        console.warn(`executeUse: Resolved item name '${foundItemName}' doesn't match start of input '${fullTargetString}'. Assuming no explicit target specified.`);
        messages.push({
            text: `Intent Parse: Mismatch between resolved item and input string. Assuming no explicit target.`,
            type: 'internal'
        });
        remainingTargetString = '';
    }
    // If fullTargetString perfectly matched foundItemName, remainingTargetString is already ''


    if (remainingTargetString) {
        messages.push({
            text: `Intent Parse: Attempting to resolve explicit target: '${remainingTargetString}'`,
            type: 'internal'
        });

        const playerPos = playerEntity.getComponent(PositionComponent);
        if (!playerPos?.locationId || !currentLocation) {
            // Cannot resolve connections or entities without location info
            console.warn(`executeUse: Player ${playerEntity.id} missing PositionComponent/locationId or currentLocation is invalid; cannot resolve explicit target '${remainingTargetString}'.`);
            messages.push({
                text: `Intent Failed: Cannot resolve explicit target '${remainingTargetString}' - player location unknown.`,
                type: 'internal'
            });
            // Fail if a target was specified but location is unknown
            dispatch('ui:message_display', {text: TARGET_MESSAGES.INTERNAL_ERROR_COMPONENT('Position'), type: 'error'});
            return {success: false, messages};
        }

        // --- Try resolving as a CONNECTION first ---
        const resolvedConnection = resolveTargetConnection(context, remainingTargetString, `use ${foundItemName} on`);

        if (resolvedConnection) {
            explicitTargetConnectionId = resolvedConnection.connectionId;
            messages.push({
                text: `Intent Parse: Resolved explicit target to CONNECTION: ${resolvedConnection.name || resolvedConnection.direction} (${explicitTargetConnectionId})`,
                type: 'internal'
            });
        } else {
            // --- If not a connection, try resolving as an ENTITY ---
            // Note: resolveTargetConnection already dispatched failure message if ambiguous/not found as connection.
            messages.push({
                text: `Intent Parse: Target '${remainingTargetString}' not resolved as a connection. Trying as entity...`,
                type: 'internal'
            });

            // Use resolveTargetEntity for entities in the location
            const explicitTargetEntity = resolveTargetEntity(context, {
                scope: 'location', // Search things in the current location (excluding player)
                requiredComponents: [], // Any named entity in the location
                actionVerb: `use ${foundItemName} on`,
                targetName: remainingTargetString, // Use the remaining string
                notFoundMessageKey: 'TARGET_NOT_FOUND_CONTEXT', // Use the specific 'use on X' message key
            });

            if (explicitTargetEntity) {
                explicitTargetEntityId = explicitTargetEntity.id;
                messages.push({
                    text: `Intent Parse: Resolved explicit target to ENTITY: ${getDisplayName(explicitTargetEntity)} (${explicitTargetEntityId})`,
                    type: 'internal'
                });
            } else {
                // Failed to resolve as EITHER connection or entity.
                // resolveTargetEntity should have dispatched the final failure message.
                messages.push({
                    text: `Intent Failed: Could not resolve unique explicit target '${remainingTargetString}' as connection or entity nearby.`,
                    type: 'internal'
                });
                return {success: false, messages}; // Fail the action if explicit target was specified but not found/resolved
            }
        }
    } else {
        messages.push({text: `Intent Parse: No explicit target name specified after item.`, type: 'internal'});
    }

    // --- 5. Construct and Dispatch Event ---
    if (!eventBus) {
        console.error("executeUse: Critical Error! eventBus is not available in the action context.");
        const errorMsg = TARGET_MESSAGES.INTERNAL_ERROR;
        dispatch('ui:message_display', {text: errorMsg, type: 'error'});
        messages.push({text: "Intent Failed: Event bus missing.", type: 'error'});
        return {success: false, messages};
    }

    /** @type {ItemUseAttemptedEventPayload} */
    const eventPayload = {
        userEntityId: playerEntity.id,
        itemInstanceId: itemInstanceId,
        itemDefinitionId: itemDefinitionId,
        explicitTargetEntityId: explicitTargetEntityId,         // Will be null if connection targeted
        explicitTargetConnectionId: explicitTargetConnectionId, // Will be null if entity targeted or no target
    };

    let success = false; // Default false
    try {
        eventBus.dispatch('event:item_use_attempted', eventPayload);
        success = true; // Set success only if dispatch works
        let targetLog = '';
        if (explicitTargetEntityId) {
            targetLog = ` on entity ${explicitTargetEntityId}`;
        } else if (explicitTargetConnectionId) {
            targetLog = ` on connection ${explicitTargetConnectionId}`;
        }
        messages.push({
            text: `Intent Success: Fired event:item_use_attempted for item ${itemDefinitionId}${targetLog}`,
            type: 'internal'
        });
    } catch (error) {
        console.error(`executeUse: Error dispatching event:item_use_attempted:`, error);
        const errorMsg = TARGET_MESSAGES.INTERNAL_ERROR;
        dispatch('ui:message_display', {text: errorMsg, type: 'error'});
        messages.push({text: `Intent Failed: Error dispatching event. ${error.message}`, type: 'error'});
        // success remains false
    }

    // --- 6. Return Result ---
    return {success, messages}; // Return success based on event dispatch attempt
}