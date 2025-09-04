// src/events/eventBus.js

/**
 * A simple Event Bus for decoupled communication between systems using a publish/subscribe pattern.
 */
import { IEventBus } from '../interfaces/IEventBus.js';

/** @typedef {import('../interfaces/coreServices.js').ILogger} ILogger */

/**
 * Callback signature for event listeners used by the EventBus.
 *
 * @typedef {(event: {type: string, payload?: any}) => void | Promise<void>} EventListener
 */

class EventBus extends IEventBus {
  #listeners = new Map(); // Stores eventName -> Set<listenerFn>
  #logger;
  #dispatchingEvents = new Set(); // Track currently dispatching events to prevent recursion
  #recursionDepth = new Map(); // Track recursion depth per event type
  #handlerExecutionDepth = new Map(); // Track actual handler execution depth (true recursion)
  #batchMode = false; // Track if we're in batch loading mode
  #batchModeOptions = null; // Store batch mode configuration
  #batchModeTimeoutId = null; // Auto-disable timeout for safety

  /**
   * Creates an EventBus instance.
   *
   * @param {{ logger?: ILogger }} [deps] - Optional logger dependency.
   */
  constructor({ logger = console } = {}) {
    super();
    this.#logger = logger;
  }

  /**
   * Enables or disables batch mode for handling high-volume event processing.
   * Batch mode increases recursion limits to allow legitimate bulk operations.
   * 
   * @param {boolean} enabled - Whether to enable batch mode
   * @param {object} [options] - Configuration options for batch mode
   * @param {number} [options.maxRecursionDepth=10] - Maximum recursion depth in batch mode
   * @param {number} [options.maxGlobalRecursion=25] - Maximum global recursion in batch mode
   * @param {number} [options.timeoutMs=30000] - Auto-disable timeout in milliseconds
   * @param {string} [options.context='unknown'] - Context description for logging
   */
  setBatchMode(enabled, options = {}) {
    if (enabled === this.#batchMode) {
      return; // No change needed
    }

    if (enabled) {
      const defaultOptions = {
        maxRecursionDepth: 10,
        maxGlobalRecursion: 25,
        timeoutMs: 30000,
        context: 'unknown'
      };
      
      this.#batchModeOptions = { ...defaultOptions, ...options };
      this.#batchMode = true;
      
      // Safety timeout to auto-disable batch mode
      if (this.#batchModeTimeoutId) {
        clearTimeout(this.#batchModeTimeoutId);
      }
      
      this.#batchModeTimeoutId = setTimeout(() => {
        this.#logger.warn(
          `EventBus: Auto-disabling batch mode after ${this.#batchModeOptions.timeoutMs}ms timeout for context: ${this.#batchModeOptions.context}`
        );
        this.setBatchMode(false);
      }, this.#batchModeOptions.timeoutMs);
      
      this.#logger.debug(
        `EventBus: Batch mode enabled for context: ${this.#batchModeOptions.context}, ` +
        `maxRecursionDepth: ${this.#batchModeOptions.maxRecursionDepth}, ` +
        `maxGlobalRecursion: ${this.#batchModeOptions.maxGlobalRecursion}`
      );
    } else {
      // Disable batch mode
      this.#batchMode = false;
      
      if (this.#batchModeTimeoutId) {
        clearTimeout(this.#batchModeTimeoutId);
        this.#batchModeTimeoutId = null;
      }
      
      const context = this.#batchModeOptions?.context || 'unknown';
      this.#batchModeOptions = null;
      
      this.#logger.debug(`EventBus: Batch mode disabled for context: ${context}`);
    }
  }

  /**
   * Returns whether batch mode is currently enabled.
   * 
   * @returns {boolean} True if batch mode is enabled
   */
  isBatchModeEnabled() {
    return this.#batchMode;
  }

  /**
   * Gets the current batch mode options.
   * 
   * @returns {object|null} Current batch mode options or null if disabled
   */
  getBatchModeOptions() {
    return this.#batchModeOptions;
  }

  /**
   * Validates that an event name is a non-empty string.
   *
   * @param {string} name - The event name to validate.
   * @returns {boolean} True if the name is valid, false otherwise.
   */
  #validateEventName(name) {
    const isValid = typeof name === 'string' && name.length > 0;
    if (!isValid) {
      this.#logger.error('EventBus: Invalid event name provided.', name);
    }
    return isValid;
  }

  /**
   * Validates that the listener is a function.
   *
   * @param {*} listener - The listener to validate.
   * @returns {boolean} True if the listener is valid, false otherwise.
   */
  #validateListener(listener) {
    const isValid = typeof listener === 'function';
    if (!isValid) {
      this.#logger.error(
        'EventBus: Invalid listener provided. Expected a function.'
      );
    }
    return isValid;
  }

  /**
   * Subscribes a listener to a specific event.
   *
   * @param {string} eventName - The name of the event to subscribe to.
   * @param {EventListener} listener - Function to invoke when the event is dispatched.
   * @returns {(() => boolean) | null} An unsubscribe function on success, or `null` on failure.
   */
  subscribe(eventName, listener) {
    if (
      !this.#validateEventName(eventName) ||
      !this.#validateListener(listener)
    ) {
      return null;
    }

    if (!this.#listeners.has(eventName)) {
      this.#listeners.set(eventName, new Set());
    }
    this.#listeners.get(eventName).add(listener);

    return () => this.unsubscribe(eventName, listener);
  }

  /**
   * Unsubscribes a listener from a specific event.
   *
   * @param {string} eventName - The event identifier.
   * @param {EventListener} listener - The previously subscribed listener.
   * @returns {boolean} `true` if a listener was removed, otherwise `false`.
   */
  unsubscribe(eventName, listener) {
    if (
      !this.#validateEventName(eventName) ||
      !this.#validateListener(listener)
    ) {
      return false;
    }

    if (this.#listeners.has(eventName)) {
      const eventListeners = this.#listeners.get(eventName);
      const deleted = eventListeners.delete(listener);
      if (eventListeners.size === 0) {
        this.#listeners.delete(eventName);
      }
      return deleted;
    }
    return false;
  }

  /**
   * Dispatches an event, ASYNCHRONOUSLY calling all subscribed listeners for that specific event name
   * AND listeners subscribed to the wildcard ('*').
   * Waits for all listener promises to settle.
   *
   * @param {string} eventName - The name of the event to dispatch (becomes event.type).
   * @param {object} [eventPayload] - The data payload associated with the event (becomes event.payload). Defaults to empty object.
   * @returns {Promise<void>} A promise that resolves when all relevant listeners have been processed.
   */
  /**
   * Dispatches an event, ASYNCHRONOUSLY calling all subscribed listeners for that specific event name
   * AND listeners subscribed to the wildcard ('*').
   * Waits for all listener promises to settle.
   *
   * @param {string} eventName - The name of the event to dispatch (becomes event.type).
   * @param {object} [eventPayload] - The data payload associated with the event (becomes event.payload). Defaults to empty object.
   * @returns {Promise<void>} A promise that resolves when all relevant listeners have been processed.
   */
  async dispatch(eventName, eventPayload = {}) {
    // Renamed second arg for clarity, added default
    if (!this.#validateEventName(eventName)) {
      return;
    }

    // Check handler execution depth to detect true recursion
    // This distinguishes between concurrent calls (allowed) and recursive calls (limited)
    const handlerDepth = this.#handlerExecutionDepth.get(eventName) || 0;
    const currentDepth = this.#recursionDepth.get(eventName) || 0;
    
    // We're only truly recursing if we're dispatching from within a handler (handlerDepth > 0)
    const isActuallyRecursing = handlerDepth > 0;
    
    // Don't treat error events as critical - they should be allowed to dispatch concurrently
    // Only actual deep recursion (beyond normal limits) should be blocked
    const isCriticalEvent = false; // Removed critical event classification for error events
    
    // Global recursion check - sum all current recursion depths
    const totalGlobalRecursion = Array.from(this.#recursionDepth.values()).reduce((sum, depth) => sum + depth, 0);
    
    // Determine recursion limits based on batch mode and event type
    let MAX_RECURSION_DEPTH;
    let MAX_GLOBAL_RECURSION;
    
    if (this.#batchMode && this.#batchModeOptions) {
      // In batch mode, use higher limits unless it's a critical event
      MAX_RECURSION_DEPTH = isCriticalEvent ? 1 : this.#batchModeOptions.maxRecursionDepth;
      MAX_GLOBAL_RECURSION = this.#batchModeOptions.maxGlobalRecursion;
    } else {
      // Normal mode limits - increased to allow more concurrent dispatches
      MAX_RECURSION_DEPTH = isCriticalEvent ? 1 : 15; // Increased from 3 to 15 for concurrent operations
      MAX_GLOBAL_RECURSION = 50; // Increased from 10 to 50 for bulk operations
    }
    
    // Progressive warnings at 50%, 75%, and 90% of limits
    const recursionWarningThresholds = [0.5, 0.75, 0.9];
    const globalWarningThresholds = [0.5, 0.75, 0.9];
    
    recursionWarningThresholds.forEach(threshold => {
      const warningLevel = Math.floor(MAX_RECURSION_DEPTH * threshold);
      if (currentDepth === warningLevel && warningLevel > 0) {
        const batchContext = this.#batchMode ? ` (batch mode: ${this.#batchModeOptions.context})` : '';
        console.warn(
          `EventBus: Recursion depth warning - ${Math.round(threshold * 100)}% of limit reached ` +
          `for event "${eventName}" (${currentDepth}/${MAX_RECURSION_DEPTH})${batchContext}`
        );
      }
    });
    
    globalWarningThresholds.forEach(threshold => {
      const warningLevel = Math.floor(MAX_GLOBAL_RECURSION * threshold);
      if (totalGlobalRecursion === warningLevel && warningLevel > 0) {
        const batchContext = this.#batchMode ? ` (batch mode: ${this.#batchModeOptions.context})` : '';
        console.warn(
          `EventBus: Global recursion warning - ${Math.round(threshold * 100)}% of limit reached ` +
          `(${totalGlobalRecursion}/${MAX_GLOBAL_RECURSION})${batchContext}. Current event: "${eventName}"`
        );
      }
    });
    
    // Check recursion depth using normal limits (no special critical event handling)
    if (currentDepth >= MAX_RECURSION_DEPTH) {
      // Use console directly to avoid triggering more events
      const batchContext = this.#batchMode ? ` (batch mode: ${this.#batchModeOptions.context})` : '';
      console.error(
        `EventBus: Maximum recursion depth (${MAX_RECURSION_DEPTH}) exceeded for event "${eventName}"${batchContext}. Dispatch blocked to prevent infinite recursion.`
      );
      return;
    }

    if (totalGlobalRecursion >= MAX_GLOBAL_RECURSION) {
      // Global recursion limit exceeded - emergency stop
      const batchContext = this.#batchMode ? ` (batch mode: ${this.#batchModeOptions.context})` : '';
      console.error(
        `EventBus: Global recursion limit (${MAX_GLOBAL_RECURSION}) exceeded${batchContext}. Current event: "${eventName}". All event dispatching blocked.`
      );
      return;
    }

    // Track dispatch for circular reference detection (but don't increment recursion depth yet)
    const eventKey = `${eventName}-${Date.now()}-${Math.random()}`;
    this.#dispatchingEvents.add(eventKey);

    try {
      const specificListeners = this.#listeners.get(eventName) || new Set();
      const wildcardListeners = this.#listeners.get('*') || new Set();
      const listenersToNotify = new Set([
        ...specificListeners,
        ...wildcardListeners,
      ]);

      if (listenersToNotify.size > 0) {
        // Construct the full event object expected by listeners like #handleEvent
        const eventObject = {
          type: eventName,
          payload: eventPayload,
        };

        const listenersArray = Array.from(listenersToNotify);
        
        // NOW increment recursion depth since we're about to execute handlers
        // This is where actual recursion could occur
        this.#recursionDepth.set(eventName, currentDepth + 1);
        
        // Increment handler execution depth to track true recursion
        // This is crucial for detecting actual recursion vs concurrent dispatches
        this.#handlerExecutionDepth.set(eventName, handlerDepth + 1);

        try {
          await Promise.all(
            listenersArray.map(async (listener) => {
              try {
                // Pass the constructed event object, not just the payload
                await listener(eventObject);
              } catch (error) {
                // Enhanced error handling - always use console for any event that might trigger recursion
                if (isCriticalEvent || totalGlobalRecursion > 5) {
                  // Already handling critical events or high recursion - use console directly
                  console.error(
                    `EventBus: Error in "${eventName}" listener (using console to prevent recursion):`,
                    error
                  );
                } else {
                  // For regular events with low recursion, still use logger but monitor recursion
                  try {
                    this.#logger.error(
                      `EventBus: Error executing listener for event "${eventName}":`,
                      error
                    );
                  } catch (loggerError) {
                    // Logger itself failed - fallback to console
                    console.error(
                      `EventBus: Logger failed while handling error in "${eventName}" listener. Original error:`,
                      error,
                      'Logger error:',
                      loggerError
                    );
                  }
                }
              }
            })
          );
        } finally {
          // Restore handler execution depth
          if (handlerDepth <= 0) {
            this.#handlerExecutionDepth.delete(eventName);
          } else {
            this.#handlerExecutionDepth.set(eventName, handlerDepth);
          }
          
          // Restore recursion depth after handlers complete
          if (currentDepth <= 0) {
            this.#recursionDepth.delete(eventName);
          } else {
            this.#recursionDepth.set(eventName, currentDepth);
          }
        }
      }
    } finally {
      // Clean up tracking
      this.#dispatchingEvents.delete(eventKey);
    }
  }

  /**
   * Returns the number of listeners currently subscribed to a specific event
   * (excluding wildcard listeners unless eventName is '*').
   *
   * @param {string} eventName - The name of the event.
   * @returns {number} The number of listeners for the given event name. Returns 0 if the event has no listeners or the event name is invalid.
   */
  listenerCount(eventName) {
    if (!this.#validateEventName(eventName)) {
      return 0;
    }

    return this.#listeners.get(eventName)?.size || 0;
  }
}

export default EventBus;
