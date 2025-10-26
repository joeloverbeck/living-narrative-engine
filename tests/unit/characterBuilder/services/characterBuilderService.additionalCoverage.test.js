/**
 * @file Additional coverage tests for CharacterBuilderService edge cases
 */

import {
  describe,
  it,
  expect,
  beforeEach,
  afterEach,
  jest,
} from '@jest/globals';
import {
  CharacterBuilderService,
  CHARACTER_BUILDER_EVENTS,
  CharacterBuilderError,
} from '../../../../src/characterBuilder/services/characterBuilderService.js';
import { CacheKeys } from '../../../../src/characterBuilder/cache/cacheHelpers.js';

const createBaseDependencies = () => ({
  logger: {
    debug: jest.fn(),
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
  },
  storageService: {
    initialize: jest.fn(),
    storeCharacterConcept: jest.fn(),
    listCharacterConcepts: jest.fn(),
    getCharacterConcept: jest.fn(),
    deleteCharacterConcept: jest.fn(),
    storeThematicDirections: jest.fn(),
    getThematicDirections: jest.fn(),
    getAllThematicDirections: jest.fn(),
    deleteThematicDirection: jest.fn(),
  },
  directionGenerator: {
    generateDirections: jest.fn(),
  },
  eventBus: {
    dispatch: jest.fn(),
  },
});

