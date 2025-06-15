// Filename: src/loaders/worldLoader.js

// --- Type‑only JSDoc imports ────────────────────────────────────────────────
/** @typedef {import('../interfaces/coreServices.js').ILogger}             ILogger */
/** @typedef {import('../interfaces/coreServices.js').ISchemaValidator}    ISchemaValidator */
/** @typedef {import('../interfaces/coreServices.js').IDataRegistry}       IDataRegistry */
/** @typedef {import('../interfaces/coreServices.js').IConfiguration}      IConfiguration */
/** @typedef {import('../interfaces/coreServices.js').BaseManifestItemLoaderInterface} BaseManifestItemLoaderInterface */ // Assuming an interface exists for loaders
/** @typedef {import('./actionLoader.js').default} ActionLoader */
/** @typedef {import('./eventLoader.js').default} EventLoader */
/** @typedef {import('./componentLoader.js').default} ComponentLoader */
/** @typedef {import('./ruleLoader.js').default} RuleLoader */
/** @typedef {import('./schemaLoader.js').default} SchemaLoader */
/** @typedef {import('./gameConfigLoader.js').default} GameConfigLoader */
/** @typedef {import('../modding/modManifestLoader.js').default} ModManifestLoader */
/** @typedef {import('./entityLoader.js').default} EntityLoader */
/** @typedef {import('../../data/schemas/mod.manifest.schema.json').ModManifest} ModManifest */
/** @typedef {import('../events/validatedEventDispatcher.js').default} ValidatedEventDispatcher */

