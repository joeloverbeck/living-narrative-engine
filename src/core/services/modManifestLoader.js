// src/core/services/modeManifestLoader.js

/**
 * @fileoverview Defines the ModManifestLoader class, responsible for
 * loading, validating, and processing mod manifest files.
 */

// --- Import Interfaces (for JSDoc/Type Hinting) ---
/** @typedef {import('../interfaces/coreServices.js').IConfiguration} IConfiguration */
/** @typedef {import('../interfaces/coreServices.js').IPathResolver} IPathResolver */
/** @typedef {import('../interfaces/coreServices.js').IDataFetcher} IDataFetcher */
/** @typedef {import('../interfaces/coreServices.js').ISchemaValidator} ISchemaValidator */
/** @typedef {import('../interfaces/coreServices.js').IDataRegistry} IDataRegistry */
/** @typedef {import('../interfaces/coreServices.js').ILogger} ILogger */
/** @typedef {import('../interfaces/coreServices.js').ValidationResult} ValidationResult */

// --- MODLOADER-005 E: Error Code Constants ---
/**
 * Standardized error codes for ModManifestLoader logging.
 * @enum {string}
 */
const ERR = {
    FETCH_FAIL: 'MOD_MANIFEST_FETCH_FAIL',
    VALIDATION_FAIL: 'MOD_MANIFEST_SCHEMA_INVALID',
    ID_MISMATCH: 'MOD_MANIFEST_ID_MISMATCH',
    // DUPLICATE_ID is removed
    INVALID_REQUEST_ARRAY: 'MODLOADER_INVALID_REQUEST_ARRAY',
    INVALID_REQUEST_ID: 'MODLOADER_INVALID_REQUEST_ID',
    DUPLICATE_REQUEST_ID: 'MODLOADER_DUPLICATE_REQUEST_ID',
    NO_VALIDATOR: 'MODLOADER_NO_SCHEMA_VALIDATOR',
    MISSING_MANIFEST_ID: 'MODLOADER_MANIFEST_MISSING_ID',
    REGISTRY_STORE_FAIL: 'MODLOADER_REGISTRY_STORE_FAIL',
};

// --- End MODLOADER-005 E ---


class ModManifestLoader {
    /** @private @type {IConfiguration} */ #configuration;
    /** @private @type {IPathResolver}   */ #pathResolver;
    /** @private @type {IDataFetcher}    */ #dataFetcher;
    /** @private @type {ISchemaValidator}*/ #schemaValidator;
    /** @private @type {IDataRegistry}   */ #dataRegistry;
    /** @private @type {ILogger}         */ #logger;
    /** @private @type {Map<string,object>|null} */ #lastLoadedManifests = null;

    constructor(configuration, pathResolver, dataFetcher, schemaValidator, dataRegistry, logger) {
        const svc = 'ModManifestLoader';

        // --- Dependency guards (unchanged) ---
        if (!configuration || typeof configuration.getContentTypeSchemaId !== 'function') {
            throw new Error(`${svc}: Missing or invalid 'configuration' dependency (IConfiguration). Requires getContentTypeSchemaId() method.`);
        }
        if (!pathResolver || typeof pathResolver.resolveModManifestPath !== 'function') {
            throw new Error(`${svc}: Missing or invalid 'pathResolver' dependency (IPathResolver). Requires resolveModManifestPath() method.`);
        }
        if (!dataFetcher || typeof dataFetcher.fetch !== 'function') {
            throw new Error(`${svc}: Missing or invalid 'dataFetcher' dependency (IDataFetcher). Requires fetch() method.`);
        }
        if (!schemaValidator || typeof schemaValidator.getValidator !== 'function') {
            throw new Error(`${svc}: Missing or invalid 'schemaValidator' dependency (ISchemaValidator). Requires getValidator() method.`);
        }
        if (!dataRegistry || typeof dataRegistry.store !== 'function') {
            throw new Error(`${svc}: Missing or invalid 'dataRegistry' dependency (IDataRegistry). Requires store() method.`);
        }
        if (!logger || ['info', 'warn', 'error', 'debug'].some(m => typeof logger[m] !== 'function')) {
            throw new Error(`${svc}: Missing or invalid 'logger' dependency (ILogger). Requires info(), warn(), error(), and debug() methods.`);
        }

        // --- assign (unchanged) ---
        this.#configuration = configuration;
        this.#pathResolver = pathResolver;
        this.#dataFetcher = dataFetcher;
        this.#schemaValidator = schemaValidator;
        this.#dataRegistry = dataRegistry;
        this.#logger = logger;

        this.#logger.info('ModManifestLoader: Instance created and dependencies validated.');
    }

