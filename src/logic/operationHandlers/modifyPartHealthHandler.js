/**
 * @file Handler for MODIFY_PART_HEALTH operation
 *
 * Changes a body part's health value by a delta amount. Negative delta = damage,
 * positive delta = healing. Automatically clamps to [0, maxHealth] bounds and
 * dispatches the anatomy:part_health_changed event.
 *
 * Operation flow:
 * 1. Validates operation parameters (part_entity_ref, delta)
 * 2. Resolves entity reference (string or JSON Logic expression)
 * 3. Resolves delta value (number or JSON Logic expression)
 * 4. Retrieves anatomy:part_health component from target entity
 * 5. Calculates new health: currentHealth + delta
 * 6. Clamps to [0, maxHealth] if clamp_to_bounds is true (default)
 * 7. Updates turnsInState if state changes based on health percentage
 * 8. Updates part_health component via addComponent
 * 9. Dispatches anatomy:part_health_changed event
 *
 * Related files:
 * @see data/schemas/operations/modifyPartHealth.schema.json - Operation schema
 * @see data/mods/anatomy/components/part_health.component.json - Component definition
 * @see src/dependencyInjection/tokens/tokens-core.js - ModifyPartHealthHandler token
 * @see src/dependencyInjection/registrations/operationHandlerRegistrations.js - Handler registration
 * @see src/dependencyInjection/registrations/interpreterRegistrations.js - Operation mapping
 * @see src/utils/preValidationUtils.js - KNOWN_OPERATION_TYPES whitelist
 * @augments BaseOperationHandler
 */

import BaseOperationHandler from './baseOperationHandler.js';
import { assertParamsObject } from '../../utils/handlerUtils/paramsUtils.js';
import { safeDispatchError } from '../../utils/safeDispatchErrorUtils.js';

const PART_HEALTH_COMPONENT_ID = 'anatomy:part_health';
const PART_COMPONENT_ID = 'anatomy:part';
const PART_HEALTH_CHANGED_EVENT = 'anatomy:part_health_changed';

/**
 * Health state thresholds (matching component definition):
 * - healthy: 76-100%
 * - bruised: 51-75%
 * - wounded: 26-50%
 * - badly_damaged: 1-25%
 * - destroyed: 0%
 */
const HEALTH_STATE_THRESHOLDS = {
  healthy: 76,
  bruised: 51,
  wounded: 26,
  badly_damaged: 1,
  destroyed: 0,
};

/**
 * @typedef {object} ModifyPartHealthParams
 * @property {string|object} part_entity_ref - Reference to body part entity (string ID or JSON Logic)
 * @property {number|object} delta - Health change amount (number or JSON Logic). Negative = damage, positive = heal.
 * @property {boolean} [clamp_to_bounds=true] - Whether to clamp result to [0, maxHealth]
 */

/**
 * Handler for MODIFY_PART_HEALTH operation.
 * Changes a body part's health value by a delta amount.
 */
class ModifyPartHealthHandler extends BaseOperationHandler {
  /** @type {import('../../entities/entityManager.js').default} */ #entityManager;
  /** @type {import('../../interfaces/ISafeEventDispatcher.js').ISafeEventDispatcher} */ #dispatcher;
  /** @type {import('../jsonLogicEvaluationService.js').default} */ #jsonLogicService;

  constructor({ logger, entityManager, safeEventDispatcher, jsonLogicService }) {
    super('ModifyPartHealthHandler', {
      logger: { value: logger },
      entityManager: {
        value: entityManager,
        requiredMethods: ['getComponentData', 'addComponent', 'hasComponent'],
      },
      safeEventDispatcher: {
        value: safeEventDispatcher,
        requiredMethods: ['dispatch'],
      },
      jsonLogicService: {
        value: jsonLogicService,
        requiredMethods: ['evaluate'],
      },
    });
    this.#entityManager = entityManager;
    this.#dispatcher = safeEventDispatcher;
    this.#jsonLogicService = jsonLogicService;
  }

