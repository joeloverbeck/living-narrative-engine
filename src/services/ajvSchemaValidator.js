// src/core/services/ajvSchemaValidator.js
// --- FILE START ---

import Ajv from 'ajv';
import addFormats from 'ajv-formats';

// --- ADDED IMPORT FOR LLM SCHEMA ---
import {LLM_TURN_ACTION_SCHEMA, LLM_TURN_ACTION_SCHEMA_ID} from '../turns/schemas/llmOutputSchemas.js';
// --- END ADDED IMPORT ---

/**
 * @typedef {import('../interfaces/coreServices.js').ISchemaValidator} ISchemaValidator
 * @typedef {import('../interfaces/coreServices.js').ValidationResult} ValidationResult
 * @typedef {import('ajv').ErrorObject} AjvErrorObject // Import Ajv specific type if needed elsewhere
 */

/**
 * Implements the ISchemaValidator interface using the Ajv library.
 * Provides methods to add schemas and retrieve validation functions,
 * replicating the core validation logic previously in GameDataRepository.
 *
 * @implements {ISchemaValidator}
 */
class AjvSchemaValidator {
    /**
     * The Ajv instance used for schema management and validation.
     * @private
     * @type {Ajv | null}
     */
    #ajv = null;
    /**
     * Injected logger instance.
     * @private
     * @type {import('../interfaces/coreServices.js').ILogger}
     */
    #logger = null;

