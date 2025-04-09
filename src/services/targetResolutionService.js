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
    // --- MODIFICATION START ---
    if (filteredEntities.length === 0) {
        let emptyMsg;
        if (config.emptyScopeMessage) {
            // Use the exact string provided by the caller (which might be from TARGET_MESSAGES itself, e.g., TAKE_EMPTY_LOCATION)
            emptyMsg = config.emptyScopeMessage;
        } else {
            // Determine appropriate generic message from TARGET_MESSAGES
            const isPersonalScope = scopes.every(s => s === 'inventory' || s === 'equipment'); // Only inv/equip searched
            const isMixedPersonal = scopes.includes('inventory') || scopes.includes('equipment'); // At least one personal scope included (e.g., 'nearby')

            if (isPersonalScope) {
                emptyMsg = TARGET_MESSAGES.SCOPE_EMPTY_PERSONAL(config.actionVerb);
            } else {
                // Determine context string for generic message
                // Simple context: 'on you' if only personal, 'here' if only location-based, 'nearby' if mixed.
                const scopeContext = isPersonalScope ? 'on you'
                    : isMixedPersonal ? 'nearby'
                        : 'here';
                emptyMsg = TARGET_MESSAGES.SCOPE_EMPTY_GENERIC(config.actionVerb, scopeContext);
            }
        }
        dispatch('ui:message_display', {text: emptyMsg, type: 'info'});
        return null;
    }
    // --- MODIFICATION END ---

    // --- 6. Call findTarget --- (No changes here)
    const findResult = findTarget(config.targetName, filteredEntities);

    // --- 7. Handle findTarget Results ---
    switch (findResult.status) {
        case 'NOT_FOUND': {
            // --- MODIFICATION START ---
            // Determine appropriate message key
            let messageKey = config.notFoundMessageKey; // Use override if provided
            if (!messageKey) {
                // Prioritize action-specific keys first
                if (config.actionVerb === 'equip') messageKey = 'NOT_FOUND_EQUIPPABLE';
                else if (config.actionVerb === 'unequip') messageKey = 'NOT_FOUND_UNEQUIPPABLE';
                else if (config.actionVerb === 'attack') messageKey = 'NOT_FOUND_ATTACKABLE';
                else if (config.actionVerb === 'take') messageKey = 'NOT_FOUND_TAKEABLE';
                // Then fall back to scope-based keys
                else if (scopes.includes('inventory') && scopes.length === 1) messageKey = 'NOT_FOUND_INVENTORY'; // More specific if ONLY inventory
                else if (scopes.includes('equipment') && scopes.length === 1) messageKey = 'NOT_FOUND_EQUIPPED'; // More specific if ONLY equipment
                else if (scopes.includes('inventory') || scopes.includes('equipment')) messageKey = 'NOT_FOUND_INVENTORY'; // General 'on person' fallback if mixed
                // Final fallback based on location presence
                else messageKey = 'NOT_FOUND_LOCATION';
            }

            const messageGenerator = TARGET_MESSAGES[messageKey];
            let errorMsg;

            if (typeof messageGenerator === 'function') {
                errorMsg = messageGenerator(config.targetName);
            } else {
                // If the key was invalid, not found in TARGET_MESSAGES, or didn't resolve above
                console.warn(`resolveTargetEntity: Invalid or undetermined notFoundMessageKey: ${messageKey}. Falling back to generic.`);
                // Use the absolute generic fallback from TARGET_MESSAGES
                errorMsg = TARGET_MESSAGES.NOT_FOUND_GENERIC(config.targetName);
            }

            dispatch('ui:message_display', {text: errorMsg, type: 'info'});
            // --- MODIFICATION END ---
            return null;
        }
        case 'FOUND_AMBIGUOUS': {
            // --- MODIFICATION START ---
            // Use TARGET_MESSAGES exclusively. No hardcoded strings.
            // Note: targetName (what user typed) is used for the "type" in the prompt.
            const errorMsg = TARGET_MESSAGES.AMBIGUOUS_PROMPT(config.actionVerb, config.targetName, findResult.matches);
            dispatch('ui:message_display', {text: errorMsg, type: 'warning'});
            // --- MODIFICATION END ---
            return null;
        }
        case 'FOUND_UNIQUE':
            return findResult.matches[0]; // Success! Return the entity.
        default: {
            // Should not happen with current findTarget implementation
            console.error("resolveTargetEntity: Unexpected status from findTarget:", findResult.status);
            // --- MODIFICATION START ---
            // Use the specific internal error message from TARGET_MESSAGES
            const errorMsg = TARGET_MESSAGES.INTERNAL_ERROR_RESOLUTION(findResult.status || 'unknown');
            // --- MODIFICATION END ---
            dispatch('ui:message_display', {text: errorMsg, type: 'error'});
            return null;
        }
    }
}