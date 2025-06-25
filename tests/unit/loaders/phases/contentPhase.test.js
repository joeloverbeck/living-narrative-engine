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
      Object.freeze(ctx);
      Object.freeze(ctx.totals);
      const originalTotalsRef = ctx.totals;

      // Act
      const result = await phase.execute(ctx);

      // Assert
      expect(mockLogger.info).toHaveBeenCalledWith('— ContentPhase starting —');
      expect(mockManager.loadContent).toHaveBeenCalledWith(
        ['core', 'modA'],
        ctx.manifests,
        expect.any(Object)
      );
      expect(mockManager.loadContent.mock.calls[0][2]).not.toBe(originalTotalsRef);

      // Acceptance Criterion 1: Totals object reference changes after phase.
      expect(result.totals).not.toBe(originalTotalsRef);
      expect(result.totals).toEqual({
        actions: { count: 5, overrides: 0, errors: 0 },
        components: { count: 10, overrides: 1, errors: 0 },
      });

      // Original ctx should remain unchanged
      expect(ctx.totals).toEqual({ actions: { count: 5, overrides: 0, errors: 0 } });

      // Verify the result is frozen
      expect(() => {
        result.newProperty = 'test';
      }).toThrow(TypeError);

      // Verify the totals object is not frozen (needs to be mutable for aggregators)
      expect(() => {
        result.totals.newProperty = 'test';
      }).not.toThrow(TypeError);
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
      Object.freeze(ctx);
      Object.freeze(ctx.totals);

      await expect(phase.execute(ctx)).rejects.toMatchObject({
        code: ModsLoaderErrorCode.CONTENT,
        message: underlyingError.message,
        phase: 'ContentPhase',
        cause: underlyingError,
      });
    });
  });
});
