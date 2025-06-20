/**
 * @file World-famous ModsLoader — orchestrates loading of all mods and their
 *       content, validates dependencies, and aggregates results.
 */

/* ── Type-only imports ──────────────────────────────────────────────────── */
/** @typedef {import('../interfaces/coreServices.js').ILogger}                 ILogger */
/** @typedef {import('../interfaces/coreServices.js').ISchemaValidator}        ISchemaValidator */
/** @typedef {import('../interfaces/coreServices.js').IDataRegistry}           IDataRegistry */
/** @typedef {import('../interfaces/coreServices.js').IConfiguration}          IConfiguration */
/** @typedef {import('../interfaces/coreServices.js').BaseManifestItemLoaderInterface} BaseManifestItemLoaderInterface */
/** @typedef {import('./actionLoader.js').default}                             ActionLoader */
/** @typedef {import('./eventLoader.js').default}                              EventLoader */
/** @typedef {import('./componentLoader.js').default}                          ComponentLoader */
/** @typedef {import('./conditionLoader.js').default}                          ConditionLoader */
/** @typedef {import('./ruleLoader.js').default}                               RuleLoader */
/** @typedef {import('./macroLoader.js').default}                              MacroLoader */
/** @typedef {import('./schemaLoader.js').default}                             SchemaLoader */
/** @typedef {import('./gameConfigLoader.js').default}                         GameConfigLoader */
/** @typedef {import('../modding/modManifestLoader.js').default}               ModManifestLoader */
/** @typedef {import('./entityDefinitionLoader.js').default}                   EntityLoader */
/** @typedef {import('./entityInstanceLoader.js').default}                     EntityInstanceLoader */
/** @typedef {import('./promptTextLoader.js').default}                         PromptTextLoader */
/** @typedef {import('../../data/schemas/mod.manifest.schema.json').ModManifest} ModManifest */
/** @typedef {import('../events/validatedEventDispatcher.js').default}         ValidatedEventDispatcher */
/** @typedef {import('./worldLoader.js').default}                              WorldLoader */
/** @typedef {import('./goalLoader.js').default}                               GoalLoader */

/* ── Implementation imports ─────────────────────────────────────────────── */
import ModDependencyError from '../errors/modDependencyError.js';
import ModsLoaderError from '../errors/modsLoaderError.js';
import MissingSchemaError from '../errors/missingSchemaError.js';
import AbstractLoader from './abstractLoader.js';
import ModManifestProcessor from './ModManifestProcessor.js';
import ContentLoadManager from './ContentLoadManager.js';
import WorldLoadSummaryLogger from './WorldLoadSummaryLogger.js';
import createDefaultContentLoadersConfig, {
  createContentLoadersConfig,
} from './defaultLoaderConfig.js';
import ESSENTIAL_SCHEMA_TYPES from '../constants/essentialSchemas.js';
import WorldLoader from './worldLoader.js';
import GoalLoader from './goalLoader.js';

/* ── Result-shape typedefs ─────────────────────────────────────────────── */
/**
 * @typedef {object} LoadItemsResult
 * @property {number} count
 * @property {number} overrides
 * @property {number} errors
 */

/**
 * @typedef {object} ContentTypeCounts
 * @property {number} count
 * @property {number} overrides
 * @property {number} errors
 */

/** @typedef {Record<string, ContentTypeCounts>} ModResultsSummary */
/** @typedef {Record<string, ContentTypeCounts>} TotalResultsSummary */

/* ───────────────────────────────────────────────────────────────────────── */

class ModsLoader extends AbstractLoader {
  /* internal (“pseudo-private”) fields — prefixed with “_” to avoid # transform */
  /** @type {ILogger}                 */ _logger;
  /** @type {IDataRegistry}           */ _registry;
  /** @type {ISchemaValidator}        */ _validator;
  /** @type {IConfiguration}          */ _configuration;

