// Filename: src/loaders/entityDefinitionLoader.js

/**
 * @file Defines the EntityDefinitionLoader class, responsible for loading
 * entity definitions (like players, NPCs, items, locations, blockers, connections) from mods.
 */

// --- Base Class Import ---
import { BaseManifestItemLoader } from './baseManifestItemLoader.js';
import { processAndStoreItem } from './helpers/processAndStoreItem.js';
import { parseAndValidateId } from '../utils/idUtils.js';
import EntityDefinition from '../entities/entityDefinition.js';

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
 * including primary schema validation based on the 'entityDefinitions' content type.
 *
 * @class EntityDefinitionLoader
 * @augments BaseManifestItemLoader
 */
class EntityDefinitionLoader extends BaseManifestItemLoader {
  // --- [LOADER-REFACTOR-04 Change START]: Removed private field #entitySchemaId ---
  // No longer needed as the base class handles the primary schema ID.
  // #entitySchemaId;
  // --- [LOADER-REFACTOR-04 Change END] ---

  /**
   * Creates an instance of EntityDefinitionLoader.
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
    // --- [LOADER-REFACTOR-04 Change START]: Call super with 'entityDefinitions' content type ---
    // MODIFIED: Ensure 'entityDefinitions' (camelCase) is passed to match configuration key
    super(
      'entityDefinitions',
      config,
      pathResolver,
      dataFetcher,
      schemaValidator,
      dataRegistry,
      logger
    );
    // --- [LOADER-REFACTOR-04 Change END] ---

    // --- [LOADER-REFACTOR-04 Change START]: Removed schema ID retrieval and warning ---
    // The base class constructor now handles retrieving the primary schema ID ('entityDefinitions')
    // and logging a warning if it's not found. No need to duplicate it here.
    // --- [LOADER-REFACTOR-04 Change END] ---
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
      this._logger.error(comprehensiveMessage, {
        modId,
        filename,
        entityId,
        failedComponentIds,
      });
      throw new Error(comprehensiveMessage);
    }
    this._logger.debug(
      `EntityLoader [${modId}]: All runtime component validations passed for entity '${entityId}' from ${filename}.`
    );
  }

  /**
   * Processes a single fetched entity definition file's data.
   *
   * @override
   * @protected
   * @param {string} modId
   * @param {string} filename
   * @param {string} resolvedPath
   * @param {any} data
   * @param {string} registryKey - The original content type registry key (e.g., 'items', 'locations') used for logging/context, but not for storage category.
   * @returns {Promise<{qualifiedId: string, didOverride: boolean}>}
   */
  async _processFetchedItem(modId, filename, resolvedPath, data, registryKey) {
    this._logger.debug(
      `EntityLoader [${modId}]: Processing fetched item (post-primary validation): ${filename} (Original Type: ${registryKey})`
    );

    const { fullId: trimmedId, baseId: baseEntityId } = parseAndValidateId(
      data,
      'id',
      modId,
      filename,
      this._logger,
      { allowFallback: true }
    );
    this._logger.debug(
      `EntityLoader [${modId}]: Extracted full ID '${trimmedId}' and derived base ID '${baseEntityId}' from ${filename}.`
    );

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

    // Create EntityDefinition instance from the raw data
    const entityDefinition = new EntityDefinition(trimmedId, data);

    this._logger.debug(
      `EntityLoader [${modId}]: Created EntityDefinition instance for '${trimmedId}' from ${filename}. Delegating storage to base helper.`
    );

    const { qualifiedId, didOverride } = await processAndStoreItem(this, {
      data: entityDefinition, // Pass the EntityDefinition instance instead of raw data
      idProp: 'id',
      category: 'entityDefinitions',
      modId,
      filename,
      parseOptions: { allowFallback: true },
    });

    const finalRegistryKey = qualifiedId;

    this._logger.debug(
      `EntityLoader [${modId}]: Successfully processed ${registryKey} file '${filename}'. Returning final registry key: ${finalRegistryKey}, Overwrite: ${didOverride}`
    );
    return { qualifiedId, didOverride };
  }
}

export default EntityDefinitionLoader;
