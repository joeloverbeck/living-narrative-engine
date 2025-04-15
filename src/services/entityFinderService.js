// src/services/entityFinderService.js

// --- Standard JavaScript Imports ---
// findTarget is still needed
import {findTarget} from '../utils/targetFinder.js';
// getDisplayName and TARGET_MESSAGES are NO LONGER needed here
// import {getDisplayName, TARGET_MESSAGES} from '../utils/messages.js'; // Remains commented out
import {NameComponent} from '../components/nameComponent.js';

// Import the entityScopeService function (remains the same)
import {getEntityIdsForScopes} from './entityScopeService.js';

// --- JSDoc Type Imports ---
/** @typedef {import('../core/eventBus.js').default} EventBus */ // No longer used directly
/** @typedef {import('../entities/entityManager.js').default} EntityManager */
/** @typedef {import('../entities/entity.js').default} Entity */
/** @typedef {import('../actions/actionTypes.js').ActionContext} ActionContext */
/** @typedef {import('../components/component.js').default} Component */ // Needed for ComponentConstructor type check
/** @typedef {typeof Component} ComponentConstructor */ // Define ComponentConstructor based on Component import

// --- NEW: JSDoc Type Definitions for Resolution Outcome ---

/**
 * Represents the status of the entity resolution attempt.
 * - 'FOUND_UNIQUE': Exactly one matching entity was found.
 * - 'NOT_FOUND': No entities matched the target name after filtering.
 * - 'AMBIGUOUS': Multiple entities matched the target name after filtering.
 * - 'FILTER_EMPTY': No entities met the required component/scope/filter criteria (list was empty before name matching).
 * - 'INVALID_INPUT': The provided context, config, or targetName was invalid for processing.
 * @typedef {'FOUND_UNIQUE' | 'NOT_FOUND' | 'AMBIGUOUS' | 'FILTER_EMPTY' | 'INVALID_INPUT'} ResolutionStatus
 */

/**
 * Structure containing the result of an entity resolution attempt.
 * @typedef {object} ResolutionResult
 * @property {ResolutionStatus} status - The outcome status of the resolution attempt.
 * @property {Entity | null} entity - The uniquely found entity (only non-null if status is 'FOUND_UNIQUE').
 * @property {Entity[] | null} candidates - The list of ambiguous candidate entities (only non-null if status is 'AMBIGUOUS').
 */

/**
 * Configuration options for resolving a target entity.
 * @typedef {object} TargetResolverConfig
 * @property {string | string[]} scope - Defines where to search. Valid scopes handled by entityScopeService.
 * @property {ComponentConstructor[]} requiredComponents - An array of Component classes the target must possess.
 * @property {string} actionVerb - The verb used in feedback messages. *NO LONGER USED INTERNALLY by resolveTargetEntity, but potentially useful for callers constructing feedback based on the ResolutionResult*.
 * @property {string} targetName - The name string provided by the user.
 * @property {(entity: Entity) => boolean} [customFilter] - Optional additional filtering function.
 */

/**
 * Centralized utility function to find a target entity based on name, scope, and required components.
 * Uses entityScopeService to resolve entity IDs based on scope.
 * Returns a structured result object indicating the outcome. Does NOT dispatch UI messages.
 *
 * @param {ActionContext | null | undefined} context - The action context. Requires entityManager.
 * @param {TargetResolverConfig | null | undefined} config - Configuration for the target resolution. Requires scope, requiredComponents, targetName.
 * @returns {ResolutionResult} An object detailing the resolution outcome.
 */
