// src/services/targetResolutionService.js

import {findTarget} from '../utils/targetFinder.js';
import {TARGET_MESSAGES} from '../utils/messages.js'; // Assuming this path is correct
import {NameComponent} from '../components/nameComponent.js';
import {InventoryComponent} from '../components/inventoryComponent.js';
import {EquipmentComponent} from '../components/equipmentComponent.js';
import {ItemComponent} from '../components/itemComponent.js';
// Import other components if needed

/** @typedef {import('../actions/actionTypes.js').ActionContext} ActionContext */
/** @typedef {import('../entities/entity.js').default} Entity */
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

    // --- 1. Validate Inputs --- (No changes here)
    if (!context || !config || !config.scope || !config.requiredComponents || !config.actionVerb || !config.targetName) {
        console.error("resolveTargetEntity: Invalid context or configuration provided.", {context, config});
        return null;
    }
    if (typeof config.targetName !== 'string' || config.targetName.trim() === '') {
        console.warn("resolveTargetEntity: Received empty targetName. Resolution cannot proceed.");
        return null;
    }

    // --- 2. Normalize Scope and Prepare Components --- (No changes here)
    const scopes = Array.isArray(config.scope) ? config.scope : [config.scope];
    const requiredComponents = [NameComponent, ...config.requiredComponents.filter(c => c !== NameComponent)];

    // --- 3. Build Searchable Entities List --- (No changes here)
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
                            if (id !== playerEntity.id) entityIdSet.add(id);
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


    // --- 4. Filter Entities --- (No changes here)
    const initialEntities = Array.from(entityIdSet)
        .map(id => entityManager.getEntityInstance(id))
        .filter(entity => entity);

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
        // Only dispatch if the caller didn't suppress messages via notFoundMessageKey: null
        // (Using notFoundMessageKey as a general signal to suppress resolver messages for now)
        if (config.notFoundMessageKey !== null) {
            let emptyMsg;
            if (config.emptyScopeMessage) {
                emptyMsg = config.emptyScopeMessage;
            } else {
                const isPersonalScope = scopes.every(s => s === 'inventory' || s === 'equipment');
                const isMixedPersonal = scopes.includes('inventory') || scopes.includes('equipment');

                if (isPersonalScope) {
                    emptyMsg = TARGET_MESSAGES.SCOPE_EMPTY_PERSONAL(config.actionVerb);
                } else {
                    const scopeContext = isPersonalScope ? 'on you'
                        : isMixedPersonal ? 'nearby'
                            : 'here';
                    emptyMsg = TARGET_MESSAGES.SCOPE_EMPTY_GENERIC(config.actionVerb, scopeContext);
                }
            }
            dispatch('ui:message_display', {text: emptyMsg, type: 'info'});
        }
        return null; // Always return null if scope was empty after filtering
    }

    // --- 6. Call findTarget --- (No changes here)
    const findResult = findTarget(config.targetName, filteredEntities);

    // --- 7. Handle findTarget Results ---
    switch (findResult.status) {
        case 'NOT_FOUND': {
            // Only determine and dispatch a message if the caller did NOT explicitly pass null
            // for notFoundMessageKey, indicating they want the resolver to handle it.
            if (config.notFoundMessageKey !== null) {
                // Determine appropriate message key
                let messageKey = config.notFoundMessageKey; // Use override if provided and not null

                // If key is still null/undefined (because caller didn't provide an override), determine default
                if (!messageKey) {
                    if (config.actionVerb === 'equip') messageKey = 'NOT_FOUND_EQUIPPABLE';
                    else if (config.actionVerb === 'unequip') messageKey = 'NOT_FOUND_UNEQUIPPABLE';
                    else if (config.actionVerb === 'attack') messageKey = 'NOT_FOUND_ATTACKABLE';
                    else if (config.actionVerb === 'take') messageKey = 'NOT_FOUND_TAKEABLE';
                    else if (scopes.length === 1 && scopes[0] === 'inventory') messageKey = 'NOT_FOUND_INVENTORY';
                    else if (scopes.length === 1 && scopes[0] === 'equipment') messageKey = 'NOT_FOUND_EQUIPPED';
                    else if (scopes.includes('inventory') || scopes.includes('equipment')) messageKey = 'NOT_FOUND_INVENTORY';
                    else messageKey = 'NOT_FOUND_LOCATION';

                    if (!messageKey) {
                        console.warn(`resolveTargetEntity: Could not determine a default message key for NOT_FOUND. Action: ${config.actionVerb}, Scope: ${scopes}`);
                        messageKey = 'NOT_FOUND_INVENTORY'; // Fallback
                    }
                }

                // Generate and dispatch the message
                const messageGenerator = TARGET_MESSAGES[messageKey];
                let errorMsg;
                if (typeof messageGenerator === 'function') {
                    errorMsg = messageGenerator(config.targetName);
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
                const errorMsg = TARGET_MESSAGES.AMBIGUOUS_PROMPT(config.actionVerb, config.targetName, findResult.matches);
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
            return null;
        }
    }
}