import { describe, beforeEach, test, expect, jest } from '@jest/globals';
import { MoodPersistenceService } from '../../../../src/ai/services/MoodPersistenceService.js';
import {
  MOOD_COMPONENT_ID,
  SEXUAL_STATE_COMPONENT_ID,
} from '../../../../src/constants/componentIds.js';
import {
  COMPONENT_ADDED_ID,
  MOOD_STATE_UPDATED_ID,
} from '../../../../src/constants/eventIds.js';

describe('MoodPersistenceService', () => {
  let logger;
  let entityManager;
  let safeEventDispatcher;
  let service;

  beforeEach(() => {
    logger = {
      warn: jest.fn(),
      info: jest.fn(),
      error: jest.fn(),
      debug: jest.fn(),
    };
    entityManager = { getEntityInstance: jest.fn() };
    safeEventDispatcher = { dispatch: jest.fn() };
    service = new MoodPersistenceService({
      entityManager,
      safeEventDispatcher,
      logger,
    });
  });

  test('throws when entityManager lacks getEntityInstance', () => {
    expect(() => {
      new MoodPersistenceService({
        entityManager: {},
        safeEventDispatcher,
        logger,
      });
    }).toThrow('MoodPersistenceService: entityManager must expose getEntityInstance');
  });

  test('throws when safeEventDispatcher lacks dispatch', () => {
    expect(() => {
      new MoodPersistenceService({
        entityManager,
        safeEventDispatcher: {},
        logger,
      });
    }).toThrow('MoodPersistenceService: safeEventDispatcher must expose dispatch');
  });

  test('throws when logger lacks debug', () => {
    expect(() => {
      new MoodPersistenceService({
        entityManager,
        safeEventDispatcher,
        logger: {},
      });
    }).toThrow('MoodPersistenceService: logger must expose debug');
  });

  test('persists mood update and dispatches MOOD_STATE_UPDATED_ID', async () => {
    const oldMood = { valence: 0.1 };
    const newMood = { valence: 0.6 };
    const actorEntity = {
      hasComponent: jest.fn().mockReturnValue(true),
      getComponentData: jest
        .fn()
        .mockReturnValueOnce(oldMood)
        .mockReturnValueOnce(newMood),
      modifyComponent: jest.fn(),
    };
    entityManager.getEntityInstance.mockReturnValue(actorEntity);

    await service.persistMoodUpdate('actor1', newMood, null);

    expect(actorEntity.modifyComponent).toHaveBeenCalledWith(
      MOOD_COMPONENT_ID,
      newMood
    );
    expect(safeEventDispatcher.dispatch).toHaveBeenCalledWith(
      COMPONENT_ADDED_ID,
      {
        entity: actorEntity,
        componentTypeId: MOOD_COMPONENT_ID,
        componentData: newMood,
        oldComponentData: oldMood,
      }
    );
    expect(safeEventDispatcher.dispatch).toHaveBeenCalledWith(
      MOOD_STATE_UPDATED_ID,
      {
        actorId: 'actor1',
        moodUpdate: newMood,
        sexualUpdate: null,
      }
    );
  });

  test('persists sexual update and preserves baseline_libido', async () => {
    const current = { baseline_libido: 0.9 };
    const updated = {
      sex_excitation: 0.8,
      sex_inhibition: 0.1,
      baseline_libido: 0.9,
    };
    const actorEntity = {
      hasComponent: jest.fn().mockReturnValue(true),
      getComponentData: jest
        .fn()
        .mockReturnValueOnce(current)
        .mockReturnValueOnce(updated),
      modifyComponent: jest.fn(),
    };
    entityManager.getEntityInstance.mockReturnValue(actorEntity);

    const sexualUpdate = { sex_excitation: 0.8, sex_inhibition: 0.1 };
    await service.persistMoodUpdate('actor1', null, sexualUpdate);

    expect(actorEntity.modifyComponent).toHaveBeenCalledWith(
      SEXUAL_STATE_COMPONENT_ID,
      updated
    );
    expect(safeEventDispatcher.dispatch).toHaveBeenCalledWith(
      MOOD_STATE_UPDATED_ID,
      {
        actorId: 'actor1',
        moodUpdate: null,
        sexualUpdate,
      }
    );
  });

  test('logs warning and skips dispatch when entity not found', async () => {
    entityManager.getEntityInstance.mockReturnValue(null);

    await service.persistMoodUpdate('missing', { valence: 0.4 }, null);

    expect(logger.warn).toHaveBeenCalledWith(
      'MoodPersistenceService: Entity not found: missing'
    );
    expect(safeEventDispatcher.dispatch).not.toHaveBeenCalled();
  });

  test('skips MOOD_STATE_UPDATED_ID when no updates are applied', async () => {
    const actorEntity = {
      hasComponent: jest.fn().mockReturnValue(false),
      getComponentData: jest.fn(),
      modifyComponent: jest.fn(),
    };
    entityManager.getEntityInstance.mockReturnValue(actorEntity);

    await service.persistMoodUpdate('actor1', { valence: 0.4 }, null);

    expect(safeEventDispatcher.dispatch).not.toHaveBeenCalled();
  });
});
