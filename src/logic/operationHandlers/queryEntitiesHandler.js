/**
 * @file This operation handler allows modders to retrieve a set of entities from the game based on filters.
 * @see src/logic/operationHandlers/queryEntitiesHandler.js
 */

/** @typedef {import('../../interfaces/IEntityManager.js').IEntityManager} IEntityManager */
/** @typedef {import('../../interfaces/coreServices.js').ILogger} ILogger */
/** @typedef {import('../jsonLogicEvaluationService.js').default} JsonLogicEvaluationService */
/** @typedef {import('../defs.js').ExecutionContext} ExecutionContext */
/** @typedef {import('../../interfaces/ISafeEventDispatcher.js').ISafeEventDispatcher} ISafeEventDispatcher */

import { DISPLAY_ERROR_ID } from '../../constants/eventIds.js';
import { safeDispatchError } from '../../utils/safeDispatchError.js';
import BaseOperationHandler from './baseOperationHandler.js';
import { setContextValue } from '../../utils/contextVariableUtils.js';

/**
 * @class QueryEntitiesHandler
 * @description Handles the 'QUERY_ENTITIES' operation. It queries for entities based on a set of filters.
 * This implementation supports filtering by location and by component presence.
 */
class QueryEntitiesHandler extends BaseOperationHandler {
  /** @type {IEntityManager} */
  #entityManager;
  /** @type {JsonLogicEvaluationService} */
  #jsonLogicEvaluationService;
  /** @type {ISafeEventDispatcher} */
  #dispatcher;

  /**
   * @param {object} deps
   * @param {IEntityManager} deps.entityManager - Service for entity management.
   * @param {ILogger} deps.logger - Logging service.
   * @param {JsonLogicEvaluationService} deps.jsonLogicEvaluationService - Service for evaluating JSON Logic rules.
   * @param deps.safeEventDispatcher
   * @throws {Error} If any required dependencies are missing or invalid.
   */
  constructor({
    entityManager,
    logger,
    jsonLogicEvaluationService,
    safeEventDispatcher,
  }) {
    super('QueryEntitiesHandler', {
      logger: { value: logger },
      entityManager: {
        value: entityManager,
        requiredMethods: [
          'getEntitiesInLocation',
          'hasComponent',
          'getComponentData',
        ],
      },
      jsonLogicEvaluationService: {
        value: jsonLogicEvaluationService,
        requiredMethods: ['evaluate'],
      },
      safeEventDispatcher: {
        value: safeEventDispatcher,
        requiredMethods: ['dispatch'],
      },
    });

    if (!entityManager?.activeEntities)
      throw new Error(
        "Dependency 'IEntityManager' is required and must expose 'activeEntities'."
      );

    this.#entityManager = entityManager;
    this.#jsonLogicEvaluationService = jsonLogicEvaluationService;
    this.#dispatcher = safeEventDispatcher;
  }

