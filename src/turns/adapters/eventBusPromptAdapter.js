// src/turns/adapters/eventBusPromptAdapter.js
// --- FILE START ---

import { IPromptOutputPort } from '../ports/IPromptOutputPort.js';
/* eslint-disable no-console */

// --- Type Imports for JSDoc ---
/** @typedef {import('../../interfaces/ISafeEventDispatcher.js').ISafeEventDispatcher} ISafeEventDispatcher */
/** @typedef {import('../../interfaces/IValidatedEventDispatcher.js').IValidatedEventDispatcher} IValidatedEventDispatcher */
/** @typedef {import('../ports/commonTypes.js').DiscoveredActionInfo} DiscoveredActionInfo */

/**
 * @class EventBusPromptAdapter
 * @implements {IPromptOutputPort}
 * @description Implements the IPromptOutputPort by dispatching a 'core:player_turn_prompt'
 * event via a Safe Event Dispatcher (preferred) or a Validated Event Dispatcher.
 */
export class EventBusPromptAdapter extends IPromptOutputPort {
  /**
   * @private
   * @type {ISafeEventDispatcher | IValidatedEventDispatcher}
   */
  #dispatcher;

  /**
   * @private
   * @type {boolean} - Flag indicating if the injected dispatcher is safe.
   */
  #isSafeDispatcher;

  /**
   * Creates an instance of EventBusPromptAdapter.
   * Prefers ISafeEventDispatcher if available.
   *
   * @param {object} dependencies - The dependencies required by the adapter.
   * @param {ISafeEventDispatcher} [dependencies.safeEventDispatcher] - The preferred safe dispatcher.
   * @param {IValidatedEventDispatcher} [dependencies.validatedEventDispatcher] - Fallback VED.
   * @throws {Error} If neither safeEventDispatcher nor validatedEventDispatcher is provided or valid.
   */
  constructor({ safeEventDispatcher, validatedEventDispatcher }) {
    super();
    if (
      safeEventDispatcher &&
      typeof safeEventDispatcher.dispatch === 'function'
    ) {
      this.#dispatcher = safeEventDispatcher;
      this.#isSafeDispatcher = true;
    } else if (
      validatedEventDispatcher &&
      typeof validatedEventDispatcher.dispatch === 'function'
    ) {
      this.#dispatcher = validatedEventDispatcher;
      this.#isSafeDispatcher = false;
      // Optional: Log a warning if falling back to VED
      console.warn(
        'EventBusPromptAdapter: ISafeEventDispatcher not provided or invalid, falling back to IValidatedEventDispatcher. Dispatch errors may not be caught gracefully by the adapter.'
      );
    } else {
      throw new Error(
        'EventBusPromptAdapter: Requires a valid ISafeEventDispatcher (preferred) or IValidatedEventDispatcher.'
      );
    }
  }

  /**
   * Sends a prompt by dispatching the 'core:player_turn_prompt' event.
   *
   * @async
   * @param {string} entityId - The unique ID of the player entity being prompted.
   * @param {DiscoveredActionInfo[]} availableActions - An array of objects describing the actions.
   * @param {string} [error] - An optional error message.
   * @returns {Promise<void>} Resolves after the dispatch attempt. Does not typically propagate dispatch success/failure unless VED throws uncaught.
   * @throws {Error} Only if using VED directly and `dispatch` throws an unhandled error.
   */
  async prompt(entityId, availableActions, error) {
    // Basic validation
    if (typeof entityId !== 'string' || !entityId) {
      console.error('EventBusPromptAdapter.prompt: Invalid entityId provided.');
      // Decide on behavior: throw, return, or log and proceed?
      // For robustness, often better to log and attempt dispatch anyway, or throw early.
      throw new Error(
        'EventBusPromptAdapter.prompt: entityId must be a non-empty string.'
      );
    }
    if (!Array.isArray(availableActions)) {
      console.error(
        'EventBusPromptAdapter.prompt: availableActions must be an array.'
      );
      throw new Error(
        'EventBusPromptAdapter.prompt: availableActions must be an array.'
      );
    }

    /** @type {import('../handlers/playerTurnHandler.js').PlayerTurnPromptPayload} */
    const payload = {
      entityId,
      availableActions,
      // Only include error property if it's a non-empty string
      ...(error &&
        typeof error === 'string' &&
        error.trim() !== '' && { error }),
    };

    if (this.#isSafeDispatcher) {
      // Using ISafeEventDispatcher - it handles logging errors internally
      // We don't need to await the boolean result unless downstream specifically needs it.
      // Returning Promise<void> after the *attempt* is usually sufficient.
      await /** @type {ISafeEventDispatcher} */ (this.#dispatcher).dispatch(
        'core:player_turn_prompt',
        payload
      );
      return Promise.resolve(); // Resolve void after attempt
    } else {
      // Using IValidatedEventDispatcher directly
      try {
        await /** @type {IValidatedEventDispatcher} */ (
          this.#dispatcher
        ).dispatch('core:player_turn_prompt', payload);
        return Promise.resolve(); // Resolve void after successful dispatch
      } catch (dispatchError) {
        // If VED throws, log it and re-throw? Or just log?
        // Ticket suggests Promise<void> that resolves after attempt is sufficient,
        // meaning we might just log and resolve here. However, re-throwing indicates
        // a potentially critical failure in the event system. Let's log and re-throw.
        console.error(
          `EventBusPromptAdapter: Error dispatching 'core:player_turn_prompt' via VED: ${dispatchError.message}`,
          dispatchError
        );
        throw dispatchError; // Propagate critical VED errors
      }
    }
  }
}

// --- FILE END ---
