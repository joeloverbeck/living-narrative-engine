// src/services/entityFinderService.js

// --- Standard JavaScript Imports ---
import {findTarget} from '../utils/targetFinder.js';
import {getDisplayName, TARGET_MESSAGES} from '../utils/messages.js';
import {NameComponent} from '../components/nameComponent.js';
import {InventoryComponent} from '../components/inventoryComponent.js';
import {EquipmentComponent} from '../components/equipmentComponent.js';
import {ItemComponent} from '../components/itemComponent.js';
import {PositionComponent} from "../components/positionComponent.js";

// --- JSDoc Type Imports ---
/** @typedef {import('../core/eventBus.js').default} EventBus */
/** @typedef {import('../entities/entityManager.js').default} EntityManager */
/** @typedef {import('../entities/entity.js').default} Entity */
/** @typedef {import('../actions/actionTypes.js').ActionContext} ActionContext */
/** @typedef {import('../components/component.js').default} Component */ // Needed for ComponentConstructor type check
/** @typedef {typeof Component} ComponentConstructor */ // Define ComponentConstructor based on Component import

/**
 * Configuration options for resolving a target entity.
 * NOTE: This definition is copied here as it's essential for the function signature.
 * @typedef {object} TargetResolverConfig
 * @property {string | string[]} scope - Defines where to search. Valid scopes: 'inventory', 'location', 'equipment', 'location_items', 'location_non_items', 'nearby'.
 * @property {ComponentConstructor[]} requiredComponents - An array of Component classes the target must possess.
 * @property {string} actionVerb - The verb used in feedback messages.
 * @property {string} targetName - The name string provided by the user.
 * @property {(entity: Entity) => boolean} [customFilter] - Optional additional filtering function.
 * @property {keyof typeof TARGET_MESSAGES | null} [notFoundMessageKey] - Optional override for the TARGET_MESSAGES key used on NOT_FOUND. Defaults based on scope/action. null suppresses default message.
 * @property {string} [emptyScopeMessage] - Optional override for the message dispatched when the initial scope yields no suitable entities (e.g., use TARGET_MESSAGES.TAKE_EMPTY_LOCATION).
 */

/**
 * Centralized utility function to find a target entity based on name, scope, and required components.
 * @param {ActionContext | null | undefined} context - The action context. Can be null/undefined for tests.
 * @param {TargetResolverConfig | null | undefined} config - Configuration for the target resolution. Can be null/undefined for tests.
 * @returns {Entity | null} The found Entity or null. Dispatches UI messages on failure.
 */