  /** @type {SchemaLoader}            */ _schemaLoader;
  /** @type {ComponentLoader}         */ _componentDefinitionLoader;
  /** @type {ConditionLoader}         */ _conditionLoader;
  /** @type {RuleLoader}              */ _ruleLoader;
  /** @type {MacroLoader}             */ _macroLoader;
  /** @type {ActionLoader}            */ _actionLoader;
  /** @type {EventLoader}             */ _eventLoader;
  /** @type {EntityLoader}            */ _entityDefinitionLoader;
  /** @type {EntityInstanceLoader}    */ _entityInstanceLoader;
  /** @type {GameConfigLoader}        */ _gameConfigLoader;
  /** @type {PromptTextLoader}        */ _promptTextLoader;
  /** @type {ModManifestLoader}       */ _modManifestLoader;
  /** @type {ValidatedEventDispatcher}*/ _validatedEventDispatcher;
  /** @type {ModManifestProcessor}    */ _modManifestProcessor;
  /** @type {ContentLoadManager}      */ _contentLoadManager;
  /** @type {WorldLoadSummaryLogger}  */ _summaryLogger;
  /** @type {WorldLoader}             */ _worldLoader;
  /** @type {GoalLoader}              */ _goalLoader;
  /** @type {string[]}                */ _finalOrder = [];

  /**
   * @private
   * @type {Array<{ loader: BaseManifestItemLoaderInterface,
   *                contentKey: string, contentTypeDir: string, typeName: string }>}
   */
  _contentLoadersConfig = [];

