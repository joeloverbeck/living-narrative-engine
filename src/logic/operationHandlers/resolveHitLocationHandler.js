import ComponentOperationHandler from './componentOperationHandler.js';
import { writeContextVariable } from '../../utils/contextVariableUtils.js';
import { safeDispatchError } from '../../utils/safeDispatchErrorUtils.js';
import { assertParamsObject } from '../../utils/handlerUtils/indexUtils.js';
import { ensureEvaluationContext } from '../../utils/evaluationContextUtils.js';

/** @typedef {import('../../interfaces/coreServices.js').ILogger} ILogger */
/** @typedef {import('../../interfaces/IEntityManager.js').IEntityManager} IEntityManager */
/** @typedef {import('../../interfaces/ISafeEventDispatcher.js').ISafeEventDispatcher} ISafeEventDispatcher */
/** @typedef {import('../defs.js').ExecutionContext} ExecutionContext */

/**
 * @class ResolveHitLocationHandler
 * @augments ComponentOperationHandler
 * @description Resolves a hit location on a target entity based on anatomy:part weights.
 */
class ResolveHitLocationHandler extends ComponentOperationHandler {
  /** @type {IEntityManager} */ #entityManager;
  /** @type {ISafeEventDispatcher} */ #dispatcher;
  /** @type {object} */ #bodyGraphService;

  /**
   * @param {object} deps
   * @param {IEntityManager} deps.entityManager
   * @param {ILogger} deps.logger
   * @param {ISafeEventDispatcher} deps.safeEventDispatcher
   * @param {object} deps.bodyGraphService
   */
  constructor({ entityManager, logger, safeEventDispatcher, bodyGraphService }) {
    super('ResolveHitLocationHandler', {
      logger: { value: logger },
      entityManager: { value: entityManager },
      safeEventDispatcher: { value: safeEventDispatcher },
      bodyGraphService: { value: bodyGraphService },
    });
    this.#entityManager = entityManager;
    this.#dispatcher = safeEventDispatcher;
    this.#bodyGraphService = bodyGraphService;
  }

  /**
   * Execute the RESOLVE_HIT_LOCATION operation.
   *
   * @param {object} params
   * @param {ExecutionContext} executionContext
   */
  execute(params, executionContext) {
    const logger = this.getLogger(executionContext);

    if (
      !assertParamsObject(params, this.#dispatcher, 'ResolveHitLocationHandler')
    ) {
      return;
    }

    if (!ensureEvaluationContext(executionContext, this.#dispatcher, logger)) {
      return;
    }

    const { entity_ref, result_variable } = params;

    const entityId = this.validateEntityRef(
      entity_ref,
      logger,
      'ResolveHitLocationHandler',
      executionContext
    );

    if (!entityId) {
      safeDispatchError(
        this.#dispatcher,
        'ResolveHitLocationHandler: Invalid entity_ref.',
        { entity_ref }
      );
      return;
    }

    // Get anatomy:body to ensure it has a body
    const bodyComponent = this.#entityManager.getComponentData(
      entityId,
      'anatomy:body'
    );
    if (!bodyComponent) {
      logger.warn(
        `ResolveHitLocationHandler: Entity '${entityId}' has no anatomy:body.`
      );
      writeContextVariable(
        result_variable,
        null,
        executionContext,
        this.#dispatcher,
        logger
      );
      return;
    }

    let candidateParts = [];
    try {
      // Retrieve all parts from the body graph
      const allPartIds = this.#bodyGraphService.getAllParts(
        bodyComponent,
        entityId
      );

      for (const partId of allPartIds) {
        const partComponent = this.#entityManager.getComponentData(
          partId,
          'anatomy:part'
        );
        if (
          partComponent &&
          typeof partComponent.hit_probability_weight === 'number' &&
          partComponent.hit_probability_weight > 0
        ) {
          candidateParts.push({
            id: partId,
            weight: partComponent.hit_probability_weight,
          });
        }
      }
    } catch (error) {
      logger.error(
        `ResolveHitLocationHandler: Error retrieving parts for entity '${entityId}': ${error.message}`
      );
      writeContextVariable(
        result_variable,
        null,
        executionContext,
        this.#dispatcher,
        logger
      );
      return;
    }

    if (candidateParts.length === 0) {
      logger.warn(
        `ResolveHitLocationHandler: No eligible parts found for entity '${entityId}'.`
      );
      writeContextVariable(
        result_variable,
        null,
        executionContext,
        this.#dispatcher,
        logger
      );
      return;
    }

    // Weighted random selection
    const totalWeight = candidateParts.reduce(
      (sum, part) => sum + part.weight,
      0
    );

    // Fallback if total weight is 0 (should be caught by > 0 check, but good for safety)
    if (totalWeight <= 0) {
      writeContextVariable(
        result_variable,
        candidateParts[0].id,
        executionContext,
        this.#dispatcher,
        logger
      );
      return;
    }

    let randomValue = Math.random() * totalWeight;
    let selectedPartId = null;

    for (const part of candidateParts) {
      randomValue -= part.weight;
      if (randomValue <= 0) {
        selectedPartId = part.id;
        break;
      }
    }

    // Fallback if floating point weirdness caused no selection
    if (!selectedPartId) {
      selectedPartId = candidateParts[candidateParts.length - 1].id;
    }

    writeContextVariable(
      result_variable,
      selectedPartId,
      executionContext,
      this.#dispatcher,
      logger
    );
    logger.debug(
      `ResolveHitLocationHandler: Resolved hit location '${selectedPartId}' for entity '${entityId}'.`
    );
  }
}

export default ResolveHitLocationHandler;
