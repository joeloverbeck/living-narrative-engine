//src/core/services/worldLoader.js

/**
 * @fileoverview Defines the WorldLoader class, responsible for orchestrating
 * the loading of all world-specific data (schemas, manifest, content files)
 * using injected core services.
 */

// --- Import Concrete Classes & Interfaces ---
// Use direct imports for concrete classes used internally
import SchemaLoader from './schemaLoader.js'; // Corrected import path assuming it's SchemaLoader.js
import ManifestLoader from './manifestLoader.js';
import GenericContentLoader from './genericContentLoader.js';

/**
 * @typedef {import('../interfaces/coreServices.js').IDataFetcher} IDataFetcher // Not directly used, but passed down
 * @typedef {import('../interfaces/coreServices.js').ISchemaValidator} ISchemaValidator // Not directly used, but passed down
 * @typedef {import('../interfaces/coreServices.js').IDataRegistry} IDataRegistry
 * @typedef {import('../interfaces/coreServices.js').ILogger} ILogger
 * @typedef {import('../interfaces/coreServices.js').IConfiguration} IConfiguration // Not directly used, but passed down
 * @typedef {import('../interfaces/coreServices.js').IPathResolver} IPathResolver // Not directly used, but passed down
 // * @typedef {SchemaLoader} SchemaLoader // Type definition already imported above
 // * @typedef {ManifestLoader} ManifestLoader // Type definition already imported above
 // * @typedef {GenericContentLoader} GenericContentLoader // Type definition already imported above
 */

/**
 * Orchestrates the process of loading game data for a specific world.
 * It uses injected services for fetching, validation, storage, configuration,
 * path resolution, logging, schema loading, manifest loading, and content loading.
 * Delegates specific loading tasks to SchemaLoader, ManifestLoader, and GenericContentLoader.
 */
class WorldLoader {
    /** @private @type {IDataRegistry} */
    #registry;
    /** @private @type {ILogger} */
    #logger;
    /** @private @type {SchemaLoader} */
    #schemaLoader;
    /** @private @type {ManifestLoader} */
    #manifestLoader;
    /** @private @type {GenericContentLoader} */
    #contentLoader;
    /** @private @type {ISchemaValidator} */
    #validator; // Keep for summary check
    /** @private @type {IConfiguration} */
    #config; // Keep for summary check

    /**
     * Constructs a WorldLoader instance.
     * Note: Removed direct dependencies like fetcher, resolver, config if they are only used by sub-loaders.
     * Kept validator and config for the summary log.
     *
     * @param {IDataRegistry} registry - Service to store and retrieve loaded data.
     * @param {ILogger} logger - Service for logging messages.
     * @param {SchemaLoader} schemaLoader - Service dedicated to loading schemas.
     * @param {ManifestLoader} manifestLoader - Service dedicated to loading the world manifest.
     * @param {GenericContentLoader} contentLoader - Service dedicated to loading content files.
     * @param {ISchemaValidator} validator - Validator service (needed for summary).
     * @param {IConfiguration} configuration - Configuration service (needed for summary).
     * @throws {Error} If any required dependency is not provided or invalid.
     */
    constructor(registry, logger, schemaLoader, manifestLoader, contentLoader, validator, configuration) { // Dependencies adjusted
        // AC: WorldLoader constructor is updated to accept an instance of GenericContentLoader.
        // Validation...
        if (!registry || typeof registry.clear !== 'function' || typeof registry.setManifest !== 'function' || typeof registry.getManifest !== 'function') {
            throw new Error("WorldLoader: Missing or invalid 'registry' dependency (IDataRegistry).");
        }
        if (!logger || typeof logger.info !== 'function' || typeof logger.error !== 'function') {
            throw new Error("WorldLoader: Missing or invalid 'logger' dependency (ILogger).");
        }
        if (!schemaLoader || typeof schemaLoader.loadAndCompileAllSchemas !== 'function') {
            throw new Error("WorldLoader: Missing or invalid 'schemaLoader' dependency (SchemaLoader).");
        }
        if (!manifestLoader || typeof manifestLoader.loadAndValidateManifest !== 'function') {
            throw new Error("WorldLoader: Missing or invalid 'manifestLoader' dependency (ManifestLoader).");
        }
        if (!contentLoader || typeof contentLoader.loadContentFiles !== 'function') {
            throw new Error("WorldLoader: Missing or invalid 'contentLoader' dependency (GenericContentLoader).");
        }
        // Keep validator/config validation if needed for summary or future use
        if (!validator || typeof validator.isSchemaLoaded !== 'function') {
            throw new Error("WorldLoader: Missing or invalid 'validator' dependency (ISchemaValidator) needed for summary.");
        }
        if (!configuration || typeof configuration.getManifestSchemaId !== 'function') {
            throw new Error("WorldLoader: Missing or invalid 'configuration' dependency (IConfiguration) needed for summary.");
        }

        // Dependency Storage...
        // AC: Constructor stores injected services internally.
        this.#registry = registry;
        this.#logger = logger;
        this.#schemaLoader = schemaLoader;
        this.#manifestLoader = manifestLoader;
        this.#contentLoader = contentLoader; // AC: Stores the injected GenericContentLoader.
        this.#validator = validator; // Store for summary
        this.#config = configuration; // Store for summary


        this.#logger.info("WorldLoader: Instance created and core services injected (including GenericContentLoader).");
    }

