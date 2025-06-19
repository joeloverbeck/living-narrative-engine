// --- Type‑only JSDoc imports ────────────────────────────────────────────────
/** @typedef {import('../interfaces/coreServices.js').ILogger}               ILogger */
/** @typedef {import('../interfaces/coreServices.js').ISchemaValidator}    ISchemaValidator */
/** @typedef {import('../interfaces/coreServices.js').IDataRegistry}         IDataRegistry */
/** @typedef {import('../interfaces/coreServices.js').IConfiguration}       IConfiguration */
/** @typedef {import('../interfaces/coreServices.js').BaseManifestItemLoaderInterface} BaseManifestItemLoaderInterface */ // Assuming an interface exists for loaders
/** @typedef {import('./actionLoader.js').default} ActionLoader */
/** @typedef {import('./eventLoader.js').default} EventLoader */
/** @typedef {import('./componentLoader.js').default} ComponentLoader */
/** @typedef {import('./conditionLoader.js').default} ConditionLoader */
/** @typedef {import('./ruleLoader.js').default} RuleLoader */
/** @typedef {import('./macroLoader.js').default} MacroLoader */
/** @typedef {import('./schemaLoader.js').default} SchemaLoader */
/** @typedef {import('./gameConfigLoader.js').default} GameConfigLoader */
/** @typedef {import('../modding/modManifestLoader.js').default} ModManifestLoader */
/** @typedef {import('./entityDefinitionLoader.js').default} EntityLoader */
/** @typedef {import('./entityInstanceLoader.js').default} EntityInstanceLoader */
/** @typedef {import('./promptTextLoader.js').default} PromptTextLoader */
/** @typedef {import('../../data/schemas/mod.manifest.schema.json').ModManifest} ModManifest */
/** @typedef {import('../events/validatedEventDispatcher.js').default} ValidatedEventDispatcher */

// --- Implementation Imports -------------------------------------------------
import ModDependencyError from '../errors/modDependencyError.js';
import WorldLoaderError from '../errors/worldLoaderError.js';
import MissingSchemaError from '../errors/missingSchemaError.js';
import AbstractLoader from './abstractLoader.js';
import ModManifestProcessor from './ModManifestProcessor.js';
import ContentLoadManager from './ContentLoadManager.js';
import WorldLoadSummaryLogger from './WorldLoadSummaryLogger.js';
import createDefaultContentLoadersConfig, {
  createContentLoadersConfig,
} from './defaultLoaderConfig.js';
import ESSENTIAL_SCHEMA_TYPES from '../constants/essentialSchemas.js';

// --- Type Definitions for Loader Results ---
/**
 * Expected return structure from BaseManifestItemLoader.loadItemsForMod.
 * (Assumed to be implemented per AC#8 stretch goal).
 *
 * @typedef {object} LoadItemsResult
 * @property {number} count - Number of items successfully loaded.
 * @property {number} overrides - Number of items that overwrote existing ones.
 * @property {number} errors - Number of individual file processing errors encountered.
 */

/**
 * Structure to hold aggregated results per content type.
 *
 * @typedef {object} ContentTypeCounts
 * @property {number} count - Number of items successfully loaded.
 * @property {number} overrides - Number of items that replaced existing items.
 * @property {number} errors - Number of errors encountered during loading.
 */

/**
 * Structure to hold aggregated results for a single mod.
 * Maps typeName to ContentTypeCounts.
 *
 * @typedef {Record<string, ContentTypeCounts>} ModResultsSummary
 */

/**
 * Structure to hold aggregated results across all mods.
 * Maps typeName to ContentTypeCounts.
 *
 * @typedef {Record<string, ContentTypeCounts>} TotalResultsSummary
 */

