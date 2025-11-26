/**
 * @file Handler for DIGEST_FOOD operation
 *
 * Converts stomach buffer content to energy reserve based on conversion rate and efficiency.
 *
 * Operation flow:
 * 1. Validates operation parameters (entity_ref, turns)
 * 2. Resolves entity reference from parameters
 * 3. Retrieves both metabolism:fuel_converter and metabolism:metabolic_store components
 * 4. Calculates digestion amount: min(bufferStorage, conversionRate × activityMultiplier × turns)
 * 5. Calculates energy gained: digestionAmount × efficiency
 * 6. Updates fuel_converter.bufferStorage (reduce by digestion amount)
 * 7. Updates metabolic_store.currentEnergy (cap at maxEnergy)
 * 8. Dispatches metabolism:food_digested event
 *
 * Related files:
 * @see data/schemas/operations/digestFood.schema.json - Operation schema
 * @see src/dependencyInjection/tokens/tokens-core.js - DigestFoodHandler token
 * @see src/dependencyInjection/registrations/operationHandlerRegistrations.js - Handler registration
 * @see src/dependencyInjection/registrations/interpreterRegistrations.js - Operation mapping
 * @see src/utils/preValidationUtils.js - KNOWN_OPERATION_TYPES whitelist
 * @augments BaseOperationHandler
 */

import BaseOperationHandler from './baseOperationHandler.js';
import { assertParamsObject } from '../../utils/handlerUtils/paramsUtils.js';
import { safeDispatchError } from '../../utils/safeDispatchErrorUtils.js';

const FUEL_CONVERTER_COMPONENT_ID = 'metabolism:fuel_converter';
const METABOLIC_STORE_COMPONENT_ID = 'metabolism:metabolic_store';
const FOOD_DIGESTED_EVENT = 'metabolism:food_digested';

/**
 * @typedef {object} DigestFoodParams
 * @property {string} entity_ref - Reference to entity with fuel_converter and metabolic_store components
 * @property {number} [turns=1] - Number of turns to process digestion for (minimum 1)
 */

/**
 * Handler for DIGEST_FOOD operation.
 * Converts fuel buffer content to energy based on conversion rate and efficiency.
 */
class DigestFoodHandler extends BaseOperationHandler {
  /** @type {import('../../entities/entityManager.js').default} */ #entityManager;
  /** @type {import('../../interfaces/ISafeEventDispatcher.js').ISafeEventDispatcher} */ #dispatcher;

