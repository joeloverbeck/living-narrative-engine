// --- Core Components ---
import {NameComponent} from '../../components/nameComponent.js';
import {DescriptionComponent} from '../../components/descriptionComponent.js';
import {ConnectionsComponent} from '../../components/connectionsComponent.js';
import {ItemComponent} from '../../components/itemComponent.js';
import {PassageDetailsComponent} from '../../components/passageDetailsComponent.js';

// --- State-Determining Components for Blockers (CONN-9.4) ---
import OpenableComponent from '../../components/openableComponent.js';
import LockableComponent from '../../components/lockableComponent.js';

// --- Utilities and Services ---
import {getDisplayName, TARGET_MESSAGES} from '../../utils/messages.js';
import {handleActionWithTargetResolution} from '../actionExecutionUtils.js';

// --- Type Imports ---
/** @typedef {import('../actionTypes.js').ActionContext} ActionContext */
/** @typedef {import('../actionTypes.js').ActionResult} ActionResult */
/** @typedef {import('../../entities/entity.js').default} Entity */
/** @typedef {import('../../managers/entityManager.js').EntityManager} EntityManager */ // Added for helper type hint
/** @typedef {import('../../types').LocationRenderData} LocationRenderData */
/** @typedef {import('../../components/passageDetailsComponent.js').PassageDetailsComponent} PassageDetailsComponentType */
/** @typedef {import('../actionTypes.js').ActionMessage} ActionMessage */


// --- REFACTOR: Ticket 11 ---
// Internal static helper to get display names of entities in a location matching a predicate.
// Centralizes fetching, filtering, and mapping to names.
/**
 * @param {EntityManager} entityManager
 * @param {string} locationId
 * @param {string | null} excludeEntityId - Entity ID to exclude (e.g., the player).
 * @param {(entity: Entity) => boolean} filterPredicate - Function to filter entities.
 * @returns {string[]} - Array of display names.
 */
const _getVisibleEntityNames = (entityManager, locationId, excludeEntityId, filterPredicate) => {
    const entityIdsInLocation = entityManager.getEntitiesInLocation(locationId);
    return Array.from(entityIdsInLocation)
        .map(id => entityManager.getEntityInstance(id))
        .filter(Boolean) // Remove nulls if an instance wasn't found
        .filter(entity => entity.id !== excludeEntityId) // Exclude specified entity
        .filter(filterPredicate) // Apply custom filter logic
        .map(entity => getDisplayName(entity)); // Map to display name
};

// --- END REFACTOR: Ticket 11 ---


/**
 * Helper function to generate the user-facing description string for an exit.
 * (Function implementation remains unchanged from the provided context)
 * @param {string} direction
 * @param {PassageDetailsComponentType} passageDetails
 * @param {Entity | null} blockerEntity
 * @param {'open' | 'closed' | 'locked' | 'impassable'} effectivePassageState
 * @returns {string}
 */
