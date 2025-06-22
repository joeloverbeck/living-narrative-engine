/**
 * @file Implements the WorldLoader, responsible for loading and registering
 * self-contained world definition files from all active mods.
 */

// --- JSDoc Imports for Type Hinting ---
/** @typedef {import('../interfaces/coreServices.js').IConfiguration} IConfiguration */
/** @typedef {import('../interfaces/coreServices.js').IPathResolver} IPathResolver */
/** @typedef {import('../interfaces/coreServices.js').IDataFetcher} IDataFetcher */
/** @typedef {import('../interfaces/coreServices.js').ISchemaValidator} ISchemaValidator */
/** @typedef {import('../interfaces/coreServices.js').IDataRegistry} IDataRegistry */
/** @typedef {import('../interfaces/coreServices.js').ILogger} ILogger */
/** @typedef {import('../interfaces/manifestItems.js').ModManifest} ModManifest */
/** @typedef {import('./LoadResultAggregator.js').TotalResultsSummary} TotalResultsSummary */

// --- Core Imports ---
import AbstractLoader from './abstractLoader.js';
import { validateAgainstSchema } from '../utils/schemaValidationUtils.js';
import ModsLoaderError from '../errors/modsLoaderError.js';
import { parseAndValidateId } from '../utils/idUtils.js';

const WORLDS_REGISTRY_KEY = 'worlds';
const ENTITY_DEFINITIONS_KEY = 'entityDefinitions';

/**
 * Loads, validates, and registers world definition files from mods.
 * This loader runs after all entity definitions are loaded, allowing it to
 * validate that instances within a world refer to known entity definitions.
 * Each valid world file is stored as a distinct, identifiable object in the data registry.
 *
 * @class WorldLoader
 * @augments AbstractLoader
 */
export class WorldLoader extends AbstractLoader {
  /** @protected @type {IConfiguration} */
  _config;
  /** @protected @type {IPathResolver} */
  _pathResolver;
  /** @protected @type {IDataFetcher} */
  _dataFetcher;
  /** @protected @type {ISchemaValidator} */
  _schemaValidator;
  /** @protected @type {IDataRegistry} */
  _dataRegistry;

  /**
   * Creates an instance of WorldLoader.
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
    super(logger, [
      {
        dependency: config,
        name: 'IConfiguration',
        methods: ['getContentTypeSchemaId'],
      },
      {
        dependency: pathResolver,
        name: 'IPathResolver',
        methods: ['resolveModContentPath'],
      },
      { dependency: dataFetcher, name: 'IDataFetcher', methods: ['fetch'] },
      {
        dependency: schemaValidator,
        name: 'ISchemaValidator',
        methods: ['validate'],
      },
      {
        dependency: dataRegistry,
        name: 'IDataRegistry',
        methods: ['store', 'get'],
      },
    ]);

    this._config = config;
    this._pathResolver = pathResolver;
    this._dataFetcher = dataFetcher;
    this._schemaValidator = schemaValidator;
    this._dataRegistry = dataRegistry;
  }

  /**
   * Iterates through mods, finds their world files, validates them and their
   * internal entity instances, and registers each valid world in the data registry.
   *
   * @param {string[]} finalModOrder - The resolved load order of mods.
   * @param {Map<string, ModManifest>} manifests - A map of all loaded mod manifests.
   * @param {TotalResultsSummary} totalCounts - The aggregator for load results to be updated.
   * @returns {Promise<void>} A promise that resolves when all world files have been processed.
   * @throws {ModsLoaderError} If an instance references an unknown entity definition that is configured to halt the process.
   */
  async loadWorlds(finalModOrder, manifests, totalCounts) {
    this._logger.info('--- Starting World File Loading Phase ---');
    let filesProcessed = 0;
    let filesFailed = 0;
    let totalInstances = 0;
    let totalOverrides = 0;
    let totalResolvedDefinitions = 0;
    let totalUnresolvedDefinitions = 0;

    // Note: The previous implementation used 'world' (singular). Ensure config key matches.
    const worldSchemaId = this._config.getContentTypeSchemaId('world');
    if (!worldSchemaId) {
      this._logger.error(
        "WorldLoader: Schema ID for content type 'world' not found in configuration. Cannot process world files."
      );
      totalCounts.worlds = {
        count: 0,
        overrides: 0,
        errors: finalModOrder.length,
        instances: 0,
        resolvedDefinitions: 0,
        unresolvedDefinitions: 0,
      };
      return;
    }

    for (const modId of finalModOrder) {
      const manifest = manifests.get(modId.toLowerCase());
      if (!manifest) {
        this._logger.warn(
          `WorldLoader [${modId}]: Manifest not found. Skipping world file search.`
        );
        continue;
      }

      const worldFiles = manifest.content?.worlds;
      if (!Array.isArray(worldFiles) || worldFiles.length === 0) {
        this._logger.debug(
          `WorldLoader [${modId}]: No world files listed in manifest. Skipping.`
        );
        continue;
      }

      for (const filename of worldFiles) {
        let resolvedPath = '';
        try {
          resolvedPath = this._pathResolver.resolveModContentPath(
            modId,
            'worlds',
            filename
          );
          this._logger.debug(
            `WorldLoader [${modId}]: Processing world file '${filename}'.`
          );

          const worldData = await this._dataFetcher.fetch(resolvedPath);

          validateAgainstSchema(
            this._schemaValidator,
            worldSchemaId,
            worldData,
            this._logger,
            {
              failureMessage: `Schema validation failed for world '${filename}' in mod '${modId}'.`,
              failureThrowMessage: `Schema validation failed for ${filename}.`,
            }
          );

          if (worldData.instances && Array.isArray(worldData.instances)) {
            const validationResult = this.#validateWorldInstances(
              worldData,
              modId,
              filename
            );
            totalResolvedDefinitions += validationResult.resolved;
            totalUnresolvedDefinitions += validationResult.unresolved;

            this._logger.debug(
              `WorldLoader [${modId}]: Successfully validated ${validationResult.instanceCount} instances from '${filename}'.`
            );
          } else if (worldData.instances) {
            this._logger.warn(
              `WorldLoader [${modId}]: 'instances' field in '${filename}' is not an array. Skipping instance validation.`,
              { modId, filename, actualType: typeof worldData.instances }
            );
          }

          const { fullId: qualifiedWorldId } = parseAndValidateId(
            worldData,
            'id',
            modId,
            filename,
            this._logger,
            { allowFallback: false }
          );

          const didOverride = this._dataRegistry.store(
            WORLDS_REGISTRY_KEY,
            qualifiedWorldId,
            worldData
          );

          this._logger.debug(
            `WorldLoader: Registered world '${qualifiedWorldId}' from file '${filename}'.`,
            { qualifiedWorldId, filename, modId }
          );

          filesProcessed++;
          totalInstances += worldData.instances?.length || 0;
          if (didOverride) {
            totalOverrides++;
            this._logger.warn(
              `World '${qualifiedWorldId}' from mod '${modId}' overwrote an existing world definition.`
            );
          }
        } catch (error) {
          filesFailed++;
          this._logger.error(
            `WorldLoader [${modId}]: Failed to process world file '${filename}'. Path: '${resolvedPath || 'unresolved'}'. Error: ${error.message}`,
            { modId, filename, error }
          );

          if (
            error instanceof ModsLoaderError &&
            (error.code === 'missing_definition' ||
              error.code === 'missing_definition_id_in_instance')
          ) {
            throw error; // Re-throw critical errors to halt the loading process.
          }
        }
      }
    }

