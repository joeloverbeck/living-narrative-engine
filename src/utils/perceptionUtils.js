// src/utils/perceptionUtils.js

/**
 * @fileoverview Utility functions for perception-related tasks,
 * primarily focused on gathering and formatting data for presentation
 * based on entity state and location (e.g., for 'look' or 'examine').
 */

// --- Core Component Imports for Type Info & Logic ---
// Import necessary components used directly or indirectly by the helpers.
import OpenableComponent from '../components/openableComponent.js';
// Note: LockableComponent isn't directly used *in* formatExitString,
// but the effectivePassageState calculation relies on it upstream.

// --- Utilities and Services ---
import {getDisplayName} from './messages.js'; // Adjusted path

// --- Type Imports ---
// Adjusted paths assuming this file is in src/utils/
/** @typedef {import('../entities/entityManager.js').EntityManager} EntityManager */
/** @typedef {import('../entities/entity.js').default} Entity */
/** @typedef {import('../components/passageDetailsComponent.js').PassageDetailsComponent} PassageDetailsComponentType */
/** @typedef {import('../components/itemComponent.js').ItemComponent} ItemComponent */ // Needed for filterPredicate example in JSDoc

// --- Helper Function: getVisibleEntityDisplayNames ---
/**
 * Gets display names of entities in a location matching a predicate.
 * @param {EntityManager} entityManager - The entity manager instance.
 * @param {string} locationId - The ID of the location to check.
 * @param {string | null} excludeEntityId - The ID of an entity to exclude (e.g., the viewer).
 * @param {(entity: Entity) => boolean} filterPredicate - A function to filter entities (e.g., `entity => entity.hasComponent(ItemComponent)`).
 * @returns {string[]} - An array of display names for matching entities.
 */
export const getVisibleEntityDisplayNames = (entityManager, locationId, excludeEntityId, filterPredicate) => {
    const entityIdsInLocation = entityManager.getEntitiesInLocation(locationId);
    return Array.from(entityIdsInLocation)
        .map(id => entityManager.getEntityInstance(id))
        .filter(Boolean) // Filter out any null results from getEntityInstance
        .filter(entity => entity.id !== excludeEntityId)
        .filter(filterPredicate)
        .map(entity => getDisplayName(entity));
};

// --- Helper Function: formatExitString ---
/**
 * Generates the user-facing description string for an exit or passage.
 * Takes into account the passage type, blocker entity, and the effective state.
 * @param {string} direction - The direction of the exit (e.g., "North", "East").
 * @param {PassageDetailsComponentType} passageDetails - The passage details component of the connection entity.
 * @param {Entity | null} blockerEntity - The entity blocking the passage, if any.
 * @param {'open' | 'closed' | 'locked' | 'impassable'} effectivePassageState - The calculated state of the passage.
 * @returns {string} - The formatted string description (e.g., "North: An open doorway").
 */
export function formatExitString(direction, passageDetails, blockerEntity, effectivePassageState) {
    const passageType = passageDetails.getType() || 'passage';
    let description = '';

    switch (effectivePassageState) {
        case 'open':
            // If there's an explicit blocker that is openable and currently open, describe it.
            if (blockerEntity && blockerEntity.hasComponent(OpenableComponent) && blockerEntity.getComponent(OpenableComponent).isOpen) {
                const blockerName = getDisplayName(blockerEntity) || 'blocker';
                description = `an open ${blockerName}`;
            } else {
                // Otherwise, describe the passage type generically as open.
                switch (passageType.toLowerCase()) {
                    case 'doorway':
                        description = 'an open doorway';
                        break;
                    case 'path':
                        description = 'a path';
                        break;
                    case 'gate':
                        description = 'an open gate';
                        break;
                    case 'archway':
                        description = 'an open archway';
                        break;
                    case 'passage': // Default case
                    default:
                        description = 'a passage';
                        break;
                }
            }
            break;
        case 'closed':
            if (blockerEntity) {
                const blockerName = getDisplayName(blockerEntity) || 'blocker';
                description = `a closed ${blockerName}`;
            } else {
                // Fallback if state is 'closed' but no blocker entity provided (warn and use generic)
                description = `a closed ${passageType}`;
                console.warn(`[formatExitString] Blocker entity missing for 'closed' state on passage type '${passageType}' direction '${direction}'.`);
            }
            break;
        case 'locked':
            if (blockerEntity) {
                const blockerName = getDisplayName(blockerEntity) || 'blocker';
                description = `a locked ${blockerName}`;
            } else {
                // Fallback if state is 'locked' but no blocker entity provided (warn and use generic)
                description = `a locked ${passageType}`;
                console.warn(`[formatExitString] Blocker entity missing for 'locked' state on passage type '${passageType}' direction '${direction}'.`);
            }
            break;
        case 'impassable':
            if (blockerEntity) {
                const blockerName = getDisplayName(blockerEntity) || 'blocker';
                // Capitalize for sentence structure "BlockerName blocks the passage"
                const capitalizedBlockerName = blockerName.charAt(0).toUpperCase() + blockerName.slice(1);
                description = `${capitalizedBlockerName} blocks the ${passageType}`;
            } else {
                // Fallback if state is 'impassable' but no blocker entity provided (warn and use generic)
                description = `an impassable ${passageType}`;
                console.warn(`[formatExitString] Blocker entity missing for 'impassable' state on passage type '${passageType}' direction '${direction}'.`);
            }
            break;
        default:
            // Fallback for unexpected state
            description = `an unknown ${passageType}`;
            console.warn(`[formatExitString] Unexpected effectivePassageState: ${effectivePassageState} for direction '${direction}'.`);
    }

    // Capitalize the description part unless it's the specific "Blocker blocks..." format
    if (effectivePassageState !== 'impassable' || !blockerEntity) {
        if (typeof description === 'string' && description.length > 0) {
            description = description.charAt(0).toUpperCase() + description.slice(1);
        }
    }

    // Combine direction and description
    return `${direction}: ${description}`;
}