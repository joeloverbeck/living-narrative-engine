// Filename: src/core/services/entityLoader.js

/**
 * @fileoverview Defines the EntityLoader class, responsible for loading
 * entity definitions (like players, NPCs, items, locations, blockers, connections) from mods.
 */

// --- Base Class Import ---
import {BaseManifestItemLoader} from './baseManifestItemLoader.js';

// --- JSDoc Imports for Type Hinting ---
/** @typedef {import('../interfaces/coreServices.js').IConfiguration} IConfiguration */
/** @typedef {import('../interfaces/coreServices.js').IPathResolver} IPathResolver */
/** @typedef {import('../interfaces/coreServices.js').IDataFetcher} IDataFetcher */
/** @typedef {import('../interfaces/coreServices.js').ISchemaValidator} ISchemaValidator */
/** @typedef {import('../interfaces/coreServices.js').IDataRegistry} IDataRegistry */
/** @typedef {import('../interfaces/coreServices.js').ILogger} ILogger */
/** @typedef {import('../interfaces/manifestItems.js').ModManifest} ModManifest */ // Adjusted path assumption
/** @typedef {import('../interfaces/coreServices.js').ValidationResult} ValidationResult */


/**
 * Loads entity definitions (including items, locations, blockers, connections) from mods
 * based on their manifests. Entities are defined by an ID and a collection of components.
 * Extends {@link BaseManifestItemLoader} to leverage common file processing logic,
 * including primary schema validation based on the 'entities' content type.
 *
 * @class EntityLoader
 * @extends BaseManifestItemLoader
 */
class EntityLoader extends BaseManifestItemLoader {
    // --- [LOADER-REFACTOR-04 Change START]: Removed private field #entitySchemaId ---
    // No longer needed as the base class handles the primary schema ID.
    // #entitySchemaId;
    // --- [LOADER-REFACTOR-04 Change END] ---

    /**
     * Creates an instance of EntityLoader.
     * @param {IConfiguration} config - Configuration service instance.
     * @param {IPathResolver} pathResolver - Path resolution service instance.
     * @param {IDataFetcher} dataFetcher - Data fetching service instance.
     * @param {ISchemaValidator} schemaValidator - Schema validation service instance.
     * @param {IDataRegistry} dataRegistry - Data registry service instance.
     * @param {ILogger} logger - Logging service instance.
     */
    constructor(config, pathResolver, dataFetcher, schemaValidator, dataRegistry, logger) {
        // --- [LOADER-REFACTOR-04 Change START]: Call super with 'entities' content type ---
        // Pass 'entities' as the first argument to the base class constructor.
        // Dependencies are passed in the correct order.
        super('entities', config, pathResolver, dataFetcher, schemaValidator, dataRegistry, logger);
        // --- [LOADER-REFACTOR-04 Change END] ---

        // --- [LOADER-REFACTOR-04 Change START]: Removed schema ID retrieval and warning ---
        // The base class constructor now handles retrieving the primary schema ID ('entities')
        // and logging a warning if it's not found. No need to duplicate it here.
        // const retrievedSchemaId = this._getContentTypeSchemaId('entities'); // Removed
        // this.#entitySchemaId = retrievedSchemaId; // Removed
        // if (this.#entitySchemaId === null) { // Removed block
        //     this._logger.warn(`EntityLoader: Schema ID for 'entities' is missing. Entity validation will be skipped or may fail.`);
        // }
        // --- [LOADER-REFACTOR-04 Change END] ---

        this._logger.debug(`EntityLoader: Initialized.`);
    }

    /**
     * Validates the components within an entity's data structure against their
     * registered schemas.
     * @private
     * @param {string} modId - The ID of the mod owning the entity.
     * @param {string} entityId - The full ID of the entity being validated.
     * @param {string} filename - The filename for logging context.
     * @param {object} components - The `components` object from the entity data.
     * @throws {Error} If any component fails validation.
     */
    #validateEntityComponents(modId, entityId, filename, components) {
        const componentEntries = Object.entries(components);
        const validationFailures = [];

        this._logger.debug(`EntityLoader [${modId}]: Validating ${componentEntries.length} components for entity '${entityId}' from ${filename}...`);

        for (const [componentId, componentData] of componentEntries) {
            // Assume component schemas are loaded and use their ID for validation
            if (!this._schemaValidator.isSchemaLoaded(componentId)) {
                this._logger.warn(`EntityLoader [${modId}]: Skipping validation for component '${componentId}' in entity '${entityId}' (file: ${filename}). Schema not loaded.`);
                // Optionally throw an error here if components *must* have loaded schemas
                // throw new Error(`Schema not loaded for component '${componentId}'`);
                continue; // Skip validation if schema isn't loaded
            }
            const componentValidationResult = this._schemaValidator.validate(componentId, componentData);
            if (!componentValidationResult.isValid) {
                const errorDetails = JSON.stringify(componentValidationResult.errors ?? [], null, 2);
                this._logger.error(
                    `EntityLoader [${modId}]: Runtime validation failed for component '${componentId}' in entity '${entityId}' (file: ${filename}). Errors:\n${errorDetails}`,
                    {modId, filename, entityId, componentId, errors: componentValidationResult.errors}
                );
                validationFailures.push({componentId: componentId, errors: componentValidationResult.errors});
            } else {
                this._logger.debug(`   - Component '${componentId}' in entity '${entityId}' passed runtime validation.`);
            }
        }

