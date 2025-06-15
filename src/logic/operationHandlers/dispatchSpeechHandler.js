/**
 * @file Handler to dispatch the core:display_speech event.
 */

/** @typedef {import('../../interfaces/coreServices.js').ILogger} ILogger */
/** @typedef {import('../defs.js').ExecutionContext} ExecutionContext */
/** @typedef {import('../../events/validatedEventDispatcher.js').default} ValidatedEventDispatcher */
/** @typedef {import('../../events/eventBus.js').default} EventBus */

import { DISPLAY_SPEECH_ID } from '../../constants/eventIds.js';

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

class DispatchSpeechHandler {
  /** @type {ValidatedEventDispatcher | EventBus} */
  #dispatcher;
  /** @type {ILogger} */
  #logger;

  /**
   * @param {object} deps
   * @param {ValidatedEventDispatcher|EventBus} deps.dispatcher - Dispatcher used to emit the event.
   * @param {ILogger} deps.logger - Logger instance.
   */
  constructor({ dispatcher, logger }) {
    if (!dispatcher || typeof dispatcher.dispatch !== 'function') {
      throw new Error(
        'DispatchSpeechHandler requires a dispatcher with a dispatch method.'
      );
    }
    if (!logger || typeof logger.debug !== 'function') {
      throw new Error(
        'DispatchSpeechHandler requires a valid ILogger instance.'
      );
    }
    this.#dispatcher = dispatcher;
    this.#logger = logger;
  }

  /**
   * Construct payload and dispatch {@link DISPLAY_SPEECH_ID}.
   *
   * @param {DispatchSpeechParams|null|undefined} params - Resolved parameters.
   * @param {ExecutionContext} _ctx - Execution context (unused).
   */
  execute(params, _ctx) {
    if (
      !params ||
      typeof params.entity_id !== 'string' ||
      !params.entity_id.trim() ||
      typeof params.speech_content !== 'string'
    ) {
      this.#logger.error('DISPATCH_SPEECH: invalid parameters.', { params });
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

    this.#logger.debug('DISPATCH_SPEECH: dispatching display_speech', {
      payload,
    });
    try {
      this.#dispatcher.dispatch(DISPLAY_SPEECH_ID, payload);
    } catch (err) {
      this.#logger.error(
        'DISPATCH_SPEECH: Error dispatching display_speech.',
        err
      );
    }
  }
}

export default DispatchSpeechHandler;
