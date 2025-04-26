// src/core/services/worldLoader.js

/**
 * @fileoverview Orchestrates the loading of all world-specific data
 * (game config → schemas → manifest → rules → component definitions → content)
 * using injected core services.
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
/** @typedef {import('./gameConfigLoader.js').default} GameConfigLoader */ // <<< ADDED for Sub-Ticket 5

/**
 * Coordinates all data loading necessary for a game world.
 *
 * **Load order**
 * 1. Clear registry
 * 2. Game Config (Determine mods) // <<< ADDED for Sub-Ticket 5
 * 3. Schemas (compile)
 * 4. Essential-schema presence check
 * 5. Manifest (validate & store) - // TODO: Replace/Refactor for Mod Support
 * 6. System rules (so events emitted by content have operationHandlers)
 * 7. Component definitions
 * 8. Remaining content types - // TODO: Refactor for Mod Support
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
    /** @type {GameConfigLoader}              */ #gameConfigLoader; // <<< ADDED for Sub-Ticket 5 (AC2)

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
     * @param {GameConfigLoader}           gameConfigLoader // <<< ADDED for Sub-Ticket 5 (AC2)
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
        gameConfigLoader, // <<< ADDED for Sub-Ticket 5 (AC2)
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
        // <<< ADDED Validation for Sub-Ticket 5 (AC2) START >>>
        if (!gameConfigLoader || typeof gameConfigLoader.loadConfig !== 'function') {
            throw new Error("WorldLoader: Missing/invalid 'gameConfigLoader' (needs loadConfig method).");
        }
        // <<< ADDED Validation for Sub-Ticket 5 (AC2) END >>>


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
        this.#gameConfigLoader = gameConfigLoader; // <<< ADDED for Sub-Ticket 5 (AC2)

        this.#logger.info('WorldLoader: Instance created.');
    }

    /**
     * Load every asset for the given world, respecting the configured mod list.
     * @param {string} worldName - Base world identifier (may be less relevant with mods).
     * @returns {Promise<void>}
     */
    async loadWorld(worldName) {
        // Note: worldName might become less central if mods define everything, but kept for now.
        if (!worldName || typeof worldName !== 'string' || worldName.trim() === '') {
            this.#logger.error("WorldLoader: Invalid 'worldName' provided.");
            throw new Error('WorldLoader: Invalid worldName.');
        }

        this.#logger.info(`WorldLoader: Starting data load sequence (World Hint: '${worldName}')...`);

        // AC8: Declare requestedModIds here to be accessible later
        let requestedModIds = [];

        try {
            // 1️⃣  Clear registry ------------------------------------------------
            this.#registry.clear();
            this.#logger.info('WorldLoader: Registry cleared.');

            // 2️⃣  Schemas (Needed before GameConfig validation) ---------------
            await this.#schemaLoader.loadAndCompileAllSchemas();
            this.#logger.info('WorldLoader: Schemas compiled.');

            // 2️⃣․5 Essential-schema presence check -----------------------------
            // Ensure game schema exists *before* loading game config
            const essentialSchemaIds = [
                this.#config.getContentTypeSchemaId('game'), // For GameConfigLoader
                this.#config.getManifestSchemaId(), // For ManifestLoader (even if replaced later)
                this.#config.getContentTypeSchemaId('components'), // For ComponentDefinitionLoader
                // add any other absolutely-required types here …
            ].filter(Boolean); // Filter out undefined results

            const missingEssentialSchemas = essentialSchemaIds.filter((id) => !this.#validator.isSchemaLoaded(id));
            if (missingEssentialSchemas.length) {
                missingEssentialSchemas.forEach((id) =>
                    this.#logger.error(`WorldLoader: Essential schema missing: ${id}`),
                );
                throw new Error('Essential schemas missing – aborting world load.');
            }
            this.#logger.info('WorldLoader: Essential schemas confirmed present.');

            // 3️⃣ Load Game Config (Determine Mods) ---------------------------
            // <<< ADDED for Sub-Ticket 5 (AC3, AC5) START >>>
            requestedModIds = await this.#gameConfigLoader.loadConfig();
            // AC6: Logging success
            this.#logger.info(`Game config loaded successfully. Requested mods (${requestedModIds.length}): [${requestedModIds.join(', ')}]`);
            // <<< ADDED for Sub-Ticket 5 (AC3, AC5) END >>>
            // AC4 (Error Propagation) is handled implicitly by GameEngine's try/catch calling this method.

            // 4️⃣  Manifest(s) & Content Loading (Mod-aware) ------------------
            // TODO: [MOD-LOADER] Replace the following sections with calls to a new
            // ModManifestLoader/ModContentLoader service that uses `requestedModIds`.
            // The new service will need to find, load, validate, and merge manifests/content
            // from the specified mods in the correct order. (AC7 / AC8)
            this.#logger.warn("WorldLoader: Using legacy manifest/content loading. // TODO: Implement mod-aware loading using requestedModIds.");

            // Legacy Manifest Loading (Placeholder)
            const manifest = await this.#manifestLoader.loadAndValidateManifest(worldName);
            this.#registry.setManifest(manifest); // Still store *something* as manifest for now? Or make nullable?
            this.#logger.info('WorldLoader: Legacy manifest stored in registry.');

            // 5️⃣  Rules (Assuming rules are global or defined in 'core' mod for now) ---
            // TODO: [MOD-LOADER] Rules might need to be loaded per-mod as well.
            this.#logger.info('WorldLoader: Loading system rules (assuming global/core)...');
            await this.#ruleLoader.loadAll(); // Needs path adjustment if not global
            this.#logger.info(
                `WorldLoader: Rules loaded for ${this.#ruleLoader.loadedEventCount} event(s).`,
            );

            // 6️⃣  Component definitions (Assuming global or defined in 'core' mod for now) ---
            // TODO: [MOD-LOADER] Component definitions might need to be loaded per-mod.
            // ComponentDefinitionLoader currently reads from the *single* manifest loaded above.
            await this.#componentDefinitionLoader.loadComponentDefinitions();
            this.#logger.info('WorldLoader: Component definitions loaded (based on legacy manifest).');

            // 7️⃣  Remaining content (Legacy based on single manifest) --------
            // TODO: [MOD-LOADER] Replace this loop with mod-aware content loading.
            const contentPromises = [];
            const contentFiles = manifest.contentFiles ?? {}; // Uses legacy manifest
            for (const [typeName, filenames] of Object.entries(contentFiles)) {
                if (typeName === 'components') continue; // already handled
                if (Array.isArray(filenames)) {
                    contentPromises.push(
                        this.#contentLoader.loadContentFiles(typeName, filenames),
                    );
                }
            }
            await Promise.all(contentPromises);
            this.#logger.info('WorldLoader: All content types loaded (based on legacy manifest).');

            // 8️⃣  Summary -------------------------------------------------------
            this.#logLoadSummary(worldName, requestedModIds); // Pass mods to summary
        } catch (err) {
            // AC4: Errors from gameConfigLoader.loadConfig() will end up here via GameEngine's catch
            this.#logger.error('WorldLoader: CRITICAL load failure during world/mod loading sequence.', err);
            this.#registry.clear();
            this.#logger.info('WorldLoader: Registry cleared after failure.');
            // Propagate error to GameEngine
            throw new Error(
                `WorldLoader failed data load sequence (World Hint: '${worldName}'): ${err.message}`,
            );
        }
    }

    /**
     * Print a concise load summary to the log.
     * @private
     * @param {string} worldName
     * @param {string[]} loadedModIds - The list of mod IDs that were loaded. // <<< ADDED
     */
    #logLoadSummary(worldName, loadedModIds) { // <<< ADDED loadedModIds param
        this.#logger.info(`— WorldLoader Load Summary (World Hint: '${worldName}') —`);
        this.#logger.info(`  • Requested Mods: [${loadedModIds.join(', ')}]`); // <<< ADDED Log

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
            // Add other types loaded by GenericContentLoader or specific loaders
        ];
        let totalContentItems = 0;
        for (const cat of categories) {
            const count = this.#registry.getAll(cat).length;
            if (count) {
                this.#logger.info(`  • ${cat}: ${count}`);
                totalContentItems += count;
            }
        }
        this.#logger.info(`  • Total Content Items (excluding components/rules): ${totalContentItems}`);


        if (this.#ruleLoader) {
            this.#logger.info(
                `  • System rules wired: ${this.#ruleLoader.loadedEventCount}`,
            );
        }
        this.#logger.info('———————————————————————————————————————————————');
    }
}

export default WorldLoader;
