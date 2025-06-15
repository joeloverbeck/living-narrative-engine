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
import { DISPLAY_ERROR_ID } from '../../constants/eventIds.js';
import { resolveEntityId } from '../../utils/entityRefUtils.js';
import { safeDispatchError } from '../../utils/safeDispatchError.js';
import { assertParamsObject } from '../../utils/handlerUtils/params.js';

class IfCoLocatedHandler {
  /** @type {ILogger} */
  #logger;
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
    if (!logger?.debug) throw new Error('IfCoLocatedHandler requires ILogger');
    if (!entityManager?.getComponentData)
      throw new Error('IfCoLocatedHandler requires EntityManager');
    if (!operationInterpreter?.execute)
      throw new Error('IfCoLocatedHandler requires OperationInterpreter');
    if (!safeEventDispatcher?.dispatch)
      throw new Error('IfCoLocatedHandler requires ISafeEventDispatcher');
    this.#logger = logger;
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
   * @param {ExecutionContext} execCtx
   */
  execute(params, execCtx) {
    const log = execCtx?.logger ?? this.#logger;

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

    const idA = resolveEntityId(entity_ref_a, execCtx);
    const idB = resolveEntityId(entity_ref_b, execCtx);

    if (!idA || !idB) {
      log.debug(
        `IF_CO_LOCATED: failed to resolve entity IDs '${idA}' or '${idB}'`
      );
      return;
    }

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

    const actions = Array.isArray(same ? then_actions : else_actions)
      ? same
        ? then_actions
        : else_actions
      : [];
    for (const op of actions) {
      try {
        this.#opInterpreter.execute(op, execCtx);
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
