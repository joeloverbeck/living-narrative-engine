// src/utils/targetFinder.js

// Ensure this import path is correct and NAME_COMPONENT_TYPE_ID is defined
// (likely as 'core:name' based on your mocks)
import {NAME_COMPONENT_TYPE_ID} from '../types/components.js';

/**
 * @typedef {import('../../src/entities/entity.js').default} Entity
 */
/**
 * @typedef {'NOT_FOUND' | 'FOUND_UNIQUE' | 'FOUND_AMBIGUOUS'} TargetResolutionStatus
 */

/**
 * @typedef {object} TargetResolutionResult
 * @property {TargetResolutionStatus} status
 * @property {Array<Entity>} matches
 */

/**
 * Finds potential target entities based on a partial name string within a given scope,
 * respecting the ECS pattern by checking the NameComponent.
 * Handles case-insensitive, partial matching.
 *
 * @param {string | null | undefined} targetString
 * @param {Array<Entity> | null | undefined} searchScope
 * @param {object} [options]
 * @returns {TargetResolutionResult}
 */
export function findTarget(targetString, searchScope, options = {}) {
  // 1. Validate Inputs
  if (
    !targetString ||
        targetString.trim() === '' ||
        !Array.isArray(searchScope) || // Added check for empty array as well
        searchScope.length === 0
  ) {
    return {status: 'NOT_FOUND', matches: []};
  }

  const lowerCaseTargetString = targetString.trim().toLowerCase();

  // 2. Filter Scope for Matches
  const foundMatches = searchScope.filter((entity) => {
    // Basic validation: Ensure 'entity' is an object and has the required method.
    // **** CORRECTED CHECK ****
    if (!entity || typeof entity.getComponentData !== 'function') {
      // If it's not an entity-like object with getComponentData, it can't match.
      // You might also want to check for `hasComponent` if your logic relies on it elsewhere:
      // if (!entity || typeof entity.getComponentData !== 'function' || typeof entity.hasComponent !== 'function') {
      return false;
    }

    // Attempt to retrieve the NameComponent data using the correct method and Type ID.
    // Make sure NAME_COMPONENT_TYPE_ID is correctly imported and has the value 'core:name'.
    const nameComponentData = entity.getComponentData(NAME_COMPONENT_TYPE_ID);

    // Check if the component data exists, if its value property is a string, and if it matches.
    return nameComponentData && // Ensure the component data was found
            typeof nameComponentData.value === 'string' && // Ensure the name value is a string
            nameComponentData.value.toLowerCase().includes(lowerCaseTargetString); // Perform case-insensitive partial match
  });

  // 3. Determine and Return Result Status
  if (foundMatches.length === 0) {
    return {status: 'NOT_FOUND', matches: []};
  } else if (foundMatches.length === 1) {
    // noinspection JSValidateTypes
    return {status: 'FOUND_UNIQUE', matches: foundMatches};
  } else {
    // noinspection JSValidateTypes
    return {status: 'FOUND_AMBIGUOUS', matches: foundMatches};
  }
}