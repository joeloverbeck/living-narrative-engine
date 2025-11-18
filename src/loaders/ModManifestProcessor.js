// src/loaders/ModManifestProcessor.js

/**
 * @file Defines ModManifestProcessor, responsible for loading and validating
 * mod manifests and resolving final mod load order.
 */

// Dependency implementations are injected via constructor
import ModDependencyError from '../errors/modDependencyError.js';

/** @typedef {import('../interfaces/coreServices.js').ILogger} ILogger */
/** @typedef {import('../interfaces/coreServices.js').IDataRegistry} IDataRegistry */
/** @typedef {import('../modding/modManifestLoader.js').default} ModManifestLoader */
/** @typedef {import('../events/validatedEventDispatcher.js').default} ValidatedEventDispatcher */
/** @typedef {import('../../data/schemas/mod-manifest.schema.json').ModManifest} ModManifest */

/**
 * @description Service used by ModsLoader to prepare mod manifests for loading.
 * @class
 */
export class ModManifestProcessor {
  #modManifestLoader;
  #logger;
  #registry;
  #validatedEventDispatcher;
  #modDependencyValidator;
  #modVersionValidator;
  #modLoadOrderResolver;
  #modValidationOrchestrator;

  /**
   * @param {object} deps - Constructor dependencies.
   * @param {ModManifestLoader} deps.modManifestLoader - Loader for manifests.
   * @param {ILogger} deps.logger - Logging service.
   * @param {IDataRegistry} deps.registry - Registry for storing manifests.
   * @param {ValidatedEventDispatcher} deps.validatedEventDispatcher - Event dispatcher for validation errors.
   * @param {typeof import('../modding/modDependencyValidator.js')} deps.modDependencyValidator - Dependency validator helper.
   * @param {typeof import('../modding/modVersionValidator.js').default} deps.modVersionValidator - Version compatibility validator.
   * @param {import('../modding/modLoadOrderResolver.js')} deps.modLoadOrderResolver - Load order resolver module.
   * @param {import('../../cli/validation/modValidationOrchestrator.js').default} [deps.modValidationOrchestrator] - Optional validation orchestrator for comprehensive validation.
   */
  constructor({
    modManifestLoader,
    logger,
    registry,
    validatedEventDispatcher,
    modDependencyValidator,
    modVersionValidator,
    modLoadOrderResolver,
    modValidationOrchestrator,
  }) {
    this.#modManifestLoader = modManifestLoader;
    this.#logger = logger;
    this.#registry = registry;
    this.#validatedEventDispatcher = validatedEventDispatcher;
    this.#modDependencyValidator = modDependencyValidator;
    this.#modVersionValidator = modVersionValidator;
    this.#modLoadOrderResolver = modLoadOrderResolver;
    this.#modValidationOrchestrator = modValidationOrchestrator;
  }

  /**
   * Recursively discovers and loads all mod dependencies.
   *
   * @private
   * @param {string[]} modIds - Mod IDs to load and check for dependencies
   * @param {Map<string, ModManifest>} loadedManifests - Already loaded manifests
   * @param {string} worldName - The name of the world being loaded
   * @returns {Promise<Map<string, ModManifest>>} All loaded manifests including dependencies
   */
  async #loadManifestsWithDependencies(modIds, loadedManifests, worldName) {
    const toLoad = modIds.filter(
      (id) => !loadedManifests.has(id.toLowerCase())
    );

    if (toLoad.length === 0) {
      return loadedManifests;
    }

