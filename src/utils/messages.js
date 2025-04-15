// src/utils/messages.js

import {NameComponent} from "../components/nameComponent.js";
// Assuming Entity type is available for JSDoc
/** @typedef {import('../entities/entity.js').default} Entity */

// Helper to get NameComponent value or fallback (Unchanged)
export const getDisplayName = (entity) => entity?.getComponent(NameComponent)?.value ?? entity?.id ?? 'unknown entity';

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

    /**
     * Default: Target not found in the current location.
     * Scope: 'location', 'location_items', 'location_non_items' (and general fallback)
     * @param {string} targetName - The name of the target being looked for.
     * @returns {string}
     */
    NOT_FOUND_LOCATION: (targetName) => `You don't see any '${targetName}' here.`,

    /**
     * Default: Target not found in the player's inventory.
     * Scope: 'inventory'
     * @param {string} targetName - The name of the item being looked for.
     * @returns {string}
     */
    NOT_FOUND_INVENTORY: (targetName) => `You don't have a '${targetName}'.`,

    /**
     * Default: Target not found among the player's equipped items.
     * Scope: 'equipment'
     * @param {string} targetName - The name of the item being looked for.
     * @returns {string}
     */
    NOT_FOUND_EQUIPMENT: (targetName) => `You don't have '${targetName}' equipped.`, // Added for 'equipment' scope

    /**
     * Default: Target not found nearby (location or inventory).
     * Scope: 'nearby'
     * @param {string} targetName - The name of the target being looked for.
     * @returns {string}
     */
    NOT_FOUND_NEARBY: (targetName) => `You don't find any '${targetName}' nearby.`, // Added for 'nearby' scope

    /**
     * Default: Ambiguous target prompt when multiple entities match.
     * Used by handleActionWithTargetResolution if no override is provided.
     * @param {string} actionVerb - The action being attempted (e.g., 'attack', 'take', 'use X on').
     * @param {string} targetName - The name/type the user specified (e.g., the ambiguous noun like 'goblin').
     * @param {Entity[]} candidates - Array of matching entities.
     * @returns {string}
     */
    AMBIGUOUS_PROMPT: (actionVerb, targetName, candidates) => { // Standardized params: targetTypeName -> targetName, matches -> candidates
        const names = candidates.map(e => getDisplayName(e)).join(', ');
        return `Which '${targetName}' did you want to ${actionVerb}: ${names}?`;
    },

    /**
     * Default: Search scope (inventory/equipment) yielded no suitable entities after filtering.
     * Used by handleActionWithTargetResolution for 'inventory' or 'equipment' scopes.
     * @param {string} actionVerb - The action verb.
     * @returns {string}
     */
    SCOPE_EMPTY_PERSONAL: (actionVerb) => `You have nothing suitable to ${actionVerb}.`, // Standardized JSDoc

    /**
     * Default: Search scope (location/nearby/etc.) yielded no suitable entities after filtering.
     * Used by handleActionWithTargetResolution for scopes other than inventory/equipment.
     * @param {string} actionVerb - The action verb.
     * @param {string} scopeContext - A hint about the scope (e.g., 'location', 'nearby').
     * @returns {string}
     */
    SCOPE_EMPTY_GENERIC: (actionVerb, scopeContext) => `You don't see anything suitable ${scopeContext} to ${actionVerb}.`, // Standardized JSDoc


    // ==================================================
    // == Action-Specific Resolution Failure Overrides ==
    // ==================================================
    // These can be used in handleActionWithTargetResolution's `failureMessages` option
    // or by action handlers directly.

    /**
     * Target not found in the current location specifically for attacking.
     * @param {string} targetName - The name of the target being looked for.
     * @returns {string}
     */
    NOT_FOUND_ATTACKABLE: (targetName) => `There is no one called '${targetName}' here to attack.`, // Param name standardized

    /**
     * Target not found in the current location specifically for taking.
     * @param {string} targetName - The name of the item being looked for.
     * @returns {string}
     */
    NOT_FOUND_TAKEABLE: (targetName) => `You don't see any '${targetName}' here to take.`, // Param name standardized

    /**
     * Target not found in the player's inventory that is suitable for equipping.
     * Used when resolving for the 'equip' action.
     * @param {string} targetName - The name of the item being looked for.
     * @returns {string}
     */
    NOT_FOUND_EQUIPPABLE: (targetName) => `You don't have a '${targetName}' you can equip.`, // Param name standardized

    /**
     * Target not found among the player's equipped items specifically for unequipping.
     * Used when resolving for the 'unequip' action by item name.
     * @param {string} targetName - The name of the item being looked for.
     * @returns {string}
     */
    NOT_FOUND_UNEQUIPPABLE: (targetName) => `You don't have '${targetName}' equipped to unequip.`, // Param name standardized

    /**
     * Target not found nearby (e.g., for 'use item on target'). Used by `useActionHandler`.
     * Consider using `NOT_FOUND_NEARBY` as the default if consistency is desired.
     * @param {string} targetName - The description/name of the target being looked for.
     * @returns {string}
     */
    TARGET_NOT_FOUND_CONTEXT: (targetName) => `Could not find '${targetName}' nearby to target.`, // Param name standardized

    /**
     * Target not found nearby specifically for examining. Used by `examineActionHandler`.
     * Consider using `NOT_FOUND_NEARBY` as the default if consistency is desired.
     * @param {string} targetName - The name of the target being looked for.
     * @returns {string}
     */
    NOT_FOUND_EXAMINABLE: (targetName) => `You don't see anything called '${targetName}' to examine nearby.`, // Param name standardized


    /**
     * Feedback when a scope (like location for 'take') contains no items relevant to the action.
     * Used by TargetResolutionService when `filteredEntities.length === 0`.
     * Can be overridden by `emptyScopeMessage` in resolver config.
     * Example usage: `takeActionHandler` overrides this via resolver config using `failureMessages.filterEmpty`.
     */
    TAKE_EMPTY_LOCATION: "There's nothing here to take.", // Keep as string override example

    // ================================
    // Ambiguity Prompts (Specific)
    // ================================

    /**
     * Ambiguous target prompt specifically for using an item on a target.
     * @param {string} actionVerb - The combined verb phrase (e.g., "use Potion on").
     * @param {string} targetName - The ambiguous name/description of the target.
     * @param {Entity[]} candidates - Array of matching entities.
     * @returns {string}
     */
    TARGET_AMBIGUOUS_CONTEXT: (actionVerb, targetName, candidates) => `Which '${targetName}' did you want to ${actionVerb}? (${candidates.map(m => getDisplayName(m)).join(', ')})`, // Standardized params

    /**
     * Ambiguous direction prompt when input matches multiple connection direction keys.
     * Used specifically by resolveTargetConnection.
     * @param {string} directionInput - The ambiguous direction string entered by the user (e.g., 'west').
     * @param {string[]} connectionNames - An array of display names for the matching connection entities (e.g., ['West Gate', 'Western Arch']).
     * @returns {string}
     */
    AMBIGUOUS_DIRECTION: (directionInput, connectionNames) => {
        const namesList = connectionNames && connectionNames.length > 0 ? connectionNames.join(', ') : 'unspecified options';
        return `There are multiple ways to go '${directionInput}'. Which one did you mean: ${namesList}?`;
    },

    // ================================
    // General Prompts & Errors
    // ================================

    /**
     * Prompt when an action requires a target but none was provided.
     * @param {string} verb - The action verb (e.g., 'Attack', 'Take').
     * @returns {string} Example: "Attack what?"
     */
    PROMPT_WHAT: (verb) => `${verb.charAt(0).toUpperCase() + verb.slice(1)} what?`,

    /** Generic internal error message for unexpected issues. */
    INTERNAL_ERROR: "Internal error occurred.",

    /**
     * Error indicating a required component is missing on the player or relevant entity.
     * @param {string} compName - Name of the missing component (e.g., 'Inventory', 'Position').
     * @returns {string}
     */
    INTERNAL_ERROR_COMPONENT: (compName) => `(Internal Error: Player is missing ${compName} capability.)`,

    /** Internal error for unexpected target resolution status. */
    INTERNAL_ERROR_RESOLUTION: (status) => `Internal error: Unexpected target resolution status (${status}).`,

    // ============================================
    // Action Specific Validation & Feedback (Review JSDoc/Params)
    // ============================================

    // --- Attack ---
    /** Feedback for trying to attack oneself. */
    ATTACK_SELF: "Trying to attack yourself? That's not productive.",
    /** Feedback when trying to attack a target that cannot be attacked (e.g., scenery, non-combatant).
     * @param {string} targetName - The display name of the non-combatant target.
     * @returns {string}
     */
    ATTACK_NON_COMBATANT: (targetName) => `You can't attack the ${targetName}.`, // Standardized param name
    /** Feedback when trying to attack an already defeated target.
     * @param {string} targetName - The display name of the defeated target.
     * @returns {string}
     */
    ATTACK_DEFEATED: (targetName) => `The ${targetName} is already defeated.`, // Standardized param name

    // --- Equip ---
    /** Feedback when an item exists in inventory but lacks the EquippableComponent.
     * @param {string} itemName - The display name of the item.
     * @returns {string}
     */
    EQUIP_CANNOT: (itemName) => `You cannot equip the ${itemName}.`, // Standardized param name
    /** Feedback when the player lacks the required equipment slot for an item.
     * @param {string} itemName - The display name of the item.
     * @param {string} slotId - The required equipment slot ID.
     * @returns {string}
     */
    EQUIP_NO_SLOT: (itemName, slotId) => `You don't have a slot to equip the ${itemName} (${slotId}).`, // Standardized param name
    /** Feedback when the target equipment slot is already occupied.
     * @param {string} currentItemName - The display name of the item currently in the slot.
     * @param {string} slotName - The user-friendly name of the slot (e.g., 'main hand').
     * @returns {string}
     */
    EQUIP_SLOT_FULL: (currentItemName, slotName) => `You need to unequip the ${currentItemName} from your ${slotName} slot first.`,

    // --- Inventory ---
    /** Feedback when the player's inventory is empty (used by 'use' and potentially others). */
    NOTHING_CARRIED: "You aren't carrying anything.",

    // --- Look ---
    /** Feedback when the player's location is unknown. */
    LOOK_LOCATION_UNKNOWN: "You can't see anything; your location is unknown.",
    /** Feedback when the player looks at themselves. */
    LOOK_SELF: "You look yourself over. You seem to be in one piece.",
    /** Default feedback when looking at an entity that has no specific DescriptionComponent text.
     * @param {string} targetName - The display name of the target entity.
     * @returns {string}
     */
    LOOK_DEFAULT_DESCRIPTION: (targetName) => `You look closely at the ${targetName}, but see nothing particularly interesting.`, // Standardized param name

    // --- Move ---
    /** Feedback when the player's location is unknown during a move attempt. */
    MOVE_LOCATION_UNKNOWN: "Cannot move: your current location is unknown.",
    /** Feedback when the player's position component is missing during a move attempt. */
    MOVE_POSITION_UNKNOWN: "Cannot move: Your position is unknown.",
    /** Prompt when the 'move' command is given without a direction. */
    MOVE_NO_DIRECTION: "Move where? (Specify a direction like 'north', 'south', 'east', or 'west')",
    /** Feedback when the current location has no defined exits. */
    MOVE_NO_EXITS: "There are no obvious exits from here.",
    /** Feedback when trying to move in a direction that is locked. Can be overridden by connection data.
     * @param {string} direction - The direction attempted.
     * @returns {string}
     */
    MOVE_LOCKED: (direction) => `The way ${direction} is locked.`,
    /** Feedback when connection data for a direction is invalid (e.g., missing target).
     * @param {string} direction - The direction attempted.
     * @returns {string}
     */
    MOVE_INVALID_CONNECTION: (direction) => `The way ${direction} seems improperly constructed.`,
    /** Feedback when the target location definition for a connection is missing or invalid.
     * @param {string} direction - The direction attempted.
     * @returns {string}
     */
    MOVE_BAD_TARGET_DEF: (direction) => `Something is wrong with the passage leading ${direction}.`,
    /** Generic feedback when there's no valid connection in the specified direction. */
    MOVE_CANNOT_GO_WAY: "You can't go that way.",

    // --- Movement Blocking ---
    /** Feedback when movement is blocked because the blocking entity is locked.
     * @param {string} blockerName - The display name of the blocking entity.
     * @returns {string}
     */
    MOVE_BLOCKED_LOCKED: (blockerName) => `The ${blockerName} is locked.`,
    /** Generic feedback when movement is blocked by an entity (e.g., closed door).
     * @param {string} blockerName - The display name of the blocking entity.
     * @returns {string}
     */
    MOVE_BLOCKED_GENERIC: (blockerName) => `The ${blockerName} blocks the way.`,
    /** Feedback when movement is blocked because the referenced blocker entity could not be found. */
    MOVE_BLOCKER_NOT_FOUND: () => "The way seems blocked by something that isn't there anymore.",

    /**
     * Feedback when an entity is successfully opened.
     * @param {string} targetName - The display name of the opened entity.
     * @returns {string}
     */
    OPEN_SUCCESS: (targetName) => `You open the ${targetName}.`,

    /**
     * Default feedback when opening an entity fails for an unspecified or default reason.
     * @param {string} targetName - The display name of the entity that failed to open.
     * @returns {string}
     */
    OPEN_FAILED_DEFAULT: (targetName) => `You cannot open the ${targetName}.`,

    /**
     * Feedback when attempting to open an entity that is already open.
     * @param {string} targetName - The display name of the already open entity.
     * @returns {string}
     */
    OPEN_FAILED_ALREADY_OPEN: (targetName) => `The ${targetName} is already open.`,

    /**
     * Feedback when attempting to open an entity that is locked.
     * @param {string} targetName - The display name of the locked entity.
     * @returns {string}
     */
    OPEN_FAILED_LOCKED: (targetName) => `The ${targetName} is locked.`,

    /**
     * Feedback when attempting to open an entity that lacks the OpenableComponent or capability.
     * @param {string} targetName - The display name of the entity that cannot be opened.
     * @returns {string}
     */
    OPEN_FAILED_NOT_OPENABLE: (targetName) => `The ${targetName} cannot be opened.`,

    // --- Unequip ---
    /** Feedback when trying to unequip from an explicitly named slot that is empty.
     * @param {string} slotName - The user-friendly name of the slot.
     * @returns {string}
     */
    UNEQUIP_SLOT_EMPTY: (slotName) => `You have nothing equipped in your ${slotName} slot.`,

    // --- Use ---
    /** Feedback when an item's usage conditions are not met.
     * @param {string} itemName - The display name of the item.
     * @returns {string}
     */
    USE_CONDITION_FAILED: (itemName) => `You cannot use the ${itemName} under the current conditions.`,
    /** Generic feedback when an item cannot be used in the attempted manner.
     * @param {string} itemName - The display name of the item.
     * @returns {string}
     */
    USE_CANNOT: (itemName) => `You can't use the ${itemName} that way.`, // Standardized param name
    /** Feedback when trying to use a healing item at full health. */
    USE_FULL_HEALTH: "You are already at full health.",
    /** Feedback when an item requires an explicit target but none was provided or resolved.
     * @param {string} itemName - The display name of the item.
     * @returns {string}
     */
    USE_REQUIRES_TARGET: (itemName) => `What do you want to use the ${itemName} on?`,
    /** Feedback when the specific target is invalid for the item being used.
     * @param {string} itemName - The display name of the item.
     * @returns {string}
     */
    USE_INVALID_TARGET: (itemName) => `You can't use the ${itemName} on that.`,
    // Deprecated/Redundant based on other messages? Review usage.
    USE_INVALID_TARGET_CONNECTION: (id) => `The connection (${id}) you targeted is not valid here.`,
    USE_INVALID_TARGET_ENTITY: (id) => `The target (${id}) you specified is no longer valid.`,

    // ================================
    // Generic Action Validation
    // ================================
    /**
     * Generic message for when an action cannot be performed on a specific target for a given reason.
     * @param {string} actionVerb - The verb of the action being attempted (e.g., 'attack', 'unlock').
     * @param {string} targetName - The display name of the target entity.
     * @param {string} reason - The reason why the action cannot be performed.
     * @returns {string} Example: "You cannot attack the sturdy door (it is indestructible)."
     */
    CANNOT_PERFORM_ACTION_ON: (actionVerb, targetName, reason) => `You cannot ${actionVerb} the ${targetName} (${reason}).`,

    /**
     * Generic message for when a resolved target is fundamentally invalid for the attempted action.
     * @param {string} targetName - The display name of the target entity.
     * @param {string} actionVerb - The verb of the action being attempted.
     * @returns {string} Example: "The training dummy is not a valid target for equipping."
     */
    TARGET_INVALID_FOR_ACTION: (targetName, actionVerb) => `The ${targetName} is not a valid target for ${actionVerb}.`,

};