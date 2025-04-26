// src/core/services/worldLoader.js

/* eslint-disable max-lines */

// --- Type‑only JSDoc imports ────────────────────────────────────────────────
/** @typedef {import('../interfaces/coreServices.js').ILogger}             ILogger */
/** @typedef {import('../interfaces/coreServices.js').ISchemaValidator}    ISchemaValidator */
/** @typedef {import('../interfaces/coreServices.js').IDataRegistry}       IDataRegistry */
/** @typedef {import('../interfaces/coreServices.js').IConfiguration}      IConfiguration */

// --- Implementation Imports -------------------------------------------------
import ModDependencyValidator from './modDependencyValidator.js';
import validateModEngineVersions from './modVersionValidator.js';
import ModDependencyError from '../errors/modDependencyError.js';
import {ENGINE_VERSION} from '../engineVersion.js';
// 🎯 NEW – Ticket: resolver injection
import {resolveOrder} from './modLoadOrderResolver.js';

// ── Class ────────────────────────────────────────────────────────────────────
class WorldLoader {
    // Private fields
    /** @type {IDataRegistry}  */          #registry;
    /** @type {ILogger}        */          #logger;
    /** @type {*}              */          #schemaLoader;
    /** @type {*}              */          #componentDefinitionLoader;
    /** @type {*}              */          #ruleLoader;
    /** @type {ISchemaValidator}*/          #validator;
    /** @type {IConfiguration} */          #configuration;
    /** @type {*}              */          #gameConfigLoader;
    /** @type {*}              */          #modManifestLoader;
    /** @type {string[]}       */          #finalOrder = [];

