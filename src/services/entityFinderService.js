// src/services/entityFinderService.js

// --- Standard JavaScript Imports ---
import { findTarget } from '../utils/targetFinder.js';
import { NameComponent } from '../components/nameComponent.js';
import { getEntityIdsForScopes } from './entityScopeService.js';
// Ensure OpenableComponent is imported for the logging check within this file
import OpenableComponent from '../components/openableComponent.js'; // Adjust path if necessary

// --- JSDoc Type Imports ---
/** @typedef {import('../core/eventBus.js').default} EventBus */ // Not used directly here
/** @typedef {import('../entities/entityManager.js').default} EntityManager */
/** @typedef {import('../entities/entity.js').default} Entity */
/** @typedef {import('../actions/actionTypes.js').ActionContext} ActionContext */
/** @typedef {import('../components/component.js').default} Component */
/** @typedef {typeof Component} ComponentConstructor */

// --- Resolution Status Enum ---
/**
 * @typedef {'FOUND_UNIQUE' | 'NOT_FOUND' | 'AMBIGUOUS' | 'FILTER_EMPTY' | 'INVALID_INPUT'} ResolutionStatusValue
 */
export const ResolutionStatus = Object.freeze({
    FOUND_UNIQUE: 'FOUND_UNIQUE',
    NOT_FOUND: 'NOT_FOUND',
    AMBIGUOUS: 'AMBIGUOUS',
    FILTER_EMPTY: 'FILTER_EMPTY',
    INVALID_INPUT: 'INVALID_INPUT',
});

// --- Result Structures ---
/**
 * @typedef {object} ResolutionResult
 * @property {ResolutionStatus} status - The outcome status of the resolution attempt.
 * @property {Entity | null} entity - The uniquely found entity (only non-null if status is 'FOUND_UNIQUE').
 * @property {Entity[] | null} candidates - The list of ambiguous candidate entities (only non-null if status is 'AMBIGUOUS').
 */
