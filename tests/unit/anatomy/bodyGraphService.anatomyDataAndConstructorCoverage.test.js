/**
 * @file Focused coverage tests for BodyGraphService constructor and anatomy data helpers.
 */

import { describe, it, expect, beforeEach, afterEach, jest } from '@jest/globals';
import BodyGraphService from '../../../src/anatomy/bodyGraphService.js';
import { AnatomyGraphAlgorithms } from '../../../src/anatomy/anatomyGraphAlgorithms.js';
import { AnatomyQueryCache } from '../../../src/anatomy/cache/AnatomyQueryCache.js';
import { InvalidArgumentError } from '../../../src/errors/invalidArgumentError.js';

describe('BodyGraphService constructor and anatomy data coverage', () => {
  let mockEntityManager;
  let mockLogger;
  let mockEventDispatcher;

  beforeEach(() => {
    mockEntityManager = {
      getComponentData: jest.fn(),
      removeComponent: jest.fn(),
    };

    mockLogger = {
      debug: jest.fn(),
      info: jest.fn(),
      warn: jest.fn(),
      error: jest.fn(),
    };

    mockEventDispatcher = {
      dispatch: jest.fn(),
    };
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  const createService = (overrides = {}) =>
    new BodyGraphService({
      entityManager: mockEntityManager,
      logger: mockLogger,
      eventDispatcher: mockEventDispatcher,
      ...overrides,
    });

  it('validates required dependencies during construction', () => {
    expect(
      () =>
        new BodyGraphService({
          logger: mockLogger,
          eventDispatcher: mockEventDispatcher,
        })
    ).toThrow(new InvalidArgumentError('entityManager is required'));

    expect(
      () =>
        new BodyGraphService({
          entityManager: mockEntityManager,
          logger: mockLogger,
        })
    ).toThrow(new InvalidArgumentError('eventDispatcher is required'));
  });

  it('creates a default query cache when none is provided', () => {
    const cacheSpy = jest
      .spyOn(AnatomyQueryCache.prototype, 'getCachedFindPartsByType')
      .mockReturnValue(['cached-part']);
    const algorithmSpy = jest.spyOn(
      AnatomyGraphAlgorithms,
      'findPartsByType'
    );

    const service = createService();
    const result = service.findPartsByType('root-entity', 'limb');

    expect(cacheSpy).toHaveBeenCalledWith('root-entity', 'limb');
    expect(algorithmSpy).not.toHaveBeenCalled();
    expect(result).toEqual(['cached-part']);
  });

  describe('getAnatomyData', () => {
    it('rejects invalid entity identifiers', async () => {
      const service = createService();

      await expect(service.getAnatomyData('')).rejects.toThrow(
        InvalidArgumentError
      );
      await expect(service.getAnatomyData(42)).rejects.toThrow(
        InvalidArgumentError
      );
    });

    it('logs and returns null when the anatomy component is absent', async () => {
      const service = createService();
      const entityId = 'actor-no-body';
      mockEntityManager.getComponentData.mockResolvedValueOnce(null);

      const result = await service.getAnatomyData(entityId);

      expect(result).toBeNull();
      expect(mockLogger.debug).toHaveBeenCalledWith(
        expect.stringContaining(
          `BodyGraphService.getAnatomyData: Getting anatomy data for entity '${entityId}'`
        )
      );
      expect(mockLogger.debug).toHaveBeenCalledWith(
        expect.stringContaining(
          `BodyGraphService.getAnatomyData: Entity '${entityId}' has no anatomy:body component`
        )
      );
    });

    it('normalizes anatomy component data and surfaces recipe information', async () => {
      const service = createService();
      mockLogger.debug.mockClear();

      mockEntityManager.getComponentData
        .mockResolvedValueOnce({})
        .mockResolvedValueOnce({ recipeId: 'recipe-123' });

      const nullRecipe = await service.getAnatomyData('actor-1');
      const withRecipe = await service.getAnatomyData('actor-2');

      expect(nullRecipe).toEqual({ recipeId: null, rootEntityId: 'actor-1' });
      expect(withRecipe).toEqual({
        recipeId: 'recipe-123',
        rootEntityId: 'actor-2',
      });
      expect(mockLogger.debug).toHaveBeenCalledWith(
        expect.stringContaining(
          "BodyGraphService.getAnatomyData: Getting anatomy data for entity 'actor-1'"
        )
      );
      expect(mockLogger.debug).toHaveBeenCalledWith(
        expect.stringContaining(
          "BodyGraphService.getAnatomyData: Getting anatomy data for entity 'actor-2'"
        )
      );
    });
  });
});