  constructor({ logger, entityManager, safeEventDispatcher }) {
    super('DigestFoodHandler', {
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
   * @param {DigestFoodParams|null|undefined} params - Raw params object
   * @param {import('../../interfaces/coreServices.js').ILogger} logger - Logger for diagnostics
   * @returns {{entityId: string, turns: number}|null} Normalized values or null when invalid
   * @private
   */
  #validateParams(params, logger) {
    if (!assertParamsObject(params, this.#dispatcher, 'DIGEST_FOOD')) {
      return null;
    }

    const { entity_ref, turns = 1 } = params;

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
        'DIGEST_FOOD: entity_ref is required and must be a valid string or object',
        { entity_ref },
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
        'DIGEST_FOOD: turns must be a positive integer',
        { turns },
        logger
      );
      return null;
    }

    return {
      entityId,
      turns,
    };
  }

  /**
   * Execute the digest food operation
   *
   * @param {DigestFoodParams} params - Operation parameters
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

    const { entityId, turns } = validated;

    try {
      // Get fuel converter component
      const fuelConverter = this.#entityManager.getComponentData(
        entityId,
        FUEL_CONVERTER_COMPONENT_ID
      );

      if (!fuelConverter) {
        safeDispatchError(
          this.#dispatcher,
          `DIGEST_FOOD: Entity does not have ${FUEL_CONVERTER_COMPONENT_ID} component`,
          { entityId },
          log
        );
        return;
      }

      // Get metabolic store component
      const metabolicStore = this.#entityManager.getComponentData(
        entityId,
        METABOLIC_STORE_COMPONENT_ID
      );

      if (!metabolicStore) {
        safeDispatchError(
          this.#dispatcher,
          `DIGEST_FOOD: Entity does not have ${METABOLIC_STORE_COMPONENT_ID} component`,
          { entityId },
          log
        );
        return;
      }

      // Extract component data (using snake_case to match component schemas)
      // Buffer storage is on metabolic_store, not fuel_converter
      const bufferStorage = metabolicStore.buffer_storage || [];
      // Edge Case 7: Ensure minimum conversion_rate to prevent division by zero
      // Schema requires exclusiveMinimum: 0, but add defensive check for runtime safety
      const conversionRate = Math.max(0.1, fuelConverter.conversion_rate || 0);
      const efficiency = fuelConverter.efficiency || 0;
      const metabolicEfficiencyMultiplier = fuelConverter.metabolic_efficiency_multiplier || 1.0;

      // Log warning if conversion_rate was adjusted
      if (fuelConverter.conversion_rate !== undefined && fuelConverter.conversion_rate <= 0) {
        log.warn('DIGEST_FOOD: conversion_rate was zero or negative, using minimum 0.1', {
          entityId,
          originalRate: fuelConverter.conversion_rate,
          adjustedRate: conversionRate,
        });
      }

      const currentEnergy = metabolicStore.current_energy || 0;
      const maxEnergy = metabolicStore.max_energy;

      // Calculate total bulk in buffer
      const totalBulk = bufferStorage.reduce((sum, item) => sum + (item.bulk || 0), 0);

      // Calculate maximum digestion potential
      const maxDigestion = conversionRate * metabolicEfficiencyMultiplier * turns;

      // Calculate actual digestion (cannot exceed total buffer bulk)
      const actualDigestion = Math.min(totalBulk, maxDigestion);

      // Calculate energy gained from buffer items (based on energy content proportional to bulk digested)
      let energyGained = 0;
      let remainingDigestion = actualDigestion;
      const newBufferStorage = [];

      for (const item of bufferStorage) {
        if (remainingDigestion <= 0) {
          newBufferStorage.push({ ...item });
          continue;
        }

        const itemBulk = item.bulk || 0;
        const itemEnergy = item.energy_content || 0;

        if (itemBulk <= remainingDigestion) {
          // Digest entire item
          energyGained += itemEnergy * efficiency;
          remainingDigestion -= itemBulk;
        } else {
          // Partially digest item
          const digestedFraction = remainingDigestion / itemBulk;
          energyGained += itemEnergy * digestedFraction * efficiency;
          newBufferStorage.push({
            bulk: itemBulk - remainingDigestion,
            energy_content: itemEnergy * (1 - digestedFraction),
          });
          remainingDigestion = 0;
        }
      }

      // Calculate new energy (capped at maxEnergy)
      const newEnergy = Math.min(maxEnergy, currentEnergy + energyGained);

      // Update both components atomically (using snake_case to match schemas)
      await this.#entityManager.batchAddComponentsOptimized(
        [
          {
            instanceId: entityId,
            componentTypeId: FUEL_CONVERTER_COMPONENT_ID,
            componentData: {
              capacity: fuelConverter.capacity,
              conversion_rate: conversionRate,
              efficiency,
              accepted_fuel_tags: fuelConverter.accepted_fuel_tags,
              metabolic_efficiency_multiplier: metabolicEfficiencyMultiplier,
            },
          },
          {
            instanceId: entityId,
            componentTypeId: METABOLIC_STORE_COMPONENT_ID,
            componentData: {
              current_energy: newEnergy,
              max_energy: maxEnergy,
              base_burn_rate: metabolicStore.base_burn_rate,
              activity_multiplier: metabolicStore.activity_multiplier,
              last_update_turn: metabolicStore.last_update_turn,
              buffer_storage: newBufferStorage,
              buffer_capacity: metabolicStore.buffer_capacity,
            },
          },
        ],
        true
      );

      // Dispatch food digested event
      this.#dispatcher.dispatch(FOOD_DIGESTED_EVENT, {
        entityId,
        bufferReduced: actualDigestion,
        energyGained,
        newBuffer: newBufferStorage.reduce((sum, item) => sum + (item.bulk || 0), 0),
        newEnergy,
        efficiency,
      });

      log.debug('Food digested successfully', {
        entityId,
        bufferReduced: actualDigestion,
        energyGained,
        newBuffer: newBufferStorage.reduce((sum, item) => sum + (item.bulk || 0), 0),
        newEnergy,
        efficiency,
        turns,
      });
    } catch (error) {
      log.error('Digest food operation failed', error, {
        entityId,
        turns,
      });
      safeDispatchError(
        this.#dispatcher,
        `DIGEST_FOOD: Operation failed - ${error.message}`,
        { entityId, error: error.message },
        log
      );
    }
  }
}

export default DigestFoodHandler;
