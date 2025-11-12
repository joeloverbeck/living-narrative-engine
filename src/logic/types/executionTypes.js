/**
 * @file Execution context type definitions
 * @description Pure type definitions for execution context plumbing. These live in a
 *   leaf module with no runtime imports so that service initialization utilities and
 *   monitoring helpers can reference the shared shapes without triggering circular
 *   dependencies back into the entity management layer.
 */

/**
 * @typedef {object} ExecutionLogger
 * @description Minimal logging contract used during execution. Matches the shape
 *   expected by service initialization helpers without importing the full logger
 *   implementation.
 * @property {(message: string, ...args: any[]) => void} info - Log informational messages.
 * @property {(message: string, ...args: any[]) => void} warn - Log warning messages.
 * @property {(message: string, ...args: any[]) => void} error - Log error messages.
 * @property {(message: string, ...args: any[]) => void} debug - Log debug messages.
 * @property {(label?: string) => void} [groupCollapsed] - Optional helper for grouping output.
 * @property {() => void} [groupEnd] - Optional helper for closing grouped output.
 */

/**
 * @typedef {object} ExecutionEntityManagerLike
 * @description Subset of entity manager capabilities that execution context consumers
 *   rely upon. Documented here to avoid importing the concrete entity manager.
 * @property {(instanceId: string) => object | undefined} getEntityInstance - Retrieve an entity by instance ID.
 * @property {(instanceId: string, componentTypeId: string) => object | undefined} getComponentData - Fetch component data.
 * @property {(componentTypeId: string) => object[]} getEntitiesWithComponent - List entities that expose a component.
 * @property {(query: object) => object[]} [findEntities] - Optional query support.
 */

/**
 * @typedef {object} ExecutionValidatedEventDispatcher
 * @description Contract for the validated event dispatcher used during operation
 *   execution. The minimal surface is captured to prevent imports from the event bus.
 * @property {(eventName: string, payload: object, options?: object) => Promise<boolean>} dispatch - Dispatch a validated event.
 * @property {(eventName: string, listener: Function) => Function | null} subscribe - Subscribe to validated events.
 * @property {(eventName: string, listener: Function) => boolean} unsubscribe - Unsubscribe from validated events.
 */

/**
 * @typedef {object} ExecutionGameDataRepository
 * @description Minimal data repository contract surfaced to operation handlers. Kept
 *   light-weight to avoid importing schema-heavy repository types.
 * @property {(id: string) => object | null} getActionDefinition - Retrieve an action definition.
 * @property {(id: string) => object | null} getConditionDefinition - Retrieve a condition definition.
 * @property {(id: string) => object | null} getEntityDefinition - Retrieve an entity definition.
 * @property {() => object[]} [getAllActionDefinitions] - Optional helper for listing actions.
 * @property {() => object[]} [getAllConditionDefinitions] - Optional helper for listing conditions.
 * @property {() => object[]} [getAllEntityDefinitions] - Optional helper for listing entities.
 */

/**
 * @typedef {object} JsonLogicEntityContext
 * @description Represents the data context for a relevant entity (such as an actor or
 *   target) when evaluating JSON Logic expressions.
 * @property {string | number} id - Unique identifier for the entity instance.
 * @property {{[key: string]: object | null}} components - Component data map keyed by component type ID.
 */

/**
 * @typedef {object} JsonLogicEvaluationContext
 * @description Data provided to the JSON Logic evaluation engine during operation
 *   execution.
 * @property {{ type: string, payload: object | null }} event - Triggering event metadata.
 * @property {JsonLogicEntityContext | null} actor - Primary entity context.
 * @property {JsonLogicEntityContext | null} target - Target entity context (for single-target actions).
 * @property {JsonLogicEntityContext | null} [primary] - Primary target entity context (for multi-target actions).
 * @property {JsonLogicEntityContext | null} [secondary] - Secondary target entity context (for multi-target actions).
 * @property {JsonLogicEntityContext | null} [tertiary] - Tertiary target entity context (for multi-target actions).
 * @property {object} context - Temporary variables shared across the action sequence.
 */

/**
 * @typedef {object} ExecutionContext
 * @description Aggregates the services and state required by operation handlers during
 *   execution.
 * @property {JsonLogicEvaluationContext} evaluationContext - Current evaluation state.
 * @property {ExecutionEntityManagerLike} entityManager - Entity management surface for handlers.
 * @property {ExecutionValidatedEventDispatcher} validatedEventDispatcher - Event dispatcher for validated events.
 * @property {ExecutionLogger} logger - Logger instance scoped to the current execution.
 * @property {ExecutionGameDataRepository | null | undefined} [gameDataRepository] - Optional game data repository access.
 */

export {};
