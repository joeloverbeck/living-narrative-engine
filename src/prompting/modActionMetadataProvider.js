/**
 * @file Provides mod-level action metadata for LLM prompt formatting.
 */

import { validateDependency } from '../utils/dependencyUtils.js';

/**
 * @typedef {object} ModActionMetadata
 * @property {string} modId - The mod identifier
 * @property {string|undefined} actionPurpose - Description of action purpose
 * @property {string|undefined} actionConsiderWhen - Guidance on when to use
 */

/**
 * Service that retrieves mod-level action metadata from manifests.
 * Used by AIPromptContentProvider to enrich action group headers in prompts.
 */
class ModActionMetadataProvider {
  #dataRegistry;
  #logger;
  #cache;

  /**
   * @param {object} deps
   * @param {import('../interfaces/coreServices.js').IDataRegistry} deps.dataRegistry
   * @param {import('../interfaces/coreServices.js').ILogger} deps.logger
   */
  constructor({ dataRegistry, logger }) {
    validateDependency(dataRegistry, 'IDataRegistry', logger, {
      requiredMethods: ['get'],
    });
    validateDependency(logger, 'ILogger', logger, {
      requiredMethods: ['debug', 'warn', 'error'],
    });

    this.#dataRegistry = dataRegistry;
    this.#logger = logger;
    this.#cache = new Map();
  }

  /**
   * Retrieves action metadata for a specific mod.
   * @param {string} modId - The mod identifier (namespace)
   * @returns {ModActionMetadata|null} Metadata or null if mod not found
   */
  getMetadataForMod(modId) {
    // 1. Validate input
    if (!modId || typeof modId !== 'string') {
      this.#logger.warn('ModActionMetadataProvider: Invalid modId provided', {
        modId,
      });
      return null;
    }

    // 2. Normalize modId (lowercase for registry lookup)
    const normalizedModId = modId.toLowerCase();

    // 3. Check cache
    if (this.#cache.has(normalizedModId)) {
      return this.#cache.get(normalizedModId);
    }

    // 4. Retrieve manifest from registry
    const manifest = this.#dataRegistry.get('mod_manifests', normalizedModId);

    if (!manifest) {
      this.#logger.debug(
        `ModActionMetadataProvider: No manifest found for mod '${normalizedModId}'`
      );
      this.#cache.set(normalizedModId, null);
      return null;
    }

    // 5. Extract metadata
    const metadata = {
      modId: normalizedModId,
      actionPurpose: manifest.actionPurpose,
      actionConsiderWhen: manifest.actionConsiderWhen,
    };

    // 6. Cache and return
    this.#cache.set(normalizedModId, metadata);

    this.#logger.debug(
      `ModActionMetadataProvider: Retrieved metadata for mod '${normalizedModId}'`,
      {
        hasActionPurpose: !!metadata.actionPurpose,
        hasActionConsiderWhen: !!metadata.actionConsiderWhen,
      }
    );

    return metadata;
  }

  /**
   * Clears internal cache (for testing/manifest reload scenarios).
   */
  clearCache() {
    this.#cache.clear();
    this.#logger.debug('ModActionMetadataProvider: Cache cleared');
  }
}

export { ModActionMetadataProvider };
