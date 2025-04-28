// Filename: src/core/services/worldLoader.js

/* eslint-disable max-lines */

// --- Type‑only JSDoc imports ────────────────────────────────────────────────
/** @typedef {import('../interfaces/coreServices.js').ILogger}             ILogger */
/** @typedef {import('../interfaces/coreServices.js').ISchemaValidator}    ISchemaValidator */
/** @typedef {import('../interfaces/coreServices.js').IDataRegistry}       IDataRegistry */
/** @typedef {import('../interfaces/coreServices.js').IConfiguration}      IConfiguration */
/** @typedef {import('./actionLoader.js').default} ActionLoader */
/** @typedef {import('./eventLoader.js').default} EventLoader */
/** @typedef {import('./componentLoader.js').default} ComponentLoader */
/** @typedef {import('./ruleLoader.js').default} RuleLoader */
/** @typedef {import('./schemaLoader.js').default} SchemaLoader */
/** @typedef {import('./gameConfigLoader.js').default} GameConfigLoader */
/** @typedef {import('./modManifestLoader.js').default} ModManifestLoader */
/** @typedef {import('./entityLoader.js').default} EntityLoader */ // <<< ADDED LOADER-004-F
/** @typedef {import('../interfaces/manifestItems.js').ModManifest} ModManifest */ // Assuming ModManifest type definition

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
    /** @type {ISchemaValidator}*/          #validator;
    /** @type {IConfiguration} */          #configuration;
    /** @type {SchemaLoader}   */          #schemaLoader;
    /** @type {ComponentLoader}*/          #componentDefinitionLoader;
    /** @type {RuleLoader}     */          #ruleLoader;
    /** @type {ActionLoader}   */          #actionLoader;
    /** @type {EventLoader}    */          #eventLoader;
    /** @type {EntityLoader}   */          #entityDefinitionLoader; // <<< ADDED LOADER-004-F
    /** @type {GameConfigLoader}*/         #gameConfigLoader;
    /** @type {ModManifestLoader}*/        #modManifestLoader;
    /** @type {string[]}       */          #finalOrder = [];

    // --- REFACTOR-LOADER-4: Added content loaders config ---
    /**
     * Configuration mapping content types to their loaders and parameters.
     * Used in the generic loading loop.
     * @private
     * @type {Array<{loader: object, contentKey: string, contentTypeDir: string, typeName: string}>}
     */
    #contentLoadersConfig = [];
    // --- END REFACTOR-LOADER-4 ---


    // ── Constructor ────────────────────────────────────────────────────────
    /**
     * @param {IDataRegistry}  registry
     * @param {ILogger}        logger
     * @param {SchemaLoader}   schemaLoader
     * @param {ComponentLoader} componentLoader
     * @param {RuleLoader}     ruleLoader
     * @param {ActionLoader}   actionLoader
     * @param {EventLoader}    eventLoader
     * @param {EntityLoader}   entityLoader // <<< ADDED LOADER-004-F
     * @param {ISchemaValidator} validator
     * @param {IConfiguration} configuration
     * @param {GameConfigLoader} gameConfigLoader  – exposes loadConfig()
     * @param {ModManifestLoader} modManifestLoader – exposes loadRequestedManifests()
     */
    constructor(
        registry,
        logger,
        schemaLoader,
        componentLoader,
        ruleLoader,
        actionLoader,
        eventLoader,
        entityLoader, // <<< ADDED LOADER-004-F
        validator,
        configuration,
        gameConfigLoader,
        modManifestLoader
    ) {
        // --- Existing validation checks ---
        if (!registry || typeof registry.clear !== 'function' || typeof registry.store !== 'function') {
            throw new Error("WorldLoader: Missing/invalid 'registry'.");
        }
        if (!logger || typeof logger.info !== 'function' || typeof logger.error !== 'function') {
            throw new Error("WorldLoader: Missing/invalid 'logger'.");
        }
        if (!schemaLoader || typeof schemaLoader.loadAndCompileAllSchemas !== 'function') {
            throw new Error("WorldLoader: Missing/invalid 'schemaLoader'.");
        }
        // REFACTOR-LOADER-2 means componentLoader now uses loadItemsForMod
        if (!componentLoader || typeof componentLoader.loadItemsForMod !== 'function') {
            throw new Error("WorldLoader: Missing/invalid 'componentLoader' (must implement loadItemsForMod).");
        }
        // REFACTOR-LOADER-2 means ruleLoader now uses loadItemsForMod
        if (!ruleLoader || typeof ruleLoader.loadItemsForMod !== 'function') {
            throw new Error("WorldLoader: Missing/invalid 'ruleLoader' (must implement loadItemsForMod).");
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
        // REFACTOR-LOADER-2 means actionLoader now uses loadItemsForMod
        if (!actionLoader || typeof actionLoader.loadItemsForMod !== 'function') {
            throw new Error("WorldLoader: Missing/invalid 'actionLoader' (must implement loadItemsForMod).");
        }
        // REFACTOR-LOADER-2 means eventLoader now uses loadItemsForMod
        if (!eventLoader || typeof eventLoader.loadItemsForMod !== 'function') {
            throw new Error("WorldLoader: Missing/invalid 'eventLoader' (must implement loadItemsForMod).");
        }
        // LOADER-004-F: Validate EntityDefinitionLoader
        if (!entityLoader || typeof entityLoader.loadItemsForMod !== 'function') {
            throw new Error("WorldLoader: Missing/invalid 'entityLoader' (must implement loadItemsForMod).");
        }

        // --- Store dependencies ---
        this.#registry = registry;
        this.#logger = logger;
        this.#schemaLoader = schemaLoader;
        this.#componentDefinitionLoader = componentLoader;
        this.#ruleLoader = ruleLoader;
        this.#actionLoader = actionLoader;
        this.#eventLoader = eventLoader;
        this.#entityDefinitionLoader = entityLoader; // <<< ADDED LOADER-004-F
        this.#validator = validator;
        this.#configuration = configuration;
        this.#gameConfigLoader = gameConfigLoader;
        this.#modManifestLoader = modManifestLoader;

        // --- REFACTOR-LOADER-4 & LOADER-004-F: Initialize content loaders config ---
        this.#contentLoadersConfig = [
            {
                loader: this.#actionLoader,
                contentKey: 'actions',
                contentTypeDir: 'actions',
                typeName: 'actions'
            },
            {
                loader: this.#componentDefinitionLoader,
                contentKey: 'components',
                contentTypeDir: 'components',
                typeName: 'components'
            },
            {
                loader: this.#eventLoader,
                contentKey: 'events',
                contentTypeDir: 'events',
                typeName: 'events'
            },
            {
                loader: this.#ruleLoader,
                contentKey: 'rules',
                contentTypeDir: 'rules', // Note: Directory name might differ from key/type
                typeName: 'rules' // Using descriptive name
            },
            // --- ADDED: LOADER-004-F Configurations ---
            {
                loader: this.#entityDefinitionLoader,
                contentKey: 'blockers',
                contentTypeDir: 'blockers',
                typeName: 'blockers'
            },
            {
                loader: this.#entityDefinitionLoader,
                contentKey: 'connections',
                contentTypeDir: 'connections',
                typeName: 'connections'
            },
            {
                loader: this.#entityDefinitionLoader,
                contentKey: 'characters',
                contentTypeDir: 'characters',
                typeName: 'characters'
            },
            {
                loader: this.#entityDefinitionLoader,
                contentKey: 'items',
                contentTypeDir: 'items',
                typeName: 'items'
            },
            {
                loader: this.#entityDefinitionLoader,
                contentKey: 'locations',
                contentTypeDir: 'locations',
                typeName: 'locations'
            },
            // --- END ADDED: LOADER-004-F ---
        ];
        // --- END REFACTOR-LOADER-4 ---

        this.#logger.info('WorldLoader: Instance created with ALL loaders (Action, Event, Component, Rule, EntityDefinition) and order‑resolver.');
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
        let incompatibilityCount = 0;
        let essentialSchemaMissing = false;
        let missingSchemaId = '';
        /** @type {Map<string, ModManifest>} */ // <<< Updated type hint
        let loadedManifestsMap = new Map();
        /** @type {Record<string, number>} */ // <<< REFACTOR-LOADER-4: Added for summary counts
        const totalCounts = {}; // Object to store total counts per type

        try {
            // 1. fresh slate
            this.#registry.clear();

            // 2. schemas
            await this.#schemaLoader.loadAndCompileAllSchemas();

            // 3. essential‑schema guard
            const essentials = [
                this.#configuration.getContentTypeSchemaId('game'),
                this.#configuration.getContentTypeSchemaId('components'), // Component Definition Schema
                this.#configuration.getContentTypeSchemaId('mod-manifest'),
                this.#configuration.getContentTypeSchemaId('entities') // LOADER-004-F: Add entity schema check
            ];
            for (const id of essentials) {
                if (!id || !this.#validator.isSchemaLoaded(id)) {
                    essentialSchemaMissing = true;
                    missingSchemaId = id ?? 'Unknown Essential Schema';
                    throw new Error(`WorldLoader: Essential schema missing or not configured: ${missingSchemaId}`);
                }
            }

            // 4. game.json → requested mods
            requestedModIds = await this.#gameConfigLoader.loadConfig();
            this.#logger.info(`Game config loaded. Requested mods: [${requestedModIds.join(', ')}]`);

            // 5. load manifests (order of fetch is irrelevant)
            loadedManifestsMap = await this.#modManifestLoader.loadRequestedManifests(requestedModIds);

            // store manifests in registry (lower‑case keys)
            const manifestsForValidation = new Map();
            for (const [modId, manifestObj] of loadedManifestsMap.entries()) {
                const lc = modId.toLowerCase();
                this.#registry.store('mod_manifests', lc, manifestObj);
                manifestsForValidation.set(lc, manifestObj); // Use lower-case keys for validation map
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

            // 5c. 🎯 NEW – compute *final* mod load order via resolver
            this.#finalOrder = resolveOrder(requestedModIds, manifestsForValidation, this.#logger);
            this.#logger.info(`WorldLoader: Final mod order resolved: [${this.#finalOrder.join(', ')}]`);
            this.#registry.store('meta', 'final_mod_order', this.#finalOrder);

            // --- REFACTOR-LOADER-4: Modified loading section ---
            // 6. Iterate through resolved mod order and load content using generic loaders config
            this.#logger.info(`WorldLoader: Beginning content loading based on final order...`);

            for (const modId of this.#finalOrder) {
                this.#logger.info(`--- Loading content for mod: ${modId} ---`);
                // Retrieve manifest using the modId (original case should work as map key)
                // Use registry lookup with lower-cased key for consistency with validation map
                const manifest = this.#registry.get('mod_manifests', modId.toLowerCase());

                if (!manifest) {
                    this.#logger.error(`WorldLoader: Manifest for mod '${modId}' (key: ${modId.toLowerCase()}) not found in registry during content loading phase. Skipping content load for this mod.`);
                    continue; // Skip to next mod
                }

                // Iterate through the contentLoadersConfig to load each type for the current mod
                for (const config of this.#contentLoadersConfig) {
                    // Check if the manifest actually lists this content type
                    // Use the contentKey from the config to check the manifest
                    if (!manifest.content || !manifest.content[config.contentKey] || manifest.content[config.contentKey].length === 0) {
                        this.#logger.debug(`WorldLoader [${modId}]: No '${config.contentKey}' listed in manifest. Skipping loading for type '${config.typeName}'.`);
                        continue; // Skip this content type for this mod
                    }

                    this.#logger.debug(`WorldLoader [${modId}]: Loading type '${config.typeName}' using content key '${config.contentKey}'...`);
                    try {
                        // Call loadItemsForMod using the configuration
                        const count = await config.loader.loadItemsForMod(
                            modId,
                            manifest, // Pass the retrieved manifest
                            config.contentKey,
                            config.contentTypeDir,
                            config.typeName
                        );

                        // Aggregate counts for the summary log
                        totalCounts[config.typeName] = (totalCounts[config.typeName] || 0) + count;
                        this.#logger.debug(`WorldLoader [${modId}]: Successfully loaded ${count} ${config.typeName}.`);

                    } catch (loadError) {
                        // Log error for this specific type/mod but continue loading others
                        this.#logger.error(
                            `WorldLoader [${modId}]: Error loading content type '${config.typeName}'. Loading will continue for other types/mods.`,
                            {
                                modId: modId,
                                contentType: config.typeName,
                                error: loadError?.message || loadError // Include error message
                            },
                            loadError // Include full error object for stack trace etc.
                        );
                        // Optional: Depending on robustness requirements, could track failures per mod/type
                    }
                } // End loop through content types

                this.#logger.info(`--- Finished loading content for mod: ${modId} ---`);
            } // End loop through mods

            this.#logger.info(`WorldLoader: Completed content loading for all mods.`);
            // --- END REFACTOR-LOADER-4 ---

            // --- REMOVED old loading steps (were already gone/commented out) ---
            // // 6. Load system rules – TBD per‑mod, currently single call (stub).
            // // await this.#ruleLoader.loadAll(); // Already removed
            // // 7. Load component definitions (still global stub)
            // // await this.#componentDefinitionLoader.loadComponentDefinitions(); // Already removed
            // --- END REMOVAL ---

            // 8. (future) other generic content loaders added to the config will be handled by the loop

            // 9. summary log - Pass totalCounts
            this.#logLoadSummary(worldName, requestedModIds, this.#finalOrder, incompatibilityCount, totalCounts); // <<< Pass totalCounts

        } catch (err) {
            this.#logger.error('WorldLoader: CRITICAL load failure during world/mod loading sequence.', {error: err}); // Log FIRST
            this.#registry.clear(); // Clear registry on any error

            if (essentialSchemaMissing) {
                this.#logger.error(`WorldLoader: Essential schema missing: ${missingSchemaId}`);
                throw new Error(`WorldLoader failed data load sequence (World Hint: '${worldName}'): Essential schemas missing – aborting world load.`);
            } else {
                throw err;
            }
        }
    }

    // ── Helper: summary logger ──────────────────────────────────────────────
    /**
     * Prints a multi‑line summary of what was loaded.
     * @param {string}   worldName
     * @param {string[]} requestedModIds – list from game.json (post‑core‑injection)
     * @param {string[]} finalOrder      – order produced by resolver
     * @param {number}   incompatibilityCount
     * @param {Record<string, number>} totalCounts - Aggregated counts per content type // <<< ADDED parameter
     */
    #logLoadSummary(worldName, requestedModIds, finalOrder, incompatibilityCount, totalCounts) { // <<< ADDED parameter
        this.#logger.info(`— WorldLoader Load Summary (World: '${worldName}') —`);
        this.#logger.info(`  • Requested Mods (raw): [${requestedModIds.join(', ')}]`);
        this.#logger.info(`  • Final Load Order    : [${finalOrder.join(', ')}]`);

        if (incompatibilityCount > 0) {
            this.#logger.info(`  • Engine‑version incompatibilities detected: ${incompatibilityCount}`);
        }

        // --- REFACTOR-LOADER-4: Update summary log using totalCounts ---
        this.#logger.info(`  • Content Loading Summary:`);
        if (Object.keys(totalCounts).length > 0) {
            const sortedTypes = Object.keys(totalCounts).sort(); // Sort type names alphabetically
            for (const typeName of sortedTypes) {
                const count = totalCounts[typeName];
                // Pad typeName for alignment (adjust padding as needed)
                const paddedTypeName = typeName.padEnd(20, ' ');
                this.#logger.info(`    - ${paddedTypeName}: ${count} loaded`);
            }
        } else {
            this.#logger.info(`    - No content items processed.`);
        }
        // --- END REFACTOR-LOADER-4 ---

        // --- REMOVED old specific count retrieval using registry.getAll ---
        // const componentCount = this.#registry.getAll('components').length;
        // this.#logger.info(`  • Component definitions loaded: ${componentCount}`);
        // const ruleCount = this.#registry.getAll('rules').length;
        // this.#logger.info(`  • System rules loaded         : ${ruleCount}`);
        // const actionCount = this.#registry.getAll('actions').length;
        // this.#logger.info(`  • Action definitions loaded   : ${actionCount}`);
        // const eventCount = this.#registry.getAll('events').length;
        // this.#logger.info(`  • Event definitions loaded    : ${eventCount}`);
        // --- END REMOVAL ---

        this.#logger.info('———————————————————————————————————————————');
    }
}

export default WorldLoader;