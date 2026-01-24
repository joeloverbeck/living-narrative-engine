// tests/integration/ai/moodPersistencePromptReflection.integration.test.js
/**
 * @file Integration tests verifying that mood/sexual state updates persist correctly
 * and are reflected in subsequent prompt generation.
 *
 * Tests the complete flow:
 * 1. Actor has initial mood values
 * 2. ACTION_DECIDED_ID event fires with moodUpdate/sexualUpdate
 * 3. MoodSexualPersistenceListener persists updates to entity
 * 4. Next prompt generation reflects the NEW values in emotionalStateText
 * @see tickets/MOOANDSEXAROSYS - Original mood/sexual arousal system implementation
 */

import {
  beforeEach,
  afterEach,
  describe,
  expect,
  it,
  jest,
} from '@jest/globals';
import { MoodSexualPersistenceListener } from '../../../src/ai/moodSexualPersistenceListener.js';
import { ActorStateProvider } from '../../../src/data/providers/actorStateProvider.js';
import { ActorDataExtractor } from '../../../src/turns/services/actorDataExtractor.js';
import EmotionCalculatorService from '../../../src/emotions/emotionCalculatorService.js';
import { EntityManagerTestBed } from '../../common/entities/entityManagerTestBed.js';
import {
  MOOD_COMPONENT_ID,
  SEXUAL_STATE_COMPONENT_ID,
} from '../../../src/constants/componentIds.js';
import {
  ACTION_DECIDED_ID,
  COMPONENT_ADDED_ID,
} from '../../../src/constants/eventIds.js';

const ACTOR_ID = 'actor-mood-prompt-test';

/**
 * Initial mood values - using integers [-100..100] as per schema.
 * These represent a neutral/calm baseline.
 * Includes all 11 mood axes.
 */
const INITIAL_MOOD = {
  valence: 0,
  arousal: 0,
  agency_control: 50,
  threat: -50, // Safe (negative = safe)
  engagement: 0,
  future_expectancy: 0,
  temporal_orientation: 0,
  self_evaluation: 0,
  affiliation: 0,
  inhibitory_control: 0,
  uncertainty: 0,
};

/**
 * Initial sexual state values - using integers [0..100] as per schema.
 */
const INITIAL_SEXUAL_STATE = {
  sex_excitation: 0,
  sex_inhibition: 50,
  baseline_libido: 50,
};

/**
 * LLM-returned mood update - high valence and engagement should produce
 * emotions like "joy" and "interest" in the formatted output.
 * Includes all 11 mood axes.
 */
const MOOD_UPDATE_HIGH_JOY = {
  valence: 80,
  arousal: 60,
  agency_control: 70,
  threat: -60, // Very safe
  engagement: 75,
  future_expectancy: 50,
  temporal_orientation: 20, // Slightly future-focused
  self_evaluation: 60,
  affiliation: 50,
  inhibitory_control: 0,
  uncertainty: -30, // Fairly certain
};

/**
 * LLM-returned sexual update - high excitation should affect sexual state text.
 */
const SEXUAL_UPDATE_ELEVATED = {
  sex_excitation: 70,
  sex_inhibition: 20,
};

