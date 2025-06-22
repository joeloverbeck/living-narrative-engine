/**
 * @file Handler to dispatch the core:display_speech event.
 */

/** @typedef {import('../../interfaces/coreServices.js').ILogger} ILogger */
/** @typedef {import('../defs.js').ExecutionContext} ExecutionContext */
/** @typedef {import('../../events/safeEventDispatcher.js').SafeEventDispatcher} SafeEventDispatcher */

import BaseOperationHandler from './baseOperationHandler.js';
import { DISPLAY_SPEECH_ID } from '../../constants/eventIds.js';
import { assertParamsObject } from '../../utils/handlerUtils/indexUtils.js';
import { safeDispatchError } from '../../utils/safeDispatchErrorUtils.js';

/**
 * Parameters accepted by {@link DispatchSpeechHandler#execute}.
 *
 * @typedef {object} DispatchSpeechParams
 * @property {string} entity_id       - ID of the entity that spoke.
 * @property {string} speech_content  - Content of the speech.
 * @property {string=} thoughts       - Optional inner thoughts.
 * @property {string=} notes          - Optional notes.
 * @property {boolean=} allow_html    - Whether speech_content is HTML.
 */

class DispatchSpeechHandler extends BaseOperationHandler {
  /** @type {SafeEventDispatcher} */
  #dispatcher;

  /**
   * @param {object} deps
   * @param {SafeEventDispatcher} deps.dispatcher - Dispatcher used to emit the event.
   * @param {ILogger} deps.logger - Logger instance.
   */
  constructor({ dispatcher, logger }) {
    super('DispatchSpeechHandler', {
      logger: { value: logger },
      dispatcher: {
        value: dispatcher,
        requiredMethods: ['dispatch'],
      },
    });
    this.#dispatcher = dispatcher;
  }

  /**
   * Construct payload and dispatch {@link DISPLAY_SPEECH_ID}.
   *
   * @param {DispatchSpeechParams|null|undefined} params - Resolved parameters.
   * @param {ExecutionContext} executionContext - Execution context (unused).
   */
  execute(params, executionContext) {
    const logger = this.getLogger(executionContext);
    if (!assertParamsObject(params, logger, 'DISPATCH_SPEECH')) return;

    if (
      typeof params.entity_id !== 'string' ||
      !params.entity_id.trim() ||
      typeof params.speech_content !== 'string'
    ) {
      safeDispatchError(
        this.#dispatcher,
        'DISPATCH_SPEECH: invalid parameters.',
        { params },
        logger
      );
      return;
    }

    const payload = {
      entityId: params.entity_id.trim(),
      speechContent: params.speech_content,
    };

    if (params.allow_html !== undefined) {
      payload.allowHtml = Boolean(params.allow_html);
    }
    if (typeof params.thoughts === 'string') {
      payload.thoughts = params.thoughts;
    }
    if (typeof params.notes === 'string') {
      payload.notes = params.notes;
    }

    logger.debug('DISPATCH_SPEECH: dispatching display_speech', {
      payload,
    });
    try {
      this.#dispatcher.dispatch(DISPLAY_SPEECH_ID, payload);
    } catch (err) {
      safeDispatchError(
        this.#dispatcher,
        'DISPATCH_SPEECH: Error dispatching display_speech.',
        { errorMessage: err.message, stack: err.stack },
        logger
      );
    }
  }
}

export default DispatchSpeechHandler;