// ── Class ────────────────────────────────────────────────────────────────────
class WorldLoader extends AbstractLoader {
  // Private fields
  /** @type {IDataRegistry}  */ #registry;
  /** @type {ILogger}        */ #logger;
  /** @type {ISchemaValidator}*/ #validator;
  /** @type {IConfiguration} */ #configuration;
  /** @type {SchemaLoader}   */ #schemaLoader;
  /** @type {ComponentLoader}*/ #componentDefinitionLoader;
  /** @type {ConditionLoader}*/ #conditionLoader;
  /** @type {RuleLoader}     */ #ruleLoader;
  /** @type {MacroLoader}    */ #macroLoader;
  /** @type {ActionLoader}   */ #actionLoader;
  /** @type {EventLoader}    */ #eventLoader;
  /** @type {EntityLoader}   */ #entityDefinitionLoader;
  /** @type {EntityInstanceLoader} */ #entityInstanceLoader;
  /** @type {GameConfigLoader}*/ #gameConfigLoader;
  /** @type {PromptTextLoader}*/ #promptTextLoader;
  /** @type {ModManifestLoader}*/ #modManifestLoader;
  /** @type {ValidatedEventDispatcher} */ #validatedEventDispatcher;
  /** @type {ModManifestProcessor} */ #modManifestProcessor;
  /** @type {ContentLoadManager} */ #contentLoadManager;
  /** @type {WorldLoadSummaryLogger} */ #summaryLogger;
  /** @type {string[]}       */ #finalOrder = [];

  /**
   * Configuration mapping content types to their loaders and parameters.
   *
   * @private
   * @type {Array<{loader: BaseManifestItemLoaderInterface, contentKey: string, contentTypeDir: string, typeName: string}>}
   */
  #contentLoadersConfig = [];

