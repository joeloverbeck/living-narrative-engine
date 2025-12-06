// src/logic/operationHandlers/resolveDirectionHandler.js

/**
 * @file Handler for RESOLVE_DIRECTION operation
 *
 * Resolves a direction string to a target location ID by querying the current location's
 * movement:exits component, which contains an array of exit definitions with direction,
 * target, and optional blocker information.
 *
 * Operation flow:
 * 1. Validate parameters (current_location_id, direction, result_variable)
 * 2. Retrieve movement:exits component from current location
 * 3. Find exit matching the specified direction
 * 4. Store target location ID (or null if no match) in context variable
 *
 * Related files:
 * @see data/schemas/operations/resolveDirection.schema.json - Operation schema
 * @see data/mods/movement/components/exits.component.json - Exits component structure
 * @see src/dependencyInjection/tokens/tokens-core.js - ResolveDirectionHandler token
 * @see src/dependencyInjection/registrations/operationHandlerRegistrations.js - Handler registration
 * @see src/dependencyInjection/registrations/interpreterRegistrations.js - Operation mapping
 * @see src/utils/preValidationUtils.js - KNOWN_OPERATION_TYPES whitelist
 * @augments BaseOperationHandler
 */

/** @typedef {import('../../interfaces/coreServices.js').ILogger} ILogger */
/** @typedef {import('../../entities/entityManager.js').default} EntityManager */
/** @typedef {import('../defs.js').OperationHandler} OperationHandler */
/** @typedef {import('../defs.js').ExecutionContext} ExecutionContext */

import { EXITS_COMPONENT_ID } from '../../constants/componentIds.js';
import { tryWriteContextVariable } from '../../utils/contextVariableUtils.js';
import { assertParamsObject } from '../../utils/handlerUtils/paramsUtils.js';
import { safeDispatchError } from '../../utils/safeDispatchErrorUtils.js';
import { isNonBlankString } from '../../utils/textUtils.js';
import { ensureEvaluationContext } from '../../utils/evaluationContextUtils.js';
import BaseOperationHandler from './baseOperationHandler.js';

/**
 * @typedef {object} ResolveDirectionOperationParams
 * @property {string} current_location_id
 *   Entity ID of the current location to search for exits.
 * @property {string} direction
 *   Direction string to match against exit definitions (case-insensitive).
 * @property {string} result_variable
 *   Context variable where the resolved target location ID (or null) will be stored.
 */

class ResolveDirectionHandler extends BaseOperationHandler {
  #entityManager;
  /** @type {import('../../interfaces/ISafeEventDispatcher.js').ISafeEventDispatcher} */
  #dispatcher;

  constructor({ entityManager, logger, safeEventDispatcher }) {
    super('ResolveDirectionHandler', {
      logger: { value: logger },
      entityManager: {
        value: entityManager,
        requiredMethods: ['getComponentData'],
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
   * Executes the RESOLVE_DIRECTION operation.
   *
   * @param {ResolveDirectionOperationParams|undefined|null} params - Operation parameters
   * @param {ExecutionContext} executionContext - Execution context
   */
  execute(params, executionContext) {
    const log = this.getLogger(executionContext);

    if (!assertParamsObject(params, this.#dispatcher, 'RESOLVE_DIRECTION')) {
      return;
    }

    const { current_location_id, direction, result_variable } = params;

    // Validate parameters
    if (!isNonBlankString(current_location_id)) {
      safeDispatchError(
        this.#dispatcher,
        'RESOLVE_DIRECTION: "current_location_id" must be a non-empty string.',
        { params }
      );
      return;
    }
    if (!isNonBlankString(direction)) {
      safeDispatchError(
        this.#dispatcher,
        'RESOLVE_DIRECTION: "direction" must be a non-empty string.',
        { params }
      );
      return;
    }
    if (!isNonBlankString(result_variable)) {
      safeDispatchError(
        this.#dispatcher,
        'RESOLVE_DIRECTION: "result_variable" must be a non-empty string.',
        { params }
      );
      return;
    }
    if (!ensureEvaluationContext(executionContext, this.#dispatcher, log)) {
      return;
    }

    const locationId = current_location_id.trim();
    const directionQuery = direction.trim().toLowerCase();
    const resultVar = result_variable.trim();

    // Retrieve exits component
    let exits = null;
    try {
      exits = this.#entityManager.getComponentData(
        locationId,
        EXITS_COMPONENT_ID
      );
    } catch (e) {
      log.warn(
        `RESOLVE_DIRECTION: Could not retrieve exits component from location '${locationId}'.`,
        { error: e.message }
      );
      tryWriteContextVariable(
        resultVar,
        null,
        executionContext,
        undefined,
        log
      );
      return;
    }

    // Handle missing or invalid exits data
    if (!Array.isArray(exits)) {
      log.debug(
        `RESOLVE_DIRECTION: Location '${locationId}' has no exits array. Storing null.`
      );
      tryWriteContextVariable(
        resultVar,
        null,
        executionContext,
        undefined,
        log
      );
      return;
    }

    // Find matching exit (case-insensitive)
    const matchingExit = exits.find(
      (exit) =>
        exit &&
        typeof exit.direction === 'string' &&
        exit.direction.toLowerCase() === directionQuery
    );

    if (matchingExit) {
      const targetId = matchingExit.target || null;
      log.debug(
        `RESOLVE_DIRECTION: Direction '${direction}' from '${locationId}' leads to '${targetId}'.`
      );
      tryWriteContextVariable(
        resultVar,
        targetId,
        executionContext,
        undefined,
        log
      );
    } else {
      log.debug(
        `RESOLVE_DIRECTION: No exit found for direction '${direction}' from location '${locationId}'. Storing null.`
      );
      tryWriteContextVariable(
        resultVar,
        null,
        executionContext,
        undefined,
        log
      );
    }
  }
}

export default ResolveDirectionHandler;
