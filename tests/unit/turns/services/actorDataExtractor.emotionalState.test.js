// tests/unit/turns/services/actorDataExtractor.emotionalState.test.js
// --- FILE START ---

import { ActorDataExtractor } from '../../../../src/turns/services/actorDataExtractor.js';
import {
  NAME_COMPONENT_ID,
  MOOD_COMPONENT_ID,
  SEXUAL_STATE_COMPONENT_ID,
  AFFECT_TRAITS_COMPONENT_ID,
} from '../../../../src/constants/componentIds.js';
import { DEFAULT_AFFECT_TRAITS } from '../../../../src/constants/moodAffectConstants.js';
import { jest, describe, beforeEach, test, expect } from '@jest/globals';

describe('ActorDataExtractor - Emotional State Extraction', () => {
  /** @type {ActorDataExtractor} */
  let extractor;
  let mockAnatomyDescriptionService;
  let mockEntityFinder;
  let mockEmotionCalculatorService;

  /**
   * Creates a valid mood component with all 14 required axes.
   *
   * @param {Partial<{valence: number, arousal: number, agency_control: number, threat: number, engagement: number, future_expectancy: number, temporal_orientation: number, self_evaluation: number, affiliation: number, inhibitory_control: number, uncertainty: number, contamination_salience: number, rumination: number, evaluation_pressure: number}>} [overrides] - Optional overrides
   * @returns {object} Mood component data
   */
  function createMoodComponent(overrides = {}) {
    return {
      valence: 50,
      arousal: 30,
      agency_control: 40,
      threat: -20,
      engagement: 60,
      future_expectancy: 25,
      temporal_orientation: 0,
      self_evaluation: 35,
      affiliation: 0,
      inhibitory_control: 0,
      uncertainty: 0,
      contamination_salience: 0,
      rumination: 0,
      evaluation_pressure: 0,
      ...overrides,
    };
  }

  /**
   * Creates a valid sexual state component.
   *
   * @param {Partial<{sex_excitation: number, sex_inhibition: number, baseline_libido: number}>} [overrides] - Optional overrides
   * @returns {object} Sexual state component data
   */
  function createSexualStateComponent(overrides = {}) {
    return {
      sex_excitation: 20,
      sex_inhibition: 10,
      baseline_libido: 5,
      ...overrides,
    };
  }

  /**
   * Creates a valid affect traits component.
   *
   * @param {Partial<{affective_empathy: number, cognitive_empathy: number, harm_aversion: number}>} [overrides] - Optional overrides
   * @returns {object} Affect traits component data
   */
  function createAffectTraitsComponent(overrides = {}) {
    return {
      affective_empathy: 50,
      cognitive_empathy: 50,
      harm_aversion: 50,
      ...overrides,
    };
  }

  /**
   * Creates a minimal valid actor state with required emotional components.
   *
   * @param {object} [overrides] - Additional component overrides
   * @returns {object} Actor state
   */
  function createValidActorState(overrides = {}) {
    return {
      [NAME_COMPONENT_ID]: { text: 'Test Actor' },
      [MOOD_COMPONENT_ID]: createMoodComponent(),
      [SEXUAL_STATE_COMPONENT_ID]: createSexualStateComponent(),
      ...overrides,
    };
  }

  beforeEach(() => {
    mockAnatomyDescriptionService = {
      getOrGenerateBodyDescription: jest.fn(),
    };
    mockEntityFinder = {
      getEntityInstance: jest.fn(),
    };
    mockEmotionCalculatorService = {
      calculateSexualArousal: jest.fn().mockReturnValue(0.15),
      calculateEmotions: jest.fn().mockReturnValue(
        new Map([
          ['joy', 0.6],
          ['curiosity', 0.4],
        ])
      ),
      calculateSexualStates: jest.fn().mockReturnValue(new Map()),
      formatEmotionsForPrompt: jest.fn().mockReturnValue('joy: strong, curiosity: noticeable'),
      formatSexualStatesForPrompt: jest.fn().mockReturnValue(''),
    };
    extractor = new ActorDataExtractor({
      anatomyDescriptionService: mockAnatomyDescriptionService,
      entityFinder: mockEntityFinder,
      emotionCalculatorService: mockEmotionCalculatorService,
    });
  });

  describe('constructor validation', () => {
    test('should throw error when emotionCalculatorService is not provided', () => {
      expect(() => {
        new ActorDataExtractor({
          anatomyDescriptionService: mockAnatomyDescriptionService,
          entityFinder: mockEntityFinder,
          // emotionCalculatorService missing
        });
      }).toThrow('ActorDataExtractor: emotionCalculatorService is required');
    });

    test('should create instance when emotionCalculatorService is provided', () => {
      expect(() => {
        new ActorDataExtractor({
          anatomyDescriptionService: mockAnatomyDescriptionService,
          entityFinder: mockEntityFinder,
          emotionCalculatorService: mockEmotionCalculatorService,
        });
      }).not.toThrow();
    });
  });

  describe('fail-fast validation', () => {
    test('should throw error when actor lacks core:mood component', () => {
      const actorState = {
        [NAME_COMPONENT_ID]: { text: 'Test Actor' },
        [SEXUAL_STATE_COMPONENT_ID]: createSexualStateComponent(),
        // MOOD_COMPONENT_ID missing
      };

      expect(() => {
        extractor.extractPromptData(actorState, 'actor-123');
      }).toThrow(
        `ActorDataExtractor: Actor 'actor-123' is missing required emotional components: [${MOOD_COMPONENT_ID}]`
      );
    });

    test('should throw error when actor lacks core:sexual_state component', () => {
      const actorState = {
        [NAME_COMPONENT_ID]: { text: 'Test Actor' },
        [MOOD_COMPONENT_ID]: createMoodComponent(),
        // SEXUAL_STATE_COMPONENT_ID missing
      };

      expect(() => {
        extractor.extractPromptData(actorState, 'actor-456');
      }).toThrow(
        `ActorDataExtractor: Actor 'actor-456' is missing required emotional components: [${SEXUAL_STATE_COMPONENT_ID}]`
      );
    });

    test('should throw error listing both components when both are missing', () => {
      const actorState = {
        [NAME_COMPONENT_ID]: { text: 'Test Actor' },
        // Both emotional components missing
      };

      expect(() => {
        extractor.extractPromptData(actorState, 'actor-789');
      }).toThrow(
        `ActorDataExtractor: Actor 'actor-789' is missing required emotional components: [${MOOD_COMPONENT_ID}, ${SEXUAL_STATE_COMPONENT_ID}]`
      );
    });

    test('should include actor ID in error message', () => {
      const actorState = {
        [NAME_COMPONENT_ID]: { text: 'Test Actor' },
      };

      expect(() => {
        extractor.extractPromptData(actorState, 'specific-actor-id');
      }).toThrow("Actor 'specific-actor-id' is missing");
    });

    test('should include guidance about required components in error message', () => {
      const actorState = {
        [NAME_COMPONENT_ID]: { text: 'Test Actor' },
      };

      expect(() => {
        extractor.extractPromptData(actorState, 'actor-test');
      }).toThrow('All actors must have both core:mood and core:sexual_state components');
    });
  });

  describe('successful emotional data extraction', () => {
    test('should extract emotional state when all components present', () => {
      const actorState = createValidActorState();

      const result = extractor.extractPromptData(actorState, 'actor-success');

      expect(result.emotionalState).toBeDefined();
    });

    test('should return complete EmotionalStateDTO structure', () => {
      const actorState = createValidActorState();

      const result = extractor.extractPromptData(actorState, 'actor-test');

      expect(result.emotionalState).toHaveProperty('moodAxes');
      expect(result.emotionalState).toHaveProperty('emotionalStateText');
      expect(result.emotionalState).toHaveProperty('sexualState');
      expect(result.emotionalState).toHaveProperty('sexVariables');
      expect(result.emotionalState).toHaveProperty('sexualStateText');
    });

    test('should include all 14 mood axis values in moodAxes', () => {
      const moodData = {
        valence: 70,
        arousal: 40,
        agency_control: 55,
        threat: -30,
        engagement: 80,
        future_expectancy: 45,
        temporal_orientation: 10,
        self_evaluation: 60,
        affiliation: 25,
        inhibitory_control: 15,
        uncertainty: 5,
        contamination_salience: 0,
        rumination: -5,
        evaluation_pressure: 20,
      };
      const actorState = createValidActorState({
        [MOOD_COMPONENT_ID]: moodData,
      });

      const result = extractor.extractPromptData(actorState, 'actor-test');

      expect(result.emotionalState.moodAxes).toEqual(moodData);
    });

    test('should include affiliation axis in moodAxes', () => {
      const moodData = {
        valence: 70,
        arousal: 40,
        agency_control: 55,
        threat: -30,
        engagement: 80,
        future_expectancy: 45,
        temporal_orientation: 10,
        self_evaluation: 60,
        affiliation: 25,
        inhibitory_control: 15,
        uncertainty: 5,
        contamination_salience: 0,
        rumination: -5,
        evaluation_pressure: 20,
      };
      const actorState = createValidActorState({
        [MOOD_COMPONENT_ID]: moodData,
      });

      const result = extractor.extractPromptData(actorState, 'actor-test');

      expect(result.emotionalState.moodAxes.affiliation).toBe(25);
    });

    test('should call calculateSexualArousal with sexual state component', () => {
      const sexualStateData = createSexualStateComponent({
        sex_excitation: 60,
        sex_inhibition: 20,
        baseline_libido: 10,
      });
      const actorState = createValidActorState({
        [SEXUAL_STATE_COMPONENT_ID]: sexualStateData,
      });

      extractor.extractPromptData(actorState, 'actor-test');

      expect(mockEmotionCalculatorService.calculateSexualArousal).toHaveBeenCalledWith(
        sexualStateData
      );
    });

    test('should include calculated sexual_arousal in sexualState', () => {
      mockEmotionCalculatorService.calculateSexualArousal.mockReturnValue(0.65);
      const actorState = createValidActorState();

      const result = extractor.extractPromptData(actorState, 'actor-test');

      expect(result.emotionalState.sexualState.sexual_arousal).toBe(0.65);
    });

    test('should include original sexual state values in sexualState', () => {
      const sexualStateData = {
        sex_excitation: 50,
        sex_inhibition: 15,
        baseline_libido: -10,
      };
      const actorState = createValidActorState({
        [SEXUAL_STATE_COMPONENT_ID]: sexualStateData,
      });

      const result = extractor.extractPromptData(actorState, 'actor-test');

      expect(result.emotionalState.sexualState.sex_excitation).toBe(50);
      expect(result.emotionalState.sexualState.sex_inhibition).toBe(15);
      expect(result.emotionalState.sexualState.baseline_libido).toBe(-10);
      expect(result.emotionalState.sexVariables).toEqual({
        sex_excitation: 50,
        sex_inhibition: 15,
      });
    });

    test('should call calculateEmotions with mood axes, sexual arousal, and null affect traits when absent', () => {
      const moodData = createMoodComponent({ valence: 80 });
      const actorState = createValidActorState({
        [MOOD_COMPONENT_ID]: moodData,
      });
      const sexualStateData = actorState[SEXUAL_STATE_COMPONENT_ID];
      mockEmotionCalculatorService.calculateSexualArousal.mockReturnValue(0.42);

      extractor.extractPromptData(actorState, 'actor-test');

      expect(mockEmotionCalculatorService.calculateEmotions).toHaveBeenCalledWith(
        moodData,
        0.42,
        sexualStateData,
        null
      );
    });

    test('should call formatEmotionsForPrompt with calculated emotions', () => {
      const emotionsMap = new Map([
        ['fear', 0.7],
        ['anger', 0.3],
      ]);
      mockEmotionCalculatorService.calculateEmotions.mockReturnValue(emotionsMap);
      const actorState = createValidActorState();

      extractor.extractPromptData(actorState, 'actor-test');

      expect(mockEmotionCalculatorService.formatEmotionsForPrompt).toHaveBeenCalledWith(
        emotionsMap
      );
    });

    test('should include formatted emotional state text', () => {
      mockEmotionCalculatorService.formatEmotionsForPrompt.mockReturnValue(
        'serenity: intense, trust: moderate'
      );
      const actorState = createValidActorState();

      const result = extractor.extractPromptData(actorState, 'actor-test');

      expect(result.emotionalState.emotionalStateText).toBe('serenity: intense, trust: moderate');
    });

    test('should call calculateSexualStates with mood axes and sexual arousal', () => {
      const moodData = createMoodComponent();
      const actorState = createValidActorState({
        [MOOD_COMPONENT_ID]: moodData,
      });
      const sexualStateData = actorState[SEXUAL_STATE_COMPONENT_ID];
      mockEmotionCalculatorService.calculateSexualArousal.mockReturnValue(0.55);

      extractor.extractPromptData(actorState, 'actor-test');

      expect(mockEmotionCalculatorService.calculateSexualStates).toHaveBeenCalledWith(
        moodData,
        0.55,
        sexualStateData
      );
    });

    test('should call formatSexualStatesForPrompt with calculated sexual states', () => {
      const sexualStatesMap = new Map([['aroused', 0.6]]);
      mockEmotionCalculatorService.calculateSexualStates.mockReturnValue(sexualStatesMap);
      const actorState = createValidActorState();

      extractor.extractPromptData(actorState, 'actor-test');

      expect(mockEmotionCalculatorService.formatSexualStatesForPrompt).toHaveBeenCalledWith(
        sexualStatesMap
      );
    });

    test('should include formatted sexual state text', () => {
      mockEmotionCalculatorService.formatSexualStatesForPrompt.mockReturnValue(
        'desire: strong'
      );
      const actorState = createValidActorState();

      const result = extractor.extractPromptData(actorState, 'actor-test');

      expect(result.emotionalState.sexualStateText).toBe('desire: strong');
    });
  });

  describe('edge cases', () => {
    test('should handle mood component with extreme values', () => {
      const extremeMoodData = {
        valence: -100,
        arousal: 100,
        agency_control: -100,
        threat: 100,
        engagement: -100,
        future_expectancy: 100,
        temporal_orientation: -100,
        self_evaluation: -100,
        affiliation: -100,
        inhibitory_control: 100,
        uncertainty: -100,
        contamination_salience: 100,
        rumination: -100,
        evaluation_pressure: 100,
      };
      const actorState = createValidActorState({
        [MOOD_COMPONENT_ID]: extremeMoodData,
      });

      const result = extractor.extractPromptData(actorState, 'actor-extreme');

      expect(result.emotionalState.moodAxes).toEqual(extremeMoodData);
    });

    test('should handle sexual state with zero values', () => {
      const zeroSexualData = {
        sex_excitation: 0,
        sex_inhibition: 0,
        baseline_libido: 0,
      };
      const actorState = createValidActorState({
        [SEXUAL_STATE_COMPONENT_ID]: zeroSexualData,
      });

      const result = extractor.extractPromptData(actorState, 'actor-zero');

      expect(result.emotionalState.sexualState.sex_excitation).toBe(0);
      expect(result.emotionalState.sexualState.sex_inhibition).toBe(0);
      expect(result.emotionalState.sexualState.baseline_libido).toBe(0);
    });

    test('should handle empty formatted text from calculator service', () => {
      mockEmotionCalculatorService.formatEmotionsForPrompt.mockReturnValue('');
      mockEmotionCalculatorService.formatSexualStatesForPrompt.mockReturnValue('');
      const actorState = createValidActorState();

      const result = extractor.extractPromptData(actorState, 'actor-empty');

      expect(result.emotionalState.emotionalStateText).toBe('');
      expect(result.emotionalState.sexualStateText).toBe('');
    });

    test('should handle null sexual arousal from calculator service', () => {
      mockEmotionCalculatorService.calculateSexualArousal.mockReturnValue(null);
      const actorState = createValidActorState();

      // Should not throw - passes null to calculateEmotions/calculateSexualStates
      const result = extractor.extractPromptData(actorState, 'actor-null-arousal');

      expect(result.emotionalState.sexualState.sexual_arousal).toBeNull();
    });
  });

  describe('integration with other extraction', () => {
    test('should preserve existing DTO fields alongside emotionalState', () => {
      const actorState = createValidActorState({
        [NAME_COMPONENT_ID]: { text: 'Preserved Name' },
      });

      const result = extractor.extractPromptData(actorState, 'actor-test');

      expect(result.name).toBe('Preserved Name');
      expect(result.emotionalState).toBeDefined();
    });

    test('should extract emotional state together with health state', () => {
      const mockInjuryAggregationService = {
        aggregateInjuries: jest.fn().mockReturnValue({
          overallHealthPercentage: 75,
          injuredParts: [
            {
              partType: 'arm',
              orientation: 'left',
              state: 'wounded',
              healthPercentage: 50,
              isBleeding: false,
              isBurning: false,
              isPoisoned: false,
              isFractured: false,
            },
          ],
          isDying: false,
          isDead: false,
          bleedingParts: [],
          burningParts: [],
          poisonedParts: [],
          fracturedParts: [],
        }),
      };

      const extractorWithHealth = new ActorDataExtractor({
        anatomyDescriptionService: mockAnatomyDescriptionService,
        entityFinder: mockEntityFinder,
        injuryAggregationService: mockInjuryAggregationService,
        emotionCalculatorService: mockEmotionCalculatorService,
      });

      const actorState = createValidActorState();
      const result = extractorWithHealth.extractPromptData(actorState, 'actor-health');

      expect(result.healthState).toBeDefined();
      expect(result.emotionalState).toBeDefined();
    });
  });

  describe('affect traits extraction', () => {
    test('should pass affect traits to calculateEmotions when component present', () => {
      const affectTraitsData = createAffectTraitsComponent({
        affective_empathy: 75,
        cognitive_empathy: 60,
        harm_aversion: 80,
      });
      const moodData = createMoodComponent();
      const actorState = createValidActorState({
        [MOOD_COMPONENT_ID]: moodData,
        [AFFECT_TRAITS_COMPONENT_ID]: affectTraitsData,
      });
      const sexualStateData = actorState[SEXUAL_STATE_COMPONENT_ID];
      mockEmotionCalculatorService.calculateSexualArousal.mockReturnValue(0.15);

      extractor.extractPromptData(actorState, 'actor-with-traits');

      expect(mockEmotionCalculatorService.calculateEmotions).toHaveBeenCalledWith(
        moodData,
        0.15,
        sexualStateData,
        affectTraitsData
      );
    });

    test('should pass null to calculateEmotions when affect_traits component absent', () => {
      const moodData = createMoodComponent();
      const actorState = createValidActorState({
        [MOOD_COMPONENT_ID]: moodData,
        // No AFFECT_TRAITS_COMPONENT_ID
      });
      const sexualStateData = actorState[SEXUAL_STATE_COMPONENT_ID];
      mockEmotionCalculatorService.calculateSexualArousal.mockReturnValue(0.20);

      extractor.extractPromptData(actorState, 'actor-no-traits');

      expect(mockEmotionCalculatorService.calculateEmotions).toHaveBeenCalledWith(
        moodData,
        0.20,
        sexualStateData,
        null
      );
    });

    test('should handle sociopath traits (low empathy values)', () => {
      const sociopathTraits = createAffectTraitsComponent({
        affective_empathy: 5,
        cognitive_empathy: 70,
        harm_aversion: 10,
      });
      const moodData = createMoodComponent();
      const actorState = createValidActorState({
        [MOOD_COMPONENT_ID]: moodData,
        [AFFECT_TRAITS_COMPONENT_ID]: sociopathTraits,
      });
      const sexualStateData = actorState[SEXUAL_STATE_COMPONENT_ID];
      mockEmotionCalculatorService.calculateSexualArousal.mockReturnValue(0.10);

      extractor.extractPromptData(actorState, 'actor-sociopath');

      expect(mockEmotionCalculatorService.calculateEmotions).toHaveBeenCalledWith(
        moodData,
        0.10,
        sexualStateData,
        sociopathTraits
      );
    });

    test('should handle hyper-empathic traits (high empathy values)', () => {
      const hyperEmpathicTraits = createAffectTraitsComponent({
        affective_empathy: 100,
        cognitive_empathy: 95,
        harm_aversion: 100,
      });
      const moodData = createMoodComponent();
      const actorState = createValidActorState({
        [MOOD_COMPONENT_ID]: moodData,
        [AFFECT_TRAITS_COMPONENT_ID]: hyperEmpathicTraits,
      });
      const sexualStateData = actorState[SEXUAL_STATE_COMPONENT_ID];
      mockEmotionCalculatorService.calculateSexualArousal.mockReturnValue(0.05);

      extractor.extractPromptData(actorState, 'actor-hyper-empathic');

      expect(mockEmotionCalculatorService.calculateEmotions).toHaveBeenCalledWith(
        moodData,
        0.05,
        sexualStateData,
        hyperEmpathicTraits
      );
    });

    test('should handle affect traits with zero values', () => {
      const zeroTraits = createAffectTraitsComponent({
        affective_empathy: 0,
        cognitive_empathy: 0,
        harm_aversion: 0,
      });
      const actorState = createValidActorState({
        [AFFECT_TRAITS_COMPONENT_ID]: zeroTraits,
      });

      // Should not throw - zero values are valid
      const result = extractor.extractPromptData(actorState, 'actor-zero-traits');

      expect(result.emotionalState).toBeDefined();
      expect(mockEmotionCalculatorService.calculateEmotions).toHaveBeenCalledWith(
        expect.any(Object),
        expect.any(Number),
        expect.any(Object),
        zeroTraits
      );
    });

    test('should handle affect traits with maximum values', () => {
      const maxTraits = createAffectTraitsComponent({
        affective_empathy: 100,
        cognitive_empathy: 100,
        harm_aversion: 100,
      });
      const actorState = createValidActorState({
        [AFFECT_TRAITS_COMPONENT_ID]: maxTraits,
      });

      // Should not throw - maximum values are valid
      const result = extractor.extractPromptData(actorState, 'actor-max-traits');

      expect(result.emotionalState).toBeDefined();
      expect(mockEmotionCalculatorService.calculateEmotions).toHaveBeenCalledWith(
        expect.any(Object),
        expect.any(Number),
        expect.any(Object),
        maxTraits
      );
    });

    test('should return DEFAULT_AFFECT_TRAITS in emotionalState when component absent', () => {
      const actorState = createValidActorState({
        // No AFFECT_TRAITS_COMPONENT_ID
      });

      const result = extractor.extractPromptData(actorState, 'actor-no-traits');

      expect(result.emotionalState.affectTraits).toEqual(DEFAULT_AFFECT_TRAITS);
    });

    test('should return component values in emotionalState when component present', () => {
      const customTraits = {
        affective_empathy: 80,
        cognitive_empathy: 70,
        harm_aversion: 60,
        self_control: 55,
        disgust_sensitivity: 40,
        ruminative_tendency: 30,
        evaluation_sensitivity: 25,
      };
      const actorState = createValidActorState({
        [AFFECT_TRAITS_COMPONENT_ID]: customTraits,
      });

      const result = extractor.extractPromptData(actorState, 'actor-with-traits');

      expect(result.emotionalState.affectTraits).toEqual(customTraits);
    });

    test('should include affectTraits property in emotionalState even when component absent', () => {
      const actorState = createValidActorState();

      const result = extractor.extractPromptData(actorState, 'actor-test');

      expect(result.emotionalState).toHaveProperty('affectTraits');
      expect(result.emotionalState.affectTraits).not.toBeNull();
    });
  });
});

// --- FILE END ---
