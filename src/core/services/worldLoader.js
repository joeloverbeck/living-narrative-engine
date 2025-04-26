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

// --- Type-only JSDoc imports ──────────────────────────────────────────────────
/** @typedef {import('../interfaces/coreServices.js').ILogger} ILogger */
/** @typedef {import('../interfaces/coreServices.js').ISchemaValidator} ISchemaValidator */
/** @typedef {import('../interfaces/coreServices.js').IDataRegistry} IDataRegistry */
/** @typedef {import('../interfaces/coreServices.js').IConfiguration} IConfiguration */

// --- Implementation Imports ---
import ModDependencyValidator from './modDependencyValidator.js';
// --- T-4: Import validateModEngineVersions ---
import validateModEngineVersions from './modVersionValidator.js';
import ModDependencyError from '../errors/modDependencyError.js'; // Assuming ModDependencyError is exported here or from a central errors file
import {ENGINE_VERSION} from '../engineVersion.js'; // Import needed for logging

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
        let incompatibilityCount = 0; // T-4: Track incompatibilities for final log

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
            requestedModIds = await this.#gameConfigLoader.loadConfig(); // Assign to the outer scope variable
            this.#logger.info(
                `Game config loaded successfully. Requested mods (${requestedModIds.length}): ` +
                `[${requestedModIds.join(', ')}]`
            );

            // ── 5. Load every requested mod’s manifest (dependency + version checks inside) ─
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
            // Store using lower-case keys for consistency with validator expectations
            const manifestsForValidation = new Map();
            for (const [modId, manifestObj] of loadedManifestsMap.entries()) {
                const modIdLower = modId.toLowerCase();
                this.#registry.store('mod_manifests', modIdLower, manifestObj);
                manifestsForValidation.set(modIdLower, manifestObj); // Populate map for validation
            }

            // --- 5a. Perform dependency validation ---
            // Uses the lower-case keyed map prepared above
            ModDependencyValidator.validate(manifestsForValidation, this.#logger);

            // --- 5b. Perform engine version compatibility check ---
            // T-4: Import and invoke validateModEngineVersions immediately after ModDependencyValidator.validate call.
            // T-4: Propagate identical try/catch semantics: On ModDependencyError → log prefix ENGINE_VERSION_INCOMPATIBLE and rethrow.
            try {
                validateModEngineVersions(manifestsForValidation, this.#logger);
            } catch (err) {
                if (err instanceof ModDependencyError) {
                    // Log individual incompatibility messages based on the error message format
                    // Expected format from validateModEngineVersions: lines like "Mod 'X' incompatible with engine vY (requires 'Z')."
                    const errorMessages = err.message.split('\n');
                    incompatibilityCount = errorMessages.length; // T-4: Track count
                    errorMessages.forEach(line => {
                        // Log each incompatibility line with the required prefix
                        this.#logger.error(`ENGINE_VERSION_INCOMPATIBLE: ${line} Aborting.`);
                    });
                    // Rethrow the original error to be caught by the outer catch block
                    throw err;
                } else {
                    // Re-throw unexpected errors
                    throw err;
                }
            }


            // ── 6. Load system-rules (they may live in mods) ─────────────────────
            await this.#ruleLoader.loadAll();

            // ── 7. Load component definitions (also mod-driven) ──────────────────
            // Ensure ComponentDefinitionLoader uses registry correctly (it might need getManifest or getAll('mod_manifests'))
            // This might require refactoring ComponentDefinitionLoader if it relied solely on getManifest().
            // Assuming ComponentDefinitionLoader is adapted or doesn't strictly need manifest *object*.
            await this.#componentDefinitionLoader.loadComponentDefinitions();

            // ── 8. (Temporary) legacy loaders skipped - they’ll be removed later ─
            // Future: GenericContentLoader would be called here, likely looping through manifests from registry.

            // ── 9. Emit a concise summary so developers can see what happened ────
            this.#logLoadSummary(worldName, requestedModIds, incompatibilityCount); // Pass incompatibilityCount

        } catch (err) {
            // Centralised error handling: clear everything and re-throw
            if (err.name === 'ModDependencyError') {
                // T-4: Modify final error logging for incompatibility count if relevant
                const versionIncompatibilityPrefix = 'ENGINE_VERSION_INCOMPATIBLE:';
                const dependencyValidationPrefix = 'DEPENDENCY_VALIDATION_FAILED:';
                let logPrefix = dependencyValidationPrefix; // Default for dependency errors

                // Check if the error message indicates it came from the version validator
                // (We logged the specific lines already, this is for the summary failure message)
                if (incompatibilityCount > 0) {
                    logPrefix = versionIncompatibilityPrefix; // Use the specific prefix for version errors
                }

                // Log the final summary failure message
                this.#logger.error(
                    `${logPrefix} WorldLoader critical load failure due to mod issues ` +
                    `(World Hint: '${worldName}'${incompatibilityCount > 0 ? `, ${incompatibilityCount} incompatibilities found` : ''}). Aborting.\n${err.message}`,
                    err // Pass the error object
                );
            } else {
                // Handle other types of errors
                this.#logger.error(
                    `WorldLoader: CRITICAL load failure during world/mod loading sequence.`, // Removed worldName hint
                    err // Log the full error object
                );
            }
            this.#registry.clear();
            // Re-throw the original error preserving its type and details
            throw err;
        }
    }

    // ── Helper: pretty summary to log ─────────────────────────────────────────

    /**
     * Logs a multi-line overview of what was loaded (mods, counts, etc.).
     *
     * @param {string}                   worldName
     * @param {string[]}                 requestedModIds
     * @param {number}                   incompatibilityCount - T-4: Added parameter
     */
    #logLoadSummary(worldName, requestedModIds, incompatibilityCount) { // T-4: Added parameter
        this.#logger.info(`— WorldLoader Load Summary (World Hint: '${worldName}') —`);

        this.#logger.info(`  • Requested Mods: [${requestedModIds.join(', ')}]`);

        // Final mod order - Get from registry where they were stored with lower-case keys
        const loadedManifests = this.#registry.getAll('mod_manifests') || [];
        // Map back to original IDs for the log message if needed, or just use the ID from manifest
        const finalOrder = loadedManifests.map(m => m?.id || 'unknown'); // Use original ID from manifest data

        this.#logger.info(`  • Final Mod Load Order: [${finalOrder.join(', ')}]`);

        // Component defs
        const componentDefsCount = this.#registry.getAll('component_definitions').length;
        this.#logger.info(`  • Component definitions loaded: ${componentDefsCount}`);

        // Mod Manifests count
        this.#logger.info(`  • Mod Manifests loaded: ${loadedManifests.length}`);

        // T-4: Conditionally log incompatibility count in the summary (only if > 0, though summary implies success)
        // Re-evaluating: The ticket asks to extend the *load-summary* log.
        // This usually means the log shown on SUCCESSFUL load.
        // However, the test harness requirement suggests it needs to be present even on failure for deterministic testing.
        // Let's add it here, but it will only appear if the load *reaches* this point (i.e., doesn't fail before step 9).
        // If the load *failed* due to incompatibility, the main catch block's error log handles the count.
        // This interpretation might be slightly off the ticket's intent but fits the code flow.
        if (incompatibilityCount > 0) {
            this.#logger.info(`  • Engine Version Incompatibilities Detected: ${incompatibilityCount}`);
        }


        // Generic content categories we care about
        const contentTypes = [
            'actions', 'items', 'entities', 'locations',
            'connections', 'blockers', 'events', 'components' // Note: 'components' here refers to entity components, not definitions
        ];

        let totalContent = 0;
        for (const type of contentTypes) {
            const list = this.#registry.getAll(type);
            if (Array.isArray(list) && list.length > 0) {
                this.#logger.info(`  • ${type}: ${list.length}`);
                totalContent += list.length;
            }
        }

        this.#logger.info(
            `  • Total Content Items (excluding manifests): ${totalContent}`
        );

        // Rules
        const ruleCount = this.#registry.getAll('system-rules').length;
        this.#logger.info(`  • System rules loaded: ${ruleCount}`);

        this.#logger.info('———————————————————————————————————————————————');
    }
}

export default WorldLoader;