// tests/loaders/phases/contentPhase.test.js

import { jest } from '@jest/globals';
import ContentPhase from '../../../../src/loaders/phases/contentPhase.js';
import LoaderPhase from '../../../../src/loaders/phases/LoaderPhase.js';
import {
  ModsLoaderPhaseError,
  ModsLoaderErrorCode,
} from '../../../../src/errors/modsLoaderPhaseError.js';

describe('ContentPhase', () => {
  let mockManager;
  let mockLogger;
  let mockManifests;

  beforeEach(() => {
    mockManager = {
      loadContent: jest
        .fn()
        .mockImplementation((_order, _manifests, totals) => {
          // Simulate the manager mutating the totals object
          totals.components = { count: 10, overrides: 1, errors: 0 };
          return Promise.resolve();
        }),
    };
    mockLogger = {
      info: jest.fn(),
      error: jest.fn(),
    };
    mockManifests = new Map([['core', { id: 'core' }]]);
  });

  it('should be an instance of LoaderPhase', () => {
    const phase = new ContentPhase({
      manager: mockManager,
      logger: mockLogger,
    });
    expect(phase).toBeInstanceOf(LoaderPhase);
  });

  describe('execute', () => {
    it('should successfully call the content manager and create a snapshot of totals', async () => {
      // Arrange
      const phase = new ContentPhase({
        manager: mockManager,
        logger: mockLogger,
      });

      const ctx = {
        finalModOrder: ['core', 'modA'],
        totals: { actions: { count: 5, overrides: 0, errors: 0 } },
      };
      ctx.manifests = mockManifests;
      const originalTotalsRef = ctx.totals;

      // Act
      await phase.execute(ctx);

      // Assert
      expect(mockLogger.info).toHaveBeenCalledWith('— ContentPhase starting —');
      expect(mockManager.loadContent).toHaveBeenCalledWith(
        ['core', 'modA'],
        ctx.manifests,
        originalTotalsRef // manager receives the original object to mutate
      );

      // Acceptance Criterion 1: Totals object reference changes after phase.
      expect(ctx.totals).not.toBe(originalTotalsRef);
      expect(ctx.totals).toEqual({
        actions: { count: 5, overrides: 0, errors: 0 },
        components: { count: 10, overrides: 1, errors: 0 },
      });
    });

    it('should throw a ModsLoaderPhaseError if content loading fails', async () => {
      // Arrange
      const underlyingError = new Error('Failed to load some content item');
      mockManager.loadContent.mockRejectedValue(underlyingError);

      const phase = new ContentPhase({
        manager: mockManager,
        logger: mockLogger,
      });

      const ctx = {
        finalModOrder: ['core'],
        totals: {},
      };
      ctx.manifests = mockManifests;

      // Act & Assert
      await expect(phase.execute(ctx)).rejects.toThrow(ModsLoaderPhaseError);

      try {
        await phase.execute(ctx);
      } catch (e) {
        // Acceptance Criterion 2: Error code equals 'content' on failure.
        expect(e).toBeInstanceOf(ModsLoaderPhaseError);
        expect(e.code).toBe(ModsLoaderErrorCode.CONTENT);
        expect(e.message).toBe(underlyingError.message);
        expect(e.phase).toBe('ContentPhase');
        expect(e.cause).toBe(underlyingError);
      }
    });
  });
});
