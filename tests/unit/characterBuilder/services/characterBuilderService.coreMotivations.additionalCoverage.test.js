/**
 * @file Additional coverage tests focused on core motivation flows within CharacterBuilderService
 */

import { describe, it, expect, afterEach, jest } from '@jest/globals';
import {
  CharacterBuilderService,
  CHARACTER_BUILDER_EVENTS,
} from '../../../../src/characterBuilder/services/characterBuilderService.js';
import { CacheInvalidation } from '../../../../src/characterBuilder/cache/cacheHelpers.js';
import { CoreMotivation } from '../../../../src/characterBuilder/models/coreMotivation.js';
import { ValidationError } from '../../../../src/errors/validationError.js';

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
    getThematicDirection: jest.fn(),
  },
  directionGenerator: {
    generateDirections: jest.fn(),
  },
  eventBus: {
    dispatch: jest.fn(),
  },
  database: {
    getCoreMotivationsByDirectionId: jest.fn(),
    saveCoreMotivations: jest.fn(),
    getCoreMotivationsCount: jest.fn(),
    deleteCoreMotivation: jest.fn(),
    deleteAllCoreMotivationsForDirection: jest.fn(),
    getCoreMotivationsByConceptId: jest.fn(),
    debugDumpAllCharacterConcepts: jest.fn(),
    debugDumpAllThematicDirections: jest.fn(),
    debugDumpAllCliches: jest.fn(),
    hasCoreMotivationsForDirection: jest.fn(),
  },
});

const createService = (overrides = {}) => {
  const base = createBaseDependencies();
  const dependencies = {
    ...base,
    ...overrides,
  };

  const service = new CharacterBuilderService({
    logger: dependencies.logger,
    storageService: dependencies.storageService,
    directionGenerator: dependencies.directionGenerator,
    eventBus: dependencies.eventBus,
    database: dependencies.database ?? null,
    cacheManager: dependencies.cacheManager ?? null,
    container: dependencies.container ?? null,
  });

  return { service, dependencies };
};

