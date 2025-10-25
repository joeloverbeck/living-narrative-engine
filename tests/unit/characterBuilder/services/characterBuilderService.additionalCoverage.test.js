/**
 * @file Additional unit tests for CharacterBuilderService focusing on hard-to-reach
 *       branches and defensive error handling paths.
 */

import {
  describe,
  it,
  expect,
  jest,
  afterEach,
} from '@jest/globals';
import {
  CharacterBuilderService,
  CharacterBuilderError,
  CHARACTER_BUILDER_EVENTS,
} from '../../../../src/characterBuilder/services/characterBuilderService.js';
import { CoreMotivation } from '../../../../src/characterBuilder/models/coreMotivation.js';
import { CacheInvalidation } from '../../../../src/characterBuilder/cache/cacheHelpers.js';
import { ValidationError } from '../../../../src/errors/validationError.js';

const buildService = (overrides = {}) => {
  const logger =
    overrides.logger ??
    {
      debug: jest.fn(),
      info: jest.fn(),
      warn: jest.fn(),
      error: jest.fn(),
    };

  const storageService =
    overrides.storageService ??
    ({
      initialize: jest.fn().mockResolvedValue(),
      storeCharacterConcept: jest.fn(),
      listCharacterConcepts: jest.fn(),
      getCharacterConcept: jest
        .fn()
        .mockResolvedValue({
          id: 'concept-1',
          concept: 'A stoic wanderer seeking redemption.',
        }),
      deleteCharacterConcept: jest.fn(),
      storeThematicDirections: jest.fn(),
      getThematicDirections: jest.fn().mockResolvedValue([]),
      getThematicDirection: jest
        .fn()
        .mockResolvedValue({
          id: 'direction-1',
          conceptId: 'concept-1',
          title: 'Haunted Wanderer',
        }),
      findOrphanedDirections: jest.fn(),
    });

  const directionGenerator =
    overrides.directionGenerator ?? ({ generateDirections: jest.fn() });

  const eventBus = overrides.eventBus ?? { dispatch: jest.fn() };

  const defaultDatabase = {
    getClicheByDirectionId: jest.fn(),
    saveCliche: jest.fn(),
    deleteCliche: jest.fn(),
    addMetadata: jest.fn(),
    getCoreMotivationsByDirectionId: jest.fn().mockResolvedValue([]),
    saveCoreMotivations: jest.fn().mockResolvedValue([]),
    getCoreMotivationsCount: jest.fn().mockResolvedValue(0),
    deleteCoreMotivation: jest.fn().mockResolvedValue(true),
    deleteAllCoreMotivationsForDirection: jest.fn().mockResolvedValue(0),
    getCoreMotivationsByConceptId: jest.fn().mockResolvedValue([]),
    hasCoreMotivationsForDirection: jest.fn().mockResolvedValue(false),
    debugDumpAllCharacterConcepts: jest.fn().mockResolvedValue(),
    debugDumpAllThematicDirections: jest.fn().mockResolvedValue(),
    debugDumpAllCliches: jest.fn().mockResolvedValue(),
  };

  const database = overrides.database === undefined ? defaultDatabase : overrides.database;

  const container =
    overrides.container ??
    {
      resolve: jest.fn(() => ({
        generate: jest.fn().mockResolvedValue([]),
        getLastModelUsed: jest.fn().mockReturnValue('model'),
      })),
    };

  const cacheManager = overrides.cacheManager ?? null;

  const service = new CharacterBuilderService({
    logger,
    storageService,
    directionGenerator,
    eventBus,
    database,
    schemaValidator: overrides.schemaValidator ?? null,
    clicheGenerator: overrides.clicheGenerator ?? null,
    traitsGenerator: overrides.traitsGenerator ?? null,
    container,
    cacheManager,
  });

  return {
    service,
    logger,
    storageService,
    directionGenerator,
    eventBus,
    database,
    container,
    cacheManager,
  };
};

afterEach(() => {
  jest.clearAllMocks();
  jest.restoreAllMocks();
  jest.useRealTimers();
});

