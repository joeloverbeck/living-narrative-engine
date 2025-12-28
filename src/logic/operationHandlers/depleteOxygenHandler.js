/**
 * @file Handler for DEPLETE_OXYGEN operation
 *
 * Depletes oxygen from an entity's respiratory organs. Used by drowning/asphyxiation mechanics.
 * When oxygen reaches zero across all respiratory organs, dispatches an oxygen_depleted event.
 *
 * Operation flow:
 * 1. Validates operation parameters (entityId required, amount optional)
 * 2. Resolves entity reference (string or JSON Logic expression)
 * 3. Finds all respiratory organs belonging to the entity
 * 4. For each organ with breathing-states:respiratory_organ:
 *    - Get current oxygen and depletion rate
 *    - Deplete by amount (or use depletionRate if amount not specified)
 *    - Clamp to 0 minimum
 *    - Update component via addComponent
 * 5. Calculate total oxygen remaining across all organs
 * 6. If total oxygen = 0, dispatch breathing-states:oxygen_depleted event
 *
 * Related files:
 * @see data/schemas/operations/depleteOxygen.schema.json - Operation schema
 * @see data/mods/breathing-states/components/respiratory_organ.component.json - Component definition
 * @see src/dependencyInjection/tokens/tokens-core.js - DepleteOxygenHandler token
 * @see src/dependencyInjection/registrations/operationHandlerRegistrations.js - Handler registration
 * @see src/dependencyInjection/registrations/interpreterRegistrations.js - Operation mapping
 * @augments BaseOperationHandler
 */

import BaseOperationHandler from './baseOperationHandler.js';
import { assertParamsObject } from '../../utils/handlerUtils/paramsUtils.js';
import { safeDispatchError } from '../../utils/safeDispatchErrorUtils.js';
import { resolveEntityId } from '../../utils/entityRefUtils.js';
import {
  RESPIRATORY_ORGAN_COMPONENT_ID,
  ANATOMY_PART_COMPONENT_ID as PART_COMPONENT_ID,
} from '../../constants/componentIds.js';
import { OXYGEN_DEPLETED_EVENT_ID as OXYGEN_DEPLETED_EVENT } from '../../constants/eventIds.js';

/**
 * @typedef {object} DepleteOxygenParams
 * @property {string|object} entityId - Reference to entity whose respiratory organs will have oxygen depleted
 * @property {number} [amount] - Amount of oxygen to deplete. If omitted, uses respiratory organ's depletionRate.
 */

/**
 * Handler for DEPLETE_OXYGEN operation.
 * Depletes oxygen from all respiratory organs belonging to an entity.
 */
class DepleteOxygenHandler extends BaseOperationHandler {
  /** @type {import('../../entities/entityManager.js').default} */ #entityManager;
  /** @type {import('../../interfaces/ISafeEventDispatcher.js').ISafeEventDispatcher} */ #dispatcher;
  /** @type {import('../jsonLogicEvaluationService.js').default} */ #jsonLogicService;

  constructor({
    logger,
    entityManager,
    safeEventDispatcher,
    jsonLogicService,
  }) {
    super('DepleteOxygenHandler', {
      logger: { value: logger },
      entityManager: {
        value: entityManager,
        requiredMethods: [
          'getComponentData',
          'addComponent',
          'hasComponent',
          'getEntitiesWithComponent',
        ],
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
   * Resolve entity reference from string or JSON Logic expression
   *
   * @param {string|object} ref - Entity reference
   * @param {object} context - Execution context for JSON Logic evaluation
   * @param {import('../../interfaces/coreServices.js').ILogger} logger - Logger for diagnostics
   * @returns {string|null} Resolved entity ID or null if invalid
   * @private
   */
  #resolveEntityRef(ref, context, logger) {
    // First try resolveEntityId for placeholder/keyword support (e.g., "secondary", "actor")
    const resolvedId = resolveEntityId(ref, context);
    if (resolvedId) {
      return resolvedId;
    }

    // Fall back to JSON Logic evaluation for object refs
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
        logger.warn('DEPLETE_OXYGEN: Failed to evaluate entityId', {
          error: err.message,
        });
      }
    }

    return null;
  }

  /**
   * Resolve amount value from number or JSON Logic expression
   *
   * @param {number|object|undefined} amount - Amount value
   * @param {object} context - Execution context for JSON Logic evaluation
   * @param {import('../../interfaces/coreServices.js').ILogger} logger - Logger for diagnostics
   * @returns {number|null} Resolved amount value or null if not provided/invalid
   * @private
   */
  #resolveAmount(amount, context, logger) {
    if (amount === undefined || amount === null) {
      return null; // Will use depletionRate from component
    }

    if (typeof amount === 'number') {
      return amount;
    }

    if (typeof amount === 'object' && amount !== null) {
      try {
        const resolved = this.#jsonLogicService.evaluate(amount, context);
        if (typeof resolved === 'number') {
          return resolved;
        }
      } catch (err) {
        logger.warn('DEPLETE_OXYGEN: Failed to evaluate amount', {
          error: err.message,
        });
      }
    }

    return null;
  }

  /**
   * Find all respiratory organs belonging to an entity
   *
   * @param {string} targetEntityId - Entity ID to find organs for
   * @returns {Array<{organEntityId: string, organData: object}>} Array of organ info
   * @private
   */
  #findRespiratoryOrgans(targetEntityId) {
    const organs = [];

