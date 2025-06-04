// src/core/adapters/eventBusTurnEndAdapter.js
// --- FILE START ---

import { ITurnEndPort } from '../ports/ITurnEndPort.js';
import { TURN_ENDED_ID } from '../../constants/eventIds.js';

/** @typedef {import('../../interfaces/ISafeEventDispatcher.js').ISafeEventDispatcher} ISafeDispatcher */
/** @typedef {import('../../interfaces/IValidatedEventDispatcher.js').IValidatedEventDispatcher} IValidatedDispatcher */
/** @typedef {import('../../interfaces/coreServices.js').ILogger} ILogger */

export default class EventBusTurnEndAdapter extends ITurnEndPort {
  /** @type {ISafeDispatcher|IValidatedDispatcher} */ #dispatcher;
  /** @type {boolean} */ #isSafe;
  /** @type {Console|ILogger} */ #log;

  /**
   * @param {{
   * safeEventDispatcher?:      ISafeDispatcher,
   * validatedEventDispatcher?: IValidatedDispatcher,
   * logger?:                   Console|ILogger
   * }} deps
   */
  constructor({
    safeEventDispatcher,
    validatedEventDispatcher,
    logger = console,
  }) {
    super();

    if (safeEventDispatcher?.dispatchSafely) {
      this.#dispatcher = safeEventDispatcher;
      this.#isSafe = true;
    } else if (validatedEventDispatcher?.dispatchValidated) {
      this.#dispatcher = validatedEventDispatcher;
      this.#isSafe = false;
      (logger || console).warn(
        // Use provided logger if available
        'EventBusTurnEndAdapter: ISafeEventDispatcher not provided or invalid, ' +
          'falling back to IValidatedEventDispatcher. Dispatch errors may not be caught gracefully by the adapter.'
      );
    } else {
      throw new Error(
        'EventBusTurnEndAdapter: Requires a valid ISafeEventDispatcher (preferred) or IValidatedEventDispatcher.'
      );
    }

    this.#log = logger;
  }

  /**
   * Canonical method used by PlayerTurnHandler / TurnManager.
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
      this.#log.error(errMsg);
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
      if (this.#isSafe) {
        await this.#dispatcher.dispatchSafely(TURN_ENDED_ID, payload);
      } else {
        // Type assertion for IValidatedDispatcher if #isSafe is false
        await /** @type {IValidatedDispatcher} */ (
          this.#dispatcher
        ).dispatchValidated(TURN_ENDED_ID, payload);
      }
      this.#log.debug(
        `EventBusTurnEndAdapter: Successfully dispatched ${TURN_ENDED_ID} for ${entityId} with success=${isTurnSuccessful}.`
      );
    } catch (err) {
      this.#log.error(
        `EventBusTurnEndAdapter: Error dispatching ${TURN_ENDED_ID} for ${entityId}. Error: ${err.message}`,
        err
      );
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
