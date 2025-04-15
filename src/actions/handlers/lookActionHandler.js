// src/actions/handlers/lookActionHandler.js

// --- Core Components ---
import {NameComponent} from '../../components/nameComponent.js';
import {DescriptionComponent} from '../../components/descriptionComponent.js';
import {ConnectionsComponent} from '../../components/connectionsComponent.js';
import {ItemComponent} from '../../components/itemComponent.js';
import {PassageDetailsComponent} from '../../components/passageDetailsComponent.js';

// --- State-Determining Components for Blockers (CONN-9.4) ---
import OpenableComponent from '../../components/openableComponent.js';
import LockableComponent from '../../components/lockableComponent.js';
// import { StateComponent } from '../../components/stateComponent.js'; // Add if needed later

// --- Utilities and Services ---
import {getDisplayName, TARGET_MESSAGES} from '../../utils/messages.js';
import {resolveTargetEntity} from '../../services/entityFinderService.js';

// --- Type Imports ---
/** @typedef {import('../actionTypes.js').ActionContext} ActionContext */
/** @typedef {import('../actionTypes.js').ActionResult} ActionResult */
/** @typedef {import('../../entities/entity.js').default} Entity */
/** @typedef {import('../../types').LocationRenderData} LocationRenderData */
/** @typedef {import('../../components/passageDetailsComponent.js').PassageDetailsComponent} PassageDetailsComponentType */


/**
 * Helper function to generate the user-facing description string for an exit.
 * Implements CONN-9.5 formatting logic.
 *
 * @param {string} direction - The direction key (e.g., 'north', 'enter door').
 * @param {PassageDetailsComponentType} passageDetails - The passage details component.
 * @param {Entity | null} blockerEntity - The blocker entity instance, or null.
 * @param {'open' | 'closed' | 'locked' | 'impassable'} effectivePassageState - The calculated state.
 * @returns {string} The formatted exit string (e.g., "north: An open doorway").
 */
function formatExitString(direction, passageDetails, blockerEntity, effectivePassageState) {
    const passageType = passageDetails.getType() || 'passage'; // Default type
    let description = '';

    switch (effectivePassageState) {
        case 'open':
            // More nuanced description if an openable blocker is explicitly open
            if (blockerEntity && blockerEntity.hasComponent(OpenableComponent) && blockerEntity.getComponent(OpenableComponent).isOpen) {
                const blockerName = getDisplayName(blockerEntity) || 'blocker';
                // Use 'an'/'a' based on blocker name? Simple 'an open' for now.
                description = `an open ${blockerName}`; // e.g., "an open wooden door"
            } else {
                // Generic description based on type for open passages without specific openable blockers
                switch (passageType.toLowerCase()) { // Use lowercase for matching
                    case 'doorway': description = 'an open doorway'; break;
                    case 'path': description = 'a path'; break;
                    case 'gate': description = 'an open gate'; break;
                    case 'archway': description = 'an open archway'; break;
                    case 'passage': // Fallthrough for default
                    default: description = 'a passage'; break;
                }
            }
            break;

        case 'closed':
            if (blockerEntity) {
                const blockerName = getDisplayName(blockerEntity) || 'blocker';
                // Use 'a'/'an'? Simple 'a closed' for now.
                description = `a closed ${blockerName}`; // e.g., "a closed oak door"
            } else {
                description = `a closed ${passageType}`; // Fallback if blocker missing somehow
                console.warn(`[formatExitString] Blocker entity missing for 'closed' state on passage type '${passageType}' direction '${direction}'.`);
            }
            break;

        case 'locked':
            if (blockerEntity) {
                const blockerName = getDisplayName(blockerEntity) || 'blocker';
                // Use 'a'/'an'? Simple 'a locked' for now.
                description = `a locked ${blockerName}`; // e.g., "a locked iron gate"
            } else {
                description = `a locked ${passageType}`; // Fallback
                console.warn(`[formatExitString] Blocker entity missing for 'locked' state on passage type '${passageType}' direction '${direction}'.`);
            }
            break;

        case 'impassable':
            if (blockerEntity) {
                const blockerName = getDisplayName(blockerEntity) || 'blocker';
                // Capitalize blocker name as it starts the description part here
                const capitalizedBlockerName = blockerName.charAt(0).toUpperCase() + blockerName.slice(1);
                description = `${capitalizedBlockerName} blocks the ${passageType}`; // e.g., "A boulder blocks the passage"
            } else {
                description = `an impassable ${passageType}`; // Fallback if blocker missing
                console.warn(`[formatExitString] Blocker entity missing for 'impassable' state on passage type '${passageType}' direction '${direction}'.`);
            }
            break;

        default:
            description = `an unknown ${passageType}`; // Should not happen
            console.warn(`[formatExitString] Unexpected effectivePassageState: ${effectivePassageState} for direction '${direction}'.`);
    }

    // Capitalize the first letter of the description for consistent output.
    // Exception: 'impassable' with blocker already capitalized the blocker name.
    if (effectivePassageState !== 'impassable' || !blockerEntity) {
        description = description.charAt(0).toUpperCase() + description.slice(1);
    }


    // Return in the final format: "{direction}: {Description}"
    // Capitalize direction for display consistency? Maybe keep as-is from component for now.
    // Let's keep direction as stored (lowercase, trimmed) for now.
    return `${direction}: ${description}`; // AC1 (Function exists), AC2 (Logic handles combinations)
}