  /**
   * Calculate health state from percentage
   *
   * @param {number} healthPercentage - Current health as percentage of maximum (0-100)
   * @returns {string} Health state: healthy, bruised, wounded, badly_damaged, or destroyed
   * @private
   */
  #calculateHealthState(healthPercentage) {
    if (healthPercentage >= HEALTH_STATE_THRESHOLDS.healthy) return 'healthy';
    if (healthPercentage >= HEALTH_STATE_THRESHOLDS.bruised) return 'bruised';
    if (healthPercentage >= HEALTH_STATE_THRESHOLDS.wounded) return 'wounded';
    if (healthPercentage >= HEALTH_STATE_THRESHOLDS.badly_damaged)
      return 'badly_damaged';
    return 'destroyed';
  }

  /**
   * Resolve entity reference from string or JSON Logic expression
   *
   * @param {string|object} ref - Entity reference
   * @param {object} context - Execution context for JSON Logic evaluation
   * @param {import('../../interfaces/coreServices.js').ILogger} logger - Logger for diagnostics
   * @returns {string|null} Resolved entity ID or null if invalid
   * @private
   */
  #resolveEntityRef(ref, context, logger) {
    if (typeof ref === 'string' && ref.trim()) {
      return ref.trim();
    }

    if (typeof ref === 'object' && ref !== null) {
      try {
        const resolved = this.#jsonLogicService.evaluate(ref, context);
        if (typeof resolved === 'string' && resolved.trim()) {
          return resolved.trim();
        }
        // Handle object result with id or entityId property
        if (typeof resolved === 'object' && resolved !== null) {
          const id = resolved.id || resolved.entityId;
          if (typeof id === 'string' && id.trim()) {
            return id.trim();
          }
        }
      } catch (err) {
        logger.warn('MODIFY_PART_HEALTH: Failed to evaluate part_entity_ref', {
          error: err.message,
        });
      }
    }

    return null;
  }

  /**
   * Resolve delta value from number or JSON Logic expression
   *
   * @param {number|object} delta - Delta value
   * @param {object} context - Execution context for JSON Logic evaluation
   * @param {import('../../interfaces/coreServices.js').ILogger} logger - Logger for diagnostics
   * @returns {number} Resolved delta value (NaN if invalid)
   * @private
   */
  #resolveDelta(delta, context, logger) {
    if (typeof delta === 'number') {
      return delta;
    }

    if (typeof delta === 'object' && delta !== null) {
      try {
        const resolved = this.#jsonLogicService.evaluate(delta, context);
        if (typeof resolved === 'number') {
          return resolved;
        }
      } catch (err) {
        logger.warn('MODIFY_PART_HEALTH: Failed to evaluate delta', {
          error: err.message,
        });
      }
    }

    return NaN;
  }

  /**
   * Get part subType from anatomy:part component
   *
   * @param {string} entityId - Entity ID
   * @returns {string} Part subType or 'unknown'
   * @private
   */
  #getPartType(entityId) {
    if (this.#entityManager.hasComponent(entityId, PART_COMPONENT_ID)) {
      const partComponent = this.#entityManager.getComponentData(
        entityId,
        PART_COMPONENT_ID
      );
      return partComponent?.subType || 'unknown';
    }
    return 'unknown';
  }

  /**
   * Get owner entity ID from anatomy:part component
   *
   * @param {string} entityId - Entity ID
   * @returns {string|null} Owner entity ID or null
   * @private
   */
  #getOwnerEntityId(entityId) {
    if (this.#entityManager.hasComponent(entityId, PART_COMPONENT_ID)) {
      const partComponent = this.#entityManager.getComponentData(
        entityId,
        PART_COMPONENT_ID
      );
      return partComponent?.ownerEntityId || null;
    }
    return null;
  }

  /**
   * Validate and normalize parameters for execute.
   *
   * @param {ModifyPartHealthParams|null|undefined} params - Raw params object
   * @param {object} context - Execution context
   * @param {import('../../interfaces/coreServices.js').ILogger} logger - Logger for diagnostics
   * @returns {{partEntityId: string, deltaValue: number, clampToBounds: boolean}|null} Normalized values or null when invalid
   * @private
   */
  #validateParams(params, context, logger) {
    if (!assertParamsObject(params, this.#dispatcher, 'MODIFY_PART_HEALTH')) {
      return null;
    }

    const { part_entity_ref, delta, clamp_to_bounds = true } = params;

    // Resolve part entity ID
    const partEntityId = this.#resolveEntityRef(part_entity_ref, context, logger);
    if (!partEntityId) {
      safeDispatchError(
        this.#dispatcher,
        'MODIFY_PART_HEALTH: part_entity_ref is required and must resolve to a valid entity ID',
        { part_entity_ref },
        logger
      );
      return null;
    }

    // Resolve delta value
    const deltaValue = this.#resolveDelta(delta, context, logger);
    if (typeof deltaValue !== 'number' || isNaN(deltaValue)) {
      safeDispatchError(
        this.#dispatcher,
        'MODIFY_PART_HEALTH: delta is required and must resolve to a valid number',
        { delta },
        logger
      );
      return null;
    }

    return {
      partEntityId,
      deltaValue,
      clampToBounds: clamp_to_bounds !== false,
    };
  }

  /**
   * Execute the modify part health operation
   *
   * @param {ModifyPartHealthParams} params - Operation parameters
   * @param {import('../defs.js').ExecutionContext} executionContext - Execution context
   * @returns {Promise<void>}
   */
  async execute(params, executionContext) {
    const log = this.getLogger(executionContext);

    // Validation
    const validated = this.#validateParams(params, executionContext, log);
    if (!validated) {
      return;
    }

    const { partEntityId, deltaValue, clampToBounds } = validated;

    try {
      // Verify entity has part_health component
      if (!this.#entityManager.hasComponent(partEntityId, PART_HEALTH_COMPONENT_ID)) {
        safeDispatchError(
          this.#dispatcher,
          `MODIFY_PART_HEALTH: Entity does not have ${PART_HEALTH_COMPONENT_ID} component`,
          { partEntityId },
          log
        );
        return;
      }

      // Get current health data
      const healthComponent = this.#entityManager.getComponentData(
        partEntityId,
        PART_HEALTH_COMPONENT_ID
      );

      const previousHealth = healthComponent.currentHealth;
      const maxHealth = healthComponent.maxHealth;
      const previousState = healthComponent.state;
      const previousTurnsInState = healthComponent.turnsInState || 0;

      // Calculate new health
      let newHealth = previousHealth + deltaValue;
      if (clampToBounds) {
        newHealth = Math.max(0, Math.min(newHealth, maxHealth));
      }

      // Calculate new state
      const healthPercentage = (newHealth / maxHealth) * 100;
      const newState = this.#calculateHealthState(healthPercentage);

      // Update turnsInState: increment if same state, reset to 0 if changed
      const turnsInState =
        newState === previousState ? previousTurnsInState + 1 : 0;

      // Update component
      await this.#entityManager.addComponent(
        partEntityId,
        PART_HEALTH_COMPONENT_ID,
        {
          currentHealth: newHealth,
          maxHealth,
          state: newState,
          turnsInState,
        }
      );

      // Get additional context for event
      const partType = this.#getPartType(partEntityId);
      const ownerEntityId = this.#getOwnerEntityId(partEntityId);

      // Dispatch health changed event
      this.#dispatcher.dispatch(PART_HEALTH_CHANGED_EVENT, {
        partEntityId,
        ownerEntityId,
        partType,
        previousHealth,
        newHealth,
        maxHealth,
        healthPercentage,
        previousState,
        newState,
        delta: deltaValue,
        timestamp: Date.now(),
      });

      log.debug(
        `MODIFY_PART_HEALTH: ${partEntityId} health ${previousHealth} -> ${newHealth} (delta: ${deltaValue}, state: ${previousState} -> ${newState})`
      );
    } catch (error) {
      log.error('MODIFY_PART_HEALTH operation failed', error, {
        partEntityId,
      });
      safeDispatchError(
        this.#dispatcher,
        `MODIFY_PART_HEALTH: Operation failed - ${error.message}`,
        { partEntityId, error: error.message },
        log
      );
    }
  }
}

export default ModifyPartHealthHandler;