        if (validationFailures.length > 0) {
            const failedComponentIds = validationFailures.map(failure => failure.componentId).join(', ');
            const comprehensiveMessage = `Runtime component validation failed for entity '${entityId}' in file '${filename}' (mod: ${modId}). Invalid components: [${failedComponentIds}]. See previous logs for details.`;
            // Log the comprehensive error *before* throwing
            this._logger.error(comprehensiveMessage, {
                modId,
                filename,
                entityId,
                failedComponentIds // Keep as string for consistency with message
            });
            throw new Error(comprehensiveMessage);
        }
        this._logger.debug(`EntityLoader [${modId}]: All runtime component validations passed for entity '${entityId}' from ${filename}.`);
    }


    /**
     * Processes a single fetched entity-like definition file's data **after**
     * primary schema validation has been performed by the base class wrapper.
     * This method handles entity-specific logic:
     * 1. Extracts and validates the entity's `id`.
     * 2. Performs runtime validation of `components` against their schemas.
     * 3. Delegates storage to the base class helper, always using the 'entities' category.
     * 4. Returns the final, fully qualified entity ID.
     *
     * @override
     * @protected
     * @async
     * @param {string} modId - The ID of the mod owning the file.
     * @param {string} filename - The original filename from the manifest.
     * @param {string} resolvedPath - The fully resolved path to the file.
     * @param {any} data - The raw data fetched from the file (already validated against the primary 'entities' schema).
     * @param {string} typeName - The original content type name (e.g., 'items', 'locations') used for logging/context, but not for storage category.
     * @returns {Promise<string>} A promise resolving with the fully qualified item ID (e.g., `modId:baseEntityId`).
     * @throws {Error} If entity-specific processing (ID extraction, component validation, storage) fails.
     */
    async _processFetchedItem(modId, filename, resolvedPath, data, typeName) {
        // --- [LOADER-REFACTOR-04 Change START]: Primary validation happens BEFORE this method ---
        // The call `this._validatePrimarySchema(data, filename, modId, resolvedPath)` is now made
        // by the `_processFileWrapper` in BaseManifestItemLoader before calling this method.
        // Therefore, the manual validation block is removed from here.
        this._logger.debug(`EntityLoader [${modId}]: Processing fetched item (post-primary validation): ${filename} (Original Type: ${typeName})`);

        // --- [LOADER-REFACTOR-04 Change START]: Removed manual primary validation block ---
        // if (!this.#entitySchemaId) { ... } else { ... validationResult = ... } block removed.
        // --- [LOADER-REFACTOR-04 Change END] ---

        // --- Step 1 (was 2): ID Extraction & Validation ---
        const idFromFile = data?.id;
        if (typeof idFromFile !== 'string' || idFromFile.trim() === '') {
            this._logger.error(
                `EntityLoader [${modId}]: Invalid or missing 'id' in ${typeName} file '${filename}'.`,
                {modId, filename, resolvedPath, receivedId: idFromFile}
            );
            throw new Error(`Invalid or missing 'id' in ${typeName} file '${filename}' for mod '${modId}'.`);
        }
        const trimmedId = idFromFile.trim(); // This is the full ID (e.g., core:player, mymod:special_item)
        let baseEntityId = '';
        const colonIndex = trimmedId.indexOf(':');

        // Extract base ID: everything after the first colon, or the whole ID if no colon or colon is at start/end
        if (colonIndex !== -1 && colonIndex > 0 && colonIndex < trimmedId.length - 1) {
            baseEntityId = trimmedId.substring(colonIndex + 1);
        } else {
            // Handle cases like "my_item" (no namespace) or "core:" (invalid format but handled gracefully)
            baseEntityId = trimmedId;
            if (colonIndex === -1) {
                this._logger.debug(`EntityLoader [${modId}]: ID '${trimmedId}' in ${filename} has no namespace prefix. Using full ID as base ID.`);
            } else {
                this._logger.warn(`EntityLoader [${modId}]: ID '${trimmedId}' in ${filename} has an unusual format (colon at start/end). Using full ID as base ID.`);
            }
        }

        // Final check for empty base ID (should be rare after previous checks)
        if (!baseEntityId) { // Check if baseEntityId became empty string somehow
            this._logger.error(`EntityLoader [${modId}]: Could not derive a non-empty base ID from '${trimmedId}' in file '${filename}'.`);
            throw new Error(`Could not derive a valid base ID from '${trimmedId}' in ${filename}`);
        }
        this._logger.debug(`EntityLoader [${modId}]: Extracted full ID '${trimmedId}' and derived base ID '${baseEntityId}' from ${filename}.`);


        // --- Step 2 (was 3): Runtime Component Validation ---
        const components = data?.components;
        if (components && typeof components === 'object' && Object.keys(components).length > 0) {
            // Call the dedicated private method for component validation
            this.#validateEntityComponents(modId, trimmedId, filename, components);
        } else {
            this._logger.debug(`EntityLoader [${modId}]: Entity '${trimmedId}' in ${filename} has no components or an empty/invalid components map. Skipping runtime component validation.`);
        }

        // --- Step 3 (was 4): Storage (Using Helper) ---
        this._logger.debug(`EntityLoader [${modId}]: Delegating storage for original type '${typeName}' with base ID '${baseEntityId}' to base helper for file ${filename}. Storing under 'entities' category.`);

        // Use the base class helper to store the item.
        // IMPORTANT: The category is hardcoded to 'entities' as per requirements.
        this._storeItemInRegistry('entities', modId, baseEntityId, data, filename);
        // The _storeItemInRegistry helper handles prefixing the ID in the stored data,
        // logging success/failure, and checking for overwrites.

        // Construct the final fully qualified ID that was used as the registry key.
        const finalId = `${modId}:${baseEntityId}`;

        // --- Step 4 (was 5): Return Final ID ---
        this._logger.debug(`EntityLoader [${modId}]: Successfully processed ${typeName} file '${filename}'. Returning final registry key: ${finalId}`);
        return finalId; // Return the key used in the registry
    }
}

export default EntityLoader;