/**
 * @typedef {object} TargetResolverConfig
 * @property {string | string[]} scope - Defines where to search. Valid scopes handled by entityScopeService.
 * @property {ComponentConstructor[]} requiredComponents - An array of Component classes the target must possess.
 * @property {string} actionVerb - The verb used in feedback messages. (Not used internally for logic here).
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
    // --- 1. Validate Core Inputs ---
    if (
        !context ||
        !context.entityManager ||
        !config ||
        !config.scope ||
        !config.requiredComponents || // Ensure this is always an array, even if empty
        typeof config.targetName !== 'string'
    ) {
        console.error(
            'resolveTargetEntity: Invalid context or configuration provided.',
            { context, config }
        );
        return {
            status: ResolutionStatus.INVALID_INPUT,
            entity: null,
            candidates: null,
        };
    }

    const { entityManager } = context;

    // --- 2. Validate Target Name Content ---
    if (config.targetName.trim() === '') {
        console.warn(
            'resolveTargetEntity: Received empty targetName. Resolution cannot proceed.'
        );
        return {
            status: ResolutionStatus.INVALID_INPUT,
            entity: null,
            candidates: null,
        };
    }

    // --- 3. Normalize Scope and Prepare Components ---
    const scopes = Array.isArray(config.scope) ? config.scope : [config.scope];
    // Ensure NameComponent is always implicitly required for findTarget to work by name
    const requiredComponentsSet = new Set([
        NameComponent,
        ...config.requiredComponents,
    ]);
    const requiredComponents = Array.from(requiredComponentsSet);

    // --- 4. Build Searchable Entities List (Using Service) ---
    let entityIdSet; // Declare outside try
    try {
        console.log(`resolveTargetEntity: >>> Calling getEntityIdsForScopes for scope [${scopes.join(', ')}]...`); // <<< LOGGING
        entityIdSet = getEntityIdsForScopes(scopes, context);
        console.log(`resolveTargetEntity: <<< Returned from getEntityIdsForScopes.`); // <<< LOGGING
    } catch (scopeError) {
        console.error(`resolveTargetEntity: *** CRITICAL ERROR calling getEntityIdsForScopes:`, scopeError); // <<< LOGGING
        // If scope service fails critically, return failure
        return { status: ResolutionStatus.INVALID_INPUT, entity: null, candidates: null };
    }

    // Log the result from getEntityIdsForScopes
    const idArray = entityIdSet ? Array.from(entityIdSet) : [];
    console.log(`resolveTargetEntity: IDs returned by getEntityIdsForScopes: [${idArray.join(', ')}]`); // <<< LOGGING


    // --- 5. Map IDs to Instances and Filter Nulls ---
    console.log(`resolveTargetEntity: >>> Mapping IDs to instances...`); // <<< LOGGING
    const initialEntities = idArray
        .map((id) => {
            const instance = entityManager.getEntityInstance(id);
            // Log specifically for chest_closed and player during mapping
            if (id === 'chest_closed') { // <<< LOGGING
                console.log(`resolveTargetEntity: --- Mapping ID 'chest_closed'. Instance found: ${!!instance}`);
                if (!instance) {
                    console.log(`resolveTargetEntity: --- getEntityInstance returned null for 'chest_closed' at this stage!`);
                }
            } else if (id === 'player') { // <<< LOGGING
                console.log(`resolveTargetEntity: --- Mapping ID 'player'. Instance found: ${!!instance}`);
            }
            return instance;
        })
        .filter(Boolean); // Filter out potential null/undefined instances

    // Log the result after mapping and filtering nulls
    const initialEntityIds = initialEntities.map(e => e.id);
    console.log(`resolveTargetEntity: <<< initialEntities after map & filter(Boolean): [${initialEntityIds.join(', ')}]`); // <<< LOGGING


    // --- 6. Handle Empty Initial List (Before Component Filter) ---
    // If no valid instances were found in the scope after mapping, it's a filter empty situation.
    if (initialEntities.length === 0) {
        console.log(`resolveTargetEntity: initialEntities array is empty after scope collection and instance mapping/filtering.`); // <<< LOGGING
        return {
            status: ResolutionStatus.FILTER_EMPTY, // Treat as FILTER_EMPTY if no valid instances found
            entity: null,
            candidates: null,
        };
    }

    // --- 7. Filter Entities by Required Components and Custom Filter ---
    console.log(`resolveTargetEntity: >>> Starting component filter loop...`); // <<< LOGGING
    const filteredEntities = initialEntities.filter((entity) => {
        // Log component checks specifically for chest_closed
        if (entity.id === 'chest_closed') { // <<< LOGGING
            // Check required components for the 'open' action (Name + Openable)
            const hasName = entity.hasComponent(NameComponent);
            const hasOpenable = entity.hasComponent(OpenableComponent); // Use imported class
            console.log(`resolveTargetEntity: --- Checking chest_closed in filter loop. Has NameComponent? ${hasName}. Has OpenableComponent? ${hasOpenable}`);
            // If the required OpenableComponent is missing, log existing components for debugging
            if (!hasOpenable) {
                // Adjust based on how Entity stores components (e.g., entity.components is a Map)
                const componentKeys = entity.components ? Array.from(entity.components.keys()) : 'N/A (entity.components missing or not iterable)';
                console.log(`resolveTargetEntity: --- Components actually found on chest_closed in filter loop:`, componentKeys);
            }
        }

        // Check if the entity has ALL required components
        const hasAllRequired = requiredComponents.every((ComponentClass) => {
            // Safety check: Ensure ComponentClass is actually a function/class constructor
            if (typeof ComponentClass !== 'function') {
                console.warn(`resolveTargetEntity: Invalid item in requiredComponents array (not a class/function) for entity ${entity.id}. Skipping check for this component.`);
                return true; // Or false depending on desired strictness
            }
            return entity.hasComponent(ComponentClass); // Assumes hasComponent works with class constructors
        });

        if (!hasAllRequired) {
            if (entity.id === 'chest_closed') { // <<< LOGGING
                console.log(`resolveTargetEntity: --- chest_closed FAILED hasAllRequired check.`);
            }
            return false; // Filter out if missing required components
        }

        // Apply custom filter if provided
        if (config.customFilter) {
            try {
                // Log custom filter application for the target entity if desired
                if (entity.id === 'chest_closed') { // <<< LOGGING (Optional)
                    console.log(`resolveTargetEntity: --- Applying custom filter to chest_closed...`);
                }
                const customFilterResult = config.customFilter(entity);
                if (entity.id === 'chest_closed') { // <<< LOGGING (Optional)
                    console.log(`resolveTargetEntity: --- Custom filter result for chest_closed: ${customFilterResult}`);
                }
                // Keep entity only if custom filter returns true
                if (!customFilterResult) return false;

            } catch (filterError) {
                console.error(
                    `resolveTargetEntity: Error executing customFilter for entity ${entity.id}:`,
                    filterError
                );
                return false; // Exclude entity if filter throws
            }
        }

        // If we reach here, the entity has all required components and passed the custom filter (if any)
        return true;
    });

    // --- 8. Handle Empty Filtered Scope (After Component Filter) ---
    // If component/custom filtering removed all candidates
    if (filteredEntities.length === 0) {
        console.log(`resolveTargetEntity: filteredEntities array is empty after component/custom filtering.`); // <<< LOGGING
        return {
            status: ResolutionStatus.FILTER_EMPTY,
            entity: null,
            candidates: null,
        };
    }

    // --- 9. Call findTarget Utility ---
    console.log(`resolveTargetEntity: >>> Calling findTarget with targetName "${config.targetName}" on [${filteredEntities.map(e=>e.id).join(', ')}] entities...`); // <<< LOGGING
    const findResult = findTarget(config.targetName, filteredEntities);
    console.log(`resolveTargetEntity: <<< Returned from findTarget. Status: ${findResult.status}`); // <<< LOGGING

    // --- 10. Handle findTarget Results (Not Found, Ambiguous, Found) ---
    switch (findResult.status) {
        case 'NOT_FOUND': {
            return {
                status: ResolutionStatus.NOT_FOUND,
                entity: null,
                candidates: null,
            };
        }
        case 'FOUND_AMBIGUOUS': {
            return {
                status: ResolutionStatus.AMBIGUOUS,
                entity: null,
                candidates: findResult.matches,
            };
        }
        case 'FOUND_UNIQUE': {
            return {
                status: ResolutionStatus.FOUND_UNIQUE,
                entity: findResult.matches[0],
                candidates: null,
            };
        }
        default: {
            // Handle unexpected status from findTarget
            console.error(
                `resolveTargetEntity: Internal error - Unexpected findTarget status: ${
                    findResult.status || 'unknown'
                }`
            );
            // Return a failure status
            return {
                status: ResolutionStatus.NOT_FOUND, // Or INVALID_INPUT? NOT_FOUND seems safer.
                entity: null,
                candidates: null,
            };
        }
    }
} // End resolveTargetEntity

// --- Export the function ---
export { resolveTargetEntity };