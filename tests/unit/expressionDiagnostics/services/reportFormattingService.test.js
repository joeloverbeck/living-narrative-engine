/**
 * @file Unit tests for ReportFormattingService
 * @description Tests for all 20 formatting methods extracted from MonteCarloReportGenerator.
 * Each method is tested with normal cases, edge cases, and error handling.
 */

import { describe, it, expect } from '@jest/globals';
import ReportFormattingService from '../../../../src/expressionDiagnostics/services/ReportFormattingService.js';

describe('ReportFormattingService', () => {
  let service;

  beforeEach(() => {
    service = new ReportFormattingService();
  });

  // ============================================================================
  // Number Formatting
  // ============================================================================

  describe('formatPercentage', () => {
    it('formats standard percentages with 2 decimal places', () => {
      expect(service.formatPercentage(0.15)).toBe('15.00%');
      expect(service.formatPercentage(0.5)).toBe('50.00%');
      expect(service.formatPercentage(1)).toBe('100.00%');
    });

    it('respects custom decimal places', () => {
      expect(service.formatPercentage(0.15123, 3)).toBe('15.123%');
      expect(service.formatPercentage(0.15, 0)).toBe('15%');
    });

    it('handles zero', () => {
      expect(service.formatPercentage(0)).toBe('0.00%');
    });

    it('handles very small values with increased precision', () => {
      expect(service.formatPercentage(0.00005)).toBe('0.0050%');
    });

    it('handles extremely small values with scientific notation', () => {
      const result = service.formatPercentage(0.000005);
      expect(result).toMatch(/^\d\.\d+e[+-]\d+%$/);
    });

    it('returns N/A for null, undefined, NaN', () => {
      expect(service.formatPercentage(null)).toBe('N/A');
      expect(service.formatPercentage(undefined)).toBe('N/A');
      expect(service.formatPercentage(NaN)).toBe('N/A');
    });

    it('returns N/A for non-number values', () => {
      expect(service.formatPercentage('50')).toBe('N/A');
      expect(service.formatPercentage({})).toBe('N/A');
    });
  });

  describe('formatNumber', () => {
    it('formats numbers with 2 decimal places by default', () => {
      expect(service.formatNumber(1.2345)).toBe('1.23');
      expect(service.formatNumber(100)).toBe('100.00');
    });

    it('respects custom decimal places', () => {
      // Note: JavaScript's toFixed() uses banker's rounding, so 1.2345 rounds to 1.234 not 1.235
      expect(service.formatNumber(1.2345, 3)).toBe('1.234');
      expect(service.formatNumber(1.2345, 0)).toBe('1');
    });

    it('handles zero', () => {
      expect(service.formatNumber(0)).toBe('0.00');
    });

    it('handles negative numbers', () => {
      expect(service.formatNumber(-5.5)).toBe('-5.50');
    });

    it('returns N/A for invalid values', () => {
      expect(service.formatNumber(null)).toBe('N/A');
      expect(service.formatNumber(undefined)).toBe('N/A');
      expect(service.formatNumber(NaN)).toBe('N/A');
      expect(service.formatNumber('hello')).toBe('N/A');
    });
  });

  describe('formatCount', () => {
    it('formats counts with locale-specific separators', () => {
      const result = service.formatCount(1000000);
      // Check that it contains separators (varies by locale)
      expect(result).toMatch(/^\d{1,3}(,\d{3})*$/);
    });

    it('handles small numbers', () => {
      expect(service.formatCount(42)).toBe('42');
    });

    it('handles zero', () => {
      expect(service.formatCount(0)).toBe('0');
    });

    it('returns N/A for non-finite values', () => {
      expect(service.formatCount(Infinity)).toBe('N/A');
      expect(service.formatCount(-Infinity)).toBe('N/A');
      expect(service.formatCount(NaN)).toBe('N/A');
    });
  });

  describe('formatSignedNumber', () => {
    it('formats positive numbers with + sign', () => {
      expect(service.formatSignedNumber(5)).toBe('+5.000');
    });

    it('formats negative numbers with - sign', () => {
      expect(service.formatSignedNumber(-5)).toBe('-5.000');
    });

    it('formats zero with + sign', () => {
      expect(service.formatSignedNumber(0)).toBe('+0.000');
    });

    it('returns N/A for invalid values', () => {
      expect(service.formatSignedNumber(null)).toBe('N/A');
      expect(service.formatSignedNumber(undefined)).toBe('N/A');
      expect(service.formatSignedNumber(NaN)).toBe('N/A');
    });
  });

  describe('formatSignedPercentagePoints', () => {
    it('formats positive percentage points with + sign', () => {
      expect(service.formatSignedPercentagePoints(0.05)).toBe('+5.00 pp');
    });

    it('formats negative percentage points with - sign', () => {
      expect(service.formatSignedPercentagePoints(-0.05)).toBe('-5.00 pp');
    });

    it('formats zero without sign', () => {
      expect(service.formatSignedPercentagePoints(0)).toBe('0.00 pp');
    });

    it('returns N/A for NaN', () => {
      expect(service.formatSignedPercentagePoints(NaN)).toBe('N/A');
    });
  });

  describe('formatBooleanValue', () => {
    it('returns yes for true', () => {
      expect(service.formatBooleanValue(true)).toBe('yes');
    });

    it('returns no for false', () => {
      expect(service.formatBooleanValue(false)).toBe('no');
    });

    it('returns N/A for null, undefined, or other values', () => {
      expect(service.formatBooleanValue(null)).toBe('N/A');
      expect(service.formatBooleanValue(undefined)).toBe('N/A');
      expect(service.formatBooleanValue('true')).toBe('N/A');
      expect(service.formatBooleanValue(1)).toBe('N/A');
    });
  });

  // ============================================================================
  // Rate Formatting
  // ============================================================================

  describe('formatFailRate', () => {
    it('formats rate as percentage without counts', () => {
      expect(service.formatFailRate(0.15)).toBe('15.00%');
    });

    it('formats rate with failure and total counts', () => {
      expect(service.formatFailRate(0.15, 15, 100)).toBe('15.00% (15 / 100)');
    });

    it('ignores counts when total is zero', () => {
      expect(service.formatFailRate(0.15, 15, 0)).toBe('15.00%');
    });

    it('returns N/A for invalid rate', () => {
      expect(service.formatFailRate(null)).toBe('N/A');
      expect(service.formatFailRate(undefined)).toBe('N/A');
      expect(service.formatFailRate(NaN)).toBe('N/A');
    });
  });

  describe('formatRateWithCounts', () => {
    it('formats rate as percentage without counts', () => {
      expect(service.formatRateWithCounts(0.5)).toBe('50.00%');
    });

    it('formats rate with count and total', () => {
      expect(service.formatRateWithCounts(0.5, 50, 100)).toBe('50.00% (50 / 100)');
    });

    it('ignores counts when total is zero', () => {
      expect(service.formatRateWithCounts(0.5, 50, 0)).toBe('50.00%');
    });

    it('returns N/A for invalid rate', () => {
      expect(service.formatRateWithCounts(null)).toBe('N/A');
      expect(service.formatRateWithCounts(undefined)).toBe('N/A');
      expect(service.formatRateWithCounts(NaN)).toBe('N/A');
    });
  });

  // ============================================================================
  // Threshold Formatting
  // ============================================================================

  describe('formatThresholdValue', () => {
    it('formats non-integer domain values with decimals', () => {
      expect(service.formatThresholdValue(0.5, false)).toBe('0.50');
    });

    it('formats integer domain values as integers', () => {
      expect(service.formatThresholdValue(5.0, true)).toBe('5');
    });

    it('formats integer domain with close-to-integer values as integers', () => {
      expect(service.formatThresholdValue(5.0000001, true)).toBe('5');
    });

    it('formats integer domain with non-integer values with decimals', () => {
      expect(service.formatThresholdValue(5.5, true)).toBe('5.50');
    });

    it('returns N/A for invalid values', () => {
      expect(service.formatThresholdValue(null, false)).toBe('N/A');
      expect(service.formatThresholdValue(undefined, false)).toBe('N/A');
      expect(service.formatThresholdValue(NaN, false)).toBe('N/A');
    });
  });

  describe('formatEffectiveThreshold', () => {
    it('rounds to integer and returns as string', () => {
      expect(service.formatEffectiveThreshold(5.4)).toBe('5');
      expect(service.formatEffectiveThreshold(5.6)).toBe('6');
    });

    it('returns em dash for invalid values', () => {
      expect(service.formatEffectiveThreshold(null)).toBe('—');
      expect(service.formatEffectiveThreshold(undefined)).toBe('—');
      expect(service.formatEffectiveThreshold(NaN)).toBe('—');
    });
  });

  // ============================================================================
  // Population Formatting
  // ============================================================================

  describe('formatPopulationHeader', () => {
    it('formats complete population object', () => {
      const population = {
        name: 'test-population',
        predicate: 'test-predicate',
        count: 1000,
        hash: 'abc123',
      };
      const result = service.formatPopulationHeader(population);
      expect(result).toBe(
        '**Population**: test-population (predicate: test-predicate; count: 1,000; hash: abc123).\n'
      );
    });

    it('uses defaults for missing optional fields', () => {
      const population = { name: 'test', count: 100 };
      const result = service.formatPopulationHeader(population);
      expect(result).toContain('predicate: all');
      expect(result).toContain('hash: unknown');
    });

    it('returns empty string for null or undefined', () => {
      expect(service.formatPopulationHeader(null)).toBe('');
      expect(service.formatPopulationHeader(undefined)).toBe('');
    });

    it('returns empty string for non-finite count', () => {
      expect(service.formatPopulationHeader({ name: 'test', count: NaN })).toBe(
        ''
      );
    });
  });

  describe('formatStoredContextPopulationLabel', () => {
    it('delegates to formatPopulationHeader when population is provided', () => {
      const population = {
        name: 'explicit-population',
        count: 500,
        predicate: 'test',
        hash: 'xyz',
      };
      const result = service.formatStoredContextPopulationLabel(null, population);
      expect(result).toContain('explicit-population');
    });

    it('formats from populationSummary when population is null', () => {
      const summary = {
        sampleCount: 10000,
        storedContextCount: 500,
        storedContextLimit: 1000,
        storedInRegimeCount: 300,
      };
      const result = service.formatStoredContextPopulationLabel(summary);
      expect(result).toContain('500');
      expect(result).toContain('10,000');
      expect(result).toContain('1,000');
      expect(result).toContain('300');
    });

    it('returns empty string for null summary without population', () => {
      expect(service.formatStoredContextPopulationLabel(null)).toBe('');
    });

    it('returns empty string for zero stored context count', () => {
      const summary = { storedContextCount: 0, sampleCount: 100 };
      expect(service.formatStoredContextPopulationLabel(summary)).toBe('');
    });
  });

  describe('formatPopulationEvidenceLabel', () => {
    it('formats population evidence label', () => {
      const population = { name: 'test-pop', count: 1234 };
      const result = service.formatPopulationEvidenceLabel(population);
      expect(result).toBe('Population: test-pop (N=1,234)');
    });

    it('returns null for missing name', () => {
      expect(service.formatPopulationEvidenceLabel({ count: 100 })).toBe(null);
    });

    it('returns null for non-finite count', () => {
      expect(service.formatPopulationEvidenceLabel({ name: 'test', count: NaN })).toBe(
        null
      );
    });

    it('returns null for null input', () => {
      expect(service.formatPopulationEvidenceLabel(null)).toBe(null);
    });
  });

  // ============================================================================
  // Evidence Formatting
  // ============================================================================

  describe('formatEvidenceCount', () => {
    it('returns integer as-is', () => {
      expect(service.formatEvidenceCount(42)).toBe(42);
    });

    it('formats non-integer with decimals', () => {
      expect(service.formatEvidenceCount(42.567)).toBe('42.57');
    });

    it('returns ? for non-numbers', () => {
      expect(service.formatEvidenceCount('hello')).toBe('?');
      expect(service.formatEvidenceCount(null)).toBe('?');
    });

    it('returns ? for NaN', () => {
      expect(service.formatEvidenceCount(NaN)).toBe('?');
    });
  });

  describe('formatEvidenceValue', () => {
    it('formats as percentage when value is in 0-1 range and denominator is not 1', () => {
      expect(service.formatEvidenceValue(0.5, 100)).toBe('50.00%');
    });

    it('formats as number when denominator is 1', () => {
      expect(service.formatEvidenceValue(0.5, 1)).toBe('0.50');
    });

    it('formats as number when value is outside 0-1 range', () => {
      expect(service.formatEvidenceValue(1.5, 100)).toBe('1.50');
      expect(service.formatEvidenceValue(-0.5, 100)).toBe('-0.50');
    });

    it('returns n/a for non-numbers', () => {
      expect(service.formatEvidenceValue('hello', 100)).toBe('n/a');
      expect(service.formatEvidenceValue(null, 100)).toBe('n/a');
    });

    it('returns n/a for NaN', () => {
      expect(service.formatEvidenceValue(NaN, 100)).toBe('n/a');
    });
  });

  // ============================================================================
  // Misc Formatting
  // ============================================================================

  describe('formatOrMoodConstraintWarning', () => {
    it('returns the standard OR mood constraint warning', () => {
      const result = service.formatOrMoodConstraintWarning();
      expect(result).toContain('⚠️');
      expect(result).toContain('AND-only');
      expect(result).toContain('OR-based mood constraints');
    });
  });

  describe('formatSweepWarningsInline', () => {
    it('formats multiple warnings', () => {
      const warnings = [
        { message: 'Warning 1' },
        { message: 'Warning 2' },
      ];
      const result = service.formatSweepWarningsInline(warnings);
      expect(result).toContain('⚠️ Warning 1');
      expect(result).toContain('⚠️ Warning 2');
    });

    it('returns empty string for empty array', () => {
      expect(service.formatSweepWarningsInline([])).toBe('');
    });

    it('returns empty string for non-array', () => {
      expect(service.formatSweepWarningsInline(null)).toBe('');
      expect(service.formatSweepWarningsInline(undefined)).toBe('');
      expect(service.formatSweepWarningsInline('not an array')).toBe('');
    });
  });

  describe('formatFunnelClauseLabel', () => {
    it('uses description when available', () => {
      const leaf = { description: 'Test description' };
      expect(service.formatFunnelClauseLabel(leaf)).toBe('`Test description`');
    });

    it('constructs label from variablePath, operator, threshold', () => {
      const leaf = {
        variablePath: 'emotions.joy',
        comparisonOperator: '>=',
        thresholdValue: 0.5,
      };
      expect(service.formatFunnelClauseLabel(leaf)).toBe('`emotions.joy >= 0.50`');
    });

    it('handles missing fields gracefully', () => {
      const leaf = {};
      expect(service.formatFunnelClauseLabel(leaf)).toBe('`unknown ? N/A`');
    });

    it('handles non-numeric threshold', () => {
      const leaf = {
        variablePath: 'test.path',
        comparisonOperator: '==',
        thresholdValue: 'high',
      };
      expect(service.formatFunnelClauseLabel(leaf)).toBe('`test.path == high`');
    });
  });

  describe('formatClampTrivialLabel', () => {
    it('returns special label for true', () => {
      expect(service.formatClampTrivialLabel(true)).toBe(
        'Trivially satisfied (clamped)'
      );
    });

    it('returns no for false', () => {
      expect(service.formatClampTrivialLabel(false)).toBe('no');
    });

    it('returns N/A for null', () => {
      expect(service.formatClampTrivialLabel(null)).toBe('N/A');
    });
  });

  describe('formatTuningDirection', () => {
    it('returns correct directions for >= operator', () => {
      const result = service.formatTuningDirection('>=');
      expect(result).toEqual({ loosen: 'threshold down', tighten: 'threshold up' });
    });

    it('returns correct directions for > operator', () => {
      const result = service.formatTuningDirection('>');
      expect(result).toEqual({ loosen: 'threshold down', tighten: 'threshold up' });
    });

    it('returns correct directions for <= operator', () => {
      const result = service.formatTuningDirection('<=');
      expect(result).toEqual({ loosen: 'threshold up', tighten: 'threshold down' });
    });

    it('returns correct directions for < operator', () => {
      const result = service.formatTuningDirection('<');
      expect(result).toEqual({ loosen: 'threshold up', tighten: 'threshold down' });
    });

    it('returns unknown for unrecognized operators', () => {
      const result = service.formatTuningDirection('==');
      expect(result).toEqual({ loosen: 'unknown', tighten: 'unknown' });
    });
  });
});
