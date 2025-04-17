// src/services/connectionResolver.js

// Service responsible for resolving connection targets based on user input
// (e.g., directions like 'north' or connection names like 'door')

// ** Import Core Classes/Types **
import Entity from '../entities/entity.js';
import EntityManager from '../entities/entityManager.js'; // Dependency for function context
import {ConnectionsComponent} from '../components/connectionsComponent.js'; // Dependency for function logic
import {getDisplayName, TARGET_MESSAGES} from '../utils/messages.js';
import {PassageDetailsComponent} from "../components/passageDetailsComponent.js";
import {EVENT_DISPLAY_MESSAGE} from "../types/eventTypes.js"; // Added TARGET_MESSAGES for resolveTargetConnection

// ========================================================================
// == Core Type Definitions for Connection Resolution =====================
// ========================================================================

/**
 * Represents a fetched connection along with its originating direction.
 * Copied from targetResolutionService.js - TICKET-REF-SUB-3.1
 * @typedef {object} FetchedConnectionData
 * @property {string} direction - The direction key (lowercase, trimmed) associated with this connection from the source location.
 * @property {Entity} connectionEntity - The fetched Connection entity instance.
 */

/**
 * Represents the output of the connection matching logic (e.g., CONN-5.1.2).
 * Contains arrays of matches found based on direction or name.
 * Depends on FetchedConnectionData.
 * Copied from targetResolutionService.js - TICKET-REF-SUB-3.1
 * @typedef {object} PotentialConnectionMatches
 * @property {FetchedConnectionData[]} directionMatches - Array of connection data where the direction key matched the input.
 * @property {FetchedConnectionData[]} nameMatches - Array of unique connection data where the connection entity's display name matched the input.
 */

// ========================================================================
// == Service Function Implementations ===================================
// ========================================================================

/**
 * **CONN-5.1.2 Implementation:** Finds potential Connection entities based on direction and name matching.
 * Moved from targetResolutionService.js (Sub-Ticket 3.2). Kept internal for now.
 * @param {ActionContext} context - The action context, requires `currentLocation` and `entityManager`.
 * @param {string} connectionTargetName - The name or direction string provided by the user (non-empty).
 * @returns {PotentialConnectionMatches} An object containing arrays of direction and name matches.
 */
function findPotentialConnectionMatches(context, connectionTargetName) { // NOTE: No 'export' keyword
    const {currentLocation, entityManager} = context;

    /** @type {PotentialConnectionMatches} */
    const results = {
        directionMatches: [],
        nameMatches: [],
    };

    // --- Pre-computation Checks ---
    if (!currentLocation) {
        console.warn("findPotentialConnectionMatches (in ConnectionResolver): Missing currentLocation in context.");
        return results;
    }
    if (!entityManager) {
        // Ensure context provides entityManager
        console.error("findPotentialConnectionMatches (in ConnectionResolver): Missing entityManager in context.");
        return results;
    }
    const connectionsComponent = currentLocation.getComponent(ConnectionsComponent);
    if (!connectionsComponent) {
        // Warning message updated slightly to reflect new location
        console.warn(`findPotentialConnectionMatches (in ConnectionResolver): ConnectionsComponent not found on location '${currentLocation.id}'`);
        return results;
    }
    const connectionMappings = connectionsComponent.getAllConnections();
    if (connectionMappings.length === 0) {
        return results;
    }

    // --- Fetch Connection Entities ---
    /** @type {FetchedConnectionData[]} */
    const fetchedConnectionsData = [];
    for (const mapping of connectionMappings) {
        const {direction, connectionEntityId} = mapping;
        const connectionEntity = entityManager.getEntityInstance(connectionEntityId);

        if (connectionEntity) {
            fetchedConnectionsData.push({direction, connectionEntity});
        } else {
            // Warning message updated slightly
            console.warn(`findPotentialConnectionMatches (in ConnectionResolver): Could not find Connection entity '${connectionEntityId}' referenced in location '${currentLocation.id}'`);
        }
    }
    if (fetchedConnectionsData.length === 0) {
        // Warning message updated slightly
        console.warn(`findPotentialConnectionMatches (in ConnectionResolver): Location '${currentLocation.id}' has connection mappings, but failed to fetch any corresponding Connection entities.`);
        return results;
    }

    // --- Step 7: Find Matching Connections (Logic as copied) ---
    const lowerCaseTarget = connectionTargetName.trim().toLowerCase(); // AC1
    const nameMatchEntityIds = new Set(); // To track unique entities added to nameMatches

    for (const item of fetchedConnectionsData) {
        let isDirectionMatch = false; // Flag to track if this item matched by direction

        // AC2: Direction Matching (Exact, Case-Insensitive)
        if (item.direction === lowerCaseTarget) {
            results.directionMatches.push(item);
            isDirectionMatch = true; // Mark it as a direction match
        }

        // AC3: Name Matching (Substring, Case-Insensitive)
        const entityName = getDisplayName(item.connectionEntity)?.toLowerCase();

        // NEW: also look at the blocker’s entity‑name, if any
        const blockerId = item.connectionEntity.getComponent(PassageDetailsComponent)?.blockerEntityId;
        const blockerEnt = blockerId ? context.entityManager.getEntityInstance(blockerId) : null;
        const blockerName = blockerEnt ? getDisplayName(blockerEnt).toLowerCase() : null;

        // Only consider for name match if NOT already a direction match
        if (!isDirectionMatch && ((entityName && entityName.includes(lowerCaseTarget)) || (blockerName && blockerName.includes(lowerCaseTarget)))) {
            // Ensure we only add each unique *entity* once to nameMatches,
            // even if it's reachable via multiple directions whose names match.
            if (!nameMatchEntityIds.has(item.connectionEntity.id)) {
                results.nameMatches.push(item);
                nameMatchEntityIds.add(item.connectionEntity.id);
            }
        }
    }

    // AC4: Return the structured results
    return results;
} // End findPotentialConnectionMatches