    // Load the requested manifests
    const newManifests = await this.#modManifestLoader.loadRequestedManifests(
      toLoad,
      worldName
    );

    // Add to loaded manifests
    for (const [modId, manifest] of newManifests.entries()) {
      loadedManifests.set(modId.toLowerCase(), manifest);
    }

    // Collect all dependencies (using Set to automatically deduplicate)
    const allDependencies = new Set();
    for (const manifest of newManifests.values()) {
      if (manifest.dependencies && Array.isArray(manifest.dependencies)) {
        for (const dep of manifest.dependencies) {
          if (dep.id && !loadedManifests.has(dep.id.toLowerCase())) {
            allDependencies.add(dep.id);
          }
        }
      }
    }

    // Recursively load dependencies
    if (allDependencies.size > 0) {
      await this.#loadManifestsWithDependencies(
        Array.from(allDependencies),
        loadedManifests,
        worldName
      );
    }

    return loadedManifests;
  }

  /**
   * Loads, validates, and resolves manifests for the requested mod IDs.
   *
   * @param {string[]} requestedIds - IDs of mods requested by the game config.
   * @param {string} worldName - The name of the world being loaded.
   * @param {object} [options] - Optional validation options
   * @param {boolean} [options.validateCrossReferences] - Whether to perform cross-reference validation
   * @param {boolean} [options.strictMode] - Whether to fail on validation warnings
   * @returns {Promise<{loadedManifestsMap: Map<string, ModManifest>, finalModOrder: string[], incompatibilityCount: number, validationWarnings?: string[]}>}
   * Object containing the loaded manifests, resolved order and incompatibility count.
   * @throws {ModDependencyError|Error} Propagates validation errors.
   */
  async processManifests(requestedIds, worldName, options = {}) {
    const { validateCrossReferences = false, strictMode = false } = options;
    let validationWarnings = [];

    // If validation orchestrator is available and cross-reference validation is requested
    if (this.#modValidationOrchestrator && validateCrossReferences) {
      this.#logger.info(
        'Using ModValidationOrchestrator for comprehensive validation'
      );

      try {
        const validationResult =
          await this.#modValidationOrchestrator.validateForLoading(
            requestedIds,
            { strictMode, allowWarnings: !strictMode }
          );

        if (!validationResult.canLoad) {
          throw new ModDependencyError(
            'Pre-loading validation failed - cannot load mods'
          );
        }

        validationWarnings = validationResult.warnings || [];

        if (validationWarnings.length > 0) {
          this.#logger.warn(
            `Loading with ${validationWarnings.length} validation warnings`
          );
          validationWarnings.forEach((warning) => {
            this.#logger.warn(`  - ${warning}`);
          });
        }

        // The orchestrator already loaded manifests, use them
        const loadedManifestsMap =
          (await this.#modManifestLoader.getLoadedManifests()) || new Map();

        // Store all manifests in registry
        for (const [modId, manifestObj] of loadedManifestsMap.entries()) {
          this.#registry.store('mod_manifests', modId, manifestObj);
        }

        // Use the load order from validation result if available
        const finalModOrder = validationResult.loadOrder || requestedIds;
        this.#registry.store('meta', 'final_mod_order', finalModOrder);

        return {
          loadedManifestsMap,
          finalModOrder,
          incompatibilityCount: 0,
          validationWarnings,
        };
      } catch (error) {
        if (strictMode) {
          throw error;
        }
        // Fall back to traditional validation if orchestrator fails
        this.#logger.warn(
          'Validation orchestrator failed, falling back to traditional validation',
          error
        );
      }
    }

    // Traditional validation flow (backward compatible)
    // Load all manifests including dependencies recursively
    const loadedManifestsMap = await this.#loadManifestsWithDependencies(
      requestedIds,
      new Map(),
      worldName
    );

    this.#logger.debug(
      `ModsLoader: Loaded ${loadedManifestsMap.size} mod manifests (including dependencies).`
    );

    // Store all manifests in registry
    for (const [modId, manifestObj] of loadedManifestsMap.entries()) {
      this.#registry.store('mod_manifests', modId, manifestObj);
    }

    // Now validate dependencies - all manifests are loaded
    this.#modDependencyValidator.validate(loadedManifestsMap, this.#logger);

    // Validate version compatibility before resolving order
    let incompatibilityCount = 0;
    try {
      this.#modVersionValidator(
        loadedManifestsMap,
        this.#logger,
        this.#validatedEventDispatcher
      );
    } catch (e) {
      if (e instanceof ModDependencyError) {
        incompatibilityCount = (e.message.match(/\n/g) || []).length;
        this.#logger.warn(
          `ModsLoader: Encountered ${incompatibilityCount} engine version incompatibilities. Details:\n${e.message}`,
          e
        );
        throw e;
      }
      throw e;
    }

    // Resolve the final mod order
    const finalModOrder = this.#modLoadOrderResolver.resolve(
      requestedIds,
      loadedManifestsMap
    );
    this.#logger.debug(
      `ModsLoader: Final mod order resolved: [${finalModOrder.join(', ')}]`
    );

    this.#registry.store('meta', 'final_mod_order', finalModOrder);

    return {
      loadedManifestsMap,
      finalModOrder,
      incompatibilityCount,
      validationWarnings,
    };
  }
}

export default ModManifestProcessor;
