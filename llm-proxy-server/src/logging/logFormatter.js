/**
 * @file Log message formatting utilities for enhanced visual presentation
 * @description Handles message formatting, context object pretty-printing, and visual hierarchy
 */

import { getLoggerConfiguration } from './loggerConfiguration.js';

/**
 * @typedef {object} FormattedMessage
 * @property {string} timestamp - Formatted timestamp
 * @property {string} icon - Context icon
 * @property {string} level - Log level
 * @property {string} service - Service name
 * @property {string} message - Main message
 * @property {string[]} contextLines - Formatted context lines
 */

/**
 * @typedef {object} ContextInfo
 * @property {string} type - Context type (startup, request, cache, etc.)
 * @property {string} icon - Associated icon
 * @property {string} service - Detected service name
 */

/**
 * Log formatter class for enhanced message presentation
 */
class LogFormatter {
  /** @type {import('./loggerConfiguration.js').LoggerConfiguration} */
  #config;

  /** @type {Map<string, string>} */
  #contextIcons;

  /** @type {Map<string, RegExp[]>} */
  #contextPatterns;

  /**
   *
   */
  constructor() {
    this.#config = getLoggerConfiguration();
    this.#initializeContextMappings();
  }

  /**
   * Detect if terminal supports Unicode emoji characters
   * @returns {boolean} Whether emoji are supported
   * @private
   */
  #detectEmojiSupport() {
    // Check environment variables that indicate emoji support
    const termProgram = process.env.TERM_PROGRAM;
    const terminalEmulator = process.env.TERMINAL_EMULATOR;
    const wslDistroName = process.env.WSL_DISTRO_NAME;

    // Force disable emoji if explicitly set
    if (process.env.LOG_DISABLE_EMOJI === 'true') {
      return false;
    }

    // Force enable emoji if explicitly set
    if (process.env.LOG_FORCE_EMOJI === 'true') {
      return true;
    }

    // Known emoji-supporting terminals
    const emojiSupportedTerminals = [
      'vscode', // VS Code integrated terminal
      'cursor', // Cursor IDE terminal
      'hyper', // Hyper terminal
      'iTerm.app', // macOS iTerm2
      'Apple_Terminal', // macOS Terminal
      'gnome-terminal', // GNOME Terminal
      'konsole', // KDE Konsole
      'alacritty', // Alacritty
      'kitty', // Kitty terminal
      'wezterm', // WezTerm
    ];

    // Check if running in a known emoji-supporting terminal
    if (termProgram && emojiSupportedTerminals.includes(termProgram)) {
      return true;
    }

    if (
      terminalEmulator &&
      emojiSupportedTerminals.includes(terminalEmulator)
    ) {
      return true;
    }

    // Windows CMD/PowerShell in WSL typically doesn't support emoji well
    if (
      wslDistroName &&
      (process.env.TERM === 'xterm' || !process.env.TERM_PROGRAM)
    ) {
      return false;
    }

    // Check for Windows Terminal which does support emoji
    if (process.env.WT_SESSION) {
      return true;
    }

    // Default fallback based on platform and environment
    if (process.platform === 'win32' && !process.env.WT_SESSION) {
      return false; // Windows CMD/PowerShell
    }

