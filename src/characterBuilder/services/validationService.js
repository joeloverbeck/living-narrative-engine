/**
 * @file ValidationService centralizes schema validation flows for character builder controllers.
 */

/** @typedef {import('../../interfaces/ILogger.js').ILogger} ILogger */
/** @typedef {import('../../interfaces/coreServices.js').ISchemaValidator} ISchemaValidator */

/**
 * @typedef {object} ValidationServiceDependencies
 * @property {ISchemaValidator} schemaValidator - Shared schema validator instance.
 * @property {ILogger} logger - Logger used for validation warnings.
 * @property {Function} handleError - Error handler used when validation throws.
 * @property {Record<string, string>} errorCategories - Error categories enum.
 */

/**
 * Provides reusable validation helpers and error formatting utilities.
 */
export class ValidationService {
  /** @type {ISchemaValidator} */
  #schemaValidator;

  /** @type {ILogger} */
  #logger;

  /** @type {Function} */
  #handleError;

  /** @type {Record<string, string>} */
  #errorCategories;

  /**
   * @param {ValidationServiceDependencies} dependencies
   * @description Store dependencies required to run schema validation workflows.
   */
  constructor({ schemaValidator, logger, handleError, errorCategories }) {
    if (!schemaValidator || typeof schemaValidator.validate !== 'function') {
      throw new Error(
        'ValidationService requires a schemaValidator with a validate() method.'
      );
    }

    if (!logger || typeof logger.warn !== 'function') {
      throw new Error('ValidationService requires a logger with warn().');
    }

    if (typeof handleError !== 'function') {
      throw new Error('ValidationService requires a handleError function.');
    }

    if (!errorCategories || typeof errorCategories.SYSTEM !== 'string') {
      throw new Error(
        'ValidationService requires errorCategories with a SYSTEM entry.'
      );
    }

    this.#schemaValidator = schemaValidator;
    this.#logger = logger;
    this.#handleError = handleError;
    this.#errorCategories = errorCategories;
  }

  /**
   * @param {object} data - Payload being validated.
   * @param {string} schemaId - Schema identifier registered with the validator.
   * @param {object} [context] - Additional logging metadata such as operation name.
   * @returns {{isValid: true}|{isValid: false, errors: string[], errorMessage: string, failureMessage?: string}}
   * @description Validate a payload against a schema and format resulting errors.
   */
  validateData(data, schemaId, context = {}) {
    try {
      const validationResult = this.#schemaValidator.validate(schemaId, data);

      if (validationResult?.isValid) {
        return { isValid: true };
      }

      const formattedErrors = this.formatValidationErrors(
        validationResult?.errors
      );
      const errorCount = Array.isArray(validationResult?.errors)
        ? validationResult.errors.length
        : 0;
      const controllerName =
        context.controllerName || this.constructor.name || 'ValidationService';
      const failureMessage = `${controllerName}: Validation failed for schema '${schemaId}' with ${errorCount} error(s)`;
      const loggerContext = {
        ...context,
        operation: context.operation || 'validateData',
        schemaId,
      };

      this.#logger.warn(failureMessage, loggerContext);

      return {
        isValid: false,
        errors: formattedErrors,
        errorMessage: this.buildValidationErrorMessage(formattedErrors),
        failureMessage,
      };
    } catch (error) {
      this.#handleError(error, {
        operation: context.operation || 'validateData',
        category: this.#errorCategories.SYSTEM,
        userMessage: 'Validation failed. Please check your input.',
        metadata: { schemaId, dataKeys: Object.keys(data || {}) },
      });

      return {
        isValid: false,
        errors: [`Validation error: ${error.message}`],
        errorMessage: 'Unable to validate data. Please try again.',
      };
    }
  }

  /**
   * @param {unknown} errors - Raw validator errors.
   * @returns {string[]} Array of normalized error messages.
   * @description Convert AJV error payloads into user-friendly strings.
   */
  formatValidationErrors(errors) {
    if (!Array.isArray(errors)) {
      return ['Invalid data format'];
    }

    return errors.map((error) => {
      if (typeof error === 'string') {
        return error;
      }

      if (error && typeof error === 'object') {
        if (error.instancePath && error.message) {
          const field = error.instancePath.replace(/^\//, '').replace(/\//g, '.');
          return field ? `${field}: ${error.message}` : error.message;
        }

        if (typeof error.message === 'string') {
          return error.message;
        }
      }

      return 'Unknown validation error';
    });
  }

  /**
   * @param {string[]} errors - User-facing error strings.
   * @returns {string} Combined error message.
   * @description Build a message summarizing one or many validation errors.
   */
  buildValidationErrorMessage(errors) {
    if (errors.length === 1) {
      return errors[0];
    }

    return `Please fix the following errors:\n${errors
      .map((error) => `• ${error}`)
      .join('\n')}`;
  }
}
