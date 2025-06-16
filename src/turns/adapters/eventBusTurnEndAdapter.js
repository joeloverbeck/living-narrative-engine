// src/turns/adapters/eventBusTurnEndAdapter.js
// --- FILE START ---

import { ITurnEndPort } from '../ports/ITurnEndPort.js';
import {
  TURN_ENDED_ID,
  SYSTEM_ERROR_OCCURRED_ID,
} from '../../constants/eventIds.js';

/** @typedef {import('../../interfaces/ISafeEventDispatcher.js').ISafeEventDispatcher} ISafeDispatcher */
/** @typedef {import('../../interfaces/coreServices.js').ILogger} ILogger */

export default class EventBusTurnEndAdapter extends ITurnEndPort {
  /** @type {ISafeDispatcher} */ #dispatcher;
  /** @type {Console|ILogger} */ #log;

  /**
   * @param {{
   * safeEventDispatcher: ISafeDispatcher,
   * logger?:             Console|ILogger
   * }} deps
   */
  constructor({ safeEventDispatcher, logger = console }) {
    super();

    if (
      !safeEventDispatcher ||
      typeof safeEventDispatcher.dispatch !== 'function'
    ) {
      throw new Error(
        'EventBusTurnEndAdapter: Requires a valid ISafeEventDispatcher.'
      );
    }

    this.#dispatcher = safeEventDispatcher;
    this.#log = logger;
  }

  /**
   * Canonical method used by HumanTurnHandler / TurnManager.
   * The 'success' parameter is part of the ITurnEndPort interface contract
   * and IS included in the core:turn_ended event payload.
   *
   * @param {string} entityId
   * @param {boolean} success - Indicates the outcome of the turn from the notifier's perspective.
   */
  async notifyTurnEnded(entityId, success) {
    if (!entityId || typeof entityId !== 'string') {
      const errMsg =
        'EventBusTurnEndAdapter: entityId must be a non-empty string';
      try {
        await this.#dispatcher.dispatch(SYSTEM_ERROR_OCCURRED_ID, {
          message: errMsg,
          details: {
            raw: errMsg,
            timestamp: new Date().toISOString(),
          },
        });
      } catch (dispatchErr) {
        await this.#dispatcher.dispatch(SYSTEM_ERROR_OCCURRED_ID, {
          message: `EventBusTurnEndAdapter: Error dispatching ${SYSTEM_ERROR_OCCURRED_ID} about invalid entityId.`,
          details: {
            error: dispatchErr.message,
            stack: dispatchErr.stack,
            entityId,
          },
        });
      }
      throw new Error(errMsg);
    }

    // Ensure 'success' is a boolean, as required by the schema.
    // Default to false if it's not explicitly provided or is not a boolean,
    // though the calling code in TurnEndingState should provide a valid boolean.
    const isTurnSuccessful = typeof success === 'boolean' ? success : false;
    if (typeof success !== 'boolean') {
      this.#log.warn(
        `EventBusTurnEndAdapter: 'success' parameter was not a boolean (received: ${success}). Defaulting to 'false'. EntityId: ${entityId}`
      );
    }

    this.#log.debug(
      `EventBusTurnEndAdapter: Received notifyTurnEnded for ${entityId} with success=${isTurnSuccessful}. Dispatching ${TURN_ENDED_ID} with entityId and success status.`
    );

    // Payload for core:turn_ended must include 'entityId' and 'success'.
    const payload = { entityId, success: isTurnSuccessful };

    try {
      await this.#dispatcher.dispatch(TURN_ENDED_ID, payload);
      this.#log.debug(
        `EventBusTurnEndAdapter: Successfully dispatched ${TURN_ENDED_ID} for ${entityId} with success=${isTurnSuccessful}.`
      );
    } catch (err) {
      try {
        await this.#dispatcher.dispatch(SYSTEM_ERROR_OCCURRED_ID, {
          message: `EventBusTurnEndAdapter failed to dispatch ${TURN_ENDED_ID} for ${entityId}.`,
          details: {
            raw: err.message,
            stack: err.stack,
            timestamp: new Date().toISOString(),
          },
        });
      } catch (dispatchErr) {
        await this.#dispatcher.dispatch(SYSTEM_ERROR_OCCURRED_ID, {
          message: `EventBusTurnEndAdapter: Error dispatching ${SYSTEM_ERROR_OCCURRED_ID} after failing ${TURN_ENDED_ID} for ${entityId}.`,
          details: {
            error: dispatchErr.message,
            stack: dispatchErr.stack,
            entityId,
          },
        });
      }
      throw err; // Re-throw to allow caller to handle
    }
  }

  /**
   * ⚠️ Legacy shim so the old unit-tests that call `turnEnded()` still pass.
   * Calls `notifyTurnEnded(id, true)` so existing behavioural assertions remain valid.
   *
   * @param {string} entityId
   */
  async turnEnded(entityId) {
    this.#log.debug(
      `EventBusTurnEndAdapter: Legacy turnEnded called for ${entityId}. Assuming success=true.`
    );
    return this.notifyTurnEnded(entityId, true);
  }
}

/* make it importable both ways */
export { EventBusTurnEndAdapter };
// --- FILE END ---