    // ── Constructor ────────────────────────────────────────────────────────
    /**
     * @param {IDataRegistry}  registry
     * @param {ILogger}        logger
     * @param {*}              schemaLoader
     * @param {*}              componentDefinitionLoader
     * @param {*}              ruleLoader
     * @param {ISchemaValidator} validator
     * @param {IConfiguration} configuration
     * @param {*}              gameConfigLoader  – exposes loadConfig()
     * @param {*}              modManifestLoader – exposes loadRequestedManifests()
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
        // Constructor validation (remains the same)
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
            throw new Error("WorldLoader: Missing/invalid 'gameConfigLoader'.");
        }
        if (!modManifestLoader || typeof modManifestLoader.loadRequestedManifests !== 'function') {
            throw new Error("WorldLoader: Missing/invalid 'modManifestLoader'.");
        }

        this.#registry = registry;
        this.#logger = logger;
        this.#schemaLoader = schemaLoader;
        this.#componentDefinitionLoader = componentDefinitionLoader;
        this.#ruleLoader = ruleLoader;
        this.#validator = validator;
        this.#configuration = configuration;
        this.#gameConfigLoader = gameConfigLoader;
        this.#modManifestLoader = modManifestLoader;

        this.#logger.info('WorldLoader: Instance created (with ModManifestLoader & order‑resolver).');
    }

    // ── Public API ──────────────────────────────────────────────────────────
    /**
     * High‑level orchestration of the entire data‑load pipeline.
     * @param {string} worldName
     */
    async loadWorld(worldName) {
        this.#logger.info(`WorldLoader: Starting load sequence (World Hint: '${worldName}') …`);

        /** @type {string[]} */
        let requestedModIds = [];
        let incompatibilityCount = 0; // engine‑version incompatibilities (Ticket T‑4)
        let essentialSchemaMissing = false; // Flag for specific error handling
        let missingSchemaId = ''; // Store which schema was missing

        try {
            // 1. fresh slate
            this.#registry.clear();

            // 2. schemas
            await this.#schemaLoader.loadAndCompileAllSchemas();

            // 3. essential‑schema guard
            const essentials = [
                this.#configuration.getContentTypeSchemaId('game'),
                this.#configuration.getContentTypeSchemaId('components'),
                this.#configuration.getContentTypeSchemaId('mod-manifest')
            ];
            for (const id of essentials) {
                if (!this.#validator.isSchemaLoaded(id)) {
                    // *** MODIFICATION START ***
                    essentialSchemaMissing = true; // Set flag
                    missingSchemaId = id;          // Store ID
                    throw new Error(`WorldLoader: Essential schema missing: ${id}`); // Throw original specific error
                    // *** MODIFICATION END ***
                }
            }

            // 4. game.json → requested mods
            requestedModIds = await this.#gameConfigLoader.loadConfig();
            this.#logger.info(`Game config loaded. Requested mods: [${requestedModIds.join(', ')}]`);

            // 5. load manifests (order of fetch is irrelevant)
            const loadedManifestsMap = await this.#modManifestLoader.loadRequestedManifests(requestedModIds);

            // store manifests in registry (lower‑case keys)
            const manifestsForValidation = new Map();
            for (const [modId, manifestObj] of loadedManifestsMap.entries()) {
                const lc = modId.toLowerCase();
                this.#registry.store('mod_manifests', lc, manifestObj);
                manifestsForValidation.set(lc, manifestObj);
            }

            // 5a. dependency validation
            ModDependencyValidator.validate(manifestsForValidation, this.#logger);

            // 5b. engine‑version compatibility
            try {
                validateModEngineVersions(manifestsForValidation, this.#logger);
            } catch (e) {
                if (e instanceof ModDependencyError) {
                    incompatibilityCount = e.message.split('\n').length;
                    throw e;
                }
                throw e; // re‑throw unknown
            }

            // 5c. 🎯 NEW – compute *final* mod load order via resolver
            this.#finalOrder = resolveOrder(requestedModIds, manifestsForValidation, this.#logger);
            this.#logger.info(`WorldLoader: Final mod order resolved: [${this.#finalOrder.join(', ')}]`);
            // expose for other subsystems (simple meta bucket)
            this.#registry.store('meta', 'final_mod_order', this.#finalOrder);

            // 6. Load system rules – TBD per‑mod, currently single call (stub).
            await this.#ruleLoader.loadAll();

            // 7. Load component definitions (still global stub)
            await this.#componentDefinitionLoader.loadComponentDefinitions();

            // 8. (future) generic content loaders will iterate using #finalOrder

            // 9. summary log
            this.#logLoadSummary(worldName, requestedModIds, this.#finalOrder, incompatibilityCount);

            // *** CATCH BLOCK MODIFIED ***
        } catch (err) {
            this.#logger.error('WorldLoader: CRITICAL load failure during world/mod loading sequence.', err); // Log FIRST
            this.#registry.clear(); // Clear registry on any error

            if (essentialSchemaMissing) {
                // Log the specific schema missing error AS WELL (as the test expects this log)
                this.#logger.error(`WorldLoader: Essential schema missing: ${missingSchemaId}`); // Log specific reason if applicable
                // Throw the GENERAL error the test expects for this specific case
                throw new Error(`WorldLoader failed data load sequence (World Hint: '${worldName}'): Essential schemas missing – aborting world load.`);
            } else {
                // For all other errors, re-throw the original error after logging
                throw err;
            }
        }
        // *** END CATCH BLOCK MODIFICATION ***
    }

    // ── Helper: summary logger ──────────────────────────────────────────────
    /**
     * Prints a multi‑line summary of what was loaded.
     * @param {string}   worldName
     * @param {string[]} requestedModIds – list from game.json (post‑core‑injection)
     * @param {string[]} finalOrder      – order produced by resolver
     * @param {number}   incompatibilityCount
     */
    #logLoadSummary(worldName, requestedModIds, finalOrder, incompatibilityCount) {
        // Log message uses "World:", which is correct according to the code provided
        this.#logger.info(`— WorldLoader Load Summary (World: '${worldName}') —`);
        this.#logger.info(`  • Requested Mods (raw): [${requestedModIds.join(', ')}]`);
        this.#logger.info(`  • Final Load Order    : [${finalOrder.join(', ')}]`);

        if (incompatibilityCount > 0) {
            this.#logger.info(`  • Engine‑version incompatibilities detected: ${incompatibilityCount}`);
        }

        const componentDefs = this.#registry.getAll('component_definitions').length;
        this.#logger.info(`  • Component definitions loaded: ${componentDefs}`);
        const ruleCount = this.#registry.getAll('system-rules').length;
        // *** SMALL FIX: Consistent spacing in log output ***
        this.#logger.info(`  • System rules loaded         : ${ruleCount}`);
        this.#logger.info('———————————————————————————————————————————');
    }
}

export default WorldLoader;