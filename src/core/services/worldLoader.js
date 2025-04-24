// src/core/services/worldLoader.js

/**
 * @fileoverview Orchestrates the loading of all world-specific data
 * (schemas → manifest → rules → component definitions → content) using injected
 * core services.
 */

// ── Concrete imports ───────────────────────────────────────────────────────────
import SchemaLoader from './schemaLoader.js';
import ManifestLoader from './manifestLoader.js';
import GenericContentLoader from './genericContentLoader.js';
// -- Only for type-hints (keeps runtime bundle minimal) ────────────────────────
/** @typedef {import('./componentDefinitionLoader.js').default} ComponentDefinitionLoader */
/** @typedef {import('./ruleLoader.js').default} RuleLoader */
/** @typedef {import('../interfaces/coreServices.js').IDataRegistry} IDataRegistry */
/** @typedef {import('../interfaces/coreServices.js').ILogger} ILogger */
/** @typedef {import('../interfaces/coreServices.js').ISchemaValidator} ISchemaValidator */

/** @typedef {import('../interfaces/coreServices.js').IConfiguration} IConfiguration */

/**
 * Coordinates all data loading necessary for a game world.
 *
 * **Load order**
 * 1. Clear registry
 * 2. Schemas (compile)
 * 3. Essential-schema presence check
 * 4. Manifest (validate & store)
 * 5. System rules (so events emitted by content have handlers)
 * 6. Component definitions
 * 7. Remaining content types
 */
class WorldLoader {
    /** @type {IDataRegistry}                 */ #registry;
    /** @type {ILogger}                       */ #logger;
    /** @type {SchemaLoader}                  */ #schemaLoader;
    /** @type {ManifestLoader}                */ #manifestLoader;
    /** @type {GenericContentLoader}          */ #contentLoader;
    /** @type {ComponentDefinitionLoader}     */ #componentDefinitionLoader;
    /** @type {RuleLoader}                    */ #ruleLoader;
    /** @type {ISchemaValidator}              */ #validator;
    /** @type {IConfiguration}                */ #config;

    /**
     * @param {IDataRegistry}              registry
     * @param {ILogger}                    logger
     * @param {SchemaLoader}               schemaLoader
     * @param {ManifestLoader}             manifestLoader
     * @param {GenericContentLoader}       contentLoader
     * @param {ComponentDefinitionLoader}  componentDefinitionLoader
     * @param {RuleLoader}                 ruleLoader
     * @param {ISchemaValidator}           validator
     * @param {IConfiguration}             configuration
     */
    constructor(
        registry,
        logger,
        schemaLoader,
        manifestLoader,
        contentLoader,
        componentDefinitionLoader,
        ruleLoader,
        validator,
        configuration,
    ) {
        // ── Dependency guards ────────────────────────────────────────────────
        if (!registry || typeof registry.clear !== 'function') {
            throw new Error("WorldLoader: Missing/invalid 'registry' (IDataRegistry).");
        }
        if (!logger || typeof logger.info !== 'function') {
            throw new Error("WorldLoader: Missing/invalid 'logger' (ILogger).");
        }
        if (!schemaLoader || typeof schemaLoader.loadAndCompileAllSchemas !== 'function') {
            throw new Error("WorldLoader: Missing/invalid 'schemaLoader'.");
        }
        if (!manifestLoader || typeof manifestLoader.loadAndValidateManifest !== 'function') {
            throw new Error("WorldLoader: Missing/invalid 'manifestLoader'.");
        }
        if (!contentLoader || typeof contentLoader.loadContentFiles !== 'function') {
            throw new Error("WorldLoader: Missing/invalid 'contentLoader'.");
        }
        if (
            !componentDefinitionLoader ||
            typeof componentDefinitionLoader.loadComponentDefinitions !== 'function'
        ) {
            throw new Error(
                "WorldLoader: Missing/invalid 'componentDefinitionLoader' (needs loadComponentDefinitions).",
            );
        }
        if (!ruleLoader || typeof ruleLoader.loadAll !== 'function') {
            throw new Error("WorldLoader: Missing/invalid 'ruleLoader'.");
        }
        if (!validator || typeof validator.isSchemaLoaded !== 'function') {
            throw new Error("WorldLoader: Missing/invalid 'validator' (ISchemaValidator).");
        }
        if (
            !configuration ||
            typeof configuration.getManifestSchemaId !== 'function' ||
            typeof configuration.getContentTypeSchemaId !== 'function'
        ) {
            throw new Error("WorldLoader: Missing/invalid 'configuration' (IConfiguration).");
        }

        // ── Store ────────────────────────────────────────────────────────────
        this.#registry = registry;
        this.#logger = logger;
        this.#schemaLoader = schemaLoader;
        this.#manifestLoader = manifestLoader;
        this.#contentLoader = contentLoader;
        this.#componentDefinitionLoader = componentDefinitionLoader;
        this.#ruleLoader = ruleLoader;
        this.#validator = validator;
        this.#config = configuration;

        this.#logger.info('WorldLoader: Instance created.');
    }

