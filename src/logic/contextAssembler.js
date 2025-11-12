// src/logic/contextAssembler.js

// --- JSDoc Imports for Type Hinting ---
/** @typedef {import('../entities/entityManager.js').default} EntityManager */
/** @typedef {import('../interfaces/coreServices.js').ILogger} ILogger */
/** @typedef {import('./defs.js').GameEvent} GameEvent */
/** @typedef {import('./defs.js').JsonLogicEvaluationContext} JsonLogicEvaluationContext */
/** @typedef {import('./defs.js').JsonLogicEntityContext} JsonLogicEntityContext */
// +++ Add imports for the new function's parameters +++
/** @typedef {import('../entities/entity.js').default} Entity */
/** @typedef {import('../models/actionTargetContext.js').ActionTargetContext} ActionTargetContext */

import { ServiceSetup } from '../utils/serviceInitializerUtils.js';
import { REQUIRED_ENTITY_MANAGER_METHODS } from '../constants/entityManager.js';
import { createComponentAccessor } from './componentAccessor.js';

/** @typedef {string | number | null | undefined} EntityId */

/**
 * @description Create a basic context object for an entity.
 * @param {EntityId} entityId - Identifier of the entity.
 * @param {EntityManager} entityManager - Manager used to access components.
 * @param {ILogger} logger - Logger instance for diagnostics.
 * @returns {JsonLogicEntityContext} Context object with id and component accessor.
 */
export function createEntityContext(entityId, entityManager, logger) {
  return {
    id: entityId,
    components: createComponentAccessor(entityId, entityManager, logger),
  };
}

/**
 * Populates either the `actor` or `target` field on the provided evaluation
 * context by retrieving the entity and creating a component accessor.
 *
 * @param {'actor' | 'target'} fieldName - Which field to populate on the
 *   evaluation context.
 * @param {EntityId} entityId - Identifier of the entity to retrieve.
 * @param {JsonLogicEvaluationContext} evaluationContext - Context object being
 *   assembled.
 * @param {EntityManager} entityManager - Entity manager used for lookups.
 * @param {ILogger} logger - Logger instance for diagnostics.
 * @returns {void}
 */
export function populateParticipant(
  fieldName,
  entityId,
  evaluationContext,
  entityManager,
  logger
) {
  logger.debug(
    `🔧 [populateParticipant] Populating ${fieldName} with entityId: ${entityId}`
  );

  // Handle special 'system' token - represents system-generated events
  if (entityId === 'system') {
    logger.debug(
      `Special 'system' token detected for ${fieldName}. Creating minimal context without entity lookup.`
    );
    evaluationContext[fieldName] = {
      id: 'system',
      components: createComponentAccessor('system', entityManager, logger),
    };
    return;
  }

  const isStringIdentifier = typeof entityId === 'string';
  const isNumberIdentifier = typeof entityId === 'number';
  const hasStringValue = isStringIdentifier && entityId.length > 0;
  const hasNumberValue = isNumberIdentifier && Number.isFinite(entityId);
  const shouldAttemptLookup = hasStringValue || hasNumberValue;

  if (shouldAttemptLookup) {
    try {
      const entity = entityManager.getEntityInstance(entityId);
      logger.debug(
        `🔧 [populateParticipant] getEntityInstance(${entityId}) returned: ${entity ? 'entity object' : 'null/undefined'}`
      );

      if (entity) {
        logger.debug(
          `Found ${fieldName} entity [${entityId}]. Creating context entry.`
        );
        evaluationContext[fieldName] = createEntityContext(
          entityId,
          entityManager,
          logger
        );
        logger.debug(
          `🔧 [populateParticipant] Context entry created. evaluationContext.${fieldName}.id = ${evaluationContext[fieldName].id}`
        );
      } else {
        logger.warn(
          `${fieldName.charAt(0).toUpperCase() + fieldName.slice(1)} entity not found for ID [${entityId}]. Setting ${fieldName} context to null.`
        );
      }
    } catch (error) {
      logger.error(
        `Error processing ${fieldName} ID [${entityId}] in createJsonLogicContext:`,
        error
      );
      throw error;
    }
  } else if (entityId) {
    logger.warn(
      `Invalid ${fieldName}Id type provided: [${typeof entityId}]. Setting ${fieldName} context to null.`
    );
  } else if (fieldName === 'target') {
    logger.debug('No targetId provided, target context remains null.');
  }
}

