// src/loaders/worldLoader.js

/**
 * @file Implements the WorldLoader, responsible for loading and aggregating
 * initial world state files from mods after all other definitions are loaded.
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

const WORLD_INITIAL_STATE_KEY = 'worlds';
const ENTITY_DEFINITIONS_KEY = 'entityDefinitions';

/**
 * Loads, validates, and aggregates world definition files from mods.
 * This loader is intended to run *after* all other definition loaders have completed,
 * ensuring that the world's initial state can be built upon a complete set of
 * registered game data.
 *
 * It enforces that all `definitionId`s referenced in world entity instances
 * must already exist in the data registry.
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
      { dependency: dataRegistry, name: 'IDataRegistry', methods: ['store', 'get'] },
    ]);

    this._config = config;
    this._pathResolver = pathResolver;
    this._dataFetcher = dataFetcher;
    this._schemaValidator = schemaValidator;
    this._dataRegistry = dataRegistry;
  }

  /**
   * Iterates through mods in the final load order, finds their world files,
   * validates them, checks for definitionId existence, and aggregates all
   * valid initial entity instances into the data registry.
   *
   * Throws a ModsLoaderError if a definitionId is not found.
   *
   * @param {string[]} finalOrder - The resolved load order of mods.
   * @param {Map<string, ModManifest>} manifests - A map of all loaded mod manifests, keyed by lowercase mod ID.
   * @param {TotalResultsSummary} totalCounts - The aggregator for load results to be updated.
   * @returns {Promise<void>} A promise that resolves when all world files have been processed successfully.
   * @throws {ModsLoaderError} If a referenced definitionId is not found in the registry.
   */
  async loadWorlds(finalOrder, manifests, totalCounts) {
    this._logger.info('--- Starting World File Loading Phase ---');
    const aggregatedInstances = [];
    let filesProcessed = 0;
    let filesFailed = 0;
    let instancesLoaded = 0;
    let totalResolvedDefinitions = 0;
    let fileUnresolvedDefinitions = 0;

    const worldSchemaId = this._config.getContentTypeSchemaId('world');
    if (!worldSchemaId) {
      this._logger.error(
        "WorldLoader: Schema ID for content type 'world' not found in configuration. Cannot process world files."
      );
      totalCounts.worlds = {
        count: 0,
        overrides: 0,
        errors: finalOrder.length,
        instances: 0,
        resolvedDefinitions: 0,
        unresolvedDefinitions: 0,
      };
      return;
    }

    for (const modId of finalOrder) {
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
        let fileResolvedDefinitions = 0;
        const instancesForCurrentFile = [];

        try {
          resolvedPath = this._pathResolver.resolveModContentPath(
            modId,
            'worlds',
            filename
          );
          this._logger.debug(
            `WorldLoader [${modId}]: Processing world file '${filename}' from '${resolvedPath}'.`
          );

          const data = await this._dataFetcher.fetch(resolvedPath);

          validateAgainstSchema(
            this._schemaValidator,
            worldSchemaId,
            data,
            this._logger,
            {
              failureMessage: `WorldLoader [${modId}]: Schema validation failed for world file '${filename}'.`,
              failureThrowMessage: `Schema validation failed for ${filename} in mod ${modId}.`,
            }
          );

          if (data.instances && Array.isArray(data.instances)) {
            for (const instance of data.instances) {
              const definitionId = instance.definitionId;
              if (!definitionId) {
                this._logger.warn(
                  `WorldLoader [${modId}]: Instance in '${filename}' is missing 'definitionId'. Skipping instance.`,
                  { instance }
                );
                fileUnresolvedDefinitions++;
                throw new ModsLoaderError(
                  `Instance in world file '${filename}' (mod: '${modId}') is missing a 'definitionId'.`,
                  'missing_definition_id_in_instance',
                  { modId, filename, instance }
                );
              }

              const definition = this._dataRegistry.get(ENTITY_DEFINITIONS_KEY, definitionId);

              if (!definition) {
                fileUnresolvedDefinitions++;
                this._logger.error(
                  `WorldLoader [${modId}]: Unknown entity definitionId '${definitionId}' referenced in world file '${filename}'.`,
                  { modId, filename, definitionId, instance }
                );
                throw new ModsLoaderError(
                  `Unknown entity definition: ${definitionId} (referenced in world file '${filename}', mod: '${modId}')`,
                  'missing_definition',
                  { modId, filename, definitionId }
                );
              }
              fileResolvedDefinitions++;
              instancesForCurrentFile.push(instance);
            }

            if (fileUnresolvedDefinitions > 0) {
              this._logger.error(
                `WorldLoader [${modId}]: World file '${filename}' has ${fileUnresolvedDefinitions} unresolved entity definition(s). Resolved: ${fileResolvedDefinitions}.`
              );
            } else {
              aggregatedInstances.push(...instancesForCurrentFile);
              instancesLoaded += instancesForCurrentFile.length;
              totalResolvedDefinitions += fileResolvedDefinitions;
              this._logger.debug(
                `WorldLoader [${modId}]: Successfully validated ${instancesForCurrentFile.length} instances from '${filename}'. All ${fileResolvedDefinitions} definitionId(s) resolved.`
              );
            }
          } else if (data.instances) {
            this._logger.warn(
              `WorldLoader [${modId}]: 'instances' field in '${filename}' is not an array. Skipping instance processing for this file.`, { modId, filename, actualType: typeof data.instances }
            );
          }
          filesProcessed++;
        } catch (error) {
          filesFailed++;
          if (error instanceof ModsLoaderError && (error.code === 'missing_definition' || error.code === 'missing_definition_id_in_instance')) {
            throw error;
          }
          this._logger.error(
            `WorldLoader [${modId}]: Failed to process world file '${filename}'. Path: '${resolvedPath || 'unresolved'}'`,
            {
              error: error.message,
              modId,
              filename,
            }
          );
          if (error.name === 'SyntaxError' || (error.message && error.message.startsWith('Schema validation failed'))) {
          }
        }
      }
    }

    this._dataRegistry.store(WORLD_INITIAL_STATE_KEY, 'main', aggregatedInstances);
    totalCounts.worlds = {
      count: filesProcessed,
      overrides: 0,
      errors: filesFailed,
      instances: instancesLoaded,
      resolvedDefinitions: totalResolvedDefinitions,
      unresolvedDefinitions: fileUnresolvedDefinitions,
    };

    this._logger.info(`--- World File Loading Phase Complete ---`);
    if (filesFailed > 0) {
      this._logger.warn(
        `WorldLoader: Processed ${filesProcessed} world files. Successfully loaded ${instancesLoaded} instances from ${filesProcessed - filesFailed} files. Encountered ${filesFailed} file-level errors.`
      );
    } else {
      this._logger.info(
        `WorldLoader: Successfully processed ${filesProcessed} world files, loading ${instancesLoaded} entity instances. All ${totalResolvedDefinitions} definition references were resolved.`
      );
    }
  }
}

export default WorldLoader;