    /**
     * Load every asset for the given world.
     * @param {string} worldName
     * @returns {Promise<void>}
     */
    async loadWorld(worldName) {
        if (!worldName || typeof worldName !== 'string' || worldName.trim() === '') {
            this.#logger.error("WorldLoader: Invalid 'worldName' provided.");
            throw new Error('WorldLoader: Invalid worldName.');
        }

        this.#logger.info(`WorldLoader: Loading world '${worldName}' …`);

        try {
            // 1️⃣  Clear registry ------------------------------------------------
            this.#registry.clear();
            this.#logger.info('WorldLoader: Registry cleared.');

            // 2️⃣  Schemas -------------------------------------------------------
            await this.#schemaLoader.loadAndCompileAllSchemas();
            this.#logger.info('WorldLoader: Schemas compiled.');

            // 2️⃣․5 Essential-schema presence check -----------------------------
            const essentialIds = [
                this.#config.getManifestSchemaId(),
                this.#config.getContentTypeSchemaId('components'),
                // add any other absolutely-required types here …
            ].filter(Boolean);

            const missing = essentialIds.filter((id) => !this.#validator.isSchemaLoaded(id));
            if (missing.length) {
                missing.forEach((id) =>
                    this.#logger.error(`WorldLoader: Essential schema missing: ${id}`),
                );
                throw new Error('Essential schemas missing – aborting world load.');
            }

            // 3️⃣  Manifest ------------------------------------------------------
            const manifest = await this.#manifestLoader.loadAndValidateManifest(worldName);
            this.#registry.setManifest(manifest);
            this.#logger.info('WorldLoader: Manifest stored in registry.');

            // 4️⃣  Rules ---------------------------------------------------------
            this.#logger.info('WorldLoader: Loading system rules …');
            await this.#ruleLoader.loadAll();
            this.#logger.info(
                `WorldLoader: Rules loaded for ${this.#ruleLoader.loadedEventCount} event(s).`,
            );

            // 5️⃣  Component definitions ----------------------------------------
            await this.#componentDefinitionLoader.loadComponentDefinitions();
            this.#logger.info('WorldLoader: Component definitions loaded.');

            // 6️⃣  Remaining content --------------------------------------------
            const contentPromises = [];
            const contentFiles = manifest.contentFiles ?? {};
            for (const [typeName, filenames] of Object.entries(contentFiles)) {
                if (typeName === 'components') continue; // already handled
                if (Array.isArray(filenames)) {
                    contentPromises.push(
                        this.#contentLoader.loadContentFiles(typeName, filenames),
                    );
                }
            }
            await Promise.all(contentPromises);
            this.#logger.info('WorldLoader: All content types loaded.');

            // 7️⃣  Summary -------------------------------------------------------
            this.#logLoadSummary(worldName);
        } catch (err) {
            this.#logger.error('WorldLoader: CRITICAL load failure.', err);
            this.#registry.clear();
            this.#logger.info('WorldLoader: Registry cleared after failure.');
            throw new Error(
                `WorldLoader failed to load world '${worldName}': ${err.message}`,
            );
        }
    }

    /**
     * Print a concise load summary to the log.
     * @private
     * @param {string} worldName
     */
    #logLoadSummary(worldName) {
        this.#logger.info(`— WorldLoader Summary for '${worldName}' —`);
        const compDefs = this.#registry.getAll('component_definitions').length;
        this.#logger.info(`  • Component definitions: ${compDefs}`);

        const categories = [
            'actions',
            'events',
            'entities',
            'items',
            'locations',
            'connections',
            'blockers',
            'triggers',
            'quests',
        ];
        for (const cat of categories) {
            const count = this.#registry.getAll(cat).length;
            if (count) this.#logger.info(`  • ${cat}: ${count}`);
        }

        if (this.#ruleLoader) {
            this.#logger.info(
                `  • System rules wired: ${this.#ruleLoader.loadedEventCount}`,
            );
        }
        this.#logger.info('———————————————————————————————————————');
    }
}

export default WorldLoader;