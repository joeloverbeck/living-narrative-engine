/**
 * @file Handler for UPDATE_PART_HEALTH_STATE operation
 *
 * Recalculates narrative health state from health percentage and updates the part_health component.
 *
 * Operation flow:
 * 1. Validates operation parameters (part_entity_ref)
 * 2. Resolves entity reference from parameters
 * 3. Retrieves anatomy:part_health component
 * 4. Calculates health percentage: (currentHealth / maxHealth) * 100
 * 5. Maps percentage to health state using thresholds
 * 6. Updates turnsInState (increment if same state, reset to 0 if changed)
 * 7. Updates part_health component via batchAddComponentsOptimized
 * 8. Dispatches anatomy:part_state_changed event if state changed
 *
 * State thresholds:
 * - healthy: >75%
 * - bruised: 51-75%
 * - wounded: 26-50%
 * - badly_damaged: 1-25%
 * - destroyed: 0%
 *
 * Related files:
 * @see data/schemas/operations/updatePartHealthState.schema.json - Operation schema
 * @see data/mods/anatomy/components/part_health.component.json - Component definition
 * @see src/dependencyInjection/tokens/tokens-core.js - UpdatePartHealthStateHandler token
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
const PART_STATE_CHANGED_EVENT = 'anatomy:part_state_changed';

/**
 * @typedef {object} UpdatePartHealthStateParams
 * @property {string|object} part_entity_ref - Reference to body part entity with part_health component
 */

/**
 * Handler for UPDATE_PART_HEALTH_STATE operation.
 * Calculates and updates health state based on health percentage.
 */
class UpdatePartHealthStateHandler extends BaseOperationHandler {
  /** @type {import('../../entities/entityManager.js').default} */ #entityManager;
  /** @type {import('../../interfaces/ISafeEventDispatcher.js').ISafeEventDispatcher} */ #dispatcher;

  constructor({ logger, entityManager, safeEventDispatcher }) {
    super('UpdatePartHealthStateHandler', {
      logger: { value: logger },
      entityManager: {
        value: entityManager,
        requiredMethods: ['getComponentData', 'batchAddComponentsOptimized'],
      },
      safeEventDispatcher: {
        value: safeEventDispatcher,
        requiredMethods: ['dispatch'],
      },
    });
    this.#entityManager = entityManager;
    this.#dispatcher = safeEventDispatcher;
  }

  /**
   * Calculate health state from percentage
   *
   * @param {number} healthPercentage - Current health as percentage of maximum (0-100)
   * @returns {string} Health state: healthy, bruised, wounded, badly_damaged, or destroyed
   * @private
   */
  #calculateState(healthPercentage) {
    if (healthPercentage > 75) return 'healthy';
    if (healthPercentage > 50) return 'bruised';
    if (healthPercentage > 25) return 'wounded';
    if (healthPercentage > 0) return 'badly_damaged';
    return 'destroyed';
  }

  /**
   * Determine if state change is deterioration (worse health)
   *
   * @param {string} previousState - Previous health state
   * @param {string} newState - New health state
   * @returns {boolean} True if health worsened
   * @private
   */
  #isDeterioration(previousState, newState) {
    const stateOrder = [
      'healthy',
      'bruised',
      'wounded',
      'badly_damaged',
      'destroyed',
    ];
    return stateOrder.indexOf(newState) > stateOrder.indexOf(previousState);
  }

  /**
   * Validate and normalize parameters for execute.
   *
   * @param {UpdatePartHealthStateParams|null|undefined} params - Raw params object
   * @param {import('../../interfaces/coreServices.js').ILogger} logger - Logger for diagnostics
   * @returns {{partEntityId: string}|null} Normalized values or null when invalid
   * @private
   */
  #validateParams(params, logger) {
    if (
      !assertParamsObject(params, this.#dispatcher, 'UPDATE_PART_HEALTH_STATE')
    ) {
      return null;
    }

    const { part_entity_ref } = params;

    // Validate entity reference
    let partEntityId;
    if (typeof part_entity_ref === 'string' && part_entity_ref.trim()) {
      partEntityId = part_entity_ref.trim();
    } else if (typeof part_entity_ref === 'object' && part_entity_ref !== null) {
      // Handle object references (e.g., from scope resolution)
      partEntityId = part_entity_ref.id || part_entity_ref.entityId;
    }

    if (!partEntityId) {
      safeDispatchError(
        this.#dispatcher,
        'UPDATE_PART_HEALTH_STATE: part_entity_ref is required and must be a valid string or object',
        { part_entity_ref },
        logger
      );
      return null;
    }

    return { partEntityId };
  }

  /**
   * Execute the update part health state operation
   *
   * @param {UpdatePartHealthStateParams} params - Operation parameters
   * @param {import('../defs.js').ExecutionContext} executionContext - Execution context
   * @returns {Promise<void>}
   */
  async execute(params, executionContext) {
    const log = this.getLogger(executionContext);

    // Validation
    const validated = this.#validateParams(params, log);
    if (!validated) {
      return;
    }

    const { partEntityId } = validated;

    try {
      // Get part_health component
      const partHealth = this.#entityManager.getComponentData(
        partEntityId,
        PART_HEALTH_COMPONENT_ID
      );

      if (!partHealth) {
        safeDispatchError(
          this.#dispatcher,
          `UPDATE_PART_HEALTH_STATE: Entity does not have ${PART_HEALTH_COMPONENT_ID} component`,
          { partEntityId },
          log
        );
        return;
      }

      // Extract health data
      const { currentHealth, maxHealth, state: previousState } = partHealth;
      const turnsInState = partHealth.turnsInState || 0;

      // Calculate health percentage
      const healthPercentage = (currentHealth / maxHealth) * 100;

      // Calculate new health state
      const newState = this.#calculateState(healthPercentage);

      // Update turnsInState: increment if same state, reset to 0 if changed
      const newTurnsInState =
        newState === previousState ? turnsInState + 1 : 0;

      // Update part_health component
      await this.#entityManager.batchAddComponentsOptimized(
        [
          {
            instanceId: partEntityId,
            componentTypeId: PART_HEALTH_COMPONENT_ID,
            componentData: {
              currentHealth,
              maxHealth,
              state: newState,
              turnsInState: newTurnsInState,
            },
          },
        ],
        true
      );

      // Dispatch state change event if state changed
      if (newState !== previousState) {
        // Get owner info from anatomy:part component if available
        const partComponent = this.#entityManager.getComponentData(
          partEntityId,
          PART_COMPONENT_ID
        );
        const ownerEntityId = partComponent?.ownerEntityId || null;
        const partType = partComponent?.subType || 'unknown';

        this.#dispatcher.dispatch(PART_STATE_CHANGED_EVENT, {
          partEntityId,
          ownerEntityId,
          partType,
          previousState,
          newState,
          turnsInPreviousState: turnsInState,
          healthPercentage,
          isDeterioration: this.#isDeterioration(previousState, newState),
          timestamp: Date.now(),
        });

        log.debug('Part health state changed', {
          partEntityId,
          previousState,
          newState,
          healthPercentage,
          turnsInState: newTurnsInState,
        });
      } else {
        log.debug('Part health state unchanged', {
          partEntityId,
          state: newState,
          healthPercentage,
          turnsInState: newTurnsInState,
        });
      }
    } catch (error) {
      log.error('Update part health state operation failed', error, {
        partEntityId,
      });
      safeDispatchError(
        this.#dispatcher,
        `UPDATE_PART_HEALTH_STATE: Operation failed - ${error.message}`,
        { partEntityId, error: error.message },
        log
      );
    }
  }
}

export default UpdatePartHealthStateHandler;
