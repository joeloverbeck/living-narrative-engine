/**
 * @file Unit tests for DiagnosticResult model
 * @description Tests unified result model for expression diagnostics.
 */

import { describe, it, expect } from '@jest/globals';
import DiagnosticResult from '../../../../src/expressionDiagnostics/models/DiagnosticResult.js';

describe('DiagnosticResult Model', () => {
  describe('Constructor', () => {
    it('should create valid result with expressionId', () => {
      const result = new DiagnosticResult('test:expression');
      expect(result.expressionId).toBe('test:expression');
    });

    it('should throw if expressionId is missing', () => {
      expect(() => new DiagnosticResult()).toThrow(
        'DiagnosticResult requires expressionId'
      );
    });

    it('should throw if expressionId is null', () => {
      expect(() => new DiagnosticResult(null)).toThrow(
        'DiagnosticResult requires expressionId'
      );
    });

    it('should throw if expressionId is empty string', () => {
      expect(() => new DiagnosticResult('')).toThrow(
        'DiagnosticResult requires expressionId'
      );
    });

    it('should throw if expressionId is not a string', () => {
      expect(() => new DiagnosticResult(123)).toThrow(
        'DiagnosticResult requires expressionId'
      );
    });

    it('should throw if expressionId is an object', () => {
      expect(() => new DiagnosticResult({ id: 'test' })).toThrow(
        'DiagnosticResult requires expressionId'
      );
    });

    it('should set timestamp automatically', () => {
      const before = new Date();
      const result = new DiagnosticResult('test:expression');
      const after = new Date();

      expect(result.timestamp).toBeInstanceOf(Date);
      expect(result.timestamp.getTime()).toBeGreaterThanOrEqual(before.getTime());
      expect(result.timestamp.getTime()).toBeLessThanOrEqual(after.getTime());
    });

    it('should initialize with sensible defaults', () => {
      const result = new DiagnosticResult('test:expression');

      expect(result.isImpossible).toBe(false);
      expect(result.impossibilityReason).toBeNull();
      expect(result.gateConflicts).toEqual([]);
      expect(result.unreachableThresholds).toEqual([]);
      expect(result.triggerRate).toBeNull();
      expect(result.confidenceInterval).toBeNull();
      expect(result.sampleCount).toBe(0);
      expect(result.distribution).toBeNull();
      expect(result.clauseFailures).toEqual([]);
      expect(result.witnessState).toBeNull();
      expect(result.nearestMiss).toBeNull();
      expect(result.smtResult).toBeNull();
      expect(result.unsatCore).toBeNull();
      expect(result.suggestions).toEqual([]);
    });
  });

  describe('rarityCategory', () => {
    it('should return "impossible" when isImpossible is true', () => {
      const result = new DiagnosticResult('test:expression');
      result.setStaticAnalysis({
        gateConflicts: [{ axis: 'threat', required: { min: 0.5, max: 0.2 }, prototypes: [], gates: [] }],
      });
      expect(result.rarityCategory).toBe('impossible');
    });

    it('should return "unknown" when triggerRate is null and not marked impossible', () => {
      const result = new DiagnosticResult('test:expression');
      // When triggerRate is null and no impossibility detected,
      // should return 'unknown' (awaiting simulation data)
      expect(result.rarityCategory).toBe('unknown');
    });

    it('should return "impossible" when triggerRate is 0', () => {
      const result = new DiagnosticResult('test:expression');
      result.setMonteCarloResults({ triggerRate: 0 });
      expect(result.rarityCategory).toBe('impossible');
    });

    it('should return "extremely_rare" for rate < 0.00001', () => {
      const result = new DiagnosticResult('test:expression');
      result.setMonteCarloResults({ triggerRate: 0.000005 }); // 0.0005%
      expect(result.rarityCategory).toBe('extremely_rare');
    });

    it('should return "extremely_rare" for rate at boundary (0.000009)', () => {
      const result = new DiagnosticResult('test:expression');
      result.setMonteCarloResults({ triggerRate: 0.000009 });
      expect(result.rarityCategory).toBe('extremely_rare');
    });

    it('should return "rare" for rate 0.00001 (boundary)', () => {
      const result = new DiagnosticResult('test:expression');
      result.setMonteCarloResults({ triggerRate: 0.00001 });
      expect(result.rarityCategory).toBe('rare');
    });

    it('should return "rare" for rate in range 0.00001-0.0005', () => {
      const result = new DiagnosticResult('test:expression');
      result.setMonteCarloResults({ triggerRate: 0.0001 }); // 0.01%
      expect(result.rarityCategory).toBe('rare');
    });

    it('should return "rare" for rate at upper boundary (0.000499)', () => {
      const result = new DiagnosticResult('test:expression');
      result.setMonteCarloResults({ triggerRate: 0.000499 });
      expect(result.rarityCategory).toBe('rare');
    });

    it('should return "normal" for rate 0.0005 (boundary)', () => {
      const result = new DiagnosticResult('test:expression');
      result.setMonteCarloResults({ triggerRate: 0.0005 });
      expect(result.rarityCategory).toBe('normal');
    });

    it('should return "normal" for rate in range 0.0005-0.02', () => {
      const result = new DiagnosticResult('test:expression');
      result.setMonteCarloResults({ triggerRate: 0.01 }); // 1%
      expect(result.rarityCategory).toBe('normal');
    });

    it('should return "normal" for rate at upper boundary (0.019)', () => {
      const result = new DiagnosticResult('test:expression');
      result.setMonteCarloResults({ triggerRate: 0.019 });
      expect(result.rarityCategory).toBe('normal');
    });

    it('should return "frequent" for rate 0.02 (boundary)', () => {
      const result = new DiagnosticResult('test:expression');
      result.setMonteCarloResults({ triggerRate: 0.02 });
      expect(result.rarityCategory).toBe('frequent');
    });

    it('should return "frequent" for rate > 0.02', () => {
      const result = new DiagnosticResult('test:expression');
      result.setMonteCarloResults({ triggerRate: 0.05 }); // 5%
      expect(result.rarityCategory).toBe('frequent');
    });

    it('should return "frequent" for very high rate', () => {
      const result = new DiagnosticResult('test:expression');
      result.setMonteCarloResults({ triggerRate: 0.5 }); // 50%
      expect(result.rarityCategory).toBe('frequent');
    });
  });

  describe('statusIndicator', () => {
    it('should return correct indicator for impossible', () => {
      const result = new DiagnosticResult('test:expression');
      result.setStaticAnalysis({
        gateConflicts: [{ axis: 'threat', required: { min: 0.5, max: 0.2 }, prototypes: [], gates: [] }],
      });
      expect(result.statusIndicator).toEqual({
        color: 'red',
        emoji: '🔴',
        label: 'Impossible',
      });
    });

    it('should return correct indicator for extremely_rare', () => {
      const result = new DiagnosticResult('test:expression');
      result.setMonteCarloResults({ triggerRate: 0.000005 });
      expect(result.statusIndicator).toEqual({
        color: 'orange',
        emoji: '🟠',
        label: 'Extremely Rare',
      });
    });

    it('should return correct indicator for rare', () => {
      const result = new DiagnosticResult('test:expression');
      result.setMonteCarloResults({ triggerRate: 0.0001 });
      expect(result.statusIndicator).toEqual({
        color: 'yellow',
        emoji: '🟡',
        label: 'Rare',
      });
    });

    it('should return correct indicator for normal', () => {
      const result = new DiagnosticResult('test:expression');
      result.setMonteCarloResults({ triggerRate: 0.01 });
      expect(result.statusIndicator).toEqual({
        color: 'green',
        emoji: '🟢',
        label: 'Normal',
      });
    });

    it('should return correct indicator for frequent', () => {
      const result = new DiagnosticResult('test:expression');
      result.setMonteCarloResults({ triggerRate: 0.05 });
      expect(result.statusIndicator).toEqual({
        color: 'blue',
        emoji: '🔵',
        label: 'Frequent',
      });
    });
  });

  describe('setStaticAnalysis()', () => {
    it('should set isImpossible for gate conflicts', () => {
      const result = new DiagnosticResult('test:expression');
      result.setStaticAnalysis({
        gateConflicts: [
          { axis: 'threat', required: { min: 0.5, max: 0.2 }, prototypes: ['fear', 'confidence'], gates: ['threat >= 0.5', 'threat <= 0.2'] },
        ],
      });

      expect(result.isImpossible).toBe(true);
      expect(result.impossibilityReason).toBe('Gate conflict on axis: threat');
      expect(result.gateConflicts).toHaveLength(1);
      expect(result.gateConflicts[0].axis).toBe('threat');
    });

    it('should set isImpossible for unreachable thresholds', () => {
      const result = new DiagnosticResult('test:expression');
      result.setStaticAnalysis({
        unreachableThresholds: [
          { prototypeId: 'fear', type: 'emotion', threshold: 0.8, maxPossible: 0.6, gap: 0.2 },
        ],
      });

      expect(result.isImpossible).toBe(true);
      expect(result.impossibilityReason).toContain('Unreachable threshold');
      expect(result.impossibilityReason).toContain('fear');
      expect(result.unreachableThresholds).toHaveLength(1);
    });

    it('should prioritize gate conflicts over unreachable thresholds', () => {
      const result = new DiagnosticResult('test:expression');
      result.setStaticAnalysis({
        gateConflicts: [{ axis: 'threat', required: { min: 0.5, max: 0.2 }, prototypes: [], gates: [] }],
        unreachableThresholds: [{ prototypeId: 'fear', type: 'emotion', threshold: 0.8, maxPossible: 0.6, gap: 0.2 }],
      });

      expect(result.impossibilityReason).toBe('Gate conflict on axis: threat');
    });

    it('should not set isImpossible for empty static results', () => {
      const result = new DiagnosticResult('test:expression');
      result.setStaticAnalysis({});

      expect(result.isImpossible).toBe(false);
      expect(result.impossibilityReason).toBeNull();
    });

    it('should return this for chaining', () => {
      const result = new DiagnosticResult('test:expression');
      const returned = result.setStaticAnalysis({});
      expect(returned).toBe(result);
    });
  });

  describe('setMonteCarloResults()', () => {
    it('should store all fields correctly', () => {
      const result = new DiagnosticResult('test:expression');
      result.setMonteCarloResults({
        triggerRate: 0.015,
        sampleCount: 10000,
        distribution: 'gaussian',
        confidenceInterval: { low: 0.012, high: 0.018 },
        clauseFailures: [
          { clauseDescription: 'emotions.fear >= 0.5', failureRate: 0.72, averageViolation: 0.15, clauseIndex: 0 },
        ],
      });

      expect(result.triggerRate).toBe(0.015);
      expect(result.sampleCount).toBe(10000);
      expect(result.distribution).toBe('gaussian');
      expect(result.confidenceInterval).toEqual({ low: 0.012, high: 0.018 });
      expect(result.clauseFailures).toHaveLength(1);
      expect(result.clauseFailures[0].clauseDescription).toBe('emotions.fear >= 0.5');
    });

    it('should handle missing optional fields', () => {
      const result = new DiagnosticResult('test:expression');
      result.setMonteCarloResults({ triggerRate: 0.01 });

      expect(result.triggerRate).toBe(0.01);
      expect(result.sampleCount).toBe(0);
      expect(result.distribution).toBeNull();
      expect(result.confidenceInterval).toBeNull();
      expect(result.clauseFailures).toEqual([]);
    });

    it('should return this for chaining', () => {
      const result = new DiagnosticResult('test:expression');
      const returned = result.setMonteCarloResults({ triggerRate: 0.01 });
      expect(returned).toBe(result);
    });
  });

  describe('setWitnessResults()', () => {
    it('should store witness state and nearest miss', () => {
      const witnessState = { moodAxes: { valence: 50 }, sexualState: { sex_excitation: 70 } };
      const nearestMiss = { moodAxes: { valence: 45 }, sexualState: { sex_excitation: 65 } };

      const result = new DiagnosticResult('test:expression');
      result.setWitnessResults({ witnessState, nearestMiss });

      expect(result.witnessState).toEqual(witnessState);
      expect(result.nearestMiss).toEqual(nearestMiss);
    });

    it('should handle null witness state', () => {
      const result = new DiagnosticResult('test:expression');
      result.setWitnessResults({ witnessState: null, nearestMiss: { some: 'data' } });

      expect(result.witnessState).toBeNull();
      expect(result.nearestMiss).toEqual({ some: 'data' });
    });

    it('should handle missing fields', () => {
      const result = new DiagnosticResult('test:expression');
      result.setWitnessResults({});

      expect(result.witnessState).toBeNull();
      expect(result.nearestMiss).toBeNull();
    });

    it('should return this for chaining', () => {
      const result = new DiagnosticResult('test:expression');
      const returned = result.setWitnessResults({});
      expect(returned).toBe(result);
    });
  });

  describe('setSmtResults()', () => {
    it('should store SMT result when satisfiable', () => {
      const result = new DiagnosticResult('test:expression');
      result.setSmtResults({ satisfiable: true });

      expect(result.smtResult).toBe(true);
      expect(result.unsatCore).toBeNull();
      expect(result.isImpossible).toBe(false);
    });

    it('should set isImpossible when unsatisfiable with unsat core', () => {
      const result = new DiagnosticResult('test:expression');
      result.setSmtResults({
        satisfiable: false,
        unsatCore: ['threat >= 0.5', 'threat <= 0.2'],
      });

      expect(result.smtResult).toBe(false);
      expect(result.unsatCore).toEqual(['threat >= 0.5', 'threat <= 0.2']);
      expect(result.isImpossible).toBe(true);
      expect(result.impossibilityReason).toBe('SMT solver proved impossibility');
    });

    it('should not overwrite impossibility from static analysis', () => {
      const result = new DiagnosticResult('test:expression');
      result.setStaticAnalysis({
        gateConflicts: [{ axis: 'threat', required: { min: 0.5, max: 0.2 }, prototypes: [], gates: [] }],
      });
      result.setSmtResults({ satisfiable: false, unsatCore: ['constraint1'] });

      // SMT sets its own reason, which overwrites
      expect(result.isImpossible).toBe(true);
      expect(result.impossibilityReason).toBe('SMT solver proved impossibility');
    });

    it('should return this for chaining', () => {
      const result = new DiagnosticResult('test:expression');
      const returned = result.setSmtResults({ satisfiable: true });
      expect(returned).toBe(result);
    });
  });

  describe('setSuggestions()', () => {
    it('should store suggestions', () => {
      const suggestions = [
        { clause: 'emotions.fear >= 0.6', original: 0.6, suggested: 0.5, expectedTriggerRate: 0.02 },
        { clause: 'delta >= 0.12', original: 0.12, suggested: 0.08, expectedTriggerRate: 0.015 },
      ];

      const result = new DiagnosticResult('test:expression');
      result.setSuggestions(suggestions);

      expect(result.suggestions).toHaveLength(2);
      expect(result.suggestions[0].clause).toBe('emotions.fear >= 0.6');
    });

    it('should return this for chaining', () => {
      const result = new DiagnosticResult('test:expression');
      const returned = result.setSuggestions([]);
      expect(returned).toBe(result);
    });
  });

  describe('Builder Pattern Chaining', () => {
    it('should allow chaining all setters', () => {
      const result = new DiagnosticResult('test:expression')
        .setStaticAnalysis({ gateConflicts: [] })
        .setMonteCarloResults({ triggerRate: 0.01 })
        .setWitnessResults({ witnessState: { valence: 50 } })
        .setSmtResults({ satisfiable: true })
        .setSuggestions([]);

      expect(result.expressionId).toBe('test:expression');
      expect(result.triggerRate).toBe(0.01);
    });
  });

  describe('Immutability', () => {
    it('should return copy of gateConflicts array', () => {
      const result = new DiagnosticResult('test:expression');
      const conflicts = [{ axis: 'threat', required: { min: 0.5, max: 0.2 }, prototypes: [], gates: [] }];
      result.setStaticAnalysis({ gateConflicts: conflicts });

      const retrieved = result.gateConflicts;
      retrieved.push({ axis: 'new' });

      expect(result.gateConflicts).toHaveLength(1);
    });

    it('should return copy of unreachableThresholds array', () => {
      const result = new DiagnosticResult('test:expression');
      const thresholds = [{ prototypeId: 'fear', type: 'emotion', threshold: 0.8, maxPossible: 0.6, gap: 0.2 }];
      result.setStaticAnalysis({ unreachableThresholds: thresholds });

      const retrieved = result.unreachableThresholds;
      retrieved.push({ prototypeId: 'new' });

      expect(result.unreachableThresholds).toHaveLength(1);
    });

    it('should return copy of clauseFailures array', () => {
      const result = new DiagnosticResult('test:expression');
      result.setMonteCarloResults({
        clauseFailures: [{ clauseDescription: 'test', failureRate: 0.5, averageViolation: 0.1, clauseIndex: 0 }],
      });

      const retrieved = result.clauseFailures;
      retrieved.push({ clauseDescription: 'new' });

      expect(result.clauseFailures).toHaveLength(1);
    });

    it('should return copy of unsatCore array', () => {
      const result = new DiagnosticResult('test:expression');
      result.setSmtResults({ satisfiable: false, unsatCore: ['constraint1'] });

      const retrieved = result.unsatCore;
      retrieved.push('newConstraint');

      expect(result.unsatCore).toHaveLength(1);
    });

    it('should return copy of suggestions array', () => {
      const result = new DiagnosticResult('test:expression');
      result.setSuggestions([{ clause: 'test', original: 0.5, suggested: 0.4, expectedTriggerRate: 0.01 }]);

      const retrieved = result.suggestions;
      retrieved.push({ clause: 'new' });

      expect(result.suggestions).toHaveLength(1);
    });
  });

  describe('toJSON()', () => {
    it('should serialize all fields correctly', () => {
      const result = new DiagnosticResult('test:expression');
      result.setStaticAnalysis({
        gateConflicts: [{ axis: 'threat', required: { min: 0.5, max: 0.2 }, prototypes: ['fear'], gates: ['threat >= 0.5'] }],
      });
      result.setMonteCarloResults({
        triggerRate: 0.015,
        sampleCount: 10000,
        distribution: 'gaussian',
        confidenceInterval: { low: 0.012, high: 0.018 },
        clauseFailures: [{ clauseDescription: 'test', failureRate: 0.5, averageViolation: 0.1, clauseIndex: 0 }],
      });
      result.setWitnessResults({
        witnessState: { valence: 50 },
        nearestMiss: { valence: 45 },
      });
      result.setSuggestions([{ clause: 'test', original: 0.5, suggested: 0.4, expectedTriggerRate: 0.01 }]);

      const json = result.toJSON();

      expect(json.expressionId).toBe('test:expression');
      expect(json.timestamp).toMatch(/^\d{4}-\d{2}-\d{2}T/);
      expect(json.rarityCategory).toBe('impossible');
      expect(json.statusIndicator.color).toBe('red');
      expect(json.isImpossible).toBe(true);
      expect(json.impossibilityReason).toContain('Gate conflict');
      expect(json.staticAnalysis.gateConflicts).toHaveLength(1);
      expect(json.monteCarlo.triggerRate).toBe(0.015);
      expect(json.monteCarlo.confidenceInterval).toEqual({ low: 0.012, high: 0.018 });
      expect(json.witness.found).toBe(true);
      expect(json.witness.state).toEqual({ valence: 50 });
      expect(json.suggestions).toHaveLength(1);
    });

    it('should output valid JSON with no circular refs', () => {
      const result = new DiagnosticResult('test:expression');
      result.setMonteCarloResults({ triggerRate: 0.01 });

      const jsonString = JSON.stringify(result.toJSON());
      const parsed = JSON.parse(jsonString);

      expect(parsed.expressionId).toBe('test:expression');
      expect(parsed.monteCarlo.triggerRate).toBe(0.01);
    });

    it('should handle default/empty state', () => {
      const result = new DiagnosticResult('test:expression');
      const json = result.toJSON();

      expect(json.expressionId).toBe('test:expression');
      expect(json.isImpossible).toBe(false);
      expect(json.impossibilityReason).toBeNull();
      expect(json.staticAnalysis.gateConflicts).toEqual([]);
      expect(json.monteCarlo.triggerRate).toBeNull();
      expect(json.witness.found).toBe(false);
      expect(json.smt.satisfiable).toBeNull();
      expect(json.suggestions).toEqual([]);
    });
  });

  describe('Static Constants', () => {
    it('should export RARITY_THRESHOLDS', () => {
      expect(DiagnosticResult.RARITY_THRESHOLDS).toBeDefined();
      expect(DiagnosticResult.RARITY_THRESHOLDS.IMPOSSIBLE).toBe(0);
      expect(DiagnosticResult.RARITY_THRESHOLDS.EXTREMELY_RARE).toBe(0.00001);
      expect(DiagnosticResult.RARITY_THRESHOLDS.RARE).toBe(0.0005);
      expect(DiagnosticResult.RARITY_THRESHOLDS.NORMAL).toBe(0.02);
    });

    it('should export RARITY_CATEGORIES', () => {
      expect(DiagnosticResult.RARITY_CATEGORIES).toBeDefined();
      expect(DiagnosticResult.RARITY_CATEGORIES.IMPOSSIBLE).toBe('impossible');
      expect(DiagnosticResult.RARITY_CATEGORIES.EXTREMELY_RARE).toBe('extremely_rare');
      expect(DiagnosticResult.RARITY_CATEGORIES.RARE).toBe('rare');
      expect(DiagnosticResult.RARITY_CATEGORIES.NORMAL).toBe('normal');
      expect(DiagnosticResult.RARITY_CATEGORIES.FREQUENT).toBe('frequent');
    });

    it('should export STATUS_INDICATORS', () => {
      expect(DiagnosticResult.STATUS_INDICATORS).toBeDefined();
      expect(DiagnosticResult.STATUS_INDICATORS.impossible.color).toBe('red');
      expect(DiagnosticResult.STATUS_INDICATORS.extremely_rare.color).toBe('orange');
      expect(DiagnosticResult.STATUS_INDICATORS.rare.color).toBe('yellow');
      expect(DiagnosticResult.STATUS_INDICATORS.normal.color).toBe('green');
      expect(DiagnosticResult.STATUS_INDICATORS.frequent.color).toBe('blue');
    });

    it('should have frozen constants', () => {
      expect(Object.isFrozen(DiagnosticResult.RARITY_THRESHOLDS)).toBe(true);
      expect(Object.isFrozen(DiagnosticResult.RARITY_CATEGORIES)).toBe(true);
      expect(Object.isFrozen(DiagnosticResult.STATUS_INDICATORS)).toBe(true);
    });

    it('should export UNKNOWN in RARITY_CATEGORIES', () => {
      expect(DiagnosticResult.RARITY_CATEGORIES.UNKNOWN).toBe('unknown');
    });

    it('should export unknown status indicator', () => {
      expect(DiagnosticResult.STATUS_INDICATORS.unknown).toBeDefined();
      expect(DiagnosticResult.STATUS_INDICATORS.unknown.color).toBe('gray');
      expect(DiagnosticResult.STATUS_INDICATORS.unknown.emoji).toBe('⚪');
      expect(DiagnosticResult.STATUS_INDICATORS.unknown.label).toBe('Unknown');
    });
  });

  describe('getRarityCategoryForRate() static helper', () => {
    it('should return "impossible" for rate 0', () => {
      expect(DiagnosticResult.getRarityCategoryForRate(0)).toBe('impossible');
    });

    it('should return "extremely_rare" for rate < 0.00001 (0.001%)', () => {
      expect(DiagnosticResult.getRarityCategoryForRate(0.000005)).toBe(
        'extremely_rare'
      );
    });

    it('should return "rare" for rate at EXTREMELY_RARE threshold (boundary)', () => {
      expect(DiagnosticResult.getRarityCategoryForRate(0.00001)).toBe('rare');
    });

    it('should return "rare" for rate in EXTREMELY_RARE-RARE range', () => {
      expect(DiagnosticResult.getRarityCategoryForRate(0.0001)).toBe('rare');
    });

    it('should return "normal" for rate at RARE threshold (boundary)', () => {
      expect(DiagnosticResult.getRarityCategoryForRate(0.0005)).toBe('normal');
    });

    it('should return "normal" for rate in RARE-NORMAL range', () => {
      expect(DiagnosticResult.getRarityCategoryForRate(0.01)).toBe('normal');
    });

    it('should return "frequent" for rate at NORMAL threshold (boundary)', () => {
      expect(DiagnosticResult.getRarityCategoryForRate(0.02)).toBe('frequent');
    });

    it('should return "frequent" for rate > NORMAL threshold', () => {
      expect(DiagnosticResult.getRarityCategoryForRate(0.05)).toBe('frequent');
      expect(DiagnosticResult.getRarityCategoryForRate(0.5)).toBe('frequent');
    });

    it('should match instance rarityCategory getter for all rates', () => {
      const rates = [0, 0.000005, 0.00001, 0.0001, 0.0005, 0.01, 0.02, 0.05];

      // Test each rate - all use the same setMonteCarloResults pattern
      for (const rate of rates) {
        const result = new DiagnosticResult('test:expression');
        result.setMonteCarloResults({ triggerRate: rate });
        expect(DiagnosticResult.getRarityCategoryForRate(rate)).toBe(
          result.rarityCategory
        );
      }
    });
  });

  describe('Static Analysis Only (No Monte Carlo)', () => {
    it('should return "unknown" when static analysis passes but no simulation run', () => {
      const result = new DiagnosticResult('test:expression');
      // Static analysis with no issues
      result.setStaticAnalysis({
        gateConflicts: [],
        unreachableThresholds: [],
      });

      // No Monte Carlo results set (triggerRate remains null)
      // Should NOT be 'impossible' - should be 'unknown'
      expect(result.rarityCategory).toBe('unknown');
      expect(result.isImpossible).toBe(false);
    });

    it('should return "impossible" when static analysis detects gate conflicts', () => {
      const result = new DiagnosticResult('test:expression');
      result.setStaticAnalysis({
        gateConflicts: [
          {
            axis: 'threat',
            required: { min: 0.5, max: 0.2 },
            prototypes: ['fear'],
            gates: ['threat >= 0.5', 'threat <= 0.2'],
          },
        ],
        unreachableThresholds: [],
      });

      expect(result.rarityCategory).toBe('impossible');
      expect(result.isImpossible).toBe(true);
    });

    it('should return "impossible" when static analysis detects unreachable thresholds', () => {
      const result = new DiagnosticResult('test:expression');
      result.setStaticAnalysis({
        gateConflicts: [],
        unreachableThresholds: [
          {
            prototypeId: 'fear',
            type: 'emotion',
            threshold: 0.85,
            maxPossible: 0.7666666666666667,
            gap: 0.0833333333333333,
          },
        ],
      });

      expect(result.rarityCategory).toBe('impossible');
      expect(result.isImpossible).toBe(true);
      expect(result.impossibilityReason).toContain('Unreachable threshold');
    });

    it('should have correct status indicator for unknown category', () => {
      const result = new DiagnosticResult('test:expression');
      result.setStaticAnalysis({
        gateConflicts: [],
        unreachableThresholds: [],
      });

      expect(result.statusIndicator).toEqual({
        color: 'gray',
        emoji: '⚪',
        label: 'Unknown',
      });
    });

    it('should transition from unknown to rarity category when Monte Carlo results added', () => {
      const result = new DiagnosticResult('test:expression');
      result.setStaticAnalysis({
        gateConflicts: [],
        unreachableThresholds: [],
      });

      // Before Monte Carlo
      expect(result.rarityCategory).toBe('unknown');

      // After Monte Carlo
      result.setMonteCarloResults({ triggerRate: 0.05 });
      expect(result.rarityCategory).toBe('frequent');
    });
  });
});
