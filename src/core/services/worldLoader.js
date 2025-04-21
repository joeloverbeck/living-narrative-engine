// src/core/services/worldLoader.js

/**
 * @fileoverview Defines the WorldLoader class, responsible for orchestrating
 * the loading of all world-specific data (schemas, manifest, component definitions, content files)
 * using injected core services.
 */

// --- Import Concrete Classes & Interfaces ---
// Use direct imports for concrete classes used internally
import SchemaLoader from './schemaLoader.js';
import ManifestLoader from './manifestLoader.js';
import GenericContentLoader from './genericContentLoader.js';
// --- NEW: Import ComponentDefinitionLoader for type hinting ---
/** @typedef {import('./componentDefinitionLoader.js').default} ComponentDefinitionLoader */

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
 * path resolution, logging, schema loading, manifest loading, component definition loading,
 * and content loading.
 * Delegates specific loading tasks to SchemaLoader, ManifestLoader, ComponentDefinitionLoader,
 * and GenericContentLoader.
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

    // --- Declare private field for ComponentDefinitionLoader ---
    /** @private @type {ComponentDefinitionLoader} */
    #componentDefinitionLoader;

    /**
     * Constructs a WorldLoader instance.
     * Includes the new ComponentDefinitionLoader dependency.
     *
     * @param {IDataRegistry} registry - Service to store and retrieve loaded data.
     * @param {ILogger} logger - Service for logging messages.
     * @param {SchemaLoader} schemaLoader - Service dedicated to loading schemas.
     * @param {ManifestLoader} manifestLoader - Service dedicated to loading the world manifest.
     * @param {GenericContentLoader} contentLoader - Service dedicated to loading generic content files.
     * @param {ComponentDefinitionLoader} componentDefinitionLoader - Service dedicated to loading component definitions.
     * @param {ISchemaValidator} validator - Validator service (needed for summary).
     * @param {IConfiguration} configuration - Configuration service (needed for summary).
     * @throws {Error} If any required dependency is not provided or invalid.
     */
    constructor(registry, logger, schemaLoader, manifestLoader, contentLoader, componentDefinitionLoader, validator, configuration) { // Dependencies adjusted
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

        // --- Add validation for ComponentDefinitionLoader ---
        if (!componentDefinitionLoader || typeof componentDefinitionLoader.loadComponentDefinitions !== 'function') { // [cite: 117]
            throw new Error("WorldLoader constructor requires a valid ComponentDefinitionLoader instance with a loadComponentDefinitions method."); // [cite: 117]
        }
        // --- End Validation ---

        // Keep validator/config validation if needed for summary or future use
        if (!validator || typeof validator.isSchemaLoaded !== 'function') {
            throw new Error("WorldLoader: Missing or invalid 'validator' dependency (ISchemaValidator) needed for summary.");
        }
        if (!configuration || typeof configuration.getManifestSchemaId !== 'function') {
            throw new Error("WorldLoader: Missing or invalid 'configuration' dependency (IConfiguration) needed for summary.");
        }

        // Dependency Storage...
        this.#registry = registry;
        this.#logger = logger;
        this.#schemaLoader = schemaLoader;
        this.#manifestLoader = manifestLoader;
        this.#contentLoader = contentLoader;
        // --- Assign ComponentDefinitionLoader to private field ---
        this.#componentDefinitionLoader = componentDefinitionLoader; // [cite: 117]
        // --- End Assignment ---
        this.#validator = validator; // Store for summary
        this.#config = configuration; // Store for summary


        this.#logger.info("WorldLoader: Instance created and core services injected (including ComponentDefinitionLoader).");
    }

    /**
     * Orchestrates the loading of all data for a specified world.
     * This method coordinates schema loading, manifest loading/validation,
     * component definition loading, and content loading based on the manifest.
     *
     * @param {string} worldName - The name of the world to load (e.g., 'demo').
     * @returns {Promise<void>} Resolves when loading is complete, rejects on critical error.
     * @throws {Error} If worldName is invalid or a critical loading step fails.
     */
    async loadWorld(worldName) { // [cite: 98]
        // AC: loadWorld throws an error for invalid worldName.
        if (!worldName || typeof worldName !== 'string' || worldName.trim() === '') {
            this.#logger.error("WorldLoader: Invalid 'worldName' provided to loadWorld.");
            throw new Error("WorldLoader: Invalid 'worldName' provided.");
        }

        this.#logger.info(`WorldLoader: Starting full data load for world: '${worldName}'...`);

        try { // [cite: 98]
            // 1. Clear registry
            this.#registry.clear();
            this.#logger.info("WorldLoader: Cleared data registry.");

            // 2. Load schemas
            this.#logger.info("WorldLoader: Initiating schema loading...");
            await this.#schemaLoader.loadAndCompileAllSchemas(); // [cite: 98]
            this.#logger.info("WorldLoader: Schema loading completed.");

            // --- INSERTION POINT ---
            // 3. Load Component Definitions (as per ticket 2.1.8.3)
            // >>> TICKET 2.1.8.4: Log Start <<<
            this.#logger.info('WorldLoader: Starting component definition loading...');
            await this.#componentDefinitionLoader.loadComponentDefinitions(); // [cite: 98, 101]
            // >>> TICKET 2.1.8.4: Log Success <<<
            this.#logger.info('WorldLoader: Component definition loading completed successfully.');
            // loadComponentDefinitions already logs internal success/failure and registers schemas [cite: 101, 102]
            // --- END INSERTION ---

            // 4. Load and Validate Manifest (Renumbered from 3)
            this.#logger.info(`WorldLoader: Loading manifest for world '${worldName}'...`);
            const manifestData = await this.#manifestLoader.loadAndValidateManifest(worldName);
            this.#logger.info(`WorldLoader: Manifest for world '${worldName}' loaded and validated.`);

            // 5. Store Manifest in Registry (Renumbered from 4)
            this.#registry.setManifest(manifestData);
            this.#logger.info(`WorldLoader: Stored manifest for world '${worldName}' in registry.`);

            // 6. Load Content Files via GenericContentLoader (Renumbered from 5)
            this.#logger.info("WorldLoader: Proceeding to load content based on manifest via GenericContentLoader...");
            const manifest = this.#registry.getManifest();
            if (!manifest) {
                this.#logger.error("WorldLoader: Manifest disappeared from registry after loading. Critical error.");
                throw new Error("WorldLoader: Manifest disappeared from registry after loading. Critical error.");
            }
            const contentFiles = manifest.contentFiles;
            if (!contentFiles || typeof contentFiles !== 'object') {
                this.#logger.error(`WorldLoader: Manifest for world '${worldName}' is missing the required 'contentFiles' object after load.`);
                throw new Error(`WorldLoader: Manifest for world '${worldName}' is missing the required 'contentFiles' object after load.`);
            }

            const contentPromises = [];
            for (const [typeName, filenames] of Object.entries(contentFiles)) {
                if (Array.isArray(filenames)) {
                    contentPromises.push(
                        this.#contentLoader.loadContentFiles(typeName, filenames) // [cite: 105]
                            .catch(error => {
                                this.#logger.error(`WorldLoader: Error loading content type '${typeName}'.`, error);
                                throw error;
                            })
                    );
                } else {
                    this.#logger.warn(`WorldLoader: Expected an array for content type '${typeName}' in manifest contentFiles, but got ${typeof filenames}. Skipping.`);
                }
            }
            await Promise.all(contentPromises);

            this.#logger.info("WorldLoader: All content loading tasks based on manifest completed.");
            // --- End Content Loading ---


            this.#logger.info(`WorldLoader: Data load orchestration for world '${worldName}' completed successfully.`);
            this.#logLoadSummary(worldName); // Log summary

        } catch (error) { // [cite: 98]
            // >>> TICKET 2.1.8.4: Verify Failure Logging <<<
            // The existing catch block handles failures from ANY step, including
            // the awaited `loadComponentDefinitions`. The logged error will include
            // the specific error thrown by that step, fulfilling the requirement.
            this.#logger.error(`WorldLoader: CRITICAL ERROR during loadWorld for '${worldName}'. Load process halted.`, error);
            this.#registry.clear(); // Attempt to clear partial data
            this.#logger.info("WorldLoader: Cleared data registry due to load error.");
            // The thrown error provides context about the overall failure.
            throw new Error(`WorldLoader failed to load world '${worldName}': ${error.message}`);
        }
    }

    /**
     * Logs a summary of loaded data from the registry.
     * Includes the count of loaded component definitions.
     * @private
     */
    #logLoadSummary(worldName) {
        this.#logger.info(`--- WorldLoader Load Summary for '${worldName}' ---`);
        // Schema check
        const manifestSchemaId = this.#config.getManifestSchemaId();
        const compDefSchemaId = this.#config.getContentTypeSchemaId('components'); // Check component def schema too
        let schemasOk = true;
        if (manifestSchemaId && !this.#validator.isSchemaLoaded(manifestSchemaId)) {
            this.#logger.warn("  - Schemas: Essential Manifest schema NOT detected in validator.");
            schemasOk = false;
        }
        if (compDefSchemaId && !this.#validator.isSchemaLoaded(compDefSchemaId)) {
            this.#logger.warn("  - Schemas: Essential Component Definition schema NOT detected in validator.");
            schemasOk = false;
        }
        if (schemasOk) {
            this.#logger.info("  - Schemas: Essential schemas (Manifest, Component Definition) appear loaded in validator.");
        }

        // Manifest check
        const loadedManifest = this.#registry.getManifest();
        if (loadedManifest) {
            this.#logger.info(`  - Manifest: Successfully loaded and stored for world '${loadedManifest.worldName || worldName}'.`);
        } else {
            this.#logger.error("  - Manifest: NOT FOUND in registry after load attempt!");
        }

        // --- TICKET 2.1.8.5 START ---
        // Retrieve Component Definitions Count
        const componentDefs = this.#registry.getAll('component_definitions'); // Retrieve definitions

        // Log Component Definitions Count
        // (Place this logically within the summary, e.g., after schemas or before other content)
        this.#logger.info(`  - Component Definitions: ${componentDefs.length} loaded.`); // Add log line
        // --- TICKET 2.1.8.5 END ---

        // Content check (Excluding component definitions now logged separately)
        const contentTypes = [
            // 'component_definitions', // Removed - now logged separately above
            'actions', 'events', 'entities', 'items', 'locations', 'connections',
            'blockers', 'triggers', 'quests', 'objectives', 'interactionTests'
        ];
        let totalContentCount = 0;
        this.#logger.info("  - Content (from Registry):");
        for (const type of contentTypes) {
            const items = this.#registry.getAll(type);
            const count = items.length;
            if (count > 0) {
                this.#logger.info(`    - ${type.charAt(0).toUpperCase() + type.slice(1)}: ${count}`);
                totalContentCount += count;
            }
        }
        if (totalContentCount > 0) {
            // Adjust total count message if desired, or keep it representing 'manifest content'
            this.#logger.info(`  - Total Manifest Content Items Loaded: ${totalContentCount}`);
        } else {
            this.#logger.info("  - No manifest content items found loaded in the registry.");
        }
        this.#logger.info(`-------------------------------------------`);
    }
}

export default WorldLoader;