    /**
     * Initializes the Ajv instance and preloads core schemas.
     * @param {import('../interfaces/coreServices.js').ILogger} logger - Logger instance.
     * @throws {Error} If Ajv instantiation fails or logger is invalid.
     */
    constructor(logger) {
        if (!logger || typeof logger.info !== 'function' || typeof logger.warn !== 'function' || typeof logger.error !== 'function' || typeof logger.debug !== 'function') {
            throw new Error("AjvSchemaValidator: Missing or invalid 'logger' dependency (ILogger). Requires info, warn, error, and debug methods.");
        }
        this.#logger = logger;

        try {
            this.#ajv = new Ajv({
                allErrors: true,
                strictTypes: false,
            });
            addFormats(this.#ajv);
            this.#logger.debug("AjvSchemaValidator: Ajv instance created and formats added successfully.");

            // --- ADDED: PRELOAD CORE LLM SCHEMA ---
            try {
                // The LLM_TURN_ACTION_SCHEMA object contains its own $id (LLM_TURN_ACTION_SCHEMA_ID),
                // which Ajv will use as the key.
                if (!this.#ajv.getSchema(LLM_TURN_ACTION_SCHEMA_ID)) {
                    this.#ajv.addSchema(LLM_TURN_ACTION_SCHEMA);
                    this.#logger.info(`AjvSchemaValidator: Successfully preloaded core schema '${LLM_TURN_ACTION_SCHEMA_ID}'.`);
                } else {
                    // This case implies the constructor might be called in a way that this schema
                    // is already present, or schema with this ID was added by another mechanism.
                    // For a singleton, this specific "else" block for preloading should not be hit frequently.
                    this.#logger.debug(`AjvSchemaValidator: Core schema '${LLM_TURN_ACTION_SCHEMA_ID}' was already loaded. Skipping preload.`);
                }
            } catch (preloadError) {
                this.#logger.error(`AjvSchemaValidator: CRITICAL - Failed to preload core schema '${LLM_TURN_ACTION_SCHEMA_ID}'. Error: ${preloadError.message}`, {
                    schemaId: LLM_TURN_ACTION_SCHEMA_ID,
                    error: preloadError
                });
                // Depending on the application's criticality for this schema,
                // you might want to rethrow the error to halt initialization.
                // throw new Error(`AjvSchemaValidator: Failed to preload critical core schema '${LLM_TURN_ACTION_SCHEMA_ID}'.`);
            }
            // --- END ADDED: PRELOAD CORE LLM SCHEMA ---

        } catch (error) {
            this.#logger.error('AjvSchemaValidator: CRITICAL - Failed to instantiate Ajv or add formats:', error);
            throw new Error('AjvSchemaValidator: Failed to initialize the Ajv validation library.');
        }
    }

    /**
     * Adds a JSON schema object to the validator instance, associating it with the given schema ID.
     * The promise resolves when the schema is successfully added and potentially compiled/prepared for validation.
     *
     * @param {object} schemaData - The JSON schema object. Must have a valid structure.
     * @param {string} schemaId - The unique identifier for the schema (typically the '$id' property within the schemaData).
     * @returns {Promise<void>} Resolves on successful addition, rejects if Ajv encounters an error.
     */
    async addSchema(schemaData, schemaId) {
        if (!this.#ajv) {
            this.#logger.error('AjvSchemaValidator.addSchema: Ajv instance not available.');
            return Promise.reject(new Error('AjvSchemaValidator: Ajv instance not available. Cannot add schema.'));
        }
        if (!schemaData || typeof schemaData !== 'object' || Object.keys(schemaData).length === 0) {
            const errMsg = `Invalid or empty schemaData provided for ID '${schemaId}'. Expected a non-empty object.`;
            this.#logger.error(`AjvSchemaValidator.addSchema: ${errMsg}`);
            return Promise.reject(new Error(`AjvSchemaValidator: ${errMsg}`));
        }
        if (!schemaId || typeof schemaId !== 'string' || schemaId.trim() === '') {
            const errMsg = 'Invalid or empty schemaId provided. Expected a non-empty string.';
            this.#logger.error(`AjvSchemaValidator.addSchema: ${errMsg}`);
            return Promise.reject(new Error(`AjvSchemaValidator: ${errMsg}`));
        }

        // Use the schema's internal $id if schemaId parameter is not the defining one,
        // or ensure they match if both are present. Ajv uses schema.$id as a primary key.
        // For simplicity, we assume schemaId is the intended key for registration.
        const keyToRegister = schemaId.trim();

        try {
            if (this.#ajv.getSchema(keyToRegister)) {
                const errorMsg = `AjvSchemaValidator: Schema with ID '${keyToRegister}' already exists. Ajv does not overwrite. Use removeSchema first if replacement is intended.`;
                this.#logger.error(errorMsg);
                throw new Error(errorMsg); // Throw to be caught and rejected as a promise
            }

            // If schemaData has an $id that differs from keyToRegister, Ajv might get confused or prioritize $id.
            // It's best if keyToRegister and schemaData.$id (if present) are consistent.
            // Or, remove schemaData.$id if keyToRegister is to be the sole identifier for this addition.
            // For now, proceeding with keyToRegister. Ajv's addSchema(schema, key) uses 'key'.
            this.#ajv.addSchema(schemaData, keyToRegister);
            this.#logger.debug(`AjvSchemaValidator: Successfully added schema '${keyToRegister}'.`);
            return Promise.resolve();
        } catch (error) {
            this.#logger.error(`AjvSchemaValidator: Error adding schema with ID '${keyToRegister}': ${error.message}`, {
                schemaId: keyToRegister,
                error: error,
                // schemaData: schemaData // Be cautious logging full schema data if it's very large
            });
            if (error.errors) {
                this.#logger.error('Ajv Validation Errors (during addSchema):', JSON.stringify(error.errors, null, 2));
            }
            const rejectionError = error instanceof Error ? error : new Error(`Failed to add schema '${keyToRegister}': ${String(error)}`);
            return Promise.reject(rejectionError);
        }
    }

    /**
     * Removes a schema from the Ajv instance using its ID.
     *
     * @param {string} schemaId - The unique identifier ($id) of the schema to remove.
     * @returns {boolean} True if the schema was successfully removed, false otherwise.
     * @throws {Error} If the Ajv instance is not available.
     */
    removeSchema(schemaId) {
        if (!this.#ajv) {
            this.#logger.error('AjvSchemaValidator.removeSchema: Ajv instance not available.');
            throw new Error('AjvSchemaValidator: Ajv instance not available. Cannot remove schema.');
        }
        if (!schemaId || typeof schemaId !== 'string' || schemaId.trim() === '') {
            this.#logger.warn(`AjvSchemaValidator: removeSchema called with invalid schemaId: '${schemaId}'`);
            return false;
        }

        const idToUse = schemaId.trim();

        try {
            if (!this.#ajv.getSchema(idToUse)) {
                this.#logger.warn(`AjvSchemaValidator: Schema '${idToUse}' not found. Cannot remove.`);
                return false;
            }

            this.#ajv.removeSchema(idToUse);
            const removedSuccessfully = !this.#ajv.getSchema(idToUse);

            if (removedSuccessfully) {
                this.#logger.debug(`AjvSchemaValidator: Successfully removed schema '${idToUse}'.`);
                return true;
            } else {
                this.#logger.error(`AjvSchemaValidator: Called removeSchema for '${idToUse}', but it appears to still be present.`);
                return false;
            }
        } catch (error) {
            this.#logger.error(`AjvSchemaValidator: Error removing schema '${idToUse}': ${error.message}`, {
                schemaId: idToUse,
                error: error
            });
            return false;
        }
    }

    /**
     * Retrieves a validation function for the specified schema ID.
     *
     * @param {string} schemaId - The unique identifier for the schema.
     * @returns {((data: any) => ValidationResult) | undefined} A validation function, or undefined if not found.
     */
    getValidator(schemaId) {
        if (!this.#ajv) {
            this.#logger.warn('AjvSchemaValidator: getValidator called but Ajv instance not available.');
            return undefined;
        }
        if (!schemaId || typeof schemaId !== 'string') {
            this.#logger.warn(`AjvSchemaValidator: getValidator called with invalid schemaId: ${schemaId}`);
            return undefined;
        }

        let originalValidator;
        try {
            originalValidator = this.#ajv.getSchema(schemaId);
        } catch (error) {
            this.#logger.warn(`AjvSchemaValidator: Error accessing schema '${schemaId}' via ajv.getSchema: ${error.message}`, {
                schemaId: schemaId,
                error: error
            });
            return undefined;
        }

        if (!originalValidator) {
            // This is a common case (schema not found), so debug level might be more appropriate
            // if it's not necessarily an error condition for the caller.
            // this.#logger.debug(`AjvSchemaValidator: No validator found for schemaId '${schemaId}'.`);
            return undefined;
        }

        return (data) => {
            try {
                const isValid = originalValidator(data);
                const validationErrors = originalValidator.errors; // Access errors from the validator instance

                return {
                    isValid: isValid,
                    errors: isValid ? null : (validationErrors || [])
                };
            } catch (validationError) {
                this.#logger.error(`AjvSchemaValidator: Runtime error during validation with schema '${schemaId}': ${validationError.message}`, {
                    schemaId: schemaId,
                    error: validationError,
                    // data: data // Be cautious logging potentially sensitive data
                });
                return {
                    isValid: false,
                    errors: [{
                        instancePath: '',
                        schemaPath: '',
                        keyword: 'runtimeError',
                        params: {},
                        message: `Runtime validation error: ${validationError.message}`
                    }]
                };
            }
        };
    }

    /**
     * Checks if a schema with the specified ID has been successfully loaded and is ready for use.
     *
     * @param {string} schemaId - The unique identifier for the schema.
     * @returns {boolean} True if the schema is loaded and compiled, false otherwise.
     */
    isSchemaLoaded(schemaId) {
        if (!this.#ajv) {
            // Reduced log level as this might be called frequently during setup
            // this.#logger.debug('AjvSchemaValidator: isSchemaLoaded called but Ajv instance not available.');
            return false;
        }
        if (!schemaId || typeof schemaId !== 'string') {
            // this.#logger.debug(`AjvSchemaValidator: isSchemaLoaded called with invalid schemaId type: ${typeof schemaId}`);
            return false;
        }

        try {
            const validator = this.#ajv.getSchema(schemaId);
            // this.#logger.debug(`AjvSchemaValidator: isSchemaLoaded check for '${schemaId}': ${!!validator}`);
            return !!validator;
        } catch (error) {
            this.#logger.warn(`AjvSchemaValidator: Error accessing schema '${schemaId}' during isSchemaLoaded check: ${error.message}`, {
                schemaId: schemaId,
                error: error
            });
            return false;
        }
    }

    /**
     * Directly validates data against the schema identified by schemaId.
     *
     * @param {string} schemaId - The unique identifier for the schema.
     * @param {any} data - The data to validate.
     * @returns {ValidationResult} An object indicating if the data is valid and containing errors if not.
     */
    validate(schemaId, data) {
        const validatorFunction = this.getValidator(schemaId);

        if (!validatorFunction) {
            this.#logger.warn(`AjvSchemaValidator: validate called for schemaId '${schemaId}', but no validator function could be retrieved (schema might not be loaded or is invalid).`);
            return {
                isValid: false,
                errors: [{
                    instancePath: '',
                    schemaPath: '',
                    keyword: 'schemaNotFound',
                    params: {schemaId: schemaId},
                    message: `Schema with id '${schemaId}' not found, is invalid, or validator could not be retrieved.`
                }]
            };
        }
        return validatorFunction(data);
    }
}

export default AjvSchemaValidator;
// --- FILE END ---