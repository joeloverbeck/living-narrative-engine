/**
 * @file DamageExecutionService.js
 * @description Bridges UI damage configuration to the real APPLY_DAMAGE operation handler.
 * Handles constructing proper operation parameters, executing damage, and capturing
 * results for display.
 * @see applyDamageHandler.js - Handler that executes the damage
 * @see DamageCapabilityComposer.js - Provides damage configuration
 */

import { validateDependency } from '../../utils/dependencyUtils.js';

/** @typedef {import('../../interfaces/coreServices.js').ILogger} ILogger */
/** @typedef {import('../../interfaces/ISafeEventDispatcher.js').ISafeEventDispatcher} ISafeEventDispatcher */
/** @typedef {import('../../entities/entityManager.js').default} EntityManager */
/** @typedef {import('../../logic/operationInterpreter.js').default} OperationInterpreter */

/**
 * Event types emitted by the execution service
 * @readonly
 */
const EXECUTION_EVENTS = Object.freeze({
  EXECUTION_STARTED: 'damage-simulator:execution-started',
  EXECUTION_COMPLETE: 'damage-simulator:execution-complete',
  EXECUTION_ERROR: 'damage-simulator:execution-error',
});

/**
 * Event type for anatomy damage applied (subscribed to capture results)
 * @readonly
 */
const DAMAGE_APPLIED_EVENT = 'anatomy:damage_applied';

/**
 * Component IDs for entity queries
 * @readonly
 */
const COMPONENT_IDS = Object.freeze({
  PART: 'anatomy:part',
  PART_HEALTH: 'anatomy:part_health',
  NAME: 'core:name',
  BODY: 'anatomy:body',
});

/**
 * @typedef {Object} DamageResult
 * @property {boolean} success - Whether damage was applied successfully
 * @property {string} [targetPartId] - Which part was hit
 * @property {string} [targetPartName] - Human-readable part name
 * @property {number} [damageDealt] - Amount of damage dealt
 * @property {string} [damageType] - Type of damage dealt
 * @property {string} [severity] - Severity classification
 * @property {string|null} [error] - Error message if failed
 */

/**
 * @typedef {Object} ExecutionResult
 * @property {boolean} success - Overall execution success
 * @property {DamageResult[]} results - Array of damage results
 * @property {string|null} error - Error message if execution failed
 */

/**
 * Service for executing damage operations in the damage simulator.
 * Bridges UI configuration to the real APPLY_DAMAGE operation handler.
 */
class DamageExecutionService {
  /** @type {OperationInterpreter} */
  #operationInterpreter;

  /** @type {EntityManager} */
  #entityManager;

  /** @type {ISafeEventDispatcher} */
  #eventBus;

  /** @type {ILogger} */
  #logger;

  /**
   * Expose constants for testing and external use
   */
  static EXECUTION_EVENTS = EXECUTION_EVENTS;
  static DAMAGE_APPLIED_EVENT = DAMAGE_APPLIED_EVENT;
  static COMPONENT_IDS = COMPONENT_IDS;

  /**
   * @param {Object} dependencies
   * @param {OperationInterpreter} dependencies.operationInterpreter - Executes operations
   * @param {EntityManager} dependencies.entityManager - Entity management service
   * @param {ISafeEventDispatcher} dependencies.eventBus - Event dispatcher
   * @param {ILogger} dependencies.logger - Logger instance
   */
  constructor({ operationInterpreter, entityManager, eventBus, logger }) {
    validateDependency(operationInterpreter, 'IOperationInterpreter', console, {
      requiredMethods: ['execute'],
    });
    validateDependency(entityManager, 'IEntityManager', console, {
      requiredMethods: ['getEntityInstance', 'getComponentData'],
    });
    validateDependency(eventBus, 'IEventBus', console, {
      requiredMethods: ['dispatch', 'subscribe'],
    });
    validateDependency(logger, 'ILogger', console, {
      requiredMethods: ['debug', 'info', 'warn', 'error'],
    });

    this.#operationInterpreter = operationInterpreter;
    this.#entityManager = entityManager;
    this.#eventBus = eventBus;
    this.#logger = logger;
  }

