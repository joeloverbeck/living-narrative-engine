// src/services/targetResolutionService.js

import {findTarget} from '../utils/targetFinder.js';
// Assuming TARGET_MESSAGES includes functions for ambiguity now
import {getDisplayName, TARGET_MESSAGES} from '../utils/messages.js';
import {NameComponent} from '../components/nameComponent.js';
import {InventoryComponent} from '../components/inventoryComponent.js';
import {EquipmentComponent} from '../components/equipmentComponent.js';
import {ItemComponent} from '../components/itemComponent.js';

import {ConnectionsComponent} from '../components/connectionsComponent.js';
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
/** @typedef {import('../../data/schemas/item.schema.json').definitions.UsableComponent} UsableComponentData */
/** @typedef {import('../services/conditionEvaluationService.js').ConditionEvaluationService} ConditionEvaluationService */
/** @typedef {import('../services/conditionEvaluationService.js').ConditionEvaluationContext} ConditionEvaluationContext */
/** @typedef {import('../services/conditionEvaluationService.js').ConditionEvaluationOptions} ConditionEvaluationOptions */
/** @typedef {import('../actions/actionTypes.js').ActionMessage} ActionMessage */
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
// == TargetResolutionService Core Logic =======================
// ========================================================================

/**
 * @typedef {object} ResolveItemTargetResult
 * @property {boolean} success - True if target resolution (and validation) succeeded or if no target was required.
 * @property {Entity | Connection | null} target - The validated target object, or null if no target was required or found/validated.
 * @property {'entity' | 'connection' | 'none'} targetType - The type of the resolved target.
 * @property {ActionMessage[]} messages - Array of internal/debugging messages generated during resolution.
 */

/**
 * Provides methods for resolving action targets based on different criteria.
 */
export class TargetResolutionService {
    // No constructor needed if dependencies are passed to methods.