  /* ── constructor ────────────────────────────────────────────────────── */
  /**
   * @param {object} dependencies – see extensive JSDoc list above.
   */
  constructor({
    registry,
    logger,
    schemaLoader,
    componentLoader,
    conditionLoader,
    ruleLoader,
    macroLoader,
    actionLoader,
    eventLoader,
    entityLoader,
    entityInstanceLoader = {
      async loadItemsForMod() {
        return { count: 0, overrides: 0, errors: 0 };
      },
    },
    goalLoader,
    validator,
    configuration,
    gameConfigLoader,
    promptTextLoader,
    modManifestLoader,
    validatedEventDispatcher,
    modDependencyValidator,
    modVersionValidator,
    modLoadOrderResolver,
    worldLoader,
    contentLoadersConfig = null,
  }) {
    /* ── FLEXIBLE DEP-VALIDATION FOR TWO TRICKY DEPENDENCIES ──────────── */

    /* 1️⃣  ModVersionValidator: function OR object with .validate */
    const isModVersionValidatorFn = typeof modVersionValidator === 'function';

    /* 2️⃣  ModLoadOrderResolver: function OR object with .resolve OR .resolveOrder */
    const isModLoadOrderResolverFn = typeof modLoadOrderResolver === 'function';
    const hasResolve =
      !isModLoadOrderResolverFn &&
      modLoadOrderResolver &&
      typeof modLoadOrderResolver.resolve === 'function';
    const hasResolveOrder =
      !isModLoadOrderResolverFn &&
      modLoadOrderResolver &&
      typeof modLoadOrderResolver.resolveOrder === 'function';

    const depsToValidate = [
      {
        dependency: registry,
        name: 'IDataRegistry',
        methods: ['store', 'get', 'clear'],
      },
      {
        dependency: schemaLoader,
        name: 'SchemaLoader',
        methods: ['loadAndCompileAllSchemas'],
      },
      {
        dependency: componentLoader,
        name: 'ComponentLoader',
        methods: ['loadItemsForMod'],
      },
      {
        dependency: conditionLoader,
        name: 'ConditionLoader',
        methods: ['loadItemsForMod'],
      },
      {
        dependency: ruleLoader,
        name: 'RuleLoader',
        methods: ['loadItemsForMod'],
      },
      {
        dependency: actionLoader,
        name: 'ActionLoader',
        methods: ['loadItemsForMod'],
      },
      {
        dependency: eventLoader,
        name: 'EventLoader',
        methods: ['loadItemsForMod'],
      },
      {
        dependency: entityLoader,
        name: 'EntityLoader',
        methods: ['loadItemsForMod'],
      },
      {
        dependency: entityInstanceLoader,
        name: 'EntityInstanceLoader',
        methods: ['loadItemsForMod'],
      },
      {
        dependency: validator,
        name: 'ISchemaValidator',
        methods: ['isSchemaLoaded'],
      },
      {
        dependency: configuration,
        name: 'IConfiguration',
        methods: ['getContentTypeSchemaId'],
      },
      {
        dependency: gameConfigLoader,
        name: 'GameConfigLoader',
        methods: ['loadConfig'],
      },
      {
        dependency: promptTextLoader,
        name: 'PromptTextLoader',
        methods: ['loadPromptText'],
      },
      {
        dependency: modManifestLoader,
        name: 'ModManifestLoader',
        methods: ['loadRequestedManifests'],
      },
      {
        dependency: validatedEventDispatcher,
        name: 'ValidatedEventDispatcher',
        methods: ['dispatch'],
      },
      {
        dependency: modDependencyValidator,
        name: 'ModDependencyValidator',
        methods: ['validate'],
      },

      /* ✅ ModVersionValidator spec */
      {
        dependency: modVersionValidator,
        name: 'ModVersionValidator',
        methods: isModVersionValidatorFn ? [] : ['validate'],
        isFunction: isModVersionValidatorFn,
      },

      /* ✅ ModLoadOrderResolver spec — accept several shapes */
      isModLoadOrderResolverFn
        ? {
            dependency: modLoadOrderResolver,
            name: 'ModLoadOrderResolver',
            methods: [],
            isFunction: true,
          }
        : hasResolve
          ? {
              dependency: modLoadOrderResolver,
              name: 'ModLoadOrderResolver',
              methods: ['resolve'],
            }
          : {
              dependency: modLoadOrderResolver,
              name: 'ModLoadOrderResolver',
              methods: ['resolveOrder'], // fall-back (tests often provide this name)
            },

      { dependency: worldLoader, name: 'WorldLoader', methods: ['loadWorlds'] },
    ];

    /* Delegate validation to AbstractLoader */
    super(logger, depsToValidate);

    /* ── store references ─────────────────────────────────────────────── */
    this._logger = logger;
    this._registry = registry;
    this._schemaLoader = schemaLoader;
    this._componentDefinitionLoader = componentLoader;
    this._conditionLoader = conditionLoader;
    this._ruleLoader = ruleLoader;
    this._macroLoader =
      macroLoader ||
      /** @type {MacroLoader} */ ({
        loadItemsForMod: async () => ({ count: 0, overrides: 0, errors: 0 }),
      });
    this._actionLoader = actionLoader;
    this._eventLoader = eventLoader;
    this._entityDefinitionLoader = entityLoader;
    this._entityInstanceLoader = entityInstanceLoader;
    this._goalLoader = goalLoader;
    this._validator = validator;
    this._configuration = configuration;
    this._gameConfigLoader = gameConfigLoader;
    this._promptTextLoader = promptTextLoader;
    this._modManifestLoader = modManifestLoader;
    this._validatedEventDispatcher = validatedEventDispatcher;
    this._worldLoader = worldLoader;

    /* ── build content-loader config ──────────────────────────────────── */
    this._contentLoadersConfig =
      (Array.isArray(contentLoadersConfig)
        ? contentLoadersConfig
        : contentLoadersConfig && typeof contentLoadersConfig === 'object'
          ? createContentLoadersConfig(contentLoadersConfig)
          : null) ??
      createDefaultContentLoadersConfig({
        componentDefinitionLoader: this._componentDefinitionLoader,
        eventLoader: this._eventLoader,
        conditionLoader: this._conditionLoader,
        macroLoader: this._macroLoader,
        actionLoader: this._actionLoader,
        ruleLoader: this._ruleLoader,
        goalLoader: this._goalLoader,
        entityDefinitionLoader: this._entityDefinitionLoader,
        entityInstanceLoader: this._entityInstanceLoader,
      });

    this._modManifestProcessor = new ModManifestProcessor({
      modManifestLoader,
      logger: this._logger,
      registry: this._registry,
      validatedEventDispatcher,
      modDependencyValidator,
      modVersionValidator,
      modLoadOrderResolver,
    });

    this._contentLoadManager = new ContentLoadManager({
      logger: this._logger,
      validatedEventDispatcher,
      contentLoadersConfig: this._contentLoadersConfig,
    });

    this._summaryLogger = new WorldLoadSummaryLogger();

    this._logger.debug(
      'ModsLoader: Instance created with ALL loaders and WorldLoader.'
    );
  }

  /* ── helper methods (unchanged) ─────────────────────────────────────── */
  _clearRegistry() {
    this._registry.clear();
    this._logger.debug('ModsLoader: Data registry cleared.');
  }

  async _loadSchemas() {
    await this._schemaLoader.loadAndCompileAllSchemas();
    this._logger.debug('ModsLoader: Schema loading phase completed.');
  }