// --- Implementation Imports -------------------------------------------------
import ModDependencyValidator from '../modding/modDependencyValidator.js';
import validateModEngineVersions from '../modding/modVersionValidator.js';
import ModDependencyError from '../errors/modDependencyError.js';
import WorldLoaderError from '../errors/worldLoaderError.js';
// import {ENGINE_VERSION} from '../engineVersion.js'; // Not directly used in this logic, commented out
import { resolveOrder } from '../modding/modLoadOrderResolver.js';
import AbstractLoader from './abstractLoader.js';

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
 * @property {number} count
 * @property {number} overrides
 * @property {number} errors
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
  /** @type {RuleLoader}     */ #ruleLoader;
  /** @type {ActionLoader}   */ #actionLoader;
  /** @type {EventLoader}    */ #eventLoader;
  /** @type {EntityLoader}   */ #entityDefinitionLoader;
  /** @type {GameConfigLoader}*/ #gameConfigLoader;
  /** @type {ModManifestLoader}*/ #modManifestLoader;
  /** @type {ValidatedEventDispatcher} */ #validatedEventDispatcher;
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
   * @param {RuleLoader} dependencies.ruleLoader - Loader for system rules.
   * @param {ActionLoader} dependencies.actionLoader - Loader for action definitions.
   * @param {EventLoader} dependencies.eventLoader - Loader for event definitions.
   * @param {EntityLoader} dependencies.entityLoader - Loader for entity definitions.
   * @param {ISchemaValidator} dependencies.validator - Service for schema validation.
   * @param {IConfiguration} dependencies.configuration - Service for configuration access.
   * @param {GameConfigLoader} dependencies.gameConfigLoader - Loader for game configuration.
   * @param {ModManifestLoader} dependencies.modManifestLoader - Loader for mod manifests.
   * @param {ValidatedEventDispatcher} dependencies.validatedEventDispatcher - Service for dispatching validated events.
   * @throws {Error} If any required dependency is missing or invalid.
   */
  constructor({
    registry,
    logger,
    schemaLoader,
    componentLoader,
    ruleLoader,
    actionLoader,
    eventLoader,
    entityLoader,
    validator,
    configuration,
    gameConfigLoader,
    modManifestLoader,
    validatedEventDispatcher,
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
    this.#ruleLoader = ruleLoader;
    this.#actionLoader = actionLoader;
    this.#eventLoader = eventLoader;
    this.#entityDefinitionLoader = entityLoader;
    this.#validator = validator;
    this.#configuration = configuration;
    this.#gameConfigLoader = gameConfigLoader;
    this.#modManifestLoader = modManifestLoader;
    this.#validatedEventDispatcher = validatedEventDispatcher;

    // --- Initialize content loaders dependencyInjection ---
    this.#contentLoadersConfig = [
      {
        loader: this.#componentDefinitionLoader,
        contentKey: 'components',
        contentTypeDir: 'components',
        typeName: 'components',
      },
      {
        loader: this.#eventLoader,
        contentKey: 'events',
        contentTypeDir: 'events',
        typeName: 'events',
      },
      {
        loader: this.#actionLoader,
        contentKey: 'actions',
        contentTypeDir: 'actions',
        typeName: 'actions',
      },
      {
        loader: this.#ruleLoader,
        contentKey: 'rules',
        contentTypeDir: 'rules',
        typeName: 'rules',
      },
      {
        loader: this.#entityDefinitionLoader,
        contentKey: 'items',
        contentTypeDir: 'items',
        typeName: 'items',
      },
      {
        loader: this.#entityDefinitionLoader,
        contentKey: 'locations',
        contentTypeDir: 'locations',
        typeName: 'locations',
      },
      {
        loader: this.#entityDefinitionLoader,
        contentKey: 'characters',
        contentTypeDir: 'characters',
        typeName: 'characters',
      },
      {
        loader: this.#entityDefinitionLoader,
        contentKey: 'blockers',
        contentTypeDir: 'blockers',
        typeName: 'blockers',
      },
      {
        loader: this.#entityDefinitionLoader,
        contentKey: 'connections',
        contentTypeDir: 'connections',
        typeName: 'connections',
      },
    ];

    this.#logger.debug(
      'WorldLoader: Instance created with ALL loaders, order‑resolver, and ValidatedEventDispatcher.'
    );
  }

  // ── Public API ──────────────────────────────────────────────────────────
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
    let essentialSchemaMissing = false;
    let missingSchemaId = '';
    let loadedManifestsMap = new Map();
    /** @type {TotalResultsSummary} */
    const totalCounts = {}; // Object to store total counts per content type across all mods

    try {
      // --- Step 1: Clear Existing Data ---
      this.#registry.clear();
      this.#logger.debug('WorldLoader: Data registry cleared.');

      // --- Step 2: Load All Core Schemas ---
      await this.#schemaLoader.loadAndCompileAllSchemas();
      this.#logger.debug('WorldLoader: Schema loading phase completed.');

      // --- Step 3: Essential Schema Guard ---
      const essentials = [
        this.#configuration.getContentTypeSchemaId('game'),
        this.#configuration.getContentTypeSchemaId('components'),
        this.#configuration.getContentTypeSchemaId('mod-manifest'),
        this.#configuration.getContentTypeSchemaId('entities'),
        this.#configuration.getContentTypeSchemaId('actions'),
        this.#configuration.getContentTypeSchemaId('events'),
        this.#configuration.getContentTypeSchemaId('rules'),
      ];
      this.#logger.debug(
        `WorldLoader: Checking for essential schemas: [${essentials.filter((id) => !!id).join(', ')}]`
      );
      for (const id of essentials) {
        if (!id || !this.#validator.isSchemaLoaded(id)) {
          essentialSchemaMissing = true; // Set flag if essential schema is missing
          missingSchemaId = id ?? 'Unknown Essential Schema ID';
          // No longer throwing here; let the main catch handle it after logging/cleanup
          this.#logger.error(
            `WorldLoader: Essential schema missing or not configured: ${missingSchemaId}`
          );
          break; // Exit loop early if one is missing
        }
      }
      // If flag was set, throw the error now to proceed to catch block
      if (essentialSchemaMissing) {
        throw new Error(
          `Essential schema check failed for: ${missingSchemaId}`
        );
      }
      this.#logger.debug('WorldLoader: All essential schemas found.');

      // --- Step 4: Load Game Configuration ---
      requestedModIds = await this.#gameConfigLoader.loadConfig();
      this.#logger.debug(
        `WorldLoader: Game config loaded. Requested mods: [${requestedModIds.join(', ')}]`
      );

      // --- Step 5: Load, Validate, and Resolve Mod Manifests ---
      loadedManifestsMap =
        await this.#modManifestLoader.loadRequestedManifests(requestedModIds);
      const manifestsForValidation = new Map();
      for (const [modId, manifestObj] of loadedManifestsMap.entries()) {
        const lcModId = modId.toLowerCase();
        this.#registry.store('mod_manifests', lcModId, manifestObj);
        manifestsForValidation.set(lcModId, manifestObj);
      }
      this.#logger.debug(
        `WorldLoader: Stored ${manifestsForValidation.size} mod manifests in the registry.`
      );

      // Run validations - these may throw ModDependencyError
      ModDependencyValidator.validate(manifestsForValidation, this.#logger);
      try {
        validateModEngineVersions(
          manifestsForValidation,
          this.#logger,
          this.#validatedEventDispatcher
        );
      } catch (e) {
        // Capture engine version specific errors for summary, but re-throw
        if (e instanceof ModDependencyError) {
          // Count incompatibilities based on newlines (assuming one per line after header)
          incompatibilityCount = (e.message.match(/\n/g) || []).length;
          this.#logger.warn(
            `WorldLoader: Encountered ${incompatibilityCount} engine version incompatibilities. Details:\n${e.message}`,
            e
          );
          // Still throw to trigger the main catch block
          throw e;
        } else {
          // Re-throw unexpected errors during version validation
          throw e;
        }
      }

      this.#finalOrder = resolveOrder(
        requestedModIds,
        manifestsForValidation,
        this.#logger
      );
      this.#logger.debug(
        `WorldLoader: Final mod order resolved: [${this.#finalOrder.join(', ')}]`
      );
      this.#registry.store('meta', 'final_mod_order', this.#finalOrder);

      // --- Step 6: Sequential Per-Mod Content Loading ---
      this.#logger.debug(
        `WorldLoader: Beginning content loading based on final order...`
      );

      for (const modId of this.#finalOrder) {
        this.#logger.debug(`--- Loading content for mod: ${modId} ---`);

        let manifest = null;
        /** @type {ModResultsSummary} */
        const modResults = {}; // Stores { typeName: { count, overrides, errors } } for this mod
        let modDurationMs = 0; // Variable to store duration for this mod

        try {
          manifest = /** @type {ModManifest | null} */ (
            this.#registry.get('mod_manifests', modId.toLowerCase())
          );

          if (!manifest) {
            const reason = `Manifest not found in registry for mod ID '${modId}'. Skipping content load.`;
            this.#logger.error(`WorldLoader: ${reason}`);
            this.#validatedEventDispatcher
              .dispatch(
                'initialization:world_loader:mod_load_failed',
                {
                  modId,
                  reason,
                },
                { allowSchemaNotFound: true }
              )
              .catch((dispatchError) =>
                this.#logger.error(
                  `Failed dispatching mod_load_failed event for ${modId}: ${dispatchError.message}`,
                  dispatchError
                )
              );
            continue;
          }

          this.#logger.debug(
            `WorldLoader [${modId}]: Manifest retrieved successfully. Processing content types...`
          );

          // *** Start Timer ***
          const modStartTime = performance.now();

          // Inner loop iterates through #contentLoadersConfig
          for (const config of this.#contentLoadersConfig) {
            const { loader, contentKey, contentTypeDir, typeName } = config;
            const hasContent =
              manifest.content &&
              Array.isArray(manifest.content[contentKey]) &&
              manifest.content[contentKey].length > 0;

            if (hasContent) {
              this.#logger.debug(
                `WorldLoader [${modId}]: Found content for '${contentKey}'. Invoking loader '${loader.constructor.name}'.`
              );
              try {
                const result = /** @type {LoadItemsResult} */ (
                  await loader.loadItemsForMod(
                    modId,
                    manifest,
                    contentKey,
                    contentTypeDir,
                    typeName
                  )
                );

                // --- START: Data Aggregation ---
                if (result && typeof result.count === 'number') {
                  modResults[typeName] = {
                    count: result.count || 0,
                    overrides: result.overrides || 0,
                    errors: result.errors || 0,
                  };
                  this.#logger.debug(
                    `WorldLoader [${modId}]: Loader for '${typeName}' reported: C:${modResults[typeName].count}, O:${modResults[typeName].overrides}, E:${modResults[typeName].errors}`
                  );

                  // Aggregate into totalCounts
                  if (!totalCounts[typeName]) {
                    totalCounts[typeName] = {
                      count: 0,
                      overrides: 0,
                      errors: 0,
                    };
                  }
                  totalCounts[typeName].count += modResults[typeName].count;
                  totalCounts[typeName].overrides +=
                    modResults[typeName].overrides;
                  totalCounts[typeName].errors += modResults[typeName].errors;
                } else {
                  this.#logger.warn(
                    `WorldLoader [${modId}]: Loader for '${typeName}' returned an unexpected result format. Assuming 0 counts.`,
                    { result }
                  );
                  modResults[typeName] = { count: 0, overrides: 0, errors: 0 };
                  if (!totalCounts[typeName]) {
                    totalCounts[typeName] = {
                      count: 0,
                      overrides: 0,
                      errors: 0,
                    };
                  }
                }
                // --- END: Data Aggregation ---
              } catch (loadError) {
                const errorMessage = loadError?.message || String(loadError);
                this.#logger.error(
                  `WorldLoader [${modId}]: Error loading content type '${typeName}'. Continuing...`,
                  {
                    modId,
                    typeName,
                    error: errorMessage,
                  },
                  loadError
                );
                // --- START: Error Handling ---
                if (!modResults[typeName]) {
                  modResults[typeName] = { count: 0, overrides: 0, errors: 0 };
                }
                modResults[typeName].errors += 1;
                if (!totalCounts[typeName]) {
                  totalCounts[typeName] = { count: 0, overrides: 0, errors: 0 };
                }
                totalCounts[typeName].errors += 1;
                // --- END: Error Handling ---
                this.#validatedEventDispatcher
                  .dispatch(
                    'initialization:world_loader:content_load_failed',
                    {
                      modId,
                      typeName,
                      error: errorMessage,
                    },
                    { allowSchemaNotFound: true }
                  )
                  .catch((e) =>
                    this.#logger.error(
                      `Failed dispatching content_load_failed event for ${modId}/${typeName}`,
                      e
                    )
                  );
              }
            } else {
              this.#logger.debug(
                `WorldLoader [${modId}]: Skipping content type '${typeName}' (key: '${contentKey}') as it's not defined or empty in the manifest.`
              );
            }
          } // End inner loop (contentLoadersConfig)

          // *** Stop Timer & Calculate Duration ***
          const modEndTime = performance.now();
          modDurationMs = modEndTime - modStartTime;
          this.#logger.debug(
            `WorldLoader [${modId}]: Content loading loop took ${modDurationMs.toFixed(2)} ms.`
          );
        } catch (error) {
          this.#logger.error(
            `WorldLoader [${modId}]: Unexpected error during processing for mod '${modId}'. Skipping remaining content for this mod.`,
            {
              modId,
              error: error?.message,
            },
            error
          );
          this.#validatedEventDispatcher
            .dispatch(
              'initialization:world_loader:mod_load_failed',
              {
                modId,
                reason: `Unexpected error: ${error?.message}`,
              },
              { allowSchemaNotFound: true }
            )
            .catch((dispatchError) =>
              this.#logger.error(
                `Failed dispatching mod_load_failed event for ${modId} after unexpected error: ${dispatchError.message}`,
                dispatchError
              )
            );
          continue; // Continue to the next mod
        }

        // --- Per-Mod Summary Logging ---
        const totalModOverrides = Object.values(modResults).reduce(
          (sum, res) => sum + (res.overrides || 0),
          0
        );
        const totalModErrors = Object.values(modResults).reduce(
          (sum, res) => sum + (res.errors || 0),
          0
        );
        const typeCountsString = Object.entries(modResults)
          .filter(([typeName, result]) => result.count > 0)
          .map(([typeName, result]) => `${typeName}(${result.count})`)
          .sort()
          .join(', ');
        const summaryMessage = `Mod '${modId}' loaded in ${modDurationMs.toFixed(2)}ms: ${typeCountsString.length > 0 ? typeCountsString : 'No items loaded'}${typeCountsString.length > 0 ? ' ' : ''}-> Overrides(${totalModOverrides}), Errors(${totalModErrors})`;
        this.#logger.debug(summaryMessage);
        // --- End Per-Mod Summary Logging ---

        this.#logger.debug(
          `--- Finished loading content for mod: ${modId} ---`
        );
      } // End outer loop (finalOrder)
      this.#logger.debug(
        `WorldLoader: Completed content loading loop for all mods in final order.`
      );

      // --- Step 7: Post-Load Processing (Placeholder) ---
      this.#logger.debug(
        'WorldLoader: Post-load processing step (if any) reached.'
      );

      // --- Step 8: Log Summary ---
      this.#logLoadSummary(
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
      } else if (essentialSchemaMissing) {
        // This condition should now primarily catch the error thrown if the flag was set in Step 3
        const finalMessage = `WorldLoader failed: Essential schema '${missingSchemaId || 'unknown'}' missing or check failed – aborting world load. Original error: ${err.message}`;
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

  // ── Helper: per-mod summary logger (OLD - Replaced by inline logic above) ──
  /**
   * @private
   * @deprecated Use inline summary logging logic after the mod processing loop instead.
   */
  // eslint-disable-next-line no-unused-private-class-members
  #logModLoadSummary /* modId, modResults, durationMs */() {
    // This method is intentionally left empty as the logic is now inline above.
    this.#logger.warn(
      'WorldLoader: #logModLoadSummary is deprecated and should not be called.'
    );
  }

  // ── Helper: final summary logger ────────────────────────────────────────
  /**
   * Prints a multi‑line summary of what was loaded across all mods.
   *
   * @private
   * @param {string}   worldName
   * @param {string[]} requestedModIds
   * @param {string[]} finalOrder
   * @param {number}   incompatibilityCount
   * @param {TotalResultsSummary} totalCounts - Map of content type name to {count, overrides, errors}.
   */
  #logLoadSummary(
    worldName,
    requestedModIds,
    finalOrder,
    incompatibilityCount,
    totalCounts
  ) {
    this.#logger.info(`— WorldLoader Load Summary (World: '${worldName}') —`);
    this.#logger.info(
      `  • Requested Mods (raw): [${requestedModIds.join(', ')}]`
    );
    this.#logger.info(`  • Final Load Order    : [${finalOrder.join(', ')}]`);
    if (incompatibilityCount > 0) {
      // Logged as warning because it indicates potential issues, even if loading continued
      this.#logger.warn(
        `  • Engine‑version incompatibilities detected: ${incompatibilityCount}`
      );
    }
    this.#logger.info(`  • Content Loading Summary (Totals):`);
    if (Object.keys(totalCounts).length > 0) {
      const sortedTypes = Object.keys(totalCounts).sort();
      for (const typeName of sortedTypes) {
        const counts = totalCounts[typeName]; // counts is { count, overrides, errors }
        const paddedTypeName = typeName.padEnd(20, ' ');
        // Display Totals: C=Count, O=Overrides, E=Errors during load
        const details = `C:${counts.count}, O:${counts.overrides}, E:${counts.errors}`;
        this.#logger.info(`    - ${paddedTypeName}: ${details}`);
      }
      // Calculate grand totals
      const grandTotalCount = Object.values(totalCounts).reduce(
        (sum, tc) => sum + tc.count,
        0
      );
      const grandTotalOverrides = Object.values(totalCounts).reduce(
        (sum, tc) => sum + tc.overrides,
        0
      );
      const grandTotalErrors = Object.values(totalCounts).reduce(
        (sum, tc) => sum + tc.errors,
        0
      );
      this.#logger.info(
        `    - ${''.padEnd(20, '-')}--------------------------`
      );
      this.#logger.info(
        `    - ${'TOTAL'.padEnd(20, ' ')}: C:${grandTotalCount}, O:${grandTotalOverrides}, E:${grandTotalErrors}`
      );
    } else {
      this.#logger.info(
        `    - No specific content items were processed by loaders in this run.`
      );
    }
    this.#logger.info('———————————————————————————————————————————');
  }
}

export default WorldLoader;