    /* ----------------------------------------------------------------------- */
    /* Enhanced parallel loader (MODLOADER‑005 D & E - Revised Logic)          */

    /* ----------------------------------------------------------------------- */

    /**
     * Fetches manifests **in parallel**, then validates & registers them.
     * Validation and ID checks happen sequentially based on the requested order.
     * If any manifest fails a critical check (validation, ID issues), the entire
     * operation halts immediately by throwing an error.
     * Manifests are stored in the registry only *after* all requested manifests
     * have been successfully fetched and validated.
     *
     * @param {string[]} requestedModIds
     * @returns {Promise<Map<string,object>>} Resolves with a map of successfully loaded manifests.
     * @throws {Error} If parameter validation fails, schema validator is missing,
     * or any manifest fails fetching (critically) or validation/ID checks.
     */
    async loadRequestedManifests(requestedModIds) {
        const fn = 'ModManifestLoader.loadRequestedManifests';
        const schemaId = this.#configuration.getContentTypeSchemaId('mod-manifest');

        // --- 1. Parameter Validation & Deduplication (Fast, Upfront) ---
        if (!Array.isArray(requestedModIds)) {
            const errorMsg = `${fn}: expected an array of mod IDs.`;
            this.#logger.error(ERR.INVALID_REQUEST_ARRAY, errorMsg, {details: 'Input was not an array.'});
            throw new TypeError(errorMsg);
        }
        const trimmedIds = [];
        const reqSeen = new Set();
        for (const id of requestedModIds) {
            if (typeof id !== 'string' || id.trim() === '') {
                const errorMsg = `${fn}: every mod ID must be a non-empty string.`;
                this.#logger.error(ERR.INVALID_REQUEST_ID, errorMsg, {details: `Invalid ID encountered: ${id}`});
                throw new TypeError(errorMsg);
            }
            const trimmedId = id.trim();
            if (reqSeen.has(trimmedId)) {
                const errorMsg = `${fn}: Duplicate mod ID '${trimmedId}' encountered in request list.`;
                this.#logger.error(ERR.DUPLICATE_REQUEST_ID, errorMsg, {modId: trimmedId});
                throw new Error(errorMsg);
            }
            reqSeen.add(trimmedId);
            trimmedIds.push(trimmedId);
        }

        // --- 2. Prepare Validator ---
        const validator = this.#schemaValidator.getValidator(schemaId);
        if (typeof validator !== 'function') {
            const errorMsg = `${fn}: No validator function found for schemaId '${schemaId}'.`;
            this.#logger.error(ERR.NO_VALIDATOR, errorMsg, {schemaId: schemaId});
            throw new Error(errorMsg);
        }

        // --- 3. Parallel Fetch ---
        const fetchMeta = trimmedIds.map(modId => {
            const path = this.#pathResolver.resolveModManifestPath(modId);
            return {modId, path, promise: this.#dataFetcher.fetch(path)};
        });
        const settledResults = await Promise.allSettled(fetchMeta.map(f => f.promise));

        // --- 4. Sequential Validation and Collection (Halts on First Critical Error) ---
        const validatedManifestData = []; // Store successfully validated data temporarily
        for (let idx = 0; idx < trimmedIds.length; idx++) {
            const {modId, path} = fetchMeta[idx];
            const res = settledResults[idx];

            if (res.status === 'rejected') {
                // Log fetch failure as warning but continue processing others *for validation*
                // However, if ANY fetch fails, we might consider halting *before* storing later.
                // For now, just log and skip validation for this one. The final count will be lower.
                const reason = res.reason?.message || res.reason || 'Unknown fetch error';
                this.#logger.warn(
                    ERR.FETCH_FAIL,
                    `${fn}: Could not fetch manifest for requested mod '${modId}'. This mod will be skipped.`,
                    {modId: modId, path: path, details: reason}
                );
                continue; // Skip processing this failed fetch
            }

            // If fetch succeeded, perform validation and checks
            const manifestData = res.value;

            // Schema validation (critical)
            const valResult = validator(manifestData);
            if (!valResult?.isValid) {
                const errors = Array.isArray(valResult.errors) && valResult.errors.length
                    ? valResult.errors.map(e => e.message || JSON.stringify(e)).join('; ')
                    : 'No specific validation errors provided.';
                const errorMsg = `${fn}: Manifest for requested mod '${modId}' failed schema validation. Halting processing.`;
                this.#logger.error(ERR.VALIDATION_FAIL, errorMsg, {
                    modId: modId,
                    path: path,
                    schemaId: schemaId,
                    details: errors
                });
                throw new Error(`${errorMsg} Details: ${errors}`); // Throw immediately
            }

