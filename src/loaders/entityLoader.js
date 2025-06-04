// Filename: src/core/services/entityLoader.js

/**
 * @file Defines the EntityLoader class, responsible for loading
 * entity definitions (like players, NPCs, items, locations, blockers, connections) from mods.
 */

// --- Base Class Import ---
import { BaseManifestItemLoader } from './baseManifestItemLoader.js';

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
 * @augments BaseManifestItemLoader
 */
class EntityLoader extends BaseManifestItemLoader {
  // --- [LOADER-REFACTOR-04 Change START]: Removed private field #entitySchemaId ---
  // No longer needed as the base class handles the primary schema ID.
  // #entitySchemaId;
  // --- [LOADER-REFACTOR-04 Change END] ---

  /**
   * Creates an instance of EntityLoader.
   *
   * @param {IConfiguration} config - Configuration service instance.
   * @param {IPathResolver} pathResolver - Path resolution service instance.
   * @param {IDataFetcher} dataFetcher - Data fetching service instance.
   * @param {ISchemaValidator} schemaValidator - Schema validation service instance.
   * @param {IDataRegistry} dataRegistry - Data registry service instance.
   * @param {ILogger} logger - Logging service instance.
   */
  constructor(
    config,
    pathResolver,
    dataFetcher,
    schemaValidator,
    dataRegistry,
    logger
  ) {
    // --- [LOADER-REFACTOR-04 Change START]: Call super with 'entities' content type ---
    // Pass 'entities' as the first argument to the base class constructor.
    // Dependencies are passed in the correct order.
    super(
      'entities',
      config,
      pathResolver,
      dataFetcher,
      schemaValidator,
      dataRegistry,
      logger
    );
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
   *
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

    this._logger.debug(
      `EntityLoader [${modId}]: Validating ${componentEntries.length} components for entity '${entityId}' from ${filename}...`
    );

    for (const [componentId, componentData] of componentEntries) {
      // Assume component schemas are loaded and use their ID for validation
      if (!this._schemaValidator.isSchemaLoaded(componentId)) {
        this._logger.warn(
          `EntityLoader [${modId}]: Skipping validation for component '${componentId}' in entity '${entityId}' (file: ${filename}). Schema not loaded.`
        );
        // Optionally throw an error here if components *must* have loaded schemas
        // throw new Error(`Schema not loaded for component '${componentId}'`);
        continue; // Skip validation if schema isn't loaded
      }
      const componentValidationResult = this._schemaValidator.validate(
        componentId,
        componentData
      );
      if (!componentValidationResult.isValid) {
        const errorDetails = JSON.stringify(
          componentValidationResult.errors ?? [],
          null,
          2
        );
        this._logger.error(
          `EntityLoader [${modId}]: Runtime validation failed for component '${componentId}' in entity '${entityId}' (file: ${filename}). Errors:\n${errorDetails}`,
          {
            modId,
            filename,
            entityId,
            componentId,
            errors: componentValidationResult.errors,
          }
        );
        validationFailures.push({
          componentId: componentId,
          errors: componentValidationResult.errors,
        });
      } else {
        this._logger.debug(
          `   - Component '${componentId}' in entity '${entityId}' passed runtime validation.`
        );
      }
    }

    if (validationFailures.length > 0) {
      const failedComponentIds = validationFailures
        .map((failure) => failure.componentId)
        .join(', ');
      const comprehensiveMessage = `Runtime component validation failed for entity '${entityId}' in file '${filename}' (mod: ${modId}). Invalid components: [${failedComponentIds}]. See previous logs for details.`;
      // Log the comprehensive error *before* throwing
      this._logger.error(comprehensiveMessage, {
        modId,
        filename,
        entityId,
        failedComponentIds, // Keep as string for consistency with message
      });
      throw new Error(comprehensiveMessage);
    }
    this._logger.debug(
      `EntityLoader [${modId}]: All runtime component validations passed for entity '${entityId}' from ${filename}.`
    );
  }

