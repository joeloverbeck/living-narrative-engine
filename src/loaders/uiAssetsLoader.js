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
   * @returns {Promise<{count:number, overrides:number, errors:number, failures:{file:string,reason:string}[]}>} Result summary.
   */
  async _loadAssetFiles(modId, manifest, { suffix, schemaKey, registryCat }) {
    const uiFiles = manifest?.content?.ui || [];
    const targetFiles = uiFiles.filter((f) => f.endsWith(suffix));

    let count = 0;
    let overrides = 0;
    let errors = 0;
    const failures = [];

    for (const filename of targetFiles) {
      const path = this.#resolver.resolveModContentPath(modId, 'ui', filename);

      let fileData;
      try {
        fileData = await this.#fetcher.fetch(path);
      } catch (e) {
        errors++;
        failures.push({ file: filename, reason: 'fetch' });
        this._logger.error(
          `UiAssetsLoader [${modId}]: Failed to fetch ${filename}: ${e.message}`
        );
        continue;
      }

      const schemaId = this.#config.getContentTypeSchemaId(schemaKey);
      let validationResult;
      try {
        validationResult = this.#validator.validate(schemaId, fileData);
      } catch (e) {
        errors++;
        failures.push({ file: filename, reason: 'validation' });
        this._logger.error(
          `UiAssetsLoader [${modId}]: Failed to validate ${filename}: ${e.message}`
        );
        continue;
      }

      if (!validationResult.isValid) {
        errors++;
        failures.push({ file: filename, reason: 'validation' });
        this._logger.error(
          `UiAssetsLoader [${modId}]: Failed to process ${filename}: Asset schema validation failed`
        );
        continue;
      }

      for (const [name, value] of Object.entries(fileData)) {
        if (this.#registry.get(registryCat, name) !== undefined) {
          overrides++;
        }
        const toStore = registryCat === 'ui-icons' ? { markup: value } : value;
        this.#registry.store(registryCat, name, toStore);
      }

      count++;
    }

    return { count, overrides, errors, failures };
  }

  /**
   * @description Loads icon definitions for a mod.
   * @param {string} modId - The mod identifier.
   * @param {ModManifest} manifest - The mod manifest.
   * @returns {Promise<{count:number, overrides:number, errors:number, failures:{file:string,reason:string}[]}>} Result summary.
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
   * @returns {Promise<{count:number, overrides:number, errors:number, failures:{file:string,reason:string}[]}>} Result summary.
   */
  async loadLabelsForMod(modId, manifest) {
    return this._loadAssetFiles(modId, manifest, {
      suffix: 'labels.json',
      schemaKey: 'ui-labels',
      registryCat: 'ui-labels',
    });
  }

  /**
   * @description Categorizes UI file names by type.
   * @private
   * @param {string[]} uiFiles - File names from the manifest.
   * @returns {{iconFiles:string[], labelFiles:string[], unknownFiles:string[]}}
   * Lists of files grouped by category.
   */
  #categorizeUiFiles(uiFiles) {
    const iconFiles = [];
    const labelFiles = [];
    const unknownFiles = [];

    for (const file of uiFiles) {
      if (file.endsWith('icons.json')) {
        iconFiles.push(file);
      } else if (file.endsWith('labels.json')) {
        labelFiles.push(file);
      } else {
        unknownFiles.push(file);
      }
    }

    return { iconFiles, labelFiles, unknownFiles };
  }

  // --- Testing Utilities ---

  /**
   * Exposes {@link UiAssetsLoader.#categorizeUiFiles} for tests.
   *
   * @public
   * @param {string[]} uiFiles
   * @returns {{iconFiles:string[], labelFiles:string[], unknownFiles:string[]}}
   */
  categorizeUiFilesForTest(uiFiles) {
    return this.#categorizeUiFiles(uiFiles);
  }

  /**
   * @description Helper to load a group of asset files using a loader function.
   * @protected
   * @param {string[]} files - File names to process.
   * @param {{modId:string, loader:(id:string, manifest:ModManifest)=>Promise<{count:number, overrides:number, errors:number, failures:{file:string,reason:string}[]}>}} options
   * Parameters including the mod id and loader to invoke.
   * @returns {Promise<{count:number, overrides:number, errors:number, failures:{file:string,reason:string}[]}>}
   * Aggregated result summary.
   */
  async loadAssetGroup(files, { modId, loader }) {
    let count = 0;
    let overrides = 0;
    let errors = 0;
    const failures = [];

    for (const filename of files) {
      try {
        const loaderResult = await loader(modId, {
          content: { ui: [filename] },
        });
        count += loaderResult.count;
        overrides += loaderResult.overrides;
        errors += loaderResult.errors;
        if (Array.isArray(loaderResult.failures)) {
          for (const failure of loaderResult.failures) {
            this._logger.warn(
              `UiAssetsLoader [${modId}]: ${failure.file} failed due to ${failure.reason}`
            );
          }
          failures.push(...loaderResult.failures);
        }
      } catch (e) {
        errors++;
        this._logger.error(
          `UiAssetsLoader [${modId}]: Failed to process ${filename}: ${e.message}`
        );
      }
    }

    return { count, overrides, errors, failures };
  }

  /**
   * @description Loads all UI assets for a mod based on file names.
   * @param {string} modId - The mod identifier.
   * @param {ModManifest} manifest - The mod manifest.
   * @returns {Promise<{count:number, overrides:number, errors:number, failures:{file:string,reason:string}[]}>} Result summary.
   */
  async loadUiAssetsForMod(modId, manifest) {
    const uiFiles = manifest?.content?.ui || [];
    const { iconFiles, labelFiles, unknownFiles } =
      this.#categorizeUiFiles(uiFiles);
    const iconRes = await this.loadAssetGroup(iconFiles, {
      modId,
      loader: this.loadIconsForMod.bind(this),
    });
    const labelRes = await this.loadAssetGroup(labelFiles, {
      modId,
      loader: this.loadLabelsForMod.bind(this),
    });
    const count = iconRes.count + labelRes.count;
    const overrides = iconRes.overrides + labelRes.overrides;
    const errors = iconRes.errors + labelRes.errors;
    const failures = [
      ...(iconRes.failures || []),
      ...(labelRes.failures || []),
    ];

    for (const filename of unknownFiles) {
      this._logger.warn(`UiAssetsLoader [${modId}]: Unknown file ${filename}`);
    }

    return { count, overrides, errors, failures };
  }
}

export default UiAssetsLoader;
