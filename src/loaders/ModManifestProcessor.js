// src/loaders/ModManifestProcessor.js

/**
 * @file Defines ModManifestProcessor, responsible for loading and validating
 * mod manifests and resolving final mod load order.
 */

import ModDependencyValidator from '../modding/modDependencyValidator.js';
import validateModEngineVersions from '../modding/modVersionValidator.js';
import { resolveOrder } from '../modding/modLoadOrderResolver.js';
import ModDependencyError from '../errors/modDependencyError.js';

/** @typedef {import('../interfaces/coreServices.js').ILogger} ILogger */
/** @typedef {import('../interfaces/coreServices.js').IDataRegistry} IDataRegistry */
/** @typedef {import('../modding/modManifestLoader.js').default} ModManifestLoader */
/** @typedef {import('../events/validatedEventDispatcher.js').default} ValidatedEventDispatcher */
/** @typedef {import('../../data/schemas/mod.manifest.schema.json').ModManifest} ModManifest */

/**
 * @description Service used by WorldLoader to prepare mod manifests for loading.
 * @class
 */
export class ModManifestProcessor {
  #modManifestLoader;
  #logger;
  #registry;
  #validatedEventDispatcher;

  /**
   * @param {object} deps - Constructor dependencies.
   * @param {ModManifestLoader} deps.modManifestLoader - Loader for manifests.
   * @param {ILogger} deps.logger - Logging service.
   * @param {IDataRegistry} deps.registry - Registry for storing manifests.
   * @param {ValidatedEventDispatcher} deps.validatedEventDispatcher - Event dispatcher for validation errors.
   */
  constructor({
    modManifestLoader,
    logger,
    registry,
    validatedEventDispatcher,
  }) {
    this.#modManifestLoader = modManifestLoader;
    this.#logger = logger;
    this.#registry = registry;
    this.#validatedEventDispatcher = validatedEventDispatcher;
  }

  /**
   * Loads, validates, and resolves manifests for the requested mod IDs.
   *
   * @param {string[]} requestedIds - IDs of mods requested by the game config.
   * @returns {Promise<{loadedManifestsMap: Map<string, ModManifest>, finalOrder: string[], incompatibilityCount: number}>}
   * Object containing the loaded manifests, resolved order and incompatibility count.
   * @throws {ModDependencyError|Error} Propagates validation errors.
   */
  async processManifests(requestedIds) {
    const loadedManifestsRaw =
      await this.#modManifestLoader.loadRequestedManifests(requestedIds);
    const loadedManifestsMap = new Map();
    const manifestsForValidation = new Map();
    for (const [modId, manifestObj] of loadedManifestsRaw.entries()) {
      const lcModId = modId.toLowerCase();
      this.#registry.store('mod_manifests', lcModId, manifestObj);
      manifestsForValidation.set(lcModId, manifestObj);
      loadedManifestsMap.set(lcModId, manifestObj);
    }
    this.#logger.debug(
      `WorldLoader: Stored ${manifestsForValidation.size} mod manifests in the registry.`
    );

    ModDependencyValidator.validate(manifestsForValidation, this.#logger);
    let incompatibilityCount = 0;
    try {
      validateModEngineVersions(
        manifestsForValidation,
        this.#logger,
        this.#validatedEventDispatcher
      );
    } catch (e) {
      if (e instanceof ModDependencyError) {
        incompatibilityCount = (e.message.match(/\n/g) || []).length;
        this.#logger.warn(
          `WorldLoader: Encountered ${incompatibilityCount} engine version incompatibilities. Details:\n${e.message}`,
          e
        );
        throw e;
      }
      throw e;
    }

    const finalOrder = resolveOrder(
      requestedIds,
      manifestsForValidation,
      this.#logger
    );
    this.#logger.debug(
      `WorldLoader: Final mod order resolved: [${finalOrder.join(', ')}]`
    );
    this.#registry.store('meta', 'final_mod_order', finalOrder);

    return { loadedManifestsMap, finalOrder, incompatibilityCount };
  }
}

export default ModManifestProcessor;
