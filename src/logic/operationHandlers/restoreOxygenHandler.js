/**
 * @file Handler for RESTORE_OXYGEN operation
 *
 * Restores oxygen to an entity's respiratory organs. Used by drowning/asphyxiation mechanics.
 * When restoreFull is true, sets current oxygen to oxygenCapacity.
 * Otherwise restores by amount (or the organ's restorationRate if amount is omitted).
 *
 * Operation flow:
 * 1. Validates operation parameters (entityId required, restoreFull/amount optional)
 * 2. Resolves entity reference (string or JSON Logic expression)
 * 3. Finds all respiratory organs belonging to the entity
 * 4. For each organ with breathing-states:respiratory_organ:
 *    - Get current oxygen, capacity, and restoration rate
 *    - Restore to full or by amount (clamped to capacity)
 *    - Update component via addComponent
 *
 * Related files:
 * @see data/schemas/operations/restoreOxygen.schema.json - Operation schema
 * @see data/mods/breathing-states/components/respiratory_organ.component.json - Component definition
 * @see src/dependencyInjection/tokens/tokens-core.js - RestoreOxygenHandler token
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

/**
 * @typedef {object} RestoreOxygenParams
 * @property {string|object} entityId - Reference to entity whose respiratory organs will have oxygen restored
 * @property {boolean} [restoreFull] - When true, restores oxygen to full capacity
 * @property {number} [amount] - Amount of oxygen to restore when not restoring to full capacity
 */

/**
 * Handler for RESTORE_OXYGEN operation.
 * Restores oxygen to all respiratory organs belonging to an entity.
 */
class RestoreOxygenHandler extends BaseOperationHandler {
  /** @type {import('../../entities/entityManager.js').default} */ #entityManager;
  /** @type {import('../../interfaces/ISafeEventDispatcher.js').ISafeEventDispatcher} */
  #dispatcher;
  /** @type {import('../jsonLogicEvaluationService.js').default} */ #jsonLogicService;

  constructor({
    logger,
    entityManager,
    safeEventDispatcher,
    jsonLogicService,
  }) {
    super('RestoreOxygenHandler', {
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
        logger.warn('RESTORE_OXYGEN: Failed to evaluate entityId', {
          error: err.message,
        });
      }
    }

    return null;
  }

  /**
   * Resolve amount value from number or JSON Logic expression
   *
   * @param {number|object|undefined|null} amount - Amount value
   * @param {object} context - Execution context for JSON Logic evaluation
   * @param {import('../../interfaces/coreServices.js').ILogger} logger - Logger for diagnostics
   * @returns {number|null} Resolved amount value or null if not provided/invalid
   * @private
   */
  #resolveAmount(amount, context, logger) {
    if (amount === undefined || amount === null) {
      return null; // Will use restorationRate from component
    }

    if (typeof amount === 'number') {
      return amount;
    }

    if (typeof amount === 'object') {
      try {
        const resolved = this.#jsonLogicService.evaluate(amount, context);
        if (typeof resolved === 'number') {
          return resolved;
        }
      } catch (err) {
        logger.warn('RESTORE_OXYGEN: Failed to evaluate amount', {
          error: err.message,
        });
      }
    }