  /**
   * Apply damage to an entity using the real APPLY_DAMAGE operation handler.
   *
   * @param {Object} options
   * @param {string} options.entityId - Target entity instance ID
   * @param {Object} options.damageEntry - Damage entry from DamageCapabilityComposer
   * @param {number} [options.multiplier=1] - Damage multiplier
   * @param {string|null} [options.targetPartId=null] - Specific part ID or null for random
   * @returns {Promise<ExecutionResult>}
   */
  async applyDamage({ entityId, damageEntry, multiplier = 1, targetPartId = null }) {
    this.#logger.debug('[DamageExecutionService] Applying damage', {
      entityId,
      damageEntry,
      multiplier,
      targetPartId,
    });

    const results = [];

    // Emit execution started event
    this.#eventBus.dispatch(EXECUTION_EVENTS.EXECUTION_STARTED, {
      entityId,
      damageEntry,
      multiplier,
      targetPartId,
    });

    // Subscribe to damage events to capture results
    const unsubscribe = this.#eventBus.subscribe(
      DAMAGE_APPLIED_EVENT,
      (event) => {
        const result = this.#extractResult(event.payload);
        results.push(result);
      }
    );

    try {
      // Build operation
      const operation = this.#buildOperation({
        entityId,
        damageEntry,
        multiplier,
        targetPartId,
      });

      // Build execution context
      const executionContext = this.#buildExecutionContext(entityId);

      // Execute the operation
      const handlerResult = this.#operationInterpreter.execute(operation, executionContext);

      // Handle async or sync result
      if (handlerResult && typeof handlerResult.then === 'function') {
        await handlerResult;
      }

      this.#logger.info(
        `[DamageExecutionService] Damage applied successfully, ${results.length} result(s)`
      );

      // Emit execution complete event
      this.#eventBus.dispatch(EXECUTION_EVENTS.EXECUTION_COMPLETE, {
        entityId,
        results,
      });

      return {
        success: true,
        results,
        error: null,
      };
    } catch (error) {
      this.#logger.error('[DamageExecutionService] Execution failed:', error);

      // Emit execution error event
      this.#eventBus.dispatch(EXECUTION_EVENTS.EXECUTION_ERROR, {
        entityId,
        error: error.message,
      });

      return {
        success: false,
        results,
        error: error.message,
      };
    } finally {
      // Always unsubscribe to prevent memory leaks
      if (typeof unsubscribe === 'function') {
        unsubscribe();
      }
    }
  }

  /**
   * Get list of targetable body parts for an entity.
   *
   * @param {string} entityId - Entity instance ID
   * @returns {Array<{id: string, name: string, weight: number}>} Targetable parts
   */
  getTargetableParts(entityId) {
    this.#logger.debug('[DamageExecutionService] Getting targetable parts', { entityId });

    const entity = this.#entityManager.getEntityInstance(entityId);
    if (!entity) {
      this.#logger.warn(`[DamageExecutionService] Entity not found: ${entityId}`);
      return [];
    }

    const parts = [];
    const bodyData = this.#entityManager.getComponentData(entityId, COMPONENT_IDS.BODY);

    if (!bodyData?.parts) {
      this.#logger.debug('[DamageExecutionService] No body parts found');
      return [];
    }

    // Iterate through body parts
    for (const partId of bodyData.parts) {
      const partData = this.#entityManager.getComponentData(partId, COMPONENT_IDS.PART);
      const nameData = this.#entityManager.getComponentData(partId, COMPONENT_IDS.NAME);

      if (partData) {
        parts.push({
          id: partId,
          name: nameData?.name || partData.subType || partId,
          weight: partData.targetWeight ?? 1,
        });
      }
    }

    this.#logger.debug(`[DamageExecutionService] Found ${parts.length} targetable parts`);
    return parts;
  }

  /**
   * Build the APPLY_DAMAGE operation object.
   *
   * @private
   * @param {Object} options
   * @param {string} options.entityId
   * @param {Object} options.damageEntry
   * @param {number} options.multiplier
   * @param {string|null} options.targetPartId
   * @returns {Object} Operation object
   */
  #buildOperation({ entityId, damageEntry, multiplier, targetPartId }) {
    const parameters = {
      entity_ref: entityId,
      damage_entry: damageEntry,
      damage_multiplier: multiplier,
    };

    // Only include part_ref for specific targeting
    if (targetPartId) {
      parameters.part_ref = targetPartId;
    }

    return {
      type: 'APPLY_DAMAGE',
      parameters,
    };
  }

  /**
   * Build the execution context for the operation interpreter.
   *
   * @private
   * @param {string} entityId
   * @returns {Object} Execution context
   */
  #buildExecutionContext(entityId) {
    return {
      evaluationContext: {
        event: {
          type: 'damage-simulator:apply',
          payload: {},
        },
        actor: null,
        target: this.#buildEntityContext(entityId),
        context: {},
      },
      entityManager: this.#entityManager,
      validatedEventDispatcher: this.#eventBus,
      logger: this.#logger,
    };
  }

  /**
   * Build entity context for JSON Logic evaluation.
   *
   * @private
   * @param {string} entityId
   * @returns {Object|null} Entity context
   */
  #buildEntityContext(entityId) {
    const entity = this.#entityManager.getEntityInstance(entityId);
    if (!entity) {
      return null;
    }

    // Build components map
    const components = {};
    const componentIds = entity.getComponentIds ? entity.getComponentIds() : [];

    for (const componentId of componentIds) {
      components[componentId] = this.#entityManager.getComponentData(entityId, componentId);
    }

    return {
      id: entityId,
      components,
    };
  }

  /**
   * Extract a DamageResult from an anatomy:damage_applied event payload.
   *
   * @private
   * @param {Object} payload - Event payload
   * @returns {DamageResult} Extracted result
   */
  #extractResult(payload) {
    return {
      success: true,
      targetPartId: payload.partId,
      targetPartName: payload.partType || payload.partId,
      damageDealt: payload.amount,
      damageType: payload.damageType,
      severity: payload.severity,
      error: null,
    };
  }
}

export default DamageExecutionService;