  /**
   * Processes a single fetched entity-like definition file's data **after**
   * primary schema validation has been performed by the base class wrapper.
   * This method handles entity-specific logic:
   * 1. Extracts and validates the entity's `id`.
   * 2. Performs runtime validation of `components` against their schemas.
   * 3. Delegates storage to the base class helper, always using the 'entities' category.
   * 4. Returns an object containing the final, fully qualified entity ID and whether an overwrite occurred.
   *
   * @override
   * @protected
   * @async
   * @param {string} modId - The ID of the mod owning the file.
   * @param {string} filename - The original filename from the manifest.
   * @param {string} resolvedPath - The fully resolved path to the file.
   * @param {any} data - The raw data fetched from the file (already validated against the primary 'entities' schema).
   * @param {string} typeName - The original content type name (e.g., 'items', 'locations') used for logging/context, but not for storage category.
   * @returns {Promise<{qualifiedId: string, didOverride: boolean}>} An object containing the final registry key and overwrite status.
   * @throws {Error} If entity-specific processing (ID extraction, component validation, storage) fails.
   */
  async _processFetchedItem(modId, filename, resolvedPath, data, typeName) {
    // <<< MODIFIED Return Type in JSDoc
    this._logger.debug(
      `EntityLoader [${modId}]: Processing fetched item (post-primary validation): ${filename} (Original Type: ${typeName})`
    );

    // Primary validation happens in BaseManifestItemLoader._processFileWrapper

    // --- Step 1: ID Extraction & Validation ---
    const idFromFile = data?.id;
    if (typeof idFromFile !== 'string' || idFromFile.trim() === '') {
      this._logger.error(
        `EntityLoader [${modId}]: Invalid or missing 'id' in ${typeName} file '${filename}'.`,
        { modId, filename, resolvedPath, receivedId: idFromFile }
      );
      throw new Error(
        `Invalid or missing 'id' in ${typeName} file '${filename}' for mod '${modId}'.`
      );
    }
    const trimmedId = idFromFile.trim();
    let baseEntityId = '';
    const colonIndex = trimmedId.indexOf(':');

    if (
      colonIndex !== -1 &&
      colonIndex > 0 &&
      colonIndex < trimmedId.length - 1
    ) {
      baseEntityId = trimmedId.substring(colonIndex + 1);
    } else {
      baseEntityId = trimmedId; // Includes no-colon case and potentially invalid formats
      if (colonIndex !== -1) {
        // Warn only if format is weird (colon at start/end)
        this._logger.warn(
          `EntityLoader [${modId}]: ID '${trimmedId}' in ${filename} has an unusual format. Using full ID as base ID.`
        );
      }
    }

    if (!baseEntityId) {
      this._logger.error(
        `EntityLoader [${modId}]: Could not derive a non-empty base ID from '${trimmedId}' in file '${filename}'.`
      );
      throw new Error(
        `Could not derive a valid base ID from '${trimmedId}' in ${filename}`
      );
    }
    this._logger.debug(
      `EntityLoader [${modId}]: Extracted full ID '${trimmedId}' and derived base ID '${baseEntityId}' from ${filename}.`
    );

    // --- Step 2: Runtime Component Validation ---
    const components = data?.components;
    if (
      components &&
      typeof components === 'object' &&
      Object.keys(components).length > 0
    ) {
      this.#validateEntityComponents(modId, trimmedId, filename, components);
    } else {
      this._logger.debug(
        `EntityLoader [${modId}]: Entity '${trimmedId}' in ${filename} has no components or an empty/invalid components map. Skipping runtime component validation.`
      );
    }

    // --- Step 3: Storage (Using Helper) ---
    this._logger.debug(
      `EntityLoader [${modId}]: Delegating storage for original type '${typeName}' with base ID '${baseEntityId}' to base helper for file ${filename}. Storing under 'entities' category.`
    );
    let didOverride = false; // <<< Initialize override flag
    try {
      // IMPORTANT: The category is hardcoded to 'entities' as per requirements.
      // Capture the boolean return value from the helper
      didOverride = this._storeItemInRegistry(
        'entities',
        modId,
        baseEntityId,
        data,
        filename
      ); // <<< CAPTURE result
    } catch (storageError) {
      // Error logging happens in helper, re-throw
      throw storageError;
    }

    // Construct the final fully qualified ID that was used as the registry key.
    const finalRegistryKey = `${modId}:${baseEntityId}`;

    // --- Step 4: Return Result Object ---
    this._logger.debug(
      `EntityLoader [${modId}]: Successfully processed ${typeName} file '${filename}'. Returning final registry key: ${finalRegistryKey}, Overwrite: ${didOverride}`
    );
    // Return the object as required by the base class contract
    return { qualifiedId: finalRegistryKey, didOverride: didOverride }; // <<< MODIFIED Return Value
  }
}

export default EntityLoader;
