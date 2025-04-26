// src/core/services/worldLoader.js

/* eslint-disable max-lines */

/**
 * @fileoverview
 * Responsible for loading every piece of static game data required to start a
 * world: JSON-Schemas, the game-config file (mods to load), each selected mod’s
 * manifest, rules, component definitions, and—eventually—generic content.
 *
 * It is deliberately opinionated: if *anything* goes wrong (missing schema,
 * malformed JSON, validation error, dependency failure, etc.) it aborts early
 * so the engine never runs in a partially-initialised state.
 */

// ── Type-only JSDoc imports ──────────────────────────────────────────────────
/** @typedef {import('../interfaces/coreServices.js').ILogger} ILogger */
/** @typedef {import('../interfaces/coreServices.js').ISchemaValidator} ISchemaValidator */

/** @typedef {import('../interfaces/coreServices.js').IDataRegistry} IDataRegistry */
/** @typedef {import('../interfaces/coreServices.js').IConfiguration} IConfiguration */

// ── Class ────────────────────────────────────────────────────────────────────
class WorldLoader {
    // Private fields
    /** @type {IDataRegistry} */           #registry;
    /** @type {ILogger} */                 #logger;
    /** @type {*} */                       #schemaLoader;
    /** @type {*} */                       #componentDefinitionLoader;
    /** @type {*} */                       #ruleLoader;
    /** @type {ISchemaValidator} */        #validator;
    /** @type {IConfiguration} */          #configuration;
    /** @type {*} */                       #gameConfigLoader;
    /** @type {*} */                       #modManifestLoader;

    // ── Constructor ───────────────────────────────────────────────────────────
    /**
     * @param {IDataRegistry}                 registry
     * @param {ILogger}                       logger
     * @param {*}                             schemaLoader
     * @param {*}                             componentDefinitionLoader
     * @param {*}                             ruleLoader
     * @param {ISchemaValidator}              validator
     * @param {IConfiguration}                configuration
     * @param {*}                             gameConfigLoader          – must expose loadConfig()
     * @param {*}                             modManifestLoader         – must expose loadRequestedManifests()
     */
    constructor(
        registry,
        logger,
        schemaLoader,
        componentDefinitionLoader,
        ruleLoader,
        validator,
        configuration,
        gameConfigLoader,
        modManifestLoader
    ) {
        // Basic-null checks first
        if (!registry || typeof registry.clear !== 'function' || typeof registry.store !== 'function') {
            throw new Error("WorldLoader: Missing/invalid 'registry'.");
        }
        if (!logger || typeof logger.info !== 'function' || typeof logger.error !== 'function') {
            throw new Error("WorldLoader: Missing/invalid 'logger'.");
        }
        if (!schemaLoader || typeof schemaLoader.loadAndCompileAllSchemas !== 'function') {
            throw new Error("WorldLoader: Missing/invalid 'schemaLoader'.");
        }
        if (!componentDefinitionLoader || typeof componentDefinitionLoader.loadComponentDefinitions !== 'function') {
            throw new Error("WorldLoader: Missing/invalid 'componentDefinitionLoader'.");
        }
        if (!ruleLoader || typeof ruleLoader.loadAll !== 'function') {
            throw new Error("WorldLoader: Missing/invalid 'ruleLoader'.");
        }
        if (!validator || typeof validator.isSchemaLoaded !== 'function') {
            throw new Error("WorldLoader: Missing/invalid 'validator'.");
        }
        if (!configuration || typeof configuration.getContentTypeSchemaId !== 'function') {
            throw new Error("WorldLoader: Missing/invalid 'configuration'.");
        }
        if (!gameConfigLoader || typeof gameConfigLoader.loadConfig !== 'function') {
            throw new Error("WorldLoader: Missing/invalid 'gameConfigLoader' (needs loadConfig method).");
        }
        if (!modManifestLoader || typeof modManifestLoader.loadRequestedManifests !== 'function') {
            throw new Error("WorldLoader: Missing/invalid 'modManifestLoader' (needs loadRequestedManifests method).");
        }

        // Store
        this.#registry = registry;
        this.#logger = logger;
        this.#schemaLoader = schemaLoader;
        this.#componentDefinitionLoader = componentDefinitionLoader;
        this.#ruleLoader = ruleLoader;
        this.#validator = validator;
        this.#configuration = configuration;
        this.#gameConfigLoader = gameConfigLoader;
        this.#modManifestLoader = modManifestLoader;

        this.#logger.info('WorldLoader: Instance created (with ModManifestLoader).');
    }