function formatExitString(direction, passageDetails, blockerEntity, effectivePassageState) {
    const passageType = passageDetails.getType() || 'passage';
    let description = '';

    switch (effectivePassageState) {
        case 'open':
            if (blockerEntity && blockerEntity.hasComponent(OpenableComponent) && blockerEntity.getComponent(OpenableComponent).isOpen) {
                const blockerName = getDisplayName(blockerEntity) || 'blocker';
                description = `an open ${blockerName}`;
            } else {
                switch (passageType.toLowerCase()) {
                    case 'doorway':
                        description = 'an open doorway';
                        break;
                    case 'path':
                        description = 'a path';
                        break;
                    case 'gate':
                        description = 'an open gate';
                        break;
                    case 'archway':
                        description = 'an open archway';
                        break;
                    case 'passage':
                    default:
                        description = 'a passage';
                        break;
                }
            }
            break;
        case 'closed':
            if (blockerEntity) {
                const blockerName = getDisplayName(blockerEntity) || 'blocker';
                description = `a closed ${blockerName}`;
            } else {
                description = `a closed ${passageType}`;
                console.warn(`[formatExitString] Blocker entity missing for 'closed' state on passage type '${passageType}' direction '${direction}'.`);
            }
            break;
        case 'locked':
            if (blockerEntity) {
                const blockerName = getDisplayName(blockerEntity) || 'blocker';
                description = `a locked ${blockerName}`;
            } else {
                description = `a locked ${passageType}`;
                console.warn(`[formatExitString] Blocker entity missing for 'locked' state on passage type '${passageType}' direction '${direction}'.`);
            }
            break;
        case 'impassable':
            if (blockerEntity) {
                const blockerName = getDisplayName(blockerEntity) || 'blocker';
                const capitalizedBlockerName = blockerName.charAt(0).toUpperCase() + blockerName.slice(1);
                description = `${capitalizedBlockerName} blocks the ${passageType}`;
            } else {
                description = `an impassable ${passageType}`;
                console.warn(`[formatExitString] Blocker entity missing for 'impassable' state on passage type '${passageType}' direction '${direction}'.`);
            }
            break;
        default:
            description = `an unknown ${passageType}`;
            console.warn(`[formatExitString] Unexpected effectivePassageState: ${effectivePassageState} for direction '${direction}'.`);
    }

    if (effectivePassageState !== 'impassable' || !blockerEntity) {
        description = description.charAt(0).toUpperCase() + description.slice(1);
    }

    return `${direction}: ${description}`;
}


/**
 * Handles the 'core:look' action.
 * Refactored (Ticket 11) location part to use _getVisibleEntityNames helper.
 * Uses handleActionWithTargetResolution for looking at specific targets.
 * @param {ActionContext} context
 * @returns {Promise<ActionResult>}
 */
