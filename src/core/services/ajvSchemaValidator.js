// src/core/services/ajvSchemaValidator.js

import Ajv from 'ajv';

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
    #logger = null; // Added for logging within removeSchema

    /**
     * Initializes the Ajv instance.
     * @param {import('../interfaces/coreServices.js').ILogger} logger - Logger instance.
     * @throws {Error} If Ajv instantiation fails or logger is invalid.
     */
    constructor(logger) { // Added logger dependency
        // Validate logger
        if (!logger || typeof logger.info !== 'function' || typeof logger.warn !== 'function' || typeof logger.error !== 'function' || typeof logger.debug !== 'function') {
            throw new Error("AjvSchemaValidator: Missing or invalid 'logger' dependency (ILogger). Requires info, warn, error, and debug methods.");
        }
        this.#logger = logger;

        try {
            // AC: AjvSchemaValidator constructor initializes an Ajv instance
            this.#ajv = new Ajv({
                allErrors: true,    // Collect all errors
                strictTypes: false, // Adjust based on schema strictness needs
                // Consider adding formats if needed: require("ajv-formats")(this.#ajv)
            });
            this.#logger.debug("AjvSchemaValidator: Ajv instance created successfully.");
        } catch (error) {
            this.#logger.error('AjvSchemaValidator: CRITICAL - Failed to instantiate Ajv:', error);
            throw new Error('AjvSchemaValidator: Failed to initialize the Ajv validation library.');
        }
    }

    /**
     * Adds a JSON schema object to the validator instance, associating it with the given schema ID.
     * The promise resolves when the schema is successfully added and potentially compiled/prepared for validation.
     * Investigation Note: Ajv v8 does NOT silently overwrite existing schemas with the same key.
     * Use removeSchema first if override behavior is intended.
     *
     * @param {object} schemaData - The JSON schema object. Must have a valid structure.
     * @param {string} schemaId - The unique identifier for the schema (typically the '$id' property within the schemaData, but provided explicitly here for consistency).
     * @returns {Promise<void>} Resolves on successful addition, rejects if Ajv encounters an error (e.g., invalid schema, duplicate ID).
     */
    async addSchema(schemaData, schemaId) {
        // AC: addSchema rejects if #ajv is null
        if (!this.#ajv) {
            // Use logger for internal errors before rejecting
            this.#logger.error('AjvSchemaValidator.addSchema: Ajv instance not available.');
            return Promise.reject(new Error('AjvSchemaValidator: Ajv instance not available. Cannot add schema.'));
        }
        // AC: addSchema rejects on invalid schemaData or schemaId.
        if (!schemaData || typeof schemaData !== 'object' || Object.keys(schemaData).length === 0) {
            this.#logger.error(`AjvSchemaValidator.addSchema: Invalid or empty schemaData provided for ID '${schemaId}'.`);
            return Promise.reject(new Error(`AjvSchemaValidator: Invalid or empty schemaData provided for ID '${schemaId}'. Expected a non-empty object.`));
        }
        if (!schemaId || typeof schemaId !== 'string' || schemaId.trim() === '') {
            this.#logger.error('AjvSchemaValidator.addSchema: Invalid or empty schemaId provided.');
            return Promise.reject(new Error('AjvSchemaValidator: Invalid or empty schemaId provided. Expected a non-empty string.'));
        }

        try {
            // Check if schema already exists - Ajv addSchema does not overwrite silently
            if (this.#ajv.getSchema(schemaId)) {
                const errorMsg = `AjvSchemaValidator: Schema with ID '${schemaId}' already exists. Ajv does not overwrite. Use removeSchema first if replacement is intended.`;
                this.#logger.error(errorMsg);
                // Throw an error consistent with Ajv's likely behavior (preventing duplicate adds)
                throw new Error(errorMsg);
            }

            // AC: addSchema calls ajv.addSchema with schemaData and schemaId.
            // Ajv's addSchema compiles synchronously and throws on error.
            this.#ajv.addSchema(schemaData, schemaId);
            this.#logger.debug(`AjvSchemaValidator: Successfully added schema '${schemaId}'.`);
            // AC: addSchema resolves a promise on successful addition.
            return Promise.resolve(); // Indicate success
        } catch (error) {
            // AC: addSchema rejects the promise if ajv.addSchema throws.
            // Log the detailed error from Ajv
            this.#logger.error(`AjvSchemaValidator: Error adding schema with ID '${schemaId}':`, error.message);
            if (error.errors) { // Ajv often includes detailed errors here
                this.#logger.error('Ajv Validation Errors (during addSchema):', JSON.stringify(error.errors, null, 2));
            }
            // Ensure a proper Error object is rejected for consistent error handling
            const rejectionError = error instanceof Error ? error : new Error(`Failed to add schema '${schemaId}': ${error}`);
            return Promise.reject(rejectionError); // Indicate failure
        }
    }

    /**
     * Removes a schema from the Ajv instance using its ID.
     * Required for handling component schema overrides as addSchema doesn't overwrite.
     * Investigation Note: Based on Ajv docs/issues, removeSchema is the standard way to handle updates/overrides.
     *
     * @param {string} schemaId - The unique identifier ($id) of the schema to remove.
     * @returns {boolean} True if the schema was successfully removed, false otherwise (e.g., not found or error during removal).
     * @throws {Error} If the Ajv instance is not available.
     */
    removeSchema(schemaId) {
        if (!this.#ajv) {
            // Use logger before throwing
            this.#logger.error('AjvSchemaValidator.removeSchema: Ajv instance not available.');
            // Consistent error handling with other methods
            throw new Error('AjvSchemaValidator: Ajv instance not available. Cannot remove schema.');
        }
        // Validate input schemaId
        if (!schemaId || typeof schemaId !== 'string' || schemaId.trim() === '') {
            this.#logger.warn(`AjvSchemaValidator: removeSchema called with invalid schemaId: ${schemaId}`);
            return false; // Or throw, but returning false is often acceptable for removal
        }

        const idToUse = schemaId.trim(); // Use trimmed version

        try {
            // Check if the schema actually exists before trying to remove
            // This helps distinguish "not found" from actual removal errors.
            if (!this.#ajv.getSchema(idToUse)) {
                this.#logger.warn(`AjvSchemaValidator: Schema '${idToUse}' not found. Cannot remove.`);
                return false;
            }

            // ajv.removeSchema might return the instance on success or throw/return false on failure.
            // The API docs are sometimes unclear, GitHub issues suggest it might return the instance.
            // Let's call it and then verify with getSchema afterwards for robustness.
            this.#ajv.removeSchema(idToUse); // Attempt removal

            // Verify removal - getSchema should now return undefined/null for the removed ID
            const removedSuccessfully = !this.#ajv.getSchema(idToUse);

            if (removedSuccessfully) {
                this.#logger.debug(`AjvSchemaValidator: Successfully removed schema '${idToUse}'.`);
                return true;
            } else {
                // This case might indicate an internal Ajv issue if removeSchema didn't throw but also didn't remove.
                this.#logger.error(`AjvSchemaValidator: Called removeSchema for '${idToUse}', but it appears to still be present.`);
                return false;
            }
        } catch (error) {
            // Catch errors specifically from removeSchema or the verification getSchema call
            this.#logger.error(`AjvSchemaValidator: Error removing schema '${idToUse}':`, error.message);
            // Decide whether to re-throw or return false based on desired strictness
            return false; // Treat errors during removal as 'not successful'
        }
    }


    /**
     * Retrieves a validation function for the specified schema ID.
     * The returned function takes data as input and returns a `ValidationResult`.
     * Returns `undefined` if no schema with the given ID is loaded or compiled,
     * or if accessing the schema via Ajv throws an error (indicating a failed compilation).
     *
     * @param {string} schemaId - The unique identifier for the schema.
     * @returns {((data: any) => ValidationResult) | undefined} A function that performs validation, or undefined if the schema ID is not found or invalid.
     */
    getValidator(schemaId) {
        // AC: getValidator returns undefined if #ajv is null.
        if (!this.#ajv) {
            this.#logger.warn('AjvSchemaValidator: getValidator called but Ajv instance not available.');
            return undefined;
        }
        // AC: getValidator returns undefined for invalid schemaId.
        if (!schemaId || typeof schemaId !== 'string') {
            this.#logger.warn(`AjvSchemaValidator: getValidator called with invalid schemaId: ${schemaId}`);
            return undefined;
        }

        let originalValidator;
        try {
            // Wrap the potentially throwing call in try...catch
            // AC: getValidator calls ajv.getSchema with schemaId.
            originalValidator = this.#ajv.getSchema(schemaId);
        } catch (error) {
            // AC: getValidator returns undefined if ajv.getSchema throws.
            this.#logger.warn(`AjvSchemaValidator: Error accessing schema '${schemaId}' via ajv.getSchema (likely due to prior compilation failure):`, error.message);
            return undefined; // Treat schema access error as "not available"
        }

        // AC: getValidator returns undefined if ajv.getSchema returns falsy.
        if (!originalValidator) {
            this.#logger.debug(`AjvSchemaValidator: No validator found for schemaId '${schemaId}'.`);
            // Schema ID not found or schema failed compilation during addSchema
            return undefined;
        }

        // AC: getValidator returns a function if ajv.getSchema succeeds.
        // Return a new function adhering to the ISchemaValidator interface.
        return (data) => {
            try {
                // Ensure you have the original Ajv validator function correctly available here
                // (Assuming it's captured in the closure as originalValidator)
                const isValid = originalValidator(data);

                // --- CORRECTED ERROR HANDLING ---
                // Ajv attaches the 'errors' property to the compiled validator function itself.
                // Accessing originalValidator.errors is the correct way to get errors
                // specific to this validation call, avoiding issues with the shared
                // instance state (this.#ajv.errors).
                const validationErrors = originalValidator.errors;

                return {
                    isValid: isValid,
                    // Use the errors from the specific validator function if validation failed
                    errors: isValid ? null : (validationErrors || []) // <-- Use validationErrors from the compiled function
                };
                // --- END CORRECTION ---

            } catch (validationError) {
                // AC: The returned function catches runtime errors... returns ValidationResult.
                this.#logger.error(`AjvSchemaValidator: Runtime error during validation with schema '${schemaId}':`, validationError);
                return {
                    isValid: false,
                    errors: [{
                        // Structure matching AjvErrorObject roughly
                        instancePath: '', // May not be available in runtime errors
                        schemaPath: '',   // May not be available in runtime errors
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
     * Returns false if accessing the schema via Ajv throws an error (indicating a failed compilation).
     *
     * @param {string} schemaId - The unique identifier for the schema.
     * @returns {boolean} True if the schema is loaded and compiled, false otherwise.
     */
    isSchemaLoaded(schemaId) {
        // AC: isSchemaLoaded returns false if #ajv is null.
        if (!this.#ajv) {
            this.#logger.warn('AjvSchemaValidator: isSchemaLoaded called but Ajv instance not available.');
            return false;
        }
        // AC: isSchemaLoaded returns false for invalid schemaId.
        if (!schemaId || typeof schemaId !== 'string') {
            // Log subtly for invalid ID checks
            // this.#logger.debug(`AjvSchemaValidator: isSchemaLoaded called with invalid schemaId type: ${typeof schemaId}`);
            return false;
        }

        try {
            // AC: isSchemaLoaded calls ajv.getSchema with schemaId.
            // Wrap the potentially throwing call in try...catch
            // ajv.getSchema returns the compiled function if successful, undefined otherwise.
            // It might THROW if the schema definition itself was fundamentally broken during addSchema.
            const validator = this.#ajv.getSchema(schemaId);
            // AC: isSchemaLoaded returns true if ajv.getSchema returns truthy.
            // AC: isSchemaLoaded returns false if ajv.getSchema returns falsy.
            // Log the result of the check at debug level
            // this.#logger.debug(`AjvSchemaValidator: isSchemaLoaded check for '${schemaId}': ${!!validator}`);
            return !!validator;
        } catch (error) {
            // AC: isSchemaLoaded returns false if ajv.getSchema throws.
            this.#logger.warn(`AjvSchemaValidator: Error accessing schema '${schemaId}' via ajv.getSchema (likely due to prior compilation failure):`, error.message);
            return false; // Treat schema access error as "not loaded"
        }
    }

    /**
     * Directly validates data against the schema identified by schemaId.
     * Returns a ValidationResult indicating success or failure.
     * This combines getting the validator and executing it.
     *
     * @param {string} schemaId - The unique identifier for the schema.
     * @param {any} data - The data to validate.
     * @returns {ValidationResult} An object indicating if the data is valid and containing errors if not.
     */
    validate(schemaId, data) {
        // Reuse getValidator logic to find the validation function
        const validatorFunction = this.getValidator(schemaId);

        if (!validatorFunction) {
            // Schema not found or failed compilation previously
            // Log a warning consistent with getValidator/isSchemaLoaded might be good
            this.#logger.warn(`AjvSchemaValidator: validate called for schemaId '${schemaId}', but no validator function could be retrieved.`);
            return {
                isValid: false,
                errors: [{ // Provide a structured error indicating the schema wasn't found/valid
                    instancePath: '',
                    schemaPath: '',
                    keyword: 'schemaNotFound',
                    params: {schemaId: schemaId},
                    message: `Schema with id '${schemaId}' not found or is invalid.`
                }]
            };
        }

        // If validator function exists, execute it (it already includes error handling)
        return validatorFunction(data);
    }
}

// AC: ajvSchemaValidator.js exists and exports the AjvSchemaValidator class.
export default AjvSchemaValidator;
