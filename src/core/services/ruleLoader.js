// src/core/services/ruleLoader.js

/**
 * @typedef {import('../interfaces/coreServices.js').IPathResolver}      IPathResolver
 * @typedef {import('../interfaces/coreServices.js').IDataFetcher}       IDataFetcher
 * @typedef {import('../interfaces/coreServices.js').ISchemaValidator}   ISchemaValidator
 * @typedef {import('../interfaces/coreServices.js').ILogger}            ILogger
 * @typedef {import('../eventBus.js').default}                           EventBus
 */

/** Domain-specific failure wrapper that callers can trap with
 *   `catch (e) { if (e instanceof RuleLoaderError) … }` */
export class RuleLoaderError extends Error {
    constructor(message, cause) {
        super(message);
        this.name = 'RuleLoaderError';
        if (cause) this.cause = cause;
    }
}

class RuleLoader {
    /** @type {IPathResolver}     */ #pathResolver;
    /** @type {IDataFetcher}      */ #dataFetcher;
    /** @type {ISchemaValidator}  */ #schemaValidator;
    /** @type {EventBus}          */ #eventBus;
    /** @type {ILogger}           */ #logger;
    /** @type {{handle(rule:any, payload:any): (void|Promise<void>)}} */ #interpreter;

    /** @private */
    #rulesByEvent = new Map();

    /**
     * @param {IPathResolver}     pathResolver
     * @param {IDataFetcher}      dataFetcher
     * @param {ISchemaValidator}  schemaValidator
     * @param {EventBus}          eventBus
     * @param {ILogger}           logger
     * @param {object}   [interpreter]  Optional object with `handle(rule, payload)` – useful for tests.
     */
    constructor(
        pathResolver,
        dataFetcher,
        schemaValidator,
        eventBus,
        logger,
        interpreter = {
            handle: () => {
            }
        },
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

        if (
            !eventBus ||
            typeof eventBus.subscribe !== 'function' ||
            typeof eventBus.listenerCount !== 'function'
        )
            throw new Error("RuleLoader: Missing/invalid 'eventBus' (needs subscribe & listenerCount).");

        if (
            !logger ||
            typeof logger.info !== 'function' ||
            typeof logger.warn !== 'function' ||
            typeof logger.error !== 'function'
        )
            throw new Error("RuleLoader: Missing/invalid 'logger' (needs info/warn/error).");

        this.#pathResolver = pathResolver;
        this.#dataFetcher = dataFetcher;
        this.#schemaValidator = schemaValidator;
        this.#eventBus = eventBus;
        this.#logger = logger;
        this.#interpreter = interpreter;

        this.#logger.info('RuleLoader: Instance created.');
    }

    /**  Public: number of distinct `event_type`s currently loaded */
    get loadedEventCount() {
        return this.#rulesByEvent.size;
    }

    // -------------------------------------------------------------------
    // Internal helpers
    // -------------------------------------------------------------------

    /**
     * Subscribe to an EventBus event **once** for the given event-type.
     * Prevents duplicate wiring during hot-reloads by checking `listenerCount()`.
     * @private
     * @param {string} evt
     */
    subscribeOnce(evt) {
        if (this.#eventBus.listenerCount(evt) > 0) return;

        const rules = this.#rulesByEvent.get(evt) ?? [];

        const handler = async (payload) => {
            for (const rule of rules) {
                this.#logger.debug('[RuleLoader] matched', rule.rule_id ?? evt);
                try {
                    await this.#interpreter.handle(rule, payload);
                } catch (e) {
                    this.#logger.error(`RuleLoader: interpreter.handle failed (${rule.rule_id ?? evt})`, e);
                }
            }
        };

        this.#eventBus.subscribe(evt, handler);
        this.#logger.info(`RuleLoader: subscribed to “${evt}” (${rules.length} rule(s))`);
    }

    // -------------------------------------------------------------------
    // Public API
    // -------------------------------------------------------------------

    /**
     * Load and validate every `*.json` rule file beneath `baseUrl`.
     *
     * Workflow: *dir discover* → *parallel fetch* → *schema validation*.
     *
     * A **RuleLoaderError** is thrown when:
     *   • any fetch fails, **or**
     *   • any blob fails JSON-schema validation.
     *
     * @param   {string} [baseUrl='./data/system-rules/']
     * @returns {Promise<void>}
     * @throws  {RuleLoaderError}
     */
    async loadAll(baseUrl = './data/system-rules/') {
        //------------------------------------------------------------------
        // Start from a clean slate to avoid duplicates on hot-reload
        //------------------------------------------------------------------
        this.#rulesByEvent.clear();

        if (!baseUrl.endsWith('/')) baseUrl += '/';
        this.#logger.info(`RuleLoader.loadAll: bootstrap at “${baseUrl}”`);

        //------------------------------------------------------------------
        // #1  Enumerate files  .............................................
        //------------------------------------------------------------------
        let filenames = [];
        try {
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
                    const listing = await indexResp.json();
                    if (Array.isArray(listing))
                        filenames = listing.filter(f => typeof f === 'string' && f.endsWith('.json'));
                }
            }
        } catch (e) {
            this.#logger.warn(`RuleLoader: directory scrape failed (${e.message}) – falling back to rulesIndex.json`);
        }

