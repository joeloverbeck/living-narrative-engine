/**
 * @file Defines the EntityInstanceLoader class, responsible for loading
 * entity instances from mods.
 */

// --- Base Class Import ---
import { BaseManifestItemLoader } from './baseManifestItemLoader.js';
import { parseAndValidateId } from '../utils/idUtils.js';
import { formatAjvErrors } from '../utils/ajvUtils.js';

// --- JSDoc Imports for Type Hinting ---
/** @typedef {import('../interfaces/coreServices.js').IConfiguration} IConfiguration */
/** @typedef {import('../interfaces/coreServices.js').IPathResolver} IPathResolver */
/** @typedef {import('../interfaces/coreServices.js').IDataFetcher} IDataFetcher */
/** @typedef {import('../interfaces/coreServices.js').ISchemaValidator} ISchemaValidator */
/** @typedef {import('../interfaces/coreServices.js').IDataRegistry} IDataRegistry */
/** @typedef {import('../interfaces/coreServices.js').ILogger} ILogger */

/** @typedef {import('../interfaces/manifestItems.js').ModManifest} ModManifest */

/**
 * Loads entity instances from mods based on their manifests. Instances are defined
 * by an instance ID, a link to a definition, and a set of component overrides.
 * Extends {@link BaseManifestItemLoader} to leverage common file processing logic.
 *
 * @class EntityInstanceLoader
 * @augments BaseManifestItemLoader
 */
export class EntityInstanceLoader extends BaseManifestItemLoader {
  /**
   * Creates an instance of EntityInstanceLoader.
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
    // Pass 'entityInstances' as the content type to the base class. This will be used
    // to look up the primary schema ID ('entity-instance.schema.json').
    super(
      'entityInstances',
      config,
      pathResolver,
      dataFetcher,
      schemaValidator,
      dataRegistry,
      logger
    );
  }

  /**
   * Validates the component overrides within an entity instance's data against their
   * registered component schemas. This is the secondary validation step.
   *
   * @private
   * @param {string} modId - The ID of the mod owning the entity instance.
   * @param {string} instanceId - The full ID of the entity instance being validated.
   * @param {string} filename - The filename for logging context.
   * @param {object} componentOverrides - The `componentOverrides` object from the instance data.
   * @throws {Error} If any component override fails validation.
   */
  #validateComponentOverrides(modId, instanceId, filename, componentOverrides) {
    const componentEntries = Object.entries(componentOverrides);
    const validationFailures = [];

    this._logger.debug(
      `EntityInstanceLoader [${modId}]: Validating ${componentEntries.length} component overrides for instance '${instanceId}' from ${filename}...`
    );

    for (const [componentId, componentData] of componentEntries) {
      if (!this._schemaValidator.isSchemaLoaded(componentId)) {
        this._logger.warn(
          `EntityInstanceLoader [${modId}]: Skipping validation for component override '${componentId}' in instance '${instanceId}' (file: ${filename}). Schema not loaded.`
        );
        continue; // Skip validation if schema isn't loaded
      }

      const { isValid, errors } = this._schemaValidator.validate(
        componentId,
        componentData
      );

      if (!isValid) {
        const formattedErrors = formatAjvErrors(errors);
        this._logger.error(
          `EntityInstanceLoader [${modId}]: Schema validation failed for component override '${componentId}' in instance '${instanceId}' (file: ${filename}). Errors: ${formattedErrors}`,
          {
            modId,
            filename,
            instanceId,
            componentId,
            errors,
          }
        );
        validationFailures.push({ componentId, errors: formattedErrors });
      } else {
        this._logger.debug(
          `   - Component override '${componentId}' in instance '${instanceId}' passed schema validation.`
        );
      }
    }

    if (validationFailures.length > 0) {
      const failedComponentIds = validationFailures
        .map((failure) => failure.componentId)
        .join(', ');
      const comprehensiveMessage = `Component override validation failed for instance '${instanceId}' in file '${filename}' (mod: ${modId}). Invalid components: [${failedComponentIds}]. See previous error logs for details.`;
      throw new Error(comprehensiveMessage);
    }
  }

  /**
   * Processes a single fetched entity instance file's data after primary schema validation.
   * This method handles instance-specific logic:
   * 1. Extracts and validates the instance's `instanceId`.
   * 2. Performs secondary validation of `componentOverrides` against their schemas.
   * 3. Stores the validated instance data in the 'entity_instances' registry category.
   *
   * @override
   * @protected
   * @async
   * @param {string} modId - The ID of the mod owning the file.
   * @param {string} filename - The original filename from the manifest.
   * @param {string} resolvedPath - The fully resolved path to the file.
   * @param {any} data - The raw data from the file (validated against the primary 'entity-instance' schema).
   * @param {string} registryKey - The original content type registry key ('entityInstances').
   * @returns {Promise<{qualifiedId: string, didOverride: boolean}>} An object containing the final registry key and overwrite status.
   * @throws {Error} If instance-specific processing (ID extraction, component validation, storage) fails.
   */
  async _processFetchedItem(modId, filename, resolvedPath, data, registryKey) {
    this._logger.debug(
      `EntityInstanceLoader [${modId}]: Processing fetched item: ${filename}`
    );

    // --- Step 1: ID Extraction & Validation ---
    // The primary schema ensures 'instanceId' and 'definitionId' exist.
    const { fullId: instanceId } = parseAndValidateId(
      data,
      'instanceId', // The ID property on an instance file
      modId,
      filename,
      this._logger
    );

    // --- Step 2: Secondary Validation (Component Overrides) ---
    const overrides = data?.componentOverrides;
    if (
      overrides &&
      typeof overrides === 'object' &&
      Object.keys(overrides).length > 0
    ) {
      this.#validateComponentOverrides(modId, instanceId, filename, overrides);
    } else {
      this._logger.debug(
        `EntityInstanceLoader [${modId}]: Instance '${instanceId}' in ${filename} has no component overrides. Skipping secondary validation.`
      );
    }

    // --- Step 3: Storage ---
    // The base method handles creating the prefixed key and storing the data.
    const { qualifiedId, didOverride } = this._parseIdAndStoreItem(
      data,
      'instanceId',
      'entity_instances', // Store in a dedicated registry category
      modId,
      filename
    );

    // --- Step 4: Return Result ---
    this._logger.debug(
      `EntityInstanceLoader [${modId}]: Successfully processed instance file '${filename}'. Final ID: ${qualifiedId}, Overwrite: ${didOverride}`
    );
    return { qualifiedId, didOverride };
  }
}

export default EntityInstanceLoader;
