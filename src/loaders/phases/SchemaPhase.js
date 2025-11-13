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
  /**
   * @param {object} params - Configuration parameters
   * @param {import('../../interfaces/coreServices.js').ISchemaLoader} params.schemaLoader - Service for loading and compiling schemas
   * @param {import('../../interfaces/coreServices.js').IConfiguration} params.config - Configuration service for getting schema IDs
   * @param {import('../../interfaces/coreServices.js').ISchemaValidator} params.validator - Service for validating schema loading
   * @param {import('../../interfaces/coreServices.js').ILogger} params.logger - Logger service
   */
  constructor({ schemaLoader, config, validator, logger }) {
    super('schema');

    // Debug logging for SchemaPhase construction
    if (logger) {
      logger.debug('SchemaPhase: Constructor starting...');
      logger.debug(
        `SchemaPhase: schemaLoader = ${schemaLoader ? 'provided' : 'missing'}`
      );
      logger.debug(`SchemaPhase: config = ${config ? 'provided' : 'missing'}`);
      logger.debug(
        `SchemaPhase: validator = ${validator ? 'provided' : 'missing'}`
      );
    }

    this.schemaLoader = schemaLoader;
    this.config = config;
    this.validator = validator;
    this.logger = logger;

    if (logger) {
      logger.debug('SchemaPhase: Constructor completed successfully');
    }
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

      // Pre-generate validators for improved startup performance
      // This optimizes validation by creating validators for all component schemas upfront
      try {
        if (
          typeof this.validator.preGenerateValidators === 'function' &&
          typeof this.validator.getLoadedComponentSchemas === 'function'
        ) {
          const componentSchemas =
            this.validator.getLoadedComponentSchemas();
          if (componentSchemas && componentSchemas.length > 0) {
            this.logger.debug(
              `SchemaPhase: Pre-generating validators for ${componentSchemas.length} component schemas...`
            );
            const startTime = Date.now();

            this.validator.preGenerateValidators(componentSchemas);

            const duration = Date.now() - startTime;
            this.logger.info(
              `SchemaPhase: Pre-generated validators for ${componentSchemas.length} components in ${duration}ms`
            );
          }
        }
      } catch (preGenError) {
        // Log but don't fail - pre-generation is an optimization, not critical
        this.logger.warn(
          'SchemaPhase: Failed to pre-generate validators (continuing without optimization):',
          preGenError
        );
      }

      // Return frozen context (no modifications in this phase)
      return Object.freeze({ ...ctx });
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
