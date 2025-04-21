// src/types/common.js

/**
 * @typedef {string} NamespacedId
 * @description A unique identifier string, typically namespaced using a colon (e.g., 'core:player', 'mod_combat:action_attack').
 * Allows alphanumeric characters, underscore, hyphen, and colon.
 * Pattern: ^[a-zA-Z0-9_\\-:]+$
 */

/**
 * @typedef {NamespacedId | null} NullableNamespacedId
 * @description A unique identifier string, typically namespaced (like namespacedId), or null.
 */

/**
 * @typedef {object} DefinitionRefComponentData
 * @description Data structure for DefinitionRefComponent.
 * @property {NamespacedId} id - The namespaced ID referencing the target definition.
 */

/**
 * @typedef {object} AttackComponentData
 * @description Data structure for AttackComponent.
 * @property {number} damage - Base damage (integer). Minimum 0.
 * @property {string} [attack_verb="attacks"] - Optional verb used in combat messages.
 */

/**
 * @typedef {object} EntitiesPresentComponentData
 * @description Data structure for EntitiesPresentComponent.
 * @property {NamespacedId[]} [entityIds=[]] - Array of entity IDs present within this entity (e.g., Location).
 */

/**
 * @typedef {{[directionOrName: string]: NamespacedId}} ExitsMap
 */

/**
 * @typedef {object} ConnectionsComponentData
 * @description Data structure for ConnectionsComponent (basic version).
 * @property {ExitsMap} exits - Map where keys are directions/names and values are target location IDs.
 */

/**
 * @typedef {{[slotId: NamespacedId]: NullableNamespacedId}} EquipmentSlotsMap
 */

/**
 * @typedef {object} EquipmentComponentData
 * @description Data structure for EquipmentComponent.
 * @property {EquipmentSlotsMap} slots - Map where keys are slot IDs and values are the equipped item ID or null.
 */

/**
 * @typedef {object} QuestLogComponentData
 * @description Data structure for QuestLogComponent.
 * @property {NamespacedId[]} [active_quests=[]] - List of active quest IDs.
 * @property {NamespacedId[]} [completed_quests=[]] - List of completed quest IDs.
 */

/**
 * @typedef {object} TypedParameterBaseData
 * @description Base structure for objects with typed parameters.
 * @property {string} type - Identifier determining the structure of 'parameters'.
 * @property {object} parameters - Container for parameters specific to the 'type'. Structure defined in consuming schemas.
 */

/**
 * @typedef {object} EventDefinitionData
 * @description Defines an event structure.
 * @property {NamespacedId} eventName - The unique, namespaced name/ID of the event.
 * @property {object} [eventData] - Optional payload data object for the event. Structure depends on the event.
 */

/**
 * @typedef {object} PassageDetailsComponentData
 * @description Data structure for PassageDetailsComponent.
 * @property {NamespacedId} locationAId - ID of the first location.
 * @property {NamespacedId} locationBId - ID of the second location.
 * @property {string} directionAtoB - Command to travel from A to B.
 * @property {string} directionBtoA - Command to travel from B to A.
 * @property {NullableNamespacedId} [blockerEntityId=null] - Optional ID of a blocking entity.
 * @property {string} [type="passage"] - Type of connection (e.g., 'doorway', 'path').
 * @property {boolean} [isHidden=false] - If true, connection requires discovery.
 * @property {string} [state] - Optional current state of the connection itself (e.g., 'open', 'closed').
 * @property {string} [descriptionOverrideAtoB] - Optional description from A looking towards B.
 * @property {string} [descriptionOverrideBtoA] - Optional description from B looking towards A.
 */

// --- Placeholder types for referenced schemas ---
// Replace these with actual imports if/when those schemas are defined as types

/** @typedef {object} OpenableComponentData */
/** @typedef {object} LockableComponentData */
/** @typedef {object} ContainerComponentData */
/** @typedef {object} EdibleComponentData */
/** @typedef {object} LiquidContainerComponentData */
/** @typedef {object} PushableComponentData */
/** @typedef {object} BreakableComponentData */


// Export the types (the empty export makes this file a module)
export {};

/*
 * Example Usage (in another file like actionDefinition.js):
 *
 * /** @typedef {import('./common.js').NamespacedId} NamespacedId * /
 * // Now NamespacedId can be used in other typedefs.
 */