/**
 * Assembles the data context object (`JsonLogicEvaluationContext`) needed for
 * evaluating JSON Logic rules within the system.
 *
 * @param {GameEvent} event - The triggering game event object.
 * @param {EntityId} actorId - The ID of the entity considered the 'actor' for this event, if applicable.
 * @param {EntityId} targetId - The ID of the entity considered the 'target' for this event, if applicable.
 * @param {EntityManager} entityManager - The EntityManager instance for retrieving entity data.
 * @param {ILogger} logger - Logger instance for diagnostics.
 * @param serviceSetup
 * @returns {JsonLogicEvaluationContext} The assembled data context object.
 * @throws {Error} If required arguments like event, entityManager, or logger are missing.
 */
export function createJsonLogicContext(
  event,
  actorId,
  targetId,
  entityManager,
  logger,
  serviceSetup
) {
  // --- Argument Validation ---
  if (!event || typeof event !== 'object' || typeof event.type !== 'string') {
    throw new Error(
      "createJsonLogicContext: Missing or invalid 'event' object."
    );
  }
  // Check if serviceSetup is a trace object (has trace-specific methods)
  // If so, don't use it as ServiceSetup - create a new one instead
  const isTrace =
    serviceSetup &&
    typeof serviceSetup === 'object' &&
    'captureOperationStart' in serviceSetup;
  const setup = isTrace
    ? new ServiceSetup()
    : (serviceSetup ?? new ServiceSetup());
  const effectiveLogger = setup.setupService('createJsonLogicContext', logger, {
    entityManager: {
      value: entityManager,
      requiredMethods: REQUIRED_ENTITY_MANAGER_METHODS,
    },
  });

  logger = effectiveLogger;

  logger.debug(
    `Creating JsonLogicEvaluationContext for event type [${event.type}]. ActorID: [${actorId ?? 'None'}], TargetID: [${targetId ?? 'None'}]`
  );

  // --- Initialize Context Object ---
  /** @type {JsonLogicEvaluationContext} */
  const evaluationContext = {
    event: {
      // AC.3: Populate event property
      type: event.type,
      // Before: payload: event.payload || {}
      // After: Represent a truly missing payload as null, otherwise use the provided payload (even if it's {} or other falsy value except undefined)
      payload: event.payload === undefined ? null : event.payload,
    },
    actor: null, // Initialize as null
    target: null, // Initialize as null
    context: {}, // AC.6: Initialize context as an empty object
    globals: {}, // AC.7: Initialize globals placeholder
    entities: {}, // AC.7: Initialize entities placeholder (if needed later)
  };

  // --- Populate Actor --- (AC.4, AC.5, AC.9)
  populateParticipant(
    'actor',
    actorId,
    evaluationContext,
    entityManager,
    logger
  );

  // --- Populate Target --- (AC.4, AC.5, AC.9)
  populateParticipant(
    'target',
    targetId,
    evaluationContext,
    entityManager,
    logger
  );

  // --- Populate Multi-Target Participants (primary, secondary, tertiary) ---
  const primaryId = event.payload?.primaryId;
  const secondaryId = event.payload?.secondaryId;
  const tertiaryId = event.payload?.tertiaryId;

  if (primaryId !== undefined && primaryId !== null) {
    populateParticipant(
      'primary',
      primaryId,
      evaluationContext,
      entityManager,
      logger
    );
  }

  if (secondaryId !== undefined && secondaryId !== null) {
    populateParticipant(
      'secondary',
      secondaryId,
      evaluationContext,
      entityManager,
      logger
    );
  }

  if (tertiaryId !== undefined && tertiaryId !== null) {
    populateParticipant(
      'tertiary',
      tertiaryId,
      evaluationContext,
      entityManager,
      logger
    );
  }

  return evaluationContext;
}

