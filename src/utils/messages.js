// src/utils/messages.js

import {NameComponent} from "../components/nameComponent.js";

// Helper to get NameComponent value or fallback
export const getDisplayName = (entity) => entity?.getComponent(NameComponent)?.value ?? entity?.id ?? 'unknown entity';

/**
 * A collection of message templates for user feedback, particularly related to
 * target resolution and action validation. Functions accept parameters to
 * provide context-specific messages.
 */
export const TARGET_MESSAGES = {
    // ================================
    // Target Finding & Resolution
    // ================================

    /**
     * Target not found in the current location (general).
     * @param {string} name - The name of the target being looked for.
     * @returns {string}
     */
    NOT_FOUND_LOCATION: (name) => `You don't see any '${name}' here.`,

    /**
     * Target not found in the current location specifically for attacking.
     * @param {string} name - The name of the target being looked for.
     * @returns {string}
     */
    NOT_FOUND_ATTACKABLE: (name) => `There is no one called '${name}' here to attack.`,

    /**
     * Target not found in the current location specifically for taking.
     * @param {string} name - The name of the item being looked for.
     * @returns {string}
     */
    NOT_FOUND_TAKEABLE: (name) => `You don't see any '${name}' here to take.`,

    /**
     * Target not found in the player's inventory.
     * @param {string} name - The name of the item being looked for.
     * @returns {string}
     */
    NOT_FOUND_INVENTORY: (name) => `You don't have a '${name}'.`,

    /**
     * Target not found in the player's inventory that is suitable for equipping.
     * Used when resolving for the 'equip' action.
     * @param {string} name - The name of the item being looked for.
     * @returns {string}
     */
    NOT_FOUND_EQUIPPABLE: (name) => `You don't have a '${name}' you can equip.`,

    /**
     * Target not found among the player's equipped items (general check).
     * @param {string} name - The name of the item being looked for.
     * @returns {string}
     */
    NOT_FOUND_EQUIPPED: (name) => `You don't have '${name}' equipped.`,

    /**
     * Target not found among the player's equipped items specifically for unequipping.
     * Used when resolving for the 'unequip' action by item name.
     * @param {string} name - The name of the item being looked for.
     * @returns {string}
     */
    NOT_FOUND_UNEQUIPPABLE: (name) => `You don't have '${name}' equipped to unequip.`,

    /**
     * Target not found nearby (e.g., for 'use item on target').
     * @param {string} targetDesc - The description/name of the target being looked for.
     * @returns {string}
     */
    TARGET_NOT_FOUND_CONTEXT: (targetDesc) => `Could not find '${targetDesc}' nearby to target.`,

    /**
     * Ambiguous target prompt when multiple entities match the user's input.
     * @param {string} actionVerb - The action being attempted (e.g., 'attack', 'take', 'use X on').
     * @param {string} targetTypeName - The name/type the user specified (e.g., the ambiguous noun like 'goblin').
     * @param {import('../entities/entity.js').default[]} matches - Array of matching entities.
     * @returns {string}
     */
    AMBIGUOUS_PROMPT: (actionVerb, targetTypeName, matches) => {
        const names = matches.map(e => getDisplayName(e)).join(', ');
        // VVV THIS IS THE CORRECTED LINE VVV
        return `Which '${targetTypeName}' do you want to ${actionVerb}: ${names}?`;
    },

    /**
     * Ambiguous target prompt specifically for using an item on a target.
     * @param {string} verb - The combined verb phrase (e.g., "use Potion on").
     * @param {string} targetDesc - The ambiguous name/description of the target.
     * @param {import('../entities/entity.js').default[]} matches - Array of matching entities.
     * @returns {string}
     */
    TARGET_AMBIGUOUS_CONTEXT: (verb, targetDesc, matches) => `Which '${targetDesc}' did you want to ${verb}? (${matches.map(m => getDisplayName(m)).join(', ')})`,

    /**
     * Ambiguous direction prompt when input matches multiple connection direction keys.
     * Used specifically by resolveTargetConnection.
     * @param {string} directionInput - The ambiguous direction string entered by the user (e.g., 'west').
     * @param {string[]} connectionNames - An array of display names for the matching connection entities (e.g., ['West Gate', 'Western Arch']).
     * @returns {string}
     */
    AMBIGUOUS_DIRECTION: (directionInput, connectionNames) => {
        // Handle potential empty names array gracefully, though unlikely if ambiguity was detected
        const namesList = connectionNames && connectionNames.length > 0 ? connectionNames.join(', ') : 'unspecified options';
        return `There are multiple ways to go '${directionInput}'. Which one did you mean: ${namesList}?`;
    },

    /**
     * Default feedback when the search scope yields no suitable entities after filtering.
     * This is the generic fallback used by TargetResolutionService if `emptyScopeMessage`
     * is not provided in the config. Callers might provide more specific messages
     * like TAKE_EMPTY_LOCATION via the config.
     * @param {string} actionVerb - The action verb.
     * @param {string} scopeContext - A hint about the scope, e.g., 'here', 'on you', 'nearby'.
     * @returns {string}
     */
    SCOPE_EMPTY_GENERIC: (actionVerb, scopeContext) => `You don't see anything suitable ${scopeContext} to ${actionVerb}.`,

    /**
     * Default feedback when the search scope (specifically inventory/equipment) yields no suitable entities.
     * @param {string} actionVerb - The action verb.
     * @returns {string}
     */
    SCOPE_EMPTY_PERSONAL: (actionVerb) => `You have nothing suitable to ${actionVerb}.`,

    /**
     * Feedback when a scope (like location for 'take') contains no items relevant to the action.
     * Used by TargetResolutionService when `filteredEntities.length === 0`.
     * Can be overridden by `emptyScopeMessage` in resolver config.
     * Example usage: `takeActionHandler` overrides this via resolver config.
     */
    TAKE_EMPTY_LOCATION: "There's nothing here to take.",
    // Note: TargetResolutionService has a generic fallback for empty scopes too.

    // ================================
    // General Prompts & Errors
    // ================================

    /**
     * Prompt when an action requires a target but none was provided.
     * @param {string} verb - The action verb (e.g., 'Attack', 'Take').
     * @returns {string} Example: "Attack what?"
     */
    PROMPT_WHAT: (verb) => `${verb.charAt(0).toUpperCase() + verb.slice(1)} what?`,

    /**
     * Generic internal error message for unexpected issues.
     */
    INTERNAL_ERROR: "Internal error occurred.",

    /**
     * Error indicating a required component is missing on the player or relevant entity.
     * @param {string} compName - Name of the missing component (e.g., 'Inventory', 'Position').
     * @returns {string}
     */
    INTERNAL_ERROR_COMPONENT: (compName) => `(Internal Error: Player is missing ${compName} capability.)`,

    INTERNAL_ERROR_RESOLUTION: (status) => `Internal error: Unexpected target resolution status (${status}).`,

    // ================================
    // Action Specific Validation & Feedback
    // ================================

    // --- Attack ---
    /** Feedback for trying to attack oneself. */
    ATTACK_SELF: "Trying to attack yourself? That's not productive.",
    /** Feedback when trying to attack a target that cannot be attacked (e.g., scenery, non-combatant). */
    ATTACK_NON_COMBATANT: (name) => `You can't attack the ${name}.`,
    /** Feedback when trying to attack an already defeated target. */
    ATTACK_DEFEATED: (name) => `The ${name} is already defeated.`,

    // --- Drop ---
    // (Most drop failures relate to finding the item, covered by NOT_FOUND_INVENTORY)

    // --- Equip ---
    /** Feedback when an item exists in inventory but lacks the EquippableComponent. */
    EQUIP_CANNOT: (name) => `You cannot equip the ${name}.`,
    /** Feedback when the player lacks the required equipment slot for an item. */
    EQUIP_NO_SLOT: (name, slotId) => `You don't have a slot to equip the ${name} (${slotId}).`,
    /** Feedback when the target equipment slot is already occupied. */
    EQUIP_SLOT_FULL: (currentItemName, slotName) => `You need to unequip the ${currentItemName} from your ${slotName} slot first.`,

    // --- Inventory ---
    /** Feedback when the player's inventory is empty (used by 'use' and potentially others). */
    NOTHING_CARRIED: "You aren't carrying anything.",

    // --- Look ---
    /** ***** NEW ***** Feedback when the player's location is unknown. */
    LOOK_LOCATION_UNKNOWN: "You can't see anything; your location is unknown.",
    /** ***** NEW ***** Feedback when the player looks at themselves. */
    LOOK_SELF: "You look yourself over. You seem to be in one piece.",
    /** Default feedback when looking at an entity that has no specific DescriptionComponent text. */
    LOOK_DEFAULT_DESCRIPTION: (name) => `You look closely at the ${name}, but see nothing particularly interesting.`,
    // Note: `executeLook` also has specific messages for looking at self ("You look yourself over...")
    // and for when the player's location is unknown ("You can't see anything...")


    // --- Move ---
    /** Feedback when the player's location is unknown during a move attempt. */
    MOVE_LOCATION_UNKNOWN: "Cannot move: your current location is unknown.",
    /** Feedback when the player's position component is missing during a move attempt. */
    MOVE_POSITION_UNKNOWN: "Cannot move: Your position is unknown.",
    /** Prompt when the 'move' command is given without a direction. */
    MOVE_NO_DIRECTION: "Move where? (Specify a direction like 'north', 'south', 'east', or 'west')",
    /** Feedback when the current location has no defined exits. */
    MOVE_NO_EXITS: "There are no obvious exits from here.",
    /** Feedback when trying to move in a direction that is locked. Can be overridden by connection data. */
    MOVE_LOCKED: (direction) => `The way ${direction} is locked.`,
    /** Feedback when connection data for a direction is invalid (e.g., missing target). */
    MOVE_INVALID_CONNECTION: (direction) => `The way ${direction} seems improperly constructed.`,
    /** Feedback when the target location definition for a connection is missing or invalid. */
    MOVE_BAD_TARGET_DEF: (direction) => `Something is wrong with the passage leading ${direction}.`,
    /** Generic feedback when there's no valid connection in the specified direction. */
    MOVE_CANNOT_GO_WAY: "You can't go that way.",
    // Note: `executeMove` also has a specific message if the player's location is unknown ("Cannot move: your current location is unknown.")

    // ================================
    // --> NEW: Movement Blocking <--
    // ================================

    /**
     * Feedback when movement is blocked because the blocking entity is locked.
     * Corresponds to BlockerSystem reasonCode 'DIRECTION_LOCKED'.
     * @param {string} blockerName - The display name of the blocking entity.
     * @returns {string}
     */
    MOVE_BLOCKED_LOCKED: (blockerName) => `The ${blockerName} is locked.`, // AC 1: Added

    /**
     * Generic feedback when movement is blocked by an entity (e.g., closed door, intact obstacle).
     * Corresponds to BlockerSystem reasonCode 'DIRECTION_BLOCKED'.
     * @param {string} blockerName - The display name of the blocking entity.
     * @returns {string}
     */
    MOVE_BLOCKED_GENERIC: (blockerName) => `The ${blockerName} blocks the way.`, // AC 2: Added

    /**
     * Feedback when movement is blocked because the referenced blocker entity could not be found.
     * Corresponds to BlockerSystem reasonCode 'BLOCKER_NOT_FOUND'. Provides a default message; handlers
     * might use more specific details from the event payload if available.
     * @returns {string}
     */
    MOVE_BLOCKER_NOT_FOUND: () => "The way seems blocked by something that isn't there anymore.", // AC 3: Added

    // ================================
    // --- Take ---
    // (Covered by NOT_FOUND_TAKEABLE and TAKE_EMPTY_LOCATION)

    // --- Unequip ---
    /** Feedback when trying to unequip from an explicitly named slot that is empty. */
    UNEQUIP_SLOT_EMPTY: (slotName) => `You have nothing equipped in your ${slotName} slot.`,
    // Note: Finding the item to unequip by name is covered by NOT_FOUND_UNEQUIPPABLE

    // --- Use ---
    // (These messages are likely used by systems handling item *effects* after 'event:item_use_attempted')
    /** Feedback when an item's usage conditions (e.g., target health state) are not met. */
    USE_CONDITION_FAILED: (itemName) => `You cannot use the ${itemName} under the current conditions.`,
    /** Generic feedback when an item cannot be used in the attempted manner (e.g., using a sword on a door). */
    USE_CANNOT: (name) => `You can't use the ${name} that way.`,
    /** Feedback when trying to use a healing item at full health. */
    USE_FULL_HEALTH: "You are already at full health.",
    /** Feedback when an item requires an explicit target but none was provided or resolved. */
    USE_INVALID_TARGET_CONNECTION: (id) => `The connection (${id}) you targeted is not valid here.`,
    USE_INVALID_TARGET_ENTITY: (id) => `The target (${id}) you specified is no longer valid.`,
    USE_REQUIRES_TARGET: (itemName) => `What do you want to use the ${itemName} on?`,
    USE_INVALID_TARGET: (itemName) => `You can't use the ${itemName} on that.`,

    // ================================
    // Generic Action Validation (Examples from Ticket)
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
     * Generic message for when a resolved target is fundamentally invalid for the attempted action,
     * before checking more specific conditions.
     * @param {string} targetName - The display name of the target entity.
     * @param {string} actionVerb - The verb of the action being attempted.
     * @returns {string} Example: "The training dummy is not a valid target for equipping."
     */
    TARGET_INVALID_FOR_ACTION: (targetName, actionVerb) => `The ${targetName} is not a valid target for ${actionVerb}.`,

};