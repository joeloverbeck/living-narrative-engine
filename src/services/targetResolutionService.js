// src/services/targetResolutionService.js

import {findTarget} from '../utils/targetFinder.js';
import {getDisplayName, TARGET_MESSAGES} from '../utils/messages.js'; // Assuming this path is correct
import {NameComponent} from '../components/nameComponent.js';
import {InventoryComponent} from '../components/inventoryComponent.js';
import {EquipmentComponent} from '../components/equipmentComponent.js';
import {ItemComponent} from '../components/itemComponent.js';

import {ConnectionsComponent} from '../components/connectionsComponent.js';
import {PositionComponent} from "../components/positionComponent.js";
// Import other components if needed

// Import type definitions (make sure paths are correct)
/** @typedef {import('../../eventBus.js').default} EventBus */
/** @typedef {import('../entities/entityManager.js').default} EntityManager */
/** @typedef {import('../entities/entity.js').default} Entity */
/** @typedef {import('../components/connectionsComponent.js').Connection} Connection */
/** @typedef {import('../../data/schemas/item.schema.json').definitions.UsableComponent} UsableComponentData */
/** @typedef {import('../services/conditionEvaluationService.js').ConditionEvaluationService} ConditionEvaluationService */
/** @typedef {import('../services/conditionEvaluationService.js').ConditionEvaluationContext} ConditionEvaluationContext */
/** @typedef {import('../services/conditionEvaluationService.js').ConditionEvaluationOptions} ConditionEvaluationOptions */
/** @typedef {import('../actions/actionTypes.js').ActionMessage} ActionMessage */
/** @typedef {import('../actions/actionTypes.js').ActionContext} ActionContext */
/** @typedef {import('../components/baseComponent.js').ComponentConstructor} ComponentConstructor */