    /**
     * Orchestrates the loading of all data for a specified world.
     * This method coordinates schema loading, manifest loading/validation,
     * and content loading based on the manifest.
     *
     * @param {string} worldName - The name of the world to load (e.g., 'demo').
     * @returns {Promise<void>} Resolves when loading is complete, rejects on critical error.
     * @throws {Error} If worldName is invalid or a critical loading step fails.
     */
    async loadWorld(worldName) {
        // AC: loadWorld throws an error for invalid worldName.
        if (!worldName || typeof worldName !== 'string' || worldName.trim() === '') {
            this.#logger.error("WorldLoader: Invalid 'worldName' provided to loadWorld.");
            throw new Error("WorldLoader: Invalid 'worldName' provided.");
        }

        this.#logger.info(`WorldLoader: Starting full data load for world: '${worldName}'...`);

        try {
            // 1. Clear registry
            // AC: Calls registry.clear() at the beginning.
            this.#registry.clear();
            this.#logger.info("WorldLoader: Cleared data registry.");

            // 2. Load schemas
            // AC: Calls schemaLoader.loadAndCompileAllSchemas().
            this.#logger.info("WorldLoader: Initiating schema loading...");
            await this.#schemaLoader.loadAndCompileAllSchemas();
            this.#logger.info("WorldLoader: Schema loading completed.");

            // 3. Load and Validate Manifest
            // AC: Calls manifestLoader.loadAndValidateManifest(worldName).
            this.#logger.info(`WorldLoader: Loading manifest for world '${worldName}'...`);
            const manifestData = await this.#manifestLoader.loadAndValidateManifest(worldName);
            this.#logger.info(`WorldLoader: Manifest for world '${worldName}' loaded and validated.`);

            // 4. Store Manifest in Registry
            // AC: Calls registry.setManifest(manifestData).
            this.#registry.setManifest(manifestData);
            this.#logger.info(`WorldLoader: Stored manifest for world '${worldName}' in registry.`);

            // 5. Load Content Files via GenericContentLoader << --- MODIFIED SECTION --- >>
            this.#logger.info("WorldLoader: Proceeding to load content based on manifest via GenericContentLoader...");
            // AC: Retrieves the manifest from the registry (or uses the loaded data).
            const manifest = this.#registry.getManifest(); // Re-get manifest (or use manifestData directly)
            if (!manifest) {
                // Should not happen if step 3 succeeded, but check defensively
                this.#logger.error("WorldLoader: Manifest disappeared from registry after loading. Critical error.");
                throw new Error("WorldLoader: Manifest disappeared from registry after loading. Critical error.");
            }
            // AC: Accesses the `contentFiles` property of the manifest.
            const contentFiles = manifest.contentFiles;
            if (!contentFiles || typeof contentFiles !== 'object') {
                // This check might be redundant if ManifestLoader already validated it, but good defense.
                this.#logger.error(`WorldLoader: Manifest for world '${worldName}' is missing the required 'contentFiles' object after load.`);
                throw new Error(`WorldLoader: Manifest for world '${worldName}' is missing the required 'contentFiles' object after load.`);
            }

            // AC: WorldLoader.loadWorld calls genericContentLoader.loadContentFiles for each content type...
            // Load content types sequentially for simplicity and clearer logging between types
            // AC: Iterates over the entries in the `contentFiles` object.
            const contentPromises = [];
            for (const [typeName, filenames] of Object.entries(contentFiles)) {
                if (Array.isArray(filenames)) {
                    // AC: Calls genericContentLoader.loadContentFiles(typeName, filenames).
                    // Push the promise returned by loadContentFiles onto the array
                    contentPromises.push(
                        this.#contentLoader.loadContentFiles(typeName, filenames)
                            .catch(error => {
                                // Catch error here to log typeName context, then rethrow
                                this.#logger.error(`WorldLoader: Error loading content type '${typeName}'.`, error);
                                throw error; // Re-throw to fail Promise.all
                            })
                    );
                } else {
                    this.#logger.warn(`WorldLoader: Expected an array for content type '${typeName}' in manifest contentFiles, but got ${typeof filenames}. Skipping.`);
                }
            }
            // AC: Waits for all promises returned by loadContentFiles to settle using Promise.all.
            // Wait for all content loading promises to complete. Promise.all rejects on first error.
            await Promise.all(contentPromises);

            this.#logger.info("WorldLoader: All content loading tasks based on manifest completed.");
            // --- End Content Loading ---


            this.#logger.info(`WorldLoader: Data load orchestration for world '${worldName}' completed successfully.`);
            this.#logLoadSummary(worldName); // Log summary
            // AC: Resolves the promise upon successful completion of all steps.

        } catch (error) {
            // Catch errors from any step (Schema, Manifest, Content loading)
            // AC: Catches errors from any of the loading steps.
            this.#logger.error(`WorldLoader: CRITICAL ERROR during loadWorld for '${worldName}'. Load process halted.`, error);
            // AC: Calls registry.clear() in the catch block on failure.
            this.#registry.clear(); // Attempt to clear partial data
            this.#logger.info("WorldLoader: Cleared data registry due to load error.");
            // AC: Re-throws the caught error.
            throw new Error(`WorldLoader failed to load world '${worldName}': ${error.message}`);
        }
    }

