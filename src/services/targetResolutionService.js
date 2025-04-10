// src/services/targetResolutionService.js

import {findTarget} from '../utils/targetFinder.js';
import {TARGET_MESSAGES} from '../utils/messages.js'; // Assuming this path is correct
import {NameComponent} from '../components/nameComponent.js';
import {InventoryComponent} from '../components/inventoryComponent.js';
import {EquipmentComponent} from '../components/equipmentComponent.js';
import {ItemComponent} from '../components/itemComponent.js';
// Import ConnectionsComponent
import {ConnectionsComponent} from '../components/connectionsComponent.js';
// Import other components if needed

/** @typedef {import('../actions/actionTypes.js').ActionContext} ActionContext */
/** @typedef {import('../entities/entity.js').default} Entity */
/** @typedef {import('../components/connectionsComponent.js').Connection} Connection */
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
 * @property {keyof typeof TARGET_MESSAGES} [notFoundMessageKey] - Optional override for the TARGET_MESSAGES key used on NOT_FOUND. Defaults based on scope/action.
 * @property {string} [emptyScopeMessage] - Optional override for the message dispatched when the initial scope yields no suitable entities (e.g., use TARGET_MESSAGES.TAKE_EMPTY_LOCATION).
 */

/**
 * Centralized utility function to find a target entity based on name, scope, and required components.
 * (Function description remains the same)
 * @param {ActionContext} context - The action context.
 * @param {TargetResolverConfig} config - Configuration for the target resolution.
 * @returns {Entity | null} The found Entity or null. Dispatches UI messages on failure.
 */
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
 * Handles ambiguity and not found cases by dispatching UI messages.
 *
 * @param {ActionContext} context - The action context.
 * @param {string} connectionTargetName - The name or direction string provided by the user.
 * @param {string} [actionVerb='interact with'] - Verb used in feedback messages (e.g., 'use key on').
 * @returns {Connection | null} The found Connection object or null.
 */
export function resolveTargetConnection(context, connectionTargetName, actionVerb = 'interact with') {
    const {playerEntity, currentLocation, dispatch} = context;

    // 1. Validate Inputs
    if (!context || !currentLocation) {
        console.warn("resolveTargetConnection: Missing context or currentLocation.");
        // Maybe dispatch an internal error? Or assume caller handled location check.
        return null;
    }
    if (typeof connectionTargetName !== 'string' || connectionTargetName.trim() === '') {
        console.warn("resolveTargetConnection: Received empty connectionTargetName. Resolution cannot proceed.");
        // Maybe dispatch a generic "What do you want to [actionVerb]?"
        // dispatch('ui:message_display', { text: TARGET_MESSAGES.PROMPT_WHAT(actionVerb), type: 'prompt' });
        return null;
    }

    // 2. Get Connections Component
    const connectionsComponent = currentLocation.getComponent(ConnectionsComponent);
    if (!connectionsComponent) {
        console.warn(`resolveTargetConnection: Location ${currentLocation.id} lacks ConnectionsComponent.`);
        // Maybe dispatch "There are no connections here."? Depends on context.
        // Let the specific search handle not found.
        return null;
    }

    const allConnections = connectionsComponent.getAllConnections();
    if (allConnections.length === 0) {
        // Use SCOPE_EMPTY_GENERIC or a more specific message like MOVE_NO_EXITS?
        const emptyMsg = TARGET_MESSAGES.SCOPE_EMPTY_GENERIC(actionVerb, 'in this direction');
        dispatch('ui:message_display', {text: emptyMsg, type: 'info'});
        return null;
    }

    // 3. Find Matching Connections
    const lowerCaseTarget = connectionTargetName.trim().toLowerCase();
    const foundMatches = allConnections.filter(conn => {
        // Check direction match (case-insensitive)
        if (conn.direction && conn.direction.toLowerCase() === lowerCaseTarget) {
            return true;
        }
        // Check name match (case-insensitive, partial)
        // Ensure name exists and is a string before checking
        if (conn.name && typeof conn.name === 'string' && conn.name.toLowerCase().includes(lowerCaseTarget)) {
            return true;
        }
        // Maybe check description_override as well? For simplicity, stick to direction and name for now.
        // if (conn.description_override && typeof conn.description_override === 'string' && conn.description_override.toLowerCase().includes(lowerCaseTarget)) {
        //    return true;
        // }
        return false;
    });

    // 4. Handle Results
    if (foundMatches.length === 0) {
        // Use TARGET_NOT_FOUND_CONTEXT or a specific connection message?
        const notFoundMsg = TARGET_MESSAGES.TARGET_NOT_FOUND_CONTEXT(connectionTargetName); // Generic context target not found
        dispatch('ui:message_display', {text: notFoundMsg, type: 'info'});
        return null;
    } else if (foundMatches.length === 1) {
        return foundMatches[0]; // Success! Return the unique connection object.
    } else { // Ambiguous
        // Adapt ambiguous prompt messages
        // We need a way to display connection matches. Using 'name' or 'direction'.
        const displayNames = foundMatches.map(conn => conn.name || conn.direction || conn.connectionId).join(', ');
        const ambiguousMsg = `Which '${connectionTargetName}' did you want to ${actionVerb}? (${displayNames})`;
        dispatch('ui:message_display', {text: ambiguousMsg, type: 'warning'});
        return null;
    }
}