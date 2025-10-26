/**
 * @file Safe error logging utility that prevents infinite recursion during error logging
 * @see eventBus.js, infiniteRecursionPrevention.test.js
 */

import { ensureValidLogger } from './loggerUtils.js';

/**
 * @typedef {import('../interfaces/coreServices.js').ILogger} ILogger
 * @typedef {import('../interfaces/ISafeEventDispatcher.js').ISafeEventDispatcher} ISafeEventDispatcher
 */

/**
 * Creates a safe error logger that can prevent infinite recursion when logging
 * errors that might trigger more events. This is particularly useful during
 * game loading when many components are being added simultaneously.
 *
 * @param {object} deps - Dependencies
 * @param {ILogger} deps.logger - Logger instance
 * @param {ISafeEventDispatcher} deps.safeEventDispatcher - SafeEventDispatcher instance for batch mode management
 * @param {object} [deps.eventBus] - EventBus instance (deprecated - use safeEventDispatcher)
 * @returns {object} Safe error logging utilities
 */
const HIGH_VOLUME_CONTEXTS = new Set(['game-initialization', 'game-load']);

export function createSafeErrorLogger({
  logger,
  safeEventDispatcher,
  eventBus,
}) {
  const safeLogger = ensureValidLogger(logger, 'SafeErrorLogger');

  // Support both parameter names for backward compatibility
  // Prefer safeEventDispatcher if provided, otherwise use eventBus
  const dispatcher = safeEventDispatcher || eventBus;

  if (!dispatcher) {
    throw new Error(
      'SafeErrorLogger requires either safeEventDispatcher or eventBus parameter'
    );
  }

  /**
   * Tracks if we're currently in a game loading phase.
   * This helps auto-enable batch mode during legitimate bulk operations.
   */
  let isGameLoading = false;
  /** @type {ReturnType<typeof setTimeout> | null} */
  let loadingTimeoutId = null;
  let outermostStartTime = null;
  /**
   * Tracks nested loading contexts so we can restore configuration when exiting.
   * @type {Array<{options: {context: string, timeoutMs: number}, config: {maxRecursionDepth: number, maxGlobalRecursion: number, timeoutMs: number, context: string}}>} */
  const loadingContextStack = [];

  const clearExistingTimeout = () => {
    if (loadingTimeoutId) {
      clearTimeout(loadingTimeoutId);
      loadingTimeoutId = null;
    }
  };

  const scheduleAutoDisable = (timeoutMs, contextLabel) => {
    clearExistingTimeout();

    if (!(Number.isFinite(timeoutMs) && timeoutMs > 0)) {
      return;
    }

    loadingTimeoutId = setTimeout(() => {
      safeLogger.debug(
        `SafeErrorLogger: Auto-disabling game loading mode after ${timeoutMs}ms timeout (context: ${contextLabel})`
      );
      disableGameLoadingMode({ force: true, reason: 'timeout' });
    }, timeoutMs);
  };

  const restorePreviousContext = () => {
    const previousContext = loadingContextStack[loadingContextStack.length - 1];
    if (!previousContext) {
      return;
    }

    dispatcher.setBatchMode(true, previousContext.config);
    scheduleAutoDisable(
      previousContext.config.timeoutMs,
      previousContext.options.context
    );
  };

  /**
   * Enables game loading mode which automatically manages EventBus batch mode.
   *
   * @param {object} [options] - Loading configuration
   * @param {string} [options.context='game-loading'] - Context description
   * @param {number} [options.timeoutMs=60000] - Auto-disable timeout
   */
  function enableGameLoadingMode(options = {}) {
    const defaultOptions = {
      context: 'game-loading',
      timeoutMs: 60000, // 1 minute timeout for safety
    };

    const loadingOptions = { ...defaultOptions, ...options };

    const isHighVolumeContext = HIGH_VOLUME_CONTEXTS.has(
      loadingOptions.context
    );
    const batchModeConfig = {
      maxRecursionDepth: 25, // Base limit - EventBus will apply event-specific overrides
      maxGlobalRecursion: isHighVolumeContext ? 200 : 50,
      timeoutMs: loadingOptions.timeoutMs,
      context: loadingOptions.context,
    };

    const now = Date.now();
    const contextEntry = {
      options: loadingOptions,
      config: batchModeConfig,
    };

    if (loadingContextStack.length === 0) {
      outermostStartTime = now;
    }

    loadingContextStack.push(contextEntry);

    isGameLoading = true;

    // Enable batch mode on EventBus with context-aware limits
    // EventBus now handles event-specific limits based on context automatically
    dispatcher.setBatchMode(true, batchModeConfig);

    safeLogger.debug(
      `SafeErrorLogger: Enabled batch mode for ${loadingOptions.context} (depth: ${loadingContextStack.length}) - ` +
        `maxRecursionDepth: ${batchModeConfig.maxRecursionDepth}, ` +
        `maxGlobalRecursion: ${batchModeConfig.maxGlobalRecursion}`
    );

    scheduleAutoDisable(batchModeConfig.timeoutMs, loadingOptions.context);
  }

  /**
   * Disables game loading mode and EventBus batch mode.
   */
  function disableGameLoadingMode({ force = false, reason = 'manual' } = {}) {
    if (!isGameLoading) {
      return; // Already disabled
    }

    if (!force && loadingContextStack.length > 1) {
      const endedContext = loadingContextStack.pop();
      safeLogger.debug(
        `SafeErrorLogger: Exited nested game loading mode for ${endedContext.options.context}. Remaining depth: ${loadingContextStack.length}`
      );
      restorePreviousContext();
      return;
    }

    const totalDuration = outermostStartTime
      ? Date.now() - outermostStartTime
      : 0;

    outermostStartTime = null;
    loadingContextStack.length = 0;
    isGameLoading = false;

    clearExistingTimeout();

    // Disable batch mode on SafeEventDispatcher
    dispatcher.setBatchMode(false);

    safeLogger.debug(
      `SafeErrorLogger: Game loading mode disabled (${reason}) after ${totalDuration}ms`
    );
  }

  /**
   * Safely logs an error with recursion protection.
   * Falls back to console.error if the logger itself causes recursion.
   *
   * @param {string} message - Error message
   * @param {Error|any} error - Error object or additional context
   * @param {object} [context] - Additional context information
   */
  function safeError(message, error, context = {}) {
    try {
      safeLogger.error(message, error, context);
    } catch (loggerError) {
      // Logger itself failed - fallback to console to prevent recursion
      console.error(
        `SafeErrorLogger: Logger failed. Original error: ${message}`,
        error,
        'Logger error:',
        loggerError
      );
    }
  }

  /**
   * Safely logs a warning with recursion protection.
   *
   * @param {string} message - Warning message
   * @param {any} [context] - Additional context information
   */
  function safeWarn(message, context) {
    try {
      safeLogger.warn(message, context);
    } catch (loggerError) {
      console.warn(
        `SafeErrorLogger: Logger failed. Original warning: ${message}`,
        context,
        'Logger error:',
        loggerError
      );
    }
  }

  /**
   * Executes a function with game loading mode enabled.
   * Automatically manages batch mode for the duration of the operation.
   * Detects and force-cleans any lingering nested loading contexts that
   * remain active after the function resolves to prevent batch mode leaks.
   *
   * @param {Function} fn - Function to execute during loading mode
   * @param {object} [options] - Loading mode options
   * @returns {Promise<any>} Result of the function execution
   */
  async function withGameLoadingMode(fn, options = {}) {
    const previousDepth = loadingContextStack.length;
    enableGameLoadingMode(options);

    try {
      return await fn();
    } finally {
      disableGameLoadingMode();

      const expectedDepth = previousDepth;
      if (loadingContextStack.length > expectedDepth) {
        safeLogger.warn(
          'SafeErrorLogger: Game loading mode still active after scope exit. Forcing batch mode disable to prevent leaks.',
          { context: options.context }
        );
        disableGameLoadingMode({ force: true, reason: 'scope-exit' });
      }
    }
  }

  /**
   * Returns whether game loading mode is currently active.
   *
   * @returns {boolean} True if game loading mode is active
   */
  function isGameLoadingActive() {
    return isGameLoading;
  }

  return {
    enableGameLoadingMode,
    disableGameLoadingMode,
    withGameLoadingMode,
    isGameLoadingActive,
    safeError,
    safeWarn,
  };
}

export default createSafeErrorLogger;
