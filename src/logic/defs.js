// src/logic/defs.js

// --- JSDoc Imports (Ensure paths are correct for your project) ---
/** @typedef {import('../entities/entityManager.js').default} EntityManager */
/** @typedef {import('../interfaces/coreServices.js').ILogger} ILogger */
/** @typedef {import('../events/validatedEventDispatcher.js').default} ValidatedEventDispatcher */ // User confirmed preference
/** @typedef {import('../entities/entity.js').default} Entity */
/** @typedef {import('../data/gameDataRepository.js').default} GameDataRepository */ // <<< CORRECTED PATH based on provided service implementation
/** @typedef {import('./services/closenessCircleService.js')} ClosenessCircleService */

// --- Existing Type Definitions (Assuming these are up-to-date) ---
/**
 * @typedef {object} GameEvent
 * @property {string} type - The unique identifier for the event type (e.g., "ENTITY_CREATED", "ACTION_PERFORMED:MOVE").
 * @property {*} [payload] - Optional data associated with the event. Structure depends on the event type.
 * @property {number} [timestamp] - Optional timestamp when the event occurred.
 */

/**
 * @typedef {object} JsonLogicEntityContext
 * Represents the data context for a relevant entity (like actor or target)
 * provided to the JSON Logic engine when evaluating SystemRule conditions.
 * Provides access to the entity's ID and its component data. Properties within
 * `components` resolve to null if the component is not present on the entity,
 * ensuring predictable behavior with the JSON Logic `var` operator.
 * @property {string | number} id - The unique identifier of the entity, retrieved from the Entity instance.
 * @property {Object<string, object|null>} components - A map-like structure providing access to the entity's
 * component data. Keys are Component Type IDs (e.g., "Health", "Position").
 * Accessing a key (e.g., `actor.components.Health`) dynamically retrieves the
 * raw component data object using `EntityManager.getComponentData(entityId, componentTypeId)`.
 * It yields the data object if the entity has that component, or null otherwise.
 */

/**
 * @typedef {object} JsonLogicEvaluationContext
 * The data object provided to the JSON Logic evaluation engine when processing
 * a SystemRule condition or an IF operation's condition. This object aggregates
 * all necessary contextual information required for the condition logic.
 * @property {object} event - Information about the triggering event.
 * @property {string} event.type - The namespaced ID of the triggering event (e.g., "ACTION_SUCCESS:MOVE").
 * @property {object | null} event.payload - The payload object carried by the triggering event. Contents vary by event type. Represented as null if payload was undefined.
 * @property {JsonLogicEntityContext | null} actor - Represents the primary entity contextually identified as the 'actor' for this event.
 * @property {JsonLogicEntityContext | null} target - Represents the entity contextually identified as the 'target' for this event.
 * @property {object} context - Holds temporary variables generated during the execution of the current SystemRule's action sequence.
 * @property {object} [globals] - Optional placeholder for future access to global game state variables.
 * @property {object} [entities] - Optional placeholder for future direct access to any entity's component data by ID.
 */

// --- REFINED Type Definitions for Operation Handling ---

/**
 * @typedef {object} OperationParams
 * @property
 * Represents the parameters provided to an Operation Handler. This is typically
 * the `parameters` object defined within an `Operation` in a SystemRule's action
 * list (conforming to `operation.schema.json`).
 * The specific structure of this object is dependent on the `type` of the operation.
 */

/**
 * @typedef {object} ExecutionContext
 * Provides access to the current evaluation state and core system services
 * needed by an Operation Handler during its execution. This context is assembled
 * by the OperationInterpreter (or a similar orchestrator) before invoking the handler.
 * It offers the necessary tools to interact with live game state and static definitions.
 * @property {JsonLogicEvaluationContext} evaluationContext - The data context used for JSON Logic evaluations, containing information about the event, actor, target, and any temporary context variables set by preceding operations (like QUERY_COMPONENT).
 * @property {EntityManager} entityManager - The central manager for accessing and manipulating live entity and component data. Essential for operations like MODIFY_COMPONENT.
 * @property {ValidatedEventDispatcher} validatedEventDispatcher - The system's validated event dispatcher for emitting new events as a result of the operation's execution. Used by operations like DISPATCH_EVENT.
 * @property {ILogger} logger - The logging service for recording messages, warnings, and errors occurring within the handler's logic. Used by operations like LOG.
 * @property {GameDataRepository} [gameDataRepository] - (Optional but recommended) Provides abstracted access to static game data definitions (e.g., action definitions, item templates, entity definitions) stored in the data registry. Useful if an operation needs details about a definition referenced by an ID.
 */

/**
 * @typedef {(params: OperationParams, context: ExecutionContext) => void | Promise<void>} OperationHandler
 * Defines the contract for a function responsible for executing the logic
 * associated with a specific operation type (e.g., 'MODIFY_COMPONENT', 'DISPATCH_EVENT', 'LOG').
 * Handlers receive the specific parameters for the operation instance and the
 * broader execution context containing core services and evaluation data.
 * Handlers can be synchronous (`void`) or asynchronous (`Promise<void>`).
 */

// Ensure this file doesn't export anything by default if it's just for type definitions
// export {};