    // Modern terminals on macOS and Linux generally support emoji
    return process.platform === 'darwin' || process.platform === 'linux';
  }

  /**
   * Initialize context icon mappings and detection patterns
   * @private
   */
  #initializeContextMappings() {
    // Detect if terminal supports Unicode emoji
    const supportsEmoji = this.#detectEmojiSupport();

    if (supportsEmoji) {
      this.#contextIcons = new Map([
        ['startup', '🚀'],
        ['request', '🔄'],
        ['auth', '🔑'],
        ['cache', '💾'],
        ['http', '🌐'],
        ['cleanup', '🧹'],
        ['stats', '📊'],
        ['security', '🛡️'],
        ['config', '⚙️'],
        ['error', '💥'],
        ['performance', '⚡'],
        ['default', '📝'],
      ]);
    } else {
      // Fallback to ASCII symbols for terminals without emoji support
      this.#contextIcons = new Map([
        ['startup', '[START]'],
        ['request', '[REQ]'],
        ['auth', '[AUTH]'],
        ['cache', '[CACHE]'],
        ['http', '[HTTP]'],
        ['cleanup', '[CLEAN]'],
        ['stats', '[STATS]'],
        ['security', '[SEC]'],
        ['config', '[CONF]'],
        ['error', '[ERR]'],
        ['performance', '[PERF]'],
        ['default', '[LOG]'],
      ]);
    }

    this.#contextPatterns = new Map([
      [
        'startup',
        [
          /startup|initialization|initialized|listening|server|loading/i,
          /graceful.*shutdown|shutdown.*complete/i,
        ],
      ],
      [
        'request',
        [
          /request|POST|GET|endpoint|api.*request|received.*request/i,
          /handing.*off|relaying.*client/i,
        ],
      ],
      [
        'auth',
        [
          /api.*key|authentication|auth|token|credential|apikey/i,
          /masked|authorization/i,
        ],
      ],
      [
        'cache',
        [
          /cache|cached|caching|hit|miss|TTL|statistics/i,
          /cache.*enabled|cache.*disabled/i,
        ],
      ],
      [
        'http',
        [
          /http|agent|connection|pool|endpoint|external.*call/i,
          /retry|request.*service|network/i,
        ],
      ],
      [
        'cleanup',
        [
          /cleanup|closed|cleaned.*up|resource|graceful/i,
          /shutdown|cleanup.*complete/i,
        ],
      ],
      [
        'stats',
        [
          /statistics|metrics|performance|hit.*rate|count/i,
          /reset.*stats|cache.*statistics/i,
        ],
      ],
      [
        'security',
        [
          /security|validation|sanitization|cors|rate.*limit/i,
          /not.*operational|validation.*failed/i,
        ],
      ],
      [
        'config',
        [
          /config|configuration|loaded|path|environment|variable/i,
          /cors.*enabled|proxy.*allowed/i,
        ],
      ],
      [
        'error',
        [
          /critical|error|failed|failure|exception|not.*found/i,
          /unable.*to|cannot.*load/i,
        ],
      ],
    ]);
  }

  /**
   * Detect context type from message content
   * @param {string} message - Log message
   * @param {string} level - Log level
   * @returns {ContextInfo} Detected context information
   * @private
   */
  #detectContext(message, level) {
    // Check for error context first
    if (level === 'error') {
      return {
        type: 'error',
        icon: this.#contextIcons.get('error'),
        service: this.#extractServiceName(message),
      };
    }

    // Check patterns for context detection
    for (const [contextType, patterns] of this.#contextPatterns) {
      for (const pattern of patterns) {
        if (pattern.test(message)) {
          return {
            type: contextType,
            icon: this.#contextIcons.get(contextType),
            service: this.#extractServiceName(message),
          };
        }
      }
    }

    return {
      type: 'default',
      icon: this.#contextIcons.get('default'),
      service: this.#extractServiceName(message),
    };
  }

  /**
   * Extract service name from message
   * @param {string} message - Log message
   * @returns {string} Extracted service name
   * @private
   */
  #extractServiceName(message) {
    const servicePatterns = [
      /^(\w+Service):/,
      /^(\w+Controller):/,
      /^(\w+Manager):/,
      /^(LLM Proxy Server):/,
      /^(\w+):/,
    ];

    for (const pattern of servicePatterns) {
      const match = message.match(pattern);
      if (match) {
        return match[1];
      }
    }

    return 'System';
  }

  /**
   * Format timestamp according to configuration
   * @returns {string} Formatted timestamp
   * @private
   */
  #formatTimestamp() {
    const now = new Date();
    const hours = now.getHours().toString().padStart(2, '0');
    const minutes = now.getMinutes().toString().padStart(2, '0');
    const seconds = now.getSeconds().toString().padStart(2, '0');
    const milliseconds = now.getMilliseconds().toString().padStart(3, '0');

    return `${hours}:${minutes}:${seconds}.${milliseconds}`;
  }

  /**
   * Truncate message if it exceeds maximum length
   * @param {string} message - Original message
   * @param {string} [level='info'] - Log level associated with the message
   * @returns {string} Truncated message with indicator
   * @private
   */
  #truncateMessage(message, level = 'info') {
    const maxLength = this.#config.getMaxMessageLength();

    if (typeof maxLength !== 'number' || maxLength <= 0) {
      return message;
    }

    if (level === 'warn' || level === 'error') {
      return message;
    }

    if (message.length <= maxLength) {
      return message;
    }

    const truncated = message.substring(0, maxLength - 3);
    return `${truncated}...`;
  }

  /**
   * Format context object for display
   * @param {any} context - Context object or value
   * @returns {string[]} Array of formatted context lines
   * @private
   */
  #formatContext(context) {
    if (!context || !this.#config.shouldShowContext()) {
      return [];
    }

    const lines = [];

    try {
      if (typeof context === 'object') {
        const formatted = JSON.stringify(context, null, 2);
        const contextLines = formatted.split('\n');

        if (contextLines.length > 1) {
          lines.push('                    ↳ Context: {');
          contextLines.slice(1, -1).forEach((line) => {
            lines.push(`                    ${line}`);
          });
          lines.push('                    }');
        } else {
          lines.push(`                    ↳ Context: ${formatted}`);
        }
      } else {
        lines.push(`                    ↳ Context: ${String(context)}`);
      }
    } catch (error) {
      lines.push(
        `                    ↳ Context: [Unable to format: ${error.message}]`
      );
    }

    return lines;
  }

  /**
   * Format additional arguments as details
   * @param {any[]} args - Additional arguments
   * @returns {string[]} Array of formatted detail lines
   * @private
   */
  #formatDetails(args) {
    if (!args || args.length === 0) {
      return [];
    }

    const lines = [];

    args.forEach((arg, index) => {
      try {
        if (typeof arg === 'object') {
          const formatted = JSON.stringify(arg, null, 2);
          if (formatted.length > 100) {
            lines.push(
              `                    ↳ Details[${index}]: ${formatted.substring(0, 97)}...`
            );
          } else {
            lines.push(`                    ↳ Details[${index}]: ${formatted}`);
          }
        } else {
          lines.push(`                    ↳ Details[${index}]: ${String(arg)}`);
        }
      } catch (error) {
        lines.push(
          `                    ↳ Details[${index}]: [Unable to format: ${error.message}]`
        );
      }
    });

    return lines;
  }

  /**
   * Format a complete log message with enhanced presentation
   * @param {string} level - Log level (debug, info, warn, error)
   * @param {string} message - Main log message
   * @param {...any} args - Additional arguments
   * @returns {FormattedMessage} Formatted message components
   */
  formatMessage(level, message, ...args) {
    const context = this.#detectContext(message, level);
    const timestamp = this.#formatTimestamp();
    const truncatedMessage = this.#truncateMessage(message, level);

    // Separate context object from other arguments if present
    let contextObject = null;
    let detailArgs = args;

    if (args.length > 0 && typeof args[0] === 'object' && args[0] !== null) {
      contextObject = args[0];
      detailArgs = args.slice(1);
    }

    const contextLines = this.#formatContext(contextObject);
    const detailLines = this.#formatDetails(detailArgs);

    return {
      timestamp,
      icon: this.#config.isIconsEnabled() ? context.icon : '',
      level: level.toUpperCase(),
      service: context.service,
      message: truncatedMessage,
      contextLines: [...contextLines, ...detailLines],
    };
  }

  /**
   * Create a simple formatted message string (fallback mode)
   * @param {string} level - Log level
   * @param {string} message - Main message
   * @param {...any} args - Additional arguments
   * @returns {string} Simple formatted message
   */
  formatSimple(level, message, ...args) {
    const timestamp = this.#formatTimestamp();
    const argsStr =
      args.length > 0
        ? ` ${args
            .map((arg) =>
              typeof arg === 'object' ? JSON.stringify(arg) : String(arg)
            )
            .join(' ')}`
        : '';

    return `[${timestamp}] ${level.toUpperCase()}: ${message}${argsStr}`;
  }
}

// Export singleton instance
let formatterInstance = null;

/**
 * Get the singleton log formatter instance
 * @returns {LogFormatter} The formatter instance
 */
export function getLogFormatter() {
  if (!formatterInstance) {
    formatterInstance = new LogFormatter();
  }
  return formatterInstance;
}

export default LogFormatter;
