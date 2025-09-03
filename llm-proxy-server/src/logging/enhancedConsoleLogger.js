/**
 * @file Enhanced console logger with colors, icons, and structured formatting
 * @description Drop-in replacement for ConsoleLogger with visual enhancements
 */

// Chalk will be loaded lazily in the initializeChalk method
let chalk = null;

import { getLoggerConfiguration } from './loggerConfiguration.js';
import { getLogFormatter } from './logFormatter.js';
import { maskApiKey, createSecureLogger } from '../utils/loggerUtils.js';

/**
 * @typedef {object} ILogger
 * @property {Function} info - Log info level messages
 * @property {Function} warn - Log warning level messages
 * @property {Function} error - Log error level messages
 * @property {Function} debug - Log debug level messages
 */

/**
 * Enhanced console logger with colors, icons, and structured formatting
 * Maintains complete backward compatibility with existing ILogger interface
 */
class EnhancedConsoleLogger {
  /** @type {import('./loggerConfiguration.js').LoggerConfiguration} */
  #config;

  /** @type {import('./logFormatter.js').LogFormatter} */
  #formatter;

  /** @type {Map<string, Function>} */
  #colorFunctions;

  /** @type {boolean} */
  #chalkAvailable;

  /**
   *
   */
  constructor() {
    this.#config = getLoggerConfiguration();
    this.#formatter = getLogFormatter();
    this.#chalkAvailable = false; // Will be set when chalk is first accessed
    this.#initializeColorFunctions();
  }

  /**
   * Initialize chalk and test availability (lazy loading)
   * @returns {boolean} Whether chalk is available
   * @private
   */
  #initializeChalk() {
    // If we've already tried to initialize chalk, return the cached result
    if (chalk !== null) {
      return this.#chalkAvailable;
    }

