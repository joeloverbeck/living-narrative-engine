// src/services/targetResolutionService.js

import {findTarget} from '../utils/targetFinder.js';
// Assuming TARGET_MESSAGES includes functions for ambiguity now
import {getDisplayName, TARGET_MESSAGES} from '../utils/messages.js';
import {NameComponent} from '../components/nameComponent.js';
import {InventoryComponent} from '../components/inventoryComponent.js';
import {EquipmentComponent} from '../components/equipmentComponent.js';
import {ItemComponent} from '../components/itemComponent.js';

import {ConnectionsComponent} from '../components/connectionsComponent.js';
// NOTE: PositionComponent is still needed by resolveTargetEntity (indirectly via entityManager.getEntitiesInLocation)
// and potentially by logic within connection resolution if spatial aspects were added later.
// The test setup also uses it via placeInLocation. Keeping it for now.
import {PositionComponent} from "../components/positionComponent.js";
// Import other components if needed

// Import the function itself to potentially use as a default (if needed outside testing)
// NOTE: Be cautious with self-importing for defaults; might need careful handling.
// For the test, we primarily care about passing our mock explicitly.
import {findPotentialConnectionMatches as internalFindPotentialConnectionMatches} from './targetResolutionService.js';

// Import type definitions (make sure paths are correct)
/** @typedef {import('../core/eventBus.js').default} EventBus */
/** @typedef {import('../entities/entityManager.js').default} EntityManager */
/** @typedef {import('../entities/entity.js').default} Entity */
/** @typedef {import('../components/connectionsComponent.js').Connection} Connection */ // Assuming Connection type exists
/** @typedef {import('../components/connectionsComponent.js').ConnectionMapping} ConnectionMapping */
// ** REMOVED UsableComponentData import/typedef - No longer used here **
// ** REMOVED ConditionEvaluationService and related types - No longer used here **
// ** REMOVED ActionMessage - No longer used here **
/** @typedef {import('../actions/actionTypes.js').ActionContext} ActionContext */
/** @typedef {import('../components/baseComponent.js').ComponentConstructor} ComponentConstructor */

/**
 * Represents a fetched connection along with its originating direction.
 * @typedef {object} FetchedConnectionData
 * @property {string} direction - The direction key (lowercase, trimmed) associated with this connection from the source location.
 * @property {Entity} connectionEntity - The fetched Connection entity instance.
 */

/**
 * Represents the output of the connection matching logic (CONN-5.1.2).
 * @typedef {object} PotentialConnectionMatches
 * @property {FetchedConnectionData[]} directionMatches - Array of connection data where the direction key matched the input.
 * @property {FetchedConnectionData[]} nameMatches - Array of unique connection data where the connection entity's display name matched the input.
 */

/**
 * Configuration options for resolving a target entity.
 * @typedef {object} TargetResolverConfig
 * @property {string | string[]} scope - Defines where to search. Valid scopes: 'inventory', 'location', 'equipment', 'location_items', 'location_non_items', 'nearby'.
 * @property {ComponentConstructor[]} requiredComponents - An array of Component classes the target must possess.
 * @property {string} actionVerb - The verb used in feedback messages.
 * @property {string} targetName - The name string provided by the user.
 * @property {(entity: Entity) => boolean} [customFilter] - Optional additional filtering function.
 * @property {keyof typeof TARGET_MESSAGES | null} [notFoundMessageKey] - Optional override for the TARGET_MESSAGES key used on NOT_FOUND. Defaults based on scope/action. null suppresses default message.
 * @property {string} [emptyScopeMessage] - Optional override for the message dispatched when the initial scope yields no suitable entities (e.g., use TARGET_MESSAGES.TAKE_EMPTY_LOCATION).
 */


// ========================================================================
// == Utility Functions (Unchanged by this refactoring) ==================
// ========================================================================

/**
 * Centralized utility function to find a target entity based on name, scope, and required components.
 * [Function implementation remains unchanged]
 * @param {ActionContext} context - The action context.
 * @param {TargetResolverConfig} config - Configuration for the target resolution.
 * @returns {Entity | null} The found Entity or null. Dispatches UI messages on failure.
 */
