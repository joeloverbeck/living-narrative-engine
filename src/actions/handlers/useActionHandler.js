// src/actions/handlers/useActionHandler.js

/** @typedef {import('../actionTypes.js').ActionContext} ActionContext */
/** @typedef {import('../actionTypes.js').ActionResult} ActionResult */
/** @typedef {import('../../components/inventoryComponent.js').InventoryComponent} InventoryComponent */
/** @typedef {import('../../components/nameComponent.js').NameComponent} NameComponent */
/** @typedef {import('../../components/positionComponent.js').PositionComponent} PositionComponent */
/** @typedef {import('../../components/connectionsComponent.js').ConnectionsComponent} ConnectionsComponent */
/** @typedef {import('../../components/connectionsComponent.js').Connection} Connection */
/** @typedef {import('../../src/entities/entity.js').default} Entity */
/** @typedef {import('../../types/eventTypes.js').ItemUseAttemptedEventPayload} ItemUseAttemptedEventPayload */
/** @typedef {import('../actionTypes.js').ParsedCommand} ParsedCommand */ // Added for clarity

import {InventoryComponent} from '../../components/inventoryComponent.js';
import {NameComponent} from '../../components/nameComponent.js';
import {PositionComponent} from '../../components/positionComponent.js';
import {ConnectionsComponent} from '../../components/connectionsComponent.js';
import {ItemComponent} from '../../components/itemComponent.js';
import {TARGET_MESSAGES, getDisplayName} from '../../utils/messages.js';
// Import the new connection resolver
import {resolveTargetEntity, resolveTargetConnection} from '../../services/targetResolutionService.js';
import {validateRequiredCommandPart} from '../../utils/actionValidationUtils.js';

/**
 * Handles the 'core:use' action.
 * Attempts to parse the input into an item (from inventory) and an optional target
 * (connection or entity nearby), then fires 'event:item_use_attempted'.
 *
 * @param {ActionContext} context - The action context.
 * @returns {ActionResult} - The result of the intent validation.
 */
