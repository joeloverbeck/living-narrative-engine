// src/logic/operationHandlers/ifCoLocatedHandler.js

/**
 * @file Handler that conditionally executes nested actions when two entities share a location.
 * @see src/logic/operationHandlers/ifCoLocatedHandler.js
 */

/** @typedef {import('../defs.js').ExecutionContext} ExecutionContext */
/** @typedef {import('../defs.js').OperationHandler} OperationHandler */
/** @typedef {import('../../interfaces/coreServices.js').ILogger} ILogger */
/** @typedef {import('./modifyComponentHandler.js').EntityRefObject} EntityRefObject */
/** @typedef {import('../../data/schemas/operation.schema.json').Operation} Operation */

import { resolveEntityId } from '../../utils/entityRefUtils.js';

class IfCoLocatedHandler {
  /** @type {import('../../entities/entityManager.js').default} */ #entityManager;
  /** @type {import('../operationInterpreter.js').default} */ #operationInterpreter;
  /** @type {ILogger} */ #logger;

  /**
   * @param {object} deps
   * @param {import('../../entities/entityManager.js').default} deps.entityManager
   * @param {import('../operationInterpreter.js').default} deps.operationInterpreter
   * @param {ILogger} deps.logger
   */
  constructor({ entityManager, operationInterpreter, logger }) {
    if (!entityManager?.getComponentData)
      throw new Error('IfCoLocatedHandler requires a valid EntityManager');
    if (!operationInterpreter?.execute)
      throw new Error('IfCoLocatedHandler requires OperationInterpreter');
    if (!logger?.debug) throw new Error('IfCoLocatedHandler requires ILogger');

    this.#entityManager = entityManager;
    this.#operationInterpreter = operationInterpreter;
    this.#logger = logger;
  }

  /**
   * @typedef {object} IfCoLocatedParams
   * @property {'actor'|'target'|string|EntityRefObject} entity_ref_a
   * @property {'actor'|'target'|string|EntityRefObject} entity_ref_b
   * @property {Operation[]} then_actions
   * @property {Operation[]=} else_actions
   */

  /**
   * @param {IfCoLocatedParams} params
   * @param {ExecutionContext} execCtx
   */
  execute(params, execCtx) {
    const log = execCtx?.logger ?? this.#logger;

    if (!params || typeof params !== 'object') {
      log.warn('IF_CO_LOCATED: parameters missing or invalid');
      return;
    }

    const {
      entity_ref_a,
      entity_ref_b,
      then_actions = [],
      else_actions = [],
    } = params;

    if (!entity_ref_a || !entity_ref_b) {
      log.warn('IF_CO_LOCATED: entity_ref_a and entity_ref_b are required');
      return;
    }

    const idA = resolveEntityId(entity_ref_a, execCtx);
    const idB = resolveEntityId(entity_ref_b, execCtx);
    if (!idA || !idB) {
      log.warn(
        'IF_CO_LOCATED: could not resolve one or both entity references'
      );
      return;
    }

    let locA = null;
    let locB = null;
    try {
      locA =
        this.#entityManager.getComponentData(idA, 'core:position')
          ?.locationId ?? null;
    } catch (e) {
      log.warn(`IF_CO_LOCATED: failed to get position for ${idA}`, e);
    }
    try {
      locB =
        this.#entityManager.getComponentData(idB, 'core:position')
          ?.locationId ?? null;
    } catch (e) {
      log.warn(`IF_CO_LOCATED: failed to get position for ${idB}`, e);
    }

    const actions = locA && locB && locA === locB ? then_actions : else_actions;
    if (!Array.isArray(actions) || actions.length === 0) return;

    for (const op of actions) {
      try {
        this.#operationInterpreter.execute(op, execCtx);
      } catch (e) {
        log.error('IF_CO_LOCATED: error executing nested action', e);
      }
    }
  }
}

export default IfCoLocatedHandler;
