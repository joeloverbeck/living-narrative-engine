// src/services/ajvSchemaValidator.js
// -----------------------------------------------------------------------------
// Implements ISchemaValidator via Ajv. Preloads both v1 and v2 “turn action” schemas.
// -----------------------------------------------------------------------------

import Ajv from 'ajv';
import addFormats from 'ajv-formats';
import { SYSTEM_ERROR_OCCURRED_ID } from '../constants/eventIds.js';

// ── IMPORT v3 TURN‐ACTION SCHEMA ─────────────────────────────────────────────
import {
  LLM_TURN_ACTION_RESPONSE_SCHEMA,
  LLM_TURN_ACTION_RESPONSE_SCHEMA_ID,
} from '../turns/schemas/llmOutputSchemas.js';
// ───────────────────────────────────────────────────────────────────────────────

/**
 * @typedef {import('../interfaces/coreServices.js').ISchemaValidator} ISchemaValidator
 * @typedef {import('../interfaces/coreServices.js').ValidationResult} ValidationResult
 * @typedef {import('ajv').ErrorObject} AjvErrorObject
 */

/**
 * Implements the ISchemaValidator interface using Ajv.
 * Preloads the consolidated v3 turn‐action schema so it can be retrieved by ID.
 */
class AjvSchemaValidator {
  #ajv = null;
  #logger = null;
  #dispatcher = null;

