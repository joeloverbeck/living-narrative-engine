/**
 * @file Base error class providing standardized error properties and methods
 * @description Foundation class for all custom errors with context, correlation tracking, and serialization
 * @see ModValidationError.js - Existing pattern this builds upon
 * @see src/scopeDsl/constants/errorCodes.js - Error codes infrastructure
 */

import { v4 as uuidv4 } from 'uuid';
import { isNonBlankString } from '../utils/textUtils.js';

/**
 * Base error class that standardizes error handling across the application
 * Builds upon existing ModValidationError patterns with enhanced features
 *
 * @class
 * @augments {Error}
 */
class BaseError extends Error {
  #code;
  #context;
  #timestamp;
  #severity;
  #recoverable;
  #correlationId;

  /**
   * Creates a new BaseError instance with standardized properties
   *
   * @param {string} message - The error message describing the failure
   * @param {string} code - Error code for classification (use ErrorCodes constants)
   * @param {object} [context] - Context information about where/how the error occurred
   * @param {object} [options] - Additional options
   * @param {string} [options.correlationId] - Custom correlation ID (auto-generated if not provided)
   * @throws {Error} If required parameters are missing or invalid
   */
  constructor(message, code, context = {}, options = {}) {
    // Validate required parameters following project patterns
    if (!isNonBlankString(message)) {
      throw new Error(
        `BaseError constructor: Invalid message '${message}'. Expected non-blank string.`
      );
    }
    if (!isNonBlankString(code)) {
      throw new Error(
        `BaseError constructor: Invalid code '${code}'. Expected non-blank string.`
      );
    }

    // Context can be undefined/null, defaulting to empty object
    if (context === null || context === undefined) {
      context = {};
    }

    super(message);
    this.name = this.constructor.name;
    this.#code = code;
    this.#context = this.#deepCopy(context); // Deep defensive copy
    this.#timestamp = new Date().toISOString(); // ISO format like ModValidationError
    this.#severity = this.getSeverity();
    this.#recoverable = this.isRecoverable();
    this.#correlationId =
      options.correlationId || this.#generateCorrelationId();

    // Capture stack trace for V8 environments (existing pattern)
    if (Error.captureStackTrace) {
      Error.captureStackTrace(this, this.constructor);
    }
  }

  /**
   * Abstract method to determine error severity - override in subclasses
   *
   * @returns {string} Severity level
   * @abstract
   */
  getSeverity() {
    return 'error'; // Default severity level
  }

  /**
   * Abstract method to determine if error is recoverable - override in subclasses
   *
   * @returns {boolean} Whether the error is recoverable
   * @abstract
   */
  isRecoverable() {
    return false; // Default to non-recoverable for safety
  }

  /**
   * Generates a unique correlation ID using project's UUID library
   *
   * @returns {string} UUID v4 correlation ID
   * @private
   */
  #generateCorrelationId() {
    return uuidv4();
  }

  /**
   * Creates a deep copy of an object to prevent external modification
   *
   * @param {*} obj - Object to copy
   * @returns {*} Deep copy of the object
   * @private
   */
  #deepCopy(obj) {
    if (obj === null || typeof obj !== 'object') {
      return obj;
    }
    if (obj instanceof Date) {
      return new Date(obj.getTime());
    }
    if (obj instanceof Array) {
      return obj.map((item) => this.#deepCopy(item));
    }
    if (obj instanceof Object) {
      const clonedObj = {};
      for (const key in obj) {
        if (Object.prototype.hasOwnProperty.call(obj, key)) {
          clonedObj[key] = this.#deepCopy(obj[key]);
        }
      }
      return clonedObj;
    }
    return obj;
  }

  // Getters following existing patterns
  get code() {
    return this.#code;
  }
  get context() {
    return this.#deepCopy(this.#context);
  } // Return deep defensive copy
  get timestamp() {
    return this.#timestamp;
  }
  get severity() {
    return this.#severity;
  }
  get recoverable() {
    return this.#recoverable;
  }
  get correlationId() {
    return this.#correlationId;
  }

  /**
   * Serializes the error for logging or reporting (matches ModValidationError pattern)
   *
   * @returns {object} Serialized error object
   */
  toJSON() {
    return {
      name: this.name,
      message: this.message,
      code: this.#code,
      context: this.#context,
      timestamp: this.#timestamp,
      severity: this.#severity,
      recoverable: this.#recoverable,
      correlationId: this.#correlationId,
      stack: this.stack,
    };
  }

  /**
   * Creates a formatted string representation (enhanced ModValidationError pattern)
   *
   * @returns {string} Formatted error string
   */
  toString() {
    return `${this.name}[${this.#code}]: ${this.message} (severity: ${this.#severity}, recoverable: ${this.#recoverable})`;
  }

  /**
   * Adds context information to the error (fluent interface)
   *
   * @param {string} key - Context key
   * @param {*} value - Context value
   * @returns {BaseError} This instance for chaining
   */
  addContext(key, value) {
    if (!isNonBlankString(key)) {
      throw new Error(
        `addContext: Invalid context key '${key}'. Expected non-blank string.`
      );
    }
    this.#context[key] = value;
    return this;
  }

  /**
   * Retrieves context information
   *
   * @param {string|null} [key] - Specific context key to retrieve
   * @returns {*} Context value or entire context object if key is null
   */
  getContext(key = null) {
    return key
      ? this.#deepCopy(this.#context[key])
      : this.#deepCopy(this.#context);
  }
}

export default BaseError;
