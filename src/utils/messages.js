// src/utils/messages.js

import {getEntityDisplayName} from './entityUtils.js';

/** @typedef {import('../entities/entity.js').default} Entity */
/** @typedef {import('../entities/entityManager.js').default} EntityManager */ // Added for potential future use, though not strictly needed for these helpers

/**
 * Generates "You need to specify which {itemType}..." messages.
 *
 * @param {string} itemType - Type of item (e.g., "item", "equipped item").
 * @param {string} [domainDetails] - Optional details like "from your inventory".
 * @returns {string} Formatted error message.
 */
export function formatSpecifyItemMessage(itemType, domainDetails = '') {
    let message = `You need to specify which ${itemType}`;
    if (domainDetails && domainDetails.trim() !== '') {
        message += ` ${domainDetails.trim()}`;
    }
    message += '.';
    return message;
}

/**
 * Generates "You don't have/see '{nounPhrase}'..." messages.
 *
 * @param {string} nounPhrase - The specific item name.
 * @param {string} context - How/where it's missing (e.g., "in your inventory", "equipped", "here").
 * @param {object} [options] - Optional parameters.
 * @param {string} [options.verb] - The verb to use (e.g., "have", "see").
 * @param {boolean} [options.useAny] - Whether to prefix the nounPhrase with "any ".
 * @returns {string} Formatted error message.
 */
export function formatNounPhraseNotFoundMessage(
    nounPhrase,
    context,
    {verb = 'have', useAny = false} = {}
) {
    const anyPrefix = useAny ? 'any ' : '';
    let currentVerb = verb;
    if (context?.toLowerCase() === 'here') {
        currentVerb = 'see';
    }
    const safeContext = typeof context === 'string' ? context : '';
    return `You don't ${currentVerb} ${anyPrefix}"${nounPhrase}" ${safeContext}.`;
}

/**
 * Generates "You don't have anything like that..." messages.
 *
 * @param {string} context - Where this applies (e.g., "in your inventory", "equipped").
 * @returns {string} Formatted error message.
 */
export function formatNothingOfKindMessage(context) {
    const safeContext = typeof context === 'string' ? context : '';
    return `You don't have anything like that ${safeContext}.`;
}

// getDisplayName helper removed in favor of canonical getEntityDisplayName

/**
 * A collection of message templates for user feedback, particularly related to
 * target resolution and action validation. Functions accept parameters to
 * provide context-specific messages.
 *
 * Message keys intended for default lookup by `handleActionWithTargetResolution`
 * follow the patterns:
 * - NOT_FOUND_<SCOPE_NAME_UPPERCASE> (e.g., NOT_FOUND_LOCATION, NOT_FOUND_INVENTORY)
 * - SCOPE_EMPTY_PERSONAL / SCOPE_EMPTY_GENERIC
 * - AMBIGUOUS_PROMPT (used as the default for ambiguity)
 */
export const TARGET_MESSAGES = {
    // ==================================================
    // == Target Finding & Resolution Default Messages ==
    // ==================================================
    // These are used as defaults by handleActionWithTargetResolution based on scope.

    // ==================================================
    // == Action-Specific Resolution Failure Overrides ==
    // ==================================================
    // These can be used in handleActionWithTargetResolution's `failureMessages` option
    // or by action operationHandlers directly.

    /**
     * Target not found nearby (e.g., for 'use item on target'). Used by `useActionHandler`.
     * Consider using `NOT_FOUND_NEARBY` as the default if consistency is desired.
     *
     * @param {string} targetName - The description/name of the target being looked for.
     * @returns {string} Message text describing the result.
     */
    TARGET_NOT_FOUND_CONTEXT: (targetName) =>
        `Could not find '${targetName}' nearby to target.`, // Param name standardized

    // ================================
    // Ambiguity Prompts (Specific)
    // ================================

    /**
     * Ambiguous target prompt specifically for using an item on a target.
     *
     * @param {string} actionVerb - The combined verb phrase (e.g., "use Potion on").
     * @param {string} targetName - The ambiguous name/description of the target.
     * @param {Entity[]} candidates - Array of matching entities.
     * @returns {string} Message text listing the ambiguous options.
     */
    TARGET_AMBIGUOUS_CONTEXT: (actionVerb, targetName, candidates) => {
        const names = candidates
            .map((m) =>
                getEntityDisplayName(
                    m,
                    m && typeof m.id === 'string' ? m.id : 'an item'
                )
            )
            .join(', ');
        return `Which '${targetName}' did you want to ${actionVerb}? (${names})`;
    },

    /**
     * Ambiguous direction prompt when input matches multiple connection direction keys.
     * Used specifically by resolveTargetConnection.
     *
     * @param {string} directionInput - The ambiguous direction string entered by the user (e.g., 'west').
     * @param {string[]} connectionNames - An array of display names for the matching connection entities (e.g., ['West Gate', 'Western Arch']).
     * @returns {string} Message text listing direction options.
     */
    AMBIGUOUS_DIRECTION: (directionInput, connectionNames) => {
        const namesList =
            connectionNames && connectionNames.length > 0
                ? connectionNames.join(', ')
                : 'unspecified options';
        return `There are multiple ways to go '${directionInput}'. Which one did you mean: ${namesList}?`;
    }
};