/**
 * Configuration options for resolving a target entity.
 * (Typedef TargetResolverConfig remains the same)
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
     * This method encapsulates the targeting logic previously found in ItemUsageSystem Section 5.
     * It dispatches UI error messages directly via the EventBus for targeting failures.
     * It now prioritizes resolving connections via explicitTargetConnectionId if provided.
     *
     * @param {object} params - The parameters for target resolution.
     * @param {Entity} params.userEntity - The entity using the item.
     * @param {UsableComponentData} params.usableComponentData - The item's Usable component data.
     * @param {string | null | undefined} params.explicitTargetEntityId - Optional entity ID provided by the event.
     * @param {string | null | undefined} params.explicitTargetConnectionId - Optional connection ID provided by the event.
     * @param {string} params.itemName - The display name of the item being used (for messages).
     * @param {object} dependencies - Required service dependencies.
     * @param {EntityManager} dependencies.entityManager - For looking up entities and components.
     * @param {EventBus} dependencies.eventBus - For dispatching UI messages.
     * @param {ConditionEvaluationService} dependencies.conditionEvaluationService - For validating target conditions.
     *
     * @returns {Promise<ResolveItemTargetResult>} - A promise resolving to the outcome of the target resolution.
     */
    async resolveItemTarget(
        {userEntity, usableComponentData, explicitTargetEntityId, explicitTargetConnectionId, itemName},
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

        log(`Target required. Explicit Entity ID: ${explicitTargetEntityId}, Connection ID: ${explicitTargetConnectionId}`);

        // --- 2. Resolve Potential Target from Explicit IDs ---
        let potentialTarget = null;
        let targetType = 'none'; // 'entity', 'connection', or 'none'
        let targetEntityContext = null;
        let targetConnectionContext = null;

        // --- 2a. PRIORITIZE Explicit Connection Target ---
        // *** Handle explicitTargetConnectionId FIRST ***
        if (explicitTargetConnectionId) {
            log(`Attempting to resolve explicit connection target: ${explicitTargetConnectionId}`);
            const userPosComp = userEntity.getComponent(PositionComponent);
            const userLocationId = userPosComp?.locationId;

            if (userLocationId) {
                const currentLocation = entityManager.getEntityInstance(userLocationId);
                const connectionsComp = currentLocation?.getComponent(ConnectionsComponent);
                if (connectionsComp) {
                    // Find the connection using the component's method
                    const foundConnection = connectionsComp.getConnectionById(explicitTargetConnectionId);
                    if (foundConnection) {
                        potentialTarget = foundConnection; // Assign the Connection object
                        targetType = 'connection';
                        targetConnectionContext = foundConnection; // Set context for validation
                        log(`Found potential explicit target: CONNECTION ${foundConnection.name || foundConnection.direction} (${foundConnection.connectionId})`);
                    } else {
                        log(`Explicit connection target ID ${explicitTargetConnectionId} not found in current location ${currentLocation?.id}.`, 'warning');
                    }
                } else {
                    log(`User's current location ${currentLocation?.id ?? userLocationId} lacks ConnectionsComponent.`, 'warning');
                }
            } else {
                log(`User ${userEntity.id} lacks PositionComponent or locationId. Cannot resolve connection target.`, 'warning');
            }

            // If connection resolution failed (either ID not found or setup error), dispatch error and return immediately.
            // We don't fall back to entity ID if a connection ID was *specified* but invalid.
            if (!potentialTarget) {
                const failureMsg = TARGET_MESSAGES.USE_INVALID_TARGET_CONNECTION(explicitTargetConnectionId); // Use a specific message if available, otherwise fallback
                // const failureMsg = `The connection you targeted (${explicitTargetConnectionId}) is not valid here.`; // Example specific message
                eventBus.dispatch('ui:message_display', {text: failureMsg, type: 'warning'});
                log(`Failure: Explicit connection ${explicitTargetConnectionId} not found or user location/component invalid.`, 'error');
                return {success: false, target: null, targetType: 'none', messages};
            }
        }

        // --- 2b. Attempt Explicit Entity Target ONLY IF No Connection Target was Found/Specified ---
        // This block only runs if explicitTargetConnectionId was null/undefined OR if it was provided but resolution failed above (which returns early).
        // *** Only run if potentialTarget is STILL null ***
        if (!potentialTarget && explicitTargetEntityId) {
            log(`Attempting to resolve explicit entity target: ${explicitTargetEntityId}`);
            potentialTarget = entityManager.getEntityInstance(explicitTargetEntityId);
            if (potentialTarget) {
                targetType = 'entity';
                targetEntityContext = potentialTarget; // Set context for validation
                log(`Found potential explicit target: ENTITY ${getDisplayName(potentialTarget)} (${potentialTarget.id})`);
            } else {
                // Entity ID was provided but the entity doesn't exist
                log(`Explicit entity target ID ${explicitTargetEntityId} not found.`, 'warning');
                const failureMsg = TARGET_MESSAGES.USE_INVALID_TARGET_ENTITY(explicitTargetEntityId); // Use a specific message if available
                // const failureMsg = `The target (${explicitTargetEntityId}) you specified is no longer valid.`; // Example specific message
                eventBus.dispatch('ui:message_display', {text: failureMsg, type: 'warning'});
                log(`Failure: Explicit entity ${explicitTargetEntityId} not found.`, 'error');
                return {success: false, target: null, targetType: 'none', messages};
            }
        }

        // --- 3. Handle Target Required But Not Found/Specified ---
        // This check now correctly covers:
        // - No explicit ID provided.
        // - Connection ID provided but failed resolution (already returned).
        // - Entity ID provided but failed resolution (already returned).
        // - *Implicit* targeting (not handled here) would need changes elsewhere if required.
        if (!potentialTarget) {
            // This case should now only be reached if target_required is true, but NEITHER explicit ID was provided.
            log(`Target required, but no valid explicit target entity OR connection ID was provided.`, 'error');
            // Using the generic "requires target" message seems appropriate here.
            const failureMsg = usableComponentData.failure_message_target_required || TARGET_MESSAGES.USE_REQUIRES_TARGET(itemName);
            eventBus.dispatch('ui:message_display', {text: failureMsg, type: 'warning'});
            return {success: false, target: null, targetType: 'none', messages};
        }

        // --- 4. Validate the Found Potential Target Against Conditions ---
        // Determine target name based on resolved type
        const targetName = targetType === 'entity'
            ? getDisplayName(/** @type {Entity} */ (potentialTarget))
            : ((/** @type {Connection} */ (potentialTarget).name || /** @type {Connection} */ (potentialTarget).direction) ?? 'connection'); // Added nullish coalescing for safety

        log(`Validating potential target (${targetType} '${targetName}') against target_conditions.`);

        if (usableComponentData.target_conditions && usableComponentData.target_conditions.length > 0) {
            /** @type {ConditionEvaluationContext} */
            const targetCheckContext = {
                userEntity: userEntity,
                // Pass the correct context based on resolved type
                targetEntityContext: targetType === 'entity' ? /** @type {Entity} */ (potentialTarget) : null,
                targetConnectionContext: targetType === 'connection' ? /** @type {Connection} */ (potentialTarget) : null
            };
            /** @type {ConditionEvaluationOptions} */
            const targetOptions = {
                itemName: itemName,
                checkType: 'Target',
                fallbackMessages: {
                    target: usableComponentData.failure_message_invalid_target || TARGET_MESSAGES.USE_INVALID_TARGET(itemName), // Use specific or generic invalid message
                    default: TARGET_MESSAGES.USE_INVALID_TARGET(itemName) // Generic fallback
                }
            };

            // Determine the subject for condition evaluation
            // Conditions typically apply *to the target* itself.
            const conditionSubject = potentialTarget; // The Entity or Connection object

            // Evaluate conditions against the target (Entity or Connection)
            const targetCheckResult = await conditionEvaluationService.evaluateConditions(
                conditionSubject,       // Evaluate conditions *on* the target
                targetCheckContext,     // Provide full context
                usableComponentData.target_conditions,
                targetOptions
            );

            messages.push(...targetCheckResult.messages);

            if (!targetCheckResult.success) {
                log(`Target conditions failed for ${targetType} '${targetName}'.`, 'warning');
                // Dispatch failure message provided by the condition service
                if (targetCheckResult.failureMessage) {
                    eventBus.dispatch('ui:message_display', {
                        text: targetCheckResult.failureMessage,
                        type: 'warning'
                    });
                } else {
                    // Fallback if condition service didn't provide one
                    const fallbackMsg = usableComponentData.failure_message_invalid_target || TARGET_MESSAGES.USE_INVALID_TARGET(itemName);
                    eventBus.dispatch('ui:message_display', {
                        text: fallbackMsg,
                        type: 'warning'
                    });
                }
                return {success: false, target: null, targetType: 'none', messages};
            } else {
                log(`Target ${targetType} '${targetName}' passed validation conditions.`);
            }
        } else {
            log(`No target_conditions defined for ${itemName} or target type '${targetType}'. Target considered valid.`);
        }

        // --- 5. Target Found and Validated ---
        log(`Target resolution successful. Validated Target: ${targetType} '${targetName}'.`);
        // Return the correct target object (Entity or Connection) and its type
        return {success: true, target: potentialTarget, targetType: targetType, messages};
    }
}