    return null;
  }

  /**
   * Resolve restoreFull flag from boolean or JSON Logic expression
   *
   * @param {boolean|object|undefined|null} restoreFull - Restore full flag
   * @param {object} context - Execution context for JSON Logic evaluation
   * @param {import('../../interfaces/coreServices.js').ILogger} logger - Logger for diagnostics
   * @returns {boolean|null} Resolved restoreFull value or null if invalid
   * @private
   */
  #resolveRestoreFull(restoreFull, context, logger) {
    if (restoreFull === undefined) {
      return false;
    }

    if (restoreFull === null) {
      return null;
    }

    if (typeof restoreFull === 'boolean') {
      return restoreFull;
    }

    if (typeof restoreFull === 'object') {
      try {
        const resolved = this.#jsonLogicService.evaluate(restoreFull, context);
        if (typeof resolved === 'boolean') {
          return resolved;
        }
      } catch (err) {
        logger.warn('RESTORE_OXYGEN: Failed to evaluate restoreFull', {
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
   * @param {RestoreOxygenParams|null|undefined} params - Raw params object
   * @param {object} context - Execution context
   * @param {import('../../interfaces/coreServices.js').ILogger} logger - Logger for diagnostics
   * @returns {{targetEntityId: string, amountValue: number|null, restoreFullValue: boolean}|null}
   *   Normalized values or null when invalid
   * @private
   */
  #validateParams(params, context, logger) {
    if (!assertParamsObject(params, this.#dispatcher, 'RESTORE_OXYGEN')) {
      return null;
    }

    const { entityId, restoreFull, amount } = params;

    // Resolve target entity ID
    const targetEntityId = this.#resolveEntityRef(entityId, context, logger);
    if (!targetEntityId) {
      safeDispatchError(
        this.#dispatcher,
        'RESTORE_OXYGEN: entityId is required and must resolve to a valid entity ID',
        { entityId },
        logger
      );
      return null;
    }

    // Resolve restoreFull (optional)
    const restoreFullValue = this.#resolveRestoreFull(
      restoreFull,
      context,
      logger
    );
    if (restoreFull !== undefined && restoreFullValue === null) {
      safeDispatchError(
        this.#dispatcher,
        'RESTORE_OXYGEN: restoreFull must be a boolean if provided',
        { restoreFull },
        logger
      );
      return null;
    }

    // Resolve amount (optional)
    const amountValue = this.#resolveAmount(amount, context, logger);
    if (amount !== undefined && amount !== null && amountValue === null) {
      safeDispatchError(
        this.#dispatcher,
        'RESTORE_OXYGEN: amount must be a valid positive integer if provided',
        { amount },
        logger
      );
      return null;
    }

    // Validate amount is positive if provided
    if (amountValue !== null && amountValue < 1) {
      safeDispatchError(
        this.#dispatcher,
        'RESTORE_OXYGEN: amount must be at least 1',
        { amount: amountValue },
        logger
      );
      return null;
    }

    return {
      targetEntityId,
      amountValue,
      restoreFullValue: restoreFullValue ?? false,
    };
  }

  /**
   * Execute the restore oxygen operation
   *
   * @param {RestoreOxygenParams} params - Operation parameters
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

    const { targetEntityId, amountValue, restoreFullValue } = validated;

    try {
      // Find all respiratory organs for the entity
      const organs = this.#findRespiratoryOrgans(targetEntityId);

      if (organs.length === 0) {
        // Graceful handling - entity has no respiratory organs
        log.debug(
          `RESTORE_OXYGEN: Entity ${targetEntityId} has no respiratory organs, skipping`
        );
        return;
      }

      // Restore oxygen for each organ
      for (const { organEntityId, organData } of organs) {
        const currentOxygen = organData.currentOxygen ?? 0;
        const oxygenCapacity = organData.oxygenCapacity ?? 0;
        const restorationRate = organData.restorationRate ?? 1;

        const restoreAmount = restoreFullValue
          ? null
          : amountValue ?? restorationRate;

        const newOxygen = restoreFullValue
          ? oxygenCapacity
          : Math.min(oxygenCapacity, currentOxygen + restoreAmount);

        await this.#entityManager.addComponent(
          organEntityId,
          RESPIRATORY_ORGAN_COMPONENT_ID,
          {
            ...organData,
            currentOxygen: newOxygen,
          }
        );

        log.debug(
          `RESTORE_OXYGEN: ${organEntityId} oxygen ${currentOxygen} -> ${newOxygen}`
        );
      }
    } catch (error) {
      log.error('RESTORE_OXYGEN operation failed', error, {
        targetEntityId,
      });
      safeDispatchError(
        this.#dispatcher,
        `RESTORE_OXYGEN: Operation failed - ${error.message}`,
        { targetEntityId, error: error.message },
        log
      );
    }
  }
}

export default RestoreOxygenHandler;
