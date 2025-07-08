// src/services/ajvSchemaValidator.js
// -----------------------------------------------------------------------------
// Implements ISchemaValidator via Ajv. Allows optional schema preloading.
// -----------------------------------------------------------------------------

import Ajv from 'ajv';
import addFormats from 'ajv-formats';

// ── IMPORT v3 TURN‐ACTION SCHEMA ─────────────────────────────────────────────
// Schema IDs can be preloaded by passing them in via constructor options.
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
  /** @type {import('ajv').default} */
  #ajv;
  /** @type {import('../interfaces/coreServices.js').ILogger} */
  #logger;

  /**
   * Ensures the Ajv instance is initialized.
   *
   * @throws {Error} If Ajv is not available.
   * @returns {void}
   */
  #ensureAjv() {
    if (!this.#ajv) {
      throw new Error('AjvSchemaValidator: Ajv instance not available.');
    }
  }

  /**
   * Validates and normalizes a schema ID.
   *
   * @param {string} id - Candidate schema identifier.
   * @returns {string} Normalized schema ID.
   * @throws {Error} If the ID is missing or invalid.
   */
  #requireValidSchemaId(id) {
    if (!id || typeof id !== 'string' || id.trim() === '') {
      throw new Error(
        'AjvSchemaValidator: Invalid or empty schemaId provided. Expected a non-empty string.'
      );
    }
    return id.trim();
  }

  /**
   * Validates inputs for {@link addSchema} and normalizes the schema ID.
   *
   * @protected
   * @param {object} schemaData - Schema object to add.
   * @param {string} schemaId - Candidate schema identifier.
   * @returns {string} Normalized schema ID to register.
   * @throws {Error} When the schema data or ID is invalid.
   */
  _validateAddSchemaInput(schemaData, schemaId) {
    if (
      !schemaData ||
      typeof schemaData !== 'object' ||
      Object.keys(schemaData).length === 0
    ) {
      const errMsg = `Invalid or empty schemaData provided for ID '${schemaId}'.`;
      this.#logger.error(`AjvSchemaValidator.addSchema: ${errMsg}`);
      throw new Error(`AjvSchemaValidator: ${errMsg}`);
    }

    try {
      return this.#requireValidSchemaId(schemaId);
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      this.#logger.error(`AjvSchemaValidator.addSchema: ${errorMessage}`);
      throw error;
    }
  }

  /**
   * Validates an array of schemas for {@link addSchemas}.
   *
   * @protected
   * @param {object[]} schemasArray - Array of schema objects with `$id` fields.
   * @returns {void}
   * @throws {Error} If the input array or any schema entry is invalid.
   */
  _validateBatchInput(schemasArray) {
    if (!Array.isArray(schemasArray) || schemasArray.length === 0) {
      const errMsg = 'addSchemas called with empty or non-array input.';
      this.#logger.error(`AjvSchemaValidator.addSchemas: ${errMsg}`);
      throw new Error(`AjvSchemaValidator: ${errMsg}`);
    }

    for (const schema of schemasArray) {
      if (!schema || typeof schema !== 'object') {
        const errMsg = 'All schemas must be objects with a valid $id.';
        this.#logger.error(`AjvSchemaValidator.addSchemas: ${errMsg}`);
        throw new Error(`AjvSchemaValidator: ${errMsg}`);
      }
      try {
        this.#requireValidSchemaId(schema.$id || '');
      } catch (error) {
        const errMsg = 'All schemas must be objects with a valid $id.';
        this.#logger.error(`AjvSchemaValidator.addSchemas: ${errMsg}`);
        throw new Error(`AjvSchemaValidator: ${errMsg}`);
      }
    }
  }

  /**
   * @param {object} [params]
   * @param {import('../interfaces/coreServices.js').ILogger} params.logger
   * @param {import('ajv').default} [params.ajvInstance]
   * @param {Array<{ schema: object, id: string }>} [params.preloadSchemas]
   */
  constructor({ logger, ajvInstance, preloadSchemas }) {
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
      if (ajvInstance) {
        this.#ajv = ajvInstance;
        this.#logger.debug('AjvSchemaValidator: Using provided Ajv instance.');
      } else {
        this.#ajv = new Ajv({
          allErrors: true,
          strictTypes: false,
          strict: false,
          validateFormats: false,
          allowUnionTypes: true,
          verbose: true,
        });
        addFormats(this.#ajv);
        this.#logger.debug(
          'AjvSchemaValidator: Ajv instance created and formats added.'
        );
      }

      if (Array.isArray(preloadSchemas)) {
        this.preloadSchemas(preloadSchemas);
      }
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
    try {
      this.#ensureAjv();
    } catch (error) {
      this.#logger.error(
        'AjvSchemaValidator.addSchema: Ajv instance not available.'
      );
      throw error;
    }

    const keyToRegister = this._validateAddSchemaInput(schemaData, schemaId);

    if (this.#ajv.getSchema(keyToRegister)) {
      const errorMsg = `AjvSchemaValidator: Schema with ID '${keyToRegister}' already exists. Ajv does not overwrite. Use removeSchema first if replacement is intended.`;
      this.#logger.error(errorMsg);
      throw new Error(errorMsg);
    }

    try {
      this.#ajv.addSchema(schemaData, keyToRegister);
      this.#logger.debug(
        `AjvSchemaValidator: Successfully added schema '${keyToRegister}'.`
      );

      // Verify that the schema was added correctly and can be retrieved
      const addedSchema = this.#ajv.getSchema(keyToRegister);
      if (!addedSchema) {
        this.#logger.warn(
          `AjvSchemaValidator: Schema '${keyToRegister}' was added but cannot be retrieved. This may indicate a $ref resolution issue.`
        );
      } else {
        this.#logger.debug(
          `AjvSchemaValidator: Schema '${keyToRegister}' verified as retrievable.`
        );
      }
    } catch (error) {
      this.#logger.error(
        `AjvSchemaValidator: Error adding schema with ID '${keyToRegister}': ${error instanceof Error ? error.message : String(error)}`,
        {
          schemaId: keyToRegister,
          error: error,
        }
      );
      if (error && typeof error === 'object' && 'errors' in error) {
        this.#logger.error(
          'Ajv Validation Errors (during addSchema):',
          JSON.stringify(error.errors, null, 2)
        );
      }
      throw error instanceof Error
        ? error
        : new Error(
            `Failed to add schema '${keyToRegister}': ${String(error)}`
          );
    }

    return Promise.resolve();
  }

  /**
   * Removes a schema from Ajv by its ID.
   *
   * @param {string} schemaId
   */
  removeSchema(schemaId) {
    try {
      this.#ensureAjv();
    } catch (error) {
      this.#logger.error(
        'AjvSchemaValidator.removeSchema: Ajv instance not available. Cannot remove schema.'
      );
      throw error;
    }

    let idToUse;
    try {
      idToUse = this.#requireValidSchemaId(schemaId);
    } catch (error) {
      this.#logger.warn(
        `AjvSchemaValidator: removeSchema called with invalid schemaId: '${schemaId}'`
      );
      return false;
    }

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
        `AjvSchemaValidator: Error removing schema '${idToUse}': ${error instanceof Error ? error.message : String(error)}`,
        {
          schemaId: idToUse,
          error: error,
        }
      );
      return false;
    }
  }

  /**
   * Preloads multiple schemas into Ajv.
   *
   * @param {Array<{schema: object, id: string}>} schemas
   * @returns {void}
   */
  preloadSchemas(schemas) {
    if (!Array.isArray(schemas)) {
      return;
    }
    for (const entry of schemas) {
      if (!entry || typeof entry.schema !== 'object' || !entry.id) {
        this.#logger.warn(
          'AjvSchemaValidator.preloadSchemas: invalid entry encountered.'
        );
        continue;
      }
      try {
        if (!this.#ajv.getSchema(entry.id)) {
          this.#ajv.addSchema(entry.schema, entry.id);
          this.#logger.debug(
            `AjvSchemaValidator: Successfully preloaded schema '${entry.id}'.`
          );
        } else {
          this.#logger.debug(
            `AjvSchemaValidator: Schema '${entry.id}' already loaded. Skipping.`
          );
        }
      } catch (preloadError) {
        this.#logger.error(
          `AjvSchemaValidator: Failed to preload schema '${entry.id}'. Error: ${preloadError instanceof Error ? preloadError.message : String(preloadError)}`,
          { schemaId: entry.id, error: preloadError }
        );
      }
    }
  }
  /**
   * Retrieves a validation function for a given schema ID.
   *
   * @param {string} schemaId
   * @returns {((data: any) => ValidationResult) | undefined}
   */
  getValidator(schemaId) {
    try {
      this.#ensureAjv();
    } catch (error) {
      this.#logger.warn(
        'AjvSchemaValidator: getValidator called but Ajv instance not available.'
      );
      return undefined;
    }

    try {
      this.#requireValidSchemaId(schemaId);
    } catch (error) {
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
        `AjvSchemaValidator: Error accessing schema '${schemaId}' via ajv.getSchema: ${error instanceof Error ? error.message : String(error)}`,
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
          `AjvSchemaValidator: Runtime error during validation with schema '${schemaId}': ${validationError instanceof Error ? validationError.message : String(validationError)}`,
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
              message: `Runtime validation error: ${validationError instanceof Error ? validationError.message : String(validationError)}`,
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
    try {
      this.#ensureAjv();
      this.#requireValidSchemaId(schemaId);
    } catch (error) {
      return false;
    }

    try {
      const validator = this.#ajv.getSchema(schemaId);
      return !!validator;
    } catch (error) {
      this.#logger.warn(
        `AjvSchemaValidator: Error accessing schema '${schemaId}' during isSchemaLoaded: ${error instanceof Error ? error.message : String(error)}`,
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
    try {
      this.#ensureAjv();
      this.#requireValidSchemaId(schemaId);
    } catch (error) {
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

  /**
   * Checks if all $refs in a schema are resolvable.
   * This helps diagnose schema loading issues.
   *
   * @param {string} schemaId
   * @returns {boolean}
   */
  validateSchemaRefs(schemaId) {
    try {
      this.#ensureAjv();
      this.#requireValidSchemaId(schemaId);
    } catch (error) {
      return false;
    }

    try {
      const schema = this.#ajv.getSchema(schemaId);
      if (!schema) {
        this.#logger.warn(
          `AjvSchemaValidator: Cannot validate refs for schema '${schemaId}' - schema not found.`
        );
        return false;
      }

      // Try to compile the schema to check for $ref resolution issues
      this.#ajv.compile(schema.schema);
      return true;
    } catch (error) {
      this.#logger.error(
        `AjvSchemaValidator: Schema '${schemaId}' has unresolved $refs or other issues: ${error instanceof Error ? error.message : String(error)}`,
        {
          schemaId: schemaId,
          error: error,
        }
      );
      return false;
    }
  }

  /**
   * Gets a list of all loaded schema IDs for debugging purposes.
   * Uses Ajv's internal schema map to determine which schemas are registered.
   *
   * @returns {string[]}
   */
  getLoadedSchemaIds() {
    if (!this.#ajv) {
      return [];
    }

    try {
      const schemaMap = this.#ajv.schemas || {};
      return Object.keys(schemaMap);
    } catch (error) {
      this.#logger.error(
        'AjvSchemaValidator: Error getting loaded schema IDs',
        { error: error }
      );
      return [];
    }
  }

  /**
   * Adds multiple JSON schema objects to the validator instance at once.
   *
   * @param {object[]} schemasArray - Array of schema objects, each with a valid $id.
   * @returns {Promise<void>}
   */
  async addSchemas(schemasArray) {
    try {
      this.#ensureAjv();
    } catch (error) {
      this.#logger.error(
        'AjvSchemaValidator.addSchemas: Ajv instance not available.'
      );
      throw error;
    }

    this._validateBatchInput(schemasArray);

    try {
      this.#ajv.addSchema(schemasArray);
      this.#logger.debug(
        `AjvSchemaValidator: Successfully added ${schemasArray.length} schemas in batch.`
      );
    } catch (error) {
      this.#logger.error(
        `AjvSchemaValidator: Error adding schemas in batch: ${error instanceof Error ? error.message : String(error)}`,
        { error }
      );
      if (error && typeof error === 'object' && 'errors' in error) {
        this.#logger.error(
          'Ajv Validation Errors (during addSchemas):',
          JSON.stringify(error.errors, null, 2)
        );
      }
      throw error instanceof Error
        ? error
        : new Error(`Failed to add schemas in batch: ${String(error)}`);
    }

    return Promise.resolve();
  }
}

export default AjvSchemaValidator;
