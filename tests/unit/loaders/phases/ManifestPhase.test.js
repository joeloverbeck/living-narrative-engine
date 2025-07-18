import { beforeEach, describe, expect, it, jest } from '@jest/globals';
import ManifestPhase from '../../../../src/loaders/phases/ManifestPhase.js';
import LoaderPhase from '../../../../src/loaders/phases/LoaderPhase.js';
import {
  ModsLoaderPhaseError,
  ModsLoaderErrorCode,
} from '../../../../src/errors/modsLoaderPhaseError.js';

describe('ManifestPhase', () => {
  /** @type {any} */
  let mockProcessor;
  /** @type {any} */
  let mockLogger;
  /** @type {ManifestPhase} */
  let manifestPhase;
  /** @type {any} */
  let mockLoadContext;

  beforeEach(() => {
    // Create mocks
    mockProcessor = {
      processManifests: jest.fn().mockResolvedValue({
        finalModOrder: ['core', 'modA', 'modB'],
        incompatibilityCount: 0,
      }),
    };

    mockLogger = {
      info: jest.fn(),
      debug: jest.fn(),
      error: jest.fn(),
    };

    mockLoadContext = {
      worldName: 'test-world',
      requestedMods: ['core', 'modA', 'modB'],
      finalModOrder: [],
      registry: {},
      totals: {},
      incompatibilities: 0,
    };

    // Create ManifestPhase instance
    manifestPhase = new ManifestPhase({
      processor: mockProcessor,
      logger: mockLogger,
    });
  });

  describe('constructor', () => {
    it('should create a ManifestPhase instance with the provided dependencies', () => {
      expect(manifestPhase).toBeInstanceOf(ManifestPhase);
      expect(manifestPhase).toBeInstanceOf(LoaderPhase);
      expect(manifestPhase.processor).toBe(mockProcessor);
      expect(manifestPhase.logger).toBe(mockLogger);
    });

    it('should properly assign all constructor parameters', () => {
      const processor = { processManifests: jest.fn() };
      const logger = { info: jest.fn() };

      const phase = new ManifestPhase({ processor, logger });

      expect(phase.processor).toBe(processor);
      expect(phase.logger).toBe(logger);
    });
  });

  describe('execute', () => {
    it('should successfully process manifests and leave previous ctx unchanged', async () => {
      // Arrange
      const expectedResult = {
        finalModOrder: ['core', 'modA', 'modB'],
        incompatibilityCount: 2,
        loadedManifestsMap: new Map([['core', { id: 'core' }]]),
      };
      mockProcessor.processManifests.mockResolvedValue(expectedResult);
      Object.freeze(mockLoadContext);
      Object.freeze(mockLoadContext.requestedMods);
      Object.freeze(mockLoadContext.totals);

      // Act
      const result = await manifestPhase.execute(mockLoadContext);

      // Assert
      expect(mockLogger.info).toHaveBeenCalledWith(
        '— ManifestPhase starting —'
      );
      expect(mockProcessor.processManifests).toHaveBeenCalledWith(
        mockLoadContext.requestedMods,
        mockLoadContext.worldName
      );
      expect(mockProcessor.processManifests).toHaveBeenCalledTimes(1);

      // Verify returned context was updated
      expect(result.finalModOrder).toEqual(expectedResult.finalModOrder);
      expect(result.incompatibilities).toBe(
        expectedResult.incompatibilityCount
      );
      expect(result.manifests).toBe(expectedResult.loadedManifestsMap);

      // Original context remains unchanged
      expect(mockLoadContext.finalModOrder).toEqual([]);
      expect(mockLoadContext.incompatibilities).toBe(0);

      // Verify the result is frozen
      expect(() => {
        result.newProperty = 'test';
      }).toThrow(TypeError);
    });

    it('should handle successful processing with zero incompatibilities', async () => {
      // Arrange
      const expectedResult = {
        finalModOrder: ['core'],
        incompatibilityCount: 0,
        loadedManifestsMap: new Map(),
      };
      mockProcessor.processManifests.mockResolvedValue(expectedResult);

      // Act
      const result = await manifestPhase.execute(mockLoadContext);

      // Assert
      expect(result.finalModOrder).toEqual(['core']);
      expect(result.incompatibilities).toBe(0);
    });

    it('should handle successful processing with multiple incompatibilities', async () => {
      // Arrange
      const expectedResult = {
        finalModOrder: ['core', 'modA'],
        incompatibilityCount: 5,
        loadedManifestsMap: new Map(),
      };
      mockProcessor.processManifests.mockResolvedValue(expectedResult);

      // Act
      const result = await manifestPhase.execute(mockLoadContext);

      // Assert
      expect(result.finalModOrder).toEqual(['core', 'modA']);
      expect(result.incompatibilities).toBe(5);
    });

    it('should throw ModsLoaderPhaseError when manifest processing fails', async () => {
      // Arrange
      const processingError = new Error('Dependency resolution failed');
      mockProcessor.processManifests.mockRejectedValue(processingError);

      // Act & Assert
      await expect(manifestPhase.execute(mockLoadContext)).rejects.toThrow(
        ModsLoaderPhaseError
      );

      try {
        await manifestPhase.execute(mockLoadContext);
      } catch (error) {
        expect(error).toBeInstanceOf(ModsLoaderPhaseError);
        expect(error.code).toBe(ModsLoaderErrorCode.MANIFEST);
        expect(error.message).toBe('Dependency resolution failed');
        expect(error.phase).toBe('ManifestPhase');
        expect(error.cause).toBe(processingError);
      }
    });

    it('should throw ModsLoaderPhaseError when processor throws different error types', async () => {
      // Arrange
      const validationError = new TypeError('Invalid manifest format');
      mockProcessor.processManifests.mockRejectedValue(validationError);

      // Act & Assert
      try {
        await manifestPhase.execute(mockLoadContext);
      } catch (error) {
        expect(error).toBeInstanceOf(ModsLoaderPhaseError);
        expect(error.code).toBe(ModsLoaderErrorCode.MANIFEST);
        expect(error.message).toBe('Invalid manifest format');
        expect(error.phase).toBe('ManifestPhase');
        expect(error.cause).toBe(validationError);
      }
    });

    it('should throw ModsLoaderPhaseError when processor returns null', async () => {
      // Arrange
      mockProcessor.processManifests.mockResolvedValue(null);

      // Act & Assert
      try {
        await manifestPhase.execute(mockLoadContext);
      } catch (error) {
        expect(error).toBeInstanceOf(ModsLoaderPhaseError);
        expect(error.code).toBe(ModsLoaderErrorCode.MANIFEST);
        expect(error.phase).toBe('ManifestPhase');
      }
    });

    it('should throw ModsLoaderPhaseError when processor returns undefined', async () => {
      // Arrange
      mockProcessor.processManifests.mockResolvedValue(undefined);

      // Act & Assert
      try {
        await manifestPhase.execute(mockLoadContext);
      } catch (error) {
        expect(error).toBeInstanceOf(ModsLoaderPhaseError);
        expect(error.code).toBe(ModsLoaderErrorCode.MANIFEST);
        expect(error.phase).toBe('ManifestPhase');
      }
    });

    it('should handle empty requestedMods array', async () => {
      // Arrange
      const emptyContext = {
        ...mockLoadContext,
        requestedMods: [],
      };
      const expectedResult = {
        finalModOrder: [],
        incompatibilityCount: 0,
        loadedManifestsMap: new Map(),
      };
      mockProcessor.processManifests.mockResolvedValue(expectedResult);

      // Act
      const result = await manifestPhase.execute(emptyContext);

      // Assert
      expect(mockProcessor.processManifests).toHaveBeenCalledWith(
        [],
        'test-world'
      );
      expect(result.finalModOrder).toEqual([]);
      expect(result.incompatibilities).toBe(0);
    });

    it('should handle single mod in requestedMods', async () => {
      // Arrange
      const singleModContext = {
        ...mockLoadContext,
        requestedMods: ['core'],
      };
      const expectedResult = {
        finalModOrder: ['core'],
        incompatibilityCount: 0,
        loadedManifestsMap: new Map(),
      };
      mockProcessor.processManifests.mockResolvedValue(expectedResult);

      // Act
      const result = await manifestPhase.execute(singleModContext);

      // Assert
      expect(mockProcessor.processManifests).toHaveBeenCalledWith(
        ['core'],
        'test-world'
      );
      expect(result.finalModOrder).toEqual(['core']);
      expect(result.incompatibilities).toBe(0);
    });

    it('should preserve existing context properties not modified by the phase', async () => {
      // Arrange
      const contextWithExtraProps = {
        ...mockLoadContext,
        someExtraProperty: 'should remain unchanged',
        totals: { existing: 'data' },
      };
      const expectedResult = {
        finalModOrder: ['core'],
        incompatibilityCount: 1,
        loadedManifestsMap: new Map(),
      };
      mockProcessor.processManifests.mockResolvedValue(expectedResult);

      // Act
      const result = await manifestPhase.execute(contextWithExtraProps);

      // Assert
      expect(result.someExtraProperty).toBe('should remain unchanged');
      expect(result.totals).toEqual({ existing: 'data' });
      expect(result.finalModOrder).toEqual(['core']);
      expect(result.incompatibilities).toBe(1);
    });
  });
});
