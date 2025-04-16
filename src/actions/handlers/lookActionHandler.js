// src/actions/handlers/lookActionHandler.js

// --- Core Components ---
import {NameComponent} from '../../components/nameComponent.js';
import {DescriptionComponent} from '../../components/descriptionComponent.js';
import {ConnectionsComponent} from '../../components/connectionsComponent.js';
import {ItemComponent} from '../../components/itemComponent.js';
import {PassageDetailsComponent} from '../../components/passageDetailsComponent.js';
import {PositionComponent} from '../../components/positionComponent.js'; // Ensure this is imported if needed

// --- State-Determining Components for Blockers ---
import OpenableComponent from '../../components/openableComponent.js';
import LockableComponent from '../../components/lockableComponent.js';

// --- Utilities and Services ---
import {getDisplayName, TARGET_MESSAGES} from '../../utils/messages.js';
import {handleActionWithTargetResolution} from '../actionExecutionUtils.js';

// --- Type Imports ---
/** @typedef {import('../actionTypes.js').ActionContext} ActionContext */
/** @typedef {import('../actionTypes.js').ActionResult} ActionResult */
/** @typedef {import('../../entities/entity.js').default} Entity */
/** @typedef {import('../../managers/entityManager.js').EntityManager} EntityManager */
/** @typedef {import('../../types').LocationRenderData} LocationRenderData */
/** @typedef {import('../../components/passageDetailsComponent.js').PassageDetailsComponent} PassageDetailsComponentType */
/** @typedef {import('../actionTypes.js').ActionMessage} ActionMessage */

// --- Helper Function: _getVisibleEntityNames ---
/**
 * Gets display names of entities in a location matching a predicate.
 * @param {EntityManager} entityManager
 * @param {string} locationId
 * @param {string | null} excludeEntityId
 * @param {(entity: Entity) => boolean} filterPredicate
 * @returns {string[]}
 */
const _getVisibleEntityNames = (entityManager, locationId, excludeEntityId, filterPredicate) => {
    const entityIdsInLocation = entityManager.getEntitiesInLocation(locationId);
    return Array.from(entityIdsInLocation)
        .map(id => entityManager.getEntityInstance(id))
        .filter(Boolean)
        .filter(entity => entity.id !== excludeEntityId)
        .filter(filterPredicate)
        .map(entity => getDisplayName(entity));
};

// --- Helper Function: formatExitString ---
/**
 * Generates the user-facing description string for an exit.
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
        if (typeof description === 'string' && description.length > 0) {
            description = description.charAt(0).toUpperCase() + description.slice(1);
        }
    }

    return `${direction}: ${description}`;
}

// --- Main Action Handler: executeLook ---
/**
 * Handles the 'core:look' action.
 * @param {ActionContext} context
 * @returns {Promise<ActionResult>}
 */