    /**
     * Resolves the target for an item usage action based on explicit IDs and validates it.
     * [Function implementation updated for CONN-5.2.1, CONN-5.2.2, CONN-5.2.3, and CONN-5.2.4]
     * @param {object} params - The parameters for target resolution.
     * @param {Entity} params.userEntity - The entity using the item.
     * @param {UsableComponentData} params.usableComponentData - The item's Usable component data.
     * @param {string | null | undefined} params.explicitTargetEntityId - Optional entity ID provided by the event.
     * @param {string | null | undefined} params.explicitTargetConnectionEntityId - Optional connection *entity* ID provided by the event. // <-- RENAMED PARAMETER (AC1)
     * @param {string} params.itemName - The display name of the item being used (for messages).
     * @param {object} dependencies - Required service dependencies.
     * @param {EntityManager} dependencies.entityManager - For looking up entities and components.
     * @param {EventBus} dependencies.eventBus - For dispatching UI messages.
     * @param {ConditionEvaluationService} dependencies.conditionEvaluationService - For validating target conditions.
     *
     * @returns {Promise<ResolveItemTargetResult>} - A promise resolving to the outcome of the target resolution.
     */
    async resolveItemTarget(
        {userEntity, usableComponentData, explicitTargetEntityId, explicitTargetConnectionEntityId, itemName},
        {entityManager, eventBus, conditionEvaluationService}
    ) {
        /** @type {ActionMessage[]} */
        const messages = [];
        const log = (text, type = 'internal') => messages.push({text, type});

        log(`Starting resolveItemTarget for item: ${itemName}`);

        // --- 1. Check if Target is Required ---
        if (!usableComponentData.target_required) {
            log(`Target not required for ${itemName}.`);
            return {success: true, target: null, targetType: 'none', messages};
        }

        log(`Target required. Explicit Entity ID: ${explicitTargetEntityId}, Connection Entity ID: ${explicitTargetConnectionEntityId}`);

        // --- 2. Resolve Potential Target from Explicit IDs ---
        let potentialTarget = null;
        let targetType = 'none'; // 'entity', 'connection', or 'none'
        let targetEntityContext = null;
        let targetConnectionContext = null;

        // --- 2a. BLOCK UPDATED FOR CONN-5.2.2, CONN-5.2.3 & CONN-5.2.4: PRIORITIZE Explicit Connection Entity Target ---
        if (explicitTargetConnectionEntityId) {
            log(`Attempting to resolve explicit connection target: ${explicitTargetConnectionEntityId}`);

            // --- CONN-5.2.2: Fetch the Connection Entity Instance ---
            const connectionEntity = entityManager.getEntityInstance(explicitTargetConnectionEntityId);

            // --- CONN-5.2.2: Handle Fetch Failure ---
            if (!connectionEntity) {
                log(`Failed to fetch Connection Entity instance with ID: ${explicitTargetConnectionEntityId}`, 'error');
                const failureMsg = TARGET_MESSAGES.USE_INVALID_TARGET_CONNECTION(explicitTargetConnectionEntityId);
                eventBus.dispatch('ui:message_display', {text: failureMsg, type: 'warning'});
                console.log("DEBUG: RETURNING because !connectionEntity");
                return {success: false, target: null, targetType: 'none', messages};
            } else {
                // --- CONN-5.2.2: Handle Fetch Success ---
                log(`Successfully fetched Connection Entity: ${getDisplayName(connectionEntity)} (${connectionEntity.id})`);

                // ***** START: CONN-5.2.3 / CONN-5.2.4 VALIDATION LOGIC *****
                log("Starting validation: Is connection a valid exit from user's location?");

                // 1. Get user's PositionComponent and locationId
                const userPosComp = userEntity.getComponent(PositionComponent); // AC1 (Get Component)
                if (!userPosComp) {
                    // --- CONN-5.2.4 FAILURE HANDLING (AC1) ---
                    log("CONN-5.2.4 Failure: User missing PositionComponent.", 'error');
                    eventBus.dispatch('ui:message_display', {
                        text: TARGET_MESSAGES.USE_INVALID_TARGET_CONNECTION(explicitTargetConnectionEntityId),
                        type: 'warning'
                    });
                    return {success: false, target: null, targetType: 'none', messages};
                }

                const userLocationId = userPosComp.locationId; // AC1 (Get locationId)
                if (!userLocationId) {
                    // --- CONN-5.2.4 FAILURE HANDLING (AC1) ---
                    log("CONN-5.2.4 Failure: User PositionComponent missing locationId.", 'error');
                    eventBus.dispatch('ui:message_display', {
                        text: TARGET_MESSAGES.USE_INVALID_TARGET_CONNECTION(explicitTargetConnectionEntityId),
                        type: 'warning'
                    });
                    console.log("DEBUG: RETURNING because !userLocation");
                    return {success: false, target: null, targetType: 'none', messages};
                }
                log(`User location ID: ${userLocationId}`);

                // 2. Fetch user's location entity
                const userLocation = entityManager.getEntityInstance(userLocationId); // AC2
                if (!userLocation) {
                    // --- CONN-5.2.4 FAILURE HANDLING (AC2) ---
                    log(`CONN-5.2.4 Failure: Could not fetch user location entity: ${userLocationId}`, 'error');
                    eventBus.dispatch('ui:message_display', {
                        text: TARGET_MESSAGES.USE_INVALID_TARGET_CONNECTION(explicitTargetConnectionEntityId),
                        type: 'warning'
                    });
                    return {success: false, target: null, targetType: 'none', messages};
                }
                log(`Workspaceed user location entity: ${getDisplayName(userLocation)} (${userLocation.id})`);

                // 3. Get ConnectionsComponent from userLocation
                const connectionsComp = userLocation.getComponent(ConnectionsComponent); // AC3
                if (!connectionsComp) {
                    // --- CONN-5.2.4 FAILURE HANDLING (AC3) ---
                    log(`CONN-5.2.4 Failure: User location ${userLocation.id} missing ConnectionsComponent.`, 'error');
                    eventBus.dispatch('ui:message_display', {
                        text: TARGET_MESSAGES.USE_INVALID_TARGET_CONNECTION(explicitTargetConnectionEntityId),
                        type: 'warning'
                    });
                    return {success: false, target: null, targetType: 'none', messages};
                }
                log("Fetched ConnectionsComponent from user location.");

                // 4. Get the list of current exits
                const currentExits = connectionsComp.getAllConnections(); // AC4

                // 5. Perform the check
                log("Checking fetched connection against current location's exits.");
                const isValidExit = currentExits.some(exit => exit.connectionEntityId === connectionEntity.id); // AC5
                log(`isValidExit result: ${isValidExit}`);

                if (isValidExit) {
                    log(`Validation successful. Connection ${connectionEntity.id} is a valid exit.`);
                    // Mark the connection entity as the potential target
                    potentialTarget = connectionEntity;
                    targetType = 'connection';
                    // Prepare context for later condition evaluation
                    const matchingExit = currentExits.find(exit => exit.connectionEntityId === connectionEntity.id);
                    targetConnectionContext = {
                        connectionEntity: connectionEntity,
                        direction: matchingExit?.direction // Add direction if found
                    };
                    log(`Potential target confirmed as CONNECTION ${getDisplayName(potentialTarget)} (${potentialTarget.id}). Proceeding to condition checks.`);
                } else {
                    // --- CONN-5.2.4 FAILURE HANDLING (AC4) ---
                    log(`CONN-5.2.4 Failure: Connection Entity ${connectionEntity.id} is NOT a valid exit from ${userLocation.id}.`, 'error'); // Changed log to error
                    eventBus.dispatch('ui:message_display', {
                        text: TARGET_MESSAGES.USE_INVALID_TARGET_CONNECTION(explicitTargetConnectionEntityId),
                        type: 'warning'
                    });
                    return {success: false, target: null, targetType: 'none', messages};
                    // NOTE: No need to reset potentialTarget = null as we are returning.
                }
                // ***** END: CONN-5.2.3 / CONN-5.2.4 VALIDATION LOGIC *****
            }
            // --- End of CONN-5.2.2 / CONN-5.2.3 / CONN-5.2.4 Implementation for Connection Target ---

        } // --- End of explicit connection entity ID block ---

        // --- 2b. Attempt Explicit Entity Target ONLY IF No Valid Connection Target was Found/Specified/Validated ---
        // This block now runs only if:
        // - explicitTargetConnectionEntityId was NOT provided, OR
        // - it WAS provided but the initial fetch failed (returned earlier), OR
        // - it WAS provided, fetch succeeded, but CONN-5.2.3/5.2.4 validation failed (returned earlier).
        // Therefore, if we reach here *without* a potentialTarget, we can proceed to check explicitTargetEntityId.
        if (!potentialTarget && explicitTargetEntityId) {
            log(`Attempting to resolve explicit entity target: ${explicitTargetEntityId}`);
            potentialTarget = entityManager.getEntityInstance(explicitTargetEntityId);
            if (potentialTarget) {
                targetType = 'entity';
                targetEntityContext = potentialTarget;
                log(`Found potential explicit target: ENTITY ${getDisplayName(potentialTarget)} (${potentialTarget.id})`);
            } else {
                log(`Explicit entity target ID ${explicitTargetEntityId} not found.`, 'warning');
                // Use the specific message for entity not found
                const failureMsg = TARGET_MESSAGES.USE_INVALID_TARGET_ENTITY(explicitTargetEntityId);
                eventBus.dispatch('ui:message_display', {text: failureMsg, type: 'warning'});
                log(`Failure: Explicit entity ${explicitTargetEntityId} not found.`, 'error');
                return {success: false, target: null, targetType: 'none', messages};
            }
        }

        // --- 3. Handle Target Required But Not Found/Specified/Validated ---
        // This check covers cases where:
        // - Neither ID was provided.
        // - Connection ID was provided but fetch/validation failed (returned earlier).
        // - Entity ID was provided but fetch failed (returned earlier).
        if (!potentialTarget) {
            // If we got here, it means target_required was true, but neither a valid connection
            // nor a valid entity target was resolved successfully.
            log(`Target required, but no valid explicit target entity OR connection entity ID was provided or resolved/validated.`, 'error');
            // Use the generic 'target required' message, as the specific connection/entity failures
            // would have dispatched their own messages already.
            const failureMsg = usableComponentData.failure_message_target_required || TARGET_MESSAGES.USE_REQUIRES_TARGET(itemName);
            eventBus.dispatch('ui:message_display', {text: failureMsg, type: 'warning'});
            console.log("DEBUG: RETURNING because !potentialTarget");
            return {success: false, target: null, targetType: 'none', messages};
        }

        // --- 4. Validate the Found Potential Target Against Conditions ---
        // This section should only run if potentialTarget is *not* null (meaning fetch & validation succeeded)
        let targetName;
        // Note: targetConnectionContext is only populated if targetType === 'connection' and validation passed
        if (targetType === 'connection' && targetConnectionContext) {
            targetName = getDisplayName(targetConnectionContext.connectionEntity) || `Connection (${targetConnectionContext.connectionEntity.id})`;
        } else if (targetType === 'entity' && targetEntityContext) {
            targetName = getDisplayName(targetEntityContext);
        } else {
            // This case should ideally not be reachable if the logic above is correct
            // because potentialTarget would be null if context isn't set.
            targetName = getDisplayName(/** @type {Entity} */ (potentialTarget));
            log('Warning: potentialTarget exists but specific context (entity/connection) is missing or incomplete.', 'warning');
        }
        log(`Validating potential target ('${targetName}') against target_conditions.`);


        if (usableComponentData.target_conditions && usableComponentData.target_conditions.length > 0) {
            /** @type {ConditionEvaluationContext} */
            const targetCheckContext = {
                userEntity: userEntity,
                targetEntityContext: targetEntityContext, // Is the Entity instance or null
                targetConnectionContext: targetConnectionContext // Contains { connectionEntity, direction? } or null
            };
            /** @type {ConditionEvaluationOptions} */
            const targetOptions = {
                itemName: itemName,
                checkType: 'Target',
                fallbackMessages: {
                    target: usableComponentData.failure_message_invalid_target || TARGET_MESSAGES.USE_INVALID_TARGET(itemName),
                    default: TARGET_MESSAGES.USE_INVALID_TARGET(itemName)
                }
            };

            // The subject of the condition check is the actual target (Entity or Connection Entity)
            const conditionSubject = potentialTarget;

            const targetCheckResult = await conditionEvaluationService.evaluateConditions(
                conditionSubject,
                targetCheckContext,
                usableComponentData.target_conditions,
                targetOptions
            );

            messages.push(...targetCheckResult.messages);

            if (!targetCheckResult.success) {
                log(`Target conditions failed for target '${targetName}'.`, 'warning');
                // Condition evaluation service should dispatch its own failure message based on targetOptions
                if (targetCheckResult.failureMessage) {
                    eventBus.dispatch('ui:message_display', {text: targetCheckResult.failureMessage, type: 'warning'});
                } else {
                    // Fallback if condition service somehow didn't provide a message
                    const fallbackMsg = usableComponentData.failure_message_invalid_target || TARGET_MESSAGES.USE_INVALID_TARGET(itemName);
                    eventBus.dispatch('ui:message_display', {text: fallbackMsg, type: 'warning'});
                }
                return {success: false, target: null, targetType: 'none', messages};
            } else {
                log(`Target '${targetName}' passed validation conditions.`);
            }
        } else {
            log(`No target_conditions defined for ${itemName}. Target considered valid.`);
        }

        // --- 5. Target Found and Validated ---
        log(`Target resolution successful. Validated Target: ${targetType} '${targetName}'.`);
        return {success: true, target: potentialTarget, targetType: targetType, messages};
    } // End resolveItemTarget
} // End TargetResolutionService Class