describe('CharacterBuilderService additional coverage', () => {
  describe('Cliché error handling', () => {
    it('wraps unexpected errors when deleting clichés', async () => {
      const { service, logger } = buildService();
      jest
        .spyOn(service, 'getClichesByDirectionId')
        .mockRejectedValue(new Error('network down'));

      await expect(
        service.deleteClichesForDirection('direction-1')
      ).rejects.toThrow('Failed to delete clichés: network down');

      expect(logger.error).toHaveBeenCalledWith(
        'Failed to delete clichés for direction-1:',
        expect.any(Error)
      );
    });

    it('rethrows CharacterBuilderError when database is unavailable for updates', async () => {
      const { service } = buildService({ database: null });
      const fakeCliche = {
        conceptId: 'concept-1',
        directionId: 'direction-1',
        createWithItemRemoved: jest.fn().mockReturnValue({
          conceptId: 'concept-1',
          directionId: 'direction-1',
          getTotalCount: jest.fn().mockReturnValue(1),
        }),
      };

      jest
        .spyOn(service, 'getClichesByDirectionId')
        .mockResolvedValue(fakeCliche);

      const promise = service.removeClicheItem(
        'direction-1',
        'names',
        'Old Entry'
      );

      await expect(promise).rejects.toBeInstanceOf(CharacterBuilderError);
      await expect(promise).rejects.toThrow(
        'Database not available for cliché update'
      );
    });

    it('wraps unexpected errors when removing cliché items', async () => {
      const { service, logger } = buildService();
      const fakeCliche = {
        createWithItemRemoved: jest.fn(() => {
          throw new Error('mutation failure');
        }),
      };

      jest
        .spyOn(service, 'getClichesByDirectionId')
        .mockResolvedValue(fakeCliche);

      await expect(
        service.removeClicheItem('direction-1', 'names', 'Old Entry')
      ).rejects.toThrow('Failed to remove cliché item: mutation failure');

      expect(logger.error).toHaveBeenCalledWith(
        'Failed to remove cliché item for direction-1:',
        expect.any(Error)
      );
    });

    it('wraps unexpected errors when removing cliché tropes', async () => {
      const { service, logger } = buildService();
      const fakeCliche = {
        createWithTropeRemoved: jest.fn(() => {
          throw new Error('trope removal failed');
        }),
      };

      jest
        .spyOn(service, 'getClichesByDirectionId')
        .mockResolvedValue(fakeCliche);

      await expect(
        service.removeClicheTrope('direction-1', 'Chosen One')
      ).rejects.toThrow('Failed to remove cliché trope: trope removal failed');

      expect(logger.error).toHaveBeenCalledWith(
        'Failed to remove cliché trope for direction-1:',
        expect.any(Error)
      );
    });
  });

  describe('Core motivations generation', () => {
    it('rejects when cliché context is empty', async () => {
      const { service, storageService } = buildService();
      storageService.getCharacterConcept.mockResolvedValue({
        id: 'concept-1',
        concept: 'An enigmatic rogue.',
      });

      storageService.getThematicDirection.mockResolvedValue({
        id: 'direction-1',
        conceptId: 'concept-1',
        title: 'Shadow Operative',
      });

      await expect(
        service.generateCoreMotivationsForDirection('concept-1', 'direction-1', [])
      ).rejects.toThrow(ValidationError);
    });

    it('logs validation warnings for generated motivations', async () => {
      const generator = {
        generate: jest.fn().mockResolvedValue([
          {
            coreDesire: 'short',
            internalContradiction: 'short',
            centralQuestion: 'short',
          },
        ]),
        getLastModelUsed: jest.fn().mockReturnValue('gpt-test'),
      };

      const container = { resolve: jest.fn().mockReturnValue(generator) };
      const { service, storageService, logger } = buildService({ container });

      storageService.getCharacterConcept.mockResolvedValue({
        id: 'concept-1',
        concept: 'An enigmatic rogue.',
      });

      storageService.getThematicDirection.mockResolvedValue({
        id: 'direction-1',
        conceptId: 'concept-1',
        title: 'Shadow Operative',
      });

      const motivations = await service.generateCoreMotivationsForDirection(
        'concept-1',
        'direction-1',
        [{ id: 'cliche-1' }]
      );

      expect(Array.isArray(motivations)).toBe(true);
      expect(logger.warn).toHaveBeenCalledWith(
        expect.stringContaining('Motivation validation issues:' )
      );
    });
  });

  describe('Core motivations retrieval and caching', () => {
    it('logs cache errors and falls back to database retrieval', async () => {
      const cacheManager = {
        get: jest.fn(() => {
          throw new Error('cache offline');
        }),
        set: jest.fn(),
        delete: jest.fn(),
      };
      const { service, logger, database, eventBus } = buildService({ cacheManager });
      database.getCoreMotivationsByDirectionId.mockResolvedValue([]);

      const results = await service.getCoreMotivationsByDirectionId('direction-1');

      expect(results).toEqual([]);
      expect(logger.warn).toHaveBeenCalledWith(
        expect.stringContaining('cache offline')
      );
      expect(eventBus.dispatch).toHaveBeenCalledWith(
        CHARACTER_BUILDER_EVENTS.CORE_MOTIVATIONS_RETRIEVED,
        { directionId: 'direction-1', source: 'database', count: 0 }
      );
    });

    it('returns empty array when database has no motivations', async () => {
      const { service, database, eventBus } = buildService();
      database.getCoreMotivationsByDirectionId.mockResolvedValue(null);

      const results = await service.getCoreMotivationsByDirectionId('direction-1');

      expect(results).toEqual([]);
      expect(eventBus.dispatch).toHaveBeenCalledWith(
        CHARACTER_BUILDER_EVENTS.CORE_MOTIVATIONS_RETRIEVED,
        { directionId: 'direction-1', source: 'database', count: 0 }
      );
    });

    it('logs cache write failures without interrupting results', async () => {
      const cacheManager = {
        get: jest.fn().mockReturnValue(null),
        set: jest.fn(() => {
          throw new Error('write failed');
        }),
        delete: jest.fn(),
      };
      const { service, logger, database } = buildService({ cacheManager });
      database.getCoreMotivationsByDirectionId.mockResolvedValue([
        {
          directionId: 'direction-1',
          conceptId: 'concept-1',
          coreDesire: 'A heroic quest to save the realm',
          internalContradiction: 'A fear of leadership responsibilities',
          centralQuestion: 'Can they accept their destiny?',
        },
      ]);

      const results = await service.getCoreMotivationsByDirectionId('direction-1');

      expect(results).toHaveLength(1);
      expect(logger.warn).toHaveBeenCalledWith(
        expect.stringContaining('Failed to cache motivations')
      );
    });
  });

  describe('Core motivations persistence', () => {
    it('converts model instances and invalidates cache when saving', async () => {
      const cacheManager = { get: jest.fn(), set: jest.fn(), delete: jest.fn() };
      const { service, database, eventBus } = buildService({ cacheManager });
      const motivation = new CoreMotivation({
        directionId: 'direction-1',
        conceptId: 'concept-1',
        coreDesire: 'A long standing need to protect others',
        internalContradiction: 'A deep seated fear of attachment',
        centralQuestion: 'Can they allow themselves to care?',
      });

      const toJSONSpy = jest.spyOn(CoreMotivation.prototype, 'toJSON');
      const invalidateSpy = jest.spyOn(CacheInvalidation, 'invalidateMotivations');

      database.saveCoreMotivations.mockResolvedValue(['motivation-1']);
      database.getCoreMotivationsCount.mockResolvedValue(1);

      const savedIds = await service.saveCoreMotivations('direction-1', [motivation]);

      expect(savedIds).toEqual(['motivation-1']);
      expect(database.saveCoreMotivations).toHaveBeenCalledWith([
        expect.objectContaining({ directionId: 'direction-1' }),
      ]);
      expect(toJSONSpy).toHaveBeenCalled();
      expect(invalidateSpy).toHaveBeenCalledWith(
        cacheManager,
        'direction-1',
        motivation.conceptId
      );
      expect(eventBus.dispatch).toHaveBeenCalledWith(
        CHARACTER_BUILDER_EVENTS.CORE_MOTIVATIONS_GENERATION_COMPLETED,
        expect.objectContaining({ directionId: 'direction-1' })
      );
    });

    it('logs and rethrows errors when saving motivations fails', async () => {
      const { service, logger, database } = buildService();
      database.saveCoreMotivations.mockRejectedValue(new Error('db down'));

      await expect(
        service.saveCoreMotivations('direction-1', [
          {
            conceptId: 'concept-1',
            coreDesire: 'Protect the innocent',
            internalContradiction: 'Fear of failure',
            centralQuestion: 'Can they overcome self-doubt?',
          },
        ])
      ).rejects.toThrow('db down');

      expect(logger.error).toHaveBeenCalledWith(
        'Failed to save core motivations:',
        expect.any(Error)
      );
    });

    it('invalidates caches when removing individual motivations', async () => {
      const cacheManager = { get: jest.fn(), set: jest.fn(), delete: jest.fn() };
      const { service, database } = buildService({ cacheManager });
      database.deleteCoreMotivation.mockResolvedValue(true);
      const invalidateSpy = jest.spyOn(CacheInvalidation, 'invalidateMotivations');

      const result = await service.removeCoreMotivationItem(
        'direction-1',
        'motivation-1'
      );

      expect(result).toBe(true);
      expect(invalidateSpy).toHaveBeenCalledWith(cacheManager, 'direction-1');
    });

    it('logs and rethrows errors when removing motivations fails', async () => {
      const { service, logger, database } = buildService();
      database.deleteCoreMotivation.mockRejectedValue(new Error('delete failed'));

      await expect(
        service.removeCoreMotivationItem('direction-1', 'motivation-1')
      ).rejects.toThrow('delete failed');

      expect(logger.error).toHaveBeenCalledWith(
        'Failed to remove core motivation motivation-1:',
        expect.any(Error)
      );
    });
  });

  describe('Core motivations exports and statistics', () => {
    it('logs and rethrows errors when exporting motivations fails', async () => {
      const { service, logger } = buildService();
      jest
        .spyOn(service, 'getCoreMotivationsByDirectionId')
        .mockRejectedValue(new Error('export failed'));

      await expect(
        service.exportCoreMotivationsToText('direction-1')
      ).rejects.toThrow('export failed');

      expect(logger.error).toHaveBeenCalledWith(
        'Failed to export core motivations for direction direction-1:',
        expect.any(Error)
      );
    });

    it('logs and rethrows errors when statistics cannot be calculated', async () => {
      const { service, logger } = buildService();
      jest
        .spyOn(service, 'getThematicDirectionsByConceptId')
        .mockRejectedValue(new Error('statistics failed'));

      await expect(
        service.getCoreMotivationsStatistics('concept-1')
      ).rejects.toThrow('statistics failed');

      expect(logger.error).toHaveBeenCalledWith(
        'Failed to get core motivations statistics for concept concept-1:',
        expect.any(Error)
      );
    });
  });

  describe('Circuit breaker behaviour', () => {
    it('exposes circuit breaker state for cooldown enforcement', () => {
      const { service } = buildService();
      const now = Date.now();

      service.__setCircuitBreakerStateForTests('directions_concept-1', {
        failures: 5,
        lastFailureTime: now,
      });

      const state = service.__getCircuitBreakerStateForTests(
        'directions_concept-1'
      );

      expect(state).toEqual({ failures: 5, lastFailureTime: now });
    });
  });

  describe('Debug dump coverage', () => {
    it('warns and exits early when database is unavailable', async () => {
      const { service, logger } = buildService({ database: null });

      await service.debugDumpDatabase();

      expect(logger.warn).toHaveBeenCalledWith(
        'DEBUG: Database not available for debugging'
      );
    });

    it('performs debug dump when database is available', async () => {
      const { service, database, logger } = buildService();

      await service.debugDumpDatabase();

      expect(database.debugDumpAllCharacterConcepts).toHaveBeenCalled();
      expect(database.debugDumpAllThematicDirections).toHaveBeenCalled();
      expect(database.debugDumpAllCliches).toHaveBeenCalled();
      expect(logger.debug).toHaveBeenCalledWith('DEBUG: Database dump completed');
    });

    it('logs errors that occur during debug dump', async () => {
      const { service, database, logger } = buildService();
      const failure = new Error('dump failed');
      database.debugDumpAllCharacterConcepts.mockRejectedValue(failure);

      await service.debugDumpDatabase();

      expect(logger.error).toHaveBeenCalledWith(
        'DEBUG: Error during database dump:',
        failure
      );
    });
  });
});