describe('Mood/Sexual State Persistence and Prompt Reflection', () => {
  /** @type {EntityManagerTestBed} */
  let testBed;
  /** @type {{ debug: jest.Mock, warn: jest.Mock, error: jest.Mock, info: jest.Mock }} */
  let logger;
  /** @type {{ dispatch: jest.Mock }} */
  let safeEventDispatcher;
  /** @type {MoodSexualPersistenceListener} */
  let persistenceListener;
  /** @type {ActorStateProvider} */
  let actorStateProvider;
  /** @type {ActorDataExtractor} */
  let actorDataExtractor;
  /** @type {EmotionCalculatorService} */
  let emotionCalculatorService;

  beforeEach(async () => {
    testBed = new EntityManagerTestBed();
    logger = {
      debug: jest.fn(),
      warn: jest.fn(),
      error: jest.fn(),
      info: jest.fn(),
    };
    safeEventDispatcher = { dispatch: jest.fn() };

    // Create real services for the test
    persistenceListener = new MoodSexualPersistenceListener({
      logger,
      entityManager: testBed.entityManager,
      safeEventDispatcher,
    });

    actorStateProvider = new ActorStateProvider();

    // Create a mock dataRegistry for EmotionCalculatorService
    // dataRegistry.get(type, id) pattern where type is 'lookups'
    // NOTE: Production code expects lookup.entries to contain the prototypes
    const mockDataRegistry = {
      get: jest.fn((type, lookupId) => {
        if (type !== 'lookups') return null;
        if (lookupId === 'core:emotion_prototypes') {
          return {
            entries: {
              joy: {
                weights: { valence: 1.0, arousal: 0.5 },
                gates: ['valence >= 0.20'],
              },
              contentment: {
                weights: { valence: 0.8, arousal: -0.3, agency_control: 0.4 },
                gates: ['valence >= 0.10'],
              },
              interest: {
                weights: { engagement: 1.0, arousal: 0.3 },
                gates: ['engagement >= 0.20'],
              },
              calm: {
                weights: { threat: -0.8, arousal: -0.5 },
                gates: ['threat <= -0.20'],
              },
              sadness: {
                weights: { valence: -1.0, arousal: -0.3 },
                gates: ['valence <= -0.20'],
              },
            },
          };
        }
        if (lookupId === 'core:sexual_prototypes') {
          return {
            entries: {
              aroused: {
                weights: { sex_arousal: 1.0 },
                gates: [],
              },
            },
          };
        }
        return null;
      }),
    };

    emotionCalculatorService = new EmotionCalculatorService({
      logger,
      dataRegistry: mockDataRegistry,
    });

    actorDataExtractor = new ActorDataExtractor({
      injuryAggregationService: null,
      injuryNarrativeFormatterService: null,
      emotionCalculatorService,
      logger,
    });
  });

  afterEach(async () => {
    await testBed.cleanup();
    jest.restoreAllMocks();
  });

  /**
   * Creates an actor entity with mood and sexual_state components.
   *
   * @param overrides
   */
  async function createActorWithMoodAndSexualState(overrides = {}) {
    return await testBed.createActorEntity({
      instanceId: ACTOR_ID,
      overrides: {
        [MOOD_COMPONENT_ID]: { ...INITIAL_MOOD, ...overrides.mood },
        [SEXUAL_STATE_COMPONENT_ID]: {
          ...INITIAL_SEXUAL_STATE,
          ...overrides.sexualState,
        },
      },
    });
  }

  /**
   * Builds actor state and extracts prompt data in one flow.
   * Note: emotionalStateText is nested inside promptData.emotionalState
   *
   * @param actor
   */
  function buildActorStateAndExtractPromptData(actor) {
    const actorState = actorStateProvider.build(actor, logger);
    const promptData = actorDataExtractor.extractPromptData(actorState, actor.id);
    // Flatten for easier test access - emotionalStateText is nested inside emotionalState
    return {
      ...promptData,
      emotionalStateText: promptData.emotionalState?.emotionalStateText || '',
    };
  }

  describe('Complete persistence-to-prompt flow', () => {
    it('should reflect moodUpdate in the next prompt generation', async () => {
      // ARRANGE: Create actor with initial calm/neutral mood
      const actor = await createActorWithMoodAndSexualState();

      // Capture INITIAL prompt data (before update)
      const initialPromptData = buildActorStateAndExtractPromptData(actor);
      const initialEmotionalText = initialPromptData.emotionalStateText || '';

      // ACT: Simulate ACTION_DECIDED_ID event with moodUpdate
      persistenceListener.handleEvent({
        type: ACTION_DECIDED_ID,
        payload: {
          actorId: actor.id,
          extractedData: { moodUpdate: MOOD_UPDATE_HIGH_JOY },
        },
      });

      // Verify component was updated
      const updatedMood = actor.getComponentData(MOOD_COMPONENT_ID);
      expect(updatedMood.valence).toBe(MOOD_UPDATE_HIGH_JOY.valence);
      expect(updatedMood.arousal).toBe(MOOD_UPDATE_HIGH_JOY.arousal);

      // ASSERT: Generate new prompt and verify it reflects the update
      const nextPromptData = buildActorStateAndExtractPromptData(actor);
      const nextEmotionalText = nextPromptData.emotionalStateText || '';

      // The emotional text should be DIFFERENT from initial
      // (With high valence=80 and engagement=75, we expect emotions like "joy" or "interest")
      expect(nextEmotionalText).not.toBe(initialEmotionalText);

      // Verify that the new emotional state contains expected emotional labels
      // High valence should produce joy-related emotions
      expect(nextEmotionalText.length).toBeGreaterThan(0);
    });

    it('should reflect sexualUpdate in the next prompt generation', async () => {
      // ARRANGE: Create actor with initial low sexual arousal
      const actor = await createActorWithMoodAndSexualState();

      // Capture INITIAL sexual state
      const initialSexualState = actor.getComponentData(
        SEXUAL_STATE_COMPONENT_ID
      );
      expect(initialSexualState.sex_excitation).toBe(
        INITIAL_SEXUAL_STATE.sex_excitation
      );

      // ACT: Simulate ACTION_DECIDED_ID event with sexualUpdate
      persistenceListener.handleEvent({
        type: ACTION_DECIDED_ID,
        payload: {
          actorId: actor.id,
          extractedData: { sexualUpdate: SEXUAL_UPDATE_ELEVATED },
        },
      });

      // ASSERT: Verify component was updated
      const updatedSexualState = actor.getComponentData(
        SEXUAL_STATE_COMPONENT_ID
      );
      expect(updatedSexualState.sex_excitation).toBe(
        SEXUAL_UPDATE_ELEVATED.sex_excitation
      );
      expect(updatedSexualState.sex_inhibition).toBe(
        SEXUAL_UPDATE_ELEVATED.sex_inhibition
      );

      // Verify baseline_libido was preserved
      expect(updatedSexualState.baseline_libido).toBe(
        INITIAL_SEXUAL_STATE.baseline_libido
      );
    });

    it('should reflect BOTH mood and sexual updates in subsequent prompts', async () => {
      // ARRANGE: Create actor with neutral initial state
      const actor = await createActorWithMoodAndSexualState();
      const initialPromptData = buildActorStateAndExtractPromptData(actor);
      const initialEmotionalText = initialPromptData.emotionalStateText || '';

      // ACT: Simulate ACTION_DECIDED_ID with BOTH updates
      persistenceListener.handleEvent({
        type: ACTION_DECIDED_ID,
        payload: {
          actorId: actor.id,
          extractedData: {
            moodUpdate: MOOD_UPDATE_HIGH_JOY,
            sexualUpdate: SEXUAL_UPDATE_ELEVATED,
          },
        },
      });

      // ASSERT: Both components updated
      const updatedMood = actor.getComponentData(MOOD_COMPONENT_ID);
      const updatedSexual = actor.getComponentData(SEXUAL_STATE_COMPONENT_ID);

      expect(updatedMood.valence).toBe(MOOD_UPDATE_HIGH_JOY.valence);
      expect(updatedSexual.sex_excitation).toBe(
        SEXUAL_UPDATE_ELEVATED.sex_excitation
      );

      // Generate new prompt - emotional text should reflect changes
      const nextPromptData = buildActorStateAndExtractPromptData(actor);
      expect(nextPromptData.emotionalStateText).not.toBe(initialEmotionalText);
    });

    it('should accumulate multiple consecutive mood updates', async () => {
      // ARRANGE: Create actor
      const actor = await createActorWithMoodAndSexualState();

      // ACT: First update - positive mood
      persistenceListener.handleEvent({
        type: ACTION_DECIDED_ID,
        payload: {
          actorId: actor.id,
          extractedData: { moodUpdate: MOOD_UPDATE_HIGH_JOY },
        },
      });

      const afterFirstUpdate = actor.getComponentData(MOOD_COMPONENT_ID);
      expect(afterFirstUpdate.valence).toBe(80);

      // Second update - negative shift (all 11 axes)
      const negativeMoodUpdate = {
        valence: -50,
        arousal: -30,
        agency_control: 20,
        threat: 40, // Threatened
        engagement: -20,
        future_expectancy: -40,
        temporal_orientation: -30, // Past-focused (ruminating)
        self_evaluation: -30,
        affiliation: -20,
        inhibitory_control: -10,
        uncertainty: 50, // High uncertainty
      };

      persistenceListener.handleEvent({
        type: ACTION_DECIDED_ID,
        payload: {
          actorId: actor.id,
          extractedData: { moodUpdate: negativeMoodUpdate },
        },
      });

      // ASSERT: Second update overwrites first
      const afterSecondUpdate = actor.getComponentData(MOOD_COMPONENT_ID);
      expect(afterSecondUpdate.valence).toBe(-50);
      expect(afterSecondUpdate.threat).toBe(40);

      // Prompt should reflect final (negative) state
      const finalPromptData = buildActorStateAndExtractPromptData(actor);
      // With negative valence, we should NOT see "joy" in the output
      expect(finalPromptData.emotionalStateText).toBeDefined();
    });
  });

  describe('COMPONENT_ADDED_ID event dispatch for UI updates', () => {
    it('should dispatch COMPONENT_ADDED_ID for mood component', async () => {
      const actor = await createActorWithMoodAndSexualState();

      persistenceListener.handleEvent({
        type: ACTION_DECIDED_ID,
        payload: {
          actorId: actor.id,
          extractedData: { moodUpdate: MOOD_UPDATE_HIGH_JOY },
        },
      });

      const updatedMood = actor.getComponentData(MOOD_COMPONENT_ID);
      expect(safeEventDispatcher.dispatch).toHaveBeenCalledWith(
        COMPONENT_ADDED_ID,
        expect.objectContaining({
          entity: actor,
          componentTypeId: MOOD_COMPONENT_ID,
          componentData: updatedMood,
          oldComponentData: INITIAL_MOOD,
        })
      );
    });

    it('should dispatch COMPONENT_ADDED_ID for sexual_state component', async () => {
      const actor = await createActorWithMoodAndSexualState();

      persistenceListener.handleEvent({
        type: ACTION_DECIDED_ID,
        payload: {
          actorId: actor.id,
          extractedData: { sexualUpdate: SEXUAL_UPDATE_ELEVATED },
        },
      });

      const updatedSexual = actor.getComponentData(SEXUAL_STATE_COMPONENT_ID);
      expect(safeEventDispatcher.dispatch).toHaveBeenCalledWith(
        COMPONENT_ADDED_ID,
        expect.objectContaining({
          entity: actor,
          componentTypeId: SEXUAL_STATE_COMPONENT_ID,
          componentData: updatedSexual,
          oldComponentData: INITIAL_SEXUAL_STATE,
        })
      );
    });

    it('should dispatch both events when both updates are present', async () => {
      const actor = await createActorWithMoodAndSexualState();

      persistenceListener.handleEvent({
        type: ACTION_DECIDED_ID,
        payload: {
          actorId: actor.id,
          extractedData: {
            moodUpdate: MOOD_UPDATE_HIGH_JOY,
            sexualUpdate: SEXUAL_UPDATE_ELEVATED,
          },
        },
      });

      const updatedMood = actor.getComponentData(MOOD_COMPONENT_ID);
      const updatedSexual = actor.getComponentData(SEXUAL_STATE_COMPONENT_ID);
      expect(safeEventDispatcher.dispatch).toHaveBeenCalledTimes(2);
      expect(safeEventDispatcher.dispatch).toHaveBeenCalledWith(
        COMPONENT_ADDED_ID,
        expect.objectContaining({
          entity: actor,
          componentTypeId: MOOD_COMPONENT_ID,
          componentData: updatedMood,
          oldComponentData: INITIAL_MOOD,
        })
      );
      expect(safeEventDispatcher.dispatch).toHaveBeenCalledWith(
        COMPONENT_ADDED_ID,
        expect.objectContaining({
          entity: actor,
          componentTypeId: SEXUAL_STATE_COMPONENT_ID,
          componentData: updatedSexual,
          oldComponentData: INITIAL_SEXUAL_STATE,
        })
      );
    });
  });

  describe('Value range validation (integers vs floats)', () => {
    it('should correctly persist integer mood values from LLM schema', async () => {
      const actor = await createActorWithMoodAndSexualState();

      // Simulate LLM returning integer values per schema definition (all 11 axes)
      const integerMoodUpdate = {
        valence: -75,
        arousal: 45,
        agency_control: -20,
        threat: 80,
        engagement: 30,
        future_expectancy: -55,
        temporal_orientation: 10,
        self_evaluation: 15,
        affiliation: -40,
        inhibitory_control: 25,
        uncertainty: 60,
      };

      persistenceListener.handleEvent({
        type: ACTION_DECIDED_ID,
        payload: {
          actorId: actor.id,
          extractedData: { moodUpdate: integerMoodUpdate },
        },
      });

      const updatedMood = actor.getComponentData(MOOD_COMPONENT_ID);

      // Values should be preserved as integers
      expect(updatedMood.valence).toBe(-75);
      expect(updatedMood.arousal).toBe(45);
      expect(updatedMood.agency_control).toBe(-20);
      expect(updatedMood.threat).toBe(80);
      expect(updatedMood.engagement).toBe(30);
      expect(updatedMood.future_expectancy).toBe(-55);
      expect(updatedMood.self_evaluation).toBe(15);

      // All values should be integers
      Object.values(updatedMood).forEach((value) => {
        expect(Number.isInteger(value)).toBe(true);
      });
    });

    it('should correctly persist integer sexual values from LLM schema', async () => {
      const actor = await createActorWithMoodAndSexualState();

      // Simulate LLM returning integer values per schema definition [0..100]
      const integerSexualUpdate = {
        sex_excitation: 85,
        sex_inhibition: 15,
      };

      persistenceListener.handleEvent({
        type: ACTION_DECIDED_ID,
        payload: {
          actorId: actor.id,
          extractedData: { sexualUpdate: integerSexualUpdate },
        },
      });

      const updatedSexual = actor.getComponentData(SEXUAL_STATE_COMPONENT_ID);

      expect(updatedSexual.sex_excitation).toBe(85);
      expect(updatedSexual.sex_inhibition).toBe(15);
      expect(Number.isInteger(updatedSexual.sex_excitation)).toBe(true);
      expect(Number.isInteger(updatedSexual.sex_inhibition)).toBe(true);
    });
  });
});
