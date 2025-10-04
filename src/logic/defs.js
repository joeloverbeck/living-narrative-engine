/**
 * @file Operation handler type definitions
 * @description Type definitions for operation handlers and execution context
 *
 * Note: ExecutionContext and related types have been extracted to
 * src/logic/types/executionTypes.js to break circular dependencies.
 * They are re-exported here for backward compatibility.
 */

// Re-export types from the new location for backward compatibility
export * from './types/executionTypes.js';

// --- JSDoc Imports (Ensure paths are correct for your project) ---
/** @typedef {import('../entities/entityManager.js').default} EntityManager */
/** @typedef {import('../interfaces/coreServices.js').ILogger} ILogger */
/** @typedef {import('../events/validatedEventDispatcher.js').default} ValidatedEventDispatcher */ // User confirmed preference
/** @typedef {import('../entities/entity.js').default} Entity */
/** @typedef {import('../data/gameDataRepository.js').default} GameDataRepository */ // <<< CORRECTED PATH based on provided service implementation
/** @typedef {import('./services/closenessCircleService.js')} ClosenessCircleService */
/** @typedef {import('../interfaces/ISafeEventDispatcher.js').ISafeEventDispatcher} ISafeEventDispatcher */

// Import re-exported types for JSDoc references
/** @typedef {import('./types/executionTypes.js').ExecutionContext} ExecutionContext */
/** @typedef {import('./types/executionTypes.js').JsonLogicEvaluationContext} JsonLogicEvaluationContext */
/** @typedef {import('./types/executionTypes.js').JsonLogicEntityContext} JsonLogicEntityContext */

// --- Existing Type Definitions (Assuming these are up-to-date) ---
/**
 * @typedef {object} GameEvent
 * @property {string} type - The unique identifier for the event type (e.g., "ENTITY_CREATED", "ACTION_PERFORMED:MOVE").
 * @property {*} [payload] - Optional data associated with the event. Structure depends on the event type.
 * @property {number} [timestamp] - Optional timestamp when the event occurred.
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
 * @typedef {object} OperationHandler
 * Defines the interface contract for operation handler classes.
 * Each handler must implement an execute method that processes operation parameters
 * within the provided execution context.
 * @property {function(OperationParams, ExecutionContext): void | Promise<void>} execute
 * The main method that executes the operation logic. Receives the specific parameters
 * for the operation instance and the broader execution context containing core
 * services and evaluation data. Can be synchronous (void) or asynchronous (Promise<void>).
 */

// --- Common Dependency Type Definitions ---

/**
 * @typedef {object} BaseHandlerDeps
 * Common dependencies required by most operation handlers.
 * @property {ILogger} logger - The logging service instance.
 */

/**
 * @typedef {object} EntityOperationDeps
 * Dependencies for handlers that work with entities and components.
 * @property {EntityManager} entityManager - The entity management service.
 * @property {ILogger} logger - The logging service instance.
 * @property {ISafeEventDispatcher} safeEventDispatcher - Safe event dispatcher for error handling.
 */

/**
 * @typedef {object} EventDispatchDeps
 * Dependencies for handlers that dispatch events.
 * @property {ValidatedEventDispatcher} validatedEventDispatcher - The validated event dispatcher.
 * @property {ILogger} logger - The logging service instance.
 * @property {ISafeEventDispatcher} safeEventDispatcher - Safe event dispatcher for error handling.
 */

/**
 * @typedef {object} ContextOperationDeps
 * Dependencies for handlers that modify execution context variables.
 * @property {ILogger} logger - The logging service instance.
 * @property {ISafeEventDispatcher} safeEventDispatcher - Safe event dispatcher for error handling.
 */

/**
 * @typedef {object} ClosenessCircleDeps
 * Dependencies for handlers that work with closeness circles.
 * @property {EntityManager} entityManager - The entity management service.
 * @property {ClosenessCircleService} closenessCircleService - The closeness circle service.
 * @property {ILogger} logger - The logging service instance.
 * @property {ISafeEventDispatcher} safeEventDispatcher - Safe event dispatcher for error handling.
 */

// Ensure this file doesn't export anything by default if it's just for type definitions
export {};
