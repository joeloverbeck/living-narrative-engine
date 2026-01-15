/**
 * @file Unit tests for WitnessFormatter
 * @description Tests for all 6 formatting methods extracted from MonteCarloReportGenerator.
 * Each method is tested with normal cases, edge cases, and error handling.
 */

import { describe, it, expect, beforeEach } from '@jest/globals';
import WitnessFormatter from '../../../../src/expressionDiagnostics/services/WitnessFormatter.js';
import ReportFormattingService from '../../../../src/expressionDiagnostics/services/ReportFormattingService.js';

describe('WitnessFormatter', () => {
  let formatter;
  let mockFormattingService;

  beforeEach(() => {
    mockFormattingService = new ReportFormattingService();
    formatter = new WitnessFormatter({ formattingService: mockFormattingService });
  });

  // ============================================================================
  // Constructor Tests
  // ============================================================================

  describe('constructor', () => {
    it('should create instance with formattingService', () => {
      const service = new WitnessFormatter({
        formattingService: mockFormattingService,
      });
      expect(service).toBeInstanceOf(WitnessFormatter);
    });

    it('should throw if formattingService is missing', () => {
      expect(() => new WitnessFormatter({})).toThrow(
        'WitnessFormatter requires formattingService'
      );
    });

    it('should throw if formattingService is null', () => {
      expect(() => new WitnessFormatter({ formattingService: null })).toThrow(
        'WitnessFormatter requires formattingService'
      );
    });

    it('should throw if formattingService is undefined', () => {
      expect(
        () => new WitnessFormatter({ formattingService: undefined })
      ).toThrow('WitnessFormatter requires formattingService');
    });
  });

  // ============================================================================
  // formatWitness Tests
  // ============================================================================

  describe('formatWitness', () => {
    const createFullWitness = () => ({
      current: {
        mood: {
          valence: 45,
          arousal: 30,
          agency_control: 50,
          threat: -20,
          engagement: 60,
          future_expectancy: 35,
          self_evaluation: 40,
          affiliation: 55,
        },
        sexual: {
          sex_excitation: 25,
          sex_inhibition: 40,
          baseline_libido: 10,
        },
      },
      previous: {
        mood: {
          valence: 40,
          arousal: 25,
        },
        sexual: {
          sex_excitation: 20,
        },
      },
      affectTraits: {
        affective_empathy: 70,
        cognitive_empathy: 65,
        harm_aversion: 80,
      },
      computedEmotions: {
        joy: 0.456,
        curiosity: 0.234,
        fear: 0.089,
      },
      previousComputedEmotions: {
        joy: 0.389,
        curiosity: 0.201,
      },
    });

    it('should format complete witness data with index', () => {
      const witness = createFullWitness();
      const result = formatter.formatWitness(witness, 1);

      expect(result).toContain('### Witness #1');
      expect(result).toContain('**Computed Emotions (Current)**:');
      expect(result).toContain('- joy: 0.456');
      expect(result).toContain('**Mood State (Current)**:');
      expect(result).toContain('- valence: 45');
      expect(result).toContain('**Sexual State (Current)**:');
      expect(result).toContain('- sex_excitation: 25');
      expect(result).toContain('**Affect Traits**:');
      expect(result).toContain('- affective_empathy: 70');
    });

    it('should handle different index values', () => {
      const witness = createFullWitness();

      expect(formatter.formatWitness(witness, 1)).toContain('### Witness #1');
      expect(formatter.formatWitness(witness, 5)).toContain('### Witness #5');
      expect(formatter.formatWitness(witness, 10)).toContain('### Witness #10');
    });

    it('should handle missing current mood', () => {
      const witness = {
        current: {},
        previous: {},
        affectTraits: null,
        computedEmotions: {},
        previousComputedEmotions: {},
      };
      const result = formatter.formatWitness(witness, 1);

      expect(result).toContain('- No current mood data');
    });

    it('should handle missing previous state', () => {
      const witness = {
        current: { mood: { valence: 50 } },
        previous: null,
        affectTraits: null,
        computedEmotions: {},
        previousComputedEmotions: null,
      };
      const result = formatter.formatWitness(witness, 1);

      expect(result).toContain('- No previous mood data');
      expect(result).toContain('- No previous sexual data');
    });

    it('should handle empty computed emotions', () => {
      const witness = {
        current: {},
        previous: {},
        affectTraits: null,
        computedEmotions: {},
        previousComputedEmotions: {},
      };
      const result = formatter.formatWitness(witness, 1);

      expect(result).toContain('- No current emotion data');
      expect(result).toContain('- No previous emotion data');
    });

    it('should handle null computed emotions', () => {
      const witness = {
        current: {},
        previous: {},
        affectTraits: null,
        computedEmotions: null,
        previousComputedEmotions: null,
      };
      const result = formatter.formatWitness(witness, 1);

      expect(result).toContain('- No current emotion data');
      expect(result).toContain('- No previous emotion data');
    });
  });

  // ============================================================================
  // formatMoodState Tests
  // ============================================================================

  describe('formatMoodState', () => {
    it('should format all 8 mood axes', () => {
      const mood = {
        valence: 45,
        arousal: 30,
        agency_control: 50,
        threat: -20,
        engagement: 60,
        future_expectancy: 35,
        self_evaluation: 40,
        affiliation: 55,
      };
      const result = formatter.formatMoodState(mood, 'Current');

      expect(result).toContain('- valence: 45');
      expect(result).toContain('- arousal: 30');
      expect(result).toContain('- agency_control: 50');
      expect(result).toContain('- threat: -20');
      expect(result).toContain('- engagement: 60');
      expect(result).toContain('- future_expectancy: 35');
      expect(result).toContain('- self_evaluation: 40');
      expect(result).toContain('- affiliation: 55');
    });

    it('should handle partial mood data (only some axes)', () => {
      const mood = {
        valence: 45,
        arousal: 30,
      };
      const result = formatter.formatMoodState(mood, 'Current');

      expect(result).toBe('- valence: 45\n- arousal: 30');
    });

    it('should handle null mood', () => {
      const result = formatter.formatMoodState(null, 'Current');
      expect(result).toBe('- No current mood data');
    });

    it('should handle undefined mood', () => {
      const result = formatter.formatMoodState(undefined, 'Previous');
      expect(result).toBe('- No previous mood data');
    });

    it('should filter undefined axes', () => {
      const mood = {
        valence: 45,
        arousal: undefined,
        agency_control: 50,
      };
      const result = formatter.formatMoodState(mood, 'Current');

      expect(result).toBe('- valence: 45\n- agency_control: 50');
    });

    it('should handle empty mood object', () => {
      const result = formatter.formatMoodState({}, 'Current');
      expect(result).toBe('');
    });

    it('should preserve axis order', () => {
      const mood = {
        valence: 1,
        arousal: 2,
        agency_control: 3,
        threat: 4,
        engagement: 5,
        future_expectancy: 6,
        self_evaluation: 7,
        affiliation: 8,
      };
      const result = formatter.formatMoodState(mood, 'Current');
      const lines = result.split('\n');

      expect(lines[0]).toContain('valence');
      expect(lines[1]).toContain('arousal');
      expect(lines[2]).toContain('agency_control');
      expect(lines[7]).toContain('affiliation');
    });

    it('should use lowercase label in "No data" message', () => {
      expect(formatter.formatMoodState(null, 'Current')).toBe(
        '- No current mood data'
      );
      expect(formatter.formatMoodState(null, 'Previous')).toBe(
        '- No previous mood data'
      );
    });
  });

  // ============================================================================
  // formatSexualState Tests
  // ============================================================================

  describe('formatSexualState', () => {
    it('should format all 3 sexual fields', () => {
      const sexual = {
        sex_excitation: 25,
        sex_inhibition: 40,
        baseline_libido: 10,
      };
      const result = formatter.formatSexualState(sexual, 'Current');

      expect(result).toContain('- sex_excitation: 25');
      expect(result).toContain('- sex_inhibition: 40');
      expect(result).toContain('- baseline_libido: 10');
    });

    it('should handle partial sexual data', () => {
      const sexual = {
        sex_excitation: 25,
      };
      const result = formatter.formatSexualState(sexual, 'Current');

      expect(result).toBe('- sex_excitation: 25');
    });

    it('should handle null sexual state', () => {
      const result = formatter.formatSexualState(null, 'Current');
      expect(result).toBe('- No current sexual data');
    });

    it('should handle undefined sexual state', () => {
      const result = formatter.formatSexualState(undefined, 'Previous');
      expect(result).toBe('- No previous sexual data');
    });

    it('should filter undefined fields', () => {
      const sexual = {
        sex_excitation: 25,
        sex_inhibition: undefined,
        baseline_libido: 10,
      };
      const result = formatter.formatSexualState(sexual, 'Current');

      expect(result).toBe('- sex_excitation: 25\n- baseline_libido: 10');
    });

    it('should handle empty sexual object', () => {
      const result = formatter.formatSexualState({}, 'Current');
      expect(result).toBe('');
    });
  });

  // ============================================================================
  // formatAffectTraits Tests
  // ============================================================================

  describe('formatAffectTraits', () => {
    it('should format all 3 trait fields', () => {
      const traits = {
        affective_empathy: 70,
        cognitive_empathy: 65,
        harm_aversion: 80,
      };
      const result = formatter.formatAffectTraits(traits);

      expect(result).toContain('- affective_empathy: 70');
      expect(result).toContain('- cognitive_empathy: 65');
      expect(result).toContain('- harm_aversion: 80');
    });

    it('should handle partial trait data', () => {
      const traits = {
        affective_empathy: 70,
      };
      const result = formatter.formatAffectTraits(traits);

      expect(result).toBe('- affective_empathy: 70');
    });

    it('should handle null traits', () => {
      const result = formatter.formatAffectTraits(null);
      expect(result).toBe('- No affect trait data');
    });

    it('should handle undefined traits', () => {
      const result = formatter.formatAffectTraits(undefined);
      expect(result).toBe('- No affect trait data');
    });

    it('should filter undefined fields', () => {
      const traits = {
        affective_empathy: 70,
        cognitive_empathy: undefined,
        harm_aversion: 80,
      };
      const result = formatter.formatAffectTraits(traits);

      expect(result).toBe('- affective_empathy: 70\n- harm_aversion: 80');
    });

    it('should handle empty traits object', () => {
      const result = formatter.formatAffectTraits({});
      expect(result).toBe('');
    });
  });

  // ============================================================================
  // formatComputedEmotions Tests
  // ============================================================================

  describe('formatComputedEmotions', () => {
    it('should format emotions with 3-decimal precision', () => {
      const emotions = {
        joy: 0.456789,
        fear: 0.1,
        curiosity: 0.234,
      };
      const result = formatter.formatComputedEmotions(emotions, 'Current');

      expect(result).toContain('- joy: 0.457'); // rounded to 3 decimals
      expect(result).toContain('- fear: 0.100');
      expect(result).toContain('- curiosity: 0.234');
    });

    it('should sort emotions alphabetically', () => {
      const emotions = {
        fear: 0.1,
        anger: 0.2,
        joy: 0.3,
        curiosity: 0.4,
      };
      const result = formatter.formatComputedEmotions(emotions, 'Current');
      const lines = result.split('\n');

      expect(lines[0]).toContain('anger');
      expect(lines[1]).toContain('curiosity');
      expect(lines[2]).toContain('fear');
      expect(lines[3]).toContain('joy');
    });

    it('should handle single emotion', () => {
      const emotions = { joy: 0.5 };
      const result = formatter.formatComputedEmotions(emotions, 'Current');

      expect(result).toBe('- joy: 0.500');
    });

    it('should handle empty emotions object', () => {
      const result = formatter.formatComputedEmotions({}, 'Current');
      expect(result).toBe('- No current emotion data');
    });

    it('should handle null emotions', () => {
      const result = formatter.formatComputedEmotions(null, 'Current');
      expect(result).toBe('- No current emotion data');
    });

    it('should handle undefined emotions', () => {
      const result = formatter.formatComputedEmotions(undefined, 'Previous');
      expect(result).toBe('- No previous emotion data');
    });

    it('should use lowercase label in "No data" message', () => {
      expect(formatter.formatComputedEmotions({}, 'Current')).toBe(
        '- No current emotion data'
      );
      expect(formatter.formatComputedEmotions({}, 'Previous')).toBe(
        '- No previous emotion data'
      );
    });
  });

  // ============================================================================
  // formatBindingAxes Tests
  // ============================================================================

  describe('formatBindingAxes', () => {
    it('should return "None" for empty axes', () => {
      const result = formatter.formatBindingAxes([]);
      expect(result).toBe(
        '**Binding Axes**: None (all axes can reach optimal values)'
      );
    });

    it('should return "None" for null axes', () => {
      const result = formatter.formatBindingAxes(null);
      expect(result).toBe(
        '**Binding Axes**: None (all axes can reach optimal values)'
      );
    });

    it('should return "None" for undefined axes', () => {
      const result = formatter.formatBindingAxes(undefined);
      expect(result).toBe(
        '**Binding Axes**: None (all axes can reach optimal values)'
      );
    });

    it('should list axes without conflicts', () => {
      const axes = [{ axis: 'valence' }, { axis: 'arousal' }];
      const result = formatter.formatBindingAxes(axes);

      expect(result).toBe(
        '**Binding Axes**: valence, arousal (constraints limit optimal values)'
      );
    });

    it('should format positive_weight_low_max conflicts', () => {
      const axes = [
        {
          axis: 'valence',
          weight: 1.0,
          conflictType: 'positive_weight_low_max',
          constraintMax: 0.5,
        },
      ];
      const result = formatter.formatBindingAxes(axes);

      expect(result).toContain('**Binding Axes (Structural Conflicts)**:');
      expect(result).toContain('⚠️ **valence**');
      expect(result).toContain('Has positive weight (+1.00)');
      expect(result).toContain('constraint limits max to 0.50');
    });

    it('should format negative_weight_high_min conflicts', () => {
      const axes = [
        {
          axis: 'arousal',
          weight: -0.8,
          conflictType: 'negative_weight_high_min',
          constraintMin: 0.3,
        },
      ];
      const result = formatter.formatBindingAxes(axes);

      expect(result).toContain('**Binding Axes (Structural Conflicts)**:');
      expect(result).toContain('⚠️ **arousal**');
      expect(result).toContain('Has negative weight (-0.80)');
      expect(result).toContain('constraint requires min 0.30');
    });

    it('should format multiple conflicts', () => {
      const axes = [
        {
          axis: 'valence',
          weight: 1.0,
          conflictType: 'positive_weight_low_max',
          constraintMax: 0.5,
        },
        {
          axis: 'arousal',
          weight: -0.8,
          conflictType: 'negative_weight_high_min',
          constraintMin: 0.3,
        },
      ];
      const result = formatter.formatBindingAxes(axes);

      expect(result).toContain('⚠️ **valence**');
      expect(result).toContain('⚠️ **arousal**');
    });

    it('should handle unknown conflict type', () => {
      const axes = [
        {
          axis: 'valence',
          weight: 1.0,
          conflictType: 'unknown_conflict_type',
        },
      ];
      const result = formatter.formatBindingAxes(axes);

      expect(result).toContain('⚠️ **valence**: Binding conflict');
    });

    it('should handle mixed axes with and without conflicts', () => {
      const axes = [
        { axis: 'valence' }, // no conflict
        {
          axis: 'arousal',
          weight: -0.8,
          conflictType: 'negative_weight_high_min',
          constraintMin: 0.3,
        },
      ];
      const result = formatter.formatBindingAxes(axes);

      // When there are conflicts, only conflicts are shown
      expect(result).toContain('**Binding Axes (Structural Conflicts)**:');
      expect(result).toContain('⚠️ **arousal**');
      expect(result).not.toContain('valence');
    });
  });
});