  /**
   * Dispatches a SYSTEM_ERROR_OCCURRED_ID event with context details.
   *
   * @param {string} message
   * @param {Error} [err]
   */
  #emitError(message, err) {
    const details = {
      timestamp: new Date().toISOString(),
      raw: err ? err.message : undefined,
      stack: err ? err.stack : undefined,
    };
    this.#dispatcher.dispatch(SYSTEM_ERROR_OCCURRED_ID, { message, details });
  }

  /**
   * @param {object} dependencies
   * @param {import('../interfaces/coreServices.js').ILogger} dependencies.logger
   * @param {import('../interfaces/ISafeEventDispatcher.js').ISafeEventDispatcher} dependencies.dispatcher
   */
  constructor({ logger, dispatcher }) {
    if (
      !logger ||
      typeof logger.info !== 'function' ||
      typeof logger.warn !== 'function' ||
      typeof logger.error !== 'function' ||
      typeof logger.debug !== 'function'
    ) {
      throw new Error(
        "AjvSchemaValidator: Missing or invalid 'logger' dependency (ILogger). Requires info, warn, error, debug."
      );
    }
    if (!dispatcher || typeof dispatcher.dispatch !== 'function') {
      throw new Error(
        'AjvSchemaValidator: Missing or invalid SafeEventDispatcher with .dispatch(...)'
      );
    }
    this.#logger = logger;
    this.#dispatcher = dispatcher;

    try {
      this.#ajv = new Ajv({ allErrors: true, strictTypes: false });
      addFormats(this.#ajv);
      this.#logger.debug(
        'AjvSchemaValidator: Ajv instance created and formats added.'
      );

      // ── PRELOAD v3 TURN‐ACTION SCHEMA ─────────────────────────────────────────
      try {
        if (!this.#ajv.getSchema(LLM_TURN_ACTION_RESPONSE_SCHEMA_ID)) {
          this.#ajv.addSchema(
            LLM_TURN_ACTION_RESPONSE_SCHEMA,
            LLM_TURN_ACTION_RESPONSE_SCHEMA_ID
          );
          this.#logger.info(
            `AjvSchemaValidator: Successfully preloaded schema '${LLM_TURN_ACTION_RESPONSE_SCHEMA_ID}'.`
          );
        } else {
          this.#logger.debug(
            `AjvSchemaValidator: Schema '${LLM_TURN_ACTION_RESPONSE_SCHEMA_ID}' already loaded. Skipping.`
          );
        }
      } catch (preloadError) {
        this.#emitError(
          `AjvSchemaValidator: Failed to preload schema '${LLM_TURN_ACTION_RESPONSE_SCHEMA_ID}'. Error: ${preloadError.message}`,
          preloadError
        );
      }
      // ───────────────────────────────────────────────────────────────────────────
    } catch (error) {
      this.#emitError(
        `AjvSchemaValidator: CRITICAL - Failed to instantiate Ajv or add formats: ${error.message}`,
        error
      );
      throw new Error('AjvSchemaValidator: Failed to initialize Ajv.');
    }
  }

  /**
   * Adds a JSON schema object to the validator instance.
   *
   * @param {object} schemaData
   * @param {string} schemaId
   * @returns {Promise<void>}
   */
  async addSchema(schemaData, schemaId) {
    if (!this.#ajv) {
      this.#emitError(
        'AjvSchemaValidator.addSchema: Ajv instance not available.'
      );
      return Promise.reject(
        new Error('AjvSchemaValidator: Ajv instance not available.')
      );
    }
    if (
      !schemaData ||
      typeof schemaData !== 'object' ||
      Object.keys(schemaData).length === 0
    ) {
      const errMsg = `Invalid or empty schemaData provided for ID '${schemaId}'.`;
      this.#emitError(`AjvSchemaValidator.addSchema: ${errMsg}`);
      return Promise.reject(new Error(`AjvSchemaValidator: ${errMsg}`));
    }
    if (!schemaId || typeof schemaId !== 'string' || schemaId.trim() === '') {
      const errMsg =
        'Invalid or empty schemaId provided. Expected a non-empty string.';
      this.#emitError(`AjvSchemaValidator.addSchema: ${errMsg}`);
      return Promise.reject(new Error(`AjvSchemaValidator: ${errMsg}`));
    }

    const keyToRegister = schemaId.trim();

    try {
      if (this.#ajv.getSchema(keyToRegister)) {
        const errorMsg = `AjvSchemaValidator: Schema with ID '${keyToRegister}' already exists. Ajv does not overwrite. Use removeSchema first if replacement is intended.`;
        this.#emitError(errorMsg);
        throw new Error(errorMsg);
      }

      this.#ajv.addSchema(schemaData, keyToRegister);
      this.#logger.debug(
        `AjvSchemaValidator: Successfully added schema '${keyToRegister}'.`
      );
      return Promise.resolve();
    } catch (error) {
      this.#emitError(
        `AjvSchemaValidator: Error adding schema with ID '${keyToRegister}': ${error.message}`,
        error
      );
      if (error.errors) {
        this.#emitError(
          'Ajv Validation Errors (during addSchema): ' +
            JSON.stringify(error.errors, null, 2)
        );
      }
      const rejectionError =
        error instanceof Error
          ? error
          : new Error(
              `Failed to add schema '${keyToRegister}': ${String(error)}`
            );
      return Promise.reject(rejectionError);
    }
  }

  /**
   * Removes a schema from Ajv by its ID.
   *
   * @param {string} schemaId
   * @returns {boolean}
   */
  removeSchema(schemaId) {
    if (!this.#ajv) {
      this.#emitError(
        'AjvSchemaValidator.removeSchema: Ajv instance not available. Cannot remove schema.'
      );
      throw new Error('AjvSchemaValidator: Ajv instance not available.');
    }
    if (!schemaId || typeof schemaId !== 'string' || schemaId.trim() === '') {
      this.#logger.warn(
        `AjvSchemaValidator: removeSchema called with invalid schemaId: '${schemaId}'`
      );
      return false;
    }

    const idToUse = schemaId.trim();

    try {
      if (!this.#ajv.getSchema(idToUse)) {
        this.#logger.warn(
          `AjvSchemaValidator: Schema '${idToUse}' not found. Cannot remove.`
        );
        return false;
      }

      this.#ajv.removeSchema(idToUse);
      const removedSuccessfully = !this.#ajv.getSchema(idToUse);

      if (removedSuccessfully) {
        this.#logger.debug(
          `AjvSchemaValidator: Successfully removed schema '${idToUse}'.`
        );
        return true;
      } else {
        this.#emitError(
          `AjvSchemaValidator: Called removeSchema for '${idToUse}', but it still appears present.`
        );
        return false;
      }
    } catch (error) {
      this.#emitError(
        `AjvSchemaValidator: Error removing schema '${idToUse}': ${error.message}`,
        error
      );
      return false;
    }
  }

  /**
   * Retrieves a validation function for a given schema ID.
   *
   * @param {string} schemaId
   * @returns {((data: any) => ValidationResult) | undefined}
   */
  getValidator(schemaId) {
    if (!this.#ajv) {
      this.#logger.warn(
        'AjvSchemaValidator: getValidator called but Ajv instance not available.'
      );
      return undefined;
    }
    if (!schemaId || typeof schemaId !== 'string') {
      this.#logger.warn(
        `AjvSchemaValidator: getValidator called with invalid schemaId: ${schemaId}`
      );
      return undefined;
    }

    let originalValidator;
    try {
      originalValidator = this.#ajv.getSchema(schemaId);
    } catch (error) {
      this.#logger.warn(
        `AjvSchemaValidator: Error accessing schema '${schemaId}' via ajv.getSchema: ${error.message}`,
        {
          schemaId: schemaId,
          error: error,
        }
      );
      return undefined;
    }

    if (!originalValidator) {
      return undefined;
    }

    return (data) => {
      try {
        const isValid = originalValidator(data);
        const validationErrors = originalValidator.errors;
        return {
          isValid: isValid,
          errors: isValid ? null : validationErrors || [],
        };
      } catch (validationError) {
        this.#emitError(
          `AjvSchemaValidator: Runtime error during validation with schema '${schemaId}': ${validationError.message}`,
          validationError
        );
        return {
          isValid: false,
          errors: [
            {
              instancePath: '',
              schemaPath: '',
              keyword: 'runtimeError',
              params: {},
              message: `Runtime validation error: ${validationError.message}`,
            },
          ],
        };
      }
    };
  }

  /**
   * Checks if a schema is loaded/compiled.
   *
   * @param {string} schemaId
   * @returns {boolean}
   */
  isSchemaLoaded(schemaId) {
    if (!this.#ajv) {
      return false;
    }
    if (!schemaId || typeof schemaId !== 'string') {
      return false;
    }

    try {
      const validator = this.#ajv.getSchema(schemaId);
      return !!validator;
    } catch (error) {
      this.#logger.warn(
        `AjvSchemaValidator: Error accessing schema '${schemaId}' during isSchemaLoaded: ${error.message}`,
        {
          schemaId: schemaId,
          error: error,
        }
      );
      return false;
    }
  }

  /**
   * Validates data against the specified schema ID.
   *
   * @param {string} schemaId
   * @param {any} data
   * @returns {ValidationResult}
   */
  validate(schemaId, data) {
    const validatorFunction = this.getValidator(schemaId);

    if (!validatorFunction) {
      this.#logger.warn(
        `AjvSchemaValidator: validate called for schemaId '${schemaId}', but no validator function was found.`
      );
      return {
        isValid: false,
        errors: [
          {
            instancePath: '',
            schemaPath: '',
            keyword: 'schemaNotFound',
            params: { schemaId: schemaId },
            message: `Schema with id '${schemaId}' not found, is invalid, or validator could not be retrieved.`,
          },
        ],
      };
    }
    return validatorFunction(data);
  }
}

export default AjvSchemaValidator;