// ========================================================================
// == Utility Functions (Unchanged by CONN-5.2.1) ========================
// ========================================================================

/**
 * Centralized utility function to find a target entity based on name, scope, and required components.
 * [Function implementation remains unchanged - Not relevant to CONN-5.2.1]
 * @param {ActionContext} context - The action context.
 * @param {TargetResolverConfig} config - Configuration for the target resolution.
 * @returns {Entity | null} The found Entity or null. Dispatches UI messages on failure.
 */
export function resolveTargetEntity(context, config) {
    // --- Implementation as provided in the prompt ---
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
                if (config.actionVerb.includes(' on') || config.actionVerb.includes(' >') || TARGET_MESSAGES.TARGET_AMBIGUOUS_CONTEXT) {
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
 * [Function implementation remains unchanged - Not relevant to CONN-5.2.1]
 * @param {ActionContext} context - The action context.
 * @param {string} connectionTargetName - The name or direction string provided by the user (non-empty).
 * @returns {PotentialConnectionMatches} An object containing arrays of direction and name matches.
 */
export function findPotentialConnectionMatches(context, connectionTargetName) {
    // --- Implementation as provided in the prompt ---
    const {currentLocation, entityManager} = context; // Removed playerEntity, dispatch as they aren't needed for matching itself

    /** @type {PotentialConnectionMatches} */
    const results = {
        directionMatches: [],
        nameMatches: [],
    };

    // --- Pre-computation Checks (Moved from original resolveTargetConnection) ---
    if (!currentLocation) {
        console.warn("findPotentialConnectionMatches: Missing currentLocation in context.");
        return results; // Return empty results if no location context
    }
    if (!entityManager) {
        console.error("findPotentialConnectionMatches: Missing entityManager in context.");
        return results; // Return empty results if no entity manager
    }

    const connectionsComponent = currentLocation.getComponent(ConnectionsComponent);
    if (!connectionsComponent) {
        console.warn(`findPotentialConnectionMatches: ConnectionsComponent not found on location '${currentLocation.id}'`);
        return results; // Return empty results if component missing
    }

    const connectionMappings = connectionsComponent.getAllConnections();
    if (connectionMappings.length === 0) {
        // No connections defined in this location.
        return results; // Return empty results
    }

    // --- Fetch Connection Entities ---
    /** @type {FetchedConnectionData[]} */
    const fetchedConnectionsData = [];
    const fetchedEntityIds = new Set(); // To track successfully fetched entities for name matching de-duplication

    for (const mapping of connectionMappings) {
        const {direction, connectionEntityId} = mapping;
        const connectionEntity = entityManager.getEntityInstance(connectionEntityId);

        if (connectionEntity) {
            fetchedConnectionsData.push({direction, connectionEntity});
            fetchedEntityIds.add(connectionEntity.id); // Track successful fetches
        } else {
            console.warn(`findPotentialConnectionMatches: Could not find Connection entity '${connectionEntityId}' referenced in location '${currentLocation.id}'`);
        }
    }

    if (fetchedConnectionsData.length === 0) {
        console.warn(`findPotentialConnectionMatches: Location '${currentLocation.id}' has connection mappings, but failed to fetch any corresponding Connection entities.`);
        return results; // Return empty results if fetching failed for all
    }

    // --- Step 7 (Ticket CONN-5.1.2 Core): Find Matching Connections ---
    const lowerCaseTarget = connectionTargetName.trim().toLowerCase(); // AC1

    // Use a Set to keep track of entity IDs added to nameMatches to ensure uniqueness
    const nameMatchEntityIds = new Set();

    for (const item of fetchedConnectionsData) {
        // AC2: Direction Matching (Exact, Case-Insensitive)
        // Direction keys are already stored lowercase/trimmed in ConnectionsComponent
        if (item.direction === lowerCaseTarget) {
            results.directionMatches.push(item);
        }

        // AC3: Name Matching (Substring, Case-Insensitive)
        const entityName = getDisplayName(item.connectionEntity)?.toLowerCase();
        if (entityName && entityName.includes(lowerCaseTarget)) {
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


export function resolveTargetConnection(
    context,
    connectionTargetName,
    actionVerb = 'go',
    // **** ADDED PARAMETER ****
    // Allow passing in the matching function. Defaulting here can be complex,
    // so often real code might still call the internal one, but tests override.
    // Or make it required if preferred design. For the test, we just need the parameter slot.
    findMatchesFn = internalFindPotentialConnectionMatches // Use the imported function as default
) {
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