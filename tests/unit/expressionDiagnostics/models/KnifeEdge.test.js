/**
 * @file Unit tests for KnifeEdge model
 * @description Tests the data model representing brittle constraints where
 * the feasible interval for an axis is very narrow.
 */

import { describe, it, expect } from '@jest/globals';
import KnifeEdge from '../../../../src/expressionDiagnostics/models/KnifeEdge.js';

describe('KnifeEdge Model', () => {
  describe('Constructor Validation', () => {
    it('should throw if axis is missing', () => {
      expect(
        () =>
          new KnifeEdge({
            min: 0.1,
            max: 0.1,
          })
      ).toThrow('KnifeEdge requires non-empty axis string');
    });

    it('should throw if axis is empty string', () => {
      expect(
        () =>
          new KnifeEdge({
            axis: '',
            min: 0.1,
            max: 0.1,
          })
      ).toThrow('KnifeEdge requires non-empty axis string');
    });

    it('should throw if axis is whitespace only', () => {
      expect(
        () =>
          new KnifeEdge({
            axis: '   ',
            min: 0.1,
            max: 0.1,
          })
      ).toThrow('KnifeEdge requires non-empty axis string');
    });

    it('should throw if axis is not a string', () => {
      expect(
        () =>
          new KnifeEdge({
            axis: 123,
            min: 0.1,
            max: 0.1,
          })
      ).toThrow('KnifeEdge requires non-empty axis string');
    });

    it('should throw if min is missing', () => {
      expect(
        () =>
          new KnifeEdge({
            axis: 'agency_control',
            max: 0.1,
          })
      ).toThrow('KnifeEdge requires numeric min value');
    });

    it('should throw if min is NaN', () => {
      expect(
        () =>
          new KnifeEdge({
            axis: 'agency_control',
            min: NaN,
            max: 0.1,
          })
      ).toThrow('KnifeEdge requires numeric min value');
    });

    it('should throw if min is not a number', () => {
      expect(
        () =>
          new KnifeEdge({
            axis: 'agency_control',
            min: '0.1',
            max: 0.1,
          })
      ).toThrow('KnifeEdge requires numeric min value');
    });

    it('should throw if max is missing', () => {
      expect(
        () =>
          new KnifeEdge({
            axis: 'agency_control',
            min: 0.1,
          })
      ).toThrow('KnifeEdge requires numeric max value');
    });

    it('should throw if max is NaN', () => {
      expect(
        () =>
          new KnifeEdge({
            axis: 'agency_control',
            min: 0.1,
            max: NaN,
          })
      ).toThrow('KnifeEdge requires numeric max value');
    });

    it('should throw if max is not a number', () => {
      expect(
        () =>
          new KnifeEdge({
            axis: 'agency_control',
            min: 0.1,
            max: '0.1',
          })
      ).toThrow('KnifeEdge requires numeric max value');
    });

    it('should throw if max < min', () => {
      expect(
        () =>
          new KnifeEdge({
            axis: 'agency_control',
            min: 0.5,
            max: 0.1,
          })
      ).toThrow('KnifeEdge max (0.1) cannot be less than min (0.5)');
    });

    it('should throw if contributingPrototypes is not an array', () => {
      expect(
        () =>
          new KnifeEdge({
            axis: 'agency_control',
            min: 0.1,
            max: 0.1,
            contributingPrototypes: 'not-an-array',
          })
      ).toThrow('KnifeEdge contributingPrototypes must be an array');
    });

    it('should throw if contributingGates is not an array', () => {
      expect(
        () =>
          new KnifeEdge({
            axis: 'agency_control',
            min: 0.1,
            max: 0.1,
            contributingGates: 'not-an-array',
          })
      ).toThrow('KnifeEdge contributingGates must be an array');
    });

    it('should accept valid parameters with defaults', () => {
      const edge = new KnifeEdge({
        axis: 'agency_control',
        min: 0.1,
        max: 0.1,
      });

      expect(edge.axis).toBe('agency_control');
      expect(edge.min).toBe(0.1);
      expect(edge.max).toBe(0.1);
      expect(edge.width).toBe(0);
      expect(edge.contributingPrototypes).toEqual([]);
      expect(edge.contributingGates).toEqual([]);
    });

    it('should accept all optional parameters', () => {
      const edge = new KnifeEdge({
        axis: 'agency_control',
        min: 0.1,
        max: 0.1,
        contributingPrototypes: ['flow', 'entrancement'],
        contributingGates: ['agency_control >= 0.10', 'agency_control <= 0.10'],
      });

      expect(edge.contributingPrototypes).toEqual(['flow', 'entrancement']);
      expect(edge.contributingGates).toEqual([
        'agency_control >= 0.10',
        'agency_control <= 0.10',
      ]);
    });

    it('should calculate width correctly', () => {
      const edge = new KnifeEdge({
        axis: 'arousal',
        min: 0.25,
        max: 0.6,
      });

      expect(edge.width).toBeCloseTo(0.35, 10);
    });

    it('should accept zero as valid min and max', () => {
      const edge = new KnifeEdge({
        axis: 'valence',
        min: 0,
        max: 0,
      });

      expect(edge.min).toBe(0);
      expect(edge.max).toBe(0);
      expect(edge.width).toBe(0);
    });

    it('should accept negative values', () => {
      const edge = new KnifeEdge({
        axis: 'valence',
        min: -0.5,
        max: 0.5,
      });

      expect(edge.min).toBe(-0.5);
      expect(edge.max).toBe(0.5);
      expect(edge.width).toBe(1.0);
    });
  });

  describe('Getters', () => {
    it('axis getter returns correct value', () => {
      const edge = new KnifeEdge({
        axis: 'engagement',
        min: 0.4,
        max: 0.45,
      });
      expect(edge.axis).toBe('engagement');
    });

    it('min getter returns correct value', () => {
      const edge = new KnifeEdge({
        axis: 'arousal',
        min: 0.25,
        max: 0.6,
      });
      expect(edge.min).toBe(0.25);
    });

    it('max getter returns correct value', () => {
      const edge = new KnifeEdge({
        axis: 'arousal',
        min: 0.25,
        max: 0.6,
      });
      expect(edge.max).toBe(0.6);
    });

    it('width getter returns correct value (max - min)', () => {
      const edge = new KnifeEdge({
        axis: 'arousal',
        min: 0.25,
        max: 0.6,
      });
      expect(edge.width).toBeCloseTo(0.35, 10);
    });
  });

  describe('Getters - Immutability', () => {
    it('contributingPrototypes getter returns copy, not reference', () => {
      const originalProtos = ['flow', 'entrancement'];
      const edge = new KnifeEdge({
        axis: 'agency_control',
        min: 0.1,
        max: 0.1,
        contributingPrototypes: originalProtos,
      });

      const returned1 = edge.contributingPrototypes;
      const returned2 = edge.contributingPrototypes;

      expect(returned1).not.toBe(returned2);
      expect(returned1).not.toBe(originalProtos);
      expect(returned1).toEqual(originalProtos);

      // Mutating returned array should not affect internal state
      returned1.push('mutated');
      expect(edge.contributingPrototypes).toEqual(['flow', 'entrancement']);
    });

    it('contributingGates getter returns copy, not reference', () => {
      const originalGates = ['agency_control >= 0.10', 'agency_control <= 0.10'];
      const edge = new KnifeEdge({
        axis: 'agency_control',
        min: 0.1,
        max: 0.1,
        contributingGates: originalGates,
      });

      const returned1 = edge.contributingGates;
      const returned2 = edge.contributingGates;

      expect(returned1).not.toBe(returned2);
      expect(returned1).not.toBe(originalGates);
      expect(returned1).toEqual(originalGates);

      // Mutating returned array should not affect internal state
      returned1.push('mutated');
      expect(edge.contributingGates).toEqual([
        'agency_control >= 0.10',
        'agency_control <= 0.10',
      ]);
    });
  });

  describe('isPoint Property', () => {
    it('returns true when width is 0', () => {
      const edge = new KnifeEdge({
        axis: 'agency_control',
        min: 0.1,
        max: 0.1,
      });
      expect(edge.isPoint).toBe(true);
    });

    it('returns false when width > 0', () => {
      const edge = new KnifeEdge({
        axis: 'agency_control',
        min: 0.1,
        max: 0.11,
      });
      expect(edge.isPoint).toBe(false);
    });

    it('returns false for very small but non-zero width', () => {
      const edge = new KnifeEdge({
        axis: 'agency_control',
        min: 0.1,
        max: 0.1001,
      });
      expect(edge.isPoint).toBe(false);
    });
  });

  describe('isBelowThreshold()', () => {
    it('returns true when below default threshold', () => {
      const edge = new KnifeEdge({
        axis: 'agency_control',
        min: 0.1,
        max: 0.11, // width = 0.01, default threshold = 0.02
      });
      expect(edge.isBelowThreshold()).toBe(true);
    });

    it('returns true when equal to default threshold', () => {
      const edge = new KnifeEdge({
        axis: 'agency_control',
        min: 0.1,
        max: 0.12, // width = 0.02, equals default threshold
      });
      expect(edge.isBelowThreshold()).toBe(true);
    });

    it('returns false when above default threshold', () => {
      const edge = new KnifeEdge({
        axis: 'agency_control',
        min: 0.1,
        max: 0.15, // width = 0.05, above default threshold of 0.02
      });
      expect(edge.isBelowThreshold()).toBe(false);
    });

    it('uses custom threshold when provided', () => {
      const edge = new KnifeEdge({
        axis: 'agency_control',
        min: 0.1,
        max: 0.15, // width = 0.05
      });
      expect(edge.isBelowThreshold(0.1)).toBe(true);
      expect(edge.isBelowThreshold(0.04)).toBe(false);
    });

    it('returns true for zero-width with any threshold', () => {
      const edge = new KnifeEdge({
        axis: 'agency_control',
        min: 0.1,
        max: 0.1,
      });
      expect(edge.isBelowThreshold(0.001)).toBe(true);
      expect(edge.isBelowThreshold(0)).toBe(true);
    });
  });

  describe('severity Property', () => {
    it("returns 'critical' for width 0", () => {
      const edge = new KnifeEdge({
        axis: 'agency_control',
        min: 0.1,
        max: 0.1,
      });
      expect(edge.severity).toBe('critical');
    });

    it("returns 'warning' for width <= 0.01", () => {
      const edge = new KnifeEdge({
        axis: 'agency_control',
        min: 0.1,
        max: 0.11, // width = 0.01
      });
      expect(edge.severity).toBe('warning');
    });

    it("returns 'warning' for width exactly 0.01", () => {
      const edge = new KnifeEdge({
        axis: 'agency_control',
        min: 0.0,
        max: 0.01,
      });
      expect(edge.severity).toBe('warning');
    });

    it("returns 'warning' for small non-zero width", () => {
      const edge = new KnifeEdge({
        axis: 'agency_control',
        min: 0.1,
        max: 0.105, // width = 0.005
      });
      expect(edge.severity).toBe('warning');
    });

    it("returns 'info' for width > 0.01", () => {
      const edge = new KnifeEdge({
        axis: 'agency_control',
        min: 0.1,
        max: 0.12, // width = 0.02
      });
      expect(edge.severity).toBe('info');
    });

    it("returns 'info' for larger widths", () => {
      const edge = new KnifeEdge({
        axis: 'arousal',
        min: 0.25,
        max: 0.6, // width = 0.35
      });
      expect(edge.severity).toBe('info');
    });
  });

  describe('formatInterval()', () => {
    it('returns "exactly X" for point constraints', () => {
      const edge = new KnifeEdge({
        axis: 'agency_control',
        min: 0.1,
        max: 0.1,
      });
      expect(edge.formatInterval()).toBe('exactly 0.10');
    });

    it('returns "[min, max]" for ranges', () => {
      const edge = new KnifeEdge({
        axis: 'arousal',
        min: 0.25,
        max: 0.6,
      });
      expect(edge.formatInterval()).toBe('[0.25, 0.60]');
    });

    it('formats with two decimal places', () => {
      const edge = new KnifeEdge({
        axis: 'engagement',
        min: 0.1234,
        max: 0.5678,
      });
      expect(edge.formatInterval()).toBe('[0.12, 0.57]');
    });

    it('handles negative values', () => {
      const edge = new KnifeEdge({
        axis: 'valence',
        min: -0.5,
        max: 0.5,
      });
      expect(edge.formatInterval()).toBe('[-0.50, 0.50]');
    });

    it('handles zero values', () => {
      const edge = new KnifeEdge({
        axis: 'valence',
        min: 0,
        max: 0,
      });
      expect(edge.formatInterval()).toBe('exactly 0.00');
    });
  });

  describe('formatContributors()', () => {
    it('returns "unknown" when no prototypes', () => {
      const edge = new KnifeEdge({
        axis: 'agency_control',
        min: 0.1,
        max: 0.1,
        contributingPrototypes: [],
      });
      expect(edge.formatContributors()).toBe('unknown');
    });

    it('returns single prototype without separator', () => {
      const edge = new KnifeEdge({
        axis: 'agency_control',
        min: 0.1,
        max: 0.1,
        contributingPrototypes: ['flow'],
      });
      expect(edge.formatContributors()).toBe('flow');
    });

    it('joins prototypes with " ∧ " (logical AND)', () => {
      const edge = new KnifeEdge({
        axis: 'agency_control',
        min: 0.1,
        max: 0.1,
        contributingPrototypes: ['flow', 'entrancement'],
      });
      expect(edge.formatContributors()).toBe('flow \u2227 entrancement');
    });

    it('joins multiple prototypes correctly', () => {
      const edge = new KnifeEdge({
        axis: 'engagement',
        min: 0.4,
        max: 0.45,
        contributingPrototypes: ['flow', 'interest', 'fascination'],
      });
      expect(edge.formatContributors()).toBe(
        'flow \u2227 interest \u2227 fascination'
      );
    });
  });

  describe('toJSON()', () => {
    it('includes all properties', () => {
      const edge = new KnifeEdge({
        axis: 'agency_control',
        min: 0.1,
        max: 0.1,
        contributingPrototypes: ['flow', 'entrancement'],
        contributingGates: ['agency_control >= 0.10', 'agency_control <= 0.10'],
      });

      const json = edge.toJSON();

      expect(json.axis).toBe('agency_control');
      expect(json.min).toBe(0.1);
      expect(json.max).toBe(0.1);
      expect(json.width).toBe(0);
      expect(json.contributingPrototypes).toEqual(['flow', 'entrancement']);
      expect(json.contributingGates).toEqual([
        'agency_control >= 0.10',
        'agency_control <= 0.10',
      ]);
    });

    it('includes calculated severity', () => {
      const criticalEdge = new KnifeEdge({
        axis: 'agency_control',
        min: 0.1,
        max: 0.1,
      });
      expect(criticalEdge.toJSON().severity).toBe('critical');

      const warningEdge = new KnifeEdge({
        axis: 'agency_control',
        min: 0.1,
        max: 0.11,
      });
      expect(warningEdge.toJSON().severity).toBe('warning');

      const infoEdge = new KnifeEdge({
        axis: 'agency_control',
        min: 0.1,
        max: 0.15,
      });
      expect(infoEdge.toJSON().severity).toBe('info');
    });

    it('is JSON.stringify compatible', () => {
      const edge = new KnifeEdge({
        axis: 'agency_control',
        min: 0.1,
        max: 0.1,
        contributingPrototypes: ['flow'],
      });

      const str = JSON.stringify(edge);
      expect(() => JSON.parse(str)).not.toThrow();

      const parsed = JSON.parse(str);
      expect(parsed.axis).toBe('agency_control');
      expect(parsed.severity).toBe('critical');
    });

    it('returns deep copies of arrays', () => {
      const edge = new KnifeEdge({
        axis: 'agency_control',
        min: 0.1,
        max: 0.1,
        contributingPrototypes: ['flow'],
        contributingGates: ['gate1'],
      });

      const json1 = edge.toJSON();
      const json2 = edge.toJSON();

      expect(json1.contributingPrototypes).not.toBe(
        json2.contributingPrototypes
      );
      expect(json1.contributingGates).not.toBe(json2.contributingGates);
    });
  });

  describe('fromJSON()', () => {
    it('reconstructs KnifeEdge correctly', () => {
      const original = new KnifeEdge({
        axis: 'agency_control',
        min: 0.1,
        max: 0.1,
        contributingPrototypes: ['flow', 'entrancement'],
        contributingGates: ['agency_control >= 0.10', 'agency_control <= 0.10'],
      });

      const json = original.toJSON();
      const reconstructed = KnifeEdge.fromJSON(json);

      expect(reconstructed.axis).toBe('agency_control');
      expect(reconstructed.min).toBe(0.1);
      expect(reconstructed.max).toBe(0.1);
      expect(reconstructed.width).toBe(0);
      expect(reconstructed.contributingPrototypes).toEqual([
        'flow',
        'entrancement',
      ]);
      expect(reconstructed.contributingGates).toEqual([
        'agency_control >= 0.10',
        'agency_control <= 0.10',
      ]);
      expect(reconstructed.severity).toBe('critical');
    });

    it('handles missing optional arrays', () => {
      const json = {
        axis: 'arousal',
        min: 0.25,
        max: 0.6,
      };

      const edge = KnifeEdge.fromJSON(json);

      expect(edge.axis).toBe('arousal');
      expect(edge.min).toBe(0.25);
      expect(edge.max).toBe(0.6);
      expect(edge.contributingPrototypes).toEqual([]);
      expect(edge.contributingGates).toEqual([]);
    });

    it('roundtrips through JSON correctly', () => {
      const original = new KnifeEdge({
        axis: 'engagement',
        min: 0.4,
        max: 0.45,
        contributingPrototypes: ['flow', 'interest'],
        contributingGates: ['engagement >= 0.40'],
      });

      const serialized = JSON.stringify(original.toJSON());
      const parsed = JSON.parse(serialized);
      const reconstructed = KnifeEdge.fromJSON(parsed);

      expect(reconstructed.axis).toBe(original.axis);
      expect(reconstructed.min).toBe(original.min);
      expect(reconstructed.max).toBe(original.max);
      expect(reconstructed.width).toBe(original.width);
      expect(reconstructed.contributingPrototypes).toEqual(
        original.contributingPrototypes
      );
      expect(reconstructed.contributingGates).toEqual(
        original.contributingGates
      );
    });
  });

  describe('toWarningMessage()', () => {
    it('includes severity emoji - critical', () => {
      const edge = new KnifeEdge({
        axis: 'agency_control',
        min: 0.1,
        max: 0.1,
        contributingPrototypes: ['flow', 'entrancement'],
      });

      const msg = edge.toWarningMessage();
      expect(msg).toContain('\uD83D\uDD34'); // Red circle
    });

    it('includes severity emoji - warning', () => {
      const edge = new KnifeEdge({
        axis: 'agency_control',
        min: 0.1,
        max: 0.11,
        contributingPrototypes: ['flow'],
      });

      const msg = edge.toWarningMessage();
      expect(msg).toContain('\uD83D\uDFE1'); // Yellow circle
    });

    it('includes severity emoji - info', () => {
      const edge = new KnifeEdge({
        axis: 'agency_control',
        min: 0.1,
        max: 0.15,
        contributingPrototypes: ['flow'],
      });

      const msg = edge.toWarningMessage();
      expect(msg).toContain('\uD83D\uDD35'); // Blue circle
    });

    it('includes all information', () => {
      const edge = new KnifeEdge({
        axis: 'agency_control',
        min: 0.1,
        max: 0.1,
        contributingPrototypes: ['flow', 'entrancement'],
      });

      const msg = edge.toWarningMessage();
      expect(msg).toContain('agency_control');
      expect(msg).toContain('must be exactly 0.10 (10 in game values)');
      expect(msg).toContain('width: 0.000');
      expect(msg).toContain('flow \u2227 entrancement');
    });

    it('shows "unknown" when no contributors', () => {
      const edge = new KnifeEdge({
        axis: 'arousal',
        min: 0.25,
        max: 0.6,
      });

      const msg = edge.toWarningMessage();
      expect(msg).toContain('caused by: unknown');
    });
  });

  describe('toDisplayObject()', () => {
    it('returns UI-ready format', () => {
      const edge = new KnifeEdge({
        axis: 'agency_control',
        min: 0.1,
        max: 0.1,
        contributingPrototypes: ['flow', 'entrancement'],
        contributingGates: ['agency_control >= 0.10', 'agency_control <= 0.10'],
      });

      const display = edge.toDisplayObject();

      expect(display).toEqual({
        axis: 'agency_control',
        interval: 'exactly 0.10',
        intervalDualScale: 'exactly 0.10 (raw: 10)',
        width: '0.000',
        rawWidth: 0,
        min: 0.1,
        max: 0.1,
        rawMin: 10,
        rawMax: 10,
        cause: 'flow \u2227 entrancement',
        gates: ['agency_control >= 0.10', 'agency_control <= 0.10'],
        severity: 'critical',
      });
    });

    it('includes range interval format for non-point', () => {
      const edge = new KnifeEdge({
        axis: 'arousal',
        min: 0.25,
        max: 0.6,
      });

      const display = edge.toDisplayObject();

      expect(display.interval).toBe('[0.25, 0.60]');
      expect(display.intervalDualScale).toBe('[0.25, 0.60] (raw: [25, 60])');
      expect(display.width).toBe('0.350');
      expect(display.rawWidth).toBe(35);
      expect(display.severity).toBe('info');
    });

    it('includes empty gates array when none provided', () => {
      const edge = new KnifeEdge({
        axis: 'engagement',
        min: 0.4,
        max: 0.45,
      });

      const display = edge.toDisplayObject();
      expect(display.gates).toEqual([]);
    });
  });

  describe('Static DEFAULT_THRESHOLD', () => {
    it('is 0.02', () => {
      expect(KnifeEdge.DEFAULT_THRESHOLD).toBe(0.02);
    });

    it('is used by isBelowThreshold default', () => {
      // Edge with width exactly at threshold
      const atThreshold = new KnifeEdge({
        axis: 'test',
        min: 0,
        max: KnifeEdge.DEFAULT_THRESHOLD,
      });
      expect(atThreshold.isBelowThreshold()).toBe(true);

      // Edge with width just above threshold
      const aboveThreshold = new KnifeEdge({
        axis: 'test',
        min: 0,
        max: KnifeEdge.DEFAULT_THRESHOLD + 0.001,
      });
      expect(aboveThreshold.isBelowThreshold()).toBe(false);
    });
  });

  describe('Raw Scale Conversion', () => {
    describe('rawMin getter', () => {
      it('converts normalized min to raw scale (×100)', () => {
        const edge = new KnifeEdge({
          axis: 'agency_control',
          min: 0.1,
          max: 0.2,
        });
        expect(edge.rawMin).toBe(10);
      });

      it('handles negative values', () => {
        const edge = new KnifeEdge({
          axis: 'valence',
          min: -0.5,
          max: 0.5,
        });
        expect(edge.rawMin).toBe(-50);
      });

      it('handles zero', () => {
        const edge = new KnifeEdge({
          axis: 'arousal',
          min: 0,
          max: 0.5,
        });
        expect(edge.rawMin).toBe(0);
      });

      it('handles full range boundary', () => {
        const edge = new KnifeEdge({
          axis: 'valence',
          min: -1,
          max: 1,
        });
        expect(edge.rawMin).toBe(-100);
      });
    });

    describe('rawMax getter', () => {
      it('converts normalized max to raw scale (×100)', () => {
        const edge = new KnifeEdge({
          axis: 'agency_control',
          min: 0.1,
          max: 0.2,
        });
        expect(edge.rawMax).toBe(20);
      });

      it('handles full range boundary', () => {
        const edge = new KnifeEdge({
          axis: 'valence',
          min: -1,
          max: 1,
        });
        expect(edge.rawMax).toBe(100);
      });
    });

    describe('rawWidth getter', () => {
      it('converts normalized width to raw scale (×100)', () => {
        const edge = new KnifeEdge({
          axis: 'arousal',
          min: 0.25,
          max: 0.6,
        });
        expect(edge.rawWidth).toBeCloseTo(35, 10);
      });

      it('returns 0 for point constraints', () => {
        const edge = new KnifeEdge({
          axis: 'agency_control',
          min: 0.1,
          max: 0.1,
        });
        expect(edge.rawWidth).toBe(0);
      });

      it('handles full range', () => {
        const edge = new KnifeEdge({
          axis: 'valence',
          min: -1,
          max: 1,
        });
        expect(edge.rawWidth).toBe(200);
      });
    });

    describe('static toRawScale()', () => {
      it('converts normalized value to raw (×100)', () => {
        expect(KnifeEdge.toRawScale(0.1)).toBe(10);
        expect(KnifeEdge.toRawScale(0.5)).toBe(50);
        expect(KnifeEdge.toRawScale(1.0)).toBe(100);
      });

      it('handles negative values', () => {
        expect(KnifeEdge.toRawScale(-0.5)).toBe(-50);
        expect(KnifeEdge.toRawScale(-1.0)).toBe(-100);
      });

      it('handles zero', () => {
        expect(KnifeEdge.toRawScale(0)).toBe(0);
      });

      it('handles fractional results', () => {
        expect(KnifeEdge.toRawScale(0.123)).toBeCloseTo(12.3, 10);
      });
    });
  });

  describe('formatDualScaleInterval()', () => {
    it('shows "exactly X (raw: Y)" for point constraints', () => {
      const edge = new KnifeEdge({
        axis: 'agency_control',
        min: 0.1,
        max: 0.1,
      });
      expect(edge.formatDualScaleInterval()).toBe('exactly 0.10 (raw: 10)');
    });

    it('shows "[min, max] (raw: [rawMin, rawMax])" for ranges', () => {
      const edge = new KnifeEdge({
        axis: 'arousal',
        min: 0.25,
        max: 0.6,
      });
      expect(edge.formatDualScaleInterval()).toBe(
        '[0.25, 0.60] (raw: [25, 60])'
      );
    });

    it('handles negative values', () => {
      const edge = new KnifeEdge({
        axis: 'valence',
        min: -0.5,
        max: 0.5,
      });
      expect(edge.formatDualScaleInterval()).toBe(
        '[-0.50, 0.50] (raw: [-50, 50])'
      );
    });

    it('handles zero point constraint', () => {
      const edge = new KnifeEdge({
        axis: 'valence',
        min: 0,
        max: 0,
      });
      expect(edge.formatDualScaleInterval()).toBe('exactly 0.00 (raw: 0)');
    });

    it('rounds raw values to integers', () => {
      const edge = new KnifeEdge({
        axis: 'engagement',
        min: 0.123,
        max: 0.567,
      });
      // 0.123 * 100 = 12.3 → 12
      // 0.567 * 100 = 56.7 → 57
      expect(edge.formatDualScaleInterval()).toBe(
        '[0.12, 0.57] (raw: [12, 57])'
      );
    });
  });

  describe('Enhanced toWarningMessage()', () => {
    it('includes raw game values for point constraints', () => {
      const edge = new KnifeEdge({
        axis: 'agency_control',
        min: 0.1,
        max: 0.1,
        contributingPrototypes: ['confidence'],
      });

      const msg = edge.toWarningMessage();
      expect(msg).toContain('must be exactly 0.10 (10 in game values)');
      expect(msg).toContain('agency_control');
      expect(msg).toContain('width: 0.000');
      expect(msg).toContain('caused by: confidence');
    });

    it('includes raw game values for range constraints', () => {
      const edge = new KnifeEdge({
        axis: 'arousal',
        min: 0.25,
        max: 0.6,
        contributingPrototypes: ['flow', 'interest'],
      });

      const msg = edge.toWarningMessage();
      expect(msg).toContain(
        'must be in [0.25, 0.60] (25 to 60 in game values)'
      );
      expect(msg).toContain('arousal');
      expect(msg).toContain('flow \u2227 interest');
    });

    it('handles negative values in raw format', () => {
      const edge = new KnifeEdge({
        axis: 'valence',
        min: -0.5,
        max: 0.5,
        contributingPrototypes: ['balance'],
      });

      const msg = edge.toWarningMessage();
      expect(msg).toContain(
        'must be in [-0.50, 0.50] (-50 to 50 in game values)'
      );
    });
  });

  describe('Enhanced toDisplayObject()', () => {
    it('includes intervalDualScale property', () => {
      const edge = new KnifeEdge({
        axis: 'agency_control',
        min: 0.1,
        max: 0.1,
        contributingPrototypes: ['flow'],
      });

      const display = edge.toDisplayObject();
      expect(display.intervalDualScale).toBe('exactly 0.10 (raw: 10)');
    });

    it('includes raw min, max, and width', () => {
      const edge = new KnifeEdge({
        axis: 'arousal',
        min: 0.25,
        max: 0.6,
      });

      const display = edge.toDisplayObject();
      expect(display.rawMin).toBe(25);
      expect(display.rawMax).toBe(60);
      expect(display.rawWidth).toBe(35);
    });

    it('includes normalized min and max', () => {
      const edge = new KnifeEdge({
        axis: 'engagement',
        min: 0.4,
        max: 0.45,
      });

      const display = edge.toDisplayObject();
      expect(display.min).toBe(0.4);
      expect(display.max).toBe(0.45);
    });

    it('includes all expected properties', () => {
      const edge = new KnifeEdge({
        axis: 'agency_control',
        min: 0.1,
        max: 0.1,
        contributingPrototypes: ['flow', 'entrancement'],
        contributingGates: ['agency_control >= 0.10', 'agency_control <= 0.10'],
      });

      const display = edge.toDisplayObject();

      expect(display).toEqual({
        axis: 'agency_control',
        interval: 'exactly 0.10',
        intervalDualScale: 'exactly 0.10 (raw: 10)',
        width: '0.000',
        rawWidth: 0,
        min: 0.1,
        max: 0.1,
        rawMin: 10,
        rawMax: 10,
        cause: 'flow \u2227 entrancement',
        gates: ['agency_control >= 0.10', 'agency_control <= 0.10'],
        severity: 'critical',
      });
    });
  });

  describe('Enhanced toJSON()', () => {
    it('includes rawMin and rawMax', () => {
      const edge = new KnifeEdge({
        axis: 'agency_control',
        min: 0.1,
        max: 0.2,
      });

      const json = edge.toJSON();
      expect(json.rawMin).toBe(10);
      expect(json.rawMax).toBe(20);
    });

    it('includes rawWidth', () => {
      const edge = new KnifeEdge({
        axis: 'arousal',
        min: 0.25,
        max: 0.6,
      });

      const json = edge.toJSON();
      expect(json.rawWidth).toBe(35);
    });

    it('rounds raw values to integers', () => {
      const edge = new KnifeEdge({
        axis: 'engagement',
        min: 0.123,
        max: 0.567,
      });

      const json = edge.toJSON();
      // 0.123 * 100 = 12.3 → 12
      // 0.567 * 100 = 56.7 → 57
      // width = 0.444 * 100 = 44.4 → 44
      expect(json.rawMin).toBe(12);
      expect(json.rawMax).toBe(57);
      expect(json.rawWidth).toBe(44);
    });

    it('includes all properties in serialized format', () => {
      const edge = new KnifeEdge({
        axis: 'agency_control',
        min: 0.1,
        max: 0.1,
        contributingPrototypes: ['flow'],
        contributingGates: ['agency_control >= 0.10'],
      });

      const json = edge.toJSON();

      expect(json).toEqual({
        axis: 'agency_control',
        min: 0.1,
        max: 0.1,
        rawMin: 10,
        rawMax: 10,
        width: 0,
        rawWidth: 0,
        contributingPrototypes: ['flow'],
        contributingGates: ['agency_control >= 0.10'],
        severity: 'critical',
      });
    });
  });
});
