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

const WORLD_INITIAL_STATE_KEY = 'worlds';

/**
 * Loads, validates, and aggregates world definition files from mods.
 * This loader is intended to run *after* all other definition loaders have completed,
 * ensuring that the world's initial state can be built upon a complete set of
 * registered game data.
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
            { dependency: config, name: 'IConfiguration', methods: ['getContentTypeSchemaId'] },
            { dependency: pathResolver, name: 'IPathResolver', methods: ['resolveModContentPath'] },
            { dependency: dataFetcher, name: 'IDataFetcher', methods: ['fetch'] },
            { dependency: schemaValidator, name: 'ISchemaValidator', methods: ['validate'] },
            { dependency: dataRegistry, name: 'IDataRegistry', methods: ['store'] },
        ]);

        this._config = config;
        this._pathResolver = pathResolver;
        this._dataFetcher = dataFetcher;
        this._schemaValidator = schemaValidator;
        this._dataRegistry = dataRegistry;
    }

    /**
     * Iterates through mods in the final load order, finds their world files,
     * validates them, and aggregates all initial entity instances into the data registry.
     *
     * @param {string[]} finalOrder - The resolved load order of mods.
     * @param {Map<string, ModManifest>} manifests - A map of all loaded mod manifests, keyed by lowercase mod ID.
     * @param {TotalResultsSummary} totalCounts - The aggregator for load results to be updated.
     * @returns {Promise<void>} A promise that resolves when all world files have been processed.
     */
    async loadWorlds(finalOrder, manifests, totalCounts) {
        this._logger.info('--- Starting World File Loading Phase ---');
        const aggregatedInstances = [];
        let filesProcessed = 0;
        let filesFailed = 0;
        let instancesLoaded = 0;

        const worldSchemaId = this._config.getContentTypeSchemaId('world');
        if (!worldSchemaId) {
            this._logger.error("WorldLoader: Schema ID for content type 'world' not found in configuration. Cannot process world files.");
            return;
        }

        for (const modId of finalOrder) {
            const manifest = manifests.get(modId.toLowerCase());
            if (!manifest) {
                this._logger.warn(`WorldLoader [${modId}]: Manifest not found. Skipping world file search.`);
                continue;
            }

            const worldFiles = manifest.content?.worlds;
            if (!Array.isArray(worldFiles) || worldFiles.length === 0) {
                this._logger.debug(`WorldLoader [${modId}]: No world files listed in manifest. Skipping.`);
                continue;
            }

            for (const filename of worldFiles) {
                let resolvedPath = '';
                try {
                    resolvedPath = this._pathResolver.resolveModContentPath(modId, 'worlds', filename);
                    this._logger.debug(`WorldLoader [${modId}]: Processing world file '${filename}' from '${resolvedPath}'.`);

                    const data = await this._dataFetcher.fetch(resolvedPath);

                    validateAgainstSchema(this._schemaValidator, worldSchemaId, data, this._logger, {
                        failureMessage: `WorldLoader [${modId}]: Schema validation failed for world file '${filename}'.`,
                        failureThrowMessage: `Schema validation failed for ${filename}.`,
                    });

                    if (data.instances && Array.isArray(data.instances)) {
                        aggregatedInstances.push(...data.instances);
                        instancesLoaded += data.instances.length;
                        this._logger.debug(`WorldLoader [${modId}]: Successfully loaded and validated ${data.instances.length} instances from '${filename}'.`);
                    }
                    filesProcessed++;
                } catch (error) {
                    filesFailed++;
                    this._logger.error(`WorldLoader [${modId}]: Failed to process world file '${filename}'. Path: '${resolvedPath || 'unresolved'}'`, {
                        error: error.message,
                        stack: error.stack,
                    });
                }
            }
        }

        this._dataRegistry.store(WORLD_INITIAL_STATE_KEY, 'main', aggregatedInstances);

        // Update the central results summary
        totalCounts.worlds = {
            count: filesProcessed,
            overrides: 0, // Not applicable for worlds
            errors: filesFailed,
            instances: instancesLoaded, // Custom property for this summary
        };

        this._logger.info(`--- World File Loading Phase Complete ---`);
        this._logger.info(`Processed ${filesProcessed} world files, loading a total of ${instancesLoaded} entity instances. Encountered ${filesFailed} errors.`);
    }
}

export default WorldLoader;