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

  /**
   * Reset the test timer service
   */
  #reset() {
    this.#pendingTimers = [];
    this.#activeTimers = new Map();
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
    const index = this.#pendingTimers.findIndex(t => t.id === timerId);
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
    // Process all currently pending timers
    const timersToProcess = [...this.#pendingTimers];
    this.#pendingTimers = [];
    
    for (const timer of timersToProcess) {
      // Skip if timer was cleared
      if (!this.#activeTimers.has(timer.id)) {
        continue;
      }
      
      // Remove from active timers before execution
      this.#activeTimers.delete(timer.id);
      
      // Execute the callback
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
  }

  /**
   * Trigger pending timers that should have fired by the given time
   *
   * @param {number} timeMs - Simulated time advancement in milliseconds
   * @returns {Promise<void>}
   */
  async advanceTime(timeMs) {
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
      
      // Execute the callback
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
   * Clear all pending timers
   */
  clearAll() {
    this.#reset();
  }
}

// Default instance for production use
export const defaultTimerService = new TimerService();