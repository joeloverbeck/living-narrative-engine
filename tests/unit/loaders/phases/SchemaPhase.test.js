import { beforeEach, describe, expect, it, jest } from '@jest/globals';
import SchemaPhase from '../../../../src/loaders/phases/SchemaPhase.js';
import {
  ModsLoaderPhaseError,
  ModsLoaderErrorCode,
} from '../../../../src/errors/modsLoaderPhaseError.js';
import ESSENTIAL_SCHEMA_TYPES from '../../../../src/constants/essentialSchemas.js';

describe('SchemaPhase', () => {
  /** @type {any} */
  let mockSchemaLoader;
  /** @type {any} */
  let mockConfig;
  /** @type {any} */
  let mockValidator;
  /** @type {any} */
  let mockLogger;
  /** @type {SchemaPhase} */
  let schemaPhase;
  /** @type {any} */
  let mockLoadContext;

  beforeEach(() => {
    // Create mocks
    mockSchemaLoader = {
      loadAndCompileAllSchemas: jest.fn().mockResolvedValue(undefined),
    };

    mockConfig = {
      getContentTypeSchemaId: jest
        .fn()
        .mockImplementation((type) => `schema:${type}`),
    };

    mockValidator = {
      isSchemaLoaded: jest.fn().mockReturnValue(true),
      preGenerateValidators: undefined,
      getLoadedComponentSchemas: undefined,
    };

    mockLogger = {
      info: jest.fn(),
      debug: jest.fn(),
      warn: jest.fn(),
    };

    mockLoadContext = {
      worldName: 'test-world',
      requestedMods: [],
      finalModOrder: [],
      registry: {},
      totals: {},
      incompatibilities: 0,
    };

    // Create SchemaPhase instance
    schemaPhase = new SchemaPhase({
      schemaLoader: mockSchemaLoader,
      config: mockConfig,
      validator: mockValidator,
      logger: mockLogger,
    });
  });

  describe('constructor', () => {
    it('should create a SchemaPhase instance with the provided dependencies', () => {
      expect(schemaPhase).toBeInstanceOf(SchemaPhase);
      expect(schemaPhase.schemaLoader).toBe(mockSchemaLoader);
      expect(schemaPhase.config).toBe(mockConfig);
      expect(schemaPhase.validator).toBe(mockValidator);
      expect(schemaPhase.logger).toBe(mockLogger);
    });
  });

  describe('execute', () => {
    it('should successfully load schemas and verify essential schemas', async () => {
      // Arrange
      mockSchemaLoader.loadAndCompileAllSchemas.mockResolvedValue(undefined);
      mockValidator.isSchemaLoaded.mockReturnValue(true);

      // Act
      await schemaPhase.execute(mockLoadContext);

      // Assert
      expect(mockLogger.info).toHaveBeenCalledWith('— SchemaPhase starting —');
      expect(mockSchemaLoader.loadAndCompileAllSchemas).toHaveBeenCalledTimes(
        1
      );
      expect(mockValidator.isSchemaLoaded).toHaveBeenCalledTimes(
        ESSENTIAL_SCHEMA_TYPES.length
      );
      expect(mockLogger.debug).toHaveBeenCalledWith(
        'SchemaPhase: All schemas loaded and essential schemas verified.'
      );

      // Verify each essential schema type was checked
      ESSENTIAL_SCHEMA_TYPES.forEach((type) => {
        expect(mockConfig.getContentTypeSchemaId).toHaveBeenCalledWith(type);
        expect(mockValidator.isSchemaLoaded).toHaveBeenCalledWith(
          `schema:${type}`
        );
      });
    });

    it('should pre-generate validators when supported by the validator', async () => {
      const mockComponentSchemas = [
        'schema:component:one',
        'schema:component:two',
      ];
      mockValidator.getLoadedComponentSchemas = jest
        .fn()
        .mockReturnValue(mockComponentSchemas);
      mockValidator.preGenerateValidators = jest.fn();

      await schemaPhase.execute(mockLoadContext);

      expect(mockValidator.getLoadedComponentSchemas).toHaveBeenCalledTimes(1);
      expect(mockValidator.preGenerateValidators).toHaveBeenCalledWith(
        mockComponentSchemas
      );
      expect(mockLogger.debug).toHaveBeenCalledWith(
        'SchemaPhase: Pre-generating validators for 2 component schemas...'
      );
      expect(mockLogger.info).toHaveBeenCalledWith(
        expect.stringMatching(
          /SchemaPhase: Pre-generated validators for 2 components in \d+ms/
        )
      );
    });

    it('should log a warning if pre-generating validators throws an error', async () => {
      const mockError = new Error('pre-generation failed');
      mockValidator.getLoadedComponentSchemas = jest
        .fn()
        .mockReturnValue(['schema:component']);
      mockValidator.preGenerateValidators = jest.fn(() => {
        throw mockError;
      });

      await schemaPhase.execute(mockLoadContext);

      expect(mockLogger.warn).toHaveBeenCalledWith(
        'SchemaPhase: Failed to pre-generate validators (continuing without optimization):',
        mockError
      );
    });

    it('should throw ModsLoaderPhaseError when schema loading fails', async () => {
      // Arrange
      const schemaLoadError = new Error('Schema loading failed');
      mockSchemaLoader.loadAndCompileAllSchemas.mockRejectedValue(
        schemaLoadError
      );

      // Act & Assert
      await expect(schemaPhase.execute(mockLoadContext)).rejects.toThrow(
        ModsLoaderPhaseError
      );

      try {
        await schemaPhase.execute(mockLoadContext);
      } catch (error) {
        expect(error).toBeInstanceOf(ModsLoaderPhaseError);
        expect(error.code).toBe(ModsLoaderErrorCode.SCHEMA);
        expect(error.message).toBe('Schema loading failed');
        expect(error.phase).toBe('SchemaPhase');
        expect(error.cause).toBe(schemaLoadError);
      }
    });

    it('should throw ModsLoaderPhaseError when essential schema is missing (no id)', async () => {
      // Arrange
      mockConfig.getContentTypeSchemaId.mockReturnValue(null);

      // Act & Assert
      await expect(schemaPhase.execute(mockLoadContext)).rejects.toThrow(
        ModsLoaderPhaseError
      );

      try {
        await schemaPhase.execute(mockLoadContext);
      } catch (error) {
        expect(error).toBeInstanceOf(ModsLoaderPhaseError);
        expect(error.code).toBe(ModsLoaderErrorCode.SCHEMA);
        expect(error.message).toBe("Essential schema 'game' missing (no id).");
        expect(error.phase).toBe('SchemaPhase');
      }
    });

    it('should throw ModsLoaderPhaseError when essential schema is not loaded', async () => {
      // Arrange
      mockValidator.isSchemaLoaded.mockReturnValue(false);

      // Act & Assert
      await expect(schemaPhase.execute(mockLoadContext)).rejects.toThrow(
        ModsLoaderPhaseError
      );

      try {
        await schemaPhase.execute(mockLoadContext);
      } catch (error) {
        expect(error).toBeInstanceOf(ModsLoaderPhaseError);
        expect(error.code).toBe(ModsLoaderErrorCode.SCHEMA);
        expect(error.message).toBe(
          "Essential schema 'game' missing (schema:game)."
        );
        expect(error.phase).toBe('SchemaPhase');
      }
    });

    it('should throw ModsLoaderPhaseError with correct error code when validator fails', async () => {
      // Arrange - This is the specific acceptance criteria test
      mockValidator.isSchemaLoaded.mockReturnValue(false);

      // Act & Assert
      try {
        await schemaPhase.execute(mockLoadContext);
      } catch (error) {
        expect(error).toBeInstanceOf(ModsLoaderPhaseError);
        expect(error.code).toBe('schema'); // This is the acceptance criteria
        expect(error.phase).toBe('SchemaPhase');
      }
    });
  });
});