/**
 * Centralized utility function to find a target entity based on name, scope, and required components.
 * (Function description remains the same)
 * @param {ActionContext} context - The action context.
 * @param {TargetResolverConfig} config - Configuration for the target resolution.
 * @returns {Entity | null} The found Entity or null. Dispatches UI messages on failure.
 */
// No changes needed for resolveTargetEntity for this ticket
export function resolveTargetEntity(context, config) {
    const {playerEntity, currentLocation, entityManager, dispatch} = context;

    // --- 1. Validate Inputs ---
    if (!context || !config || !config.scope || !config.requiredComponents || !config.actionVerb || !config.targetName) {
        console.error("resolveTargetEntity: Invalid context or configuration provided.", {context, config});
        return null;
    }
    if (typeof config.targetName !== 'string' || config.targetName.trim() === '') {
        console.warn("resolveTargetEntity: Received empty targetName. Resolution cannot proceed.");
        // Dispatch PROMPT_WHAT if required target missing? No, that's handled by validateRequiredTargets
        return null;
    }

    // --- 2. Normalize Scope and Prepare Components ---
    const scopes = Array.isArray(config.scope) ? config.scope : [config.scope];
    const requiredComponents = [NameComponent, ...config.requiredComponents.filter(c => c !== NameComponent)];

    // --- 3. Build Searchable Entities List ---
    const entityIdSet = new Set();
    // (Logic for building entityIdSet based on scopes remains the same)
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
                                // Apply scope filters BEFORE adding to set
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
                    // Add inventory items
                    const inventory = playerEntity.getComponent(InventoryComponent);
                    if (inventory) inventory.getItems().forEach(id => entityIdSet.add(id));
                    // Add location entities (excluding player)
                    if (currentLocation) {
                        const idsInLoc = entityManager.getEntitiesInLocation(currentLocation.id);
                        if (idsInLoc) idsInLoc.forEach(id => {
                            if (id !== playerEntity.id) {
                                const entity = entityManager.getEntityInstance(id);
                                // Only add if entity exists
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
        .filter(entity => entity); // Filter out nulls if entity instances were missing

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
    // (This handles cases where NO potential entities match filters,
    // before attempting name matching with findTarget)
    if (filteredEntities.length === 0) {
        // Only dispatch if the caller didn't suppress messages via notFoundMessageKey: null
        if (config.notFoundMessageKey !== null) {
            let emptyMsg;
            if (config.emptyScopeMessage) {
                emptyMsg = config.emptyScopeMessage;
            } else {
                // Determine generic message based on scope
                const isPersonalScope = scopes.every(s => s === 'inventory' || s === 'equipment');
                const isMixedPersonal = scopes.includes('inventory') || scopes.includes('equipment');

                if (isPersonalScope) {
                    emptyMsg = TARGET_MESSAGES.SCOPE_EMPTY_PERSONAL(config.actionVerb);
                } else {
                    // Default to 'here' or 'nearby' based on scopes involved
                    const scopeContext = (scopes.includes('location') || scopes.includes('location_items') || scopes.includes('location_non_items'))
                        ? 'here' : 'nearby'; // Simple heuristic
                    emptyMsg = TARGET_MESSAGES.SCOPE_EMPTY_GENERIC(config.actionVerb, scopeContext);
                }
            }
            dispatch('ui:message_display', {text: emptyMsg, type: 'info'});
        }
        return null; // Always return null if scope was empty after filtering
    }

    // --- 6. Call findTarget ---
    // This finds ENTITIES matching the name within the filtered list
    const findResult = findTarget(config.targetName, filteredEntities);

    // --- 7. Handle findTarget Results ---
    // (No changes here - Handles entity ambiguity/not found AFTER initial scope filtering)
    switch (findResult.status) {
        case 'NOT_FOUND': {
            // Only determine and dispatch a message if the caller did NOT explicitly pass null
            // for notFoundMessageKey, indicating they want the resolver to handle it.
            if (config.notFoundMessageKey !== null) {
                // Determine appropriate message key
                let messageKey = config.notFoundMessageKey; // Use override if provided and not null

                // If key is still null/undefined (because caller didn't provide an override), determine default
                if (!messageKey) {
                    // Determine default based on actionVerb and scope
                    if (config.actionVerb === 'equip') messageKey = 'NOT_FOUND_EQUIPPABLE';
                    else if (config.actionVerb === 'unequip') messageKey = 'NOT_FOUND_UNEQUIPPABLE';
                    else if (config.actionVerb === 'attack') messageKey = 'NOT_FOUND_ATTACKABLE';
                    else if (config.actionVerb === 'take') messageKey = 'NOT_FOUND_TAKEABLE';
                    // Simplified context check for 'use X on' style verbs
                    else if (config.actionVerb.includes(' on') || config.actionVerb.includes(' >')) messageKey = 'TARGET_NOT_FOUND_CONTEXT';
                    else if (scopes.length === 1 && scopes[0] === 'inventory') messageKey = 'NOT_FOUND_INVENTORY';
                    else if (scopes.length === 1 && scopes[0] === 'equipment') messageKey = 'NOT_FOUND_EQUIPPED';
                    else if (scopes.includes('inventory') || scopes.includes('equipment')) messageKey = 'NOT_FOUND_INVENTORY'; // Prefer inventory if mixed
                    else messageKey = 'NOT_FOUND_LOCATION'; // Default to location

                    // Final fallback if somehow still undefined
                    if (!messageKey) {
                        console.warn(`resolveTargetEntity: Could not determine a default message key for NOT_FOUND. Action: ${config.actionVerb}, Scope: ${scopes}`);
                        messageKey = 'NOT_FOUND_LOCATION'; // Fallback
                    }
                }

                // Generate and dispatch the message
                const messageGenerator = TARGET_MESSAGES[messageKey];
                let errorMsg;
                if (typeof messageGenerator === 'function') {
                    // Pass target name, or specific target description if it's a contextual message
                    const msgParam = messageKey === 'TARGET_NOT_FOUND_CONTEXT' ? config.targetName : config.targetName;
                    errorMsg = messageGenerator(msgParam);
                } else {
                    console.warn(`resolveTargetEntity: Invalid or missing message key in TARGET_MESSAGES: ${messageKey}. Falling back.`);
                    errorMsg = `You don't find any '${config.targetName}' to ${config.actionVerb}.`; // Basic fallback
                }

                dispatch('ui:message_display', {text: errorMsg, type: 'info'});

            } // End of conditional dispatch block

            // Always return null when status is NOT_FOUND
            return null;
        }
        case 'FOUND_AMBIGUOUS': {
            // Also suppress ambiguous prompt if notFoundMessageKey is null, assuming
            // the caller wants to handle all non-success cases.
            if (config.notFoundMessageKey !== null) {
                // Use the specific context message if available
                let errorMsg;
                if (config.actionVerb.includes(' on') || config.actionVerb.includes(' >')) {
                    errorMsg = TARGET_MESSAGES.TARGET_AMBIGUOUS_CONTEXT(config.actionVerb, config.targetName, findResult.matches);
                } else {
                    errorMsg = TARGET_MESSAGES.AMBIGUOUS_PROMPT(config.actionVerb, config.targetName, findResult.matches);
                }
                dispatch('ui:message_display', {text: errorMsg, type: 'warning'});
            }
            return null; // Always return null for ambiguous case
        }
        case 'FOUND_UNIQUE':
            return findResult.matches[0]; // Success! Return the entity.
        default: {
            // Internal errors maybe should always be dispatched? Or also suppressed?
            // Let's assume internal errors should still be shown for debugging.
            const errorMsg = TARGET_MESSAGES.INTERNAL_ERROR_RESOLUTION(findResult.status || 'unknown');
            dispatch('ui:message_display', {text: errorMsg, type: 'error'});
            console.error(`resolveTargetEntity: Internal error - Unexpected findTarget status: ${findResult.status}`);
            return null;
        }
    }
}

/**
 * Resolves a target connection within the player's current location based on name or direction.
 * Prioritizes exact direction matches over partial name matches.
 * Handles ambiguity and not found cases by dispatching UI messages.
 *
 * @param {ActionContext} context - The action context.
 * @param {string} connectionTargetName - The name or direction string provided by the user.
 * @param {string} [actionVerb='interact with'] - Verb used in feedback messages (e.g., 'use key on').
 * @returns {Connection | null} The found Connection object or null.
 */
// No changes needed for resolveTargetConnection for this ticket
export function resolveTargetConnection(context, connectionTargetName, actionVerb = 'interact with') {
    const {playerEntity, currentLocation, dispatch} = context;

    // 1. Validate Inputs
    if (!context || !currentLocation) {
        console.warn("resolveTargetConnection: Missing context or currentLocation.");
        return null;
    }
    if (typeof connectionTargetName !== 'string' || connectionTargetName.trim() === '') {
        console.warn("resolveTargetConnection: Received empty connectionTargetName. Resolution cannot proceed.");
        // Consider dispatching PROMPT_WHAT if appropriate for the calling action
        // dispatch('ui:message_display', { text: TARGET_MESSAGES.PROMPT_WHAT(actionVerb), type: 'prompt' });
        return null;
    }

    // 2. Get Connections Component
    const connectionsComponent = currentLocation.getComponent(ConnectionsComponent);
    if (!connectionsComponent) {
        console.warn(`resolveTargetConnection: Location ${currentLocation.id} lacks ConnectionsComponent.`);
        // Don't dispatch here, let the search handle not found if necessary.
        return null;
    }

    const allConnections = connectionsComponent.getAllConnections();
    if (allConnections.length === 0) {
        const emptyMsg = TARGET_MESSAGES.SCOPE_EMPTY_GENERIC(actionVerb, 'in this direction'); // Or MOVE_NO_EXITS if context known
        dispatch('ui:message_display', {text: emptyMsg, type: 'info'});
        return null;
    }

    // 3. Find Matching Connections with Priority
    const lowerCaseTarget = connectionTargetName.trim().toLowerCase();

    // --- Step 3a: Prioritize Exact Direction Match ---
    const directionMatches = allConnections.filter(conn =>
        conn.direction && conn.direction.toLowerCase() === lowerCaseTarget
    );

    if (directionMatches.length === 1) {
        // Unique exact direction match found. This is the highest priority.
        return directionMatches[0];
    }

    if (directionMatches.length > 1) {
        // Ambiguous based *only* on direction.
        const displayNames = directionMatches.map(conn => conn.name || conn.direction || conn.connectionId).join(', ');
        // Using a slightly more specific message for direction ambiguity
        const ambiguousMsg = `There are multiple ways to go '${connectionTargetName}'. Which one did you mean? (${displayNames})`;
        dispatch('ui:message_display', {text: ambiguousMsg, type: 'warning'});
        return null;
    }

    // --- Step 3b: If No Unique Direction Match, Check Name Match ---
    // Only proceed if directionMatches.length === 0
    const nameMatches = allConnections.filter(conn =>
        conn.name && typeof conn.name === 'string' && conn.name.toLowerCase().includes(lowerCaseTarget)
    );

    if (nameMatches.length === 1) {
        // Unique name match found (and no unique direction match existed).
        return nameMatches[0];
    }

    if (nameMatches.length > 1) {
        // Ambiguous based on name match.
        const displayNames = nameMatches.map(conn => conn.name || conn.direction || conn.connectionId).join(', ');
        const ambiguousMsg = `Which '${connectionTargetName}' did you want to ${actionVerb}? (${displayNames})`;
        dispatch('ui:message_display', {text: ambiguousMsg, type: 'warning'});
        return null;
    }

    // --- Step 4: Handle Not Found ---
    // If we reach here, neither direction nor name search yielded any results.
    const notFoundMsg = TARGET_MESSAGES.TARGET_NOT_FOUND_CONTEXT(connectionTargetName); // Or a more specific "You can't go that way." message
    dispatch('ui:message_display', {text: notFoundMsg, type: 'info'});
    return null;
}