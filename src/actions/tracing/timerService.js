/**
 * @file Timer service abstraction for better testability
 * @see traceQueueProcessor.js
 */

/**
 * Base timer service that wraps native timer functions
 * This abstraction allows for easy mocking in tests
 */
export class TimerService {
  /**
   * Schedule a callback to be executed after a delay
   *
   * @param {Function} callback - Function to execute
   * @param {number} delay - Delay in milliseconds
   * @returns {number|NodeJS.Timeout} Timer ID for cancellation
   */
  setTimeout(callback, delay) {
    return setTimeout(callback, delay);
  }

  /**
   * Clear a scheduled timeout
   *
   * @param {number|NodeJS.Timeout} timerId - Timer ID to clear
   */
  clearTimeout(timerId) {
    if (timerId) {
      clearTimeout(timerId);
    }
  }
}

/**
 * Test timer service for controlled execution in tests
 * Allows manual triggering of scheduled callbacks
 */
export class TestTimerService extends TimerService {
  constructor() {
    super();
    this.#reset();
  }

  #pendingTimers;
  #nextId;
  #activeTimers;
  #runningCallbacks;
  #isProcessingBatch;

  /**
   * Reset the test timer service
   */
  #reset() {
    this.#pendingTimers = [];
    this.#activeTimers = new Map();
    this.#runningCallbacks = new Set();
    this.#isProcessingBatch = false;
    this.#nextId = 1;
  }

  /**
   * Schedule a callback (stores it for manual triggering)
   *
   * @param {Function} callback - Function to execute
   * @param {number} delay - Delay in milliseconds (stored but not enforced)
   * @returns {number} Timer ID for cancellation
   */
  setTimeout(callback, delay) {
    const id = this.#nextId++;
    const timer = { id, callback, delay, createdAt: Date.now() };

    this.#pendingTimers.push(timer);
    this.#activeTimers.set(id, timer);

    return id;
  }

  /**
   * Clear a scheduled timeout
   *
   * @param {number} timerId - Timer ID to clear
   */
  clearTimeout(timerId) {
    if (!timerId) return;

    // Remove from active timers
    this.#activeTimers.delete(timerId);

    // Remove from pending timers
    const index = this.#pendingTimers.findIndex((t) => t.id === timerId);
    if (index !== -1) {
      this.#pendingTimers.splice(index, 1);
    }
  }

  /**
   * Trigger all pending timers immediately
   * Useful for testing immediate execution scenarios
   *
   * @returns {Promise<void>}
   */
  async triggerAll() {
    // Prevent recursive calls during batch processing
    if (this.#isProcessingBatch) {
      return;
    }

    this.#isProcessingBatch = true;

    try {
      let iterationCount = 0;
      const maxIterations = 100; // Prevent infinite loops

      // Keep processing until no more timers are created
      while (this.#pendingTimers.length > 0 && iterationCount < maxIterations) {
        // Process all currently pending timers (snapshot)
        const timersToProcess = [...this.#pendingTimers];
        this.#pendingTimers = [];

        for (const timer of timersToProcess) {
          // Skip if timer was cleared
          if (!this.#activeTimers.has(timer.id)) {
            continue;
          }

          // Remove from active timers before execution
          this.#activeTimers.delete(timer.id);

          // Execute the callback and track it
          const callbackPromise = this.#executeCallback(timer);
          this.#runningCallbacks.add(callbackPromise);

          try {
            await callbackPromise;
          } finally {
            this.#runningCallbacks.delete(callbackPromise);
          }
        }

        iterationCount++;
      }

      // Wait for any remaining callbacks to finish
      if (this.#runningCallbacks.size > 0) {
        await Promise.allSettled([...this.#runningCallbacks]);
      }

      if (iterationCount >= maxIterations) {
        console.warn('TestTimerService: Maximum trigger iterations reached, may have pending operations');
      }
    } finally {
      this.#isProcessingBatch = false;
    }
  }

  /**
   * Execute a callback and handle the result properly
   *
   * @private
   * @param {object} timer - Timer object with callback
   * @returns {Promise<void>}
   */
  async #executeCallback(timer) {
    try {
      const result = timer.callback();
      // If callback returns a promise, await it
      if (result && typeof result.then === 'function') {
        await result;
      }
    } catch (error) {
      // Log but don't throw - mimics setTimeout behavior
      console.error('Timer callback error:', error);
    }
  }

  /**
   * Trigger pending timers that should have fired by the given time
   *
   * @param {number} timeMs - Simulated time advancement in milliseconds
   * @returns {Promise<void>}
   */
  async advanceTime(timeMs) {
    if (this.#isProcessingBatch) {
      return;
    }

    this.#isProcessingBatch = true;

    try {
      const timersToProcess = [];
      const remainingTimers = [];

      for (const timer of this.#pendingTimers) {
        // Always process immediate timers (delay 0) or timers whose delay has elapsed
        if (timer.delay === 0 || timer.delay <= timeMs) {
          timersToProcess.push(timer);
        } else {
          // For non-immediate timers, reduce their remaining delay
          timer.delay -= timeMs;
          remainingTimers.push(timer);
        }
      }

      this.#pendingTimers = remainingTimers;

      // Process timers that should fire
      for (const timer of timersToProcess) {
        // Skip if timer was cleared
        if (!this.#activeTimers.has(timer.id)) {
          continue;
        }

        // Remove from active timers before execution
        this.#activeTimers.delete(timer.id);

        // Execute the callback and track it
        const callbackPromise = this.#executeCallback(timer);
        this.#runningCallbacks.add(callbackPromise);

        try {
          await callbackPromise;
        } finally {
          this.#runningCallbacks.delete(callbackPromise);
        }
      }

      // Wait for any remaining callbacks to finish
      if (this.#runningCallbacks.size > 0) {
        await Promise.allSettled([...this.#runningCallbacks]);
      }
    } finally {
      this.#isProcessingBatch = false;
    }
  }

  /**
   * Get count of pending timers
   *
   * @returns {number} Number of pending timers
   */
  getPendingCount() {
    return this.#pendingTimers.length;
  }

  /**
   * Check if there are any pending timers
   *
   * @returns {boolean} True if there are pending timers
   */
  hasPending() {
    return this.#pendingTimers.length > 0;
  }

  /**
   * Check if the timer service is currently processing callbacks
   *
   * @returns {boolean} True if processing is in progress
   */
  isProcessing() {
    return this.#isProcessingBatch || this.#runningCallbacks.size > 0;
  }

  /**
   * Wait for all running callbacks to complete
   *
   * @returns {Promise<void>}
   */
  async waitForCompletion() {
    let attempts = 0;
    const maxAttempts = 50;

    while (this.isProcessing() && attempts < maxAttempts) {
      if (this.#runningCallbacks.size > 0) {
        await Promise.allSettled([...this.#runningCallbacks]);
      }
      // Small delay to allow any new callbacks to be registered
      await new Promise(resolve => setTimeout(resolve, 10));
      attempts++;
    }

    if (attempts >= maxAttempts) {
      console.warn(`TestTimerService waitForCompletion: Max attempts reached. Running: ${this.#runningCallbacks.size}, Pending: ${this.#pendingTimers.length}`);
    }
  }

  /**
   * Get count of currently running callbacks
   *
   * @returns {number} Number of running callbacks
   */
  getRunningCount() {
    return this.#runningCallbacks.size;
  }

  /**
   * Clear all pending timers
   */
  clearAll() {
    this.#reset();
  }
}

// Default instance for production use
export const defaultTimerService = new TimerService();
