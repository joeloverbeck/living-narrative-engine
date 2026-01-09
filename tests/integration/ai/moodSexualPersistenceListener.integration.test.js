// tests/integration/ai/moodSexualPersistenceListener.integration.test.js

import {
  beforeEach,
  afterEach,
  describe,
  expect,
  it,
  jest,
} from '@jest/globals';
import { MoodSexualPersistenceListener } from '../../../src/ai/moodSexualPersistenceListener.js';
import { EntityManagerTestBed } from '../../common/entities/entityManagerTestBed.js';
import {
  MOOD_COMPONENT_ID,
  SEXUAL_STATE_COMPONENT_ID,
} from '../../../src/constants/componentIds.js';
import {
  ACTION_DECIDED_ID,
  COMPONENT_ADDED_ID,
} from '../../../src/constants/eventIds.js';

const ACTOR_ID = 'actor-mood-sexual';

describe('MoodSexualPersistenceListener integration with real services', () => {
  /** @type {EntityManagerTestBed} */
  let testBed;
  /** @type {{ debug: jest.Mock, warn: jest.Mock, error: jest.Mock, info: jest.Mock }} */
  let logger;
  /** @type {{ dispatch: jest.Mock }} */
  let safeEventDispatcher;
  /** @type {MoodSexualPersistenceListener} */
  let listener;

  beforeEach(() => {
    testBed = new EntityManagerTestBed();
    logger = {
      debug: jest.fn(),
      warn: jest.fn(),
      error: jest.fn(),
      info: jest.fn(),
    };
    safeEventDispatcher = { dispatch: jest.fn() };
    listener = new MoodSexualPersistenceListener({
      logger,
      entityManager: testBed.entityManager,
      safeEventDispatcher,
    });
  });

  afterEach(async () => {
    await testBed.cleanup();
    jest.restoreAllMocks();
  });

  /**
   * Creates an actor entity with mood and sexual_state components.
   *
   * @param {object} componentOverrides - Override component data.
   * @returns {Promise<import('../../../src/entities/entity.js').default>}
   */
  async function createActorWithMoodAndSexualState(componentOverrides = {}) {
    const defaultMood = {
      valence: 0.0,
      arousal: 0.5,
      agency_control: 0.5,
      threat: 0.0,
      engagement: 0.5,
      future_expectancy: 0.5,
      self_evaluation: 0.5,
    };
    const defaultSexualState = {
      sex_excitation: 0.0,
      sex_inhibition: 0.5,
      baseline_libido: 0.5,
    };

    return await testBed.createActorEntity({
      instanceId: ACTOR_ID,
      overrides: {
        [MOOD_COMPONENT_ID]: { ...defaultMood, ...componentOverrides.mood },
        [SEXUAL_STATE_COMPONENT_ID]: {
          ...defaultSexualState,
          ...componentOverrides.sexualState,
        },
      },
    });
  }

  describe('mood updates', () => {
    it('updates mood component using real entity manager', async () => {
      const actor = await createActorWithMoodAndSexualState();

      const moodUpdate = {
        valence: 0.8,
        arousal: 0.6,
        agency_control: 0.7,
        threat: 0.1,
        engagement: 0.9,
        future_expectancy: 0.7,
        self_evaluation: 0.8,
      };

      listener.handleEvent({
        type: ACTION_DECIDED_ID,
        payload: {
          actorId: actor.id,
          extractedData: { moodUpdate },
        },
      });

      const updatedMood = actor.getComponentData(MOOD_COMPONENT_ID);
      expect(updatedMood.valence).toBe(0.8);
      expect(updatedMood.arousal).toBe(0.6);
      expect(updatedMood.agency_control).toBe(0.7);
      expect(updatedMood.threat).toBe(0.1);
      expect(updatedMood.engagement).toBe(0.9);
      expect(updatedMood.future_expectancy).toBe(0.7);
      expect(updatedMood.self_evaluation).toBe(0.8);

      expect(logger.info).toHaveBeenCalledWith(
        expect.stringContaining('event received')
      );
      expect(logger.info).toHaveBeenCalledWith(
        expect.stringContaining('Updated mood'),
        expect.objectContaining({ valence: 0.8 })
      );

      // Verify COMPONENT_ADDED_ID event dispatched for UI update
      expect(safeEventDispatcher.dispatch).toHaveBeenCalledWith(
        COMPONENT_ADDED_ID,
        expect.objectContaining({
          entity: actor,
          componentTypeId: MOOD_COMPONENT_ID,
          componentData: updatedMood,
          oldComponentData: expect.any(Object),
        })
      );
    });

    it('handles partial mood updates', async () => {
      const actor = await createActorWithMoodAndSexualState({
        mood: { valence: 0.3, arousal: 0.4 },
      });

      listener.handleEvent({
        type: ACTION_DECIDED_ID,
        payload: {
          actorId: actor.id,
          extractedData: {
            moodUpdate: { valence: 0.7, arousal: 0.9 },
          },
        },
      });

      const updatedMood = actor.getComponentData(MOOD_COMPONENT_ID);
      expect(updatedMood.valence).toBe(0.7);
      expect(updatedMood.arousal).toBe(0.9);
    });
  });

  describe('sexual state updates', () => {
    it('updates sexual_state component while preserving baseline_libido', async () => {
      const actor = await createActorWithMoodAndSexualState({
        sexualState: {
          sex_excitation: 0.2,
          sex_inhibition: 0.6,
          baseline_libido: 0.8,
        },
      });

      const sexualUpdate = {
        sex_excitation: 0.7,
        sex_inhibition: 0.2,
      };

      listener.handleEvent({
        type: ACTION_DECIDED_ID,
        payload: {
          actorId: actor.id,
          extractedData: { sexualUpdate },
        },
      });

      const updatedSexual = actor.getComponentData(SEXUAL_STATE_COMPONENT_ID);
      expect(updatedSexual.sex_excitation).toBe(0.7);
      expect(updatedSexual.sex_inhibition).toBe(0.2);
      // baseline_libido MUST be preserved from original component
      expect(updatedSexual.baseline_libido).toBe(0.8);

      expect(logger.info).toHaveBeenCalledWith(
        expect.stringContaining('Updated sexual state'),
        expect.objectContaining({
          sex_excitation: 0.7,
          sex_inhibition: 0.2,
        })
      );

      // Verify COMPONENT_ADDED_ID event dispatched for UI update
      expect(safeEventDispatcher.dispatch).toHaveBeenCalledWith(
        COMPONENT_ADDED_ID,
        expect.objectContaining({
          entity: actor,
          componentTypeId: SEXUAL_STATE_COMPONENT_ID,
          componentData: updatedSexual,
          oldComponentData: expect.any(Object),
        })
      );
    });

    it('preserves baseline_libido even when update has different values', async () => {
      const actor = await createActorWithMoodAndSexualState({
        sexualState: { baseline_libido: 0.9 },
      });

      listener.handleEvent({
        type: ACTION_DECIDED_ID,
        payload: {
          actorId: actor.id,
          extractedData: {
            sexualUpdate: {
              sex_excitation: 0.5,
              sex_inhibition: 0.3,
            },
          },
        },
      });

      const updatedSexual = actor.getComponentData(SEXUAL_STATE_COMPONENT_ID);
      expect(updatedSexual.baseline_libido).toBe(0.9);
    });
  });

  describe('combined mood and sexual updates', () => {
    it('updates both components in a single event', async () => {
      const actor = await createActorWithMoodAndSexualState({
        mood: { valence: 0.0 },
        sexualState: { baseline_libido: 0.6 },
      });

      listener.handleEvent({
        type: ACTION_DECIDED_ID,
        payload: {
          actorId: actor.id,
          extractedData: {
            moodUpdate: { valence: 0.9, arousal: 0.8 },
            sexualUpdate: { sex_excitation: 0.6, sex_inhibition: 0.1 },
          },
        },
      });

      const updatedMood = actor.getComponentData(MOOD_COMPONENT_ID);
      const updatedSexual = actor.getComponentData(SEXUAL_STATE_COMPONENT_ID);

      expect(updatedMood.valence).toBe(0.9);
      expect(updatedMood.arousal).toBe(0.8);
      expect(updatedSexual.sex_excitation).toBe(0.6);
      expect(updatedSexual.sex_inhibition).toBe(0.1);
      expect(updatedSexual.baseline_libido).toBe(0.6);
    });
  });

  describe('entity not found handling', () => {
    it('logs warning when entity cannot be located', () => {
      const getEntitySpy = jest.spyOn(testBed.entityManager, 'getEntityInstance');

      listener.handleEvent({
        type: ACTION_DECIDED_ID,
        payload: {
          actorId: 'missing-actor',
          extractedData: { moodUpdate: { valence: 0.5 } },
        },
      });

      expect(logger.warn).toHaveBeenCalledWith(
        'MoodSexualPersistenceListener: Entity not found: missing-actor'
      );
      expect(getEntitySpy).toHaveBeenCalledWith('missing-actor');
    });
  });

  describe('missing component handling', () => {
    it('logs warning when actor lacks mood component', async () => {
      // Create actor WITHOUT mood component
      const actor = await testBed.createActorEntity({
        instanceId: ACTOR_ID,
        overrides: {
          [SEXUAL_STATE_COMPONENT_ID]: {
            sex_excitation: 0.0,
            sex_inhibition: 0.5,
            baseline_libido: 0.5,
          },
        },
      });

      listener.handleEvent({
        type: ACTION_DECIDED_ID,
        payload: {
          actorId: actor.id,
          extractedData: { moodUpdate: { valence: 0.5 } },
        },
      });

      expect(logger.warn).toHaveBeenCalledWith(
        `MoodSexualPersistenceListener: Actor ${actor.id} lacks ${MOOD_COMPONENT_ID} component`
      );
    });

    it('logs warning when actor lacks sexual_state component', async () => {
      // Create actor WITHOUT sexual_state component
      const actor = await testBed.createActorEntity({
        instanceId: ACTOR_ID,
        overrides: {
          [MOOD_COMPONENT_ID]: {
            valence: 0.0,
            arousal: 0.5,
          },
        },
      });

      listener.handleEvent({
        type: ACTION_DECIDED_ID,
        payload: {
          actorId: actor.id,
          extractedData: { sexualUpdate: { sex_excitation: 0.5 } },
        },
      });

      expect(logger.warn).toHaveBeenCalledWith(
        `MoodSexualPersistenceListener: Actor ${actor.id} lacks ${SEXUAL_STATE_COMPONENT_ID} component`
      );
    });
  });

  describe('no-op scenarios', () => {
    it('ignores events without payload', async () => {
      await createActorWithMoodAndSexualState();

      listener.handleEvent(null);
      listener.handleEvent({});

      expect(logger.debug).not.toHaveBeenCalled();
    });

    it('ignores events without mood or sexual updates', async () => {
      const actor = await createActorWithMoodAndSexualState();
      const getEntitySpy = jest.spyOn(testBed.entityManager, 'getEntityInstance');

      listener.handleEvent({
        type: ACTION_DECIDED_ID,
        payload: {
          actorId: actor.id,
          extractedData: { thoughts: 'some thoughts', notes: [] },
        },
      });

      expect(getEntitySpy).not.toHaveBeenCalled();
    });
  });
});
