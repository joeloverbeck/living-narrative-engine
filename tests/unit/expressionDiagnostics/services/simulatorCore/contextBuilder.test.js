/**
 * @file Unit tests for ContextBuilder.
 */

import { describe, it, expect, beforeEach, jest } from '@jest/globals';
import ContextBuilder from '../../../../../src/expressionDiagnostics/services/simulatorCore/ContextBuilder.js';
import {
  normalizeAffectTraits,
  normalizeMoodAxes,
  normalizeSexualAxes,
} from '../../../../../src/expressionDiagnostics/utils/axisNormalizationUtils.js';

const buildEmotionAdapter = () => ({
  calculateEmotionsFiltered: jest.fn(() => ({ joy: 0.3 })),
  calculateEmotionTracesFiltered: jest.fn(() => ({ joy: { trace: 0.4 } })),
  calculateSexualStateTraces: jest.fn(() => ({ arousal: { trace: 0.2 } })),
  calculateSexualArousal: jest.fn(() => 0.6),
  calculateSexualStates: jest.fn(() => ({ aroused: 0.5 })),
});

const buildDataRegistry = (emotionEntries, sexualEntries) => ({
  get: jest.fn((category, lookupId) => {
    if (category !== 'lookups') {
      return null;
    }
    if (lookupId === 'core:emotion_prototypes') {
      return emotionEntries ? { entries: emotionEntries } : null;
    }
    if (lookupId === 'core:sexual_prototypes') {
      return sexualEntries ? { entries: sexualEntries } : null;
    }
    return null;
  }),
});

describe('ContextBuilder', () => {
  let mockLogger;
  let mockDataRegistry;
  let mockEmotionCalculatorAdapter;
  let contextBuilder;

  beforeEach(() => {
    mockLogger = { debug: jest.fn(), warn: jest.fn(), error: jest.fn() };
    mockDataRegistry = buildDataRegistry({ joy: {} }, { aroused: {} });
    mockEmotionCalculatorAdapter = buildEmotionAdapter();

    contextBuilder = new ContextBuilder({
      logger: mockLogger,
      dataRegistry: mockDataRegistry,
      emotionCalculatorAdapter: mockEmotionCalculatorAdapter,
    });
  });

  describe('constructor', () => {
    it('should validate required dependencies', () => {
      expect(() => new ContextBuilder({})).toThrow();
      expect(() => new ContextBuilder({ dataRegistry: {} })).toThrow();
    });
  });

  describe('buildContext', () => {
    it('should build context with derived fields and defaults', () => {
      const currentState = { mood: { valence: 10 }, sexual: { sex_excitation: 20 } };
      const previousState = { mood: { valence: -10 }, sexual: { sex_excitation: 5 } };

      const context = contextBuilder.buildContext(
        currentState,
        previousState,
        null,
        null,
        true
      );

      expect(mockEmotionCalculatorAdapter.calculateEmotionsFiltered).toHaveBeenCalledTimes(2);
      expect(mockEmotionCalculatorAdapter.calculateSexualArousal).toHaveBeenCalledTimes(2);
      expect(mockEmotionCalculatorAdapter.calculateSexualStates).toHaveBeenCalledTimes(2);

      expect(context.moodAxes).toEqual(currentState.mood);
      expect(context.previousMoodAxes).toEqual(previousState.mood);
      expect(context.sexualAxes).toEqual(currentState.sexual);
      expect(context.previousSexualAxes).toEqual(previousState.sexual);
      expect(context.sexualArousal).toBe(0.6);
      expect(context.previousSexualArousal).toBe(0.6);
      expect(context.affectTraits).toEqual({
        affective_empathy: 50,
        cognitive_empathy: 50,
        harm_aversion: 50,
        self_control: 50,
      });
      expect(context.gateTrace).toEqual({
        emotions: { joy: { trace: 0.4 } },
        sexualStates: { arousal: { trace: 0.2 } },
      });
    });
  });

  describe('buildKnownContextKeys', () => {
    it('should include registry-backed keys and static defaults', () => {
      const { topLevel, nestedKeys, scalarKeys } = contextBuilder.buildKnownContextKeys();

      expect(topLevel.has('affectTraits')).toBe(true);
      expect(scalarKeys.has('sexualArousal')).toBe(true);
      expect([...nestedKeys.emotions]).toEqual(['joy']);
      expect([...nestedKeys.sexualStates]).toEqual(['aroused']);
    });
  });

  describe('normalizeGateContext', () => {
    it('should normalize mood, sexual, and trait axes', () => {
      const context = {
        moodAxes: { valence: 40 },
        sexualAxes: { sex_excitation: 10 },
        sexualArousal: 0.2,
        affectTraits: { affective_empathy: 80 },
      };

      const normalized = contextBuilder.normalizeGateContext(context, false);

      expect(normalized).toEqual({
        moodAxes: normalizeMoodAxes(context.moodAxes),
        sexualAxes: normalizeSexualAxes(context.sexualAxes, context.sexualArousal),
        traitAxes: normalizeAffectTraits(context.affectTraits),
      });
    });
  });

  describe('mood regime tracking helpers', () => {
    it('should initialize and record histogram bins', () => {
      const histograms = contextBuilder.initializeMoodRegimeAxisHistograms(['valence']);
      const context = { moodAxes: { valence: 50 } };

      contextBuilder.recordMoodRegimeAxisHistograms(histograms, context);

      const histogram = histograms.valence;
      expect(histogram.sampleCount).toBe(1);
      expect(histogram.bins[150]).toBe(1);
    });

    it('should store samples in the reservoir up to the limit', () => {
      const reservoir = contextBuilder.initializeMoodRegimeSampleReservoir(1);
      const context = {
        moodAxes: { valence: 25 },
        sexualAxes: { sex_excitation: 40 },
      };

      contextBuilder.recordMoodRegimeSampleReservoir(
        reservoir,
        ['valence', 'sex_excitation'],
        context
      );
      contextBuilder.recordMoodRegimeSampleReservoir(
        reservoir,
        ['valence', 'sex_excitation'],
        context
      );

      expect(reservoir.sampleCount).toBe(2);
      expect(reservoir.storedCount).toBe(1);
      expect(reservoir.samples).toEqual([
        { valence: 25, sex_excitation: 40 },
      ]);
    });
  });
});
