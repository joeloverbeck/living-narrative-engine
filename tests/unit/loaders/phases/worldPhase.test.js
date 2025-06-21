// tests/unit/loaders/phases/worldPhase.test.js

import { jest } from '@jest/globals';
import { mock } from 'jest-mock-extended';
import WorldPhase from '../../../../src/loaders/phases/worldPhase.js';
import {
  ModsLoaderPhaseError,
  ModsLoaderErrorCode,
} from '../../../../src/errors/modsLoaderPhaseError.js';

describe('WorldPhase', () => {
  let worldLoader;
  let logger;
  let manifests;
  let worldPhase;

  beforeEach(() => {
    worldLoader = mock();
    logger = mock();
    manifests = new Map([['core', { id: 'core' }]]);
  });

  it('should instantiate correctly and assign properties', () => {
    // Arrange & Act
    worldPhase = new WorldPhase({ worldLoader, logger });

    // Assert
    expect(worldPhase.worldLoader).toBe(worldLoader);
    expect(worldPhase.logger).toBe(logger);
  });

  describe('execute', () => {
    beforeEach(() => {
      worldPhase = new WorldPhase({ worldLoader, logger });
    });

    it('should successfully call worldLoader.loadWorlds with correct parameters', async () => {
      // Arrange
      const ctx = {
        finalModOrder: ['core', 'modA'],
        totals: { components: 10, actions: 5 },
      };
      ctx.manifests = manifests;
      worldLoader.loadWorlds.mockResolvedValue(undefined);

      // Act
      await worldPhase.execute(ctx);

      // Assert
      expect(logger.info).toHaveBeenCalledWith('— WorldPhase starting —');
      expect(worldLoader.loadWorlds).toHaveBeenCalledWith(
        ctx.finalModOrder,
        ctx.manifests,
        ctx.totals
      );
      expect(worldLoader.loadWorlds).toHaveBeenCalledTimes(1);
    });

    it('should throw a ModsLoaderPhaseError when worldLoader.loadWorlds fails', async () => {
      // Arrange
      const originalError = new Error('Unknown definition in world file');
      worldLoader.loadWorlds.mockRejectedValue(originalError);
      const ctx = {
        finalModOrder: ['core'],
        totals: {},
      };
      ctx.manifests = manifests;

      // Act & Assert
      await expect(worldPhase.execute(ctx)).rejects.toThrow(
        ModsLoaderPhaseError
      );
    });

    it('should wrap the original error and set the correct error code on failure', async () => {
      // Arrange
      const originalError = new Error(
        'A critical world loading error occurred.'
      );
      originalError.stack = 'some stack trace';
      worldLoader.loadWorlds.mockRejectedValue(originalError);
      const ctx = {
        finalModOrder: ['core'],
        totals: {},
      };
      ctx.manifests = manifests;

      // Act
      let caughtError;
      try {
        await worldPhase.execute(ctx);
      } catch (e) {
        caughtError = e;
      }

      // Assert
      expect(caughtError).toBeInstanceOf(ModsLoaderPhaseError);
      expect(caughtError.code).toBe(ModsLoaderErrorCode.WORLD);
      expect(caughtError.message).toBe(originalError.message);
      expect(caughtError.phase).toBe('WorldPhase');
      // FIX: Changed 'originalError' to 'cause' to align with standard error wrapping.
      expect(caughtError.cause).toBe(originalError);
    });
  });
});
