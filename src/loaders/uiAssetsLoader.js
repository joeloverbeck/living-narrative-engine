// src/loaders/uiAssetsLoader.js

/**
 * @file Loader for UI asset files such as icons.
 */

/** @typedef {import('../interfaces/coreServices.js').IConfiguration} IConfiguration */
/** @typedef {import('../interfaces/coreServices.js').IPathResolver} IPathResolver */
/** @typedef {import('../interfaces/coreServices.js').IDataFetcher} IDataFetcher */
/** @typedef {import('../interfaces/coreServices.js').ISchemaValidator} ISchemaValidator */
/** @typedef {import('../interfaces/coreServices.js').IDataRegistry} IDataRegistry */
/** @typedef {import('../interfaces/coreServices.js').ILogger} ILogger */
/** @typedef {import('../interfaces/coreServices.js').ModManifest} ModManifest */

import AbstractLoader from './abstractLoader.js';

/**
 * Simple loader that processes `icons.json` files for a mod and stores the
 * icon markup in the provided {@link IDataRegistry}. Icons are stored under the
 * `ui-icons` category using their icon name as the key. When multiple mods
 * provide the same icon name, the last loaded mod wins.
 *
 * @class UiAssetsLoader
 * @augments AbstractLoader
 */
class UiAssetsLoader extends AbstractLoader {
  #config;
  #resolver;
  #fetcher;
  #validator;
  #registry;

  /**
   * @description Creates an instance of UiAssetsLoader.
   * @param {IConfiguration} config - Configuration service.
   * @param {IPathResolver} pathResolver - Path resolver service.
   * @param {IDataFetcher} dataFetcher - Data fetching service.
   * @param {ISchemaValidator} schemaValidator - Schema validation service.
   * @param {IDataRegistry} dataRegistry - Data registry for storing icons.
   * @param {ILogger} logger - Logger instance.
   */
  constructor(
    config,
    pathResolver,
    dataFetcher,
    schemaValidator,
    dataRegistry,
    logger
  ) {
    super(logger, [
      {
        dependency: config,
        name: 'IConfiguration',
        methods: ['getContentTypeSchemaId'],
      },
      {
        dependency: pathResolver,
        name: 'IPathResolver',
        methods: ['resolveModContentPath'],
      },
      { dependency: dataFetcher, name: 'IDataFetcher', methods: ['fetch'] },
      {
        dependency: schemaValidator,
        name: 'ISchemaValidator',
        methods: ['validate'],
      },
      {
        dependency: dataRegistry,
        name: 'IDataRegistry',
        methods: ['store', 'get'],
      },
    ]);

    this.#config = config;
    this.#resolver = pathResolver;
    this.#fetcher = dataFetcher;
    this.#validator = schemaValidator;
    this.#registry = dataRegistry;
  }

  /**
   * @description Helper to load UI asset files like icons or labels.
   * @protected
   * @param {string} modId - The mod identifier.
   * @param {ModManifest} manifest - The mod manifest.
   * @param {{suffix:string, schemaKey:string, registryCat:string}} options - Parameters controlling file suffix, schema key and registry category.
   * @returns {Promise<{count:number, overrides:number, errors:number}>} Result summary.
   */
  async _loadAssetFiles(modId, manifest, { suffix, schemaKey, registryCat }) {
    const uiFiles = manifest?.content?.ui || [];
    const targetFiles = uiFiles.filter((f) => f.endsWith(suffix));

    let count = 0;
    let overrides = 0;
    let errors = 0;

    for (const filename of targetFiles) {
      try {
        const path = this.#resolver.resolveModContentPath(
          modId,
          'ui',
          filename
        );
        const data = await this.#fetcher.fetch(path);
        const schemaId = this.#config.getContentTypeSchemaId(schemaKey);
        const res = this.#validator.validate(schemaId, data);
        if (!res.isValid) {
          throw new Error('Asset schema validation failed');
        }
        for (const [name, value] of Object.entries(data)) {
          if (this.#registry.get(registryCat, name) !== undefined) {
            overrides++;
          }
          const toStore =
            registryCat === 'ui-icons' ? { markup: value } : value;
          this.#registry.store(registryCat, name, toStore);
        }
        count++;
      } catch (e) {
        errors++;
        this._logger.error(
          `UiAssetsLoader [${modId}]: Failed to process ${filename}: ${e.message}`
        );
      }
    }

    return { count, overrides, errors };
  }

  /**
   * @description Loads icon definitions for a mod.
   * @param {string} modId - The mod identifier.
   * @param {ModManifest} manifest - The mod manifest.
   * @returns {Promise<{count:number, overrides:number, errors:number}>} Result summary.
   */
  async loadIconsForMod(modId, manifest) {
    return this._loadAssetFiles(modId, manifest, {
      suffix: 'icons.json',
      schemaKey: 'ui-icons',
      registryCat: 'ui-icons',
    });
  }

  /**
   * @description Loads label definitions for a mod.
   * @param {string} modId - The mod identifier.
   * @param {ModManifest} manifest - The mod manifest.
   * @returns {Promise<{count:number, overrides:number, errors:number}>} Result summary.
   */
  async loadLabelsForMod(modId, manifest) {
    return this._loadAssetFiles(modId, manifest, {
      suffix: 'labels.json',
      schemaKey: 'ui-labels',
      registryCat: 'ui-labels',
    });
  }

  /**
   * @description Loads all UI assets for a mod based on file names.
   * @param {string} modId - The mod identifier.
   * @param {ModManifest} manifest - The mod manifest.
   * @returns {Promise<{count:number, overrides:number, errors:number}>} Result summary.
   */
  async loadUiAssetsForMod(modId, manifest) {
    const uiFiles = manifest?.content?.ui || [];
    let count = 0;
    let overrides = 0;
    let errors = 0;

    for (const filename of uiFiles) {
      if (filename.endsWith('icons.json')) {
        try {
          const res = await this.loadIconsForMod(modId, {
            content: { ui: [filename] },
          });
          count += res.count;
          overrides += res.overrides;
        } catch (e) {
          errors++;
          this._logger.error(
            `UiAssetsLoader [${modId}]: Failed to process ${filename}: ${e.message}`
          );
        }
      } else if (filename.endsWith('labels.json')) {
        try {
          const res = await this.loadLabelsForMod(modId, {
            content: { ui: [filename] },
          });
          count += res.count;
          overrides += res.overrides;
        } catch (e) {
          errors++;
          this._logger.error(
            `UiAssetsLoader [${modId}]: Failed to process ${filename}: ${e.message}`
          );
        }
      } else {
        this._logger.warn(
          `UiAssetsLoader [${modId}]: Unknown file ${filename}`
        );
        throw new Error(`Unknown UI asset file: ${filename}`);
      }
    }

    return { count, overrides, errors };
  }
}

export default UiAssetsLoader;
