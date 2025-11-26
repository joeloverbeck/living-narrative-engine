/**
 * @file Handler for UPDATE_HUNGER_STATE operation
 *
 * Calculates hunger state from energy percentage thresholds and updates the hunger_state component.
 *
 * Operation flow:
 * 1. Validates operation parameters (entity_ref)
 * 2. Resolves entity reference from parameters
 * 3. Retrieves both metabolism:metabolic_store and metabolism:hunger_state components
 * 4. Calculates energy percentage: (currentEnergy / maxEnergy) * 100
 * 5. Maps percentage to hunger state using thresholds
 * 6. Updates turnsInState (increment if same state, reset to 0 if changed)
 * 7. Updates hunger_state component via batchAddComponentsOptimized
 * 8. Dispatches metabolism:hunger_state_changed event if state changed
 *
 * State thresholds:
 * - gluttonous: >100%
 * - satiated: 75-100%
 * - neutral: 30-75%
 * - hungry: 10-30%
 * - starving: 0.1-10%
 * - critical: ≤0%
 *
 * Related files:
 * @see data/schemas/operations/updateHungerState.schema.json - Operation schema
 * @see data/mods/metabolism/components/hunger_state.component.json - Component definition
 * @see src/dependencyInjection/tokens/tokens-core.js - UpdateHungerStateHandler token
 * @see src/dependencyInjection/registrations/operationHandlerRegistrations.js - Handler registration
 * @see src/dependencyInjection/registrations/interpreterRegistrations.js - Operation mapping
 * @see src/utils/preValidationUtils.js - KNOWN_OPERATION_TYPES whitelist
 * @augments BaseOperationHandler
 */

import BaseOperationHandler from './baseOperationHandler.js';
import { assertParamsObject } from '../../utils/handlerUtils/paramsUtils.js';
import { safeDispatchError } from '../../utils/safeDispatchErrorUtils.js';

const METABOLIC_STORE_COMPONENT_ID = 'metabolism:metabolic_store';
const HUNGER_STATE_COMPONENT_ID = 'metabolism:hunger_state';
const HUNGER_STATE_CHANGED_EVENT = 'metabolism:hunger_state_changed';

/**
 * @typedef {object} UpdateHungerStateParams
 * @property {string|object} entity_ref - Reference to entity with hunger_state and metabolic_store components
 */

/**
 * Handler for UPDATE_HUNGER_STATE operation.
 * Calculates and updates hunger state based on energy percentage.
 */
class UpdateHungerStateHandler extends BaseOperationHandler {
  /** @type {import('../../entities/entityManager.js').default} */ #entityManager;
  /** @type {import('../../interfaces/ISafeEventDispatcher.js').ISafeEventDispatcher} */ #dispatcher;

  constructor({ logger, entityManager, safeEventDispatcher }) {
    super('UpdateHungerStateHandler', {
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
   * Calculate hunger state from energy percentage
   *
   * @param {number} energyPercentage - Current energy as percentage of maximum (0-100+)
   * @returns {string} Hunger state: gluttonous, satiated, neutral, hungry, starving, or critical
   * @private
   */
  #calculateHungerState(energyPercentage) {
    if (energyPercentage > 100) return 'gluttonous';
    if (energyPercentage >= 75) return 'satiated';
    if (energyPercentage >= 30) return 'neutral';
    if (energyPercentage >= 10) return 'hungry';
    if (energyPercentage > 0) return 'starving';
    return 'critical';
  }

  /**
   * Validate and normalize parameters for execute.
   *
   * @param {UpdateHungerStateParams|null|undefined} params - Raw params object
   * @param {import('../../interfaces/coreServices.js').ILogger} logger - Logger for diagnostics
   * @returns {{entityId: string}|null} Normalized values or null when invalid
   * @private
   */
  #validateParams(params, logger) {
    if (!assertParamsObject(params, this.#dispatcher, 'UPDATE_HUNGER_STATE')) {
      return null;
    }

    const { entity_ref } = params;

    // Validate entity reference
    let entityId;
    if (typeof entity_ref === 'string' && entity_ref.trim()) {
      entityId = entity_ref.trim();
    } else if (typeof entity_ref === 'object' && entity_ref !== null) {
      // Handle object references (e.g., from scope resolution)
      entityId = entity_ref.id || entity_ref.entityId;
    }

    if (!entityId) {
      safeDispatchError(
        this.#dispatcher,
        'UPDATE_HUNGER_STATE: entity_ref is required and must be a valid string or object',
        { entity_ref },
        logger
      );
      return null;
    }

    return {
      entityId,
    };
  }

  /**
   * Execute the update hunger state operation
   *
   * @param {UpdateHungerStateParams} params - Operation parameters
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

    const { entityId } = validated;

    try {
      // Get metabolic store component
      const metabolicStore = this.#entityManager.getComponentData(
        entityId,
        METABOLIC_STORE_COMPONENT_ID
      );

      if (!metabolicStore) {
        safeDispatchError(
          this.#dispatcher,
          `UPDATE_HUNGER_STATE: Entity does not have ${METABOLIC_STORE_COMPONENT_ID} component`,
          { entityId },
          log
        );
        return;
      }

      // Get hunger state component
      const hungerState = this.#entityManager.getComponentData(
        entityId,
        HUNGER_STATE_COMPONENT_ID
      );

      if (!hungerState) {
        safeDispatchError(
          this.#dispatcher,
          `UPDATE_HUNGER_STATE: Entity does not have ${HUNGER_STATE_COMPONENT_ID} component`,
          { entityId },
          log
        );
        return;
      }

      // Extract metabolic data (using snake_case to match metabolic_store schema)
      const currentEnergy = metabolicStore.current_energy || 0;
      const maxEnergy = metabolicStore.max_energy;

      // Calculate energy percentage
      const energyPercentage = (currentEnergy / maxEnergy) * 100;

      // Calculate new hunger state
      const newState = this.#calculateHungerState(energyPercentage);
      const previousState = hungerState.state;

      // Update turnsInState: increment if same state, reset to 0 if changed
      // hunger_state schema uses camelCase (energyPercentage, turnsInState, starvationDamage)
      const turnsInState =
        newState === previousState ? hungerState.turnsInState + 1 : 0;

      // Update hunger state component (using camelCase to match hunger_state schema)
      await this.#entityManager.batchAddComponentsOptimized(
        [
          {
            instanceId: entityId,
            componentTypeId: HUNGER_STATE_COMPONENT_ID,
            componentData: {
              state: newState,
              energyPercentage,
              turnsInState,
              starvationDamage: hungerState.starvationDamage || 0,
            },
          },
        ],
        true
      );

      // Dispatch state change event if state changed
      if (newState !== previousState) {
        this.#dispatcher.dispatch(HUNGER_STATE_CHANGED_EVENT, {
          entityId,
          previousState,
          newState,
          energyPercentage,
          turnsInPreviousState: hungerState.turnsInState,
        });

        log.debug('Hunger state changed', {
          entityId,
          previousState,
          newState,
          energyPercentage,
          turnsInState,
        });
      } else {
        log.debug('Hunger state unchanged', {
          entityId,
          state: newState,
          energyPercentage,
          turnsInState,
        });
      }
    } catch (error) {
      log.error('Update hunger state operation failed', error, {
        entityId,
      });
      safeDispatchError(
        this.#dispatcher,
        `UPDATE_HUNGER_STATE: Operation failed - ${error.message}`,
        { entityId, error: error.message },
        log
      );
    }
  }
}

export default UpdateHungerStateHandler;
