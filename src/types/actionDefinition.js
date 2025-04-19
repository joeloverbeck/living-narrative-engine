// src/types/actionDefinition.js

/**
 * @typedef {import('./common.js').NamespacedId} NamespacedId
 */

/**
 * @typedef {object} ConditionObject
 * @description A single prerequisite condition. Specific parameters depend on 'condition_type'. Extensible.
 * @property {string} condition_type - Identifier for the type of condition check (e.g., 'placeholder', 'actor_has_component', 'target_has_component', 'actor_stat_check', 'target_state_check', 'world_state_check').
 * @property {boolean} [negate=false] - If true, the result of the condition check is inverted.
 * @property {string} [failure_message] - Optional message to provide if this specific condition fails.
 * @property {boolean} [force_fail=false] - Optional flag specifically for placeholder testing to force a failure result.
 * @property {any} [details] - Allows specific condition types to add their own parameters, e.g., 'componentId', 'statId', 'minValue', 'expectedStateValue'. Use specific types based on known condition_type values.
 * For example:
 * @property {NamespacedId} [componentId] - Used with 'actor_has_component', 'target_has_component'.
 * @property {string} [statId] - Used with 'actor_stat_check'.
 * @property {number} [minValue] - Used with 'actor_stat_check'.
 * @property {string | number | boolean} [expectedStateValue] - Used with 'target_state_check', 'world_state_check'.
 * @property {any} [additionalProperties] - Fallback for truly custom data needed by specific condition types.
 * @comment Specific condition types will define their own required properties beyond 'condition_type'.
 */

/**
 * @typedef {'none' | 'self' | 'inventory' | 'equipment' | 'environment' | 'direction'} TargetDomain
 */

/**
 * @typedef {object} ActionDefinition
 * @description Defines the structure for an Action Definition, used by the Dynamic Action Discovery system.
 * @property {NamespacedId} id - Required. Unique, namespaced ID for the action definition (e.g., 'core:action_eat').
 * @property {string} [name] - Optional. Human-readable name or verb (e.g., 'Eat').
 * @property {TargetDomain} target_domain - Required. Specifies where to look for potential targets.
 * @property {NamespacedId[]} [actor_required_components=[]] - Optional. Components the acting entity must possess.
 * @property {NamespacedId[]} [actor_forbidden_components=[]] - Optional. Components the acting entity must NOT possess.
 * @property {NamespacedId[]} [target_required_components=[]] - Optional. Components the target entity must possess (if applicable).
 * @property {NamespacedId[]} [target_forbidden_components=[]] - Optional. Components the target entity must NOT possess (if applicable).
 * @property {ConditionObject[]} [prerequisites=[]] - Optional. Additional conditions that must all be met. Evaluated AFTER component checks.
 * @property {string} template - Required. Text template for generating the command string (e.g., 'eat {target}').
 * @property {any} [additionalProperties] - Allows additional properties for extensions like costs, effects, etc.
 */

export {}; // Ensure module treatment

/* Example Usage (in another file):
 * /** @typedef {import('./types/actionDefinition.js').ActionDefinition} ActionDefinition * /
 * /** @type {ActionDefinition} * /
 * const eatAction = {
 * id: "core:action_eat",
 * name: "Eat",
 * target_domain: "inventory",
 * actor_required_components: ["core:component_alive"],
 * target_required_components: ["core:component_edible"],
 * prerequisites: [
 * { condition_type: "placeholder", details: "Basic check placeholder" },
 * { condition_type: "placeholder_fail", failure_message: "Simulated prerequisite failure." } // Example for testing failure
 * ],
 * template: "eat {target}"
 * };
 */