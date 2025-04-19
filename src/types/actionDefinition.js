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
 * @property {object} [details] - Optional object to hold specific parameters needed by the condition type (e.g., componentId, statId, minValue). Structure depends on condition_type. Use more specific types if possible based on known condition_type values.
 * @property {any} [additionalProperties] - Fallback for truly custom data needed by specific condition types. Use this sparingly. Consider extending details or adding specific properties instead.
 * @comment Specific condition types will define their own required properties beyond 'condition_type'. Details object allows structured parameters.
 */

/**
 * @typedef {'none' | 'self' | 'inventory' | 'equipment' | 'environment' | 'direction'} TargetDomain
 */

/**
 * @typedef {object} ActionDefinition
 * @description Defines the structure for an Action Definition, used by the Dynamic Action Discovery system.
 * @property {NamespacedId} id - Required. Unique, namespaced ID for the action definition (e.g., 'core:action_eat').
 * @property {string} commandVerb - Required. The single, canonical, lowercase command verb (e.g., 'go', 'take', 'look'). Used for command parsing and UI generation. Must not contain spaces.
 * @property {string} [name] - Optional. Human-readable name or verb (e.g., 'Eat'). Primarily for debugging or tooling.
 * @property {TargetDomain} target_domain - Required. Specifies where to look for potential targets.
 * @property {NamespacedId[]} [actor_required_components=[]] - Optional. Components the acting entity must possess.
 * @property {NamespacedId[]} [actor_forbidden_components=[]] - Optional. Components the acting entity must NOT possess.
 * @property {NamespacedId[]} [target_required_components=[]] - Optional. Components the target entity must possess (if applicable).
 * @property {NamespacedId[]} [target_forbidden_components=[]] - Optional. Components the target entity must NOT possess (if applicable).
 * @property {ConditionObject[]} [prerequisites=[]] - Optional. Additional conditions that must all be met. Evaluated AFTER component checks.
 * @property {string} template - Required. Text template for generating the command string (e.g., 'eat {target}', 'go {direction}', 'wait').
 * @property {object} [dispatch_event] - Optional. Defines the event to dispatch if this action passes validation and target resolution.
 * @property {string} [dispatch_event.eventName] - Required if dispatch_event is present. The namespaced ID of the event to dispatch (e.g., 'event:move_attempted').
 * @property {Record<string, string>} [dispatch_event.payload] - Required if dispatch_event is present. Defines the event payload using source mapping strings (e.g., 'actor.id', 'target.component.Health.current').
 * @property {any} [additionalProperties] - Allows additional properties for extensions like costs, effects, etc.
 */

export {}; // Ensure module treatment

/* Example Usage (in another file):
 * /** @typedef {import('./types/actionDefinition.js').ActionDefinition} ActionDefinition * /
 * /** @type {ActionDefinition} * /
 * const eatAction = {
 * id: "core:action_eat",
 * commandVerb: "eat",
 * name: "Eat",
 * target_domain: "inventory",
 * actor_required_components: ["core:component_alive"],
 * target_required_components: ["core:component_edible"],
 * prerequisites: [
 * { condition_type: "placeholder", details: { info: "Basic check placeholder" } },
 * { condition_type: "placeholder_fail", failure_message: "Simulated prerequisite failure." } // Example for testing failure
 * ],
 * template: "eat {target}"
 * dispatch_event: {
 * eventName: "event:actor_ate",
 * payload: {
 * actorId: "actor.id",
 * foodId: "target.id",
 * foodName: "target.name"
 * }
 * }
 * };
 */