// src/loaders/promptTextLoader.js

/**
 * @file Loader for the core prompt text used by the AI system.
 */

/** @typedef {import('../interfaces/coreServices.js').IConfiguration} IConfiguration */
/** @typedef {import('../interfaces/coreServices.js').IPathResolver} IPathResolver */
/** @typedef {import('../interfaces/coreServices.js').IDataFetcher} IDataFetcher */
/** @typedef {import('../interfaces/coreServices.js').ISchemaValidator} ISchemaValidator */
/** @typedef {import('../interfaces/coreServices.js').IDataRegistry} IDataRegistry */
/** @typedef {import('../interfaces/coreServices.js').ILogger} ILogger */

import AbstractLoader from './abstractLoader.js';

/**
 * Handles loading and validation of the game's core prompt text file.
 *
 * @class PromptTextLoader
 * @augments AbstractLoader
 */
class PromptTextLoader extends AbstractLoader {
  #configuration;
  #pathResolver;
  #dataFetcher;
  #schemaValidator;
  #dataRegistry;

  /**
   * Creates a new PromptTextLoader instance.
   *
   * @param {object} deps - Dependency injection object.
   * @param {IConfiguration} deps.configuration - Configuration service.
   * @param {IPathResolver} deps.pathResolver - Path resolver service.
   * @param {IDataFetcher} deps.dataFetcher - Data fetching service.
   * @param {ISchemaValidator} deps.schemaValidator - Schema validator service.
   * @param {IDataRegistry} deps.dataRegistry - Data registry service.
   * @param {ILogger} deps.logger - Logger service.
   */
  constructor({
    configuration,
    pathResolver,
    dataFetcher,
    schemaValidator,
    dataRegistry,
    logger,
  }) {
    super(logger, [
      {
        dependency: configuration,
        name: 'IConfiguration',
        methods: ['getContentTypeSchemaId'],
      },
      {
        dependency: pathResolver,
        name: 'IPathResolver',
        methods: ['resolveContentPath'],
      },
      { dependency: dataFetcher, name: 'IDataFetcher', methods: ['fetch'] },
      {
        dependency: schemaValidator,
        name: 'ISchemaValidator',
        methods: ['validate'],
      },
      { dependency: dataRegistry, name: 'IDataRegistry', methods: ['store'] },
    ]);

    this.#configuration = configuration;
    this.#pathResolver = pathResolver;
    this.#dataFetcher = dataFetcher;
    this.#schemaValidator = schemaValidator;
    this.#dataRegistry = dataRegistry;
  }

  /**
   * Loads the core prompt text, validates it against the configured schema, and stores it in the registry.
   *
   * @returns {Promise<object>} The validated prompt text object.
   * @public
   * @async
   */
  async loadPromptText() {
    const filePath = this.#pathResolver.resolveContentPath(
      'prompts',
      'corePromptText.json'
    );
    this._logger.debug(
      `PromptTextLoader: Loading prompt text from ${filePath}.`
    );

    const data = await this.#dataFetcher.fetch(filePath);

    const schemaId = this.#configuration.getContentTypeSchemaId('prompt-text');
    const validationResult = this.#schemaValidator.validate(schemaId, data);
    if (!validationResult.isValid) {
      this._logger.error(
        `PromptTextLoader: Validation failed for ${filePath} using schema '${schemaId}'.`,
        { errors: validationResult.errors }
      );
      throw new Error('Prompt text validation failed.');
    }

    this.#dataRegistry.store('prompt_text', 'core', data);
    this._logger.debug(
      'PromptTextLoader: Stored prompt text under type \u2018prompt_text\u2019 with id \u2018core\u2019.'
    );

    return data;
  }
}

export default PromptTextLoader;
