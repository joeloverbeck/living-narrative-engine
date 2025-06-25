/**
 * @file This operation handler allows modders to retrieve a set of entities from the game based on filters.
 * @see src/logic/operationHandlers/queryEntitiesHandler.js
 */

/** @typedef {import('../../interfaces/IEntityManager.js').IEntityManager} IEntityManager */
/** @typedef {import('../../interfaces/coreServices.js').ILogger} ILogger */
/** @typedef {import('../jsonLogicEvaluationService.js').default} JsonLogicEvaluationService */
/** @typedef {import('../defs.js').ExecutionContext} ExecutionContext */
/** @typedef {import('../../interfaces/ISafeEventDispatcher.js').ISafeEventDispatcher} ISafeEventDispatcher */

import { safeDispatchError } from '../../utils/safeDispatchErrorUtils.js';
import BaseOperationHandler from './baseOperationHandler.js';
import { tryWriteContextVariable } from '../../utils/contextVariableUtils.js';
import { assertParamsObject } from '../../utils/handlerUtils/indexUtils.js';

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
   * Create a new QueryEntitiesHandler instance.
   *
   * @param {object} deps - Constructor dependencies.
   * @param {IEntityManager} deps.entityManager - Service for entity management.
   * @param {ILogger} deps.logger - Logging service.
   * @param {JsonLogicEvaluationService} deps.jsonLogicEvaluationService - Service for evaluating JSON Logic rules.
   * @param {ISafeEventDispatcher} deps.safeEventDispatcher - Dispatcher for error events.
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
   * Execute the operation with validated parameters and modular filter helpers.
   *
   * @param {object} params - Parameters for the operation.
   * @param {string} params.result_variable - Variable name to store results.
   * @param {object[]} params.filters - Filters to apply.
   * @param {number} [params.limit] - Optional result limit.
   * @param {ExecutionContext} executionContext - Interpreter execution context.
   * @returns {void}
   */
  execute(params, executionContext) {
    const validated = this.#validateParams(params, executionContext);
    if (!validated) return;
    const { resultVariable, filters, limit, logger } = validated;

    let candidateIds = new Set(this.#entityManager.getEntityIds());
    logger.debug(
      `QUERY_ENTITIES: Starting with ${candidateIds.size} total active entities.`
    );

    for (const filter of filters) {
      if (candidateIds.size === 0) {
        logger.debug(
          'QUERY_ENTITIES: Candidate set is empty, skipping remaining filters.'
        );
        break;
      }

      if (!filter || typeof filter !== 'object') {
        logger.warn('QUERY_ENTITIES: Invalid filter object. Skipping.');
        continue;
      }

      const filterType = Object.keys(filter)[0];
      const filterValue = filter[filterType];

      if (filterType === 'by_location') {
        candidateIds = this.#applyLocationFilter(
          candidateIds,
          filterValue,
          logger
        );
      } else if (filterType === 'with_component') {
        candidateIds = this.#applyComponentFilter(
          candidateIds,
          filterValue,
          logger
        );
      } else if (filterType === 'with_component_data') {
        candidateIds = this.#applyComponentDataFilter(
          candidateIds,
          filterValue,
          logger
        );
      } else {
        logger.warn(
          `QUERY_ENTITIES: Encountered unknown filter type '${filterType}'. Skipping.`
        );
      }
    }

    let finalIds = Array.from(candidateIds);
    if (typeof limit === 'number') {
      const originalCount = finalIds.length;
      finalIds = finalIds.slice(0, limit);
      logger.debug(
        `QUERY_ENTITIES: Applied limit: ${limit}. Results reduced from ${originalCount} to ${finalIds.length}.`
      );
    }

    const res = tryWriteContextVariable(
      resultVariable,
      finalIds,
      executionContext,
      this.#dispatcher,
      logger
    );
    if (res.success) {
      logger.debug(
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

  /**
   * Validate and normalize execution parameters.
   *
   * @param {object} params - Raw parameters object.
   * @param {ExecutionContext} executionContext - Current execution context.
   * @returns {{resultVariable:string, filters:object[], limit:number|undefined, logger:ILogger}|null}
   *   Normalized parameters or `null` when validation fails.
   * @private
   */
  #validateParams(params, executionContext) {
    const logger = this.getLogger(executionContext);

    if (!assertParamsObject(params, logger, 'QUERY_ENTITIES')) {
      return null;
    }
    const { result_variable, filters, limit } = params;

    if (typeof result_variable !== 'string' || !result_variable) {
      logger.warn(
        'QUERY_ENTITIES: Missing or invalid "result_variable" parameter.'
      );
      return null;
    }
    if (!Array.isArray(filters)) {
      logger.warn(
        'QUERY_ENTITIES: Missing or invalid "filters" array parameter.'
      );
      return null;
    }
    const safeLimit =
      typeof limit === 'number' && limit >= 0 ? Math.floor(limit) : undefined;

    return {
      resultVariable: result_variable,
      filters,
      limit: safeLimit,
      logger,
    };
  }

  /**
   * Apply a location-based filter.
   *
   * @param {Set<string>} candidates - Current candidate entity ids.
   * @param {*} locationId - Location identifier to filter by.
   * @param {ILogger} logger - Logger for debug/warn output.
   * @returns {Set<string>} Filtered candidate ids.
   * @private
   */
  #applyLocationFilter(candidates, locationId, logger) {
    if (typeof locationId !== 'string' || !locationId) {
      logger.warn(
        "QUERY_ENTITIES: Invalid value for 'by_location' filter. Skipping."
      );
      return candidates;
    }

    const idsInLocation = this.#entityManager.getEntitiesInLocation(locationId);
    const originalSize = candidates.size;
    const result = new Set(
      [...candidates].filter((id) => idsInLocation.has(id))
    );

    logger.debug(
      `QUERY_ENTITIES: Applied 'by_location: ${locationId}'. Candidates reduced from ${originalSize} to ${result.size}.`
    );
    return result;
  }

  /**
   * Apply a simple component presence filter.
   *
   * @param {Set<string>} candidates - Current candidate entity ids.
   * @param {*} componentType - Component type to require.
   * @param {ILogger} logger - Logger for debug/warn output.
   * @returns {Set<string>} Filtered candidate ids.
   * @private
   */
  #applyComponentFilter(candidates, componentType, logger) {
    if (typeof componentType !== 'string' || !componentType) {
      logger.warn(
        "QUERY_ENTITIES: Invalid value for 'with_component' filter. Skipping."
      );
      return candidates;
    }

    const originalSize = candidates.size;
    const result = new Set();
    for (const id of candidates) {
      if (this.#entityManager.hasComponent(id, componentType)) {
        result.add(id);
      }
    }
    logger.debug(
      `QUERY_ENTITIES: Applied 'with_component: ${componentType}'. Candidates reduced from ${originalSize} to ${result.size}.`
    );
    return result;
  }

  /**
   * Apply a component data filter using JSON Logic.
   *
   * @param {Set<string>} candidates - Current candidate entity ids.
   * @param {{component_type:string,condition:object}} filter - Filter descriptor.
   * @param {ILogger} logger - Logger for debug/warn output.
   * @returns {Set<string>} Filtered candidate ids.
   * @private
   */
  #applyComponentDataFilter(candidates, filter, logger) {
    const { component_type, condition } = filter || {};
    if (typeof component_type !== 'string' || !component_type) {
      logger.warn(
        "QUERY_ENTITIES: Invalid 'component_type' in 'with_component_data' filter. Skipping."
      );
      return candidates;
    }
    if (typeof condition !== 'object' || condition === null) {
      logger.warn(
        "QUERY_ENTITIES: Invalid 'condition' in 'with_component_data' filter. Skipping."
      );
      return candidates;
    }

    const originalSize = candidates.size;
    const result = new Set();
    for (const id of candidates) {
      const compData = this.#entityManager.getComponentData(id, component_type);
      if (compData !== undefined) {
        const match = this.#jsonLogicEvaluationService.evaluate(
          condition,
          compData
        );
        if (match) result.add(id);
      }
    }
    logger.debug(
      `QUERY_ENTITIES: Applied 'with_component_data: ${component_type}'. Candidates reduced from ${originalSize} to ${result.size}.`
    );
    return result;
  }
}

export default QueryEntitiesHandler;