export function resolveTargetEntity(context, config) {
    // --- Implementation as provided in the prompt (unchanged) ---
    const {playerEntity, currentLocation, entityManager, dispatch} = context;

    // --- 1. Validate Inputs ---
    if (!context || !config || !config.scope || !config.requiredComponents || !config.actionVerb || !config.targetName) {
        console.error("resolveTargetEntity: Invalid context or configuration provided.", {context, config});
        return null;
    }
    if (typeof config.targetName !== 'string' || config.targetName.trim() === '') {
        console.warn("resolveTargetEntity: Received empty targetName. Resolution cannot proceed.");
        return null;
    }

    // --- 2. Normalize Scope and Prepare Components ---
    const scopes = Array.isArray(config.scope) ? config.scope : [config.scope];
    const requiredComponents = [NameComponent, ...config.requiredComponents.filter(c => c !== NameComponent)];

    // --- 3. Build Searchable Entities List ---
    const entityIdSet = new Set();
    for (const scope of scopes) {
        try {
            switch (scope) {
                case 'inventory': {
                    const inventory = playerEntity.getComponent(InventoryComponent);
                    if (inventory) inventory.getItems().forEach(id => entityIdSet.add(id));
                    else console.warn(`resolveTargetEntity: Scope 'inventory' requested but player ${playerEntity.id} lacks InventoryComponent.`);
                    break;
                }
                case 'location':
                case 'location_items':
                case 'location_non_items': {
                    if (!currentLocation) {
                        console.warn(`resolveTargetEntity: Scope '${scope}' requested but currentLocation is null.`);
                        continue;
                    }
                    const idsInLoc = entityManager.getEntitiesInLocation(currentLocation.id);
                    if (idsInLoc) {
                        idsInLoc.forEach(id => {
                            if (id !== playerEntity.id) {
                                const entity = entityManager.getEntityInstance(id);
                                if (!entity) {
                                    console.warn(`resolveTargetEntity: Entity ID ${id} listed in location ${currentLocation.id} but instance not found.`);
                                    return;
                                }
                                if (scope === 'location_items' && !entity.hasComponent(ItemComponent)) return;
                                if (scope === 'location_non_items' && entity.hasComponent(ItemComponent)) return;
                                entityIdSet.add(id);
                            }
                        });
                    }
                    break;
                }
                case 'equipment': {
                    const equipment = playerEntity.getComponent(EquipmentComponent);
                    if (equipment) Object.values(equipment.getAllEquipped()).forEach(id => {
                        if (id) entityIdSet.add(id);
                    });
                    else console.warn(`resolveTargetEntity: Scope 'equipment' requested but player ${playerEntity.id} lacks EquipmentComponent.`);
                    break;
                }
                case 'nearby':
                    const inventory = playerEntity.getComponent(InventoryComponent);
                    if (inventory) inventory.getItems().forEach(id => entityIdSet.add(id));
                    if (currentLocation) {
                        const idsInLoc = entityManager.getEntitiesInLocation(currentLocation.id);
                        if (idsInLoc) idsInLoc.forEach(id => {
                            if (id !== playerEntity.id) {
                                const entity = entityManager.getEntityInstance(id);
                                if (entity) entityIdSet.add(id);
                            }
                        });
                    }
                    break;
                default:
                    console.warn(`resolveTargetEntity: Unsupported scope specified: '${scope}'. Skipping.`);
            }
        } catch (error) {
            console.error(`resolveTargetEntity: Error processing scope '${scope}':`, error);
        }
    }

    // --- 4. Filter Entities ---
    const initialEntities = Array.from(entityIdSet)
        .map(id => entityManager.getEntityInstance(id))
        .filter(Boolean); // Filter out nulls efficiently

    const filteredEntities = initialEntities.filter(entity => {
        const hasAllRequired = requiredComponents.every(ComponentClass => entity.hasComponent(ComponentClass));
        if (!hasAllRequired) return false;
        if (config.customFilter) {
            try {
                return config.customFilter(entity);
            } catch (filterError) {
                console.error(`resolveTargetEntity: Error executing customFilter for entity ${entity.id}:`, filterError);
                return false;
            }
        }
        return true;
    });

    // --- 5. Handle Empty Filtered Scope ---
    if (filteredEntities.length === 0) {
        if (config.notFoundMessageKey !== null) {
            let emptyMsg;
            if (config.emptyScopeMessage) {
                emptyMsg = config.emptyScopeMessage;
            } else {
                const isPersonalScope = scopes.every(s => s === 'inventory' || s === 'equipment');
                if (isPersonalScope) {
                    emptyMsg = TARGET_MESSAGES.SCOPE_EMPTY_PERSONAL(config.actionVerb);
                } else {
                    const scopeContext = (scopes.includes('location') || scopes.includes('location_items') || scopes.includes('location_non_items'))
                        ? 'here' : 'nearby';
                    emptyMsg = TARGET_MESSAGES.SCOPE_EMPTY_GENERIC(config.actionVerb, scopeContext);
                }
            }
            dispatch('ui:message_display', {text: emptyMsg, type: 'info'});
        }
        return null;
    }

    // --- 6. Call findTarget ---
    const findResult = findTarget(config.targetName, filteredEntities);

    // --- 7. Handle findTarget Results ---
    switch (findResult.status) {
        case 'NOT_FOUND': {
            if (config.notFoundMessageKey !== null) {
                let messageKey = config.notFoundMessageKey;
                if (!messageKey) {
                    if (config.actionVerb === 'equip') messageKey = 'NOT_FOUND_EQUIPPABLE';
                    else if (config.actionVerb === 'unequip') messageKey = 'NOT_FOUND_UNEQUIPPABLE';
                    else if (config.actionVerb === 'attack') messageKey = 'NOT_FOUND_ATTACKABLE';
                    else if (config.actionVerb === 'take') messageKey = 'NOT_FOUND_TAKEABLE';
                    else if (config.actionVerb.includes(' on') || config.actionVerb.includes(' >')) messageKey = 'TARGET_NOT_FOUND_CONTEXT';
                    else if (scopes.length === 1 && scopes[0] === 'inventory') messageKey = 'NOT_FOUND_INVENTORY';
                    else if (scopes.length === 1 && scopes[0] === 'equipment') messageKey = 'NOT_FOUND_EQUIPPED';
                    else if (scopes.includes('inventory') || scopes.includes('equipment')) messageKey = 'NOT_FOUND_INVENTORY';
                    else messageKey = 'NOT_FOUND_LOCATION';
                    if (!messageKey) {
                        console.warn(`resolveTargetEntity: Could not determine a default message key for NOT_FOUND. Action: ${config.actionVerb}, Scope: ${scopes}`);
                        messageKey = 'NOT_FOUND_LOCATION';
                    }
                }
                const messageGenerator = TARGET_MESSAGES[messageKey];
                let errorMsg;
                if (typeof messageGenerator === 'function') {
                    // Adjust parameter based on specific message key if needed
                    const msgParam = (messageKey === 'TARGET_NOT_FOUND_CONTEXT' || messageKey.startsWith('NOT_FOUND_')) ? config.targetName : config.targetName; // Simplified logic here
                    errorMsg = messageGenerator(msgParam);
                } else {
                    console.warn(`resolveTargetEntity: Invalid or missing message key in TARGET_MESSAGES: ${messageKey}. Falling back.`);
                    errorMsg = `You don't find any '${config.targetName}' to ${config.actionVerb}.`;
                }
                dispatch('ui:message_display', {text: errorMsg, type: 'info'});
            }
            return null;
        }
        case 'FOUND_AMBIGUOUS': {
            if (config.notFoundMessageKey !== null) {
                let errorMsg;
                // Use specific ambiguity messages if available
                const targetEntities = findResult.matches;
                if (config.actionVerb.includes(' on') || config.actionVerb.includes(' >')) {
                    errorMsg = TARGET_MESSAGES.TARGET_AMBIGUOUS_CONTEXT(config.actionVerb, config.targetName, targetEntities);
                } else if (TARGET_MESSAGES.AMBIGUOUS_PROMPT) {
                    errorMsg = TARGET_MESSAGES.AMBIGUOUS_PROMPT(config.actionVerb, config.targetName, targetEntities);
                } else {
                    // Fallback if specific messages aren't defined
                    const displayNames = targetEntities.map(e => getDisplayName(e) || e.id).join(', ');
                    errorMsg = `Which '${config.targetName}' did you want to ${config.actionVerb}? (${displayNames})`;
                }
                dispatch('ui:message_display', {text: errorMsg, type: 'warning'});
            }
            return null;
        }
        case 'FOUND_UNIQUE':
            return findResult.matches[0];
        default: {
            if (TARGET_MESSAGES.INTERNAL_ERROR_RESOLUTION) {
                const errorMsg = TARGET_MESSAGES.INTERNAL_ERROR_RESOLUTION(findResult.status || 'unknown');
                dispatch('ui:message_display', {text: errorMsg, type: 'error'});
            } else {
                dispatch('ui:message_display', {
                    text: 'An internal error occurred during target resolution.',
                    type: 'error'
                });
            }
            console.error(`resolveTargetEntity: Internal error - Unexpected findTarget status: ${findResult.status}`);
            return null;
        }
    }
} // End resolveTargetEntity