describe('CharacterBuilderService core motivation coverage', () => {
  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('dispatches success event after generating thematic directions', async () => {
    const overrides = createBaseDependencies();
    const conceptId = 'concept-123';
    const generatedDirections = [{ id: 'dir-1' }];

    const setTimeoutSpy = jest
      .spyOn(global, 'setTimeout')
      .mockImplementation(() => 0);

    overrides.storageService.getCharacterConcept.mockResolvedValue({
      id: conceptId,
      concept: 'A fully fleshed out character concept description.',
    });
    overrides.directionGenerator.generateDirections.mockResolvedValue(
      generatedDirections
    );
    overrides.storageService.storeThematicDirections.mockResolvedValue(
      generatedDirections
    );

    const { service, dependencies } = createService(overrides);

    const result = await service.generateThematicDirections(conceptId);

    expect(result).toEqual(generatedDirections);
    expect(dependencies.eventBus.dispatch).toHaveBeenCalledWith(
      CHARACTER_BUILDER_EVENTS.DIRECTIONS_GENERATED,
      expect.objectContaining({
        conceptId,
        directionCount: generatedDirections.length,
        autoSaved: true,
      })
    );

    setTimeoutSpy.mockRestore();
  });

  it('throws validation error when generating core motivations without cliches', async () => {
    const overrides = createBaseDependencies();
    const conceptId = 'concept-1';
    const directionId = 'direction-1';

    overrides.storageService.getCharacterConcept.mockResolvedValue({
      id: conceptId,
      concept: 'Valid concept content',
    });
    overrides.storageService.getThematicDirection.mockResolvedValue({
      id: directionId,
      conceptId,
      title: 'Direction title',
    });

    const { service } = createService({
      ...overrides,
      container: { resolve: jest.fn() },
    });

    await expect(
      service.generateCoreMotivationsForDirection(conceptId, directionId, [])
    ).rejects.toThrow(ValidationError);
  });

  it('logs validation warnings for generated core motivations', async () => {
    const overrides = createBaseDependencies();
    const conceptId = 'concept-2';
    const directionId = 'direction-2';
    const generator = {
      generate: jest.fn().mockResolvedValue([
        {
          coreDesire: 'Too short',
          internalContradiction: 'Tiny',
          centralQuestion: 'Small',
        },
      ]),
      getLastModelUsed: jest.fn().mockReturnValue('model-x'),
    };

    overrides.storageService.getCharacterConcept.mockResolvedValue({
      id: conceptId,
      concept: 'Another long form concept representation',
    });
    overrides.storageService.getThematicDirection.mockResolvedValue({
      id: directionId,
      conceptId,
      title: 'Direction title',
    });

    const { service, dependencies } = createService({
      ...overrides,
      container: {
        resolve: jest.fn().mockReturnValue(generator),
      },
    });

    const motivations = await service.generateCoreMotivationsForDirection(
      conceptId,
      directionId,
      [{ id: 'cliche-1' }]
    );

    expect(motivations).toHaveLength(1);
    expect(generator.generate).toHaveBeenCalled();
    expect(dependencies.logger.warn).toHaveBeenCalledWith(
      expect.stringContaining('Motivation validation issues')
    );
  });

  it('continues after cache manager errors when retrieving motivations', async () => {
    const overrides = createBaseDependencies();
    const cacheManager = {
      get: jest.fn().mockImplementation(() => {
        throw new Error('cache read failed');
      }),
      set: jest.fn().mockImplementation(() => {
        throw new Error('cache write failed');
      }),
      delete: jest.fn(),
    };

    const directionId = 'direction-5';
    const storedMotivation = new CoreMotivation({
      conceptId: 'concept-5',
      directionId,
      coreDesire: 'A meaningful desire that is long enough',
      internalContradiction: 'An internal conflict that exceeds minimum length',
      centralQuestion: 'How can purpose survive adversity?',
    });

    overrides.database.getCoreMotivationsByDirectionId.mockResolvedValue([
      storedMotivation.toJSON(),
    ]);

    const { service, dependencies } = createService({
      ...overrides,
      cacheManager,
    });

    const result = await service.getCoreMotivationsByDirectionId(directionId);

    expect(result).toHaveLength(1);
    expect(cacheManager.get).toHaveBeenCalled();
    expect(cacheManager.set).toHaveBeenCalled();
    expect(dependencies.logger.warn).toHaveBeenCalledWith(
      `Cache error for key motivations_${directionId}: cache read failed`
    );
    expect(dependencies.logger.warn).toHaveBeenCalledWith(
      `Failed to cache motivations for key motivations_${directionId}: cache write failed`
    );
    expect(dependencies.eventBus.dispatch).toHaveBeenCalledWith(
      CHARACTER_BUILDER_EVENTS.CORE_MOTIVATIONS_RETRIEVED,
      expect.objectContaining({
        directionId,
        source: 'database',
        count: 1,
      })
    );
  });

  it('returns empty list when database yields no motivations', async () => {
    const overrides = createBaseDependencies();
    const directionId = 'direction-10';
    overrides.database.getCoreMotivationsByDirectionId.mockResolvedValue(null);

    const { service, dependencies } = createService(overrides);

    const result = await service.getCoreMotivationsByDirectionId(directionId);

    expect(result).toEqual([]);
    expect(dependencies.eventBus.dispatch).toHaveBeenCalledWith(
      CHARACTER_BUILDER_EVENTS.CORE_MOTIVATIONS_RETRIEVED,
      expect.objectContaining({ directionId, source: 'database', count: 0 })
    );
  });

  it('saves motivations from model instances and invalidates caches', async () => {
    const overrides = createBaseDependencies();
    const directionId = 'direction-20';
    const conceptId = 'concept-20';
    const motivationInstance = new CoreMotivation({
      directionId,
      conceptId,
      coreDesire: 'A desire that clears minimum length requirements',
      internalContradiction:
        'An internal contradiction that easily exceeds the character limit',
      centralQuestion: 'What legacy will remain after the final act?',
    });
    const cacheManager = {
      delete: jest.fn(),
      set: jest.fn(),
      get: jest.fn(),
    };

    overrides.database.saveCoreMotivations.mockResolvedValue(['saved-1']);
    overrides.database.getCoreMotivationsCount.mockResolvedValue(1);

    const invalidateSpy = jest.spyOn(
      CacheInvalidation,
      'invalidateMotivations'
    );

    const { service, dependencies } = createService({
      ...overrides,
      cacheManager,
    });

    const saved = await service.saveCoreMotivations(directionId, [
      motivationInstance,
    ]);

    expect(saved).toEqual(['saved-1']);
    expect(dependencies.database.saveCoreMotivations).toHaveBeenCalledWith([
      motivationInstance.toJSON(),
    ]);
    expect(invalidateSpy).toHaveBeenCalledWith(
      cacheManager,
      directionId,
      conceptId
    );
    expect(dependencies.eventBus.dispatch).toHaveBeenCalledWith(
      CHARACTER_BUILDER_EVENTS.CORE_MOTIVATIONS_GENERATION_COMPLETED,
      expect.objectContaining({
        directionId,
        motivationIds: ['saved-1'],
      })
    );
  });

  it('logs and rethrows errors when saving motivations fails', async () => {
    const overrides = createBaseDependencies();
    const directionId = 'direction-21';
    const conceptId = 'concept-21';
    const motivationInstance = new CoreMotivation({
      directionId,
      conceptId,
      coreDesire: 'An adequately detailed desire for coverage',
      internalContradiction:
        'A contradiction that meets the minimum character requirement',
      centralQuestion: 'Which choice will define their fate?',
    });

    const failure = new Error('persist failed');
    overrides.database.saveCoreMotivations.mockRejectedValue(failure);

    const { service, dependencies } = createService(overrides);

    await expect(
      service.saveCoreMotivations(directionId, [motivationInstance])
    ).rejects.toThrow('persist failed');
    expect(dependencies.logger.error).toHaveBeenCalledWith(
      'Failed to save core motivations:',
      failure
    );
  });

  it('invalidates caches when removing a core motivation succeeds', async () => {
    const overrides = createBaseDependencies();
    const cacheManager = {
      delete: jest.fn(),
      get: jest.fn(),
      set: jest.fn(),
    };
    overrides.database.deleteCoreMotivation.mockResolvedValue(true);

    const invalidateSpy = jest.spyOn(
      CacheInvalidation,
      'invalidateMotivations'
    );

    const { service } = createService({
      ...overrides,
      cacheManager,
    });

    const result = await service.removeCoreMotivationItem(
      'direction-30',
      'motivation-1'
    );

    expect(result).toBe(true);
    expect(invalidateSpy).toHaveBeenCalledWith(cacheManager, 'direction-30');
  });

  it('logs export errors and rethrows them', async () => {
    const overrides = createBaseDependencies();
    const { service, dependencies } = createService(overrides);
    const error = new Error('lookup failed');
    jest
      .spyOn(service, 'getCoreMotivationsByDirectionId')
      .mockRejectedValue(error);

    await expect(
      service.exportCoreMotivationsToText('direction-99')
    ).rejects.toThrow('lookup failed');
    expect(dependencies.logger.error).toHaveBeenCalledWith(
      'Failed to export core motivations for direction direction-99:',
      error
    );
  });

  it('logs statistics errors and rethrows them', async () => {
    const overrides = createBaseDependencies();
    const { service, dependencies } = createService(overrides);
    const error = new Error('stats failure');
    jest
      .spyOn(service, 'getThematicDirectionsByConceptId')
      .mockRejectedValue(error);

    await expect(
      service.getCoreMotivationsStatistics('concept-77')
    ).rejects.toThrow('stats failure');
    expect(dependencies.logger.error).toHaveBeenCalledWith(
      'Failed to get core motivations statistics for concept concept-77:',
      error
    );
  });

  it('debugDumpDatabase warns when database is unavailable', async () => {
    const overrides = createBaseDependencies();
    const service = new CharacterBuilderService({
      logger: overrides.logger,
      storageService: overrides.storageService,
      directionGenerator: overrides.directionGenerator,
      eventBus: overrides.eventBus,
    });

    await service.debugDumpDatabase();

    expect(overrides.logger.warn).toHaveBeenCalledWith(
      'DEBUG: Database not available for debugging'
    );
  });

  it('debugDumpDatabase executes all dump operations', async () => {
    const overrides = createBaseDependencies();
    const { service, dependencies } = createService(overrides);

    await service.debugDumpDatabase();

    expect(
      dependencies.database.debugDumpAllCharacterConcepts
    ).toHaveBeenCalled();
    expect(
      dependencies.database.debugDumpAllThematicDirections
    ).toHaveBeenCalled();
    expect(dependencies.database.debugDumpAllCliches).toHaveBeenCalled();
    expect(dependencies.logger.debug).toHaveBeenCalledWith(
      'DEBUG: Database dump completed'
    );
  });

  it('debugDumpDatabase logs errors from database operations', async () => {
    const overrides = createBaseDependencies();
    const failure = new Error('dump failed');
    overrides.database.debugDumpAllCharacterConcepts.mockRejectedValue(failure);

    const { service, dependencies } = createService(overrides);

    await service.debugDumpDatabase();

    expect(dependencies.logger.error).toHaveBeenCalledWith(
      'DEBUG: Error during database dump:',
      failure
    );
  });
});
