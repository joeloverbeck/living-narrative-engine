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
  #eventChainHistory = new Map(); // Track recent event chains to detect true infinite loops
  #chainHistoryLimit = 10; // Maximum chain history entries per event type
  #lastDispatchTime = 0; // Track last dispatch time for auto-reset

  // PERFORMANCE: Incremental counters for category-specific recursion totals
  // These avoid O(n) iteration over #recursionDepth on every dispatch
  #totalWorkflowRecursion = 0;
  #totalComponentRecursion = 0;
  #totalGeneralRecursion = 0;

  /**
   * Creates an EventBus instance.
   *
   * @param {{ logger?: ILogger, chainHistoryLimit?: number }} [deps] - Optional dependencies.
   * @param {number} [deps.chainHistoryLimit] - Overrides the history window used for infinite loop detection.
   */
  constructor({ logger = console, chainHistoryLimit } = {}) {
    super();
    this.#logger = logger;

    if (Number.isInteger(chainHistoryLimit) && chainHistoryLimit > 0) {
      this.#chainHistoryLimit = chainHistoryLimit;
    }
  }

  /**
   * Enables or disables batch mode for handling high-volume event processing.
   * Batch mode increases recursion limits to allow legitimate bulk operations.
   *
   * @param {boolean} enabled - Whether to enable batch mode
   * @param {object} [options] - Configuration options for batch mode
   * @param {number} [options.maxRecursionDepth] - Maximum recursion depth in batch mode
   * @param {number} [options.maxGlobalRecursion] - Maximum global recursion in batch mode
   * @param {number} [options.timeoutMs] - Auto-disable timeout in milliseconds
   * @param {string} [options.context] - Context description for logging
   */
  setBatchMode(enabled, options = {}) {
    const defaultOptions = {
      maxRecursionDepth: 10,
      maxGlobalRecursion: 25,
      timeoutMs: 30000,
      context: 'unknown',
    };

    if (enabled) {
      const mergedOptions = { ...defaultOptions, ...options };

      if (this.#batchMode) {
        const optionsChanged = this.#haveBatchOptionsChanged(
          this.#batchModeOptions,
          mergedOptions
        );

        // Update configuration while remaining in batch mode (nested contexts)
        this.#batchModeOptions = mergedOptions;

        this.#scheduleBatchModeTimeout(
          mergedOptions.timeoutMs,
          mergedOptions.context
        );

        if (optionsChanged) {
          this.#logger.debug(
            `EventBus: Batch mode configuration updated for context: ${mergedOptions.context}, ` +
              `maxRecursionDepth: ${mergedOptions.maxRecursionDepth}, ` +
              `maxGlobalRecursion: ${mergedOptions.maxGlobalRecursion}`
          );
        } else {
          this.#logger.debug(
            `EventBus: Batch mode timeout refreshed for context: ${mergedOptions.context}`
          );
        }
        return;
      }

      this.#batchModeOptions = mergedOptions;
      this.#batchMode = true;

      this.#scheduleBatchModeTimeout(
        mergedOptions.timeoutMs,
        mergedOptions.context
      );

      this.#logger.debug(
        `EventBus: Batch mode enabled for context: ${mergedOptions.context}, ` +
          `maxRecursionDepth: ${mergedOptions.maxRecursionDepth}, ` +
          `maxGlobalRecursion: ${mergedOptions.maxGlobalRecursion}`
      );
      return;
    }

    if (!this.#batchMode) {
      return; // Already disabled
    }

    // Disable batch mode
    this.#batchMode = false;

    this.#clearBatchModeTimeout();

    // Reset recursion depth counters when exiting batch mode
    // This prevents accumulated depth from batch operations affecting normal gameplay
    this.#recursionDepth.clear();
    this.#handlerExecutionDepth.clear();

    const context = this.#batchModeOptions?.context || 'unknown';
    this.#batchModeOptions = null;

    this.#logger.debug(
      `EventBus: Batch mode disabled for context: ${context}. Recursion depth counters reset.`
    );
  }

  /**
   * Resets recursion depth counters for all event types.
   * 
   * This method clears the accumulated recursion tracking state, which can build up
   * during normal gameplay even though events are separated by time. Call this between
   * game turns or at other logical boundaries to prevent false recursion warnings.
   * 
   * @public
   */
  resetRecursionCounters() {
    this.#recursionDepth.clear();
    this.#handlerExecutionDepth.clear();
    // PERFORMANCE: Reset incremental counters too
    this.#totalWorkflowRecursion = 0;
    this.#totalComponentRecursion = 0;
    this.#totalGeneralRecursion = 0;
    this.#logger.debug('EventBus: Recursion depth counters manually reset');
  }

  /**
   * Clears any scheduled batch mode auto-disable timer.
   *
   * @returns {void}
   */
  #clearBatchModeTimeout() {
    if (this.#batchModeTimeoutId) {
      clearTimeout(this.#batchModeTimeoutId);
      this.#batchModeTimeoutId = null;
    }
  }

  /**
   * Schedules the batch mode auto-disable timer with the provided configuration.
   *
   * @param {number} timeoutMs - Timeout in milliseconds before auto-disable.
   * @param {string} context - Context label for logging.
   * @returns {void}
   */
  #scheduleBatchModeTimeout(timeoutMs, context) {
    this.#clearBatchModeTimeout();

    if (Number.isFinite(timeoutMs) && timeoutMs > 0) {
      this.#batchModeTimeoutId = setTimeout(() => {
        this.#logger.debug(
          `EventBus: Auto-disabling batch mode after ${timeoutMs}ms timeout for context: ${context}`
        );
        this.setBatchMode(false);
      }, timeoutMs);
    }
  }

  /**
   * @description Determines whether the requested batch mode options differ from the current configuration.
   * @param {object|null} currentOptions - Previously applied batch mode options.
   * @param {object} newOptions - Incoming batch mode options.
   * @returns {boolean} True when options have changed and should trigger an update.
   */
  #haveBatchOptionsChanged(currentOptions, newOptions) {
    return (
      !currentOptions ||
      currentOptions.maxRecursionDepth !== newOptions.maxRecursionDepth ||
      currentOptions.maxGlobalRecursion !== newOptions.maxGlobalRecursion ||
      currentOptions.timeoutMs !== newOptions.timeoutMs ||
      currentOptions.context !== newOptions.context
    );
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
   * Gets context-aware timing thresholds for infinite loop detection.
   * Adjusts thresholds based on batch mode context and event type to allow
   * legitimate bulk operations while still catching true infinite loops.
   *
   * @param {string} eventName - The event being evaluated
   * @returns {{eventCount: number, timeSpanMs: number}} Timing thresholds
   */
  #getInfiniteLoopThresholds(eventName) {
    const isComponentLifecycleEvent =
      eventName === 'core:component_added' ||
      eventName === 'core:component_removed' ||
      eventName === 'core:entity_created';

    if (this.#batchMode && this.#batchModeOptions) {
      if (this.#batchModeOptions.context === 'game-initialization') {
        // During game initialization, allow much higher throughput for legitimate bulk operations
        return isComponentLifecycleEvent
          ? { eventCount: 50, timeSpanMs: 100 }
          : { eventCount: 20, timeSpanMs: 50 };
      } else {
        // Other batch contexts get moderate increases
        return isComponentLifecycleEvent
          ? { eventCount: 20, timeSpanMs: 50 }
          : { eventCount: 15, timeSpanMs: 40 };
      }
    }

    // Normal mode - component lifecycle events get slight increase due to cascading nature
    // Use higher thresholds than recursion limits to avoid interfering with recursion depth tests
    return isComponentLifecycleEvent
      ? { eventCount: 60, timeSpanMs: 100 }
      : { eventCount: 20, timeSpanMs: 50 };
  }

  /**
   * Tracks event chain history and detects potential infinite loops.
   * Returns true if the event appears to be part of a rapid infinite loop.
   * Uses context-aware thresholds to allow legitimate bulk operations.
   *
   * @param {string} eventName - The event being dispatched
   * @returns {boolean} True if this looks like an infinite loop
   */
  #detectInfiniteLoop(eventName) {
    const now = Date.now();

    // Get or create history for this event type
    if (!this.#eventChainHistory.has(eventName)) {
      this.#eventChainHistory.set(eventName, []);
    }

    const history = this.#eventChainHistory.get(eventName);

    // Add current timestamp
    history.push(now);

    // Keep only recent entries (last N events)
    if (history.length > this.#chainHistoryLimit) {
      history.splice(0, history.length - this.#chainHistoryLimit);
    }

    // Get context-aware thresholds for this event type
    const thresholds = this.#getInfiniteLoopThresholds(eventName);

    // Check for rapid repeated events (potential infinite loop)
    if (history.length >= thresholds.eventCount) {
      const recentEvents = history.slice(-thresholds.eventCount);
      const timeSpan = recentEvents[recentEvents.length - 1] - recentEvents[0];

      // Use context-aware thresholds instead of fixed limits
      if (timeSpan < thresholds.timeSpanMs) {
        return true;
      }
    }

    return false;
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
  async dispatch(eventName, eventPayload) {
    // Renamed second arg for clarity, added default
    if (!this.#validateEventName(eventName)) {
      return;
    }

    if (eventPayload === undefined || eventPayload === null) {
      eventPayload = {};
    }

    // Time-based auto-reset: Clear recursion counters if no dispatch in 5 seconds
    // This prevents accumulation across turns during normal gameplay
    const now = Date.now();
    const timeSinceLastDispatch = now - this.#lastDispatchTime;
    const AUTO_RESET_THRESHOLD_MS = 5000;

    if (timeSinceLastDispatch > AUTO_RESET_THRESHOLD_MS) {
      const hadEntries = this.#recursionDepth.size > 0 || this.#handlerExecutionDepth.size > 0;
      if (hadEntries) {
        this.#logger.debug(
          `EventBus: Auto-reset triggered (${timeSinceLastDispatch}ms since last dispatch). ` +
          `Clearing recursion counters.`
        );
        this.#recursionDepth.clear();
        this.#handlerExecutionDepth.clear();
        // PERFORMANCE: Reset incremental counters too
        this.#totalWorkflowRecursion = 0;
        this.#totalComponentRecursion = 0;
        this.#totalGeneralRecursion = 0;
      }
    }
    this.#lastDispatchTime = now;

    // Check handler execution depth to detect true recursion
    // This distinguishes between concurrent calls (allowed) and recursive calls (limited)
    const handlerDepth = this.#handlerExecutionDepth.get(eventName) || 0;
    const currentDepth = this.#recursionDepth.get(eventName) || 0;

    // We're only truly recursing if we're dispatching from within a handler (handlerDepth > 0)
    // const isActuallyRecursing = handlerDepth > 0; // Currently unused but kept for future reference

    // Don't treat error events as critical - they should be allowed to dispatch concurrently
    // Only actual deep recursion (beyond normal limits) should be blocked
    // Define workflow events that are part of legitimate game loops and should have higher limits
    const workflowEvents = new Set([
      'core:turn_started',
      'core:turn_processing_started',
      'core:turn_processing_ended',
      'core:turn_ended',
      'core:player_turn_prompt',
      'core:action_decided',
      'core:attempt_action',
    ]);

    // Define event-specific limits for legitimate cascading events
    const isComponentLifecycleEvent =
      eventName === 'core:component_added' ||
      eventName === 'core:component_removed' ||
      eventName === 'core:entity_created';

    const isWorkflowEvent = workflowEvents.has(eventName);

    // PERFORMANCE: Use cached incremental counters instead of O(n) iteration
    // These counters are maintained when recursion depth is incremented/decremented
    const totalGlobalRecursion = this.#totalGeneralRecursion;
    const workflowEventRecursion = this.#totalWorkflowRecursion;
    const componentEventRecursion = this.#totalComponentRecursion;

    // Determine recursion limits based on batch mode and event type
    let MAX_RECURSION_DEPTH;
    let MAX_GLOBAL_RECURSION;

    if (this.#batchMode && this.#batchModeOptions) {
      // In batch mode, use higher limits unless it's a critical event
      if (
        isComponentLifecycleEvent &&
        this.#batchModeOptions.context === 'game-initialization'
      ) {
        // Allow much higher recursion for component lifecycle events during game initialization
        // Increased to 300 to handle complex anatomy graphs with multiple characters (49 parts per character)
        // For 3 characters: ~50 parts × 3 characters × 1.5 (clothing) = ~225 events, 300 provides 33% buffer
        MAX_RECURSION_DEPTH = 300; // Allow deep component loading cascades for anatomy building
      } else if (isWorkflowEvent) {
        // Workflow events get higher individual limits
        MAX_RECURSION_DEPTH = 25; // Higher limit for workflow events
      } else {
        MAX_RECURSION_DEPTH = this.#batchModeOptions.maxRecursionDepth;
      }
      MAX_GLOBAL_RECURSION = this.#batchModeOptions.maxGlobalRecursion;
    } else {
      // Normal mode limits
      if (isComponentLifecycleEvent) {
        // Allow much higher limits for component lifecycle events during initialization
        // Complex entities can trigger many cascading component additions
        MAX_RECURSION_DEPTH = 100; // Increased from 50 to handle deep component hierarchies
      } else if (isWorkflowEvent) {
        // Workflow events get higher individual limits to allow game loops
        MAX_RECURSION_DEPTH = 20; // Allow reasonable turn cycling
      } else {
        MAX_RECURSION_DEPTH = 10; // Reduced limit for non-workflow events
      }
      // Much higher global limit, since workflow events are counted separately
      MAX_GLOBAL_RECURSION = 200; // Emergency limit for non-workflow events
    }

    // Progressive warnings at 50%, 75%, and 90% of limits
    const recursionWarningThresholds = [0.5, 0.75, 0.9];
    const globalWarningThresholds = [0.5, 0.75, 0.9];

    recursionWarningThresholds.forEach((threshold) => {
      const warningLevel = Math.floor(MAX_RECURSION_DEPTH * threshold);
      if (currentDepth === warningLevel && warningLevel > 0) {
        const batchContext = this.#batchMode
          ? ` (batch mode: ${this.#batchModeOptions.context})`
          : '';
        console.warn(
          `EventBus: Recursion depth warning - ${Math.round(threshold * 100)}% of limit reached ` +
            `for event "${eventName}" (${currentDepth}/${MAX_RECURSION_DEPTH})${batchContext}`
        );
      }
    });

    globalWarningThresholds.forEach((threshold) => {
      const warningLevel = Math.floor(MAX_GLOBAL_RECURSION * threshold);
      if (totalGlobalRecursion === warningLevel && warningLevel > 0) {
        const batchContext = this.#batchMode
          ? ` (batch mode: ${this.#batchModeOptions.context})`
          : '';
        console.warn(
          `EventBus: Global recursion warning - ${Math.round(threshold * 100)}% of limit reached ` +
            `(${totalGlobalRecursion}/${MAX_GLOBAL_RECURSION})${batchContext}. Current event: "${eventName}"`
        );
      }
    });

    // Check for potential infinite loops using timing-based detection
    const isInfiniteLoop = this.#detectInfiniteLoop(eventName);
    if (isInfiniteLoop) {
      const thresholds = this.#getInfiniteLoopThresholds(eventName);
      const batchContext = this.#batchMode
        ? ` (batch mode: ${this.#batchModeOptions.context})`
        : '';
      console.error(
        `EventBus: Potential infinite loop detected for event "${eventName}"${batchContext}. Events occurring too rapidly (>${thresholds.eventCount} in <${thresholds.timeSpanMs}ms). Dispatch blocked.`
      );
      return;
    }

    // Check recursion depth using normal limits (no special critical event handling)
    if (currentDepth >= MAX_RECURSION_DEPTH) {
      // Use console directly to avoid triggering more events
      const batchContext = this.#batchMode
        ? ` (batch mode: ${this.#batchModeOptions.context})`
        : '';

      // Enhanced error logging with event details
      const eventDetails = {
        eventName,
        payload: eventPayload,
        currentDepth,
        maxDepth: MAX_RECURSION_DEPTH,
        batchMode: this.#batchMode,
        context: this.#batchModeOptions?.context || 'normal',
      };

      console.error(
        `EventBus: Maximum recursion depth (${MAX_RECURSION_DEPTH}) exceeded for event "${eventName}"${batchContext}. Dispatch blocked to prevent infinite recursion.`,
        '\nLast event details that caused the recursion limit:',
        JSON.stringify(eventDetails, null, 2)
      );
      return;
    }

    if (totalGlobalRecursion >= MAX_GLOBAL_RECURSION) {
      // Global recursion limit exceeded - emergency stop (excluding workflow events)
      const batchContext = this.#batchMode
        ? ` (batch mode: ${this.#batchModeOptions.context})`
        : '';
      console.error(
        `EventBus: Global recursion limit (${MAX_GLOBAL_RECURSION}) exceeded for non-workflow/non-component events${batchContext}. Current event: "${eventName}" (workflow: ${isWorkflowEvent}, component: ${isComponentLifecycleEvent}). Regular recursion: ${totalGlobalRecursion}, workflow: ${workflowEventRecursion}, component: ${componentEventRecursion}. All event dispatching blocked.`
      );
      return;
    }

    // Additional emergency check for workflow events if they exceed an extreme limit
    if (isWorkflowEvent && workflowEventRecursion >= 100) {
      const batchContext = this.#batchMode
        ? ` (batch mode: ${this.#batchModeOptions.context})`
        : '';
      console.error(
        `EventBus: Extreme workflow event recursion (${workflowEventRecursion}) detected${batchContext}. Current event: "${eventName}". This may indicate a broken game loop. All event dispatching blocked.`
      );
      return;
    }

    // Additional emergency check for component lifecycle events if they exceed an extreme limit
    // Increased to 300 to account for higher normal limit of 200 during game initialization
    if (isComponentLifecycleEvent && componentEventRecursion >= 300) {
      const batchContext = this.#batchMode
        ? ` (batch mode: ${this.#batchModeOptions.context})`
        : '';
      console.error(
        `EventBus: Extreme component event recursion (${componentEventRecursion}) detected${batchContext}. Current event: "${eventName}". This may indicate an infinite component cascade. All event dispatching blocked.`
      );
      return;
    }

    // Track dispatch for circular reference detection (but don't increment recursion depth yet)
    const eventKey = `${eventName}-${Date.now()}-${Math.random()}`;
    this.#dispatchingEvents.add(eventKey);

    try {
      const specificListeners = this.#listeners.get(eventName) || new Set();
      const wildcardListeners = this.#listeners.get('*') || new Set();

      // PERFORMANCE: Avoid creating union Set when not needed
      // If no wildcard listeners, use specific listeners directly
      // If no specific listeners, use wildcard listeners directly
      let listenersToNotify;
      if (wildcardListeners.size === 0) {
        listenersToNotify = specificListeners;
      } else if (specificListeners.size === 0) {
        listenersToNotify = wildcardListeners;
      } else {
        // Only create union when both have listeners
        listenersToNotify = new Set([...specificListeners, ...wildcardListeners]);
      }

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

        // PERFORMANCE: Update incremental counters when recursion increases
        if (isWorkflowEvent) {
          this.#totalWorkflowRecursion++;
        } else if (isComponentLifecycleEvent) {
          this.#totalComponentRecursion++;
        } else {
          this.#totalGeneralRecursion++;
        }

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
                if (totalGlobalRecursion > 10) {
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

          // PERFORMANCE: Decrement incremental counters when recursion decreases
          if (isWorkflowEvent) {
            this.#totalWorkflowRecursion--;
          } else if (isComponentLifecycleEvent) {
            this.#totalComponentRecursion--;
          } else {
            this.#totalGeneralRecursion--;
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
