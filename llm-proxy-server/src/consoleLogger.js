// llm-proxy-server/src/consoleLogger.js

/**
 * @file Enhanced ILogger implementation with colors, icons, and structured formatting
 * Drop-in replacement for the basic console logger with visual enhancements while maintaining
 * complete backward compatibility with existing code.
 */

import { getEnhancedConsoleLogger } from './logging/enhancedConsoleLogger.js';

/**
 * @typedef {import('../interfaces/coreServices.js').ILogger} ILogger
 */

/**
 * Enhanced console logger that implements the ILogger interface with visual improvements.
 * Provides color-coded output, context icons, structured formatting, and intelligent
 * context detection while maintaining the same API as the original ConsoleLogger.
 *
 * Features:
 * - Color-coded log levels (DEBUG=cyan, INFO=green, WARN=yellow, ERROR=red)
 * - Context-aware Unicode icons (🚀🔄🔑💾🌐🧹📊🛡️)
 * - Structured message formatting with visual hierarchy
 * - Environment-aware behavior (rich formatting in dev, minimal in production)
 * - Automatic API key masking and security sanitization
 * - Graceful fallback to plain text if enhanced features fail
 * @implements {ILogger}
 */
export class ConsoleLogger {
  /** @type {import('./logging/enhancedConsoleLogger.js').default} */
  #enhancedLogger;

  /**
   *
   */
  constructor() {
    this.#enhancedLogger = getEnhancedConsoleLogger();
  }

  /**
   * Logs an informational message with enhanced formatting.
   * In enhanced mode: displays with green color, context detection, and structured layout.
   * In fallback mode: uses standard console.info behavior.
   * @param {string} message - The primary message string to log.
   * @param {...any} args - Additional arguments or objects to include in the log output.
   */
  info(message, ...args) {
    this.#enhancedLogger.info(message, ...args);
  }

  /**
   * Logs a warning message with enhanced formatting.
   * In enhanced mode: displays with yellow color, warning icon, and structured layout.
   * In fallback mode: uses standard console.warn behavior.
   * @param {string} message - The primary warning message string.
   * @param {...any} args - Additional arguments or objects to include in the warning output.
   */
  warn(message, ...args) {
    this.#enhancedLogger.warn(message, ...args);
  }

  /**
   * Logs an error message with enhanced formatting.
   * In enhanced mode: displays with bold red color, error icon, and structured layout.
   * In fallback mode: uses standard console.error behavior.
   * @param {string} message - The primary error message string.
   * @param {...any} args - Additional arguments or objects, typically including an Error object, to log.
   */
  error(message, ...args) {
    this.#enhancedLogger.error(message, ...args);
  }

  /**
   * Logs a debug message with enhanced formatting.
   * In enhanced mode: displays with cyan color, debug icon, and structured layout.
   * In fallback mode: uses standard console.debug behavior.
   * Browser developer tools may filter these messages by default; ensure 'Verbose' or 'Debug'
   * level is enabled to see them.
   * @param {string} message - The primary debug message string.
   * @param {...any} args - Additional arguments or objects to include in the debug output.
   */
  debug(message, ...args) {
    this.#enhancedLogger.debug(message, ...args);
  }

  /**
   * Create a secure version of this logger with enhanced data sanitization.
   * Useful for services that handle sensitive information.
   * @returns {ILogger} Secure logger instance with enhanced API key masking
   */
  createSecure() {
    return this.#enhancedLogger.createSecure();
  }

  /**
   * Test the enhanced logger output (development only).
   * Displays sample messages showing the enhanced formatting capabilities.
   * Only runs in development environment to avoid cluttering production logs.
   */
  testEnhancedOutput() {
    this.#enhancedLogger.testOutput();
  }
}

/**
 * Create a new console logger instance
 * @returns {ConsoleLogger} New logger instance
 */
export function createConsoleLogger() {
  return new ConsoleLogger();
}

// Export default instance for backward compatibility
export default new ConsoleLogger();