/**
 * **CONN-5.1.2 Implementation:** Finds potential Connection entities based on direction and name matching.
 * [Function implementation remains unchanged]
 * @param {ActionContext} context - The action context.
 * @param {string} connectionTargetName - The name or direction string provided by the user (non-empty).
 * @returns {PotentialConnectionMatches} An object containing arrays of direction and name matches.
 */
export function findPotentialConnectionMatches(context, connectionTargetName) {
    const {currentLocation, entityManager} = context;

    /** @type {PotentialConnectionMatches} */
    const results = {
        directionMatches: [],
        nameMatches: [],
    };

    // --- Pre-computation Checks ---
    if (!currentLocation) {
        console.warn("findPotentialConnectionMatches: Missing currentLocation in context.");
        return results;
    }
    if (!entityManager) {
        console.error("findPotentialConnectionMatches: Missing entityManager in context.");
        return results;
    }
    const connectionsComponent = currentLocation.getComponent(ConnectionsComponent);
    if (!connectionsComponent) {
        console.warn(`findPotentialConnectionMatches: ConnectionsComponent not found on location '${currentLocation.id}'`);
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
            console.warn(`findPotentialConnectionMatches: Could not find Connection entity '${connectionEntityId}' referenced in location '${currentLocation.id}'`);
        }
    }
    if (fetchedConnectionsData.length === 0) {
        console.warn(`findPotentialConnectionMatches: Location '${currentLocation.id}' has connection mappings, but failed to fetch any corresponding Connection entities.`);
        return results;
    }

    // --- Step 7: Find Matching Connections (Revised Logic) ---
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

        // *** CHANGE HERE: Only consider for name match if NOT already a direction match ***
        if (!isDirectionMatch && entityName && entityName.includes(lowerCaseTarget)) {
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
}