    // Get all entities with respiratory_organ component
    const entitiesWithOrgan = this.#entityManager.getEntitiesWithComponent(
      RESPIRATORY_ORGAN_COMPONENT_ID
    );

    for (const entity of entitiesWithOrgan) {
      const organEntityId = entity.id;

      // Check if this organ belongs to the target entity via anatomy:part component
      if (this.#entityManager.hasComponent(organEntityId, PART_COMPONENT_ID)) {
        const partComponent = this.#entityManager.getComponentData(
          organEntityId,
          PART_COMPONENT_ID
        );

        if (partComponent?.ownerEntityId === targetEntityId) {
          const organData = this.#entityManager.getComponentData(
            organEntityId,
            RESPIRATORY_ORGAN_COMPONENT_ID
          );

          if (organData) {
            organs.push({ organEntityId, organData });
          }
        }
      }
    }

    return organs;
  }

  /**
   * Validate and normalize parameters for execute.
   *
   * @param {DepleteOxygenParams|null|undefined} params - Raw params object
   * @param {object} context - Execution context
   * @param {import('../../interfaces/coreServices.js').ILogger} logger - Logger for diagnostics
   * @returns {{targetEntityId: string, amountValue: number|null}|null} Normalized values or null when invalid
   * @private
   */
  #validateParams(params, context, logger) {
    if (!assertParamsObject(params, this.#dispatcher, 'DEPLETE_OXYGEN')) {
      return null;
    }

    const { entityId, amount } = params;

    // Resolve target entity ID
    const targetEntityId = this.#resolveEntityRef(entityId, context, logger);
    if (!targetEntityId) {
      safeDispatchError(
        this.#dispatcher,
        'DEPLETE_OXYGEN: entityId is required and must resolve to a valid entity ID',
        { entityId },
        logger
      );
      return null;
    }

    // Resolve amount (optional - may be null)
    const amountValue = this.#resolveAmount(amount, context, logger);
    if (amount !== undefined && amount !== null && amountValue === null) {
      safeDispatchError(
        this.#dispatcher,
        'DEPLETE_OXYGEN: amount must be a valid positive integer if provided',
        { amount },
        logger
      );
      return null;
    }

    // Validate amount is positive if provided
    if (amountValue !== null && amountValue < 1) {
      safeDispatchError(
        this.#dispatcher,
        'DEPLETE_OXYGEN: amount must be at least 1',
        { amount: amountValue },
        logger
      );
      return null;
    }

    return {
      targetEntityId,
      amountValue,
    };
  }

  /**
   * Execute the deplete oxygen operation
   *
   * @param {DepleteOxygenParams} params - Operation parameters
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

    const { targetEntityId, amountValue } = validated;

    try {
      // Find all respiratory organs for the entity
      const organs = this.#findRespiratoryOrgans(targetEntityId);

      if (organs.length === 0) {
        // Graceful handling - entity has no respiratory organs
        log.debug(
          `DEPLETE_OXYGEN: Entity ${targetEntityId} has no respiratory organs, skipping`
        );
        return;
      }

      let totalOxygenRemaining = 0;
      const depletionResults = [];

      // Deplete oxygen from each organ
      for (const { organEntityId, organData } of organs) {
        const currentOxygen = organData.currentOxygen ?? 0;
        const oxygenCapacity = organData.oxygenCapacity ?? 0;
        const depletionRate = organData.depletionRate ?? 1;

        // Use provided amount or fall back to organ's depletionRate
        const depleteAmount = amountValue ?? depletionRate;

        // Calculate new oxygen level (clamped to 0 minimum)
        const previousOxygen = currentOxygen;
        const newOxygen = Math.max(0, currentOxygen - depleteAmount);

        // Update the component
        await this.#entityManager.addComponent(
          organEntityId,
          RESPIRATORY_ORGAN_COMPONENT_ID,
          {
            ...organData,
            currentOxygen: newOxygen,
          }
        );

        totalOxygenRemaining += newOxygen;

        depletionResults.push({
          organEntityId,
          previousOxygen,
          newOxygen,
          depleteAmount,
          oxygenCapacity,
        });

        log.debug(
          `DEPLETE_OXYGEN: ${organEntityId} oxygen ${previousOxygen} -> ${newOxygen} (depleted: ${depleteAmount})`
        );
      }

      // If total oxygen is now zero, dispatch oxygen_depleted event
      if (totalOxygenRemaining === 0) {
        this.#dispatcher.dispatch(OXYGEN_DEPLETED_EVENT, {
          entityId: targetEntityId,
          organCount: organs.length,
          depletionResults,
          timestamp: Date.now(),
        });

        log.debug(
          `DEPLETE_OXYGEN: Entity ${targetEntityId} oxygen depleted across all ${organs.length} organs`
        );
      }
    } catch (error) {
      log.error('DEPLETE_OXYGEN operation failed', error, {
        targetEntityId,
      });
      safeDispatchError(
        this.#dispatcher,
        `DEPLETE_OXYGEN: Operation failed - ${error.message}`,
        { targetEntityId, error: error.message },
        log
      );
    }
  }
}

export default DepleteOxygenHandler;
