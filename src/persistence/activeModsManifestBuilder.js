// src/persistence/activeModsManifestBuilder.js

import { CORE_MOD_ID } from '../constants/core.js';
import { BaseService } from '../utils/serviceBase.js';

/**
 * @typedef {import('../interfaces/coreServices.js').ILogger} ILogger
 * @typedef {import('../interfaces/coreServices.js').IDataRegistry} IDataRegistry
 */

/**
 * @class ActiveModsManifestBuilder
 * @augments BaseService
 * @description Builds the active mods manifest for save files.
 */
export default class ActiveModsManifestBuilder extends BaseService {
  /** @type {ILogger} */
  #logger;
  /** @type {IDataRegistry} */
  #dataRegistry;

  /**
   * @param {{logger: ILogger, dataRegistry: IDataRegistry}} deps
   */
  constructor({ logger, dataRegistry }) {
    super();
    this.#logger = this._init('ActiveModsManifestBuilder', logger, {
      dataRegistry: { value: dataRegistry, requiredMethods: ['getAll'] },
    });
    this.#dataRegistry = dataRegistry;
  }

  /**
   * Builds an array describing currently active mods.
   *
   * @returns {{modId: string, version: string}[]} List of mod identifiers and versions.
   */
  buildManifest() {
    /** @type {import('../../data/schemas/mod-manifest.schema.json').ModManifest[]} */
    const manifests = this.#dataRegistry.getAll('mod_manifests') || [];
    if (manifests.length === 0) {
      return this.#buildFallbackManifest(manifests);
    }

    const activeModsManifest = manifests.map((manifest) => ({
      modId: manifest.id,
      version: manifest.version,
    }));
    this.#logger.debug(
      `${this.constructor.name}: Captured ${activeModsManifest.length} active mods from 'mod_manifests' type in registry.`
    );
    return activeModsManifest;
  }

  /**
   * @description Builds a fallback manifest when registry data is missing.
   * @param {Array<{id: string, version: string}>} manifests
   * @returns {{modId: string, version: string}[]}
   */
  #buildFallbackManifest(manifests) {
    this.#logger.warn(
      `${this.constructor.name}: No mod manifests found in registry under "mod_manifests" type. Mod manifest may be incomplete. Using fallback.`
    );

    const coreModManifest = manifests.find((m) => m.id === CORE_MOD_ID);
    const fallbackManifest = coreModManifest
      ? [{ modId: CORE_MOD_ID, version: coreModManifest.version }]
      : [{ modId: CORE_MOD_ID, version: 'unknown_fallback' }];

    this.#logger.debug(
      `${this.constructor.name}: Used fallback for mod manifest.`
    );
    return fallbackManifest;
  }
}
