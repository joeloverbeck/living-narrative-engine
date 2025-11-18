/**
 * @file Handler for DISPATCH_SPEECH operation
 *
 * Dispatches speech display events to show character dialogue in the UI with optional
 * inner thoughts and notes.
 *
 * Operation flow:
 * 1. Validate required parameters (entity_id, speech_content)
 * 2. Build payload with speech content and optional allow_html flag
 * 3. Add optional thoughts and notes if provided
 * 4. Dispatch core:display_speech event through event bus
 * 5. Handle dispatch errors with safe error dispatcher
 *
 * Related files:
 * @see data/schemas/operations/dispatchSpeech.schema.json - Operation schema
 * @see src/dependencyInjection/tokens/tokens-core.js - DispatchSpeechHandler token
 * @see src/dependencyInjection/registrations/operationHandlerRegistrations.js - Handler registration
 * @see src/dependencyInjection/registrations/interpreterRegistrations.js - Operation mapping
 * @see src/utils/preValidationUtils.js - KNOWN_OPERATION_TYPES whitelist
 * @augments BaseOperationHandler
 */

/** @typedef {import('../../interfaces/coreServices.js').ILogger} ILogger */
/** @typedef {import('../defs.js').ExecutionContext} ExecutionContext */
/** @typedef {import('../../events/safeEventDispatcher.js').SafeEventDispatcher} SafeEventDispatcher */

import BaseOperationHandler from './baseOperationHandler.js';
import { DISPLAY_SPEECH_ID } from '../../constants/eventIds.js';
import { assertParamsObject } from '../../utils/handlerUtils/indexUtils.js';
import { validateStringParam } from '../../utils/handlerUtils/paramsUtils.js';
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

    const entityId = validateStringParam(
      params.entity_id,
      'entity_id',
      logger,
      this.#dispatcher
    );
    if (!entityId) return;

    const speechContent = validateStringParam(
      params.speech_content,
      'speech_content',
      logger,
      this.#dispatcher
    );
    if (!speechContent) return;

    const payload = {
      entityId,
      speechContent,
    };

    if (params.allow_html !== undefined) {
      payload.allowHtml = Boolean(params.allow_html);
    }
    if (typeof params.thoughts === 'string') {
      payload.thoughts = params.thoughts;
    }
    if (params.notes !== undefined) {
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
