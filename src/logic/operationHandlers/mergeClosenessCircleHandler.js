/**
 * @file Handler for MERGE_CLOSENESS_CIRCLE operation
 *
 * Merges two separate closeness circles into a single unified circle, updating all affected
 * entities so each has all other members as partners.
 *
 * Operation flow:
 * 1. Validate parameters (actor_id, target_id, optional result_variable)
 * 2. Retrieve closeness components for both actor and target
 * 3. Merge partner lists using closeness circle service
 * 4. Update closeness component for all members with complete merged partner list
 * 5. Store merged member IDs in result variable if requested
 *
 * Related files:
 * @see data/schemas/operations/mergeClosenessCircle.schema.json - Operation schema
 * @see src/dependencyInjection/tokens/tokens-core.js - MergeClosenessCircleHandler token
 * @see src/dependencyInjection/registrations/operationHandlerRegistrations.js - Handler registration
 * @see src/dependencyInjection/registrations/interpreterRegistrations.js - Operation mapping
 * @see src/utils/preValidationUtils.js - KNOWN_OPERATION_TYPES whitelist
 * @augments BaseOperationHandler
 */

/** @typedef {import('../../interfaces/coreServices.js').ILogger} ILogger */
/** @typedef {import('../../entities/entityManager.js').default} EntityManager */
/** @typedef {import('../defs.js').ExecutionContext} ExecutionContext */
/** @typedef {import('../../interfaces/ISafeEventDispatcher.js').ISafeEventDispatcher} ISafeEventDispatcher */

import BaseOperationHandler from './baseOperationHandler.js';
import { tryWriteContextVariable } from '../../utils/contextVariableUtils.js';
import { safeDispatchError } from '../../utils/safeDispatchErrorUtils.js';
import { ensureEvaluationContext } from '../../utils/evaluationContextUtils.js';

/**
 * @class MergeClosenessCircleHandler
 * @description Handles the MERGE_CLOSENESS_CIRCLE operation.
 */
class MergeClosenessCircleHandler extends BaseOperationHandler {
  /** @type {EntityManager} */
  #entityManager;
  /** @type {ISafeEventDispatcher} */
  #dispatcher;
  /** @type {object} */
  #closenessCircleService;

  /**
   * @param {object} deps - Constructor dependencies.
   * @param {ILogger} deps.logger - Logging service.
   * @param {EntityManager} deps.entityManager - Entity manager.
   * @param {ISafeEventDispatcher} deps.safeEventDispatcher - Error dispatcher.
   * @param {object} deps.closenessCircleService - Closeness circle service.
   */
  constructor({
    logger,
    entityManager,
    safeEventDispatcher,
    closenessCircleService,
  }) {
    super('MergeClosenessCircleHandler', {
      logger: { value: logger },
      entityManager: {
        value: entityManager,
        requiredMethods: ['getComponentData', 'addComponent'],
      },
      safeEventDispatcher: {
        value: safeEventDispatcher,
        requiredMethods: ['dispatch'],
      },
      closenessCircleService: {
        value: closenessCircleService,
        requiredMethods: ['merge'],
      },
    });
    this.#entityManager = entityManager;
    this.#dispatcher = safeEventDispatcher;
    this.#closenessCircleService = closenessCircleService;
  }

  /**
   * Validate parameters for execute.
   *
   * @param {object} params
   * @param {ExecutionContext} executionContext
   * @returns {{ actorId:string, targetId:string, resultVar:string|null, logger:ILogger }|null}
   * @private
   */
  #validateParams(params, executionContext) {
    const { actor_id, target_id, result_variable } = params || {};
    const log = this.getLogger(executionContext);
    if (typeof actor_id !== 'string' || !actor_id.trim()) {
      safeDispatchError(
        this.#dispatcher,
        'MERGE_CLOSENESS_CIRCLE: invalid "actor_id"',
        { params },
        log
      );
      return null;
    }
    if (typeof target_id !== 'string' || !target_id.trim()) {
      safeDispatchError(
        this.#dispatcher,
        'MERGE_CLOSENESS_CIRCLE: invalid "target_id"',
        { params },
        log
      );
      return null;
    }
    if (
      result_variable !== undefined &&
      (typeof result_variable !== 'string' || !result_variable.trim())
    ) {
      safeDispatchError(
        this.#dispatcher,
        'MERGE_CLOSENESS_CIRCLE: "result_variable" must be a non-empty string when provided.',
        { params },
        log
      );
      return null;
    }
    return {
      actorId: actor_id.trim(),
      targetId: target_id.trim(),
      resultVar:
        typeof result_variable === 'string' ? result_variable.trim() : null,
      logger: log,
    };
  }

  /**
   * Update partner lists for merged circle.
   *
   * @param {string} actorId
   * @param {string} targetId
   * @returns {Promise<string[]>}
   * @private
   */
  async #updatePartners(actorId, targetId) {
    const actorComp = this.#entityManager.getComponentData(
      actorId,
      'positioning:closeness'
    );
    const targetComp = this.#entityManager.getComponentData(
      targetId,
      'positioning:closeness'
    );
    const mergedMemberIds = this.#closenessCircleService.merge(
      [actorId, targetId],
      Array.isArray(actorComp?.partners) ? actorComp.partners : [],
      Array.isArray(targetComp?.partners) ? targetComp.partners : []
    );
    for (const id of mergedMemberIds) {
      const partners = mergedMemberIds.filter((p) => p !== id);
      try {
        await this.#entityManager.addComponent(id, 'positioning:closeness', {
          partners,
        });
      } catch (err) {
        safeDispatchError(
          this.#dispatcher,
          'MERGE_CLOSENESS_CIRCLE: failed updating closeness',
          { id, error: err.message, stack: err.stack },
          this.logger
        );
      }
    }
    return mergedMemberIds;
  }

  /**
   * Merge the actor and target circles.
   *
   * @param {{ actor_id:string, target_id:string, result_variable?:string }} params - Operation parameters.
   * @param {ExecutionContext} executionContext - Execution context.
   */
  async execute(params, executionContext) {
    const validated = this.#validateParams(params, executionContext);
    if (!validated) return;
    const { actorId, targetId, resultVar, logger } = validated;

    const mergedMemberIds = await this.#updatePartners(actorId, targetId);

    if (resultVar) {
      if (
        !ensureEvaluationContext(executionContext, this.#dispatcher, logger)
      ) {
        return;
      }
      tryWriteContextVariable(
        resultVar,
        mergedMemberIds,
        executionContext,
        this.#dispatcher,
        logger
      );
    }

    logger.debug(
      `[MergeClosenessCircleHandler] merged circle -> ${JSON.stringify(mergedMemberIds)}`
    );
  }
}

export default MergeClosenessCircleHandler;