    totalCounts.worlds = {
      count: filesProcessed,
      overrides: totalOverrides,
      errors: filesFailed,
      instances: totalInstances,
      resolvedDefinitions: totalResolvedDefinitions,
      unresolvedDefinitions: totalUnresolvedDefinitions,
    };

    this._logger.info('--- World File Loading Phase Complete ---');
    if (filesFailed > 0) {
      this._logger.warn(
        `WorldLoader: Processed ${filesProcessed + filesFailed} world files. Registered ${filesProcessed} worlds. Encountered ${filesFailed} file-level errors.`
      );
    } else {
      this._logger.info(
        `WorldLoader: Successfully processed and registered ${filesProcessed} worlds, containing ${totalInstances} entity instances. All ${totalResolvedDefinitions} definition references were resolved.`
      );
    }
  }

  /**
   * Validates all entity instances within a single world data object. Throws
   * a critical error if any validation fails.
   *
   * @private
   * @param {object} worldData - The content of the world file.
   * @param {string} modId - The ID of the mod owning the world file.
   * @param {string} filename - The filename for logging context.
   * @returns {{resolved: number, unresolved: number, instanceCount: number}} Counts of definitions and instances.
   * @throws {ModsLoaderError} If any instance has a missing or unresolvable definitionId.
   */
  #validateWorldInstances(worldData, modId, filename) {
    let resolved = 0;
    let unresolved = 0;

    for (const instance of worldData.instances) {
      const { definitionId, instanceId } = instance;
      if (!definitionId) {
        unresolved++;
        throw new ModsLoaderError(
          `Instance '${instanceId || '(no instanceId)'}' in world file '${filename}' is missing a 'definitionId'.`,
          'missing_definition_id_in_instance',
          { modId, filename, instance }
        );
      }

      const definition = this._dataRegistry.get(
        ENTITY_DEFINITIONS_KEY,
        definitionId
      );

      if (!definition) {
        unresolved++;
        throw new ModsLoaderError(
          `Unknown entity definitionId '${definitionId}' referenced by instance '${instanceId || '(unnamed)'}' in world '${filename}'.`,
          'missing_definition',
          { modId, filename, definitionId, instanceId }
        );
      }
      resolved++;
    }

    return { resolved, unresolved, instanceCount: worldData.instances.length };
  }
}

export default WorldLoader;