        if (filenames.length === 0) {
            try {
                const idx = await this.#dataFetcher.fetch(baseUrl + 'rulesIndex.json');
                if (!idx.ok) throw new Error(`HTTP ${idx.status} ${idx.statusText}`);
                const j = await idx.json();
                if (Array.isArray(j))
                    filenames = j.filter(f => typeof f === 'string' && f.endsWith('.json'));
            } catch (e) {
                this.#logger.error(`RuleLoader: rulesIndex.json fallback failed (${e.message})`);
                throw new RuleLoaderError('Unable to enumerate rule files', e);
            }
        }

        filenames = [...new Set(filenames)];
        if (filenames.length === 0)
            throw new RuleLoaderError(`No *.json rule files discovered under ${baseUrl}`);

        this.#logger.info(`RuleLoader: discovered ${filenames.length} file(s).`);

        //------------------------------------------------------------------
        // #2  Parallel fetch ...............................................
        //------------------------------------------------------------------
        const results = await Promise.allSettled(
            filenames.map(fn =>
                this.#dataFetcher.fetch(baseUrl + fn)
                    .then(r => {
                        if (!r.ok) throw new Error(`HTTP ${r.status} ${r.statusText}`);
                        return r.json();
                    })
            )
        );

        //------------------------------------------------------------------
        // #3  Transport errors .............................................
        //------------------------------------------------------------------
        const fetchFails = results
            .map((r, i) => ({r, fn: filenames[i]}))
            .filter(({r}) => r.status === 'rejected');

        fetchFails.forEach(({fn, r}) =>
            this.#logger.error(`RuleLoader: fetch failed for "${fn}" – ${r.reason}`));

        if (fetchFails.length)
            throw new RuleLoaderError(`${fetchFails.length}/${filenames.length} rule files failed to download`);

        //------------------------------------------------------------------
        // #4  Schema validation ............................................
        //------------------------------------------------------------------
        const SCHEMA_ID = 'http://example.com/schemas/system-rule.schema.json';
        const validationFails = [];
        const validRules = [];

        results.forEach((res, idx) => {
            const json = /** @type {any} */ (res).value;     // all fulfilled
            const vRes = this.#schemaValidator.validate(SCHEMA_ID, json);

            // AJV-style: boolean OR {valid, errors}
            const valid = typeof vRes === 'boolean' ? vRes : vRes?.valid;
            const errors = typeof vRes === 'boolean' ? (valid ? [] : this.#schemaValidator.errors) : vRes?.errors;

            if (!valid) {
                this.#logger.error(`RuleLoader: schema invalid → "${filenames[idx]}"`, errors);
                validationFails.push({file: filenames[idx], errors});
                return;
            }
            validRules.push({file: filenames[idx], rule: json});
        });

        if (validationFails.length)
            throw new RuleLoaderError(`${validationFails.length} rule file(s) failed schema validation`);

        //------------------------------------------------------------------
        // #5  Index by event_type ..........................................
        //------------------------------------------------------------------
        validRules.forEach(({rule}) => {
            const evt = rule?.event_type;
            if (typeof evt !== 'string' || !evt.length) {
                this.#logger.warn('RuleLoader: skipping rule lacking event_type', rule?.rule_id);
                return;
            }
            if (!this.#rulesByEvent.has(evt)) this.#rulesByEvent.set(evt, []);
            this.#rulesByEvent.get(evt).push(rule);
        });

        this.#logger.info(
            `RuleLoader: loaded ${validRules.length} rule(s) for ${this.#rulesByEvent.size} event(s).`
        );

        //------------------------------------------------------------------
        // #6  Subscribe once per unique event_type .........................
        //------------------------------------------------------------------
        for (const [evt] of this.#rulesByEvent) this.subscribeOnce(evt);
    }
}

export default RuleLoader;