export function executeUse(context) {
    const {
        playerEntity,
        targets,
        entityManager,
        dataManager,
        dispatch,
        eventBus,
        currentLocation,
        parsedCommand
    } = context; // Added parsedCommand destructuring
    /** @type {import('../actionTypes.js').ActionMessage[]} */
    const messages = [];

    // --- 1. Validate basic target presence & Get Full String ---
    // 'use' requires a direct object (the item). ParsedCommand should have it.
    if (!validateRequiredCommandPart(context, 'use', 'directObjectPhrase')) { // [cite: file:handlers/useActionHandler.js]
        // Validation failed, semantic event dispatched by validator
        return {success: false, messages: [], newState: undefined};
    }

    // --- 2. Pre-check Inventory ---
    // Check if inventory is completely empty first.
    const inventoryComponent = playerEntity.getComponent(InventoryComponent);
    if (!inventoryComponent) {
        console.error(`executeUse: Player entity ${playerEntity.id} missing InventoryComponent.`);
        const errorMsg = TARGET_MESSAGES.INTERNAL_ERROR_COMPONENT('Inventory');
        dispatch('ui:message_display', {text: errorMsg, type: 'error'});
        messages.push({text: "Intent Failed: Player missing InventoryComponent.", type: 'internal'});
        return {success: false, messages};
    }
    // Check for *completely* empty inventory
    if (inventoryComponent.getItems().length === 0) {
        dispatch('ui:message_display', {text: TARGET_MESSAGES.NOTHING_CARRIED, type: 'info'});
        messages.push({text: TARGET_MESSAGES.NOTHING_CARRIED, type: 'internal'});
        return {success: false, messages};
    }

    // --- 3. Get Item Name and Potential Target Name from Parsed Command ---
    // *Implementation of Ticket 7.2*
    // Use the direct object phrase identified by the parser as the item name.
    const itemNameGuess = parsedCommand.directObjectPhrase;
    // The target name (indirect object) handling will be addressed by the parent ticket (Ticket 7)
    // For now, targetNameGuess remains null as no preposition/IO logic is active here yet.
    const targetNameGuess = parsedCommand.indirectObjectPhrase; // Get potential target, may be null
    const usedPreposition = parsedCommand.preposition; // Get potential preposition, may be null

    messages.push({
        text: `Intent Parse: Using Parsed DO for Item guess: '${itemNameGuess}'. IO Phrase: '${targetNameGuess || 'None'}'. Prep: '${usedPreposition || 'None'}'.`,
        type: 'internal'
    });


    // --- 4. Resolve the Item ---
    // Use the itemNameGuess derived from the parsed directObjectPhrase
    const targetItemEntity = resolveTargetEntity(context, {
        scope: 'inventory', // IMPORTANT: Search only inventory for the item to USE
        requiredComponents: [ItemComponent],
        actionVerb: 'use', // Base action verb
        targetName: itemNameGuess, // Use the parsed item name guess
        notFoundMessageKey: 'NOT_FOUND_INVENTORY', // Correct key for item-not-found-in-inventory
    });

    if (!targetItemEntity) {
        // resolveTargetEntity should have dispatched the appropriate message (NOT_FOUND_INVENTORY or AMBIGUOUS_PROMPT)
        messages.push({
            text: `Intent Failed: Could not resolve unique item from parsed DO '${itemNameGuess}' in inventory.`,
            type: 'internal'
        });
        return {success: false, messages}; // Failure, message already sent by resolver
    }

    // --- Successfully resolved unique item ---
    const itemInstanceId = targetItemEntity.id;
    const itemComponent = targetItemEntity.getComponent(ItemComponent);
    const itemDefinition = dataManager.getEntityDefinition(itemComponent?.definitionId || itemInstanceId);
    const itemDefinitionId = itemDefinition?.id || itemInstanceId; // Prefer definition ID if available
    const foundItemName = getDisplayName(targetItemEntity); // Get display name for messages/context
    messages.push({
        text: `Intent Parse: Resolved item: ${foundItemName} (${itemInstanceId}, def: ${itemDefinitionId})`,
        type: 'internal'
    });


    // --- 5. Resolve the Explicit Target (if one was parsed) ---
    // This section now relies on targetNameGuess being populated by the parser (via parsedCommand.indirectObjectPhrase)
    // which is handled by the parent Ticket 7 structure.
    let explicitTargetEntityId = null;
    let explicitTargetConnectionId = null;
    // let resolvedTargetSuccess = false; // No longer needed like this, logic below covers it.

    // Only attempt to resolve a target if an indirect object phrase was parsed.
    if (targetNameGuess) {
        messages.push({
            text: `Intent Parse: Attempting to resolve explicit target from parsed IO: '${targetNameGuess}'`,
            type: 'internal'
        });

        // Construct a context string for target resolution messages
        const targetResolutionContext = `use ${foundItemName} ${usedPreposition || 'on'}`;

        // --- 5a. Try resolving as a CONNECTION first ---
        // Pass the parsed target name and the contextual string
        const resolvedConnection = resolveTargetConnection(
            context,
            targetNameGuess,
            targetResolutionContext // Provide context like "use key on"
        );

        if (resolvedConnection) {
            explicitTargetConnectionId = resolvedConnection.connectionId;
            // resolvedTargetSuccess = true; // Found connection target
            messages.push({
                text: `Intent Parse: Resolved explicit target to CONNECTION: ${resolvedConnection.name || resolvedConnection.direction} (${explicitTargetConnectionId})`,
                type: 'internal'
            });
        } else {
            // --- 5b. If not a connection, try resolving as an ENTITY nearby ---
            messages.push({
                text: `Intent Parse: Target '${targetNameGuess}' not resolved as a connection. Trying as entity...`,
                type: 'internal'
            });

            // Pass the parsed target name and the contextual string
            const explicitTargetEntity = resolveTargetEntity(context, {
                scope: 'location', // Search things in the current location (excluding player)
                requiredComponents: [], // Any named entity usually works for 'use on X'
                actionVerb: targetResolutionContext, // Provide context like "use key on"
                targetName: targetNameGuess, // Use the parsed target name guess
                notFoundMessageKey: 'TARGET_NOT_FOUND_CONTEXT', // Appropriate message key
            });

            if (explicitTargetEntity) {
                explicitTargetEntityId = explicitTargetEntity.id;
                // resolvedTargetSuccess = true; // Found entity target
                messages.push({
                    text: `Intent Parse: Resolved explicit target to ENTITY: ${getDisplayName(explicitTargetEntity)} (${explicitTargetEntityId})`,
                    type: 'internal'
                });
            } else {
                // resolvedTargetSuccess = false; // Target specified but resolution failed BOTH ways
                messages.push({
                    text: `Intent Failed: Explicit target '${targetNameGuess}' (parsed IO) specified but could not be resolved uniquely as connection or entity nearby.`,
                    type: 'internal'
                });
                // Note: resolveTargetEntity/Connection should dispatch user-facing messages like TARGET_NOT_FOUND_CONTEXT or AMBIGUOUS_PROMPT
                return {success: false, messages}; // Stop execution, resolution failed.
            }
        }
    } else {
        // No indirect object phrase was parsed.
        // resolvedTargetSuccess = true; // Considered success as no target resolution was needed.
        messages.push({text: `Intent Parse: No explicit target (IO Phrase) parsed.`, type: 'internal'});
    }

    // --- 6. Construct and Dispatch Event ---
    // If we reached here, either no target was needed, or the specified target was resolved successfully.
    if (!eventBus) {
        console.error("executeUse: Critical Error! eventBus is not available.");
        dispatch('ui:message_display', {text: TARGET_MESSAGES.INTERNAL_ERROR, type: 'error'});
        return {success: false, messages};
    }

    /** @type {ItemUseAttemptedEventPayload} */
    const eventPayload = {
        userEntityId: playerEntity.id,
        itemInstanceId: itemInstanceId,
        itemDefinitionId: itemDefinitionId, // Use the resolved definition ID
        explicitTargetEntityId: explicitTargetEntityId, // Populated if IO resolved to entity
        explicitTargetConnectionId: explicitTargetConnectionId, // Populated if IO resolved to connection
    };

    try {
        eventBus.dispatch('event:item_use_attempted', eventPayload);
        let targetLog = explicitTargetEntityId ? ` on entity ${explicitTargetEntityId}` : (explicitTargetConnectionId ? ` on connection ${explicitTargetConnectionId}` : '');
        messages.push({
            text: `Intent Success: Fired event:item_use_attempted for item ${itemDefinitionId}${targetLog}`,
            type: 'internal'
        });
        return {success: true, messages}; // Parsing and dispatch successful
    } catch (error) {
        console.error(`executeUse: Error dispatching event:item_use_attempted:`, error);
        const errorMsg = TARGET_MESSAGES.INTERNAL_ERROR;
        dispatch('ui:message_display', {text: errorMsg, type: 'error'});
        messages.push({text: `Intent Failed: Error dispatching event. ${error.message}`, type: 'error'});
        return {success: false, messages};
    }
}