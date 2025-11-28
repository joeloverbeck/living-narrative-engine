// src/turns/utils/cancellablePrimitives.js
/**
 * @file Cancellable primitive helpers for async coordination with AbortController.
 *
 * Provides utilities for creating cancellable timeouts and event-based promises
 * that integrate with AbortController for deterministic cleanup.
 * @see src/turns/states/awaitingExternalTurnEndState.js - Primary consumer
 */

/**
 * Sentinel value returned by createCancellableTimeout when the timeout elapses.
 * Use this to distinguish timeout resolution from event resolution in Promise.race.
 *
 * @type {symbol}
 */
export const TIMEOUT_SENTINEL = Symbol('TIMEOUT');

/**
 * Creates a cancellable timeout that resolves to TIMEOUT_SENTINEL.
 *
 * The returned promise:
 * - Resolves to TIMEOUT_SENTINEL after `ms` milliseconds
 * - Rejects with AbortError if the signal is aborted before timeout
 * - Properly clears the timeout on abort to prevent memory leaks
 *
 * @param {number} ms - Timeout duration in milliseconds
 * @param {AbortSignal} signal - Abort signal for cancellation
 * @returns {Promise<symbol>} Resolves to TIMEOUT_SENTINEL or rejects if aborted
 * @example
 * const controller = new AbortController();
 * const timeoutPromise = createCancellableTimeout(5000, controller.signal);
 *
 * // Later, to cancel:
 * controller.abort();
 */
export function createCancellableTimeout(ms, signal) {
  return new Promise((resolve, reject) => {
    // If already aborted, reject immediately
    if (signal.aborted) {
      reject(new DOMException('Aborted', 'AbortError'));
      return;
    }

    const timeoutId = setTimeout(() => resolve(TIMEOUT_SENTINEL), ms);

    // Listen for abort to clear the timeout
    signal.addEventListener(
      'abort',
      () => {
        clearTimeout(timeoutId);
        reject(new DOMException('Aborted', 'AbortError'));
      },
      { once: true }
    );
  });
}

/**
 * Creates a promise that resolves when the specified event is received.
 *
 * The returned promise:
 * - Resolves with the event object when an event matching the filter is received
 * - Rejects with AbortError if the signal is aborted before event reception
 * - Automatically unsubscribes from the event on resolution or abort
 *
 * @param {object} dispatcher - SafeEventDispatcher instance with subscribe method
 * @param {string} eventId - Event ID to listen for
 * @param {function(object): boolean} filter - Predicate to filter events (return true to resolve)
 * @param {AbortSignal} signal - Abort signal for cancellation
 * @returns {Promise<object>} Resolves with the matching event object
 * @example
 * const controller = new AbortController();
 * const eventPromise = createEventPromise(
 *   dispatcher,
 *   'core:turn_ended',
 *   (event) => event.payload?.entityId === actorId,
 *   controller.signal
 * );
 */
export function createEventPromise(dispatcher, eventId, filter, signal) {
  return new Promise((resolve, reject) => {
    // If already aborted, reject immediately
    if (signal.aborted) {
      reject(new DOMException('Aborted', 'AbortError'));
      return;
    }

    let unsubscribe = null;
    let resolved = false;

    // Subscribe to the event
    unsubscribe = dispatcher.subscribe(eventId, (event) => {
      if (!resolved && filter(event)) {
        resolved = true;
        if (unsubscribe) {
          unsubscribe();
        }
        resolve(event);
      }
    });

    // Listen for abort to unsubscribe
    signal.addEventListener(
      'abort',
      () => {
        if (!resolved && unsubscribe) {
          unsubscribe();
        }
        reject(new DOMException('Aborted', 'AbortError'));
      },
      { once: true }
    );
  });
}