/**
 * **CONN-5.1.3 Implementation:** Resolves a target Connection entity based on user input (direction or name).
 * Moved from targetResolutionService.js (Sub-Ticket 3.3).
 * Uses a provided function (findMatchesFn) internally for finding potential matches.
 * Handles ambiguity and dispatches appropriate messages using eventBus from context. // <<< Updated doc comment
 * @param {ActionContext} context - The action context, requires `eventBus`. // <<< Updated doc comment
 * @param {string} connectionTargetName - The raw target string from the user.
 * @param {string} [actionVerb='go'] - The verb used in ambiguity messages.
 * @param {(context: ActionContext, targetName: string) => PotentialConnectionMatches} [findMatchesFn=findPotentialConnectionMatches] - The function to use for finding matches.
 * @returns {Entity | null} The resolved Connection entity or null if not found/ambiguous.
 */
export function resolveTargetConnection(
    context,
    connectionTargetName,
    actionVerb = 'go',
    findMatchesFn = findPotentialConnectionMatches
) {
    // --- Corrected: Get eventBus from context ---
    const {eventBus} = context;

    // --- Step 1: Validate Inputs ---
    // --- Corrected: Validate eventBus and its dispatch method ---
    if (!context || !eventBus || typeof eventBus.dispatch !== 'function') {
        console.error("resolveTargetConnection (in ConnectionResolver): Invalid context or missing eventBus/dispatch function provided.");
        return null;
    }
    const trimmedTargetName = typeof connectionTargetName === 'string' ? connectionTargetName.trim() : '';
    if (trimmedTargetName === '') {
        console.warn("resolveTargetConnection (in ConnectionResolver): Invalid or empty connectionTargetName provided.");
        return null;
    }

    // --- Step 2: Find Potential Matches (CONN-5.1.2 via Injection) ---
    const {directionMatches, nameMatches} = findMatchesFn(context, trimmedTargetName);
    console.log(`resolveTargetConnection (in ConnectionResolver): Matches for '${trimmedTargetName}': Directions=${directionMatches.length}, Names=${nameMatches.length}`);

    // ================================================================
    // --- Step 3: Resolve Priority and Ambiguity (CONN-5.1.3 Logic) ---
    // ================================================================

    // AC1: Priority Check - Check directionMatches first.
    // AC2: Unique Direction Match
    if (directionMatches.length === 1) {
        const match = directionMatches[0];
        console.log(`resolveTargetConnection (in ConnectionResolver): Found unique direction match: ${match.direction} -> ${match.connectionEntity.id}`);
        return match.connectionEntity; // Return the Connection Entity
    }

    // AC3: Ambiguous Direction Match
    if (directionMatches.length > 1) {
        console.warn(`resolveTargetConnection (in ConnectionResolver): Ambiguous direction match for '${trimmedTargetName}'.`);
        const displayNames = directionMatches.map(item => getDisplayName(item.connectionEntity) || item.direction || item.connectionEntity.id);
        let ambiguousMsg;
        if (TARGET_MESSAGES.AMBIGUOUS_DIRECTION) {
            ambiguousMsg = TARGET_MESSAGES.AMBIGUOUS_DIRECTION(trimmedTargetName, displayNames);
        } else {
            ambiguousMsg = `There are multiple ways to go '${trimmedTargetName}'. Which one did you mean? (${displayNames.join(', ')})`;
        }
        // --- Corrected: Use eventBus.dispatch ---
        eventBus.dispatch(EVENT_DISPLAY_MESSAGE, {text: ambiguousMsg, type: 'warning'});
        return null;
    }

    // AC4: Name Match Check (If No Direction Match)
    // AC5: Unique Name Match
    if (nameMatches.length === 1) {
        const match = nameMatches[0];
        console.log(`resolveTargetConnection (in ConnectionResolver): Found unique name match: ${getDisplayName(match.connectionEntity)} (${match.connectionEntity.id}) via direction ${match.direction}`);
        return match.connectionEntity;
    }

    // AC6: Ambiguous Name Match
    if (nameMatches.length > 1) {
        console.warn(`resolveTargetConnection (in ConnectionResolver): Ambiguous name match for '${trimmedTargetName}'.`);
        const displayNames = nameMatches.map(item => getDisplayName(item.connectionEntity) || item.direction || item.connectionEntity.id);
        let ambiguousMsg;
        if (TARGET_MESSAGES.TARGET_AMBIGUOUS_CONTEXT) {
            const ambiguousEntities = nameMatches.map(match => match.connectionEntity);
            ambiguousMsg = TARGET_MESSAGES.TARGET_AMBIGUOUS_CONTEXT(actionVerb, trimmedTargetName, ambiguousEntities);
        } else {
            ambiguousMsg = `Which '${trimmedTargetName}' did you want to ${actionVerb}? (${displayNames.join(', ')})`;
        }
        // --- Corrected: Use eventBus.dispatch ---
        eventBus.dispatch(EVENT_DISPLAY_MESSAGE, {text: ambiguousMsg, type: 'warning'});
        return null;
    }

    // AC7: Not Found
    console.log(`resolveTargetConnection (in ConnectionResolver): No direction or name matches found for '${trimmedTargetName}'.`);
    const notFoundMsg = TARGET_MESSAGES.TARGET_NOT_FOUND_CONTEXT(trimmedTargetName);
    // --- Corrected: Use eventBus.dispatch ---
    eventBus.dispatch(EVENT_DISPLAY_MESSAGE, {text: notFoundMsg, type: 'info'});
    return null;
}