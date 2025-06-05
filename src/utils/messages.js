// src/utils/messages.js

// --- TICKET 4.4 REFACTOR: Import correct component IDs ---
import { NAME_COMPONENT_ID } from '../constants/componentIds.js'; // Adjust path if needed
// --- END TICKET 4.4 REFACTOR ---

/** @typedef {import('../entities/entity.js').default} Entity */
/** @typedef {import('../entities/entityManager.js').default} EntityManager */ // Added for potential future use, though not strictly needed for these helpers

// --- TICKET 4.4 REFACTOR: Updated getDisplayName helper ---
/**
 * Gets the display name for an entity.
 * Retrieves data from the 'core:name' component via entity.getComponentData.
 * Falls back to entity ID or a default string if the component or name value is missing.
 *
 * @param {Entity | null | undefined} entity - The entity instance.
 * @param {string} [fallback] - The string to return if no name or ID is found.
 * @returns {string} The entity's display name or a fallback string.
 */
export const getDisplayName = (entity, fallback = 'unknown entity') => {
  if (!entity || typeof entity.getComponentData !== 'function') {
    // Handle cases where entity is null, undefined, or not a valid Entity object
    return entity?.id || fallback;
  }
  // AC: Data is accessed using entity.getComponentData(entityId, "core:name") (via entity instance)
  const nameComponentData = entity.getComponentData(NAME_COMPONENT_ID);
  // AC: Default values or fallback logic are handled appropriately if components are missing.
  // Support both { text: "Entity Name" } and legacy { value: "Entity Name" } structures.
  if (nameComponentData) {
    if (
      typeof nameComponentData.text === 'string' &&
      nameComponentData.text.trim() !== ''
    ) {
      return nameComponentData.text;
    }
    if (
      typeof nameComponentData.value === 'string' &&
      nameComponentData.value.trim() !== ''
    ) {
      return nameComponentData.value;
    }
  }
  return entity.id ?? fallback;
};
// --- END TICKET 4.4 REFACTOR ---

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
   * Target not found in the current location specifically for taking.
   *
   * @param {string} targetName - The name of the item being looked for.
   * @returns {string}
   */
  NOT_FOUND_TAKEABLE: (targetName) =>
    `You don't see any '${targetName}' here to take.`, // Param name standardized

  /**
   * Target not found nearby (e.g., for 'use item on target'). Used by `useActionHandler`.
   * Consider using `NOT_FOUND_NEARBY` as the default if consistency is desired.
   *
   * @param {string} targetName - The description/name of the target being looked for.
   * @returns {string}
   */
  TARGET_NOT_FOUND_CONTEXT: (targetName) =>
    `Could not find '${targetName}' nearby to target.`, // Param name standardized

  /**
   * Feedback when a scope (like location for 'take') contains no items relevant to the action.
   * Used by TargetResolutionService when `filteredEntities.length === 0`.
   * Can be overridden by `emptyScopeMessage` in resolver dependencyInjection.
   * Example usage: `takeActionHandler` overrides this via resolver dependencyInjection using `failureMessages.filterEmpty`.
   */
  TAKE_EMPTY_LOCATION: "There's nothing here to take.", // Keep as string override example

  // ================================
  // Ambiguity Prompts (Specific)
  // ================================

  /**
   * Ambiguous target prompt specifically for using an item on a target.
   *
   * @param {string} actionVerb - The combined verb phrase (e.g., "use Potion on").
   * @param {string} targetName - The ambiguous name/description of the target.
   * @param {Entity[]} candidates - Array of matching entities.
   * @returns {string}
   */
  TARGET_AMBIGUOUS_CONTEXT: (actionVerb, targetName, candidates) => {
    // TICKET 4.4: Uses refactored getDisplayName
    const names = candidates.map((m) => getDisplayName(m)).join(', ');
    return `Which '${targetName}' did you want to ${actionVerb}? (${names})`;
  },

  /**
   * Ambiguous direction prompt when input matches multiple connection direction keys.
   * Used specifically by resolveTargetConnection.
   *
   * @param {string} directionInput - The ambiguous direction string entered by the user (e.g., 'west').
   * @param {string[]} connectionNames - An array of display names for the matching connection entities (e.g., ['West Gate', 'Western Arch']).
   * @returns {string}
   */
  AMBIGUOUS_DIRECTION: (directionInput, connectionNames) => {
    const namesList =
      connectionNames && connectionNames.length > 0
        ? connectionNames.join(', ')
        : 'unspecified options';
    return `There are multiple ways to go '${directionInput}'. Which one did you mean: ${namesList}?`;
  },

  // ================================
  // General Prompts & Errors
  // ================================

  /**
   * Prompt when an action requires a target but none was provided.
   *
   * @param {string} verb - The action verb (e.g., 'Attack', 'Take').
   * @returns {string} Example: "Attack what?"
   */
  PROMPT_WHAT: (verb) =>
    `${verb.charAt(0).toUpperCase() + verb.slice(1)} what?`,

  /** Generic internal error message for unexpected issues. */
  INTERNAL_ERROR: 'Internal error occurred.',

  /**
   * Error indicating a required component is missing on the player or relevant entity.
   *
   * @param {string} compName - Name of the missing component (e.g., 'Inventory', 'Position').
   * @returns {string}
   */
  INTERNAL_ERROR_COMPONENT: (compName) =>
    `(Internal Error: Player is missing ${compName} capability.)`,

  // ============================================
  // Action Specific Validation & Feedback (Review JSDoc/Params)
  // ============================================

  // --- Attack ---
  /** Feedback for trying to attack oneself. */
  ATTACK_SELF: "Trying to attack yourself? That's not productive.",

  // --- Inventory ---
  /** Feedback when the player's inventory is empty (used by 'use' and potentially others). */
  NOTHING_CARRIED: "You aren't carrying anything.",

  // --- Look ---
  /** Feedback when the player's location is unknown. */
  LOOK_LOCATION_UNKNOWN: "You can't see anything; your location is unknown.",
  /** Feedback when the player looks at themselves. */
  LOOK_SELF: 'You look yourself over. You seem to be in one piece.',
  /**
   * Default feedback when looking at an entity that has no specific DescriptionComponent text.
   *
   * @param {string} targetName - The display name of the target entity. (Uses getDisplayName upstream)
   * @returns {string}
   */
  // TICKET 4.4: This message is a fallback if the *description* component is missing.
  // The LOOK_DEFAULT_DESCRIPTION *itself* shouldn't call getDisplayDescription.
  // Instead, the 'examine' or 'look' action handler should call getDisplayDescription(targetEntity)
  // and use the result. If getDisplayDescription returns its *own* fallback, that's what's shown.
  // This message is now more like a fallback for the *entire look action result*.
  // Renaming might be clearer, but keeping name for now.
  LOOK_DEFAULT_DESCRIPTION: (targetName) =>
    `You look closely at the ${targetName}, but see nothing particularly interesting.`,

  // --- Move ---
  /** Feedback when the player's location is unknown during a move attempt. */
  MOVE_LOCATION_UNKNOWN: 'Cannot move: your current location is unknown.',
  /** Feedback when the player's position component is missing during a move attempt. */
  MOVE_POSITION_UNKNOWN: 'Cannot move: Your position is unknown.',
  /** Prompt when the 'move' command is given without a direction. */
  MOVE_NO_DIRECTION:
    "Move where? (Specify a direction like 'north', 'south', 'east', or 'west')",
  /** Feedback when the current location has no defined exits. */
  MOVE_NO_EXITS: 'There are no obvious exits from here.',
  /**
   * Feedback when trying to move in a direction that is locked. Can be overridden by connection data.
   *
   * @param {string} direction - The direction attempted.
   * @returns {string}
   */
  MOVE_LOCKED: (direction) => `The way ${direction} is locked.`,
  /**
   * Feedback when connection data for a direction is invalid (e.g., missing target).
   *
   * @param {string} direction - The direction attempted.
   * @returns {string}
   */
  MOVE_INVALID_CONNECTION: (direction) =>
    `The way ${direction} seems improperly constructed.`,
  /**
   * Feedback when the target location definition for a connection is missing or invalid.
   *
   * @param {string} direction - The direction attempted.
   * @returns {string}
   */
  MOVE_BAD_TARGET_DEF: (direction) =>
    `Something is wrong with the passage leading ${direction}.`,
  /** Generic feedback when there's no valid connection in the specified direction. */
  MOVE_CANNOT_GO_WAY: "You can't go that way.",

  // --- Movement Blocking ---
  /**
   * Feedback when movement is blocked because the blocking entity is locked.
   *
   * @param {string} blockerName - The display name of the blocking entity. (Uses getDisplayName upstream)
   * @returns {string}
   */
  MOVE_BLOCKED_LOCKED: (blockerName) => `The ${blockerName} is locked.`, // TICKET 4.4: Relies on caller passing result of getDisplayName
  /**
   * Generic feedback when movement is blocked by an entity (e.g., closed door).
   *
   * @param {string} blockerName - The display name of the blocking entity. (Uses getDisplayName upstream)
   * @returns {string}
   */
  MOVE_BLOCKED_GENERIC: (blockerName) => `The ${blockerName} blocks the way.`, // TICKET 4.4: Relies on caller passing result of getDisplayName
  /** Feedback when movement is blocked because the referenced blocker entity could not be found. */
  MOVE_BLOCKER_NOT_FOUND: () =>
    "The way seems blocked by something that isn't there anymore.",

  /**
   * Feedback when an entity is successfully opened.
   *
   * @param {string} targetName - The display name of the opened entity. (Uses getDisplayName upstream)
   * @returns {string}
   */
  OPEN_SUCCESS: (targetName) => `You open the ${targetName}.`, // TICKET 4.4: Relies on caller passing result of getDisplayName

  /**
   * Default feedback when opening an entity fails for an unspecified or default reason.
   *
   * @param {string} targetName - The display name of the entity that failed to open. (Uses getDisplayName upstream)
   * @returns {string}
   */
  OPEN_FAILED_DEFAULT: (targetName) => `You cannot open the ${targetName}.`, // TICKET 4.4: Relies on caller passing result of getDisplayName

  /**
   * Feedback when attempting to open an entity that is already open.
   *
   * @param {string} targetName - The display name of the already open entity. (Uses getDisplayName upstream)
   * @returns {string}
   */
  OPEN_FAILED_ALREADY_OPEN: (targetName) =>
    `The ${targetName} is already open.`, // TICKET 4.4: Relies on caller passing result of getDisplayName

  /**
   * Feedback when attempting to open an entity that is locked.
   *
   * @param {string} targetName - The display name of the locked entity. (Uses getDisplayName upstream)
   * @returns {string}
   */
  OPEN_FAILED_LOCKED: (targetName) => `The ${targetName} is locked.`, // TICKET 4.4: Relies on caller passing result of getDisplayName

  /**
   * Feedback when attempting to open an entity that lacks the OpenableComponent or capability.
   *
   * @param {string} targetName - The display name of the entity that cannot be opened. (Uses getDisplayName upstream)
   * @returns {string}
   */
  OPEN_FAILED_NOT_OPENABLE: (targetName) =>
    `The ${targetName} cannot be opened.`, // TICKET 4.4: Relies on caller passing result of getDisplayName

  // --- Use ---
  /** Feedback when trying to use a healing item at full health. */
  USE_FULL_HEALTH: 'You are already at full health.',
  /**
   * Feedback when an item requires an explicit target but none was provided or resolved.
   *
   * @param {string} itemName - The display name of the item. (Uses getDisplayName upstream)
   * @returns {string}
   */
  USE_REQUIRES_TARGET: (itemName) =>
    `What do you want to use the ${itemName} on?`, // TICKET 4.4: Relies on caller passing result of getDisplayName
};