            // ID validity check (critical)
            if (!manifestData || typeof manifestData !== 'object' || typeof manifestData.id !== 'string' || manifestData.id.trim() === '') {
                const errorMsg = `${fn}: Manifest for requested mod '${modId}' is missing a valid 'id' field. Halting processing.`;
                this.#logger.error(ERR.MISSING_MANIFEST_ID, errorMsg, {
                    modId: modId,
                    path: path,
                    schemaId: schemaId,
                    details: 'Manifest data is invalid or lacks a non-empty string ID.'
                });
                throw new Error(errorMsg); // Throw immediately
            }

            const manifestId = manifestData.id.trim();

            // ID consistency check (critical)
            if (manifestId !== modId) {
                const errorMsg = `${fn}: Manifest ID '${manifestId}' does not match requested mod ID '${modId}'. Halting processing.`;
                this.#logger.error(ERR.ID_MISMATCH, errorMsg, {
                    modId: modId,
                    path: path,
                    schemaId: schemaId,
                    details: `Manifest contains ID '${manifestId}'`
                });
                throw new Error(errorMsg); // Throw immediately
            }

            // If all checks passed for this manifest, add it to our temporary list
            validatedManifestData.push({modId: manifestId, data: manifestData, path: path}); // Store context
            this.#logger.debug(`${fn}: Manifest for mod '${manifestId}' passed validation and checks.`);
        }

        // --- 5. Store Validated Manifests in Registry (Only if loop completed without errors) ---
        const storedManifests = new Map();
        if (validatedManifestData.length > 0) {
            this.#logger.info(`${fn}: All processed manifests passed validation. Storing ${validatedManifestData.length} manifests...`);
            for (const {modId, data, path} of validatedManifestData) {
                try {
                    this.#dataRegistry.store('mod_manifests', modId, data);
                    storedManifests.set(modId, data);
                    this.#logger.debug(`${fn}: Stored manifest for mod '${modId}'.`);
                } catch (err) {
                    // If storing fails, it's still a critical error for the overall process
                    const errorMsg = `${fn}: Failed to store manifest '${modId}' in registry during final storage phase. Halting.`;
                    this.#logger.error(
                        ERR.REGISTRY_STORE_FAIL,
                        errorMsg,
                        {modId: modId, path: path, schemaId: schemaId, details: err.message}
                    );
                    throw new Error(`${errorMsg} Reason: ${err.message}`); // Throw immediately
                }
            }
        } else {
            this.#logger.info(`${fn}: No manifests passed validation or fetch stage. Nothing to store.`);
        }


        // --- 6. Finalize ---
        this.#lastLoadedManifests = storedManifests;
        const fetchedCount = settledResults.filter(r => r.status === 'fulfilled').length;
        this.#logger.info(`${fn}: Processing complete. Fetched: ${fetchedCount}/${trimmedIds.length}. Validated: ${validatedManifestData.length}. Stored: ${storedManifests.size}.`);
        return storedManifests; // Resolve with the map of successfully stored manifests
    }

    /* ---------------- placeholders / future work (unchanged) ------------ */
    async loadModManifests(modIds) {
        this.#logger.warn('ModManifestLoader.loadModManifests: Called but deprecated in favor of loadRequestedManifests.');
        return this.loadRequestedManifests(modIds);
    }

    getLoadedManifests() {
        return this.#lastLoadedManifests;
    }
}

export default ModManifestLoader;