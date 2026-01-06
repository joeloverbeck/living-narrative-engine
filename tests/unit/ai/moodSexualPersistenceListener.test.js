// tests/unit/ai/moodSexualPersistenceListener.test.js

import { describe, beforeEach, test, expect, jest } from '@jest/globals';
import { MoodSexualPersistenceListener } from '../../../src/ai/moodSexualPersistenceListener.js';
import {
  MOOD_COMPONENT_ID,
  SEXUAL_STATE_COMPONENT_ID,
} from '../../../src/constants/componentIds.js';
import { COMPONENT_ADDED_ID } from '../../../src/constants/eventIds.js';

describe('MoodSexualPersistenceListener', () => {
  let logger;
  let entityManager;
  let safeEventDispatcher;
  let listener;

  beforeEach(() => {
    logger = {
      warn: jest.fn(),
      info: jest.fn(),
      error: jest.fn(),
      debug: jest.fn(),
    };
    entityManager = { getEntityInstance: jest.fn() };
    safeEventDispatcher = { dispatch: jest.fn() };
    listener = new MoodSexualPersistenceListener({
      logger,
      entityManager,
      safeEventDispatcher,
    });
  });

  describe('constructor validation', () => {
    test('throws error when logger missing', () => {
      expect(() => {
        new MoodSexualPersistenceListener({ entityManager, safeEventDispatcher });
      }).toThrow('MoodSexualPersistenceListener: logger dependency is required');
    });

    test('throws error when entityManager missing', () => {
      expect(() => {
        new MoodSexualPersistenceListener({ logger, safeEventDispatcher });
      }).toThrow(
        'MoodSexualPersistenceListener: entityManager dependency is required'
      );
    });

    test('throws error when safeEventDispatcher missing', () => {
      expect(() => {
        new MoodSexualPersistenceListener({ logger, entityManager });
      }).toThrow(
        'MoodSexualPersistenceListener: safeEventDispatcher dependency is required'
      );
    });

    test('creates instance with valid dependencies', () => {
      expect(listener).toBeInstanceOf(MoodSexualPersistenceListener);
    });
  });

  describe('handleEvent - mood updates', () => {
    test('updates mood component when moodUpdate present', () => {
      const actorEntity = {
        hasComponent: jest.fn().mockReturnValue(true),
        getComponentData: jest.fn().mockReturnValue({ valence: 0.1 }),
        modifyComponent: jest.fn(),
      };
      entityManager.getEntityInstance.mockReturnValue(actorEntity);

      const moodUpdate = {
        valence: 0.7,
        arousal: 0.5,
        agency_control: 0.6,
        threat: 0.2,
        engagement: 0.8,
        future_expectancy: 0.6,
        self_evaluation: 0.7,
      };

      listener.handleEvent({
        payload: {
          actorId: 'actor1',
          extractedData: { moodUpdate },
        },
      });

      expect(entityManager.getEntityInstance).toHaveBeenCalledWith('actor1');
      expect(actorEntity.hasComponent).toHaveBeenCalledWith(MOOD_COMPONENT_ID);
      expect(actorEntity.modifyComponent).toHaveBeenCalledWith(
        MOOD_COMPONENT_ID,
        moodUpdate
      );
      expect(logger.info).toHaveBeenCalled();
    });

    test('dispatches COMPONENT_ADDED_ID event after mood update', () => {
      const oldMood = { valence: 0.1 };
      const newMood = { valence: 0.5 };
      const actorEntity = {
        hasComponent: jest.fn().mockReturnValue(true),
        getComponentData: jest
          .fn()
          .mockReturnValueOnce(oldMood)
          .mockReturnValueOnce(newMood),
        modifyComponent: jest.fn(),
      };
      entityManager.getEntityInstance.mockReturnValue(actorEntity);

      listener.handleEvent({
        payload: {
          actorId: 'actor1',
          extractedData: { moodUpdate: newMood },
        },
      });

      expect(safeEventDispatcher.dispatch).toHaveBeenCalledWith(
        COMPONENT_ADDED_ID,
        {
          entity: actorEntity,
          componentTypeId: MOOD_COMPONENT_ID,
          componentData: newMood,
          oldComponentData: oldMood,
        }
      );
    });

    test('logs warning when actor lacks mood component', () => {
      const actorEntity = {
        hasComponent: jest.fn().mockReturnValue(false),
        modifyComponent: jest.fn(),
      };
      entityManager.getEntityInstance.mockReturnValue(actorEntity);

      listener.handleEvent({
        payload: {
          actorId: 'actor1',
          extractedData: { moodUpdate: { valence: 0.5 } },
        },
      });

      expect(logger.warn).toHaveBeenCalledWith(
        `MoodSexualPersistenceListener: Actor actor1 lacks ${MOOD_COMPONENT_ID} component`
      );
      expect(actorEntity.modifyComponent).not.toHaveBeenCalled();
      expect(safeEventDispatcher.dispatch).not.toHaveBeenCalled();
    });
  });

  describe('handleEvent - sexual updates', () => {
    test('updates sexual_state component when sexualUpdate present', () => {
      const actorEntity = {
        hasComponent: jest.fn().mockReturnValue(true),
        getComponentData: jest.fn().mockReturnValue({ baseline_libido: 0.6 }),
        modifyComponent: jest.fn(),
      };
      entityManager.getEntityInstance.mockReturnValue(actorEntity);

      const sexualUpdate = {
        sex_excitation: 0.4,
        sex_inhibition: 0.3,
      };

      listener.handleEvent({
        payload: {
          actorId: 'actor1',
          extractedData: { sexualUpdate },
        },
      });

      expect(actorEntity.hasComponent).toHaveBeenCalledWith(
        SEXUAL_STATE_COMPONENT_ID
      );
      expect(actorEntity.getComponentData).toHaveBeenCalledWith(
        SEXUAL_STATE_COMPONENT_ID
      );
      expect(actorEntity.modifyComponent).toHaveBeenCalledWith(
        SEXUAL_STATE_COMPONENT_ID,
        {
          sex_excitation: 0.4,
          sex_inhibition: 0.3,
          baseline_libido: 0.6, // Preserved from existing component
        }
      );
      expect(logger.info).toHaveBeenCalled();
    });

    test('preserves baseline_libido when updating sexual state', () => {
      const actorEntity = {
        hasComponent: jest.fn().mockReturnValue(true),
        getComponentData: jest.fn().mockReturnValue({ baseline_libido: 0.9 }),
        modifyComponent: jest.fn(),
      };
      entityManager.getEntityInstance.mockReturnValue(actorEntity);

      listener.handleEvent({
        payload: {
          actorId: 'actor1',
          extractedData: {
            sexualUpdate: {
              sex_excitation: 0.8,
              sex_inhibition: 0.1,
            },
          },
        },
      });

      expect(actorEntity.modifyComponent).toHaveBeenCalledWith(
        SEXUAL_STATE_COMPONENT_ID,
        expect.objectContaining({ baseline_libido: 0.9 })
      );
    });

    test('dispatches COMPONENT_ADDED_ID event after sexual state update', () => {
      const oldSexual = { sex_excitation: 0.2, sex_inhibition: 0.7, baseline_libido: 0.5 };
      const newSexual = { sex_excitation: 0.4, sex_inhibition: 0.3, baseline_libido: 0.5 };
      const actorEntity = {
        hasComponent: jest.fn().mockReturnValue(true),
        getComponentData: jest
          .fn()
          .mockReturnValueOnce(oldSexual)
          .mockReturnValueOnce(newSexual),
        modifyComponent: jest.fn(),
      };
      entityManager.getEntityInstance.mockReturnValue(actorEntity);

      listener.handleEvent({
        payload: {
          actorId: 'actor1',
          extractedData: { sexualUpdate: { sex_excitation: 0.4, sex_inhibition: 0.3 } },
        },
      });

      expect(safeEventDispatcher.dispatch).toHaveBeenCalledWith(
        COMPONENT_ADDED_ID,
        {
          entity: actorEntity,
          componentTypeId: SEXUAL_STATE_COMPONENT_ID,
          componentData: newSexual,
          oldComponentData: oldSexual,
        }
      );
    });

    test('logs warning when actor lacks sexual_state component', () => {
      const actorEntity = {
        hasComponent: jest.fn().mockReturnValue(false),
        modifyComponent: jest.fn(),
      };
      entityManager.getEntityInstance.mockReturnValue(actorEntity);

      listener.handleEvent({
        payload: {
          actorId: 'actor1',
          extractedData: { sexualUpdate: { sex_excitation: 0.5 } },
        },
      });

      expect(logger.warn).toHaveBeenCalledWith(
        `MoodSexualPersistenceListener: Actor actor1 lacks ${SEXUAL_STATE_COMPONENT_ID} component`
      );
      expect(actorEntity.modifyComponent).not.toHaveBeenCalled();
      expect(safeEventDispatcher.dispatch).not.toHaveBeenCalled();
    });
  });

  describe('handleEvent - both updates', () => {
    test('updates both mood and sexual_state when both present', () => {
      const actorEntity = {
        hasComponent: jest.fn().mockReturnValue(true),
        getComponentData: jest.fn().mockReturnValue({ baseline_libido: 0.5 }),
        modifyComponent: jest.fn(),
      };
      entityManager.getEntityInstance.mockReturnValue(actorEntity);

      const moodUpdate = { valence: 0.6, arousal: 0.4 };
      const sexualUpdate = { sex_excitation: 0.3, sex_inhibition: 0.2 };

      listener.handleEvent({
        payload: {
          actorId: 'actor1',
          extractedData: { moodUpdate, sexualUpdate },
        },
      });

      expect(actorEntity.modifyComponent).toHaveBeenCalledTimes(2);
      expect(actorEntity.modifyComponent).toHaveBeenCalledWith(
        MOOD_COMPONENT_ID,
        moodUpdate
      );
      expect(actorEntity.modifyComponent).toHaveBeenCalledWith(
        SEXUAL_STATE_COMPONENT_ID,
        expect.objectContaining({
          sex_excitation: 0.3,
          sex_inhibition: 0.2,
          baseline_libido: 0.5,
        })
      );
    });

    test('dispatches COMPONENT_ADDED_ID events for both components', () => {
      const oldMood = { valence: 0.1 };
      const newMood = { valence: 0.6 };
      const oldSexual = { sex_excitation: 0.2, sex_inhibition: 0.7, baseline_libido: 0.5 };
      const newSexual = { sex_excitation: 0.3, sex_inhibition: 0.2, baseline_libido: 0.5 };
      const actorEntity = {
        hasComponent: jest.fn().mockReturnValue(true),
        getComponentData: jest
          .fn()
          .mockReturnValueOnce(oldMood)
          .mockReturnValueOnce(newMood)
          .mockReturnValueOnce(oldSexual)
          .mockReturnValueOnce(newSexual),
        modifyComponent: jest.fn(),
      };
      entityManager.getEntityInstance.mockReturnValue(actorEntity);

      listener.handleEvent({
        payload: {
          actorId: 'actor1',
          extractedData: {
            moodUpdate: { valence: 0.6 },
            sexualUpdate: { sex_excitation: 0.3, sex_inhibition: 0.2 },
          },
        },
      });

      expect(safeEventDispatcher.dispatch).toHaveBeenCalledTimes(2);
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
        COMPONENT_ADDED_ID,
        {
          entity: actorEntity,
          componentTypeId: SEXUAL_STATE_COMPONENT_ID,
          componentData: newSexual,
          oldComponentData: oldSexual,
        }
      );
    });
  });

  describe('handleEvent - no-op scenarios', () => {
    test('does nothing when event is null', () => {
      listener.handleEvent(null);

      expect(entityManager.getEntityInstance).not.toHaveBeenCalled();
    });

    test('does nothing when payload is null', () => {
      listener.handleEvent({});

      expect(entityManager.getEntityInstance).not.toHaveBeenCalled();
    });

    test('does nothing when extractedData is null', () => {
      listener.handleEvent({
        payload: { actorId: 'actor1', extractedData: null },
      });

      expect(entityManager.getEntityInstance).not.toHaveBeenCalled();
    });

    test('does nothing when neither moodUpdate nor sexualUpdate present', () => {
      listener.handleEvent({
        payload: {
          actorId: 'actor1',
          extractedData: { thoughts: 'some thoughts', notes: [] },
        },
      });

      expect(entityManager.getEntityInstance).not.toHaveBeenCalled();
    });
  });

  describe('handleEvent - entity not found', () => {
    test('logs warning when entity not found', () => {
      entityManager.getEntityInstance.mockReturnValue(null);

      listener.handleEvent({
        payload: {
          actorId: 'actor1',
          extractedData: { moodUpdate: { valence: 0.5 } },
        },
      });

      expect(logger.warn).toHaveBeenCalledWith(
        'MoodSexualPersistenceListener: Entity not found: actor1'
      );
    });
  });

  describe('handleEvent - error handling', () => {
    test('catches and logs errors without throwing', () => {
      const actorEntity = {
        hasComponent: jest.fn().mockReturnValue(true),
        getComponentData: jest.fn().mockReturnValue({ valence: 0.1 }),
        modifyComponent: jest.fn().mockImplementation(() => {
          throw new Error('Component update failed');
        }),
      };
      entityManager.getEntityInstance.mockReturnValue(actorEntity);

      // Should not throw
      expect(() => {
        listener.handleEvent({
          payload: {
            actorId: 'actor1',
            extractedData: { moodUpdate: { valence: 0.5 } },
          },
        });
      }).not.toThrow();

      expect(logger.error).toHaveBeenCalledWith(
        'MoodSexualPersistenceListener: Error updating state for actor1',
        expect.any(Error)
      );
    });

    test('catches errors from getEntityInstance without throwing', () => {
      entityManager.getEntityInstance.mockImplementation(() => {
        throw new Error('Database error');
      });

      expect(() => {
        listener.handleEvent({
          payload: {
            actorId: 'actor1',
            extractedData: { moodUpdate: { valence: 0.5 } },
          },
        });
      }).not.toThrow();

      expect(logger.error).toHaveBeenCalled();
    });
  });
});
