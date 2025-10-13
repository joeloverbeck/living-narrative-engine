// llm-proxy-server/src/interfaces/coreServices.js
/**
 * @interface ILogger
 * @description Defines an interface for logging operations across the application.
 */

/**
 * Logs an informational message.
 * @function
 * @name ILogger#info
 * @param {string} message - The message to log.
 * @param {object} [context] - Optional context object with additional information.
 * @returns {void}
 */

/**
 * Logs a warning message.
 * @function
 * @name ILogger#warn
 * @param {string} message - The message to log.
 * @param {object} [context] - Optional context object with additional information.
 * @returns {void}
 */

/**
 * Logs an error message.
 * @function
 * @name ILogger#error
 * @param {string} message - The message to log.
 * @param {object} [context] - Optional context object with additional information.
 * @returns {void}
 */

/**
 * @typedef {object} InterfaceMethodMetadata
 * @property {string} name - Name of the logger method.
 * @property {string} description - What the method should log.
 * @property {Array<{name: string, type: string, optional?: boolean}>} params - Expected parameters.
 */

/**
 * @typedef {object} InterfaceMetadata
 * @property {string} name - Interface identifier.
 * @property {string} description - Summary of the interface contract.
 * @property {InterfaceMethodMetadata[]} methods - Supported logger methods.
 */

/**
 * Runtime metadata describing the ILogger contract used throughout the proxy.
 * @type {Readonly<InterfaceMetadata>}
 */
export const ILoggerMetadata = Object.freeze({
  name: 'ILogger',
  description: 'Defines the logging surface used by services within the proxy.',
  methods: [
    {
      name: 'info',
      description: 'Logs informational messages useful for high-level tracing.',
      params: [
        { name: 'message', type: 'string' },
        { name: 'context', type: 'object', optional: true },
      ],
    },
    {
      name: 'warn',
      description: 'Logs warnings about unusual or recoverable conditions.',
      params: [
        { name: 'message', type: 'string' },
        { name: 'context', type: 'object', optional: true },
      ],
    },
    {
      name: 'error',
      description: 'Logs errors and critical failures.',
      params: [
        { name: 'message', type: 'string' },
        { name: 'context', type: 'object', optional: true },
      ],
    },
    {
      name: 'debug',
      description: 'Logs verbose diagnostic information for troubleshooting.',
      params: [
        { name: 'message', type: 'string' },
        { name: 'context', type: 'object', optional: true },
      ],
    },
  ],
});
