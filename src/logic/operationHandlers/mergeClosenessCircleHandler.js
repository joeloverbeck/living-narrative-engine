/**
 * @file Handler that merges two intimacy circles and locks movement of all participants.
 */

/** @typedef {import('../../interfaces/coreServices.js').ILogger} ILogger */
/** @typedef {import('../../entities/entityManager.js').default} EntityManager */
/** @typedef {import('../defs.js').ExecutionContext} ExecutionContext */
/** @typedef {import('../../interfaces/ISafeEventDispatcher.js').ISafeEventDispatcher} ISafeEventDispatcher */

import closenessCircleService from '../services/closenessCircleService.js';
import { SYSTEM_ERROR_OCCURRED_ID } from '../../constants/eventIds.js';
import { setContextValue } from '../../utils/contextVariableUtils.js';
import { safeDispatchError } from '../../utils/safeDispatchErrorUtils.js';

/**
 * @class MergeClosenessCircleHandler
 * @description Handles the MERGE_CLOSENESS_CIRCLE operation.
 */
class MergeClosenessCircleHandler {
  /** @type {ILogger} */
  #logger;
  /** @type {EntityManager} */
  #entityManager;
  /** @type {ISafeEventDispatcher} */
  #dispatcher;

  /**
   * @param {object} deps - Constructor dependencies.
   * @param {ILogger} deps.logger - Logging service.
   * @param {EntityManager} deps.entityManager - Entity manager.
   * @param {ISafeEventDispatcher} deps.safeEventDispatcher - Error dispatcher.
   */
  constructor({ logger, entityManager, safeEventDispatcher }) {
    if (!logger?.debug) {
      throw new Error('MergeClosenessCircleHandler requires a valid ILogger');
    }
    if (!entityManager?.getComponentData || !entityManager?.addComponent) {
      throw new Error(
        'MergeClosenessCircleHandler requires a valid EntityManager'
      );
    }
    if (!safeEventDispatcher?.dispatch) {
      throw new Error(
        'MergeClosenessCircleHandler requires a valid ISafeEventDispatcher'
      );
    }
    this.#logger = logger;
    this.#entityManager = entityManager;
    this.#dispatcher = safeEventDispatcher;
    this.#logger.debug('[MergeClosenessCircleHandler] Initialized');
  }

  /**
   * Merge the actor and target circles and lock movement for all members.
   *
   * @param {{ actor_id:string, target_id:string, result_variable?:string }} params - Operation parameters.
   * @param {ExecutionContext} execCtx - Execution context.
   */
  execute(params, execCtx) {
    const { actor_id, target_id, result_variable } = params || {};
    const log = execCtx?.logger ?? this.#logger;

    if (typeof actor_id !== 'string' || !actor_id.trim()) {
      safeDispatchError(
        this.#dispatcher,
        'MERGE_CLOSENESS_CIRCLE: invalid "actor_id"',
        { params }
      );
      return;
    }
    if (typeof target_id !== 'string' || !target_id.trim()) {
      safeDispatchError(
        this.#dispatcher,
        'MERGE_CLOSENESS_CIRCLE: invalid "target_id"',
        { params }
      );
      return;
    }
    if (
      result_variable !== undefined &&
      (typeof result_variable !== 'string' || !result_variable.trim())
    ) {
      safeDispatchError(
        this.#dispatcher,
        'MERGE_CLOSENESS_CIRCLE: "result_variable" must be a non-empty string when provided.',
        { params }
      );
      return;
    }

    const actorId = actor_id.trim();
    const targetId = target_id.trim();

    const actorComp = this.#entityManager.getComponentData(
      actorId,
      'intimacy:closeness'
    );
    const targetComp = this.#entityManager.getComponentData(
      targetId,
      'intimacy:closeness'
    );

    const allMembers = closenessCircleService.merge(
      [actorId, targetId],
      Array.isArray(actorComp?.partners) ? actorComp.partners : [],
      Array.isArray(targetComp?.partners) ? targetComp.partners : []
    );

    for (const id of allMembers) {
      const partners = allMembers.filter((p) => p !== id);
      try {
        this.#entityManager.addComponent(id, 'intimacy:closeness', {
          partners,
        });
      } catch (err) {
        this.#dispatcher.dispatch(SYSTEM_ERROR_OCCURRED_ID, {
          message: 'MERGE_CLOSENESS_CIRCLE: failed updating closeness',
          details: { id, error: err.message, stack: err.stack },
        });
      }
      try {
        const move =
          this.#entityManager.getComponentData(id, 'core:movement') || {};
        this.#entityManager.addComponent(id, 'core:movement', {
          ...move,
          locked: true,
        });
      } catch (err) {
        this.#dispatcher.dispatch(SYSTEM_ERROR_OCCURRED_ID, {
          message: 'MERGE_CLOSENESS_CIRCLE: failed locking movement',
          details: { id, error: err.message, stack: err.stack },
        });
      }
    }

    if (typeof result_variable === 'string' && result_variable.trim()) {
      setContextValue(
        result_variable.trim(),
        allMembers,
        execCtx,
        this.#dispatcher,
        log
      );
    }

    log.debug(
      `[MergeClosenessCircleHandler] merged circle -> ${JSON.stringify(allMembers)}`
    );
  }
}

export default MergeClosenessCircleHandler;
