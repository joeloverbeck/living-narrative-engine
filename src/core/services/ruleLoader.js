// src/core/services/ruleLoader.js

/**
 * @typedef {import('../interfaces/coreServices.js').IPathResolver}      IPathResolver
 * @typedef {import('../interfaces/coreServices.js').IDataFetcher}       IDataFetcher
 * @typedef {import('../interfaces/coreServices.js').ISchemaValidator}   ISchemaValidator
 * @typedef {import('../interfaces/coreServices.js').ILogger}            ILogger
 * @typedef {import('../interfaces/coreServices.js').IDataRegistry}      IDataRegistry // Added
 */
// EventBus import removed (AC11 related)

// AC1: uuid library is imported
import { v4 as uuidv4 } from 'uuid';

/** Domain-specific failure wrapper that callers can trap with
 * `catch (e) { if (e instanceof RuleLoaderError) … }` */
export class RuleLoaderError extends Error {
    constructor(message, cause) {
        super(message);
        this.name = 'RuleLoaderError';
        if (cause) this.cause = cause;
    }
}

/**
 * @class RuleLoader
 * @description Responsible for discovering, fetching, validating, and storing system rule
 * definition files. It interacts with various core services (fetching, path resolution,
 * validation, logging, data registry) to perform its tasks. This version focuses
 * solely on loading rules into the IDataRegistry and does *not* handle rule
 * interpretation or event bus interactions directly.
 */
class RuleLoader {
    /** @type {IPathResolver}     */ #pathResolver;
    /** @type {IDataFetcher}      */ #dataFetcher;
    /** @type {ISchemaValidator}  */ #schemaValidator;
    /** @type {IDataRegistry}     */ #dataRegistry;   // Added
    /** @type {ILogger}           */ #logger;
    // #eventBus removed (AC2, AC11 related)
    // #interpreter removed (AC11 related)
    // #rulesByEvent map removed (AC11 related, storage handled by dataRegistry)

    /**
     * @param {IPathResolver}     pathResolver
     * @param {IDataFetcher}      dataFetcher
     * @param {ISchemaValidator}  schemaValidator
     * @param {IDataRegistry}     dataRegistry    // Added
     * @param {ILogger}           logger
     * // Removed eventBus parameter
     */
    constructor(
        pathResolver,
        dataFetcher,
        schemaValidator,
        dataRegistry,   // Added
        logger,
    ) {
        //------------------------------------------------------------------
        // Dependency guards
        //------------------------------------------------------------------
        if (!pathResolver || typeof pathResolver.resolveContentPath !== 'function')
            throw new Error("RuleLoader: Missing/invalid 'pathResolver' (needs resolveContentPath).");

        if (!dataFetcher || typeof dataFetcher.fetch !== 'function')
            throw new Error("RuleLoader: Missing/invalid 'dataFetcher' (needs fetch).");

        if (
            !schemaValidator ||
            typeof schemaValidator.addSchema !== 'function' ||
            typeof schemaValidator.isSchemaLoaded !== 'function' ||
            typeof schemaValidator.validate !== 'function'
        )
            throw new Error("RuleLoader: Missing/invalid 'schemaValidator' (needs addSchema, isSchemaLoaded & validate).");

        // Added: Check for dataRegistry with a 'store' method
        if (!dataRegistry || typeof dataRegistry.store !== 'function')
            throw new Error("RuleLoader: Missing/invalid 'dataRegistry' (needs store method).");

        // Removed: EventBus dependency check (AC11 related)

        if (
            !logger ||
            typeof logger.info !== 'function' ||
            typeof logger.warn !== 'function' ||
            typeof logger.error !== 'function' ||
            typeof logger.debug !== 'function' // Added debug check for logging store success
        )
            throw new Error("RuleLoader: Missing/invalid 'logger' (needs info/warn/error/debug).");

        this.#pathResolver = pathResolver;
        this.#dataFetcher = dataFetcher;
        this.#schemaValidator = schemaValidator;
        this.#dataRegistry = dataRegistry; // Added
        this.#logger = logger;
        // #eventBus assignment removed
        // #interpreter assignment removed

        // Updated log message
        this.#logger.info('RuleLoader: Instance created. Mode: Load & Store.');
    }

    // ** AC1: Removed commented-out loadedEventCount getter **

    // -------------------------------------------------------------------
    // Internal helpers
    // -------------------------------------------------------------------

    // ** AC1: Removed commented-out subscribeOnce method **

    // -------------------------------------------------------------------
    // Public API
    // -------------------------------------------------------------------