  _checkEssentialSchemas() {
    this._logger.debug(
      `ModsLoader: Checking ${ESSENTIAL_SCHEMA_TYPES.length} essential schemas…`
    );
    for (const type of ESSENTIAL_SCHEMA_TYPES) {
      const schemaId = this._configuration.getContentTypeSchemaId(type);
      if (!schemaId) {
        const msg = `Essential schema type '${type}' is not configured (no schema ID found).`;
        this._logger.error(`ModsLoader: ${msg}`);
        throw new MissingSchemaError(msg, null, type);
      }
      if (!this._validator.isSchemaLoaded(schemaId)) {
        const msg = `Essential schema '${schemaId}' (type: '${type}') is configured but not loaded.`;
        this._logger.error(`ModsLoader: ${msg}`);
        throw new MissingSchemaError(msg, schemaId, type);
      }
      this._logger.debug(
        `ModsLoader: Schema '${schemaId}' for type '${type}' is loaded.`
      );
    }
  }

  async _loadPromptText(totalCounts) {
    try {
      await this._promptTextLoader.loadPromptText();
      this._logger.debug('ModsLoader: Prompt text loaded successfully.');
    } catch (e) {
      totalCounts['prompt_text'] ??= { count: 0, overrides: 0, errors: 0 };
      totalCounts['prompt_text'].errors++;
      this._logger.error(
        `ModsLoader: Failed to load prompt text: ${e.message}`,
        e
      );
    }
  }

  async _loadGameConfig() {
    const mods = await this._gameConfigLoader.loadConfig();
    this._logger.debug(
      `ModsLoader: Game config requested mods: [${mods.join(', ')}]`
    );
    return mods;
  }

  /**
   * Dynamically register another content loader (mostly used in tests/plugins).
   * @param {{ loader: BaseManifestItemLoaderInterface, typeName: string }} param0
   */
  registerContentLoader({ loader, typeName }) {
    const [entry] = createContentLoadersConfig({ [typeName]: loader });
    if (entry) this._contentLoadersConfig.push(entry);
  }

  /* ── public API ─────────────────────────────────────────────────────── */
  /**
   * Load everything for a world.
   * @param {string} worldName
   */
  async loadWorld(worldName) {
    this._logger.debug(
      `ModsLoader: Starting load sequence (World: '${worldName}')`
    );

    const totalCounts = /** @type {TotalResultsSummary} */ ({});
    let requestedModIds = [];
    let incompatibilityCount = 0;
    let loadedManifestsMap = new Map();

    try {
      this._clearRegistry();
      await this._loadSchemas();
      this._checkEssentialSchemas();
      await this._loadPromptText(totalCounts);

      requestedModIds = await this._loadGameConfig();

      const manifestData =
        await this._modManifestProcessor.processManifests(requestedModIds);
      loadedManifestsMap = manifestData.loadedManifestsMap;
      this._finalOrder = manifestData.finalOrder;
      incompatibilityCount = manifestData.incompatibilityCount;

      await this._contentLoadManager.loadContent(
        this._finalOrder,
        loadedManifestsMap,
        totalCounts
      );

      await this._worldLoader.loadWorlds(
        this._finalOrder,
        loadedManifestsMap,
        totalCounts
      );

      this._summaryLogger.logSummary(
        this._logger,
        worldName,
        requestedModIds,
        this._finalOrder,
        incompatibilityCount,
        totalCounts
      );
    } catch (err) {
      this._logger.error(
        'ModsLoader: CRITICAL load failure during world/mod loading sequence.',
        { error: err }
      );
      this._registry.clear();

      if (err instanceof ModDependencyError || err.name === 'ModDependencyError') {
        throw err;
      } else if (err instanceof MissingSchemaError || err.name === 'MissingSchemaError') {
        const msg =
          `ModsLoader failed during essential schema check – aborting world load. ` +
          `Original error: ${err.message}`;
        this._logger.error(msg, err);
        throw new ModsLoaderError(msg, err);
      } else {
        this._logger.debug(
          'ModsLoader: Unexpected error, wrapping and re-throwing.'
        );
        throw new ModsLoaderError(
          `ModsLoader unexpected error: ${err.message}`,
          err
        );
      }
    }
  }
}

export default ModsLoader;
