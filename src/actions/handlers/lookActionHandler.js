// src/actions/handlers/lookActionHandler.js

import {NameComponent} from '../../components/nameComponent.js';
import {DescriptionComponent} from '../../components/descriptionComponent.js';
import {ConnectionsComponent} from '../../components/connectionsComponent.js';
import {ItemComponent} from '../../components/itemComponent.js';
import {getDisplayName, TARGET_MESSAGES} from '../../utils/messages.js';
import {resolveTargetEntity} from '../../services/targetResolutionService.js';


/** @typedef {import('../actionTypes.js').ActionContext} ActionContext */
/** @typedef {import('../actionTypes.js').ActionResult} ActionResult */
/** @typedef {import('../../src/entities/entity.js').default} Entity */

/** @typedef {import('../../types').LocationRenderData} LocationRenderData */

/**
 * Handles the 'core:action_look' action. Dispatches messages directly via context.dispatch.
 * Uses TargetResolutionService for looking at specific targets (nearby scope).
 * @param {ActionContext} context
 * @returns {ActionResult}
 */
export function executeLook(context) {
    const {currentLocation, targets, entityManager, playerEntity, dispatch} = context;
    const messages = [];
    let success = true;

    if (!currentLocation) {
        // --- REFACTORED --- Use TARGET_MESSAGES
        const errorMsg = TARGET_MESSAGES.LOOK_LOCATION_UNKNOWN;
        dispatch('ui:message_display', {text: errorMsg, type: 'error'});
        // Still return the message for internal logging/result tracking
        return {success: false, messages: [{text: errorMsg, type: 'error'}]};
    }

    if (targets.length === 0) {
        // --- Look at the current location (Existing logic - No feedback strings here to refactor) ---
        const nameComp = currentLocation.getComponent(NameComponent);
        const descComp = currentLocation.getComponent(DescriptionComponent);
        const connectionsComp = currentLocation.getComponent(ConnectionsComponent);

        const locationName = nameComp ? nameComp.value : `Unnamed Location (${currentLocation.id})`;
        const locationDesc = descComp ? descComp.text : "You are in an undescribed location."; // Note: Room description isn't a feedback message in the same category, leaving as is.

        const entityIdsInLocation = entityManager.getEntitiesInLocation(currentLocation.id);
        const entitiesInLocation = Array.from(entityIdsInLocation)
            .map(id => entityManager.getEntityInstance(id))
            .filter(entity => entity);

        let itemsVisible = entitiesInLocation
            .filter(entity => entity.hasComponent(ItemComponent))
            .map(itemEntity => getDisplayName(itemEntity));

        let npcsVisible = entitiesInLocation
            .filter(entity => entity.id !== playerEntity.id && !entity.hasComponent(ItemComponent))
            .map(npcEntity => getDisplayName(npcEntity));

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
        messages.push({text: `Displayed location ${currentLocation.id}`, type: 'internal'});

    } else {
        // --- Look at a specific target ---
        // (Validation check from previous ticket could go here if needed, but not part of this ticket's changes)
        // if (!validateRequiredTargets(context, 'look at')) {
        //     return { success: false, messages: [], newState: undefined };
        // }

        const targetName = targets.join(' ');

        if (targetName.toLowerCase() === 'self' || targetName.toLowerCase() === 'me') {
            // --- REFACTORED --- Use TARGET_MESSAGES
            const lookSelfMsg = TARGET_MESSAGES.LOOK_SELF;
            dispatch('ui:message_display', {text: lookSelfMsg, type: 'info'});
            messages.push({text: lookSelfMsg, type: 'info'}); // Keep internal log
            // success remains true
        } else {
            // --- Use resolveTargetEntity for other targets ---
            const targetEntity = resolveTargetEntity(context, {
                scope: 'nearby', // Search inventory + location
                requiredComponents: [], // Any named entity
                actionVerb: 'look at',
                targetName: targetName,
                // Optional: could add notFoundMessageKey: 'NOT_FOUND_LOCATION' etc. if needed, but resolver defaults are probably fine for 'look'
            });

            // --- Handle Resolver Result ---
            if (!targetEntity) {
                // Failure message dispatched by resolver (which already uses TARGET_MESSAGES)
                success = false; // Look failed
            } else {
                // --- Display Description ---
                const name = getDisplayName(targetEntity);
                const descComp = targetEntity.getComponent(DescriptionComponent);
                // --- REFACTORED --- Use TARGET_MESSAGES for fallback
                const description = descComp ? descComp.text : TARGET_MESSAGES.LOOK_DEFAULT_DESCRIPTION(name); // Use template function

                dispatch('ui:message_display', {text: description, type: 'info'});
                messages.push({text: `Looked at ${name} (${targetEntity.id})`, type: 'internal'});
                success = true;
            }
        }
    }

    // Return result
    return {success, messages};
}