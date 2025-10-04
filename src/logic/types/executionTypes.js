/**
 * @file Execution context type definitions
 * @description Pure type definitions without circular dependencies
 * This file contains type definitions for the execution context system,
 * extracted to break circular dependencies in the entity management system.
 * @see src/logic/defs.js - Operation handler type definitions
 * @see src/utils/serviceInitializerUtils.js - Service initialization utilities
 */

/** @typedef {import('../../entities/entityManager.js').default} EntityManager */
/** @typedef {import('../../interfaces/coreServices.js').ILogger} ILogger */
/** @typedef {import('../../events/validatedEventDispatcher.js').default} ValidatedEventDispatcher */
/** @typedef {import('../../data/gameDataRepository.js').default} GameDataRepository */

/**
 * @typedef {object} JsonLogicEntityContext
 * Represents the data context for a relevant entity (like actor or target)
 * @property {string | number} id - The unique identifier of the entity
 * @property {{[key: string]: object | null}} components - Component data map
 */

/**
 * @typedef {object} JsonLogicEvaluationContext
 * The data object provided to the JSON Logic evaluation engine
 * @property {object} event - Information about the triggering event
 * @property {string} event.type - The namespaced ID of the triggering event
 * @property {object | null} event.payload - The payload object carried by the event
 * @property {JsonLogicEntityContext | null} actor - Primary entity context
 * @property {JsonLogicEntityContext | null} target - Target entity context
 * @property {object} context - Temporary variables from action sequence
 */

/**
 * @typedef {object} ExecutionContext
 * Provides access to current evaluation state and core system services
 * This context is passed through the operation handler execution pipeline,
 * providing access to the entity manager, event dispatcher, logger, and
 * the current JSON Logic evaluation context.
 * @property {JsonLogicEvaluationContext} evaluationContext - Current evaluation state
 * @property {EntityManager} entityManager - Entity management service
 * @property {ValidatedEventDispatcher} validatedEventDispatcher - Event dispatcher
 * @property {ILogger} logger - Logging service
 * @property {GameDataRepository} [gameDataRepository] - Optional game data repository
 */

export {};
