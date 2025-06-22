// src/persistence/activeModsManifestBuilder.js

import { CORE_MOD_ID } from '../constants/core.js';
import { setupService } from '../utils/serviceInitializerUtils.js';

/**
 * @typedef {import('../interfaces/coreServices.js').ILogger} ILogger
 * @typedef {import('../interfaces/coreServices.js').IDataRegistry} IDataRegistry
 */

/**
 * @class ActiveModsManifestBuilder
 * @description Builds the active mods manifest for save files.
 */
export default class ActiveModsManifestBuilder {
  /** @type {ILogger} */
  #logger;
  /** @type {IDataRegistry} */
  #dataRegistry;

  /**
   * @param {{logger: ILogger, dataRegistry: IDataRegistry}} deps
   */
  constructor({ logger, dataRegistry }) {
    this.#logger = setupService('ActiveModsManifestBuilder', logger, {
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
    const loadedManifestObjects = this.#dataRegistry.getAll('mod_manifests');
    let activeModsManifest = [];
    if (loadedManifestObjects && loadedManifestObjects.length > 0) {
      activeModsManifest = loadedManifestObjects.map((manifest) => ({
        modId: manifest.id,
        version: manifest.version,
      }));
      this.#logger.debug(
        `${this.constructor.name}: Captured ${activeModsManifest.length} active mods from 'mod_manifests' type in registry.`
      );
    } else {
      this.#logger.warn(
        `${this.constructor.name}: No mod manifests found in registry under "mod_manifests" type. Mod manifest may be incomplete. Using fallback.`
      );
      const coreModManifest = loadedManifestObjects?.find(
        (m) => m.id === CORE_MOD_ID
      );
      if (coreModManifest) {
        activeModsManifest = [
          { modId: CORE_MOD_ID, version: coreModManifest.version },
        ];
      } else {
        activeModsManifest = [
          { modId: CORE_MOD_ID, version: 'unknown_fallback' },
        ];
      }
      this.#logger.debug(
        `${this.constructor.name}: Used fallback for mod manifest.`
      );
    }
    return activeModsManifest;
  }
}