function resolveTargetEntity(context, config) {
    // --- 1. Validate Core Inputs (Context and Config structure) ---
    // Check for essential properties. actionVerb is no longer strictly needed *internally*.
    if (
        !context ||
        !context.entityManager ||
        !config ||
        !config.scope ||
        !config.requiredComponents ||
        // REMOVED: Internal check for config.actionVerb
        typeof config.targetName !== 'string'
    ) {
        console.error(
            'resolveTargetEntity: Invalid context or configuration provided.',
            {context, config}
        );
        // Return INVALID_INPUT status
        return {
            status: 'INVALID_INPUT',
            entity: null,
            candidates: null,
        };
    }

    // --- Now it's safe to destructure context ---
    // Note: playerEntity and currentLocation might be null within context,
    // the entityScopeService handles those cases internally.
    const {entityManager} = context;

    // --- 2. Validate Target Name Content ---
    if (config.targetName.trim() === '') {
        console.warn(
            'resolveTargetEntity: Received empty targetName. Resolution cannot proceed.'
        );
        // Return INVALID_INPUT status
        return {
            status: 'INVALID_INPUT',
            entity: null,
            candidates: null,
        };
    }

    // --- 3. Normalize Scope and Prepare Components ---
    // Ensure `scopes` is an array for the service call
    const scopes = Array.isArray(config.scope) ? config.scope : [config.scope];
    // Ensure NameComponent is always implicitly required for findTarget to work
    const requiredComponentsSet = new Set([
        NameComponent,
        ...config.requiredComponents,
    ]);
    const requiredComponents = Array.from(requiredComponentsSet);

    // --- 4. Build Searchable Entities List (Using Service) ---
    // Delegate scope resolution to the entityScopeService
    const entityIdSet = getEntityIdsForScopes(scopes, context);

    // --- 5. Filter Entities by Required Components and Custom Filter ---
    const initialEntities = Array.from(entityIdSet)
        .map((id) => entityManager.getEntityInstance(id))
        .filter(Boolean); // Filter out potential null entities

    const filteredEntities = initialEntities.filter((entity) => {
        // Check for required components
        const hasAllRequired = requiredComponents.every((ComponentClass) =>
            entity.hasComponent(ComponentClass)
        );
        if (!hasAllRequired) return false;

        // Apply custom filter if provided
        if (config.customFilter) {
            try {
                return config.customFilter(entity);
            } catch (filterError) {
                console.error(
                    `resolveTargetEntity: Error executing customFilter for entity ${entity.id}:`,
                    filterError
                );
                return false; // Exclude entity if filter throws
            }
        }
        return true;
    });

    // --- 6. Handle Empty Filtered Scope ---
    // This triggers if the service returned an empty set,
    // OR if the component/custom filtering removed all candidates.
    if (filteredEntities.length === 0) {
        // REMOVED: All message determination and dispatch logic.
        // Return FILTER_EMPTY status
        return {
            status: 'FILTER_EMPTY',
            entity: null,
            candidates: null,
        };
    }

    // --- 7. Call findTarget Utility ---
    // This remains the same, operating on the filtered list.
    const findResult = findTarget(config.targetName, filteredEntities);

    // --- 8. Handle findTarget Results (Not Found, Ambiguous, Found) ---

    switch (findResult.status) {
        case 'NOT_FOUND': {
            // Return NOT_FOUND status
            return {
                status: 'NOT_FOUND',
                entity: null,
                candidates: null,
            };
        }
        case 'FOUND_AMBIGUOUS': {
            // Return AMBIGUOUS status with the candidates
            return {
                status: 'AMBIGUOUS',
                entity: null,
                candidates: findResult.matches,
            };
        }
        case 'FOUND_UNIQUE': {
            // Return FOUND_UNIQUE status with the single entity
            return {
                status: 'FOUND_UNIQUE',
                entity: findResult.matches[0],
                candidates: null,
            };
        }
        default: {
            // Handle unexpected status from findTarget - Log internal error and return a failure status.
            // 'NOT_FOUND' seems the most appropriate fallback among the defined statuses, indicating failure to resolve.
            console.error(
                `resolveTargetEntity: Internal error - Unexpected findTarget status: ${
                    findResult.status || 'unknown'
                }`
            );
            // REMOVED: Dispatch call for internal error.
            return {
                status: 'NOT_FOUND', // Or potentially introduce an 'INTERNAL_ERROR' status if deemed necessary later.
                entity: null,
                candidates: null,
            };
        }
    }
} // End resolveTargetEntity

// --- Export the function ---
export {resolveTargetEntity};

/**
 * Example Usage (in an Action handler):
 *
 * import { resolveTargetEntity } from './entityFinderService.js';
 * import { TARGET_MESSAGES, getDisplayName } from '../utils/messages.js';
 *
 * function handleLookAction(context, targetName) {
 * const config = {
 * scope: 'nearby', // Search inventory and location
 * requiredComponents: [], // Just need NameComponent (implicit)
 * actionVerb: 'look', // Still useful for constructing messages later
 * targetName: targetName,
 * };
 *
 * const resolution = resolveTargetEntity(context, config);
 *
 * switch (resolution.status) {
 * case 'FOUND_UNIQUE':
 * // Found the entity, proceed with 'look' logic
 * context.dispatch('ui:message_display', { text: `You look at the ${getDisplayName(resolution.entity)}. It looks like a ${resolution.entity.name}.`, type: 'info' });
 * // ... more detailed description logic ...
 * break;
 *
 * case 'NOT_FOUND':
 * // Use TARGET_MESSAGES (or custom logic) to generate feedback
 * context.dispatch('ui:message_display', { text: TARGET_MESSAGES.NOT_FOUND_LOCATION(targetName), type: 'info' });
 * break;
 *
 * case 'AMBIGUOUS':
 * // Generate ambiguity feedback
 * const ambiguousMsg = TARGET_MESSAGES.AMBIGUOUS_PROMPT(config.actionVerb, targetName, resolution.candidates);
 * context.dispatch('ui:message_display', { text: ambiguousMsg, type: 'warning' });
 * break;
 *
 * case 'FILTER_EMPTY':
 * // Generate feedback for empty scope/filter result
 * const emptyMsg = TARGET_MESSAGES.SCOPE_EMPTY_GENERIC(config.actionVerb, 'nearby'); // Determine context based on scope
 * context.dispatch('ui:message_display', { text: emptyMsg, type: 'info' });
 * break;
 *
 * case 'INVALID_INPUT':
 * // Usually indicates a programming error in how the action called resolveTargetEntity
 * // Logged internally by resolveTargetEntity, maybe show a generic error to user?
 * context.dispatch('ui:message_display', { text: 'There seems to be a problem with that command.', type: 'error' });
 * break;
 * }
 * }
 *
 */