/**
 * @description Assemble the nested execution context used by SystemLogicInterpreter.
 * Internally delegates to {@link createJsonLogicContext} for the evaluation context.
 * @param {GameEvent} event - Event triggering rule evaluation.
 * @param {EntityId} actorId - Optional actor entity ID.
 * @param {EntityId} targetId - Optional target entity ID.
 * @param serviceSetup
 * @param {EntityManager} entityManager - Entity manager for lookups.
 * @param {ILogger} logger - Logger instance.
 * @returns {{event: GameEvent, actor: JsonLogicEntityContext|null, target: JsonLogicEntityContext|null, logger: ILogger, evaluationContext: JsonLogicEvaluationContext}}
 *   The nested execution context structure.
 */
export function createNestedExecutionContext(
  event,
  actorId,
  targetId,
  entityManager,
  logger,
  serviceSetup
) {
  logger.debug(
    `🔧 [createNestedExecutionContext] Starting with actorId: ${actorId}, targetId: ${targetId}`
  );

  const ctx = createJsonLogicContext(
    event,
    actorId,
    targetId,
    entityManager,
    logger,
    serviceSetup
  );

  logger.debug(
    `🔧 [createNestedExecutionContext] JsonLogicContext created. ctx.actor: ${ctx.actor ? ctx.actor.id : 'null'}, ctx.target: ${ctx.target ? ctx.target.id : 'null'}`
  );

  const executionContext = {
    event,
    actor: ctx.actor,
    target: ctx.target,
    logger,
    evaluationContext: ctx,
  };

  logger.debug(`🔧 [createNestedExecutionContext] ExecutionContext assembled:`);
  logger.debug(
    `  - executionContext.actor: ${executionContext.actor ? executionContext.actor.id : 'null'}`
  );
  logger.debug(
    `  - executionContext.evaluationContext.actor: ${executionContext.evaluationContext.actor ? executionContext.evaluationContext.actor.id : 'null'}`
  );

  // Add trace if it was passed (trace is passed as serviceSetup parameter)
  // Check if serviceSetup is a trace object (has trace-specific methods)
  if (
    serviceSetup &&
    typeof serviceSetup === 'object' &&
    'captureOperationStart' in serviceSetup
  ) {
    executionContext.trace = serviceSetup;
  }

  return executionContext;
}

/**
 * Creates an evaluation context by extracting actor/target IDs from event payload.
 * This function provides a simplified interface that matches E2E test expectations.
 *
 * @param {GameEvent} event - Event with payload containing actorId/targetId
 * @param {EntityManager} entityManager - Entity manager for lookups
 * @param {ILogger} logger - Logger instance
 * @returns {{event: GameEvent, actor?: JsonLogicEntityContext, target?: JsonLogicEntityContext, [key: string]: any}}
 *   Context object with event and populated actor/target contexts, plus any additional payload data
 */
export function createEvaluationContext(event, entityManager, logger) {
  if (!event || typeof event !== 'object' || typeof event.type !== 'string') {
    throw new Error(
      "createEvaluationContext: Missing or invalid 'event' object."
    );
  }

  // Create base context with event
  const context = {
    event,
  };

  // Extract IDs from payload
  const actorId = event.payload?.actorId;
  const targetId = event.payload?.targetId;

  const hasActorId = actorId !== undefined && actorId !== null;
  const hasTargetId = targetId !== undefined && targetId !== null;

  // Add actor context if actorId exists
  if (hasActorId) {
    context.actor = createEntityContext(actorId, entityManager, logger);
  }

  // Add target context if targetId exists
  if (hasTargetId) {
    context.target = createEntityContext(targetId, entityManager, logger);
  }

  // Spread any additional payload data into context (excluding actorId/targetId)
  if (event.payload && typeof event.payload === 'object') {
    for (const [key, value] of Object.entries(event.payload)) {
      if (key !== 'actorId' && key !== 'targetId') {
        context[key] = value;
      }
    }
  }

  return context;
}
