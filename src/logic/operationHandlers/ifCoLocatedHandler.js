/**
 * @file Executes a set of actions if two entities are in the same location.
 * @see src/logic/operationHandlers/ifCoLocatedHandler.js
 */

/** @typedef {import('../../interfaces/coreServices.js').ILogger} ILogger */
/** @typedef {import('../../entities/entityManager.js').default} EntityManager */
/** @typedef {import('../defs.js').ExecutionContext} ExecutionContext */
/** @typedef {import('../operationInterpreter.js').default} OperationInterpreter */
/** @typedef {import('../../interfaces/ISafeEventDispatcher.js').ISafeEventDispatcher} ISafeEventDispatcher */

import { POSITION_COMPONENT_ID } from '../../constants/componentIds.js';
import { resolveEntityId } from '../../utils/entityRefUtils.js';
import { safeDispatchError } from '../../utils/safeDispatchErrorUtils.js';
import { assertParamsObject } from '../../utils/handlerUtils/paramsUtils.js';
import BaseOperationHandler from './baseOperationHandler.js';

class IfCoLocatedHandler extends BaseOperationHandler {
  /** @type {EntityManager} */
  #entityManager;
  /** @type {OperationInterpreter} */
  #opInterpreter;
  /** @type {ISafeEventDispatcher} */
  #dispatcher;

  /**
   * @param {object} deps
   * @param {ILogger} deps.logger
   * @param {EntityManager} deps.entityManager
   * @param {OperationInterpreter} deps.operationInterpreter
   * @param {ISafeEventDispatcher} deps.safeEventDispatcher
   */
  constructor({
    logger,
    entityManager,
    operationInterpreter,
    safeEventDispatcher,
  }) {
    super('IfCoLocatedHandler', {
      logger: { value: logger },
      entityManager: {
        value: entityManager,
        requiredMethods: ['getComponentData'],
      },
      operationInterpreter: {
        value: operationInterpreter,
        requiredMethods: ['execute'],
      },
      safeEventDispatcher: {
        value: safeEventDispatcher,
        requiredMethods: ['dispatch'],
      },
    });
    this.#entityManager = entityManager;
    this.#opInterpreter = operationInterpreter;
    this.#dispatcher = safeEventDispatcher;
  }

  /**
   * @typedef {object} IfCoLocatedParams
   * @property {string|object} entity_ref_a
   * @property {string|object} entity_ref_b
   * @property {import('../../data/schemas/operation.schema.json').Operation[]} [then_actions]
   * @property {import('../../data/schemas/operation.schema.json').Operation[]} [else_actions]
   */

  /**
   * @param {IfCoLocatedParams} params
   * @param {ExecutionContext} executionContext
   */
  execute(params, executionContext) {
    const log = this.getLogger(executionContext);

    if (!assertParamsObject(params, this.#dispatcher, 'IF_CO_LOCATED')) {
      return;
    }

    const {
      entity_ref_a,
      entity_ref_b,
      then_actions = [],
      else_actions = [],
    } = params;

    if (!entity_ref_a || !entity_ref_b) {
      safeDispatchError(
        this.#dispatcher,
        'IF_CO_LOCATED: entity_ref_a and entity_ref_b are required'
      );
      return;
    }

    const idA = resolveEntityId(entity_ref_a, executionContext);
    const idB = resolveEntityId(entity_ref_b, executionContext);

    if (!idA || !idB) {
      log.debug(
        `IF_CO_LOCATED: failed to resolve entity IDs '${idA}' or '${idB}'`
      );
      return;
    }

    const same = this.#entitiesCoLocated(idA, idB, executionContext);

    const actions = same ? then_actions : else_actions;
    this.#runActions(actions, executionContext);
  }

  /**
   * Determine if two entities share the same location.
   *
   * @private
   * @param {string} idA - First entity ID.
   * @param {string} idB - Second entity ID.
   * @param {ExecutionContext} _executionContext - Current execution context.
   * @returns {boolean} `true` if co-located, else `false`.
   */
  #entitiesCoLocated(idA, idB, _executionContext) {
    let same = false;
    try {
      const posA = this.#entityManager.getComponentData(
        idA,
        POSITION_COMPONENT_ID
      );
      const posB = this.#entityManager.getComponentData(
        idB,
        POSITION_COMPONENT_ID
      );
      same =
        posA?.locationId &&
        posB?.locationId &&
        posA.locationId === posB.locationId;
    } catch (e) {
      safeDispatchError(
        this.#dispatcher,
        `IF_CO_LOCATED: error reading positions for '${idA}' or '${idB}'`,
        { error: e.message, stack: e.stack }
      );
      same = false;
    }
    return same;
  }

  /**
   * Execute a list of operations using the interpreter.
   *
   * @private
   * @param {import('../../data/schemas/operation.schema.json').Operation[]|*} actions - Operations to execute.
   * @param {ExecutionContext} executionContext - Current execution context.
   * @returns {void}
   */
  #runActions(actions, executionContext) {
    if (!Array.isArray(actions)) return;
    for (const op of actions) {
      try {
        this.#opInterpreter.execute(op, executionContext);
      } catch (err) {
        safeDispatchError(
          this.#dispatcher,
          'IF_CO_LOCATED: nested operation threw',
          {
            error: err?.message,
            stack: err?.stack,
            op,
          }
        );
        break;
      }
    }
  }
}

export default IfCoLocatedHandler;
