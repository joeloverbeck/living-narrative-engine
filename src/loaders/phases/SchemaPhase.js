import LoaderPhase from './LoaderPhase.js';
import {
  ModsLoaderPhaseError,
  ModsLoaderErrorCode,
} from '../../errors/modsLoaderPhaseError.js';
import ESSENTIAL_SCHEMA_TYPES from '../../constants/essentialSchemas.js';

/**
 * @description Phase responsible for loading and compiling all schemas and verifying essential schemas are present.
 */
export default class SchemaPhase extends LoaderPhase {
  name = 'SchemaPhase';

  /**
   * @description Creates a new SchemaPhase instance.
   * @param {object} params - Configuration parameters
   * @param {import('../../interfaces/coreServices.js').ISchemaLoader} params.schemaLoader - Service for loading and compiling schemas
   * @param {import('../../interfaces/coreServices.js').IConfiguration} params.config - Configuration service for getting schema IDs
   * @param {import('../../interfaces/coreServices.js').ISchemaValidator} params.validator - Service for validating schema loading
   * @param {import('../../interfaces/coreServices.js').ILogger} params.logger - Logger service
   */
  constructor({ schemaLoader, config, validator, logger }) {
    super();
    this.schemaLoader = schemaLoader;
    this.config = config;
    this.validator = validator;
    this.logger = logger;
  }

  /**
   * @description Executes the schema loading and verification phase.
   * @param {import('../LoadContext.js').LoadContext} ctx - The load context
   * @returns {Promise<import('../LoadContext.js').LoadContext>}
   * @throws {ModsLoaderPhaseError} When schema loading fails or essential schemas are missing
   */
  async execute(ctx) {
    this.logger.info('— SchemaPhase starting —');

    try {
      // Load and compile all schemas
      await this.schemaLoader.loadAndCompileAllSchemas();

      // Verify all essential schemas are loaded
      for (const type of ESSENTIAL_SCHEMA_TYPES) {
        const id = this.config.getContentTypeSchemaId(type);
        if (!id || !this.validator.isSchemaLoaded(id)) {
          throw new Error(
            `Essential schema '${type}' missing (${id || 'no id'}).`
          );
        }
      }

      this.logger.debug(
        'SchemaPhase: All schemas loaded and essential schemas verified.'
      );
      return ctx;
    } catch (e) {
      throw new ModsLoaderPhaseError(
        ModsLoaderErrorCode.SCHEMA,
        e.message,
        'SchemaPhase',
        e
      );
    }
  }
}
