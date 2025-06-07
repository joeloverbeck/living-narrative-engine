/**
 * @file Implements the AlertRouter class, which routes system warning and error events
 * to the UI or console depending on UI readiness.
 * @see src/alerting/alertRouter.js
 */

import {
  SYSTEM_ERROR_OCCURRED_ID,
  SYSTEM_WARNING_OCCURRED_ID,
} from '../constants/eventIds.js';

/**
 * @class
 * @description
 * The AlertRouter subscribes immediately to `core:system_warning_occurred`
 * and SYSTEM_ERROR_OCCURRED_ID. If the UI is not yet ready (i.e. ChatAlertRenderer
 * has not called `notifyUIReady()`), it queues incoming events and starts a 5-second
 * timer. If, after 5 seconds, `notifyUIReady()` still hasn’t been called, it dumps all
 * queued events to the console (`console.warn` for warnings, `console.error` for errors).
 * Once `notifyUIReady()` is invoked, it cancels any pending timer, forwards all queued
 * events as `"core:display_warning"` or `"core:display_error"`, clears the queue, and sets
 * `uiReady = true`. After that, any new incoming events are forwarded immediately.
 *
 * All internal operations are wrapped in `try/catch` to avoid crashes; exceptions
 * are logged via `console.error(...)`.
 * @param {import('../interfaces/ISafeEventDispatcher.js').ISafeEventDispatcher} dispatcher
 * An instance of `SafeEventDispatcher` used to subscribe to core events and dispatch UI events.
 */
export default class AlertRouter {
  /**
   * Creates an AlertRouter and immediately subscribes to core warning/error events.
   *
   * @param {object} dependencies - The dependency object.
   * @param {import('../interfaces/ISafeEventDispatcher.js').ISafeEventDispatcher} dependencies.safeEventDispatcher
   * The resolved safe event dispatcher instance.
   */
  constructor({ safeEventDispatcher }) {
    /** @private */
    this.dispatcher = safeEventDispatcher;
    /** @private {Array<{ name: string, payload: any, timestamp: string }>} */
    this.queue = [];
    /** @private {boolean} */
    this.uiReady = false;
    /** @private {NodeJS.Timeout|null} */
    this.flushTimer = null;

    try {
      // --- FIX START ---
      // The issue is that the event dispatcher passes a full event object
      // (e.g., { name, payload }) to the subscriber. The original code
      // incorrectly treated this entire object as the payload.
      //
      // The fix is to subscribe with a handler that correctly unnests
      // the `payload` property from the received event object before passing
      // it to `handleEvent`.

      this.dispatcher.subscribe(SYSTEM_WARNING_OCCURRED_ID, (eventObject) => {
        // Pass the actual application payload (eventObject.payload) to the handler
        this.handleEvent(SYSTEM_WARNING_OCCURRED_ID, eventObject.payload);
      });
      this.dispatcher.subscribe(SYSTEM_ERROR_OCCURRED_ID, (eventObject) => {
        // Pass the actual application payload (eventObject.payload) to the handler
        this.handleEvent(SYSTEM_ERROR_OCCURRED_ID, eventObject.payload);
      });
      // --- FIX END ---
    } catch (err) {
      console.error('AlertRouter subscription error:', err);
    }
  }

  /**
   * Handles an incoming core event. If UI is not ready, enqueue it;
   * otherwise forward immediately.
   *
   * @private
   * @param {string} name
   * Either SYSTEM_WARNING_OCCURRED_ID or SYSTEM_ERROR_OCCURRED_ID.
   * @param {object} payload
   * Expected to contain a `message` property.
   */
  handleEvent(name, payload) {
    try {
      if (!this.uiReady) {
        // Enqueue the event
        this.queue.push({
          name,
          payload,
          timestamp: new Date().toISOString(),
        });
        // If this is the first item in an empty queue, start the 5s flush timer
        if (this.queue.length === 1) {
          this.startFlushTimer();
        }
      } else {
        // UI already ready → forward immediately
        this.forwardToUI(name, payload);
      }
    } catch (err) {
      console.error('AlertRouter error:', err);
    }
  }

  /**
   * Starts a 5-second timer that will flush all queued events to console
   * if `notifyUIReady()` is not called within 5 seconds.
   *
   * @private
   */
  startFlushTimer() {
    this.flushTimer = setTimeout(() => {
      try {
        this.queue.forEach((evt) => {
          try {
            const { name, payload } = evt;
            const message =
              payload && typeof payload.message === 'string'
                ? payload.message
                : undefined;
            if (message === undefined) {
              // Malformed payload: no 'message' string
              throw new Error('Missing or invalid `message` in payload');
            }
            if (name === SYSTEM_WARNING_OCCURRED_ID) {
              console.warn(message);
            } else if (name === SYSTEM_ERROR_OCCURRED_ID) {
              console.error(message);
            }
          } catch (innerErr) {
            // Any individual event‐processing error is caught here
            console.error('AlertRouter flush error:', innerErr);
          }
        });
      } catch (err) {
        console.error('AlertRouter flush error:', err);
      } finally {
        // Clear the queue and indicate no timer is active
        this.queue = [];
        this.flushTimer = null;
      }
    }, 5000);
  }

  /**
   * Cancels any pending flush timer, re-dispatches all queued events to the UI
   * as "core:display_warning" or "core:display_error", then clears the queue and
   * marks the router as ready for immediate forwarding.
   */
  notifyUIReady() {
    if (this.flushTimer) {
      clearTimeout(this.flushTimer);
      this.flushTimer = null;
    }
    // Forward everything that was queued
    this.queue.forEach((evt) => {
      try {
        this.forwardToUI(evt.name, evt.payload);
      } catch (err) {
        console.error('AlertRouter error forwarding queued event:', err);
      }
    });
    this.queue = [];
    this.uiReady = true;
  }

  /**
   * Translates a core event into a UI event and dispatches it.
   *
   * @private
   * @param {string} name
   * Either SYSTEM_WARNING_OCCURRED_ID or SYSTEM_ERROR_OCCURRED_ID.
   * @param {object} payload
   */
  forwardToUI(name, payload) {
    try {
      const uiEvent =
        name === SYSTEM_WARNING_OCCURRED_ID
          ? 'core:display_warning'
          : 'core:display_error';
      this.dispatcher.dispatch(uiEvent, payload);
    } catch (err) {
      console.error('AlertRouter dispatch error:', err);
    }
  }
}
