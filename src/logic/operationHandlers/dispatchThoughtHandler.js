/**
 * @file Handler to dispatch the core:display_thought event.
 */

/** @typedef {import('../../interfaces/coreServices.js').ILogger} ILogger */
/** @typedef {import('../defs.js').ExecutionContext} ExecutionContext */
/** @typedef {import('../../events/safeEventDispatcher.js').SafeEventDispatcher} SafeEventDispatcher */

import BaseOperationHandler from './baseOperationHandler.js';
import { DISPLAY_THOUGHT_ID } from '../../constants/eventIds.js';
import { assertParamsObject } from '../../utils/handlerUtils/indexUtils.js';
import { validateStringParam } from '../../utils/handlerUtils/paramsUtils.js';
import { safeDispatchError } from '../../utils/safeDispatchErrorUtils.js';

/**
 * Parameters accepted by {@link DispatchThoughtHandler#execute}.
 *
 * @typedef {object} DispatchThoughtParams
 * @property {string} entity_id       - ID of the entity that had thoughts.
 * @property {string} thoughts        - Content of the thoughts.
 * @property {string=} notes          - Optional notes.
 */

class DispatchThoughtHandler extends BaseOperationHandler {
  /** @type {SafeEventDispatcher} */
  #dispatcher;

  /**
   * @param {object} deps
   * @param {SafeEventDispatcher} deps.dispatcher - Dispatcher used to emit the event.
   * @param {ILogger} deps.logger - Logger instance.
   */
  constructor({ dispatcher, logger }) {
    super('DispatchThoughtHandler', {
      logger: { value: logger },
      dispatcher: {
        value: dispatcher,
        requiredMethods: ['dispatch'],
      },
    });
    this.#dispatcher = dispatcher;
  }

  /**
   * Construct payload and dispatch {@link DISPLAY_THOUGHT_ID}.
   *
   * @param {DispatchThoughtParams|null|undefined} params - Resolved parameters.
   * @param {ExecutionContext} executionContext - Execution context (unused).
   */
  execute(params, executionContext) {
    const logger = this.getLogger(executionContext);
    if (!assertParamsObject(params, logger, 'DISPATCH_THOUGHT')) return;

    const entityId = validateStringParam(
      params.entity_id,
      'entity_id',
      logger,
      this.#dispatcher
    );
    if (!entityId) return;

    const thoughts = validateStringParam(
      params.thoughts,
      'thoughts',
      logger,
      this.#dispatcher
    );
    if (!thoughts) return;

    const payload = {
      entityId,
      thoughts,
    };

    if (params.notes !== undefined) {
      payload.notes = params.notes;
    }

    logger.debug('DISPATCH_THOUGHT: dispatching display_thought', {
      payload,
    });
    try {
      this.#dispatcher.dispatch(DISPLAY_THOUGHT_ID, payload);
    } catch (err) {
      safeDispatchError(
        this.#dispatcher,
        'DISPATCH_THOUGHT: Error dispatching display_thought.',
        { errorMessage: err.message, stack: err.stack },
        logger
      );
    }
  }
}

export default DispatchThoughtHandler;