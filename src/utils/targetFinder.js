// src/utils/targetFinder.js

// Import NameComponent - required for the modified logic
import { NameComponent } from '../components/nameComponent.js';

/**
 * @typedef {import('../../src/entities/entity.js').default} Entity - Represents a game entity (assuming Entity class has getComponent method).
 */
// Note: Entity needs to be defined or imported properly elsewhere for JSDoc/TS checks to fully work.
// The important aspect for this function is that objects in searchScope are expected
// to have a 'getComponent' method.

/**
 * @typedef {'NOT_FOUND' | 'FOUND_UNIQUE' | 'FOUND_AMBIGUOUS'} TargetResolutionStatus
 */

/**
 * @typedef {object} TargetResolutionResult
 * @property {TargetResolutionStatus} status - The outcome of the target search.
 * @property {Array<Entity>} matches - An array of entities that matched the target string.
 * Empty if status is 'NOT_FOUND'.
 * Contains one entity if status is 'FOUND_UNIQUE'.
 * Contains multiple entities if status is 'FOUND_AMBIGUOUS'.
 */

/**
 * Finds potential target entities based on a partial name string within a given scope,
 * respecting the ECS pattern by checking the NameComponent.
 * Handles case-insensitive, partial matching.
 *
 * @param {string | null | undefined} targetString - The partial name (or full name) provided by the user.
 * Should be trimmed before passing if necessary.
 * @param {Array<Entity> | null | undefined} searchScope - An array of potential target entities (Entity instances).
 * These entities are expected to use NameComponent for their names.
 * @param {object} [options] - Optional configuration object for future extensions (e.g., { requireExactMatch: false }).
 * @returns {TargetResolutionResult} - An object describing the outcome of the search.
 */
export function findTarget(targetString, searchScope, options = {}) {
    // 1. Validate Inputs (Remains the same)
    if (
        !targetString ||
        targetString.trim() === '' ||
        !Array.isArray(searchScope)
    ) {
        // Return NOT_FOUND for invalid input to prevent errors downstream
        return { status: 'NOT_FOUND', matches: [] };
    }

    const lowerCaseTargetString = targetString.trim().toLowerCase(); // Trim and lowercase the input

    // 2. Filter Scope for Matches
    const foundMatches = searchScope.filter((entity) => {
        // Basic validation: Ensure 'entity' is an object that could have components.
        // Checking for 'getComponent' method provides a reasonable check for Entity-like objects.
        if (!entity || typeof entity.getComponent !== 'function') {
            // If it's not an entity-like object, it can't match based on NameComponent.
            return false;
        }

        // Attempt to retrieve the NameComponent.
        const nameComponent = entity.getComponent(NameComponent); // Uses getComponent with NameComponent

        // Check if the component exists, if its value is a string, and if it matches.
        return nameComponent && // Ensure the component was found
            typeof nameComponent.value === 'string' && // Ensure the name value is a string
            nameComponent.value.toLowerCase().includes(lowerCaseTargetString); // Perform case-insensitive partial match
    });

    // 3. Determine and Return Result Status (Remains the same)
    if (foundMatches.length === 0) {
        return { status: 'NOT_FOUND', matches: [] };
    } else if (foundMatches.length === 1) {
        // Assuming Entity type is correct if it passed the filter
        // noinspection JSValidateTypes
        return { status: 'FOUND_UNIQUE', matches: foundMatches };
    } else {
        // Assuming Entity type is correct if it passed the filter
        // noinspection JSValidateTypes
        return { status: 'FOUND_AMBIGUOUS', matches: foundMatches };
    }
}