    /**
     * Logs a summary of loaded data from the registry.
     * @private
     */
    #logLoadSummary(worldName) {
        // AC: Includes a private #logLoadSummary method.
        this.#logger.info(`--- WorldLoader Load Summary for '${worldName}' ---`);
        // Schema check
        // AC: #logLoadSummary checks essential schemas using ISchemaValidator.
        const manifestSchemaId = this.#config.getManifestSchemaId();
        if (manifestSchemaId && this.#validator.isSchemaLoaded(manifestSchemaId)) {
            this.#logger.info("  - Schemas: Essential schemas appear loaded in validator.");
        } else {
            this.#logger.warn("  - Schemas: Essential schemas NOT detected in validator.");
        }
        // Manifest check
        // AC: #logLoadSummary checks if the manifest is loaded via registry.getManifest().
        const loadedManifest = this.#registry.getManifest();
        if (loadedManifest) {
            this.#logger.info(`  - Manifest: Successfully loaded and stored for world '${loadedManifest.worldName || worldName}'.`);
        } else {
            this.#logger.error("  - Manifest: NOT FOUND in registry after load attempt!"); // Should be error if load succeeded overall
        }

        // Content check (Now reflects actual loaded content) << MODIFIED >>
        // AC: #logLoadSummary iterates common content types, calling registry.getAll() for each.
        const contentTypes = [
            'actions', 'events', 'entities', 'items', 'locations', 'connections',
            'blockers', 'triggers', 'quests', 'objectives', 'interactionTests'
            // Add any other types handled by GenericContentLoader from your config
        ];
        let totalContentCount = 0;
        this.#logger.info("  - Content (from Registry):");
        for (const type of contentTypes) {
            const items = this.#registry.getAll(type); // AC: uses registry.getAll()
            const count = items.length;
            if (count > 0) {
                // AC: Logs the count of loaded items for each type.
                this.#logger.info(`    - ${type.charAt(0).toUpperCase() + type.slice(1)}: ${count}`);
                totalContentCount += count;
            }
        }
        if (totalContentCount > 0) {
            // AC: Logs the total count of loaded content items.
            this.#logger.info(`  - Total Content Items Loaded: ${totalContentCount}`);
        } else {
            this.#logger.info("  - No content items found loaded in the registry.");
        }
        this.#logger.info(`-------------------------------------------`);
    }
}

// AC: worldLoader.js exists and exports the WorldLoader class.
export default WorldLoader;