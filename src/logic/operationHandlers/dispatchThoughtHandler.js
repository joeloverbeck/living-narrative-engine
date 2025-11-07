/**
 * @file Handler for DISPATCH_THOUGHT operation
 *
 * Dispatches thought display events to show character internal thoughts in the UI with
 * optional structured notes for AI memory systems.
 *
 * Operation flow:
 * 1. Validate required parameters (entity_id, thoughts)
 * 2. Build payload with thoughts content
 * 3. Add optional structured notes array if provided and non-empty
 * 4. Dispatch core:display_thought event through event bus
 * 5. Handle dispatch errors with safe error dispatcher
 *
 * Related files:
 * @see data/schemas/operations/dispatchThought.schema.json - Operation schema
 * @see src/dependencyInjection/tokens/tokens-core.js - DispatchThoughtHandler token
 * @see src/dependencyInjection/registrations/operationHandlerRegistrations.js - Handler registration
 * @see src/dependencyInjection/registrations/interpreterRegistrations.js - Operation mapping
 * @see src/utils/preValidationUtils.js - KNOWN_OPERATION_TYPES whitelist
 *
 * @extends BaseOperationHandler
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
 * @property {Array<{text: string, subject?: string, subjectType?: string, context?: string}>=} notes - Optional structured notes array.
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

    // Only include notes if it's a non-empty array
    if (Array.isArray(params.notes) && params.notes.length > 0) {
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