export async function executeLook(context) {
    const {currentLocation, entityManager, playerEntity, parsedCommand, eventBus } = context;
    const messages = [];

    if (!currentLocation) {
        const errorMsg = TARGET_MESSAGES.LOOK_LOCATION_UNKNOWN;
        await eventBus.dispatch('ui:message_display', {text: errorMsg, type: 'error'}); // Use eventBus instance
        return {success: false, messages: [{text: errorMsg, type: 'error'}]};
    }

    const targetName = parsedCommand.directObjectPhrase;

    if (!targetName) {
        // --- Look at the current location ---
        messages.push({text: `Look intent: At current location ${currentLocation.id}`, type: 'internal'});
        const nameComp = currentLocation.getComponent(NameComponent);
        const descComp = currentLocation.getComponent(DescriptionComponent);
        const connectionsComp = currentLocation.getComponent(ConnectionsComponent);

        const locationName = nameComp ? nameComp.value : `Unnamed Location (${currentLocation.id})`;
        const locationDesc = descComp ? descComp.text : "You are in an undescribed location.";

        // --- REFACTOR: Ticket 11 ---
        // Use helper to get visible item names
        const itemsVisible = _getVisibleEntityNames(
            entityManager,
            currentLocation.id,
            playerEntity.id, // Exclude player
            entity => entity.hasComponent(ItemComponent) // Filter for items
        );

        // Use helper to get visible NPC names
        const npcsVisible = _getVisibleEntityNames(
            entityManager,
            currentLocation.id,
            playerEntity.id, // Exclude player
            entity => !entity.hasComponent(ItemComponent) // Filter for non-items (basic NPC check)
        );
        // --- END REFACTOR: Ticket 11 ---


        // --- Connection/Exit Processing (Logic remains the same, complexity noted) ---
        const formattedExits = [];
        // ... (existing detailed connection processing loop remains here) ...
        // (No changes to the loop itself based on the refactoring ticket's constraints)
        // ... (rest of the connection processing loop) ...
        if (connectionsComp) {
            const allConnections = connectionsComp.getAllConnections();
            for (const {direction, connectionEntityId} of allConnections) {
                let connectionEntity = null;
                let passageDetailsComp = null;
                let blockerEntity = null;
                let effectivePassageState = "open"; // Default

                try {
                    connectionEntity = entityManager.getEntityInstance(connectionEntityId);
                    if (!connectionEntity) continue; // Skip if connection entity missing

                    passageDetailsComp = connectionEntity.getComponent(PassageDetailsComponent);
                    if (!passageDetailsComp || passageDetailsComp.isHidden()) continue; // Skip if no details or hidden

                    const blockerId = passageDetailsComp.getBlockerId();
                    if (blockerId) {
                        blockerEntity = entityManager.getEntityInstance(blockerId);
                        // Note: Warning if blockerEntity not found is good, but proceed without it for exit desc
                    }

                    // Determine effective state based on blocker (existing logic)
                    if (blockerEntity) {
                        const lockableComp = blockerEntity.getComponent(LockableComponent);
                        const openableComp = blockerEntity.getComponent(OpenableComponent);
                        if (lockableComp?.isLocked) effectivePassageState = "locked";
                        else if (openableComp) effectivePassageState = openableComp.isOpen ? "open" : "closed";
                        else if (lockableComp && !lockableComp.isLocked) effectivePassageState = "open";
                        else effectivePassageState = "impassable"; // Blocker exists but no state components
                    } // else: no blocker, state remains 'open'

                    const exitString = formatExitString(direction, passageDetailsComp, blockerEntity, effectivePassageState);
                    formattedExits.push(exitString);

                } catch (error) {
                    console.error(`LookActionHandler: Error processing connection '${connectionEntityId}' (direction '${direction}'):`, error);
                }
            }
        }
        // --- End Connection/Exit Processing ---


        const finalExits = formattedExits.length > 0 ? formattedExits : undefined;

        const locationData = {
            name: locationName,
            description: locationDesc,
            exits: finalExits,
            items: itemsVisible.length > 0 ? itemsVisible : undefined,
            npcs: npcsVisible.length > 0 ? npcsVisible : undefined,
        };

        await eventBus.dispatch('ui:display_location', locationData);

        messages.push({text: `Displayed location ${currentLocation.id}`, type: 'internal'});
        return {success: true, messages: messages, newState: undefined};

    } else if (targetName.toLowerCase() === 'self' || targetName.toLowerCase() === 'me') {
        // --- Look at self (Unchanged) ---
        messages.push({text: `Look intent: At self`, type: 'internal'});
        const lookSelfMsg = TARGET_MESSAGES.LOOK_SELF;
        await eventBus.dispatch('ui:message_display', {text: lookSelfMsg, type: 'info'});
        messages.push({text: lookSelfMsg, type: 'info'});
        return {success: true, messages: messages, newState: undefined};

    } else {
        // --- Look at specific target (Uses standard helper - Unchanged) ---
        messages.push({
            text: `Look intent: At target '${targetName}' using handleActionWithTargetResolution`,
            type: 'internal'
        });

        const onFoundUniqueLookTarget = (innerContext, targetEntity, accumulatedMessages) => {
            const name = getDisplayName(targetEntity);
            const descComp = targetEntity.getComponent(DescriptionComponent);
            const description = descComp ? descComp.text : TARGET_MESSAGES.LOOK_DEFAULT_DESCRIPTION(name);
            innerContext.eventBus.dispatch('ui:message_display', {text: description, type: 'info'});
            // No need to modify accumulatedMessages directly; utility handles merging.
            return {success: true, messages: []};
        };

        const options = {
            scope: 'nearby',
            requiredComponents: [],
            commandPart: 'directObjectPhrase',
            actionVerb: 'look at',
            onFoundUnique: onFoundUniqueLookTarget,
            failureMessages: {
                notFound: TARGET_MESSAGES.NOT_FOUND_EXAMINABLE, // Use more specific message for look
                // Using NOT_FOUND_LOCATION was also reasonable, switched to EXAMINABLE
            },
        };

        return await handleActionWithTargetResolution(context, options);
    }
}