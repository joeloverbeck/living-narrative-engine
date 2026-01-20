/**
 * @file recommendationUtils.test.js - Unit tests for shared recommendation utilities
 */

import { describe, it, expect } from '@jest/globals';
import {
  SEVERITY_ORDER,
  CHOKE_GATE_FAIL_RATE,
  CHOKE_PASS_GIVEN_GATE_MAX,
  getConfidence,
  getSeverity,
  buildPopulation,
  getImpactFromId,
  isThresholdChoke,
  classifyChokeType,
} from '../../../../../src/expressionDiagnostics/services/utils/recommendationUtils.js';

describe('recommendationUtils', () => {
  describe('Constants', () => {
    it('exports SEVERITY_ORDER with correct values', () => {
      expect(SEVERITY_ORDER).toEqual({
        high: 0,
        medium: 1,
        low: 2,
      });
    });

    it('exports CHOKE_GATE_FAIL_RATE as 0.2', () => {
      expect(CHOKE_GATE_FAIL_RATE).toBe(0.2);
    });

    it('exports CHOKE_PASS_GIVEN_GATE_MAX as 0.95', () => {
      expect(CHOKE_PASS_GIVEN_GATE_MAX).toBe(0.95);
    });
  });

  describe('getConfidence', () => {
    it('returns "high" for sampleCount >= 500', () => {
      expect(getConfidence(500)).toBe('high');
      expect(getConfidence(1000)).toBe('high');
    });

    it('returns "medium" for sampleCount >= 200 and < 500', () => {
      expect(getConfidence(200)).toBe('medium');
      expect(getConfidence(499)).toBe('medium');
    });

    it('returns "low" for sampleCount < 200', () => {
      expect(getConfidence(199)).toBe('low');
      expect(getConfidence(0)).toBe('low');
    });

    it('handles edge cases', () => {
      expect(getConfidence(NaN)).toBe('low');
      expect(getConfidence(-1)).toBe('low');
    });
  });

  describe('getSeverity', () => {
    it('returns "high" for impact >= 0.2', () => {
      expect(getSeverity(0.2)).toBe('high');
      expect(getSeverity(0.5)).toBe('high');
      expect(getSeverity(1.0)).toBe('high');
    });

    it('returns "medium" for impact >= 0.1 and < 0.2', () => {
      expect(getSeverity(0.1)).toBe('medium');
      expect(getSeverity(0.19)).toBe('medium');
    });

    it('returns "low" for impact < 0.1', () => {
      expect(getSeverity(0.09)).toBe('low');
      expect(getSeverity(0)).toBe('low');
    });

    it('handles edge cases', () => {
      expect(getSeverity(NaN)).toBe('low');
      expect(getSeverity(-0.1)).toBe('low');
    });
  });

  describe('buildPopulation', () => {
    it('builds population with valid name and count', () => {
      expect(buildPopulation('test', 100)).toEqual({
        name: 'test',
        count: 100,
      });
    });

    it('returns null for empty name', () => {
      expect(buildPopulation('', 100)).toBeNull();
    });

    it('returns null for non-string name', () => {
      expect(buildPopulation(null, 100)).toBeNull();
      expect(buildPopulation(undefined, 100)).toBeNull();
      expect(buildPopulation(123, 100)).toBeNull();
    });

    it('returns population with null count for non-number count', () => {
      expect(buildPopulation('test', null)).toEqual({
        name: 'test',
        count: null,
      });
      expect(buildPopulation('test', undefined)).toEqual({
        name: 'test',
        count: null,
      });
      expect(buildPopulation('test', 'abc')).toEqual({
        name: 'test',
        count: null,
      });
    });

    it('returns population with null count for NaN', () => {
      expect(buildPopulation('test', NaN)).toEqual({
        name: 'test',
        count: null,
      });
    });

    it('handles zero count', () => {
      expect(buildPopulation('test', 0)).toEqual({ name: 'test', count: 0 });
    });
  });

  describe('getImpactFromId', () => {
    const clauses = [
      { clauseId: 'clause1', impact: 0.5 },
      { clauseId: 'clause2', impact: 0.3 },
      { clauseId: 'ns:clause3', impact: 0.8 },
    ];

    it('extracts impact from ID with two colons', () => {
      expect(getImpactFromId('type:sub:clause1', clauses)).toBe(0.5);
    });

    it('extracts impact from ID with more colons', () => {
      expect(getImpactFromId('type:sub:ns:clause3', clauses)).toBe(0.8);
    });

    it('returns 0 for non-matching clause', () => {
      expect(getImpactFromId('type:sub:nonexistent', clauses)).toBe(0);
    });

    it('returns 0 for empty clauses array', () => {
      expect(getImpactFromId('type:sub:clause1', [])).toBe(0);
    });

    it('handles clause with missing impact', () => {
      const clausesWithMissing = [{ clauseId: 'clause1' }];
      expect(getImpactFromId('type:sub:clause1', clausesWithMissing)).toBe(0);
    });
  });

  describe('isThresholdChoke', () => {
    it('returns true when passGivenGate < CHOKE_PASS_GIVEN_GATE_MAX', () => {
      expect(
        isThresholdChoke({
          passGivenGate: 0.9,
          meanValueGivenGate: null,
          thresholdValue: null,
        })
      ).toBe(true);
    });

    it('returns false when passGivenGate >= CHOKE_PASS_GIVEN_GATE_MAX', () => {
      expect(
        isThresholdChoke({
          passGivenGate: 0.95,
          meanValueGivenGate: null,
          thresholdValue: null,
        })
      ).toBe(false);
      expect(
        isThresholdChoke({
          passGivenGate: 0.99,
          meanValueGivenGate: null,
          thresholdValue: null,
        })
      ).toBe(false);
    });

    it('uses meanValueGivenGate comparison when passGivenGate is null', () => {
      expect(
        isThresholdChoke({
          passGivenGate: null,
          meanValueGivenGate: 0.3,
          thresholdValue: 0.5,
        })
      ).toBe(true);
      expect(
        isThresholdChoke({
          passGivenGate: null,
          meanValueGivenGate: 0.6,
          thresholdValue: 0.5,
        })
      ).toBe(false);
    });

    it('returns false when no valid data available', () => {
      expect(
        isThresholdChoke({
          passGivenGate: null,
          meanValueGivenGate: null,
          thresholdValue: 0.5,
        })
      ).toBe(false);
      expect(
        isThresholdChoke({
          passGivenGate: null,
          meanValueGivenGate: 0.5,
          thresholdValue: null,
        })
      ).toBe(false);
    });
  });

  describe('classifyChokeType', () => {
    const basePrototype = {
      gateFailRate: null,
      gatePassCount: 0,
      pThreshGivenGate: null,
      meanValueGivenGate: null,
    };

    const baseClause = {
      thresholdValue: 0.5,
    };

    it('returns "mixed" for explicit gate AND threshold mismatch', () => {
      expect(
        classifyChokeType({
          prototype: basePrototype,
          clause: baseClause,
          gateMismatch: true,
          thresholdMismatch: true,
        })
      ).toBe('mixed');
    });

    it('returns "gate" for explicit gate mismatch only', () => {
      expect(
        classifyChokeType({
          prototype: basePrototype,
          clause: baseClause,
          gateMismatch: true,
          thresholdMismatch: false,
        })
      ).toBe('gate');
    });

    it('returns "threshold" for explicit threshold mismatch only', () => {
      expect(
        classifyChokeType({
          prototype: basePrototype,
          clause: baseClause,
          gateMismatch: false,
          thresholdMismatch: true,
        })
      ).toBe('threshold');
    });

    it('detects gate problem from statistics', () => {
      const prototypeWithGateProblem = {
        ...basePrototype,
        gateFailRate: 0.3, // >= CHOKE_GATE_FAIL_RATE (0.2)
        gatePassCount: 0, // No gate passes, so no threshold check
      };
      expect(
        classifyChokeType({
          prototype: prototypeWithGateProblem,
          clause: baseClause,
          gateMismatch: false,
          thresholdMismatch: false,
        })
      ).toBe('gate');
    });

    it('detects threshold problem from statistics', () => {
      const prototypeWithThresholdProblem = {
        ...basePrototype,
        gateFailRate: 0.1, // < CHOKE_GATE_FAIL_RATE, so no gate problem
        gatePassCount: 100,
        pThreshGivenGate: 0.5, // < CHOKE_PASS_GIVEN_GATE_MAX (0.95)
      };
      expect(
        classifyChokeType({
          prototype: prototypeWithThresholdProblem,
          clause: baseClause,
          gateMismatch: false,
          thresholdMismatch: false,
        })
      ).toBe('threshold');
    });

    it('detects mixed problem from statistics', () => {
      const prototypeWithBothProblems = {
        ...basePrototype,
        gateFailRate: 0.3, // >= CHOKE_GATE_FAIL_RATE
        gatePassCount: 100,
        pThreshGivenGate: 0.5, // < CHOKE_PASS_GIVEN_GATE_MAX
      };
      expect(
        classifyChokeType({
          prototype: prototypeWithBothProblems,
          clause: baseClause,
          gateMismatch: false,
          thresholdMismatch: false,
        })
      ).toBe('mixed');
    });

    it('returns "mixed" as fallback when no specific problem detected', () => {
      const prototypeNoProblems = {
        ...basePrototype,
        gateFailRate: 0.1, // < CHOKE_GATE_FAIL_RATE
        gatePassCount: 0, // No gate passes, so no threshold check
      };
      expect(
        classifyChokeType({
          prototype: prototypeNoProblems,
          clause: baseClause,
          gateMismatch: false,
          thresholdMismatch: false,
        })
      ).toBe('mixed');
    });

    it('handles missing prototype statistics gracefully', () => {
      expect(
        classifyChokeType({
          prototype: {},
          clause: {},
          gateMismatch: false,
          thresholdMismatch: false,
        })
      ).toBe('mixed');
    });
  });
});