/**
 * Handles the 'core:look' action. Dispatches messages directly via context.dispatch.
 * Uses resolveTargetEntity service for looking at specific targets.
 * Refactored in CONN-9.1 to process connections when looking at the location.
 * Refactored in CONN-9.2 to filter hidden connections.
 * Refactored in CONN-9.3 to fetch blocker entities for visible connections.
 * Refactored in CONN-9.4 to evaluate blocker state for visible connections.
 * Refactored in CONN-9.5 to format exit strings and populate locationData.exits.
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
        // --- Look at the current location ---
        messages.push({text: `Look intent: At current location ${currentLocation.id}`, type: 'internal'});
        const nameComp = currentLocation.getComponent(NameComponent);
        const descComp = currentLocation.getComponent(DescriptionComponent);
        const connectionsComp = currentLocation.getComponent(ConnectionsComponent);

        const locationName = nameComp ? nameComp.value : `Unnamed Location (${currentLocation.id})`;
        const locationDesc = descComp ? descComp.text : "You are in an undescribed location.";

        // Logic to get items, NPCs (unchanged)
        const entityIdsInLocation = entityManager.getEntitiesInLocation(currentLocation.id);
        const entitiesInLocation = Array.from(entityIdsInLocation)
            .map(id => entityManager.getEntityInstance(id))
            .filter(Boolean);

        const itemsVisible = entitiesInLocation
            .filter(entity => entity.hasComponent(ItemComponent))
            .map(itemEntity => getDisplayName(itemEntity));

        const npcsVisible = entitiesInLocation
            .filter(entity => entity.id !== playerEntity.id && !entity.hasComponent(ItemComponent))
            .map(npcEntity => getDisplayName(npcEntity));

        // === START: CONN-9.5 Initialization ===
        const formattedExits = []; // Create temporary array before the loop
        // We don't strictly need visibleConnectionsData outside the loop anymore,
        // but keeping it for logging clarity below.
        const visibleConnectionsData = [];
        // === END: CONN-9.5 Initialization ===

        console.log(`[LOOK HANDLER LOG] Starting connection processing for location: ${currentLocation.id}`);

        if (connectionsComp) {
            const allConnections = connectionsComp.getAllConnections();

            for (const { direction, connectionEntityId } of allConnections) {
                let connectionEntity = null;
                let passageDetailsComp = null;
                let blockerEntity = null;
                let effectivePassageState = "open"; // Default

                try {
                    connectionEntity = entityManager.getEntityInstance(connectionEntityId);
                    if (!connectionEntity) {
                        console.warn(`LookActionHandler: Connection entity '${connectionEntityId}' (direction '${direction}' from '${currentLocation.id}') not found.`);
                        continue;
                    }

                    passageDetailsComp = connectionEntity.getComponent(PassageDetailsComponent);
                    if (!passageDetailsComp) {
                        console.warn(`LookActionHandler: Connection entity '${connectionEntityId}' (direction '${direction}') lacks PassageDetailsComponent.`);
                        continue;
                    }

                    // === START: CONN-9.2 Filter Hidden ===
                    const hidden = passageDetailsComp.isHidden();
                    if (hidden) {
                        console.log(`  [LOOK HANDLER LOG] -> Skipping hidden connection: ${connectionEntityId} (Direction: ${direction})`);
                        continue; // Skip to next connection
                    }
                    // === END: CONN-9.2 Filter Hidden ===

                    // --- Processing for VISIBLE connections continues below ---

                    // === START: CONN-9.3 Fetch Blocker ===
                    const blockerId = passageDetailsComp.getBlockerId();
                    if (blockerId) {
                        // Fetch logic from CONN-9.3
                        blockerEntity = entityManager.getEntityInstance(blockerId);
                        if (!blockerEntity) {
                            console.warn(`LookActionHandler: Failed to fetch blocker entity '${blockerId}' for connection '${connectionEntityId}'.`);
                        }
                    }
                    // === END: CONN-9.3 Fetch Blocker ===


                    // === START: CONN-9.4 Evaluate Blocker State ===
                    // State evaluation logic from CONN-9.4
                    if (blockerEntity) {
                        const lockableComp = blockerEntity.getComponent(LockableComponent);
                        const openableComp = blockerEntity.getComponent(OpenableComponent);

                        if (lockableComp && lockableComp.isLocked) {
                            effectivePassageState = "locked";
                        } else if (openableComp) {
                            effectivePassageState = openableComp.isOpen ? "open" : "closed";
                        } else if (lockableComp && !lockableComp.isLocked) {
                            effectivePassageState = "open"; // Lockable but unlocked, treat as open if not explicitly closeable
                        } else {
                            effectivePassageState = "impassable"; // Blocker exists but no standard state components
                            console.warn(`    [LOOK HANDLER LOG] -> Blocker ${blockerEntity.id} exists but lacks standard state components (Lockable, Openable). Marking passage as IMPASSABLE.`);
                        }
                    } else {
                        // No blocker or fetch failed, state remains "open" (default)
                        // Could potentially check passageDetailsComp.state here if needed
                    }
                    // === END: CONN-9.4 Evaluate Blocker State ===

                    // Store data for logging/debugging (optional now)
                    const connectionLogData = {
                        direction: direction,
                        connectionId: connectionEntityId,
                        passageDetails: passageDetailsComp,
                        blockerEntity: blockerEntity,
                        effectivePassageState: effectivePassageState,
                    };
                    visibleConnectionsData.push(connectionLogData); // Add to log array

                    // === START: CONN-9.5 Format Exit String ===
                    // Generate the formatted string using the helper function (AC1, AC2)
                    const exitString = formatExitString(direction, passageDetailsComp, blockerEntity, effectivePassageState);

                    // Add to the temporary array (AC3: Only happens for non-hidden exits)
                    formattedExits.push(exitString);
                    console.log(`    [LOOK HANDLER LOG] -> Formatted exit string: "${exitString}"`);
                    // === END: CONN-9.5 Format Exit String ===


                } catch (error) {
                    console.error(`LookActionHandler: Error processing connection '${connectionEntityId}' (direction '${direction}'):`, error);
                    // Continue to the next connection even if one fails
                }
            } // End for loop
        } else {
            console.log(`[LOOK HANDLER LOG] Location ${currentLocation.id} has no ConnectionsComponent.`);
        }

        console.log(`[LOOK HANDLER LOG] Finished connection processing. Found ${visibleConnectionsData.length} visible connections.`);
        if (formattedExits.length > 0) {
            console.log(`[LOOK HANDLER LOG] Generated formatted exit strings:`, formattedExits);
        } else {
            console.log(`[LOOK HANDLER LOG] No visible exits found or processed.`);
        }
        // --- END REFACTOR Scope ---


        // === START: CONN-9.5 Finalize Exits ===
        // Construct final location data, now including the processed exits.
        // AC4: Assign collected strings to locationData.exits
        // AC5: Handle case with no visible exits - assign undefined if empty
        const finalExits = formattedExits.length > 0 ? formattedExits : undefined;
        // === END: CONN-9.5 Finalize Exits ===

        const locationData = {
            name: locationName,
            description: locationDesc,
            exits: finalExits, // Use the processed array (or undefined)
            items: itemsVisible.length > 0 ? itemsVisible : undefined,
            npcs: npcsVisible.length > 0 ? npcsVisible : undefined,
            // No temporary _internal_connections_data needed anymore
        };

        // AC6: Dispatch final location data including the populated `exits` array
        dispatch('ui:display_location', locationData);

        messages.push({text: `Displayed location ${currentLocation.id}`, type: 'internal'});
        success = true;

    } else if (targetName.toLowerCase() === 'self' || targetName.toLowerCase() === 'me') {
        // --- Look at self (Unchanged) ---
        // ...
        messages.push({text: `Look intent: At self`, type: 'internal'});
        const lookSelfMsg = TARGET_MESSAGES.LOOK_SELF;
        dispatch('ui:message_display', {text: lookSelfMsg, type: 'info'});
        messages.push({text: lookSelfMsg, type: 'info'});
        success = true;

    } else {
        // --- Look at a specific target (Unchanged) ---
        messages.push({text: `Look intent: At target '${targetName}'`, type: 'internal'});

        const resolution = resolveTargetEntity(context, {
            scope: 'nearby',
            requiredComponents: [],
            actionVerb: 'look at',
            targetName: targetName,
        });

        // --- Handle Resolver Result (unchanged) ---
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
                const feedbackMsg = TARGET_MESSAGES.SCOPE_EMPTY_GENERIC('look at', 'nearby');
                dispatch('ui:message_display', {text: feedbackMsg, type: 'info'});
                messages.push({ text: `Resolution failed: FILTER_EMPTY. User message: "${feedbackMsg}"`, type: 'internal' });
                success = false;
                break;
            }
            case 'INVALID_INPUT': {
                const feedbackMsg = TARGET_MESSAGES.INTERNAL_ERROR;
                dispatch('ui:message_display', {text: feedbackMsg, type: 'error'});
                messages.push({ text: `Resolution failed: INVALID_INPUT. Configuration error calling resolveTargetEntity.`, type: 'internal_error' });
                console.error(`executeLook: resolveTargetEntity returned INVALID_INPUT for target '${targetName}'. Context/Config issue?`);
                success = false;
                break;
            }
            default: {
                const feedbackMsg = TARGET_MESSAGES.INTERNAL_ERROR;
                dispatch('ui:message_display', {text: feedbackMsg, type: 'error'});
                messages.push({ text: `Resolution failed: Unhandled status '${resolution.status}'`, type: 'internal_error' });
                console.error(`executeLook: Unhandled resolution status: ${resolution.status}`);
                success = false;
                break;
            }
        } // End switch
    } // End else (specific target)

    // Return result
    return {success, messages, newState: undefined};
} // End executeLook