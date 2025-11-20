/**
 * @file Handler for BURN_ENERGY operation
 *
 * Calculates and subtracts energy from an entity's metabolic store based on base burn rate and activity multiplier.
 *
 * Operation flow:
 * 1. Validates operation parameters (entity_ref, activity_multiplier, turns)
 * 2. Resolves entity reference from parameters
 * 3. Retrieves metabolism:metabolic_store component
 * 4. Calculates energy burned: baseBurnRate × activity_multiplier × turns
 * 5. Updates current energy, clamping to minimum 0
 * 6. Updates metabolic_store component via entityManager
 * 7. Dispatches metabolism:energy_burned event
 *
 * Related files:
 * @see data/schemas/operations/burnEnergy.schema.json - Operation schema
 * @see src/dependencyInjection/tokens/tokens-core.js - BurnEnergyHandler token
 * @see src/dependencyInjection/registrations/operationHandlerRegistrations.js - Handler registration
 * @see src/dependencyInjection/registrations/interpreterRegistrations.js - Operation mapping
 * @see src/utils/preValidationUtils.js - KNOWN_OPERATION_TYPES whitelist
 * @augments BaseOperationHandler
 */

import BaseOperationHandler from './baseOperationHandler.js';
import { assertParamsObject } from '../../utils/handlerUtils/paramsUtils.js';
import { safeDispatchError } from '../../utils/safeDispatchErrorUtils.js';

const METABOLIC_STORE_COMPONENT_ID = 'metabolism:metabolic_store';
const ENERGY_BURNED_EVENT = 'metabolism:energy_burned';

/**
 * @typedef {object} BurnEnergyParams
 * @property {string} entity_ref - Reference to entity with metabolic_store component
 * @property {number} [activity_multiplier=1.0] - Multiplier for base burn rate (minimum 0)
 * @property {number} [turns=1] - Number of turns to calculate burn for (minimum 1)
 */

/**
 * Handler for BURN_ENERGY operation.
 * Burns energy from an entity's metabolic store based on activity level.
 */
class BurnEnergyHandler extends BaseOperationHandler {
  /** @type {import('../../entities/entityManager.js').default} */ #entityManager;
  /** @type {import('../../interfaces/ISafeEventDispatcher.js').ISafeEventDispatcher} */ #dispatcher;

  constructor({ logger, entityManager, safeEventDispatcher }) {
    super('BurnEnergyHandler', {
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
   * Validate and normalize parameters for execute.
   *
   * @param {BurnEnergyParams|null|undefined} params - Raw params object
   * @param {import('../../interfaces/coreServices.js').ILogger} logger - Logger for diagnostics
   * @returns {{entityId: string, activityMultiplier: number, turns: number}|null} Normalized values or null when invalid
   * @private
   */
  #validateParams(params, logger) {
    if (!assertParamsObject(params, this.#dispatcher, 'BURN_ENERGY')) {
      return null;
    }

    const { entity_ref, activity_multiplier = 1.0, turns = 1 } = params;

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
        'BURN_ENERGY: entity_ref is required and must be a valid string or object',
        { entity_ref },
        logger
      );
      return null;
    }

    // Validate activity_multiplier
    if (typeof activity_multiplier !== 'number' || activity_multiplier < 0) {
      safeDispatchError(
        this.#dispatcher,
        'BURN_ENERGY: activity_multiplier must be a non-negative number',
        { activity_multiplier },
        logger
      );
      return null;
    }

    // Validate turns
    if (
      typeof turns !== 'number' ||
      !Number.isInteger(turns) ||
      turns < 1
    ) {
      safeDispatchError(
        this.#dispatcher,
        'BURN_ENERGY: turns must be a positive integer',
        { turns },
        logger
      );
      return null;
    }

    return {
      entityId,
      activityMultiplier: activity_multiplier,
      turns,
    };
  }

  /**
   * Execute the burn energy operation
   *
   * @param {BurnEnergyParams} params - Operation parameters
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

    const { entityId, activityMultiplier, turns } = validated;

    try {
      // Get metabolic store component
      const metabolicStore = this.#entityManager.getComponentData(
        entityId,
        METABOLIC_STORE_COMPONENT_ID
      );

      if (!metabolicStore) {
        safeDispatchError(
          this.#dispatcher,
          `BURN_ENERGY: Entity does not have ${METABOLIC_STORE_COMPONENT_ID} component`,
          { entityId },
          log
        );
        return;
      }

      // Extract metabolic data
      const currentEnergy = metabolicStore.currentEnergy || 0;
      const baseBurnRate = metabolicStore.baseBurnRate || 0;
      const maxEnergy = metabolicStore.maxEnergy;

      // Calculate energy burned
      const energyBurned = baseBurnRate * activityMultiplier * turns;

      // Calculate new energy, clamped to minimum 0
      const newEnergy = Math.max(0, currentEnergy - energyBurned);

      // Update metabolic store component
      await this.#entityManager.batchAddComponentsOptimized(
        [
          {
            instanceId: entityId,
            componentTypeId: METABOLIC_STORE_COMPONENT_ID,
            componentData: {
              currentEnergy: newEnergy,
              maxEnergy,
              baseBurnRate,
              activityMultiplier: metabolicStore.activityMultiplier,
              lastUpdateTurn: metabolicStore.lastUpdateTurn,
            },
          },
        ],
        true
      );

      // Dispatch energy burned event
      this.#dispatcher.dispatch(ENERGY_BURNED_EVENT, {
        entityId,
        energyBurned,
        newEnergy,
        activityMultiplier,
        turns,
      });

      log.debug('Energy burned successfully', {
        entityId,
        energyBurned,
        newEnergy,
        activityMultiplier,
        turns,
      });
    } catch (error) {
      log.error('Burn energy operation failed', error, {
        entityId,
        activityMultiplier,
        turns,
      });
      safeDispatchError(
        this.#dispatcher,
        `BURN_ENERGY: Operation failed - ${error.message}`,
        { entityId, error: error.message },
        log
      );
    }
  }
}

export default BurnEnergyHandler;
