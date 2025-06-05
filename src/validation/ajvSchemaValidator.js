// src/services/ajvSchemaValidator.js
// -----------------------------------------------------------------------------
// Implements ISchemaValidator via Ajv. Preloads both v1 and v2 “turn action” schemas.
// -----------------------------------------------------------------------------

import Ajv from 'ajv';
import addFormats from 'ajv-formats';

// ── IMPORT BOTH v1 AND v2 TURN-ACTION SCHEMAS ─────────────────────────────────
import {
  LLM_TURN_ACTION_SCHEMA,
  LLM_TURN_ACTION_SCHEMA_ID,
  LLM_TURN_ACTION_WITH_THOUGHTS_SCHEMA,
  LLM_TURN_ACTION_WITH_THOUGHTS_SCHEMA_ID,
} from '../turns/schemas/llmOutputSchemas.js';
// ───────────────────────────────────────────────────────────────────────────────

/**
 * @typedef {import('../interfaces/coreServices.js').ISchemaValidator} ISchemaValidator
 * @typedef {import('../interfaces/coreServices.js').ValidationResult} ValidationResult
 * @typedef {import('ajv').ErrorObject} AjvErrorObject
 */

/**
 * Implements the ISchemaValidator interface using Ajv.
 * Preloads both the v1 and v2 turn‐action schemas so they can be retrieved by ID.
 */
class AjvSchemaValidator {
  #ajv = null;
  #logger = null;

  /**
   * @param {import('../interfaces/coreServices.js').ILogger} logger
   */
  constructor(logger) {
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
    this.#logger = logger;

    try {
      this.#ajv = new Ajv({
        allErrors: true,
        strictTypes: false,
      });
      addFormats(this.#ajv);
      this.#logger.debug(
        'AjvSchemaValidator: Ajv instance created and formats added.'
      );

      // ── PRELOAD v1 TURN-ACTION SCHEMA ─────────────────────────────────────────
      try {
        if (!this.#ajv.getSchema(LLM_TURN_ACTION_SCHEMA_ID)) {
          this.#ajv.addSchema(LLM_TURN_ACTION_SCHEMA);
          this.#logger.info(
            `AjvSchemaValidator: Successfully preloaded core schema '${LLM_TURN_ACTION_SCHEMA_ID}'.`
          );
        } else {
          this.#logger.debug(
            `AjvSchemaValidator: Core schema '${LLM_TURN_ACTION_SCHEMA_ID}' already loaded. Skipping.`
          );
        }
      } catch (preloadError) {
        this.#logger.error(
          `AjvSchemaValidator: Failed to preload core schema '${LLM_TURN_ACTION_SCHEMA_ID}'. Error: ${preloadError.message}`,
          {
            schemaId: LLM_TURN_ACTION_SCHEMA_ID,
            error: preloadError,
          }
        );
      }
      // ───────────────────────────────────────────────────────────────────────────

      // ── PRELOAD v2 TURN-ACTION WITH THOUGHTS SCHEMA ────────────────────────────
      try {
        if (!this.#ajv.getSchema(LLM_TURN_ACTION_WITH_THOUGHTS_SCHEMA_ID)) {
          this.#ajv.addSchema(LLM_TURN_ACTION_WITH_THOUGHTS_SCHEMA);
          this.#logger.info(
            `AjvSchemaValidator: Successfully preloaded core schema '${LLM_TURN_ACTION_WITH_THOUGHTS_SCHEMA_ID}'.`
          );
        } else {
          this.#logger.debug(
            `AjvSchemaValidator: Core schema '${LLM_TURN_ACTION_WITH_THOUGHTS_SCHEMA_ID}' already loaded. Skipping.`
          );
        }
      } catch (preloadError2) {
        this.#logger.error(
          `AjvSchemaValidator: Failed to preload core schema '${LLM_TURN_ACTION_WITH_THOUGHTS_SCHEMA_ID}'. Error: ${preloadError2.message}`,
          {
            schemaId: LLM_TURN_ACTION_WITH_THOUGHTS_SCHEMA_ID,
            error: preloadError2,
          }
        );
      }
      // ───────────────────────────────────────────────────────────────────────────
    } catch (error) {
      this.#logger.error(
        'AjvSchemaValidator: CRITICAL - Failed to instantiate Ajv or add formats:',
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
      this.#logger.error(
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
      this.#logger.error(`AjvSchemaValidator.addSchema: ${errMsg}`);
      return Promise.reject(new Error(`AjvSchemaValidator: ${errMsg}`));
    }
    if (!schemaId || typeof schemaId !== 'string' || schemaId.trim() === '') {
      const errMsg =
        'Invalid or empty schemaId provided. Expected a non-empty string.';
      this.#logger.error(`AjvSchemaValidator.addSchema: ${errMsg}`);
      return Promise.reject(new Error(`AjvSchemaValidator: ${errMsg}`));
    }

    const keyToRegister = schemaId.trim();

    try {
      if (this.#ajv.getSchema(keyToRegister)) {
        const errorMsg = `AjvSchemaValidator: Schema with ID '${keyToRegister}' already exists. Ajv does not overwrite. Use removeSchema first if replacement is intended.`;
        this.#logger.error(errorMsg);
        throw new Error(errorMsg);
      }

      this.#ajv.addSchema(schemaData, keyToRegister);
      this.#logger.debug(
        `AjvSchemaValidator: Successfully added schema '${keyToRegister}'.`
      );
      return Promise.resolve();
    } catch (error) {
      this.#logger.error(
        `AjvSchemaValidator: Error adding schema with ID '${keyToRegister}': ${error.message}`,
        {
          schemaId: keyToRegister,
          error: error,
        }
      );
      if (error.errors) {
        this.#logger.error(
          'Ajv Validation Errors (during addSchema):',
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
      this.#logger.error(
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
        this.#logger.error(
          `AjvSchemaValidator: Called removeSchema for '${idToUse}', but it still appears present.`
        );
        return false;
      }
    } catch (error) {
      this.#logger.error(
        `AjvSchemaValidator: Error removing schema '${idToUse}': ${error.message}`,
        {
          schemaId: idToUse,
          error: error,
        }
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
        this.#logger.error(
          `AjvSchemaValidator: Runtime error during validation with schema '${schemaId}': ${validationError.message}`,
          {
            schemaId: schemaId,
            error: validationError,
          }
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
