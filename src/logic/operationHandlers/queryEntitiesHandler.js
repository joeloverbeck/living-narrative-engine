/**
 * @file This operation handler allows modders to retrieve a set of entities from the game based on filters.
 * @see src/logic/operationHandlers/queryEntitiesHandler.js
 */

/** @typedef {import('../../interfaces/IEntityManager.js').IEntityManager} IEntityManager */
/** @typedef {import('../../interfaces/coreServices.js').ILogger} ILogger */
/** @typedef {import('../jsonLogicEvaluationService.js').default} JsonLogicEvaluationService */
/** @typedef {import('../defs.js').ExecutionContext} ExecutionContext */
/** @typedef {import('../defs.js').OperationHandler} OperationHandler */
/** @typedef {import('../../interfaces/ISafeEventDispatcher.js').ISafeEventDispatcher} ISafeEventDispatcher */

import { safeDispatchError } from '../../utils/safeDispatchErrorUtils.js';
import BaseOperationHandler from './baseOperationHandler.js';
import { tryWriteContextVariable } from '../../utils/contextVariableUtils.js';
import { ensureEvaluationContext } from '../../utils/evaluationContextUtils.js';
import { assertParamsObject } from '../../utils/handlerUtils/indexUtils.js';

const FILTER_MAP = Object.freeze({
  by_location: 'applyLocationFilter',
  with_component: 'applyComponentFilter',
  with_component_data: 'applyComponentDataFilter',
});

/**
 * @class QueryEntitiesHandler
 * @description Handles the 'QUERY_ENTITIES' operation. It queries for entities based on a set of filters.
 * This implementation supports filtering by location and by component presence.
 * @implements {OperationHandler}
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

    candidateIds = this.#applyFilters(candidateIds, filters, logger);

    let finalIds = Array.from(candidateIds);
    if (typeof limit === 'number') {
      const originalCount = finalIds.length;
      finalIds = finalIds.slice(0, limit);
      logger.debug(
        `QUERY_ENTITIES: Applied limit: ${limit}. Results reduced from ${originalCount} to ${finalIds.length}.`
      );
    }

    this.#storeResult(resultVariable, finalIds, executionContext, logger);
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
   * Apply all provided filters to the candidate set in order.
   *
   * @param {Set<string>} candidates - Current candidate entity ids.
   * @param {object[]} filters - Array of filter descriptors.
   * @param {ILogger} logger - Logger for debug/warn output.
   * @returns {Set<string>} Filtered candidate ids.
   * @private
   */
  #applyFilters(candidates, filters, logger) {
    let result = candidates;
    for (const filter of filters) {
      if (result.size === 0) {
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

      const methodName = FILTER_MAP[filterType];
      if (methodName && typeof this[methodName] === 'function') {
        result = this[methodName](result, filterValue, logger);
      } else {
        logger.warn(
          `QUERY_ENTITIES: Encountered unknown filter type '${filterType}'. Skipping.`
        );
      }
    }
    return result;
  }

  /**
   * Store the query result in the execution context.
   *
   * @param {string} resultVariable - Name of the context variable to store in.
   * @param {string[]} finalIds - Array of entity ids to store.
   * @param {ExecutionContext} executionContext - Current execution context.
   * @param {ILogger} logger - Logger for debug output.
   * @returns {void}
   * @private
   */
  #storeResult(resultVariable, finalIds, executionContext, logger) {
    if (!ensureEvaluationContext(executionContext, this.#dispatcher, logger)) {
      return;
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
   * Apply a filtering function and log candidate reduction.
   *
   * @param {Set<string>} candidates - Current candidate entity ids.
   * @param {(set:Set<string>) => Set<string>} filterFn - Filtering callback.
   * @param {string} label - Label describing the filter for logging.
   * @param {ILogger} logger - Logger for debug output.
   * @returns {Set<string>} Resulting candidate ids after filtering.
   * @private
   */
  #filterAndLog(candidates, filterFn, label, logger) {
    const originalSize = candidates.size;
    const result = filterFn(candidates);
    logger.debug(
      `QUERY_ENTITIES: Applied '${label}'. Candidates reduced from ${originalSize} to ${result.size}.`
    );
    return result;
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
  applyLocationFilter(candidates, locationId, logger) {
    if (typeof locationId !== 'string' || !locationId) {
      logger.warn(
        "QUERY_ENTITIES: Invalid value for 'by_location' filter. Skipping."
      );
      return candidates;
    }

    const idsInLocation = this.#entityManager.getEntitiesInLocation(locationId);
    return this.#filterAndLog(
      candidates,
      (set) => new Set([...set].filter((id) => idsInLocation.has(id))),
      `by_location: ${locationId}`,
      logger
    );
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
  applyComponentFilter(candidates, componentType, logger) {
    if (typeof componentType !== 'string' || !componentType) {
      logger.warn(
        "QUERY_ENTITIES: Invalid value for 'with_component' filter. Skipping."
      );
      return candidates;
    }

    return this.#filterAndLog(
      candidates,
      (set) => {
        const result = new Set();
        for (const id of set) {
          if (this.#entityManager.hasComponent(id, componentType)) {
            result.add(id);
          }
        }
        return result;
      },
      `with_component: ${componentType}`,
      logger
    );
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
  applyComponentDataFilter(candidates, filter, logger) {
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

    return this.#filterAndLog(
      candidates,
      (set) => {
        const result = new Set();
        for (const id of set) {
          const compData = this.#entityManager.getComponentData(
            id,
            component_type
          );
          if (compData !== undefined) {
            const match = this.#jsonLogicEvaluationService.evaluate(
              condition,
              compData
            );
            if (match) result.add(id);
          }
        }
        return result;
      },
      `with_component_data: ${component_type}`,
      logger
    );
  }
}

export default QueryEntitiesHandler;