describe('CharacterBuilderService additional coverage', () => {
  let baseDeps;

  beforeEach(() => {
    baseDeps = createBaseDependencies();
  });

  afterEach(() => {
    jest.useRealTimers();
    jest.restoreAllMocks();
  });

  const createService = (overrides = {}) => {
    const deps = {
      logger: overrides.logger ?? baseDeps.logger,
      storageService: overrides.storageService ?? baseDeps.storageService,
      directionGenerator: overrides.directionGenerator ?? baseDeps.directionGenerator,
      eventBus: overrides.eventBus ?? baseDeps.eventBus,
      database: overrides.database ?? null,
      cacheManager: overrides.cacheManager ?? null,
      initialClicheCache: overrides.initialClicheCache ?? null,
      initialMotivationCache: overrides.initialMotivationCache ?? null,
    };

    return new CharacterBuilderService(deps);
  };

  it('migrates legacy caches when cache manager is provided', () => {
    const initialCliche = ['direction-1', { data: { id: 'cliche-1' } }];
    const initialMotivation = ['motivation-key', { data: [{ id: 'motivation-1' }] }];
    const cacheManager = { set: jest.fn(), get: jest.fn() };

    createService({
      cacheManager,
      initialClicheCache: new Map([initialCliche]),
      initialMotivationCache: [initialMotivation],
    });

    expect(cacheManager.set).toHaveBeenCalledWith(
      initialCliche[0],
      initialCliche[1].data,
      'cliches'
    );
    expect(cacheManager.set).toHaveBeenCalledWith(
      initialMotivation[0],
      initialMotivation[1].data,
      'motivations'
    );
  });

  it('ignores non-iterable cache seeds without throwing', async () => {
    const service = createService({
      initialClicheCache: { legacy: true },
      initialMotivationCache: Object.create(null),
    });

    const result = await service.getClichesByDirectionId('direction-legacy');

    expect(result).toBeNull();
    expect(baseDeps.logger.warn).toHaveBeenCalledWith(
      'Database not available for cliché operations'
    );
  });

  it('retries concept creation with exponential backoff before failing', async () => {
    const setTimeoutSpy = jest
      .spyOn(global, 'setTimeout')
      .mockImplementation((callback, delay) => {
        callback();
        return delay;
      });
    const storageError = new Error('Save failed');
    baseDeps.storageService.storeCharacterConcept.mockRejectedValue(storageError);

    const service = createService();

    await expect(
      service.createCharacterConcept('A valid concept')
    ).rejects.toThrow(
      'Failed to create character concept after 3 attempts: Save failed'
    );

    expect(baseDeps.storageService.storeCharacterConcept).toHaveBeenCalledTimes(3);
    expect(setTimeoutSpy).toHaveBeenNthCalledWith(1, expect.any(Function), 1);
    expect(setTimeoutSpy).toHaveBeenNthCalledWith(2, expect.any(Function), 2);
    expect(baseDeps.eventBus.dispatch).toHaveBeenCalledWith(
      CHARACTER_BUILDER_EVENTS.ERROR_OCCURRED,
      expect.objectContaining({ operation: 'createCharacterConcept' })
    );
  });

  it('blocks direction generation when circuit breaker cooldown is active', async () => {
    const service = createService();
    const breakerKey = 'directions_concept-1';
    const now = Date.now();

    jest.spyOn(Date, 'now').mockReturnValue(now);
    service.__setCircuitBreakerStateForTests(breakerKey, {
      failures: 5,
      lastFailureTime: now - 1000,
    });

    await expect(
      service.generateThematicDirections('concept-1')
    ).rejects.toThrow(
      'Service temporarily unavailable for concept concept-1. Too many recent failures.'
    );
  });

  it('resets circuit breaker when cooldown has elapsed', async () => {
    const conceptId = 'concept-1';
    const direction = { id: 'direction-1' };
    baseDeps.storageService.getCharacterConcept.mockResolvedValue({
      id: conceptId,
      concept: 'A concept',
    });
    baseDeps.directionGenerator.generateDirections.mockResolvedValue([direction]);
    baseDeps.storageService.storeThematicDirections.mockResolvedValue([direction]);

    const service = createService();
    const breakerKey = `directions_${conceptId}`;
    service.__setCircuitBreakerStateForTests(breakerKey, {
      failures: 5,
      lastFailureTime: Date.now() - 10 * 60 * 1000,
    });

    const result = await service.generateThematicDirections(conceptId);

    expect(result).toEqual([direction]);
    expect(
      service.__getCircuitBreakerStateForTests(breakerKey).failures
    ).toBe(0);
  });

  it('wraps storage errors when listing all thematic directions', async () => {
    const failure = new Error('Database offline');
    baseDeps.storageService.getAllThematicDirections.mockRejectedValue(failure);

    const service = createService();

    await expect(service.getAllThematicDirections()).rejects.toThrow(
      'Failed to get all thematic directions: Database offline'
    );
    expect(baseDeps.logger.error).toHaveBeenCalledWith(
      'Failed to get all thematic directions: Database offline',
      failure
    );
  });

  it('logs batch fetch failures when retrieving multiple clichés', async () => {
    const databaseError = new Error('lookup failed');
    const database = {
      getClicheByDirectionId: jest.fn().mockRejectedValue(databaseError),
    };

    const service = createService({ database });

    const result = await service.getClichesForDirections(['direction-1']);

    expect(result.size).toBe(0);
    expect(baseDeps.logger.error).toHaveBeenCalledWith(
      'Batch fetch failed:',
      databaseError
    );
  });

  it('throws when deleting clichés without a database connection', async () => {
    const service = createService();
    const cliche = { id: 'c1' };
    jest
      .spyOn(service, 'getClichesByDirectionId')
      .mockResolvedValue(cliche);

    await expect(
      service.deleteClichesForDirection('direction-1')
    ).rejects.toThrow('Database not available for cliché deletion');
  });

  it('throws when removing a cliché item for an unknown direction', async () => {
    const service = createService();
    jest
      .spyOn(service, 'getClichesByDirectionId')
      .mockResolvedValue(null);

    await expect(
      service.removeClicheItem('direction-1', 'names', 'Item text')
    ).rejects.toThrow(
      'No clichés found for direction: direction-1'
    );
  });

  it('surfaces cache updates errors when no database is configured', async () => {
    const directionId = 'direction-1';
    const updatedCliche = {
      id: 'cliche-1',
      conceptId: 'concept-1',
      directionId,
      getTotalCount: jest.fn().mockReturnValue(3),
      toJSON: jest.fn().mockReturnValue({ id: 'cliche-1' }),
    };
    const cachedCliche = {
      conceptId: 'concept-1',
      directionId,
      createWithItemRemoved: jest.fn().mockReturnValue(updatedCliche),
    };

    const service = createService({
      initialClicheCache: new Map([
        [directionId, { data: cachedCliche, timestamp: Date.now() }],
      ]),
    });

    const removalPromise = service
      .removeClicheItem(directionId, 'names', 'Item text')
      .catch((error) => {
        expect(error).toBeInstanceOf(CharacterBuilderError);
        throw error;
      });

    await expect(removalPromise).rejects.toThrow(
      'Database not available for cliché update'
    );
    expect(cachedCliche.createWithItemRemoved).toHaveBeenCalledWith(
      'names',
      'Item text'
    );
    expect(baseDeps.eventBus.dispatch).not.toHaveBeenCalled();
  });

  it('removes a cliché item and refreshes cache', async () => {
    const database = {
      updateCliche: jest.fn().mockResolvedValue(),
    };
    const updatedCliche = {
      id: 'cliche-1',
      conceptId: 'concept-1',
      directionId: 'direction-1',
      getTotalCount: jest.fn().mockReturnValue(4),
      toJSON: jest.fn().mockReturnValue({ id: 'cliche-1' }),
    };
    const existingCliche = {
      createWithItemRemoved: jest.fn().mockReturnValue(updatedCliche),
    };

    const service = createService({ database });
    jest
      .spyOn(service, 'getClichesByDirectionId')
      .mockResolvedValue(existingCliche);

    const result = await service.removeClicheItem(
      'direction-1',
      'names',
      'Item text'
    );

    expect(result).toBe(updatedCliche);
    expect(database.updateCliche).toHaveBeenCalledWith(
      'cliche-1',
      { id: 'cliche-1' }
    );
    expect(existingCliche.createWithItemRemoved).toHaveBeenCalledWith(
      'names',
      'Item text'
    );
    expect(baseDeps.eventBus.dispatch).toHaveBeenCalledWith(
      CHARACTER_BUILDER_EVENTS.CLICHE_ITEM_DELETED,
      expect.objectContaining({ directionId: 'direction-1', categoryId: 'names' })
    );
  });

  it('throws when removing a trope for an unknown direction', async () => {
    const service = createService();
    jest
      .spyOn(service, 'getClichesByDirectionId')
      .mockResolvedValue(null);

    await expect(
      service.removeClicheTrope('direction-1', 'Trope text')
    ).rejects.toThrow(
      'No clichés found for direction: direction-1'
    );
  });

  it('removes a cliché trope and refreshes cache', async () => {
    const database = {
      updateCliche: jest.fn().mockResolvedValue(),
    };
    const updatedCliche = {
      id: 'cliche-2',
      conceptId: 'concept-2',
      directionId: 'direction-2',
      getTotalCount: jest.fn().mockReturnValue(2),
      toJSON: jest.fn().mockReturnValue({ id: 'cliche-2' }),
    };
    const existingCliche = {
      createWithTropeRemoved: jest.fn().mockReturnValue(updatedCliche),
    };

    const service = createService({ database });
    jest
      .spyOn(service, 'getClichesByDirectionId')
      .mockResolvedValue(existingCliche);

    const result = await service.removeClicheTrope(
      'direction-2',
      'Overused trope'
    );

    expect(result).toBe(updatedCliche);
    expect(database.updateCliche).toHaveBeenCalledWith(
      'cliche-2',
      { id: 'cliche-2' }
    );
    expect(existingCliche.createWithTropeRemoved).toHaveBeenCalledWith(
      'Overused trope'
    );
    expect(baseDeps.eventBus.dispatch).toHaveBeenCalledWith(
      CHARACTER_BUILDER_EVENTS.CLICHE_TROPE_DELETED,
      expect.objectContaining({ directionId: 'direction-2', tropeText: 'Overused trope' })
    );
  });

  it('returns cached core motivations through the cache manager', async () => {
    const cachedMotivations = [{ id: 'motivation-1' }];
    const cacheManager = {
      set: jest.fn(),
      get: jest.fn().mockReturnValue(cachedMotivations),
    };

    const service = createService({ cacheManager });

    const result = await service.getCoreMotivationsByDirectionId('direction-1');

    expect(result).toBe(cachedMotivations);
    expect(cacheManager.get).toHaveBeenCalledWith(
      CacheKeys.motivationsForDirection('direction-1')
    );
    expect(baseDeps.eventBus.dispatch).toHaveBeenCalledWith(
      CHARACTER_BUILDER_EVENTS.CORE_MOTIVATIONS_RETRIEVED,
      expect.objectContaining({ directionId: 'direction-1', source: 'cache', count: 1 })
    );
  });
});