    // ── Public API ────────────────────────────────────────────────────────────
    /**
     * High-level orchestration of the entire data-load pipeline.
     *
     * @param   {string} worldName
     * @returns {Promise<void>}
     */
    async loadWorld(worldName) {
        this.#logger.info(`WorldLoader: Starting load sequence (World Hint: '${worldName}') …`);
        let requestedModIds = []; // Define here to be accessible in the summary call

        try {
            // ── 1. Always start from a clean slate ───────────────────────────────
            this.#registry.clear();

            // ── 2. Compile every JSON-Schema file we ship ────────────────────────
            await this.#schemaLoader.loadAndCompileAllSchemas();

            // ── 3. Guard-rail: ensure absolutely-essential schemas are present ──
            const essentialSchemaIds = [
                this.#configuration.getContentTypeSchemaId('game'),
                this.#configuration.getContentTypeSchemaId('components'),
                this.#configuration.getContentTypeSchemaId('mod-manifest')
            ];

            for (const id of essentialSchemaIds) {
                if (!this.#validator.isSchemaLoaded(id)) {
                    this.#logger.error(`WorldLoader: Essential schema missing: ${id}`);
                    throw new Error(
                        `WorldLoader failed data load sequence (World Hint: '${worldName}'): ` +
                        'Essential schemas missing – aborting world load.'
                    );
                }
            }

            // ── 4. Read game.json → list of mods requested by the user ──────────
            // AC: loadWorld calls gameConfigLoader.loadConfig()
            requestedModIds = await this.#gameConfigLoader.loadConfig(); // Assign to the outer scope variable
            this.#logger.info(
                `Game config loaded successfully. Requested mods (${requestedModIds.length}): ` +
                `[${requestedModIds.join(', ')}]`
            );

            // ── 5. Load every requested mod’s manifest (dependency + version checks inside) ─
            // AC: loadWorld calls modManifestLoader.loadRequestedManifests() with requestedModIds
            this.#logger.info(
                `WorldLoader: Requesting ModManifestLoader to load manifests for ` +
                `${requestedModIds.length} mods...`
            );
            const loadedManifestsMap =
                await this.#modManifestLoader.loadRequestedManifests(requestedModIds);
            this.#logger.info(
                `WorldLoader: ModManifestLoader finished processing. ` +
                `Result contains ${loadedManifestsMap.size} manifests.`
            );

            // (optional) store manifests in the registry for downstream loaders or debugging
            for (const [modId, manifestObj] of loadedManifestsMap.entries()) {
                this.#registry.store('mod_manifests', modId, manifestObj);
            }

            // ── 6. Load system-rules (they may live in mods) ─────────────────────
            // AC: loadWorld calls ruleLoader.loadAll()
            await this.#ruleLoader.loadAll();

            // ── 7. Load component definitions (also mod-driven) ──────────────────
            // AC: loadWorld calls componentDefinitionLoader.loadComponentDefinitions()
            await this.#componentDefinitionLoader.loadComponentDefinitions();

            // ── 8. (Temporary) legacy loaders skipped - they’ll be removed later ─

            // ── 9. Emit a concise summary so developers can see what happened ────
            // AC: loadWorld calls #logLoadSummary at the end of the try block
            // <<< MODIFIED FOR MODLOADER-006-E: Pass requestedModIds >>>
            this.#logLoadSummary(worldName, requestedModIds);

        } catch (err) {
            // Centralised error handling: clear everything and re-throw
            this.#logger.error(
                'WorldLoader: CRITICAL load failure during world/mod loading sequence.',
                err
            );
            this.#registry.clear();
            throw new Error(
                `WorldLoader failed data load sequence (World Hint: '${worldName}'): ${err.message}`
            );
        }
    }

    // ── Helper: pretty summary to log ─────────────────────────────────────────

    /**
     * Logs a multi-line overview of what was loaded (mods, counts, etc.).
     *
     * @param {string}                   worldName
     * @param {string[]}                 requestedModIds         // <<< ADDED parameter for MODLOADER-006-E
     */
    // <<< MODIFIED FOR MODLOADER-006-E: Added requestedModIds parameter >>>
    #logLoadSummary(worldName, requestedModIds) {
        this.#logger.info(`— WorldLoader Load Summary (World Hint: '${worldName}') —`);

        // <<< ADDED for MODLOADER-006-E: Log requested mod IDs >>>
        this.#logger.info(`  • Requested Mods: [${requestedModIds.join(', ')}]`);

        // Final mod order - Get from registry if stored there, or deduce if needed
        // Assuming ModManifestLoader stored them and they are available
        const loadedManifests = this.#registry.getAll('mod_manifests') || [];
        const finalOrder = loadedManifests.map(m => m.id); // Assumes manifest has 'id'

        this.#logger.info(`  • Final Mod Load Order: [${finalOrder.join(', ')}]`);


        // Component defs
        const componentCount = this.#registry.getAll('component_definitions').length;
        this.#logger.info(`  • Component definitions: ${componentCount}`);

        // Manifests count (redundant with final order, but okay)
        // <<< MODIFIED: Removed "Loaded" to match test expectation >>>
        this.#logger.info(`  • Mod Manifests: ${finalOrder.length}`);

        // Generic content categories we care about
        const contentTypes = [
            'actions', 'items', 'entities', 'locations',
            'connections', 'blockers', 'events', 'components'
        ];

        let totalContent = 0;
        for (const type of contentTypes) {
            const list = this.#registry.getAll(type);
            if (Array.isArray(list) && list.length > 0) {
                this.#logger.info(`  • ${type}: ${list.length}`);
                totalContent += list.length;
            }
        }

        // Exclude special categories from the total (they were logged above)
        this.#logger.info(
            `  • Total Content Items (excluding components/rules/manifests): ${totalContent}`
        );

        // Rules
        const ruleCount = this.#registry.getAll('system-rules').length;
        this.#logger.info(`  • System rules loaded: ${ruleCount}`);

        this.#logger.info('———————————————————————————————————————————————');
    }
}

export default WorldLoader;