// src/core/services/modeManifestLoader.js

/**
 * @file Defines the ModManifestLoader class, responsible for
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
     * @private #configuration;
     * @private #pathResolver;
     * @private #dataFetcher;
     * @private #schemaValidator;
     * @private #dataRegistry;
     * @private #logger;
     * @private #lastLoadedManifests = null;

  constructor(
    configuration,
    pathResolver,
    dataFetcher,
    schemaValidator,
    dataRegistry,
    logger
  ) {
    const svc = 'ModManifestLoader';

    // --- Dependency guards (unchanged) ---
    if (
      !configuration ||
      typeof configuration.getContentTypeSchemaId !== 'function'
    ) {
      throw new Error(
        `${svc}: Missing or invalid 'configuration' dependency (IConfiguration). Requires getContentTypeSchemaId() method.`
      );
    }
    if (
      !pathResolver ||
      typeof pathResolver.resolveModManifestPath !== 'function'
    ) {
      throw new Error(
        `${svc}: Missing or invalid 'pathResolver' dependency (IPathResolver). Requires resolveModManifestPath() method.`
      );
    }
    if (!dataFetcher || typeof dataFetcher.fetch !== 'function') {
      throw new Error(
        `${svc}: Missing or invalid 'dataFetcher' dependency (IDataFetcher). Requires fetch() method.`
      );
    }
    if (
      !schemaValidator ||
      typeof schemaValidator.getValidator !== 'function'
    ) {
      throw new Error(
        `${svc}: Missing or invalid 'schemaValidator' dependency (ISchemaValidator). Requires getValidator() method.`
      );
    }
    if (!dataRegistry || typeof dataRegistry.store !== 'function') {
      throw new Error(
        `${svc}: Missing or invalid 'dataRegistry' dependency (IDataRegistry). Requires store() method.`
      );
    }
    if (
      !logger ||
      ['info', 'warn', 'error', 'debug'].some(
        (m) => typeof logger[m] !== 'function'
      )
    ) {
      throw new Error(
        `${svc}: Missing or invalid 'logger' dependency (ILogger). Requires info(), warn(), error(), and debug() methods.`
      );
    }

    // --- assign (unchanged) ---
    this.#configuration = configuration;
    this.#pathResolver = pathResolver;
    this.#dataFetcher = dataFetcher;
    this.#schemaValidator = schemaValidator;
    this.#dataRegistry = dataRegistry;
    this.#logger = logger;

    this.#logger.info(
      'ModManifestLoader: Instance created and dependencies validated.'
    );
  }

  /* ----------------------------------------------------------------------- */
  /* Enhanced parallel loader (MODLOADER‑005 D & E - Revised Logic)          */

  /* ----------------------------------------------------------------------- */

  /**
   * Fetches, validates (against mod.manifest.schema.json), and registers
   * every manifest listed in `requestedModIds`.
   * @param  {string[]} requestedModIds
   * @return {Promise<Map<string,object>>}
   * @throws {Error} if any manifest cannot be fetched, validated, or stored.
   */
  async loadRequestedManifests(requestedModIds) {
    const fn = 'ModManifestLoader.loadRequestedManifests';
    const schemaId = this.#configuration.getContentTypeSchemaId('mod-manifest');

    /* ── 1. basic request-array sanity ─────────────────────────────── */
    if (!Array.isArray(requestedModIds)) {
      const msg = `${fn}: expected an array of mod-IDs.`;
      this.#logger.error(ERR.INVALID_REQUEST_ARRAY, msg, {});
      throw new TypeError(msg);
    }

    const trimmedIds = [];
    const seen = new Set();
    for (const raw of requestedModIds) {
      if (typeof raw !== 'string' || !raw.trim()) {
        const msg = `${fn}: mod-IDs must be non-empty strings.`;
        this.#logger.error(ERR.INVALID_REQUEST_ID, msg, { badValue: raw });
        throw new TypeError(msg);
      }
      const id = raw.trim();
      if (seen.has(id)) {
        const msg = `${fn}: duplicate mod-ID '${id}' in request list.`;
        this.#logger.error(ERR.DUPLICATE_REQUEST_ID, msg);
        throw new Error(msg);
      }
      seen.add(id);
      trimmedIds.push(id);
    }

    /* ── 2. pull the compiled validator once ───────────────────────── */
    const validatorFn = this.#schemaValidator.getValidator(schemaId);
    if (typeof validatorFn !== 'function') {
      const msg = `${fn}: no validator available for '${schemaId}'.`;
      this.#logger.error(ERR.NO_VALIDATOR, msg, { schemaId });
      throw new Error(msg);
    }

    /* ── 3. parallel fetch of *all* manifests ──────────────────────── */
    const fetchJobs = trimmedIds.map((modId) => {
      const path = this.#pathResolver.resolveModManifestPath(modId);
      return { modId, path, job: this.#dataFetcher.fetch(path) };
    });
    const settled = await Promise.allSettled(fetchJobs.map((f) => f.job));

    /* ── 4. validation & id-consistency (sequential, abort on error) ─ */
    const validated = []; // {modId, data, path}
    for (let i = 0; i < fetchJobs.length; i++) {
      const { modId, path } = fetchJobs[i];
      const result = settled[i];

      if (result.status === 'rejected') {
        this.#logger.warn(
          ERR.FETCH_FAIL,
          `${fn}: could not fetch manifest for '${modId}' – skipping.`,
          { modId, path, reason: result.reason?.message || result.reason }
        );
        continue;
      }

      const manifestObj = result.value;

      /* ── 4a. schema validation ⤵ ─────────────────────────────── */
      const vRes = validatorFn(manifestObj);
      if (!vRes.isValid) {
        const pretty = JSON.stringify(vRes.errors ?? [], null, 2);
        const msg = `${fn}: manifest for '${modId}' failed schema validation.`;
        this.#logger.error(ERR.VALIDATION_FAIL, msg, {
          modId,
          path,
          schemaId,
          details: pretty,
        });
        throw new Error(`${msg} See log for Ajv error details.`);
      }
      this.#logger.debug(`${fn}: manifest for '${modId}' schema-validated OK.`);

      /* ── 4b. ID ↔ directory consistency check ────────────────── */
      const declaredId = manifestObj?.id?.trim?.();
      if (!declaredId) {
        const msg = `${fn}: manifest '${path}' is missing an 'id' field.`;
        this.#logger.error(ERR.MISSING_MANIFEST_ID, msg, { modId, path });
        throw new Error(msg);
      }
      if (declaredId !== modId) {
        const msg = `${fn}: manifest ID '${declaredId}' does not match expected mod ID '${modId}'.`;
        this.#logger.error(ERR.ID_MISMATCH, msg, { modId, path });
        throw new Error(msg);
      }
      this.#logger.debug(
        `${fn}: manifest ID consistency check passed for '${modId}'.`
      );

      validated.push({ modId, data: manifestObj, path });
    }

    /* ── 5. store each validated manifest ─────────────────────────── */
    const stored = new Map();
    for (const { modId, data, path } of validated) {
      try {
        this.#dataRegistry.store('mod_manifests', modId, data);
        stored.set(modId, data);
        this.#logger.debug(`${fn}: stored manifest '${modId}'.`);
      } catch (e) {
        const msg = `${fn}: failed to store manifest '${modId}'.`;
        this.#logger.error(ERR.REGISTRY_STORE_FAIL, msg, { modId, path });
        throw new Error(`${msg} – ${e.message}`);
      }
    }

    /* ── 6. summary ───────────────────────────────────────────────── */
    this.#lastLoadedManifests = stored;
    this.#logger.info(
      `${fn}: finished – fetched ${settled.filter((s) => s.status === 'fulfilled').length}/` +
        `${trimmedIds.length}, validated ${validated.length}, stored ${stored.size}.`
    );
    return stored;
  }

  /* ---------------- placeholders / future work (unchanged) ------------ */
  async loadModManifests(modIds) {
    this.#logger.warn(
      'ModManifestLoader.loadModManifests: Called but deprecated in favor of loadRequestedManifests.'
    );
    return this.loadRequestedManifests(modIds);
  }

  getLoadedManifests() {
    return this.#lastLoadedManifests;
  }
}

export default ModManifestLoader;
