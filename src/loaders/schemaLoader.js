// src/loaders/schemaLoader.js

/**
 * @file Defines the SchemaLoader class, responsible for loading
 * and compiling JSON schemas listed in the configuration using injected core services.
 */

// --- Import Interfaces (for JSDoc/Type Hinting) ---
/**
 * @typedef {import('../interfaces/coreServices.js').IConfiguration} IConfiguration
 * @typedef {import('../interfaces/coreServices.js').IPathResolver} IPathResolver
 * @typedef {import('../interfaces/coreServices.js').IDataFetcher} IDataFetcher
 * @typedef {import('../interfaces/coreServices.js').ISchemaValidator} ISchemaValidator
 * @typedef {import('../interfaces/coreServices.js').ILogger} ILogger
 */

/**
 * Handles the loading, validation against meta-schemas (implicitly by ISchemaValidator),
 * and compilation of JSON schemas specified in the application's configuration.
 * It focuses solely on processing the schemas listed in the configuration's `schemaFiles`.
 */
import AbstractLoader from './abstractLoader.js';
import { validateDependencies } from '../utils/dependencyUtils.js';

class SchemaLoader extends AbstractLoader {
  #config;
  #resolver;
  #fetcher;
  #validator;
  #logger;

  /**
   * Constructs a SchemaLoader instance.
   *
   * @param {IConfiguration} configuration - Service to provide configuration values (schema paths, filenames).
   * @param {IPathResolver} pathResolver - Service to resolve abstract paths to fetchable paths.
   * @param {IDataFetcher} fetcher - Service to fetch raw schema data.
   * @param {ISchemaValidator} validator - Service to add and compile schemas.
   * @param {ILogger} logger - Service for logging messages.
   * @throws {Error} If any required dependency is not provided or invalid.
   */
  constructor(configuration, pathResolver, fetcher, validator, logger) {
    validateDependencies(
      [
        {
          dependency: logger,
          name: 'ILogger',
          methods: ['info', 'warn', 'error', 'debug'],
        },
        {
          dependency: configuration,
          name: 'IConfiguration',
          methods: ['getSchemaFiles'],
        },
        {
          dependency: pathResolver,
          name: 'IPathResolver',
          methods: ['resolveSchemaPath'],
        },
        {
          dependency: fetcher,
          name: 'IDataFetcher',
          methods: ['fetch'],
        },
        {
          dependency: validator,
          name: 'ISchemaValidator',
          methods: ['addSchema', 'isSchemaLoaded'],
        },
      ],
      logger
    );
    super(logger);

    this.#config = configuration;
    this.#resolver = pathResolver;
    this.#fetcher = fetcher;
    this.#validator = validator;
    this.#logger = this._logger;

    // --- Dependencies stored; initialization complete ---
  }

  /**
   * Loads and compiles all JSON schemas listed in the configuration's `schemaFiles`
   * using the injected services (PathResolver, DataFetcher, SchemaValidator).
   *
   * @returns {Promise<void>} Resolves when all configured schemas are successfully processed
   * (either loaded and added or skipped if already present), rejects if a critical error
   * occurs during fetching or adding any schema listed in the configuration.
   * @throws {Error} If processing fails for any schema during the main processing loop.
   */
  async loadAndCompileAllSchemas() {
    // --- Uses getSchemaFiles from IConfiguration ---
    const schemaFiles = this.#config.getSchemaFiles();

    if (!schemaFiles || schemaFiles.length === 0) {
      this.#logger.warn(
        'SchemaLoader: No schema files listed in configuration. Skipping schema loading.'
      );
      return; // Exit if no schemas are configured
    }

    this.#logger.debug(
      `SchemaLoader: Processing ${schemaFiles.length} schemas listed in configuration (batch registration)...`
    );

    // --- Phase 1: Load all schemas into memory ---
    const loadedSchemas = await Promise.all(
      schemaFiles.map(async (filename) => {
        const path = this.#resolver.resolveSchemaPath(filename);
        let schemaData;
        try {
          schemaData = await this.#fetcher.fetch(path);
        } catch (error) {
          this.#logger.error(
            `SchemaLoader: Failed to fetch schema file ${filename} at ${path}: ${error.message}`,
            error
          );
          throw error;
        }
        const schemaId = schemaData?.$id;
        if (!schemaId) {
          const errMsg = `Schema file ${filename} (at ${path}) is missing required '$id' property.`;
          this.#logger.error(`SchemaLoader: ${errMsg}`);
          throw new Error(errMsg);
        }
        return { schemaId, schemaData, filename };
      })
    );

    // --- Phase 2: Register all schemas with the validator in batch ---
    try {
      await this.#validator.addSchemas(loadedSchemas.map((s) => s.schemaData));
      this.#logger.debug(
        `SchemaLoader: Batch schema registration complete. Added ${loadedSchemas.length} schemas.`
      );
    } catch (error) {
      this.#logger.error(
        `SchemaLoader: Failed to register schemas in batch: ${error.message}`,
        error
      );
      throw error;
    }

    // --- Optionally validate $refs for all schemas ---
    if (
      this.#validator.validateSchemaRefs &&
      typeof this.#validator.validateSchemaRefs === 'function'
    ) {
      for (const { schemaId } of loadedSchemas) {
        const refsValid = this.#validator.validateSchemaRefs(schemaId);
        if (!refsValid) {
          this.#logger.warn(
            `SchemaLoader: Schema '${schemaId}' loaded but has unresolved $refs. This may cause validation issues.`
          );
        } else {
          this.#logger.debug(
            `SchemaLoader: Schema '${schemaId}' loaded successfully with all $refs resolved.`
          );
        }
      }
    }

    // Log a summary of loaded schemas for debugging
    if (
      this.#validator.getLoadedSchemaIds &&
      typeof this.#validator.getLoadedSchemaIds === 'function'
    ) {
      const loadedIds = this.#validator.getLoadedSchemaIds();
      this.#logger.info(
        `SchemaLoader: Loaded ${loadedIds.length} schemas: ${loadedIds.join(', ')}`
      );
    }
  }

  /**
   * Gets a summary of schema loading status for debugging purposes.
   *
   * @returns {object} Summary object with loaded schemas and any issues
   */
  getSchemaLoadingSummary() {
    const summary = {
      totalConfigured: this.#config.getSchemaFiles().length,
      loadedSchemas: [],
      issues: [],
    };

    if (
      this.#validator.getLoadedSchemaIds &&
      typeof this.#validator.getLoadedSchemaIds === 'function'
    ) {
      summary.loadedSchemas = this.#validator.getLoadedSchemaIds();
    }

    // Check for common issues
    const criticalSchemas = [
      'http://example.com/schemas/common.schema.json',
      'http://example.com/schemas/world.schema.json',
      'http://example.com/schemas/entity-instance.schema.json',
    ];

    for (const schemaId of criticalSchemas) {
      if (!this.#validator.isSchemaLoaded(schemaId)) {
        summary.issues.push(`Critical schema '${schemaId}' not loaded`);
      } else if (
        this.#validator.validateSchemaRefs &&
        typeof this.#validator.validateSchemaRefs === 'function'
      ) {
        if (!this.#validator.validateSchemaRefs(schemaId)) {
          summary.issues.push(`Schema '${schemaId}' has unresolved $refs`);
        }
      }
    }

    return summary;
  }
}

export default SchemaLoader;
