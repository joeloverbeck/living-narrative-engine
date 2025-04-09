// src/actions/handlers/lookActionHandler.js

// Import necessary components and utilities
import {NameComponent} from '../../components/nameComponent.js';
import {DescriptionComponent} from '../../components/descriptionComponent.js';
import {ConnectionsComponent} from '../../components/connectionsComponent.js';
import {ItemComponent} from '../../components/itemComponent.js';

// Import messages and the new service
import {getDisplayName} from '../../utils/messages.js';
import {resolveTargetEntity} from '../../services/targetResolutionService.js'; // ***** IMPORT NEW SERVICE *****

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
    const messages = []; // Keep for internal logging if needed
    let success = true; // Assume success unless target not found/ambiguous

    if (!currentLocation) {
        const errorMsg = "You can't see anything; your location is unknown.";
        dispatch('ui:message_display', {text: errorMsg, type: 'error'});
        return {success: false, messages: [{text: errorMsg, type: 'error'}]};
    }

    if (targets.length === 0) {
        // --- Look at the current location (Existing logic remains unchanged) ---
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
        const targetName = targets.join(' ');

        // Handle "look self" or "look me" (remains unchanged)
        if (targetName.toLowerCase() === 'self' || targetName.toLowerCase() === 'me') {
            // TODO: Enhance "look self" - show health, equipped items?
            const lookSelfMsg = "You look yourself over. You seem to be in one piece.";
            dispatch('ui:message_display', {text: lookSelfMsg, type: 'info'});
            messages.push({text: lookSelfMsg, type: 'info'});
        } else {
            // --- Use resolveTargetEntity for other targets ---
            const targetEntity = resolveTargetEntity(context, {
                scope: 'nearby', // Search inventory + location (excluding player)
                requiredComponents: [], // Any named entity
                actionVerb: 'look at',
                targetName: targetName,
                // Use default NOT_FOUND_LOCATION message key or customize if needed
                // notFoundMessageKey: 'NOT_FOUND_NEARBY', // Example custom key
                // emptyScopeMessage: "There's nothing nearby matching that description.",
            });

            // --- Handle Resolver Result ---
            if (!targetEntity) {
                // Failure message dispatched by resolver
                success = false;
            } else {
                // --- Display Description ---
                const name = getDisplayName(targetEntity);
                const descComp = targetEntity.getComponent(DescriptionComponent);
                const description = descComp ? descComp.text : `You look closely at the ${name}, but see nothing particularly interesting.`; // Fallback

                dispatch('ui:message_display', {text: description, type: 'info'});
                messages.push({text: `Looked at ${name} (${targetEntity.id})`, type: 'internal'});
                success = true;
            }
        }
    }

    // Return result (success might be false if specific target look failed)
    return {success, messages};
}