function resolveTargetEntity(context, config) {

    // --- 1. Validate Core Inputs (Context and Config structure) ---
    // FIX: Check context and config BEFORE destructuring context or accessing config deeply.
    // FIX: Adjusted config check to allow targetName to be an empty string at this stage.
    if (!context || !config || !config.scope || !config.requiredComponents || !config.actionVerb || typeof config.targetName !== 'string') {
        // Check if targetName is strictly not a string (null, undefined, wrong type)
        console.error("resolveTargetEntity: Invalid context or configuration provided.", {context, config});
        return null;
    }

    // --- Now it's safe to destructure context ---
    const {playerEntity, currentLocation, entityManager, dispatch} = context;

    // --- 2. Validate Target Name Content ---
    if (config.targetName.trim() === '') {
        console.warn("resolveTargetEntity: Received empty targetName. Resolution cannot proceed.");
        return null;
    }

    // --- 3. Normalize Scope and Prepare Components ---
    const scopes = Array.isArray(config.scope) ? config.scope : [config.scope];
    const requiredComponentsSet = new Set([NameComponent, ...config.requiredComponents]);
    const requiredComponents = Array.from(requiredComponentsSet);

    // --- 4. Build Searchable Entities List ---
    const entityIdSet = new Set();
    for (const scope of scopes) {
        try {
            switch (scope) {
                // *** IMPORTANT: Check for playerEntity existence *before* accessing its methods ***
                case 'inventory': {
                    // Check playerEntity exists AND has the component
                    if (playerEntity && playerEntity.hasComponent(InventoryComponent)) {
                        const inventory = playerEntity.getComponent(InventoryComponent);
                        inventory.getItems().forEach(id => entityIdSet.add(id));
                    } else if (playerEntity) { // Player exists but no inventory
                        console.warn(`resolveTargetEntity: Scope 'inventory' requested but player ${playerEntity.id} lacks InventoryComponent.`);
                    } else { // Player entity itself is missing from context (should have been caught earlier, but safe check)
                        console.warn(`resolveTargetEntity: Scope 'inventory' requested but playerEntity is missing in context.`);
                    }
                    break;
                }
                case 'location':
                case 'location_items':
                case 'location_non_items': {
                    if (!currentLocation) {
                        console.warn(`resolveTargetEntity: Scope '${scope}' requested but currentLocation is null.`);
                        continue; // Use continue to proceed to the next scope if in a loop
                    }
                    // Ensure playerEntity is checked before potentially excluding its ID
                    const playerId = playerEntity ? playerEntity.id : null;
                    const idsInLoc = entityManager.getEntitiesInLocation(currentLocation.id);
                    if (idsInLoc) {
                        idsInLoc.forEach(id => {
                            // Exclude the player entity itself if player exists
                            if (playerId && id === playerId) return;

                            const entity = entityManager.getEntityInstance(id);
                            if (!entity) {
                                console.warn(`resolveTargetEntity: Entity ID ${id} listed in location ${currentLocation.id} but instance not found.`);
                                return;
                            }
                            // Apply scope-specific filters
                            if (scope === 'location_items' && !entity.hasComponent(ItemComponent)) return;
                            if (scope === 'location_non_items' && entity.hasComponent(ItemComponent)) return;
                            entityIdSet.add(id);
                        });
                    }
                    break;
                }
                case 'equipment': {
                    // Check playerEntity exists AND has the component
                    if (playerEntity && playerEntity.hasComponent(EquipmentComponent)) {
                        const equipment = playerEntity.getComponent(EquipmentComponent);
                        Object.values(equipment.getAllEquipped()).forEach(id => {
                            if (id) entityIdSet.add(id);
                        });
                    } else if (playerEntity) { // Player exists but no equipment
                        console.warn(`resolveTargetEntity: Scope 'equipment' requested but player ${playerEntity.id} lacks EquipmentComponent.`);
                    } else { // Player missing
                        console.warn(`resolveTargetEntity: Scope 'equipment' requested but playerEntity is missing in context.`);
                    }
                    break;
                }
                case 'nearby': // Combines inventory and location (excluding player)
                    // Inventory (Check player)
                    if (playerEntity && playerEntity.hasComponent(InventoryComponent)) {
                        playerEntity.getComponent(InventoryComponent).getItems().forEach(id => entityIdSet.add(id));
                    }
                    // Location (Check location and player)
                    if (currentLocation) {
                        const playerId = playerEntity ? playerEntity.id : null;
                        const idsInLoc = entityManager.getEntitiesInLocation(currentLocation.id);
                        if (idsInLoc) idsInLoc.forEach(id => {
                            if (playerId && id === playerId) return; // Exclude player
                            const entity = entityManager.getEntityInstance(id);
                            if (entity) entityIdSet.add(id);
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

    // --- 5. Filter Entities by Required Components and Custom Filter ---
    const initialEntities = Array.from(entityIdSet)
        .map(id => entityManager.getEntityInstance(id))
        .filter(Boolean);

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

    // --- 6. Handle Empty Filtered Scope ---
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
                    const scopeContext = (scopes.includes('location') || scopes.includes('location_items') || scopes.includes('location_non_items') || scopes.includes('nearby'))
                        ? 'here' : 'nearby';
                    emptyMsg = TARGET_MESSAGES.SCOPE_EMPTY_GENERIC(config.actionVerb, scopeContext);
                }
            }
            // Ensure dispatch exists before calling it
            if (dispatch) dispatch('ui:message_display', {text: emptyMsg, type: 'info'});
            else console.warn("resolveTargetEntity: Cannot dispatch message, dispatch function missing in context.");
        }
        return null;
    }

    // --- 7. Call findTarget Utility ---
    const findResult = findTarget(config.targetName, filteredEntities);

    // --- 8. Handle findTarget Results (Not Found, Ambiguous, Found) ---
    // Ensure dispatch exists before calling it in failure cases
    if (!dispatch && (findResult.status === 'NOT_FOUND' || findResult.status === 'FOUND_AMBIGUOUS' || findResult.status === 'INTERNAL_ERROR')) {
        console.warn("resolveTargetEntity: Cannot dispatch message, dispatch function missing in context.");
    }

    switch (findResult.status) {
        case 'NOT_FOUND': {
            // Check if message suppression is requested (null)
            if (config.notFoundMessageKey !== null) {
                let messageKey = config.notFoundMessageKey; // Use override key if provided

                // Determine default message key if no override
                if (!messageKey) {

                    // <<< ADD DEBUG LOGGING HERE >>>
                    console.log(`DEBUG: NOT_FOUND check. Verb: "${config.actionVerb}", Includes ' on ': ${config.actionVerb.includes(' on ')}`);
                    // <<< END DEBUG LOGGING >>>

                    // Prioritize specific action-related messages
                    if (config.actionVerb === 'equip') messageKey = 'NOT_FOUND_EQUIPPABLE';
                    else if (config.actionVerb === 'unequip') messageKey = 'NOT_FOUND_UNEQUIPPABLE';
                    else if (config.actionVerb === 'attack') messageKey = 'NOT_FOUND_ATTACKABLE';
                    else if (config.actionVerb === 'take') messageKey = 'NOT_FOUND_TAKEABLE';
                    // Check for context actions (like 'use X on Y')
                    else if (config.actionVerb.trim().includes(' on ') || config.actionVerb.trim().endsWith(' on') || config.actionVerb.trim().includes(' > ')) {
                        messageKey = 'TARGET_NOT_FOUND_CONTEXT';
                        console.log('DEBUG: Context key selected.'); // Add log here too
                    }
                    // Scope-specific messages
                    else if (scopes.length === 1 && scopes[0] === 'inventory') messageKey = 'NOT_FOUND_INVENTORY';
                    else if (scopes.length === 1 && scopes[0] === 'equipment') messageKey = 'NOT_FOUND_EQUIPPED';
                    // Fallback based on general scope area
                    else if (scopes.includes('inventory') || scopes.includes('equipment')) messageKey = 'NOT_FOUND_INVENTORY'; // Prefer inventory if it was searched
                    else {
                        messageKey = 'NOT_FOUND_LOCATION';
                        console.log('DEBUG: Location key selected.'); // And here
                    }

                    // Final fallback if logic somehow failed
                    if (!messageKey) {
                        console.warn(`resolveTargetEntity: Could not determine a default message key for NOT_FOUND. Action: ${config.actionVerb}, Scope: ${scopes.join(',')}`);
                        messageKey = 'NOT_FOUND_GENERIC'; // Use a truly generic one if available
                    }
                }

                const messageGenerator = TARGET_MESSAGES[messageKey];
                let errorMsg;
                if (typeof messageGenerator === 'function') {
                    // Pass appropriate parameter based on message type
                    const msgParam = (messageKey === 'TARGET_NOT_FOUND_CONTEXT' || messageKey.startsWith('NOT_FOUND_'))
                        ? config.targetName
                        : config.targetName; // Default parameter is usually the target name
                    errorMsg = messageGenerator(msgParam);
                } else {
                    // Fallback if the message key is invalid or message isn't defined
                    console.warn(`resolveTargetEntity: Invalid or missing message key in TARGET_MESSAGES: ${messageKey}. Falling back to generic message.`);
                    errorMsg = TARGET_MESSAGES.NOT_FOUND_GENERIC ? TARGET_MESSAGES.NOT_FOUND_GENERIC(config.targetName) : `You don't see any '${config.targetName}' to ${config.actionVerb}.`;
                }
                dispatch('ui:message_display', {text: errorMsg, type: 'info'});
            }
            return null; // Target not found
        }
        case 'FOUND_AMBIGUOUS': {
            // Check if message suppression is requested (null) - Although ambiguity usually needs feedback
            if (config.notFoundMessageKey !== null) { // Reuse the same flag for general feedback control
                let errorMsg;
                const targetEntities = findResult.matches;

                // <<< ADD DEBUG LOGGING HERE >>>
                console.log(`DEBUG: AMBIGUOUS check. Verb: "${config.actionVerb}", Includes ' on ': ${config.actionVerb.includes(' on ')}, Context Msg Exists: ${!!TARGET_MESSAGES.TARGET_AMBIGUOUS_CONTEXT}`);
                // <<< END DEBUG LOGGING >>>

                // Prefer specific ambiguity messages if available
                if ((config.actionVerb.includes(' on ') || config.actionVerb.includes(' > ')) && TARGET_MESSAGES.TARGET_AMBIGUOUS_CONTEXT) {
                    errorMsg = TARGET_MESSAGES.TARGET_AMBIGUOUS_CONTEXT(config.actionVerb, config.targetName, targetEntities);
                } else if (TARGET_MESSAGES.AMBIGUOUS_PROMPT) {
                    errorMsg = TARGET_MESSAGES.AMBIGUOUS_PROMPT(config.actionVerb, config.targetName, targetEntities);
                } else {
                    // Generic fallback if specific ambiguity messages aren't defined
                    const displayNames = targetEntities.map(e => getDisplayName(e) || e.id).join(', ');
                    errorMsg = `Which '${config.targetName}' did you want to ${config.actionVerb}? Be more specific (e.g., ${displayNames.split(', ')[0]}).`; // Simplified fallback
                }
                dispatch('ui:message_display', {text: errorMsg, type: 'warning'});
            }
            return null; // Ambiguous result
        }
        case 'FOUND_UNIQUE':
            // Success! Return the single matching entity.
            return findResult.matches[0];
        default: {
            // Handle unexpected status from findTarget
            const errorMsg = TARGET_MESSAGES.INTERNAL_ERROR_RESOLUTION
                ? TARGET_MESSAGES.INTERNAL_ERROR_RESOLUTION(findResult.status || 'unknown')
                : 'An internal error occurred during target resolution.';
            dispatch('ui:message_display', {text: errorMsg, type: 'error'});
            console.error(`resolveTargetEntity: Internal error - Unexpected findTarget status: ${findResult.status}`);
            return null; // Internal error state
        }
    }
} // End resolveTargetEntity

// --- Export the function ---
export {resolveTargetEntity};