  /**
   * Executes the query operation.
   * Validates parameters, starts with a set of all active entities, then sequentially applies
   * filters to reduce the set. Finally, it stores the resulting array of entity IDs in the
   * specified context variable.
   *
   * @param {object} params - The parameters for the operation.
   * @param {string} params.result_variable - The variable name to store the array of entity IDs in the context.
   * @param {object[]} params.filters - An array of filter objects.
   * @param {number} [params.limit] - Optional limit on the number of results.
   * @param {ExecutionContext} executionContext - The context of the current execution.
   */
  execute(params, executionContext) {
    const log = this.getLogger(executionContext);

    // 1. Parameter Validation
    if (
      !params?.result_variable ||
      typeof params.result_variable !== 'string'
    ) {
      log.warn(
        'QUERY_ENTITIES: Missing or invalid "result_variable" parameter.'
      );
      return;
    }
    if (!params.filters || !Array.isArray(params.filters)) {
      log.warn('QUERY_ENTITIES: Missing or invalid "filters" array parameter.');
      return;
    }

    // 2. Start with all active entities
    let candidateIds = new Set(this.#entityManager.activeEntities.keys());
    log.debug(
      `QUERY_ENTITIES: Starting with ${candidateIds.size} total active entities.`
    );

    // 3. Apply each filter sequentially
    for (const filter of params.filters) {
      if (candidateIds.size === 0) {
        log.debug(
          'QUERY_ENTITIES: Candidate set is empty, skipping remaining filters.'
        );
        break; // Optimization: no need to process more filters if no entities are left.
      }
      const filterType = Object.keys(filter)[0];
      const filterValue = filter[filterType];

      if (filterType === 'by_location') {
        if (typeof filterValue !== 'string' || !filterValue) {
          log.warn(
            `QUERY_ENTITIES: Invalid value for 'by_location' filter. Skipping.`
          );
          continue;
        }
        const idsInLocation =
          this.#entityManager.getEntitiesInLocation(filterValue);
        const originalSize = candidateIds.size;

        // Find the intersection of the current candidates and entities in the location
        candidateIds = new Set(
          [...candidateIds].filter((id) => idsInLocation.has(id))
        );

        log.debug(
          `QUERY_ENTITIES: Applied 'by_location: ${filterValue}'. Candidates reduced from ${originalSize} to ${candidateIds.size}.`
        );
      } else if (filterType === 'with_component') {
        if (typeof filterValue !== 'string' || !filterValue) {
          log.warn(
            `QUERY_ENTITIES: Invalid value for 'with_component' filter. Skipping.`
          );
          continue;
        }
        const componentType = filterValue;
        const originalSize = candidateIds.size;
        const nextCandidateIds = new Set();

        for (const id of candidateIds) {
          if (this.#entityManager.hasComponent(id, componentType)) {
            nextCandidateIds.add(id);
          }
        }
        candidateIds = nextCandidateIds;
        log.debug(
          `QUERY_ENTITIES: Applied 'with_component: ${componentType}'. Candidates reduced from ${originalSize} to ${candidateIds.size}.`
        );
      }
      // ---- NEW LOGIC FOR THIS TICKET ----
      else if (filterType === 'with_component_data') {
        const { component_type, condition } = filterValue;
        if (typeof component_type !== 'string' || !component_type) {
          log.warn(
            `QUERY_ENTITIES: Invalid 'component_type' in 'with_component_data' filter. Skipping.`
          );
          continue;
        }
        if (typeof condition !== 'object' || condition === null) {
          log.warn(
            `QUERY_ENTITIES: Invalid 'condition' in 'with_component_data' filter. Skipping.`
          );
          continue;
        }

        const originalSize = candidateIds.size;
        const nextCandidateIds = new Set();

        for (const id of candidateIds) {
          const componentData = this.#entityManager.getComponentData(
            id,
            component_type
          );
          // The entity must have the component for the filter to be applicable.
          if (componentData !== undefined) {
            const isMatch = this.#jsonLogicEvaluationService.evaluate(
              condition,
              componentData
            );
            if (isMatch) {
              nextCandidateIds.add(id);
            }
          }
        }
        candidateIds = nextCandidateIds;
        log.debug(
          `QUERY_ENTITIES: Applied 'with_component_data: ${component_type}'. Candidates reduced from ${originalSize} to ${candidateIds.size}.`
        );
      }
      // ---- END NEW LOGIC ----
      else {
        log.warn(
          `QUERY_ENTITIES: Encountered unknown filter type '${filterType}'. Skipping.`
        );
      }
    }

    // 4. Apply Limit and Store Result
    let finalIds = Array.from(candidateIds);
    if (typeof params.limit === 'number' && params.limit >= 0) {
      const originalCount = finalIds.length;
      finalIds = finalIds.slice(0, params.limit);
      log.debug(
        `QUERY_ENTITIES: Applied limit: ${params.limit}. Results reduced from ${originalCount} to ${finalIds.length}.`
      );
    }

    const resultVariable = params.result_variable;
    const stored = setContextValue(
      resultVariable,
      finalIds,
      executionContext,
      this.#dispatcher,
      log
    );
    if (stored) {
      log.debug(
        `QUERY_ENTITIES: Stored ${finalIds.length} entity IDs in context variable "${resultVariable}".`
      );
    } else {
      safeDispatchError(
        this.#dispatcher,
        'QUERY_ENTITIES: Cannot store result. `executionContext.evaluationContext.context` is not available.',
        { resultVariable }
      );
    }
  }
}

export default QueryEntitiesHandler;