    try {
      // Try to use chalk - handle both sync require and async import cases
      let chalkModule = null;

      try {
        // Check global scope first
        if (typeof globalThis !== 'undefined' && globalThis.chalk) {
          chalkModule = globalThis.chalk;
        } else if (typeof global !== 'undefined' && global.chalk) {
          chalkModule = global.chalk;
        } else {
          // Try synchronous require for compatibility
          try {
            chalkModule = require('chalk');
            // Handle both default and named exports
            if (chalkModule && chalkModule.default) {
              chalkModule = chalkModule.default;
            }
          } catch (_requireError) {
            // If require fails, chalk is not available
            chalkModule = null;
          }
        }
      } catch (_) {
        // Ignore access errors and fall through
      }

      // Test if chalk is available and working
      if (!chalkModule || typeof chalkModule.blue !== 'function') {
        chalk = false;
        this.#chalkAvailable = false;
        // eslint-disable-next-line no-console
        console.warn(
          'EnhancedConsoleLogger: Chalk not available, falling back to plain text'
        );
        return false;
      }

      // Test chalk functionality
      try {
        chalkModule.blue('test');
        chalk = chalkModule;
        this.#chalkAvailable = true;
        return true;
      } catch (_testError) {
        // Chalk test failed
        chalk = false;
        this.#chalkAvailable = false;
        // eslint-disable-next-line no-console
        console.warn(
          'EnhancedConsoleLogger: Chalk not available, falling back to plain text'
        );
        return false;
      }
    } catch (_error) {
      chalk = false;
      this.#chalkAvailable = false;
      // eslint-disable-next-line no-console
      console.warn(
        'EnhancedConsoleLogger: Chalk not available, falling back to plain text'
      );
      return false;
    }
  }

  /**
   * Initialize color functions for different log levels
   * @private
   */
  #initializeColorFunctions() {
    // Check if chalk is available when we need it
    const chalkReady = this.#initializeChalk();

    if (!chalkReady || !this.#config.isColorsEnabled()) {
      // Fallback to identity functions if colors disabled or chalk unavailable
      this.#colorFunctions = new Map([
        ['debug', (str) => str],
        ['info', (str) => str],
        ['warn', (str) => str],
        ['error', (str) => str],
        ['timestamp', (str) => str],
        ['service', (str) => str],
        ['context', (str) => str],
      ]);
      return;
    }

    // Use chalk color functions if available
    this.#colorFunctions = new Map([
      ['debug', chalk.cyan],
      ['info', chalk.green],
      ['warn', chalk.yellow],
      ['error', chalk.red.bold],
      ['timestamp', chalk.gray],
      ['service', chalk.blue],
      ['context', chalk.gray.italic],
    ]);
  }

  /**
   * Apply color to text based on type
   * @param {string} text - Text to colorize
   * @param {string} type - Color type (debug, info, warn, error, etc.)
   * @returns {string} Colorized text
   * @private
   */
  #applyColor(text, type) {
    const colorFunction = this.#colorFunctions.get(type);
    return colorFunction ? colorFunction(text) : text;
  }

  /**
   * Build the complete formatted log output
   * @param {string} level - Log level
   * @param {string} message - Main message
   * @param {...any} args - Additional arguments
   * @returns {string} Complete formatted output
   * @private
   */
  #buildFormattedOutput(level, message, ...args) {
    if (!this.#config.isPrettyFormatEnabled()) {
      return this.#formatter.formatSimple(level, message, ...args);
    }

    const formatted = this.#formatter.formatMessage(level, message, ...args);

    // Build main log line
    const timestamp = this.#applyColor(`[${formatted.timestamp}]`, 'timestamp');
    const icon = formatted.icon ? `${formatted.icon} ` : '';
    const levelText = this.#applyColor(formatted.level, level);
    const service = this.#applyColor(formatted.service, 'service');
    const messageText = formatted.message;

    const mainLine = `${timestamp} ${icon}${levelText} ${service}: ${messageText}`;

    // Add context lines if present
    const contextLines = formatted.contextLines.map((line) =>
      this.#applyColor(line, 'context')
    );

    return [mainLine, ...contextLines].join('\n');
  }

  /**
   * Force flush stdout/stderr on Windows and WSL to prevent terminal buffering
   * Note: Windows Terminal flush workaround has been removed as it's no longer needed.
   * @private
   * @deprecated
   */
  #forceFlushOnWindows() {
    // No-op: Windows Terminal flush workaround removed
  }

  /**
   * Output log message to appropriate console method
   * @param {string} level - Log level
   * @param {string} output - Formatted output
   * @private
   */
  #outputToConsole(level, output) {
    switch (level) {
      case 'debug':
        // eslint-disable-next-line no-console
        console.debug(output);
        break;
      case 'info':
        // eslint-disable-next-line no-console
        console.info(output);
        break;
      case 'warn':
        // eslint-disable-next-line no-console
        console.warn(output);
        break;
      case 'error':
        // eslint-disable-next-line no-console
        console.error(output);
        break;
      default:
        // eslint-disable-next-line no-console
        console.log(output);
    }
    
    // Force flush on Windows to prevent terminal buffering that causes
    // logs to only appear when terminal focus changes
    this.#forceFlushOnWindows();
  }

  /**
   * Sanitize arguments to remove sensitive information
   * @param {...any} args - Arguments to sanitize
   * @returns {any[]} Sanitized arguments
   * @private
   */
  #sanitizeArguments(...args) {
    return args.map((arg) => {
      if (typeof arg === 'string') {
        // Check for potential API keys in strings
        // More precise patterns to avoid false positives
        // Skip if it's a service name pattern like "ApiKeyService:"
        if (/^\w+Service:/.test(arg)) {
          return arg;
        }

        // Check for actual API key patterns
        if (
          /\bapiKey[=:"']\s*[\w-]+/i.test(arg) ||
          /\bAPI_KEY[=:"']\s*[\w-]+/.test(arg) ||
          /\bAPI key[=:"']\s*[\w-]+/i.test(arg) ||
          /sk-[a-zA-Z0-9]{20,}/.test(arg) ||
          /Bearer\s+[a-zA-Z0-9\-._~+/]+/i.test(arg) ||
          (/^[a-zA-Z0-9]{32,}$/.test(arg) && !arg.includes(' '))
        ) {
          // Standalone long strings without spaces
          return maskApiKey(arg);
        }
        return arg;
      }

      if (typeof arg === 'object' && arg !== null) {
        // Deep sanitize objects
        return this.#sanitizeObject(arg);
      }

      return arg;
    });
  }

  /**
   * Sanitize object properties recursively
   * @param {any} obj - Object to sanitize
   * @returns {any} Sanitized object
   * @private
   */
  #sanitizeObject(obj) {
    if (Array.isArray(obj)) {
      return obj.map((item) => this.#sanitizeObject(item));
    }

    if (typeof obj === 'object' && obj !== null) {
      const sanitized = {};
      for (const [key, value] of Object.entries(obj)) {
        const lowerKey = key.toLowerCase();
        if (
          lowerKey.includes('apikey') ||
          lowerKey.includes('token') ||
          lowerKey.includes('password') ||
          lowerKey.includes('secret')
        ) {
          sanitized[key] = '[MASKED]';
        } else if (typeof value === 'object') {
          sanitized[key] = this.#sanitizeObject(value);
        } else {
          sanitized[key] = value;
        }
      }
      return sanitized;
    }

    return obj;
  }

  /**
   * Core logging method
   * @param {string} level - Log level
   * @param {string} message - Main message
   * @param {...any} args - Additional arguments
   * @private
   */
  #log(level, message, ...args) {
    try {
      // Sanitize message and arguments
      const sanitizedMessage = this.#sanitizeArguments(message)[0] || message;
      const sanitizedArgs = this.#sanitizeArguments(...args);

      // Build formatted output
      const output = this.#buildFormattedOutput(
        level,
        sanitizedMessage,
        ...sanitizedArgs
      );

      // Output to console
      this.#outputToConsole(level, output);
    } catch (_error) {
      // Fallback to simple console output if formatting fails
      // eslint-disable-next-line no-console
      console.error(
        'EnhancedConsoleLogger: Formatting error, falling back to simple output'
      );
      const fallbackOutput = `[FALLBACK] ${level.toUpperCase()}: ${message}`;
      // eslint-disable-next-line no-console
      const consoleMethod = console[level] || console.log;
      consoleMethod(fallbackOutput, ...args);
    }
  }

  /**
   * Log debug level messages
   * @param {string} message - Debug message
   * @param {...any} args - Additional arguments
   */
  debug(message, ...args) {
    this.#log('debug', message, ...args);
  }

  /**
   * Log info level messages
   * @param {string} message - Info message
   * @param {...any} args - Additional arguments
   */
  info(message, ...args) {
    this.#log('info', message, ...args);
  }

  /**
   * Log warning level messages
   * @param {string} message - Warning message
   * @param {...any} args - Additional arguments
   */
  warn(message, ...args) {
    this.#log('warn', message, ...args);
  }

  /**
   * Log error level messages
   * @param {string} message - Error message
   * @param {...any} args - Additional arguments
   */
  error(message, ...args) {
    this.#log('error', message, ...args);
  }

  /**
   * Create a secure version of this logger with enhanced sanitization
   * @returns {ILogger} Secure logger instance
   */
  createSecure() {
    return createSecureLogger(this);
  }

  /**
   * Test the logger with sample messages (for development/testing)
   */
  testOutput() {
    if (!this.#config.isDevelopment()) {
      return;
    }

    // eslint-disable-next-line no-console
    console.log('\n=== Enhanced Logger Test Output ===');
    // eslint-disable-next-line no-console
    console.log('Testing log output...');
    this.debug('ApiKeyService: Debug message with context', {
      llmId: 'test-provider',
    });
    this.info('LLM Proxy Server: Server initialization complete', {
      port: 3001,
    });
    this.warn('CacheService: Cache miss for key test-key', { attempts: 3 });
    this.error('HttpAgentService: Connection failed', {
      error: 'ECONNREFUSED',
    });
    // eslint-disable-next-line no-console
    console.log('=== End Test Output ===\n');
  }
}

// Export singleton instance for consistency
let loggerInstance = null;

/**
 * Get the singleton enhanced console logger instance
 * @returns {EnhancedConsoleLogger} The logger instance
 */
export function getEnhancedConsoleLogger() {
  if (!loggerInstance) {
    loggerInstance = new EnhancedConsoleLogger();
  }
  return loggerInstance;
}

export default EnhancedConsoleLogger;