    /**
     * Load and validate every `*.json` rule file beneath `baseUrl`.
     *
     * Workflow: *dir discover* → *parallel fetch* → *schema validation* → *store in IDataRegistry*.
     *
     * A **RuleLoaderError** is thrown when:
     * • any fetch fails, **or**
     * • any blob fails JSON-schema validation.
     *
     * Storing uses `rule.rule_id` if available and valid, otherwise generates a UUID.
     * If no files are found after attempting both directory listing and a `rulesIndex.json` fallback,
     * the method completes gracefully without throwing an enumeration error.
     *
     * @param   {string} [baseUrl='./data/system-rules/']
     * @returns {Promise<void>}
     * @throws  {RuleLoaderError} If fetch/parse or validation fails for any discovered file.
     */
    async loadAll(baseUrl = './data/system-rules/') {
        //------------------------------------------------------------------
        // Start - No need to clear internal state like #rulesByEvent anymore
        //------------------------------------------------------------------
        // Consider if #dataRegistry needs clearing: Depends on registry implementation.
        // Assuming registry handles its own state or is cleared elsewhere if needed.
        // Example: // this.#dataRegistry.clear('system-rules');

        if (!baseUrl.endsWith('/')) baseUrl += '/';
        this.#logger.info(`RuleLoader.loadAll: Starting load process from “${baseUrl}”`);

        //------------------------------------------------------------------
        // #1  Enumerate files  .............................................
        //------------------------------------------------------------------
        let filenames = [];
        try {
            // Attempt HTML directory listing
            const indexResp = await this.#dataFetcher.fetch(baseUrl, {method: 'GET'});
            if (indexResp.ok) {
                const type = indexResp.headers.get('content-type') ?? '';
                if (type.includes('text/html')) {
                    const html = await indexResp.text();
                    const hrefRe = /href\s*=\s*"(.*?)"/gi;
                    let m;
                    while ((m = hrefRe.exec(html))) {
                        const f = decodeURIComponent(m[1]).replace(/^\.\//, '');
                        if (f.endsWith('.json')) filenames.push(f);
                    }
                } else if (type.includes('application/json')) {
                    // Handle potential JSON directory listing
                    const listing = await indexResp.json();
                    if (Array.isArray(listing))
                        filenames = listing.filter(f => typeof f === 'string' && f.endsWith('.json'));
                }
            }
            // If HTML directory listing fails or doesn't yield results, filenames might still be empty
        } catch (e) {
            this.#logger.warn(`RuleLoader: Directory scrape attempt failed (${e.message}) – falling back to rulesIndex.json`);
            // Fall through to try rulesIndex.json
        }

        // Attempt rulesIndex.json fallback ONLY if directory listing yielded no files
        if (filenames.length === 0) {
            this.#logger.info(`RuleLoader: Directory listing yielded no JSON files, attempting fallback: rulesIndex.json`);
            try {
                const idx = await this.#dataFetcher.fetch(baseUrl + 'rulesIndex.json');
                if (!idx.ok) {
                    // Log the failure but don't throw here - let the final check handle it
                    this.#logger.warn(`RuleLoader: rulesIndex.json fetch failed (HTTP ${idx.status} ${idx.statusText}). Proceeding with potentially empty file list.`);
                } else {
                    const j = await idx.json();
                    if (Array.isArray(j)) {
                        filenames = j.filter(f => typeof f === 'string' && f.endsWith('.json'));
                        this.#logger.info(`RuleLoader: Loaded ${filenames.length} files from rulesIndex.json.`);
                    } else {
                        this.#logger.warn(`RuleLoader: rulesIndex.json content was not a valid JSON array.`);
                    }
                }
            } catch (e) {
                // ***** FIX: Remove the throw from this catch block ***** (Already Fixed in Provided Code)
                this.#logger.error(`RuleLoader: rulesIndex.json fallback failed (${e.message})`);
                // Let the logic proceed to check if filenames is still empty
                // *******************************************************
            }
        }

        filenames = [...new Set(filenames)]; // Deduplicate filenames

        // Final check after attempting both methods
        if (filenames.length === 0) {
            this.#logger.warn(`RuleLoader: No *.json rule files discovered under ${baseUrl} after attempting directory listing and rulesIndex.json fallback. Load process completing without rules.`);
            // AC12 requires final log, so run that before returning
            this.#logger.info(
                `RuleLoader: Load process finished. ` +
                `Successfully stored 0 rule(s). ` +
                `Skipped/Failed to store 0 rule(s) during registry operation.`
            );
            return; // Gracefully return undefined as per test expectation
        }

        this.#logger.info(`RuleLoader: Discovered ${filenames.length} potential rule file(s) to process.`);

        //------------------------------------------------------------------
        // #2  Parallel fetch ...............................................
        //------------------------------------------------------------------
        const results = await Promise.allSettled(
            filenames.map(fn =>
                this.#dataFetcher.fetch(baseUrl + fn)
                    .then(r => {
                        if (!r.ok) throw new Error(`HTTP ${r.status} ${r.statusText} (${baseUrl + fn})`);
                        return r.json(); // Attempt to parse JSON directly
                    })
                    .catch(err => {
                        // Catch fetch or JSON parse errors here to enrich the reason
                        throw new Error(`Failed fetch or JSON parse for "${fn}": ${err.message}`);
                    })
            )
        );

        //------------------------------------------------------------------
        // #3  Transport/Parse errors ......................................
        //------------------------------------------------------------------
        const fetchFails = results
            .map((r, i) => ({r, fn: filenames[i]}))
            .filter(({r}) => r.status === 'rejected');

        fetchFails.forEach(({fn, r}) =>
            this.#logger.error(`RuleLoader: Fetch/Parse failed for "${fn}" – ${r.reason?.message || r.reason || 'Unknown error'}`)); // Log enriched reason

        // Throw if any file failed fetching/parsing
        if (fetchFails.length)
            throw new RuleLoaderError(`${fetchFails.length}/${filenames.length} rule files failed to download or parse`);

        //------------------------------------------------------------------
        // #4  Schema validation ............................................
        //------------------------------------------------------------------
        const SCHEMA_ID = 'http://example.com/schemas/system-rule.schema.json'; // Ensure this schema is loaded elsewhere
        const validationFails = [];
        const validRules = []; // Keep track of rules that passed validation

        results.forEach((res, idx) => {
            // Only process fulfilled promises (fetch/parse errors already handled)
            if (res.status === 'fulfilled') {
                const json = res.value;
                const vRes = this.#schemaValidator.validate(SCHEMA_ID, json);

                const valid = typeof vRes === 'boolean' ? vRes : vRes?.valid;
                // Handle potential missing errors property on validator result
                const errors = valid ? [] : (typeof vRes === 'boolean' ? this.#schemaValidator.errors : (vRes?.errors || [{ message: 'Unknown validation error' }]));

                if (!valid) {
                    this.#logger.error(`RuleLoader: Schema invalid → "${filenames[idx]}"`, errors);
                    validationFails.push({file: filenames[idx], errors});
                    // Do not add to validRules
                } else {
                    // Store the validated rule along with its original filename for logging during storage
                    validRules.push({file: filenames[idx], rule: json}); // AC4 implicitly happens here (populating validRules)
                }
            }
        });

        // Throw if any file failed validation
        if (validationFails.length)
            throw new RuleLoaderError(`${validationFails.length} rule file(s) failed schema validation`);

        // Log validation success only if there were files to validate
        if (results.length > 0) {
            this.#logger.info(`RuleLoader: Validated ${validRules.length} rule file(s) against schema ${SCHEMA_ID}.`);
        }

        //------------------------------------------------------------------
        // #5  Store validated rules in IDataRegistry ......................
        //------------------------------------------------------------------
        let storedCount = 0;
        let skippedOrFailedStoreCount = 0; // Track failures during storage

        // AC4: The loop iterating through validRules in loadAll is present.
        for (const { file, rule } of validRules) {
            let storageId;
            let usedGeneratedId = false;

            // AC5: Inside the loop, logic correctly retrieves rule.rule_id.
            const ruleIdFromRule = rule?.rule_id;

            // AC8: If rule.rule_id is valid, it is used as the storageId.
            // Define "valid" as a non-empty string for this context.
            if (typeof ruleIdFromRule === 'string' && ruleIdFromRule.trim().length > 0) {
                storageId = ruleIdFromRule.trim();
            } else {
                // AC6: If rule.rule_id is missing, empty, or invalid, uuidv4() is called to generate a storageId.
                storageId = uuidv4();
                usedGeneratedId = true;

                // AC7: If rule_id is missing/invalid, log warning including filename, generated storageId, and recommendation.
                this.#logger.warn(
                    `RuleLoader: Rule from "${file}" is missing a valid 'rule_id'. ` +
                    `Using generated UUID: "${storageId}". ` +
                    `Consider adding a permanent 'rule_id' to the rule file for better traceability.`
                );
            }

            try {
                // AC9: this.#dataRegistry.store('system-rules', storageId, rule) is called for each valid rule processed.
                // Using 'system-rules' as the type key per ticket description.
                this.#dataRegistry.store('system-rules', storageId, rule);

                // AC10: Success... logged appropriately (debug for success)
                this.#logger.debug(`RuleLoader: Successfully stored rule from "${file}" with ID "${storageId}" in data registry.`);
                storedCount++;

            } catch (e) {
                // AC10: ...failure of the store operation is logged appropriately (error for failure).
                this.#logger.error(
                    `RuleLoader: Failed to store rule (ID: "${storageId}") from file "${file}" in dataRegistry.`,
                    e instanceof Error ? e.message : e // Log error message or the caught object itself
                );
                skippedOrFailedStoreCount++;
                // Decide whether to re-throw or continue processing other rules. Currently continues.
            }
        } // End loop AC4

        // AC12: Final logging accurately reflects stored vs. skipped/failed.
        // This log now runs even if no files were found initially (handled by the early return)
        // Only log details about validation/fetch failures if they occurred.
        this.#logger.info(
            `RuleLoader: Load process finished. ` +
            `Successfully stored ${storedCount} rule(s). ` +
            `Skipped/Failed to store ${skippedOrFailedStoreCount} rule(s) during registry operation.` +
            (validationFails.length > 0 ? ` Note: ${validationFails.length} file(s) failed schema validation prior to storage attempts.` : '') +
            (fetchFails.length > 0 ? ` Note: ${fetchFails.length} file(s) failed to fetch/parse.` : '')
        );

        //------------------------------------------------------------------
        // #6  Subscribe once per unique event_type .........................
        // AC11: This section and any calls to subscribeOnce are completely removed.
        //------------------------------------------------------------------
        // (Section physically removed)
    }
}

export default RuleLoader;