  // ── Constructor ────────────────────────────────────────────────────────
  /**
   * Creates an instance of WorldLoader.
   *
   * @param {object} dependencies - The required service dependencies.
   * @param {IDataRegistry} dependencies.registry - The data registry.
   * @param {ILogger} dependencies.logger - The logging service.
   * @param {SchemaLoader} dependencies.schemaLoader - Loader for JSON schemas.
   * @param {ComponentLoader} dependencies.componentLoader - Loader for component definitions.
   * @param {ConditionLoader} dependencies.conditionLoader - Loader for condition definitions.
   * @param {RuleLoader} dependencies.ruleLoader - Loader for system rules.
   * @param {MacroLoader} [dependencies.macroLoader] - Loader for macro definitions.
   * @param {ActionLoader} dependencies.actionLoader - Loader for action definitions.
   * @param {EventLoader} dependencies.eventLoader - Loader for event definitions.
   * @param {EntityLoader} dependencies.entityLoader - Loader for entity definitions.
   * @param {EntityInstanceLoader} dependencies.entityInstanceLoader - Loader for entity instances.
   * @param {ISchemaValidator} dependencies.validator - Service for schema validation.
   * @param {IConfiguration} dependencies.configuration - Service for configuration access.
   * @param {GameConfigLoader} dependencies.gameConfigLoader - Loader for game configuration.
   * @param {PromptTextLoader} dependencies.promptTextLoader - Loader for core prompt text.
   * @param {ModManifestLoader} dependencies.modManifestLoader - Loader for mod manifests.
   * @param {ValidatedEventDispatcher} dependencies.validatedEventDispatcher - Service for dispatching validated events.
   * @param {typeof import('../modding/modDependencyValidator.js')} dependencies.modDependencyValidator - Helper for validating dependencies.
   * @param {typeof import('../modding/modVersionValidator.js').default} dependencies.modVersionValidator - Helper for validating engine versions.
   * @param {import('../modding/modLoadOrderResolver.js')} dependencies.modLoadOrderResolver - Helper for resolving load order.
   * @param {Array<{loader: BaseManifestItemLoaderInterface, contentKey: string, contentTypeDir: string, typeName: string}>|Record<string, BaseManifestItemLoaderInterface>} [dependencies.contentLoadersConfig] - Optional custom content loader configuration or map.
   * @throws {Error} If any required dependency is missing or invalid.
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
      /**
       * Fallback implementation when no EntityInstanceLoader is supplied.
       *
       * @returns {Promise<{count:number, overrides:number, errors:number}>}
       * A resolved result indicating nothing was loaded.
       */
      async loadItemsForMod() {
        return { count: 0, overrides: 0, errors: 0 };
      },
    },
    validator,
    configuration,
    gameConfigLoader,
    promptTextLoader,
    modManifestLoader,
    validatedEventDispatcher,
    modDependencyValidator,
    modVersionValidator,
    modLoadOrderResolver,
    contentLoadersConfig = null,
  }) {
    super(logger, [
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
    ]);

    this.#logger = this._logger;

    // --- Store dependencies ---
    this.#registry = registry;
    this.#schemaLoader = schemaLoader;
    this.#componentDefinitionLoader = componentLoader;
    this.#conditionLoader = conditionLoader;
    this.#ruleLoader = ruleLoader;
    this.#macroLoader = macroLoader || {
      loadItemsForMod: async () => ({ count: 0, overrides: 0, errors: 0 }),
    };
    this.#actionLoader = actionLoader;
    this.#eventLoader = eventLoader;
    this.#entityDefinitionLoader = entityLoader;
    this.#entityInstanceLoader = entityInstanceLoader;
    this.#validator = validator;
    this.#configuration = configuration;
    this.#gameConfigLoader = gameConfigLoader;
    this.#promptTextLoader = promptTextLoader;
    this.#modManifestLoader = modManifestLoader;
    this.#validatedEventDispatcher = validatedEventDispatcher;

    // --- Initialize content loaders configuration ---
    this.#contentLoadersConfig =
      (Array.isArray(contentLoadersConfig)
        ? contentLoadersConfig
        : contentLoadersConfig && typeof contentLoadersConfig === 'object'
          ? createContentLoadersConfig(contentLoadersConfig)
          : null) ??
      createDefaultContentLoadersConfig({
        componentDefinitionLoader: this.#componentDefinitionLoader,
        eventLoader: this.#eventLoader,
        conditionLoader: this.#conditionLoader,
        macroLoader: this.#macroLoader,
        actionLoader: this.#actionLoader,
        ruleLoader: this.#ruleLoader,
        entityDefinitionLoader: this.#entityDefinitionLoader,
        entityInstanceLoader: this.#entityInstanceLoader,
      });

    this.#modManifestProcessor = new ModManifestProcessor({
      modManifestLoader: this.#modManifestLoader,
      logger: this.#logger,
      registry: this.#registry,
      validatedEventDispatcher: this.#validatedEventDispatcher,
      modDependencyValidator,
      modVersionValidator,
      modLoadOrderResolver,
    });

    this.#contentLoadManager = new ContentLoadManager({
      logger: this.#logger,
      validatedEventDispatcher: this.#validatedEventDispatcher,
      contentLoadersConfig: this.#contentLoadersConfig,
    });

    this.#summaryLogger = new WorldLoadSummaryLogger();

    this.#logger.debug(
      'WorldLoader: Instance created with ALL loaders, order‑resolver, and ValidatedEventDispatcher.'
    );
  }

  // ── Private Helper Methods ─────────────────────────────────────────────

  /**
   * Clears all entries from the data registry.
   *
   * @private
   * @returns {void}
   */
  #clearRegistry() {
    this.#registry.clear();
    this.#logger.debug('WorldLoader: Data registry cleared.');
  }

  /**
   * Loads and compiles all core JSON schemas required by the engine.
   *
   * @private
   * @returns {Promise<void>} Resolves when schemas are loaded.
   */
  async #loadSchemas() {
    await this.#schemaLoader.loadAndCompileAllSchemas();
    this.#logger.debug('WorldLoader: Schema loading phase completed.');
  }

  /**
   * Ensures that all essential schemas are configured and loaded.
   *
   * @private
   * @throws {MissingSchemaError} If a required schema is missing.
   */
  #checkEssentialSchemas() {
    const essentials = ESSENTIAL_SCHEMA_TYPES.map((type) =>
      this.#configuration.getContentTypeSchemaId(type)
    );
    this.#logger.debug(
      `WorldLoader: Checking for essential schemas: [${essentials.filter((id) => !!id).join(', ')}]`
    );
    for (const id of essentials) {
      if (!id || !this.#validator.isSchemaLoaded(id)) {
        const missing = id ?? 'Unknown Essential Schema ID';
        this.#logger.error(
          `WorldLoader: Essential schema missing or not configured: ${missing}`
        );
        throw new MissingSchemaError(missing);
      }
    }
    this.#logger.debug('WorldLoader: All essential schemas found.');
  }

  /**
   * Wrapper exposing the essential schema check for testing.
   *
   * @returns {void}
   */
  checkEssentialSchemas() {
    return this.#checkEssentialSchemas();
  }

  /**
   * Loads core prompt text used by the engine UI.
   *
   * @private
   * @param {TotalResultsSummary} totalCounts Aggregated result counters.
   * @returns {Promise<void>} Resolves when prompt text is loaded.
   */
  async #loadPromptText(totalCounts) {
    try {
      await this.#promptTextLoader.loadPromptText();
      this.#logger.debug('WorldLoader: Prompt text loaded successfully.');
    } catch (e) {
      if (!totalCounts['prompt_text']) {
        totalCounts['prompt_text'] = { count: 0, overrides: 0, errors: 0 };
      }
      totalCounts['prompt_text'].errors += 1;
      this.#logger.error(
        `WorldLoader: Failed to load prompt text: ${e.message}`,
        e
      );
    }
  }

  /**
   * Loads game configuration and returns the requested mod IDs.
   *
   * @private
   * @returns {Promise<string[]>} List of requested mod identifiers.
   */
  async #loadGameConfig() {
    const modIds = await this.#gameConfigLoader.loadConfig();
    this.#logger.debug(
      `WorldLoader: Game config loaded. Requested mods: [${modIds.join(', ')}]`
    );
    return modIds;
  }

  // ── Public API ──────────────────────────────────────────────────────────

  /**
   * Registers an additional content loader.
   *
   * @param {object} params - Loader configuration.
   * @param {BaseManifestItemLoaderInterface} params.loader - Loader instance.
   * @param {string} params.typeName - Name used for logging and summary counts.
   * @returns {void}
   */
  registerContentLoader({ loader, typeName }) {
    const [entry] = createContentLoadersConfig({ [typeName]: loader });
    if (entry) {
      this.#contentLoadersConfig.push(entry);
    }
  }

  /**
   * High‑level orchestration of the entire data‑load pipeline.
   * Orchestrates schema loading, game dependencyInjection loading, manifest processing,
   * dependency validation, load order resolution, and sequential, per-mod content loading.
   *
   * @param {string} worldName - A hint or identifier for the world being loaded (used for logging/events).
   * @returns {Promise<void>} A promise that resolves when loading completes successfully or rejects on critical failure.
   * @throws {Error | ModDependencyError} Re-throws critical errors encountered during the loading sequence.
   */
  async loadWorld(worldName) {
    this.#logger.debug(
      `WorldLoader: Starting load sequence (World Hint: '${worldName}') ...`
    );

    let requestedModIds = [];
    let incompatibilityCount = 0;
    let loadedManifestsMap = new Map();
    /** @type {TotalResultsSummary} */
    const totalCounts = {}; // Object to store total counts per content type across all mods

    try {
      this.#clearRegistry();
      await this.#loadSchemas();

      this.#checkEssentialSchemas();

      await this.#loadPromptText(totalCounts);

      requestedModIds = await this.#loadGameConfig();

      const manifestData =
        await this.#modManifestProcessor.processManifests(requestedModIds);
      loadedManifestsMap = manifestData.loadedManifestsMap;
      this.#finalOrder = manifestData.finalOrder;
      incompatibilityCount = manifestData.incompatibilityCount;

      await this.#contentLoadManager.loadContent(
        this.#finalOrder,
        loadedManifestsMap,
        totalCounts
      );

      this.#summaryLogger.logSummary(
        this.#logger,
        worldName,
        requestedModIds,
        this.#finalOrder,
        incompatibilityCount,
        totalCounts
      );
    } catch (err) {
      // --- REVISED CATCH BLOCK ---
      this.#logger.error(
        'WorldLoader: CRITICAL load failure during world/mod loading sequence.',
        { error: err }
      );
      this.#registry.clear(); // Ensure registry is cleared on failure

      // Explicitly check the type of error before deciding how to re-throw
      if (err instanceof ModDependencyError) {
        this.#logger.debug(
          'Caught ModDependencyError, re-throwing original error.'
        );
        throw err; // Re-throw the specific dependency/version error
      } else if (err instanceof MissingSchemaError) {
        const finalMessage = `WorldLoader failed: Essential schema '${err.schemaId || 'unknown'}' missing or check failed – aborting world load. Original error: ${err.message}`;
        this.#logger.error(finalMessage, err); // Log the combined info
        throw new WorldLoaderError(finalMessage, err); // Throw a new error, preserving the original cause
      } else {
        // Re-throw any other unexpected error encountered during the try block
        this.#logger.debug(
          'Caught an unexpected error type, re-throwing original error.'
        );
        throw new WorldLoaderError(
          `WorldLoader unexpected error: ${err.message}`,
          err
        );
      }
      // --- END REVISED CATCH BLOCK ---
    }
  }
}

export default WorldLoader;