/**
 * Resolves a target Connection entity based on user input (direction or name).
 * Uses findPotentialConnectionMatches internally or via injection.
 * Handles ambiguity and dispatches appropriate messages.
 * [Function implementation remains unchanged]
 * @param {ActionContext} context - The action context, requires `dispatch`.
 * @param {string} connectionTargetName - The raw target string from the user.
 * @param {string} [actionVerb='go'] - The verb used in ambiguity messages.
 * @param {(context: ActionContext, targetName: string) => PotentialConnectionMatches} [findMatchesFn=internalFindPotentialConnectionMatches] - The function to use for finding matches.
 * @returns {Entity | null} The resolved Connection entity or null if not found/ambiguous.
 */
export function resolveTargetConnection(
    context,
    connectionTargetName,
    actionVerb = 'go',
    // **** Uses the imported function as default ****
    findMatchesFn = internalFindPotentialConnectionMatches
) {
    // --- Implementation as provided in the prompt (unchanged) ---
    const {dispatch} = context;

    // --- Step 1: Validate Inputs ---
    if (!context || !context.dispatch) { // Ensure dispatch is available
        console.error("resolveTargetConnection: Invalid context or missing dispatch function provided.");
        return null;
    }
    const trimmedTargetName = typeof connectionTargetName === 'string' ? connectionTargetName.trim() : '';
    if (trimmedTargetName === '') {
        console.warn("resolveTargetConnection: Invalid or empty connectionTargetName provided.");
        // Optional: Dispatch a generic "What do you want to [verb]?" message if desired.
        // dispatch('ui:message_display', { text: `What do you want to ${actionVerb}?`, type: 'prompt' });
        return null;
    }

    // --- Step 2: Find Potential Matches (CONN-5.1.2) ---
    const {directionMatches, nameMatches} = findMatchesFn(context, trimmedTargetName);
    console.log(`resolveTargetConnection: Matches for '${trimmedTargetName}': Directions=${directionMatches.length}, Names=${nameMatches.length}`);

    // ================================================================
    // --- Step 3: Resolve Priority and Ambiguity (CONN-5.1.3 Logic) ---
    // ================================================================

    // AC1: Priority Check - Check directionMatches first.
    // AC2: Unique Direction Match
    if (directionMatches.length === 1) {
        const match = directionMatches[0];
        console.log(`resolveTargetConnection: Found unique direction match: ${match.direction} -> ${match.connectionEntity.id}`);
        return match.connectionEntity; // Return the Connection Entity
    }

    // AC3: Ambiguous Direction Match
    if (directionMatches.length > 1) {
        console.warn(`resolveTargetConnection: Ambiguous direction match for '${trimmedTargetName}'.`);
        // Extract display names for the message
        const displayNames = directionMatches.map(item => getDisplayName(item.connectionEntity) || item.direction || item.connectionEntity.id);
        // Use a specific message function if available in TARGET_MESSAGES, otherwise construct one
        let ambiguousMsg;
        if (TARGET_MESSAGES.AMBIGUOUS_DIRECTION) {
            ambiguousMsg = TARGET_MESSAGES.AMBIGUOUS_DIRECTION(trimmedTargetName, displayNames);
        } else {
            ambiguousMsg = `There are multiple ways to go '${trimmedTargetName}'. Which one did you mean? (${displayNames.join(', ')})`;
        }
        dispatch('ui:message_display', {text: ambiguousMsg, type: 'warning'});
        return null; // Return null due to ambiguity
    }

    // AC4: Name Match Check (If No Direction Match) - This condition (directionMatches.length === 0) is met if we reach here.
    // AC5: Unique Name Match
    if (nameMatches.length === 1) {
        const match = nameMatches[0];
        console.log(`resolveTargetConnection: Found unique name match: ${getDisplayName(match.connectionEntity)} (${match.connectionEntity.id}) via direction ${match.direction}`);
        return match.connectionEntity; // Return the Connection Entity
    }

    // AC6: Ambiguous Name Match
    if (nameMatches.length > 1) {
        console.warn(`resolveTargetConnection: Ambiguous name match for '${trimmedTargetName}'.`);
        // Extract display names for the message
        const displayNames = nameMatches.map(item => getDisplayName(item.connectionEntity) || item.direction || item.connectionEntity.id);
        // Use a specific message function (like TARGET_AMBIGUOUS_CONTEXT) if available, otherwise construct
        let ambiguousMsg;
        if (TARGET_MESSAGES.TARGET_AMBIGUOUS_CONTEXT) {
            // Convert FetchedConnectionData[] to Entity[] for TARGET_AMBIGUOUS_CONTEXT
            const ambiguousEntities = nameMatches.map(match => match.connectionEntity);
            ambiguousMsg = TARGET_MESSAGES.TARGET_AMBIGUOUS_CONTEXT(actionVerb, trimmedTargetName, ambiguousEntities);
        } else {
            ambiguousMsg = `Which '${trimmedTargetName}' did you want to ${actionVerb}? (${displayNames.join(', ')})`;
        }
        dispatch('ui:message_display', {text: ambiguousMsg, type: 'warning'});
        return null; // Return null due to ambiguity
    }

    // AC7: Not Found (If both directionMatches and nameMatches are empty)
    console.log(`resolveTargetConnection: No direction or name matches found for '${trimmedTargetName}'.`);
    // Use the specified TARGET_MESSAGES function
    const notFoundMsg = TARGET_MESSAGES.TARGET_NOT_FOUND_CONTEXT(trimmedTargetName);
    dispatch('ui:message_display', {text: notFoundMsg, type: 'info'});
    return null; // Return null as target was not found
}