export async function executeLook(context) {
    const {currentLocation, entityManager, playerEntity, parsedCommand, eventBus} = context;
    const messages = [];

    // --- Handle Missing Location ---
    if (!currentLocation) {
        const errorMsg = TARGET_MESSAGES.LOOK_LOCATION_UNKNOWN;
        await eventBus.dispatch('ui:message_display', {text: errorMsg, type: 'error'});
        return {success: false, messages: [{text: errorMsg, type: 'error'}]};
    }

    const targetName = parsedCommand.directObjectPhrase;

    // --- Case 1: Look at Current Location ---
    if (!targetName) {
        messages.push({text: `Look intent: At current location ${currentLocation.id}`, type: 'internal'});
        const nameComp = currentLocation.getComponent(NameComponent);
        const descComp = currentLocation.getComponent(DescriptionComponent);
        const connectionsComp = currentLocation.getComponent(ConnectionsComponent);

        const locationName = nameComp ? nameComp.value : `Unnamed Location (${currentLocation.id})`;
        const locationDesc = descComp ? descComp.text : "You are in an undescribed location.";

        // --- Get Items/NPCs ---
        const itemsVisible = _getVisibleEntityNames(entityManager, currentLocation.id, playerEntity.id, entity => entity.hasComponent(ItemComponent));
        const npcsVisible = _getVisibleEntityNames(entityManager, currentLocation.id, playerEntity.id, entity => !entity.hasComponent(ItemComponent));

        // --- Connection/Exit Processing ---
        const formattedExits = [];
        let allConnections = []; // Default to empty array

        // +++ Start Debug Block for Connections Component +++
        console.log(`[EXECUTE_LOOK DEBUG] Checking connectionsComp for ${currentLocation.id}:`);
        if (connectionsComp) {
            try {
                allConnections = connectionsComp.getAllConnections(); // Assign to the variable used by the loop
                console.log(`[EXECUTE_LOOK DEBUG] Result of getAllConnections():`, allConnections);
                console.log(`[EXECUTE_LOOK DEBUG] Type of result:`, typeof allConnections);
                console.log(`[EXECUTE_LOOK DEBUG] Is result Array?`, Array.isArray(allConnections));
                console.log(`[EXECUTE_LOOK DEBUG] Result length:`, Array.isArray(allConnections) ? allConnections.length : 'N/A (Not Array)');
            } catch (e) {
                console.error('[EXECUTE_LOOK DEBUG] Error calling getAllConnections():', e);
                allConnections = []; // Ensure it's an empty array on error
            }
        } else {
            console.log(`[EXECUTE_LOOK DEBUG] connectionsComp is NULL or undefined for ${currentLocation.id}.`);
        }
        // +++ End Debug Block for Connections Component +++

        // Iterate over connections (safe loop as allConnections is guaranteed array)
        for (const {direction, connectionEntityId} of allConnections) {
            console.log(`[EXECUTE_LOOK DEBUG] --- Loop Body Entered for direction: ${direction}, ID: ${connectionEntityId} ---`); // Log loop entry
            let connectionEntity = null;
            let passageDetailsComp = null;
            let blockerEntity = null;
            let effectivePassageState = "open"; // Default

            try {
                // --- Fetch Connection Entity ---
                console.log(`[DEBUG] Processing connection: ${connectionEntityId} (Direction: ${direction})`);
                connectionEntity = entityManager.getEntityInstance(connectionEntityId);
                console.log(`[DEBUG] Fetched connectionEntity:`, connectionEntity ? connectionEntity.id : 'NULL');
                if (!connectionEntity) {
                    console.warn(`Could not find connection entity with ID: ${connectionEntityId}`);
                    console.log(`[DEBUG] CONTINUING (loop iteration) because !connectionEntity`);
                    continue; // Skip this iteration
                }

                // --- Fetch Passage Details ---
                passageDetailsComp = connectionEntity.getComponent(PassageDetailsComponent);
                console.log(`[DEBUG] Fetched passageDetailsComp:`, passageDetailsComp ? 'Exists' : 'NULL');
                let isHiddenStatus = 'N/A (No Comp)';
                if (passageDetailsComp) {
                    isHiddenStatus = passageDetailsComp.isHidden();
                    console.log(`[DEBUG] isHidden() returned: ${isHiddenStatus} (Type: ${typeof isHiddenStatus})`);
                }
                if (!passageDetailsComp || isHiddenStatus === true) {
                    console.log(`[DEBUG] CONTINUING (loop iteration) because !passageDetailsComp or isHidden is true`);
                    continue; // Skip this iteration
                }

                // --- Process Blocker ---
                const blockerId = passageDetailsComp.getBlockerId();
                console.log(`[DEBUG] Blocker ID from getBlockerId():`, blockerId, `(Type: ${typeof blockerId})`);
                if (blockerId) {
                    blockerEntity = entityManager.getEntityInstance(blockerId);
                    console.log(`[DEBUG] Fetched blockerEntity for ID ${blockerId}:`, blockerEntity ? blockerEntity.id : 'NULL');
                    if (!blockerEntity) {
                        // *** THE EXPECTED WARNING FOR THE FAILING TEST ***
                        console.warn(`Blocker entity with ID '${blockerId}' not found for connection ${connectionEntityId}. Treating passage as unblocked.`);
                    }
                } else {
                    console.log(`[DEBUG] No blockerId specified.`);
                }

                // --- Determine State ---
                if (blockerEntity) {
                    const lockableComp = blockerEntity.getComponent(LockableComponent);
                    const openableComp = blockerEntity.getComponent(OpenableComponent);
                    if (lockableComp?.isLocked) effectivePassageState = "locked";
                    else if (openableComp) effectivePassageState = openableComp.isOpen ? "open" : "closed";
                    else if (lockableComp && !lockableComp.isLocked) effectivePassageState = "open"; // Assumed open if lockable but unlocked
                    else effectivePassageState = "impassable"; // Generic blocker
                    console.log(`[DEBUG] Blocker found. State: ${effectivePassageState}`);
                } else {
                    effectivePassageState = "open"; // Default if no blocker
                    console.log(`[DEBUG] No blocker. State defaults to: ${effectivePassageState}`);
                }

                // --- Format & Add Exit ---
                const exitString = formatExitString(direction, passageDetailsComp, blockerEntity, effectivePassageState);
                formattedExits.push(exitString);
                console.log(`[DEBUG] Added exit string: "${exitString}"`);

            } catch (error) {
                console.error(`LookActionHandler: Error processing connection '${connectionEntityId}' (direction '${direction}'):`, error);
                console.log(`[DEBUG] CAUGHT error during processing for connection ${connectionEntityId}`);
            }
        } // --- End of Connection Loop ---

        // --- Prepare and Dispatch Event ---
        const finalExits = formattedExits.length > 0 ? formattedExits : undefined;
        const locationData = {
            name: locationName,
            description: locationDesc,
            exits: finalExits,
            items: itemsVisible.length > 0 ? itemsVisible : undefined,
            npcs: npcsVisible.length > 0 ? npcsVisible : undefined,
        };
        console.log("[EXECUTE_LOOK DEBUG] Dispatching ui:display_location with payload:", JSON.stringify(locationData));
        await eventBus.dispatch('ui:display_location', locationData);

        messages.push({text: `Displayed location ${currentLocation.id}`, type: 'internal'});
        return {success: true, messages: messages, newState: undefined};

        // --- Case 2: Look at Self ---
    } else if (targetName.toLowerCase() === 'self' || targetName.toLowerCase() === 'me') {
        messages.push({text: `Look intent: At self`, type: 'internal'});
        const lookSelfMsg = TARGET_MESSAGES.LOOK_SELF;
        await eventBus.dispatch('ui:message_display', {text: lookSelfMsg, type: 'info'});
        messages.push({text: lookSelfMsg, type: 'info'});
        return {success: true, messages: messages, newState: undefined};

        // --- Case 3: Look at Specific Target ---
    } else {
        messages.push({
            text: `Look intent: At target '${targetName}' using handleActionWithTargetResolution`,
            type: 'internal'
        });

        const onFoundUniqueLookTarget = async (innerContext, targetEntity, accumulatedMessages) => {
            const name = getDisplayName(targetEntity);
            const descComp = targetEntity.getComponent(DescriptionComponent);
            const description = descComp ? descComp.text : TARGET_MESSAGES.LOOK_DEFAULT_DESCRIPTION(name);
            await innerContext.eventBus.dispatch('ui:message_display', {text: description, type: 'info'});
            // Return minimal result, letting handleAction manage overall messages if appropriate
            return {success: true, messages: [{text: description, type: 'info'}]};
        };

        const options = {
            scope: 'nearby', // Look in location + inventory
            requiredComponents: [], // Nothing specific required to look
            commandPart: 'directObjectPhrase',
            actionVerb: 'look at',
            onFoundUnique: onFoundUniqueLookTarget,
            failureMessages: {
                notFound: TARGET_MESSAGES.NOT_FOUND_EXAMINABLE(targetName),
                // Add notUnique etc. if needed
            },
        };
        return await handleActionWithTargetResolution(context, options);
    }
}