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
 * Extends {@link BaseManifestItemLoader} to leverage common file processing logic.
 *
 * @class EntityLoader
 * @extends BaseManifestItemLoader
 */
class EntityLoader extends BaseManifestItemLoader {
    /**
     * Private field to store the cached schema ID for entity definitions.
     * @private
     * @type {string | null}
     */
    #entitySchemaId;

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
        super(config, pathResolver, dataFetcher, schemaValidator, dataRegistry, logger);
        const retrievedSchemaId = this._getContentTypeSchemaId('entities');
        this.#entitySchemaId = retrievedSchemaId;
        if (this.#entitySchemaId === null) {
            this._logger.warn(`EntityLoader: Schema ID for 'entities' is missing. Entity validation will be skipped or may fail.`);
        }
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
            this._logger.error(comprehensiveMessage, {modId, filename, entityId, failedComponentIds});
            throw new Error(comprehensiveMessage);
        }
        this._logger.debug(`EntityLoader [${modId}]: All runtime component validations passed for entity '${entityId}' from ${filename}.`);
    }


    /**
     * Processes a single fetched entity-like definition file's data.
     * Validates the entity structure, validates component data schemas, extracts ID,
     * and delegates storage **always under the 'entities' category**.
     *
     * @override
     * @protected
     * @async
     * @param {string} modId - The ID of the mod owning the file.
     * @param {string} filename - The original filename from the manifest.
     * @param {string} resolvedPath - The fully resolved path to the file.
     * @param {any} data - The raw data fetched from the file.
     * @param {string} typeName - The original content type name (e.g., 'items', 'locations') used for logging/context, but not for storage category.
     * @returns {Promise<string>} A promise resolving with the fully qualified item ID.
     * @throws {Error} If processing or validation fails.
     */
    async _processFetchedItem(modId, filename, resolvedPath, data, typeName) {
        this._logger.debug(`EntityLoader [${modId}]: Processing fetched item: ${filename} (Type: ${typeName})`);

        // --- Step 1: Entity Schema Validation ---
        if (!this.#entitySchemaId) {
            this._logger.warn(`EntityLoader [${modId}]: Skipping primary schema validation for ${filename} (type ${typeName}) because 'entities' schema ID is missing.`);
        } else {
            const validationResult = this._schemaValidator.validate(this.#entitySchemaId, data);
            if (!validationResult.isValid) {
                const errorDetails = JSON.stringify(validationResult.errors ?? [], null, 2);
                this._logger.error(
                    `EntityLoader [${modId}]: Schema validation failed for ${typeName} file '${filename}' using schema '${this.#entitySchemaId}'. Errors:\n${errorDetails}`,
                    {
                        modId,
                        filename,
                        resolvedPath,
                        schemaId: this.#entitySchemaId,
                        validationErrors: validationResult.errors,
                        failedData: data
                    }
                );
                throw new Error(`Schema validation failed for ${typeName} file '${filename}' in mod '${modId}'.`);
            }
            this._logger.debug(`EntityLoader [${modId}]: Primary schema validation passed for ${filename} (Type: ${typeName}).`);
        }

        // --- Step 2: ID Extraction & Validation ---
        const idFromFile = data?.id;
        if (typeof idFromFile !== 'string' || idFromFile.trim() === '') {
            this._logger.error(
                `EntityLoader [${modId}]: Invalid or missing 'id' in ${typeName} file '${filename}'.`,
                {modId, filename, resolvedPath, receivedId: idFromFile}
            );
            throw new Error(`Invalid or missing 'id' in ${typeName} file '${filename}' for mod '${modId}'.`);
        }
        const trimmedId = idFromFile.trim();
        let baseEntityId = '';
        const colonIndex = trimmedId.indexOf(':');
        if (colonIndex !== -1 && colonIndex > 0 && colonIndex < trimmedId.length - 1) {
            baseEntityId = trimmedId.substring(colonIndex + 1);
        } else {
            baseEntityId = trimmedId;
        }
        if (!baseEntityId) {
            this._logger.error(`EntityLoader [${modId}]: Could not derive base ID from '${trimmedId}' in file '${filename}'.`);
            throw new Error(`Could not derive base ID from '${trimmedId}' in ${filename}`);
        }
        this._logger.debug(`EntityLoader [${modId}]: Extracted full ID '${trimmedId}' and derived base ID '${baseEntityId}' from ${filename}.`);


        // --- Step 3: Runtime Component Validation ---
        const components = data?.components;
        if (components && typeof components === 'object' && Object.keys(components).length > 0) {
            this.#validateEntityComponents(modId, trimmedId, filename, components);
        } else {
            this._logger.debug(`EntityLoader [${modId}]: Entity '${trimmedId}' in ${filename} has no components or an empty components map. Skipping runtime component validation.`);
        }

        // --- [Ticket 4 - START] ---
        // Logic to inject role markers based on typeName was REMOVED here
        // as per user clarification (markers are not needed).
        // --- [Ticket 4 - END] ---

        // --- Step 4: Storage (Using Helper) ---
        this._logger.debug(`EntityLoader [${modId}]: Delegating storage for ${typeName} with base ID '${baseEntityId}' to base helper for file ${filename}. Will be stored under 'entities' category.`);

        // --- [Ticket 4 - CHANGE] ---
        // The first argument (category) is now hardcoded to 'entities'.
        // The original typeName is still passed for context in logging messages.
        this._storeItemInRegistry('entities', modId, baseEntityId, data, filename);
        // --- [Ticket 4 - END CHANGE] ---

        // Construct the fully qualified, prefixed entity ID using the format ${modId}:${baseId}.
        const finalId = `${modId}:${baseEntityId}`;

        // --- Step 5: Return Final ID ---
        this._logger.debug(`EntityLoader [${modId}]: Successfully processed ${typeName} file '${filename}'. Returning final registry key: ${finalId}`);
        return finalId;
    }
}

export default EntityLoader;