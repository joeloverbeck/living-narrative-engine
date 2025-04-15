// src/actions/handlers/lookActionHandler.js

// --- Core Components ---
import {NameComponent} from '../../components/nameComponent.js';
import {DescriptionComponent} from '../../components/descriptionComponent.js';
import {ConnectionsComponent} from '../../components/connectionsComponent.js';
import {ItemComponent} from '../../components/itemComponent.js';
// --- Utilities and Services ---
import {getDisplayName, TARGET_MESSAGES} from '../../utils/messages.js';
import {resolveTargetEntity} from '../../services/entityFinderService.js';

// --- Type Imports ---
/** @typedef {import('../actionTypes.js').ActionContext} ActionContext */
/** @typedef {import('../actionTypes.js').ActionResult} ActionResult */
/** @typedef {import('../../entities/entity.js').default} Entity */
/** @typedef {import('../../types').LocationRenderData} LocationRenderData */ // Assuming this type exists

/**
 * Handles the 'core:look' action. Dispatches messages directly via context.dispatch.
 * Uses resolveTargetEntity service for looking at specific targets.
 * @param {ActionContext} context
 * @returns {ActionResult}
 */
export function executeLook(context) {
    const {currentLocation, entityManager, playerEntity, dispatch, parsedCommand} = context;
    const messages = [];
    let success = true; // Assume success unless resolution fails

    if (!currentLocation) {
        const errorMsg = TARGET_MESSAGES.LOOK_LOCATION_UNKNOWN;
        dispatch('ui:message_display', {text: errorMsg, type: 'error'});
        return {success: false, messages: [{text: errorMsg, type: 'error'}]};
    }

    const targetName = parsedCommand.directObjectPhrase;

    if (!targetName) {
        // --- Look at the current location (No change needed here) ---
        messages.push({text: `Look intent: At current location ${currentLocation.id}`, type: 'internal'});
        const nameComp = currentLocation.getComponent(NameComponent);
        const descComp = currentLocation.getComponent(DescriptionComponent);
        const connectionsComp = currentLocation.getComponent(ConnectionsComponent);

        const locationName = nameComp ? nameComp.value : `Unnamed Location (${currentLocation.id})`;
        const locationDesc = descComp ? descComp.text : "You are in an undescribed location.";

        // Logic to get items, NPCs, exits (simplified from original)
        const entityIdsInLocation = entityManager.getEntitiesInLocation(currentLocation.id);
        const entitiesInLocation = Array.from(entityIdsInLocation)
            .map(id => entityManager.getEntityInstance(id))
            .filter(Boolean); // Filter out nulls

        const itemsVisible = entitiesInLocation
            .filter(entity => entity.hasComponent(ItemComponent))
            .map(itemEntity => getDisplayName(itemEntity));

        const npcsVisible = entitiesInLocation
            .filter(entity => entity.id !== playerEntity.id && !entity.hasComponent(ItemComponent))
            .map(npcEntity => getDisplayName(npcEntity));

        const availableDirections = connectionsComp?.getAvailableDirections() ?? []; // Use helper if available

        const locationData = {
            name: locationName,
            description: locationDesc,
            exits: availableDirections.length > 0 ? availableDirections : undefined,
            items: itemsVisible.length > 0 ? itemsVisible : undefined,
            npcs: npcsVisible.length > 0 ? npcsVisible : undefined,
        };

        dispatch('ui:display_location', locationData);
        messages.push({text: `Displayed location ${currentLocation.id}`, type: 'internal'});
        success = true; // Looking at location is always successful if location exists

    } else if (targetName.toLowerCase() === 'self' || targetName.toLowerCase() === 'me') {
        // --- Look at self (No change needed here) ---
        messages.push({text: `Look intent: At self`, type: 'internal'});
        const lookSelfMsg = TARGET_MESSAGES.LOOK_SELF;
        dispatch('ui:message_display', {text: lookSelfMsg, type: 'info'});
        messages.push({text: lookSelfMsg, type: 'info'});
        success = true;

    } else {
        // --- Look at a specific target (Refactored) ---
        messages.push({text: `Look intent: At target '${targetName}'`, type: 'internal'});

        // --- Use resolveTargetEntity for other targets ---
        const resolution = resolveTargetEntity(context, {
            scope: 'nearby', // Search inventory + location
            requiredComponents: [], // Any named entity
            actionVerb: 'look at', // For potential message construction
            targetName: targetName,
        });

        // --- Handle Resolver Result ---
        switch (resolution.status) {
            case 'FOUND_UNIQUE': {
                const targetEntity = resolution.entity;
                const name = getDisplayName(targetEntity);
                const descComp = targetEntity.getComponent(DescriptionComponent);
                const description = descComp ? descComp.text : TARGET_MESSAGES.LOOK_DEFAULT_DESCRIPTION(name);

                dispatch('ui:message_display', {text: description, type: 'info'});
                messages.push({text: `Looked at ${name} (${targetEntity.id})`, type: 'internal'});
                success = true;
                break;
            }
            case 'NOT_FOUND': {
                // Use a message suitable for "look", maybe NOT_FOUND_LOCATION is okay,
                // or a more generic one if inventory was also searched.
                const feedbackMsg = TARGET_MESSAGES.NOT_FOUND_LOCATION(targetName);
                dispatch('ui:message_display', {text: feedbackMsg, type: 'info'});
                messages.push({text: `Resolution failed: NOT_FOUND. User message: "${feedbackMsg}"`, type: 'internal'});
                success = false;
                break;
            }
            case 'AMBIGUOUS': {
                const feedbackMsg = TARGET_MESSAGES.AMBIGUOUS_PROMPT('look at', targetName, resolution.candidates);
                dispatch('ui:message_display', {text: feedbackMsg, type: 'warning'});
                messages.push({text: `Resolution failed: AMBIGUOUS. User message: "${feedbackMsg}"`, type: 'internal'});
                success = false;
                break;
            }
            case 'FILTER_EMPTY': {
                // 'nearby' scope was empty or filtered empty.
                const feedbackMsg = TARGET_MESSAGES.SCOPE_EMPTY_GENERIC('look at', 'nearby');
                dispatch('ui:message_display', {text: feedbackMsg, type: 'info'});
                messages.push({
                    text: `Resolution failed: FILTER_EMPTY. User message: "${feedbackMsg}"`,
                    type: 'internal'
                });
                success = false;
                break;
            }
            case 'INVALID_INPUT': {
                const feedbackMsg = TARGET_MESSAGES.INTERNAL_ERROR;
                dispatch('ui:message_display', {text: feedbackMsg, type: 'error'});
                messages.push({
                    text: `Resolution failed: INVALID_INPUT. Configuration error calling resolveTargetEntity.`,
                    type: 'internal_error'
                });
                console.error(`executeLook: resolveTargetEntity returned INVALID_INPUT for target '${targetName}'. Context/Config issue?`);
                success = false;
                break;
            }
            default: {
                const feedbackMsg = TARGET_MESSAGES.INTERNAL_ERROR;
                dispatch('ui:message_display', {text: feedbackMsg, type: 'error'});
                messages.push({
                    text: `Resolution failed: Unhandled status '${resolution.status}'`,
                    type: 'internal_error'
                });
                console.error(`executeLook: Unhandled resolution status: ${resolution.status}`);
                success = false;
                break;
            }
        } // End switch
    } // End else (specific target)

    // Return result
    return {success, messages, newState: undefined};
}