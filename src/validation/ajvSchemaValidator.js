// src/services/ajvSchemaValidator.js
// -----------------------------------------------------------------------------
// Implements ISchemaValidator via Ajv. Allows optional schema preloading.
// -----------------------------------------------------------------------------

import Ajv from 'ajv';
import addFormats from 'ajv-formats';
import { validateAgainstSchema as validateAgainstSchemaUtil } from '../utils/schemaValidationUtils.js';
import { formatAjvErrors } from '../utils/ajvUtils.js';
import { formatAjvErrorsEnhanced } from '../utils/ajvAnyOfErrorFormatter.js';

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
   * Creates a schema loader function for AJV to resolve relative schema references.
   * This converts relative paths like "./operations/unlockMovement.schema.json" or "../base-operation.schema.json"
   * to absolute schema IDs like "schema://living-narrative-engine/operations/unlockMovement.schema.json"
   *
   * @returns {Function} AJV-compatible loadSchema function
   */
  #createSchemaLoader() {
    const decodePointerSegment = (segment) =>
      segment.replace(/~1/g, '/').replace(/~0/g, '~');

    const resolveFragment = (schemaObject, fragment) => {
      if (!fragment || fragment === '#') {
        return schemaObject;
      }

      const pointer = fragment.startsWith('#') ? fragment.slice(1) : fragment;

      const parts = pointer
        .split('/')
        .filter((part) => part.length > 0)
        .map(decodePointerSegment);

      let current = schemaObject;
      for (const part of parts) {
        if (
          current &&
          typeof current === 'object' &&
          Object.prototype.hasOwnProperty.call(current, part)
        ) {
          current = current[part];
        } else {
          return null;
        }
      }

      return current;
    };

    const splitPathAndFragment = (target) => {
      const hashIndex = target.indexOf('#');
      if (hashIndex === -1) {
        return { basePath: target, fragment: '' };
      }

      return {
        basePath: target.slice(0, hashIndex),
        fragment: target.slice(hashIndex),
      };
    };

    const normaliseRelativeReference = (reference) => {
      let result = reference;
      while (result.startsWith('./')) {
        result = result.slice(2);
      }
      while (result.startsWith('../')) {
        result = result.slice(3);
      }
      return result;
    };

    const tryResolveFromId = (baseId, fragment) => {
      if (!baseId) {
        return null;
      }

      const candidates = fragment
        ? [`${baseId}${fragment}`, baseId]
        : [baseId];

      for (const candidateId of candidates) {
        try {
          const schemaEnv = this.#ajv.getSchema(candidateId);
          if (schemaEnv) {
            if (fragment && candidateId === baseId) {
              const fragmentSchema = resolveFragment(schemaEnv.schema, fragment);
              if (fragmentSchema) {
                return fragmentSchema;
              }
              // Fragment resolution failed - return null to signal error
              return null;
            } else {
              return schemaEnv.schema;
            }
          }
        } catch (error) {
          this.#logger.debug(
            `AjvSchemaValidator: Error resolving schema '${candidateId}': ${error instanceof Error ? error.message : String(error)}`
          );
        }
      }

      return null;
    };

    return async (uri) => {
      this.#logger.debug(
        `AjvSchemaValidator: Attempting to load schema from URI: ${uri}`
      );

      // Handle relative schema references by converting to absolute IDs
      if (uri.startsWith('./') || uri.startsWith('../')) {
        const normalisedReference = normaliseRelativeReference(uri);
        const { basePath: relativeBasePath, fragment } =
          splitPathAndFragment(normalisedReference);
        const absoluteBaseId = relativeBasePath
          ? `schema://living-narrative-engine/${relativeBasePath}`
          : '';

        if (absoluteBaseId) {
          this.#logger.debug(
            `AjvSchemaValidator: Converting relative URI '${uri}' to absolute ID '${absoluteBaseId}${fragment}'`
          );

          const absoluteSchema = tryResolveFromId(absoluteBaseId, fragment);
          if (absoluteSchema) {
            this.#logger.debug(
              `AjvSchemaValidator: Found existing schema for '${absoluteBaseId}${fragment}'`
            );
            return absoluteSchema;
          }
        }

        // If not found, try to find it by searching through all loaded schemas
        if (relativeBasePath) {
          const loadedIds = this.getLoadedSchemaIds();
          const matchingId = loadedIds.find((id) =>
            id.endsWith(relativeBasePath)
          );

          if (matchingId) {
            const matchingSchema = tryResolveFromId(matchingId, fragment);
            if (matchingSchema) {
              this.#logger.debug(
                `AjvSchemaValidator: Found schema '${matchingId}' matching relative path '${relativeBasePath}${fragment}'`
              );
              return matchingSchema;
            }
          }
        }

        const absoluteForLog = absoluteBaseId
          ? `${absoluteBaseId}${fragment}`
          : '(unresolved base path)';
        this.#logger.warn(
          `AjvSchemaValidator: Could not resolve schema reference '${uri}' (absolute: '${absoluteForLog}')`
        );
        throw new Error(`Cannot resolve schema reference: ${uri}`);
      }

      // For absolute URIs, try to load directly
      const { basePath, fragment } = splitPathAndFragment(uri);
      const existingSchema = tryResolveFromId(basePath, fragment);
      if (existingSchema) {
        this.#logger.debug(
          `AjvSchemaValidator: Found existing schema for '${uri}'`
        );
        return existingSchema;
      }

      this.#logger.warn(
        `AjvSchemaValidator: Could not resolve schema reference '${uri}'`
      );
      throw new Error(`Cannot resolve schema reference: ${uri}`);
    };
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
      const errorMessage =
        error instanceof Error ? error.message : String(error);
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
          loadSchema: this.#createSchemaLoader(),
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

      // Try to verify that the schema was added correctly and can be retrieved
      // This may fail if schema has unresolved $refs, but that's okay - just log a warning
      try {
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
      } catch (verifyError) {
        this.#logger.warn(
          `AjvSchemaValidator: Schema '${keyToRegister}' was added but cannot be compiled: ${verifyError instanceof Error ? verifyError.message : String(verifyError)}. This may indicate unresolved $refs that will be resolved later.`
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
   * Loads a schema object into the validator instance.
   * This is an alias for addSchema with parameters in the order expected by tests.
   *
   * @param {string} schemaId - The schema identifier
   * @param {object} schemaData - The schema object to load
   * @returns {Promise<void>}
   */
  async loadSchemaObject(schemaId, schemaData) {
    return this.addSchema(schemaData, schemaId);
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

          // Verify schema was added and can be retrieved
          const retrievedSchema = this.#ajv.getSchema(entry.id);
          if (retrievedSchema) {
            this.#logger.debug(
              `AjvSchemaValidator: Schema '${entry.id}' verified as retrievable after preload.`
            );
          } else {
            this.#logger.warn(
              `AjvSchemaValidator: Schema '${entry.id}' was preloaded but cannot be retrieved. This may indicate a $ref resolution issue.`
            );
          }
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
      // Check if schema is registered in the schema map
      const schemaMap = this.#ajv.schemas || {};
      if (!(schemaId in schemaMap)) {
        return false;
      }

      // Verify the schema can be retrieved and compiled
      // This ensures $refs are resolvable and the schema is actually usable
      const validator = this.#ajv.getSchema(schemaId);
      return !!validator;
    } catch (error) {
      // Schema is registered but has unresolved $refs or compilation issues
      this.#logger.warn(
        `AjvSchemaValidator: Schema '${schemaId}' is registered but cannot be compiled: ${error instanceof Error ? error.message : String(error)}`,
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

    // Filter out schemas that already exist to prevent duplicates
    const newSchemas = schemasArray.filter((schema) => {
      const schemaId = schema.$id;
      const exists = this.#ajv.getSchema(schemaId);
      if (exists) {
        this.#logger.debug(
          `AjvSchemaValidator: Schema '${schemaId}' already exists, skipping duplicate.`
        );
        return false;
      }
      return true;
    });

    if (newSchemas.length === 0) {
      this.#logger.debug(
        `AjvSchemaValidator: All ${schemasArray.length} schemas already exist, no new schemas to add.`
      );
      return Promise.resolve();
    }

    try {
      this.#ajv.addSchema(newSchemas);
      this.#logger.debug(
        `AjvSchemaValidator: Successfully added ${newSchemas.length} new schemas in batch (${schemasArray.length - newSchemas.length} already existed).`
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

  /**
   * Validates data against the specified schema ID using the utility function.
   * This method provides compatibility with character builder services.
   *
   * @param {any} data - The data to validate
   * @param {string} schemaId - The schema ID to validate against
   * @param {object} [context] - Optional context for validation
   * @returns {boolean} - True if valid, false otherwise
   */
  validateAgainstSchema(data, schemaId, context = {}) {
    try {
      const result = validateAgainstSchemaUtil(
        this,
        schemaId,
        data,
        this.#logger,
        context
      );
      return result.isValid;
    } catch (error) {
      this.#logger.error(
        `AjvSchemaValidator: validateAgainstSchema failed for schema '${schemaId}': ${error.message}`,
        { schemaId, error }
      );
      return false;
    }
  }

  /**
   * Formats Ajv errors into a readable string.
   * This method provides compatibility with character builder services.
   *
   * @param {object[]} errors - Array of Ajv error objects
   * @param {any} [data] - The data being validated (optional)
   * @returns {string} - Formatted error string
   */
  formatAjvErrors(errors, data) {
    return formatAjvErrorsEnhanced(errors, data);
  }

  /**
   * @description Overrides the internal Ajv instance. This is intended solely for test scenarios
   * that need to simulate Ajv unavailability in order to exercise error handling paths.
   *
   * @param {import('ajv').default | null | undefined} ajvInstance - Ajv instance to assign or
   *   {@link null} to clear the reference.
   * @returns {void}
   */
  _setAjvInstanceForTesting(ajvInstance) {
    this.#ajv = ajvInstance ?? null;
  }
}

export default AjvSchemaValidator;
