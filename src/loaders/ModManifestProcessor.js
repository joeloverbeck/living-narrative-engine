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

  /**
   * @param {object} deps - Constructor dependencies.
   * @param {ModManifestLoader} deps.modManifestLoader - Loader for manifests.
   * @param {ILogger} deps.logger - Logging service.
   * @param {IDataRegistry} deps.registry - Registry for storing manifests.
   * @param {ValidatedEventDispatcher} deps.validatedEventDispatcher - Event dispatcher for validation errors.
   * @param {typeof import('../modding/modDependencyValidator.js')} deps.modDependencyValidator - Dependency validator helper.
   * @param {typeof import('../modding/modVersionValidator.js').default} deps.modVersionValidator - Version compatibility validator.
   * @param {import('../modding/modLoadOrderResolver.js')} deps.modLoadOrderResolver - Load order resolver module.
   */
  constructor({
    modManifestLoader,
    logger,
    registry,
    validatedEventDispatcher,
    modDependencyValidator,
    modVersionValidator,
    modLoadOrderResolver,
  }) {
    this.#modManifestLoader = modManifestLoader;
    this.#logger = logger;
    this.#registry = registry;
    this.#validatedEventDispatcher = validatedEventDispatcher;
    this.#modDependencyValidator = modDependencyValidator;
    this.#modVersionValidator = modVersionValidator;
    this.#modLoadOrderResolver = modLoadOrderResolver;
  }

  /**
   * Loads, validates, and resolves manifests for the requested mod IDs.
   *
   * @param {string[]} requestedIds - IDs of mods requested by the game config.
   * @param {string} worldName - The name of the world being loaded.
   * @returns {Promise<{loadedManifestsMap: Map<string, ModManifest>, finalModOrder: string[], incompatibilityCount: number}>}
   * Object containing the loaded manifests, resolved order and incompatibility count.
   * @throws {ModDependencyError|Error} Propagates validation errors.
   */
  async processManifests(requestedIds, worldName) {
    // First, load the requested mod manifests
    const loadedManifestsRaw =
      await this.#modManifestLoader.loadRequestedManifests(
        requestedIds,
        worldName
      );

    const loadedManifestsMap = new Map();
    const manifestsForValidation = new Map();
    for (const [modId, manifestObj] of loadedManifestsRaw.entries()) {
      const lowerCaseModId = modId.toLowerCase();
      this.#registry.store('mod_manifests', lowerCaseModId, manifestObj);
      manifestsForValidation.set(lowerCaseModId, manifestObj);
      loadedManifestsMap.set(lowerCaseModId, manifestObj);
    }
    this.#logger.debug(
      `ModsLoader: Stored ${manifestsForValidation.size} mod manifests in the registry.`
    );

    this.#modDependencyValidator.validate(manifestsForValidation, this.#logger);
    let incompatibilityCount = 0;
    try {
      this.#modVersionValidator(
        manifestsForValidation,
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

    // Resolve the final mod order (this may include dependencies not yet loaded)
    const finalModOrder = this.#modLoadOrderResolver.resolve(
      requestedIds,
      manifestsForValidation
    );
    this.#logger.debug(
      `ModsLoader: Final mod order resolved: [${finalModOrder.join(', ')}]`
    );

    // Load any missing dependency manifests
    const missingMods = finalModOrder.filter(
      modId => !loadedManifestsMap.has(modId.toLowerCase())
    );
    
    if (missingMods.length > 0) {
      this.#logger.debug(
        `ModsLoader: Loading ${missingMods.length} missing dependency manifests: [${missingMods.join(', ')}]`
      );
      
      const missingManifestsRaw = await this.#modManifestLoader.loadRequestedManifests(
        missingMods,
        worldName
      );
      
      for (const [modId, manifestObj] of missingManifestsRaw.entries()) {
        const lowerCaseModId = modId.toLowerCase();
        this.#registry.store('mod_manifests', lowerCaseModId, manifestObj);
        manifestsForValidation.set(lowerCaseModId, manifestObj);
        loadedManifestsMap.set(lowerCaseModId, manifestObj);
      }
      
      this.#logger.debug(
        `ModsLoader: Loaded ${missingManifestsRaw.size} additional dependency manifests.`
      );
    }

    this.#registry.store('meta', 'final_mod_order', finalModOrder);

    return { loadedManifestsMap, finalModOrder, incompatibilityCount };
  }
}

export default ModManifestProcessor;
