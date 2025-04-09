// src/utils/messages.js

// Conceptual shared messages (e.g., in src/utils/messages.js or similar)
import {NameComponent} from "../components/nameComponent.js";

export const TARGET_MESSAGES = {
    // Target Finding
    NOT_FOUND_LOCATION: (name) => `You don't see any '${name}' here.`,
    NOT_FOUND_ATTACKABLE: (name) => `There is no one called '${name}' here to attack.`, // More specific
    NOT_FOUND_TAKEABLE: (name) => `You don't see any '${name}' here to take.`,       // More specific
    NOT_FOUND_INVENTORY: (name) => `You don't have a '${name}'.`,
    NOT_FOUND_EQUIPPABLE: (name) => `You don't have a '${name}' you can equip.`,
    NOT_FOUND_EQUIPPED: (name) => `You don't have '${name}' equipped.`,
    NOT_FOUND_UNEQUIPPABLE: (name) => `You don't have '${name}' equipped to unequip.`, // More specific

    AMBIGUOUS_PROMPT: (actionVerb, targetTypeName, matches) => {
        const names = matches.map(e => e.getComponent(NameComponent)?.value ?? e.id).join(', ');
        return `Which ${targetTypeName} do you want to ${actionVerb}: ${names}?`;
    },

    // Action Specific
    ATTACK_SELF: "Trying to attack yourself? That's not productive.",
    ATTACK_NON_COMBATANT: (name) => `You can't attack the ${name}.`,
    ATTACK_DEFEATED: (name) => `The ${name} is already defeated.`,
    EQUIP_CANNOT: (name) => `You cannot equip the ${name}.`,
    EQUIP_NO_SLOT: (name, slotId) => `You don't have a slot to equip the ${name} (${slotId}).`,
    EQUIP_SLOT_FULL: (currentItemName, slotName) => `You need to unequip the ${currentItemName} from your ${slotName} slot first.`,
    UNEQUIP_SLOT_EMPTY: (slotName) => `You have nothing equipped in your ${slotName} slot.`,
    USE_CANNOT: (name) => `You can't use the ${name} that way.`,
    USE_FULL_HEALTH: "You are already at full health.",
    MOVE_NO_DIRECTION: "Move where? (Specify a direction like 'north', 'south', 'east', or 'west')",
    MOVE_NO_EXITS: "There are no obvious exits from here.",
    MOVE_LOCKED: (direction) => `The way ${direction} is locked.`, // Default, can be overridden
    MOVE_INVALID_CONNECTION: (direction) => `The way ${direction} seems improperly constructed.`,
    MOVE_BAD_TARGET_DEF: (direction) => `Something is wrong with the passage leading ${direction}.`,
    MOVE_CANNOT_GO_WAY: "You can't go that way.",

    // General Prompts/Errors
    PROMPT_WHAT: (verb) => `${verb.charAt(0).toUpperCase() + verb.slice(1)} what?`, // e.g., "Attack what?", "Take what?"
    INTERNAL_ERROR: "Internal error occurred.", // Generic internal error for UI
    INTERNAL_ERROR_COMPONENT: (compName) => `(Internal Error: Player is missing ${compName} capability.)`,

};

// Helper to get NameComponent value or fallback
export const getDisplayName = (entity) => entity?.getComponent(NameComponent)?.value ?? entity?.id ?? 'unknown entity';